# Web UI Stability & Dark Theme Fix — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all broken tab loading (every tab except Overview is stuck on skeleton loaders) and fix dark-theme styling clashes.

**Architecture:** Replace fragile HTMX `hx-trigger="revealed"` lazy loading with direct `fetch()` in Alpine's `loadTabContent()`. This eliminates the HTMX race condition entirely. Keep HTMX for form submissions only. Fix skeleton/card colors for dark theme via CSS overrides.

**Tech Stack:** Alpine.js, Bootstrap 5.3, vanilla JS fetch(), Flask/Jinja2 partials

---

### Task 1: Rewrite `loadTabContent()` in app-init.js

**Files:**
- Modify: `web_interface/static/v3/js/app-init.js:275-355`

**Step 1: Replace the `$watch('activeTab')` callback and `loadTabContent` method**

In `web_interface/static/v3/js/app-init.js`, replace lines 275-355 (from `// Ensure content loads for the active tab` through the end of `loadTabContent`) with:

```javascript
        // Ensure content loads for the active tab
        this.$watch('activeTab', (newTab, oldTab) => {
            // Scroll to top on tab switch
            window.scrollTo(0, 0);
            // Update plugin tab states when activeTab changes
            if (typeof this.updatePluginTabStates === 'function') {
                this.updatePluginTabStates();
            }
            // Trigger content load when tab changes
            this.$nextTick(() => {
                this.loadTabContent(newTab);
            });
        });

        // Load initial tab content
        this.$nextTick(() => {
            this.loadTabContent(this.activeTab);
        });
```

Then replace the `loadTabContent` method (was lines 337-355) with these three new methods:

```javascript
        loadTabContent(tab) {
            const contentEl = document.getElementById(tab + '-content');
            if (!contentEl || contentEl.hasAttribute('data-loaded')) return;

            const url = this.getPartialUrl(tab);
            if (!url) return;

            // Mark as loading to prevent duplicate requests
            contentEl.setAttribute('data-loaded', 'true');

            fetch(url)
                .then(r => {
                    if (!r.ok) throw new Error('HTTP ' + r.status);
                    return r.text();
                })
                .then(html => {
                    contentEl.innerHTML = html;
                    this.executeScripts(contentEl);
                    if (window.Alpine) {
                        Alpine.initTree(contentEl);
                    }
                })
                .catch(err => {
                    console.error('Failed to load tab:', tab, err);
                    contentEl.removeAttribute('data-loaded');
                    contentEl.innerHTML = '<div class="alert alert-danger m-3">' +
                        '<i class="fas fa-exclamation-triangle me-2"></i>' +
                        'Failed to load content. <a href="#" onclick="location.reload(); return false;">Refresh page</a>' +
                        '</div>';
                });
        },

        getPartialUrl(tab) {
            const map = {
                'overview': '/v3/partials/overview',
                'general': '/v3/partials/general',
                'wifi': '/v3/partials/wifi',
                'schedule': '/v3/partials/schedule',
                'display': '/v3/partials/display',
                'config-editor': '/v3/partials/raw-json',
                'fonts': '/v3/partials/fonts',
                'logs': '/v3/partials/logs',
                'cache': '/v3/partials/cache',
                'operation-history': '/v3/partials/operation-history',
                'plugins': '/v3/partials/plugins',
            };
            if (map[tab]) return map[tab];
            // Plugin config tabs and starlark tabs
            if (tab.startsWith('starlark:')) return '/v3/partials/' + tab;
            return '/v3/partials/plugin-config/' + tab;
        },

        executeScripts(container) {
            const scripts = container.querySelectorAll('script');
            scripts.forEach(oldScript => {
                const newScript = document.createElement('script');
                if (oldScript.src) newScript.src = oldScript.src;
                if (oldScript.type) newScript.type = oldScript.type;
                if (oldScript.textContent) newScript.textContent = oldScript.textContent;
                oldScript.replaceWith(newScript);
            });
        },
```

**Step 2: Verify the edit**

Run: `grep -n 'loadTabContent\|getPartialUrl\|executeScripts' web_interface/static/v3/js/app-init.js`

Expected: Should see the three new methods and the `$watch` callback, no references to `htmx.trigger` or `loadOverviewDirect`.

**Step 3: Commit**

```bash
git add web_interface/static/v3/js/app-init.js
git commit -m "fix(web): replace HTMX tab loading with direct fetch

Eliminates race condition where hx-trigger='revealed' never fires
for hidden tabs. All tabs now load via fetch() when first activated."
```

---

### Task 2: Remove hx-* attributes and fallback scripts from base.html

**Files:**
- Modify: `web_interface/templates/v3/base.html:36-167`

**Step 1: Clean up all tab content divs**

For each tab content div, remove the `hx-get`, `hx-trigger`, `hx-swap`, and `hx-on::htmx:response-error` attributes. Keep the `id` and skeleton HTML.

The overview div (line 37) changes from:
```html
<div id="overview-content" hx-get="/v3/partials/overview" hx-trigger="revealed" hx-swap="innerHTML" hx-on::htmx:response-error="loadOverviewDirect()">
```
to:
```html
<div id="overview-content">
```

Apply same change to: `general-content` (line 104), `wifi-content` (lines 119-123), `schedule-content` (line 171), `display-content` (line 186), `config-editor-content` (line 201), `fonts-content` (line 233), `logs-content` (line 248), `cache-content` (line 263), `operation-history-content` (line 278).

**Step 2: Remove the two inline fallback script blocks**

Remove the `<script>` block at lines 50-100 (the `loadOverviewDirect()` function and HTMX fallback timeouts).

Remove the `<script>` block at lines 136-167 (the `loadWifiDirect()` function and AP mode fallback).

**Step 3: Fix the plugins tab loading**

The plugins tab (line 215-229) has a special `x-effect` that calls `window.loadPluginsTab`. Change the x-effect to no longer call loadPluginsTab (that function is being removed). The plugins tab content will be loaded by `loadTabContent('plugins')` like all other tabs.

Change line 215-217 from:
```html
<div x-show="activeTab === 'plugins'"
     x-transition
     x-effect="if (activeTab === 'plugins') { window.loadPluginsTab && window.loadPluginsTab(); }">
```
to:
```html
<div x-show="activeTab === 'plugins'" x-transition>
```

Also remove `hx-get`/`hx-trigger`/`hx-swap` from plugins-content if present. Ensure it has the id `plugins-content`:
```html
<div id="plugins-content">
```

**Step 4: Fix dynamic plugin config tabs**

The dynamic plugin tabs (lines 299-324) use `x-init` to call `htmx.ajax()`. Replace with direct fetch pattern. Change the template from:
```html
<template x-if="activeTab === plugin.id">
    <div class="bg-white rounded-lg shadow p-6 plugin-config-tab"
         :id="'plugin-config-' + plugin.id"
         x-init="$nextTick(() => {
             if (window.htmx && !$el.dataset.htmxLoaded) {
                 $el.dataset.htmxLoaded = 'true';
                 htmx.ajax('GET', '/v3/partials/plugin-config/' + plugin.id, {target: $el, swap: 'innerHTML'});
             }
         })">
```
to:
```html
<template x-if="activeTab === plugin.id">
    <div :id="plugin.id + '-content'"
         class="plugin-config-tab"
         x-init="$nextTick(() => { $root.__x.$data.loadTabContent(plugin.id); })">
```

Note: The `bg-white` class is removed (dark theme issue) and the loading is delegated to `loadTabContent()`.

**Step 5: Commit**

```bash
git add web_interface/templates/v3/base.html
git commit -m "fix(web): remove hx-trigger=revealed and inline fallback scripts

Tab content loading is now handled entirely by loadTabContent() in
app-init.js via direct fetch. HTMX is no longer used for initial
page content loading."
```

---

### Task 3: Gut htmx-config.js

**Files:**
- Modify: `web_interface/static/v3/js/htmx-config.js` (replace entire file)

**Step 1: Replace the entire file**

Replace the 792-line file with a clean ~90-line version that keeps only the essential HTMX event handlers (needed for form submissions):

```javascript
/**
 * HTMX configuration — event handlers and error handling for form submissions.
 * Tab content loading is handled by app-init.js loadTabContent().
 */
(function() {
    function setup() {
        if (!document.body) {
            document.addEventListener('DOMContentLoaded', setup);
            return;
        }

        // Validate HTMX swap targets before swap
        document.body.addEventListener('htmx:beforeSwap', function(event) {
            try {
                const target = event.detail.target;
                if (!target || !(target instanceof Element) || !document.body.contains(target)) {
                    event.detail.shouldSwap = false;
                    return false;
                }
                return true;
            } catch (e) {
                event.detail.shouldSwap = false;
                return false;
            }
        });

        // Suppress harmless HTMX console noise
        const originalError = console.error;
        console.error = function(...args) {
            const str = args.join(' ');
            if ((str.includes('insertBefore') || str.includes("Cannot read properties of null")) &&
                (str.includes('htmx') || args.some(a => a && typeof a === 'object' && a.stack && a.stack.includes('htmx')))) {
                return;
            }
            originalError.apply(console, args);
        };

        const originalWarn = console.warn;
        console.warn = function(...args) {
            const str = args.join(' ');
            if (str.includes('Permissions-Policy') || str.includes('Unrecognized feature')) {
                return;
            }
            originalWarn.apply(console, args);
        };

        // Log HTMX response errors
        document.body.addEventListener('htmx:responseError', function(event) {
            const xhr = event.detail.xhr;
            console.error('HTMX response error:', {
                status: xhr?.status,
                url: xhr?.responseURL,
                target: event.detail.target?.id
            });
        });

        // Re-execute scripts after HTMX swaps (for form responses)
        document.body.addEventListener('htmx:afterSwap', function(event) {
            if (event.detail && event.detail.target) {
                try {
                    const scripts = event.detail.target.querySelectorAll('script');
                    scripts.forEach(function(oldScript) {
                        try {
                            const newScript = document.createElement('script');
                            if (oldScript.src) newScript.src = oldScript.src;
                            if (oldScript.type) newScript.type = oldScript.type;
                            if (oldScript.textContent) newScript.textContent = oldScript.textContent;
                            if (oldScript.parentNode) {
                                oldScript.replaceWith(newScript);
                            }
                        } catch (e) { /* ignore script execution errors */ }
                    });
                } catch (e) { /* ignore */ }
            }
        });
    }
    setup();

    // Section toggle utility (used by HTMX-loaded content)
    window.toggleSection = function(sectionId) {
        const section = document.getElementById(sectionId);
        const icon = document.getElementById(sectionId + '-icon');
        if (!section || !icon) return;

        const isHidden = section.classList.contains('hidden') ||
                         window.getComputedStyle(section).display === 'none';

        if (isHidden) {
            section.classList.remove('hidden');
            section.style.display = 'block';
            icon.classList.replace('fa-chevron-right', 'fa-chevron-down');
        } else {
            section.classList.add('hidden');
            section.style.display = 'none';
            icon.classList.replace('fa-chevron-down', 'fa-chevron-right');
        }
    };
})();
```

**Step 2: Verify line count**

Run: `wc -l web_interface/static/v3/js/htmx-config.js`

Expected: ~95 lines (down from 792).

**Step 3: Commit**

```bash
git add web_interface/static/v3/js/htmx-config.js
git commit -m "refactor(web): gut htmx-config.js from 792 to ~95 lines

Remove loadPluginsTab, inline HTML rendering fallbacks, script
execution fallback chains (Function constructor, eval, promise races),
and plugin function verification intervals. These were all compensating
for the HTMX race condition that is now fixed."
```

---

### Task 4: Fix dark-theme skeleton placeholders in app.css

**Files:**
- Modify: `web_interface/static/v3/app.css:667-669` (after the existing `.skeleton` dark rule)

**Step 1: Add dark-theme overrides for Bootstrap placeholders**

After line 669 (`[data-bs-theme="dark"] .skeleton { ... }`), add:

```css
/* Dark theme overrides for Bootstrap placeholder skeletons */
[data-bs-theme="dark"] .placeholder-glow .placeholder {
    background-color: var(--lm-surface-elevated);
    opacity: 0.3;
}

[data-bs-theme="dark"] .placeholder-glow .card {
    background-color: var(--lm-surface-card);
    border: 1px solid var(--lm-border);
}

/* Fix bg-light cards in dark mode (e.g., WiFi status card) */
[data-bs-theme="dark"] .card.bg-light {
    background-color: var(--lm-surface-elevated) !important;
    color: var(--lm-text-primary);
}
```

**Step 2: Commit**

```bash
git add web_interface/static/v3/app.css
git commit -m "fix(web): dark-theme skeleton placeholders and bg-light cards

Skeleton loaders now blend with dark background instead of showing
bright white/grey rectangles. Also fixes WiFi status card and any
other bg-light cards in dark mode."
```

---

### Task 5: Manual browser testing

**Step 1: Start the web server**

Run: `make web` (or `make run-all` if emulator needed)

**Step 2: Test all tabs load**

Open `http://localhost:5050/v3/` in browser. Click each sidebar tab and verify:

| Tab | Expected |
|-----|----------|
| Overview | Loads immediately (default tab), shows stats, display preview |
| General | Loads on click, shows settings form |
| WiFi | Loads on click, shows WiFi setup with dark-themed status card |
| Schedule | Loads on click, shows schedule settings |
| Display | Loads on click, shows display settings |
| Config Editor | Loads on click, shows JSON editor |
| Fonts | Loads on click, shows font list |
| Logs | Loads on click, shows log viewer |
| Cache | Loads on click, shows cache management |
| Operation History | Loads on click, shows history |
| Plugin Manager | Loads on click, shows installed plugins + store |
| Simple Clock (plugin) | Loads on click, shows plugin config |
| Starlark Apps | Loads on click, shows starlark config |

**Step 3: Test dark theme skeletons**

Hard refresh (Cmd+Shift+R) and watch the skeleton loaders during loading. They should be dark (`#334155`) not bright white/grey.

**Step 4: Test scroll-to-top**

Scroll down on Overview page, then click General tab. Page should scroll to top.

**Step 5: Test HTMX form submissions still work**

On General tab, change a setting and click "Save General Settings". The form should submit via HTMX and show a success notification.

**Step 6: Commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix(web): address issues found during manual testing"
```

---

### Task 6: Final commit — squash-ready summary

**Step 1: Verify all changes**

Run: `git log --oneline -5` to see all commits from this work.

**Step 2: Optional squash**

If desired, squash the 4-5 commits into one:

```bash
git rebase -i HEAD~5
```

Squash message:
```
fix(web): fix tab loading and dark-theme styling

Replace fragile HTMX hx-trigger="revealed" with direct fetch() in
loadTabContent(). This fixes all tabs being permanently stuck on
skeleton loaders due to HTMX/Alpine race condition.

Changes:
- Rewrite loadTabContent() to fetch partials directly for all tabs
- Add scroll-to-top on tab switch
- Remove hx-* attributes and inline fallback scripts from base.html
- Gut htmx-config.js from 792 to ~95 lines
- Fix dark-theme skeleton colors (bright grey -> dark surface)
- Fix bg-light cards in dark mode (WiFi status card)
```
