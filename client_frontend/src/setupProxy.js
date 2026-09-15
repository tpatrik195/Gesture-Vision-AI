// Dev-server proxy. The target is configurable so the same code works when the
// frontend runs on the host (localhost) and inside compose (service name).
// Everything the backend owns lives under /api, including the gesture
// WebSocket, which keeps it clear of the dev server's own hot-reload socket.
const { createProxyMiddleware } = require("http-proxy-middleware");

const target = process.env.DEV_API_TARGET || "http://localhost:8000";

module.exports = function setupProxy(app) {
    app.use(
        "/api",
        createProxyMiddleware({
            target,
            changeOrigin: true,
            ws: true,
        })
    );
};
