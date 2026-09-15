"""Per-client gesture sessions.

Every connected client gets its own detector and its own state machine, so
tracking state, swipe history and cooldowns can never leak between users.
"""
from __future__ import annotations
import asyncio
import logging
import time
from dataclasses import dataclass, field

from app.config import settings
from app.core.concurrency import run_in_thread
from app.models.hand_detector import (
    GESTURE_NO_HAND,
    GESTURE_NONE,
    GESTURE_POINTING,
    GESTURE_SWIPE_LEFT,
    GESTURE_SWIPE_RIGHT,
    DetectionResult,
    HandGestureDetector,
)

logger = logging.getLogger(__name__)

IGNORED_GESTURES = {GESTURE_NONE, GESTURE_NO_HAND, "Normal"}
NAVIGATION_GESTURES = {GESTURE_SWIPE_LEFT, GESTURE_SWIPE_RIGHT}
INFERENCE_SAMPLE_LIMIT = 500


@dataclass
class SessionStats:
    started_at: float = field(default_factory=time.time)
    frames_received: int = 0
    frames_processed: int = 0
    frames_dropped_rate_limit: int = 0
    frames_dropped_backpressure: int = 0
    gestures_emitted: int = 0
    inference_samples: list[float] = field(default_factory=list)

    def record_inference(self, value: float) -> None:
        if len(self.inference_samples) < INFERENCE_SAMPLE_LIMIT:
            self.inference_samples.append(value)

    def summary(self) -> dict:
        samples = sorted(self.inference_samples)
        avg = sum(samples) / len(samples) if samples else None
        p95 = samples[int(len(samples) * 0.95)] if samples else None
        duration = time.time() - self.started_at
        return {
            "duration_s": duration,
            "frames_received": self.frames_received,
            "frames_processed": self.frames_processed,
            "frames_dropped_rate_limit": self.frames_dropped_rate_limit,
            "frames_dropped_backpressure": self.frames_dropped_backpressure,
            "gestures_emitted": self.gestures_emitted,
            "inference_ms_avg": avg,
            "inference_ms_p95": p95,
        }


class GestureSession:
    def __init__(self, client_id: str) -> None:
        self.client_id = client_id
        self.detector = HandGestureDetector()
        self.stats = SessionStats()
        self.created_at = time.monotonic()
        self.last_activity = time.monotonic()

        self._buffer: list[tuple[str, float]] = []
        self._last_sent: dict[str, float] = {}
        self._command_mode_until = 0.0
        self._last_pointer_emit = 0.0
        self._frame_times: list[float] = []

    def close(self) -> None:
        self.detector.close()

    # --- rate limiting -------------------------------------------------
    def allow_frame(self) -> bool:
        """Sliding-window frame rate limit, protecting the CPU from runaway clients."""
        now = time.monotonic()
        self._frame_times = [t for t in self._frame_times if now - t < 1.0]
        if len(self._frame_times) >= settings.max_frames_per_second:
            self.stats.frames_dropped_rate_limit += 1
            return False
        self._frame_times.append(now)
        return True

    # --- detection -----------------------------------------------------
    async def process_frame(self, frame_bgr) -> DetectionResult:
        self.last_activity = time.monotonic()
        result = await run_in_thread(self.detector.detect, frame_bgr)
        self.stats.frames_processed += 1
        self.stats.record_inference(result.inference_ms)
        return result

    # --- state machine -------------------------------------------------
    def should_emit_pointer(self) -> bool:
        now = time.monotonic()
        if now - self._last_pointer_emit < settings.pointer_emit_interval:
            return False
        self._last_pointer_emit = now
        return True

    def evaluate(self, gesture: str, confidence: float) -> tuple[str, bool] | None:
        """Debounce raw detections into a stable gesture event.

        Detection flickers from frame to frame on a real hand, so a gesture wins
        by majority inside a short sliding window rather than by an unbroken run:
        a single uncertain frame no longer discards the evidence so far.

        Returns the gesture and whether it should trigger its action. Navigation
        gestures only act while command mode is armed (by a pointing gesture),
        which stops casual hand movement from flipping slides - but they are
        still reported, so the user can see what was recognised.
        """
        now = time.monotonic()
        self._buffer = [
            (name, ts) for name, ts in self._buffer
            if now - ts <= settings.gesture_window_seconds
        ]

        if not gesture or gesture in IGNORED_GESTURES:
            return None
        if confidence < settings.min_confidence:
            return None

        self._buffer.append((gesture, now))
        votes = [ts for name, ts in self._buffer if name == gesture]
        if len(votes) < settings.gesture_threshold:
            return None
        if now - votes[0] < settings.gesture_hold_seconds:
            return None
        if now - self._last_sent.get(gesture, 0.0) < settings.gesture_cooldown_seconds:
            return None

        self._last_sent[gesture] = now
        self.stats.gestures_emitted += 1

        if gesture == GESTURE_POINTING:
            self._command_mode_until = now + settings.command_mode_window_seconds
            return gesture, True

        if gesture in NAVIGATION_GESTURES and now > self._command_mode_until:
            return gesture, False

        return gesture, True


class SessionManager:
    def __init__(self) -> None:
        self._sessions: dict[str, GestureSession] = {}
        self._lock = asyncio.Lock()
        self.peak_concurrent = 0

    @property
    def active_count(self) -> int:
        return len(self._sessions)

    async def acquire(self, client_id: str) -> GestureSession:
        async with self._lock:
            existing = self._sessions.pop(client_id, None)
            if existing is not None:
                await run_in_thread(existing.close)

            if len(self._sessions) >= settings.max_concurrent_sessions:
                await self._evict_idle_locked()
            if len(self._sessions) >= settings.max_concurrent_sessions:
                raise RuntimeError("server at capacity")

            session = await run_in_thread(GestureSession, client_id)
            self._sessions[client_id] = session
            self.peak_concurrent = max(self.peak_concurrent, len(self._sessions))
            return session

    async def release(self, client_id: str) -> None:
        async with self._lock:
            session = self._sessions.pop(client_id, None)
        if session is not None:
            await run_in_thread(session.close)

    async def _evict_idle_locked(self) -> None:
        now = time.monotonic()
        stale = [
            client_id
            for client_id, session in self._sessions.items()
            if now - session.last_activity > settings.session_idle_timeout
        ]
        for client_id in stale:
            session = self._sessions.pop(client_id, None)
            if session is not None:
                await run_in_thread(session.close)
                logger.info("Evicted idle session %s", client_id)


session_manager = SessionManager()
