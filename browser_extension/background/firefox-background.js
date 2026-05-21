const SUPPORTED_ACTIONS = ["toggle_mute", "toggle_video", "raise_hand"];

const DEFAULT_MAPPINGS = {
  thumbs_up: "toggle_mute",
  peace: "toggle_video",
  palm: "raise_hand"
};

const POLL_INTERVAL_MS = 700;
const DEFAULT_ENDPOINT = "http://127.0.0.1:8765/latest";

let lastEventKey = null;
let pollTimer = null;

function isSupportedAction(action) {
  return SUPPORTED_ACTIONS.includes(action);
}

function storageGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}

function storageSet(values) {
  return new Promise((resolve) => chrome.storage.local.set(values, resolve));
}

function queryTabs(queryInfo) {
  return new Promise((resolve) => chrome.tabs.query(queryInfo, resolve));
}

function sendTabMessage(tabId, message) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, () => resolve());
  });
}

async function getSettings() {
  const data = await storageGet(["gestureEndpoint", "mappings", "minConfidence"]);
  return {
    endpoint: data.gestureEndpoint || DEFAULT_ENDPOINT,
    mappings: data.mappings || DEFAULT_MAPPINGS,
    minConfidence: typeof data.minConfidence === "number" ? data.minConfidence : 0.75
  };
}

function buildEventKey(payload) {
  return `${payload.timestamp || "na"}:${payload.gesture || "na"}:${payload.action || "na"}`;
}

async function broadcastAction(action, payload) {
  const tabs = await queryTabs({
    url: ["*://*.zoom.us/*", "*://meet.google.com/*"]
  });

  await Promise.all(
    tabs.map((tab) =>
      sendTabMessage(tab.id, {
        source: "gesture-vision-plugin",
        type: "gesture_action",
        action,
        payload
      })
    )
  );
}

async function pollEndpoint() {
  const { endpoint, mappings, minConfidence } = await getSettings();

  try {
    const response = await fetch(endpoint, { cache: "no-store" });
    if (!response.ok) return;

    const payload = await response.json();
    const eventKey = buildEventKey(payload);
    if (eventKey === lastEventKey) return;

    const confidence = Number(payload.confidence ?? 0);
    if (confidence < minConfidence) return;

    const action = payload.action || mappings[payload.gesture];
    if (!isSupportedAction(action)) return;

    lastEventKey = eventKey;
    await broadcastAction(action, payload);
  } catch (_err) {
    // Silent retry loop is intentional for local bridge availability.
  }
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(pollEndpoint, POLL_INTERVAL_MS);
  pollEndpoint();
}

chrome.runtime.onInstalled.addListener(async () => {
  const current = await storageGet(["gestureEndpoint", "mappings", "minConfidence"]);
  const seed = {};

  if (!current.gestureEndpoint) seed.gestureEndpoint = DEFAULT_ENDPOINT;
  if (!current.mappings) seed.mappings = DEFAULT_MAPPINGS;
  if (typeof current.minConfidence !== "number") seed.minConfidence = 0.75;

  if (Object.keys(seed).length > 0) {
    await storageSet(seed);
  }

  startPolling();
});

chrome.runtime.onStartup.addListener(startPolling);
startPolling();
