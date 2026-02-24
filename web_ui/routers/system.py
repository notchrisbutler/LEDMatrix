"""System API endpoints."""

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from web_ui.services.system_service import SystemService

router = APIRouter(prefix="/api/system", tags=["system"])


class ActionRequest(BaseModel):
    action: str


@router.get("/status")
async def get_status() -> dict[str, Any]:
    """Return system status (CPU, memory, temp, service)."""
    return SystemService.get_status()


@router.post("/action")
async def system_action(body: ActionRequest) -> dict[str, str]:
    """Run a system action (restart, stop)."""
    return SystemService.run_action(body.action)
