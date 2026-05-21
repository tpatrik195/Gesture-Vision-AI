(function () {
  function clickBySelector(selectors) {
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) {
        el.click();
        return true;
      }
    }
    return false;
  }

  function pressKey(key, shiftKey = false) {
    const event = new KeyboardEvent("keydown", {
      key,
      code: key,
      shiftKey,
      bubbles: true,
      cancelable: true
    });
    document.dispatchEvent(event);
  }

  function toggleMute() {
    const clicked = clickBySelector([
      'button[aria-label*="Mute"]',
      'button[aria-label*="Unmute"]',
      'button[data-testid="mute-button"]'
    ]);
    if (!clicked) pressKey("a");
  }

  function toggleVideo() {
    const clicked = clickBySelector([
      'button[aria-label*="Start Video"]',
      'button[aria-label*="Stop Video"]',
      'button[data-testid="video-button"]'
    ]);
    if (!clicked) pressKey("v");
  }

  function raiseHand() {
    const clicked = clickBySelector([
      'button[aria-label*="Raise Hand"]',
      'button[aria-label*="Lower Hand"]'
    ]);
    if (!clicked) pressKey("y", true);
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || msg.source !== "gesture-vision-plugin" || msg.type !== "gesture_action") return;

    if (msg.action === "toggle_mute") toggleMute();
    if (msg.action === "toggle_video") toggleVideo();
    if (msg.action === "raise_hand") raiseHand();
  });
})();
