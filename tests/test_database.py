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
    assert cam["masked_url"] == "rtsp://*****:*****@192.168.1.100:554/ch1"
    assert cam["rtsp_url"] == "rtsp://admin:mypassword123@192.168.1.100:554/ch1"
    assert cam["status"] == "UNKNOWN"

    # Verify database encryption at rest: raw SQLite row must be encrypted
    import aiosqlite
    async with aiosqlite.connect(test_db) as db:
        async with db.execute("SELECT rtsp_url FROM cameras WHERE id = ?", (cam_id,)) as cur:
            row = await cur.fetchone()
            raw_stored = row[0]
            assert raw_stored.startswith("enc:")
            assert "admin" not in raw_stored
            assert "mypassword123" not in raw_stored

def test_mask_rtsp_url():
    # Both username and password masked
    assert mask_rtsp_url("rtsp://admin:12345@192.168.1.10:554/ch1") == "rtsp://*****:*****@192.168.1.10:554/ch1"
    # Password with complex symbols (@)
    assert mask_rtsp_url("rtsp://arechs_cctv:scpl@2026@192.168.0.245:51554/ch1") == "rtsp://*****:*****@192.168.0.245:51554/ch1"
    # Username only without password
    assert mask_rtsp_url("rtsp://admin@192.168.1.10:554/ch1") == "rtsp://*****@192.168.1.10:554/ch1"
    # URL without credentials
    assert mask_rtsp_url("rtsp://192.168.1.10:554/ch1") == "rtsp://192.168.1.10:554/ch1"
    assert mask_rtsp_url("invalid-url") == "invalid-url"


@pytest.mark.asyncio
async def test_users_and_audit_logs(tmp_path):
    test_db = str(tmp_path / "test_auth.db")
    await init_db(test_db)
    
    from app.models import UserRepository, AuditLogRepository
    user_repo = UserRepository(test_db)
    audit_repo = AuditLogRepository(test_db)
    
    # 1. Default user seeded
    admin = await user_repo.get_by_username("admin")
    assert admin is not None
    assert admin["username"] == "admin"
    assert admin["password_hash"].startswith("$2b$")
    
    # 2. Audit log recorded
    logs = await audit_repo.get_recent(limit=10)
    assert len(logs) >= 1
    assert any("admin" in l["description"].lower() or "INITIALIZED" in l["event_type"] for l in logs)

