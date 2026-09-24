import pytest
from app.database import init_db
from app.models import CameraRepository, IncidentRepository, SettingsRepository
from app.engine import StateMachine

@pytest.mark.asyncio
async def test_state_transitions_and_incidents(tmp_path):
    test_db = str(tmp_path / "test_engine.db")
    await init_db(test_db)
    
    cam_repo = CameraRepository(test_db)
    inc_repo = IncidentRepository(test_db)
    settings_repo = SettingsRepository(test_db)
    
    cam_id = await cam_repo.create(
        name="Corridor", dvr_nvr_name="NVR-01", location="1F",
        ip_address="192.168.1.50", port=554, channel_no="02",
        rtsp_url="rtsp://192.168.1.50:554/ch2"
    )
    
    sm = StateMachine(cam_repo, inc_repo, settings_repo)
    
    # 1st failure -> WARNING, no incident opened yet
    res1 = await sm.process_check_result(cam_id, success=False, latency_ms=0, error="Timeout")
    assert res1.new_status == "WARNING"
    assert res1.consecutive_failures == 1
    active_incidents = await inc_repo.get_active(cam_id)
    assert len(active_incidents) == 0
    
    # 2nd failure -> OFFLINE, incident opened
    res2 = await sm.process_check_result(cam_id, success=False, latency_ms=0, error="Timeout")
    assert res2.new_status == "OFFLINE"
    assert res2.consecutive_failures == 2
    assert res2.opened_incident_id is not None
    active_incidents = await inc_repo.get_active(cam_id)
    assert len(active_incidents) == 1
    assert active_incidents[0]["error_reason"] == "Timeout"
    
    # Recovery -> ONLINE, incident closed with duration
    res3 = await sm.process_check_result(cam_id, success=True, latency_ms=15.2, error=None)
    assert res3.new_status == "ONLINE"
    assert res3.consecutive_failures == 0
    assert res3.closed_incident_id == res2.opened_incident_id
    active_incidents = await inc_repo.get_active(cam_id)
    assert len(active_incidents) == 0
    resolved = await inc_repo.get_by_id(res2.opened_incident_id)
    assert resolved["resolved_at"] is not None
    assert resolved["duration_seconds"] >= 0
