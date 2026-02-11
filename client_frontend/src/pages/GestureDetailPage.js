import React, { useRef, useEffect, useState } from "react";
import Webcam from "react-webcam";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import "../App.css";
import { getGestures } from "../utils/gestureOptions";
import { useParams } from "react-router-dom";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button as MuiButton, Typography } from "@mui/material";

const SERVER_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";
const WS_URL = process.env.REACT_APP_WS_URL || "ws://127.0.0.1:8000/ws";

const GestureDetailPage = () => {
    const webcamRef = useRef(null);
    const frameInterval = useRef(null);
    const [gesture, setGesture] = useState("");
    const [clientId, setClientId] = useState("");
    const [consentAccepted, setConsentAccepted] = useState(
        sessionStorage.getItem("cameraConsentAccepted") === "true"
    );
    const wsRef = useRef(null);
    const mediaStreamRef = useRef(null);
    const { t } = useTranslation();
    const location = useLocation();
const stopCameraTracks = () => {
    const videoEl = webcamRef.current?.video;
    const stream = mediaStreamRef.current || webcamRef.current?.stream || videoEl?.srcObject;
    if (stream && stream.getTracks) {
        stream.getTracks().forEach((track) => track.stop());
    }
    if (videoEl) {
        videoEl.srcObject = null;
    }
    mediaStreamRef.current = null;
};
    useEffect(() => {
        const handleUnload = () => {
            stopCameraTracks();
        };
        window.addEventListener("beforeunload", handleUnload);
        return () => window.removeEventListener("beforeunload", handleUnload);
    }, []);
    const navigate = useNavigate();

    const gestures = getGestures(t);
    const { gestureId } = useParams();
    const currentGestureData = gestures.find((g) => g.id === Number(gestureId));

    useEffect(() => {
        const existingId = sessionStorage.getItem("clientId");
        if (existingId) {
            setClientId(existingId);
            fetch(`${SERVER_URL}/register_client`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    clientId: existingId,
                    consentAccepted: sessionStorage.getItem("cameraConsentAccepted") === "true",
                }),
            }).catch(() => {});
            return;
        }
        const newId = (typeof crypto !== "undefined" && crypto.randomUUID && crypto.randomUUID())
            || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        sessionStorage.setItem("clientId", newId);
        setClientId(newId);
        fetch(`${SERVER_URL}/register_client`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                clientId: newId,
                consentAccepted: sessionStorage.getItem("cameraConsentAccepted") === "true",
            }),
        }).catch(() => {});
    }, []);

    useEffect(() => {
        if (!clientId || !consentAccepted) {
            return;
        }
        const ws = new WebSocket(`${WS_URL}?clientId=${encodeURIComponent(clientId)}`);
        wsRef.current = ws;

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data?.gesture) {
                    setGesture(data.gesture);
                }
            } catch (e) {
                console.error("Invalid WS message", e);
            }
        };

        startFrameStreaming();

        return () => {
            stopFrameStreaming();
            stopCameraTracks();
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
        };
    }, [clientId, consentAccepted]);

    const startFrameStreaming = () => {
        frameInterval.current = setInterval(async () => {
            if (webcamRef.current && webcamRef.current.video.readyState === 4 && clientId) {
                const video = webcamRef.current.video;
                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d");

                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                canvas.toBlob(async (blob) => {
                    if (blob) {
                        const formData = new FormData();
                        formData.append("frame", blob, "frame.jpg");

                        try {
                            await fetch(`${SERVER_URL}/process_frame?clientId=${encodeURIComponent(clientId)}`, {
                                method: "POST",
                                body: formData,
                            });
                        } catch (error) {
                            console.error("Error sending frame", error);
                        }
                    }
                }, "image/jpeg");
            }
        }, 100);
    };

    const stopFrameStreaming = () => {
        if (frameInterval.current) {
            clearInterval(frameInterval.current);
            frameInterval.current = null;
        }
    };

    useEffect(() => {
        return () => {
            if (location.pathname.startsWith("/practice/")) {
                stopFrameStreaming();
                stopCameraTracks();
                if (wsRef.current) {
                    wsRef.current.close();
                    wsRef.current = null;
                }
            }
        };
    }, [location.pathname]);

    let backgroundColor = "white";
    if (gesture !== "no hand detected" && gesture !== "Normal" && currentGestureData) {
        backgroundColor = gesture === currentGestureData.name
            ? "rgba(0, 255, 0, 0.3)"
            : "rgba(255, 0, 0, 0.3)";
    }

    return (
        <div
            style={{
                minHeight: "100vh",
                background: "linear-gradient(135deg, #faf7f2 0%, #f3efe7 100%)",
                display: "flex",
                justifyContent: "center",
                alignItems: "flex-start",
                paddingTop: "30px",
                paddingLeft: "16px",
                paddingRight: "16px",
            }}
        >
            <Dialog open={!consentAccepted} maxWidth="sm" fullWidth>
                <DialogTitle>Kamera használat jóváhagyása</DialogTitle>
                <DialogContent>
                    <Typography variant="body1" sx={{ mb: 2 }}>
                        A kamera képe titkosítva kerül továbbításra, és kizárólag a gesztusfelismeréshez
                        használjuk fel. Harmadik félnek nem továbbítjuk, és nem tároljuk.
                    </Typography>
                    <Typography variant="body2">
                        A folytatáshoz kérlek fogadd el a feltételeket.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <MuiButton
                        variant="outlined"
                        onClick={() => navigate("/practice")}
                    >
                        Nem fogadom el
                    </MuiButton>
                    <MuiButton
                        variant="contained"
                        onClick={() => {
                            sessionStorage.setItem("cameraConsentAccepted", "true");
                            setConsentAccepted(true);
                            if (clientId) {
                                fetch(`${SERVER_URL}/client_consent`, {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ clientId, consentAccepted: true }),
                                }).catch(() => {});
                            }
                        }}
                    >
                        Elfogadom
                    </MuiButton>
                </DialogActions>
            </Dialog>
            <div
                className="container"
                style={{
                    backgroundColor,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "85vh",
                    width: "58%",
                    borderRadius: "10px",
                }}
            >
                {currentGestureData && (
                    <p style={{ marginRight: "3px", marginLeft: "3px", marginTop: "15px", fontSize: "16px", fontWeight: "bold", textAlign: "center", }}>
                        {currentGestureData.description}
                    </p>
                )}
                {consentAccepted && (
                    <Webcam
                        ref={webcamRef}
                        onUserMedia={(stream) => {
                            mediaStreamRef.current = stream;
                        }}
                        onUserMediaError={() => {
                            mediaStreamRef.current = null;
                        }}
                        style={{ width: "100%", maxWidth: "840px", borderRadius: "10px", transform: "scaleX(-1)" }}
                    />
                )}
                <p style={{ marginTop: "10px", fontSize: "20px", fontWeight: "bold" }}>
                    {t("presentationPage.recognizedGesture")} {gesture}
                </p>
            </div>
        </div>
    );
};

export default GestureDetailPage;
