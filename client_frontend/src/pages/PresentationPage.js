import React, { useRef, useEffect, useState } from "react";
import Webcam from "react-webcam";
import { SelfieSegmentation } from "@mediapipe/selfie_segmentation";
import * as cam from "@mediapipe/camera_utils";
import '../App.css';
import DisplayLottie from "../DisplayLottie";
import loader from '../85646-loading-dots-blue.json'
import PptxGenJS from "pptxgenjs";
import html2canvas from "html2canvas";
import { useTranslation } from 'react-i18next';
import CursorFollower from "../components/CursorFollower";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button as MuiButton, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";

import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";
import { GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf";
GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

const SERVER_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";

const WS_URL = process.env.REACT_APP_WS_URL || "ws://127.0.0.1:8000/ws";

const PresentationPage = () => {
    const webcamRef = useRef(null);
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const [imageURL, setimageURL] = useState("");
    const [load, setLoad] = useState(false);
    const [pdfPageNum, setPdfPageNum] = useState(1);
    const [pptSlideNum, setPptSlideNum] = useState(0);
    const [totalPdfPages, setTotalPdfPages] = useState(0);
    const [pptSlides, setPptSlides] = useState([]);
    const [pdfUrl, setPdfUrl] = useState("");
    const [fileType, setFileType] = useState("");
    const [gesture, setGesture] = useState("");
    const [showPerson, setShowPerson] = useState(true);
    const [subscribed, setSubscribed] = useState(false);
    const [fullScreenMode, setFullScreenMode] = useState(false);
    const frameInterval = useRef(null);
    const [markerPosition, setMarkerPosition] = useState(null);
    const [clientId, setClientId] = useState("");
    const [consentAccepted, setConsentAccepted] = useState(
        sessionStorage.getItem("cameraConsentAccepted") === "true"
    );
    const [videoReady, setVideoReady] = useState(false);
    const showPersonRef = useRef(showPerson);
    const cameraRef = useRef(null);
    const segmentationRef = useRef(null);
    const wsRef = useRef(null);
    const segmentationActiveRef = useRef(false);
    const cameraStartedRef = useRef(false);
    const mediaStreamRef = useRef(null);

    const { t } = useTranslation();
    const navigate = useNavigate();

    const stopCameraTracks = () => {
        segmentationActiveRef.current = false;
        try {
            cameraRef.current?.stop();
        } catch (e) {}
        cameraRef.current = null;
        cameraStartedRef.current = false;
        try {
            segmentationRef.current?.close();
        } catch (e) {}
        segmentationRef.current = null;
        setVideoReady(false);
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

    const startCameraIfReady = () => {
        if (!consentAccepted || !videoReady) {
            return;
        }
        if (cameraStartedRef.current) {
            return;
        }
        const videoEl = webcamRef.current?.video;
        if (!videoEl || !segmentationRef.current) {
            return;
        }
        const camera = new cam.Camera(videoEl, {
            onFrame: async () => {
                if (!segmentationActiveRef.current) {
                    return;
                }
                try {
                    await segmentationRef.current.send({ image: videoEl });
                } catch (e) {}
            },
            width: 1280,
            height: 720
        });
        cameraRef.current = camera;
        cameraStartedRef.current = true;
        camera.start();
    };

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

    const onResults = async (results) => {
        if (!webcamRef.current || !webcamRef.current.video) {
            return;
        }
        const img = document.getElementById('vbackground')
        const videoWidth = webcamRef.current.video.videoWidth;
        const videoHeight = webcamRef.current.video.videoHeight;
        if (videoWidth === 0 || videoHeight === 0) {
            return;
        }

        canvasRef.current.width = videoWidth;
        canvasRef.current.height = videoHeight;

        const canvasElement = canvasRef.current;
        const canvasCtx = canvasElement.getContext("2d");

        canvasCtx.save();
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

        if (showPersonRef.current) {
            canvasCtx.save();
            canvasCtx.translate(canvasElement.width, 0);
            canvasCtx.scale(-1, 1);
            canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
            canvasCtx.globalCompositeOperation = 'destination-atop';
            canvasCtx.drawImage(results.segmentationMask, 0, 0, canvasElement.width, canvasElement.height);
            canvasCtx.restore();
        }

        canvasCtx.globalCompositeOperation = 'destination-over';
        if (img) {
            canvasCtx.drawImage(img, 0, 0, canvasElement.width, canvasElement.height);
        }
        canvasCtx.restore();

        setLoad(true);
    }
    
    useEffect(() => {
        showPersonRef.current = showPerson;
    }, [showPerson]);

    useEffect(() => {
        return () => {
            if (frameInterval.current) {
                clearInterval(frameInterval.current);
            }
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
            stopCameraTracks();
            setSubscribed(false);
        };
    }, [clientId, consentAccepted]);

    useEffect(() => {
        if (!consentAccepted) {
            return;
        }
        const selfieSegmentation = new SelfieSegmentation({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`;
            },
        });

        selfieSegmentation.setOptions({
            modelSelection: 1,
        });

        selfieSegmentation.onResults(onResults);
        segmentationRef.current = selfieSegmentation;
        segmentationActiveRef.current = true;
        startCameraIfReady();

        return () => {
            stopCameraTracks();
        };
    }, [consentAccepted, videoReady]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === "ArrowRight") {
                if (pdfPageNum < totalPdfPages) {
                    setPdfPageNum(pdfPageNum + 1);
                } else if (pptSlideNum < pptSlides.length - 1) {
                    setPptSlideNum(pptSlideNum + 1);
                }
            } else if (e.key === "ArrowLeft") {
                if (pdfPageNum > 1) {
                    setPdfPageNum(pdfPageNum - 1);
                } else if (pptSlideNum > 0) {
                    setPptSlideNum(pptSlideNum - 1);
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [pdfPageNum, pptSlideNum, totalPdfPages, pptSlides.length]);

    const onPdfPageChange = async (pageNum) => {
        if (!pdfUrl) {
            return;
        }
        const pdf = await pdfjsLib.getDocument(pdfUrl).promise;
        const page = await pdf.getPage(pageNum);
        const scale = 1.5;
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({ canvasContext: context, viewport }).promise;

        const imgURL = canvas.toDataURL();
        setimageURL(imgURL);
    };

    const onPptSlideChange = (slideNum) => {
        const slide = pptSlides[slideNum];
        const slideHtml = slide.getHTML();

        html2canvas(slideHtml).then((canvas) => {
            const imgURL = canvas.toDataURL();
            setimageURL(imgURL);
        });
    };

    useEffect(() => {
        if (fileType === "application/pdf") {
            onPdfPageChange(pdfPageNum);
        } else if (fileType === "application/vnd.ms-powerpoint" || fileType === "application/vnd.openxmlformats-officedocument.presentationml.presentation") {
            onPptSlideChange(pptSlideNum);
        }
    }, [pdfPageNum, pptSlideNum, fileType]);

    const imageHandler = async (e) => {
        const file = e.target.files[0];
        const fileType = file.type;
        setFileType(fileType);

        if (fileType === "application/pdf") {
            const pdfUrl = URL.createObjectURL(file);
            setPdfUrl(pdfUrl);
            const pdf = await pdfjsLib.getDocument(pdfUrl).promise;
            const totalPages = pdf.numPages;

            setTotalPdfPages(totalPages);
            onPdfPageChange(pdfPageNum);
        } else if (fileType === "application/vnd.ms-powerpoint" || fileType === "application/vnd.openxmlformats-officedocument.presentationml.presentation") {
            const ppt = new PptxGenJS();
            const reader = new FileReader();

            reader.onload = async (e) => {
                const arrayBuffer = e.target.result;
                const pptx = ppt.load(arrayBuffer);

                const slides = pptx.getSlides();
                setPptSlides(slides);
                onPptSlideChange(pptSlideNum);
            };

            reader.readAsArrayBuffer(file);
        } else {
            const reader = new FileReader();
            reader.onload = () => {
                if (reader.readyState === 2) {
                    setimageURL(reader.result);
                }
            };
            reader.readAsDataURL(file);
        }
    }

    const subscribeToWebhook = async () => {
        if (!consentAccepted || !clientId) {
            return;
        }
        setSubscribed(true);
        startFrameStreaming();
    };

    const unsubscribeFromWebhook = async () => {
        setSubscribed(false);
        stopFrameStreaming();
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
    };

    let frameCounter = 0;

    const startFrameStreaming = () => {
        frameInterval.current = setInterval(async () => {
            if (webcamRef.current && clientId) {
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
                        const frameId = ++frameCounter;
                        

                        try {
                            await fetch(`${SERVER_URL}/process_frame?frameId=${frameId}&clientId=${encodeURIComponent(clientId)}`, {
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
        }
    };

    useEffect(() => {
        if (!clientId || !consentAccepted || !subscribed) {
            return;
        }
        const ws = new WebSocket(`${WS_URL}?clientId=${encodeURIComponent(clientId)}`);
        wsRef.current = ws;

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (!data?.gesture) {
                    return;
                }
                setGesture(data.gesture);
                if (data.gesture.includes(",")) {
                    const [x, y] = data.gesture.split(',').map(Number);
                    const canvasEl = canvasRef.current;
                    if (canvasEl) {
                        const rect = canvasEl.getBoundingClientRect();
                        const scaleX = rect.width / canvasEl.width;
                        const scaleY = rect.height / canvasEl.height;
                        const px = rect.left + x * scaleX;
                        const py = rect.top + y * scaleY;
                        setMarkerPosition({ x: px, y: py });
                    } else {
                        setMarkerPosition({ x, y });
                    }
                }
            } catch (e) {
                console.error("Invalid WS message", e);
            }
        };

        return () => {
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
        };
    }, [clientId, consentAccepted, subscribed]);

    useEffect(() => {
        const storedSettings = JSON.parse(sessionStorage.getItem("gestureSettings")) || {};
        const showLabel = t('presentationPage.showPerson');
        const hideLabel = t('presentationPage.hidePerson');

        if (gesture) {
            const mappedGesture = storedSettings[gesture] || gesture;

            if (mappedGesture === "Swipe Right") {
                if (fileType === "application/pdf" && pdfPageNum < totalPdfPages) {
                    setPdfPageNum((prev) => prev + 1);
                } else if (
                    (fileType === "application/vnd.ms-powerpoint" ||
                        fileType === "application/vnd.openxmlformats-officedocument.presentationml.presentation") &&
                    pptSlideNum < pptSlides.length - 1
                ) {
                    setPptSlideNum((prev) => prev + 1);
                }
            } else if (mappedGesture === "Swipe Left") {
                if (fileType === "application/pdf" && pdfPageNum > 1) {
                    setPdfPageNum((prev) => prev - 1);
                } else if (
                    (fileType === "application/vnd.ms-powerpoint" ||
                        fileType === "application/vnd.openxmlformats-officedocument.presentationml.presentation") &&
                    pptSlideNum > 0
                ) {
                    setPptSlideNum((prev) => prev - 1);
                }
            } else if (
                mappedGesture === showLabel ||
                mappedGesture.toLowerCase() === showLabel.toLowerCase() ||
                mappedGesture === "Show person" ||
                mappedGesture === "Show Person"
            ) {
                setShowPerson(true);
            } else if (
                mappedGesture === hideLabel ||
                mappedGesture.toLowerCase() === hideLabel.toLowerCase() ||
                mappedGesture === "Hide person" ||
                mappedGesture === "Hide Person"
            ) {
                setShowPerson(false);
            } else if (mappedGesture === "Full screen" || mappedGesture === "Exit full screen") {
                toggleFullScreen();
            }
        }
    }, [gesture, fileType, pdfPageNum, pptSlideNum, totalPdfPages, pptSlides.length, t]);

    const toggleFullScreen = () => {
        if (!document.fullscreenElement) {
            if (containerRef.current) {
                containerRef.current.requestFullscreen().catch(err => {
                    console.error(`Error attempting to enable full-screen mode: ${err.message}`);
                });
            }
            setFullScreenMode(true);
        } else {
            document.exitFullscreen();
            setFullScreenMode(false);
        }
    };

    useEffect(() => {
        const handleFullScreenChange = () => {
            setFullScreenMode(!!document.fullscreenElement);
        };

        document.addEventListener("fullscreenchange", handleFullScreenChange);
        return () => {
            document.removeEventListener("fullscreenchange", handleFullScreenChange);
        };
    }, []);

    return (
        <>
            <CursorFollower markerPosition={markerPosition} />
            <Dialog
                open={!consentAccepted}
                maxWidth="sm"
                fullWidth
                sx={{
                    "& .MuiPaper-root": {
                        background: "#ece5db",
                        color: "#4a2f28",
                        borderRadius: "14px",
                        boxShadow: "0 18px 40px rgba(49, 36, 31, 0.25)",
                        border: "1px solid rgba(74, 47, 40, 0.18)",
                    },
                }}
            >
                <DialogTitle>{t("consentDialog.title")}</DialogTitle>
                <DialogContent>
                    <Typography variant="body1" sx={{ mb: 2 }}>
                        {t("consentDialog.description")}
                    </Typography>
                    <Typography variant="body2">
                        {t("consentDialog.continue")}
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <MuiButton
                        variant="contained"
                        onClick={() => navigate("/")}
                        sx={{
                            backgroundColor: "#d4d8dc",
                            color: "#2e3338",
                            textTransform: "none",
                            fontWeight: 700,
                            "&:hover": {
                                backgroundColor: "#c4c9ce",
                            },
                        }}
                    >
                        {t("consentDialog.decline")}
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
                        sx={{
                            backgroundColor: "#1f5a3a",
                            color: "#ffffff",
                            textTransform: "none",
                            fontWeight: 700,
                            "&:hover": {
                                backgroundColor: "#18492f",
                            },
                        }}
                    >
                        {t("consentDialog.accept")}
                    </MuiButton>
                </DialogActions>
            </Dialog>
            <div
                style={{
                    minHeight: "100vh",
                    background: "linear-gradient(135deg, #faf7f2 0%, #f3efe7 100%)",
                    color: "#4a2f28",
                    paddingTop: "16px",
                }}
            >
                <div className="container">
                    <div ref={containerRef} className="canvas-container">
                        {consentAccepted && (
                            <Webcam
                                ref={webcamRef}
                                onUserMediaError={() => {
                                    setVideoReady(false);
                                }}
                                onUserMedia={(stream) => {
                                    mediaStreamRef.current = stream;
                                    setVideoReady(true);
                                    startCameraIfReady();
                                }}
                                videoConstraints={{ width: 1280, height: 720 }}
                                style={{
                                    display: "none",
                                    width: "100%",
                                    height: "100%",
                                }}
                            />
                        )}

                        <div
                            className="presentation-loader"
                            style={{
                                display: `${!load ? " " : "none"}`
                            }}
                        >
                            <DisplayLottie animationData={loader} />
                        </div>
                        <canvas
                            ref={canvasRef}
                            style={{
                                width: "100%",
                                height: "100%",
                            }}
                        ></canvas>
                    </div>

                    <div className="backgroundContainer">
        <div className="backgrounds">
                            {imageURL && (
                                <img id="vbackground" src={imageURL} alt="The Screan" className="background" />
                            )}
                        </div>

                        <label className="label-style">
                            {t('presentationPage.uploadFile')}
                            <input type="file" accept="image/*,.jpg,.jpeg,.png,.pdf,.ppt,.pptx" className="file-input" onChange={imageHandler} />
                        </label>

                        <button className="button-style" onClick={subscribed ? unsubscribeFromWebhook : subscribeToWebhook}>
                            {subscribed ? t('presentationPage.stop') : t('presentationPage.gestureDetection')}
                        </button>

                        <button variant="contained" className="button-style" onClick={() => setShowPerson((prev) => !prev)}>
                            {showPerson ? t('presentationPage.hidePerson') : t('presentationPage.showPerson')}
                        </button>

                        <button className="button-style" onClick={toggleFullScreen}>
                            {fullScreenMode ? t('presentationPage.exitFullScreen') : t('presentationPage.fullScreen')}
                        </button>

                        <p>{subscribed && `${t('presentationPage.recognizedGesture')} ${gesture}`}</p>
                    </div>
                </div>
            </div>
        </>
    )
}

export default PresentationPage;
