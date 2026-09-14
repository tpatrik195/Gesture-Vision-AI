"""Session tokens for WebSocket authentication.

Clients cannot pick their own identity: the server issues an opaque token and
binds it to a generated client id. The WebSocket handshake accepts the token
only, so knowing (or guessing) someone else's client id is not enough to attach
to their gesture stream.
"""
from __future__ import annotations
import hashlib
import secrets
import time
import uuid
from dataclasses import dataclass

from app.config import settings
from app.db import repository


@dataclass
class IssuedSession:
    client_id: str
    token: str


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


class SessionTokenStore:
    """In-process token cache, backed by the database when one is configured."""

    def __init__(self) -> None:
        self._tokens: dict[str, tuple[str, float]] = {}

    def issue(self, client_id: str | None = None) -> IssuedSession:
        client_id = client_id or uuid.uuid4().hex
        token = secrets.token_urlsafe(32)
        self._tokens[hash_token(token)] = (client_id, time.time() + settings.session_token_ttl)
        self._prune()
        return IssuedSession(client_id=client_id, token=token)

    def resolve(self, token: str | None) -> str | None:
        if not token:
            return None
        token_hash = hash_token(token)

        entry = self._tokens.get(token_hash)
        if entry is not None:
            client_id, expires_at = entry
            if expires_at > time.time():
                return client_id
            self._tokens.pop(token_hash, None)

        # Fall back to the database so tokens survive a restart and work across
        # multiple API workers.
        client_id = repository.find_client_by_token(token_hash)
        if client_id:
            self._tokens[token_hash] = (client_id, time.time() + settings.session_token_ttl)
        return client_id

    def revoke(self, token: str) -> None:
        self._tokens.pop(hash_token(token), None)

    def _prune(self) -> None:
        now = time.time()
        expired = [key for key, (_, expires_at) in self._tokens.items() if expires_at <= now]
        for key in expired:
            self._tokens.pop(key, None)


token_store = SessionTokenStore()
