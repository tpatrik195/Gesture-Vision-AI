// MediaPipe wasm/model assets are served from our own origin by default, so the
// app keeps working offline and on restricted conference networks. Set
// REACT_APP_MEDIAPIPE_CDN to fall back to a public CDN during development.
export const SEGMENTATION_ASSET_BASE =
    process.env.REACT_APP_MEDIAPIPE_CDN || "/mediapipe/selfie_segmentation";
