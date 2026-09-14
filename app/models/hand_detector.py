"""MediaPipe Tasks hand gesture detector.

One instance per client session: the landmarker runs in VIDEO mode, which keeps
per-stream tracking state between frames, so instances must never be shared.
"""
from __future__ import annotations
import math
import time
from dataclasses import dataclass, field

import cv2
import mediapipe as mp
from mediapipe.tasks.python.core.base_options import BaseOptions
from mediapipe.tasks.python.vision import (
    HandLandmarker,
    HandLandmarkerOptions,
    RunningMode,
)

from app.config import settings

WRIST = 0
THUMB_MCP = 2
THUMB_TIP = 4
INDEX_FINGER_MCP = 5
INDEX_FINGER_PIP = 6
INDEX_FINGER_TIP = 8
MIDDLE_FINGER_MCP = 9
MIDDLE_FINGER_PIP = 10
MIDDLE_FINGER_TIP = 12
RING_FINGER_PIP = 14
RING_FINGER_TIP = 16
PINKY_PIP = 18
PINKY_TIP = 20

GESTURE_NONE = "None"
GESTURE_NO_HAND = "no hand detected"
GESTURE_POINTING = "Pointing"
GESTURE_SWIPE_LEFT = "Swipe Left"
GESTURE_SWIPE_RIGHT = "Swipe Right"
GESTURE_ZOOM_IN = "Zoom In"
GESTURE_ZOOM_OUT = "Zoom Out"
OPTION_GESTURES = tuple(f"Option {n}" for n in range(1, 6))

SUPPORTED_GESTURES = (
    GESTURE_POINTING,
    GESTURE_SWIPE_LEFT,
    GESTURE_SWIPE_RIGHT,
    GESTURE_ZOOM_IN,
    GESTURE_ZOOM_OUT,
) + OPTION_GESTURES


@dataclass
class DetectionResult:
    gesture: str = GESTURE_NO_HAND
    confidence: float = 0.0
    pointer: tuple[float, float] | None = None
    hands_detected: int = 0
    inference_ms: float = 0.0
    frame_size: tuple[int, int] = (0, 0)


@dataclass
class _PointerFilter:
    """Exponential smoothing with an adaptive dead zone.

    Keeps the projected pointer steady while the hand is nearly still, but stays
    responsive once it starts moving, so the on-screen laser does not jitter.
    """

    alpha: float = 0.35
    deadzone_base: float = 0.012
    deadzone_min: float = 0.003
    max_step: float = 0.06
    x: float | None = None
    y: float | None = None

    def reset(self) -> None:
        self.x = None
        self.y = None

    def update(self, x: float, y: float) -> tuple[float, float]:
        if self.x is None or self.y is None:
            self.x, self.y = x, y
            return x, y

        dx = x - self.x
        dy = y - self.y
        speed = math.hypot(dx, dy)
        span = max(self.deadzone_base - self.deadzone_min, 1e-6)
        deadzone = self.deadzone_base - min(speed, 0.05) * span / 0.05
        if abs(dx) < deadzone and abs(dy) < deadzone:
            return self.x, self.y

        dx = max(-self.max_step, min(self.max_step, dx))
        dy = max(-self.max_step, min(self.max_step, dy))
        self.x += self.alpha * dx
        self.y += self.alpha * dy
        return self.x, self.y


@dataclass
class _SwipeTracker:
    """Distance-invariant horizontal swipe detection.

    Displacement is measured in hand-widths rather than raw normalised units, so
    the same physical motion triggers at 50 cm and at 2 m from the camera.
    """

    min_displacement_ratio: float = 0.55
    min_velocity_ratio: float = 1.6
    prev_x: float | None = None
    prev_t: float | None = None

    def reset(self) -> None:
        self.prev_x = None
        self.prev_t = None

    def update(self, center_x: float, hand_scale: float, now: float) -> tuple[str | None, float]:
        prev_x, prev_t = self.prev_x, self.prev_t
        self.prev_x, self.prev_t = center_x, now

        if prev_x is None or prev_t is None or hand_scale <= 1e-6:
            return None, 0.0

        dt = now - prev_t
        if dt <= 0 or dt > 0.5:
            return None, 0.0

        displacement = (center_x - prev_x) / hand_scale
        velocity = displacement / dt
        if abs(displacement) < self.min_displacement_ratio:
            return None, 0.0
        if abs(velocity) < self.min_velocity_ratio:
            return None, 0.0

        strength = min(
            1.0,
            max(
                abs(displacement) / (self.min_displacement_ratio * 2),
                abs(velocity) / (self.min_velocity_ratio * 2),
            ),
        )
        gesture = GESTURE_SWIPE_RIGHT if displacement > 0 else GESTURE_SWIPE_LEFT
        return gesture, strength


def _angle(p1, p2, vertex) -> float:
    v1x, v1y = p1.x - vertex.x, p1.y - vertex.y
    v2x, v2y = p2.x - vertex.x, p2.y - vertex.y
    mag1 = math.hypot(v1x, v1y)
    mag2 = math.hypot(v2x, v2y)
    if mag1 == 0 or mag2 == 0:
        return 0.0
    cos_theta = (v1x * v2x + v1y * v2y) / (mag1 * mag2)
    return math.degrees(math.acos(max(-1.0, min(1.0, cos_theta))))


def _hand_axis(landmarks) -> tuple[float, float]:
    """Unit vector pointing from the wrist towards the knuckles.

    Everything below is measured along this axis rather than along the image
    axes, so finger extension is judged the same way whether the hand is held
    upright or turned sideways.
    """
    wrist = landmarks[WRIST]
    middle_mcp = landmarks[MIDDLE_FINGER_MCP]
    dx = middle_mcp.x - wrist.x
    dy = middle_mcp.y - wrist.y
    magnitude = math.hypot(dx, dy)
    if magnitude < 1e-6:
        return 0.0, -1.0
    return dx / magnitude, dy / magnitude


def _project(landmark, origin, axis: tuple[float, float]) -> float:
    return (landmark.x - origin.x) * axis[0] + (landmark.y - origin.y) * axis[1]


def _finger_extended(landmarks, tip_id: int, pip_id: int, axis=None) -> bool:
    if axis is None:
        axis = _hand_axis(landmarks)
    wrist = landmarks[WRIST]
    return _project(landmarks[tip_id], wrist, axis) > _project(landmarks[pip_id], wrist, axis)


FINGERS = (
    (INDEX_FINGER_TIP, INDEX_FINGER_PIP),
    (MIDDLE_FINGER_TIP, MIDDLE_FINGER_PIP),
    (RING_FINGER_TIP, RING_FINGER_PIP),
    (PINKY_TIP, PINKY_PIP),
)


def extended_fingers(landmarks, axis=None) -> list[bool]:
    if axis is None:
        axis = _hand_axis(landmarks)
    return [_finger_extended(landmarks, tip, pip, axis) for tip, pip in FINGERS]


def extended_finger_count(landmarks, axis=None) -> int:
    return sum(extended_fingers(landmarks, axis))


def _thumb_extended(landmarks, axis=None) -> bool:
    """The thumb leaves the palm sideways, so it is measured perpendicular
    to the hand axis rather than along it."""
    if axis is None:
        axis = _hand_axis(landmarks)
    perpendicular = (-axis[1], axis[0])
    wrist = landmarks[WRIST]
    tip = abs(_project(landmarks[THUMB_TIP], wrist, perpendicular))
    mcp = abs(_project(landmarks[THUMB_MCP], wrist, perpendicular))
    return tip > mcp * 1.4


def hand_orientation(landmarks, axis=None) -> str:
    """'up' when the fingers point upwards, otherwise 'side'."""
    if axis is None:
        axis = _hand_axis(landmarks)
    # Image y grows downwards, so an upward-pointing hand has negative dy.
    return "up" if axis[1] <= -0.55 else "side"


def _is_pointing(landmarks, axis=None) -> bool:
    if axis is None:
        axis = _hand_axis(landmarks)
    wrist = landmarks[WRIST]
    index_extended = (
        _project(landmarks[INDEX_FINGER_TIP], wrist, axis)
        > _project(landmarks[INDEX_FINGER_PIP], wrist, axis)
        > _project(landmarks[INDEX_FINGER_MCP], wrist, axis)
    )
    if not index_extended:
        return False
    return not any(extended_fingers(landmarks, axis)[1:])


def _hand_scale(landmarks) -> float:
    """Approximate hand size, used to normalise motion for camera distance."""
    wrist = landmarks[WRIST]
    middle_mcp = landmarks[MIDDLE_FINGER_MCP]
    return max(math.hypot(middle_mcp.x - wrist.x, middle_mcp.y - wrist.y), 1e-6)


def finger_angles(landmarks) -> dict:
    """Inter-finger angles at the wrist, in degrees."""
    wrist = landmarks[WRIST]
    return {
        "thumb_index": _angle(landmarks[THUMB_TIP], landmarks[INDEX_FINGER_TIP], wrist),
        "index_middle": _angle(landmarks[INDEX_FINGER_TIP], landmarks[MIDDLE_FINGER_TIP], wrist),
        "middle_ring": _angle(landmarks[MIDDLE_FINGER_TIP], landmarks[RING_FINGER_TIP], wrist),
        "ring_pinky": _angle(landmarks[RING_FINGER_TIP], landmarks[PINKY_TIP], wrist),
    }


def _classify_counting(landmarks, axis) -> tuple[str, float]:
    """Option 1-5 from the number of raised fingers.

    Only recognised with the hand turned sideways, which is what separates
    counting from the upright zoom poses: an open upright palm would otherwise
    be indistinguishable from "Option 4".
    """
    fingers = extended_fingers(landmarks, axis)
    count = sum(fingers) + (1 if _thumb_extended(landmarks, axis) else 0)
    if not 1 <= count <= 5:
        return GESTURE_NONE, 0.0

    # Raised fingers should be contiguous from the index; a scattered pattern is
    # usually a half-formed pose rather than a deliberate count.
    raised = [i for i, up in enumerate(fingers) if up]
    if raised and raised != list(range(len(raised))):
        return GESTURE_NONE, 0.0

    return f"Option {count}", 0.75


def _classify_static(landmarks, axis=None) -> tuple[str, float]:
    """Static hand poses.

    Upright hand: zoom gestures from inter-finger angles, gated on the fingers
    actually being extended - the angles alone let a relaxed hand drift into a
    zoom. Sideways hand: finger counting.
    """
    if axis is None:
        axis = _hand_axis(landmarks)

    if hand_orientation(landmarks, axis) == "side":
        return _classify_counting(landmarks, axis)

    angles = finger_angles(landmarks)
    if extended_finger_count(landmarks, axis) < 3:
        return GESTURE_NONE, 0.0

    closed = max(angles["thumb_index"], angles["index_middle"], angles["middle_ring"], angles["ring_pinky"])
    if closed < settings.zoom_out_max_angle:
        tightness = 1.0 - min(1.0, closed / settings.zoom_out_max_angle)
        return GESTURE_ZOOM_OUT, 0.6 + 0.4 * tightness

    if (
        angles["thumb_index"] > settings.zoom_in_min_thumb_angle
        and angles["index_middle"] > settings.zoom_in_min_finger_angle
        and angles["middle_ring"] > settings.zoom_in_min_finger_angle
        and angles["ring_pinky"] > settings.zoom_in_min_finger_angle
    ):
        spread = min(1.0, (angles["thumb_index"] - settings.zoom_in_min_thumb_angle) / 30.0)
        return GESTURE_ZOOM_IN, 0.6 + 0.4 * spread

    return GESTURE_NONE, 0.0


class HandGestureDetector:
    """Stateful, single-stream gesture detector."""

    def __init__(self) -> None:
        options = HandLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=settings.model_path),
            running_mode=RunningMode.VIDEO,
            num_hands=settings.max_hands,
            min_hand_detection_confidence=settings.min_detection_confidence,
            min_hand_presence_confidence=settings.min_detection_confidence,
            min_tracking_confidence=settings.min_tracking_confidence,
        )
        self._landmarker = HandLandmarker.create_from_options(options)
        self._pointer = _PointerFilter()
        self._swipe = _SwipeTracker()
        self._last_timestamp_ms = 0
        # Most recent landmark set, used by the calibration probe.
        self.last_landmarks = None

    def close(self) -> None:
        try:
            self._landmarker.close()
        except Exception:
            pass

    def detect(self, frame_bgr) -> DetectionResult:
        height, width = frame_bgr.shape[:2]
        frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame_rgb)

        # detect_for_video requires strictly increasing timestamps per stream.
        timestamp_ms = max(int(time.monotonic() * 1000), self._last_timestamp_ms + 1)
        self._last_timestamp_ms = timestamp_ms

        started = time.perf_counter()
        result = self._landmarker.detect_for_video(mp_image, timestamp_ms)
        inference_ms = (time.perf_counter() - started) * 1000

        detection = DetectionResult(
            inference_ms=inference_ms,
            frame_size=(width, height),
        )

        if not result.hand_landmarks:
            self._pointer.reset()
            self._swipe.reset()
            self.last_landmarks = None
            detection.gesture = GESTURE_NO_HAND
            return detection

        self.last_landmarks = result.hand_landmarks[0]

        detection.hands_detected = len(result.hand_landmarks)
        now = time.monotonic()
        gesture = GESTURE_NONE
        confidence = 0.0

        for landmarks, handedness in zip(result.hand_landmarks, result.handedness):
            hand_score = float(handedness[0].score or 0.0)
            axis = _hand_axis(landmarks)

            swipe_gesture, strength = self._swipe.update(
                landmarks[MIDDLE_FINGER_MCP].x, _hand_scale(landmarks), now
            )
            if swipe_gesture is not None:
                candidate_confidence = hand_score * strength
                if candidate_confidence > confidence:
                    gesture, confidence = swipe_gesture, candidate_confidence
                continue

            if _is_pointing(landmarks, axis):
                tip = landmarks[INDEX_FINGER_TIP]
                x, y = self._pointer.update(
                    min(max(tip.x, 0.0), 1.0), min(max(tip.y, 0.0), 1.0)
                )
                detection.pointer = (x, y)
                if hand_score > confidence:
                    gesture, confidence = GESTURE_POINTING, hand_score
                continue

            static_gesture, static_confidence = _classify_static(landmarks, axis)
            if static_gesture != GESTURE_NONE:
                candidate_confidence = hand_score * static_confidence
                if candidate_confidence > confidence:
                    gesture, confidence = static_gesture, candidate_confidence

        if gesture != GESTURE_POINTING:
            self._pointer.reset()

        detection.gesture = gesture
        detection.confidence = confidence
        return detection
