#!/usr/bin/env python3
"""Post-deployment smoke test.

Exercises the same path a browser takes - session, consent, WebSocket handshake,
frame streaming - and reports measured latency, so a deployment can be verified
without opening a browser:

    python3 tools/smoke_test.py https://gesture.example.com
    python3 tools/smoke_test.py http://localhost:3000

Exit code is non-zero if any check fails, so it can gate a deploy script.
"""
from __future__ import annotations

import argparse
import json
import ssl
import struct
import sys
import time
import urllib.error
import urllib.request
from urllib.parse import urlparse

try:
    import numpy as np
    import cv2
except ImportError:
    np = None
    cv2 = None

PASS = "PASS"
FAIL = "FAIL"
SKIP = "SKIP"

results: list[tuple[str, str, str]] = []


def record(status: str, name: str, detail: str = "") -> None:
    results.append((status, name, detail))
    symbol = {PASS: "✓", FAIL: "✗", SKIP: "-"}[status]
    print(f"  {symbol} {name}" + (f"  [{detail}]" if detail else ""))


def request(url: str, method: str = "GET", payload: dict | None = None,
            token: str | None = None, timeout: float = 15.0) -> tuple[int, dict]:
    data = json.dumps(payload).encode() if payload is not None else None
    headers = {"Content-Type": "application/json"} if data else {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            body = response.read().decode()
            return response.status, json.loads(body) if body else {}
    except urllib.error.HTTPError as exc:
        return exc.code, {}


def test_http(base: str) -> dict | None:
    print("\nHTTP")
    try:
        status, health = request(f"{base}/api/health")
    except Exception as exc:
        record(FAIL, "API reachable", exc.__class__.__name__)
        return None

    if status != 200:
        record(FAIL, "API health", f"HTTP {status}")
        return None
    record(PASS, "API health", f"db={health.get('database')}, "
                               f"gestures={len(health.get('supportedGestures', []))}")

    try:
        status, index = request(base)
    except Exception:
        status = 0
    record(PASS if status == 200 else FAIL, "Frontend served", f"HTTP {status}")

    status, session = request(f"{base}/api/session", "POST", {"language": "hu"})
    if status != 200 or "token" not in session:
        record(FAIL, "Session issued", f"HTTP {status}")
        return None
    record(PASS, "Session issued", f"client={session['clientId'][:8]}...")

    status, _ = request(f"{base}/api/consent", "POST", {"accepted": True}, session["token"])
    record(PASS if status == 200 else FAIL, "Consent recorded", f"HTTP {status}")

    status, _ = request(f"{base}/api/consent", "POST", {"accepted": True})
    record(PASS if status == 401 else FAIL, "Consent rejects missing token", f"HTTP {status}")

    return session


def test_websocket(base: str, session: dict) -> None:
    print("\nWebSocket")
    try:
        import websockets  # noqa: F401
    except ImportError:
        record(SKIP, "WebSocket checks", "pip install websockets")
        return

    import asyncio

    parsed = urlparse(base)
    scheme = "wss" if parsed.scheme == "https" else "ws"
    ws_url = f"{scheme}://{parsed.netloc}/ws"

    async def run() -> None:
        import websockets

        ssl_context = ssl.create_default_context() if scheme == "wss" else None

        try:
            async with websockets.connect(ws_url, ssl=ssl_context, open_timeout=15):
                record(FAIL, "Unauthenticated connection rejected", "accepted!")
        except Exception:
            record(PASS, "Unauthenticated connection rejected")

        try:
            async with websockets.connect(
                f"{ws_url}?token={session['token']}", ssl=ssl_context, open_timeout=15
            ) as socket:
                ready = json.loads(await asyncio.wait_for(socket.recv(), 15))
                if ready.get("type") != "ready":
                    record(FAIL, "Handshake", f"got {ready.get('type')}")
                    return
                record(PASS, "Handshake", "ready received")

                if np is None or cv2 is None:
                    record(SKIP, "Frame streaming", "needs numpy and opencv")
                    return

                frame = np.random.randint(0, 255, (360, 640, 3), dtype=np.uint8)
                jpeg = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 70])[1].tobytes()

                await socket.send(json.dumps({"type": "hello", "page": "smoke-test"}))
                latencies = []
                for sequence in range(10, 51, 10):
                    sent = time.perf_counter()
                    await socket.send(struct.pack(">I", sequence) + jpeg)
                    deadline = time.time() + 10
                    while time.time() < deadline:
                        message = json.loads(await asyncio.wait_for(socket.recv(), 10))
                        if message.get("seq") == sequence:
                            latencies.append((time.perf_counter() - sent) * 1000)
                            break

                if latencies:
                    average = sum(latencies) / len(latencies)
                    record(PASS, "Frame round-trip",
                           f"n={len(latencies)}, avg={average:.0f} ms, max={max(latencies):.0f} ms")
                else:
                    record(FAIL, "Frame round-trip", "no acknowledgement")

                await socket.send(struct.pack(">I", 99) + b"x" * (3 * 1024 * 1024))
                reply = json.loads(await asyncio.wait_for(socket.recv(), 10))
                record(PASS if reply.get("code") == "frame_too_large" else FAIL,
                       "Oversized frame rejected", reply.get("code", reply.get("type", "?")))
        except Exception as exc:
            record(FAIL, "Authenticated session", f"{exc.__class__.__name__}: {exc}")

    asyncio.get_event_loop().run_until_complete(run())


def test_security(base: str) -> None:
    print("\nSecurity")
    parsed = urlparse(base)
    if parsed.scheme == "https":
        record(PASS, "HTTPS in use")
    else:
        record(SKIP, "HTTPS in use", "plain HTTP - expected only for local testing")

    try:
        req = urllib.request.Request(base)
        with urllib.request.urlopen(req, timeout=15) as response:
            headers = {k.lower(): v for k, v in response.headers.items()}
    except Exception:
        headers = {}

    for header in ("x-content-type-options", "x-frame-options", "permissions-policy"):
        record(PASS if header in headers else FAIL, f"Header {header}", headers.get(header, "missing"))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("base_url", help="e.g. https://gesture.example.com")
    args = parser.parse_args()
    base = args.base_url.rstrip("/")

    print(f"Smoke testing {base}")
    session = test_http(base)
    if session:
        test_websocket(base, session)
    test_security(base)

    failures = [r for r in results if r[0] == FAIL]
    passed = [r for r in results if r[0] == PASS]
    print(f"\n{len(passed)} passed, {len(failures)} failed, "
          f"{len([r for r in results if r[0] == SKIP])} skipped")
    if failures:
        print("\nFailed checks:")
        for _, name, detail in failures:
            print(f"  - {name}: {detail}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
