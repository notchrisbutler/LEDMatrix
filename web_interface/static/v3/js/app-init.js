/**
 * Alpine.js app() full implementation.
 * Contains pluginConfigData (deprecated), the complete app() function with all
 * plugin management, config form generation, and tab management methods.
 * Loaded with defer in _scripts.html — replaces the stub defined in _head.html.
 */
// ===== DEPRECATED: pluginConfigData =====
// This function is no longer used - plugin configuration forms are now
// rendered server-side and loaded via HTMX. Kept for backwards compatibility.
// See: /v3/partials/plugin-config/<plugin_id> for the new implementation.
function pluginConfigData(plugin) {
    if (!plugin) {
        console.error('pluginConfigData called with undefined plugin');
        return {
            plugin: { id: 'unknown', name: 'Unknown Plugin', enabled: false },
            loading: false,
            config: {},
            schema: {},
            webUiActions: [],
            onDemandRefreshing: false,
            onDemandStopping: false
        };
    }
    return {
        plugin: plugin,
        loading: true,
        config: {},
        schema: {},
        webUiActions: [],
        onDemandRefreshing: false,
        onDemandStopping: false,
        get onDemandStore() {
            if (window.Alpine && typeof Alpine.store === 'function' && Alpine.store('onDemand')) {
                return Alpine.store('onDemand');
            }
            return window.__onDemandStore || { loading: true, state: {}, service: {}, error: null, lastUpdated: null };
        },
        get isOnDemandLoading() {
            const store = this.onDemandStore || {};
            return !!store.loading;
        },
        get onDemandState() {
            const store = this.onDemandStore || {};
            return store.state || {};
        },
        get onDemandService() {
            const store = this.onDemandStore || {};
            return store.service || {};
        },
        get onDemandError() {
            const store = this.onDemandStore || {};
            return store.error || null;
        },
        get onDemandActive() {
            const state = this.onDemandState;
            return !!(state.active && state.plugin_id === plugin.id);
        },
        resolvePluginName() {
            return plugin.name || plugin.id;
        },
        resolvePluginDisplayName(id) {
            if (!id) {
                return 'Another plugin';
            }
            const list = window.installedPlugins || [];
            const match = Array.isArray(list) ? list.find(p => p.id === id) : null;
            return match ? (match.name || match.id) : id;
        },
        formatDuration(value) {
            if (value === undefined || value === null) {
                return '';
            }
            const total = Number(value);
            if (Number.isNaN(total)) {
                return '';
            }
            const seconds = Math.max(0, Math.round(total));
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            if (minutes > 0) {
                return `${minutes}m${remainingSeconds > 0 ? ` ${remainingSeconds}s` : ''}`;
            }
            return `${remainingSeconds}s`;
        },
        get onDemandStatusText() {
            if (this.isOnDemandLoading) {
                return 'Loading on-demand status...';
            }
            if (this.onDemandError) {
                return `On-demand error: ${this.onDemandError}`;
            }
            const state = this.onDemandState;
            if (state.active) {
                const activeName = this.resolvePluginDisplayName(state.plugin_id);
                if (state.plugin_id !== plugin.id) {
                    return `${activeName} is running on-demand.`;
                }
                const modeLabel = state.mode ? ` (${state.mode})` : '';
                const remaining = this.formatDuration(state.remaining);
                const duration = this.formatDuration(state.duration);
                let message = `${this.resolvePluginName()}${modeLabel} is running on-demand`;
                if (remaining) {
                    message += ` — ${remaining} remaining`;
                } else if (duration) {
                    message += ` — duration ${duration}`;
                } else {
                    message += ' — until stopped';
                }
                return message;
            }
            const lastEvent = state.last_event ? state.last_event.replace(/-/g, ' ') : null;
            if (lastEvent && lastEvent !== 'cleared') {
                return `No on-demand session active (last event: ${lastEvent})`;
            }
            return 'No on-demand session active.';
        },
        get onDemandStatusClass() {
            if (this.isOnDemandLoading) return 'text-blue-600';
            if (this.onDemandError) return 'text-red-600';
            if (this.onDemandActive) return 'text-green-600';
            return 'text-blue-600';
        },
        get onDemandServiceText() {
            if (this.isOnDemandLoading) {
                return 'Checking display service status...';
            }
            if (this.onDemandError) {
                return 'Display service status unavailable.';
            }
            if (this.onDemandService.active) {
                return 'Display service is running.';
            }
            const serviceError = this.onDemandService.stderr || this.onDemandService.error;
            return serviceError ? `Display service inactive (${serviceError})` : 'Display service is not running.';
        },
        get onDemandServiceClass() {
            if (this.isOnDemandLoading) return 'text-blue-500';
            if (this.onDemandError) return 'text-red-500';
            return this.onDemandService.active ? 'text-blue-500' : 'text-red-500';
        },
        get onDemandLastUpdated() {
            const store = this.onDemandStore || {};
            if (!store.lastUpdated) {
                return '';
            }
            const deltaSeconds = Math.round((Date.now() - store.lastUpdated) / 1000);
            if (deltaSeconds < 5) return 'Just now';
            if (deltaSeconds < 60) return `${deltaSeconds}s ago`;
            const minutes = Math.round(deltaSeconds / 60);
            if (minutes < 60) return `${minutes}m ago`;
            const hours = Math.round(minutes / 60);
            return `${hours}h ago`;
        },
        get canStopOnDemand() {
            if (this.isOnDemandLoading) return false;
            if (this.onDemandError) return true;
            return this.onDemandActive;
        },
        get disableRunButton() {
            return !plugin.enabled;
        },
        get showEnableHint() {
            return !plugin.enabled;
        },
        notify(message, type = 'info') {
            if (typeof showNotification === 'function') {
                showNotification(message, type);
            }
        },
        refreshOnDemandStatus() {
            if (typeof window.loadOnDemandStatus !== 'function') {
                this.notify('On-demand status controls unavailable. Refresh the Plugin Manager tab.', 'error');
                return;
            }
            this.onDemandRefreshing = true;
            Promise.resolve(window.loadOnDemandStatus(true))
                .finally(() => {
                    this.onDemandRefreshing = false;
                });
        },
        runOnDemand() {
            // Note: On-demand can work with disabled plugins - the backend will temporarily enable them
            if (typeof window.openOnDemandModal === 'function') {
                window.openOnDemandModal(plugin.id);
            } else {
                this.notify('On-demand modal unavailable. Refresh the Plugin Manager tab.', 'error');
            }
        },
        stopOnDemandWithEvent(stopService = false) {
            if (typeof window.requestOnDemandStop !== 'function') {
                this.notify('Unable to stop on-demand mode. Refresh the Plugin Manager tab.', 'error');
                return;
            }
            this.onDemandStopping = true;
            Promise.resolve(window.requestOnDemandStop({ stopService }))
                .finally(() => {
                    this.onDemandStopping = false;
                });
        },
        async loadPluginConfig(pluginId) {
            // Use PluginConfigHelpers to load config directly into this component
            if (window.PluginConfigHelpers) {
                await window.PluginConfigHelpers.loadPluginConfig(pluginId, this);
                this.loading = false;
                return;
            }
            console.error('loadPluginConfig not available');
            this.loading = false;
        }
        // Note: generateConfigForm and savePluginConfig are now called via window.PluginConfigHelpers 
        // to avoid delegation recursion and ensure proper access to app component.
        // See template usage:
        // x-html="window.PluginConfigHelpers.generateConfigForm(...)" and 
        // x-on:submit.prevent="window.PluginConfigHelpers.savePluginConfig(...)"
    };
}

// Alpine.js app function - full implementation
function app() {
    // If Alpine is already initialized, get the current component and enhance it
    let baseComponent = {};
    if (window.Alpine) {
        const appElement = document.querySelector('[x-data]');
        if (appElement && appElement._x_dataStack && appElement._x_dataStack[0]) {
            baseComponent = appElement._x_dataStack[0];
        }
    }

    const fullImplementation = {
        activeTab: (function() {
            // Auto-open WiFi tab when in AP mode (192.168.4.x)
            const isAPMode = window.location.hostname === '192.168.4.1' || 
                           window.location.hostname.startsWith('192.168.4.');
            return isAPMode ? 'wifi' : 'overview';
        })(),
        installedPlugins: [],

        init() {
            // Prevent multiple initializations
            if (this._initialized) {
                return;
            }
            this._initialized = true;

            // Load plugins on page load so tabs are available on any page, regardless of active tab
            // First check if plugins are already in window.installedPlugins (from plugins_manager.js)
            if (typeof window.installedPlugins !== 'undefined' && Array.isArray(window.installedPlugins) && window.installedPlugins.length > 0) {
                this.installedPlugins = window.installedPlugins;
                console.log('Initialized installedPlugins from global:', this.installedPlugins.length);
                // Ensure tabs are updated immediately
                this.$nextTick(() => {
                    this.updatePluginTabs();
                });
            } else if (!this.installedPlugins || this.installedPlugins.length === 0) {
                // Load plugins asynchronously, but ensure tabs update when done
                this.loadInstalledPlugins().then(() => {
                    // Ensure tabs are updated after loading
                    this.$nextTick(() => {
                        this.updatePluginTabs();
                    });
                }).catch(err => {
                    console.error('Error loading plugins in init:', err);
                    // Still try to update tabs in case some plugins are available
                    this.$nextTick(() => {
                        this.updatePluginTabs();
                    });
                });
            } else {
                // Plugins already loaded, just update tabs
                this.$nextTick(() => {
                    this.updatePluginTabs();
                });
            }

            // Ensure content loads for the active tab
            this.$watch('activeTab', (newTab, oldTab) => {
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

            // Listen for plugin updates from pluginManager
            document.addEventListener('pluginsUpdated', (event) => {
                console.log('Received pluginsUpdated event:', event.detail.plugins.length, 'plugins');
                this.installedPlugins = event.detail.plugins;
                this.updatePluginTabs();
            });

            // Also listen for direct window.installedPlugins changes
            // Store the actual value in a private property to avoid infinite loops
            let _installedPluginsValue = this.installedPlugins || [];

            // Only define the property if it doesn't already exist or if it's configurable
            const existingDescriptor = Object.getOwnPropertyDescriptor(window, 'installedPlugins');
            if (!existingDescriptor || existingDescriptor.configurable) {
                // Delete existing property if it exists and is configurable
                if (existingDescriptor) {
                    delete window.installedPlugins;
                }

                Object.defineProperty(window, 'installedPlugins', {
                    set: (value) => {
                        const newPlugins = value || [];
                        const oldIds = (_installedPluginsValue || []).map(p => p.id).sort().join(',');
                        const newIds = newPlugins.map(p => p.id).sort().join(',');

                        // Only update if plugin list actually changed
                        if (oldIds !== newIds) {
                            console.log('window.installedPlugins changed:', newPlugins.length, 'plugins');
                            _installedPluginsValue = newPlugins;
                            this.installedPlugins = newPlugins;
                            this.updatePluginTabs();
                        }
                    },
                    get: () => _installedPluginsValue,
                    configurable: true  // Allow redefinition if needed
                });
            } else {
                // Property already exists and is not configurable, just update the value
                if (typeof window.installedPlugins !== 'undefined') {
                    _installedPluginsValue = window.installedPlugins;
                }
            }

        },

        loadTabContent(tab) {
            // Try to load content for the active tab
            if (typeof htmx !== 'undefined') {
                const contentId = tab + '-content';
                const contentEl = document.getElementById(contentId);
                if (contentEl && !contentEl.hasAttribute('data-loaded')) {
                    // Trigger HTMX load
                    htmx.trigger(contentEl, 'revealed');
                }
            } else {
                // HTMX not available, use direct fetch
                console.warn('HTMX not available, using direct fetch for tab:', tab);
                if (tab === 'overview' && typeof loadOverviewDirect === 'function') {
                    loadOverviewDirect();
                } else if (tab === 'wifi' && typeof loadWifiDirect === 'function') {
                    loadWifiDirect();
                }
            }
        },

        async loadInstalledPlugins() {
            // If pluginManager exists (plugins.html is loaded), delegate to it
            if (window.pluginManager) {
                console.log('[FULL] Delegating plugin loading to pluginManager...');
                await window.pluginManager.loadInstalledPlugins();
                // pluginManager should set window.installedPlugins, so update our component
                if (window.installedPlugins && Array.isArray(window.installedPlugins)) {
                    this.installedPlugins = window.installedPlugins;
                    console.log('[FULL] Updated component plugins from window.installedPlugins:', this.installedPlugins.length);
                }
                this.updatePluginTabs();
                return;
            }

            // Otherwise, load plugins directly (fallback for when plugins.html isn't loaded)
            try {
                console.log('[FULL] Loading installed plugins directly...');
                const data = await getInstalledPluginsSafe();

                if (data.status === 'success') {
                    this.installedPlugins = data.data.plugins || [];
                    // Also update window.installedPlugins for consistency
                    window.installedPlugins = this.installedPlugins;
                    console.log(`[FULL] Loaded ${this.installedPlugins.length} plugins:`, this.installedPlugins.map(p => p.id));

                    // Debug: Log enabled status for each plugin
                    this.installedPlugins.forEach(plugin => {
                        console.log(`[DEBUG Alpine] Plugin ${plugin.id}: enabled=${plugin.enabled} (type: ${typeof plugin.enabled})`);
                    });

                    this.updatePluginTabs();
                } else {
                    console.error('[FULL] Failed to load plugins:', data.message);
                }
            } catch (error) {
                console.error('[FULL] Error loading installed plugins:', error);
            }
        },

        updatePluginTabs(retryCount = 0) {
            console.log('[FULL] updatePluginTabs called (retryCount:', retryCount, ')');
            const maxRetries = 5;

            // Debounce: Clear any pending update
            if (this._updatePluginTabsTimeout) {
                clearTimeout(this._updatePluginTabsTimeout);
            }

            // For first call or retries, execute immediately to ensure tabs appear quickly
            if (retryCount === 0) {
                // First call - execute immediately, then debounce subsequent calls
                this._doUpdatePluginTabs(retryCount);
            } else {
                // Retry - execute immediately
                this._doUpdatePluginTabs(retryCount);
            }
        },

        _doUpdatePluginTabs(retryCount = 0) {
            const maxRetries = 5;

            // Use component's installedPlugins first (most up-to-date), then global, then empty array
            const pluginsToShow = (this.installedPlugins && this.installedPlugins.length > 0) 
                ? this.installedPlugins 
                : (window.installedPlugins || []);

            console.log('[FULL] _doUpdatePluginTabs called with:', pluginsToShow.length, 'plugins (attempt', retryCount + 1, ')');
            console.log('[FULL] Plugin sources:', {
                componentPlugins: this.installedPlugins?.length || 0,
                windowPlugins: window.installedPlugins?.length || 0,
                using: pluginsToShow.length > 0 ? (this.installedPlugins?.length > 0 ? 'component' : 'window') : 'none'
            });

            // Check if plugin list actually changed by comparing IDs
            const currentPluginIds = pluginsToShow.map(p => p.id).sort().join(',');
            const lastRenderedIds = (this._lastRenderedPluginIds || '');

            // Only skip if we have plugins and they match (don't skip if both are empty)
            if (currentPluginIds === lastRenderedIds && retryCount === 0 && currentPluginIds.length > 0) {
                // Plugin list hasn't changed, skip update
                console.log('[FULL] Plugin list unchanged, skipping update');
                return;
            }

            // If we have no plugins and haven't rendered anything yet, still try to render (might be first load)
            if (pluginsToShow.length === 0 && retryCount === 0) {
                console.log('[FULL] No plugins to show, but will retry in case they load...');
                if (retryCount < maxRetries) {
                    setTimeout(() => {
                        this._doUpdatePluginTabs(retryCount + 1);
                    }, 500);
                }
                return;
            }

            // Store the current plugin IDs for next comparison
            this._lastRenderedPluginIds = currentPluginIds;

            const pluginLists = document.querySelectorAll('.sidebar-plugin-list');

            console.log('[FULL] Plugin sidebar elements:', {
                pluginLists: pluginLists.length,
                bodyExists: !!document.body,
                installedPlugins: pluginsToShow.length,
                pluginIds: pluginsToShow.map(p => p.id)
            });

            if (pluginLists.length === 0) {
                if (retryCount < maxRetries) {
                    console.warn('[FULL] Sidebar plugin list not found, retrying in 500ms... (attempt', retryCount + 1, 'of', maxRetries, ')');
                    setTimeout(() => {
                        this._doUpdatePluginTabs(retryCount + 1);
                    }, 500);
                } else {
                    console.error('[FULL] Sidebar plugin list not found after maximum retries.');
                }
                return;
            }

            console.log(`[FULL] Updating sidebar plugin tabs for ${pluginsToShow.length} plugins`);

            pluginLists.forEach(pluginList => {
                // Clear existing plugin tabs (except the Plugin Manager tab)
                const existingTabs = pluginList.querySelectorAll('.plugin-tab');
                console.log(`[FULL] Removing ${existingTabs.length} existing plugin tabs`);
                existingTabs.forEach(tab => tab.remove());

                // Add tabs for each installed plugin
                console.log('[FULL] Adding tabs for plugins:', pluginsToShow.map(p => p.id));
                pluginsToShow.forEach(plugin => {
                    const li = document.createElement('li');
                    li.className = 'nav-item plugin-tab';
                    li.setAttribute('data-plugin-tab', plugin.id);
                    const a = document.createElement('a');
                    a.className = `nav-link ${this.activeTab === plugin.id ? 'active' : ''}`;
                    a.href = '#';
                    a.onclick = (e) => {
                        e.preventDefault();
                        this.activeTab = plugin.id;
                        if (typeof this.updatePluginTabStates === 'function') {
                            this.updatePluginTabStates();
                        }
                        closeMobileNav();
                    };
                    a.innerHTML = `<i class="fas fa-puzzle-piece fa-fw"></i> ${this.escapeHtml(plugin.name || plugin.id)}`;
                    li.appendChild(a);
                    pluginList.appendChild(li);
                    console.log('[FULL] Added sidebar tab for plugin:', plugin.id);
                });
            });

            console.log('[FULL] Sidebar plugin tabs update completed.');
        },

        updatePluginTabStates() {
            // Update active state of all plugin tabs when activeTab changes
            const pluginLists = document.querySelectorAll('.sidebar-plugin-list');
            pluginLists.forEach(pluginList => {
                const pluginTabs = pluginList.querySelectorAll('.plugin-tab');
                pluginTabs.forEach(tab => {
                    const pluginId = tab.getAttribute('data-plugin-tab');
                    const link = tab.querySelector('.nav-link');
                    if (pluginId && link) {
                        if (this.activeTab === pluginId) {
                            link.classList.add('active');
                        } else {
                            link.classList.remove('active');
                        }
                    }
                });
            });
        },

        showNotification(message, type = 'info') {
            // Use global notification widget
            if (typeof window.showNotification === 'function') {
                window.showNotification(message, type);
            } else {
                console.log(`[${type.toUpperCase()}]`, message);
            }
        },

        escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        },

        async refreshPlugins() {
            await this.loadInstalledPlugins();
            await this.searchPluginStore();
            this.showNotification('Plugin list refreshed', 'success');
        },



        async loadPluginConfig(pluginId) {
            console.log('Loading config for plugin:', pluginId);
            this.loading = true;

            try {
                // Load config, schema, and installed plugins (for web_ui_actions) in parallel
                // Use batched API if available for better performance
                let configData, schemaData, pluginsData;

                if (window.PluginAPI && window.PluginAPI.batch) {
                    // PluginAPI.batch returns already-parsed JSON objects
                    try {
                        const results = await window.PluginAPI.batch([
                            {endpoint: `/plugins/config?plugin_id=${pluginId}`, method: 'GET'},
                            {endpoint: `/plugins/schema?plugin_id=${pluginId}`, method: 'GET'},
                            {endpoint: '/plugins/installed', method: 'GET'}
                        ]);
                        [configData, schemaData, pluginsData] = results;
                    } catch (batchError) {
                        console.error('Batch API request failed, falling back to individual requests:', batchError);
                        // Fall back to individual requests
                        const [configResponse, schemaResponse, pluginsResponse] = await Promise.all([
                            fetch(`/api/v3/plugins/config?plugin_id=${pluginId}`).then(r => r.json()).catch(e => ({ status: 'error', message: e.message })),
                            fetch(`/api/v3/plugins/schema?plugin_id=${pluginId}`).then(r => r.json()).catch(e => ({ status: 'error', message: e.message })),
                            fetch(`/api/v3/plugins/installed`).then(r => r.json()).catch(e => ({ status: 'error', message: e.message }))
                        ]);
                        configData = configResponse;
                        schemaData = schemaResponse;
                        pluginsData = pluginsResponse;
                    }
                } else {
                    // Direct fetch returns Response objects that need parsing
                    const [configResponse, schemaResponse, pluginsResponse] = await Promise.all([
                        fetch(`/api/v3/plugins/config?plugin_id=${pluginId}`).then(r => r.json()).catch(e => ({ status: 'error', message: e.message })),
                        fetch(`/api/v3/plugins/schema?plugin_id=${pluginId}`).then(r => r.json()).catch(e => ({ status: 'error', message: e.message })),
                        fetch(`/api/v3/plugins/installed`).then(r => r.json()).catch(e => ({ status: 'error', message: e.message }))
                    ]);
                    configData = configResponse;
                    schemaData = schemaResponse;
                    pluginsData = pluginsResponse;
                }

                if (configData && configData.status === 'success') {
                    this.config = configData.data;
                } else {
                    console.warn('Config API returned non-success status:', configData);
                    // Set defaults if config failed to load
                    this.config = { enabled: true, display_duration: 30 };
                }

                if (schemaData && schemaData.status === 'success') {
                    this.schema = schemaData.data.schema || {};
                } else {
                    console.warn('Schema API returned non-success status:', schemaData);
                    // Set empty schema as fallback
                    this.schema = {};
                }

                // Extract web_ui_actions from installed plugins and update plugin data
                if (pluginsData && pluginsData.status === 'success' && pluginsData.data && pluginsData.data.plugins) {
                    // Update window.installedPlugins with fresh data (includes commit info)
                    // The setter will check if data actually changed before updating tabs
                    window.installedPlugins = pluginsData.data.plugins;
                    // Update Alpine.js app data
                    this.installedPlugins = pluginsData.data.plugins;

                    const pluginInfo = pluginsData.data.plugins.find(p => p.id === pluginId);
                    this.webUiActions = pluginInfo ? (pluginInfo.web_ui_actions || []) : [];
                    console.log('[DEBUG] Loaded web_ui_actions for', pluginId, ':', this.webUiActions.length, 'actions');
                    console.log('[DEBUG] Updated plugin data with commit info:', pluginInfo ? {
                        last_commit: pluginInfo.last_commit,
                        branch: pluginInfo.branch,
                        last_updated: pluginInfo.last_updated
                    } : 'plugin not found');
                } else {
                    console.warn('Plugins API returned non-success status:', pluginsData);
                    this.webUiActions = [];
                }

                console.log('Loaded config, schema, and actions for', pluginId);
            } catch (error) {
                console.error('Error loading plugin config:', error);
                this.config = { enabled: true, display_duration: 30 };
                this.schema = {};
                this.webUiActions = [];
            } finally {
                this.loading = false;
            }
        },

        generateConfigForm(pluginId, config, schema, webUiActions = []) {
            // Safety check - if schema/config not ready, return empty
            if (!pluginId || !config) {
                return '<div class="text-gray-500">Loading configuration...</div>';
            }

            // Only log once per plugin to avoid spam (Alpine.js may call this multiple times during rendering)
            if (!this._configFormLogged || this._configFormLogged !== pluginId) {
                console.log('[DEBUG] generateConfigForm called for', pluginId, 'with', webUiActions?.length || 0, 'actions');
                // Debug: Check if image_config.images has x-widget in schema
                if (schema && schema.properties && schema.properties.image_config) {
                    const imgConfig = schema.properties.image_config;
                    if (imgConfig.properties && imgConfig.properties.images) {
                        const imagesProp = imgConfig.properties.images;
                        console.log('[DEBUG] Schema check - image_config.images:', {
                            type: imagesProp.type,
                            'x-widget': imagesProp['x-widget'],
                            'has x-widget': 'x-widget' in imagesProp,
                            keys: Object.keys(imagesProp)
                        });
                    }
                }
                this._configFormLogged = pluginId;
            }
            if (!schema || !schema.properties) {
                return this.generateSimpleConfigForm(config, webUiActions, pluginId);
            }

            // Helper function to get schema property by full key path
            const getSchemaProperty = (schemaObj, keyPath) => {
                if (!schemaObj || !schemaObj.properties) return null;
                const keys = keyPath.split('.');
                let current = schemaObj.properties;
                for (let i = 0; i < keys.length; i++) {
                    const k = keys[i];
                    if (!current || !current[k]) {
                        return null;
                    }

                    const prop = current[k];
                    // If this is the last key, return the property
                    if (i === keys.length - 1) {
                        return prop;
                    }

                    // If this property has nested properties, navigate deeper
                    if (prop && typeof prop === 'object' && prop.properties) {
                        current = prop.properties;
                    } else {
                        // Can't navigate deeper
                        return null;
                    }
                }
                return null;
            };

            const generateFieldHtml = (key, prop, value, prefix = '') => {
                const fullKey = prefix ? `${prefix}.${key}` : key;
                const label = prop.title || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                const description = prop.description || '';
                let html = '';

                // Debug: Log property structure for arrays to help diagnose file-upload widget issues
                if (prop.type === 'array') {
                    // Also check schema directly as fallback
                    const schemaProp = getSchemaProperty(schema, fullKey);
                    const xWidgetFromSchema = schemaProp ? (schemaProp['x-widget'] || schemaProp['x_widget']) : null;

                    console.log('[DEBUG generateFieldHtml] Array property:', fullKey, {
                        'prop.x-widget': prop['x-widget'],
                        'prop.x_widget': prop['x_widget'],
                        'schema.x-widget': xWidgetFromSchema,
                        'hasOwnProperty(x-widget)': prop.hasOwnProperty('x-widget'),
                        'x-widget in prop': 'x-widget' in prop,
                        'all prop keys': Object.keys(prop),
                        'schemaProp keys': schemaProp ? Object.keys(schemaProp) : 'null'
                    });
                }

                // Handle nested objects
                if (prop.type === 'object' && prop.properties) {
                    const sectionId = `section-${fullKey.replace(/\./g, '-')}`;
                    const nestedConfig = value || {};
                    const sectionLabel = prop.title || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    // Calculate nesting depth for better spacing
                    const nestingDepth = (fullKey.match(/\./g) || []).length;
                    const marginClass = nestingDepth > 1 ? 'mb-6' : 'mb-4';

                    html += `
                        <div class="nested-section border border-gray-300 rounded-lg ${marginClass}">
                            <button type="button" 
                                    class="w-full bg-gray-100 hover:bg-gray-200 px-4 py-3 flex items-center justify-between text-left transition-colors"
                                    onclick="toggleNestedSection('${sectionId}', event); return false;">
                                <div class="flex-1">
                                    <h4 class="font-semibold text-gray-900">${sectionLabel}</h4>
                                    ${description ? `<p class="text-sm text-gray-600 mt-1">${description}</p>` : ''}
                                </div>
                                <i id="${sectionId}-icon" class="fas fa-chevron-right text-gray-500 transition-transform"></i>
                            </button>
                            <div id="${sectionId}" class="nested-content collapsed bg-gray-50 px-4 py-4 space-y-3" style="max-height: 0; display: none;">
                    `;

                    // Recursively generate fields for nested properties
                    // Get ordered properties if x-propertyOrder is defined
                    let nestedPropertyEntries = Object.entries(prop.properties);
                    if (prop['x-propertyOrder'] && Array.isArray(prop['x-propertyOrder'])) {
                        const order = prop['x-propertyOrder'];
                        const orderedEntries = [];
                        const unorderedEntries = [];

                        // Separate ordered and unordered properties
                        nestedPropertyEntries.forEach(([nestedKey, nestedProp]) => {
                            const index = order.indexOf(nestedKey);
                            if (index !== -1) {
                                orderedEntries[index] = [nestedKey, nestedProp];
                            } else {
                                unorderedEntries.push([nestedKey, nestedProp]);
                            }
                        });

                        // Combine ordered entries (filter out undefined from sparse array) with unordered entries
                        nestedPropertyEntries = orderedEntries.filter(entry => entry !== undefined).concat(unorderedEntries);
                    }

                    nestedPropertyEntries.forEach(([nestedKey, nestedProp]) => {
                        // Use config value if it exists and is not null (including false), otherwise use schema default
                        // Check if key exists in config and value is not null/undefined
                        const hasValue = nestedKey in nestedConfig && nestedConfig[nestedKey] !== null && nestedConfig[nestedKey] !== undefined;
                        // For nested objects, if the value is an empty object, still use it (don't fall back to default)
                        const isNestedObject = nestedProp.type === 'object' && nestedProp.properties;
                        const nestedValue = hasValue ? nestedConfig[nestedKey] : 
                            (nestedProp.default !== undefined ? nestedProp.default : 
                             (isNestedObject ? {} : (nestedProp.type === 'array' ? [] : (nestedProp.type === 'boolean' ? false : ''))));

                        // Debug logging for file-upload widgets
                        if (nestedProp.type === 'array' && (nestedProp['x-widget'] === 'file-upload' || nestedProp['x_widget'] === 'file-upload')) {
                            console.log('[DEBUG] Found file-upload widget in nested property:', nestedKey, 'fullKey:', fullKey + '.' + nestedKey, 'prop:', nestedProp);
                        }

                        html += generateFieldHtml(nestedKey, nestedProp, nestedValue, fullKey);
                    });

                    html += `
                            </div>
                        </div>
                    `;

                    // Add extra spacing after nested sections to prevent overlap with next section
                    if (nestingDepth > 0) {
                        html += `<div class="mb-2"></div>`;
                    }

                    return html;
                }

                // Regular (non-nested) field
                html += `<div class="form-group">`;
                html += `<label class="block text-sm font-medium text-gray-700 mb-1">${label}</label>`;

                if (description) {
                    html += `<p class="text-sm text-gray-600 mb-2">${description}</p>`;
                }

                // Generate appropriate input based on type
                if (prop.type === 'boolean') {
                    html += `<label class="flex items-center">`;
                    html += `<input type="checkbox" name="${fullKey}" ${value ? 'checked' : ''} class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded">`;
                    html += `<span class="ml-2 text-sm">Enabled</span>`;
                    html += `</label>`;
                } else if (prop.type === 'number' || prop.type === 'integer' || 
                           (Array.isArray(prop.type) && (prop.type.includes('number') || prop.type.includes('integer')))) {
                    // Handle union types like ["integer", "null"]
                    const isUnionType = Array.isArray(prop.type);
                    const allowsNull = isUnionType && prop.type.includes('null');
                    const isInteger = prop.type === 'integer' || (isUnionType && prop.type.includes('integer'));
                    const isNumber = prop.type === 'number' || (isUnionType && prop.type.includes('number'));
                    const min = prop.minimum !== undefined ? `min="${prop.minimum}"` : '';
                    const max = prop.maximum !== undefined ? `max="${prop.maximum}"` : '';
                    const step = isInteger ? 'step="1"' : 'step="any"';

                    // For union types with null, don't show default if value is null (leave empty)
                    // This allows users to explicitly set null by leaving it empty
                    let fieldValue = '';
                    if (value !== undefined && value !== null) {
                        fieldValue = value;
                    } else if (!allowsNull && prop.default !== undefined) {
                        // Only use default if null is not allowed
                        fieldValue = prop.default;
                    }

                    // Ensure value respects min/max constraints
                    if (fieldValue !== '' && fieldValue !== undefined && fieldValue !== null) {
                        const numValue = typeof fieldValue === 'string' ? parseFloat(fieldValue) : fieldValue;
                        if (!isNaN(numValue)) {
                            // Clamp value to min/max if constraints exist
                            if (prop.minimum !== undefined && numValue < prop.minimum) {
                                fieldValue = prop.minimum;
                            } else if (prop.maximum !== undefined && numValue > prop.maximum) {
                                fieldValue = prop.maximum;
                            } else {
                                fieldValue = numValue;
                            }
                        }
                    }

                    // Add placeholder/help text for null-able fields
                    const placeholder = allowsNull ? 'Leave empty to use current time (random)' : '';
                    const helpText = allowsNull && description && description.includes('null') ? 
                        `<p class="text-xs text-gray-500 mt-1">${description}</p>` : '';

                    html += `<input type="number" name="${fullKey}" value="${fieldValue}" ${min} ${max} ${step} placeholder="${placeholder}" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm">`;
                    if (helpText) {
                        html += helpText;
                    }
                } else if (prop.type === 'array') {
                    // AGGRESSIVE file upload widget detection
                    // For 'images' field in static-image plugin, always check schema directly
                    let isFileUpload = false;
                    let uploadConfig = {};

                    // Direct check: if this is the 'images' field and schema has it with x-widget
                    if (fullKey === 'images' && schema && schema.properties && schema.properties.images) {
                        const imagesSchema = schema.properties.images;
                        if (imagesSchema['x-widget'] === 'file-upload' || imagesSchema['x_widget'] === 'file-upload') {
                            isFileUpload = true;
                            uploadConfig = imagesSchema['x-upload-config'] || imagesSchema['x_upload_config'] || {};
                            console.log('[DEBUG] ✅ Direct detection: images field has file-upload widget', uploadConfig);
                        }
                    }

                    // Fallback: check prop object (should have x-widget if schema loaded correctly)
                    if (!isFileUpload) {
                        const xWidgetFromProp = prop['x-widget'] || prop['x_widget'] || prop.xWidget;
                        if (xWidgetFromProp === 'file-upload') {
                            isFileUpload = true;
                            uploadConfig = prop['x-upload-config'] || prop['x_upload_config'] || {};
                            console.log('[DEBUG] ✅ Detection via prop object');
                        }
                    }

                    // Fallback: schema property lookup
                    if (!isFileUpload) {
                        let schemaProp = getSchemaProperty(schema, fullKey);
                        if (!schemaProp && fullKey === 'images' && schema && schema.properties && schema.properties.images) {
                            schemaProp = schema.properties.images;
                        }
                        const xWidgetFromSchema = schemaProp ? (schemaProp['x-widget'] || schemaProp['x_widget']) : null;
                        if (xWidgetFromSchema === 'file-upload') {
                            isFileUpload = true;
                            uploadConfig = schemaProp['x-upload-config'] || schemaProp['x_upload_config'] || {};
                            console.log('[DEBUG] ✅ Detection via schema lookup');
                        }
                    }

                    // Debug logging for ALL array fields to diagnose
                    console.log('[DEBUG] Array field check:', fullKey, {
                        'isFileUpload': isFileUpload,
                        'prop keys': Object.keys(prop),
                        'prop.x-widget': prop['x-widget'],
                        'schema.properties.images exists': !!(schema && schema.properties && schema.properties.images),
                        'schema.properties.images.x-widget': (schema && schema.properties && schema.properties.images) ? schema.properties.images['x-widget'] : null,
                        'uploadConfig': uploadConfig
                    });

                    if (isFileUpload) {
                        console.log('[DEBUG] ✅ Rendering file-upload widget for', fullKey, 'with config:', uploadConfig);
                        // Use the file upload widget from plugins.html
                        // We'll need to call a function that exists in the global scope
                        const maxFiles = uploadConfig.max_files || 10;
                        const allowedTypes = uploadConfig.allowed_types || ['image/png', 'image/jpeg', 'image/bmp', 'image/gif'];
                        const maxSizeMB = uploadConfig.max_size_mb || 5;

                        const currentImages = Array.isArray(value) ? value : [];
                        const fieldId = fullKey.replace(/\./g, '_');
                        const safePluginId = (uploadConfig.plugin_id || pluginId || 'static-image').toString().replace(/[^a-zA-Z0-9_-]/g, '_');

                        html += `
                            <div id="${fieldId}_upload_widget" class="mt-1">
                                <!-- File Upload Drop Zone -->
                                <div id="${fieldId}_drop_zone" 
                                     class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors cursor-pointer"
                                     ondrop="window.handleFileDrop(event, this.dataset.fieldId)" 
                                     ondragover="event.preventDefault()" 
                                     data-field-id="${fieldId}"
                                     onclick="document.getElementById(this.dataset.fieldId + '_file_input').click()">
                                    <input type="file" 
                                           id="${fieldId}_file_input" 
                                           multiple 
                                           accept="${allowedTypes.join(',')}"
                                           style="display: none;"
                                           data-field-id="${fieldId}"
                                           onchange="window.handleFileSelect(event, this.dataset.fieldId)">
                                    <i class="fas fa-cloud-upload-alt text-3xl text-gray-400 mb-2"></i>
                                    <p class="text-sm text-gray-600">Drag and drop images here or click to browse</p>
                                    <p class="text-xs text-gray-500 mt-1">Max ${maxFiles} files, ${maxSizeMB}MB each (PNG, JPG, GIF, BMP)</p>
                                </div>

                                <!-- Uploaded Images List -->
                                <div id="${fieldId}_image_list" class="mt-4 space-y-2">
                                    ${currentImages.map((img, idx) => {
                                        const imgSchedule = img.schedule || {};
                                        const hasSchedule = imgSchedule.enabled && imgSchedule.mode && imgSchedule.mode !== 'always';
                                        let scheduleSummary = 'Always shown';
                                        if (hasSchedule && window.getScheduleSummary) {
                                            try {
                                                scheduleSummary = window.getScheduleSummary(imgSchedule) || 'Scheduled';
                                            } catch (e) {
                                                scheduleSummary = 'Scheduled';
                                            }
                                        } else if (hasSchedule) {
                                            scheduleSummary = 'Scheduled';
                                        }
                                        // Escape the summary for HTML
                                        scheduleSummary = String(scheduleSummary).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

                                        return `
                                        <div id="img_${(img.id || idx).toString().replace(/[^a-zA-Z0-9_-]/g, '_')}" class="bg-gray-50 p-3 rounded-lg border border-gray-200">
                                            <div class="flex items-center justify-between mb-2">
                                                <div class="flex items-center space-x-3 flex-1">
                                                    <img src="/${(img.path || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;')}" 
                                                         alt="${(img.filename || '').replace(/"/g, '&quot;')}" 
                                                         class="w-16 h-16 object-cover rounded"
                                                         onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                                                    <div style="display:none;" class="w-16 h-16 bg-gray-200 rounded flex items-center justify-center">
                                                        <i class="fas fa-image text-gray-400"></i>
                                                    </div>
                                                    <div class="flex-1 min-w-0">
                                                        <p class="text-sm font-medium text-gray-900 truncate">${String(img.original_filename || img.filename || 'Image').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
                                                        <p class="text-xs text-gray-500">${img.size ? (Math.round(img.size / 1024) + ' KB') : ''} • ${(img.uploaded_at || '').replace(/&/g, '&amp;')}</p>
                                                        <p class="text-xs text-blue-600 mt-1">
                                                            <i class="fas fa-clock mr-1"></i>${scheduleSummary}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div class="flex items-center space-x-2 ml-4">
                                                    <button type="button" 
                                                            data-field-id="${fieldId}"
                                                            data-image-id="${img.id || ''}"
                                                            data-image-idx="${idx}"
                                                            onclick="window.openImageSchedule(this.dataset.fieldId, this.dataset.imageId || null, parseInt(this.dataset.imageIdx))"
                                                            class="text-blue-600 hover:text-blue-800 p-2" 
                                                            title="Schedule this image">
                                                        <i class="fas fa-calendar-alt"></i>
                                                    </button>
                                                    <button type="button" 
                                                            data-field-id="${fieldId}"
                                                            data-image-id="${img.id || ''}"
                                                            data-plugin-id="${safePluginId}"
                                                            onclick="window.deleteUploadedImage(this.dataset.fieldId, this.dataset.imageId, this.dataset.pluginId)"
                                                            class="text-red-600 hover:text-red-800 p-2"
                                                            title="Delete image">
                                                        <i class="fas fa-trash"></i>
                                                    </button>
                                                </div>
                                            </div>
                                            <!-- Schedule widget will be inserted here when opened -->
                                            <div id="schedule_${(img.id || idx).toString().replace(/[^a-zA-Z0-9_-]/g, '_')}" class="hidden mt-3 pt-3 border-t border-gray-300"></div>
                                        </div>
                                        `;
                                    }).join('')}
                                </div>

                                <!-- Hidden input to store image data -->
                                <input type="hidden" id="${fieldId}_images_data" name="${fullKey}" value="${JSON.stringify(currentImages).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')}">
                            </div>
                        `;
                    } else {
                        // Regular array input
                        const arrayValue = Array.isArray(value) ? value.join(', ') : '';
                        html += `<input type="text" name="${fullKey}" value="${arrayValue}" placeholder="Enter values separated by commas" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm">`;
                        html += `<p class="text-sm text-gray-600 mt-1">Enter values separated by commas</p>`;
                    }
                } else if (prop.enum) {
                    html += `<select name="${fullKey}" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm">`;
                    prop.enum.forEach(option => {
                        const selected = value === option ? 'selected' : '';
                        html += `<option value="${option}" ${selected}>${option}</option>`;
                    });
                    html += `</select>`;
                } else if (prop.type === 'string' && prop['x-widget'] === 'file-upload') {
                    // File upload widget for string fields (e.g., credentials.json)
                    const uploadConfig = prop['x-upload-config'] || {};
                    const uploadEndpoint = uploadConfig.upload_endpoint || '/api/v3/plugins/assets/upload';
                    const maxSizeMB = uploadConfig.max_size_mb || 1;
                    const allowedExtensions = uploadConfig.allowed_extensions || ['.json'];
                    const targetFilename = uploadConfig.target_filename || 'file.json';
                    const fieldId = fullKey.replace(/\./g, '_');
                    const hasFile = value && value !== '';

                    html += `
                        <div id="${fieldId}_upload_widget" class="mt-1">
                            <div id="${fieldId}_file_upload" 
                                 class="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-400 transition-colors cursor-pointer"
                                 onclick="document.getElementById('${fieldId}_file_input').click()">
                                <input type="file" 
                                       id="${fieldId}_file_input" 
                                       accept="${allowedExtensions.join(',')}"
                                       style="display: none;"
                                       data-field-id="${fieldId}"
                                       data-upload-endpoint="${uploadEndpoint}"
                                       data-target-filename="${targetFilename}"
                                       onchange="window.handleCredentialsUpload(event, this.dataset.fieldId, this.dataset.uploadEndpoint, this.dataset.targetFilename)">
                                <i class="fas fa-file-upload text-2xl text-gray-400 mb-2"></i>
                                <p class="text-sm text-gray-600" id="${fieldId}_status">
                                    ${hasFile ? `Current file: ${value}` : 'Click to upload ' + targetFilename}
                                </p>
                                <p class="text-xs text-gray-500 mt-1">Max ${maxSizeMB}MB (${allowedExtensions.join(', ')})</p>
                            </div>
                            <input type="hidden" name="${fullKey}" value="${value || ''}" id="${fieldId}_hidden">
                        </div>
                    `;
                } else {
                    // Default to text input
                    const maxLength = prop.maxLength || '';
                    const maxLengthAttr = maxLength ? `maxlength="${maxLength}"` : '';
                    html += `<input type="text" name="${fullKey}" value="${value !== undefined ? value : ''}" ${maxLengthAttr} class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm">`;
                }

                html += `</div>`;
                return html;
            };

            let formHtml = '';
            // Get ordered properties if x-propertyOrder is defined
            let propertyEntries = Object.entries(schema.properties);
            if (schema['x-propertyOrder'] && Array.isArray(schema['x-propertyOrder'])) {
                const order = schema['x-propertyOrder'];
                const orderedEntries = [];
                const unorderedEntries = [];

                // Separate ordered and unordered properties
                propertyEntries.forEach(([key, prop]) => {
                    const index = order.indexOf(key);
                    if (index !== -1) {
                        orderedEntries[index] = [key, prop];
                    } else {
                        unorderedEntries.push([key, prop]);
                    }
                });

                // Combine ordered entries (filter out undefined from sparse array) with unordered entries
                propertyEntries = orderedEntries.filter(entry => entry !== undefined).concat(unorderedEntries);
            }

            propertyEntries.forEach(([key, prop]) => {
                // Skip the 'enabled' property - it's managed separately via the header toggle
                if (key === 'enabled') return;
                // Use config value if key exists and is not null/undefined, otherwise use schema default
                // Check if key exists in config and value is not null/undefined
                const hasValue = key in config && config[key] !== null && config[key] !== undefined;
                // For nested objects, if the value is an empty object, still use it (don't fall back to default)
                const isNestedObject = prop.type === 'object' && prop.properties;
                const value = hasValue ? config[key] : 
                    (prop.default !== undefined ? prop.default : 
                     (isNestedObject ? {} : (prop.type === 'array' ? [] : (prop.type === 'boolean' ? false : ''))));
                formHtml += generateFieldHtml(key, prop, value);
            });

            // Add web UI actions section if plugin defines any
            if (webUiActions && webUiActions.length > 0) {
                console.log('[DEBUG] Rendering', webUiActions.length, 'actions in tab form');

                // Map color names to explicit Tailwind classes
                const colorMap = {
                    'blue': { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-900', textLight: 'text-blue-700', btn: 'bg-blue-600 hover:bg-blue-700' },
                    'green': { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-900', textLight: 'text-green-700', btn: 'bg-green-600 hover:bg-green-700' },
                    'red': { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-900', textLight: 'text-red-700', btn: 'bg-red-600 hover:bg-red-700' },
                    'yellow': { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-900', textLight: 'text-yellow-700', btn: 'bg-yellow-600 hover:bg-yellow-700' },
                    'purple': { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-900', textLight: 'text-purple-700', btn: 'bg-purple-600 hover:bg-purple-700' }
                };

                formHtml += `
                    <div class="border-t border-gray-200 pt-4 mt-4">
                        <h3 class="text-lg font-semibold text-gray-900 mb-3">Actions</h3>
                        <p class="text-sm text-gray-600 mb-4">${webUiActions[0].section_description || 'Perform actions for this plugin'}</p>

                        <div class="space-y-3">
                `;

                webUiActions.forEach((action, index) => {
                    const actionId = `action-${action.id}-${index}`;
                    const statusId = `action-status-${action.id}-${index}`;
                    const bgColor = action.color || 'blue';
                    const colors = colorMap[bgColor] || colorMap['blue'];
                    // Ensure pluginId is valid for template interpolation
                    const safePluginId = pluginId || '';

                    formHtml += `
                            <div class="${colors.bg} border ${colors.border} rounded-lg p-4">
                                <div class="flex items-center justify-between">
                                    <div class="flex-1">
                                        <h4 class="font-medium ${colors.text} mb-1">
                                            ${action.icon ? `<i class="${action.icon} mr-2"></i>` : ''}${action.title || action.id}
                                        </h4>
                                        <p class="text-sm ${colors.textLight}">${action.description || ''}</p>
                                    </div>
                                    <button type="button" 
                                            id="${actionId}"
                                            onclick="executePluginAction('${action.id}', ${index}, '${safePluginId}')" 
                                            data-plugin-id="${safePluginId}"
                                            data-action-id="${action.id}"
                                            class="btn ${colors.btn} text-white px-4 py-2 rounded-md whitespace-nowrap">
                                        ${action.icon ? `<i class="${action.icon} mr-2"></i>` : ''}${action.button_text || action.title || 'Execute'}
                                    </button>
                                </div>
                                <div id="${statusId}" class="mt-3 hidden"></div>
                            </div>
                    `;
                });

                formHtml += `
                        </div>
                    </div>
                `;
            }

            return formHtml;
        },

        generateSimpleConfigForm(config, webUiActions = [], pluginId = '') {
            let actionsHtml = '';
            if (webUiActions && webUiActions.length > 0) {
                const colorMap = {
                    'blue': { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-900', textLight: 'text-blue-700', btn: 'bg-blue-600 hover:bg-blue-700' },
                    'green': { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-900', textLight: 'text-green-700', btn: 'bg-green-600 hover:bg-green-700' },
                    'red': { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-900', textLight: 'text-red-700', btn: 'bg-red-600 hover:bg-red-700' },
                    'yellow': { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-900', textLight: 'text-yellow-700', btn: 'bg-yellow-600 hover:bg-yellow-700' },
                    'purple': { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-900', textLight: 'text-purple-700', btn: 'bg-purple-600 hover:bg-purple-700' }
                };

                actionsHtml = `
                    <div class="border-t border-gray-200 pt-4 mt-4">
                        <h3 class="text-lg font-semibold text-gray-900 mb-3">Actions</h3>
                        <div class="space-y-3">
                `;
                webUiActions.forEach((action, index) => {
                    const actionId = `action-${action.id}-${index}`;
                    const statusId = `action-status-${action.id}-${index}`;
                    const bgColor = action.color || 'blue';
                    const colors = colorMap[bgColor] || colorMap['blue'];
                    // Ensure pluginId is valid for template interpolation
                    const safePluginId = pluginId || '';
                    actionsHtml += `
                            <div class="${colors.bg} border ${colors.border} rounded-lg p-4">
                                <div class="flex items-center justify-between">
                                    <div class="flex-1">
                                        <h4 class="font-medium ${colors.text} mb-1">
                                            ${action.icon ? `<i class="${action.icon} mr-2"></i>` : ''}${action.title || action.id}
                                        </h4>
                                        <p class="text-sm ${colors.textLight}">${action.description || ''}</p>
                                    </div>
                                    <button type="button" 
                                            id="${actionId}"
                                            onclick="executePluginAction('${action.id}', ${index}, '${safePluginId}')" 
                                            data-plugin-id="${safePluginId}"
                                            data-action-id="${action.id}"
                                            class="btn ${colors.btn} text-white px-4 py-2 rounded-md">
                                        ${action.icon ? `<i class="${action.icon} mr-2"></i>` : ''}${action.button_text || action.title || 'Execute'}
                                    </button>
                                </div>
                                <div id="${statusId}" class="mt-3 hidden"></div>
                            </div>
                    `;
                });
                actionsHtml += `
                        </div>
                    </div>
                `;
            }

            return `
                <div class="form-group">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Display Duration (seconds)</label>
                    <input type="number" name="display_duration" value="${Math.max(5, Math.min(300, config.display_duration || 30))}" min="5" max="300" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
                    <p class="text-sm text-gray-600 mt-1">How long to show this plugin's content</p>
                </div>
                ${actionsHtml}
            `;
        },

        // Helper function to get schema property type for a field path
        getSchemaPropertyType(schema, path) {
            if (!schema || !schema.properties) return null;

            const parts = path.split('.');
            let current = schema.properties;

            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                if (current && current[part]) {
                    if (i === parts.length - 1) {
                        return current[part];
                    } else if (current[part].properties) {
                        current = current[part].properties;
                    } else {
                        return null;
                    }
                } else {
                    return null;
                }
            }
            return null;
        },

        // Helper function to escape CSS selector special characters
        escapeCssSelector(str) {
            if (typeof str !== 'string') {
                str = String(str);
            }
            // Use CSS.escape() when available (handles unicode, leading digits, and edge cases)
            if (typeof CSS !== 'undefined' && CSS.escape) {
                return CSS.escape(str);
            }
            // Fallback to regex-based escaping for older browsers
            // First, handle leading digits and whitespace (must be done before regex)
            let escaped = str;
            let hasLeadingHexEscape = false;
            if (escaped.length > 0) {
                const firstChar = escaped[0];
                const firstCode = firstChar.charCodeAt(0);

                // Escape leading digit (0-9: U+0030-U+0039)
                if (firstCode >= 0x30 && firstCode <= 0x39) {
                    const hex = firstCode.toString(16).toUpperCase().padStart(4, '0');
                    escaped = '\\' + hex + ' ' + escaped.slice(1);
                    hasLeadingHexEscape = true;
                }
                // Escape leading whitespace (space: U+0020, tab: U+0009, etc.)
                else if (/\s/.test(firstChar)) {
                    const hex = firstCode.toString(16).toUpperCase().padStart(4, '0');
                    escaped = '\\' + hex + ' ' + escaped.slice(1);
                    hasLeadingHexEscape = true;
                }
            }

            // Escape special characters
            escaped = escaped.replace(/[!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~]/g, '\\$&');

            // Escape internal spaces (replace spaces with \ ), but preserve space in hex escape
            if (hasLeadingHexEscape) {
                // Skip the first 6 characters (e.g., "\0030 ") when replacing spaces
                escaped = escaped.slice(0, 6) + escaped.slice(6).replace(/ /g, '\\ ');
            } else {
                escaped = escaped.replace(/ /g, '\\ ');
            }

            return escaped;
        },

        async savePluginConfig(pluginId, event) {
            try {
                // Get the form element for this plugin
                const form = event ? event.target : null;
                if (!form) {
                    throw new Error('Form element not found');
                }
                const formData = new FormData(form);
                const schema = this.schema || {};

                // First, collect all checkbox states (including unchecked ones)
                // Unchecked checkboxes don't appear in FormData, so we need to iterate form elements
                const flatConfig = {};

                // Process all form elements to capture all field states
                for (let i = 0; i < form.elements.length; i++) {
                    const element = form.elements[i];
                    const name = element.name;

                    // Skip elements without names or submit buttons
                    if (!name || element.type === 'submit' || element.type === 'button') {
                        continue;
                    }

                    // Handle checkboxes explicitly (both checked and unchecked)
                    if (element.type === 'checkbox') {
                        // Check if this is a checkbox group (name ends with [])
                        if (name.endsWith('[]')) {
                            const baseName = name.slice(0, -2); // Remove '[]' suffix
                            if (!flatConfig[baseName]) {
                                flatConfig[baseName] = [];
                            }
                            if (element.checked) {
                                flatConfig[baseName].push(element.value);
                            }
                        } else {
                            // Regular checkbox (boolean)
                            flatConfig[name] = element.checked;
                        }
                    }
                    // Handle radio buttons
                    else if (element.type === 'radio') {
                        if (element.checked) {
                            flatConfig[name] = element.value;
                        }
                    }
                    // Handle select elements (including multi-select)
                    else if (element.tagName === 'SELECT') {
                        if (element.multiple) {
                            // Multi-select: get all selected options
                            const selectedValues = Array.from(element.selectedOptions).map(opt => opt.value);
                            flatConfig[name] = selectedValues;
                        } else {
                            // Single select: handled by FormData, but ensure it's captured
                            if (!(name in flatConfig)) {
                                flatConfig[name] = element.value;
                            }
                        }
                    }
                    // Handle textarea
                    else if (element.tagName === 'TEXTAREA') {
                        // Textarea: handled by FormData, but ensure it's captured
                        if (!(name in flatConfig)) {
                            flatConfig[name] = element.value;
                        }
                    }
                }

                // Now process FormData for other field types
                for (const [key, value] of formData.entries()) {
                    // Skip checkboxes - we already handled them above
                    // Use querySelector to reliably find element by name (handles dot notation)
                    const escapedKey = this.escapeCssSelector(key);
                    const element = form.querySelector(`[name="${escapedKey}"]`);
                    if (element && element.type === 'checkbox') {
                        // Also skip checkbox groups (name ends with [])
                        if (key.endsWith('[]')) {
                            continue; // Already processed
                        }
                        continue; // Already processed
                    }
                    // Skip multi-select - we already handled them above
                    if (element && element.tagName === 'SELECT' && element.multiple) {
                        continue; // Already processed
                    }

                    // Get schema property type if available
                    const propSchema = this.getSchemaPropertyType(schema, key);
                    const propType = propSchema ? propSchema.type : null;

                    // Handle based on schema type or field name patterns
                    if (propType === 'array') {
                        // Check if this is a file upload widget (JSON array in hidden input)
                        if (propSchema && propSchema['x-widget'] === 'file-upload') {
                            try {
                                // Unescape HTML entities that were escaped when setting the value
                                let unescapedValue = value;
                                if (typeof value === 'string') {
                                    // Reverse the HTML escaping: &quot; -> ", &#39; -> ', &amp; -> &
                                    unescapedValue = value
                                        .replace(/&quot;/g, '"')
                                        .replace(/&#39;/g, "'")
                                        .replace(/&amp;/g, '&')
                                        .replace(/&lt;/g, '<')
                                        .replace(/&gt;/g, '>');
                                }

                                // Try to parse as JSON
                                const jsonValue = JSON.parse(unescapedValue);
                                if (Array.isArray(jsonValue)) {
                                    flatConfig[key] = jsonValue;
                                    console.log(`File upload array field ${key}: parsed JSON array with ${jsonValue.length} items`);
                                } else {
                                    // Fallback to empty array
                                    flatConfig[key] = [];
                                }
                            } catch (e) {
                                console.warn(`Failed to parse JSON for file upload field ${key}:`, e, 'Value:', value);
                                // Not valid JSON, use empty array or try comma-separated
                                if (value && value.trim()) {
                                    // Try to unescape and parse again
                                    try {
                                        const unescaped = value
                                            .replace(/&quot;/g, '"')
                                            .replace(/&#39;/g, "'")
                                            .replace(/&amp;/g, '&');
                                        const jsonValue = JSON.parse(unescaped);
                                        if (Array.isArray(jsonValue)) {
                                            flatConfig[key] = jsonValue;
                                        } else {
                                            flatConfig[key] = [];
                                        }
                                    } catch (e2) {
                                        // If still fails, try comma-separated or empty array
                                        const arrayValue = value.split(',').map(v => v.trim()).filter(v => v);
                                        flatConfig[key] = arrayValue.length > 0 ? arrayValue : [];
                                    }
                                } else {
                                    flatConfig[key] = [];
                                }
                            }
                        } else {
                            // Regular array: convert comma-separated string to array
                            const arrayValue = value ? value.split(',').map(v => v.trim()).filter(v => v) : [];
                            flatConfig[key] = arrayValue;
                        }
                    } else if (propType === 'integer' || (Array.isArray(propType) && propType.includes('integer'))) {
                        // Handle union types - if null is allowed and value is empty, keep as empty string (backend will convert to null)
                        if (Array.isArray(propType) && propType.includes('null') && (!value || value.trim() === '')) {
                            flatConfig[key] = ''; // Send empty string, backend will normalize to null
                        } else {
                            const numValue = parseInt(value, 10);
                            flatConfig[key] = isNaN(numValue) ? (propSchema && propSchema.default !== undefined ? propSchema.default : 0) : numValue;
                        }
                    } else if (propType === 'number' || (Array.isArray(propType) && propType.includes('number'))) {
                        // Handle union types - if null is allowed and value is empty, keep as empty string (backend will convert to null)
                        if (Array.isArray(propType) && propType.includes('null') && (!value || value.trim() === '')) {
                            flatConfig[key] = ''; // Send empty string, backend will normalize to null
                        } else {
                            const numValue = parseFloat(value);
                            flatConfig[key] = isNaN(numValue) ? (propSchema && propSchema.default !== undefined ? propSchema.default : 0) : numValue;
                        }
                    } else if (propType === 'boolean') {
                        // Boolean from FormData (shouldn't happen for checkboxes, but handle it)
                        flatConfig[key] = value === 'on' || value === 'true' || value === true;
                    } else {
                        // String or other types
                        // Check if it's a number field by name pattern (fallback if no schema)
                        if (!propType && (key.includes('duration') || key.includes('interval') || 
                            key.includes('timeout') || key.includes('teams') || key.includes('fps') ||
                            key.includes('bits') || key.includes('nanoseconds') || key.includes('hz'))) {
                            const numValue = parseFloat(value);
                            if (!isNaN(numValue)) {
                                flatConfig[key] = Number.isInteger(numValue) ? parseInt(value, 10) : numValue;
                            } else {
                                flatConfig[key] = value;
                            }
                        } else {
                            flatConfig[key] = value;
                        }
                    }
                }

                // Handle unchecked checkboxes using schema (if available)
                if (schema && schema.properties) {
                    const collectBooleanFields = (props, prefix = '') => {
                        const boolFields = [];
                        for (const [key, prop] of Object.entries(props)) {
                            const fullKey = prefix ? `${prefix}.${key}` : key;
                            if (prop.type === 'boolean') {
                                boolFields.push(fullKey);
                            } else if (prop.type === 'object' && prop.properties) {
                                boolFields.push(...collectBooleanFields(prop.properties, fullKey));
                            }
                        }
                        return boolFields;
                    };

                    const allBoolFields = collectBooleanFields(schema.properties);
                    allBoolFields.forEach(key => {
                        // Only set to false if the field is completely missing from flatConfig
                        // Don't override existing false values - they're explicitly set by the user
                        if (!(key in flatConfig)) {
                            flatConfig[key] = false;
                        }
                    });
                }

                // Convert dot notation to nested object
                const dotToNested = (obj) => {
                    const result = {};
                    for (const key in obj) {
                        const parts = key.split('.');
                        let current = result;
                        for (let i = 0; i < parts.length - 1; i++) {
                            if (!current[parts[i]]) {
                                current[parts[i]] = {};
                            }
                            current = current[parts[i]];
                        }
                        current[parts[parts.length - 1]] = obj[key];
                    }
                    return result;
                };

                const config = dotToNested(flatConfig);

                // Save to backend
                const response = await fetch('/api/v3/plugins/config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        plugin_id: pluginId,
                        config: config
                    })
                });

                let data;
                try {
                    data = await response.json();
                } catch (e) {
                    console.error('Failed to parse JSON response:', e);
                    console.error('Response status:', response.status, response.statusText);
                    console.error('Response text:', await response.text());
                    throw new Error(`Failed to parse server response: ${response.status} ${response.statusText}`);
                }

                console.log('Response status:', response.status, 'Response OK:', response.ok);
                console.log('Response data:', JSON.stringify(data, null, 2));

                if (!response.ok || data.status !== 'success') {
                    let errorMessage = data.message || 'Failed to save configuration';
                    if (data.validation_errors && Array.isArray(data.validation_errors)) {
                        console.error('Validation errors:', data.validation_errors);
                        errorMessage += '\n\nValidation errors:\n' + data.validation_errors.join('\n');
                    }
                    if (data.config_keys && data.schema_keys) {
                        console.error('Config keys sent:', data.config_keys);
                        console.error('Schema keys expected:', data.schema_keys);
                        const extraKeys = data.config_keys.filter(k => !data.schema_keys.includes(k));
                        const missingKeys = data.schema_keys.filter(k => !data.config_keys.includes(k));
                        if (extraKeys.length > 0) {
                            errorMessage += '\n\nExtra keys (not in schema): ' + extraKeys.join(', ');
                        }
                        if (missingKeys.length > 0) {
                            errorMessage += '\n\nMissing keys (in schema): ' + missingKeys.join(', ');
                        }
                    }
                    this.showNotification(errorMessage, 'error');
                    console.error('Config save failed - Full error response:', JSON.stringify(data, null, 2));
                } else {
                    this.showNotification('Configuration saved successfully', 'success');
                    // Reload plugin config to reflect changes
                    await this.loadPluginConfig(pluginId);
                }
            } catch (error) {
                console.error('Error saving plugin config:', error);
                this.showNotification('Error saving configuration: ' + error.message, 'error');
            }
        },

        formatCommitInfo(commit, branch) {
            // Handle null, undefined, or empty string
            const commitStr = (commit && String(commit).trim()) || '';
            const branchStr = (branch && String(branch).trim()) || '';

            if (!commitStr && !branchStr) return 'Unknown';

            const shortCommit = commitStr.length >= 7 ? commitStr.substring(0, 7) : commitStr;

            if (branchStr && shortCommit) {
                return `${branchStr} · ${shortCommit}`;
            }
            if (branchStr) {
                return branchStr;
            }
            if (shortCommit) {
                return shortCommit;
            }
            return 'Unknown';
        },

        formatDateInfo(dateString) {
            // Handle null, undefined, or empty string
            if (!dateString || !String(dateString).trim()) return 'Unknown';

            try {
                const date = new Date(dateString);
                // Check if date is valid
                if (isNaN(date.getTime())) {
                    return 'Unknown';
                }

                const now = new Date();
                const diffTime = Math.abs(now - date);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays < 1) {
                    return 'Today';
                } else if (diffDays < 2) {
                    return 'Yesterday';
                } else if (diffDays < 7) {
                    return `${diffDays} days ago`;
                } else if (diffDays < 30) {
                    const weeks = Math.floor(diffDays / 7);
                    return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
                } else {
                    // Return formatted date for older items
                    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
                }
            } catch (e) {
                console.error('Error formatting date:', e, dateString);
                return 'Unknown';
            }
        }
    };

    // Update window.app to return full implementation
    window.app = function() {
        return fullImplementation;
    };

    // If Alpine is already initialized, update the existing component immediately
    if (window.Alpine) {
        // Use requestAnimationFrame for immediate execution without blocking
        requestAnimationFrame(() => {
            const appElement = document.querySelector('[x-data]');
            if (appElement && appElement._x_dataStack && appElement._x_dataStack[0]) {
                const existingComponent = appElement._x_dataStack[0];
                // Replace all properties and methods from full implementation
                Object.keys(fullImplementation).forEach(key => {
                    existingComponent[key] = fullImplementation[key];
                });
                // Call init to load plugins and set up watchers (only if not already initialized)
                if (typeof existingComponent.init === 'function' && !existingComponent._initialized) {
                    existingComponent.init();
                }
            }
        });
    }

    return fullImplementation;
}

// Make app() available globally
window.app = app;
