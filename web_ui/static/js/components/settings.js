// web_ui/static/js/components/settings.js
import { api } from "../api.js";

export default {
    async render(container) {
        container.innerHTML = "<h1>Settings</h1><p>Loading...</p>";

        try {
            const config = await api.get("/config");
            const general = config.general || {};
            const display = config.display || {};
            const hw = display.hardware || {};

            container.innerHTML = `
                <h1>Settings</h1>
                <form id="settings-form">
                    <fieldset>
                        <legend>General</legend>
                        <label>Matrix Name
                            <input type="text" name="general.name" value="${general.name || ""}">
                        </label>
                    </fieldset>
                    <fieldset>
                        <legend>Display Hardware</legend>
                        <div class="grid">
                            <label>Columns
                                <input type="number" name="display.hardware.cols" value="${hw.cols || 64}">
                            </label>
                            <label>Rows
                                <input type="number" name="display.hardware.rows" value="${hw.rows || 32}">
                            </label>
                            <label>Chain Length
                                <input type="number" name="display.hardware.chain_length" value="${hw.chain_length || 2}">
                            </label>
                            <label>Brightness
                                <input type="range" name="display.hardware.brightness" min="0" max="100"
                                       value="${hw.brightness || 80}"
                                       oninput="this.nextElementSibling.textContent=this.value+'%'">
                                <span>${hw.brightness || 80}%</span>
                            </label>
                        </div>
                    </fieldset>
                    <button type="submit">Save Settings</button>
                </form>
                <div id="settings-status"></div>

                <fieldset>
                    <legend>Service Control</legend>
                    <div class="grid">
                        <button id="btn-restart" class="outline">Restart Service</button>
                        <button id="btn-stop" class="outline secondary">Stop Service</button>
                    </div>
                </fieldset>
            `;
            this.bindEvents(container, config);
        } catch (e) {
            container.innerHTML = `<h1>Settings</h1><p class="error">${e.message}</p>`;
        }
    },

    bindEvents(container, currentConfig) {
        const form = container.querySelector("#settings-form");
        const status = container.querySelector("#settings-status");

        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const fd = new FormData(form);

            // Build nested config update
            const updates = { ...currentConfig };
            updates.general = { ...updates.general, name: fd.get("general.name") };
            updates.display = {
                ...updates.display,
                hardware: {
                    ...(updates.display?.hardware || {}),
                    cols: Number(fd.get("display.hardware.cols")),
                    rows: Number(fd.get("display.hardware.rows")),
                    chain_length: Number(fd.get("display.hardware.chain_length")),
                    brightness: Number(fd.get("display.hardware.brightness")),
                },
            };

            try {
                await api.post("/config", updates);
                status.innerHTML = `<ins>Settings saved.</ins>`;
                setTimeout(() => {
                    status.innerHTML = "";
                }, 3000);
            } catch (err) {
                status.innerHTML = `<del>Error: ${err.message}</del>`;
            }
        });

        container.querySelector("#btn-restart").addEventListener("click", async () => {
            await api.post("/system/action", { action: "restart" });
        });

        container.querySelector("#btn-stop").addEventListener("click", async () => {
            await api.post("/system/action", { action: "stop" });
        });
    },
};
