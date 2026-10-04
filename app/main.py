import os
import sys
import json
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from app.database import init_db
from app.engine import MonitoringEngine
from app.alerts import AlertManager, WebAlertNotifier, EmailAlertNotifier, TelegramAlertNotifier
from app.routes import setup_routes
from app.paths import get_db_path, get_data_dir, get_snapshots_dir

def create_app(db_path: str = None) -> FastAPI:
    app_db = db_path or get_db_path()
    
    alert_manager = AlertManager()
    web_notifier = WebAlertNotifier()
    alert_manager.register(web_notifier)
    alert_manager.register(EmailAlertNotifier(db_path=app_db))
    alert_manager.register(TelegramAlertNotifier())

    async def alert_callback(camera, transition):
        if transition.opened_incident_id:
            await alert_manager.dispatch_outage(camera, {
                "id": transition.opened_incident_id,
                "error_reason": transition.message
            })
        elif transition.closed_incident_id:
            await alert_manager.dispatch_recovery(camera, {
                "id": transition.closed_incident_id,
                "duration_seconds": transition.duration_seconds
            }, duration_seconds=transition.duration_seconds or 0)
        else:
            # Minor status update
            await web_notifier.broadcast_event("CAMERA_UPDATE", {
                "camera_id": camera["id"],
                "status": transition.new_status,
                "consecutive_failures": transition.consecutive_failures
            })

    engine = MonitoringEngine(db_path=app_db, alert_callback=alert_callback)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        await init_db(app_db)
        await engine.start()
        yield
        await engine.stop()

    import time
    app = FastAPI(title="CCTV Health Monitoring System", lifespan=lifespan)
    app.state.db_path = app_db
    app.state.engine = engine
    app.state.alert_manager = alert_manager
    app.state.web_notifier = web_notifier
    app.state.start_time = time.time()

    setup_routes(app)

    # SSE Event Stream endpoint
    from fastapi import Depends
    from app.auth import require_admin
    @app.get("/api/events", dependencies=[Depends(require_admin)])
    async def sse_events():
        async def event_generator():
            q = web_notifier.subscribe()
            try:
                # Send initial ping event
                yield f"data: {json.dumps({'type': 'CONNECTED'})}\n\n"
                while True:
                    msg = await q.get()
                    yield f"data: {json.dumps(msg)}\n\n"
            finally:
                web_notifier.unsubscribe(q)

        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no"
            }
        )

    # Static files and frontend SPA mounting
    data_dir = get_data_dir()
    static_dir = os.path.join(data_dir, "static")
    snapshots_dir = get_snapshots_dir()
    os.makedirs(static_dir, exist_ok=True)
    os.makedirs(snapshots_dir, exist_ok=True)

    if getattr(sys, "frozen", False):
        exe_dir = os.path.dirname(sys.executable)
        bundle_dir = getattr(sys, "_MEIPASS", os.path.join(exe_dir, "_internal"))
        frontend_dist = os.path.join(bundle_dir, "frontend", "dist")
    else:
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        frontend_dist = os.path.join(base_dir, "frontend", "dist")

    if os.path.exists(static_dir):
        app.mount("/static", StaticFiles(directory=static_dir), name="static")

    if os.path.exists(frontend_dist):
        assets_dir = os.path.join(frontend_dist, "assets")
        if os.path.exists(assets_dir):
            app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

        @app.get("/")
        async def serve_frontend():
            index_path = os.path.join(frontend_dist, "index.html")
            return FileResponse(index_path)
    elif os.path.exists(static_dir):
        @app.get("/")
        async def serve_legacy_index():
            index_path = os.path.join(static_dir, "index.html")
            if os.path.exists(index_path):
                return FileResponse(index_path)
            return {"message": "CCTV Health Monitoring API running. Static UI not yet created."}

    return app

app = create_app()
