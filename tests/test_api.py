import pytest
from httpx import AsyncClient, ASGITransport
from app.main import create_app

@pytest.mark.asyncio
async def test_api_camera_endpoints(tmp_path):
    test_db = str(tmp_path / "test_api.db")
    from app.database import init_db
    await init_db(test_db)
    app = create_app(db_path=test_db)
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Settings
        res = await client.get("/api/settings")
        assert res.status_code == 200
        assert "failure_threshold" in res.json()
        
        # Add Camera
        payload = {
            "name": "Test Cam", "dvr_nvr_name": "NVR-01", "location": "Yard",
            "ip_address": "127.0.0.1", "port": 554, "channel_no": "01",
            "rtsp_url": "rtsp://admin:secret@127.0.0.1:554/ch1"
        }
        res_post = await client.post("/api/cameras", json=payload)
        assert res_post.status_code == 201
        cam_id = res_post.json()["id"]
        
        # List Cameras - password should be masked
        res_get = await client.get("/api/cameras")
        assert res_get.status_code == 200
        cams = res_get.json()
        assert len(cams) == 1
        assert "secret" not in cams[0]["masked_url"]
        assert "admin" not in cams[0]["masked_url"]
        assert "secret" not in cams[0]["rtsp_url"]
        assert "admin" not in cams[0]["rtsp_url"]
        assert cams[0]["dvr_nvr_name"] == "NVR-01"
        assert cams[0]["channel_no"] == "01"


        # Update Settings
        res_set = await client.post("/api/settings", json={"failure_threshold": "3"})
        assert res_set.status_code == 200
        res_set_get = await client.get("/api/settings")
        assert res_set_get.json()["failure_threshold"] == "3"

        # Seed 270 cameras
        res_seed = await client.post("/api/simulator/seed-270")
        assert res_seed.status_code == 200
        assert res_seed.json()["count"] == 270

        # NVR List
        res_nvrs = await client.get("/api/nvrs")
        assert res_nvrs.status_code == 200

        # NVR Audit on 404 NVR
        res_audit_404 = await client.post("/api/nvrs/NonExistentNVR/audit-channels")
        assert res_audit_404.status_code == 404

        # Toggle No Cam on an active seeded camera
        cams_all = (await client.get("/api/cameras")).json()
        target_id = cams_all[0]["id"]
        res_toggle = await client.post(f"/api/cameras/{target_id}/toggle-no-cam")
        assert res_toggle.status_code == 200
        assert res_toggle.json()["is_no_cam"] == 1
        assert res_toggle.json()["status"] == "NO_CAM"

        # Toggle back
        res_toggle_back = await client.post(f"/api/cameras/{target_id}/toggle-no-cam")
        assert res_toggle_back.status_code == 200
        assert res_toggle_back.json()["is_no_cam"] == 0

        # Rename NVR across all cameras
        # "NVR-01-MainAdmin" was created by seed-270 (27 cameras)
        res_rename = await client.post("/api/nvrs/NVR-01-MainAdmin/rename", json={"new_name": "Main Gate NVR"})
        assert res_rename.status_code == 200
        data = res_rename.json()
        assert data["new_name"] == "Main Gate NVR"
        assert data["cameras_updated"] == 27

        # Verify cameras reflect the new name
        cams_after = (await client.get("/api/cameras")).json()
        renamed_cams = [c for c in cams_after if c["dvr_nvr_name"] == "Main Gate NVR"]
        assert len(renamed_cams) == 27

        # Test Excel export endpoint
        res_excel = await client.get("/api/cameras/excel/export")
        assert res_excel.status_code == 200
        assert res_excel.headers["content-type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        assert len(res_excel.content) > 1000

        # Test Fleet Uptime History endpoint with extended presets
        for period in ["1h", "6h", "24h", "7d", "30d", "90d"]:
            res_uptime = await client.get(f"/api/fleet/uptime-history?period={period}")
            assert res_uptime.status_code == 200
            uptime_data = res_uptime.json()
            assert uptime_data["period"] == period

            assert "total_provisioned" in uptime_data
            assert "summary" in uptime_data
            assert "current_operating" in uptime_data["summary"]
            assert len(uptime_data["data_points"]) > 0
            latest_point = uptime_data["data_points"][-1]
            assert "operating" in latest_point
            assert "label" in latest_point







