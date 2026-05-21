#!/usr/bin/env python3
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import time

STATE = {
    "gesture": "thumbs_up",
    "action": "toggle_mute",
    "confidence": 0.95,
    "timestamp": int(time.time() * 1000),
}

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path != "/latest":
            self.send_response(404)
            self.end_headers()
            return

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(STATE).encode("utf-8"))

    def do_POST(self):
        if self.path != "/latest":
            self.send_response(404)
            self.end_headers()
            return

        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length)
        payload = json.loads(body.decode("utf-8"))

        STATE["gesture"] = payload.get("gesture", STATE["gesture"])
        STATE["action"] = payload.get("action", STATE["action"])
        STATE["confidence"] = float(payload.get("confidence", STATE["confidence"]))
        STATE["timestamp"] = int(time.time() * 1000)

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"ok": True, "state": STATE}).encode("utf-8"))

if __name__ == "__main__":
    server = HTTPServer(("127.0.0.1", 8765), Handler)
    print("Bridge running on http://127.0.0.1:8765/latest")
    server.serve_forever()
