from datetime import datetime
from typing import Optional
import time
from fastapi import APIRouter, UploadFile, File, HTTPException, WebSocket, WebSocketDisconnect, Query, Request
from pydantic import BaseModel
import cv2
import numpy as np
from api.process import process_hand_gesture
from db import upsert_client

import logging

router = APIRouter()

class ClientRegistration(BaseModel):
    clientId: str
    consentAccepted: Optional[bool] = None

websocket_clients = {}
gesture_buffers = {}
gesture_state = {}
GESTURE_THRESHOLD = 4
MIN_CONFIDENCE = 0.45
GESTURE_HOLD_SECONDS = 0.25
GESTURE_COOLDOWN_SECONDS = 1.0
COMMAND_MODE_WINDOW_SECONDS = 4.0

# latest_segmented_frame = None

logging.basicConfig(
    filename='gesture_detection.log',
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

gesture_count = 0
max_gestures = 30
zoom_in_count = 0

# async def notify_subscribers(gesture):
#     global gesture_count, zoom_in_count

#     for url in list(subscribers):
#         try:
#             if gesture_count < max_gestures and gesture != "Normal" and gesture != "no hand detected" and gesture != "None":
#                 logging.info(f"Gesture detected: {gesture}")
                
#             if gesture_count < max_gestures and gesture != "Normal" and gesture != "no hand detected" and gesture != "None":
#                 gesture_count += 1

#             if gesture == "Swipe Right":
#                 zoom_in_count += 1
#             try:
#                 requests.post(url, json={"gesture": gesture})
#             except Exception as e:
#                 logging.error(f"Failed to notify {url}: {e}")

#         except Exception as e:
#             logging.error(f"Failed to notify {url}: {e}")

#     if gesture_count >= max_gestures:
#         logging.info(f"Received 30 gestures, stopping logging. 'Swipe Right' gestures count: {zoom_in_count}")
#         logging.getLogger().disabled = True

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    client_id = websocket.query_params.get("clientId")
    if not client_id:
        await websocket.close(code=1008)
        return
    await websocket.accept()
    existing = websocket_clients.get(client_id)
    if existing:
        try:
            await existing.close()
        except Exception:
            pass
    websocket_clients[client_id] = websocket
    gesture_state.setdefault(client_id, {"command_mode_until": 0.0, "last_sent": {}})
    try:
        while True:
            message = await websocket.receive()
            if message.get("type") == "websocket.disconnect":
                break

            frame_bytes = message.get("bytes")
            if frame_bytes is None:
                # ignore text/ping style messages
                continue

            img_array = np.frombuffer(frame_bytes, np.uint8)
            img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
            if img is None:
                continue

            img = cv2.flip(img, 1)
            gesture, _, confidence = process_hand_gesture(img)
            event = await maybe_emit_gesture(client_id, gesture, confidence)
            if event:
                await notify_subscribers(client_id, event)
    except WebSocketDisconnect:
        pass
    finally:
        websocket_clients.pop(client_id, None)
        gesture_buffers.pop(client_id, None)
        gesture_state.pop(client_id, None)


@router.post("/register_client")
async def register_client(payload: ClientRegistration, request: Request):
    if not payload.clientId:
        raise HTTPException(status_code=400, detail="clientId is required")
    client_ip = request.client.host if request.client else None
    origin = request.headers.get("origin") or request.headers.get("referer")
    user_agent = request.headers.get("user-agent")
    # DB write disabled for now:
    # upsert_client(
    #     client_id=payload.clientId,
    #     consent_accepted=payload.consentAccepted,
    #     consent_at=datetime.utcnow() if payload.consentAccepted else None,
    #     client_ip=client_ip,
    #     origin=origin,
    #     user_agent=user_agent,
    #     last_seen_at=datetime.utcnow(),
    # )
    return {"message": "registered"}


@router.post("/client_consent")
async def client_consent(payload: ClientRegistration, request: Request):
    if not payload.clientId:
        raise HTTPException(status_code=400, detail="clientId is required")
    client_ip = request.client.host if request.client else None
    origin = request.headers.get("origin") or request.headers.get("referer")
    user_agent = request.headers.get("user-agent")
    # DB write disabled for now:
    # upsert_client(
    #     client_id=payload.clientId,
    #     consent_accepted=payload.consentAccepted,
    #     consent_at=datetime.utcnow() if payload.consentAccepted else None,
    #     client_ip=client_ip,
    #     origin=origin,
    #     user_agent=user_agent,
    #     last_seen_at=datetime.utcnow(),
    # )
    return {"message": "updated"}

async def notify_subscribers(client_id, gesture):
    client = websocket_clients.get(client_id)
    if not client:
        return
    try:
        await client.send_json({"gesture": gesture})
    except Exception:
        websocket_clients.pop(client_id, None)
        gesture_buffers.pop(client_id, None)
        gesture_state.pop(client_id, None)


async def maybe_emit_gesture(client_id, gesture, confidence):
    if not gesture or gesture in {"None", "no hand detected", "Normal"}:
        return None
    if confidence < MIN_CONFIDENCE:
        return None

    now = time.monotonic()
    state = gesture_state.setdefault(client_id, {"command_mode_until": 0.0, "last_sent": {}})
    buffer = gesture_buffers.setdefault(client_id, [])

    buffer.append((gesture, now))
    if len(buffer) > GESTURE_THRESHOLD:
        buffer.pop(0)

    if len(buffer) < GESTURE_THRESHOLD:
        return None

    first_gesture, first_ts = buffer[0]
    if first_gesture != gesture:
        return None
    if any(g != gesture for g, _ in buffer):
        return None
    if now - first_ts < GESTURE_HOLD_SECONDS:
        return None

    last_sent_ts = state["last_sent"].get(gesture, 0.0)
    if now - last_sent_ts < GESTURE_COOLDOWN_SECONDS:
        return None

    if gesture == "Pointing":
        state["command_mode_until"] = now + COMMAND_MODE_WINDOW_SECONDS
        state["last_sent"][gesture] = now
        return gesture

    if gesture in {"Swipe Left", "Swipe Right"} and now > state["command_mode_until"]:
        return None

    state["last_sent"][gesture] = now
    return gesture

# async def notify_subscribers(gesture):
#     global last_gesture, last_time_sent
#     now = asyncio.get_event_loop().time()
#     if gesture == last_gesture and now - last_time_sent < 3:
#         print("Duplicate gesture ignored.")
#         return
#     for url in list(subscribers):
#         try:
#             requests.post(url, json={"gesture": gesture})
#             print(f"Notified {url} with gesture: {gesture}")
#         except Exception as e:
#             print(f"Failed to notify {url}: {e}")
#     last_gesture = gesture
#     last_time_sent = now
#     await asyncio.sleep(3)

@router.post("/process_frame")
async def process_frame(frame: UploadFile = File(...), clientId: str = Query(""), request: Request = None):
    # global latest_segmented_frame
    try:
        if not clientId:
            raise HTTPException(status_code=400, detail="clientId is required")
        # DB write disabled for now:
        # if request is not None:
        #     upsert_client(
        #         client_id=clientId,
        #         origin=request.headers.get("origin") or request.headers.get("referer"),
        #         user_agent=request.headers.get("user-agent"),
        #         client_ip=request.client.host if request.client else None,
        #         last_seen_at=datetime.utcnow(),
        #     )
        img_array = np.frombuffer(await frame.read(), np.uint8)
        # img_bytes = await frame.read()
        # print(len(img_bytes))  # Megnézheted, hogy hány byte-ot sikerült beolvasni
        # if len(img_bytes) == 0:
        #     raise HTTPException(status_code=400, detail="No image data received")
        # img_array = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
        img = cv2.flip(img, 1)

        gesture, img, confidence = process_hand_gesture(img)

        # frame-level logging disabled for performance
        # print(gesture)

        # nem statikus gesztust egybol kuldje el
        # if gesture == "swipe right" or gesture == "swipe left":
        #     await notify_subscribers(gesture)
        
        # else:
        event = await maybe_emit_gesture(clientId, gesture, confidence)
        if event:
            await notify_subscribers(clientId, event)

        return {"message": "frame processed"}

    except Exception as e:
        return {"error": str(e)}
