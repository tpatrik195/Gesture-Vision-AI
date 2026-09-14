"""Sliding-window rate limiting for the REST endpoints."""
from __future__ import annotations
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

from app.config import settings

_WINDOW_SECONDS = 60.0
_MAX_TRACKED_KEYS = 10_000


class RateLimiter:
    def __init__(self, max_requests: int, window: float = _WINDOW_SECONDS) -> None:
        self.max_requests = max_requests
        self.window = window
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str) -> bool:
        now = time.monotonic()
        hits = self._hits[key]
        while hits and now - hits[0] > self.window:
            hits.popleft()
        if len(hits) >= self.max_requests:
            return False
        hits.append(now)

        if len(self._hits) > _MAX_TRACKED_KEYS:
            self._evict_stale(now)
        return True

    def _evict_stale(self, now: float) -> None:
        stale = [key for key, hits in self._hits.items() if not hits or now - hits[-1] > self.window]
        for key in stale:
            self._hits.pop(key, None)


_rest_limiter = RateLimiter(settings.rest_rate_limit_per_minute)


def client_key(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def enforce_rest_limit(request: Request) -> None:
    if not _rest_limiter.check(client_key(request)):
        raise HTTPException(status_code=429, detail="Too many requests")
