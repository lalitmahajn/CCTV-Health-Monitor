import json
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, UploadFile, File, Response, BackgroundTasks
from pydantic import BaseModel
from app.models import CameraRepository, IncidentRepository, SettingsRepository
from app.csv_utils import parse_and_validate_csv, generate_csv_template, export_cameras_to_csv
from app.simulator import seed_270_cameras

class CameraCreate(BaseModel):
    name: str
    dvr_nvr_name: Optional[str] = ""
    location: Optional[str] = ""
    ip_address: str
    port: Optional[int] = 554
    channel_no: Optional[str] = ""
    rtsp_url: str
    is_enabled: Optional[bool] = True

class CameraUpdate(BaseModel):
    name: Optional[str] = None
    dvr_nvr_name: Optional[str] = None
    location: Optional[str] = None
    ip_address: Optional[str] = None
    port: Optional[int] = None
    channel_no: Optional[str] = None
    rtsp_url: Optional[str] = None
    is_enabled: Optional[bool] = None

class OutageSimulate(BaseModel):
    camera_id: int
    error_reason: Optional[str] = "Simulated Connection Timeout"

def setup_routes(app):
    router = APIRouter()
    cam_repo = CameraRepository(app.state.db_path)
    inc_repo = IncidentRepository(app.state.db_path)
    settings_repo = SettingsRepository(app.state.db_path)
    engine = app.state.engine
    alert_mgr = app.state.alert_manager
    web_notifier = app.state.web_notifier

    @router.get("/cameras")
    async def get_cameras(enabled_only: bool = False):
        return await cam_repo.get_all(enabled_only=enabled_only)

    @router.post("/cameras", status_code=201)
    async def create_camera(payload: CameraCreate):
        cam_id = await cam_repo.create(
            name=payload.name,
            dvr_nvr_name=payload.dvr_nvr_name or "",
            location=payload.location or "",
            ip_address=payload.ip_address,
            port=payload.port or 554,
            channel_no=payload.channel_no or "",
            rtsp_url=payload.rtsp_url,
            is_enabled=payload.is_enabled if payload.is_enabled is not None else True
        )
        return {"id": cam_id, "message": "Camera created successfully"}

    @router.get("/cameras/{camera_id}")
    async def get_camera(camera_id: int):
        cam = await cam_repo.get_by_id(camera_id)
        if not cam:
            raise HTTPException(status_code=404, detail="Camera not found")
        return cam

    @router.put("/cameras/{camera_id}")
    async def update_camera(camera_id: int, payload: CameraUpdate):
        fields = {k: v for k, v in payload.dict().items() if v is not None}
        ok = await cam_repo.update(camera_id, **fields)
        if not ok:
            raise HTTPException(status_code=400, detail="Update failed or no valid fields provided")
        return {"message": "Camera updated"}

    @router.delete("/cameras/{camera_id}")
    async def delete_camera(camera_id: int):
        ok = await cam_repo.delete(camera_id)
        if not ok:
            raise HTTPException(status_code=404, detail="Camera not found")
        return {"message": "Camera deleted"}

    @router.post("/cameras/{camera_id}/check")
    async def manual_check_camera(camera_id: int):
        res = await engine.check_single_camera(camera_id)
        return {
            "camera_id": res.camera_id,
            "status": res.new_status,
            "message": res.message,
            "consecutive_failures": res.consecutive_failures
        }

    @router.post("/cameras/scan-all")
    async def scan_all_cameras(background_tasks: BackgroundTasks):
        """
        Triggers a full scan of all 266 cameras concurrently using the per-host throttler.
        """
        async def _run_full_scan():
            cameras = await cam_repo.get_all(enabled_only=True)
            tasks = [engine.check_single_camera(c["id"]) for c in cameras]
            import asyncio
            await asyncio.gather(*tasks, return_exceptions=True)

        background_tasks.add_task(_run_full_scan)
        return {"message": "Full fleet scan started in background"}

    # --- CSV Import & Export ---

    @router.get("/cameras/csv/template")
    async def get_csv_template():
        content = generate_csv_template()
        return Response(content=content, media_type="text/csv", headers={
            "Content-Disposition": "attachment; filename=cctv_template.csv"
        })

    @router.get("/cameras/csv/export")
    async def export_cameras_csv():
        cams = await cam_repo.get_all()
        content = export_cameras_to_csv(cams)
        return Response(content=content, media_type="text/csv", headers={
            "Content-Disposition": "attachment; filename=cctv_cameras_export.csv"
        })

    @router.post("/cameras/csv/import")
    async def import_cameras_csv(file: UploadFile = File(...)):
        content_bytes = await file.read()
        content_str = content_bytes.decode("utf-8", errors="replace")
        valid_rows, errors = parse_and_validate_csv(content_str)
        
        imported_count = 0
        for r in valid_rows:
            await cam_repo.create(
                name=r["name"],
                dvr_nvr_name=r["dvr_nvr_name"],
                location=r["location"],
                ip_address=r["ip_address"],
                port=r["port"],
                channel_no=r["channel_no"],
                rtsp_url=r["rtsp_url"],
                is_enabled=r["is_enabled"]
            )
            imported_count += 1
            
        return {
            "imported_count": imported_count,
            "errors": errors
        }

    # --- Incidents ---

    @router.get("/incidents")
    async def get_incidents(limit: int = 100):
        active = await inc_repo.get_active()
        history = await inc_repo.get_history(limit=limit)
        return {"active": active, "history": history}

    @router.post("/incidents/{incident_id}/ack")
    async def acknowledge_incident(incident_id: int):
        ok = await inc_repo.acknowledge(incident_id)
        if not ok:
            raise HTTPException(status_code=404, detail="Incident not found")
        return {"message": "Incident acknowledged"}

    # --- Settings ---

    @router.get("/settings")
    async def get_settings():
        return await settings_repo.get_all()

    @router.post("/settings")
    async def update_settings(payload: Dict[str, str]):
        await settings_repo.update_many(payload)
        return {"message": "Settings updated"}

    # --- Simulator ---

    @router.post("/simulator/seed-270")
    async def seed_simulation():
        count = await seed_270_cameras(cam_repo, clear_existing=True)
        return {"message": f"Successfully created {count} cameras", "count": count}

    @router.post("/simulator/simulate-outage")
    async def simulate_outage(payload: OutageSimulate):
        cam = await cam_repo.get_by_id(payload.camera_id)
        if not cam:
            raise HTTPException(status_code=404, detail="Camera not found")
        # Force offline transition and incident opening
        inc_id = await inc_repo.open_incident(payload.camera_id, payload.error_reason)
        await cam_repo.update_status(
            camera_id=payload.camera_id,
            status="OFFLINE",
            consecutive_failures=3,
            latency_ms=0.0,
            last_error=payload.error_reason
        )
        if alert_mgr:
            await alert_mgr.dispatch_outage(cam, {"id": inc_id, "error_reason": payload.error_reason})
        return {"message": f"Simulated outage on camera {payload.camera_id}", "incident_id": inc_id}

    app.include_router(router, prefix="/api")
