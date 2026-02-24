// web_ui/static/js/lib/ws.js
/**
 * WebSocket manager with auto-reconnect.
 */

const listeners = {};
let socket = null;
let reconnectDelay = 1000;

export function subscribe(type, callback) {
    if (!listeners[type]) listeners[type] = [];
    listeners[type].push(callback);
}

export function unsubscribe(type, callback) {
    if (!listeners[type]) return;
    listeners[type] = listeners[type].filter((cb) => cb !== callback);
}

function dispatch(msg) {
    const cbs = listeners[msg.type];
    if (cbs) cbs.forEach((cb) => cb(msg.data));
}

export function connect() {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${proto}//${location.host}/ws`;
    socket = new WebSocket(url);

    socket.onopen = () => {
        console.log("[ws] connected");
        reconnectDelay = 1000;
    };

    socket.onmessage = (event) => {
        try {
            dispatch(JSON.parse(event.data));
        } catch (e) {
            console.error("[ws] parse error", e);
        }
    };

    socket.onclose = () => {
        console.log(`[ws] closed, reconnecting in ${reconnectDelay}ms`);
        setTimeout(connect, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, 30000);
    };

    socket.onerror = () => {
        socket.close();
    };
}
