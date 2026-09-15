"""Gesture streaming over WebSocket.

Wire format
-----------
Client -> server (binary): 4-byte big-endian frame sequence number, followed by
the JPEG payload. The sequence number lets the client match replies to frames
and measure round-trip time on its own clock, so no clock synchronisation
between client and server is needed for the latency breakdown.

Client -> server (text): JSON control messages ("hello", "practice").
Server -> client (text): JSON events ("ready", "gesture", "pointer", "ack",
"status", "error").
"""
from __future__ import annotations
import json
import logging
import struct
import time

import cv2
import numpy as np
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.config import settings
from app.core.security import token_store
from app.db import repository
from app.models.hand_detector import GESTURE_NO_HAND, GESTURE_POINTING
from app.services.gesture_session import session_manager

logger = logging.getLogger(__name__)
router = APIRouter()

HEADER_SIZE = 4
FRAME_SAMPLE_EVERY = 10

WS_CLOSE_UNAUTHORIZED = 4401
WS_CLOSE_AT_CAPACITY = 4503


@router.websocket("/ws")
async def gesture_stream(websocket: WebSocket) -> None:
    token = websocket.query_params.get("token")
    client_id = token_store.resolve(token)
    if not client_id:
        await websocket.close(code=WS_CLOSE_UNAUTHORIZED)
        return

    try:
        session = await session_manager.acquire(client_id)
    except RuntimeError:
        await websocket.close(code=WS_CLOSE_AT_CAPACITY)
        return

    await websocket.accept()
    await websocket.send_json({"type": "ready", "clientId": client_id})

    source_page = "unknown"
    expected_gesture: str | None = None
    expected_since = 0.0
    last_state: str | None = None
    debug_mode = False
    last_debug_at = 0.0

    try:
        while True:
            message = await websocket.receive()
            if message.get("type") == "websocket.disconnect":
                break

            text = message.get("text")
            if text is not None:
                try:
                    payload = json.loads(text)
                except ValueError:
                    continue
                kind = payload.get("type")
                if kind == "hello":
                    source_page = str(payload.get("page") or "unknown")[:32]
                    debug_mode = bool(payload.get("debug"))
                elif kind == "debug":
                    debug_mode = bool(payload.get("enabled"))
                elif kind == "practice":
                    expected = payload.get("expected")
                    expected_gesture = str(expected)[:32] if expected else None
                    expected_since = time.monotonic()
                continue

            payload_bytes = message.get("bytes")
            if payload_bytes is None or len(payload_bytes) <= HEADER_SIZE:
                continue

            session.stats.frames_received += 1

            if len(payload_bytes) > settings.max_frame_bytes:
                await websocket.send_json(
                    {"type": "error", "code": "frame_too_large", "message": "Frame exceeds size limit"}
                )
                continue

            if not session.allow_frame():
                continue

            received_at = time.perf_counter()
            sequence = struct.unpack(">I", payload_bytes[:HEADER_SIZE])[0]
            jpeg_bytes = payload_bytes[HEADER_SIZE:]

            decode_started = time.perf_counter()
            frame = cv2.imdecode(np.frombuffer(jpeg_bytes, np.uint8), cv2.IMREAD_COLOR)
            if frame is None:
                continue
            decode_ms = (time.perf_counter() - decode_started) * 1000

            # Mirror so gestures match the user's own point of view (selfie mode).
            frame = cv2.flip(frame, 1)
            result = await session.process_frame(frame)

            if result.pointer is not None and session.should_emit_pointer():
                await websocket.send_json(
                    {"type": "pointer", "x": result.pointer[0], "y": result.pointer[1]}
                )

            event = session.evaluate(result.gesture, result.confidence)
            pipeline_ms = (time.perf_counter() - received_at) * 1000

            # Raw, unfiltered detection - what the classifier saw before
            # debouncing. Essential when tuning thresholds to a new hand.
            if debug_mode and time.monotonic() - last_debug_at > 0.2:
                last_debug_at = time.monotonic()
                await websocket.send_json(
                    {
                        "type": "debug",
                        "raw": result.gesture,
                        "confidence": round(result.confidence, 3),
                        "hands": result.hands_detected,
                        "inferenceMs": round(result.inference_ms, 1),
                    }
                )

            if event:
                gesture_name, actionable = event
                await websocket.send_json(
                    {
                        "type": "gesture",
                        "gesture": gesture_name,
                        "actionable": actionable,
                        "confidence": round(result.confidence, 3),
                        "seq": sequence,
                        "pipelineMs": round(pipeline_ms, 2),
                    }
                )
                repository.record_gesture_event(
                    client_id=client_id,
                    gesture=gesture_name,
                    confidence=result.confidence,
                    source_page=source_page,
                    inference_ms=result.inference_ms,
                    pipeline_ms=pipeline_ms,
                    client_capture_ts=None,
                )
                if expected_gesture:
                    repository.record_practice_attempt(
                        client_id=client_id,
                        expected_gesture=expected_gesture,
                        detected_gesture=gesture_name,
                        confidence=result.confidence,
                        time_to_detect_ms=(time.monotonic() - expected_since) * 1000,
                        succeeded=gesture_name == expected_gesture,
                    )
                    expected_since = time.monotonic()
            elif sequence % FRAME_SAMPLE_EVERY == 0:
                # Sampled acknowledgement: gives the client a round-trip probe and
                # the study a systematic sample of the timing breakdown.
                await websocket.send_json(
                    {"type": "ack", "seq": sequence, "pipelineMs": round(pipeline_ms, 2)}
                )
                repository.record_frame_sample(
                    client_id=client_id,
                    frame_bytes=len(jpeg_bytes),
                    frame_width=result.frame_size[0],
                    frame_height=result.frame_size[1],
                    decode_ms=decode_ms,
                    inference_ms=result.inference_ms,
                    pipeline_ms=pipeline_ms,
                    uplink_ms=None,
                    hands_detected=result.hands_detected,
                )

            state = "no_hand" if result.gesture == GESTURE_NO_HAND else "tracking"
            if state != last_state:
                last_state = state
                await websocket.send_json({"type": "status", "state": state})

    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.exception("WebSocket session failed for %s: %s", client_id, exc)
    finally:
        summary = session.stats.summary()
        summary["client_id"] = client_id
        summary["concurrent_sessions_peak"] = session_manager.peak_concurrent
        repository.record_session_metrics(summary)
        await session_manager.release(client_id)
