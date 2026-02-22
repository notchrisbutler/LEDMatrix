/**
 * Plugin tab management, plugin config helpers, display preview, and plugin CRUD functions.
 * Handles dynamic plugin tab creation/management in the sidebar,
 * plugin toggle/configure/install/uninstall, and display preview rendering.
 * Loaded with defer — runs after DOM parse.
 */
// ===== DEPRECATED: Plugin Configuration Functions (Global Access) =====
// These functions are no longer the primary method for loading plugin configs.
// Plugin configuration forms are now rendered server-side via HTMX.
// See: /v3/partials/plugin-config/<plugin_id> for the new implementation.
// Kept for backwards compatibility with any remaining client-side code.
window.PluginConfigHelpers = {
    loadPluginConfig: async function(pluginId, componentContext) {
        // This function can be called from inline components
        // It loads config, schema, and updates the component context
        if (!componentContext) {
            console.error('loadPluginConfig requires component context');
            return;
        }

        console.log('Loading config for plugin:', pluginId);
        componentContext.loading = true;

        try {
            // Load config, schema, and installed plugins (for web_ui_actions) in parallel
            let configData, schemaData, pluginsData;

            if (window.PluginAPI && window.PluginAPI.batch) {
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
                componentContext.config = configData.data;
            } else {
                console.warn('Config API returned non-success status:', configData);
                // Set defaults if config failed to load
                componentContext.config = { enabled: true, display_duration: 30 };
            }

            if (schemaData && schemaData.status === 'success') {
                componentContext.schema = schemaData.data.schema || {};
            } else {
                console.warn('Schema API returned non-success status:', schemaData);
                // Set empty schema as fallback
                componentContext.schema = {};
            }

            if (pluginsData && pluginsData.status === 'success' && pluginsData.data && pluginsData.data.plugins) {
                const pluginInfo = pluginsData.data.plugins.find(p => p.id === pluginId);
                componentContext.webUiActions = pluginInfo ? (pluginInfo.web_ui_actions || []) : [];
            } else {
                console.warn('Plugins API returned non-success status:', pluginsData);
                componentContext.webUiActions = [];
            }

            console.log('Loaded config, schema, and actions for', pluginId);
        } catch (error) {
            console.error('Error loading plugin config:', error);
            componentContext.config = { enabled: true, display_duration: 30 };
            componentContext.schema = {};
            componentContext.webUiActions = [];
        } finally {
            componentContext.loading = false;
        }
    },

    generateConfigForm: function(pluginId, config, schema, webUiActions, componentContext) {
        // Try to get the app component
        let appComponent = null;
        if (window.Alpine) {
            const appElement = document.querySelector('[x-data="app()"]');
            if (appElement && appElement._x_dataStack && appElement._x_dataStack[0]) {
                appComponent = appElement._x_dataStack[0];
            }
        }

        // If we have access to the app component, use its method
        if (appComponent && typeof appComponent.generateConfigForm === 'function') {
            return appComponent.generateConfigForm(pluginId, config, schema, webUiActions);
        }

        // Fallback: return loading message if function not available
        if (!pluginId || !config) {
            return '<div class="text-gray-500">Loading configuration...</div>';
        }
        return '<div class="text-gray-500">Configuration form not available yet...</div>';
    },

    savePluginConfig: async function(pluginId, event, componentContext) {
        // Try to get the app component
        let appComponent = null;
        if (window.Alpine) {
            const appElement = document.querySelector('[x-data="app()"]');
            if (appElement && appElement._x_dataStack && appElement._x_dataStack[0]) {
                appComponent = appElement._x_dataStack[0];
            }
        }

        // If we have access to the app component, use its method
        if (appComponent && typeof appComponent.savePluginConfig === 'function') {
            return appComponent.savePluginConfig(pluginId, event);
        }

        console.error('savePluginConfig not available');
        throw new Error('Save configuration method not available');
    }
};

// ===== Nested Section Toggle =====
window.toggleNestedSection = function(sectionId, event) {
    // Prevent event bubbling if event is provided
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }

    const content = document.getElementById(sectionId);
    const icon = document.getElementById(sectionId + '-icon');

    if (!content || !icon) {
        console.warn('[toggleNestedSection] Content or icon not found for:', sectionId);
        return;
    }

    // Check if content is currently collapsed (has 'collapsed' class or display:none)
    const isCollapsed = content.classList.contains('collapsed') || 
                        content.style.display === 'none' ||
                        (content.style.display === '' && !content.classList.contains('expanded'));

    if (isCollapsed) {
        // Expand the section
        content.classList.remove('collapsed');
        content.classList.add('expanded');
        content.style.display = 'block';
        content.style.overflow = 'hidden'; // Prevent content jumping during animation

        // CRITICAL FIX: Use setTimeout to ensure browser has time to layout the element
        // When element goes from display:none to display:block, scrollHeight might be 0
        // We need to wait for the browser to calculate the layout
        setTimeout(() => {
            // Force reflow to ensure transition works
            void content.offsetHeight;

            // Now measure the actual content height after layout
            const scrollHeight = content.scrollHeight;
            if (scrollHeight > 0) {
                content.style.maxHeight = scrollHeight + 'px';
            } else {
                // Fallback: if scrollHeight is still 0, try measuring again after a brief delay
                setTimeout(() => {
                    const retryHeight = content.scrollHeight;
                    content.style.maxHeight = retryHeight > 0 ? retryHeight + 'px' : '500px';
                }, 10);
            }
        }, 10);

        icon.classList.remove('fa-chevron-right');
        icon.classList.add('fa-chevron-down');

        // After animation completes, remove max-height constraint to allow natural expansion
        setTimeout(() => {
            if (content.classList.contains('expanded') && !content.classList.contains('collapsed')) {
                content.style.maxHeight = 'none';
                content.style.overflow = '';
            }
        }, 320); // Slightly longer than transition duration
    } else {
        // Collapse the section
        content.classList.add('collapsed');
        content.classList.remove('expanded');
        content.style.overflow = 'hidden'; // Prevent content jumping during animation

        // Set max-height to current scroll height first (required for smooth animation)
        const currentHeight = content.scrollHeight;
        content.style.maxHeight = currentHeight + 'px';

        // Force reflow to apply the height
        void content.offsetHeight;

        // Then animate to 0
        setTimeout(() => {
            content.style.maxHeight = '0';
        }, 10);

        // Hide after transition completes
        setTimeout(() => {
            if (content.classList.contains('collapsed')) {
                content.style.display = 'none';
                content.style.overflow = '';
            }
        }, 320); // Match the CSS transition duration + small buffer

        icon.classList.remove('fa-chevron-down');
        icon.classList.add('fa-chevron-right');
    }
};

// ===== Display Preview Functions (from v2) =====

function updateDisplayPreview(data) {
    const preview = document.getElementById('displayPreview');
    const stage = document.getElementById('previewStage');
    const img = document.getElementById('displayImage');
    const canvas = document.getElementById('gridOverlay');
    const ledCanvas = document.getElementById('ledCanvas');
    const placeholder = document.getElementById('displayPlaceholder');

    if (!stage || !img || !placeholder) return; // Not on overview page

    if (data.image) {
        // Show stage
        placeholder.style.display = 'none';
        stage.style.display = 'inline-block';

        // Current scale from slider
        const scale = parseInt(document.getElementById('scaleRange')?.value || '8');

        // Update image and meta label
        img.style.imageRendering = 'pixelated';
        img.onload = () => {
            renderLedDots();
        };
        img.src = `data:image/png;base64,${data.image}`;

        const meta = document.getElementById('previewMeta');
        if (meta) {
            meta.textContent = `${data.width || 128} x ${data.height || 64} @ ${scale}x`;
        }

        // Size the canvases to match
        const width = (data.width || 128) * scale;
        const height = (data.height || 64) * scale;
        img.style.width = width + 'px';
        img.style.height = height + 'px';
        ledCanvas.width = width;
        ledCanvas.height = height;
        canvas.width = width;
        canvas.height = height;
        drawGrid(canvas, data.width || 128, data.height || 64, scale);
        renderLedDots();
    } else {
        stage.style.display = 'none';
        placeholder.style.display = 'block';
        placeholder.innerHTML = `<div class="text-center text-gray-400 py-8">
            <i class="fas fa-exclamation-triangle text-4xl mb-3"></i>
            <p>No display data available</p>
        </div>`;
    }
}

function renderLedDots() {
    const ledCanvas = document.getElementById('ledCanvas');
    const img = document.getElementById('displayImage');
    const toggle = document.getElementById('toggleLedDots');

    if (!ledCanvas || !img || !toggle) {
        return;
    }

    const show = toggle.checked;

    if (!show) {
        // LED mode OFF: Show image, hide canvas
        img.style.visibility = 'visible';
        ledCanvas.style.display = 'none';
        const ctx = ledCanvas.getContext('2d');
        ctx.clearRect(0, 0, ledCanvas.width, ledCanvas.height);
        return;
    }

    // LED mode ON: Hide image (but keep layout space), show only dots on canvas
    img.style.visibility = 'hidden';
    ledCanvas.style.display = 'block';

    const scale = parseInt(document.getElementById('scaleRange')?.value || '8');
    const fillPct = parseInt(document.getElementById('dotFillRange')?.value || '75');
    const dotRadius = Math.max(1, Math.floor((scale * fillPct) / 200)); // radius in px

    const ctx = ledCanvas.getContext('2d', { willReadFrequently: true });
    ctx.clearRect(0, 0, ledCanvas.width, ledCanvas.height);

    // Create an offscreen canvas to sample pixel colors
    const off = document.createElement('canvas');
    const logicalWidth = Math.floor(ledCanvas.width / scale);
    const logicalHeight = Math.floor(ledCanvas.height / scale);
    off.width = logicalWidth;
    off.height = logicalHeight;
    const offCtx = off.getContext('2d', { willReadFrequently: true });

    // Draw the current image scaled down to logical LEDs to sample colors
    try {
        offCtx.drawImage(img, 0, 0, logicalWidth, logicalHeight);
    } catch (e) {
        console.error('Failed to draw image to offscreen canvas:', e);
        return;
    }

    // Fill canvas with black background (LED matrix bezel)
    ctx.fillStyle = 'rgb(0, 0, 0)';
    ctx.fillRect(0, 0, ledCanvas.width, ledCanvas.height);

    // Draw circular dots for each LED pixel
    let drawn = 0;
    for (let y = 0; y < logicalHeight; y++) {
        for (let x = 0; x < logicalWidth; x++) {
            const pixel = offCtx.getImageData(x, y, 1, 1).data;
            const r = pixel[0], g = pixel[1], b = pixel[2], a = pixel[3];

            // Skip fully transparent or black pixels to reduce overdraw
            if (a === 0 || (r|g|b) === 0) continue;

            ctx.fillStyle = `rgb(${r},${g},${b})`;
            const cx = Math.floor(x * scale + scale / 2);
            const cy = Math.floor(y * scale + scale / 2);
            ctx.beginPath();
            ctx.arc(cx, cy, dotRadius, 0, Math.PI * 2);
            ctx.fill();
            drawn++;
        }
    }

    // If nothing was drawn (e.g., image not ready), hide overlay to show base image
    if (drawn === 0) {
        ledCanvas.style.display = 'none';
    }
}

function drawGrid(canvas, pixelWidth, pixelHeight, scale) {
    const toggle = document.getElementById('toggleGrid');
    if (!toggle || !toggle.checked) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
    }

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;

    for (let x = 0; x <= pixelWidth; x++) {
        ctx.beginPath();
        ctx.moveTo(x * scale, 0);
        ctx.lineTo(x * scale, pixelHeight * scale);
        ctx.stroke();
    }

    for (let y = 0; y <= pixelHeight; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * scale);
        ctx.lineTo(pixelWidth * scale, y * scale);
        ctx.stroke();
    }
}

function takeScreenshot() {
    const img = document.getElementById('displayImage');
    if (img && img.src) {
        const link = document.createElement('a');
        link.download = `led_matrix_${new Date().getTime()}.png`;
        link.href = img.src;
        link.click();
    }
}

// ===== Plugin Management Functions =====

// Make togglePluginFromTab global so Alpine.js can access it  
window.togglePluginFromTab = async function(pluginId, enabled) {
    try {
        const response = await fetch('/api/v3/plugins/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plugin_id: pluginId, enabled })
        });
        const data = await response.json();

        showNotification(data.message, data.status);

        if (data.status === 'success') {
            // Update the plugin in window.installedPlugins
            if (window.installedPlugins) {
                const plugin = window.installedPlugins.find(p => p.id === pluginId);
                if (plugin) {
                    plugin.enabled = enabled;
                }
            }

            // Refresh the plugin list to ensure both management page and config page stay in sync
            if (typeof loadInstalledPlugins === 'function') {
                loadInstalledPlugins();
            }
        } else {
            // Revert the toggle if API call failed
            if (window.installedPlugins) {
                const plugin = window.installedPlugins.find(p => p.id === pluginId);
                if (plugin) {
                    plugin.enabled = !enabled;
                }
            }
        }

    } catch (error) {
        showNotification('Error toggling plugin: ' + error.message, 'error');
        // Revert on error
        if (window.installedPlugins) {
            const plugin = window.installedPlugins.find(p => p.id === pluginId);
            if (plugin) {
                plugin.enabled = !enabled;
            }
        }
    }
}

// Helper function to get schema property type for a field path
function getSchemaPropertyType(schema, path) {
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
}

// Helper function to escape CSS selector special characters
function escapeCssSelector(str) {
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
}

async function savePluginConfig(pluginId) {
    try {
        console.log('Saving config for plugin:', pluginId);

        // Load schema for type detection
        let schema = {};
        try {
            const schemaResponse = await fetch(`/api/v3/plugins/schema?plugin_id=${pluginId}`);
            const schemaData = await schemaResponse.json();
            if (schemaData.status === 'success' && schemaData.data.schema) {
                schema = schemaData.data.schema;
            }
        } catch (e) {
            console.warn('Could not load schema for type detection:', e);
        }

        // Find the form in the active plugin tab
        // Alpine.js hides/shows elements with display:none, so we look for the currently visible one
        const allForms = document.querySelectorAll('form[x-on\\:submit\\.prevent]');
        console.log('Found forms:', allForms.length);

        let form = null;
        for (const f of allForms) {
            const parent = f.closest('[x-show]');
            if (parent && parent.style.display !== 'none' && parent.offsetParent !== null) {
                form = f;
                console.log('Found visible form');
                break;
            }
        }

        if (!form) {
            throw new Error('Form not found for plugin ' + pluginId);
        }

        const formData = new FormData(form);
        const flatConfig = {};

        // First, collect all checkbox states (including unchecked ones)
        // Unchecked checkboxes don't appear in FormData, so we need to iterate form elements
        for (let i = 0; i < form.elements.length; i++) {
            const element = form.elements[i];
            const name = element.name;

            // Skip elements without names or submit buttons
            if (!name || element.type === 'submit' || element.type === 'button') {
                continue;
            }

            // Handle checkboxes explicitly (both checked and unchecked)
            if (element.type === 'checkbox') {
                flatConfig[name] = element.checked;
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
            const escapedKey = escapeCssSelector(key);
            const element = form.querySelector(`[name="${escapedKey}"]`);
            if (element && element.type === 'checkbox') {
                continue; // Already processed
            }
            // Skip multi-select - we already handled them above
            if (element && element.tagName === 'SELECT' && element.multiple) {
                continue; // Already processed
            }

            // Get schema property type if available
            const propSchema = getSchemaPropertyType(schema, key);
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

                        try {
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
                            // Fallback to empty array
                            flatConfig[key] = [];
                        }
                    } catch (e) {
                        // Not valid JSON, use empty array or try comma-separated
                        if (value && value.trim()) {
                            const arrayValue = value.split(',').map(v => v.trim()).filter(v => v);
                            flatConfig[key] = arrayValue;
                        } else {
                            flatConfig[key] = [];
                        }
                    }
                } else {
                    // Regular array: convert comma-separated string to array
                    const arrayValue = value ? value.split(',').map(v => v.trim()).filter(v => v) : [];
                    flatConfig[key] = arrayValue;
                }
            } else if (propType === 'integer') {
                const numValue = parseInt(value, 10);
                flatConfig[key] = isNaN(numValue) ? (propSchema && propSchema.default !== undefined ? propSchema.default : 0) : numValue;
            } else if (propType === 'number') {
                const numValue = parseFloat(value);
                flatConfig[key] = isNaN(numValue) ? (propSchema && propSchema.default !== undefined ? propSchema.default : 0) : numValue;
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

        console.log('Saving config for', pluginId, ':', config);
        console.log('Flat config before nesting:', flatConfig);

        // Save to backend
        const response = await fetch('/api/v3/plugins/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plugin_id: pluginId, config })
        });

        let data;
        try {
            data = await response.json();
        } catch (e) {
            throw new Error(`Failed to parse server response: ${response.status} ${response.statusText}`);
        }

        if (!response.ok || data.status !== 'success') {
            let errorMessage = data.message || 'Failed to save configuration';
            if (data.validation_errors && Array.isArray(data.validation_errors)) {
                errorMessage += '\n\nValidation errors:\n' + data.validation_errors.join('\n');
            }
            throw new Error(errorMessage);
        } else {
            showNotification(`Configuration saved for ${pluginId}`, 'success');
        }

    } catch (error) {
        console.error('Error saving plugin configuration:', error);
        showNotification('Error saving plugin configuration: ' + error.message, 'error');
    }
}

// Notification helper function
// Fix invalid number inputs before form submission
// This prevents "invalid form control is not focusable" errors
window.fixInvalidNumberInputs = function(form) {
    if (!form) return;
    const allInputs = form.querySelectorAll('input[type="number"]');
    allInputs.forEach(input => {
        const min = parseFloat(input.getAttribute('min'));
        const max = parseFloat(input.getAttribute('max'));
        const value = parseFloat(input.value);

        if (!isNaN(value)) {
            if (!isNaN(min) && value < min) {
                input.value = min;
            } else if (!isNaN(max) && value > max) {
                input.value = max;
            }
        }
    });
};

// showNotification is provided by notification.js widget
// This fallback is only used if the widget hasn't loaded yet
if (typeof window.showNotification !== 'function') {
    window.showNotification = function(message, type = 'info') {
        console.log(`[${type.toUpperCase()}]`, message);
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 ${
            type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500'
        } text-white`;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => { notification.style.opacity = '0'; setTimeout(() => notification.remove(), 500); }, 3000);
    };
}

// Section toggle function - already defined earlier, but ensure it's not overwritten
// (duplicate definition removed - function is defined in early script block above)

// Plugin config handler functions (idempotent initialization)
if (!window.__pluginConfigHandlersInitialized) {
    window.__pluginConfigHandlersInitialized = true;

    // Initialize state on window object
    window.pluginConfigRefreshInProgress = window.pluginConfigRefreshInProgress || new Set();

    // Validate plugin config form and show helpful error messages
    window.validatePluginConfigForm = function(form, pluginId) {
        // Check HTML5 validation
        if (!form.checkValidity()) {
            // Find all invalid fields
            const invalidFields = Array.from(form.querySelectorAll(':invalid'));
            const errors = [];
            let firstInvalidField = null;

            invalidFields.forEach((field, index) => {
                // Build error message
                let fieldName = field.name || field.id || 'field';
                // Make field name more readable (remove plugin ID prefix, convert dots/underscores)
                fieldName = fieldName.replace(new RegExp('^' + pluginId + '-'), '')
                                    .replace(/\./g, ' → ')
                                    .replace(/_/g, ' ')
                                    .replace(/\b\w/g, l => l.toUpperCase()); // Capitalize words

                let errorMsg = field.validationMessage || 'Invalid value';

                // Get more specific error message based on validation state
                if (field.validity.valueMissing) {
                    errorMsg = 'This field is required';
                } else if (field.validity.rangeUnderflow) {
                    errorMsg = `Value must be at least ${field.min || 'the minimum'}`;
                } else if (field.validity.rangeOverflow) {
                    errorMsg = `Value must be at most ${field.max || 'the maximum'}`;
                } else if (field.validity.stepMismatch) {
                    errorMsg = `Value must be a multiple of ${field.step || 1}`;
                } else if (field.validity.typeMismatch) {
                    errorMsg = 'Invalid format (e.g., text in number field)';
                } else if (field.validity.patternMismatch) {
                    errorMsg = 'Value does not match required pattern';
                } else if (field.validity.tooShort) {
                    errorMsg = `Value must be at least ${field.minLength} characters`;
                } else if (field.validity.tooLong) {
                    errorMsg = `Value must be at most ${field.maxLength} characters`;
                } else if (field.validity.badInput) {
                    errorMsg = 'Invalid input type';
                }

                errors.push(`${fieldName}: ${errorMsg}`);

                // Track first invalid field for focusing
                if (index === 0) {
                    firstInvalidField = field;
                }

                // If field is in a collapsed section, expand it
                const nestedContent = field.closest('.nested-content');
                if (nestedContent && nestedContent.classList.contains('hidden')) {
                    // Find the toggle button for this section
                    const sectionId = nestedContent.id;
                    if (sectionId) {
                        // Try multiple selectors to find the toggle button
                        const toggleBtn = document.querySelector(`button[aria-controls="${sectionId}"], button[onclick*="${sectionId}"], [data-toggle-section="${sectionId}"]`) ||
                                         nestedContent.previousElementSibling?.querySelector('button');
                        if (toggleBtn && toggleBtn.onclick) {
                            toggleBtn.click(); // Expand the section
                        }
                    }
                }
            });

            // Focus and scroll to first invalid field after a brief delay
            // (allows collapsed sections to expand first)
            setTimeout(() => {
                if (firstInvalidField) {
                    firstInvalidField.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    firstInvalidField.focus();
                }
            }, 200);

            // Show error notification with details
            if (errors.length > 0) {
                // Format error message nicely
                const errorList = errors.slice(0, 5).join('\n'); // Show first 5 errors
                const moreErrors = errors.length > 5 ? `\n... and ${errors.length - 5} more error(s)` : '';
                const errorMessage = `Validation failed:\n${errorList}${moreErrors}`;

                if (typeof showNotification === 'function') {
                    showNotification(errorMessage, 'error');
                } else {
                    alert(errorMessage); // Fallback if showNotification not available
                }

                // Also log to console for debugging
                console.error('Form validation errors:', errors);
            }

            // Report validation failure to browser (shows native validation tooltips)
            form.reportValidity();

            return false; // Prevent form submission
        }

        return true; // Validation passed
    };

    // Handle config save response with detailed error logging
    window.handleConfigSave = function(event, pluginId) {
        const btn = event.target.querySelector('[type=submit]');
        if (btn) btn.disabled = false;

        const xhr = event.detail.xhr;
        const status = xhr?.status || 0;

        // Check if request was successful (2xx status codes)
        if (status >= 200 && status < 300) {
            // Try to get message from response JSON
            let message = 'Configuration saved successfully!';
            try {
                if (xhr?.responseJSON?.message) {
                    message = xhr.responseJSON.message;
                } else if (xhr?.responseText) {
                    const responseData = JSON.parse(xhr.responseText);
                    message = responseData.message || message;
                }
            } catch (e) {
                // Use default message if parsing fails
            }
            showNotification(message, 'success');
        } else {
            // Request failed - log detailed error information
            console.error('Config save failed:', {
                status: status,
                statusText: xhr?.statusText,
                responseText: xhr?.responseText
            });

            // Try to parse error response
            let errorMessage = 'Failed to save configuration';
            try {
                if (xhr?.responseJSON) {
                    const errorData = xhr.responseJSON;
                    errorMessage = errorData.message || errorData.details || errorMessage;
                    if (errorData.validation_errors) {
                        errorMessage += ': ' + errorData.validation_errors.join(', ');
                    }
                } else if (xhr?.responseText) {
                    const errorData = JSON.parse(xhr.responseText);
                    errorMessage = errorData.message || errorData.details || errorMessage;
                    if (errorData.validation_errors) {
                        errorMessage += ': ' + errorData.validation_errors.join(', ');
                    }
                }
            } catch (e) {
                // If parsing fails, use status text
                errorMessage = xhr?.statusText || errorMessage;
            }

            showNotification(errorMessage, 'error');
        }
    };

    // Handle toggle response
    window.handleToggleResponse = function(event, pluginId) {
        const xhr = event.detail.xhr;
        const status = xhr?.status || 0;

        if (status >= 200 && status < 300) {
            // Update UI in place instead of refreshing to avoid duplication
            const checkbox = document.getElementById(`plugin-enabled-${pluginId}`);
            const label = checkbox?.nextElementSibling;

            if (checkbox && label) {
                const isEnabled = checkbox.checked;
                label.textContent = isEnabled ? 'Enabled' : 'Disabled';
                label.className = `ml-2 text-sm ${isEnabled ? 'text-green-600' : 'text-gray-500'}`;
            }

            // Try to get message from response
            let message = 'Plugin status updated';
            try {
                if (xhr?.responseJSON?.message) {
                    message = xhr.responseJSON.message;
                } else if (xhr?.responseText) {
                    const responseData = JSON.parse(xhr.responseText);
                    message = responseData.message || message;
                }
            } catch (e) {
                // Use default message
            }
            showNotification(message, 'success');
        } else {
            // Revert checkbox state on error
            const checkbox = document.getElementById(`plugin-enabled-${pluginId}`);
            if (checkbox) {
                checkbox.checked = !checkbox.checked;
            }

            // Try to get error message from response
            let errorMessage = 'Failed to update plugin status';
            try {
                if (xhr?.responseJSON?.message) {
                    errorMessage = xhr.responseJSON.message;
                } else if (xhr?.responseText) {
                    const errorData = JSON.parse(xhr.responseText);
                    errorMessage = errorData.message || errorData.details || errorMessage;
                }
            } catch (e) {
                // Use default message
            }
            showNotification(errorMessage, 'error');
        }
    };

    // Handle plugin update response
    window.handlePluginUpdate = function(event, pluginId) {
        const xhr = event.detail.xhr;
        const status = xhr?.status || 0;

        // Check if request was successful (2xx status)
        if (status >= 200 && status < 300) {
            // Try to parse the response to get the actual message from server
            let message = 'Plugin updated successfully';

            if (xhr && xhr.responseText) {
                try {
                    const data = JSON.parse(xhr.responseText);
                    // Use the server's message, ensuring it says "update" not "save"
                    message = data.message || message;
                    // Ensure message is about updating, not saving
                    if (message.toLowerCase().includes('save') && !message.toLowerCase().includes('update')) {
                        message = message.replace(/save/i, 'update');
                    }
                } catch (e) {
                    // If parsing fails, use default message
                    console.warn('Could not parse update response:', e);
                }
            }

            showNotification(message, 'success');
        } else {
            console.error('Plugin update failed:', {
                status: status,
                statusText: xhr?.statusText,
                responseText: xhr?.responseText
            });

            // Try to parse error response for better error message
            let errorMessage = 'Failed to update plugin';
            if (xhr?.responseText) {
                try {
                    const errorData = JSON.parse(xhr.responseText);
                    errorMessage = errorData.message || errorMessage;
                } catch (e) {
                    // If parsing fails, use default
                }
            }

            showNotification(errorMessage, 'error');
        }
    };

    // Refresh plugin config (with duplicate prevention)
    window.refreshPluginConfig = function(pluginId) {
        // Prevent concurrent refreshes
        if (window.pluginConfigRefreshInProgress.has(pluginId)) {
            return;
        }

        const container = document.getElementById(`plugin-config-${pluginId}`);
        if (container && window.htmx) {
            window.pluginConfigRefreshInProgress.add(pluginId);

            // Clear container first, then reload
            container.innerHTML = '';
            window.htmx.ajax('GET', `/v3/partials/plugin-config/${pluginId}`, {
                target: container,
                swap: 'innerHTML'
            });

            // Clear flag after delay
            setTimeout(() => {
                window.pluginConfigRefreshInProgress.delete(pluginId);
            }, 1000);
        }
    };

    // Plugin action handlers
    window.runPluginOnDemand = function(pluginId) {
        if (typeof window.openOnDemandModal === 'function') {
            window.openOnDemandModal(pluginId);
        } else {
            showNotification('On-demand modal not available', 'error');
        }
    };

    window.stopOnDemand = function() {
        if (typeof window.requestOnDemandStop === 'function') {
            window.requestOnDemandStop({});
        } else {
            showNotification('Stop function not available', 'error');
        }
    };

    window.executePluginAction = function(pluginId, actionId) {
        fetch(`/api/v3/plugins/action?plugin_id=${pluginId}&action_id=${actionId}`, {
            method: 'POST'
        })
        .then(r => r.json())
        .then(data => {
            if (data.status === 'success') {
                showNotification(data.message || 'Action executed', 'success');
            } else {
                showNotification(data.message || 'Action failed', 'error');
            }
        })
        .catch(err => {
            showNotification('Failed to execute action', 'error');
        });
    };
}

function getAppComponent() {
    if (window.Alpine) {
        const appElement = document.querySelector('[x-data="app()"]');
        if (appElement && appElement._x_dataStack && appElement._x_dataStack[0]) {
            return appElement._x_dataStack[0];
        }
    }
    return null;
}

async function updatePlugin(pluginId) {
    try {
        showNotification(`Updating ${pluginId}...`, 'info');

        const response = await fetch('/api/v3/plugins/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plugin_id: pluginId })
        });
        const data = await response.json();

        showNotification(data.message, data.status);

        if (data.status === 'success') {
            // Refresh the plugin list
            const appComponent = getAppComponent();
            if (appComponent && typeof appComponent.loadInstalledPlugins === 'function') {
                await appComponent.loadInstalledPlugins();
            }
        }
    } catch (error) {
        showNotification('Error updating plugin: ' + error.message, 'error');
    }
}

async function updateAllPlugins() {
    try {
        const plugins = Array.isArray(window.installedPlugins) ? window.installedPlugins : [];

        if (!plugins.length) {
            showNotification('No installed plugins to update.', 'warning');
            return;
        }

        showNotification(`Checking ${plugins.length} plugin${plugins.length === 1 ? '' : 's'} for updates...`, 'info');

        let successCount = 0;
        let failureCount = 0;

        for (const plugin of plugins) {
            const pluginId = plugin.id;
            const pluginName = plugin.name || pluginId;

            try {
                const response = await fetch('/api/v3/plugins/update', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ plugin_id: pluginId })
                });

                const data = await response.json();
                const status = data.status || 'info';
                const message = data.message || `Checked ${pluginName}`;

                showNotification(message, status);

                if (status === 'success') {
                    successCount += 1;
                } else {
                    failureCount += 1;
                }
            } catch (error) {
                failureCount += 1;
                showNotification(`Error updating ${pluginName}: ${error.message}`, 'error');
            }
        }

        const appComponent = getAppComponent();
        if (appComponent && typeof appComponent.loadInstalledPlugins === 'function') {
            await appComponent.loadInstalledPlugins();
        }

        if (failureCount === 0) {
            showNotification(`Finished checking ${successCount} plugin${successCount === 1 ? '' : 's'} for updates.`, 'success');
        } else {
            showNotification(`Updated ${successCount} plugin${successCount === 1 ? '' : 's'} with ${failureCount} failure${failureCount === 1 ? '' : 's'}. Check logs for details.`, 'error');
        }
    } catch (error) {
        console.error('Bulk plugin update failed:', error);
        showNotification('Failed to update all plugins: ' + error.message, 'error');
    }
}

window.updateAllPlugins = updateAllPlugins;


async function uninstallPlugin(pluginId) {
    try {
        // Get plugin info from window.installedPlugins
        const plugin = window.installedPlugins ? window.installedPlugins.find(p => p.id === pluginId) : null;
        const pluginName = plugin ? (plugin.name || pluginId) : pluginId;

        if (!confirm(`Are you sure you want to uninstall ${pluginName}?`)) {
            return;
        }

        showNotification(`Uninstalling ${pluginName}...`, 'info');

        const response = await fetch('/api/v3/plugins/uninstall', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plugin_id: pluginId })
        });
        const data = await response.json();

        // Check if operation was queued
        if (data.status === 'success' && data.data && data.data.operation_id) {
            // Operation was queued, poll for completion
            const operationId = data.data.operation_id;
            showNotification(`Uninstall queued for ${pluginName}...`, 'info');
            await pollUninstallOperation(operationId, pluginId, pluginName);
        } else if (data.status === 'success') {
            // Direct uninstall completed immediately
            showNotification(data.message || `Plugin ${pluginName} uninstalled successfully`, 'success');
            // Refresh the plugin list
            await app.loadInstalledPlugins();
        } else {
            // Error response
            showNotification(data.message || 'Failed to uninstall plugin', data.status || 'error');
        }
    } catch (error) {
        showNotification('Error uninstalling plugin: ' + error.message, 'error');
    }
}

async function pollUninstallOperation(operationId, pluginId, pluginName, maxAttempts = 60, attempt = 0) {
    if (attempt >= maxAttempts) {
        showNotification(`Uninstall operation timed out for ${pluginName}`, 'error');
        // Refresh plugin list to see actual state
        await app.loadInstalledPlugins();
        return;
    }

    try {
        const response = await fetch(`/api/v3/plugins/operation/${operationId}`);
        const data = await response.json();

        if (data.status === 'success' && data.data) {
            const operation = data.data;
            const status = operation.status;

            if (status === 'completed') {
                // Operation completed successfully
                showNotification(`Plugin ${pluginName} uninstalled successfully`, 'success');
                await app.loadInstalledPlugins();
            } else if (status === 'failed') {
                // Operation failed
                const errorMsg = operation.error || operation.message || `Failed to uninstall ${pluginName}`;
                showNotification(errorMsg, 'error');
                // Refresh plugin list to see actual state
                await app.loadInstalledPlugins();
            } else if (status === 'pending' || status === 'in_progress') {
                // Still in progress, poll again
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
                await pollUninstallOperation(operationId, pluginId, pluginName, maxAttempts, attempt + 1);
            } else {
                // Unknown status, poll again
                await new Promise(resolve => setTimeout(resolve, 1000));
                await pollUninstallOperation(operationId, pluginId, pluginName, maxAttempts, attempt + 1);
            }
        } else {
            // Error getting operation status, try again
            await new Promise(resolve => setTimeout(resolve, 1000));
            await pollUninstallOperation(operationId, pluginId, pluginName, maxAttempts, attempt + 1);
        }
    } catch (error) {
        console.error('Error polling operation status:', error);
        // On error, refresh plugin list to see actual state
        await app.loadInstalledPlugins();
    }
}

// Assign to window for global access
window.uninstallPlugin = uninstallPlugin;

async function refreshPlugin(pluginId) {
    try {
        // Switch to the plugin manager tab briefly to refresh
        const originalTab = app.activeTab;
        app.activeTab = 'plugins';

        // Wait a moment then switch back
        setTimeout(() => {
            app.activeTab = originalTab;
            app.showNotification(`Refreshed ${pluginId}`, 'success');
        }, 100);

    } catch (error) {
        app.showNotification('Error refreshing plugin: ' + error.message, 'error');
    }
}

// Format commit information for display
function formatCommitInfo(commit, branch) {
    if (!commit && !branch) return 'Unknown';
    const shortCommit = commit ? String(commit).substring(0, 7) : '';
    const branchText = branch ? String(branch) : '';

    if (branchText && shortCommit) {
        return `${branchText} · ${shortCommit}`;
    }
    if (branchText) {
        return branchText;
    }
    if (shortCommit) {
        return shortCommit;
    }
    return 'Latest';
}

// Format date for display
function formatDateInfo(dateString) {
    if (!dateString) return 'Unknown';

    try {
        const date = new Date(dateString);
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
        return dateString;
    }
}

// Make functions available to Alpine.js
window.formatCommitInfo = formatCommitInfo;
window.formatDateInfo = formatDateInfo;

