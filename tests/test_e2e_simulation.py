import pytest
from httpx import AsyncClient, ASGITransport
from app.main import create_app
from app.database import init_db

@pytest.mark.asyncio
async def test_270_camera_simulation_lifecycle(tmp_path):
    test_db = str(tmp_path / "simulation.db")
    await init_db(test_db)
    app = create_app(db_path=test_db)
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Authenticate
        login_res = await client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
        assert login_res.status_code == 200

        # 1. Seed 270 mock cameras across 10 NVRs
        res_seed = await client.post("/api/simulator/seed-270")
        assert res_seed.status_code == 200
        assert res_seed.json()["count"] == 270
        
        # 2. Verify listing length and fields
        res_list = await client.get("/api/cameras")
        assert res_list.status_code == 200
        cams = res_list.json()
        assert len(cams) == 270
        
        # Verify NVR distribution
        nvrs = set(c["dvr_nvr_name"] for c in cams)
        assert len(nvrs) == 10
        
        # 3. Simulate an outage on Camera #1
        first_cam = cams[0]
        res_fail = await client.post("/api/simulator/simulate-outage", json={
            "camera_id": first_cam["id"],
            "error_reason": "RTSP Connection Timeout (4000ms)"
        })
        assert res_fail.status_code == 200
        assert "incident_id" in res_fail.json()
        
        # 4. Verify incident logged
        res_inc = await client.get("/api/incidents")
        assert res_inc.status_code == 200
        active = res_inc.json()["active"]
        assert len(active) == 1
        assert active[0]["camera_id"] == first_cam["id"]
        assert "RTSP Connection Timeout" in active[0]["error_reason"]
        
        # 5. Verify camera status is OFFLINE
        res_cam = await client.get(f"/api/cameras/{first_cam['id']}")
        assert res_cam.json()["status"] == "OFFLINE"
