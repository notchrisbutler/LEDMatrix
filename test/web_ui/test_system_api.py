"""Tests for web_ui system API."""

import pytest
from unittest.mock import patch, MagicMock
from httpx import AsyncClient, ASGITransport

from web_ui.server import app


@pytest.mark.asyncio
@pytest.mark.unit
async def test_get_system_status():
    """GET /api/system/status returns CPU, memory, temp."""
    with patch("web_ui.services.system_service.psutil") as mock_psutil:
        mock_psutil.cpu_percent.return_value = 25.0
        mock_mem = MagicMock()
        mock_mem.percent = 45.0
        mock_psutil.virtual_memory.return_value = mock_mem
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/system/status")
        assert resp.status_code == 200
        data = resp.json()
        assert "cpu_percent" in data
        assert "memory_percent" in data
