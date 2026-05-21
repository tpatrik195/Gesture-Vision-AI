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

  function pressCombo(key) {
    const event = new KeyboardEvent("keydown", {
      key,
      ctrlKey: true,
      metaKey: true,
      bubbles: true,
      cancelable: true
    });
    document.dispatchEvent(event);
  }

  function toggleMute() {
    const clicked = clickBySelector([
      'button[aria-label*="microphone" i]',
      'div[role="button"][aria-label*="microphone" i]'
    ]);
    if (!clicked) pressCombo("d");
  }

  function toggleVideo() {
    const clicked = clickBySelector([
      'button[aria-label*="camera" i]',
      'div[role="button"][aria-label*="camera" i]'
    ]);
    if (!clicked) pressCombo("e");
  }

  function raiseHand() {
    clickBySelector([
      'button[aria-label*="Raise hand" i]',
      'button[aria-label*="Lower hand" i]',
      'div[role="button"][aria-label*="Raise hand" i]'
    ]);
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || msg.source !== "gesture-vision-plugin" || msg.type !== "gesture_action") return;

    if (msg.action === "toggle_mute") toggleMute();
    if (msg.action === "toggle_video") toggleVideo();
    if (msg.action === "raise_hand") raiseHand();
  });
})();
