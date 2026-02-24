# Lightweight Web UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a new lightweight web interface using FastAPI + vanilla JS + Pico CSS that runs on port 5454 alongside the existing Flask interface.

**Architecture:** FastAPI serves a JSON API + static files. Services layer wraps existing `src/` modules. Frontend is a single-page app with hash routing, vanilla JS components, and a single WebSocket for real-time updates.

**Tech Stack:** Python (FastAPI, uvicorn), vanilla JavaScript (ES modules), Pico CSS, WebSockets.

---

### Task 1: Project Scaffolding

**Files:**
- Create: `web_ui/__init__.py`
- Create: `web_ui/requirements.txt`
- Create: `web_ui/server.py`
- Create: `web_ui/routers/__init__.py`
- Create: `web_ui/services/__init__.py`
- Create: `web_ui/static/index.html`
- Create: `web_ui/static/css/pico.min.css`
- Create: `web_ui/static/css/style.css`
- Create: `web_ui/static/js/app.js`
- Modify: `Makefile` (add `web2` target)
- Modify: `ruff.toml` (don't exclude `web_ui/`)

**Step 1: Create directory structure**

```bash
mkdir -p web_ui/routers web_ui/services web_ui/static/css web_ui/static/js/components web_ui/static/js/lib web_ui/static/img
```

**Step 2: Create requirements.txt**

```
# web_ui/requirements.txt
fastapi>=0.115.0,<1.0.0
uvicorn[standard]>=0.32.0,<1.0.0
psutil>=6.0.0,<7.0.0
websockets>=12.0,<14.0
```

**Step 3: Create server.py with minimal FastAPI app**

```python
# web_ui/server.py
"""Lightweight LED Matrix Web UI — FastAPI backend."""

import os
import sys
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

app = FastAPI(title="LEDMatrix Web UI", docs_url=None, redoc_url=None)

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
```

**Step 4: Create minimal index.html**

```html
<!-- web_ui/static/index.html -->
<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LEDMatrix</title>
    <link rel="stylesheet" href="/static/css/pico.min.css">
    <link rel="stylesheet" href="/static/css/style.css">
</head>
<body>
    <nav class="sidebar" id="sidebar">
        <header>
            <h2>LEDMatrix</h2>
        </header>
        <ul>
            <li><a href="#/" class="nav-link active" data-page="dashboard">Dashboard</a></li>
            <li><a href="#/plugins" class="nav-link" data-page="plugins">Plugins</a></li>
            <li><a href="#/display" class="nav-link" data-page="display">Display</a></li>
            <li><a href="#/settings" class="nav-link" data-page="settings">Settings</a></li>
        </ul>
    </nav>
    <main id="content" class="main-content">
        <p>Loading...</p>
    </main>
    <script type="module" src="/static/js/app.js"></script>
</body>
</html>
```

**Step 5: Create style.css with basic layout**

```css
/* web_ui/static/css/style.css */
:root {
    --sidebar-width: 240px;
}

body {
    display: flex;
    min-height: 100vh;
    margin: 0;
}

.sidebar {
    width: var(--sidebar-width);
    position: fixed;
    top: 0;
    left: 0;
    height: 100vh;
    overflow-y: auto;
    padding: 1rem;
    border-right: 1px solid var(--pico-muted-border-color);
}

.sidebar header h2 {
    margin-bottom: 1rem;
    font-size: 1.25rem;
}

.sidebar ul {
    list-style: none;
    padding: 0;
}

.sidebar .nav-link {
    display: block;
    padding: 0.5rem 0.75rem;
    border-radius: 0.375rem;
    text-decoration: none;
}

.sidebar .nav-link.active {
    background: var(--pico-primary-focus);
}

.main-content {
    margin-left: var(--sidebar-width);
    padding: 2rem;
    flex: 1;
    width: calc(100% - var(--sidebar-width));
}

/* Mobile: collapse sidebar */
@media (max-width: 768px) {
    .sidebar {
        display: none;
    }
    .main-content {
        margin-left: 0;
        width: 100%;
    }
}
```

**Step 6: Create minimal app.js with hash router**

```javascript
// web_ui/static/js/app.js
const content = document.getElementById("content");

const routes = {
    "/": () => "<h1>Dashboard</h1><p>Loading...</p>",
    "/plugins": () => "<h1>Plugins</h1><p>Loading...</p>",
    "/display": () => "<h1>Display</h1><p>Loading...</p>",
    "/settings": () => "<h1>Settings</h1><p>Loading...</p>",
};

function navigate() {
    const hash = window.location.hash.slice(1) || "/";
    const render = routes[hash];
    if (render) {
        content.innerHTML = render();
    } else {
        content.innerHTML = "<h1>Not Found</h1>";
    }
    // Update active nav link
    document.querySelectorAll(".nav-link").forEach((link) => {
        const href = link.getAttribute("href").slice(1);
        link.classList.toggle("active", href === hash);
    });
}

window.addEventListener("hashchange", navigate);
navigate();
```

**Step 7: Download Pico CSS**

```bash
curl -o web_ui/static/css/pico.min.css https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css
```

**Step 8: Create __init__.py files**

```python
# web_ui/__init__.py
# (empty)
```

```python
# web_ui/routers/__init__.py
# (empty)
```

```python
# web_ui/services/__init__.py
# (empty)
```

**Step 9: Add `web2` target to Makefile**

Add after the existing `run-all` target:

```makefile
.PHONY: web2
web2: ## Run lightweight web UI (port 5454)
	$(PYTHON) -m uvicorn web_ui.server:app --host 0.0.0.0 --port 5454 --reload
```

**Step 10: Run and verify**

```bash
make web2
```

Open `http://localhost:5454` — should see the sidebar and "Dashboard" heading. Click nav links to verify routing works.

**Step 11: Commit**

```bash
git add web_ui/ Makefile
git commit -m "feat(web-ui): scaffold FastAPI + Pico CSS lightweight web interface"
```

---

### Task 2: Config Service + Config API

**Files:**
- Create: `web_ui/services/config_service.py`
- Create: `web_ui/routers/config.py`
- Modify: `web_ui/server.py` (register router)
- Create: `test/web_ui/__init__.py`
- Create: `test/web_ui/test_config_api.py`

**Step 1: Write the failing test**

```python
# test/web_ui/__init__.py
# (empty)
```

```python
# test/web_ui/test_config_api.py
"""Tests for web_ui config API."""

import pytest
from unittest.mock import MagicMock, patch
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
```

**Step 2: Run test to verify it fails**

```bash
venv/bin/pytest test/web_ui/test_config_api.py -v
```

Expected: FAIL (modules don't exist yet)

**Step 3: Create config_service.py**

```python
# web_ui/services/config_service.py
"""Config service — wraps src.config_manager.ConfigManager."""

from pathlib import Path
from typing import Any

from src.config_manager import ConfigManager


class ConfigService:
    """Thin wrapper around ConfigManager with in-memory caching."""

    _config_manager: ConfigManager = None
    _cache: dict | None = None

    @classmethod
    def init(cls) -> None:
        cls._config_manager = ConfigManager()
        cls._cache = None

    @classmethod
    def get_config(cls) -> dict[str, Any]:
        if cls._cache is None:
            cls._cache = cls._config_manager.load_config()
        return cls._cache

    @classmethod
    def update_config(cls, updates: dict[str, Any]) -> None:
        config = cls.get_config()
        config.update(updates)
        cls._config_manager.save_config(config)
        cls._cache = None  # Invalidate cache

    @classmethod
    def get_raw(cls, file_type: str) -> dict[str, Any]:
        return cls._config_manager.get_raw_file_content(file_type)

    @classmethod
    def invalidate(cls) -> None:
        cls._cache = None
```

**Step 4: Create config router**

```python
# web_ui/routers/config.py
"""Config API endpoints."""

from fastapi import APIRouter, HTTPException
from typing import Any

from web_ui.services.config_service import ConfigService

router = APIRouter(prefix="/api/config", tags=["config"])


@router.get("")
async def get_config() -> dict[str, Any]:
    """Return the full configuration."""
    try:
        return ConfigService.get_config()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("")
async def update_config(body: dict[str, Any]) -> dict[str, str]:
    """Update configuration sections."""
    try:
        ConfigService.update_config(body)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

**Step 5: Register router in server.py**

Add to `web_ui/server.py` before the static mount:

```python
from web_ui.routers.config import router as config_router
from web_ui.services.config_service import ConfigService

@app.on_event("startup")
async def startup():
    """Initialize services on startup."""
    ConfigService.init()

app.include_router(config_router)
```

**Step 6: Run tests**

```bash
venv/bin/pytest test/web_ui/test_config_api.py -v
```

Expected: PASS

**Step 7: Commit**

```bash
git add web_ui/services/config_service.py web_ui/routers/config.py web_ui/server.py test/web_ui/
git commit -m "feat(web-ui): add config service and API endpoints"
```

---

### Task 3: System Service + System API

**Files:**
- Create: `web_ui/services/system_service.py`
- Create: `web_ui/routers/system.py`
- Modify: `web_ui/server.py` (register router)
- Create: `test/web_ui/test_system_api.py`

**Step 1: Write the failing test**

```python
# test/web_ui/test_system_api.py
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
```

**Step 2: Run test to verify it fails**

```bash
venv/bin/pytest test/web_ui/test_system_api.py -v
```

**Step 3: Create system_service.py**

```python
# web_ui/services/system_service.py
"""System service — system stats and service control."""

import subprocess
import time
from typing import Any

import psutil


class SystemService:
    """System monitoring with throttled reads."""

    _cache: dict[str, Any] | None = None
    _cache_time: float = 0
    _cache_ttl: float = 5.0  # seconds

    @classmethod
    def get_status(cls) -> dict[str, Any]:
        now = time.time()
        if cls._cache and (now - cls._cache_time) < cls._cache_ttl:
            return cls._cache

        cpu_temp = 0.0
        try:
            with open("/sys/class/thermal/thermal_zone0/temp") as f:
                cpu_temp = round(float(f.read()) / 1000.0, 1)
        except (FileNotFoundError, ValueError):
            pass

        service_active = False
        try:
            result = subprocess.run(
                ["systemctl", "is-active", "ledmatrix"],
                capture_output=True, text=True, timeout=2,
            )
            service_active = result.stdout.strip() == "active"
        except (subprocess.TimeoutExpired, FileNotFoundError):
            pass

        cls._cache = {
            "cpu_percent": psutil.cpu_percent(interval=0),
            "memory_percent": round(psutil.virtual_memory().percent, 1),
            "cpu_temp": cpu_temp,
            "service_active": service_active,
            "timestamp": now,
        }
        cls._cache_time = now
        return cls._cache

    @classmethod
    def run_action(cls, action: str) -> dict[str, str]:
        """Run a system action (restart, stop)."""
        allowed = {"restart": "restart", "stop": "stop"}
        cmd = allowed.get(action)
        if not cmd:
            return {"status": "error", "message": f"Unknown action: {action}"}
        try:
            subprocess.run(
                ["sudo", "systemctl", cmd, "ledmatrix"],
                capture_output=True, text=True, timeout=10,
            )
            cls._cache = None  # Invalidate
            return {"status": "ok", "message": f"Service {cmd} initiated"}
        except Exception as e:
            return {"status": "error", "message": str(e)}
```

**Step 4: Create system router**

```python
# web_ui/routers/system.py
"""System API endpoints."""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Any

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
```

**Step 5: Register in server.py**

```python
from web_ui.routers.system import router as system_router

app.include_router(system_router)
```

**Step 6: Run tests**

```bash
venv/bin/pytest test/web_ui/test_system_api.py -v
```

**Step 7: Commit**

```bash
git add web_ui/services/system_service.py web_ui/routers/system.py web_ui/server.py test/web_ui/test_system_api.py
git commit -m "feat(web-ui): add system service and API endpoints"
```

---

### Task 4: Plugin Service + Plugin API

**Files:**
- Create: `web_ui/services/plugin_service.py`
- Create: `web_ui/routers/plugins.py`
- Modify: `web_ui/server.py` (register router, init plugin service)
- Create: `test/web_ui/test_plugins_api.py`

**Step 1: Write the failing test**

```python
# test/web_ui/test_plugins_api.py
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
    with patch("web_ui.services.plugin_service.PluginService._plugin_manager") as mock_pm:
        mock_pm.get_all_plugin_info.return_value = mock_plugin_info
        mock_pm.get_plugin.return_value = MagicMock(enabled=True)
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/plugins")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["id"] == "nhl-scoreboard"
```

**Step 2: Run test to verify it fails**

```bash
venv/bin/pytest test/web_ui/test_plugins_api.py -v
```

**Step 3: Create plugin_service.py**

```python
# web_ui/services/plugin_service.py
"""Plugin service — wraps PluginManager and StoreManager."""

import json
from pathlib import Path
from typing import Any, Optional

from src.config_manager import ConfigManager
from src.plugin_system.plugin_manager import PluginManager
from src.plugin_system.store_manager import PluginStoreManager


class PluginService:
    """Thin wrapper around plugin system modules."""

    _plugin_manager: PluginManager = None
    _store_manager: PluginStoreManager = None
    _config_manager: ConfigManager = None

    @classmethod
    def init(cls, plugins_dir: str, config_manager: ConfigManager) -> None:
        cls._config_manager = config_manager
        cls._plugin_manager = PluginManager(
            plugins_dir=plugins_dir,
            config_manager=config_manager,
            display_manager=None,
            cache_manager=None,
        )
        cls._store_manager = PluginStoreManager(plugins_dir=plugins_dir)
        cls._plugin_manager.discover_plugins()

    @classmethod
    def list_plugins(cls) -> list[dict[str, Any]]:
        all_info = cls._plugin_manager.get_all_plugin_info()
        config = cls._config_manager.load_config()
        result = []
        for info in all_info:
            pid = info.get("id")
            plugin_config = config.get(pid, {})
            enabled = plugin_config.get("enabled", True)
            # Check plugin instance
            instance = cls._plugin_manager.get_plugin(pid)
            if instance:
                enabled = instance.enabled
            result.append({
                "id": pid,
                "name": info.get("name", pid),
                "version": info.get("version", ""),
                "author": info.get("author", "Unknown"),
                "description": info.get("description", ""),
                "category": info.get("category", "General"),
                "enabled": enabled,
                "tags": info.get("tags", []),
            })
        return result

    @classmethod
    def get_plugin_config(cls, plugin_id: str) -> dict[str, Any]:
        config = cls._config_manager.load_config()
        plugin_config = config.get(plugin_id, {})
        # Load schema
        schema = {}
        schema_path = cls._plugin_manager.plugins_dir / plugin_id / "config_schema.json"
        if schema_path.exists():
            try:
                schema = json.loads(schema_path.read_text())
            except (json.JSONDecodeError, OSError):
                pass
        return {"config": plugin_config, "schema": schema}

    @classmethod
    def save_plugin_config(cls, plugin_id: str, new_config: dict[str, Any]) -> None:
        config = cls._config_manager.load_config()
        config[plugin_id] = new_config
        cls._config_manager.save_config(config)

    @classmethod
    def toggle_plugin(cls, plugin_id: str, enabled: bool) -> dict[str, str]:
        config = cls._config_manager.load_config()
        if plugin_id not in config:
            config[plugin_id] = {}
        config[plugin_id]["enabled"] = enabled
        cls._config_manager.save_config(config)
        return {"status": "ok", "plugin_id": plugin_id, "enabled": enabled}

    @classmethod
    def get_store_plugins(cls) -> list[dict[str, Any]]:
        registry = cls._store_manager.fetch_registry()
        return registry.get("plugins", [])

    @classmethod
    def install_plugin(cls, plugin_id: str) -> dict[str, str]:
        success = cls._store_manager.install_plugin(plugin_id)
        if success:
            cls._plugin_manager.discover_plugins()
            return {"status": "ok", "message": f"Installed {plugin_id}"}
        return {"status": "error", "message": f"Failed to install {plugin_id}"}

    @classmethod
    def uninstall_plugin(cls, plugin_id: str) -> dict[str, str]:
        success = cls._store_manager.uninstall_plugin(plugin_id)
        if success:
            cls._plugin_manager.discover_plugins()
            return {"status": "ok", "message": f"Uninstalled {plugin_id}"}
        return {"status": "error", "message": f"Failed to uninstall {plugin_id}"}
```

**Step 4: Create plugins router**

```python
# web_ui/routers/plugins.py
"""Plugin API endpoints."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any

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
        raise HTTPException(status_code=500, detail=str(e))


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
```

**Step 5: Register in server.py and init plugin service in startup**

```python
from web_ui.routers.plugins import router as plugins_router
from web_ui.services.plugin_service import PluginService

app.include_router(plugins_router)

# In startup():
# Resolve plugins dir same as web_interface/app.py
config = ConfigService.get_config()
plugin_system_config = config.get("plugin_system", {})
plugins_dir_name = plugin_system_config.get("plugins_directory", "plugin-repos")
if os.path.isabs(plugins_dir_name):
    plugins_dir = plugins_dir_name
else:
    plugins_dir = str(PROJECT_ROOT / plugins_dir_name)

PluginService.init(plugins_dir=plugins_dir, config_manager=ConfigService._config_manager)
```

**Step 6: Run tests**

```bash
venv/bin/pytest test/web_ui/test_plugins_api.py -v
```

**Step 7: Commit**

```bash
git add web_ui/services/plugin_service.py web_ui/routers/plugins.py web_ui/server.py test/web_ui/test_plugins_api.py
git commit -m "feat(web-ui): add plugin service and API endpoints"
```

---

### Task 5: WebSocket for Real-Time Updates

**Files:**
- Create: `web_ui/routers/ws.py`
- Create: `web_ui/static/js/lib/ws.js`
- Modify: `web_ui/server.py` (register WS route)

**Step 1: Create WebSocket endpoint**

```python
# web_ui/routers/ws.py
"""WebSocket endpoint for real-time updates."""

import asyncio
import json
import time
import os
import base64
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
    except (OSError, IOError):
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
```

**Step 2: Create ws.js client**

```javascript
// web_ui/static/js/lib/ws.js
/**
 * WebSocket manager with auto-reconnect.
 */

const listeners = {};
let socket = null;
let reconnectDelay = 1000;

export function subscribe(type, callback) {
    if (!listeners[type]) listeners[type] = [];
    listeners[type].push(callback);
}

export function unsubscribe(type, callback) {
    if (!listeners[type]) return;
    listeners[type] = listeners[type].filter((cb) => cb !== callback);
}

function dispatch(msg) {
    const cbs = listeners[msg.type];
    if (cbs) cbs.forEach((cb) => cb(msg.data));
}

export function connect() {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${proto}//${location.host}/ws`;
    socket = new WebSocket(url);

    socket.onopen = () => {
        console.log("[ws] connected");
        reconnectDelay = 1000;
    };

    socket.onmessage = (event) => {
        try {
            dispatch(JSON.parse(event.data));
        } catch (e) {
            console.error("[ws] parse error", e);
        }
    };

    socket.onclose = () => {
        console.log(`[ws] closed, reconnecting in ${reconnectDelay}ms`);
        setTimeout(connect, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, 30000);
    };

    socket.onerror = () => {
        socket.close();
    };
}
```

**Step 3: Register in server.py**

```python
from web_ui.routers.ws import router as ws_router

app.include_router(ws_router)
```

**Step 4: Initialize WebSocket in app.js**

Add to `web_ui/static/js/app.js`:

```javascript
import { connect } from "./lib/ws.js";
connect();
```

**Step 5: Run and verify**

```bash
make web2
```

Open browser devtools, check WebSocket connection is established and receiving stats messages.

**Step 6: Commit**

```bash
git add web_ui/routers/ws.py web_ui/static/js/lib/ws.js web_ui/server.py web_ui/static/js/app.js
git commit -m "feat(web-ui): add WebSocket for real-time stats and display preview"
```

---

### Task 6: API Client (JS)

**Files:**
- Create: `web_ui/static/js/api.js`

**Step 1: Create the fetch wrapper**

```javascript
// web_ui/static/js/api.js
/**
 * API client — thin fetch wrapper for all backend calls.
 */

const BASE = "/api";

async function request(method, path, body = null) {
    const opts = {
        method,
        headers: { "Content-Type": "application/json" },
    };
    if (body) opts.body = JSON.stringify(body);

    const resp = await fetch(`${BASE}${path}`, opts);
    if (!resp.ok) {
        const err = await resp.json().catch(() => ({ detail: resp.statusText }));
        throw new Error(err.detail || `HTTP ${resp.status}`);
    }
    return resp.json();
}

export const api = {
    get: (path) => request("GET", path),
    post: (path, body) => request("POST", path, body),
};
```

**Step 2: Commit**

```bash
git add web_ui/static/js/api.js
git commit -m "feat(web-ui): add JS API client wrapper"
```

---

### Task 7: Dashboard Component

**Files:**
- Create: `web_ui/static/js/components/dashboard.js`
- Modify: `web_ui/static/js/app.js` (wire up route)

**Step 1: Create dashboard component**

```javascript
// web_ui/static/js/components/dashboard.js
import { api } from "../api.js";
import { subscribe, unsubscribe } from "../lib/ws.js";

let statsHandler = null;

export default {
    async render(container) {
        // Fetch initial data
        let pluginCount = 0;
        try {
            const plugins = await api.get("/plugins");
            pluginCount = plugins.length;
        } catch (e) {
            console.error("Failed to load plugins", e);
        }

        container.innerHTML = `
            <h1>Dashboard</h1>
            <div class="grid">
                <article>
                    <header>CPU</header>
                    <p id="stat-cpu">--</p>
                </article>
                <article>
                    <header>Memory</header>
                    <p id="stat-mem">--</p>
                </article>
                <article>
                    <header>Temperature</header>
                    <p id="stat-temp">--</p>
                </article>
                <article>
                    <header>Plugins</header>
                    <p>${pluginCount} installed</p>
                </article>
            </div>
            <article>
                <header>Display Preview</header>
                <div id="display-preview" style="text-align:center;">
                    <p>No preview available</p>
                </div>
            </article>
        `;

        // Subscribe to real-time stats
        statsHandler = (data) => {
            const cpu = document.getElementById("stat-cpu");
            const mem = document.getElementById("stat-mem");
            const temp = document.getElementById("stat-temp");
            if (cpu) cpu.textContent = `${data.cpu_percent}%`;
            if (mem) mem.textContent = `${data.memory_percent}%`;
            if (temp) temp.textContent = data.cpu_temp > 0 ? `${data.cpu_temp}°C` : "N/A";
        };
        subscribe("stats", statsHandler);

        // Subscribe to display preview
        subscribe("display", (data) => {
            const el = document.getElementById("display-preview");
            if (el && data.image) {
                el.innerHTML = `<img src="data:image/png;base64,${data.image}" alt="Display preview" style="image-rendering:pixelated; max-width:100%; border:1px solid var(--pico-muted-border-color);">`;
            }
        });
    },

    destroy() {
        if (statsHandler) {
            unsubscribe("stats", statsHandler);
            statsHandler = null;
        }
    },
};
```

**Step 2: Wire up in app.js**

Replace the placeholder routes in `app.js` with component-based routing:

```javascript
// web_ui/static/js/app.js
import { connect } from "./lib/ws.js";
import dashboard from "./components/dashboard.js";

const content = document.getElementById("content");

const routes = {
    "/": dashboard,
    "/plugins": { render: (c) => { c.innerHTML = "<h1>Plugins</h1><p>Coming soon...</p>"; } },
    "/display": { render: (c) => { c.innerHTML = "<h1>Display</h1><p>Coming soon...</p>"; } },
    "/settings": { render: (c) => { c.innerHTML = "<h1>Settings</h1><p>Coming soon...</p>"; } },
};

let currentComponent = null;

async function navigate() {
    const hash = window.location.hash.slice(1) || "/";
    const component = routes[hash];

    // Destroy previous component
    if (currentComponent && currentComponent.destroy) {
        currentComponent.destroy();
    }

    if (component) {
        currentComponent = component;
        await component.render(content);
    } else {
        content.innerHTML = "<h1>Not Found</h1>";
        currentComponent = null;
    }

    // Update active nav link
    document.querySelectorAll(".nav-link").forEach((link) => {
        const href = link.getAttribute("href").slice(1);
        link.classList.toggle("active", href === hash);
    });
}

window.addEventListener("hashchange", navigate);
connect();
navigate();
```

**Step 3: Run and verify**

```bash
make web2
```

Open `http://localhost:5454` — dashboard should show stats cards updating in real-time.

**Step 4: Commit**

```bash
git add web_ui/static/js/components/dashboard.js web_ui/static/js/app.js
git commit -m "feat(web-ui): add dashboard component with real-time stats"
```

---

### Task 8: Plugins List Component

**Files:**
- Create: `web_ui/static/js/components/plugins.js`
- Modify: `web_ui/static/js/app.js` (wire up route)

**Step 1: Create plugins component**

```javascript
// web_ui/static/js/components/plugins.js
import { api } from "../api.js";

export default {
    async render(container) {
        container.innerHTML = "<h1>Plugins</h1><p>Loading...</p>";

        try {
            const plugins = await api.get("/plugins");
            container.innerHTML = `
                <h1>Plugins</h1>
                <div class="grid" style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));">
                    ${plugins.map((p) => this.pluginCard(p)).join("")}
                </div>
            `;
            this.bindEvents(container);
        } catch (e) {
            container.innerHTML = `<h1>Plugins</h1><p class="error">Failed to load plugins: ${e.message}</p>`;
        }
    },

    pluginCard(plugin) {
        return `
            <article data-plugin-id="${plugin.id}">
                <header>
                    <strong>${plugin.name}</strong>
                    <small>${plugin.version}</small>
                </header>
                <p>${plugin.description}</p>
                <footer>
                    <label>
                        <input type="checkbox" role="switch" class="plugin-toggle"
                               data-id="${plugin.id}" ${plugin.enabled ? "checked" : ""}>
                        ${plugin.enabled ? "Enabled" : "Disabled"}
                    </label>
                    <a href="#/plugins/${plugin.id}" class="secondary">Configure</a>
                </footer>
            </article>
        `;
    },

    bindEvents(container) {
        container.querySelectorAll(".plugin-toggle").forEach((toggle) => {
            toggle.addEventListener("change", async (e) => {
                const pluginId = e.target.dataset.id;
                const enabled = e.target.checked;
                try {
                    await api.post(`/plugins/${pluginId}/toggle`, { plugin_id: pluginId, enabled });
                    // Update label
                    const label = e.target.parentElement;
                    label.lastChild.textContent = enabled ? " Enabled" : " Disabled";
                } catch (err) {
                    e.target.checked = !enabled; // Revert on failure
                    console.error("Toggle failed", err);
                }
            });
        });
    },
};
```

**Step 2: Wire up in app.js**

```javascript
import plugins from "./components/plugins.js";

// Add to routes:
"/plugins": plugins,
```

**Step 3: Run and verify**

```bash
make web2
```

Navigate to `#/plugins` — should see plugin cards with toggle switches.

**Step 4: Commit**

```bash
git add web_ui/static/js/components/plugins.js web_ui/static/js/app.js
git commit -m "feat(web-ui): add plugins list component with toggle"
```

---

### Task 9: Plugin Config Component

**Files:**
- Create: `web_ui/static/js/components/plugin-config.js`
- Modify: `web_ui/static/js/app.js` (add dynamic route)

**Step 1: Create plugin config component**

This component renders a form from `config_schema.json` (JSON Schema) — handling string, number, boolean, select, and array fields.

```javascript
// web_ui/static/js/components/plugin-config.js
import { api } from "../api.js";

export default {
    pluginId: null,

    async render(container, pluginId) {
        this.pluginId = pluginId;
        container.innerHTML = `<h1>Plugin Config</h1><p>Loading...</p>`;

        try {
            const { config, schema } = await api.get(`/plugins/${pluginId}/config`);
            const title = schema.title || pluginId;

            container.innerHTML = `
                <h1>${title}</h1>
                <a href="#/plugins">&larr; Back to plugins</a>
                <form id="plugin-config-form">
                    ${this.renderFields(schema, config)}
                    <button type="submit">Save</button>
                </form>
                <div id="config-status"></div>
            `;
            this.bindEvents(container, pluginId);
        } catch (e) {
            container.innerHTML = `<h1>Error</h1><p>${e.message}</p><a href="#/plugins">&larr; Back</a>`;
        }
    },

    renderFields(schema, config) {
        const props = schema.properties || {};
        return Object.entries(props)
            .filter(([key]) => key !== "enabled") // Handled by toggle on plugins page
            .map(([key, prop]) => this.renderField(key, prop, config[key]))
            .join("");
    },

    renderField(key, prop, value) {
        const label = prop.title || key;
        const desc = prop.description ? `<small>${prop.description}</small>` : "";
        const type = prop.type;

        if (prop.enum) {
            const options = prop.enum
                .map((v) => `<option value="${v}" ${v === value ? "selected" : ""}>${v}</option>`)
                .join("");
            return `<label>${label}${desc}<select name="${key}">${options}</select></label>`;
        }

        if (type === "boolean") {
            return `<label><input type="checkbox" name="${key}" role="switch" ${value ? "checked" : ""}> ${label}${desc}</label>`;
        }

        if (type === "number" || type === "integer") {
            const min = prop.minimum !== undefined ? `min="${prop.minimum}"` : "";
            const max = prop.maximum !== undefined ? `max="${prop.maximum}"` : "";
            return `<label>${label}${desc}<input type="number" name="${key}" value="${value ?? prop.default ?? ""}" ${min} ${max}></label>`;
        }

        // Default: string input
        return `<label>${label}${desc}<input type="text" name="${key}" value="${value ?? prop.default ?? ""}"></label>`;
    },

    bindEvents(container, pluginId) {
        const form = container.querySelector("#plugin-config-form");
        const status = container.querySelector("#config-status");

        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const config = {};

            // Get schema to know types
            const { schema } = await api.get(`/plugins/${pluginId}/config`);
            const props = schema.properties || {};

            for (const [key, prop] of Object.entries(props)) {
                if (key === "enabled") continue;
                if (prop.type === "boolean") {
                    config[key] = form.querySelector(`[name="${key}"]`)?.checked ?? false;
                } else if (prop.type === "number" || prop.type === "integer") {
                    const val = formData.get(key);
                    config[key] = val !== null && val !== "" ? Number(val) : null;
                } else {
                    config[key] = formData.get(key) ?? "";
                }
            }

            try {
                await api.post(`/plugins/${pluginId}/config`, config);
                status.innerHTML = `<ins>Configuration saved.</ins>`;
                setTimeout(() => { status.innerHTML = ""; }, 3000);
            } catch (err) {
                status.innerHTML = `<del>Error: ${err.message}</del>`;
            }
        });
    },
};
```

**Step 2: Update app.js router to handle dynamic plugin routes**

In the `navigate` function, add pattern matching for `/plugins/:id`:

```javascript
import pluginConfig from "./components/plugin-config.js";

// In navigate():
const pluginMatch = hash.match(/^\/plugins\/(.+)$/);
if (pluginMatch) {
    currentComponent = pluginConfig;
    await pluginConfig.render(content, pluginMatch[1]);
    return; // handled
}
```

**Step 3: Run and verify**

```bash
make web2
```

Click "Configure" on a plugin card — should see a generated form. Submit to save.

**Step 4: Commit**

```bash
git add web_ui/static/js/components/plugin-config.js web_ui/static/js/app.js
git commit -m "feat(web-ui): add plugin config component with schema-driven forms"
```

---

### Task 10: Settings Component

**Files:**
- Create: `web_ui/static/js/components/settings.js`
- Modify: `web_ui/static/js/app.js` (wire up route)

**Step 1: Create settings component**

```javascript
// web_ui/static/js/components/settings.js
import { api } from "../api.js";

export default {
    async render(container) {
        container.innerHTML = "<h1>Settings</h1><p>Loading...</p>";

        try {
            const config = await api.get("/config");
            const general = config.general || {};
            const display = config.display || {};
            const hw = display.hardware || {};

            container.innerHTML = `
                <h1>Settings</h1>
                <form id="settings-form">
                    <fieldset>
                        <legend>General</legend>
                        <label>Matrix Name
                            <input type="text" name="general.name" value="${general.name || ""}">
                        </label>
                    </fieldset>
                    <fieldset>
                        <legend>Display Hardware</legend>
                        <div class="grid">
                            <label>Columns
                                <input type="number" name="display.hardware.cols" value="${hw.cols || 64}">
                            </label>
                            <label>Rows
                                <input type="number" name="display.hardware.rows" value="${hw.rows || 32}">
                            </label>
                            <label>Chain Length
                                <input type="number" name="display.hardware.chain_length" value="${hw.chain_length || 2}">
                            </label>
                            <label>Brightness
                                <input type="range" name="display.hardware.brightness" min="0" max="100"
                                       value="${hw.brightness || 80}"
                                       oninput="this.nextElementSibling.textContent=this.value+'%'">
                                <span>${hw.brightness || 80}%</span>
                            </label>
                        </div>
                    </fieldset>
                    <button type="submit">Save Settings</button>
                </form>
                <div id="settings-status"></div>

                <fieldset>
                    <legend>Service Control</legend>
                    <div class="grid">
                        <button id="btn-restart" class="outline">Restart Service</button>
                        <button id="btn-stop" class="outline secondary">Stop Service</button>
                    </div>
                </fieldset>
            `;
            this.bindEvents(container, config);
        } catch (e) {
            container.innerHTML = `<h1>Settings</h1><p class="error">${e.message}</p>`;
        }
    },

    bindEvents(container, currentConfig) {
        const form = container.querySelector("#settings-form");
        const status = container.querySelector("#settings-status");

        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const fd = new FormData(form);

            // Build nested config update
            const updates = { ...currentConfig };
            updates.general = { ...updates.general, name: fd.get("general.name") };
            updates.display = {
                ...updates.display,
                hardware: {
                    ...(updates.display?.hardware || {}),
                    cols: Number(fd.get("display.hardware.cols")),
                    rows: Number(fd.get("display.hardware.rows")),
                    chain_length: Number(fd.get("display.hardware.chain_length")),
                    brightness: Number(fd.get("display.hardware.brightness")),
                },
            };

            try {
                await api.post("/config", updates);
                status.innerHTML = `<ins>Settings saved.</ins>`;
                setTimeout(() => { status.innerHTML = ""; }, 3000);
            } catch (err) {
                status.innerHTML = `<del>Error: ${err.message}</del>`;
            }
        });

        container.querySelector("#btn-restart").addEventListener("click", async () => {
            if (confirm("Restart the LEDMatrix service?")) {
                await api.post("/system/action", { action: "restart" });
            }
        });

        container.querySelector("#btn-stop").addEventListener("click", async () => {
            if (confirm("Stop the LEDMatrix service?")) {
                await api.post("/system/action", { action: "stop" });
            }
        });
    },
};
```

**Step 2: Wire up in app.js**

```javascript
import settings from "./components/settings.js";

// Add to routes:
"/settings": settings,
```

**Step 3: Run and verify**

```bash
make web2
```

Navigate to `#/settings` — should see settings form with brightness slider and service control buttons.

**Step 4: Commit**

```bash
git add web_ui/static/js/components/settings.js web_ui/static/js/app.js
git commit -m "feat(web-ui): add settings component with service control"
```

---

### Task 11: Display Preview Component

**Files:**
- Create: `web_ui/static/js/components/display.js`
- Modify: `web_ui/static/js/app.js` (wire up route)

**Step 1: Create display component**

```javascript
// web_ui/static/js/components/display.js
import { subscribe, unsubscribe } from "../lib/ws.js";

let displayHandler = null;

export default {
    async render(container) {
        container.innerHTML = `
            <h1>Display Preview</h1>
            <article>
                <div id="live-preview" style="text-align:center; background:#000; padding:1rem; border-radius:0.5rem;">
                    <p style="color:#666;">Waiting for display data...</p>
                </div>
            </article>
        `;

        displayHandler = (data) => {
            const el = document.getElementById("live-preview");
            if (el && data.image) {
                el.innerHTML = `<img src="data:image/png;base64,${data.image}" alt="LED Matrix"
                    style="image-rendering:pixelated; width:100%; max-width:640px;">`;
            }
        };
        subscribe("display", displayHandler);
    },

    destroy() {
        if (displayHandler) {
            unsubscribe("display", displayHandler);
            displayHandler = null;
        }
    },
};
```

**Step 2: Wire up in app.js**

```javascript
import display from "./components/display.js";

// Add to routes:
"/display": display,
```

**Step 3: Commit**

```bash
git add web_ui/static/js/components/display.js web_ui/static/js/app.js
git commit -m "feat(web-ui): add display preview component"
```

---

### Task 12: Mobile Responsive Layout

**Files:**
- Modify: `web_ui/static/index.html` (add mobile hamburger menu)
- Modify: `web_ui/static/css/style.css` (mobile styles)

**Step 1: Add mobile menu toggle to index.html**

Add a hamburger button before the sidebar nav that shows on mobile:

```html
<button id="menu-toggle" class="mobile-only" aria-label="Menu">&#9776;</button>
```

**Step 2: Add mobile CSS**

```css
.mobile-only {
    display: none;
}

@media (max-width: 768px) {
    .mobile-only {
        display: block;
        position: fixed;
        top: 0.5rem;
        left: 0.5rem;
        z-index: 100;
        background: var(--pico-card-background-color);
        border: 1px solid var(--pico-muted-border-color);
        border-radius: 0.375rem;
        padding: 0.5rem 0.75rem;
        font-size: 1.25rem;
        cursor: pointer;
    }

    .sidebar {
        display: none;
        position: fixed;
        z-index: 99;
        width: 100%;
        height: 100vh;
        background: var(--pico-background-color);
    }

    .sidebar.open {
        display: block;
    }

    .main-content {
        margin-left: 0;
        width: 100%;
        padding: 1rem;
        padding-top: 3rem;
    }
}
```

**Step 3: Add toggle JS to app.js**

```javascript
// Mobile menu toggle
const menuBtn = document.getElementById("menu-toggle");
const sidebar = document.getElementById("sidebar");
if (menuBtn) {
    menuBtn.addEventListener("click", () => sidebar.classList.toggle("open"));
    // Close sidebar on nav click (mobile)
    sidebar.querySelectorAll(".nav-link").forEach((link) => {
        link.addEventListener("click", () => sidebar.classList.remove("open"));
    });
}
```

**Step 4: Test at different viewport sizes, verify layout works**

**Step 5: Commit**

```bash
git add web_ui/static/index.html web_ui/static/css/style.css web_ui/static/js/app.js
git commit -m "feat(web-ui): add responsive mobile layout with hamburger menu"
```

---

### Task 13: Makefile Integration + Install Dependencies

**Files:**
- Modify: `Makefile` (add install-web2, web2 targets)

**Step 1: Update Makefile**

Add after existing targets:

```makefile
.PHONY: install-web2
install-web2: ## Install lightweight web UI dependencies
	$(PIP) install -r web_ui/requirements.txt

.PHONY: web2
web2: ## Run lightweight web UI (port 5454)
	$(PYTHON) -m uvicorn web_ui.server:app --host 0.0.0.0 --port 5454 --reload
```

**Step 2: Install and run**

```bash
make install-web2
make web2
```

**Step 3: Commit**

```bash
git add Makefile
git commit -m "chore: add web2 Makefile targets for lightweight web UI"
```

---

### Task 14: Final Integration Test

**Step 1: Install deps and start the server**

```bash
make install-web2
make web2
```

**Step 2: Verify all pages**

- `http://localhost:5454` — Dashboard with live stats
- `http://localhost:5454/#/plugins` — Plugin list with toggles
- Click "Configure" on a plugin — form renders from schema
- `http://localhost:5454/#/display` — Display preview
- `http://localhost:5454/#/settings` — Settings form, service buttons
- Resize browser to mobile width — hamburger menu works

**Step 3: Verify coexistence**

```bash
# In another terminal
make web
```

- `http://localhost:5050` — Old interface still works
- `http://localhost:5454` — New interface works independently

**Step 4: Run all tests**

```bash
venv/bin/pytest test/web_ui/ -v
```

**Step 5: Lint**

```bash
make lint
```

**Step 6: Final commit if any fixes needed**

```bash
git add -A
git commit -m "feat(web-ui): complete v1 lightweight web interface"
```
