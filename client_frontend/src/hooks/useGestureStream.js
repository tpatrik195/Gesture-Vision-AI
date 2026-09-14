import { useCallback, useEffect, useRef, useState } from "react";
import { ensureSession, WS_URL } from "../api/client";

// Single transport for gesture recognition: frames go up the WebSocket as
// binary, events come back down it. Frames are captured into one reused canvas
// and downscaled, because the detector normalises internally anyway and sending
// full-resolution stills only costs CPU and bandwidth.

const CAPTURE_WIDTH = 640;
const JPEG_QUALITY = 0.7;
const SEND_INTERVAL_MS = 100;
const MAX_BUFFERED_BYTES = 512 * 1024;
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 15000;

export const STATUS = {
    IDLE: "idle",
    CONNECTING: "connecting",
    CONNECTED: "connected",
    RECONNECTING: "reconnecting",
    ERROR: "error",
};

export default function useGestureStream({ page = "unknown", onGesture, onPointer } = {}) {
    const [status, setStatus] = useState(STATUS.IDLE);
    const [error, setError] = useState(null);
    const [handPresent, setHandPresent] = useState(false);
    const [latency, setLatency] = useState(null);

    const socketRef = useRef(null);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const timerRef = useRef(null);
    const sequenceRef = useRef(0);
    const inFlightRef = useRef(false);
    const pendingRef = useRef(new Map());
    const reconnectRef = useRef(null);
    const attemptsRef = useRef(0);
    const wantActiveRef = useRef(false);
    const practiceTargetRef = useRef(null);
    const onGestureRef = useRef(onGesture);
    const onPointerRef = useRef(onPointer);

    useEffect(() => {
        onGestureRef.current = onGesture;
        onPointerRef.current = onPointer;
    }, [onGesture, onPointer]);

    const clearTimers = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        if (reconnectRef.current) {
            clearTimeout(reconnectRef.current);
            reconnectRef.current = null;
        }
    }, []);

    const captureAndSend = useCallback(async () => {
        const socket = socketRef.current;
        const video = videoRef.current;
        if (!socket || socket.readyState !== WebSocket.OPEN) return;
        if (!video || !video.videoWidth) return;
        if (inFlightRef.current) return;
        if (socket.bufferedAmount > MAX_BUFFERED_BYTES) return;

        inFlightRef.current = true;
        try {
            if (!canvasRef.current) {
                canvasRef.current = document.createElement("canvas");
            }
            const canvas = canvasRef.current;
            const scale = Math.min(1, CAPTURE_WIDTH / video.videoWidth);
            const width = Math.round(video.videoWidth * scale);
            const height = Math.round(video.videoHeight * scale);
            if (canvas.width !== width || canvas.height !== height) {
                canvas.width = width;
                canvas.height = height;
            }
            canvas.getContext("2d").drawImage(video, 0, 0, width, height);

            const blob = await new Promise((resolve) =>
                canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
            );
            if (!blob || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
                return;
            }

            const jpeg = await blob.arrayBuffer();
            const sequence = (sequenceRef.current + 1) % 0xffffffff;
            sequenceRef.current = sequence;

            const payload = new Uint8Array(4 + jpeg.byteLength);
            new DataView(payload.buffer).setUint32(0, sequence, false);
            payload.set(new Uint8Array(jpeg), 4);

            pendingRef.current.set(sequence, performance.now());
            if (pendingRef.current.size > 60) {
                const oldest = pendingRef.current.keys().next().value;
                pendingRef.current.delete(oldest);
            }
            socketRef.current.send(payload);
        } catch (err) {
            // A dropped frame is not worth surfacing; the next tick retries.
        } finally {
            inFlightRef.current = false;
        }
    }, []);

    const handleMessage = useCallback((event) => {
        let message;
        try {
            message = JSON.parse(event.data);
        } catch {
            return;
        }

        if (message.seq !== undefined) {
            const sentAt = pendingRef.current.get(message.seq);
            if (sentAt !== undefined) {
                pendingRef.current.delete(message.seq);
                const roundtrip = performance.now() - sentAt;
                const pipeline = message.pipelineMs ?? 0;
                setLatency({
                    roundtripMs: Math.round(roundtrip),
                    pipelineMs: Math.round(pipeline),
                    networkMs: Math.max(0, Math.round(roundtrip - pipeline)),
                });
            }
        }

        switch (message.type) {
            case "gesture":
                onGestureRef.current?.(message.gesture, message);
                break;
            case "pointer":
                onPointerRef.current?.({ x: message.x, y: message.y });
                break;
            case "status":
                setHandPresent(message.state === "tracking");
                if (message.state !== "tracking") {
                    onPointerRef.current?.(null);
                }
                break;
            case "error":
                setError(message.message || message.code);
                break;
            default:
                break;
        }
    }, []);

    const connect = useCallback(async () => {
        if (!wantActiveRef.current) return;
        clearTimers();

        try {
            const session = await ensureSession();
            if (!wantActiveRef.current) return;

            setStatus(attemptsRef.current > 0 ? STATUS.RECONNECTING : STATUS.CONNECTING);
            const socket = new WebSocket(`${WS_URL}?token=${encodeURIComponent(session.token)}`);
            socket.binaryType = "arraybuffer";
            socketRef.current = socket;

            socket.onopen = () => {
                attemptsRef.current = 0;
                setStatus(STATUS.CONNECTED);
                setError(null);
                socket.send(JSON.stringify({ type: "hello", page }));
                if (practiceTargetRef.current) {
                    socket.send(
                        JSON.stringify({ type: "practice", expected: practiceTargetRef.current })
                    );
                }
                timerRef.current = setInterval(captureAndSend, SEND_INTERVAL_MS);
            };

            socket.onmessage = handleMessage;

            socket.onerror = () => {
                setError("connection");
            };

            socket.onclose = (event) => {
                clearTimers();
                socketRef.current = null;
                setHandPresent(false);
                if (!wantActiveRef.current) {
                    setStatus(STATUS.IDLE);
                    return;
                }
                if (event.code === 4401) {
                    // Token rejected: drop it so the next attempt asks for a new one.
                    try {
                        sessionStorage.removeItem("gestureSessionToken");
                        sessionStorage.removeItem("gestureClientId");
                    } catch {
                        // ignore
                    }
                }
                if (event.code === 4503) {
                    setError("server_busy");
                }
                attemptsRef.current += 1;
                const delay = Math.min(
                    RECONNECT_BASE_MS * 2 ** (attemptsRef.current - 1),
                    RECONNECT_MAX_MS
                );
                setStatus(STATUS.RECONNECTING);
                reconnectRef.current = setTimeout(connect, delay);
            };
        } catch (err) {
            if (!wantActiveRef.current) return;
            setStatus(STATUS.ERROR);
            setError("session");
            attemptsRef.current += 1;
            const delay = Math.min(
                RECONNECT_BASE_MS * 2 ** (attemptsRef.current - 1),
                RECONNECT_MAX_MS
            );
            reconnectRef.current = setTimeout(connect, delay);
        }
    }, [captureAndSend, clearTimers, handleMessage, page]);

    const start = useCallback(
        (videoElement) => {
            videoRef.current = videoElement || videoRef.current;
            if (wantActiveRef.current) return;
            wantActiveRef.current = true;
            attemptsRef.current = 0;
            connect();
        },
        [connect]
    );

    const stop = useCallback(() => {
        wantActiveRef.current = false;
        clearTimers();
        pendingRef.current.clear();
        const socket = socketRef.current;
        socketRef.current = null;
        if (socket) {
            socket.onclose = null;
            socket.onerror = null;
            socket.onmessage = null;
            try {
                socket.close();
            } catch {
                // already closing
            }
        }
        setStatus(STATUS.IDLE);
        setHandPresent(false);
    }, [clearTimers]);

    const setVideoElement = useCallback((videoElement) => {
        videoRef.current = videoElement;
    }, []);

    const setPracticeTarget = useCallback((gestureName) => {
        practiceTargetRef.current = gestureName;
        const socket = socketRef.current;
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "practice", expected: gestureName }));
        }
    }, []);

    useEffect(() => stop, [stop]);

    return {
        status,
        error,
        handPresent,
        latency,
        isActive: status === STATUS.CONNECTED,
        start,
        stop,
        setVideoElement,
        setPracticeTarget,
    };
}
