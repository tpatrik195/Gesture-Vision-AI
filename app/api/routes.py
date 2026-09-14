"""REST endpoints: session issuing, consent and health."""
from __future__ import annotations
import logging
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field

from app.core.rate_limit import enforce_rest_limit
from app.core.security import hash_token, token_store
from app.db import database, repository
from app.models.hand_detector import SUPPORTED_GESTURES
from app.services.gesture_session import session_manager

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api")

CONSENT_VERSION = "1.0"


class SessionRequest(BaseModel):
    language: Optional[str] = Field(default=None, max_length=8)


class SessionResponse(BaseModel):
    clientId: str
    token: str
    supportedGestures: List[str]


class ConsentRequest(BaseModel):
    accepted: bool


def require_client(authorization: Optional[str] = Header(default=None)) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing session token")
    token = authorization.split(" ", 1)[1].strip()
    client_id = token_store.resolve(token)
    if not client_id:
        raise HTTPException(status_code=401, detail="Invalid or expired session token")
    return client_id


@router.post("/session", response_model=SessionResponse)
async def create_session(payload: SessionRequest, request: Request) -> SessionResponse:
    enforce_rest_limit(request)
    issued = token_store.issue()
    repository.upsert_client(
        client_id=issued.client_id,
        token_hash=hash_token(issued.token),
        client_ip=request.client.host if request.client else None,
        origin=request.headers.get("origin") or request.headers.get("referer"),
        user_agent=request.headers.get("user-agent"),
        language=payload.language,
        last_seen_at=datetime.utcnow(),
    )
    return SessionResponse(
        clientId=issued.client_id,
        token=issued.token,
        supportedGestures=list(SUPPORTED_GESTURES),
    )


@router.post("/consent")
async def record_consent(
    payload: ConsentRequest,
    request: Request,
    client_id: str = Depends(require_client),
) -> dict:
    enforce_rest_limit(request)
    now = datetime.utcnow()
    repository.upsert_client(
        client_id=client_id,
        consent_accepted=payload.accepted,
        consent_at=now if payload.accepted else None,
        consent_version=CONSENT_VERSION if payload.accepted else None,
        client_ip=request.client.host if request.client else None,
        origin=request.headers.get("origin") or request.headers.get("referer"),
        user_agent=request.headers.get("user-agent"),
        last_seen_at=now,
    )
    return {"accepted": payload.accepted, "consentVersion": CONSENT_VERSION}


@router.get("/health")
async def health() -> dict:
    return {
        "status": "ok",
        "database": "connected" if database.is_enabled() else "disabled",
        "activeSessions": session_manager.active_count,
        "supportedGestures": list(SUPPORTED_GESTURES),
    }
