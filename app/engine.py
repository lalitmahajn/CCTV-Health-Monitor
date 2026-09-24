import asyncio
import logging
from dataclasses import dataclass
from typing import Optional, List, Dict, Any
from app.models import CameraRepository, IncidentRepository, SettingsRepository
from app.scanner import check_tcp_liveness, HostThrottler, grab_rtsp_snapshot

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
        thumbnail_path: Optional[str] = None
    ) -> TransitionResult:
        camera = await self.camera_repo.get_by_id(camera_id)
        if not camera:
            raise ValueError(f"Camera with ID {camera_id} not found")

        old_status = camera["status"]
        failures = camera["consecutive_failures"]
        
        # Load configurable thresholds
        failure_threshold = int(await self.settings_repo.get("failure_threshold", 2))
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
            if new_failures >= failure_threshold:
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
    Background orchestrator executing fast liveness scans and staggered frame snapshots.
    """
    def __init__(self, db_path: str = None, alert_callback = None):
        self.db_path = db_path
        self.camera_repo = CameraRepository(db_path)
        self.incident_repo = IncidentRepository(db_path)
        self.settings_repo = SettingsRepository(db_path)
        self.state_machine = StateMachine(self.camera_repo, self.incident_repo, self.settings_repo)
        self.alert_callback = alert_callback
        self.throttler = HostThrottler(max_per_host=2)
        self.is_running = False
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

    async def check_single_camera(self, camera_id: int) -> TransitionResult:
        camera = await self.camera_repo.get_by_id(camera_id)
        if not camera:
            raise ValueError(f"Camera {camera_id} not found")

        host = camera["ip_address"]
        port = camera["port"] or 554
        timeout_ms = int(await self.settings_repo.get("socket_timeout_ms", 3000))

        async with self.throttler.acquire(host):
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
                cameras = await self.camera_repo.get_all(enabled_only=True)
                
                # Run checks across cameras concurrently with per-host throttler
                tasks = [self.check_single_camera(cam["id"]) for cam in cameras]
                if tasks:
                    await asyncio.gather(*tasks, return_exceptions=True)
                    
            except Exception as e:
                logger.error(f"Error in monitoring loop: {e}")

            await asyncio.sleep(interval)
