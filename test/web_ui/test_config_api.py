"""Tests for web_ui config API."""

import pytest
from unittest.mock import patch
from httpx import AsyncClient, ASGITransport

from web_ui.server import app


@pytest.fixture
def mock_config_data():
    return {
        "general": {"name": "My Matrix"},
        "display": {"hardware": {"cols": 64, "chain_length": 2, "rows": 32, "brightness": 80}},
        "schedule": {"enabled": False},
    }


@pytest.mark.asyncio
@pytest.mark.unit
async def test_get_config(mock_config_data):
    """GET /api/config returns full config."""
    with patch("web_ui.services.config_service.ConfigService._config_manager") as mock_cm:
        mock_cm.load_config.return_value = mock_config_data
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/config")
        assert resp.status_code == 200
        data = resp.json()
        assert data["general"]["name"] == "My Matrix"


@pytest.mark.asyncio
@pytest.mark.unit
async def test_post_config(mock_config_data):
    """POST /api/config updates config."""
    with patch("web_ui.services.config_service.ConfigService._config_manager") as mock_cm:
        mock_cm.load_config.return_value = mock_config_data
        mock_cm.save_config.return_value = None
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/config", json={"general": {"name": "Updated"}})
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"
