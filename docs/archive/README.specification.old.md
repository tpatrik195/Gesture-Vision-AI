# Gesture Vision AI - Specification README

## 1. Project Overview

Gesture Vision AI egy valós idejű kézgesztus-felismerő rendszer prezentációvezérléshez és gyakorláshoz.

Fő cél:
- kameraképből kézgesztusok detektálása
- gesztusok továbbítása a frontendnek WebSocketen
- prezentáció navigáció gesztusokkal (pl. `Swipe Left`, `Swipe Right`)
- gyakorló mód, ahol a felhasználó visszajelzést kap a felismert gesztusról

## 2. High-Level Architecture

Komponensek:
- Frontend: React + MUI (`client_frontend`)
- Backend API/WS: FastAPI (`app`)
- Gesture engine: OpenCV + MediaPipe Tasks
- Adatbázis: PostgreSQL (session/meta tárolásra előkészítve)
- Deployment/proxy: Docker Compose + Nginx (prod stack)

Fő kommunikáció:
- HTTP:
  - `POST /process_frame`
  - `POST /register_client`
  - `POST /client_consent`
- WebSocket:
  - `GET /ws?clientId=...`

## 3. Backend Technical Design

Fő fájlok:
- `app/main.py`: FastAPI app inicializálás, CORS, router regisztráció, DB init
- `app/api/routes.py`: API + WebSocket endpointok
- `app/api/process.py`: frame -> gesture pipeline
- `app/models/hand_detectation.py`: kézdetektálás és gesztuslogika
- `app/db.py`: SQLAlchemy engine, tábla, upsert logika

### 3.1 Gesture recognition pipeline

1. Backend kap egy képkockát (`/process_frame` vagy WS binary frame).
2. OpenCV dekódolja (`cv2.imdecode`) és tükrözi (`cv2.flip`).
3. `process_hand_gesture` RGB-re konvertál.
4. MediaPipe Hand Landmarker landmarkokat ad.
5. `detect_gesture()` egyszerű landmark szabályokkal dönt:
   - `Pointing`
   - `Swipe Left`
   - `Swipe Right`
   - fallback: `None` / `no hand detected`
6. Eredmény visszaküldése WS-en az adott kliensnek.

### 3.2 WebSocket model

- Endpoint: `/ws`
- Kötelező query param: `clientId`
- Backend `clientId` -> WebSocket kapcsolat map-et tart (`websocket_clients`)
- A gesztus az adott kliensnek megy vissza JSON-ban:
  - `{"gesture": "Swipe Right"}`

## 4. Frontend Technical Design

Fő oldalak:
- `HomePage`: bemutató / információ
- `PresentationPage`: prezentációvezérlés és kamera-feldolgozás
- `PracticePage`: gesztus gyakorló lista
- `GestureDetailPage`: adott gesztus gyakorlása valós idejű visszajelzéssel
- `SettingsPage`: gesztus-action mapping + debug opció

### 4.1 Frontend communication behavior

A frontend same-origin alapon kommunikál:
- HTTP: `window.location.origin`
- WS: `ws://<host>/ws` vagy `wss://<host>/ws`

Ez azért fontos, mert így Docker proxy + ngrok + szerveres reverse proxy esetén is működik ugyanazzal a builddel.

### 4.2 Presentation flow (important)

`PresentationPage` működése röviden:
- kamera stream helyi feldolgozás + vizuális kompozit
- frame küldés backendnek (`/process_frame`)
- WS-en érkező gesztus alapján slide navigáció / UI műveletek
- fullscreen és mobil orientáció kezelés (landscape lock ahol támogatott)

## 5. Database

`app/db.py` tartalmazza a `client_sessions` táblát:
- `client_id`, `consent_accepted`, `client_ip`, `origin`, `user_agent`, timestamp mezők

Jelenleg több DB írás kommentelve van (`routes.py`), de az infrastruktúra és az `upsert_client()` kész.

## 6. Technologies

- Frontend:
  - React 19
  - Material UI
  - react-router-dom
  - i18next
  - react-webcam
  - pdfjs-dist, pptxgenjs
- Backend:
  - FastAPI
  - Uvicorn
  - OpenCV
  - MediaPipe Tasks Vision
  - NumPy
  - SQLAlchemy
- Infra:
  - Docker, Docker Compose
  - Nginx (prod reverse proxy)
  - PostgreSQL 16

## 7. Run Modes

## 7.1 Local development (without Docker)

Backend:
```bash
cd /home/patrik/Documents/Gesture-Vision-AI
export DATABASE_URL=postgresql+psycopg2://gesture:gesture_password@localhost:5432/gesture_db
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload --reload-dir app
```

Frontend:
```bash
cd /home/patrik/Documents/Gesture-Vision-AI/client_frontend
npm install
npm start
```

## 7.2 Docker development stack (hot-reload frontend)

```bash
cd /home/patrik/Documents/Gesture-Vision-AI
docker compose -f docker/docker-compose.yml up --build
```

Elérés:
- Frontend: `http://localhost:3000`
- API: `http://localhost:8000`

## 7.3 Production-like Docker stack (recommended for deploy tests)

Ez egy belépési pontot ad Nginx-szel.

```bash
cd /home/patrik/Documents/Gesture-Vision-AI
docker compose -f docker/docker-compose.prod.yml up --build -d
```

Elérés:
- App: `http://localhost:3000`

A `web` (Nginx) proxyzza:
- `/ws` -> `api:8000/ws`
- `/process_frame`, `/register_client`, `/client_consent` -> `api:8000`
- minden más route -> frontend SPA (`index.html`)

## 8. Ngrok test guide

Cél: publikus HTTPS URL-ről tesztelni helyi gépen futó stackkel.

1. Indítsd a prod stacket:
```bash
docker compose -f docker/docker-compose.prod.yml up --build -d
```

2. Indíts tunnelt:
```bash
ngrok http 3000
```

3. Nyisd meg a kapott `https://...` URL-t.

Várt működés:
- HTTP hívások same-origin mennek
- WS automatikusan `wss://<ngrok-host>/ws`
- kamera engedélykérés működik HTTPS miatt

## 9. Deployment recommendation (server)

Ajánlott:
- VPS-en a `docker-compose.prod.yml` stack futtatása
- domain a `web` konténerre irányítva
- TLS termináció (pl. Caddy vagy Nginx + Let's Encrypt)

Minimális lépések:
1. Kód felmásolás szerverre
2. `docker compose -f docker/docker-compose.prod.yml up --build -d`
3. Reverse proxy + tanúsítvány beállítás
4. Egészségellenőrzés:
   - `/` elérhető
   - `/ws` handshake sikeres
   - `process_frame` válaszol

## 10. Operational notes

- A gesture threshold jelenleg `1` (`GESTURE_THRESHOLD = 1`), tehát nagyon gyors, de zajérzékeny lehet.
- Több helyen vannak kommentelt DB írások; ha analytics/naplózás kell, ezeket vissza lehet kapcsolni.
- A `main.py` kétszer hív `app.include_router(router)`-t; működik, de érdemes egyszerire tisztítani.

## 11. Quick verification checklist

1. Nyisd meg az appot.
2. Kamera engedélyezés.
3. Presentation oldalon háttér feltöltés opcionális.
4. Gesture detection indítása.
5. DevTools Network:
   - `/ws` kapcsolat `101 Switching Protocols`
   - `/process_frame` periodikusan `200`
6. Felismert gesztus megjelenik UI-ban.
