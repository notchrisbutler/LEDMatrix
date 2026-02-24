"""Lightweight LED Matrix Web UI — FastAPI backend."""

import os
import sys
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from web_ui.routers.config import router as config_router
from web_ui.routers.plugins import router as plugins_router
from web_ui.routers.system import router as system_router
from web_ui.routers.ws import router as ws_router
from web_ui.services.config_service import ConfigService
from web_ui.services.plugin_service import PluginService

app = FastAPI(title="LEDMatrix Web UI", docs_url=None, redoc_url=None)


@app.on_event("startup")
async def startup():
    """Initialize services on startup."""
    ConfigService.init()

    # Resolve plugins dir
    config = ConfigService.get_config()
    plugin_system_config = config.get("plugin_system", {})
    plugins_dir_name = plugin_system_config.get("plugins_directory", "plugin-repos")
    if os.path.isabs(plugins_dir_name):
        plugins_dir = plugins_dir_name
    else:
        plugins_dir = str(PROJECT_ROOT / plugins_dir_name)

    PluginService.init(plugins_dir=plugins_dir, config_manager=ConfigService._config_manager)


# Register API routers
app.include_router(config_router)
app.include_router(system_router)
app.include_router(plugins_router)
app.include_router(ws_router)

# Serve static files
STATIC_DIR = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/")
async def index():
    """Serve the SPA shell."""
    return FileResponse(str(STATIC_DIR / "index.html"))


# Catch-all for SPA routes (so refreshing #/plugins still works)
@app.get("/{path:path}")
async def spa_fallback(path: str):
    """Serve index.html for all non-API, non-static routes."""
    file_path = STATIC_DIR / path
    if file_path.exists() and file_path.is_file():
        return FileResponse(str(file_path))
    return FileResponse(str(STATIC_DIR / "index.html"))
