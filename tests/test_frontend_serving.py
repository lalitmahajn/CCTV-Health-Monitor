import pytest
import os
from httpx import AsyncClient, ASGITransport
from app.main import create_app
from app.database import init_db

@pytest.mark.asyncio
async def test_frontend_serving(tmp_path):
    test_db = str(tmp_path / "frontend.db")
    await init_db(test_db)
    app = create_app(db_path=test_db)
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/")
        assert res.status_code == 200
        assert "CCTV Health Monitor" in res.text
        assert "tab-dashboard" in res.text
        assert "tab-incidents" in res.text
        assert "tab-cameras" in res.text
        assert "tab-csv" in res.text
        assert "tab-settings" in res.text
