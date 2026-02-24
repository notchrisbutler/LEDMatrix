"""Tests for web_ui plugins API."""

import pytest
from unittest.mock import MagicMock, patch
from httpx import AsyncClient, ASGITransport

from web_ui.server import app


@pytest.fixture
def mock_plugin_info():
    return [
        {
            "id": "nhl-scoreboard",
            "name": "NHL Scoreboard",
            "version": "1.2.0",
            "author": "ChuckBuilds",
            "description": "NHL scores",
            "category": "Sports",
            "enabled": True,
            "tags": ["nhl", "hockey"],
        }
    ]


@pytest.mark.asyncio
@pytest.mark.unit
async def test_list_plugins(mock_plugin_info):
    """GET /api/plugins returns installed plugin list."""
    with (
        patch("web_ui.services.plugin_service.PluginService._plugin_manager") as mock_pm,
        patch("web_ui.services.plugin_service.PluginService._config_manager") as mock_cm,
    ):
        mock_pm.get_all_plugin_info.return_value = mock_plugin_info
        mock_pm.get_plugin.return_value = MagicMock(enabled=True)
        mock_cm.load_config.return_value = {"nhl-scoreboard": {"enabled": True}}
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/plugins")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["id"] == "nhl-scoreboard"
