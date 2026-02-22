/* Widget Bundle - 26 files */

/* === base-widget.js === */
/**
 * LEDMatrix Base Widget Class
 * 
 * Provides common functionality and utilities for all widgets.
 * Widgets can extend this or use it as a reference for best practices.
 * 
 * @module BaseWidget
 */

(function() {
    'use strict';

    /**
     * Base Widget Class
     * Provides common utilities and patterns for widgets
     */
    class BaseWidget {
        constructor(name, version) {
            this.name = name;
            this.version = version || '1.0.0';
        }
        
        /**
         * Validate widget configuration
         * @param {Object} config - Configuration object from schema
         * @param {Object} schema - Full schema object
         * @returns {Object} Validation result {valid: boolean, errors: Array}
         */
        validateConfig(config, schema) {
            const errors = [];
            
            if (!config) {
                errors.push('Configuration is required');
                return { valid: false, errors };
            }
            
            // Add widget-specific validation here
            // This is a base implementation that can be overridden
            
            return {
                valid: errors.length === 0,
                errors
            };
        }
        
        /**
         * Sanitize value for storage
         * @param {*} value - Raw value from widget
         * @returns {*} Sanitized value
         */
        sanitizeValue(value) {
            // Base implementation - widgets should override for specific needs
            if (typeof value === 'string') {
                // Basic XSS prevention
                return value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
            }
            return value;
        }
        
        /**
         * Get field ID from container or options
         * @param {HTMLElement} container - Container element
         * @param {Object} options - Options object
         * @returns {string} Field ID
         */
        getFieldId(container, options) {
            if (options && options.fieldId) {
                return options.fieldId;
            }
            if (container && container.id) {
                return container.id.replace(/_widget_container$/, '');
            }
            return null;
        }
        
        /**
         * Show error message
         * @param {HTMLElement} container - Container element
         * @param {string} message - Error message
         */
        showError(container, message) {
            if (!container) return;
            
            // Remove existing error
            const existingError = container.querySelector('.widget-error');
            if (existingError) {
                existingError.remove();
            }
            
            // Create error element using DOM APIs to prevent XSS
            const errorEl = document.createElement('div');
            errorEl.className = 'widget-error text-sm text-red-600 mt-2';
            
            const icon = document.createElement('i');
            icon.className = 'fas fa-exclamation-circle mr-1';
            errorEl.appendChild(icon);
            
            const messageText = document.createTextNode(message);
            errorEl.appendChild(messageText);
            
            container.appendChild(errorEl);
        }
        
        /**
         * Clear error message
         * @param {HTMLElement} container - Container element
         */
        clearError(container) {
            if (!container) return;
            const errorEl = container.querySelector('.widget-error');
            if (errorEl) {
                errorEl.remove();
            }
        }
        
        /**
         * Escape HTML to prevent XSS
         * Always escapes the input, even for non-strings, by coercing to string first
         * @param {*} text - Text to escape (will be coerced to string)
         * @returns {string} Escaped text
         */
        escapeHtml(text) {
            // Always coerce to string first, then escape
            const textStr = String(text);
            const div = document.createElement('div');
            div.textContent = textStr;
            return div.innerHTML;
        }
        
        /**
         * Sanitize identifier for use in DOM IDs and CSS selectors
         * @param {string} id - Identifier to sanitize
         * @returns {string} Sanitized identifier safe for DOM/CSS
         */
        sanitizeId(id) {
            if (typeof id !== 'string') {
                id = String(id);
            }
            // Allow only alphanumeric, underscore, and hyphen
            return id.replace(/[^a-zA-Z0-9_-]/g, '_');
        }
        
        /**
         * Trigger widget change event
         * @param {string} fieldId - Field ID
         * @param {*} value - New value
         */
        triggerChange(fieldId, value) {
            const event = new CustomEvent('widget-change', {
                detail: { fieldId, value },
                bubbles: true,
                cancelable: true
            });
            document.dispatchEvent(event);
        }
        
        /**
         * Get notification function (if available)
         * @returns {Function|null} Notification function or null
         */
        getNotificationFunction() {
            if (typeof window.showNotification === 'function') {
                return window.showNotification;
            }
            return null;
        }
        
        /**
         * Show notification
         * @param {string} message - Message to show
         * @param {string} type - Notification type (success, error, info, warning)
         */
        notify(message, type) {
            // Normalize type to prevent errors when undefined/null
            const normalizedType = type ? String(type) : 'info';
            
            const notifyFn = this.getNotificationFunction();
            if (notifyFn) {
                notifyFn(message, normalizedType);
            } else {
                console.log(`[${normalizedType.toUpperCase()}] ${message}`);
            }
        }
    }
    
    // Export for use in widget implementations
    if (typeof window !== 'undefined') {
        window.BaseWidget = BaseWidget;
    }
    
    console.log('[BaseWidget] Base widget class loaded');
})();


/* === registry.js === */
/**
 * LEDMatrix Widget Registry
 * 
 * Central registry for all UI widgets used in plugin configuration forms.
 * Allows plugins to use existing widgets and enables third-party developers
 * to create custom widgets without modifying the LEDMatrix codebase.
 * 
 * @module LEDMatrixWidgets
 */

(function() {
    'use strict';

    // Global widget registry
    window.LEDMatrixWidgets = {
        _widgets: new Map(),
        _handlers: new Map(),
        
        /**
         * Register a widget with the registry
         * @param {string} widgetName - Unique identifier for the widget
         * @param {Object} definition - Widget definition object
         * @param {string} definition.name - Human-readable widget name
         * @param {string} definition.version - Widget version
         * @param {Function} definition.render - Function to render the widget HTML
         * @param {Function} definition.getValue - Function to get current widget value
         * @param {Function} definition.setValue - Function to set widget value programmatically
         * @param {Object} definition.handlers - Event handlers for the widget
         */
        register: function(widgetName, definition) {
            if (!widgetName || typeof widgetName !== 'string') {
                console.error('[WidgetRegistry] Invalid widget name:', widgetName);
                return false;
            }
            
            if (!definition || typeof definition !== 'object') {
                console.error('[WidgetRegistry] Invalid widget definition for:', widgetName);
                return false;
            }
            
            // Validate required properties
            if (typeof definition.render !== 'function') {
                console.error('[WidgetRegistry] Widget must have a render function:', widgetName);
                return false;
            }
            
            this._widgets.set(widgetName, definition);
            
            if (definition.handlers) {
                this._handlers.set(widgetName, definition.handlers);
            }
            
            console.log(`[WidgetRegistry] Registered widget: ${widgetName}`);
            return true;
        },
        
        /**
         * Get widget definition
         * @param {string} widgetName - Widget identifier
         * @returns {Object|null} Widget definition or null if not found
         */
        get: function(widgetName) {
            return this._widgets.get(widgetName) || null;
        },
        
        /**
         * Get widget handlers
         * @param {string} widgetName - Widget identifier
         * @returns {Object} Widget handlers object (empty object if not found)
         */
        getHandlers: function(widgetName) {
            return this._handlers.get(widgetName) || {};
        },
        
        /**
         * Check if widget exists in registry
         * @param {string} widgetName - Widget identifier
         * @returns {boolean} True if widget is registered
         */
        has: function(widgetName) {
            return this._widgets.has(widgetName);
        },
        
        /**
         * List all registered widgets
         * @returns {Array<string>} Array of widget names
         */
        list: function() {
            return Array.from(this._widgets.keys());
        },
        
        /**
         * Render a widget into a container element
         * @param {string} widgetName - Widget identifier
         * @param {string|HTMLElement} container - Container element or ID
         * @param {Object} config - Widget configuration from schema
         * @param {*} value - Current value for the widget
         * @param {Object} options - Additional options (fieldId, pluginId, etc.)
         * @returns {boolean} True if rendering succeeded
         */
        render: function(widgetName, container, config, value, options) {
            const widget = this.get(widgetName);
            if (!widget) {
                console.error(`[WidgetRegistry] Widget not found: ${widgetName}`);
                return false;
            }
            
            // Resolve container element
            let containerEl = container;
            if (typeof container === 'string') {
                containerEl = document.getElementById(container);
                if (!containerEl) {
                    console.error(`[WidgetRegistry] Container not found: ${container}`);
                    return false;
                }
            }
            
            if (!containerEl || !(containerEl instanceof HTMLElement)) {
                console.error('[WidgetRegistry] Invalid container element');
                return false;
            }
            
            try {
                // Call widget's render function
                widget.render(containerEl, config, value, options || {});
                return true;
            } catch (error) {
                console.error(`[WidgetRegistry] Error rendering widget ${widgetName}:`, error);
                return false;
            }
        },
        
        /**
         * Get current value from a widget
         * @param {string} widgetName - Widget identifier
         * @param {string} fieldId - Field ID
         * @returns {*} Current widget value
         */
        getValue: function(widgetName, fieldId) {
            const widget = this.get(widgetName);
            if (!widget || typeof widget.getValue !== 'function') {
                console.warn(`[WidgetRegistry] Widget ${widgetName} does not support getValue`);
                return null;
            }
            
            try {
                return widget.getValue(fieldId);
            } catch (error) {
                console.error(`[WidgetRegistry] Error getting value from widget ${widgetName}:`, error);
                return null;
            }
        },
        
        /**
         * Set value in a widget
         * @param {string} widgetName - Widget identifier
         * @param {string} fieldId - Field ID
         * @param {*} value - Value to set
         * @returns {boolean} True if setting succeeded
         */
        setValue: function(widgetName, fieldId, value) {
            const widget = this.get(widgetName);
            if (!widget || typeof widget.setValue !== 'function') {
                console.warn(`[WidgetRegistry] Widget ${widgetName} does not support setValue`);
                return false;
            }
            
            try {
                widget.setValue(fieldId, value);
                return true;
            } catch (error) {
                console.error(`[WidgetRegistry] Error setting value in widget ${widgetName}:`, error);
                return false;
            }
        },
        
        /**
         * Unregister a widget (for testing/cleanup)
         * @param {string} widgetName - Widget identifier
         * @returns {boolean} True if widget was removed
         */
        unregister: function(widgetName) {
            const removed = this._widgets.delete(widgetName);
            this._handlers.delete(widgetName);
            if (removed) {
                console.log(`[WidgetRegistry] Unregistered widget: ${widgetName}`);
            }
            return removed;
        },
        
        /**
         * Clear all registered widgets (for testing/cleanup)
         */
        clear: function() {
            this._widgets.clear();
            this._handlers.clear();
            console.log('[WidgetRegistry] Cleared all widgets');
        }
    };
    
    // Expose registry for debugging
    if (typeof window !== 'undefined' && window.console) {
        window.LEDMatrixWidgets.debug = function() {
            console.log('[WidgetRegistry] Registered widgets:', Array.from(this._widgets.keys()));
            console.log('[WidgetRegistry] Widget details:', Array.from(this._widgets.entries()).map(([name, def]) => ({
                name,
                version: def.version || 'unknown',
                hasRender: typeof def.render === 'function',
                hasGetValue: typeof def.getValue === 'function',
                hasSetValue: typeof def.setValue === 'function',
                hasHandlers: !!def.handlers
            })));
        };
    }
    
    console.log('[WidgetRegistry] Widget registry initialized');
})();


/* === notification.js === */
/**
 * LEDMatrix Notification Widget
 *
 * Global notification/toast system for displaying messages to users.
 * Consolidates all notification functionality into a single widget.
 *
 * Usage:
 *   window.showNotification('Message here', 'success');
 *   window.showNotification('Error occurred', 'error');
 *   window.LEDMatrixWidgets.get('notification').show('Custom message', { type: 'warning', duration: 5000 });
 *
 * Types: success, error, warning, info (default)
 *
 * @module NotificationWidget
 */

(function() {
    'use strict';

    // Ensure LEDMatrixWidgets registry exists
    if (typeof window.LEDMatrixWidgets === 'undefined') {
        console.error('[NotificationWidget] LEDMatrixWidgets registry not found. Load registry.js first.');
        return;
    }

    // Configuration
    const CONFIG = {
        containerId: 'notifications',
        defaultDuration: 4000,
        fadeOutDuration: 300,
        maxNotifications: 5,
        position: 'top-right' // top-right, top-left, bottom-right, bottom-left
    };

    // Type-specific styling
    const TYPE_STYLES = {
        success: {
            bg: 'bg-green-500',
            icon: 'fa-check-circle',
            label: 'Success'
        },
        error: {
            bg: 'bg-red-500',
            icon: 'fa-exclamation-circle',
            label: 'Error'
        },
        warning: {
            bg: 'bg-yellow-500',
            icon: 'fa-exclamation-triangle',
            label: 'Warning'
        },
        info: {
            bg: 'bg-blue-500',
            icon: 'fa-info-circle',
            label: 'Info'
        }
    };

    // Track active notifications
    let activeNotifications = [];
    let notificationCounter = 0;

    /**
     * Get or create the notifications container
     * @returns {HTMLElement} Container element
     */
    function getContainer() {
        let container = document.getElementById(CONFIG.containerId);

        if (!container) {
            container = document.createElement('div');
            container.id = CONFIG.containerId;
            container.className = 'fixed top-4 right-4 z-50 space-y-2 pointer-events-none';
            container.setAttribute('aria-live', 'polite');
            container.setAttribute('aria-label', 'Notifications');
            document.body.appendChild(container);
        }

        return container;
    }

    /**
     * Escape HTML to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    /**
     * Remove a notification by ID
     * @param {string} notificationId - Notification ID
     * @param {boolean} immediate - Skip fade animation
     */
    function removeNotification(notificationId, immediate = false) {
        const notification = document.getElementById(notificationId);
        if (!notification) return;

        if (immediate) {
            notification.remove();
        } else {
            notification.style.transition = `opacity ${CONFIG.fadeOutDuration}ms, transform ${CONFIG.fadeOutDuration}ms`;
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';

            setTimeout(() => {
                notification.remove();
            }, CONFIG.fadeOutDuration);
        }

        // Remove from tracking array
        activeNotifications = activeNotifications.filter(id => id !== notificationId);
    }

    /**
     * Show a notification
     * @param {string} message - Message to display
     * @param {Object|string} options - Options object or type string
     * @returns {string} Notification ID (for manual dismissal)
     */
    function showNotification(message, options = {}) {
        // Handle legacy call signature: showNotification(message, type)
        if (typeof options === 'string') {
            options = { type: options };
        }

        const type = options.type || 'info';
        const duration = options.duration !== undefined ? options.duration : CONFIG.defaultDuration;
        const showIcon = options.showIcon !== false;
        const dismissible = options.dismissible !== false;

        const style = TYPE_STYLES[type] || TYPE_STYLES.info;
        const container = getContainer();
        const notificationId = `notification_${++notificationCounter}`;

        // Enforce max notifications limit
        while (activeNotifications.length >= CONFIG.maxNotifications) {
            removeNotification(activeNotifications[0], true);
        }

        // Create notification element
        const notification = document.createElement('div');
        notification.id = notificationId;
        notification.className = `${style.bg} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 pointer-events-auto transform transition-all duration-300 ease-out`;
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        notification.setAttribute('role', 'alert');

        // Build content
        let html = '';

        if (showIcon) {
            html += `<i class="fas ${style.icon} flex-shrink-0"></i>`;
        }

        html += `<span class="flex-1 text-sm">${escapeHtml(message)}</span>`;

        if (dismissible) {
            html += `
                <button type="button"
                        onclick="window.LEDMatrixWidgets.get('notification').dismiss('${notificationId}')"
                        class="flex-shrink-0 ml-2 w-5 h-5 flex items-center justify-center rounded-full opacity-70 hover:opacity-100 hover:bg-white hover:bg-opacity-20 transition-all duration-150"
                        aria-label="Dismiss notification">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            `;
        }

        notification.innerHTML = html;
        container.appendChild(notification);
        activeNotifications.push(notificationId);

        // Trigger animation (need to wait for DOM update)
        requestAnimationFrame(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(0)';
        });

        // Auto-dismiss (0 = no auto-dismiss)
        if (duration > 0) {
            setTimeout(() => {
                removeNotification(notificationId);
            }, duration);
        }

        // Log for debugging
        console.log(`[${type.toUpperCase()}]`, message);

        return notificationId;
    }

    /**
     * Clear all active notifications
     */
    function clearAll() {
        const ids = [...activeNotifications];
        ids.forEach(id => removeNotification(id, true));
    }

    // Register the widget
    window.LEDMatrixWidgets.register('notification', {
        name: 'Notification Widget',
        version: '1.0.0',

        /**
         * Show a notification
         * @param {string} message - Message to display
         * @param {Object} options - Configuration options
         * @param {string} options.type - Notification type: success, error, warning, info
         * @param {number} options.duration - Auto-dismiss duration in ms (0 = no auto-dismiss)
         * @param {boolean} options.showIcon - Show type icon (default: true)
         * @param {boolean} options.dismissible - Show dismiss button (default: true)
         * @returns {string} Notification ID
         */
        show: showNotification,

        /**
         * Dismiss a specific notification
         * @param {string} notificationId - Notification ID to dismiss
         */
        dismiss: function(notificationId) {
            removeNotification(notificationId);
        },

        /**
         * Clear all notifications
         */
        clearAll: clearAll,

        /**
         * Get active notification count
         * @returns {number} Number of active notifications
         */
        getActiveCount: function() {
            return activeNotifications.length;
        },

        // Widget interface methods (for consistency with other widgets)
        render: function() {
            // Notification widget doesn't render into a container
            // It manages its own container
            getContainer();
        },

        getValue: function() {
            return activeNotifications.length;
        },

        setValue: function() {
            // No-op for notification widget
        },

        handlers: {
            dismiss: function(notificationId) {
                removeNotification(notificationId);
            }
        }
    });

    // Global shorthand function (backwards compatible with existing code)
    window.showNotification = function(message, type = 'info') {
        return showNotification(message, { type: type });
    };

    // Initialize container on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', getContainer);
    } else {
        getContainer();
    }

    console.log('[NotificationWidget] Notification widget registered');
})();


/* === plugin-loader.js === */
/**
 * Plugin Widget Loader
 * 
 * Handles loading of plugin-specific custom widgets from plugin directories.
 * Allows third-party plugins to provide their own widget implementations.
 * 
 * @module PluginWidgetLoader
 */

(function() {
    'use strict';

    // Ensure LEDMatrixWidgets registry exists
    if (typeof window.LEDMatrixWidgets === 'undefined') {
        console.error('[PluginWidgetLoader] LEDMatrixWidgets registry not found. Load registry.js first.');
        return;
    }

    /**
     * Load a plugin-specific widget
     * @param {string} pluginId - Plugin ID
     * @param {string} widgetName - Widget name
     * @returns {Promise<void>} Promise that resolves when widget is loaded
     */
    window.LEDMatrixWidgets.loadPluginWidget = async function(pluginId, widgetName) {
        if (!pluginId || !widgetName) {
            throw new Error('Plugin ID and widget name are required');
        }

        // Check if widget is already registered
        if (this.has(widgetName)) {
            console.log(`[PluginWidgetLoader] Widget ${widgetName} already registered`);
            return;
        }

        // Try multiple possible paths for plugin widgets
        const possiblePaths = [
            `/static/plugin-widgets/${pluginId}/${widgetName}.js`,
            `/plugins/${pluginId}/widgets/${widgetName}.js`,
            `/static/plugins/${pluginId}/widgets/${widgetName}.js`
        ];

        let lastError = null;
        for (const widgetPath of possiblePaths) {
            try {
                // Dynamic import of plugin widget
                await import(widgetPath);
                console.log(`[PluginWidgetLoader] Loaded plugin widget: ${pluginId}/${widgetName} from ${widgetPath}`);
                
                // Verify widget was registered
                if (this.has(widgetName)) {
                    return;
                } else {
                    console.warn(`[PluginWidgetLoader] Widget ${widgetName} loaded but not registered. Make sure the script calls LEDMatrixWidgets.register().`);
                }
            } catch (error) {
                lastError = error;
                // Continue to next path
                continue;
            }
        }

        // If all paths failed, throw error
        throw new Error(`Failed to load plugin widget ${pluginId}/${widgetName} from any path. Last error: ${lastError?.message || 'Unknown error'}`);
    };

    /**
     * Auto-load widget when detected in schema
     * Called automatically when a widget is referenced in a plugin's config schema
     * @param {string} widgetName - Widget name
     * @param {string} pluginId - Plugin ID (optional, for plugin-specific widgets)
     * @returns {Promise<boolean>} True if widget is available (either already registered or successfully loaded)
     */
    window.LEDMatrixWidgets.ensureWidget = async function(widgetName, pluginId) {
        // Check if widget is already registered
        if (this.has(widgetName)) {
            return true;
        }

        // If plugin ID provided, try to load as plugin widget
        if (pluginId) {
            try {
                await this.loadPluginWidget(pluginId, widgetName);
                return this.has(widgetName);
            } catch (error) {
                console.warn(`[PluginWidgetLoader] Could not load widget ${widgetName} from plugin ${pluginId}:`, error);
                // Continue to check if it's a core widget
            }
        }

        // Widget not found
        return false;
    };

    /**
     * Load all widgets specified in plugin manifest
     * @param {string} pluginId - Plugin ID
     * @param {Object} manifest - Plugin manifest object
     * @returns {Promise<Array<string>>} Array of successfully loaded widget names
     */
    window.LEDMatrixWidgets.loadPluginWidgetsFromManifest = async function(pluginId, manifest) {
        if (!manifest || !manifest.widgets || !Array.isArray(manifest.widgets)) {
            return [];
        }

        const loadedWidgets = [];
        
        for (const widgetDef of manifest.widgets) {
            const widgetName = widgetDef.name || widgetDef.script?.replace(/\.js$/, '');
            if (!widgetName) {
                console.warn(`[PluginWidgetLoader] Invalid widget definition in manifest:`, widgetDef);
                continue;
            }

            try {
                await this.loadPluginWidget(pluginId, widgetName);
                if (this.has(widgetName)) {
                    loadedWidgets.push(widgetName);
                }
            } catch (error) {
                console.error(`[PluginWidgetLoader] Failed to load widget ${widgetName} from plugin ${pluginId}:`, error);
            }
        }

        return loadedWidgets;
    };

    console.log('[PluginWidgetLoader] Plugin widget loader initialized');
})();


/* === array-table.js === */
/**
 * Array Table Widget
 *
 * Generic table-based array-of-objects editor.
 * Handles adding, removing, and editing array items with object properties.
 * Reads column definitions from the schema's items.properties.
 *
 * Usage in config_schema.json:
 *   "my_array": {
 *     "type": "array",
 *     "x-widget": "array-table",
 *     "x-columns": ["name", "code", "priority", "enabled"],  // optional
 *     "items": {
 *       "type": "object",
 *       "properties": {
 *         "name": { "type": "string" },
 *         "code": { "type": "string" },
 *         "priority": { "type": "integer", "default": 50 },
 *         "enabled": { "type": "boolean", "default": true }
 *       }
 *     }
 *   }
 *
 * @module ArrayTableWidget
 */

(function() {
    'use strict';

    // Ensure LEDMatrixWidgets registry exists
    if (typeof window.LEDMatrixWidgets === 'undefined') {
        console.error('[ArrayTableWidget] LEDMatrixWidgets registry not found. Load registry.js first.');
        return;
    }

    /**
     * Register the array-table widget
     */
    window.LEDMatrixWidgets.register('array-table', {
        name: 'Array Table Widget',
        version: '1.0.0',

        render: function(container, config, value, options) {
            console.log('[ArrayTableWidget] Render called (server-side rendered)');
        },

        getValue: function(fieldId) {
            const tbody = document.getElementById(`${fieldId}_tbody`);
            if (!tbody) return [];

            const rows = tbody.querySelectorAll('.array-table-row');
            const items = [];

            rows.forEach((row) => {
                const item = {};
                row.querySelectorAll('input').forEach(input => {
                    const name = input.getAttribute('name');
                    if (!name || name.endsWith('.enabled') || input.type === 'hidden') return;
                    const match = name.match(/\.\d+\.([^.]+)$/);
                    if (match) {
                        const propName = match[1];
                        if (input.type === 'checkbox') {
                            item[propName] = input.checked;
                        } else if (input.type === 'number') {
                            item[propName] = input.value ? parseFloat(input.value) : null;
                        } else {
                            item[propName] = input.value;
                        }
                    }
                });
                if (Object.keys(item).length > 0) {
                    items.push(item);
                }
            });

            return items;
        },

        setValue: function(fieldId, items, options) {
            if (!Array.isArray(items)) {
                console.error('[ArrayTableWidget] setValue expects an array');
                return;
            }

            if (!options || !options.fullKey || !options.pluginId) {
                throw new Error('ArrayTableWidget.setValue requires options.fullKey and options.pluginId');
            }

            const tbody = document.getElementById(`${fieldId}_tbody`);
            if (!tbody) {
                console.warn(`[ArrayTableWidget] tbody not found for fieldId: ${fieldId}`);
                return;
            }

            tbody.innerHTML = '';

            items.forEach((item, index) => {
                const row = createArrayTableRow(
                    fieldId,
                    options.fullKey,
                    index,
                    options.pluginId,
                    item,
                    options.itemProperties || {},
                    options.displayColumns || []
                );
                tbody.appendChild(row);
            });

            // Refresh Add button state after repopulating rows
            updateAddButtonState(fieldId);
        },

        handlers: {}
    });

    /**
     * Create a table row element for array item
     */
    function createArrayTableRow(fieldId, fullKey, index, pluginId, item, itemProperties, displayColumns) {
        item = item || {};
        const row = document.createElement('tr');
        row.className = 'array-table-row';
        row.setAttribute('data-index', index);

        displayColumns.forEach(colName => {
            const colDef = itemProperties[colName] || {};
            const colType = colDef.type || 'string';
            const colDefault = colDef.default !== undefined ? colDef.default : (colType === 'boolean' ? false : '');
            const colValue = item[colName] !== undefined ? item[colName] : colDefault;

            const cell = document.createElement('td');
            cell.className = 'px-4 py-3 whitespace-nowrap';

            if (colType === 'boolean') {
                const hiddenInput = document.createElement('input');
                hiddenInput.type = 'hidden';
                hiddenInput.name = `${fullKey}.${index}.${colName}`;
                hiddenInput.value = 'false';
                cell.appendChild(hiddenInput);

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.name = `${fullKey}.${index}.${colName}`;
                checkbox.checked = Boolean(colValue);
                checkbox.value = 'true';
                checkbox.className = 'h-4 w-4 text-blue-600';
                cell.appendChild(checkbox);
            } else if (colType === 'integer' || colType === 'number') {
                const input = document.createElement('input');
                input.type = 'number';
                input.name = `${fullKey}.${index}.${colName}`;
                input.value = colValue !== null && colValue !== undefined ? colValue : '';
                if (colDef.minimum !== undefined) input.min = colDef.minimum;
                if (colDef.maximum !== undefined) input.max = colDef.maximum;
                input.step = colType === 'integer' ? '1' : 'any';
                input.className = 'block w-20 px-2 py-1 border border-gray-300 rounded text-sm text-center';
                if (colDef.description) input.title = colDef.description;
                cell.appendChild(input);
            } else {
                const input = document.createElement('input');
                input.type = 'text';
                input.name = `${fullKey}.${index}.${colName}`;
                input.value = colValue !== null && colValue !== undefined ? colValue : '';
                input.className = 'block w-full px-2 py-1 border border-gray-300 rounded text-sm';
                if (colDef.description) input.placeholder = colDef.description;
                if (colDef.pattern) input.pattern = colDef.pattern;
                if (colDef.minLength) input.minLength = colDef.minLength;
                if (colDef.maxLength) input.maxLength = colDef.maxLength;
                cell.appendChild(input);
            }

            row.appendChild(cell);
        });

        // Actions cell
        const actionsCell = document.createElement('td');
        actionsCell.className = 'px-4 py-3 whitespace-nowrap text-center';
        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.className = 'text-red-600 hover:text-red-800 px-2 py-1';
        removeButton.onclick = function() { removeArrayTableRow(this); };
        const removeIcon = document.createElement('i');
        removeIcon.className = 'fas fa-trash';
        removeButton.appendChild(removeIcon);
        actionsCell.appendChild(removeButton);
        row.appendChild(actionsCell);

        return row;
    }

    /**
     * Update the Add button's disabled state based on current row count
     * @param {string} fieldId - Field ID to find the tbody and button
     */
    function updateAddButtonState(fieldId) {
        const tbody = document.getElementById(fieldId + '_tbody');
        if (!tbody) return;

        // Find the add button by looking for the button with matching data-field-id
        const addButton = document.querySelector(`button[data-field-id="${fieldId}"]`);
        if (!addButton) return;

        const maxItems = parseInt(addButton.getAttribute('data-max-items'), 10);
        const currentRows = tbody.querySelectorAll('.array-table-row');
        const isAtMax = currentRows.length >= maxItems;

        addButton.disabled = isAtMax;
        addButton.style.opacity = isAtMax ? '0.5' : '';
    }

    // Expose for external use if needed
    window.updateArrayTableAddButtonState = updateAddButtonState;

    /**
     * Add a new row to the array table
     * @param {HTMLElement} button - The button element with data attributes
     */
    window.addArrayTableRow = function(button) {
        const fieldId = button.getAttribute('data-field-id');
        const fullKey = button.getAttribute('data-full-key');
        const maxItems = parseInt(button.getAttribute('data-max-items'), 10);
        const pluginId = button.getAttribute('data-plugin-id');

        // Parse JSON with fallback on error
        let itemProperties = {};
        let displayColumns = [];
        const rawItemProps = button.getAttribute('data-item-properties') || '{}';
        const rawDisplayCols = button.getAttribute('data-display-columns') || '[]';

        try {
            itemProperties = JSON.parse(rawItemProps);
        } catch (e) {
            console.error('[ArrayTableWidget] Failed to parse data-item-properties:', rawItemProps, e);
            itemProperties = {};
        }

        try {
            displayColumns = JSON.parse(rawDisplayCols);
        } catch (e) {
            console.error('[ArrayTableWidget] Failed to parse data-display-columns:', rawDisplayCols, e);
            displayColumns = [];
        }

        const tbody = document.getElementById(fieldId + '_tbody');
        if (!tbody) return;

        const currentRows = tbody.querySelectorAll('.array-table-row');
        if (currentRows.length >= maxItems) {
            const notifyFn = window.showNotification || alert;
            notifyFn(`Maximum ${maxItems} items allowed`, 'error');
            return;
        }

        const newIndex = currentRows.length;
        const row = createArrayTableRow(fieldId, fullKey, newIndex, pluginId, {}, itemProperties, displayColumns);
        tbody.appendChild(row);

        // Update button state after adding
        updateAddButtonState(fieldId);
    };

    /**
     * Remove a row from the array table
     * @param {HTMLElement} button - The remove button element
     */
    window.removeArrayTableRow = function(button) {
        const row = button.closest('tr');
        if (!row) return;

        if (confirm('Remove this item?')) {
            const tbody = row.parentElement;
            if (!tbody) return;

            // Get fieldId from tbody id (format: {fieldId}_tbody)
            const fieldId = tbody.id.replace('_tbody', '');

            row.remove();

            // Re-index remaining rows
            const rows = tbody.querySelectorAll('.array-table-row');
            rows.forEach(function(r, index) {
                r.setAttribute('data-index', index);
                r.querySelectorAll('input').forEach(function(input) {
                    const name = input.getAttribute('name');
                    if (name) {
                        input.setAttribute('name', name.replace(/\.\d+\./, '.' + index + '.'));
                    }
                });
            });

            // Update button state after removing
            updateAddButtonState(fieldId);
        }
    };

    /**
     * Initialize all array table add buttons on page load
     */
    function initArrayTableButtons() {
        const addButtons = document.querySelectorAll('button[data-field-id][data-max-items]');
        addButtons.forEach(function(button) {
            const fieldId = button.getAttribute('data-field-id');
            updateAddButtonState(fieldId);
        });
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initArrayTableButtons);
    } else {
        initArrayTableButtons();
    }

    console.log('[ArrayTableWidget] Array table widget registered');
})();


/* === checkbox-group.js === */
/**
 * Checkbox Group Widget
 * 
 * Handles multi-select checkbox groups for array fields with enum items.
 * Updates a hidden input with JSON array of selected values.
 * 
 * @module CheckboxGroupWidget
 */

(function() {
    'use strict';

    // Ensure LEDMatrixWidgets registry exists
    if (typeof window.LEDMatrixWidgets === 'undefined') {
        console.error('[CheckboxGroupWidget] LEDMatrixWidgets registry not found. Load registry.js first.');
        return;
    }

    /**
     * Register the checkbox-group widget
     */
    window.LEDMatrixWidgets.register('checkbox-group', {
        name: 'Checkbox Group Widget',
        version: '1.0.0',
        
        /**
         * Render the checkbox group widget
         * Note: This widget is currently server-side rendered via Jinja2 template.
         * This registration ensures the handlers are available globally.
         */
        render: function(container, config, value, options) {
            // For now, widgets are server-side rendered
            // This function is a placeholder for future client-side rendering
            console.log('[CheckboxGroupWidget] Render called (server-side rendered)');
        },
        
        /**
         * Get current value from widget
         * @param {string} fieldId - Field ID
         * @returns {Array} Array of selected values
         */
        getValue: function(fieldId) {
            const hiddenInput = document.getElementById(`${fieldId}_data`);
            if (hiddenInput && hiddenInput.value) {
                try {
                    return JSON.parse(hiddenInput.value);
                } catch (e) {
                    console.error('Error parsing checkbox group data:', e);
                    return [];
                }
            }
            return [];
        },
        
        /**
         * Set value in widget
         * @param {string} fieldId - Field ID
         * @param {Array} values - Array of values to select
         */
        setValue: function(fieldId, values) {
            if (!Array.isArray(values)) {
                console.error('[CheckboxGroupWidget] setValue expects an array');
                return;
            }
            
            // Normalize values to strings for consistent comparison
            const normalizedValues = values.map(String);
            
            // Update checkboxes
            const checkboxes = document.querySelectorAll(`input[type="checkbox"][data-checkbox-group="${fieldId}"]`);
            checkboxes.forEach(checkbox => {
                const optionValue = checkbox.getAttribute('data-option-value') || checkbox.value;
                // Normalize optionValue to string for comparison
                checkbox.checked = normalizedValues.includes(String(optionValue));
            });
            
            // Update hidden input
            updateCheckboxGroupData(fieldId);
        },
        
        handlers: {
            // Handlers are attached to window for backwards compatibility
        }
    });

    /**
     * Update checkbox group data in hidden input
     * Called when any checkbox in the group changes
     * @param {string} fieldId - Field ID
     */
    window.updateCheckboxGroupData = function(fieldId) {
        // Update hidden _data input with currently checked values
        const hiddenInput = document.getElementById(fieldId + '_data');
        if (!hiddenInput) {
            console.warn(`[CheckboxGroupWidget] Hidden input not found for fieldId: ${fieldId}`);
            return;
        }
        
        const checkboxes = document.querySelectorAll(`input[type="checkbox"][data-checkbox-group="${fieldId}"]`);
        const selectedValues = [];
        
        checkboxes.forEach(checkbox => {
            if (checkbox.checked) {
                const optionValue = checkbox.getAttribute('data-option-value') || checkbox.value;
                selectedValues.push(optionValue);
            }
        });
        
        hiddenInput.value = JSON.stringify(selectedValues);
        
        // Trigger change event for form validation
        const event = new CustomEvent('widget-change', {
            detail: { fieldId, value: selectedValues },
            bubbles: true,
            cancelable: true
        });
        hiddenInput.dispatchEvent(event);
    };

    console.log('[CheckboxGroupWidget] Checkbox group widget registered');
})();


/* === color-picker.js === */
/**
 * LEDMatrix Color Picker Widget
 *
 * Color selection with preview and hex/RGB input.
 *
 * Schema example:
 * {
 *   "backgroundColor": {
 *     "type": "string",
 *     "x-widget": "color-picker",
 *     "x-options": {
 *       "showHexInput": true,
 *       "showPreview": true,
 *       "presets": ["#ff0000", "#00ff00", "#0000ff", "#ffffff", "#000000"],
 *       "format": "hex"  // "hex", "rgb", "rgba"
 *     }
 *   }
 * }
 *
 * @module ColorPickerWidget
 */

(function() {
    'use strict';

    const base = window.BaseWidget ? new window.BaseWidget('ColorPicker', '1.0.0') : null;

    function escapeHtml(text) {
        if (base) return base.escapeHtml(text);
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function sanitizeId(id) {
        if (base) return base.sanitizeId(id);
        return String(id).replace(/[^a-zA-Z0-9_-]/g, '_');
    }

    function triggerChange(fieldId, value) {
        if (base) {
            base.triggerChange(fieldId, value);
        } else {
            const event = new CustomEvent('widget-change', {
                detail: { fieldId, value },
                bubbles: true,
                cancelable: true
            });
            document.dispatchEvent(event);
        }
    }

    function isValidHex(hex) {
        return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hex);
    }

    function normalizeHex(hex) {
        if (!hex) return '#000000';
        hex = String(hex).trim();
        if (!hex.startsWith('#')) hex = '#' + hex;
        // Expand 3-digit hex
        if (hex.length === 4) {
            hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
        }
        return hex.toLowerCase();
    }

    /**
     * Sanitize and validate a hex color, returning a safe 7-char #rrggbb string.
     * Falls back to #000000 for any invalid input.
     */
    function sanitizeHex(value) {
        const normalized = normalizeHex(value);
        // Validate it's exactly #rrggbb format with valid hex chars
        if (/^#[0-9a-f]{6}$/.test(normalized)) {
            return normalized;
        }
        return '#000000';
    }

    const DEFAULT_PRESETS = [
        '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff',
        '#ffff00', '#00ffff', '#ff00ff', '#808080', '#ffa500'
    ];

    window.LEDMatrixWidgets.register('color-picker', {
        name: 'Color Picker Widget',
        version: '1.0.0',

        render: function(container, config, value, options) {
            const fieldId = sanitizeId(options.fieldId || container.id || 'color_picker');
            const xOptions = config['x-options'] || config['x_options'] || {};
            const showHexInput = xOptions.showHexInput !== false;
            const showPreview = xOptions.showPreview !== false;
            // Ensure presets is always an array to prevent crashes on .map()
            const presets = Array.isArray(xOptions.presets) ? xOptions.presets : DEFAULT_PRESETS;
            const disabled = xOptions.disabled === true;

            const currentValue = sanitizeHex(value);

            let html = `<div id="${fieldId}_widget" class="color-picker-widget" data-field-id="${fieldId}">`;

            // Main color picker row
            html += '<div class="flex items-center gap-3">';

            // Native color input
            html += `
                <input type="color"
                       id="${fieldId}_color"
                       value="${currentValue}"
                       ${disabled ? 'disabled' : ''}
                       onchange="window.LEDMatrixWidgets.getHandlers('color-picker').onColorChange('${fieldId}')"
                       class="w-12 h-10 rounded cursor-pointer border border-gray-300 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}">
            `;

            // Hex input
            if (showHexInput) {
                html += `
                    <div class="flex items-center">
                        <span class="text-gray-400 mr-1">#</span>
                        <input type="text"
                               id="${fieldId}_hex"
                               value="${currentValue.substring(1)}"
                               maxlength="6"
                               ${disabled ? 'disabled' : ''}
                               onchange="window.LEDMatrixWidgets.getHandlers('color-picker').onHexChange('${fieldId}')"
                               oninput="window.LEDMatrixWidgets.getHandlers('color-picker').onHexInput('${fieldId}')"
                               class="w-20 px-2 py-1 text-sm font-mono rounded border border-gray-300 focus:border-blue-500 focus:ring-blue-500 ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'} text-black uppercase">
                    </div>
                `;
            }

            // Preview box
            if (showPreview) {
                html += `
                    <div id="${fieldId}_preview"
                         class="w-20 h-10 rounded border border-gray-300 shadow-inner"
                         style="background-color: ${currentValue};">
                    </div>
                `;
            }

            html += '</div>';

            // Hidden input for form submission
            html += `<input type="hidden" id="${fieldId}_input" name="${escapeHtml(options.name || fieldId)}" value="${currentValue}">`;

            // Preset colors - only render valid hex colors
            if (Array.isArray(presets) && presets.length > 0) {
                const validPresets = (Array.isArray(presets) ? presets : []).map(p => normalizeHex(p)).filter(p => isValidHex(p));
                if (validPresets.length > 0) {
                    html += `
                        <div class="flex flex-wrap gap-1 mt-3">
                            <span class="text-xs text-gray-400 w-full mb-1">Quick colors:</span>
                    `;
                    for (const normalized of validPresets) {
                        html += `
                            <button type="button"
                                    ${disabled ? 'disabled' : ''}
                                    data-color="${escapeHtml(normalized)}"
                                    onclick="window.LEDMatrixWidgets.getHandlers('color-picker').onPresetClick('${fieldId}', this.dataset.color)"
                                    class="w-6 h-6 rounded border border-gray-300 hover:scale-110 transition-transform ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}"
                                    style="background-color: ${escapeHtml(normalized)};"
                                    title="${escapeHtml(normalized)}">
                            </button>
                        `;
                    }
                    html += '</div>';
                }
            }

            // Error message area
            html += `<div id="${fieldId}_error" class="text-sm text-red-600 mt-1 hidden"></div>`;

            html += '</div>';

            container.innerHTML = html;
        },

        getValue: function(fieldId) {
            const safeId = sanitizeId(fieldId);
            const input = document.getElementById(`${safeId}_input`);
            return input ? input.value : '';
        },

        setValue: function(fieldId, value) {
            const safeId = sanitizeId(fieldId);
            const sanitized = sanitizeHex(value);

            const colorInput = document.getElementById(`${safeId}_color`);
            const hexInput = document.getElementById(`${safeId}_hex`);
            const preview = document.getElementById(`${safeId}_preview`);
            const hidden = document.getElementById(`${safeId}_input`);

            if (colorInput) colorInput.value = sanitized;
            if (hexInput) hexInput.value = sanitized.substring(1);
            if (preview) preview.style.backgroundColor = sanitized;
            if (hidden) hidden.value = sanitized;
        },

        handlers: {
            onColorChange: function(fieldId) {
                const safeId = sanitizeId(fieldId);
                const colorInput = document.getElementById(`${safeId}_color`);
                const value = sanitizeHex(colorInput?.value);

                const widget = window.LEDMatrixWidgets.get('color-picker');
                widget.setValue(fieldId, value);
                triggerChange(fieldId, value);
            },

            onHexChange: function(fieldId) {
                const safeId = sanitizeId(fieldId);
                const hexInput = document.getElementById(`${safeId}_hex`);
                const errorEl = document.getElementById(`${safeId}_error`);

                const rawValue = '#' + (hexInput?.value || '000000');
                const normalized = normalizeHex(rawValue);

                if (!isValidHex(normalized)) {
                    if (errorEl) {
                        errorEl.textContent = 'Invalid hex color';
                        errorEl.classList.remove('hidden');
                    }
                    return;
                }

                if (errorEl) {
                    errorEl.classList.add('hidden');
                }

                // Use sanitized value for setting
                const sanitized = sanitizeHex(normalized);
                const widget = window.LEDMatrixWidgets.get('color-picker');
                widget.setValue(fieldId, sanitized);
                triggerChange(fieldId, sanitized);
            },

            onHexInput: function(fieldId) {
                const safeId = sanitizeId(fieldId);
                const hexInput = document.getElementById(`${safeId}_hex`);

                if (hexInput) {
                    // Filter to only valid hex characters
                    hexInput.value = hexInput.value.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
                }
            },

            onPresetClick: function(fieldId, color) {
                const sanitized = sanitizeHex(color);
                const widget = window.LEDMatrixWidgets.get('color-picker');
                widget.setValue(fieldId, sanitized);
                triggerChange(fieldId, sanitized);
            }
        }
    });

    console.log('[ColorPickerWidget] Color picker widget registered');
})();


/* === custom-feeds.js === */
/**
 * Custom Feeds Widget
 * 
 * Handles table-based RSS feed editor with logo uploads.
 * Allows adding, removing, and editing custom RSS feed entries.
 * 
 * @module CustomFeedsWidget
 */

(function() {
    'use strict';

    // Ensure LEDMatrixWidgets registry exists
    if (typeof window.LEDMatrixWidgets === 'undefined') {
        console.error('[CustomFeedsWidget] LEDMatrixWidgets registry not found. Load registry.js first.');
        return;
    }

    /**
     * Register the custom-feeds widget
     */
    window.LEDMatrixWidgets.register('custom-feeds', {
        name: 'Custom Feeds Widget',
        version: '1.0.0',
        
        /**
         * Render the custom feeds widget
         * Note: This widget is currently server-side rendered via Jinja2 template.
         * This registration ensures the handlers are available globally.
         */
        render: function(container, config, value, options) {
            // For now, widgets are server-side rendered
            // This function is a placeholder for future client-side rendering
            console.log('[CustomFeedsWidget] Render called (server-side rendered)');
        },
        
        /**
         * Get current value from widget
         * @param {string} fieldId - Field ID
         * @returns {Array} Array of feed objects
         */
        getValue: function(fieldId) {
            const tbody = document.getElementById(`${fieldId}_tbody`);
            if (!tbody) return [];
            
            const rows = tbody.querySelectorAll('.custom-feed-row');
            const feeds = [];
            
            rows.forEach((row, index) => {
                const nameInput = row.querySelector('input[name*=".name"]');
                const urlInput = row.querySelector('input[name*=".url"]');
                const enabledInput = row.querySelector('input[name*=".enabled"]');
                const logoPathInput = row.querySelector('input[name*=".logo.path"]');
                const logoIdInput = row.querySelector('input[name*=".logo.id"]');
                
                if (nameInput && urlInput) {
                    feeds.push({
                        name: nameInput.value,
                        url: urlInput.value,
                        enabled: enabledInput ? enabledInput.checked : true,
                        logo: logoPathInput || logoIdInput ? {
                            path: logoPathInput ? logoPathInput.value : '',
                            id: logoIdInput ? logoIdInput.value : ''
                        } : null
                    });
                }
            });
            
            return feeds;
        },
        
        /**
         * Set value in widget
         * @param {string} fieldId - Field ID
         * @param {Array} feeds - Array of feed objects
         * @param {Object} options - Options containing fullKey and pluginId
         */
        setValue: function(fieldId, feeds, options) {
            if (!Array.isArray(feeds)) {
                console.error('[CustomFeedsWidget] setValue expects an array');
                return;
            }
            
            // Throw NotImplementedError if options are missing (defensive approach)
            if (!options || !options.fullKey || !options.pluginId) {
                throw new Error('CustomFeedsWidget.setValue not implemented: requires options.fullKey and options.pluginId');
            }
            
            const tbody = document.getElementById(`${fieldId}_tbody`);
            if (!tbody) {
                console.warn(`[CustomFeedsWidget] tbody not found for fieldId: ${fieldId}`);
                return;
            }
            
            // Clear existing rows immediately before appending new ones
            tbody.innerHTML = '';
            
            // Build rows for each feed using the same logic as addCustomFeedRow
            feeds.forEach((feed, index) => {
                const fullKey = options.fullKey;
                const pluginId = options.pluginId;
                
                const newRow = document.createElement('tr');
                newRow.className = 'custom-feed-row';
                newRow.setAttribute('data-index', index);
                
                // Create name cell
                const nameCell = document.createElement('td');
                nameCell.className = 'px-4 py-3 whitespace-nowrap';
                const nameInput = document.createElement('input');
                nameInput.type = 'text';
                nameInput.name = `${fullKey}.${index}.name`;
                nameInput.value = feed.name || '';
                nameInput.className = 'block w-full px-2 py-1 border border-gray-300 rounded text-sm';
                nameInput.placeholder = 'Feed Name';
                nameInput.required = true;
                nameCell.appendChild(nameInput);
                
                // Create URL cell
                const urlCell = document.createElement('td');
                urlCell.className = 'px-4 py-3 whitespace-nowrap';
                const urlInput = document.createElement('input');
                urlInput.type = 'url';
                urlInput.name = `${fullKey}.${index}.url`;
                urlInput.value = feed.url || '';
                urlInput.className = 'block w-full px-2 py-1 border border-gray-300 rounded text-sm';
                urlInput.placeholder = 'https://example.com/feed';
                urlInput.required = true;
                urlCell.appendChild(urlInput);
                
                // Create logo cell
                const logoCell = document.createElement('td');
                logoCell.className = 'px-4 py-3 whitespace-nowrap';
                const logoContainer = document.createElement('div');
                logoContainer.className = 'flex items-center space-x-2';
                
                const fileInput = document.createElement('input');
                fileInput.type = 'file';
                fileInput.id = `${fieldId}_logo_${index}`;
                fileInput.accept = 'image/png,image/jpeg,image/bmp,image/gif';
                fileInput.style.display = 'none';
                fileInput.dataset.index = String(index);
                fileInput.addEventListener('change', function(e) {
                    const idx = parseInt(e.target.dataset.index || '0', 10);
                    handleCustomFeedLogoUpload(e, fieldId, idx, pluginId, fullKey);
                });
                
                const uploadButton = document.createElement('button');
                uploadButton.type = 'button';
                uploadButton.className = 'px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded';
                uploadButton.addEventListener('click', function() {
                    fileInput.click();
                });
                const uploadIcon = document.createElement('i');
                uploadIcon.className = 'fas fa-upload mr-1';
                uploadButton.appendChild(uploadIcon);
                uploadButton.appendChild(document.createTextNode(' Upload'));
                
                if (feed.logo && feed.logo.path) {
                    const img = document.createElement('img');
                    img.src = feed.logo.path;
                    img.alt = 'Logo';
                    img.className = 'w-8 h-8 object-cover rounded border';
                    img.id = `${fieldId}_logo_preview_${index}`;
                    logoContainer.appendChild(img);
                    
                    // Create hidden inputs for logo data
                    const pathInput = document.createElement('input');
                    pathInput.type = 'hidden';
                    pathInput.name = `${fullKey}.${index}.logo.path`;
                    pathInput.value = feed.logo.path;
                    logoContainer.appendChild(pathInput);
                    
                    if (feed.logo.id) {
                        const idInput = document.createElement('input');
                        idInput.type = 'hidden';
                        idInput.name = `${fullKey}.${index}.logo.id`;
                        idInput.value = String(feed.logo.id);
                        logoContainer.appendChild(idInput);
                    }
                } else {
                    const noLogoSpan = document.createElement('span');
                    noLogoSpan.className = 'text-xs text-gray-400';
                    noLogoSpan.textContent = 'No logo';
                    logoContainer.appendChild(noLogoSpan);
                }
                
                logoContainer.appendChild(fileInput);
                logoContainer.appendChild(uploadButton);
                logoCell.appendChild(logoContainer);
                
                // Create enabled cell
                const enabledCell = document.createElement('td');
                enabledCell.className = 'px-4 py-3 whitespace-nowrap text-center';
                const enabledInput = document.createElement('input');
                enabledInput.type = 'checkbox';
                enabledInput.name = `${fullKey}.${index}.enabled`;
                enabledInput.checked = feed.enabled !== false;
                enabledInput.value = 'true';
                enabledInput.className = 'h-4 w-4 text-blue-600';
                enabledCell.appendChild(enabledInput);
                
                // Create remove cell
                const removeCell = document.createElement('td');
                removeCell.className = 'px-4 py-3 whitespace-nowrap text-center';
                const removeButton = document.createElement('button');
                removeButton.type = 'button';
                removeButton.className = 'text-red-600 hover:text-red-800 px-2 py-1';
                removeButton.addEventListener('click', function() {
                    removeCustomFeedRow(this);
                });
                const removeIcon = document.createElement('i');
                removeIcon.className = 'fas fa-trash';
                removeButton.appendChild(removeIcon);
                removeCell.appendChild(removeButton);
                
                // Append all cells to row
                newRow.appendChild(nameCell);
                newRow.appendChild(urlCell);
                newRow.appendChild(logoCell);
                newRow.appendChild(enabledCell);
                newRow.appendChild(removeCell);
                tbody.appendChild(newRow);
            });
        },
        
        handlers: {
            // Handlers are attached to window for backwards compatibility
        }
    });

    /**
     * Add a new custom feed row to the table
     * @param {string} fieldId - Field ID
     * @param {string} fullKey - Full field key (e.g., "feeds.custom_feeds")
     * @param {number} maxItems - Maximum number of items allowed
     * @param {string} pluginId - Plugin ID
     */
    window.addCustomFeedRow = function(fieldId, fullKey, maxItems, pluginId) {
        const tbody = document.getElementById(fieldId + '_tbody');
        if (!tbody) return;
        
        const currentRows = tbody.querySelectorAll('.custom-feed-row');
        if (currentRows.length >= maxItems) {
            const notifyFn = window.showNotification || alert;
            notifyFn(`Maximum ${maxItems} feeds allowed`, 'error');
            return;
        }
        
        const newIndex = currentRows.length;
        const newRow = document.createElement('tr');
        newRow.className = 'custom-feed-row';
        newRow.setAttribute('data-index', newIndex);
        
        // Create name cell
        const nameCell = document.createElement('td');
        nameCell.className = 'px-4 py-3 whitespace-nowrap';
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.name = `${fullKey}.${newIndex}.name`;
        nameInput.value = '';
        nameInput.className = 'block w-full px-2 py-1 border border-gray-300 rounded text-sm';
        nameInput.placeholder = 'Feed Name';
        nameInput.required = true;
        nameCell.appendChild(nameInput);
        
        // Create URL cell
        const urlCell = document.createElement('td');
        urlCell.className = 'px-4 py-3 whitespace-nowrap';
        const urlInput = document.createElement('input');
        urlInput.type = 'url';
        urlInput.name = `${fullKey}.${newIndex}.url`;
        urlInput.value = '';
        urlInput.className = 'block w-full px-2 py-1 border border-gray-300 rounded text-sm';
        urlInput.placeholder = 'https://example.com/feed';
        urlInput.required = true;
        urlCell.appendChild(urlInput);
        
        // Create logo cell
        const logoCell = document.createElement('td');
        logoCell.className = 'px-4 py-3 whitespace-nowrap';
        const logoContainer = document.createElement('div');
        logoContainer.className = 'flex items-center space-x-2';
        
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.id = `${fieldId}_logo_${newIndex}`;
        fileInput.accept = 'image/png,image/jpeg,image/bmp,image/gif';
        fileInput.style.display = 'none';
        fileInput.dataset.index = String(newIndex);
        fileInput.addEventListener('change', function(e) {
            const idx = parseInt(e.target.dataset.index || '0', 10);
            handleCustomFeedLogoUpload(e, fieldId, idx, pluginId, fullKey);
        });
        
        const uploadButton = document.createElement('button');
        uploadButton.type = 'button';
        uploadButton.className = 'px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded';
        uploadButton.addEventListener('click', function() {
            fileInput.click();
        });
        const uploadIcon = document.createElement('i');
        uploadIcon.className = 'fas fa-upload mr-1';
        uploadButton.appendChild(uploadIcon);
        uploadButton.appendChild(document.createTextNode(' Upload'));
        
        const noLogoSpan = document.createElement('span');
        noLogoSpan.className = 'text-xs text-gray-400';
        noLogoSpan.textContent = 'No logo';
        
        logoContainer.appendChild(fileInput);
        logoContainer.appendChild(uploadButton);
        logoContainer.appendChild(noLogoSpan);
        logoCell.appendChild(logoContainer);
        
        // Create enabled cell
        const enabledCell = document.createElement('td');
        enabledCell.className = 'px-4 py-3 whitespace-nowrap text-center';
        const enabledInput = document.createElement('input');
        enabledInput.type = 'checkbox';
        enabledInput.name = `${fullKey}.${newIndex}.enabled`;
        enabledInput.checked = true;
        enabledInput.value = 'true';
        enabledInput.className = 'h-4 w-4 text-blue-600';
        enabledCell.appendChild(enabledInput);
        
        // Create remove cell
        const removeCell = document.createElement('td');
        removeCell.className = 'px-4 py-3 whitespace-nowrap text-center';
        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.className = 'text-red-600 hover:text-red-800 px-2 py-1';
        removeButton.addEventListener('click', function() {
            removeCustomFeedRow(this);
        });
        const removeIcon = document.createElement('i');
        removeIcon.className = 'fas fa-trash';
        removeButton.appendChild(removeIcon);
        removeCell.appendChild(removeButton);
        
        // Append all cells to row
        newRow.appendChild(nameCell);
        newRow.appendChild(urlCell);
        newRow.appendChild(logoCell);
        newRow.appendChild(enabledCell);
        newRow.appendChild(removeCell);
        tbody.appendChild(newRow);
    };
    
    /**
     * Remove a custom feed row from the table
     * @param {HTMLElement} button - The remove button element
     */
    window.removeCustomFeedRow = function(button) {
        const row = button.closest('tr');
        if (!row) return;
        
        if (confirm('Remove this feed?')) {
            const tbody = row.parentElement;
            if (!tbody) return;
            
            row.remove();
            
            // Re-index remaining rows
            const rows = tbody.querySelectorAll('.custom-feed-row');
            rows.forEach((r, index) => {
                const oldIndex = r.getAttribute('data-index');
                r.setAttribute('data-index', index);
                // Update all input names with new index
                r.querySelectorAll('input, button').forEach(input => {
                    const name = input.getAttribute('name');
                    if (name) {
                        // Replace pattern like "feeds.custom_feeds.0.name" with "feeds.custom_feeds.1.name"
                        input.setAttribute('name', name.replace(/\.\d+\./, `.${index}.`));
                    }
                    const id = input.id;
                    if (id) {
                        // Keep IDs aligned after reindex
                        input.id = id
                            .replace(/_logo_preview_\d+$/, `_logo_preview_${index}`)
                            .replace(/_logo_\d+$/, `_logo_${index}`);
                    }
                    // Keep dataset index aligned
                    if (input.dataset && 'index' in input.dataset) {
                        input.dataset.index = String(index);
                    }
                });
            });
        }
    };
    
    /**
     * Handle custom feed logo upload
     * @param {Event} event - File input change event
     * @param {string} fieldId - Field ID
     * @param {number} index - Feed row index
     * @param {string} pluginId - Plugin ID
     * @param {string} fullKey - Full field key
     */
    window.handleCustomFeedLogoUpload = function(event, fieldId, index, pluginId, fullKey) {
        const file = event.target.files[0];
        if (!file) return;
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('plugin_id', pluginId);
        
        fetch('/api/v3/plugins/assets/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            // Check HTTP status before parsing JSON
            if (!response.ok) {
                return response.text().then(text => {
                    throw new Error(`Upload failed: ${response.status} ${response.statusText}${text ? ': ' + text : ''}`);
                });
            }
            return response.json();
        })
        .then(data => {
            if (data.status === 'success' && data.data && data.data.files && data.data.files.length > 0) {
                const uploadedFile = data.data.files[0];
                const row = document.querySelector(`#${fieldId}_tbody tr[data-index="${index}"]`);
                if (row) {
                    const logoCell = row.querySelector('td:nth-child(3)');
                    const existingPathInput = logoCell.querySelector('input[name*=".logo.path"]');
                    const existingIdInput = logoCell.querySelector('input[name*=".logo.id"]');
                    const pathName = existingPathInput ? existingPathInput.name : `${fullKey}.${index}.logo.path`;
                    const idName = existingIdInput ? existingIdInput.name : `${fullKey}.${index}.logo.id`;
                    
                    // Normalize path: remove leading slashes, then add single leading slash
                    const normalizedPath = String(uploadedFile.path || '').replace(/^\/+/, '');
                    const imageSrc = '/' + normalizedPath;
                    
                    // Clear logoCell and build DOM safely to prevent XSS
                    logoCell.textContent = ''; // Clear existing content
                    
                    // Create container div
                    const container = document.createElement('div');
                    container.className = 'flex items-center space-x-2';
                    
                    // Create file input
                    const fileInput = document.createElement('input');
                    fileInput.type = 'file';
                    fileInput.id = `${fieldId}_logo_${index}`;
                    fileInput.accept = 'image/png,image/jpeg,image/bmp,image/gif';
                    fileInput.style.display = 'none';
                    fileInput.dataset.index = String(index);
                    fileInput.addEventListener('change', function(e) {
                        const idx = parseInt(e.target.dataset.index || '0', 10);
                        handleCustomFeedLogoUpload(e, fieldId, idx, pluginId, fullKey);
                    });
                    
                    // Create upload button
                    const uploadButton = document.createElement('button');
                    uploadButton.type = 'button';
                    uploadButton.className = 'px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded';
                    uploadButton.addEventListener('click', function() {
                        fileInput.click();
                    });
                    const uploadIcon = document.createElement('i');
                    uploadIcon.className = 'fas fa-upload mr-1';
                    uploadButton.appendChild(uploadIcon);
                    uploadButton.appendChild(document.createTextNode(' Upload'));
                    
                    // Create img element
                    const img = document.createElement('img');
                    img.src = imageSrc;
                    img.alt = 'Logo';
                    img.className = 'w-8 h-8 object-cover rounded border';
                    img.id = `${fieldId}_logo_preview_${index}`;
                    
                    // Create hidden input for path
                    const pathInput = document.createElement('input');
                    pathInput.type = 'hidden';
                    pathInput.name = pathName;
                    pathInput.value = imageSrc;
                    
                    // Create hidden input for id
                    const idInput = document.createElement('input');
                    idInput.type = 'hidden';
                    idInput.name = idName;
                    idInput.value = String(uploadedFile.id);
                    
                    // Append all elements to container
                    container.appendChild(fileInput);
                    container.appendChild(uploadButton);
                    container.appendChild(img);
                    container.appendChild(pathInput);
                    container.appendChild(idInput);
                    
                    // Append container to logoCell
                    logoCell.appendChild(container);
                }
                // Allow re-uploading the same file
                event.target.value = '';
            } else {
                const notifyFn = window.showNotification || alert;
                notifyFn('Upload failed: ' + (data.message || 'Unknown error'), 'error');
            }
        })
        .catch(error => {
            console.error('Upload error:', error);
            const notifyFn = window.showNotification || alert;
            notifyFn('Upload failed: ' + error.message, 'error');
        });
    };

    console.log('[CustomFeedsWidget] Custom feeds widget registered');
})();


/* === date-picker.js === */
/**
 * LEDMatrix Date Picker Widget
 *
 * Date selection with optional min/max constraints.
 *
 * Schema example:
 * {
 *   "startDate": {
 *     "type": "string",
 *     "format": "date",
 *     "x-widget": "date-picker",
 *     "x-options": {
 *       "min": "2024-01-01",
 *       "max": "2025-12-31",
 *       "placeholder": "Select date",
 *       "clearable": true
 *     }
 *   }
 * }
 *
 * @module DatePickerWidget
 */

(function() {
    'use strict';

    const base = window.BaseWidget ? new window.BaseWidget('DatePicker', '1.0.0') : null;

    function escapeHtml(text) {
        if (base) return base.escapeHtml(text);
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function sanitizeId(id) {
        if (base) return base.sanitizeId(id);
        return String(id).replace(/[^a-zA-Z0-9_-]/g, '_');
    }

    function triggerChange(fieldId, value) {
        if (base) {
            base.triggerChange(fieldId, value);
        } else {
            const event = new CustomEvent('widget-change', {
                detail: { fieldId, value },
                bubbles: true,
                cancelable: true
            });
            document.dispatchEvent(event);
        }
    }

    window.LEDMatrixWidgets.register('date-picker', {
        name: 'Date Picker Widget',
        version: '1.0.0',

        render: function(container, config, value, options) {
            const fieldId = sanitizeId(options.fieldId || container.id || 'date_picker');
            const xOptions = config['x-options'] || config['x_options'] || {};
            const min = xOptions.min || config.minimum || '';
            const max = xOptions.max || config.maximum || '';
            const placeholder = xOptions.placeholder || '';
            const clearable = xOptions.clearable === true;
            const disabled = xOptions.disabled === true;
            const required = xOptions.required === true;

            const currentValue = value || '';

            let html = `<div id="${fieldId}_widget" class="date-picker-widget" data-field-id="${fieldId}">`;

            html += '<div class="flex items-center">';

            html += `
                <div class="relative flex-1">
                    <input type="date"
                           id="${fieldId}_input"
                           name="${escapeHtml(options.name || fieldId)}"
                           value="${escapeHtml(currentValue)}"
                           ${min ? `min="${escapeHtml(min)}"` : ''}
                           ${max ? `max="${escapeHtml(max)}"` : ''}
                           ${placeholder ? `placeholder="${escapeHtml(placeholder)}"` : ''}
                           ${disabled ? 'disabled' : ''}
                           ${required ? 'required' : ''}
                           onchange="window.LEDMatrixWidgets.getHandlers('date-picker').onChange('${fieldId}')"
                           class="form-input w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'} text-black pr-10">
                    <div class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                        <i class="fas fa-calendar-alt text-gray-400"></i>
                    </div>
                </div>
            `;

            if (clearable && !disabled) {
                html += `
                    <button type="button"
                            id="${fieldId}_clear"
                            onclick="window.LEDMatrixWidgets.getHandlers('date-picker').onClear('${fieldId}')"
                            class="ml-2 inline-flex items-center px-2 py-2 text-gray-400 hover:text-gray-600 ${currentValue ? '' : 'hidden'}"
                            title="Clear">
                        <i class="fas fa-times"></i>
                    </button>
                `;
            }

            html += '</div>';

            // Date constraint info
            if (min || max) {
                let constraintText = '';
                if (min && max) {
                    constraintText = `${min} to ${max}`;
                } else if (min) {
                    constraintText = `From ${min}`;
                } else {
                    constraintText = `Until ${max}`;
                }
                html += `<div class="text-xs text-gray-400 mt-1">${escapeHtml(constraintText)}</div>`;
            }

            // Error message area
            html += `<div id="${fieldId}_error" class="text-sm text-red-600 mt-1 hidden"></div>`;

            html += '</div>';

            container.innerHTML = html;
        },

        getValue: function(fieldId) {
            const safeId = sanitizeId(fieldId);
            const input = document.getElementById(`${safeId}_input`);
            return input ? input.value : '';
        },

        setValue: function(fieldId, value) {
            const safeId = sanitizeId(fieldId);
            const input = document.getElementById(`${safeId}_input`);
            const clearBtn = document.getElementById(`${safeId}_clear`);

            if (input) {
                input.value = value || '';
            }
            if (clearBtn) {
                clearBtn.classList.toggle('hidden', !value);
            }
        },

        validate: function(fieldId) {
            const safeId = sanitizeId(fieldId);
            const input = document.getElementById(`${safeId}_input`);
            const errorEl = document.getElementById(`${safeId}_error`);

            if (!input) return { valid: true, errors: [] };

            const isValid = input.checkValidity();

            if (errorEl) {
                if (!isValid) {
                    errorEl.textContent = input.validationMessage;
                    errorEl.classList.remove('hidden');
                    input.classList.add('border-red-500');
                } else {
                    errorEl.classList.add('hidden');
                    input.classList.remove('border-red-500');
                }
            }

            return { valid: isValid, errors: isValid ? [] : [input.validationMessage] };
        },

        handlers: {
            onChange: function(fieldId) {
                const widget = window.LEDMatrixWidgets.get('date-picker');
                const safeId = sanitizeId(fieldId);
                const clearBtn = document.getElementById(`${safeId}_clear`);
                const value = widget.getValue(fieldId);

                if (clearBtn) {
                    clearBtn.classList.toggle('hidden', !value);
                }

                widget.validate(fieldId);
                triggerChange(fieldId, value);
            },

            onClear: function(fieldId) {
                const widget = window.LEDMatrixWidgets.get('date-picker');
                widget.setValue(fieldId, '');
                triggerChange(fieldId, '');
            }
        }
    });

    console.log('[DatePickerWidget] Date picker widget registered');
})();


/* === day-selector.js === */
/**
 * LEDMatrix Day Selector Widget
 *
 * Reusable checkbox group for selecting days of the week.
 * Can be used by any plugin via x-widget: "day-selector" in their schema.
 *
 * Schema example:
 * {
 *   "active_days": {
 *     "type": "array",
 *     "x-widget": "day-selector",
 *     "items": { "enum": ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] },
 *     "x-options": {
 *       "format": "short",      // "short" (Mon) or "long" (Monday)
 *       "layout": "horizontal", // "horizontal" or "vertical"
 *       "selectAll": true       // Show "Select All" toggle
 *     }
 *   }
 * }
 *
 * @module DaySelectorWidget
 */

(function() {
    'use strict';

    const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    const DAY_LABELS = {
        short: {
            monday: 'Mon',
            tuesday: 'Tue',
            wednesday: 'Wed',
            thursday: 'Thu',
            friday: 'Fri',
            saturday: 'Sat',
            sunday: 'Sun'
        },
        long: {
            monday: 'Monday',
            tuesday: 'Tuesday',
            wednesday: 'Wednesday',
            thursday: 'Thursday',
            friday: 'Friday',
            saturday: 'Saturday',
            sunday: 'Sunday'
        }
    };

    // Use BaseWidget utilities if available
    const base = window.BaseWidget ? new window.BaseWidget('DaySelector', '1.0.0') : null;

    function escapeHtml(text) {
        if (base) return base.escapeHtml(text);
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function sanitizeId(id) {
        if (base) return base.sanitizeId(id);
        return String(id).replace(/[^a-zA-Z0-9_-]/g, '_');
    }

    function triggerChange(fieldId, value) {
        if (base) {
            base.triggerChange(fieldId, value);
        } else {
            const event = new CustomEvent('widget-change', {
                detail: { fieldId, value },
                bubbles: true,
                cancelable: true
            });
            document.dispatchEvent(event);
        }
    }

    window.LEDMatrixWidgets.register('day-selector', {
        name: 'Day Selector Widget',
        version: '1.0.0',

        /**
         * Render the day selector widget
         * @param {HTMLElement} container - Container element
         * @param {Object} config - Schema configuration
         * @param {Array} value - Array of selected day names
         * @param {Object} options - Additional options (fieldId, pluginId)
         */
        render: function(container, config, value, options) {
            const fieldId = sanitizeId(options.fieldId || container.id || 'day_selector');
            const xOptions = config['x-options'] || config['x_options'] || {};
            const requestedFormat = xOptions.format || 'long';
            // Validate format exists in DAY_LABELS, default to 'long' if not
            const format = DAY_LABELS.hasOwnProperty(requestedFormat) ? requestedFormat : 'long';
            const layout = xOptions.layout || 'horizontal';
            const showSelectAll = xOptions.selectAll !== false;

            // Normalize value to array and filter to only valid days
            const rawDays = Array.isArray(value) ? value : [];
            const selectedDays = rawDays.filter(day => DAYS.includes(day));
            const inputName = options.name || fieldId;

            // Build HTML
            let html = `<div id="${fieldId}_widget" class="day-selector-widget" data-field-id="${fieldId}">`;

            // Hidden input to store the value as JSON array
            // Note: Using single quotes for attribute, JSON uses double quotes, so no escaping needed
            html += `<input type="hidden" id="${fieldId}_data" name="${escapeHtml(inputName)}" value='${JSON.stringify(selectedDays)}'>`;

            // Select All toggle
            if (showSelectAll) {
                const allSelected = selectedDays.length === DAYS.length;
                html += `
                    <div class="mb-2">
                        <label class="inline-flex items-center cursor-pointer">
                            <input type="checkbox"
                                   id="${fieldId}_select_all"
                                   ${allSelected ? 'checked' : ''}
                                   onchange="window.LEDMatrixWidgets.getHandlers('day-selector').onSelectAll('${fieldId}', this.checked)"
                                   class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded">
                            <span class="ml-2 text-sm font-medium text-gray-700">Select All</span>
                        </label>
                    </div>
                `;
            }

            // Day checkboxes
            const containerClass = layout === 'horizontal'
                ? 'flex flex-wrap gap-3'
                : 'space-y-2';

            html += `<div class="${containerClass}">`;

            // Get the validated label map (guaranteed to exist due to format validation above)
            const labelMap = DAY_LABELS[format] || DAY_LABELS.long;

            for (const day of DAYS) {
                const isChecked = selectedDays.includes(day);
                const label = labelMap[day] || day;

                html += `
                    <label class="inline-flex items-center cursor-pointer">
                        <input type="checkbox"
                               id="${fieldId}_${day}"
                               data-day="${day}"
                               ${isChecked ? 'checked' : ''}
                               onchange="window.LEDMatrixWidgets.getHandlers('day-selector').onChange('${fieldId}')"
                               class="day-checkbox h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded">
                        <span class="ml-1 text-sm text-gray-700">${escapeHtml(label)}</span>
                    </label>
                `;
            }

            html += '</div></div>';

            container.innerHTML = html;
        },

        /**
         * Get current selected days
         * @param {string} fieldId - Field ID
         * @returns {Array} Array of selected day names
         */
        getValue: function(fieldId) {
            const safeId = sanitizeId(fieldId);
            const widget = document.getElementById(`${safeId}_widget`);
            if (!widget) return [];

            const selectedDays = [];
            const checkboxes = widget.querySelectorAll('.day-checkbox:checked');
            checkboxes.forEach(cb => {
                selectedDays.push(cb.dataset.day);
            });

            return selectedDays;
        },

        /**
         * Set selected days
         * @param {string} fieldId - Field ID
         * @param {Array} days - Array of day names to select
         */
        setValue: function(fieldId, days) {
            const safeId = sanitizeId(fieldId);
            const widget = document.getElementById(`${safeId}_widget`);
            if (!widget) return;

            // Filter to only valid days
            const rawDays = Array.isArray(days) ? days : [];
            const selectedDays = rawDays.filter(day => DAYS.includes(day));

            // Update checkboxes
            DAYS.forEach(day => {
                const checkbox = document.getElementById(`${safeId}_${day}`);
                if (checkbox) {
                    checkbox.checked = selectedDays.includes(day);
                }
            });

            // Update hidden input
            const hiddenInput = document.getElementById(`${safeId}_data`);
            if (hiddenInput) {
                hiddenInput.value = JSON.stringify(selectedDays);
            }

            // Update select all checkbox
            const selectAllCheckbox = document.getElementById(`${safeId}_select_all`);
            if (selectAllCheckbox) {
                selectAllCheckbox.checked = selectedDays.length === DAYS.length;
            }
        },

        handlers: {
            /**
             * Handle individual day checkbox change
             * @param {string} fieldId - Field ID
             */
            onChange: function(fieldId) {
                const widget = window.LEDMatrixWidgets.get('day-selector');
                const selectedDays = widget.getValue(fieldId);

                // Update hidden input
                const safeId = sanitizeId(fieldId);
                const hiddenInput = document.getElementById(`${safeId}_data`);
                if (hiddenInput) {
                    hiddenInput.value = JSON.stringify(selectedDays);
                }

                // Update select all checkbox state
                const selectAllCheckbox = document.getElementById(`${safeId}_select_all`);
                if (selectAllCheckbox) {
                    selectAllCheckbox.checked = selectedDays.length === DAYS.length;
                }

                // Trigger change event
                triggerChange(fieldId, selectedDays);
            },

            /**
             * Handle select all toggle
             * @param {string} fieldId - Field ID
             * @param {boolean} selectAll - Whether to select all
             */
            onSelectAll: function(fieldId, selectAll) {
                const widget = window.LEDMatrixWidgets.get('day-selector');
                widget.setValue(fieldId, selectAll ? DAYS.slice() : []);

                // Trigger change event
                triggerChange(fieldId, selectAll ? DAYS.slice() : []);
            }
        }
    });

    // Expose DAYS constant for external use
    window.LEDMatrixWidgets.get('day-selector').DAYS = DAYS;
    window.LEDMatrixWidgets.get('day-selector').DAY_LABELS = DAY_LABELS;

    console.log('[DaySelectorWidget] Day selector widget registered');
})();


/* === email-input.js === */
/**
 * LEDMatrix Email Input Widget
 *
 * Email input with validation and common domain suggestions.
 *
 * Schema example:
 * {
 *   "email": {
 *     "type": "string",
 *     "format": "email",
 *     "x-widget": "email-input",
 *     "x-options": {
 *       "placeholder": "user@example.com",
 *       "showIcon": true
 *     }
 *   }
 * }
 *
 * @module EmailInputWidget
 */

(function() {
    'use strict';

    const base = window.BaseWidget ? new window.BaseWidget('EmailInput', '1.0.0') : null;

    function escapeHtml(text) {
        if (base) return base.escapeHtml(text);
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function sanitizeId(id) {
        if (base) return base.sanitizeId(id);
        return String(id).replace(/[^a-zA-Z0-9_-]/g, '_');
    }

    function triggerChange(fieldId, value) {
        if (base) {
            base.triggerChange(fieldId, value);
        } else {
            const event = new CustomEvent('widget-change', {
                detail: { fieldId, value },
                bubbles: true,
                cancelable: true
            });
            document.dispatchEvent(event);
        }
    }

    window.LEDMatrixWidgets.register('email-input', {
        name: 'Email Input Widget',
        version: '1.0.0',

        render: function(container, config, value, options) {
            const fieldId = sanitizeId(options.fieldId || container.id || 'email_input');
            const xOptions = config['x-options'] || config['x_options'] || {};
            const placeholder = xOptions.placeholder || 'email@example.com';
            const showIcon = xOptions.showIcon !== false;
            const disabled = xOptions.disabled === true;
            const required = xOptions.required === true;

            const currentValue = value || '';

            let html = `<div id="${fieldId}_widget" class="email-input-widget" data-field-id="${fieldId}">`;

            html += '<div class="relative">';

            if (showIcon) {
                html += `
                    <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <i class="fas fa-envelope text-gray-400"></i>
                    </div>
                `;
            }

            html += `
                <input type="email"
                       id="${fieldId}_input"
                       name="${escapeHtml(options.name || fieldId)}"
                       value="${escapeHtml(currentValue)}"
                       placeholder="${escapeHtml(placeholder)}"
                       ${disabled ? 'disabled' : ''}
                       ${required ? 'required' : ''}
                       onchange="window.LEDMatrixWidgets.getHandlers('email-input').onChange('${fieldId}')"
                       oninput="window.LEDMatrixWidgets.getHandlers('email-input').onInput('${fieldId}')"
                       class="form-input w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 ${showIcon ? 'pl-10' : ''} ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'} text-black placeholder:text-gray-400">
            `;

            html += '</div>';

            // Validation indicator
            html += `
                <div id="${fieldId}_valid" class="text-sm text-green-600 mt-1 hidden">
                    <i class="fas fa-check-circle mr-1"></i>Valid email format
                </div>
            `;

            // Error message area
            html += `<div id="${fieldId}_error" class="text-sm text-red-600 mt-1 hidden"></div>`;

            html += '</div>';

            container.innerHTML = html;
        },

        getValue: function(fieldId) {
            const safeId = sanitizeId(fieldId);
            const input = document.getElementById(`${safeId}_input`);
            return input ? input.value : '';
        },

        setValue: function(fieldId, value) {
            const safeId = sanitizeId(fieldId);
            const input = document.getElementById(`${safeId}_input`);
            if (input) {
                input.value = value || '';
                this.handlers.onInput(fieldId);
            }
        },

        validate: function(fieldId) {
            const safeId = sanitizeId(fieldId);
            const input = document.getElementById(`${safeId}_input`);
            const errorEl = document.getElementById(`${safeId}_error`);
            const validEl = document.getElementById(`${safeId}_valid`);

            if (!input) return { valid: true, errors: [] };

            const value = input.value;
            const isValid = input.checkValidity() && (!value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));

            if (errorEl && validEl) {
                if (!isValid && value) {
                    errorEl.textContent = 'Please enter a valid email address';
                    errorEl.classList.remove('hidden');
                    validEl.classList.add('hidden');
                    input.classList.add('border-red-500');
                    input.classList.remove('border-green-500');
                } else if (isValid && value) {
                    errorEl.classList.add('hidden');
                    validEl.classList.remove('hidden');
                    input.classList.remove('border-red-500');
                    input.classList.add('border-green-500');
                } else {
                    errorEl.classList.add('hidden');
                    validEl.classList.add('hidden');
                    input.classList.remove('border-red-500', 'border-green-500');
                }
            }

            return { valid: isValid, errors: isValid ? [] : ['Invalid email format'] };
        },

        handlers: {
            onChange: function(fieldId) {
                const widget = window.LEDMatrixWidgets.get('email-input');
                widget.validate(fieldId);
                triggerChange(fieldId, widget.getValue(fieldId));
            },

            onInput: function(fieldId) {
                const widget = window.LEDMatrixWidgets.get('email-input');
                // Validate on input for real-time feedback
                widget.validate(fieldId);
            }
        }
    });

    console.log('[EmailInputWidget] Email input widget registered');
})();


/* === example-color-picker.js === */
/**
 * Example: Color Picker Widget
 * 
 * This is an example custom widget demonstrating how to create
 * a plugin-specific widget for the LEDMatrix system.
 * 
 * To use this widget:
 * 1. Copy this file to your plugin's widgets directory
 * 2. Reference it in your config_schema.json with "x-widget": "color-picker"
 * 3. The widget will be automatically loaded when the plugin config form is rendered
 * 
 * @module ColorPickerWidget
 */

(function() {
    'use strict';

    // Ensure LEDMatrixWidgets registry exists
    if (typeof window.LEDMatrixWidgets === 'undefined') {
        console.error('[ColorPickerWidget] LEDMatrixWidgets registry not found. Load registry.js first.');
        return;
    }

    /**
     * Register the color picker widget
     */
    window.LEDMatrixWidgets.register('color-picker', {
        name: 'Color Picker Widget',
        version: '1.0.0',
        
        /**
         * Render the color picker widget
         * @param {HTMLElement} container - Container element to render into
         * @param {Object} config - Widget configuration from schema
         * @param {string} value - Current color value (hex format)
         * @param {Object} options - Additional options
         */
        render: function(container, config, value, options) {
            const fieldId = options.fieldId || container.id.replace('_widget_container', '');
            let currentValue = value || config.default || '#000000';
            
            // Validate hex color format - use safe default if invalid
            const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
            if (!hexColorRegex.test(currentValue)) {
                currentValue = '#000000';
            }
            
            // Escape HTML to prevent XSS (for HTML contexts)
            const escapeHtml = (text) => {
                const div = document.createElement('div');
                div.textContent = text;
                return div.innerHTML;
            };
            
            // Use validated/sanitized hex for style attribute and input values
            const safeHex = currentValue; // Already validated above
            
            container.innerHTML = `
                <div class="color-picker-widget flex items-center space-x-3">
                    <div class="flex items-center space-x-2">
                        <label for="${escapeHtml(fieldId)}_color" class="text-sm text-gray-700">Color:</label>
                        <input type="color" 
                               id="${escapeHtml(fieldId)}_color" 
                               value="${safeHex}"
                               class="h-10 w-20 border border-gray-300 rounded cursor-pointer">
                    </div>
                    <div class="flex items-center space-x-2">
                        <label for="${escapeHtml(fieldId)}_hex" class="text-sm text-gray-700">Hex:</label>
                        <input type="text" 
                               id="${escapeHtml(fieldId)}_hex" 
                               value="${safeHex}"
                               pattern="^#[0-9A-Fa-f]{6}$"
                               maxlength="7"
                               class="px-3 py-2 border border-gray-300 rounded-md text-sm font-mono w-24"
                               placeholder="#000000">
                    </div>
                    <div class="flex-1">
                        <div id="${escapeHtml(fieldId)}_preview" 
                             class="h-10 w-full border border-gray-300 rounded"
                             style="background-color: ${safeHex}">
                        </div>
                    </div>
                </div>
                <p class="text-xs text-gray-500 mt-2">Select a color using the color picker or enter a hex code</p>
            `;
            
            // Get references to elements
            const colorInput = container.querySelector('input[type="color"]');
            const hexInput = container.querySelector('input[type="text"]');
            const preview = container.querySelector(`#${fieldId}_preview`);
            
            // Update hex when color picker changes
            colorInput.addEventListener('input', (e) => {
                const color = e.target.value;
                hexInput.value = color;
                if (preview) {
                    preview.style.backgroundColor = color;
                }
                this.handlers.onChange(fieldId, color);
            });
            
            // Update color picker and preview when hex input changes
            hexInput.addEventListener('input', (e) => {
                const hex = e.target.value;
                // Validate hex format
                if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
                    colorInput.value = hex;
                    if (preview) {
                        preview.style.backgroundColor = hex;
                    }
                    hexInput.classList.remove('border-red-500');
                    hexInput.classList.add('border-gray-300');
                    this.handlers.onChange(fieldId, hex);
                } else if (hex.length > 0) {
                    // Show error state for invalid hex
                    hexInput.classList.remove('border-gray-300');
                    hexInput.classList.add('border-red-500');
                }
            });
            
            // Validate on blur
            hexInput.addEventListener('blur', (e) => {
                const hex = e.target.value;
                if (hex && !/^#[0-9A-Fa-f]{6}$/.test(hex)) {
                    // Reset to current color picker value
                    e.target.value = colorInput.value;
                    e.target.classList.remove('border-red-500');
                    e.target.classList.add('border-gray-300');
                }
            });
        },
        
        /**
         * Get current value from widget
         * @param {string} fieldId - Field ID
         * @returns {string} Current hex color value
         */
        getValue: function(fieldId) {
            const colorInput = document.querySelector(`#${fieldId}_color`);
            return colorInput ? colorInput.value : null;
        },
        
        /**
         * Set value programmatically
         * @param {string} fieldId - Field ID
         * @param {string} value - Hex color value to set
         */
        setValue: function(fieldId, value) {
            // Validate hex color format before using
            const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
            const safeValue = hexColorRegex.test(value) ? value : '#000000';
            
            const colorInput = document.querySelector(`#${fieldId}_color`);
            const hexInput = document.querySelector(`#${fieldId}_hex`);
            const preview = document.querySelector(`#${fieldId}_preview`);
            
            if (colorInput && hexInput) {
                colorInput.value = safeValue;
                hexInput.value = safeValue;
                if (preview) {
                    preview.style.backgroundColor = safeValue;
                }
            }
        },
        
        /**
         * Event handlers
         */
        handlers: {
            /**
             * Handle color change
             * @param {string} fieldId - Field ID
             * @param {string} value - New color value
             */
            onChange: function(fieldId, value) {
                // Trigger form change event for validation and saving
                const event = new CustomEvent('widget-change', {
                    detail: { fieldId, value },
                    bubbles: true,
                    cancelable: true
                });
                document.dispatchEvent(event);
                
                // Also update any hidden input if it exists
                const hiddenInput = document.querySelector(`input[name*="${fieldId}"][type="hidden"]`);
                if (hiddenInput) {
                    hiddenInput.value = value;
                }
            }
        }
    });

    console.log('[ColorPickerWidget] Color picker widget registered (example)');
})();


/* === file-upload.js === */
/**
 * File Upload Widget
 * 
 * Handles file uploads (primarily images) with drag-and-drop support,
 * preview, delete, and scheduling functionality.
 * 
 * @module FileUploadWidget
 */

(function() {
    'use strict';

    // Ensure LEDMatrixWidgets registry exists
    if (typeof window.LEDMatrixWidgets === 'undefined') {
        console.error('[FileUploadWidget] LEDMatrixWidgets registry not found. Load registry.js first.');
        return;
    }

    /**
     * Register the file-upload widget
     */
    window.LEDMatrixWidgets.register('file-upload', {
        name: 'File Upload Widget',
        version: '1.0.0',
        
        /**
         * Render the file upload widget
         * Note: This widget is currently server-side rendered via Jinja2 template.
         * This registration ensures the handlers are available globally.
         * Future enhancement: Full client-side rendering support.
         */
        render: function(container, config, value, options) {
            // For now, widgets are server-side rendered
            // This function is a placeholder for future client-side rendering
            console.log('[FileUploadWidget] Render called (server-side rendered)');
        },
        
        /**
         * Get current value from widget
         * @param {string} fieldId - Field ID
         * @returns {Array} Array of uploaded files
         */
        getValue: function(fieldId) {
            return window.getCurrentImages ? window.getCurrentImages(fieldId) : [];
        },
        
        /**
         * Set value in widget
         * @param {string} fieldId - Field ID
         * @param {Array} images - Array of image objects
         */
        setValue: function(fieldId, images) {
            if (window.updateImageList) {
                window.updateImageList(fieldId, images);
            }
        },
        
        handlers: {
            // Handlers are attached to window for backwards compatibility
        }
    });

    // ===== File Upload Handlers (Backwards Compatible) =====
    // These functions are called from the server-rendered template
    
    /**
     * Handle file drop event
     * @param {Event} event - Drop event
     * @param {string} fieldId - Field ID
     */
    window.handleFileDrop = function(event, fieldId) {
        event.preventDefault();
        const files = event.dataTransfer.files;
        if (files.length > 0) {
            window.handleFiles(fieldId, Array.from(files));
        }
    };

    /**
     * Handle file select event
     * @param {Event} event - Change event
     * @param {string} fieldId - Field ID
     */
    window.handleFileSelect = function(event, fieldId) {
        const files = event.target.files;
        if (files.length > 0) {
            window.handleFiles(fieldId, Array.from(files));
        }
    };

    /**
     * Handle multiple files upload
     * @param {string} fieldId - Field ID
     * @param {Array<File>} files - Files to upload
     */
    window.handleFiles = async function(fieldId, files) {
        const uploadConfig = window.getUploadConfig ? window.getUploadConfig(fieldId) : {};
        const pluginId = uploadConfig.plugin_id || window.currentPluginConfig?.pluginId || 'static-image';
        const maxFiles = uploadConfig.max_files || 10;
        const maxSizeMB = uploadConfig.max_size_mb || 5;
        const fileType = uploadConfig.file_type || 'image';
        const customUploadEndpoint = uploadConfig.endpoint || '/api/v3/plugins/assets/upload';
        
        // Get allowed types from config, with fallback
        const allowedTypes = uploadConfig.allowed_types || ['image/png', 'image/jpeg', 'image/jpg', 'image/bmp', 'image/gif'];
        
        // Get current files list
        const currentFiles = window.getCurrentImages ? window.getCurrentImages(fieldId) : [];
        
        // Validate file types and sizes first, build validFiles
        const validFiles = [];
        for (const file of files) {
            if (file.size > maxSizeMB * 1024 * 1024) {
                const notifyFn = window.showNotification || console.error;
                notifyFn(`File ${file.name} exceeds ${maxSizeMB}MB limit`, 'error');
                continue;
            }
            
            if (fileType === 'json') {
                // Validate JSON files
                if (!file.name.toLowerCase().endsWith('.json')) {
                    const notifyFn = window.showNotification || console.error;
                    notifyFn(`File ${file.name} must be a JSON file (.json)`, 'error');
                    continue;
                }
            } else {
                // Validate image files using allowedTypes from config
                if (!allowedTypes.includes(file.type)) {
                    const notifyFn = window.showNotification || console.error;
                    notifyFn(`File ${file.name} is not a valid image type`, 'error');
                    continue;
                }
            }
            
            validFiles.push(file);
        }
        
        // Check max files AFTER building validFiles
        if (currentFiles.length + validFiles.length > maxFiles) {
            const notifyFn = window.showNotification || console.error;
            notifyFn(`Maximum ${maxFiles} files allowed. You have ${currentFiles.length} and tried to add ${validFiles.length}.`, 'error');
            return;
        }
        
        if (validFiles.length === 0) {
            return;
        }
        
        // Show upload progress
        if (window.showUploadProgress) {
            window.showUploadProgress(fieldId, validFiles.length);
        }
        
        // Upload files
        const formData = new FormData();
        if (fileType !== 'json') {
            formData.append('plugin_id', pluginId);
        }
        validFiles.forEach(file => formData.append('files', file));
        
        try {
            const response = await fetch(customUploadEndpoint, {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.status === 'success') {
                // Add uploaded files to current list
                const currentFiles = window.getCurrentImages ? window.getCurrentImages(fieldId) : [];
                const newFiles = [...currentFiles, ...(data.uploaded_files || data.data?.files || [])];
                if (window.updateImageList) {
                    window.updateImageList(fieldId, newFiles);
                }
                
                const notifyFn = window.showNotification || console.log;
                notifyFn(`Successfully uploaded ${data.uploaded_files?.length || data.data?.files?.length || 0} ${fileType === 'json' ? 'file(s)' : 'image(s)'}`, 'success');
            } else {
                const notifyFn = window.showNotification || console.error;
                notifyFn(`Upload failed: ${data.message}`, 'error');
            }
        } catch (error) {
            console.error('Upload error:', error);
            const notifyFn = window.showNotification || console.error;
            notifyFn(`Upload error: ${error.message}`, 'error');
        } finally {
            if (window.hideUploadProgress) {
                window.hideUploadProgress(fieldId);
            }
            // Clear file input
            const fileInput = document.getElementById(`${fieldId}_file_input`);
            if (fileInput) {
                fileInput.value = '';
            }
        }
    };

    /**
     * Delete uploaded image
     * @param {string} fieldId - Field ID
     * @param {string} imageId - Image ID
     * @param {string} pluginId - Plugin ID
     */
    window.deleteUploadedImage = async function(fieldId, imageId, pluginId) {
        return window.deleteUploadedFile(fieldId, imageId, pluginId, 'image', null);
    };

    /**
     * Delete uploaded file (generic)
     * @param {string} fieldId - Field ID
     * @param {string} fileId - File ID
     * @param {string} pluginId - Plugin ID
     * @param {string} fileType - File type ('image' or 'json')
     * @param {string|null} customDeleteEndpoint - Custom delete endpoint
     */
    window.deleteUploadedFile = async function(fieldId, fileId, pluginId, fileType, customDeleteEndpoint) {
        const fileTypeLabel = fileType === 'json' ? 'file' : 'image';
        if (!confirm(`Are you sure you want to delete this ${fileTypeLabel}?`)) {
            return;
        }
        
        try {
            const deleteEndpoint = customDeleteEndpoint || (fileType === 'json' ? '/api/v3/plugins/of-the-day/json/delete' : '/api/v3/plugins/assets/delete');
            const requestBody = fileType === 'json' 
                ? { file_id: fileId }
                : { plugin_id: pluginId, image_id: fileId };
            
            const response = await fetch(deleteEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });
            
            const data = await response.json();
            
            if (data.status === 'success') {
                // Remove from current list - normalize types for comparison
                const currentFiles = window.getCurrentImages ? window.getCurrentImages(fieldId) : [];
                const fileIdStr = String(fileId);
                const newFiles = currentFiles.filter(file => {
                    const fileIdValue = String(file.id || file.category_name || '');
                    return fileIdValue !== fileIdStr;
                });
                if (window.updateImageList) {
                    window.updateImageList(fieldId, newFiles);
                }
                
                const notifyFn = window.showNotification || console.log;
                notifyFn(`${fileType === 'json' ? 'File' : 'Image'} deleted successfully`, 'success');
            } else {
                const notifyFn = window.showNotification || console.error;
                notifyFn(`Delete failed: ${data.message}`, 'error');
            }
        } catch (error) {
            console.error('Delete error:', error);
            const notifyFn = window.showNotification || console.error;
            notifyFn(`Delete error: ${error.message}`, 'error');
        }
    };

    /**
     * Get upload configuration from schema
     * @param {string} fieldId - Field ID
     * @returns {Object} Upload configuration
     */
    window.getUploadConfig = function(fieldId) {
        // Extract config from schema
        const schema = window.currentPluginConfig?.schema;
        if (!schema || !schema.properties) return {};
        
        // Find the property that matches this fieldId
        // FieldId is like "image_config_images" for "image_config.images"
        const key = fieldId.replace(/_/g, '.');
        const keys = key.split('.');
        let prop = schema.properties;
        
        for (const k of keys) {
            if (prop && prop[k]) {
                prop = prop[k];
                if (prop.properties && prop.type === 'object') {
                    prop = prop.properties;
                } else if (prop.type === 'array' && prop['x-widget'] === 'file-upload') {
                    break;
                } else {
                    break;
                }
            }
        }
        
        // If we found an array with x-widget, get its config
        if (prop && prop.type === 'array' && prop['x-widget'] === 'file-upload') {
            return prop['x-upload-config'] || {};
        }
        
        // Try to find nested images array
        if (schema.properties && schema.properties.image_config && 
            schema.properties.image_config.properties && 
            schema.properties.image_config.properties.images) {
            const imagesProp = schema.properties.image_config.properties.images;
            if (imagesProp['x-widget'] === 'file-upload') {
                return imagesProp['x-upload-config'] || {};
            }
        }
        
        return {};
    };

    /**
     * Get current images from hidden input
     * @param {string} fieldId - Field ID
     * @returns {Array} Array of image objects
     */
    window.getCurrentImages = function(fieldId) {
        const hiddenInput = document.getElementById(`${fieldId}_images_data`);
        if (hiddenInput && hiddenInput.value) {
            try {
                return JSON.parse(hiddenInput.value);
            } catch (e) {
                console.error('Error parsing images data:', e);
            }
        }
        return [];
    };

    /**
     * Update image list display and hidden input
     * Uses DOM creation to prevent XSS and preserves open schedule editors
     * @param {string} fieldId - Field ID
     * @param {Array} images - Array of image objects
     */
    window.updateImageList = function(fieldId, images) {
        const hiddenInput = document.getElementById(`${fieldId}_images_data`);
        if (hiddenInput) {
            hiddenInput.value = JSON.stringify(images);
        }
        
        // Update the display
        const imageList = document.getElementById(`${fieldId}_image_list`);
        if (!imageList) return;
        
        const uploadConfig = window.getUploadConfig(fieldId);
        const pluginId = uploadConfig.plugin_id || window.currentPluginConfig?.pluginId || 'static-image';
        
        // Detect which schedule is currently open (if any)
        const openScheduleId = (() => {
            const existingItems = imageList.querySelectorAll('[id^="img_"]');
            for (const item of existingItems) {
                const scheduleDiv = item.querySelector('[id^="schedule_"]');
                if (scheduleDiv && !scheduleDiv.classList.contains('hidden')) {
                    // Extract the ID from schedule_<id>
                    const match = scheduleDiv.id.match(/^schedule_(.+)$/);
                    if (match) {
                        return match[1];
                    }
                }
            }
            return null;
        })();
        
        // Preserve open schedule content if it exists
        const preservedScheduleContent = openScheduleId ? (() => {
            const scheduleDiv = document.getElementById(`schedule_${openScheduleId}`);
            return scheduleDiv ? scheduleDiv.innerHTML : null;
        })() : null;
        
        // Clear and rebuild using DOM creation
        imageList.innerHTML = '';
        
        images.forEach((img, idx) => {
            const imgId = img.id || idx;
            const sanitizedId = String(imgId).replace(/[^a-zA-Z0-9_-]/g, '_');
            const imgSchedule = img.schedule || {};
            const hasSchedule = imgSchedule.enabled && imgSchedule.mode && imgSchedule.mode !== 'always';
            const scheduleSummary = hasSchedule ? (window.getScheduleSummary ? window.getScheduleSummary(imgSchedule) : 'Scheduled') : 'Always shown';
            
            // Create container div
            const container = document.createElement('div');
            container.id = `img_${sanitizedId}`;
            container.className = 'bg-gray-50 p-3 rounded-lg border border-gray-200';
            
            // Create main content div
            const mainDiv = document.createElement('div');
            mainDiv.className = 'flex items-center justify-between mb-2';
            
            // Create left section with image and info
            const leftSection = document.createElement('div');
            leftSection.className = 'flex items-center space-x-3 flex-1';
            
            // Create image element
            const imgEl = document.createElement('img');
            const imgPath = String(img.path || '').replace(/^\/+/, '');
            imgEl.src = '/' + imgPath;
            imgEl.alt = String(img.filename || '');
            imgEl.className = 'w-16 h-16 object-cover rounded';
            imgEl.addEventListener('error', function() {
                this.style.display = 'none';
                if (this.nextElementSibling) {
                    this.nextElementSibling.style.display = 'block';
                }
            });
            
            // Create placeholder div for broken images
            const placeholderDiv = document.createElement('div');
            placeholderDiv.style.display = 'none';
            placeholderDiv.className = 'w-16 h-16 bg-gray-200 rounded flex items-center justify-center';
            const placeholderIcon = document.createElement('i');
            placeholderIcon.className = 'fas fa-image text-gray-400';
            placeholderDiv.appendChild(placeholderIcon);
            
            // Create info div
            const infoDiv = document.createElement('div');
            infoDiv.className = 'flex-1 min-w-0';
            
            // Filename
            const filenameP = document.createElement('p');
            filenameP.className = 'text-sm font-medium text-gray-900 truncate';
            filenameP.textContent = img.original_filename || img.filename || 'Image';
            
            // Size and date
            const sizeDateP = document.createElement('p');
            sizeDateP.className = 'text-xs text-gray-500';
            const fileSize = window.formatFileSize ? window.formatFileSize(img.size || 0) : (Math.round((img.size || 0) / 1024) + ' KB');
            const uploadedDate = window.formatDate ? window.formatDate(img.uploaded_at) : (img.uploaded_at || '');
            sizeDateP.textContent = `${fileSize} • ${uploadedDate}`;
            
            // Schedule summary
            const scheduleP = document.createElement('p');
            scheduleP.className = 'text-xs text-blue-600 mt-1';
            const clockIcon = document.createElement('i');
            clockIcon.className = 'fas fa-clock mr-1';
            scheduleP.appendChild(clockIcon);
            scheduleP.appendChild(document.createTextNode(scheduleSummary));
            
            infoDiv.appendChild(filenameP);
            infoDiv.appendChild(sizeDateP);
            infoDiv.appendChild(scheduleP);
            
            leftSection.appendChild(imgEl);
            leftSection.appendChild(placeholderDiv);
            leftSection.appendChild(infoDiv);
            
            // Create right section with buttons
            const rightSection = document.createElement('div');
            rightSection.className = 'flex items-center space-x-2 ml-4';
            
            // Schedule button
            const scheduleBtn = document.createElement('button');
            scheduleBtn.type = 'button';
            scheduleBtn.className = 'text-blue-600 hover:text-blue-800 p-2';
            scheduleBtn.title = 'Schedule this image';
            scheduleBtn.dataset.fieldId = fieldId;
            scheduleBtn.dataset.imageId = String(imgId);
            scheduleBtn.dataset.imageIdx = String(idx);
            scheduleBtn.addEventListener('click', function() {
                window.openImageSchedule(this.dataset.fieldId, this.dataset.imageId, parseInt(this.dataset.imageIdx, 10));
            });
            const scheduleIcon = document.createElement('i');
            scheduleIcon.className = 'fas fa-calendar-alt';
            scheduleBtn.appendChild(scheduleIcon);
            
            // Delete button
            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'text-red-600 hover:text-red-800 p-2';
            deleteBtn.title = 'Delete image';
            deleteBtn.dataset.fieldId = fieldId;
            deleteBtn.dataset.imageId = String(imgId);
            deleteBtn.dataset.pluginId = pluginId;
            deleteBtn.addEventListener('click', function() {
                window.deleteUploadedImage(this.dataset.fieldId, this.dataset.imageId, this.dataset.pluginId);
            });
            const deleteIcon = document.createElement('i');
            deleteIcon.className = 'fas fa-trash';
            deleteBtn.appendChild(deleteIcon);
            
            rightSection.appendChild(scheduleBtn);
            rightSection.appendChild(deleteBtn);
            
            mainDiv.appendChild(leftSection);
            mainDiv.appendChild(rightSection);
            
            // Create schedule container
            const scheduleContainer = document.createElement('div');
            scheduleContainer.id = `schedule_${sanitizedId}`;
            scheduleContainer.className = 'hidden mt-3 pt-3 border-t border-gray-300';
            
            // Restore preserved schedule content if this is the open one
            if (openScheduleId === sanitizedId && preservedScheduleContent) {
                scheduleContainer.innerHTML = preservedScheduleContent;
                scheduleContainer.classList.remove('hidden');
            }
            
            container.appendChild(mainDiv);
            container.appendChild(scheduleContainer);
            imageList.appendChild(container);
        });
    };

    /**
     * Show upload progress
     * @param {string} fieldId - Field ID
     * @param {number} totalFiles - Total number of files
     */
    window.showUploadProgress = function(fieldId, totalFiles) {
        const dropZone = document.getElementById(`${fieldId}_drop_zone`);
        if (dropZone) {
            dropZone.innerHTML = `
                <i class="fas fa-spinner fa-spin text-3xl text-blue-500 mb-2"></i>
                <p class="text-sm text-gray-600">Uploading ${totalFiles} file(s)...</p>
            `;
            dropZone.style.pointerEvents = 'none';
        }
    };

    /**
     * Hide upload progress and restore drop zone
     * @param {string} fieldId - Field ID
     */
    window.hideUploadProgress = function(fieldId) {
        const uploadConfig = window.getUploadConfig(fieldId);
        const maxFiles = uploadConfig.max_files || 10;
        const maxSizeMB = uploadConfig.max_size_mb || 5;
        const allowedTypes = uploadConfig.allowed_types || ['image/png', 'image/jpeg', 'image/bmp', 'image/gif'];
        
        // Generate user-friendly extension list from allowedTypes
        const extensionMap = {
            'image/png': 'PNG',
            'image/jpeg': 'JPG',
            'image/jpg': 'JPG',
            'image/bmp': 'BMP',
            'image/gif': 'GIF',
            'image/webp': 'WEBP'
        };
        const extensions = allowedTypes
            .map(type => extensionMap[type] || type.split('/')[1]?.toUpperCase() || type)
            .filter((ext, idx, arr) => arr.indexOf(ext) === idx) // Remove duplicates
            .join(', ');
        const extensionText = extensions || 'PNG, JPG, GIF, BMP';
        
        const dropZone = document.getElementById(`${fieldId}_drop_zone`);
        if (dropZone) {
            dropZone.innerHTML = `
                <i class="fas fa-cloud-upload-alt text-3xl text-gray-400 mb-2"></i>
                <p class="text-sm text-gray-600">Drag and drop images here or click to browse</p>
                <p class="text-xs text-gray-500 mt-1">Max ${maxFiles} files, ${maxSizeMB}MB each (${extensionText})</p>
            `;
            dropZone.style.pointerEvents = 'auto';
        }
    };

    /**
     * Format file size
     * @param {number} bytes - File size in bytes
     * @returns {string} Formatted file size
     */
    window.formatFileSize = function(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    /**
     * Format date string
     * @param {string} dateString - Date string
     * @returns {string} Formatted date
     */
    window.formatDate = function(dateString) {
        if (!dateString) return 'Unknown date';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch (e) {
            return dateString;
        }
    };

    /**
     * Get schedule summary text
     * @param {Object} schedule - Schedule object
     * @returns {string} Schedule summary
     */
    window.getScheduleSummary = function(schedule) {
        if (!schedule || !schedule.enabled || schedule.mode === 'always') {
            return 'Always shown';
        }
        
        if (schedule.mode === 'time_range') {
            return `${schedule.start_time || '08:00'} - ${schedule.end_time || '18:00'} (daily)`;
        }
        
        if (schedule.mode === 'per_day' && schedule.days) {
            const enabledDays = Object.entries(schedule.days)
                .filter(([day, config]) => config && config.enabled)
                .map(([day]) => day.charAt(0).toUpperCase() + day.slice(1, 3));
            
            if (enabledDays.length === 0) {
                return 'Never shown';
            }
            
            return enabledDays.join(', ') + ' only';
        }
        
        return 'Scheduled';
    };

    /**
     * Open image schedule editor
     * @param {string} fieldId - Field ID
     * @param {string|number} imageId - Image ID
     * @param {number} imageIdx - Image index
     */
    window.openImageSchedule = function(fieldId, imageId, imageIdx) {
        const currentImages = window.getCurrentImages(fieldId);
        const image = currentImages[imageIdx];
        if (!image) return;
        
        // Sanitize imageId to match updateImageList's sanitization
        const sanitizedId = (imageId || imageIdx).toString().replace(/[^a-zA-Z0-9_-]/g, '_');
        const scheduleContainer = document.getElementById(`schedule_${sanitizedId}`);
        if (!scheduleContainer) return;
        
        // Toggle visibility
        const isVisible = !scheduleContainer.classList.contains('hidden');
        
        if (isVisible) {
            scheduleContainer.classList.add('hidden');
            return;
        }
        
        scheduleContainer.classList.remove('hidden');
        
        const schedule = image.schedule || { enabled: false, mode: 'always', start_time: '08:00', end_time: '18:00', days: {} };
        
        // Escape HTML helper
        const escapeHtml = (text) => {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        };
        
        // Use sanitizedId for all ID references in the schedule HTML
        // Use data attributes instead of inline handlers to prevent JS injection
        scheduleContainer.innerHTML = `
            <div class="bg-white rounded-lg border border-blue-200 p-4">
                <h4 class="text-sm font-semibold text-gray-900 mb-3">
                    <i class="fas fa-clock mr-2"></i>Schedule Settings
                </h4>
                
                <!-- Enable Schedule -->
                <div class="mb-4">
                    <label class="flex items-center">
                        <input type="checkbox" 
                               id="schedule_enabled_${sanitizedId}"
                               data-field-id="${escapeHtml(fieldId)}"
                               data-image-id="${sanitizedId}"
                               data-image-idx="${imageIdx}"
                               ${schedule.enabled ? 'checked' : ''}
                               class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded">
                        <span class="ml-2 text-sm font-medium text-gray-700">Enable schedule for this image</span>
                    </label>
                    <p class="ml-6 text-xs text-gray-500 mt-1">When enabled, this image will only display during scheduled times</p>
                </div>
                
                <!-- Schedule Mode -->
                <div id="schedule_options_${sanitizedId}" class="space-y-4" style="display: ${schedule.enabled ? 'block' : 'none'};">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Schedule Type</label>
                        <select id="schedule_mode_${sanitizedId}"
                                data-field-id="${escapeHtml(fieldId)}"
                                data-image-id="${sanitizedId}"
                                data-image-idx="${imageIdx}"
                                class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
                            <option value="always" ${schedule.mode === 'always' ? 'selected' : ''}>Always Show (No Schedule)</option>
                            <option value="time_range" ${schedule.mode === 'time_range' ? 'selected' : ''}>Same Time Every Day</option>
                            <option value="per_day" ${schedule.mode === 'per_day' ? 'selected' : ''}>Different Times Per Day</option>
                        </select>
                    </div>
                    
                    <!-- Time Range Mode -->
                    <div id="time_range_${sanitizedId}" class="grid grid-cols-2 gap-4" style="display: ${schedule.mode === 'time_range' ? 'grid' : 'none'};">
                        <div>
                            <label class="block text-xs font-medium text-gray-700 mb-1">Start Time</label>
                            <input type="time" 
                                   id="schedule_start_${sanitizedId}"
                                   data-field-id="${escapeHtml(fieldId)}"
                                   data-image-id="${sanitizedId}"
                                   data-image-idx="${imageIdx}"
                                   value="${escapeHtml(schedule.start_time || '08:00')}"
                                   class="block w-full px-2 py-1 text-sm border border-gray-300 rounded-md">
                        </div>
                        <div>
                            <label class="block text-xs font-medium text-gray-700 mb-1">End Time</label>
                            <input type="time" 
                                   id="schedule_end_${sanitizedId}"
                                   data-field-id="${escapeHtml(fieldId)}"
                                   data-image-id="${sanitizedId}"
                                   data-image-idx="${imageIdx}"
                                   value="${escapeHtml(schedule.end_time || '18:00')}"
                                   class="block w-full px-2 py-1 text-sm border border-gray-300 rounded-md">
                        </div>
                    </div>
                    
                    <!-- Per-Day Mode -->
                    <div id="per_day_${sanitizedId}" style="display: ${schedule.mode === 'per_day' ? 'block' : 'none'};">
                        <label class="block text-xs font-medium text-gray-700 mb-2">Day-Specific Times</label>
                        <div class="bg-gray-50 rounded p-3 space-y-2 max-h-64 overflow-y-auto">
                            ${['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => {
                                const dayConfig = (schedule.days && schedule.days[day]) || { enabled: true, start_time: '08:00', end_time: '18:00' };
                                return `
                                <div class="bg-white rounded p-2 border border-gray-200">
                                    <div class="flex items-center justify-between mb-2">
                                        <label class="flex items-center">
                                            <input type="checkbox"
                                                   id="day_${day}_${sanitizedId}"
                                                   data-field-id="${escapeHtml(fieldId)}"
                                                   data-image-id="${sanitizedId}"
                                                   data-image-idx="${imageIdx}"
                                                   data-day="${day}"
                                                   ${dayConfig.enabled ? 'checked' : ''}
                                                   class="h-3 w-3 text-blue-600 focus:ring-blue-500 border-gray-300 rounded">
                                            <span class="ml-2 text-xs font-medium text-gray-700 capitalize">${day}</span>
                                        </label>
                                    </div>
                                    <div class="grid grid-cols-2 gap-2 ml-5" id="day_times_${day}_${sanitizedId}" style="display: ${dayConfig.enabled ? 'grid' : 'none'};">
                                        <input type="time"
                                               id="day_${day}_start_${sanitizedId}"
                                               data-field-id="${escapeHtml(fieldId)}"
                                               data-image-id="${sanitizedId}"
                                               data-image-idx="${imageIdx}"
                                               data-day="${day}"
                                               value="${escapeHtml(dayConfig.start_time || '08:00')}"
                                               class="text-xs px-2 py-1 border border-gray-300 rounded"
                                               ${!dayConfig.enabled ? 'disabled' : ''}>
                                        <input type="time"
                                               id="day_${day}_end_${sanitizedId}"
                                               data-field-id="${escapeHtml(fieldId)}"
                                               data-image-id="${sanitizedId}"
                                               data-image-idx="${imageIdx}"
                                               data-day="${day}"
                                               value="${escapeHtml(dayConfig.end_time || '18:00')}"
                                               class="text-xs px-2 py-1 border border-gray-300 rounded"
                                               ${!dayConfig.enabled ? 'disabled' : ''}>
                                    </div>
                                </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Attach event listeners using data attributes (prevents JS injection)
        const enabledCheckbox = document.getElementById(`schedule_enabled_${sanitizedId}`);
        if (enabledCheckbox) {
            enabledCheckbox.addEventListener('change', function() {
                const fieldId = this.dataset.fieldId;
                const imageId = this.dataset.imageId;
                const imageIdx = parseInt(this.dataset.imageIdx, 10);
                window.toggleImageScheduleEnabled(fieldId, imageId, imageIdx);
            });
        }
        
        const modeSelect = document.getElementById(`schedule_mode_${sanitizedId}`);
        if (modeSelect) {
            modeSelect.addEventListener('change', function() {
                const fieldId = this.dataset.fieldId;
                const imageId = this.dataset.imageId;
                const imageIdx = parseInt(this.dataset.imageIdx, 10);
                window.updateImageScheduleMode(fieldId, imageId, imageIdx);
            });
        }
        
        const startInput = document.getElementById(`schedule_start_${sanitizedId}`);
        if (startInput) {
            startInput.addEventListener('change', function() {
                const fieldId = this.dataset.fieldId;
                const imageId = this.dataset.imageId;
                const imageIdx = parseInt(this.dataset.imageIdx, 10);
                window.updateImageScheduleTime(fieldId, imageId, imageIdx);
            });
        }
        
        const endInput = document.getElementById(`schedule_end_${sanitizedId}`);
        if (endInput) {
            endInput.addEventListener('change', function() {
                const fieldId = this.dataset.fieldId;
                const imageId = this.dataset.imageId;
                const imageIdx = parseInt(this.dataset.imageIdx, 10);
                window.updateImageScheduleTime(fieldId, imageId, imageIdx);
            });
        }
        
        // Attach listeners for per-day inputs
        ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].forEach(day => {
            const dayCheckbox = document.getElementById(`day_${day}_${sanitizedId}`);
            if (dayCheckbox) {
                dayCheckbox.addEventListener('change', function() {
                    const fieldId = this.dataset.fieldId;
                    const imageId = this.dataset.imageId;
                    const imageIdx = parseInt(this.dataset.imageIdx, 10);
                    const day = this.dataset.day;
                    window.updateImageScheduleDay(fieldId, imageId, imageIdx, day);
                });
            }
            
            const dayStartInput = document.getElementById(`day_${day}_start_${sanitizedId}`);
            if (dayStartInput) {
                dayStartInput.addEventListener('change', function() {
                    const fieldId = this.dataset.fieldId;
                    const imageId = this.dataset.imageId;
                    const imageIdx = parseInt(this.dataset.imageIdx, 10);
                    const day = this.dataset.day;
                    window.updateImageScheduleDay(fieldId, imageId, imageIdx, day);
                });
            }
            
            const dayEndInput = document.getElementById(`day_${day}_end_${sanitizedId}`);
            if (dayEndInput) {
                dayEndInput.addEventListener('change', function() {
                    const fieldId = this.dataset.fieldId;
                    const imageId = this.dataset.imageId;
                    const imageIdx = parseInt(this.dataset.imageIdx, 10);
                    const day = this.dataset.day;
                    window.updateImageScheduleDay(fieldId, imageId, imageIdx, day);
                });
            }
        });
    };

    /**
     * Toggle image schedule enabled state
     */
    window.toggleImageScheduleEnabled = function(fieldId, imageId, imageIdx) {
        const currentImages = window.getCurrentImages(fieldId);
        const image = currentImages[imageIdx];
        if (!image) return;
        
        // Sanitize imageId for DOM lookup
        const sanitizedId = String(imageId).replace(/[^a-zA-Z0-9_-]/g, '_');
        const checkbox = document.getElementById(`schedule_enabled_${sanitizedId}`);
        const enabled = checkbox ? checkbox.checked : false;
        
        if (!image.schedule) {
            image.schedule = { enabled: false, mode: 'always', start_time: '08:00', end_time: '18:00', days: {} };
        }
        
        image.schedule.enabled = enabled;
        
        const optionsDiv = document.getElementById(`schedule_options_${sanitizedId}`);
        if (optionsDiv) {
            optionsDiv.style.display = enabled ? 'block' : 'none';
        }
        
        if (window.updateImageList) {
            window.updateImageList(fieldId, currentImages);
        }
    };

    /**
     * Update image schedule mode
     */
    window.updateImageScheduleMode = function(fieldId, imageId, imageIdx) {
        const currentImages = window.getCurrentImages(fieldId);
        const image = currentImages[imageIdx];
        if (!image) return;
        
        // Sanitize imageId for DOM lookup
        const sanitizedId = String(imageId).replace(/[^a-zA-Z0-9_-]/g, '_');
        
        if (!image.schedule) {
            image.schedule = { enabled: true, mode: 'always', start_time: '08:00', end_time: '18:00', days: {} };
        }
        
        const modeSelect = document.getElementById(`schedule_mode_${sanitizedId}`);
        const mode = modeSelect ? modeSelect.value : 'always';
        
        image.schedule.mode = mode;
        
        const timeRangeDiv = document.getElementById(`time_range_${sanitizedId}`);
        const perDayDiv = document.getElementById(`per_day_${sanitizedId}`);
        
        if (timeRangeDiv) timeRangeDiv.style.display = mode === 'time_range' ? 'grid' : 'none';
        if (perDayDiv) perDayDiv.style.display = mode === 'per_day' ? 'block' : 'none';
        
        if (window.updateImageList) {
            window.updateImageList(fieldId, currentImages);
        }
    };

    /**
     * Update image schedule time
     */
    window.updateImageScheduleTime = function(fieldId, imageId, imageIdx) {
        const currentImages = window.getCurrentImages(fieldId);
        const image = currentImages[imageIdx];
        if (!image) return;
        
        // Sanitize imageId for DOM lookup
        const sanitizedId = String(imageId).replace(/[^a-zA-Z0-9_-]/g, '_');
        
        if (!image.schedule) {
            image.schedule = { enabled: true, mode: 'time_range', start_time: '08:00', end_time: '18:00' };
        }
        
        const startInput = document.getElementById(`schedule_start_${sanitizedId}`);
        const endInput = document.getElementById(`schedule_end_${sanitizedId}`);
        
        if (startInput) image.schedule.start_time = startInput.value || '08:00';
        if (endInput) image.schedule.end_time = endInput.value || '18:00';
        
        if (window.updateImageList) {
            window.updateImageList(fieldId, currentImages);
        }
    };

    /**
     * Update image schedule day
     */
    window.updateImageScheduleDay = function(fieldId, imageId, imageIdx, day) {
        const currentImages = window.getCurrentImages(fieldId);
        const image = currentImages[imageIdx];
        if (!image) return;
        
        // Sanitize imageId for DOM lookup
        const sanitizedId = String(imageId).replace(/[^a-zA-Z0-9_-]/g, '_');
        
        if (!image.schedule) {
            image.schedule = { enabled: true, mode: 'per_day', days: {} };
        }
        
        if (!image.schedule.days) {
            image.schedule.days = {};
        }
        
        const checkbox = document.getElementById(`day_${day}_${sanitizedId}`);
        const startInput = document.getElementById(`day_${day}_start_${sanitizedId}`);
        const endInput = document.getElementById(`day_${day}_end_${sanitizedId}`);
        
        const enabled = checkbox ? checkbox.checked : true;
        
        if (!image.schedule.days[day]) {
            image.schedule.days[day] = { enabled: true, start_time: '08:00', end_time: '18:00' };
        }
        
        image.schedule.days[day].enabled = enabled;
        if (startInput) image.schedule.days[day].start_time = startInput.value || '08:00';
        if (endInput) image.schedule.days[day].end_time = endInput.value || '18:00';
        
        const dayTimesDiv = document.getElementById(`day_times_${day}_${sanitizedId}`);
        if (dayTimesDiv) {
            dayTimesDiv.style.display = enabled ? 'grid' : 'none';
        }
        if (startInput) startInput.disabled = !enabled;
        if (endInput) endInput.disabled = !enabled;
        
        if (window.updateImageList) {
            window.updateImageList(fieldId, currentImages);
        }
    };

    console.log('[FileUploadWidget] File upload widget registered');
})();


/* === font-selector.js === */
/**
 * LEDMatrix Font Selector Widget
 *
 * Dynamic font selector that fetches available fonts from the API.
 * Automatically shows all fonts in assets/fonts/ directory.
 *
 * Schema example:
 * {
 *   "font": {
 *     "type": "string",
 *     "title": "Font Family",
 *     "x-widget": "font-selector",
 *     "x-options": {
 *       "placeholder": "Select a font...",
 *       "showPreview": false,
 *       "filterTypes": ["ttf", "bdf"]
 *     },
 *     "default": "PressStart2P-Regular.ttf"
 *   }
 * }
 *
 * @module FontSelectorWidget
 */

(function() {
    'use strict';

    const base = window.BaseWidget ? new window.BaseWidget('FontSelector', '1.0.0') : null;

    // Cache for font catalog to avoid repeated API calls
    let fontCatalogCache = null;
    let fontCatalogPromise = null;

    function escapeHtml(text) {
        if (base) return base.escapeHtml(text);
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function sanitizeId(id) {
        if (base) return base.sanitizeId(id);
        return String(id).replace(/[^a-zA-Z0-9_-]/g, '_');
    }

    function triggerChange(fieldId, value) {
        if (base) {
            base.triggerChange(fieldId, value);
        } else {
            const event = new CustomEvent('widget-change', {
                detail: { fieldId, value },
                bubbles: true,
                cancelable: true
            });
            document.dispatchEvent(event);
        }
    }

    /**
     * Generate a human-readable display name from font filename
     * @param {string} filename - Font filename (e.g., "PressStart2P-Regular.ttf")
     * @returns {string} Display name (e.g., "Press Start 2P Regular")
     */
    function generateDisplayName(filename) {
        if (!filename) return '';

        // Remove extension
        let name = filename.replace(/\.(ttf|bdf|otf)$/i, '');

        // Handle common patterns
        // Split on hyphens and underscores
        name = name.replace(/[-_]/g, ' ');

        // Add space before capital letters (camelCase/PascalCase)
        name = name.replace(/([a-z])([A-Z])/g, '$1 $2');

        // Add space before numbers that follow letters
        name = name.replace(/([a-zA-Z])(\d)/g, '$1 $2');

        // Clean up multiple spaces
        name = name.replace(/\s+/g, ' ').trim();

        return name;
    }

    /**
     * Fetch font catalog from API (with caching)
     * @returns {Promise<Array>} Array of font objects
     */
    async function fetchFontCatalog() {
        // Return cached data if available
        if (fontCatalogCache) {
            return fontCatalogCache;
        }

        // Return existing promise if fetch is in progress
        if (fontCatalogPromise) {
            return fontCatalogPromise;
        }

        // Fetch from API
        fontCatalogPromise = fetch('/api/v3/fonts/catalog')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to fetch font catalog: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                // Handle different response structures
                let fonts = [];

                if (data.data && data.data.fonts) {
                    // New format: { data: { fonts: [...] } }
                    fonts = data.data.fonts;
                } else if (data.data && data.data.catalog) {
                    // Alternative format: { data: { catalog: {...} } }
                    const catalog = data.data.catalog;
                    fonts = Object.entries(catalog).map(([family, info]) => ({
                        filename: info.filename || family,
                        family: family,
                        display_name: info.display_name || generateDisplayName(info.filename || family),
                        path: info.path,
                        type: info.type || 'unknown'
                    }));
                } else if (Array.isArray(data)) {
                    // Direct array format
                    fonts = data;
                }

                // Sort fonts alphabetically by display name
                fonts.sort((a, b) => {
                    const nameA = (a.display_name || a.filename || '').toLowerCase();
                    const nameB = (b.display_name || b.filename || '').toLowerCase();
                    return nameA.localeCompare(nameB);
                });

                fontCatalogCache = fonts;
                fontCatalogPromise = null;
                return fonts;
            })
            .catch(error => {
                console.error('[FontSelectorWidget] Error fetching font catalog:', error);
                fontCatalogPromise = null;
                return [];
            });

        return fontCatalogPromise;
    }

    /**
     * Clear the font catalog cache (call when fonts are uploaded/deleted)
     */
    function clearFontCache() {
        fontCatalogCache = null;
        fontCatalogPromise = null;
    }

    // Expose cache clearing function globally
    window.clearFontSelectorCache = clearFontCache;

    // Guard against missing global registry
    if (!window.LEDMatrixWidgets || typeof window.LEDMatrixWidgets.register !== 'function') {
        console.error('[FontSelectorWidget] LEDMatrixWidgets registry not available');
        return;
    }

    window.LEDMatrixWidgets.register('font-selector', {
        name: 'Font Selector Widget',
        version: '1.0.0',

        render: async function(container, config, value, options) {
            const fieldId = sanitizeId(options.fieldId || container.id || 'font-select');
            const xOptions = config['x-options'] || config['x_options'] || {};
            const placeholder = xOptions.placeholder || 'Select a font...';
            const filterTypes = xOptions.filterTypes || null; // e.g., ['ttf', 'bdf']
            const showPreview = xOptions.showPreview === true;
            const disabled = xOptions.disabled === true;
            const required = xOptions.required === true;

            const currentValue = value !== null && value !== undefined ? String(value) : '';

            // Show loading state
            container.innerHTML = `
                <div id="${fieldId}_widget" class="font-selector-widget" data-field-id="${fieldId}">
                    <select id="${fieldId}_input"
                            name="${escapeHtml(options.name || fieldId)}"
                            disabled
                            class="form-select w-full rounded-md border-gray-300 shadow-sm bg-gray-100 text-black">
                        <option value="">Loading fonts...</option>
                    </select>
                </div>
            `;

            try {
                // Fetch fonts from API
                const fonts = await fetchFontCatalog();

                // Filter by type if specified
                let filteredFonts = fonts;
                if (filterTypes && Array.isArray(filterTypes)) {
                    filteredFonts = fonts.filter(font => {
                        const fontType = (font.type || '').toLowerCase();
                        return filterTypes.some(t => t.toLowerCase() === fontType);
                    });
                }

                // Build select HTML
                let html = `<div id="${fieldId}_widget" class="font-selector-widget" data-field-id="${fieldId}">`;

                html += `
                    <select id="${fieldId}_input"
                            name="${escapeHtml(options.name || fieldId)}"
                            ${disabled ? 'disabled' : ''}
                            ${required ? 'required' : ''}
                            onchange="window.LEDMatrixWidgets.getHandlers('font-selector').onChange('${fieldId}')"
                            class="form-select w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'} text-black">
                `;

                // Placeholder option
                if (placeholder && !required) {
                    html += `<option value="" ${!currentValue ? 'selected' : ''}>${escapeHtml(placeholder)}</option>`;
                }

                // Font options
                for (const font of filteredFonts) {
                    const fontValue = font.filename || font.family;
                    const displayName = font.display_name || generateDisplayName(fontValue);
                    const fontType = font.type ? ` (${font.type.toUpperCase()})` : '';
                    const isSelected = String(fontValue) === currentValue;

                    html += `<option value="${escapeHtml(String(fontValue))}" ${isSelected ? 'selected' : ''}>${escapeHtml(displayName)}${escapeHtml(fontType)}</option>`;
                }

                html += '</select>';

                // Optional preview area
                if (showPreview) {
                    html += `
                        <div id="${fieldId}_preview" class="mt-2 p-2 bg-gray-800 rounded text-white text-center" style="min-height: 30px;">
                            <span style="font-family: monospace;">Preview</span>
                        </div>
                    `;
                }

                // Error message area
                html += `<div id="${fieldId}_error" class="text-sm text-red-600 mt-1 hidden"></div>`;

                html += '</div>';

                container.innerHTML = html;

            } catch (error) {
                console.error('[FontSelectorWidget] Error rendering:', error);
                container.innerHTML = `
                    <div id="${fieldId}_widget" class="font-selector-widget" data-field-id="${fieldId}">
                        <select id="${fieldId}_input"
                                name="${escapeHtml(options.name || fieldId)}"
                                class="form-select w-full rounded-md border-gray-300 shadow-sm bg-white text-black">
                            <option value="${escapeHtml(currentValue)}" selected>${escapeHtml(currentValue || 'Error loading fonts')}</option>
                        </select>
                        <div class="text-sm text-red-600 mt-1">Failed to load font list</div>
                    </div>
                `;
            }
        },

        getValue: function(fieldId) {
            const safeId = sanitizeId(fieldId);
            const input = document.getElementById(`${safeId}_input`);
            return input ? input.value : '';
        },

        setValue: function(fieldId, value) {
            const safeId = sanitizeId(fieldId);
            const input = document.getElementById(`${safeId}_input`);
            if (input) {
                input.value = value !== null && value !== undefined ? String(value) : '';
            }
        },

        handlers: {
            onChange: function(fieldId) {
                const widget = window.LEDMatrixWidgets.get('font-selector');
                triggerChange(fieldId, widget.getValue(fieldId));
            }
        },

        // Expose utility functions
        utils: {
            clearCache: clearFontCache,
            fetchCatalog: fetchFontCatalog,
            generateDisplayName: generateDisplayName
        }
    });

    console.log('[FontSelectorWidget] Font selector widget registered');
})();


/* === number-input.js === */
/**
 * LEDMatrix Number Input Widget
 *
 * Enhanced number input with min/max/step, formatting, and increment buttons.
 *
 * Schema example:
 * {
 *   "brightness": {
 *     "type": "number",
 *     "x-widget": "number-input",
 *     "minimum": 0,
 *     "maximum": 100,
 *     "x-options": {
 *       "step": 5,
 *       "prefix": null,
 *       "suffix": "%",
 *       "showButtons": true,
 *       "format": "integer"  // "integer", "decimal", "percent"
 *     }
 *   }
 * }
 *
 * @module NumberInputWidget
 */

(function() {
    'use strict';

    const base = window.BaseWidget ? new window.BaseWidget('NumberInput', '1.0.0') : null;

    function escapeHtml(text) {
        if (base) return base.escapeHtml(text);
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function sanitizeId(id) {
        if (base) return base.sanitizeId(id);
        return String(id).replace(/[^a-zA-Z0-9_-]/g, '_');
    }

    function triggerChange(fieldId, value) {
        if (base) {
            base.triggerChange(fieldId, value);
        } else {
            const event = new CustomEvent('widget-change', {
                detail: { fieldId, value },
                bubbles: true,
                cancelable: true
            });
            document.dispatchEvent(event);
        }
    }

    window.LEDMatrixWidgets.register('number-input', {
        name: 'Number Input Widget',
        version: '1.0.0',

        render: function(container, config, value, options) {
            // Guard against undefined options
            options = options || {};
            const fieldId = sanitizeId(options.fieldId || container.id || 'number_input');
            const xOptions = config['x-options'] || config['x_options'] || {};

            // Sanitize min/max as valid numbers or null
            const rawMin = config.minimum !== undefined ? config.minimum : (xOptions.min !== undefined ? xOptions.min : null);
            const rawMax = config.maximum !== undefined ? config.maximum : (xOptions.max !== undefined ? xOptions.max : null);
            const min = (rawMin !== null && Number.isFinite(Number(rawMin))) ? Number(rawMin) : null;
            const max = (rawMax !== null && Number.isFinite(Number(rawMax))) ? Number(rawMax) : null;

            // Sanitize step - must be a positive number or 'any'
            const rawStep = xOptions.step || (config.type === 'integer' ? 1 : 'any');
            const step = (rawStep === 'any' || (Number.isFinite(Number(rawStep)) && Number(rawStep) > 0))
                ? (rawStep === 'any' ? 'any' : Number(rawStep))
                : 1;
            const prefix = xOptions.prefix || '';
            const suffix = xOptions.suffix || '';
            const showButtons = xOptions.showButtons !== false;
            const disabled = xOptions.disabled === true;
            const placeholder = xOptions.placeholder || '';

            // Sanitize currentValue - ensure it's a safe numeric string or empty
            const rawValue = value !== null && value !== undefined ? value : '';
            const currentValue = rawValue === '' ? '' : (isNaN(Number(rawValue)) ? '' : String(Number(rawValue)));

            // Escape values for safe HTML attribute interpolation
            const safeMin = min !== null ? escapeHtml(String(min)) : '';
            const safeMax = max !== null ? escapeHtml(String(max)) : '';
            const safeStep = escapeHtml(String(step));

            let html = `<div id="${fieldId}_widget" class="number-input-widget" data-field-id="${fieldId}" data-min="${safeMin}" data-max="${safeMax}" data-step="${safeStep}">`;

            html += '<div class="flex items-center">';

            if (prefix) {
                html += `<span class="inline-flex items-center px-3 text-sm text-gray-500 bg-gray-100 border border-r-0 border-gray-300 rounded-l-md">${escapeHtml(prefix)}</span>`;
            }

            if (showButtons && !disabled) {
                html += `
                    <button type="button"
                            onclick="window.LEDMatrixWidgets.getHandlers('number-input').onDecrement('${fieldId}')"
                            class="inline-flex items-center px-3 py-2 text-gray-600 bg-gray-100 border border-r-0 border-gray-300 hover:bg-gray-200 ${prefix ? '' : 'rounded-l-md'}">
                        <i class="fas fa-minus text-xs"></i>
                    </button>
                `;
            }

            const inputRoundedClass = showButtons || prefix || suffix ? '' : 'rounded-md';

            html += `
                <input type="number"
                       id="${fieldId}_input"
                       name="${escapeHtml(options.name || fieldId)}"
                       value="${escapeHtml(currentValue)}"
                       placeholder="${escapeHtml(placeholder)}"
                       ${min !== null ? `min="${safeMin}"` : ''}
                       ${max !== null ? `max="${safeMax}"` : ''}
                       step="${safeStep}"
                       ${disabled ? 'disabled' : ''}
                       onchange="window.LEDMatrixWidgets.getHandlers('number-input').onChange('${fieldId}')"
                       oninput="window.LEDMatrixWidgets.getHandlers('number-input').onInput('${fieldId}')"
                       class="form-input w-24 text-center ${inputRoundedClass} border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'} text-black placeholder:text-gray-400">
            `;

            if (showButtons && !disabled) {
                html += `
                    <button type="button"
                            onclick="window.LEDMatrixWidgets.getHandlers('number-input').onIncrement('${fieldId}')"
                            class="inline-flex items-center px-3 py-2 text-gray-600 bg-gray-100 border border-l-0 border-gray-300 hover:bg-gray-200 ${suffix ? '' : 'rounded-r-md'}">
                        <i class="fas fa-plus text-xs"></i>
                    </button>
                `;
            }

            if (suffix) {
                html += `<span class="inline-flex items-center px-3 text-sm text-gray-500 bg-gray-100 border border-l-0 border-gray-300 rounded-r-md">${escapeHtml(suffix)}</span>`;
            }

            html += '</div>';

            // Range indicator if min/max specified
            if (min !== null || max !== null) {
                const rangeText = min !== null && max !== null
                    ? `${min} - ${max}`
                    : (min !== null ? `Min: ${min}` : `Max: ${max}`);
                html += `<div class="text-xs text-gray-400 mt-1">${escapeHtml(rangeText)}</div>`;
            }

            // Error message area
            html += `<div id="${fieldId}_error" class="text-sm text-red-600 mt-1 hidden"></div>`;

            html += '</div>';

            container.innerHTML = html;
        },

        getValue: function(fieldId) {
            const safeId = sanitizeId(fieldId);
            const input = document.getElementById(`${safeId}_input`);
            if (!input || input.value === '') return null;
            const num = parseFloat(input.value);
            return isNaN(num) ? null : num;
        },

        setValue: function(fieldId, value) {
            const safeId = sanitizeId(fieldId);
            const input = document.getElementById(`${safeId}_input`);
            if (input) {
                input.value = value !== null && value !== undefined ? value : '';
            }
        },

        validate: function(fieldId) {
            const safeId = sanitizeId(fieldId);
            const input = document.getElementById(`${safeId}_input`);
            const errorEl = document.getElementById(`${safeId}_error`);

            if (!input) return { valid: true, errors: [] };

            const isValid = input.checkValidity();

            if (errorEl) {
                if (!isValid) {
                    errorEl.textContent = input.validationMessage;
                    errorEl.classList.remove('hidden');
                    input.classList.add('border-red-500');
                } else {
                    errorEl.classList.add('hidden');
                    input.classList.remove('border-red-500');
                }
            }

            return { valid: isValid, errors: isValid ? [] : [input.validationMessage] };
        },

        handlers: {
            onChange: function(fieldId) {
                const widget = window.LEDMatrixWidgets.get('number-input');
                widget.validate(fieldId);
                triggerChange(fieldId, widget.getValue(fieldId));
            },

            onInput: function(fieldId) {
                // Real-time input handling if needed
            },

            onIncrement: function(fieldId) {
                const safeId = sanitizeId(fieldId);
                const widget = document.getElementById(`${safeId}_widget`);
                const input = document.getElementById(`${safeId}_input`);
                if (!input || !widget) return;

                const step = parseFloat(widget.dataset.step) || 1;
                const max = widget.dataset.max !== '' ? parseFloat(widget.dataset.max) : Infinity;
                const current = parseFloat(input.value) || 0;
                const newValue = Math.min(current + step, max);

                input.value = newValue;
                this.onChange(fieldId);
            },

            onDecrement: function(fieldId) {
                const safeId = sanitizeId(fieldId);
                const widget = document.getElementById(`${safeId}_widget`);
                const input = document.getElementById(`${safeId}_input`);
                if (!input || !widget) return;

                const step = parseFloat(widget.dataset.step) || 1;
                const min = widget.dataset.min !== '' ? parseFloat(widget.dataset.min) : -Infinity;
                const current = parseFloat(input.value) || 0;
                const newValue = Math.max(current - step, min);

                input.value = newValue;
                this.onChange(fieldId);
            }
        }
    });

    console.log('[NumberInputWidget] Number input widget registered');
})();


/* === password-input.js === */
/**
 * LEDMatrix Password Input Widget
 *
 * Password input with show/hide toggle and strength indicator.
 *
 * Schema example:
 * {
 *   "password": {
 *     "type": "string",
 *     "x-widget": "password-input",
 *     "x-options": {
 *       "placeholder": "Enter password",
 *       "showToggle": true,
 *       "showStrength": false,
 *       "minLength": 8,
 *       "requireUppercase": false,
 *       "requireNumber": false,
 *       "requireSpecial": false
 *     }
 *   }
 * }
 *
 * @module PasswordInputWidget
 */

(function() {
    'use strict';

    const base = window.BaseWidget ? new window.BaseWidget('PasswordInput', '1.0.0') : null;

    function escapeHtml(text) {
        if (base) return base.escapeHtml(text);
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function sanitizeId(id) {
        if (base) return base.sanitizeId(id);
        return String(id).replace(/[^a-zA-Z0-9_-]/g, '_');
    }

    function triggerChange(fieldId, value) {
        if (base) {
            base.triggerChange(fieldId, value);
        } else {
            const event = new CustomEvent('widget-change', {
                detail: { fieldId, value },
                bubbles: true,
                cancelable: true
            });
            document.dispatchEvent(event);
        }
    }

    // Deterministic color class mapping to avoid Tailwind JIT purging
    const STRENGTH_COLORS = {
        gray: 'bg-gray-300',
        red: 'bg-red-500',
        orange: 'bg-orange-500',
        yellow: 'bg-yellow-500',
        lime: 'bg-lime-500',
        green: 'bg-green-500'
    };

    function calculateStrength(password, options) {
        if (!password) return { score: 0, label: '', color: 'gray' };

        let score = 0;
        const minLength = options.minLength || 8;

        // Length check
        if (password.length >= minLength) score += 1;
        if (password.length >= minLength + 4) score += 1;
        if (password.length >= minLength + 8) score += 1;

        // Character variety
        if (/[a-z]/.test(password)) score += 1;
        if (/[A-Z]/.test(password)) score += 1;
        if (/[0-9]/.test(password)) score += 1;
        if (/[^a-zA-Z0-9]/.test(password)) score += 1;

        // Normalize to 0-4 scale
        const normalizedScore = Math.min(4, Math.floor(score / 2));

        const levels = [
            { label: 'Very Weak', color: 'red' },
            { label: 'Weak', color: 'orange' },
            { label: 'Fair', color: 'yellow' },
            { label: 'Good', color: 'lime' },
            { label: 'Strong', color: 'green' }
        ];

        return {
            score: normalizedScore,
            ...levels[normalizedScore]
        };
    }

    window.LEDMatrixWidgets.register('password-input', {
        name: 'Password Input Widget',
        version: '1.0.0',

        render: function(container, config, value, options) {
            const fieldId = sanitizeId(options.fieldId || container.id || 'password_input');
            const xOptions = config['x-options'] || config['x_options'] || {};
            const placeholder = xOptions.placeholder || 'Enter password';
            const showToggle = xOptions.showToggle !== false;
            const showStrength = xOptions.showStrength === true;
            // Validate and sanitize minLength as a non-negative integer
            const rawMinLength = xOptions.minLength !== undefined ? parseInt(xOptions.minLength, 10) : 8;
            const sanitizedMinLength = (Number.isFinite(rawMinLength) && Number.isInteger(rawMinLength) && rawMinLength >= 0) ? rawMinLength : 8;
            const requireUppercase = xOptions.requireUppercase === true;
            const requireNumber = xOptions.requireNumber === true;
            const requireSpecial = xOptions.requireSpecial === true;
            const disabled = xOptions.disabled === true;
            const required = xOptions.required === true;

            const currentValue = value || '';

            let html = `<div id="${fieldId}_widget" class="password-input-widget" data-field-id="${fieldId}" data-min-length="${sanitizedMinLength}" data-require-uppercase="${requireUppercase}" data-require-number="${requireNumber}" data-require-special="${requireSpecial}">`;

            html += '<div class="relative">';

            html += `
                <input type="password"
                       id="${fieldId}_input"
                       name="${escapeHtml(options.name || fieldId)}"
                       value="${escapeHtml(currentValue)}"
                       placeholder="${escapeHtml(placeholder)}"
                       ${sanitizedMinLength > 0 ? `minlength="${sanitizedMinLength}"` : ''}
                       ${disabled ? 'disabled' : ''}
                       ${required ? 'required' : ''}
                       onchange="window.LEDMatrixWidgets.getHandlers('password-input').onChange('${fieldId}')"
                       oninput="window.LEDMatrixWidgets.getHandlers('password-input').onInput('${fieldId}')"
                       class="form-input w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 pr-10 ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'} text-black placeholder:text-gray-400">
            `;

            if (showToggle && !disabled) {
                html += `
                    <button type="button"
                            id="${fieldId}_toggle"
                            onclick="window.LEDMatrixWidgets.getHandlers('password-input').onToggle('${fieldId}')"
                            class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                            title="Show/hide password">
                        <i id="${fieldId}_icon" class="fas fa-eye"></i>
                    </button>
                `;
            }

            html += '</div>';

            // Strength indicator
            if (showStrength) {
                const strength = calculateStrength(currentValue, xOptions);
                const colorClass = STRENGTH_COLORS[strength.color] || STRENGTH_COLORS.gray;
                html += `
                    <div id="${fieldId}_strength" class="mt-2 ${currentValue ? '' : 'hidden'}">
                        <div class="flex gap-1 mb-1">
                            <div class="h-1 flex-1 rounded bg-gray-200">
                                <div id="${fieldId}_bar0" class="h-full rounded ${strength.score >= 1 ? colorClass : ''}" style="width: ${strength.score >= 1 ? '100%' : '0'}"></div>
                            </div>
                            <div class="h-1 flex-1 rounded bg-gray-200">
                                <div id="${fieldId}_bar1" class="h-full rounded ${strength.score >= 2 ? colorClass : ''}" style="width: ${strength.score >= 2 ? '100%' : '0'}"></div>
                            </div>
                            <div class="h-1 flex-1 rounded bg-gray-200">
                                <div id="${fieldId}_bar2" class="h-full rounded ${strength.score >= 3 ? colorClass : ''}" style="width: ${strength.score >= 3 ? '100%' : '0'}"></div>
                            </div>
                            <div class="h-1 flex-1 rounded bg-gray-200">
                                <div id="${fieldId}_bar3" class="h-full rounded ${strength.score >= 4 ? colorClass : ''}" style="width: ${strength.score >= 4 ? '100%' : '0'}"></div>
                            </div>
                        </div>
                        <span id="${fieldId}_strength_label" class="text-xs text-gray-500">${strength.label}</span>
                    </div>
                `;
            }

            // Error message area
            html += `<div id="${fieldId}_error" class="text-sm text-red-600 mt-1 hidden"></div>`;

            html += '</div>';

            container.innerHTML = html;
        },

        getValue: function(fieldId) {
            const safeId = sanitizeId(fieldId);
            const input = document.getElementById(`${safeId}_input`);
            return input ? input.value : '';
        },

        setValue: function(fieldId, value) {
            const safeId = sanitizeId(fieldId);
            const input = document.getElementById(`${safeId}_input`);
            if (input) {
                input.value = value || '';
                this.handlers.onInput(fieldId);
            }
        },

        validate: function(fieldId) {
            const safeId = sanitizeId(fieldId);
            const input = document.getElementById(`${safeId}_input`);
            const errorEl = document.getElementById(`${safeId}_error`);
            const widget = document.getElementById(`${safeId}_widget`);

            if (!input) return { valid: true, errors: [] };

            const errors = [];
            let isValid = input.checkValidity();

            if (!isValid) {
                errors.push(input.validationMessage);
            } else if (input.value && widget) {
                // Check custom validation requirements
                const requireUppercase = widget.dataset.requireUppercase === 'true';
                const requireNumber = widget.dataset.requireNumber === 'true';
                const requireSpecial = widget.dataset.requireSpecial === 'true';

                if (requireUppercase && !/[A-Z]/.test(input.value)) {
                    isValid = false;
                    errors.push('Password must contain at least one uppercase letter');
                }
                if (requireNumber && !/[0-9]/.test(input.value)) {
                    isValid = false;
                    errors.push('Password must contain at least one number');
                }
                if (requireSpecial && !/[^a-zA-Z0-9]/.test(input.value)) {
                    isValid = false;
                    errors.push('Password must contain at least one special character');
                }
            }

            if (errorEl) {
                if (!isValid && errors.length > 0) {
                    errorEl.textContent = errors[0];
                    errorEl.classList.remove('hidden');
                    input.classList.add('border-red-500');
                } else {
                    errorEl.classList.add('hidden');
                    input.classList.remove('border-red-500');
                }
            }

            return { valid: isValid, errors };
        },

        handlers: {
            onChange: function(fieldId) {
                const widget = window.LEDMatrixWidgets.get('password-input');
                widget.validate(fieldId);
                triggerChange(fieldId, widget.getValue(fieldId));
            },

            onInput: function(fieldId) {
                const safeId = sanitizeId(fieldId);
                const input = document.getElementById(`${safeId}_input`);
                const strengthEl = document.getElementById(`${safeId}_strength`);
                const strengthLabel = document.getElementById(`${safeId}_strength_label`);
                const widget = document.getElementById(`${safeId}_widget`);

                if (strengthEl && input) {
                    const value = input.value;
                    const minLength = parseInt(widget?.dataset.minLength || '8', 10);

                    if (value) {
                        strengthEl.classList.remove('hidden');
                        const strength = calculateStrength(value, { minLength });

                        // Update bars using shared color mapping
                        const colorClass = STRENGTH_COLORS[strength.color] || STRENGTH_COLORS.gray;

                        for (let i = 0; i < 4; i++) {
                            const bar = document.getElementById(`${safeId}_bar${i}`);
                            if (bar) {
                                // Remove all color classes
                                bar.className = 'h-full rounded';
                                if (i < strength.score) {
                                    bar.classList.add(colorClass);
                                    bar.style.width = '100%';
                                } else {
                                    bar.style.width = '0';
                                }
                            }
                        }

                        if (strengthLabel) {
                            strengthLabel.textContent = strength.label;
                        }
                    } else {
                        strengthEl.classList.add('hidden');
                    }
                }
            },

            onToggle: function(fieldId) {
                const safeId = sanitizeId(fieldId);
                const input = document.getElementById(`${safeId}_input`);
                const icon = document.getElementById(`${safeId}_icon`);

                if (input && icon) {
                    if (input.type === 'password') {
                        input.type = 'text';
                        icon.classList.remove('fa-eye');
                        icon.classList.add('fa-eye-slash');
                    } else {
                        input.type = 'password';
                        icon.classList.remove('fa-eye-slash');
                        icon.classList.add('fa-eye');
                    }
                }
            }
        }
    });

    console.log('[PasswordInputWidget] Password input widget registered');
})();


/* === radio-group.js === */
/**
 * LEDMatrix Radio Group Widget
 *
 * Exclusive option selection with radio buttons.
 *
 * Schema example:
 * {
 *   "displayMode": {
 *     "type": "string",
 *     "x-widget": "radio-group",
 *     "enum": ["auto", "manual", "scheduled"],
 *     "x-options": {
 *       "layout": "vertical",  // "vertical", "horizontal"
 *       "labels": {
 *         "auto": "Automatic",
 *         "manual": "Manual Control",
 *         "scheduled": "Scheduled"
 *       },
 *       "descriptions": {
 *         "auto": "System decides when to display",
 *         "manual": "You control when content shows",
 *         "scheduled": "Display at specific times"
 *       }
 *     }
 *   }
 * }
 *
 * @module RadioGroupWidget
 */

(function() {
    'use strict';

    const base = window.BaseWidget ? new window.BaseWidget('RadioGroup', '1.0.0') : null;

    function escapeHtml(text) {
        if (base) return base.escapeHtml(text);
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function sanitizeId(id) {
        if (base) return base.sanitizeId(id);
        return String(id).replace(/[^a-zA-Z0-9_-]/g, '_');
    }

    function triggerChange(fieldId, value) {
        if (base) {
            base.triggerChange(fieldId, value);
        } else {
            const event = new CustomEvent('widget-change', {
                detail: { fieldId, value },
                bubbles: true,
                cancelable: true
            });
            document.dispatchEvent(event);
        }
    }

    window.LEDMatrixWidgets.register('radio-group', {
        name: 'Radio Group Widget',
        version: '1.0.0',

        render: function(container, config, value, options) {
            const fieldId = sanitizeId(options.fieldId || container.id || 'radio_group');
            const xOptions = config['x-options'] || config['x_options'] || {};
            const enumValues = config.enum || xOptions.options || [];
            const layout = xOptions.layout || 'vertical';
            const labels = xOptions.labels || {};
            const descriptions = xOptions.descriptions || {};
            const disabled = xOptions.disabled === true;

            const currentValue = value !== null && value !== undefined ? String(value) : '';

            const containerClass = layout === 'horizontal' ? 'flex flex-wrap gap-4' : 'space-y-3';

            let html = `<div id="${fieldId}_widget" class="radio-group-widget ${containerClass}" data-field-id="${fieldId}">`;

            for (const optValue of enumValues) {
                const optId = `${fieldId}_${sanitizeId(String(optValue))}`;
                const label = labels[optValue] || String(optValue).replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                const description = descriptions[optValue] || '';
                const isChecked = String(optValue) === currentValue;

                html += `
                    <label class="flex items-start cursor-pointer ${disabled ? 'opacity-50' : ''}">
                        <div class="flex items-center h-5">
                            <input type="radio"
                                   id="${optId}"
                                   name="${escapeHtml(options.name || fieldId)}"
                                   value="${escapeHtml(String(optValue))}"
                                   ${isChecked ? 'checked' : ''}
                                   ${disabled ? 'disabled' : ''}
                                   class="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}">
                        </div>
                        <div class="ml-3">
                            <span class="text-sm font-medium text-gray-900">${escapeHtml(label)}</span>
                            ${description ? `<p class="text-xs text-gray-500">${escapeHtml(description)}</p>` : ''}
                        </div>
                    </label>
                `;
            }

            html += '</div>';

            container.innerHTML = html;

            // Attach event listeners (safer than inline handlers, prevents XSS)
            const widget = document.getElementById(`${fieldId}_widget`);
            if (widget) {
                const radios = widget.querySelectorAll('input[type="radio"]');
                radios.forEach(radio => {
                    radio.addEventListener('change', () => {
                        triggerChange(fieldId, radio.value);
                    });
                });
            }
        },

        getValue: function(fieldId) {
            const safeId = sanitizeId(fieldId);
            const widget = document.getElementById(`${safeId}_widget`);
            if (!widget) return '';

            const checked = widget.querySelector('input[type="radio"]:checked');
            return checked ? checked.value : '';
        },

        setValue: function(fieldId, value) {
            const safeId = sanitizeId(fieldId);
            const widget = document.getElementById(`${safeId}_widget`);
            if (!widget) return;

            const radios = widget.querySelectorAll('input[type="radio"]');
            radios.forEach(radio => {
                radio.checked = radio.value === String(value);
            });
        },

        handlers: {
            onChange: function(fieldId, value) {
                triggerChange(fieldId, value);
            }
        }
    });

    console.log('[RadioGroupWidget] Radio group widget registered');
})();


/* === schedule-picker.js === */
/**
 * LEDMatrix Schedule Picker Widget
 *
 * Composite widget combining enable toggle, mode switch (global/per-day),
 * and time range configurations. Composes day-selector and time-range widgets.
 *
 * Can be used standalone in schedule.html or by plugins via x-widget: "schedule-picker".
 *
 * Schema example:
 * {
 *   "schedule": {
 *     "type": "object",
 *     "x-widget": "schedule-picker",
 *     "x-options": {
 *       "showModeToggle": true,     // Allow switching global/per-day
 *       "showEnableToggle": true,   // Show enabled checkbox
 *       "compactMode": false,       // Compact layout for embedded use
 *       "defaultMode": "global"     // Default mode: "global" or "per_day"
 *     }
 *   }
 * }
 *
 * API-compatible output format:
 * {
 *   enabled: boolean,
 *   mode: "global" | "per_day",
 *   start_time: "HH:MM",           // if global mode
 *   end_time: "HH:MM",             // if global mode
 *   days: {                        // if per_day mode
 *     monday: { enabled: boolean, start_time: "HH:MM", end_time: "HH:MM" },
 *     ...
 *   }
 * }
 *
 * @module SchedulePickerWidget
 */

(function() {
    'use strict';

    const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    const DAY_LABELS = {
        monday: 'Monday',
        tuesday: 'Tuesday',
        wednesday: 'Wednesday',
        thursday: 'Thursday',
        friday: 'Friday',
        saturday: 'Saturday',
        sunday: 'Sunday'
    };

    // Use BaseWidget utilities if available
    const base = window.BaseWidget ? new window.BaseWidget('SchedulePicker', '1.0.0') : null;

    function escapeHtml(text) {
        if (base) return base.escapeHtml(text);
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function sanitizeId(id) {
        if (base) return base.sanitizeId(id);
        return String(id).replace(/[^a-zA-Z0-9_-]/g, '_');
    }

    function triggerChange(fieldId, value) {
        if (base) {
            base.triggerChange(fieldId, value);
        } else {
            const event = new CustomEvent('widget-change', {
                detail: { fieldId, value },
                bubbles: true,
                cancelable: true
            });
            document.dispatchEvent(event);
        }
    }

    /**
     * Generate default schedule config
     */
    function getDefaultSchedule() {
        const days = {};
        DAYS.forEach(day => {
            days[day] = {
                enabled: true,
                start_time: '07:00',
                end_time: '23:00'
            };
        });
        return {
            enabled: false,
            mode: 'global',
            start_time: '07:00',
            end_time: '23:00',
            days: days
        };
    }

    /**
     * Coerce a value to boolean, handling string 'true'/'false' values
     * that may come from config files or form submissions.
     */
    function coerceToBoolean(value) {
        if (typeof value === 'boolean') {
            return value;
        }
        if (typeof value === 'string') {
            const trimmed = value.trim().toLowerCase();
            return trimmed === 'true' || trimmed === '1' || trimmed === 'on';
        }
        return Boolean(value);
    }

    /**
     * Normalize mode value to handle both 'per_day' and 'per-day' variants.
     */
    function normalizeMode(mode) {
        if (!mode || typeof mode !== 'string') {
            return 'global';
        }
        // Normalize: replace hyphens with underscores and check for per_day
        const normalized = mode.trim().toLowerCase().replace(/-/g, '_');
        return normalized === 'per_day' ? 'per_day' : 'global';
    }

    /**
     * Merge user value with defaults
     */
    function normalizeSchedule(value) {
        const defaults = getDefaultSchedule();
        if (!value || typeof value !== 'object') {
            return defaults;
        }

        const schedule = {
            enabled: coerceToBoolean(value.enabled),
            mode: normalizeMode(value.mode),
            start_time: value.start_time || defaults.start_time,
            end_time: value.end_time || defaults.end_time,
            days: {}
        };

        // Merge days
        DAYS.forEach(day => {
            const dayConfig = (value.days && value.days[day]) || defaults.days[day];
            // Use coerceToBoolean but default to true if enabled is undefined
            const dayEnabled = dayConfig.enabled === undefined ? true : coerceToBoolean(dayConfig.enabled);
            schedule.days[day] = {
                enabled: dayEnabled,
                start_time: dayConfig.start_time || defaults.days[day].start_time,
                end_time: dayConfig.end_time || defaults.days[day].end_time
            };
        });

        return schedule;
    }

    window.LEDMatrixWidgets.register('schedule-picker', {
        name: 'Schedule Picker Widget',
        version: '1.0.0',

        /**
         * Render the schedule picker widget
         * @param {HTMLElement} container - Container element
         * @param {Object} config - Schema configuration
         * @param {Object} value - Schedule configuration object
         * @param {Object} options - Additional options (fieldId, pluginId)
         */
        render: function(container, config, value, options) {
            const fieldId = sanitizeId(options.fieldId || container.id || 'schedule');
            const xOptions = config['x-options'] || config['x_options'] || {};
            const showModeToggle = xOptions.showModeToggle !== false;
            const showEnableToggle = xOptions.showEnableToggle !== false;
            const compactMode = xOptions.compactMode === true;

            const schedule = normalizeSchedule(value);

            let html = `<div id="${fieldId}_widget" class="schedule-picker-widget" data-field-id="${fieldId}">`;

            // Hidden inputs for API-compatible form submission
            html += this._renderHiddenInputs(fieldId, schedule);

            // Enable toggle
            if (showEnableToggle) {
                html += `
                    <div class="bg-blue-50 rounded-lg p-4 mb-4">
                        <label class="flex items-center cursor-pointer">
                            <input type="checkbox"
                                   id="${fieldId}_enabled"
                                   ${schedule.enabled ? 'checked' : ''}
                                   onchange="window.LEDMatrixWidgets.getHandlers('schedule-picker').onEnabledChange('${fieldId}', this.checked)"
                                   class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded">
                            <span class="ml-2 text-sm font-medium text-gray-900">Enable Schedule</span>
                        </label>
                        <p class="mt-1 text-sm text-gray-600">When enabled, the display will only operate during specified hours.</p>
                    </div>
                `;
            }

            // Mode selection
            if (showModeToggle) {
                html += `
                    <div class="bg-gray-50 rounded-lg p-4 mb-4">
                        <h3 class="text-md font-medium text-gray-900 mb-4">Schedule Mode</h3>
                        <div class="space-y-3">
                            <label class="flex items-center cursor-pointer">
                                <input type="radio"
                                       name="${fieldId}_mode"
                                       value="global"
                                       id="${fieldId}_mode_global"
                                       ${schedule.mode === 'global' ? 'checked' : ''}
                                       onchange="window.LEDMatrixWidgets.getHandlers('schedule-picker').onModeChange('${fieldId}', 'global')"
                                       class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300">
                                <span class="ml-2 text-sm font-medium text-gray-900">Global Schedule</span>
                            </label>
                            <p class="ml-6 text-sm text-gray-600">Use the same start and end time for all days of the week</p>

                            <label class="flex items-center cursor-pointer mt-4">
                                <input type="radio"
                                       name="${fieldId}_mode"
                                       value="per_day"
                                       id="${fieldId}_mode_per_day"
                                       ${schedule.mode === 'per_day' ? 'checked' : ''}
                                       onchange="window.LEDMatrixWidgets.getHandlers('schedule-picker').onModeChange('${fieldId}', 'per_day')"
                                       class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300">
                                <span class="ml-2 text-sm font-medium text-gray-900">Per-Day Schedule</span>
                            </label>
                            <p class="ml-6 text-sm text-gray-600">Set different times for each day of the week</p>
                        </div>
                    </div>
                `;
            }

            // Global schedule section
            const globalDisplay = schedule.mode === 'global' ? 'block' : 'none';
            html += `
                <div id="${fieldId}_global_section" class="bg-gray-50 rounded-lg p-4 mb-4" style="display: ${globalDisplay};">
                    <h3 class="text-md font-medium text-gray-900 mb-4">Global Times</h3>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="form-group">
                            <label for="${fieldId}_global_start" class="block text-sm font-medium text-gray-700">Start Time</label>
                            <input type="time"
                                   id="${fieldId}_global_start"
                                   value="${escapeHtml(schedule.start_time)}"
                                   onchange="window.LEDMatrixWidgets.getHandlers('schedule-picker').onGlobalTimeChange('${fieldId}')"
                                   class="form-control mt-1">
                            <p class="mt-1 text-sm text-gray-600">When to start displaying content (HH:MM)</p>
                        </div>
                        <div class="form-group">
                            <label for="${fieldId}_global_end" class="block text-sm font-medium text-gray-700">End Time</label>
                            <input type="time"
                                   id="${fieldId}_global_end"
                                   value="${escapeHtml(schedule.end_time)}"
                                   onchange="window.LEDMatrixWidgets.getHandlers('schedule-picker').onGlobalTimeChange('${fieldId}')"
                                   class="form-control mt-1">
                            <p class="mt-1 text-sm text-gray-600">When to stop displaying content (HH:MM)</p>
                        </div>
                    </div>
                </div>
            `;

            // Per-day schedule section
            const perDayDisplay = schedule.mode === 'per_day' ? 'block' : 'none';
            html += `
                <div id="${fieldId}_perday_section" style="display: ${perDayDisplay};">
                    <h3 class="text-md font-medium text-gray-900 mb-4">Day-Specific Times</h3>
                    <div class="bg-gray-50 rounded-lg p-4">
                        <div class="overflow-x-auto">
                            <table class="min-w-full divide-y divide-gray-200">
                                <thead>
                                    <tr class="bg-gray-100">
                                        <th class="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Day</th>
                                        <th class="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Enabled</th>
                                        <th class="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Start</th>
                                        <th class="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase">End</th>
                                    </tr>
                                </thead>
                                <tbody class="bg-white divide-y divide-gray-200">
            `;

            // Render each day row
            DAYS.forEach(day => {
                const dayConfig = schedule.days[day];
                const disabled = !dayConfig.enabled;
                const disabledClass = disabled ? 'bg-gray-100' : '';

                html += `
                    <tr class="hover:bg-gray-50" id="${fieldId}_row_${day}">
                        <td class="px-3 py-2 whitespace-nowrap">
                            <span class="text-sm font-medium text-gray-900">${escapeHtml(DAY_LABELS[day])}</span>
                        </td>
                        <td class="px-3 py-2 whitespace-nowrap">
                            <input type="checkbox"
                                   id="${fieldId}_${day}_enabled"
                                   ${dayConfig.enabled ? 'checked' : ''}
                                   onchange="window.LEDMatrixWidgets.getHandlers('schedule-picker').onDayEnabledChange('${fieldId}', '${day}', this.checked)"
                                   class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded">
                        </td>
                        <td class="px-3 py-2 whitespace-nowrap">
                            <input type="time"
                                   id="${fieldId}_${day}_start"
                                   value="${escapeHtml(dayConfig.start_time)}"
                                   ${disabled ? 'disabled' : ''}
                                   onchange="window.LEDMatrixWidgets.getHandlers('schedule-picker').onDayTimeChange('${fieldId}', '${day}')"
                                   class="block w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${disabledClass}">
                        </td>
                        <td class="px-3 py-2 whitespace-nowrap">
                            <input type="time"
                                   id="${fieldId}_${day}_end"
                                   value="${escapeHtml(dayConfig.end_time)}"
                                   ${disabled ? 'disabled' : ''}
                                   onchange="window.LEDMatrixWidgets.getHandlers('schedule-picker').onDayTimeChange('${fieldId}', '${day}')"
                                   class="block w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${disabledClass}">
                        </td>
                    </tr>
                `;
            });

            html += `
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;

            html += '</div>';

            container.innerHTML = html;
        },

        /**
         * Render hidden inputs for form submission
         * These match the existing API format
         */
        _renderHiddenInputs: function(fieldId, schedule) {
            let html = '';

            // Enabled state (hidden input ensures value is always sent, even when checkbox is unchecked)
            html += `<input type="hidden" id="${fieldId}_enabled_hidden" name="enabled" value="${schedule.enabled}">`;

            // Mode indicator (for the widget to track internally)
            html += `<input type="hidden" id="${fieldId}_mode_value" name="mode" value="${schedule.mode}">`;

            // Global times (used when mode is global)
            html += `<input type="hidden" id="${fieldId}_start_time_hidden" name="start_time" value="${escapeHtml(schedule.start_time)}">`;
            html += `<input type="hidden" id="${fieldId}_end_time_hidden" name="end_time" value="${escapeHtml(schedule.end_time)}">`;

            // Per-day values (used when mode is per_day)
            DAYS.forEach(day => {
                const dayConfig = schedule.days[day];
                html += `<input type="hidden" id="${fieldId}_${day}_enabled_hidden" name="${day}_enabled" value="${dayConfig.enabled}">`;
                html += `<input type="hidden" id="${fieldId}_${day}_start_hidden" name="${day}_start" value="${escapeHtml(dayConfig.start_time)}">`;
                html += `<input type="hidden" id="${fieldId}_${day}_end_hidden" name="${day}_end" value="${escapeHtml(dayConfig.end_time)}">`;
            });

            return html;
        },

        /**
         * Get current schedule value
         * @param {string} fieldId - Field ID
         * @returns {Object} Schedule configuration object
         */
        getValue: function(fieldId) {
            const safeId = sanitizeId(fieldId);
            const widget = document.getElementById(`${safeId}_widget`);
            if (!widget) return getDefaultSchedule();

            const enabledCheckbox = document.getElementById(`${safeId}_enabled`);
            const modeGlobal = document.getElementById(`${safeId}_mode_global`);
            const globalStart = document.getElementById(`${safeId}_global_start`);
            const globalEnd = document.getElementById(`${safeId}_global_end`);

            const schedule = {
                enabled: enabledCheckbox ? enabledCheckbox.checked : false,
                mode: (modeGlobal && modeGlobal.checked) ? 'global' : 'per_day',
                start_time: globalStart ? globalStart.value : '07:00',
                end_time: globalEnd ? globalEnd.value : '23:00',
                days: {}
            };

            DAYS.forEach(day => {
                const dayEnabled = document.getElementById(`${safeId}_${day}_enabled`);
                const dayStart = document.getElementById(`${safeId}_${day}_start`);
                const dayEnd = document.getElementById(`${safeId}_${day}_end`);

                schedule.days[day] = {
                    enabled: dayEnabled ? dayEnabled.checked : true,
                    start_time: dayStart ? dayStart.value : '07:00',
                    end_time: dayEnd ? dayEnd.value : '23:00'
                };
            });

            return schedule;
        },

        /**
         * Set schedule value
         * @param {string} fieldId - Field ID
         * @param {Object} value - Schedule configuration object
         */
        setValue: function(fieldId, value) {
            const safeId = sanitizeId(fieldId);
            const schedule = normalizeSchedule(value);

            // Set enabled
            const enabledCheckbox = document.getElementById(`${safeId}_enabled`);
            if (enabledCheckbox) enabledCheckbox.checked = schedule.enabled;

            // Set mode
            const modeGlobal = document.getElementById(`${safeId}_mode_global`);
            const modePerDay = document.getElementById(`${safeId}_mode_per_day`);
            if (modeGlobal) modeGlobal.checked = schedule.mode === 'global';
            if (modePerDay) modePerDay.checked = schedule.mode === 'per_day';

            // Set global times
            const globalStart = document.getElementById(`${safeId}_global_start`);
            const globalEnd = document.getElementById(`${safeId}_global_end`);
            if (globalStart) globalStart.value = schedule.start_time;
            if (globalEnd) globalEnd.value = schedule.end_time;

            // Set per-day values
            DAYS.forEach(day => {
                const dayConfig = schedule.days[day];
                const dayEnabled = document.getElementById(`${safeId}_${day}_enabled`);
                const dayStart = document.getElementById(`${safeId}_${day}_start`);
                const dayEnd = document.getElementById(`${safeId}_${day}_end`);

                if (dayEnabled) dayEnabled.checked = dayConfig.enabled;
                if (dayStart) {
                    dayStart.value = dayConfig.start_time;
                    dayStart.disabled = !dayConfig.enabled;
                    dayStart.classList.toggle('bg-gray-100', !dayConfig.enabled);
                }
                if (dayEnd) {
                    dayEnd.value = dayConfig.end_time;
                    dayEnd.disabled = !dayConfig.enabled;
                    dayEnd.classList.toggle('bg-gray-100', !dayConfig.enabled);
                }
            });

            // Update visibility
            this.handlers.onModeChange(fieldId, schedule.mode);

            // Update hidden inputs
            this._updateHiddenInputs(fieldId);
        },

        /**
         * Update all hidden inputs to match current state
         */
        _updateHiddenInputs: function(fieldId) {
            const safeId = sanitizeId(fieldId);
            const schedule = this.getValue(fieldId);

            // Enabled
            const enabledHidden = document.getElementById(`${safeId}_enabled_hidden`);
            if (enabledHidden) enabledHidden.value = schedule.enabled;

            // Mode
            const modeHidden = document.getElementById(`${safeId}_mode_value`);
            if (modeHidden) modeHidden.value = schedule.mode;

            // Global times
            const startHidden = document.getElementById(`${safeId}_start_time_hidden`);
            const endHidden = document.getElementById(`${safeId}_end_time_hidden`);
            if (startHidden) startHidden.value = schedule.start_time;
            if (endHidden) endHidden.value = schedule.end_time;

            // Per-day values
            DAYS.forEach(day => {
                const dayConfig = schedule.days[day];
                const enabledHidden = document.getElementById(`${safeId}_${day}_enabled_hidden`);
                const startHidden = document.getElementById(`${safeId}_${day}_start_hidden`);
                const endHidden = document.getElementById(`${safeId}_${day}_end_hidden`);

                if (enabledHidden) enabledHidden.value = dayConfig.enabled;
                if (startHidden) startHidden.value = dayConfig.start_time;
                if (endHidden) endHidden.value = dayConfig.end_time;
            });
        },

        handlers: {
            /**
             * Handle enabled toggle change
             */
            onEnabledChange: function(fieldId, enabled) {
                const widget = window.LEDMatrixWidgets.get('schedule-picker');
                widget._updateHiddenInputs(fieldId);
                triggerChange(fieldId, widget.getValue(fieldId));
            },

            /**
             * Handle mode switch
             */
            onModeChange: function(fieldId, mode) {
                const safeId = sanitizeId(fieldId);
                const globalSection = document.getElementById(`${safeId}_global_section`);
                const perDaySection = document.getElementById(`${safeId}_perday_section`);

                if (globalSection) globalSection.style.display = mode === 'global' ? 'block' : 'none';
                if (perDaySection) perDaySection.style.display = mode === 'per_day' ? 'block' : 'none';

                const widget = window.LEDMatrixWidgets.get('schedule-picker');
                widget._updateHiddenInputs(fieldId);
                triggerChange(fieldId, widget.getValue(fieldId));
            },

            /**
             * Handle global time change
             */
            onGlobalTimeChange: function(fieldId) {
                const widget = window.LEDMatrixWidgets.get('schedule-picker');
                widget._updateHiddenInputs(fieldId);
                triggerChange(fieldId, widget.getValue(fieldId));
            },

            /**
             * Handle day enabled change
             */
            onDayEnabledChange: function(fieldId, day, enabled) {
                const safeId = sanitizeId(fieldId);
                const dayStart = document.getElementById(`${safeId}_${day}_start`);
                const dayEnd = document.getElementById(`${safeId}_${day}_end`);

                if (dayStart) {
                    dayStart.disabled = !enabled;
                    dayStart.classList.toggle('bg-gray-100', !enabled);
                    // Set default value only when enabling and input is empty
                    if (enabled && !dayStart.value) {
                        dayStart.value = '07:00';
                    }
                }

                if (dayEnd) {
                    dayEnd.disabled = !enabled;
                    dayEnd.classList.toggle('bg-gray-100', !enabled);
                    // Set default value only when enabling and input is empty
                    if (enabled && !dayEnd.value) {
                        dayEnd.value = '23:00';
                    }
                }

                const widget = window.LEDMatrixWidgets.get('schedule-picker');
                widget._updateHiddenInputs(fieldId);
                triggerChange(fieldId, widget.getValue(fieldId));
            },

            /**
             * Handle day time change
             */
            onDayTimeChange: function(fieldId, day) {
                const widget = window.LEDMatrixWidgets.get('schedule-picker');
                widget._updateHiddenInputs(fieldId);
                triggerChange(fieldId, widget.getValue(fieldId));
            }
        }
    });

    // Expose constants for external use
    window.LEDMatrixWidgets.get('schedule-picker').DAYS = DAYS;
    window.LEDMatrixWidgets.get('schedule-picker').DAY_LABELS = DAY_LABELS;
    window.LEDMatrixWidgets.get('schedule-picker').getDefaultSchedule = getDefaultSchedule;
    window.LEDMatrixWidgets.get('schedule-picker').normalizeSchedule = normalizeSchedule;

    console.log('[SchedulePickerWidget] Schedule picker widget registered');
})();


/* === select-dropdown.js === */
/**
 * LEDMatrix Select Dropdown Widget
 *
 * Enhanced dropdown select with custom labels.
 *
 * Schema example:
 * {
 *   "theme": {
 *     "type": "string",
 *     "x-widget": "select-dropdown",
 *     "enum": ["light", "dark", "auto"],
 *     "x-options": {
 *       "placeholder": "Select a theme...",
 *       "labels": {
 *         "light": "Light Mode",
 *         "dark": "Dark Mode",
 *         "auto": "System Default"
 *       }
 *     }
 *   }
 * }
 *
 * @module SelectDropdownWidget
 */

(function() {
    'use strict';

    const base = window.BaseWidget ? new window.BaseWidget('SelectDropdown', '1.0.0') : null;

    function escapeHtml(text) {
        if (base) return base.escapeHtml(text);
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function sanitizeId(id) {
        if (base) return base.sanitizeId(id);
        return String(id).replace(/[^a-zA-Z0-9_-]/g, '_');
    }

    function triggerChange(fieldId, value) {
        if (base) {
            base.triggerChange(fieldId, value);
        } else {
            const event = new CustomEvent('widget-change', {
                detail: { fieldId, value },
                bubbles: true,
                cancelable: true
            });
            document.dispatchEvent(event);
        }
    }

    // Guard against missing global registry
    if (!window.LEDMatrixWidgets || typeof window.LEDMatrixWidgets.register !== 'function') {
        console.error('[SelectDropdownWidget] LEDMatrixWidgets registry not available');
        return;
    }

    window.LEDMatrixWidgets.register('select-dropdown', {
        name: 'Select Dropdown Widget',
        version: '1.0.0',

        render: function(container, config, value, options) {
            const fieldId = sanitizeId(options.fieldId || container.id || 'select');
            const xOptions = config['x-options'] || config['x_options'] || {};
            const enumValues = config.enum || xOptions.options || [];
            const placeholder = xOptions.placeholder || 'Select...';
            const labels = xOptions.labels || {};
            const icons = xOptions.icons || {};
            const disabled = xOptions.disabled === true;
            const required = xOptions.required === true;

            const currentValue = value !== null && value !== undefined ? String(value) : '';

            let html = `<div id="${fieldId}_widget" class="select-dropdown-widget" data-field-id="${fieldId}">`;

            html += `
                <select id="${fieldId}_input"
                        name="${escapeHtml(options.name || fieldId)}"
                        ${disabled ? 'disabled' : ''}
                        ${required ? 'required' : ''}
                        onchange="window.LEDMatrixWidgets.getHandlers('select-dropdown').onChange('${fieldId}')"
                        class="form-select w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'} text-black">
            `;

            // Placeholder option
            if (placeholder && !required) {
                html += `<option value="" ${!currentValue ? 'selected' : ''}>${escapeHtml(placeholder)}</option>`;
            }

            // Options
            for (const optValue of enumValues) {
                const label = labels[optValue] || String(optValue).replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                const isSelected = String(optValue) === currentValue;
                html += `<option value="${escapeHtml(String(optValue))}" ${isSelected ? 'selected' : ''}>${escapeHtml(label)}</option>`;
            }

            html += '</select>';

            // Error message area
            html += `<div id="${fieldId}_error" class="text-sm text-red-600 mt-1 hidden"></div>`;

            html += '</div>';

            container.innerHTML = html;
        },

        getValue: function(fieldId) {
            const safeId = sanitizeId(fieldId);
            const input = document.getElementById(`${safeId}_input`);
            return input ? input.value : '';
        },

        setValue: function(fieldId, value) {
            const safeId = sanitizeId(fieldId);
            const input = document.getElementById(`${safeId}_input`);
            if (input) {
                input.value = value !== null && value !== undefined ? String(value) : '';
            }
        },

        handlers: {
            onChange: function(fieldId) {
                const widget = window.LEDMatrixWidgets.get('select-dropdown');
                triggerChange(fieldId, widget.getValue(fieldId));
            }
        }
    });

    console.log('[SelectDropdownWidget] Select dropdown widget registered');
})();


/* === slider.js === */
/**
 * LEDMatrix Slider Widget
 *
 * Range slider with value display and optional tick marks.
 *
 * Schema example:
 * {
 *   "volume": {
 *     "type": "number",
 *     "x-widget": "slider",
 *     "minimum": 0,
 *     "maximum": 100,
 *     "x-options": {
 *       "step": 5,
 *       "showValue": true,
 *       "showMinMax": true,
 *       "suffix": "%",
 *       "color": "blue"  // "blue", "green", "red", "purple"
 *     }
 *   }
 * }
 *
 * @module SliderWidget
 */

(function() {
    'use strict';

    const base = window.BaseWidget ? new window.BaseWidget('Slider', '1.0.0') : null;

    function escapeHtml(text) {
        if (base) return base.escapeHtml(text);
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    // Escape for use in HTML attributes (also escapes quotes)
    function escapeAttr(text) {
        return escapeHtml(text).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function sanitizeId(id) {
        if (base) return base.sanitizeId(id);
        return String(id).replace(/[^a-zA-Z0-9_-]/g, '_');
    }

    function triggerChange(fieldId, value) {
        if (base) {
            base.triggerChange(fieldId, value);
        } else {
            const event = new CustomEvent('widget-change', {
                detail: { fieldId, value },
                bubbles: true,
                cancelable: true
            });
            document.dispatchEvent(event);
        }
    }

    const COLOR_CLASSES = {
        blue: 'accent-blue-600',
        green: 'accent-green-600',
        red: 'accent-red-600',
        purple: 'accent-purple-600',
        amber: 'accent-amber-500'
    };

    window.LEDMatrixWidgets.register('slider', {
        name: 'Slider Widget',
        version: '1.0.0',

        render: function(container, config, value, options) {
            const fieldId = sanitizeId(options.fieldId || container.id || 'slider');
            const xOptions = config['x-options'] || config['x_options'] || {};
            const min = config.minimum !== undefined ? config.minimum : (xOptions.min !== undefined ? xOptions.min : 0);
            const max = config.maximum !== undefined ? config.maximum : (xOptions.max !== undefined ? xOptions.max : 100);
            const step = xOptions.step || 1;
            const showValue = xOptions.showValue !== false;
            const showMinMax = xOptions.showMinMax !== false;
            const suffix = xOptions.suffix || '';
            const prefix = xOptions.prefix || '';
            const color = xOptions.color || 'blue';
            const disabled = xOptions.disabled === true;

            const currentValue = value !== null && value !== undefined ? value : min;
            const colorClass = COLOR_CLASSES[color] || COLOR_CLASSES.blue;

            let html = `<div id="${fieldId}_widget" class="slider-widget" data-field-id="${fieldId}" data-prefix="${escapeAttr(prefix)}" data-suffix="${escapeAttr(suffix)}">`;

            // Value display above slider
            if (showValue) {
                html += `
                    <div class="flex justify-center mb-2">
                        <span id="${fieldId}_value" class="text-lg font-semibold text-gray-700">
                            ${escapeHtml(prefix)}${currentValue}${escapeHtml(suffix)}
                        </span>
                    </div>
                `;
            }

            // Slider
            html += `
                <input type="range"
                       id="${fieldId}_input"
                       name="${escapeHtml(options.name || fieldId)}"
                       value="${currentValue}"
                       min="${min}"
                       max="${max}"
                       step="${step}"
                       ${disabled ? 'disabled' : ''}
                       oninput="window.LEDMatrixWidgets.getHandlers('slider').onInput('${fieldId}')"
                       onchange="window.LEDMatrixWidgets.getHandlers('slider').onChange('${fieldId}')"
                       class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer ${colorClass} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}">
            `;

            // Min/Max labels
            if (showMinMax) {
                html += `
                    <div class="flex justify-between mt-1">
                        <span class="text-xs text-gray-400">${escapeHtml(prefix)}${min}${escapeHtml(suffix)}</span>
                        <span class="text-xs text-gray-400">${escapeHtml(prefix)}${max}${escapeHtml(suffix)}</span>
                    </div>
                `;
            }

            html += '</div>';

            container.innerHTML = html;
        },

        getValue: function(fieldId) {
            const safeId = sanitizeId(fieldId);
            const input = document.getElementById(`${safeId}_input`);
            if (!input) return null;
            const num = parseFloat(input.value);
            return isNaN(num) ? null : num;
        },

        setValue: function(fieldId, value) {
            const safeId = sanitizeId(fieldId);
            const input = document.getElementById(`${safeId}_input`);
            const valueEl = document.getElementById(`${safeId}_value`);
            const widget = document.getElementById(`${safeId}_widget`);

            if (input) {
                input.value = value !== null && value !== undefined ? value : input.min;
            }
            if (valueEl && widget && input) {
                const prefix = widget.dataset.prefix || '';
                const suffix = widget.dataset.suffix || '';
                valueEl.textContent = `${prefix}${input.value}${suffix}`;
            }
        },

        handlers: {
            onInput: function(fieldId) {
                const safeId = sanitizeId(fieldId);
                const input = document.getElementById(`${safeId}_input`);
                const valueEl = document.getElementById(`${safeId}_value`);
                const widget = document.getElementById(`${safeId}_widget`);

                if (valueEl && input && widget) {
                    const prefix = widget.dataset.prefix || '';
                    const suffix = widget.dataset.suffix || '';
                    valueEl.textContent = `${prefix}${input.value}${suffix}`;
                }
            },

            onChange: function(fieldId) {
                const widget = window.LEDMatrixWidgets.get('slider');
                triggerChange(fieldId, widget.getValue(fieldId));
            }
        }
    });

    console.log('[SliderWidget] Slider widget registered');
})();


/* === text-input.js === */
/**
 * LEDMatrix Text Input Widget
 *
 * Enhanced text input with validation, placeholder, and pattern support.
 *
 * Schema example:
 * {
 *   "username": {
 *     "type": "string",
 *     "x-widget": "text-input",
 *     "x-options": {
 *       "placeholder": "Enter username",
 *       "pattern": "^[a-zA-Z0-9_]+$",
 *       "patternMessage": "Only letters, numbers, and underscores allowed",
 *       "minLength": 3,
 *       "maxLength": 20,
 *       "prefix": "@",
 *       "suffix": null,
 *       "clearable": true
 *     }
 *   }
 * }
 *
 * @module TextInputWidget
 */

(function() {
    'use strict';

    const base = window.BaseWidget ? new window.BaseWidget('TextInput', '1.0.0') : null;

    function escapeHtml(text) {
        if (base) return base.escapeHtml(text);
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function sanitizeId(id) {
        if (base) return base.sanitizeId(id);
        return String(id).replace(/[^a-zA-Z0-9_-]/g, '_');
    }

    function triggerChange(fieldId, value) {
        if (base) {
            base.triggerChange(fieldId, value);
        } else {
            const event = new CustomEvent('widget-change', {
                detail: { fieldId, value },
                bubbles: true,
                cancelable: true
            });
            document.dispatchEvent(event);
        }
    }

    window.LEDMatrixWidgets.register('text-input', {
        name: 'Text Input Widget',
        version: '1.0.0',

        render: function(container, config, value, options) {
            const fieldId = sanitizeId(options.fieldId || container.id || 'text_input');
            const xOptions = config['x-options'] || config['x_options'] || {};
            const placeholder = xOptions.placeholder || '';
            const pattern = xOptions.pattern || '';
            const patternMessage = xOptions.patternMessage || 'Invalid format';

            // Sanitize minLength/maxLength - must be finite non-negative integers
            const rawMinLength = parseInt(xOptions.minLength, 10);
            const rawMaxLength = parseInt(xOptions.maxLength, 10);
            let minLength = (Number.isFinite(rawMinLength) && rawMinLength >= 0 && rawMinLength <= 10000000)
                ? rawMinLength : null;
            let maxLength = (Number.isFinite(rawMaxLength) && rawMaxLength >= 0 && rawMaxLength <= 10000000)
                ? rawMaxLength : null;

            // Normalize constraints: ensure maxLength >= minLength when both are set
            if (minLength !== null && maxLength !== null && maxLength < minLength) {
                maxLength = minLength;
            }

            const prefix = xOptions.prefix || '';
            const suffix = xOptions.suffix || '';
            const clearable = xOptions.clearable === true;
            const disabled = xOptions.disabled === true;

            const currentValue = value !== null && value !== undefined ? String(value) : '';

            let html = `<div id="${fieldId}_widget" class="text-input-widget" data-field-id="${fieldId}" data-pattern-message="${escapeHtml(patternMessage)}">`;

            // Container for prefix/input/suffix layout
            const hasAddons = prefix || suffix || clearable;
            if (hasAddons) {
                html += '<div class="flex items-center">';
                if (prefix) {
                    html += `<span class="inline-flex items-center px-3 text-sm text-gray-500 bg-gray-100 border border-r-0 border-gray-300 rounded-l-md">${escapeHtml(prefix)}</span>`;
                }
            }

            const roundedClass = hasAddons
                ? (prefix && suffix ? '' : (prefix ? 'rounded-r-md' : 'rounded-l-md'))
                : 'rounded-md';

            html += `
                <input type="text"
                       id="${fieldId}_input"
                       name="${escapeHtml(options.name || fieldId)}"
                       value="${escapeHtml(currentValue)}"
                       placeholder="${escapeHtml(placeholder)}"
                       ${pattern ? `pattern="${escapeHtml(pattern)}"` : ''}
                       ${minLength !== null ? `minlength="${minLength}"` : ''}
                       ${maxLength !== null ? `maxlength="${maxLength}"` : ''}
                       ${disabled ? 'disabled' : ''}
                       onchange="window.LEDMatrixWidgets.getHandlers('text-input').onChange('${fieldId}')"
                       oninput="window.LEDMatrixWidgets.getHandlers('text-input').onInput('${fieldId}')"
                       class="form-input flex-1 ${roundedClass} border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'} text-black placeholder:text-gray-400">
            `;

            if (clearable && !disabled) {
                html += `
                    <button type="button"
                            id="${fieldId}_clear"
                            onclick="window.LEDMatrixWidgets.getHandlers('text-input').onClear('${fieldId}')"
                            class="inline-flex items-center px-2 text-gray-400 hover:text-gray-600 ${currentValue ? '' : 'hidden'}"
                            title="Clear">
                        <i class="fas fa-times"></i>
                    </button>
                `;
            }

            if (suffix) {
                html += `<span class="inline-flex items-center px-3 text-sm text-gray-500 bg-gray-100 border border-l-0 border-gray-300 rounded-r-md">${escapeHtml(suffix)}</span>`;
            }

            if (hasAddons) {
                html += '</div>';
            }

            // Validation message area
            html += `<div id="${fieldId}_error" class="text-sm text-red-600 mt-1 hidden"></div>`;

            // Character count if maxLength specified
            if (maxLength !== null) {
                html += `<div id="${fieldId}_count" class="text-xs text-gray-400 mt-1 text-right">${currentValue.length}/${maxLength}</div>`;
            }

            html += '</div>';

            container.innerHTML = html;
        },

        getValue: function(fieldId) {
            const safeId = sanitizeId(fieldId);
            const input = document.getElementById(`${safeId}_input`);
            return input ? input.value : '';
        },

        setValue: function(fieldId, value) {
            const safeId = sanitizeId(fieldId);
            const input = document.getElementById(`${safeId}_input`);
            if (input) {
                input.value = value !== null && value !== undefined ? String(value) : '';
                this.handlers.onInput(fieldId);
            }
        },

        validate: function(fieldId) {
            const safeId = sanitizeId(fieldId);
            const input = document.getElementById(`${safeId}_input`);
            const errorEl = document.getElementById(`${safeId}_error`);
            const widget = document.getElementById(`${safeId}_widget`);

            if (!input) return { valid: true, errors: [] };

            // Clear any prior custom validity to avoid stale errors
            input.setCustomValidity('');

            let isValid = input.checkValidity();
            let errorMessage = input.validationMessage;

            // Use custom pattern message if pattern mismatch
            if (!isValid && input.validity.patternMismatch && widget) {
                const patternMessage = widget.dataset.patternMessage;
                if (patternMessage) {
                    errorMessage = patternMessage;
                    input.setCustomValidity(patternMessage);
                    // Re-check validity with custom message set
                    isValid = input.checkValidity();
                }
            }

            if (errorEl) {
                if (!isValid) {
                    errorEl.textContent = errorMessage;
                    errorEl.classList.remove('hidden');
                    input.classList.add('border-red-500');
                } else {
                    errorEl.classList.add('hidden');
                    input.classList.remove('border-red-500');
                }
            }

            return { valid: isValid, errors: isValid ? [] : [errorMessage] };
        },

        handlers: {
            onChange: function(fieldId) {
                const widget = window.LEDMatrixWidgets.get('text-input');
                widget.validate(fieldId);
                triggerChange(fieldId, widget.getValue(fieldId));
            },

            onInput: function(fieldId) {
                const safeId = sanitizeId(fieldId);
                const input = document.getElementById(`${safeId}_input`);
                const clearBtn = document.getElementById(`${safeId}_clear`);
                const countEl = document.getElementById(`${safeId}_count`);

                // Clear any stale custom validity to allow form submission after user fixes input
                if (input && input.validity.customError) {
                    input.setCustomValidity('');
                }

                if (clearBtn) {
                    clearBtn.classList.toggle('hidden', !input.value);
                }

                if (countEl && input) {
                    const maxLength = input.maxLength;
                    if (maxLength > 0) {
                        countEl.textContent = `${input.value.length}/${maxLength}`;
                    }
                }
            },

            onClear: function(fieldId) {
                const widget = window.LEDMatrixWidgets.get('text-input');
                widget.setValue(fieldId, '');
                triggerChange(fieldId, '');
            }
        }
    });

    console.log('[TextInputWidget] Text input widget registered');
})();


/* === textarea.js === */
/**
 * LEDMatrix Textarea Widget
 *
 * Multi-line text input with character count and resize options.
 *
 * Schema example:
 * {
 *   "description": {
 *     "type": "string",
 *     "x-widget": "textarea",
 *     "x-options": {
 *       "rows": 4,
 *       "placeholder": "Enter description...",
 *       "maxLength": 500,
 *       "resize": "vertical",  // "none", "vertical", "horizontal", "both"
 *       "showCount": true
 *     }
 *   }
 * }
 *
 * @module TextareaWidget
 */

(function() {
    'use strict';

    const base = window.BaseWidget ? new window.BaseWidget('Textarea', '1.0.0') : null;

    function escapeHtml(text) {
        if (base) return base.escapeHtml(text);
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function sanitizeId(id) {
        if (base) return base.sanitizeId(id);
        return String(id).replace(/[^a-zA-Z0-9_-]/g, '_');
    }

    function triggerChange(fieldId, value) {
        if (base) {
            base.triggerChange(fieldId, value);
        } else {
            const event = new CustomEvent('widget-change', {
                detail: { fieldId, value },
                bubbles: true,
                cancelable: true
            });
            document.dispatchEvent(event);
        }
    }

    const RESIZE_CLASSES = {
        none: 'resize-none',
        vertical: 'resize-y',
        horizontal: 'resize-x',
        both: 'resize'
    };

    window.LEDMatrixWidgets.register('textarea', {
        name: 'Textarea Widget',
        version: '1.0.0',

        render: function(container, config, value, options) {
            const fieldId = sanitizeId(options.fieldId || container.id || 'textarea');
            const xOptions = config['x-options'] || config['x_options'] || {};
            const rows = xOptions.rows || 4;
            const placeholder = xOptions.placeholder || '';
            const maxLength = xOptions.maxLength || config.maxLength || null;
            const minLength = xOptions.minLength || config.minLength || 0;
            const resize = xOptions.resize || 'vertical';
            const showCount = xOptions.showCount !== false && maxLength;
            const disabled = xOptions.disabled === true;

            const currentValue = value !== null && value !== undefined ? String(value) : '';
            const resizeClass = RESIZE_CLASSES[resize] || RESIZE_CLASSES.vertical;

            let html = `<div id="${fieldId}_widget" class="textarea-widget" data-field-id="${fieldId}">`;

            html += `
                <textarea id="${fieldId}_input"
                          name="${escapeHtml(options.name || fieldId)}"
                          rows="${rows}"
                          placeholder="${escapeHtml(placeholder)}"
                          ${maxLength ? `maxlength="${maxLength}"` : ''}
                          ${minLength ? `minlength="${minLength}"` : ''}
                          ${disabled ? 'disabled' : ''}
                          onchange="window.LEDMatrixWidgets.getHandlers('textarea').onChange('${fieldId}')"
                          oninput="window.LEDMatrixWidgets.getHandlers('textarea').onInput('${fieldId}')"
                          class="form-textarea w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 ${resizeClass} ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'} text-black placeholder:text-gray-400">${escapeHtml(currentValue)}</textarea>
            `;

            // Character count
            if (showCount) {
                html += `
                    <div class="flex justify-end mt-1">
                        <span id="${fieldId}_count" class="text-xs text-gray-400">${currentValue.length}/${maxLength}</span>
                    </div>
                `;
            }

            // Error message area
            html += `<div id="${fieldId}_error" class="text-sm text-red-600 mt-1 hidden"></div>`;

            html += '</div>';

            container.innerHTML = html;
        },

        getValue: function(fieldId) {
            const safeId = sanitizeId(fieldId);
            const input = document.getElementById(`${safeId}_input`);
            return input ? input.value : '';
        },

        setValue: function(fieldId, value) {
            const safeId = sanitizeId(fieldId);
            const input = document.getElementById(`${safeId}_input`);
            if (input) {
                input.value = value !== null && value !== undefined ? String(value) : '';
                this.handlers.onInput(fieldId);
            }
        },

        validate: function(fieldId) {
            const safeId = sanitizeId(fieldId);
            const input = document.getElementById(`${safeId}_input`);
            const errorEl = document.getElementById(`${safeId}_error`);

            if (!input) return { valid: true, errors: [] };

            const isValid = input.checkValidity();

            if (errorEl) {
                if (!isValid) {
                    errorEl.textContent = input.validationMessage;
                    errorEl.classList.remove('hidden');
                    input.classList.add('border-red-500');
                } else {
                    errorEl.classList.add('hidden');
                    input.classList.remove('border-red-500');
                }
            }

            return { valid: isValid, errors: isValid ? [] : [input.validationMessage] };
        },

        handlers: {
            onChange: function(fieldId) {
                const widget = window.LEDMatrixWidgets.get('textarea');
                widget.validate(fieldId);
                triggerChange(fieldId, widget.getValue(fieldId));
            },

            onInput: function(fieldId) {
                const safeId = sanitizeId(fieldId);
                const input = document.getElementById(`${safeId}_input`);
                const countEl = document.getElementById(`${safeId}_count`);

                if (countEl && input) {
                    const maxLength = input.maxLength;
                    if (maxLength > 0) {
                        countEl.textContent = `${input.value.length}/${maxLength}`;
                        // Change color when near limit
                        if (input.value.length >= maxLength * 0.9) {
                            countEl.classList.remove('text-gray-400');
                            countEl.classList.add('text-amber-500');
                        } else {
                            countEl.classList.remove('text-amber-500');
                            countEl.classList.add('text-gray-400');
                        }
                    }
                }
            }
        }
    });

    console.log('[TextareaWidget] Textarea widget registered');
})();


/* === time-range.js === */
/**
 * LEDMatrix Time Range Widget
 *
 * Reusable paired start/end time inputs with validation.
 * Can be used by any plugin via x-widget: "time-range" in their schema.
 *
 * Schema example:
 * {
 *   "quiet_hours": {
 *     "type": "object",
 *     "x-widget": "time-range",
 *     "properties": {
 *       "start_time": { "type": "string", "format": "time" },
 *       "end_time": { "type": "string", "format": "time" }
 *     },
 *     "x-options": {
 *       "allowOvernight": true,    // Allow end < start (overnight schedules)
 *       "showDuration": false,     // Show calculated duration
 *       "disabled": false,         // Start disabled
 *       "startLabel": "Start",     // Custom label for start time
 *       "endLabel": "End"          // Custom label for end time
 *     }
 *   }
 * }
 *
 * @module TimeRangeWidget
 */

(function() {
    'use strict';

    // Use BaseWidget utilities if available
    const base = window.BaseWidget ? new window.BaseWidget('TimeRange', '1.0.0') : null;

    function escapeHtml(text) {
        if (base) return base.escapeHtml(text);
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function sanitizeId(id) {
        if (base) return base.sanitizeId(id);
        return String(id).replace(/[^a-zA-Z0-9_-]/g, '_');
    }

    function triggerChange(fieldId, value) {
        if (base) {
            base.triggerChange(fieldId, value);
        } else {
            const event = new CustomEvent('widget-change', {
                detail: { fieldId, value },
                bubbles: true,
                cancelable: true
            });
            document.dispatchEvent(event);
        }
    }

    function showError(container, message) {
        if (base) {
            base.showError(container, message);
        } else {
            clearError(container);
            const errorEl = document.createElement('div');
            errorEl.className = 'widget-error text-sm text-red-600 mt-2';
            errorEl.textContent = message;
            container.appendChild(errorEl);
        }
    }

    function clearError(container) {
        if (base) {
            base.clearError(container);
        } else {
            const errorEl = container.querySelector('.widget-error');
            if (errorEl) errorEl.remove();
        }
    }

    /**
     * Parse time string to minutes since midnight
     * @param {string} timeStr - Time in HH:MM format
     * @returns {number} Minutes since midnight, or -1 if invalid
     */
    function parseTimeToMinutes(timeStr) {
        if (!timeStr || typeof timeStr !== 'string') return -1;
        const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
        if (!match) return -1;
        const hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return -1;
        return hours * 60 + minutes;
    }

    /**
     * Calculate duration between two times
     * @param {string} startTime - Start time HH:MM
     * @param {string} endTime - End time HH:MM
     * @param {boolean} allowOvernight - Whether overnight is allowed
     * @returns {string} Duration string
     */
    function calculateDuration(startTime, endTime, allowOvernight) {
        const startMinutes = parseTimeToMinutes(startTime);
        const endMinutes = parseTimeToMinutes(endTime);

        if (startMinutes < 0 || endMinutes < 0) return '';

        let durationMinutes;
        if (endMinutes >= startMinutes) {
            durationMinutes = endMinutes - startMinutes;
        } else if (allowOvernight) {
            durationMinutes = (24 * 60 - startMinutes) + endMinutes;
        } else {
            return 'Invalid range';
        }

        const hours = Math.floor(durationMinutes / 60);
        const minutes = durationMinutes % 60;

        if (hours === 0) return `${minutes}m`;
        if (minutes === 0) return `${hours}h`;
        return `${hours}h ${minutes}m`;
    }

    window.LEDMatrixWidgets.register('time-range', {
        name: 'Time Range Widget',
        version: '1.0.0',

        /**
         * Render the time range widget
         * @param {HTMLElement} container - Container element
         * @param {Object} config - Schema configuration
         * @param {Object} value - Object with start_time and end_time
         * @param {Object} options - Additional options (fieldId, pluginId)
         */
        render: function(container, config, value, options) {
            const fieldId = sanitizeId(options.fieldId || container.id || 'time_range');
            const xOptions = config['x-options'] || config['x_options'] || {};
            const allowOvernight = xOptions.allowOvernight !== false;
            const showDuration = xOptions.showDuration === true;
            const disabled = xOptions.disabled === true;
            const startLabel = xOptions.startLabel || 'Start Time';
            const endLabel = xOptions.endLabel || 'End Time';

            // Normalize value
            const startTime = (value && value.start_time) || '07:00';
            const endTime = (value && value.end_time) || '23:00';

            const disabledAttr = disabled ? 'disabled' : '';
            const disabledClass = disabled ? 'bg-gray-100 cursor-not-allowed' : '';
            const inputName = options.name || fieldId;

            let html = `<div id="${fieldId}_widget" class="time-range-widget" data-field-id="${fieldId}" data-allow-overnight="${allowOvernight}">`;

            // Hidden inputs for form submission
            html += `<input type="hidden" id="${fieldId}_start_time" name="${inputName}_start_time" value="${escapeHtml(startTime)}">`;
            html += `<input type="hidden" id="${fieldId}_end_time" name="${inputName}_end_time" value="${escapeHtml(endTime)}">`;

            html += `<div class="grid grid-cols-1 md:grid-cols-2 gap-4">`;

            // Start time input
            html += `
                <div class="form-group">
                    <label for="${fieldId}_start_input" class="block text-sm font-medium text-gray-700">${escapeHtml(startLabel)}</label>
                    <input type="time"
                           id="${fieldId}_start_input"
                           value="${escapeHtml(startTime)}"
                           ${disabledAttr}
                           onchange="window.LEDMatrixWidgets.getHandlers('time-range').onChange('${fieldId}')"
                           class="form-control mt-1 ${disabledClass}">
                </div>
            `;

            // End time input
            html += `
                <div class="form-group">
                    <label for="${fieldId}_end_input" class="block text-sm font-medium text-gray-700">${escapeHtml(endLabel)}</label>
                    <input type="time"
                           id="${fieldId}_end_input"
                           value="${escapeHtml(endTime)}"
                           ${disabledAttr}
                           onchange="window.LEDMatrixWidgets.getHandlers('time-range').onChange('${fieldId}')"
                           class="form-control mt-1 ${disabledClass}">
                </div>
            `;

            html += '</div>';

            // Duration display
            if (showDuration) {
                const duration = calculateDuration(startTime, endTime, allowOvernight);
                html += `
                    <div id="${fieldId}_duration" class="mt-2 text-sm text-gray-500">
                        Duration: <span class="font-medium">${escapeHtml(duration)}</span>
                    </div>
                `;
            }

            html += '</div>';

            container.innerHTML = html;
        },

        /**
         * Get current time range value
         * @param {string} fieldId - Field ID
         * @returns {Object} Object with start_time and end_time
         */
        getValue: function(fieldId) {
            const safeId = sanitizeId(fieldId);
            const startInput = document.getElementById(`${safeId}_start_input`);
            const endInput = document.getElementById(`${safeId}_end_input`);

            return {
                start_time: startInput ? startInput.value : '',
                end_time: endInput ? endInput.value : ''
            };
        },

        /**
         * Set time range value
         * @param {string} fieldId - Field ID
         * @param {Object} value - Object with start_time and end_time
         */
        setValue: function(fieldId, value) {
            const safeId = sanitizeId(fieldId);
            const startInput = document.getElementById(`${safeId}_start_input`);
            const endInput = document.getElementById(`${safeId}_end_input`);
            const startHidden = document.getElementById(`${safeId}_start_time`);
            const endHidden = document.getElementById(`${safeId}_end_time`);

            const startTime = (value && value.start_time) || '';
            const endTime = (value && value.end_time) || '';

            if (startInput) startInput.value = startTime;
            if (endInput) endInput.value = endTime;
            if (startHidden) startHidden.value = startTime;
            if (endHidden) endHidden.value = endTime;

            // Update duration if shown
            this.handlers.updateDuration(fieldId);
        },

        /**
         * Validate the time range
         * @param {string} fieldId - Field ID
         * @returns {Object} { valid: boolean, errors: Array }
         */
        validate: function(fieldId) {
            const safeId = sanitizeId(fieldId);
            const widget = document.getElementById(`${safeId}_widget`);
            const value = this.getValue(fieldId);
            const errors = [];

            // Check for empty values
            if (!value.start_time) {
                errors.push('Start time is required');
            }
            if (!value.end_time) {
                errors.push('End time is required');
            }

            // Validate time format
            if (value.start_time && parseTimeToMinutes(value.start_time) < 0) {
                errors.push('Invalid start time format');
            }
            if (value.end_time && parseTimeToMinutes(value.end_time) < 0) {
                errors.push('Invalid end time format');
            }

            // Check for valid range if overnight not allowed
            if (widget && errors.length === 0) {
                const allowOvernight = widget.dataset.allowOvernight === 'true';
                if (!allowOvernight) {
                    const startMinutes = parseTimeToMinutes(value.start_time);
                    const endMinutes = parseTimeToMinutes(value.end_time);
                    if (endMinutes <= startMinutes) {
                        errors.push('End time must be after start time');
                    }
                }
            }

            // Show/clear errors
            if (widget) {
                if (errors.length > 0) {
                    showError(widget, errors[0]);
                } else {
                    clearError(widget);
                }
            }

            return {
                valid: errors.length === 0,
                errors
            };
        },

        /**
         * Set disabled state
         * @param {string} fieldId - Field ID
         * @param {boolean} disabled - Whether to disable
         */
        setDisabled: function(fieldId, disabled) {
            const safeId = sanitizeId(fieldId);
            const startInput = document.getElementById(`${safeId}_start_input`);
            const endInput = document.getElementById(`${safeId}_end_input`);

            if (startInput) {
                startInput.disabled = disabled;
                startInput.classList.toggle('bg-gray-100', disabled);
                startInput.classList.toggle('cursor-not-allowed', disabled);
            }
            if (endInput) {
                endInput.disabled = disabled;
                endInput.classList.toggle('bg-gray-100', disabled);
                endInput.classList.toggle('cursor-not-allowed', disabled);
            }
        },

        handlers: {
            /**
             * Handle time input change
             * @param {string} fieldId - Field ID
             */
            onChange: function(fieldId) {
                const widget = window.LEDMatrixWidgets.get('time-range');
                const value = widget.getValue(fieldId);
                const safeId = sanitizeId(fieldId);

                // Update hidden inputs
                const startHidden = document.getElementById(`${safeId}_start_time`);
                const endHidden = document.getElementById(`${safeId}_end_time`);
                if (startHidden) startHidden.value = value.start_time;
                if (endHidden) endHidden.value = value.end_time;

                // Update duration
                this.updateDuration(fieldId);

                // Validate
                widget.validate(fieldId);

                // Trigger change event
                triggerChange(fieldId, value);
            },

            /**
             * Update duration display
             * @param {string} fieldId - Field ID
             */
            updateDuration: function(fieldId) {
                const safeId = sanitizeId(fieldId);
                const durationEl = document.getElementById(`${safeId}_duration`);
                if (!durationEl) return;

                const widget = window.LEDMatrixWidgets.get('time-range');
                const value = widget.getValue(fieldId);
                const widgetEl = document.getElementById(`${safeId}_widget`);
                const allowOvernight = widgetEl && widgetEl.dataset.allowOvernight === 'true';

                const duration = calculateDuration(value.start_time, value.end_time, allowOvernight);
                const spanEl = durationEl.querySelector('span');
                if (spanEl) {
                    spanEl.textContent = duration;
                }
            }
        }
    });

    // Expose utility functions for external use
    window.LEDMatrixWidgets.get('time-range').parseTimeToMinutes = parseTimeToMinutes;
    window.LEDMatrixWidgets.get('time-range').calculateDuration = calculateDuration;

    console.log('[TimeRangeWidget] Time range widget registered');
})();


/* === timezone-selector.js === */
/**
 * LEDMatrix Timezone Selector Widget
 *
 * Dropdown for selecting IANA timezone with grouped regions.
 *
 * Schema example:
 * {
 *   "timezone": {
 *     "type": "string",
 *     "x-widget": "timezone-selector",
 *     "x-options": {
 *       "showOffset": true,
 *       "placeholder": "Select timezone..."
 *     }
 *   }
 * }
 *
 * @module TimezoneSelectorWidget
 */

(function() {
    'use strict';

    const base = window.BaseWidget ? new window.BaseWidget('TimezoneSelector', '1.0.0') : null;

    function escapeHtml(text) {
        if (base) return base.escapeHtml(text);
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function sanitizeId(id) {
        if (base) return base.sanitizeId(id);
        return String(id).replace(/[^a-zA-Z0-9_-]/g, '_');
    }

    function triggerChange(fieldId, value) {
        if (base) {
            base.triggerChange(fieldId, value);
        } else {
            const event = new CustomEvent('widget-change', {
                detail: { fieldId, value },
                bubbles: true,
                cancelable: true
            });
            document.dispatchEvent(event);
        }
    }

    // IANA timezone list grouped by region
    const TIMEZONE_GROUPS = {
        'US & Canada': [
            { value: 'America/New_York', label: 'Eastern Time (New York)' },
            { value: 'America/Chicago', label: 'Central Time (Chicago)' },
            { value: 'America/Denver', label: 'Mountain Time (Denver)' },
            { value: 'America/Phoenix', label: 'Mountain Time - Arizona (Phoenix)' },
            { value: 'America/Los_Angeles', label: 'Pacific Time (Los Angeles)' },
            { value: 'America/Anchorage', label: 'Alaska Time (Anchorage)' },
            { value: 'Pacific/Honolulu', label: 'Hawaii Time (Honolulu)' },
            { value: 'America/Detroit', label: 'Eastern Time (Detroit)' },
            { value: 'America/Indiana/Indianapolis', label: 'Eastern Time (Indianapolis)' },
            { value: 'America/Toronto', label: 'Eastern Time (Toronto)' },
            { value: 'America/Vancouver', label: 'Pacific Time (Vancouver)' },
            { value: 'America/Edmonton', label: 'Mountain Time (Edmonton)' },
            { value: 'America/Winnipeg', label: 'Central Time (Winnipeg)' },
            { value: 'America/Halifax', label: 'Atlantic Time (Halifax)' },
            { value: 'America/St_Johns', label: 'Newfoundland Time (St. Johns)' }
        ],
        'Mexico & Central America': [
            { value: 'America/Mexico_City', label: 'Mexico City' },
            { value: 'America/Cancun', label: 'Cancun' },
            { value: 'America/Tijuana', label: 'Tijuana' },
            { value: 'America/Guatemala', label: 'Guatemala' },
            { value: 'America/Costa_Rica', label: 'Costa Rica' },
            { value: 'America/Panama', label: 'Panama' },
            { value: 'America/El_Salvador', label: 'El Salvador' },
            { value: 'America/Tegucigalpa', label: 'Honduras' },
            { value: 'America/Managua', label: 'Nicaragua' },
            { value: 'America/Belize', label: 'Belize' }
        ],
        'South America': [
            { value: 'America/Sao_Paulo', label: 'Sao Paulo' },
            { value: 'America/Buenos_Aires', label: 'Buenos Aires' },
            { value: 'America/Santiago', label: 'Santiago' },
            { value: 'America/Lima', label: 'Lima' },
            { value: 'America/Bogota', label: 'Bogota' },
            { value: 'America/Caracas', label: 'Caracas' },
            { value: 'America/La_Paz', label: 'La Paz' },
            { value: 'America/Montevideo', label: 'Montevideo' },
            { value: 'America/Asuncion', label: 'Asuncion' },
            { value: 'America/Guayaquil', label: 'Guayaquil' }
        ],
        'Europe': [
            { value: 'Europe/London', label: 'London (GMT/BST)' },
            { value: 'Europe/Dublin', label: 'Dublin' },
            { value: 'Europe/Paris', label: 'Paris' },
            { value: 'Europe/Berlin', label: 'Berlin' },
            { value: 'Europe/Madrid', label: 'Madrid' },
            { value: 'Europe/Rome', label: 'Rome' },
            { value: 'Europe/Amsterdam', label: 'Amsterdam' },
            { value: 'Europe/Brussels', label: 'Brussels' },
            { value: 'Europe/Vienna', label: 'Vienna' },
            { value: 'Europe/Zurich', label: 'Zurich' },
            { value: 'Europe/Stockholm', label: 'Stockholm' },
            { value: 'Europe/Oslo', label: 'Oslo' },
            { value: 'Europe/Copenhagen', label: 'Copenhagen' },
            { value: 'Europe/Helsinki', label: 'Helsinki' },
            { value: 'Europe/Warsaw', label: 'Warsaw' },
            { value: 'Europe/Prague', label: 'Prague' },
            { value: 'Europe/Budapest', label: 'Budapest' },
            { value: 'Europe/Athens', label: 'Athens' },
            { value: 'Europe/Bucharest', label: 'Bucharest' },
            { value: 'Europe/Sofia', label: 'Sofia' },
            { value: 'Europe/Lisbon', label: 'Lisbon' },
            { value: 'Europe/Moscow', label: 'Moscow' },
            { value: 'Europe/Kyiv', label: 'Kyiv' },
            { value: 'Europe/Istanbul', label: 'Istanbul' }
        ],
        'UK & Ireland': [
            { value: 'Europe/London', label: 'London' },
            { value: 'Europe/Dublin', label: 'Dublin' },
            { value: 'Europe/London', label: 'Belfast' }  // Belfast uses Europe/London (canonical IANA identifier)
        ],
        'Asia': [
            { value: 'Asia/Tokyo', label: 'Tokyo' },
            { value: 'Asia/Seoul', label: 'Seoul' },
            { value: 'Asia/Shanghai', label: 'Shanghai' },
            { value: 'Asia/Hong_Kong', label: 'Hong Kong' },
            { value: 'Asia/Taipei', label: 'Taipei' },
            { value: 'Asia/Singapore', label: 'Singapore' },
            { value: 'Asia/Kuala_Lumpur', label: 'Kuala Lumpur' },
            { value: 'Asia/Bangkok', label: 'Bangkok' },
            { value: 'Asia/Ho_Chi_Minh', label: 'Ho Chi Minh City' },
            { value: 'Asia/Jakarta', label: 'Jakarta' },
            { value: 'Asia/Manila', label: 'Manila' },
            { value: 'Asia/Kolkata', label: 'India (Kolkata)' },
            { value: 'Asia/Mumbai', label: 'Mumbai' },
            { value: 'Asia/Dhaka', label: 'Dhaka' },
            { value: 'Asia/Karachi', label: 'Karachi' },
            { value: 'Asia/Dubai', label: 'Dubai' },
            { value: 'Asia/Riyadh', label: 'Riyadh' },
            { value: 'Asia/Jerusalem', label: 'Jerusalem' },
            { value: 'Asia/Tehran', label: 'Tehran' },
            { value: 'Asia/Kabul', label: 'Kabul' },
            { value: 'Asia/Kathmandu', label: 'Kathmandu' },
            { value: 'Asia/Colombo', label: 'Colombo' },
            { value: 'Asia/Yangon', label: 'Yangon' }
        ],
        'Australia & Pacific': [
            { value: 'Australia/Sydney', label: 'Sydney' },
            { value: 'Australia/Melbourne', label: 'Melbourne' },
            { value: 'Australia/Brisbane', label: 'Brisbane' },
            { value: 'Australia/Perth', label: 'Perth' },
            { value: 'Australia/Adelaide', label: 'Adelaide' },
            { value: 'Australia/Darwin', label: 'Darwin' },
            { value: 'Australia/Hobart', label: 'Hobart' },
            { value: 'Pacific/Auckland', label: 'Auckland' },
            { value: 'Pacific/Fiji', label: 'Fiji' },
            { value: 'Pacific/Guam', label: 'Guam' },
            { value: 'Pacific/Port_Moresby', label: 'Port Moresby' },
            { value: 'Pacific/Noumea', label: 'Noumea' }
        ],
        'Africa': [
            { value: 'Africa/Cairo', label: 'Cairo' },
            { value: 'Africa/Johannesburg', label: 'Johannesburg' },
            { value: 'Africa/Lagos', label: 'Lagos' },
            { value: 'Africa/Nairobi', label: 'Nairobi' },
            { value: 'Africa/Casablanca', label: 'Casablanca' },
            { value: 'Africa/Algiers', label: 'Algiers' },
            { value: 'Africa/Tunis', label: 'Tunis' },
            { value: 'Africa/Accra', label: 'Accra' },
            { value: 'Africa/Addis_Ababa', label: 'Addis Ababa' },
            { value: 'Africa/Dar_es_Salaam', label: 'Dar es Salaam' }
        ],
        'Atlantic': [
            { value: 'Atlantic/Reykjavik', label: 'Reykjavik (Iceland)' },
            { value: 'Atlantic/Azores', label: 'Azores' },
            { value: 'Atlantic/Cape_Verde', label: 'Cape Verde' },
            { value: 'Atlantic/Bermuda', label: 'Bermuda' }
        ],
        'UTC': [
            { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
            { value: 'Etc/GMT', label: 'GMT (Greenwich Mean Time)' },
            { value: 'Etc/GMT+0', label: 'GMT+0' },
            { value: 'Etc/GMT-1', label: 'GMT-1 (UTC+1)' },
            { value: 'Etc/GMT-2', label: 'GMT-2 (UTC+2)' },
            { value: 'Etc/GMT+1', label: 'GMT+1 (UTC-1)' },
            { value: 'Etc/GMT+2', label: 'GMT+2 (UTC-2)' }
        ]
    };

    // Check if a timezone value exists in TIMEZONE_GROUPS
    function isValidTimezone(value) {
        if (!value || typeof value !== 'string') return false;
        for (const timezones of Object.values(TIMEZONE_GROUPS)) {
            for (const tz of timezones) {
                if (tz.value === value) return true;
            }
        }
        return false;
    }

    // Get current UTC offset for a timezone
    function getTimezoneOffset(tz) {
        try {
            const now = new Date();
            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone: tz,
                timeZoneName: 'shortOffset'
            });
            const parts = formatter.formatToParts(now);
            const offsetPart = parts.find(p => p.type === 'timeZoneName');
            return offsetPart ? offsetPart.value : '';
        } catch (e) {
            return '';
        }
    }

    window.LEDMatrixWidgets.register('timezone-selector', {
        name: 'Timezone Selector Widget',
        version: '1.0.0',

        render: function(container, config, value, options) {
            const fieldId = sanitizeId(options.fieldId || container.id || 'timezone_selector');
            const xOptions = config['x-options'] || config['x_options'] || {};
            const showOffset = xOptions.showOffset !== false;
            const placeholder = xOptions.placeholder || 'Select timezone...';
            const disabled = xOptions.disabled === true;

            // Validate current value - must be a recognized timezone from TIMEZONE_GROUPS
            const trimmedValue = (typeof value === 'string' && value.trim()) ? value.trim() : '';
            const currentValue = isValidTimezone(trimmedValue) ? trimmedValue : '';

            let html = `<div id="${fieldId}_widget" class="timezone-selector-widget" data-field-id="${fieldId}">`;

            // Hidden input for form submission
            html += `<input type="hidden" id="${fieldId}_data" name="${escapeHtml(options.name || fieldId)}" value="${escapeHtml(currentValue)}">`;

            html += `
                <select id="${fieldId}_input"
                        ${disabled ? 'disabled' : ''}
                        onchange="window.LEDMatrixWidgets.getHandlers('timezone-selector').onChange('${fieldId}')"
                        class="form-select w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'} text-black">
            `;

            // Placeholder option
            html += `<option value="" ${!currentValue ? 'selected' : ''} disabled>${escapeHtml(placeholder)}</option>`;

            // Build options grouped by region
            for (const [groupName, timezones] of Object.entries(TIMEZONE_GROUPS)) {
                html += `<optgroup label="${escapeHtml(groupName)}">`;

                for (const tz of timezones) {
                    const isSelected = currentValue === tz.value;
                    let displayLabel = tz.label;

                    // Add UTC offset if enabled
                    if (showOffset) {
                        const offset = getTimezoneOffset(tz.value);
                        if (offset) {
                            displayLabel = `${tz.label} (${offset})`;
                        }
                    }

                    html += `<option value="${escapeHtml(tz.value)}" ${isSelected ? 'selected' : ''}>${escapeHtml(displayLabel)}</option>`;
                }

                html += '</optgroup>';
            }

            html += '</select>';

            // Show current time in selected timezone
            html += `<div id="${fieldId}_preview" class="text-sm text-gray-500 mt-2 ${currentValue ? '' : 'hidden'}">
                <span class="font-medium">Current time:</span>
                <span id="${fieldId}_time"></span>
            </div>`;

            html += '</div>';

            container.innerHTML = html;

            // Update time preview if value is set
            if (currentValue) {
                this.handlers.updateTimePreview(fieldId, currentValue);
            }
        },

        getValue: function(fieldId) {
            const safeId = sanitizeId(fieldId);
            const input = document.getElementById(`${safeId}_input`);
            return input ? input.value : '';
        },

        setValue: function(fieldId, value) {
            const safeId = sanitizeId(fieldId);
            const select = document.getElementById(`${safeId}_input`);
            const hiddenInput = document.getElementById(`${safeId}_data`);

            // Validate incoming value against known timezones
            const requestedValue = (typeof value === 'string' && value.trim()) ? value.trim() : '';
            const validValue = isValidTimezone(requestedValue) ? requestedValue : '';

            if (select) {
                // Only set to a value that exists in the select options
                select.value = validValue;
            }

            // Read the actual selected value from the select element
            const actualValue = select ? select.value : '';

            if (hiddenInput) {
                // Synchronize hidden input to the actual selected value
                hiddenInput.value = actualValue;
            }

            this.handlers.updateTimePreview(fieldId, actualValue);
        },

        handlers: {
            onChange: function(fieldId) {
                const safeId = sanitizeId(fieldId);
                const widget = window.LEDMatrixWidgets.get('timezone-selector');
                const value = widget.getValue(fieldId);

                // Update hidden input for form submission
                const hiddenInput = document.getElementById(`${safeId}_data`);
                if (hiddenInput) {
                    hiddenInput.value = value;
                }

                widget.handlers.updateTimePreview(fieldId, value);
                triggerChange(fieldId, value);
            },

            updateTimePreview: function(fieldId, timezone) {
                const safeId = sanitizeId(fieldId);
                const previewEl = document.getElementById(`${safeId}_preview`);
                const timeEl = document.getElementById(`${safeId}_time`);

                if (!previewEl || !timeEl) return;

                if (!timezone) {
                    previewEl.classList.add('hidden');
                    return;
                }

                try {
                    const now = new Date();
                    const formatter = new Intl.DateTimeFormat('en-US', {
                        timeZone: timezone,
                        weekday: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: true
                    });
                    timeEl.textContent = formatter.format(now);
                    previewEl.classList.remove('hidden');
                } catch (e) {
                    previewEl.classList.add('hidden');
                }
            }
        }
    });

    // Expose timezone data for external use
    window.LEDMatrixWidgets.get('timezone-selector').TIMEZONE_GROUPS = TIMEZONE_GROUPS;

    // HTMX form submission protection - preserve timezone selection across requests
    // This handles cases where HTMX or other form handling might reset select values
    (function setupHtmxProtection() {
        let savedTimezoneValues = {};

        // Before any HTMX request, save timezone select values (including empty selections)
        document.body.addEventListener('htmx:beforeRequest', function(event) {
            document.querySelectorAll('.timezone-selector-widget').forEach(function(widget) {
                const fieldId = widget.dataset.fieldId;
                if (fieldId) {
                    const select = document.getElementById(fieldId + '_input');
                    // Record value even if empty to preserve cleared selections
                    savedTimezoneValues[fieldId] = select ? select.value : '';
                }
            });
        });

        // After any HTMX request, restore timezone select values
        document.body.addEventListener('htmx:afterRequest', function(event) {
            // Delay to ensure any DOM updates have completed
            setTimeout(function() {
                Object.keys(savedTimezoneValues).forEach(function(fieldId) {
                    const select = document.getElementById(fieldId + '_input');
                    const hidden = document.getElementById(fieldId + '_data');
                    const savedValue = savedTimezoneValues[fieldId];

                    // Check for undefined, not truthiness, so empty strings are restored
                    if (select && savedValue !== undefined) {
                        // Set value directly (handles empty string and placeholders correctly)
                        select.value = savedValue;

                        // Dispatch change event to trigger timezone preview update
                        select.dispatchEvent(new Event('change'));

                        // Force browser to repaint by temporarily modifying a style
                        select.style.display = 'none';
                        void select.offsetHeight;
                        select.style.display = '';
                    }
                    if (hidden && savedValue !== undefined) {
                        hidden.value = savedValue;
                    }
                });
            }, 50);
        });
    })();

    console.log('[TimezoneSelectorWidget] Timezone selector widget registered');
})();


/* === toggle-switch.js === */
/**
 * LEDMatrix Toggle Switch Widget
 *
 * Styled boolean toggle switch (more visual than checkbox).
 *
 * Schema example:
 * {
 *   "enabled": {
 *     "type": "boolean",
 *     "x-widget": "toggle-switch",
 *     "x-options": {
 *       "labelOn": "Enabled",
 *       "labelOff": "Disabled",
 *       "size": "medium",  // "small", "medium", "large"
 *       "colorOn": "blue", // "blue", "green", "red", "purple"
 *       "showLabels": true
 *     }
 *   }
 * }
 *
 * @module ToggleSwitchWidget
 */

(function() {
    'use strict';

    const base = window.BaseWidget ? new window.BaseWidget('ToggleSwitch', '1.0.0') : null;

    function escapeHtml(text) {
        if (base) return base.escapeHtml(text);
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function sanitizeId(id) {
        if (base) return base.sanitizeId(id);
        return String(id).replace(/[^a-zA-Z0-9_-]/g, '_');
    }

    function triggerChange(fieldId, value) {
        if (base) {
            base.triggerChange(fieldId, value);
        } else {
            const event = new CustomEvent('widget-change', {
                detail: { fieldId, value },
                bubbles: true,
                cancelable: true
            });
            document.dispatchEvent(event);
        }
    }

    const SIZE_CLASSES = {
        small: {
            track: 'w-8 h-4',
            thumb: 'w-3 h-3',
            translate: 'translate-x-4'
        },
        medium: {
            track: 'w-11 h-6',
            thumb: 'w-5 h-5',
            translate: 'translate-x-5'
        },
        large: {
            track: 'w-14 h-7',
            thumb: 'w-6 h-6',
            translate: 'translate-x-7'
        }
    };

    const COLOR_CLASSES = {
        blue: 'bg-blue-600',
        green: 'bg-green-600',
        red: 'bg-red-600',
        purple: 'bg-purple-600',
        amber: 'bg-amber-500'
    };

    window.LEDMatrixWidgets.register('toggle-switch', {
        name: 'Toggle Switch Widget',
        version: '1.0.0',

        render: function(container, config, value, options) {
            const fieldId = sanitizeId(options.fieldId || container.id || 'toggle');
            const xOptions = config['x-options'] || config['x_options'] || {};
            const labelOn = xOptions.labelOn || 'On';
            const labelOff = xOptions.labelOff || 'Off';
            const size = xOptions.size || 'medium';
            const colorOn = xOptions.colorOn || 'blue';
            const showLabels = xOptions.showLabels !== false;
            const disabled = xOptions.disabled === true;

            const isChecked = value === true || value === 'true';
            const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.medium;
            const colorClass = COLOR_CLASSES[colorOn] || COLOR_CLASSES.blue;

            let html = `<div id="${fieldId}_widget" class="toggle-switch-widget flex items-center" data-field-id="${fieldId}" data-label-on="${escapeHtml(labelOn)}" data-label-off="${escapeHtml(labelOff)}" data-color="${colorOn}">`;

            // Hidden checkbox for form submission
            html += `<input type="hidden" id="${fieldId}_hidden" name="${escapeHtml(options.name || fieldId)}" value="${isChecked}">`;

            html += `
                <button type="button"
                        id="${fieldId}_button"
                        role="switch"
                        aria-checked="${isChecked}"
                        ${disabled ? 'disabled' : ''}
                        onclick="window.LEDMatrixWidgets.getHandlers('toggle-switch').onToggle('${fieldId}')"
                        class="relative inline-flex flex-shrink-0 ${sizeClass.track} border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${isChecked ? colorClass : 'bg-gray-200'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}">
                    <span class="sr-only">Toggle</span>
                    <span id="${fieldId}_thumb"
                          class="pointer-events-none inline-block ${sizeClass.thumb} rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200 ${isChecked ? sizeClass.translate : 'translate-x-0'}"></span>
                </button>
            `;

            // Label
            if (showLabels) {
                html += `
                    <span id="${fieldId}_label" class="ml-3 text-sm font-medium ${isChecked ? 'text-gray-900' : 'text-gray-500'}">
                        ${escapeHtml(isChecked ? labelOn : labelOff)}
                    </span>
                `;
            }

            html += '</div>';

            container.innerHTML = html;
        },

        getValue: function(fieldId) {
            const safeId = sanitizeId(fieldId);
            const hidden = document.getElementById(`${safeId}_hidden`);
            return hidden ? hidden.value === 'true' : false;
        },

        setValue: function(fieldId, value) {
            const safeId = sanitizeId(fieldId);
            const isChecked = value === true || value === 'true';

            const hidden = document.getElementById(`${safeId}_hidden`);
            const button = document.getElementById(`${safeId}_button`);
            const thumb = document.getElementById(`${safeId}_thumb`);
            const label = document.getElementById(`${safeId}_label`);
            const widget = document.getElementById(`${safeId}_widget`);

            if (hidden) hidden.value = isChecked;

            if (button) {
                button.setAttribute('aria-checked', isChecked);
                // Get color from widget data attribute (preferred) or scan button classes
                const colorClasses = Object.values(COLOR_CLASSES);
                let currentColor = 'bg-blue-600';

                // First try to get from widget data attribute
                if (widget && widget.dataset.color) {
                    const configuredColor = COLOR_CLASSES[widget.dataset.color];
                    if (configuredColor) {
                        currentColor = configuredColor;
                    }
                } else {
                    // Fall back to scanning button classes
                    for (const cls of colorClasses) {
                        if (button.classList.contains(cls)) {
                            currentColor = cls;
                            break;
                        }
                    }
                }

                if (isChecked) {
                    button.classList.remove('bg-gray-200');
                    button.classList.add(currentColor);
                } else {
                    button.classList.remove(...colorClasses);
                    button.classList.add('bg-gray-200');
                }
            }

            if (thumb) {
                // Determine size from current translate class
                const sizeKeys = Object.keys(SIZE_CLASSES);
                for (const sizeKey of sizeKeys) {
                    const sizeClass = SIZE_CLASSES[sizeKey];
                    if (thumb.classList.contains(sizeClass.thumb)) {
                        if (isChecked) {
                            thumb.classList.remove('translate-x-0');
                            thumb.classList.add(sizeClass.translate);
                        } else {
                            thumb.classList.remove(sizeClass.translate);
                            thumb.classList.add('translate-x-0');
                        }
                        break;
                    }
                }
            }

            if (label) {
                // Get labels from widget data attributes or default
                const labelOn = widget?.dataset.labelOn || 'On';
                const labelOff = widget?.dataset.labelOff || 'Off';
                label.textContent = isChecked ? labelOn : labelOff;
                if (isChecked) {
                    label.classList.remove('text-gray-500');
                    label.classList.add('text-gray-900');
                } else {
                    label.classList.remove('text-gray-900');
                    label.classList.add('text-gray-500');
                }
            }
        },

        handlers: {
            onToggle: function(fieldId) {
                const widget = window.LEDMatrixWidgets.get('toggle-switch');
                const currentValue = widget.getValue(fieldId);
                const newValue = !currentValue;
                widget.setValue(fieldId, newValue);
                triggerChange(fieldId, newValue);
            }
        }
    });

    console.log('[ToggleSwitchWidget] Toggle switch widget registered');
})();


/* === url-input.js === */
/**
 * LEDMatrix URL Input Widget
 *
 * URL input with validation and protocol handling.
 *
 * Schema example:
 * {
 *   "website": {
 *     "type": "string",
 *     "format": "uri",
 *     "x-widget": "url-input",
 *     "x-options": {
 *       "placeholder": "https://example.com",
 *       "showIcon": true,
 *       "allowedProtocols": ["http", "https"],
 *       "showPreview": true
 *     }
 *   }
 * }
 *
 * @module UrlInputWidget
 */

(function() {
    'use strict';

    const base = window.BaseWidget ? new window.BaseWidget('UrlInput', '1.0.0') : null;

    function escapeHtml(text) {
        if (base) return base.escapeHtml(text);
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function sanitizeId(id) {
        if (base) return base.sanitizeId(id);
        return String(id).replace(/[^a-zA-Z0-9_-]/g, '_');
    }

    function triggerChange(fieldId, value) {
        if (base) {
            base.triggerChange(fieldId, value);
        } else {
            const event = new CustomEvent('widget-change', {
                detail: { fieldId, value },
                bubbles: true,
                cancelable: true
            });
            document.dispatchEvent(event);
        }
    }

    // RFC 3986 scheme pattern: starts with letter, then letters/digits/+/./-
    const RFC_SCHEME_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*$/;

    /**
     * Normalize and validate protocol list against RFC 3986 scheme pattern.
     * Accepts schemes like "http", "https", "git+ssh", "android-app", etc.
     * @param {Array|string} protocols - Protocol list (array or comma-separated string)
     * @returns {Array} Normalized lowercase protocols, defaults to ['http', 'https']
     */
    function normalizeProtocols(protocols) {
        let list = protocols;
        if (typeof list === 'string') {
            list = list.split(',').map(p => p.trim()).filter(p => p);
        } else if (!Array.isArray(list)) {
            return ['http', 'https'];
        }
        const normalized = list
            .map(p => String(p).trim())
            .filter(p => RFC_SCHEME_PATTERN.test(p))
            .map(p => p.toLowerCase());
        return normalized.length > 0 ? normalized : ['http', 'https'];
    }

    function isValidUrl(string, allowedProtocols) {
        try {
            const url = new URL(string);
            if (allowedProtocols && allowedProtocols.length > 0) {
                const protocol = url.protocol.replace(':', '').toLowerCase();
                return allowedProtocols.includes(protocol);
            }
            return true;
        } catch (_) {
            return false;
        }
    }

    window.LEDMatrixWidgets.register('url-input', {
        name: 'URL Input Widget',
        version: '1.0.0',

        render: function(container, config, value, options) {
            const fieldId = sanitizeId(options.fieldId || container.id || 'url_input');
            const xOptions = config['x-options'] || config['x_options'] || {};
            const placeholder = xOptions.placeholder || 'https://example.com';
            const showIcon = xOptions.showIcon !== false;
            const showPreview = xOptions.showPreview === true;
            // Normalize allowedProtocols using RFC 3986 validation
            const allowedProtocols = normalizeProtocols(xOptions.allowedProtocols);

            const disabled = xOptions.disabled === true;
            const required = xOptions.required === true;

            const currentValue = value || '';

            // Escape the protocols for safe HTML attribute interpolation
            const escapedProtocols = escapeHtml(allowedProtocols.join(','));
            let html = `<div id="${fieldId}_widget" class="url-input-widget" data-field-id="${fieldId}" data-protocols="${escapedProtocols}">`;

            html += '<div class="relative">';

            if (showIcon) {
                html += `
                    <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <i class="fas fa-link text-gray-400"></i>
                    </div>
                `;
            }

            html += `
                <input type="url"
                       id="${fieldId}_input"
                       name="${escapeHtml(options.name || fieldId)}"
                       value="${escapeHtml(currentValue)}"
                       placeholder="${escapeHtml(placeholder)}"
                       ${disabled ? 'disabled' : ''}
                       ${required ? 'required' : ''}
                       onchange="window.LEDMatrixWidgets.getHandlers('url-input').onChange('${fieldId}')"
                       oninput="window.LEDMatrixWidgets.getHandlers('url-input').onInput('${fieldId}')"
                       class="form-input w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 ${showIcon ? 'pl-10' : ''} ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'} text-black placeholder:text-gray-400">
            `;

            html += '</div>';

            // Preview link (if enabled and value exists)
            if (showPreview) {
                html += `
                    <div id="${fieldId}_preview" class="mt-2 ${currentValue && isValidUrl(currentValue, allowedProtocols) ? '' : 'hidden'}">
                        <a id="${fieldId}_preview_link"
                           href="${escapeHtml(currentValue)}"
                           target="_blank"
                           rel="noopener noreferrer"
                           class="text-sm text-blue-600 hover:text-blue-800 flex items-center">
                            <i class="fas fa-external-link-alt mr-1 text-xs"></i>
                            <span>Open link in new tab</span>
                        </a>
                    </div>
                `;
            }

            // Error message area
            html += `<div id="${fieldId}_error" class="text-sm text-red-600 mt-1 hidden"></div>`;

            html += '</div>';

            container.innerHTML = html;
        },

        getValue: function(fieldId) {
            const safeId = sanitizeId(fieldId);
            const input = document.getElementById(`${safeId}_input`);
            return input ? input.value : '';
        },

        setValue: function(fieldId, value) {
            const safeId = sanitizeId(fieldId);
            const input = document.getElementById(`${safeId}_input`);
            if (input) {
                input.value = value || '';
                this.handlers.onInput(fieldId);
            }
        },

        validate: function(fieldId) {
            const safeId = sanitizeId(fieldId);
            const input = document.getElementById(`${safeId}_input`);
            const errorEl = document.getElementById(`${safeId}_error`);
            const widget = document.getElementById(`${safeId}_widget`);

            if (!input) return { valid: true, errors: [] };

            const value = input.value;
            const protocols = normalizeProtocols(widget?.dataset.protocols);

            let isValid = true;
            let errorMsg = '';

            // First check browser validation (required, type, etc.)
            if (!input.checkValidity()) {
                isValid = false;
                errorMsg = input.validationMessage;
            } else if (value) {
                // Then check custom protocol validation
                if (!isValidUrl(value, protocols)) {
                    isValid = false;
                    errorMsg = `Please enter a valid URL (${protocols.join(', ')} only)`;
                }
            }

            if (errorEl) {
                if (!isValid) {
                    errorEl.textContent = errorMsg;
                    errorEl.classList.remove('hidden');
                    input.classList.add('border-red-500');
                } else {
                    errorEl.classList.add('hidden');
                    input.classList.remove('border-red-500');
                }
            }

            return { valid: isValid, errors: isValid ? [] : [errorMsg] };
        },

        handlers: {
            onChange: function(fieldId) {
                const widget = window.LEDMatrixWidgets.get('url-input');
                widget.validate(fieldId);
                triggerChange(fieldId, widget.getValue(fieldId));
            },

            onInput: function(fieldId) {
                const safeId = sanitizeId(fieldId);
                const input = document.getElementById(`${safeId}_input`);
                const previewEl = document.getElementById(`${safeId}_preview`);
                const previewLink = document.getElementById(`${safeId}_preview_link`);
                const widgetEl = document.getElementById(`${safeId}_widget`);

                const value = input?.value || '';
                const protocols = normalizeProtocols(widgetEl?.dataset.protocols);

                if (previewEl && previewLink) {
                    if (value && isValidUrl(value, protocols)) {
                        previewLink.href = value;
                        previewEl.classList.remove('hidden');
                    } else {
                        previewEl.classList.add('hidden');
                    }
                }

                // Validate on input
                const widget = window.LEDMatrixWidgets.get('url-input');
                widget.validate(fieldId);
            }
        }
    });

    console.log('[UrlInputWidget] URL input widget registered');
})();
