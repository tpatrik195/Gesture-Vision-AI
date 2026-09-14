// Dev-server proxy. The target is configurable so the same code works when the
// frontend runs on the host (localhost) and inside compose (service name).
const { createProxyMiddleware } = require("http-proxy-middleware");

const target = process.env.DEV_API_TARGET || "http://localhost:8000";

module.exports = function setupProxy(app) {
    app.use(
        "/api",
        createProxyMiddleware({
            target,
            changeOrigin: true,
        })
    );
    app.use(
        "/ws",
        createProxyMiddleware({
            target,
            changeOrigin: true,
            ws: true,
        })
    );
};
