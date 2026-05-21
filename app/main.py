from fastapi import FastAPI
from api.routes import router
import uvicorn
from fastapi.middleware.cors import CORSMiddleware
from db import init_db
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

app = FastAPI()

app.include_router(router)

init_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# build_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "client_frontend", "build")
# app.mount("/", StaticFiles(directory=build_dir, html=True), name="static")

app.include_router(router)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
