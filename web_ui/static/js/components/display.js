// web_ui/static/js/components/display.js
import { subscribe, unsubscribe } from "../lib/ws.js";

let displayHandler = null;

export default {
    async render(container) {
        container.innerHTML = `
            <h1>Display Preview</h1>
            <article>
                <div id="live-preview" style="text-align:center; background:#000; padding:1rem; border-radius:0.5rem;">
                    <p style="color:#666;">Waiting for display data...</p>
                </div>
            </article>
        `;

        displayHandler = (data) => {
            const el = document.getElementById("live-preview");
            if (el && data.image) {
                el.innerHTML = `<img src="data:image/png;base64,${data.image}" alt="LED Matrix"
                    style="image-rendering:pixelated; width:100%; max-width:640px;">`;
            }
        };
        subscribe("display", displayHandler);
    },

    destroy() {
        if (displayHandler) {
            unsubscribe("display", displayHandler);
            displayHandler = null;
        }
    },
};
