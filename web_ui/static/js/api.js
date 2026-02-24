// web_ui/static/js/api.js
/**
 * API client — thin fetch wrapper for all backend calls.
 */

const BASE = "/api";

async function request(method, path, body = null) {
    const opts = {
        method,
        headers: { "Content-Type": "application/json" },
    };
    if (body) opts.body = JSON.stringify(body);

    const resp = await fetch(`${BASE}${path}`, opts);
    if (!resp.ok) {
        const err = await resp.json().catch(() => ({ detail: resp.statusText }));
        throw new Error(err.detail || `HTTP ${resp.status}`);
    }
    return resp.json();
}

export const api = {
    get: (path) => request("GET", path),
    post: (path, body) => request("POST", path, body),
};
