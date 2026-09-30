import asyncio
import logging
from abc import ABC, abstractmethod
from typing import Dict, Any, List, Set

logger = logging.getLogger(__name__)

class BaseAlertNotifier(ABC):
    @abstractmethod
    async def send_outage(self, camera: Dict[str, Any], incident: Dict[str, Any]) -> bool:
        pass

    @abstractmethod
    async def send_recovery(self, camera: Dict[str, Any], incident: Dict[str, Any], duration_seconds: int) -> bool:
        pass


class WebAlertNotifier(BaseAlertNotifier):
    """
    Broadcasts real-time events to connected Web UI clients using SSE (Server-Sent Events).
    """
    def __init__(self):
        self._subscribers: Set[asyncio.Queue] = set()
        self._lock = asyncio.Lock()

    def subscribe(self) -> asyncio.Queue:
        q = asyncio.Queue()
        self._subscribers.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue):
        self._subscribers.discard(q)

    async def broadcast_event(self, event_type: str, data: Dict[str, Any]):
        message = {"type": event_type, **data}
        dead_queues = []
        for q in list(self._subscribers):
            try:
                q.put_nowait(message)
            except asyncio.QueueFull:
                dead_queues.append(q)
        for dq in dead_queues:
            self._subscribers.discard(dq)

    async def send_outage(self, camera: Dict[str, Any], incident: Dict[str, Any]) -> bool:
        await self.broadcast_event("CAMERA_DOWN", {
            "camera": camera,
            "incident": incident
        })
        return True

    async def send_recovery(self, camera: Dict[str, Any], incident: Dict[str, Any], duration_seconds: int) -> bool:
        await self.broadcast_event("CAMERA_RECOVERED", {
            "camera": camera,
            "incident": incident,
            "duration_seconds": duration_seconds
        })
        return True


class EmailAlertNotifier(BaseAlertNotifier):
    """
    SMTP Email alert dispatcher.
    Sends formatted outage and recovery alert emails to configured recipients
    when enable_email_alerts is turned on.
    """
    def __init__(self, db_path: str = None, **kwargs):
        self.db_path = db_path

    async def _send_email_async(self, subject: str, body_text: str):
        import smtplib
        from email.mime.text import MIMEText
        from app.models import SettingsRepository

        if not self.db_path:
            return

        try:
            settings_repo = SettingsRepository(self.db_path)
            s = await settings_repo.get_all(decrypt=True)

            if s.get("enable_email_alerts", "false").lower() != "true":
                return

            host = s.get("smtp_host", "").strip()
            port_str = s.get("smtp_port", "587").strip()
            user = s.get("smtp_user", "").strip()
            password = s.get("smtp_password", "").strip()
            use_tls = s.get("smtp_use_tls", "true").lower() == "true"
            recipients = s.get("email_recipients", "").strip()

            if not host or not user or not recipients:
                logger.debug("[EmailAlertNotifier] Missing SMTP configuration, skipping dispatch")
                return

            port = int(port_str) if port_str.isdigit() else 587
            to_list = [r.strip() for r in recipients.split(",") if r.strip()]
            if not to_list:
                return

            msg = MIMEText(body_text)
            msg["Subject"] = subject
            msg["From"] = user
            msg["To"] = ", ".join(to_list)

            def _sync_send():
                if port == 465:
                    server = smtplib.SMTP_SSL(host, port, timeout=10)
                else:
                    server = smtplib.SMTP(host, port, timeout=10)
                    if use_tls:
                        server.starttls()
                if password:
                    server.login(user, password)
                server.sendmail(user, to_list, msg.as_string())
                server.quit()

            await asyncio.to_thread(_sync_send)
            logger.info(f"[EmailAlertNotifier] Dispatched alert email to {to_list}: {subject}")
        except Exception as e:
            logger.error(f"[EmailAlertNotifier] Failed to send email alert: {e}")

    async def send_outage(self, camera: Dict[str, Any], incident: Dict[str, Any]) -> bool:
        cam_name = camera.get("name", "Unknown Camera")
        nvr_name = camera.get("dvr_nvr_name", "NVR")
        ch = camera.get("channel_no", "1")
        location = camera.get("location", "Unassigned")
        reason = incident.get("error_reason", "Connection timeout / unreachable")

        subject = f"[CRITICAL OUTAGE] {cam_name} ({nvr_name}/CH-{ch}) is DOWN"
        body = (
            f"CRITICAL CCTV OUTAGE DETECTED\n"
            f"=========================================\n"
            f"Camera:   {cam_name}\n"
            f"Location: {location}\n"
            f"Recorder: {nvr_name} (Channel {ch})\n"
            f"IP/Port:  {camera.get('ip_address')}:{camera.get('port', 554)}\n"
            f"Status:   OFFLINE\n"
            f"Reason:   {reason}\n"
            f"Incident: #{incident.get('id', 'N/A')}\n"
            f"=========================================\n"
            f"Please inspect physical connection, network switches, or power injectors immediately.\n"
            f"— CCTV Fleet Health Monitor"
        )
        await self._send_email_async(subject, body)
        return True

    async def send_recovery(self, camera: Dict[str, Any], incident: Dict[str, Any], duration_seconds: int) -> bool:
        cam_name = camera.get("name", "Unknown Camera")
        nvr_name = camera.get("dvr_nvr_name", "NVR")
        ch = camera.get("channel_no", "1")
        location = camera.get("location", "Unassigned")

        mins = duration_seconds // 60
        secs = duration_seconds % 60
        duration_str = f"{mins}m {secs}s" if mins > 0 else f"{secs}s"

        subject = f"[RESOLVED] {cam_name} ({nvr_name}/CH-{ch}) has RECOVERED"
        body = (
            f"CCTV OUTAGE RESOLVED\n"
            f"=========================================\n"
            f"Camera:   {cam_name}\n"
            f"Location: {location}\n"
            f"Recorder: {nvr_name} (Channel {ch})\n"
            f"Status:   ONLINE (Operational)\n"
            f"Downtime: {duration_str}\n"
            f"Incident: #{incident.get('id', 'N/A')} Closed\n"
            f"=========================================\n"
            f"The camera has resumed successful TCP health check responses.\n"
            f"— CCTV Fleet Health Monitor"
        )
        await self._send_email_async(subject, body)
        return True


class TelegramAlertNotifier(BaseAlertNotifier):
    """
    Modular stub for Telegram Bot notifications.
    Ready for bot_token & chat_id to be configured in settings.
    """
    def __init__(self, bot_token: str = "", chat_id: str = ""):
        self.bot_token = bot_token
        self.chat_id = chat_id

    async def send_outage(self, camera: Dict[str, Any], incident: Dict[str, Any]) -> bool:
        # Stub implementation - ready for Telegram bot API calls
        logger.info(f"[Telegram Alert Stub] Outage alert for camera {camera.get('name')}: {incident.get('error_reason')}")
        return True

    async def send_recovery(self, camera: Dict[str, Any], incident: Dict[str, Any], duration_seconds: int) -> bool:
        # Stub implementation - ready for Telegram bot API calls
        logger.info(f"[Telegram Alert Stub] Recovery alert for camera {camera.get('name')}, downtime: {duration_seconds}s")
        return True


class AlertManager:
    """
    Central dispatcher routing outages and recoveries to all registered notifiers.
    """
    def __init__(self):
        self.notifiers: List[BaseAlertNotifier] = []

    def register(self, notifier: BaseAlertNotifier):
        if notifier not in self.notifiers:
            self.notifiers.append(notifier)

    async def dispatch_outage(self, camera: Dict[str, Any], incident: Dict[str, Any]):
        for notifier in self.notifiers:
            try:
                await notifier.send_outage(camera, incident)
            except Exception as e:
                logger.error(f"Notifier {notifier.__class__.__name__} failed on outage: {e}")

    async def dispatch_recovery(self, camera: Dict[str, Any], incident: Dict[str, Any], duration_seconds: int = 0):
        for notifier in self.notifiers:
            try:
                await notifier.send_recovery(camera, incident, duration_seconds)
            except Exception as e:
                logger.error(f"Notifier {notifier.__class__.__name__} failed on recovery: {e}")
