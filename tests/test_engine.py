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
    
    # 2nd failure -> WARNING, still under failure_threshold (3)
    res2 = await sm.process_check_result(cam_id, success=False, latency_ms=0, error="Timeout")
    assert res2.new_status == "WARNING"
    assert res2.consecutive_failures == 2
    active_incidents = await inc_repo.get_active(cam_id)
    assert len(active_incidents) == 0

    # 3rd failure -> OFFLINE, incident opened
    res3 = await sm.process_check_result(cam_id, success=False, latency_ms=0, error="Timeout")
    assert res3.new_status == "OFFLINE"
    assert res3.consecutive_failures == 3
    assert res3.opened_incident_id is not None
    active_incidents = await inc_repo.get_active(cam_id)
    assert len(active_incidents) == 1
    assert active_incidents[0]["error_reason"] == "Timeout"
    
    # Recovery -> ONLINE, incident closed with duration
    res4 = await sm.process_check_result(cam_id, success=True, latency_ms=15.2, error=None)
    assert res4.new_status == "ONLINE"
    assert res4.consecutive_failures == 0
    assert res4.closed_incident_id == res3.opened_incident_id
    active_incidents = await inc_repo.get_active(cam_id)
    assert len(active_incidents) == 0
    resolved = await inc_repo.get_by_id(res3.opened_incident_id)
    assert resolved["resolved_at"] is not None
    assert resolved["duration_seconds"] >= 0


@pytest.mark.asyncio
async def test_two_tier_monitoring_nvr_down_short_circuits(tmp_path):
    import asyncio
    from app.engine import MonitoringEngine
    from app.models import NvrRepository

    test_db = str(tmp_path / "test_two_tier_down.db")
    await init_db(test_db)

    cam_repo = CameraRepository(test_db)
    nvr_repo = NvrRepository(test_db)
    await nvr_repo.upsert("NVR-Test", "127.0.0.1", port=1, total_channels=16, used_channels=2)

    c1 = await cam_repo.create("Cam 1", "127.0.0.1", "rtsp://127.0.0.1:1/ch1", dvr_nvr_name="NVR-Test", port=1, channel_no="1")
    c2 = await cam_repo.create("Cam 2", "127.0.0.1", "rtsp://127.0.0.1:1/ch2", dvr_nvr_name="NVR-Test", port=1, channel_no="2")

    engine = MonitoringEngine(test_db)
    
    # Run bay check on unreachable port 1
    await engine.check_nvr_bay("127.0.0.1", [await cam_repo.get_by_id(c1), await cam_repo.get_by_id(c2)])

    # NVR should be marked OFFLINE / failed
    nvr = await nvr_repo.get_by_name("NVR-Test")
    assert nvr["status"] in ("OFFLINE", "WARNING")
    assert "Host unreachable" in (nvr["last_error"] or "") or "NVR_OFFLINE" in (nvr["last_error"] or "") or "ConnectionRefused" in (nvr["last_error"] or "")

    # Both child cameras should be cascaded with NVR_OFFLINE
    cam1_data = await cam_repo.get_by_id(c1)
    cam2_data = await cam_repo.get_by_id(c2)
    assert "NVR_OFFLINE" in (cam1_data["last_error"] or "")
    assert "NVR_OFFLINE" in (cam2_data["last_error"] or "")


@pytest.mark.asyncio
async def test_two_tier_monitoring_nvr_alive_channel_loss(tmp_path):
    import asyncio
    from app.engine import MonitoringEngine
    from app.models import NvrRepository

    test_db = str(tmp_path / "test_two_tier_alive.db")
    await init_db(test_db)

    # Start mock RTSP server that responds 200 OK on TCP and DESCRIBE for ch1, but 404 for ch2
    async def handle_mock_nvr(reader, writer):
        try:
            data = await reader.read(2048)
            text = data.decode(errors="ignore")
            if "DESCRIBE" in text:
                if "ch1" in text:
                    sdp = "v=0\r\nm=video 0 RTP/AVP 96\r\n"
                    resp = f"RTSP/1.0 200 OK\r\nCSeq: 1\r\nContent-Length: {len(sdp)}\r\n\r\n{sdp}"
                else:
                    resp = "RTSP/1.0 404 Not Found\r\nCSeq: 1\r\n\r\n"
                writer.write(resp.encode())
                await writer.drain()
            else:
                # Plain TCP connection
                pass
        except Exception:
            pass
        finally:
            writer.close()
            await writer.wait_closed()

    server = await asyncio.start_server(handle_mock_nvr, "127.0.0.1", 0)
    mock_port = server.sockets[0].getsockname()[1]

    cam_repo = CameraRepository(test_db)
    nvr_repo = NvrRepository(test_db)
    await nvr_repo.upsert("NVR-Mock", "127.0.0.1", port=mock_port, total_channels=16, used_channels=2)

    c1 = await cam_repo.create("Cam 1", "127.0.0.1", f"rtsp://127.0.0.1:{mock_port}/ch1", dvr_nvr_name="NVR-Mock", port=mock_port, channel_no="1")
    c2 = await cam_repo.create("Cam 2", "127.0.0.1", f"rtsp://127.0.0.1:{mock_port}/ch2", dvr_nvr_name="NVR-Mock", port=mock_port, channel_no="2")

    engine = MonitoringEngine(test_db)

    # Run bay check
    await engine.check_nvr_bay("127.0.0.1", [await cam_repo.get_by_id(c1), await cam_repo.get_by_id(c2)])

    # NVR should be ONLINE
    nvr = await nvr_repo.get_by_name("NVR-Mock")
    assert nvr["status"] == "ONLINE"
    assert nvr["latency_ms"] >= 0.0

    # Ch1 should be ONLINE
    cam1_data = await cam_repo.get_by_id(c1)
    assert cam1_data["status"] == "ONLINE"
    assert cam1_data["last_error"] is None

    # Ch2 should have VIDEO_LOSS error
    cam2_data = await cam_repo.get_by_id(c2)
    assert "VIDEO_LOSS" in (cam2_data["last_error"] or "")

    server.close()
    await server.wait_closed()

