# Lightweight Web UI Design

**Date:** 2026-02-24
**Status:** Approved
**Goal:** Replace the heavy Flask/Bootstrap web interface with a lightweight FastAPI + vanilla JS alternative that runs well on a Raspberry Pi 4.

## Problem

The current `web_interface/` has performance issues on the Pi:
- Heavy frontend: Bootstrap (200KB) + Alpine.js + HTMX + jQuery + Font Awesome + 30+ widget JS files
- Monolithic backend: 8K-line `api_v3.py`, synchronous Flask, SSE with blocking `time.sleep()`
- Server-side template rendering taxes the Pi on every request
- Both initial page loads and API responses are slow

## Approach

**FastAPI + Static HTML + Vanilla JS + Pico CSS**

- FastAPI async backend (~15 endpoints for v1 vs 80+ currently)
- Static HTML/JS/CSS served once and cached by the browser (zero server rendering)
- Pico CSS (~3KB) for styling, no Bootstrap/jQuery/icon fonts
- WebSocket for real-time updates (replaces 3 separate SSE connections)
- Coexists with current interface — new UI on port 5454, old stays on 5000

## Deployment

- New `web_ui/` top-level directory (separate from `web_interface/`)
- `make web2` Makefile target
- `ledmatrix-web2.service` systemd unit for Pi

## Project Structure

```
web_ui/
├── server.py                    # FastAPI app entry point
├── requirements.txt             # fastapi, uvicorn[standard]
├── routers/
│   ├── config.py               # Config read/write endpoints
│   ├── plugins.py              # Plugin CRUD + store endpoints
│   ├── system.py               # System status, service control, logs
│   └── display.py              # Display preview, on-demand display
├── services/
│   ├── plugin_service.py       # Wraps src/ PluginManager + StoreManager
│   ├── config_service.py       # Wraps src/ ConfigManager
│   └── system_service.py       # System stats, service status
├── static/
│   ├── index.html              # Single HTML shell
│   ├── css/
│   │   └── style.css           # Pico CSS base + custom overrides (~5KB)
│   ├── js/
│   │   ├── app.js              # Router, state, initialization
│   │   ├── api.js              # Fetch wrapper for all API calls
│   │   ├── components/
│   │   │   ├── dashboard.js    # Overview/dashboard page
│   │   │   ├── plugins.js      # Plugin list + config
│   │   │   ├── display.js      # Display preview
│   │   │   └── settings.js     # General settings
│   │   └── lib/
│   │       └── ws.js           # WebSocket manager (reconnect, etc.)
│   └── img/                    # Icons, logo
└── run.sh                      # Start script
```

## Backend Architecture

### FastAPI App

- Mount static files at `/` (browser caches everything)
- Mount API routers at `/api/`
- WebSocket at `/ws` for real-time updates
- Startup event initializes services once (ConfigManager, PluginManager)
- Runs on port 5454 via uvicorn

### Services Layer

Thin wrappers around existing `src/` modules. Routers never import from `src/` directly.

- **ConfigService** — wraps ConfigManager. Caches config in memory, reloads on write.
- **PluginService** — wraps PluginManager + PluginStoreManager. Discovers plugins once at startup, re-discovers on install/uninstall.
- **SystemService** — reads psutil stats, checks systemd service status. Cached for 5s.

### API Endpoints (v1)

```
GET  /api/config                    # Full config
POST /api/config                    # Update config sections
GET  /api/plugins                   # List installed plugins
GET  /api/plugins/{id}/config       # Plugin config + schema
POST /api/plugins/{id}/config       # Save plugin config
POST /api/plugins/{id}/toggle       # Enable/disable
POST /api/plugins/install           # Install from store
POST /api/plugins/uninstall         # Uninstall
GET  /api/plugins/store             # Store listing
GET  /api/system/status             # CPU, memory, temp, service status
POST /api/system/action             # Restart/stop service
WS   /ws                            # Real-time: stats, display preview, logs
```

~15 endpoints for v1. Expand as features are added.

### Performance Wins

- Async everywhere — uvicorn event loop, no blocking threads
- WebSocket replaces SSE — single persistent connection vs 3 separate ones
- In-memory caching — config loaded once, plugin list cached, stats throttled
- No template rendering — JSON-only API, static HTML files

## Frontend Architecture

### Single-Page App (no framework, no build step)

- One `index.html` with `<nav>` sidebar and `<main>` content area
- Hash-based routing (`#/`, `#/plugins`, `#/plugins/{id}`, `#/settings`, `#/display`)
- Each route maps to a component that renders into `<main>`
- Dark theme by default

### Component Pattern

```js
export default {
  async render(container) {
    const data = await api.get('/plugins');
    container.innerHTML = `
      <h2>Plugins</h2>
      <div class="grid">${data.map(p => pluginCard(p)).join('')}</div>
    `;
    this.bindEvents(container);
  },
  bindEvents(container) {
    // Attach click handlers
  }
}
```

### Pages (v1)

1. **Dashboard** — system stats, service status, active plugin count, display preview thumbnail
2. **Plugins** — card grid, install/uninstall/toggle, click into config
3. **Plugin Config** — form generated from config_schema.json (vanilla JS)
4. **Display** — live preview via WebSocket
5. **Settings** — general config, schedule, display hardware

### CSS

- Pico CSS (~3KB) for base typography, forms, buttons, cards
- CSS variables for theming (dark mode, LED-accent colors)
- CSS Grid for layouts
- Inline SVG for icons (no icon font)

### Total Frontend Weight

~20KB (HTML + CSS + JS) vs ~500KB+ for the current interface.

### Real-Time Updates

- Single WebSocket managed by `ws.js`
- Server sends typed messages: `{type: "stats", data: {...}}`
- Components subscribe to types they care about
- Auto-reconnect with exponential backoff

## Error Handling

- FastAPI exception handlers return consistent JSON: `{"error": "message", "detail": "..."}`
- Services catch exceptions from `src/` modules, raise HTTPException
- WebSocket disconnects handled gracefully
- Frontend shows inline error banners (auto-dismiss)

## Testing

- Backend: pytest + httpx.AsyncClient for API tests
- Mock `src/` modules in tests
- Frontend: manual testing for v1

## Future Expansion

After v1, add sections as needed:
- WiFi management
- Font management
- Log viewer
- Cache management
- Raw JSON config editor
- Schedule/dim schedule
- Starlark app management
- Operation history
