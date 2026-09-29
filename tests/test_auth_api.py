import pytest
from httpx import AsyncClient, ASGITransport
from app.main import create_app

@pytest.mark.asyncio
async def test_auth_api_lifecycle(tmp_path):
    test_db = str(tmp_path / "test_api_auth.db")
    from app.database import init_db
    await init_db(test_db)
    app = create_app(db_path=test_db)
    transport = ASGITransport(app=app)
    
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Check me (unauthenticated)
        res = await client.get("/api/auth/me")
        assert res.status_code == 200
        assert res.json()["authenticated"] is False
        
        # 2. Login with bad password
        res = await client.post("/api/auth/login", json={"username": "admin", "password": "wrong"})
        assert res.status_code == 401
        
        # 3. Login with correct password
        res = await client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
        assert res.status_code == 200
        assert res.json()["authenticated"] is True
        assert "cctv_session" in res.cookies
        
        # 4. Check me with cookie
        res = await client.get("/api/auth/me")
        assert res.status_code == 200
        assert res.json()["authenticated"] is True
        assert res.json()["username"] == "admin"
        
        # 5. Update credentials
        res = await client.put("/api/auth/credentials", json={
            "current_password": "admin123",
            "new_username": "superadmin",
            "new_password": "newpassword123"
        })
        assert res.status_code == 200
        assert res.json()["success"] is True
        assert res.json()["username"] == "superadmin"
        
        # 6. Check audit logs
        res = await client.get("/api/admin/audit-logs")
        assert res.status_code == 200
        logs = res.json()
        assert len(logs) >= 2  # login + credentials_updated
        
        # 7. Check diagnostics
        res = await client.get("/api/admin/diagnostics")
        assert res.status_code == 200
        diag = res.json()
        assert "uptime_seconds" in diag
        assert "db_size_bytes" in diag
        
        # 8. Logout
        res = await client.post("/api/auth/logout")
        assert res.status_code == 200
        assert res.json()["authenticated"] is False
        
        # Verify me is unauthenticated again
        res = await client.get("/api/auth/me")
        assert res.status_code == 200
        assert res.json()["authenticated"] is False
