// web_ui/static/js/app.js
import { connect } from "./lib/ws.js";
import dashboard from "./components/dashboard.js";
import plugins from "./components/plugins.js";
import pluginConfig from "./components/plugin-config.js";
import display from "./components/display.js";
import settings from "./components/settings.js";

const content = document.getElementById("content");

const routes = {
    "/": dashboard,
    "/plugins": plugins,
    "/display": display,
    "/settings": settings,
};

let currentComponent = null;

async function navigate() {
    const hash = window.location.hash.slice(1) || "/";

    // Destroy previous component
    if (currentComponent && currentComponent.destroy) {
        currentComponent.destroy();
    }

    // Check for dynamic plugin config route
    const pluginMatch = hash.match(/^\/plugins\/(.+)$/);
    if (pluginMatch) {
        currentComponent = pluginConfig;
        await pluginConfig.render(content, pluginMatch[1]);
        // Update active nav link
        document.querySelectorAll(".nav-link").forEach((link) => {
            const href = link.getAttribute("href").slice(1);
            link.classList.toggle("active", href === "/plugins");
        });
        return;
    }

    const component = routes[hash];
    if (component) {
        currentComponent = component;
        await component.render(content);
    } else {
        content.innerHTML = "<h1>Not Found</h1>";
        currentComponent = null;
    }

    // Update active nav link
    document.querySelectorAll(".nav-link").forEach((link) => {
        const href = link.getAttribute("href").slice(1);
        link.classList.toggle("active", href === hash);
    });
}

// Mobile menu toggle
const menuBtn = document.getElementById("menu-toggle");
const sidebar = document.getElementById("sidebar");
if (menuBtn) {
    menuBtn.addEventListener("click", () => sidebar.classList.toggle("open"));
    // Close sidebar on nav click (mobile)
    sidebar.querySelectorAll(".nav-link").forEach((link) => {
        link.addEventListener("click", () => sidebar.classList.remove("open"));
    });
}

window.addEventListener("hashchange", navigate);
connect();
navigate();
