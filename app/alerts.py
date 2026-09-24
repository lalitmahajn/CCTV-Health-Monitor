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
    Modular stub for Email (SMTP) notifications.
    Ready for credentials/host to be configured in settings.
    """
    def __init__(self, smtp_host: str = "", smtp_port: int = 587,
                 username: str = "", password: str = "", to_email: str = ""):
        self.smtp_host = smtp_host
        self.smtp_port = smtp_port
        self.username = username
        self.password = password
        self.to_email = to_email

    async def send_outage(self, camera: Dict[str, Any], incident: Dict[str, Any]) -> bool:
        # Stub implementation - ready for SMTP integration
        logger.info(f"[Email Alert Stub] Outage alert for camera {camera.get('name')}: {incident.get('error_reason')}")
        return True

    async def send_recovery(self, camera: Dict[str, Any], incident: Dict[str, Any], duration_seconds: int) -> bool:
        # Stub implementation - ready for SMTP integration
        logger.info(f"[Email Alert Stub] Recovery alert for camera {camera.get('name')}, downtime: {duration_seconds}s")
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
