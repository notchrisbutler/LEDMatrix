"""Plugin API endpoints."""

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from web_ui.services.plugin_service import PluginService

router = APIRouter(prefix="/api/plugins", tags=["plugins"])


class ToggleRequest(BaseModel):
    plugin_id: str
    enabled: bool


class InstallRequest(BaseModel):
    plugin_id: str


@router.get("")
async def list_plugins() -> list[dict[str, Any]]:
    """List all installed plugins."""
    return PluginService.list_plugins()


@router.get("/{plugin_id}/config")
async def get_plugin_config(plugin_id: str) -> dict[str, Any]:
    """Get plugin config and schema."""
    return PluginService.get_plugin_config(plugin_id)


@router.post("/{plugin_id}/config")
async def save_plugin_config(plugin_id: str, body: dict[str, Any]) -> dict[str, str]:
    """Save plugin configuration."""
    try:
        PluginService.save_plugin_config(plugin_id, body)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/{plugin_id}/toggle")
async def toggle_plugin(plugin_id: str, body: ToggleRequest) -> dict[str, Any]:
    """Enable or disable a plugin."""
    return PluginService.toggle_plugin(plugin_id, body.enabled)


@router.get("/store")
async def get_store() -> list[dict[str, Any]]:
    """Get available plugins from the store."""
    return PluginService.get_store_plugins()


@router.post("/install")
async def install_plugin(body: InstallRequest) -> dict[str, str]:
    """Install a plugin from the store."""
    return PluginService.install_plugin(body.plugin_id)


@router.post("/uninstall")
async def uninstall_plugin(body: InstallRequest) -> dict[str, str]:
    """Uninstall a plugin."""
    return PluginService.uninstall_plugin(body.plugin_id)
