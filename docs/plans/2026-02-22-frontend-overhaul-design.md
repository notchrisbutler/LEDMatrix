# Frontend Overhaul Design

**Date:** 2026-02-22
**Status:** Approved

## Context

The LED Matrix web interface is a Flask + HTMX + Alpine.js app with custom CSS (no framework), a 5,353-line base.html monolith, 23+ individually-loaded widget JS files, and horizontal tab navigation that degrades badly on mobile (wraps into 3+ rows). The interface needs a full visual and structural overhaul to be mobile-first, responsive, and performant.

## Decisions

- **Aesthetic:** Clean Modern Utility (Home Assistant / IoT dashboard feel)
- **Primary devices:** Phone + desktop equally
- **Mobile nav:** Sidebar drawer (Bootstrap Offcanvas)
- **Display preview:** Always visible, hero position on Overview
- **Approach:** Bootstrap 5 full rewrite of styling layer, keep HTMX + Alpine.js

## Visual Identity

### Colors (CSS custom properties)

Dark mode (default):
- Surface base: `#0f172a` (deep slate)
- Surface card: `#1e293b`
- Surface elevated: `#334155`
- Text primary: `#f1f5f9`
- Text muted: `#94a3b8`
- Border: `rgba(148, 163, 184, 0.15)`

Light mode:
- Surface base: `#f8fafc`
- Surface card: `#ffffff`
- Surface elevated: `#f1f5f9`
- Text primary: `#1e293b`
- Text muted: `#64748b`

Accents:
- Primary: `#3b82f6` (blue) — actions, active states
- Success: `#22c55e` — running, connected
- Warning: `#f59e0b` — caution
- Danger: `#ef4444` — destructive, errors

### Typography

- Headings: `DM Sans` (Google Fonts) — geometric, modern, distinctive
- Body: `Source Sans 3` (Google Fonts) — legible, professional
- Monospace: `JetBrains Mono` (Google Fonts) — stats, logs, code
- Loading: `font-display: swap` with system fallback

### Shadows

- Card: `0 1px 3px rgba(0,0,0,0.12)` light / `0 1px 3px rgba(0,0,0,0.4)` dark
- Hover: `0 4px 12px rgba(0,0,0,0.15)`
- Subtle depth only, no heavy shadows

## Layout Architecture

### Desktop (>=992px)

Persistent sidebar (240px) + content area:

```
┌──────────────────────────────────────────────────┐
│ [Logo] LED Matrix Control   [theme] [●] CPU MEM  │
├──────────┬───────────────────────────────────────┤
│ SIDEBAR  │  CONTENT AREA                         │
│ System   │  (loaded via HTMX partials)           │
│ -Overview│                                       │
│  General │                                       │
│  WiFi    │                                       │
│  ...     │                                       │
│ Plugins  │                                       │
│ -Manager │                                       │
│  Clock   │                                       │
│  ...     │                                       │
└──────────┴───────────────────────────────────────┘
```

### Mobile (<992px)

Hamburger menu triggers Bootstrap Offcanvas sidebar:

```
┌───────────────────────┐
│ [≡] LED Matrix  [☀][●]│
├───────────────────────┤
│ FULL WIDTH CONTENT    │
└───────────────────────┘
```

## Components

### Header (56px, sticky top)
- Logo + title left
- System stats as compact badges right (CPU/MEM/TEMP)
- Connection status dot
- Theme toggle icon
- Mobile: hamburger replaces visible sidebar, stats condense

### Sidebar Navigation
- Two sections: "System" (10 items) and "Plugins" (dynamic)
- Active item: left border accent + background tint
- Icons from Font Awesome (already in use)
- Scrollable independently
- Desktop: always visible (240px)
- Mobile: Bootstrap Offcanvas (slide from left)

### Overview Page
- Hero: Live display preview (full-width card, centered canvas, scale controls)
- Stat cards: 2x2 mobile, 4-column desktop, left-border color accent
- Quick actions: Bootstrap btn-group
- Version info card

### Forms (Settings pages)
- Bootstrap form-floating labels
- Card sections with headers
- Toggle switches for booleans
- Save buttons sticky at bottom on mobile

### Plugin Manager
- Card grid with icon, name, version, status badge
- Install/Update/Uninstall as button group
- Category filter pills

### Log Viewer
- JetBrains Mono font, dark background always
- Auto-scroll with pause toggle
- Search/filter input at top

## Performance Strategy

### CSS
- Bootstrap 5.3 CSS via CDN (~25KB gzipped) replaces 1,006-line app.css
- Custom `app.css` reduced to ~150-200 lines (theming + custom components)
- Preconnect to CDN domains in `<head>`

### JavaScript
- Bootstrap 5.3 JS bundle via CDN (offcanvas, dropdowns, tooltips)
- jQuery 3.7 slim via CDN
- Keep HTMX + Alpine.js as-is
- Bundle 23 widget files into single `widgets.bundle.js`
- Lazy-load CodeMirror only on Config Editor tab open
- Defer all non-critical JS
- Extract inline JS from base.html into separate files

### Loading
- HTMX partial loading stays (load tab content on click)
- Bootstrap placeholder animations for skeleton states
- `font-display: swap` for Google Fonts

### AP Mode Fallback
- Keep existing CDN detection + local fallback pattern
- Bundle local copies of Bootstrap/jQuery in `static/v3/vendor/`

## Template Restructuring

Break up 5,353-line base.html:

- `base.html` — HTML skeleton, `<head>`, CDN links, theme init (~100 lines)
- `partials/_header.html` — header bar
- `partials/_sidebar.html` — sidebar navigation
- `partials/_scripts.html` — script tags and initialization
- Tab partials stay as-is but get Bootstrap class updates

Extract inline JS into:
- `app-init.js` — Alpine.js app(), theme handling
- `htmx-handlers.js` — HTMX event handlers, loading states
- `plugin-tabs.js` — Dynamic plugin tab generation
- `sse-manager.js` — SSE connection and reconnection

## Dark/Light Mode

- Bootstrap 5.3 native dark mode via `data-bs-theme="dark"` on `<html>`
- Custom CSS variables layered on top
- Toggle persisted to localStorage
- Default: dark mode

## Tech Stack (Final)

Keeping:
- Flask + Jinja2 (backend)
- HTMX v1.9.10 (dynamic content)
- Alpine.js v3 (reactive state)
- Font Awesome v6 (icons)
- CodeMirror v5.65 (JSON editor, lazy-loaded)

Adding:
- Bootstrap 5.3 CSS + JS (CDN, layout/components)
- jQuery 3.7 slim (CDN, DOM helpers)
- DM Sans + Source Sans 3 + JetBrains Mono (Google Fonts CDN)

Removing:
- Custom utility CSS framework (replaced by Bootstrap)
- 23 individual widget JS file loads (bundled)
- Inline JS in base.html (extracted)
