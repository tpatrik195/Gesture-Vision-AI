"""Gesture Vision AI - gesture recognition API."""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import routes, websocket
from app.config import settings
from app.db import database

logging.basicConfig(
    level=getattr(logging, settings.log_level, logging.INFO),
    format="%(asctime)s - %(levelname)s - %(name)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    database.init_engine()
    await database.start_writer()
    logger.info(
        "API ready (model=%s, max_sessions=%d)",
        settings.model_path,
        settings.max_concurrent_sessions,
    )
    yield
    await database.stop_writer()


app = FastAPI(
    title="Gesture Vision AI",
    version="2.0.0",
    description="Real-time hand gesture recognition API with WebSocket streaming.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=settings.cors_allow_credentials,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(routes.router)
# The gesture socket lives under /api too, so a single proxy rule covers the
# whole backend and it can never collide with a dev server's own /ws socket.
app.include_router(websocket.router, prefix="/api")
