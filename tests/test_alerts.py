import pytest
import asyncio
from app.alerts import AlertManager, WebAlertNotifier, EmailAlertNotifier, TelegramAlertNotifier

@pytest.mark.asyncio
async def test_alert_manager_sse_broadcast():
    alert_mgr = AlertManager()
    web_notifier = WebAlertNotifier()
    alert_mgr.register(web_notifier)
    
    queue = web_notifier.subscribe()
    
    await alert_mgr.dispatch_outage(
        camera={"id": 1, "name": "Entrance", "location": "Gate"},
        incident={"id": 10, "error_reason": "Connection Refused"}
    )
    
    msg = await asyncio.wait_for(queue.get(), timeout=1.0)
    assert msg["type"] == "CAMERA_DOWN"
    assert msg["camera"]["name"] == "Entrance"
    assert msg["incident"]["error_reason"] == "Connection Refused"
    
    web_notifier.unsubscribe(queue)

@pytest.mark.asyncio
async def test_stubs_are_callable():
    email_notifier = EmailAlertNotifier()
    tg_notifier = TelegramAlertNotifier()
    assert hasattr(email_notifier, "send_outage")
    assert hasattr(email_notifier, "send_recovery")
    assert hasattr(tg_notifier, "send_outage")
    assert hasattr(tg_notifier, "send_recovery")
    
    # Verify stubs don't crash
    res_e = await email_notifier.send_outage({"id": 1}, {"id": 10})
    res_t = await tg_notifier.send_outage({"id": 1}, {"id": 10})
    assert res_e is True
    assert res_t is True
