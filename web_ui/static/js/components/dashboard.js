// web_ui/static/js/components/dashboard.js
import { api } from "../api.js";
import { subscribe, unsubscribe } from "../lib/ws.js";

let statsHandler = null;

export default {
    async render(container) {
        // Fetch initial data
        let pluginCount = 0;
        try {
            const plugins = await api.get("/plugins");
            pluginCount = plugins.length;
        } catch (e) {
            console.error("Failed to load plugins", e);
        }

        container.innerHTML = `
            <h1>Dashboard</h1>
            <div class="grid">
                <article>
                    <header>CPU</header>
                    <p id="stat-cpu">--</p>
                </article>
                <article>
                    <header>Memory</header>
                    <p id="stat-mem">--</p>
                </article>
                <article>
                    <header>Temperature</header>
                    <p id="stat-temp">--</p>
                </article>
                <article>
                    <header>Plugins</header>
                    <p>${pluginCount} installed</p>
                </article>
            </div>
            <article>
                <header>Display Preview</header>
                <div id="display-preview" style="text-align:center;">
                    <p>No preview available</p>
                </div>
            </article>
        `;

        // Subscribe to real-time stats
        statsHandler = (data) => {
            const cpu = document.getElementById("stat-cpu");
            const mem = document.getElementById("stat-mem");
            const temp = document.getElementById("stat-temp");
            if (cpu) cpu.textContent = `${data.cpu_percent}%`;
            if (mem) mem.textContent = `${data.memory_percent}%`;
            if (temp) temp.textContent = data.cpu_temp > 0 ? `${data.cpu_temp}°C` : "N/A";
        };
        subscribe("stats", statsHandler);

        // Subscribe to display preview
        subscribe("display", (data) => {
            const el = document.getElementById("display-preview");
            if (el && data.image) {
                el.innerHTML = `<img src="data:image/png;base64,${data.image}" alt="Display preview" style="image-rendering:pixelated; max-width:100%; border:1px solid var(--pico-muted-border-color);">`;
            }
        });
    },

    destroy() {
        if (statsHandler) {
            unsubscribe("stats", statsHandler);
            statsHandler = null;
        }
    },
};
