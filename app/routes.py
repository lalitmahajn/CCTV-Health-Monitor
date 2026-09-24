import json
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, UploadFile, File, Response, BackgroundTasks
from pydantic import BaseModel
from app.models import CameraRepository, NvrRepository, IncidentRepository, SettingsRepository
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
    is_no_cam: Optional[bool] = False

class CameraUpdate(BaseModel):
    name: Optional[str] = None
    dvr_nvr_name: Optional[str] = None
    location: Optional[str] = None
    ip_address: Optional[str] = None
    port: Optional[int] = None
    channel_no: Optional[str] = None
    rtsp_url: Optional[str] = None
    is_enabled: Optional[bool] = None
    is_no_cam: Optional[bool] = None

class OutageSimulate(BaseModel):
    camera_id: int
    error_reason: Optional[str] = "Simulated Connection Timeout"

class NvrRename(BaseModel):
    new_name: str

def setup_routes(app):
    router = APIRouter()
    cam_repo = CameraRepository(app.state.db_path)
    nvr_repo = NvrRepository(app.state.db_path)
    inc_repo = IncidentRepository(app.state.db_path)
    settings_repo = SettingsRepository(app.state.db_path)
    engine = app.state.engine
    alert_mgr = app.state.alert_manager
    web_notifier = app.state.web_notifier

    @router.get("/nvrs")
    async def get_nvrs():
        return await nvr_repo.get_all()

    @router.post("/nvrs/{nvr_name}/rename")
    async def rename_nvr(nvr_name: str, payload: NvrRename):
        new_name = payload.new_name.strip()
        if not new_name:
            raise HTTPException(status_code=400, detail="New recorder name cannot be empty")
        try:
            updated_cams = await nvr_repo.rename(nvr_name, new_name)
            return {
                "message": f"Recorder renamed to '{new_name}' across {updated_cams} cameras.",
                "old_name": nvr_name,
                "new_name": new_name,
                "cameras_updated": updated_cams
            }
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    @router.post("/nvrs/{nvr_name}/audit-channels")
    async def audit_nvr_channels(nvr_name: str):
        from app.scanner import scan_nvr_channels
        import re
        nvrs = await nvr_repo.get_all()
        matched = next((n for n in nvrs if n["name"].lower() == nvr_name.lower()), None)
        if not matched:
            raise HTTPException(status_code=404, detail="NVR not found")

        cameras = await cam_repo.get_all()
        nvr_cams = [c for c in cameras if c.get("dvr_nvr_name", "").lower() == nvr_name.lower()]

        # Extract credentials and path pattern from existing camera if available
        user = "arechs_cctv"
        pwd = "scpl@2026"
        path_template = "/cam/realmonitor?channel={channel}&subtype=0"

        for c in nvr_cams:
            raw_url = c.get("rtsp_url", "")
            m = re.match(r"^rtsp://([^:]+):(.*)@([^@:/]+)(?::(\d+))?(/.*)$", raw_url)
            if m:
                user = m.group(1)
                pwd = m.group(2)
                raw_path = m.group(5)
                path_template = re.sub(r'channel=\d+', 'channel={channel}', raw_path)
                break

        total_ch = matched.get("total_channels") or 16
        if total_ch <= 0:
            total_ch = 16

        results = await scan_nvr_channels(
            host=matched["ip_address"],
            port=matched["port"] or 554,
            user=user,
            pwd=pwd,
            total_channels=total_ch,
            path_template=path_template,
            max_concurrent=2,
            timeout_sec=2.5
        )

        channel_cam_map = {}
        for c in nvr_cams:
            ch_str = str(c.get("channel_no", "")).strip()
            if ch_str.isdigit():
                channel_cam_map[int(ch_str)] = c

        active_count = 0
        empty_count = 0
        channel_details = []

        for r in results:
            ch_num = r["channel"]
            cfg_cam = channel_cam_map.get(ch_num)
            if r["status"] == "STREAMING":
                active_count += 1
            elif r["status"] == "EMPTY":
                empty_count += 1

            channel_details.append({
                "channel": ch_num,
                "status": r["status"],
                "status_code": r.get("status_code", 0),
                "codec": r.get("codec"),
                "fps": r.get("fps"),
                "latency_ms": r.get("latency_ms", 0.0),
                "message": r.get("message", ""),
                "camera_id": cfg_cam["id"] if cfg_cam else None,
                "camera_name": cfg_cam["name"] if cfg_cam else None,
                "location": cfg_cam["location"] if cfg_cam else None,
                "is_configured": cfg_cam is not None
            })

        return {
            "nvr_name": matched["name"],
            "ip_address": matched["ip_address"],
            "port": matched["port"],
            "total_channels": total_ch,
            "configured_channels": len(nvr_cams),
            "detected_streaming": active_count,
            "detected_empty": empty_count,
            "channels": channel_details
        }


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
            is_enabled=payload.is_enabled if payload.is_enabled is not None else True,
            is_no_cam=payload.is_no_cam or False
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

    @router.post("/cameras/{camera_id}/toggle-no-cam")
    async def toggle_camera_no_cam(camera_id: int):
        updated_cam = await cam_repo.toggle_no_cam(camera_id)
        if not updated_cam:
            raise HTTPException(status_code=404, detail="Camera not found")
        # If marked as no cam, close any open incidents
        if updated_cam.get("is_no_cam"):
            active_incidents = await inc_repo.get_active(camera_id)
            for inc in active_incidents:
                await inc_repo.close_incident(inc["id"])
        if web_notifier:
            await web_notifier.broadcast_event("CAMERA_UPDATE", {"camera": updated_cam})
        return {
            "camera_id": camera_id,
            "is_no_cam": updated_cam.get("is_no_cam"),
            "status": updated_cam.get("status"),
            "message": f"Camera marked as {'No Cam (Spare)' if updated_cam.get('is_no_cam') else 'Active Camera'}"
        }

    @router.post("/cameras/{camera_id}/check")
    async def manual_check_camera(camera_id: int):
        res = await engine.check_single_camera(camera_id)
        return {
            "camera_id": res.camera_id,
            "status": res.new_status,
            "message": res.message,
            "consecutive_failures": res.consecutive_failures
        }

    @router.post("/cameras/{camera_id}/snapshot")
    async def capture_camera_snapshot(camera_id: int):
        from app.scanner import grab_rtsp_snapshot
        import os, time
        cam = await cam_repo.get_by_id(camera_id)
        if not cam:
            raise HTTPException(status_code=404, detail="Camera not found")

        rtsp_url = cam["rtsp_url"]
        snapshot_dir = os.path.join("static", "snapshots")
        os.makedirs(snapshot_dir, exist_ok=True)
        filename = f"cam_{camera_id}.jpg"
        filepath = os.path.join(snapshot_dir, filename)

        success, err, intensity = await grab_rtsp_snapshot(rtsp_url, filepath, timeout_sec=5, max_width=720)
        if not success:
            raise HTTPException(status_code=502, detail=f"Failed to capture snapshot: {err or 'Stream unavailable'}")

        # Update thumbnail_path in DB
        await cam_repo.update_status(
            camera_id=camera_id,
            status=cam.get("status") or "ONLINE",
            consecutive_failures=cam.get("consecutive_failures") or 0,
            latency_ms=cam.get("latency_ms") or 0.0,
            last_error=None,
            thumbnail_path=f"/static/snapshots/{filename}"
        )

        return {
            "camera_id": camera_id,
            "camera_name": cam["name"],
            "dvr_nvr_name": cam.get("dvr_nvr_name"),
            "location": cam.get("location"),
            "channel_no": cam.get("channel_no"),
            "image_url": f"/static/snapshots/{filename}?t={int(time.time() * 1000)}",
            "mean_intensity": intensity,
            "captured_at": time.strftime("%Y-%m-%d %H:%M:%S")
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

    @router.get("/cameras/excel/export")
    async def export_cameras_excel():
        from app.excel_export import generate_excel_export
        from datetime import datetime
        cams = await cam_repo.get_all()
        nvrs = await nvr_repo.get_all()
        excel_bytes = generate_excel_export(cams, nvrs)
        filename = f"cctv_fleet_inventory_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        return Response(
            content=excel_bytes,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )

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
