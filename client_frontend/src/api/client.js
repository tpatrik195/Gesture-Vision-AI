// Same-origin API access. The server issues the session identity; the client
// never invents its own id.

import { storeSupportedGestureKeys } from "../utils/gestureOptions";

const API_BASE = `${window.location.origin}/api`;
const TOKEN_KEY = "gestureSessionToken";
const CLIENT_ID_KEY = "gestureClientId";

export const WS_URL = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/api/ws`;

let sessionPromise = null;

export function getStoredSession() {
    try {
        const token = sessionStorage.getItem(TOKEN_KEY);
        const clientId = sessionStorage.getItem(CLIENT_ID_KEY);
        return token && clientId ? { token, clientId } : null;
    } catch {
        return null;
    }
}

function storeSession(session) {
    try {
        sessionStorage.setItem(TOKEN_KEY, session.token);
        sessionStorage.setItem(CLIENT_ID_KEY, session.clientId);
    } catch {
        // Private browsing: keep the session in memory for this page only.
    }
}

async function requestSession(language) {
    const response = await fetch(`${API_BASE}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: language || null }),
    });
    if (!response.ok) {
        throw new Error(`Session request failed (${response.status})`);
    }
    return response.json();
}

export async function ensureSession(language) {
    const stored = getStoredSession();
    if (stored) {
        return stored;
    }
    if (!sessionPromise) {
        sessionPromise = requestSession(language)
            .then((data) => {
                const session = {
                    token: data.token,
                    clientId: data.clientId,
                    supportedGestures: data.supportedGestures || [],
                };
                storeSession(session);
                storeSupportedGestureKeys(session.supportedGestures);
                return session;
            })
            .finally(() => {
                sessionPromise = null;
            });
    }
    return sessionPromise;
}

export async function submitConsent(accepted) {
    const session = await ensureSession();
    const response = await fetch(`${API_BASE}/consent`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({ accepted }),
    });
    if (!response.ok) {
        throw new Error(`Consent request failed (${response.status})`);
    }
    return response.json();
}
