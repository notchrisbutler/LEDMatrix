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
                setTimeout(() => {
                    status.innerHTML = "";
                }, 3000);
            } catch (err) {
                status.innerHTML = `<del>Error: ${err.message}</del>`;
            }
        });
    },
};
