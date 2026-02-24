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
