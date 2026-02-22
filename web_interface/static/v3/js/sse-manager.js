/**
 * SSE (Server-Sent Events) connection setup, reconnection, stats/display updates.
 * Also initializes Alpine.js stores for on-demand and plugin state.
 * Loaded with defer — runs after DOM parse.
 */
const statsSource = new EventSource('/api/v3/stream/stats');
const displaySource = new EventSource('/api/v3/stream/display');

statsSource.onmessage = function(event) {
    const data = JSON.parse(event.data);
    updateSystemStats(data);
};

displaySource.onmessage = function(event) {
    const data = JSON.parse(event.data);
    updateDisplayPreview(data);
};

// Connection status
statsSource.addEventListener('open', function() {
    document.getElementById('connection-status').innerHTML = `
        <span class="rounded-circle d-inline-block" style="width: 8px; height: 8px; background-color: var(--lm-success);"></span>
        <span class="d-none d-md-inline text-muted">Connected</span>
    `;
});

statsSource.addEventListener('error', function() {
    document.getElementById('connection-status').innerHTML = `
        <span class="rounded-circle d-inline-block" style="width: 8px; height: 8px; background-color: var(--lm-danger);"></span>
        <span class="d-none d-md-inline text-muted">Disconnected</span>
    `;
});

function updateSystemStats(data) {
    // Update CPU in header (new format: <span id="cpu-stat"><i>...</i>--%</span>)
    const cpuEl = document.getElementById('cpu-stat');
    if (cpuEl && data.cpu_percent !== undefined) {
        const icon = cpuEl.querySelector('i');
        cpuEl.textContent = '';
        if (icon) cpuEl.appendChild(icon);
        cpuEl.appendChild(document.createTextNode(data.cpu_percent + '%'));
    }

    // Update Memory in header
    const memEl = document.getElementById('mem-stat');
    if (memEl && data.memory_used_percent !== undefined) {
        const icon = memEl.querySelector('i');
        memEl.textContent = '';
        if (icon) memEl.appendChild(icon);
        memEl.appendChild(document.createTextNode(data.memory_used_percent + '%'));
    }

    // Update Temperature in header
    const tempEl = document.getElementById('temp-stat');
    if (tempEl && data.cpu_temp !== undefined) {
        const icon = tempEl.querySelector('i');
        tempEl.textContent = '';
        if (icon) tempEl.appendChild(icon);
        tempEl.appendChild(document.createTextNode(data.cpu_temp + '\u00B0C'));
    }

    // Update Overview tab stats (if visible)
    const cpuUsageEl = document.getElementById('cpu-usage');
    if (cpuUsageEl && data.cpu_percent !== undefined) {
        cpuUsageEl.textContent = data.cpu_percent + '%';
    }

    const memUsageEl = document.getElementById('memory-usage');
    if (memUsageEl && data.memory_used_percent !== undefined) {
        memUsageEl.textContent = data.memory_used_percent + '%';
    }

    const cpuTempEl = document.getElementById('cpu-temp');
    if (cpuTempEl && data.cpu_temp !== undefined) {
        cpuTempEl.textContent = data.cpu_temp + '°C';
    }

    const displayStatusEl = document.getElementById('display-status');
    if (displayStatusEl) {
        displayStatusEl.textContent = data.service_active ? 'Active' : 'Inactive';
        displayStatusEl.className = data.service_active ?
            'text-lg font-medium text-green-600' :
            'text-lg font-medium text-red-600';
    }
}

window.__onDemandStore = window.__onDemandStore || {
    loading: true,
    state: {},
    service: {},
    error: null,
    lastUpdated: null
};

document.addEventListener('alpine:init', () => {
    // On-Demand state store
    if (window.Alpine && !window.Alpine.store('onDemand')) {
        window.Alpine.store('onDemand', {
            loading: window.__onDemandStore.loading,
            state: window.__onDemandStore.state,
            service: window.__onDemandStore.service,
            error: window.__onDemandStore.error,
            lastUpdated: window.__onDemandStore.lastUpdated
        });
    }
    if (window.Alpine) {
        window.__onDemandStore = window.Alpine.store('onDemand');
    }

    // Plugin state store - centralized state management for plugins
    // Used primarily by HTMX-loaded plugin config partials
    if (window.Alpine && !window.Alpine.store('plugins')) {
        window.Alpine.store('plugins', {
            // Track which plugin configs have been loaded
            loadedConfigs: {},

            // Mark a plugin config as loaded
            markLoaded(pluginId) {
                this.loadedConfigs[pluginId] = true;
            },

            // Check if a plugin config is loaded
            isLoaded(pluginId) {
                return !!this.loadedConfigs[pluginId];
            },

            // Refresh a plugin config tab via HTMX
            refreshConfig(pluginId) {
                const container = document.querySelector(`#plugin-config-${pluginId}`);
                if (container && window.htmx) {
                    htmx.ajax('GET', `/v3/partials/plugin-config/${pluginId}`, {
                        target: container,
                        swap: 'innerHTML'
                    });
                }
            }
        });
    }
});
