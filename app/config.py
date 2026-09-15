"""Central configuration, loaded from environment variables."""
from __future__ import annotations
import os
from dataclasses import dataclass, field
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default
    return int(raw)


def _env_float(name: str, default: float) -> float:
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default
    return float(raw)


def _env_list(name: str, default: list[str]) -> list[str]:
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default
    return [item.strip() for item in raw.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    # --- Model ---
    model_path: str = os.getenv("MODEL_PATH") or str(BASE_DIR / "models" / "hand_landmarker.task")
    max_hands: int = _env_int("MAX_HANDS", 2)
    min_detection_confidence: float = _env_float("MIN_DETECTION_CONFIDENCE", 0.5)
    min_tracking_confidence: float = _env_float("MIN_TRACKING_CONFIDENCE", 0.5)

    # --- Static gesture thresholds (degrees) ---
    # Inter-finger angles measured at the wrist. Hand shape varies between
    # people, so these are tunable without a code change; use
    # tools/gesture_probe.py to read live values and calibrate.
    zoom_out_max_angle: float = _env_float("ZOOM_OUT_MAX_ANGLE", 6.0)
    zoom_in_min_thumb_angle: float = _env_float("ZOOM_IN_MIN_THUMB_ANGLE", 26.0)
    zoom_in_min_finger_angle: float = _env_float("ZOOM_IN_MIN_FINGER_ANGLE", 6.0)

    # --- Gesture state machine ---
    # A gesture wins by majority inside this window, so a single flickering
    # frame does not reset the evidence.
    gesture_threshold: int = _env_int("GESTURE_THRESHOLD", 3)
    gesture_window_seconds: float = _env_float("GESTURE_WINDOW_SECONDS", 0.8)
    min_confidence: float = _env_float("MIN_CONFIDENCE", 0.45)
    gesture_hold_seconds: float = _env_float("GESTURE_HOLD_SECONDS", 0.18)
    gesture_cooldown_seconds: float = _env_float("GESTURE_COOLDOWN_SECONDS", 0.9)
    command_mode_window_seconds: float = _env_float("COMMAND_MODE_WINDOW_SECONDS", 4.0)
    pointer_emit_interval: float = _env_float("POINTER_EMIT_INTERVAL", 0.04)

    # --- Sessions & limits ---
    max_concurrent_sessions: int = _env_int("MAX_CONCURRENT_SESSIONS", 25)
    session_idle_timeout: float = _env_float("SESSION_IDLE_TIMEOUT", 900.0)
    max_frame_bytes: int = _env_int("MAX_FRAME_BYTES", 2 * 1024 * 1024)
    max_frames_per_second: float = _env_float("MAX_FRAMES_PER_SECOND", 20.0)
    rest_rate_limit_per_minute: int = _env_int("REST_RATE_LIMIT_PER_MINUTE", 60)
    session_token_ttl: float = _env_float("SESSION_TOKEN_TTL", 12 * 3600.0)

    # --- Security ---
    allowed_origins: list[str] = field(
        default_factory=lambda: _env_list("ALLOWED_ORIGINS", ["*"])
    )
    allow_credentials: bool = _env_bool("ALLOW_CREDENTIALS", False)

    # --- Database ---
    database_url: str | None = os.getenv("DATABASE_URL") or None
    telemetry_enabled: bool = _env_bool("TELEMETRY_ENABLED", True)

    # --- Runtime ---
    log_level: str = os.getenv("LOG_LEVEL", "INFO").upper()

    @property
    def cors_origins(self) -> list[str]:
        """Wildcard origins can never be combined with credentials (CORS spec)."""
        return self.allowed_origins

    @property
    def cors_allow_credentials(self) -> bool:
        if "*" in self.allowed_origins:
            return False
        return self.allow_credentials


settings = Settings()
