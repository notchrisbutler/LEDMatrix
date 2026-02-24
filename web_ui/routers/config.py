"""Config API endpoints."""

from typing import Any

from fastapi import APIRouter, HTTPException

from web_ui.services.config_service import ConfigService

router = APIRouter(prefix="/api/config", tags=["config"])


@router.get("")
async def get_config() -> dict[str, Any]:
    """Return the full configuration."""
    try:
        return ConfigService.get_config()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("")
async def update_config(body: dict[str, Any]) -> dict[str, str]:
    """Update configuration sections."""
    try:
        ConfigService.update_config(body)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
