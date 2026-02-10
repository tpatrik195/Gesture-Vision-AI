import React, { useRef, useEffect, useState } from "react";
import Webcam from "react-webcam";
import { io } from "socket.io-client";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import "../App.css";
import { getGestures } from "../utils/gestureOptions";
import { useParams } from "react-router-dom";

const SERVER_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";
const WEBHOOK_URL = process.env.REACT_APP_WEBHOOK_URL || "http://127.0.0.1:9000/webhook";
const socket = io(process.env.REACT_APP_SOCKET_URL || "http://127.0.0.1:9000");

const GestureDetailPage = () => {
    const webcamRef = useRef(null);
    const frameInterval = useRef(null);
    const [gesture, setGesture] = useState("");
    const { t } = useTranslation();
    const location = useLocation();

    const gestures = getGestures(t);
    const { gestureId } = useParams();
    const currentGestureData = gestures.find((g) => g.id === Number(gestureId));

    useEffect(() => {
        socket.on("gesture_event", (data) => {
            setGesture(data.gesture);
        });

        return () => {
            socket.off("gesture_event");
        };
    }, []);

    const startFrameStreaming = () => {
        frameInterval.current = setInterval(async () => {
            if (webcamRef.current && webcamRef.current.video.readyState === 4) {
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
                            await fetch(`${SERVER_URL}/process_frame`, {
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

    const subscribeToWebhook = async () => {
        try {
            const response = await fetch(`${SERVER_URL}/subscribe_webhook?url=${WEBHOOK_URL}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            });

            if (!response.ok) {
                throw new Error(`Subscription failed with status ${response.status}`);
            }

        } catch (error) {
            console.error("Webhook subscription failed", error);
        }
    };

    const unsubscribeFromWebhook = async () => {
        try {
            const response = await fetch(`${SERVER_URL}/unsubscribe_webhook?url=${WEBHOOK_URL}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ url: WEBHOOK_URL }),
            });

            if (!response.ok) {
                throw new Error(`Subscription failed with status ${response.status}`);
            }

            stopFrameStreaming();
        } catch (error) {
            console.error("Unsubscription failed", error);
        }
    };

    const stopFrameStreaming = () => {
        if (frameInterval.current) {
            clearInterval(frameInterval.current);
            frameInterval.current = null;
        }
    };

    useEffect(() => {
        subscribeToWebhook();
        startFrameStreaming();

        return () => {
            if (location.pathname.startsWith("/practice/")) {
                console.log("Leaving /practice/:gestureId, unsubscribing from webhook...");
                unsubscribeFromWebhook();
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
                <Webcam ref={webcamRef} style={{ width: "100%", maxWidth: "840px", borderRadius: "10px" }} />
                <p style={{ marginTop: "10px", fontSize: "20px", fontWeight: "bold" }}>
                    {t("presentationPage.recognizedGesture")} {gesture}
                </p>
            </div>
        </div>
    );
};

export default GestureDetailPage;
