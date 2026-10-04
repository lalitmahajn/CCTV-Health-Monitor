import asyncio
import logging
from dataclasses import dataclass
from typing import Optional, List, Dict, Any
from app.models import CameraRepository, IncidentRepository, SettingsRepository, NvrRepository
from app.scanner import check_tcp_liveness, check_rtsp_liveness, HostThrottler, grab_rtsp_snapshot

logger = logging.getLogger(__name__)

@dataclass
class TransitionResult:
    camera_id: int
    old_status: str
    new_status: str
    consecutive_failures: int
    opened_incident_id: Optional[int] = None
    closed_incident_id: Optional[int] = None
    duration_seconds: Optional[int] = None
    message: Optional[str] = None


class StateMachine:
    """
    Manages camera health state transitions, flapping prevention,
    and automatic incident lifecycle tracking.
    """
    def __init__(self, camera_repo: CameraRepository, incident_repo: IncidentRepository, settings_repo: SettingsRepository):
        self.camera_repo = camera_repo
        self.incident_repo = incident_repo
        self.settings_repo = settings_repo

    async def process_check_result(
        self,
        camera_id: int,
        success: bool,
        latency_ms: float = 0.0,
        error: Optional[str] = None,
        thumbnail_path: Optional[str] = None,
        is_warmup: bool = False
    ) -> TransitionResult:
        camera = await self.camera_repo.get_by_id(camera_id)
        if not camera:
            raise ValueError(f"Camera with ID {camera_id} not found")

        old_status = camera["status"]
        failures = camera["consecutive_failures"]
        
        # Load configurable thresholds
        failure_threshold = int(await self.settings_repo.get("failure_threshold", 3))
        latency_warning_threshold = float(await self.settings_repo.get("latency_warning_threshold_ms", 1500))

        opened_incident_id = None
        closed_incident_id = None
        duration_seconds = None
        message = None

        if success:
            new_failures = 0
            # Check high latency warning
            if latency_ms >= latency_warning_threshold:
                new_status = "WARNING"
                message = f"High latency ({latency_ms}ms >= {latency_warning_threshold}ms)"
            else:
                new_status = "ONLINE"
                message = "Camera healthy"

            # Check if recovering from OFFLINE
            if old_status == "OFFLINE":
                active_incidents = await self.incident_repo.get_active(camera_id)
                for inc in active_incidents:
                    duration = await self.incident_repo.close_incident(inc["id"])
                    closed_incident_id = inc["id"]
                    duration_seconds = duration
                message = f"Camera recovered after outage (duration: {duration_seconds}s)"

        else:
            new_failures = failures + 1
            if is_warmup and old_status != "OFFLINE":
                # Warmup grace: do not trigger alarm storms on initial cold boot
                new_status = "WARNING"
                new_failures = 1
                message = f"Startup grace period: {error or 'Check failed'}"
            elif new_failures >= failure_threshold:
                new_status = "OFFLINE"
                message = f"Camera offline: {error or 'Check failed'}"
                # If not already OFFLINE with an open incident, open one
                if old_status != "OFFLINE":
                    opened_incident_id = await self.incident_repo.open_incident(
                        camera_id,
                        error_reason=error or "Connection failed"
                    )
            else:
                new_status = "WARNING"
                message = f"Warning: {error or 'Single check failure'} ({new_failures}/{failure_threshold})"

        # Persist status change
        await self.camera_repo.update_status(
            camera_id=camera_id,
            status=new_status,
            consecutive_failures=new_failures,
            latency_ms=latency_ms,
            last_error=error if not success else None,
            thumbnail_path=thumbnail_path
        )

        return TransitionResult(
            camera_id=camera_id,
            old_status=old_status,
            new_status=new_status,
            consecutive_failures=new_failures,
            opened_incident_id=opened_incident_id,
            closed_incident_id=closed_incident_id,
            duration_seconds=duration_seconds,
            message=message
        )


class MonitoringEngine:
    """
    Two-Tier Hierarchical Background Orchestrator:
    - Tier 1: Recorder / NVR Hardware TCP Liveness (short-circuits dead NVRs)
    - Tier 2: Per-channel lightweight RTSP DESCRIBE probes (with strict anti-overload pacing)
    """
    def __init__(self, db_path: str = None, alert_callback = None):
        self.db_path = db_path
        self.camera_repo = CameraRepository(db_path)
        self.incident_repo = IncidentRepository(db_path)
        self.settings_repo = SettingsRepository(db_path)
        self.nvr_repo = NvrRepository(db_path)
        self.state_machine = StateMachine(self.camera_repo, self.incident_repo, self.settings_repo)
        self.alert_callback = alert_callback
        self.throttler = HostThrottler(max_per_host=2)
        self.is_running = False
        self.is_warmup = True
        self._ping_task = None

    async def start(self):
        self.is_running = True
        self._ping_task = asyncio.create_task(self._monitoring_loop())

    async def stop(self):
        self.is_running = False
        if self._ping_task:
            self._ping_task.cancel()
            try:
                await self._ping_task
            except asyncio.CancelledError:
                pass

    async def check_nvr_bay(self, host: str, cams: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Two-Tier health check for a recorder/NVR bay:
        1. Tier 1: Ping the host NVR. If unreachable, short-circuits all child channels.
        2. Tier 2: If NVR is healthy, probes each channel via lightweight RTSP DESCRIBE.
        """
        if not cams:
            return {"host": host, "status": "EMPTY", "cameras": 0}

        port = int(cams[0].get("port") or 554)
        nvr_name = cams[0].get("dvr_nvr_name") or host
        timeout_ms = int(await self.settings_repo.get("socket_timeout_ms", 4500))
        timeout_sec = max(float(timeout_ms) / 1000.0, 4.5)

        # Tier 1: NVR / Recorder Hardware Liveness (TCP Ping)
        async with self.throttler.acquire(host):
            nvr_alive, nvr_lat, nvr_err = await check_tcp_liveness(host, port, timeout_ms)

        # Update NVR database record
        if nvr_alive:
            await self.nvr_repo.update_status(
                name=nvr_name,
                status="ONLINE",
                latency_ms=nvr_lat,
                consecutive_failures=0,
                last_error=None
            )
        else:
            await self.nvr_repo.update_status(
                name=nvr_name,
                status="OFFLINE",
                latency_ms=0.0,
                consecutive_failures=1,
                last_error=f"ConnectionRefused: Host unreachable ({nvr_err})"
            )

        # Short-circuit if Tier 1 failed
        if not nvr_alive:
            error_reason = f"NVR_OFFLINE: Recorder {nvr_name} ({host}) unreachable"
            for cam in cams:
                res = await self.state_machine.process_check_result(
                    camera_id=cam["id"],
                    success=False,
                    latency_ms=0.0,
                    error=error_reason,
                    is_warmup=self.is_warmup
                )
                if self.alert_callback and (res.opened_incident_id or res.closed_incident_id or res.old_status != res.new_status):
                    await self.alert_callback(cam, res)
            return {"host": host, "status": "OFFLINE", "latency_ms": 0.0, "cameras_offline": len(cams)}

        # Tier 2: Channel Level RTSP DESCRIBE Probing (for online NVRs)
        for cam in cams:
            rtsp_url = cam.get("rtsp_url")
            async with self.throttler.acquire(host):
                if rtsp_url:
                    cam_success, cam_lat, cam_err = await check_rtsp_liveness(rtsp_url, timeout_sec=timeout_sec)
                else:
                    cam_success, cam_lat, cam_err = await check_tcp_liveness(host, port, timeout_ms)

            res = await self.state_machine.process_check_result(
                camera_id=cam["id"],
                success=cam_success,
                latency_ms=cam_lat,
                error=cam_err,
                is_warmup=self.is_warmup
            )
            if self.alert_callback and (res.opened_incident_id or res.closed_incident_id or res.old_status != res.new_status):
                await self.alert_callback(cam, res)

            # Anti-overload pacing: 80ms breather pause so NVR socket buffers flush cleanly
            await asyncio.sleep(0.08)

        return {"host": host, "status": "ONLINE", "latency_ms": nvr_lat, "cameras_checked": len(cams)}

    async def check_single_camera(self, camera_id: int) -> TransitionResult:
        camera = await self.camera_repo.get_by_id(camera_id)
        if not camera:
            raise ValueError(f"Camera {camera_id} not found")

        host = camera["ip_address"]
        port = camera["port"] or 554
        nvr_name = camera.get("dvr_nvr_name") or host
        timeout_ms = int(await self.settings_repo.get("socket_timeout_ms", 4500))
        timeout_sec = max(float(timeout_ms) / 1000.0, 4.5)

        # Tier 1 check
        async with self.throttler.acquire(host):
            nvr_alive, nvr_lat, nvr_err = await check_tcp_liveness(host, port, timeout_ms)

        if not nvr_alive:
            res = await self.state_machine.process_check_result(
                camera_id, success=False, latency_ms=0.0, error=f"NVR_OFFLINE: Recorder {nvr_name} ({host}) unreachable"
            )
            if self.alert_callback and (res.opened_incident_id or res.closed_incident_id or res.old_status != res.new_status):
                await self.alert_callback(camera, res)
            return res

        # Tier 2 check
        rtsp_url = camera.get("rtsp_url")
        async with self.throttler.acquire(host):
            if rtsp_url:
                success, latency_ms, error = await check_rtsp_liveness(rtsp_url, timeout_sec=timeout_sec)
            else:
                success, latency_ms, error = await check_tcp_liveness(host, port, timeout_ms)

        res = await self.state_machine.process_check_result(
            camera_id, success, latency_ms, error
        )
        if self.alert_callback and (res.opened_incident_id or res.closed_incident_id or res.old_status != res.new_status):
            await self.alert_callback(camera, res)
        return res

    async def _monitoring_loop(self):
        while self.is_running:
            try:
                interval = int(await self.settings_repo.get("ping_interval_seconds", 30))
                all_cams = await self.camera_repo.get_all(enabled_only=True)
                cameras = [cam for cam in all_cams if not cam.get("is_no_cam")]

                # Group cameras by recorder host IP
                bays: Dict[str, List[Dict[str, Any]]] = {}
                for cam in cameras:
                    bays.setdefault(cam["ip_address"], []).append(cam)

                # Stagger bays by 500ms to eliminate simultaneous burst across all NVRs
                tasks = []
                for host, bay_cams in bays.items():
                    tasks.append(asyncio.create_task(self.check_nvr_bay(host, bay_cams)))
                    await asyncio.sleep(0.5)

                if tasks:
                    await asyncio.gather(*tasks, return_exceptions=True)

                # First full cycle complete - warmup grace ends
                self.is_warmup = False

            except Exception as e:
                logger.error(f"Error in monitoring loop: {e}")

            await asyncio.sleep(interval)

