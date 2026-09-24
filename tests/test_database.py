import pytest
import os
import asyncio
from app.database import init_db
from app.models import CameraRepository, IncidentRepository, SettingsRepository, mask_rtsp_url

@pytest.mark.asyncio
async def test_database_initialization_and_default_settings(tmp_path):
    test_db = str(tmp_path / "test_cctv.db")
    await init_db(test_db)
    
    settings_repo = SettingsRepository(test_db)
    settings = await settings_repo.get_all()
    assert "failure_threshold" in settings
    assert int(settings["failure_threshold"]) == 2
    assert "socket_timeout_ms" in settings
    assert int(settings["socket_timeout_ms"]) == 3000

@pytest.mark.asyncio
async def test_camera_crud_and_masking(tmp_path):
    test_db = str(tmp_path / "test_cctv.db")
    await init_db(test_db)
    
    repo = CameraRepository(test_db)
    cam_id = await repo.create(
        name="Gate Cam",
        dvr_nvr_name="NVR-01",
        location="Front Gate",
        ip_address="192.168.1.100",
        port=554,
        channel_no="01",
        rtsp_url="rtsp://admin:mypassword123@192.168.1.100:554/ch1"
    )
    assert cam_id > 0
    
    cam = await repo.get_by_id(cam_id)
    assert cam["name"] == "Gate Cam"
    assert cam["dvr_nvr_name"] == "NVR-01"
    assert cam["masked_url"] == "rtsp://admin:*****@192.168.1.100:554/ch1"
    assert cam["rtsp_url"] == "rtsp://admin:mypassword123@192.168.1.100:554/ch1"
    assert cam["status"] == "UNKNOWN"

def test_mask_rtsp_url():
    assert mask_rtsp_url("rtsp://admin:12345@192.168.1.10:554/ch1") == "rtsp://admin:*****@192.168.1.10:554/ch1"
    assert mask_rtsp_url("rtsp://192.168.1.10:554/ch1") == "rtsp://192.168.1.10:554/ch1"
    assert mask_rtsp_url("invalid-url") == "invalid-url"
