export const SUPPORTED_ACTIONS = [
  "toggle_mute",
  "toggle_video",
  "raise_hand"
];

export const DEFAULT_MAPPINGS = {
  thumbs_up: "toggle_mute",
  peace: "toggle_video",
  palm: "raise_hand"
};

export function isSupportedAction(action) {
  return SUPPORTED_ACTIONS.includes(action);
}
