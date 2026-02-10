# Edge-AI-Vision (Gesture Vision AI)

run API:    cd Edge-AI-Vision
            uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload --reload-dir app

run client app:
    run webhook server: cd Edge-AI-Vision/client_frontend
                        node webhook_server.js
    
    run react app:      cd Edge-AI-Vision/client_frontend
                        npm start

run with docker-compose: docker compose -f docker/docker-compose.yml up --build