# Edge-AI-Vision (Gesture Vision AI)

run API:    cd Edge-AI-Vision
            uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload --reload-dir app

run client app:
    run react app:      cd Edge-AI-Vision/client_frontend
                        npm start

run with docker-compose: docker compose -f docker/docker-compose.yml up --build

export DATABASE_URL=postgresql+psycopg2://gesture:gesture_password@localhost:5432/gesture_db

## Production-like Docker run (single public entrypoint)

Run:

`docker compose -f docker/docker-compose.prod.yml up --build`

Open:

`http://localhost:3000`

This stack serves frontend from Nginx and proxies API + WebSocket (`/ws`) to the `api` container.

## Ngrok test from local machine

1. Start prod stack:
`docker compose -f docker/docker-compose.prod.yml up --build`
2. Start tunnel:
`ngrok http 3000`
3. Open the generated `https://...` URL in browser.

Because frontend uses same-origin paths, HTTP calls and WebSocket (`wss://.../ws`) go through the same ngrok URL.
