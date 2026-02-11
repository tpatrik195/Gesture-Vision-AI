from datetime import datetime
from typing import Optional
from fastapi import APIRouter, UploadFile, File, HTTPException, WebSocket, WebSocketDisconnect, Query, Request
from pydantic import BaseModel
import cv2
import numpy as np
from app.api.process import process_hand_gesture
from app.db import upsert_client

import logging

router = APIRouter()

class ClientRegistration(BaseModel):
    clientId: str
    consentAccepted: Optional[bool] = None

websocket_clients = {}
gesture_buffers = {}
gesture_buffer = []
GESTURE_THRESHOLD = 1

last_gesture = None
last_time_sent = 0

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
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        websocket_clients.pop(client_id, None)
        gesture_buffers.pop(client_id, None)


@router.post("/register_client")
async def register_client(payload: ClientRegistration, request: Request):
    if not payload.clientId:
        raise HTTPException(status_code=400, detail="clientId is required")
    client_ip = request.client.host if request.client else None
    origin = request.headers.get("origin") or request.headers.get("referer")
    user_agent = request.headers.get("user-agent")
    upsert_client(
        client_id=payload.clientId,
        consent_accepted=payload.consentAccepted,
        consent_at=datetime.utcnow() if payload.consentAccepted else None,
        client_ip=client_ip,
        origin=origin,
        user_agent=user_agent,
        last_seen_at=datetime.utcnow(),
    )
    return {"message": "registered"}


@router.post("/client_consent")
async def client_consent(payload: ClientRegistration, request: Request):
    if not payload.clientId:
        raise HTTPException(status_code=400, detail="clientId is required")
    client_ip = request.client.host if request.client else None
    origin = request.headers.get("origin") or request.headers.get("referer")
    user_agent = request.headers.get("user-agent")
    upsert_client(
        client_id=payload.clientId,
        consent_accepted=payload.consentAccepted,
        consent_at=datetime.utcnow() if payload.consentAccepted else None,
        client_ip=client_ip,
        origin=origin,
        user_agent=user_agent,
        last_seen_at=datetime.utcnow(),
    )
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
        if request is not None:
            upsert_client(
                client_id=clientId,
                origin=request.headers.get("origin") or request.headers.get("referer"),
                user_agent=request.headers.get("user-agent"),
                client_ip=request.client.host if request.client else None,
                last_seen_at=datetime.utcnow(),
            )
        img_array = np.frombuffer(await frame.read(), np.uint8)
        # img_bytes = await frame.read()
        # print(len(img_bytes))  # Megnézheted, hogy hány byte-ot sikerült beolvasni
        # if len(img_bytes) == 0:
        #     raise HTTPException(status_code=400, detail="No image data received")
        # img_array = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
        img = cv2.flip(img, 1)

        gesture, img = process_hand_gesture(img)

        print(gesture)

        # nem statikus gesztust egybol kuldje el
        # if gesture == "swipe right" or gesture == "swipe left":
        #     await notify_subscribers(gesture)
        
        # else:
        buffer = gesture_buffers.setdefault(clientId, [])
        if len(buffer) >= GESTURE_THRESHOLD:
            buffer.pop(0)

        buffer.append(gesture)

        if len(buffer) == GESTURE_THRESHOLD and all(g == gesture for g in buffer):
            await notify_subscribers(clientId, gesture)
            buffer.clear()

        return {"message": "frame processed"}

    except Exception as e:
        return {"error": str(e)}
