"""WebSocket endpoint for real-time updates."""

import asyncio
import base64
import os
import time
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()


async def system_stats_producer() -> dict[str, Any]:
    """Produce system stats payload."""
    import psutil

    cpu_temp = 0.0
    try:
        with open("/sys/class/thermal/thermal_zone0/temp") as f:
            cpu_temp = round(float(f.read()) / 1000.0, 1)
    except (FileNotFoundError, ValueError):
        pass

    return {
        "type": "stats",
        "data": {
            "cpu_percent": psutil.cpu_percent(interval=0),
            "memory_percent": round(psutil.virtual_memory().percent, 1),
            "cpu_temp": cpu_temp,
            "timestamp": time.time(),
        },
    }


async def display_preview_producer() -> dict[str, Any] | None:
    """Produce display preview payload if snapshot has changed."""
    snapshot_path = "/tmp/led_matrix_preview.png"
    if not os.path.exists(snapshot_path):
        return None
    try:
        with open(snapshot_path, "rb") as f:
            img_bytes = f.read()
        img_b64 = base64.b64encode(img_bytes).decode("utf-8")
        return {
            "type": "display",
            "data": {"image": img_b64, "timestamp": time.time()},
        }
    except OSError:
        return None


@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    try:
        while True:
            # Send system stats every 10 seconds
            stats = await system_stats_producer()
            await ws.send_json(stats)

            # Send display preview every 1 second (if available)
            for _ in range(10):
                preview = await display_preview_producer()
                if preview:
                    await ws.send_json(preview)
                await asyncio.sleep(1)
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
