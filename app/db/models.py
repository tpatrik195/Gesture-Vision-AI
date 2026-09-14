"""Database schema.

Privacy note: raw camera frames are never persisted. Only gesture metadata,
timing measurements and session bookkeeping are stored.
"""
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    Index,
    Integer,
    MetaData,
    String,
    Table,
)

metadata = MetaData()

client_sessions = Table(
    "client_sessions",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("client_id", String(64), unique=True, nullable=False),
    Column("token_hash", String(64), nullable=True),
    Column("consent_accepted", Boolean, nullable=False, default=False),
    Column("consent_at", DateTime, nullable=True),
    Column("consent_version", String(16), nullable=True),
    Column("client_ip", String(64), nullable=True),
    Column("origin", String(512), nullable=True),
    Column("user_agent", String(512), nullable=True),
    Column("language", String(8), nullable=True),
    Column("created_at", DateTime, nullable=False, default=datetime.utcnow),
    Column("updated_at", DateTime, nullable=False, default=datetime.utcnow),
    Column("last_seen_at", DateTime, nullable=True),
    Index("ix_client_sessions_token_hash", "token_hash"),
)

# One row per gesture event actually emitted to a client. Low volume by design:
# the state machine debounces and rate-limits emissions.
gesture_events = Table(
    "gesture_events",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("client_id", String(64), nullable=False),
    Column("gesture", String(32), nullable=False),
    Column("confidence", Float, nullable=True),
    Column("source_page", String(32), nullable=True),
    Column("inference_ms", Float, nullable=True),
    Column("pipeline_ms", Float, nullable=True),
    Column("client_capture_ts", Float, nullable=True),
    Column("created_at", DateTime, nullable=False, default=datetime.utcnow),
    Index("ix_gesture_events_client_created", "client_id", "created_at"),
    Index("ix_gesture_events_gesture", "gesture"),
)

# Systematically sampled per-frame timing breakdown (every Nth frame), so the
# latency distribution can be reconstructed without storing every frame.
frame_samples = Table(
    "frame_samples",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("client_id", String(64), nullable=False),
    Column("frame_bytes", Integer, nullable=True),
    Column("frame_width", Integer, nullable=True),
    Column("frame_height", Integer, nullable=True),
    Column("decode_ms", Float, nullable=True),
    Column("inference_ms", Float, nullable=True),
    Column("pipeline_ms", Float, nullable=True),
    Column("uplink_ms", Float, nullable=True),
    Column("hands_detected", Integer, nullable=True),
    Column("created_at", DateTime, nullable=False, default=datetime.utcnow),
    Index("ix_frame_samples_client_created", "client_id", "created_at"),
)

# Ground-truth labelled attempts from the Practice page: the user declares which
# gesture they are practising, so expected/detected pairs form a real
# multi-class confusion matrix from live usage.
practice_attempts = Table(
    "practice_attempts",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("client_id", String(64), nullable=False),
    Column("expected_gesture", String(32), nullable=False),
    Column("detected_gesture", String(32), nullable=True),
    Column("confidence", Float, nullable=True),
    Column("time_to_detect_ms", Float, nullable=True),
    Column("succeeded", Boolean, nullable=False, default=False),
    Column("created_at", DateTime, nullable=False, default=datetime.utcnow),
    Index("ix_practice_attempts_expected", "expected_gesture"),
    Index("ix_practice_attempts_client_created", "client_id", "created_at"),
)

# Per-session rollups written when a websocket session ends: throughput,
# drop rate and resource-relevant counters for the scalability measurements.
session_metrics = Table(
    "session_metrics",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("client_id", String(64), nullable=False),
    Column("started_at", DateTime, nullable=True),
    Column("ended_at", DateTime, nullable=True),
    Column("duration_s", Float, nullable=True),
    Column("frames_received", Integer, nullable=True),
    Column("frames_processed", Integer, nullable=True),
    Column("frames_dropped_rate_limit", Integer, nullable=True),
    Column("frames_dropped_backpressure", Integer, nullable=True),
    Column("gestures_emitted", Integer, nullable=True),
    Column("inference_ms_avg", Float, nullable=True),
    Column("inference_ms_p95", Float, nullable=True),
    Column("concurrent_sessions_peak", Integer, nullable=True),
    Column("created_at", DateTime, nullable=False, default=datetime.utcnow),
    Index("ix_session_metrics_client", "client_id"),
)
