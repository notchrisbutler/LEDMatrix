# Frontend Overhaul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Overhaul the LED Matrix web interface from custom CSS + horizontal tabs to Bootstrap 5 + sidebar navigation, making it mobile-first, fully responsive, and performant.

**Architecture:** Replace the custom utility CSS framework with Bootstrap 5 (CDN with AP mode fallback). Convert horizontal tab navigation to a persistent sidebar (desktop) / offcanvas drawer (mobile). Break up the 5,353-line base.html monolith into composable Jinja2 partials. Extract ~1,500 lines of inline JS into separate files. Bundle 26 widget JS files. Keep HTMX + Alpine.js as-is.

**Tech Stack:** Flask/Jinja2, Bootstrap 5.3 (CDN), jQuery 3.7 slim (CDN), HTMX 1.9.10, Alpine.js 3.x, Font Awesome 6, Google Fonts (DM Sans, Source Sans 3, JetBrains Mono)

**Design doc:** `docs/plans/2026-02-22-frontend-overhaul-design.md`

---

## Phase 1: Foundation (Bootstrap + Theme + Base Layout)

### Task 1: Add Bootstrap 5 and Google Fonts CDN with AP mode fallback

**Files:**
- Modify: `web_interface/templates/v3/base.html:1-100` (head section)
- Create: `web_interface/static/v3/vendor/` directory for local fallbacks

**Step 1: Download Bootstrap and jQuery local fallbacks for AP mode**

```bash
mkdir -p web_interface/static/v3/vendor
curl -o web_interface/static/v3/vendor/bootstrap.min.css "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"
curl -o web_interface/static/v3/vendor/bootstrap.bundle.min.js "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"
curl -o web_interface/static/v3/vendor/jquery.slim.min.js "https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.slim.min.js"
```

**Step 2: Update base.html `<head>` to load Bootstrap CSS + Google Fonts**

Replace lines 1-7 of `base.html` with:

```html
<!DOCTYPE html>
<html lang="en" data-bs-theme="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LED Matrix Control Panel</title>

    <!-- Google Fonts: DM Sans (headings), Source Sans 3 (body), JetBrains Mono (code) -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Source+Sans+3:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

**Step 3: Add Bootstrap CSS loading with AP mode fallback**

After the existing `<link rel="preconnect">` tags (lines 88-92), add:

```html
    <!-- Bootstrap 5.3 CSS -->
    <script>
    (function() {
        var isAPMode = window.location.hostname === '192.168.4.1' ||
                       window.location.hostname.startsWith('192.168.4.');
        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = isAPMode
            ? '/static/v3/vendor/bootstrap.min.css'
            : 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css';
        document.head.appendChild(link);
    })();
    </script>
```

**Step 4: Add Bootstrap JS + jQuery at end of body**

At the bottom of base.html, before the closing `</body>` tag, add:

```html
    <!-- Bootstrap 5.3 JS Bundle (includes Popper) -->
    <script>
    (function() {
        var isAPMode = window.location.hostname === '192.168.4.1' ||
                       window.location.hostname.startsWith('192.168.4.');

        // jQuery slim
        var jq = document.createElement('script');
        jq.src = isAPMode
            ? '/static/v3/vendor/jquery.slim.min.js'
            : 'https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.slim.min.js';
        document.body.appendChild(jq);

        // Bootstrap bundle
        var bs = document.createElement('script');
        bs.src = isAPMode
            ? '/static/v3/vendor/bootstrap.bundle.min.js'
            : 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js';
        document.body.appendChild(bs);
    })();
    </script>
```

**Step 5: Update theme initialization to use Bootstrap's data-bs-theme**

In the theme init script (lines 9-86), change `data-theme` to `data-bs-theme`:

- Line 28: `document.documentElement.setAttribute('data-bs-theme', theme);`
- Line 34: `var current = document.documentElement.getAttribute('data-bs-theme');`
- Line 35: `document.documentElement.setAttribute('data-bs-theme', next);`
- Line 75: `document.documentElement.setAttribute('data-bs-theme', t);`
- Line 66: `window.updateThemeIcon(document.documentElement.getAttribute('data-bs-theme') || 'dark');`

**Step 6: Verify Bootstrap loads correctly**

Run: `python web_interface/start.py` and open http://localhost:5050/v3/
Expected: Page loads with Bootstrap reset styles applied (fonts change, spacing changes). Existing layout will look different but functional.

**Step 7: Commit**

```bash
git add web_interface/templates/v3/base.html web_interface/static/v3/vendor/
git commit -m "feat(web): add Bootstrap 5.3, jQuery, Google Fonts with AP mode fallback"
```

---

### Task 2: Create new app.css with Bootstrap overrides and LED Matrix theme

**Files:**
- Rewrite: `web_interface/static/v3/app.css` (replace 1,006 lines with ~200 lines of Bootstrap overrides)

**Step 1: Write the new app.css**

Replace the entire contents of `web_interface/static/v3/app.css` with a new file that:
- Defines CSS custom properties for the LED Matrix theme colors (from design doc)
- Sets typography (DM Sans headings, Source Sans 3 body, JetBrains Mono code)
- Overrides Bootstrap component styles (sidebar, cards, form controls)
- Adds LED Matrix-specific components (display preview, stat cards, log viewer)
- Handles both light and dark mode via `[data-bs-theme="dark"]` selector

Key CSS variables to define:

```css
:root, [data-bs-theme="light"] {
    --lm-surface-base: #f8fafc;
    --lm-surface-card: #ffffff;
    --lm-surface-elevated: #f1f5f9;
    --lm-text-primary: #1e293b;
    --lm-text-muted: #64748b;
    --lm-border: rgba(148, 163, 184, 0.2);
    --lm-primary: #3b82f6;
    --lm-success: #22c55e;
    --lm-warning: #f59e0b;
    --lm-danger: #ef4444;
}

[data-bs-theme="dark"] {
    --lm-surface-base: #0f172a;
    --lm-surface-card: #1e293b;
    --lm-surface-elevated: #334155;
    --lm-text-primary: #f1f5f9;
    --lm-text-muted: #94a3b8;
    --lm-border: rgba(148, 163, 184, 0.15);
}
```

Key Bootstrap overrides:

```css
body {
    font-family: 'Source Sans 3', -apple-system, BlinkMacSystemFont, sans-serif;
    background-color: var(--lm-surface-base);
    color: var(--lm-text-primary);
}

h1, h2, h3, h4, h5, h6, .h1, .h2, .h3, .h4, .h5, .h6 {
    font-family: 'DM Sans', sans-serif;
    font-weight: 600;
}

code, pre, .font-mono {
    font-family: 'JetBrains Mono', monospace;
}
```

Sidebar styles:

```css
.sidebar {
    width: 240px;
    position: fixed;
    top: 56px;
    bottom: 0;
    left: 0;
    overflow-y: auto;
    background-color: var(--lm-surface-card);
    border-right: 1px solid var(--lm-border);
    z-index: 100;
    padding-top: 1rem;
}

.sidebar .nav-link {
    color: var(--lm-text-muted);
    padding: 0.5rem 1rem;
    border-left: 3px solid transparent;
    font-size: 0.875rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.sidebar .nav-link.active {
    color: var(--lm-primary);
    background-color: rgba(59, 130, 246, 0.08);
    border-left-color: var(--lm-primary);
    font-weight: 500;
}

.sidebar .nav-link:hover:not(.active) {
    color: var(--lm-text-primary);
    background-color: var(--lm-surface-elevated);
}

.sidebar-section-label {
    font-family: 'DM Sans', sans-serif;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--lm-text-muted);
    padding: 0.75rem 1rem 0.25rem;
}

.main-content {
    margin-left: 240px;
    padding: 1.5rem;
    min-height: calc(100vh - 56px);
}

@media (max-width: 991.98px) {
    .sidebar { display: none; }
    .main-content { margin-left: 0; }
}
```

Display preview styles:

```css
.display-preview-container {
    background-color: #000;
    border-radius: 0.5rem;
    padding: 1rem;
    display: flex;
    justify-content: center;
    align-items: center;
}
```

Log viewer (always dark):

```css
.log-viewer {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.8rem;
    background-color: #0f172a;
    color: #e2e8f0;
    border-radius: 0.5rem;
    padding: 1rem;
    max-height: 500px;
    overflow-y: auto;
}
```

Also keep any custom utility classes needed for existing partials that Bootstrap doesn't cover (e.g., `animate-pulse` for skeletons, `space-y-*` utilities that Bootstrap doesn't have).

**Step 2: Update app.css version query param in base.html**

In base.html, find the line that loads app.css (search for `app.css`) and bump the version query parameter.

**Step 3: Verify styles apply correctly**

Run: `python web_interface/start.py` and check http://localhost:5050/v3/
Expected: Dark theme with new color palette, DM Sans headings, Source Sans 3 body text. Layout still using old horizontal tabs (changed in next task).

**Step 4: Commit**

```bash
git add web_interface/static/v3/app.css web_interface/templates/v3/base.html
git commit -m "feat(web): replace custom CSS with Bootstrap theme overrides"
```

---

### Task 3: Convert horizontal tabs to sidebar navigation

**Files:**
- Modify: `web_interface/templates/v3/base.html:1380-1520` (header + nav + content area)

**Step 1: Replace the header section**

Replace the existing `<header>` block (around lines 1380-1429) with a Bootstrap navbar:

```html
    <!-- Top navbar -->
    <nav class="navbar navbar-expand-lg fixed-top border-bottom" style="height: 56px; background-color: var(--lm-surface-card); border-color: var(--lm-border) !important;">
        <div class="container-fluid px-3">
            <!-- Mobile hamburger -->
            <button class="btn btn-link text-body d-lg-none p-0 me-2" type="button"
                    data-bs-toggle="offcanvas" data-bs-target="#sidebarOffcanvas"
                    aria-label="Toggle navigation">
                <i class="fas fa-bars fa-lg"></i>
            </button>

            <!-- Logo -->
            <a class="navbar-brand d-flex align-items-center gap-2 me-auto" href="/v3/">
                <i class="fas fa-tv" style="color: var(--lm-primary);"></i>
                <span class="fw-semibold" style="font-family: 'DM Sans', sans-serif;">LED Matrix Control</span>
            </a>

            <!-- Right side: theme toggle + connection + stats -->
            <div class="d-flex align-items-center gap-3">
                <!-- Theme toggle -->
                <button id="theme-toggle" class="btn btn-link text-body p-0" onclick="toggleTheme()" aria-label="Toggle theme">
                    <i id="theme-icon-dark" class="fas fa-moon"></i>
                    <i id="theme-icon-light" class="fas fa-sun d-none"></i>
                </button>

                <!-- Connection status -->
                <span id="connection-status" class="d-flex align-items-center gap-1 small">
                    <span class="rounded-circle d-inline-block" style="width: 8px; height: 8px; background-color: var(--lm-success);"></span>
                    <span class="d-none d-md-inline text-muted">Connected</span>
                </span>

                <!-- System stats (hidden on mobile) -->
                <div class="d-none d-md-flex align-items-center gap-3 small text-muted">
                    <span id="cpu-stat"><i class="fas fa-microchip me-1"></i>--%</span>
                    <span id="mem-stat"><i class="fas fa-memory me-1"></i>--%</span>
                    <span id="temp-stat"><i class="fas fa-thermometer-half me-1"></i>--°C</span>
                </div>
            </div>
        </div>
    </nav>
```

**Step 2: Add sidebar (desktop) and offcanvas (mobile)**

Replace the nav/tabs section (lines 1431-1502) with:

```html
    <!-- Sidebar - Desktop (visible >= lg) -->
    <aside class="sidebar d-none d-lg-block">
        {% include 'v3/partials/_sidebar_nav.html' %}
    </aside>

    <!-- Sidebar - Mobile Offcanvas (visible < lg) -->
    <div class="offcanvas offcanvas-start" tabindex="-1" id="sidebarOffcanvas" style="width: 260px; background-color: var(--lm-surface-card);">
        <div class="offcanvas-header border-bottom" style="border-color: var(--lm-border) !important;">
            <h5 class="offcanvas-title" style="font-family: 'DM Sans', sans-serif;">
                <i class="fas fa-tv me-2" style="color: var(--lm-primary);"></i>Navigation
            </h5>
            <button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>
        </div>
        <div class="offcanvas-body p-0">
            {% include 'v3/partials/_sidebar_nav.html' %}
        </div>
    </div>
```

**Step 3: Create the shared sidebar nav partial**

Create new file: `web_interface/templates/v3/partials/_sidebar_nav.html`

```html
<!-- Sidebar navigation content (shared between desktop sidebar and mobile offcanvas) -->
<nav class="py-2" x-data>
    <!-- System section -->
    <div class="sidebar-section-label">System</div>
    <ul class="nav flex-column">
        <li class="nav-item">
            <a class="nav-link" href="#" @click.prevent="activeTab = 'overview'; closeMobileNav()"
               :class="activeTab === 'overview' ? 'active' : ''">
                <i class="fas fa-tachometer-alt fa-fw"></i> Overview
            </a>
        </li>
        <li class="nav-item">
            <a class="nav-link" href="#" @click.prevent="activeTab = 'general'; closeMobileNav()"
               :class="activeTab === 'general' ? 'active' : ''">
                <i class="fas fa-sliders-h fa-fw"></i> General
            </a>
        </li>
        <li class="nav-item">
            <a class="nav-link" href="#" @click.prevent="activeTab = 'wifi'; closeMobileNav()"
               :class="activeTab === 'wifi' ? 'active' : ''">
                <i class="fas fa-wifi fa-fw"></i> WiFi
            </a>
        </li>
        <li class="nav-item">
            <a class="nav-link" href="#" @click.prevent="activeTab = 'schedule'; closeMobileNav()"
               :class="activeTab === 'schedule' ? 'active' : ''">
                <i class="fas fa-clock fa-fw"></i> Schedule
            </a>
        </li>
        <li class="nav-item">
            <a class="nav-link" href="#" @click.prevent="activeTab = 'display'; closeMobileNav()"
               :class="activeTab === 'display' ? 'active' : ''">
                <i class="fas fa-desktop fa-fw"></i> Display
            </a>
        </li>
        <li class="nav-item">
            <a class="nav-link" href="#" @click.prevent="activeTab = 'config-editor'; closeMobileNav()"
               :class="activeTab === 'config-editor' ? 'active' : ''">
                <i class="fas fa-file-code fa-fw"></i> Config Editor
            </a>
        </li>
        <li class="nav-item">
            <a class="nav-link" href="#" @click.prevent="activeTab = 'fonts'; closeMobileNav()"
               :class="activeTab === 'fonts' ? 'active' : ''">
                <i class="fas fa-font fa-fw"></i> Fonts
            </a>
        </li>
        <li class="nav-item">
            <a class="nav-link" href="#" @click.prevent="activeTab = 'logs'; closeMobileNav()"
               :class="activeTab === 'logs' ? 'active' : ''">
                <i class="fas fa-file-alt fa-fw"></i> Logs
            </a>
        </li>
        <li class="nav-item">
            <a class="nav-link" href="#" @click.prevent="activeTab = 'cache'; closeMobileNav()"
               :class="activeTab === 'cache' ? 'active' : ''">
                <i class="fas fa-database fa-fw"></i> Cache
            </a>
        </li>
        <li class="nav-item">
            <a class="nav-link" href="#" @click.prevent="activeTab = 'operation-history'; closeMobileNav()"
               :class="activeTab === 'operation-history' ? 'active' : ''">
                <i class="fas fa-history fa-fw"></i> Operation History
            </a>
        </li>
    </ul>

    <!-- Plugins section -->
    <div class="sidebar-section-label mt-3">Plugins</div>
    <ul class="nav flex-column">
        <li class="nav-item">
            <a class="nav-link" href="#"
               @click.prevent="activeTab = 'plugins'; closeMobileNav(); $nextTick(() => { if (typeof htmx !== 'undefined' && !document.getElementById('plugins-content').hasAttribute('data-loaded')) { htmx.trigger('#plugins-content', 'load'); } })"
               :class="activeTab === 'plugins' ? 'active' : ''">
                <i class="fas fa-plug fa-fw"></i> Plugin Manager
            </a>
        </li>
        <!-- Dynamic plugin tabs inserted here by JS -->
        <template x-for="plugin in (typeof installedPlugins !== 'undefined' ? installedPlugins : [])" :key="plugin.id">
            <li class="nav-item">
                <a class="nav-link" href="#"
                   @click.prevent="activeTab = 'plugin-' + plugin.id; closeMobileNav()"
                   :class="activeTab === ('plugin-' + plugin.id) ? 'active' : ''">
                    <i class="fas fa-puzzle-piece fa-fw"></i>
                    <span x-text="plugin.name"></span>
                </a>
            </li>
        </template>
    </ul>
</nav>

<script>
// Close mobile offcanvas when nav item clicked
window.closeMobileNav = function() {
    var offcanvasEl = document.getElementById('sidebarOffcanvas');
    if (offcanvasEl && window.bootstrap) {
        var offcanvas = bootstrap.Offcanvas.getInstance(offcanvasEl);
        if (offcanvas) offcanvas.hide();
    }
};
</script>
```

**Step 4: Update the main content wrapper**

Replace the `<main>` tag (line 1432) and wrap the tab content:

```html
    <!-- Main content area (offset by sidebar on desktop) -->
    <main class="main-content" style="padding-top: 56px;">
        <div class="container-fluid p-3 p-lg-4">
            <!-- Tab content -->
            <div id="tab-content">
                <!-- All existing x-show tab divs stay here unchanged -->
```

**Step 5: Add a closeMobileNav helper to Alpine.js app() init**

In the Alpine.js `app()` function definition, add `closeMobileNav` as a method (or keep it as a global window function as shown above).

**Step 6: Test desktop and mobile**

Run the web server and test:
- Desktop (>=992px): Sidebar visible on left, content shifted right
- Mobile (<992px): Hamburger in header, click opens offcanvas sidebar
- Clicking nav items switches tabs and closes mobile drawer

**Step 7: Commit**

```bash
git add web_interface/templates/v3/base.html web_interface/templates/v3/partials/_sidebar_nav.html web_interface/static/v3/app.css
git commit -m "feat(web): replace horizontal tabs with sidebar + mobile offcanvas navigation"
```

---

## Phase 2: Page-by-Page Bootstrap Migration

### Task 4: Migrate Overview page to Bootstrap components

**Files:**
- Modify: `web_interface/templates/v3/partials/overview.html` (317 lines)

**Step 1: Convert stat cards to Bootstrap cards**

Replace the existing stat card grid with Bootstrap `row` + `col` grid and `card` components:

```html
<!-- System stats grid -->
<div class="row g-3 mb-4">
    <div class="col-6 col-lg-3">
        <div class="card h-100" style="border-left: 3px solid var(--lm-primary);">
            <div class="card-body d-flex align-items-center gap-3 py-3">
                <i class="fas fa-microchip fa-lg" style="color: var(--lm-primary);"></i>
                <div>
                    <div class="small text-muted">CPU Usage</div>
                    <div class="fw-semibold fs-5" id="overview-cpu">--%</div>
                </div>
            </div>
        </div>
    </div>
    <!-- Repeat for Memory, Temperature, Display Status with appropriate colors -->
</div>
```

**Step 2: Convert quick action buttons to Bootstrap button group**

```html
<div class="card mb-4">
    <div class="card-header">
        <h5 class="card-title mb-0"><i class="fas fa-bolt me-2"></i>Quick Actions</h5>
    </div>
    <div class="card-body">
        <div class="d-flex flex-wrap gap-2">
            <button class="btn btn-success" hx-post="/api/v3/display/start" hx-swap="none">
                <i class="fas fa-play me-1"></i> Start Display
            </button>
            <button class="btn btn-danger" hx-post="/api/v3/display/stop" hx-swap="none">
                <i class="fas fa-stop me-1"></i> Stop Display
            </button>
            <!-- ... other action buttons ... -->
        </div>
    </div>
</div>
```

**Step 3: Style the display preview as hero card**

```html
<div class="card mb-4">
    <div class="card-header d-flex justify-content-between align-items-center">
        <h5 class="card-title mb-0"><i class="fas fa-tv me-2"></i>Live Display Preview</h5>
        <span class="badge bg-secondary font-mono" id="display-dimensions">128 x 32 @ 8x</span>
    </div>
    <div class="card-body p-2">
        <div class="display-preview-container">
            <canvas id="display-canvas"></canvas>
        </div>
    </div>
    <div class="card-footer">
        <div class="d-flex flex-wrap align-items-center gap-3">
            <button class="btn btn-sm btn-outline-secondary" id="screenshot-btn">
                <i class="fas fa-camera me-1"></i> Screenshot
            </button>
            <div class="d-flex align-items-center gap-2">
                <label class="form-label mb-0 small">Scale:</label>
                <input type="range" class="form-range" style="width: 100px;" id="scale-slider">
                <span class="small text-muted" id="scale-value">8x</span>
            </div>
            <div class="form-check form-switch">
                <input class="form-check-input" type="checkbox" id="led-dot-mode" checked>
                <label class="form-check-label small" for="led-dot-mode">LED dot mode</label>
            </div>
        </div>
    </div>
</div>
```

**Step 4: Convert version info card**

```html
<div class="card" style="border-left: 3px solid var(--lm-primary);">
    <div class="card-body d-flex justify-content-between align-items-center">
        <div>
            <div class="small text-muted">LEDMatrix Version</div>
            <div class="fw-semibold font-mono" id="version-hash">------</div>
        </div>
        <button class="btn btn-sm btn-outline-primary" hx-post="/api/v3/system/check-updates" hx-swap="none">
            <i class="fas fa-sync-alt me-1"></i> Check Updates
        </button>
    </div>
</div>
```

**Step 5: Verify the overview page**

Load the overview tab and verify:
- Stat cards display in 2x2 on mobile, 4-across on desktop
- Quick action buttons wrap properly
- Display preview renders centered with controls below
- All HTMX triggers and SSE updates still work

**Step 6: Commit**

```bash
git add web_interface/templates/v3/partials/overview.html
git commit -m "feat(web): migrate overview page to Bootstrap cards and grid"
```

---

### Task 5: Migrate General settings page to Bootstrap forms

**Files:**
- Modify: `web_interface/templates/v3/partials/general.html`

**Step 1: Convert form layout to Bootstrap**

Wrap all form sections in Bootstrap cards with `card-header` + `card-body`. Convert inputs to Bootstrap form controls:

```html
<form hx-post="/api/v3/config/general" hx-swap="none" hx-encoding="application/json">
    <div class="card mb-4">
        <div class="card-header">
            <h5 class="card-title mb-0">General Settings</h5>
            <p class="card-text small text-muted mt-1">Configure system settings and location.</p>
        </div>
        <div class="card-body">
            <!-- Web Display Autostart -->
            <div class="form-check form-switch mb-3">
                <input class="form-check-input" type="checkbox" id="web-autostart" name="web_display_autostart">
                <label class="form-check-label" for="web-autostart">
                    <strong>Web Display Autostart</strong>
                    <div class="small text-muted">Start the web interface on boot.</div>
                </label>
            </div>

            <!-- Timezone -->
            <div class="mb-3">
                <label for="timezone" class="form-label fw-medium">Timezone</label>
                <select class="form-select" id="timezone" name="timezone">
                    <!-- options populated from server -->
                </select>
                <div class="form-text">Select your timezone for time-based features.</div>
            </div>

            <!-- Location (row of 3) -->
            <div class="row g-3 mb-3">
                <div class="col-12 col-md-4">
                    <label for="city" class="form-label fw-medium">City</label>
                    <input type="text" class="form-control" id="city" name="city">
                </div>
                <div class="col-12 col-md-4">
                    <label for="state" class="form-label fw-medium">State</label>
                    <input type="text" class="form-control" id="state" name="state">
                </div>
                <div class="col-12 col-md-4">
                    <label for="country" class="form-label fw-medium">Country</label>
                    <input type="text" class="form-control" id="country" name="country">
                </div>
            </div>
        </div>
    </div>

    <!-- Plugin System Settings card -->
    <div class="card mb-4">
        <div class="card-header">
            <h5 class="card-title mb-0">Plugin System Settings</h5>
        </div>
        <div class="card-body">
            <!-- Toggle switches for booleans -->
        </div>
    </div>

    <!-- Sticky save button on mobile -->
    <div class="d-grid d-md-block position-sticky bottom-0 py-3" style="background-color: var(--lm-surface-base);">
        <button type="submit" class="btn btn-primary">
            <i class="fas fa-save me-1"></i> Save General Settings
        </button>
    </div>
</form>
```

**Step 2: Test form rendering and submission**

Verify:
- All form controls render with Bootstrap styling
- Toggle switches work for boolean settings
- Location fields display in a row on desktop, stack on mobile
- Save button is sticky at bottom on mobile
- Form submission via HTMX still works

**Step 3: Commit**

```bash
git add web_interface/templates/v3/partials/general.html
git commit -m "feat(web): migrate general settings to Bootstrap forms"
```

---

### Task 6: Migrate Plugin Manager page to Bootstrap cards

**Files:**
- Modify: `web_interface/templates/v3/partials/plugins.html`

**Step 1: Convert plugin store grid to Bootstrap cards**

Use `row` + `col` grid with responsive breakpoints:

```html
<!-- Category filter pills -->
<div class="d-flex flex-wrap gap-2 mb-4">
    <button class="btn btn-sm btn-outline-secondary active" data-category="all">All</button>
    <button class="btn btn-sm btn-outline-secondary" data-category="sports">Sports</button>
    <!-- ... other categories ... -->
</div>

<!-- Plugin grid -->
<div class="row g-3">
    <!-- Per plugin card -->
    <div class="col-12 col-sm-6 col-lg-4">
        <div class="card h-100">
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <h6 class="card-title mb-0">Plugin Name</h6>
                    <span class="badge bg-success">Installed</span>
                </div>
                <p class="card-text small text-muted">Plugin description...</p>
                <div class="small text-muted mb-2">v1.0.0 &middot; Category</div>
            </div>
            <div class="card-footer bg-transparent">
                <div class="btn-group btn-group-sm w-100">
                    <button class="btn btn-outline-primary">Configure</button>
                    <button class="btn btn-outline-danger">Uninstall</button>
                </div>
            </div>
        </div>
    </div>
</div>
```

**Step 2: Convert installed plugins section similarly**

Use the same card pattern for installed plugins with enable/disable toggle and configuration link.

**Step 3: Test plugin manager**

Verify:
- Cards display in responsive grid (1 col mobile, 2 col tablet, 3 col desktop)
- Install/Update/Uninstall buttons trigger correctly via HTMX
- Category filter pills toggle active state
- Plugin store loads from API

**Step 4: Commit**

```bash
git add web_interface/templates/v3/partials/plugins.html
git commit -m "feat(web): migrate plugin manager to Bootstrap card grid"
```

---

### Task 7: Migrate remaining settings pages (WiFi, Schedule, Display, Fonts, Cache)

**Files:**
- Modify: `web_interface/templates/v3/partials/wifi.html`
- Modify: `web_interface/templates/v3/partials/schedule.html`
- Modify: `web_interface/templates/v3/partials/display.html`
- Modify: `web_interface/templates/v3/partials/fonts.html`
- Modify: `web_interface/templates/v3/partials/cache.html`
- Modify: `web_interface/templates/v3/partials/durations.html`
- Modify: `web_interface/templates/v3/partials/operation_history.html`

**Step 1: Apply consistent Bootstrap patterns to each page**

Each page follows the same card-based pattern:
- Card with `card-header` for section title
- `card-body` for form controls
- Bootstrap form controls (`form-control`, `form-select`, `form-check`, `form-switch`)
- `row` + `col` grid for multi-column layouts
- Responsive: stack on mobile, side-by-side on desktop
- Sticky save button pattern from Task 5

**Step 2: WiFi page specifics**

- Network scan results in a Bootstrap `list-group`
- Signal strength badges with color coding
- Connect/disconnect buttons in `btn-group`

**Step 3: Schedule page specifics**

- Day selector using Bootstrap `btn-group` toggle buttons
- Time range inputs using Bootstrap `input-group`
- Schedule entries in cards or `list-group`

**Step 4: Display page specifics**

- Matrix dimension controls in `input-group`
- Color pickers stay as native HTML color inputs
- Brightness slider using Bootstrap `form-range`

**Step 5: Fonts page specifics**

- Font list as Bootstrap `list-group` with preview
- Upload area using Bootstrap file input or drag-drop zone

**Step 6: Test each page on mobile and desktop**

Verify all forms render, submit, and display correctly at both breakpoints.

**Step 7: Commit per page or batch**

```bash
git add web_interface/templates/v3/partials/
git commit -m "feat(web): migrate all settings pages to Bootstrap components"
```

---

### Task 8: Migrate Log viewer and Config Editor pages

**Files:**
- Modify: `web_interface/templates/v3/partials/logs.html`
- Modify: `web_interface/templates/v3/partials/raw_json.html`

**Step 1: Log viewer**

```html
<div class="card">
    <div class="card-header d-flex justify-content-between align-items-center">
        <h5 class="card-title mb-0"><i class="fas fa-file-alt me-2"></i>System Logs</h5>
        <div class="d-flex gap-2">
            <input type="text" class="form-control form-control-sm" placeholder="Filter logs..." style="width: 200px;">
            <button class="btn btn-sm btn-outline-secondary" id="log-pause-btn">
                <i class="fas fa-pause"></i>
            </button>
            <button class="btn btn-sm btn-outline-secondary" id="log-clear-btn">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    </div>
    <div class="card-body p-0">
        <div class="log-viewer" id="log-container" style="height: 600px;">
            <!-- Log lines populated via SSE -->
        </div>
    </div>
</div>
```

**Step 2: Config Editor (JSON)**

```html
<div class="card">
    <div class="card-header d-flex justify-content-between align-items-center">
        <h5 class="card-title mb-0"><i class="fas fa-file-code me-2"></i>Configuration Editor</h5>
        <button class="btn btn-sm btn-primary" id="save-config-btn">
            <i class="fas fa-save me-1"></i> Save
        </button>
    </div>
    <div class="card-body p-0">
        <div id="json-editor" style="height: 600px;"></div>
    </div>
</div>
```

CodeMirror loading stays lazy (only when this tab is opened).

**Step 3: Test both pages**

- Logs: SSE streaming works, auto-scroll, filter input, monospace font
- Config Editor: CodeMirror loads, JSON editing works, save triggers API call

**Step 4: Commit**

```bash
git add web_interface/templates/v3/partials/logs.html web_interface/templates/v3/partials/raw_json.html
git commit -m "feat(web): migrate log viewer and config editor to Bootstrap"
```

---

## Phase 3: Template Decomposition and JS Extraction

### Task 9: Break up base.html into Jinja2 includes

**Files:**
- Modify: `web_interface/templates/v3/base.html` (5353 → ~150 lines)
- Create: `web_interface/templates/v3/partials/_head.html`
- Create: `web_interface/templates/v3/partials/_header.html`
- Create: `web_interface/templates/v3/partials/_scripts.html`
- Already created: `web_interface/templates/v3/partials/_sidebar_nav.html` (Task 3)

**Step 1: Extract the `<head>` contents into `_head.html`**

Move everything between `<head>` and `</head>` (theme init, CDN loading, CSS links, resource hints) into `_head.html`. In base.html, replace with:

```html
<head>
    {% include 'v3/partials/_head.html' %}
</head>
```

**Step 2: Extract the header/navbar into `_header.html`**

Move the `<nav class="navbar ...">` block into `_header.html`. In base.html:

```html
{% include 'v3/partials/_header.html' %}
```

**Step 3: Extract all `<script>` tags at end of body into `_scripts.html`**

Move Bootstrap JS loading, HTMX config, Alpine.js init, and all other bottom-of-body scripts into `_scripts.html`. In base.html:

```html
{% include 'v3/partials/_scripts.html' %}
```

**Step 4: Resulting base.html should be ~100-150 lines**

```html
<!DOCTYPE html>
<html lang="en" data-bs-theme="dark">
<head>
    {% include 'v3/partials/_head.html' %}
</head>
<body x-data="app()">
    {% include 'v3/partials/_header.html' %}

    <!-- Desktop sidebar -->
    <aside class="sidebar d-none d-lg-block">
        {% include 'v3/partials/_sidebar_nav.html' %}
    </aside>

    <!-- Mobile offcanvas -->
    <div class="offcanvas offcanvas-start" tabindex="-1" id="sidebarOffcanvas" style="width: 260px; background-color: var(--lm-surface-card);">
        <div class="offcanvas-header border-bottom">
            <h5 class="offcanvas-title"><i class="fas fa-tv me-2"></i>Navigation</h5>
            <button type="button" class="btn-close" data-bs-dismiss="offcanvas"></button>
        </div>
        <div class="offcanvas-body p-0">
            {% include 'v3/partials/_sidebar_nav.html' %}
        </div>
    </div>

    <!-- Main content -->
    <main class="main-content" style="padding-top: 56px;">
        <div class="container-fluid p-3 p-lg-4">
            {% block content %}{% endblock %}
        </div>
    </main>

    {% include 'v3/partials/_scripts.html' %}
</body>
</html>
```

**Step 5: Update index.html to use the new base**

Ensure `index.html` extends `base.html` and puts its content in `{% block content %}`.

**Step 6: Test all pages still work**

Navigate through every tab and verify no regressions.

**Step 7: Commit**

```bash
git add web_interface/templates/v3/
git commit -m "refactor(web): decompose base.html into Jinja2 includes"
```

---

### Task 10: Extract inline JavaScript into separate files

**Files:**
- Create: `web_interface/static/v3/js/theme.js` (from lines 9-86 of old base.html)
- Create: `web_interface/static/v3/js/htmx-config.js` (HTMX event handlers, error handling)
- Create: `web_interface/static/v3/js/app-init.js` (Alpine.js app() definition)
- Create: `web_interface/static/v3/js/sse-manager.js` (SSE connection, reconnect logic)
- Create: `web_interface/static/v3/js/plugin-tabs.js` (dynamic plugin tab management)
- Modify: `web_interface/templates/v3/partials/_head.html` (reference theme.js)
- Modify: `web_interface/templates/v3/partials/_scripts.html` (reference other JS files)

**Step 1: Extract theme initialization**

Move the theme IIFE (lines 9-86) to `theme.js`. This must load in `<head>` (before CSS) to prevent FOUC. Keep the `<script>` tag in `_head.html` but change to `<script src="/static/v3/js/theme.js"></script>`.

**Step 2: Extract HTMX configuration and handlers**

Consolidate all HTMX event listeners (`htmx:configRequest`, `htmx:afterRequest`, `htmx:responseError`, etc.) into `htmx-config.js`. Load after HTMX.

**Step 3: Extract Alpine.js app() definition**

Move the `function app() { return { ... } }` definition to `app-init.js`. Load before Alpine.js initializes.

**Step 4: Extract SSE manager**

Move SSE connection setup, reconnection logic, and stat update handlers to `sse-manager.js`. Load after app-init.js.

**Step 5: Extract plugin tab management**

Move dynamic plugin tab creation/removal logic to `plugin-tabs.js`. Load after app-init.js.

**Step 6: Update _scripts.html to load these files**

```html
<script src="/static/v3/js/htmx-config.js" defer></script>
<script src="/static/v3/js/app-init.js" defer></script>
<script src="/static/v3/js/sse-manager.js" defer></script>
<script src="/static/v3/js/plugin-tabs.js" defer></script>
<script src="/static/v3/js/app.js" defer></script>
```

**Step 7: Test all functionality**

- Theme toggle works
- HTMX partial loading works
- SSE stats update
- Plugin tabs appear dynamically
- No console errors

**Step 8: Commit**

```bash
git add web_interface/static/v3/js/ web_interface/templates/v3/partials/_head.html web_interface/templates/v3/partials/_scripts.html
git commit -m "refactor(web): extract inline JS from base.html into separate files"
```

---

### Task 11: Bundle widget JS files

**Files:**
- Create: `scripts/bundle_widgets.py` (build script)
- Create: `web_interface/static/v3/js/widgets.bundle.js` (output)
- Modify: `web_interface/templates/v3/partials/_scripts.html` (load bundle instead of 26 individual files)

**Step 1: Write a simple Python concatenation bundler**

```python
#!/usr/bin/env python3
"""Bundle widget JS files into a single file for production."""
import os
from pathlib import Path

WIDGETS_DIR = Path("web_interface/static/v3/js/widgets")
OUTPUT = Path("web_interface/static/v3/js/widgets.bundle.js")

# Order matters: base-widget and registry first, then alphabetical
PRIORITY = ["base-widget.js", "registry.js", "notification.js", "plugin-loader.js"]

def bundle():
    files = []
    # Priority files first
    for name in PRIORITY:
        path = WIDGETS_DIR / name
        if path.exists():
            files.append(path)
    # Then remaining files alphabetically
    for path in sorted(WIDGETS_DIR.glob("*.js")):
        if path not in files and path.name != "README.md":
            files.append(path)

    parts = [f"/* Widget Bundle - {len(files)} files */"]
    for f in files:
        parts.append(f"\n/* === {f.name} === */")
        parts.append(f.read_text())

    OUTPUT.write_text("\n".join(parts))
    print(f"Bundled {len(files)} widget files into {OUTPUT} ({OUTPUT.stat().st_size:,} bytes)")

if __name__ == "__main__":
    bundle()
```

**Step 2: Run the bundler**

```bash
python scripts/bundle_widgets.py
```

Expected: Creates `widgets.bundle.js` (~250KB, or ~50KB gzipped)

**Step 3: Update _scripts.html to load bundle**

Replace the 26 individual `<script>` tags for widgets with:

```html
<script src="/static/v3/js/widgets.bundle.js?v={{ config.get('version', '1') }}" defer></script>
```

**Step 4: Add a Makefile target**

Add to Makefile:

```makefile
bundle-widgets:  ## Bundle widget JS files
	python scripts/bundle_widgets.py
```

**Step 5: Test widget functionality**

Open a plugin config page and verify all widget types render and function:
- Text inputs, number inputs, toggles, select dropdowns
- Color pickers, date pickers, time ranges
- File upload, schedule picker
- Custom feeds, array tables

**Step 6: Commit**

```bash
git add scripts/bundle_widgets.py web_interface/static/v3/js/widgets.bundle.js web_interface/templates/v3/partials/_scripts.html Makefile
git commit -m "perf(web): bundle 26 widget JS files into single file"
```

---

## Phase 4: Migrate Plugin Config and Starlark Pages

### Task 12: Migrate plugin config form rendering to Bootstrap

**Files:**
- Modify: `web_interface/templates/v3/partials/plugin_config.html` (57KB, largest partial)

**Step 1: Convert form layout to Bootstrap**

The plugin config page renders dynamic forms from JSON schemas. Update the server-side form generation (in `pages_v3.py`) and the template to use Bootstrap form classes:

- All `<input>` elements get `class="form-control"`
- All `<select>` elements get `class="form-select"`
- All checkboxes/toggles get `class="form-check-input"` with `form-check form-switch` wrapper
- Form groups use `mb-3` spacing
- Labels get `class="form-label fw-medium"`
- Help text gets `class="form-text"`
- Sections wrapped in Bootstrap cards

**Step 2: Ensure widget JS compatibility**

The widget system adds/replaces form elements dynamically. Verify widgets apply Bootstrap classes to their generated HTML. May need to update `base-widget.js` to include Bootstrap class defaults.

**Step 3: Test with actual plugin configs**

Open Simple Clock, Starlark Apps, and Flight Tracker config pages. Verify all form fields render correctly with Bootstrap styling.

**Step 4: Commit**

```bash
git add web_interface/templates/v3/partials/plugin_config.html web_interface/blueprints/pages_v3.py
git commit -m "feat(web): migrate plugin config forms to Bootstrap"
```

---

### Task 13: Migrate Starlark config page to Bootstrap

**Files:**
- Modify: `web_interface/templates/v3/partials/starlark_config.html`

**Step 1: Apply Bootstrap card and form patterns**

Same approach as other settings pages — card sections, form controls, responsive grid.

**Step 2: Test and commit**

```bash
git add web_interface/templates/v3/partials/starlark_config.html
git commit -m "feat(web): migrate starlark config to Bootstrap"
```

---

## Phase 5: Polish and Performance

### Task 14: Add loading skeletons and transitions

**Files:**
- Modify: `web_interface/static/v3/app.css` (add skeleton styles)
- Modify: Tab content divs in base.html

**Step 1: Replace gray box skeletons with Bootstrap placeholder pattern**

For each tab's loading state, use Bootstrap's placeholder classes:

```html
<div class="placeholder-glow">
    <div class="card mb-3">
        <div class="card-body">
            <span class="placeholder col-4 mb-3"></span>
            <span class="placeholder col-12" style="height: 200px;"></span>
        </div>
    </div>
</div>
```

**Step 2: Add smooth tab transitions**

Use Alpine.js `x-transition` with custom classes that map to Bootstrap's fade:

```html
<div x-show="activeTab === 'overview'"
     x-transition:enter="fade"
     x-transition:enter-start="opacity-0"
     x-transition:enter-end="opacity-100"
     x-transition:leave="fade"
     x-transition:leave-start="opacity-100"
     x-transition:leave-end="opacity-0">
```

**Step 3: Commit**

```bash
git add web_interface/static/v3/app.css web_interface/templates/v3/
git commit -m "feat(web): add Bootstrap placeholder skeletons and tab transitions"
```

---

### Task 15: Performance optimizations

**Files:**
- Modify: `web_interface/templates/v3/partials/_head.html`
- Modify: `web_interface/templates/v3/partials/_scripts.html`
- Modify: `web_interface/app.py` (add gzip/caching headers)

**Step 1: Add resource hints**

In `_head.html`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link rel="dns-prefetch" href="https://cdn.jsdelivr.net">
```

**Step 2: Defer non-critical scripts**

Ensure all JS files in `_scripts.html` use `defer` attribute except theme.js (which needs to run synchronously in head).

**Step 3: Add cache headers for static assets**

In `app.py`, configure Flask to serve static files with cache headers:

```python
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 31536000  # 1 year for versioned assets
```

**Step 4: Test page load performance**

Open Chrome DevTools > Network tab. Verify:
- Bootstrap CSS/JS from CDN cache
- Widget bundle loads as single request instead of 26
- Google Fonts load with `font-display: swap` (no FOIT)
- Total requests reduced from ~40+ to ~15

**Step 5: Commit**

```bash
git add web_interface/templates/v3/partials/ web_interface/app.py
git commit -m "perf(web): add resource hints, defer scripts, cache headers"
```

---

### Task 16: Final responsive testing and cleanup

**Files:**
- Modify: `web_interface/static/v3/app.css` (responsive fixes)
- Potentially modify any partial templates

**Step 1: Test at key breakpoints**

Test in Chrome DevTools responsive mode at:
- 375px (iPhone SE) — all content single column, hamburger nav
- 390px (iPhone 14) — same
- 768px (iPad portrait) — 2-column grids, hamburger nav
- 1024px (iPad landscape / small laptop) — sidebar visible, 2-3 column grids
- 1280px (laptop) — full sidebar, 3-4 column grids
- 1920px (desktop) — max-width container, generous spacing

**Step 2: Fix any overflow or cramped layouts**

Common fixes:
- Tables need `table-responsive` wrapper
- Long text needs `text-truncate` or `text-break`
- Images need `img-fluid`
- Forms need proper column stacking

**Step 3: Remove old unused CSS**

Delete any remaining custom utility classes from app.css that are no longer referenced in any template.

**Step 4: Run lint on all modified files**

```bash
make lint
make format
```

**Step 5: Final verification**

Load every page on both mobile and desktop. Verify:
- No horizontal scrolling on mobile
- All forms functional
- All HTMX interactions work
- SSE updates display correctly
- Theme toggle works
- Plugin install/configure flows work
- Log viewer scrolls and updates

**Step 6: Commit**

```bash
git add -A
git commit -m "feat(web): complete frontend overhaul - Bootstrap 5, sidebar nav, responsive design"
```

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1 | 1-3 | Foundation: Bootstrap + theme + sidebar layout |
| 2 | 4-8 | Page-by-page Bootstrap migration |
| 3 | 9-11 | Template decomposition + JS extraction + bundling |
| 4 | 12-13 | Plugin config + Starlark migration |
| 5 | 14-16 | Skeletons, performance, responsive testing |

**Total tasks:** 16
**Estimated commits:** 16
