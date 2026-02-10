import React, { useRef, useEffect, useState } from "react";
import Webcam from "react-webcam";
import { io } from "socket.io-client";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import "../App.css";
import { getGestures } from "../utils/gestureOptions";
import { useParams } from "react-router-dom";

const SERVER_URL = "http://127.0.0.1:8000";
const WEBHOOK_URL = "http://127.0.0.1:9000/webhook";
const socket = io("http://localhost:9000");

const GestureDetailPage = () => {
    const webcamRef = useRef(null);
    const canvasRef = useRef(null);
    const frameInterval = useRef(null);
    const [gesture, setGesture] = useState("");
    const { t } = useTranslation();
    const location = useLocation();

    const gestures = getGestures(t);
    const { gestureId } = useParams();
    const currentGestureData = gestures.find((g) => g.id === Number(gestureId));

    useEffect(() => {
        socket.on("gesture_event", (data) => {
            console.log("Gesture received from WebSocket:", data);
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

            console.log("Successfully subscribed to webhook.");
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



// import React, { useRef, useEffect, useState } from "react";
// import Webcam from "react-webcam";
// import { io } from "socket.io-client";
// import { useTranslation } from "react-i18next";
// import { useLocation, useParams } from "react-router-dom";
// import { getGestures } from "../utils/gestureOptions";
// import "../App.css";

// import * as cam from "@mediapipe/camera_utils";
// import { Hands } from "@mediapipe/hands";
// import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";

// const SERVER_URL = "http://127.0.0.1:8000";
// const WEBHOOK_URL = "http://127.0.0.1:9000/webhook";
// const socket = io("http://localhost:9000");

// const GestureDetailPage = () => {
//     const webcamRef = useRef(null);
//     const canvasRef = useRef(null);
//     const frameInterval = useRef(null);
//     const [gesture, setGesture] = useState("");
//     const { t } = useTranslation();
//     const location = useLocation();
//     const { gestureId } = useParams();

//     const gestures = getGestures(t);
//     const currentGestureData = gestures.find((g) => g.id === Number(gestureId));

//     useEffect(() => {
//         socket.on("gesture_event", (data) => {
//             console.log("Gesture received from WebSocket:", data);
//             setGesture(data.gesture);
//         });

//         return () => {
//             socket.off("gesture_event");
//         };
//     }, []);

//     const startFrameStreaming = () => {
//         frameInterval.current = setInterval(async () => {
//             if (webcamRef.current && webcamRef.current.video.readyState === 4) {
//                 const video = webcamRef.current.video;
//                 const canvas = document.createElement("canvas");
//                 const ctx = canvas.getContext("2d");

//                 canvas.width = video.videoWidth;
//                 canvas.height = video.videoHeight;
//                 ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

//                 canvas.toBlob(async (blob) => {
//                     if (blob) {
//                         const formData = new FormData();
//                         formData.append("frame", blob, "frame.jpg");

//                         try {
//                             await fetch(`${SERVER_URL}/process_frame`, {
//                                 method: "POST",
//                                 body: formData,
//                             });
//                         } catch (error) {
//                             console.error("Error sending frame", error);
//                         }
//                     }
//                 }, "image/jpeg");
//             }
//         }, 100);
//     };

//     const subscribeToWebhook = async () => {
//         try {
//             const response = await fetch(`${SERVER_URL}/subscribe_webhook?url=${WEBHOOK_URL}`, {
//                 method: "POST",
//                 headers: { "Content-Type": "application/json" },
//             });

//             if (!response.ok) {
//                 throw new Error(`Subscription failed with status ${response.status}`);
//             }

//             console.log("Successfully subscribed to webhook.");
//         } catch (error) {
//             console.error("Webhook subscription failed", error);
//         }
//     };

//     const unsubscribeFromWebhook = async () => {
//         try {
//             const response = await fetch(`${SERVER_URL}/unsubscribe_webhook?url=${WEBHOOK_URL}`, {
//                 method: "POST",
//                 headers: {
//                     "Content-Type": "application/json",
//                 },
//                 body: JSON.stringify({ url: WEBHOOK_URL }),
//             });

//             if (!response.ok) {
//                 throw new Error(`Subscription failed with status ${response.status}`);
//             }

//             stopFrameStreaming();
//         } catch (error) {
//             console.error("Unsubscription failed", error);
//         }
//     };

//     const stopFrameStreaming = () => {
//         if (frameInterval.current) {
//             clearInterval(frameInterval.current);
//             frameInterval.current = null;
//         }
//     };

//     useEffect(() => {
//         subscribeToWebhook();
//         startFrameStreaming();

//         return () => {
//             if (location.pathname.startsWith("/practice/")) {
//                 console.log("Leaving /practice/:gestureId, unsubscribing from webhook...");
//                 unsubscribeFromWebhook();
//             }
//         };
//     }, [location.pathname]);

//     // Hand landmark detection and drawing
//     useEffect(() => {
//         if (!webcamRef.current) return;

//         const hands = new Hands({
//             locateFile: (file) =>
//                 `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
//         });

//         hands.setOptions({
//             maxNumHands: 1,
//             modelComplexity: 1,
//             minDetectionConfidence: 0.7,
//             minTrackingConfidence: 0.7,
//         });

//         hands.onResults((results) => {
//             const canvasElement = canvasRef.current;
//             const canvasCtx = canvasElement.getContext("2d");

//             canvasCtx.save();
//             canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
//             canvasCtx.drawImage(
//                 results.image,
//                 0,
//                 0,
//                 canvasElement.width,
//                 canvasElement.height
//             );

//             if (results.multiHandLandmarks) {
//                 for (const landmarks of results.multiHandLandmarks) {
//                     drawConnectors(canvasCtx, landmarks, Hands.HAND_CONNECTIONS, {
//                         color: "#00FF00",
//                         lineWidth: 2,
//                     });
//                     drawLandmarks(canvasCtx, landmarks, {
//                         color: "#FF0000",
//                         lineWidth: 1,
//                     });
//                 }
//             }

//             canvasCtx.restore();
//         });

//         const camera = new cam.Camera(webcamRef.current.video, {
//             onFrame: async () => {
//                 await hands.send({ image: webcamRef.current.video });
//             },
//             width: 640,
//             height: 480,
//         });

//         camera.start();
//     }, []);

//     let backgroundColor = "white";
//     if (gesture !== "no hand detected" && currentGestureData) {
//         backgroundColor = gesture === currentGestureData.name
//             ? "rgba(0, 255, 0, 0.3)"
//             : "rgba(255, 0, 0, 0.3)";
//     }

//     return (
//         <div
//             className="container"
//             style={{
//                 backgroundColor,
//                 display: "flex",
//                 flexDirection: "column",
//                 alignItems: "center",
//                 justifyContent: "center",
//                 height: "85vh",
//                 width: "58%",
//                 borderRadius: "10px",
//                 position: "relative",
//             }}
//         >
//             {currentGestureData && (
//                 <p style={{ marginTop: "10px", fontSize: "16px", fontWeight: "bold" }}>
//                     {currentGestureData.description}
//                 </p>
//             )}
//             <Webcam
//                 ref={webcamRef}
//                 style={{
//                     width: "100%",
//                     maxWidth: "840px",
//                     borderRadius: "10px",
//                     zIndex: 1,
//                 }}
//             />
//             <canvas
//                 ref={canvasRef}
//                 style={{
//                     position: "absolute",
//                     top: 0,
//                     left: 0,
//                     width: "100%",
//                     maxWidth: "840px",
//                     height: "100%",
//                     borderRadius: "10px",
//                     zIndex: 2,
//                 }}
//             />
//             <p style={{ marginTop: "15px", fontSize: "20px", fontWeight: "bold" }}>
//                 {t("presentationPage.recognizedGesture")} {gesture}
//             </p>
//         </div>
//     );
// };

// export default GestureDetailPage;
