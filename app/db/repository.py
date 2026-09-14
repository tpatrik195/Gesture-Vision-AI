"""Data access helpers. Telemetry inserts go through the queued writer."""
from __future__ import annotations
from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.db import database
from app.db.models import (
    client_sessions,
    frame_samples,
    gesture_events,
    practice_attempts,
    session_metrics,
)


def upsert_client(
    client_id: str,
    token_hash: str | None = None,
    consent_accepted: bool | None = None,
    consent_at: datetime | None = None,
    consent_version: str | None = None,
    client_ip: str | None = None,
    origin: str | None = None,
    user_agent: str | None = None,
    language: str | None = None,
    last_seen_at: datetime | None = None,
) -> None:
    if not database.is_enabled():
        return

    now = datetime.utcnow()
    changes: dict[str, Any] = {"updated_at": now}
    for key, value in (
        ("token_hash", token_hash),
        ("consent_accepted", consent_accepted),
        ("consent_at", consent_at),
        ("consent_version", consent_version),
        ("client_ip", client_ip),
        ("origin", origin),
        ("user_agent", user_agent),
        ("language", language),
        ("last_seen_at", last_seen_at),
    ):
        if value is not None:
            changes[key] = value

    stmt = pg_insert(client_sessions).values(
        client_id=client_id,
        token_hash=token_hash,
        consent_accepted=bool(consent_accepted),
        consent_at=consent_at,
        consent_version=consent_version,
        client_ip=client_ip,
        origin=origin,
        user_agent=user_agent,
        language=language,
        created_at=now,
        updated_at=now,
        last_seen_at=last_seen_at or now,
    )
    stmt = stmt.on_conflict_do_update(index_elements=["client_id"], set_=changes)
    database.execute(stmt)


def get_consent(client_id: str) -> dict[str, Any] | None:
    engine = database.get_engine()
    if engine is None:
        return None
    try:
        with engine.connect() as conn:
            row = conn.execute(
                select(
                    client_sessions.c.consent_accepted,
                    client_sessions.c.consent_at,
                    client_sessions.c.consent_version,
                ).where(client_sessions.c.client_id == client_id)
            ).first()
    except Exception:
        return None
    if row is None:
        return None
    return {
        "consent_accepted": row.consent_accepted,
        "consent_at": row.consent_at,
        "consent_version": row.consent_version,
    }


def find_client_by_token(token_hash: str) -> str | None:
    engine = database.get_engine()
    if engine is None:
        return None
    try:
        with engine.connect() as conn:
            row = conn.execute(
                select(client_sessions.c.client_id).where(
                    client_sessions.c.token_hash == token_hash
                )
            ).first()
    except Exception:
        return None
    return row.client_id if row else None


def record_gesture_event(
    client_id: str,
    gesture: str,
    confidence: float | None,
    source_page: str | None,
    inference_ms: float | None,
    pipeline_ms: float | None,
    client_capture_ts: float | None,
) -> None:
    database.enqueue(
        gesture_events,
        {
            "client_id": client_id,
            "gesture": gesture,
            "confidence": confidence,
            "source_page": source_page,
            "inference_ms": inference_ms,
            "pipeline_ms": pipeline_ms,
            "client_capture_ts": client_capture_ts,
            "created_at": datetime.utcnow(),
        },
    )


def record_frame_sample(
    client_id: str,
    frame_bytes: int | None,
    frame_width: int | None,
    frame_height: int | None,
    decode_ms: float | None,
    inference_ms: float | None,
    pipeline_ms: float | None,
    uplink_ms: float | None,
    hands_detected: int | None,
) -> None:
    database.enqueue(
        frame_samples,
        {
            "client_id": client_id,
            "frame_bytes": frame_bytes,
            "frame_width": frame_width,
            "frame_height": frame_height,
            "decode_ms": decode_ms,
            "inference_ms": inference_ms,
            "pipeline_ms": pipeline_ms,
            "uplink_ms": uplink_ms,
            "hands_detected": hands_detected,
            "created_at": datetime.utcnow(),
        },
    )


def record_practice_attempt(
    client_id: str,
    expected_gesture: str,
    detected_gesture: str | None,
    confidence: float | None,
    time_to_detect_ms: float | None,
    succeeded: bool,
) -> None:
    database.enqueue(
        practice_attempts,
        {
            "client_id": client_id,
            "expected_gesture": expected_gesture,
            "detected_gesture": detected_gesture,
            "confidence": confidence,
            "time_to_detect_ms": time_to_detect_ms,
            "succeeded": succeeded,
            "created_at": datetime.utcnow(),
        },
    )


def record_session_metrics(values: dict[str, Any]) -> None:
    payload = dict(values)
    payload["created_at"] = datetime.utcnow()
    database.enqueue(session_metrics, payload)
