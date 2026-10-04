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

@pytest.mark.asyncio
async def test_alert_manager_nvr_outage_and_recovery():
    alert_mgr = AlertManager()
    web_notifier = WebAlertNotifier()
    alert_mgr.register(web_notifier)

    queue = web_notifier.subscribe()

    await alert_mgr.dispatch_nvr_outage(
        nvr={"name": "NVR-Building-A", "ip_address": "192.168.1.50", "port": 554},
        channel_count=16,
        error_reason="Host unreachable (Connection refused)"
    )

    msg1 = await asyncio.wait_for(queue.get(), timeout=1.0)
    assert msg1["type"] == "NVR_DOWN"
    assert msg1["nvr"]["name"] == "NVR-Building-A"
    assert msg1["channel_count"] == 16
    assert "Connection refused" in msg1["error_reason"]

    await alert_mgr.dispatch_nvr_recovery(
        nvr={"name": "NVR-Building-A", "ip_address": "192.168.1.50", "port": 554},
        channel_count=16,
        duration_seconds=120
    )

    msg2 = await asyncio.wait_for(queue.get(), timeout=1.0)
    assert msg2["type"] == "NVR_RECOVERED"
    assert msg2["duration_seconds"] == 120

    web_notifier.unsubscribe(queue)

