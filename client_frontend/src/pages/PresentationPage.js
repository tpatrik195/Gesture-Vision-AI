import React, { useRef, useEffect, useState, useCallback } from "react";
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
import useGestureStream, { STATUS } from "../hooks/useGestureStream";
import { submitConsent } from "../api/client";
import { ACTION, loadSettings } from "../utils/gestureOptions";
import { SEGMENTATION_ASSET_BASE } from "../config";
GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

// Zoom gestures scale the cut-out speaker, as described in the thesis: the
// presenter can enlarge themselves on the slide.
const PERSON_SCALE_MIN = 0.6;
const PERSON_SCALE_MAX = 1.8;
const PERSON_SCALE_STEP = 0.15;

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
    const [markerPosition, setMarkerPosition] = useState(null);
    const [pendingAction, setPendingAction] = useState(null);
    const [cameraError, setCameraError] = useState(null);
    const [consentAccepted, setConsentAccepted] = useState(
        sessionStorage.getItem("cameraConsentAccepted") === "true"
    );
    const [videoReady, setVideoReady] = useState(false);
    const showPersonRef = useRef(showPerson);
    const cameraRef = useRef(null);
    const segmentationRef = useRef(null);
    const segmentationActiveRef = useRef(false);
    const cameraStartedRef = useRef(false);
    const mediaStreamRef = useRef(null);
    const maskCanvasRef = useRef(null);
    const smoothMaskCanvasRef = useRef(null);
    const personCanvasRef = useRef(null);
    const [personScale, setPersonScale] = useState(1);
    const personScaleRef = useRef(1);
    const [debugMode] = useState(() => !!loadSettings().debugMode);

    const { t } = useTranslation();
    const navigate = useNavigate();
    const isMobileDevice = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(max-width: 900px)").matches;

    const lockLandscapeOrientation = useCallback(async () => {
        try {
            if (isMobileDevice && window.screen.orientation && window.screen.orientation.lock) {
                await window.screen.orientation.lock("landscape");
            }
        } catch (e) {}
    }, [isMobileDevice]);

    const unlockOrientation = useCallback(async () => {
        try {
            if (window.screen.orientation && window.screen.orientation.unlock) {
                window.screen.orientation.unlock();
            }
        } catch (e) {}
    }, []);

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

    const startCameraIfReady = useCallback(() => {
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
    }, [consentAccepted, videoReady]);

    const handlePointer = useCallback((point) => {
        if (!point) {
            setMarkerPosition(null);
            return;
        }
        const canvasEl = canvasRef.current;
        if (!canvasEl) {
            return;
        }
        // The detector reports normalised coordinates, so the overlay lines up
        // regardless of canvas size, device pixel ratio or fullscreen state.
        const rect = canvasEl.getBoundingClientRect();
        setMarkerPosition({
            x: rect.left + point.x * rect.width,
            y: rect.top + point.y * rect.height,
        });
    }, []);

    const handleGesture = useCallback((detectedGesture, message) => {
        // Always show what was recognised; only act when the server says the
        // gesture is armed (navigation needs command mode).
        setGesture(detectedGesture);
        if (message?.actionable !== false) {
            setPendingAction({ gesture: detectedGesture, at: Date.now() });
        }
    }, []);

    const gestureStream = useGestureStream({
        page: "presentation",
        onGesture: handleGesture,
        onPointer: handlePointer,
        debug: debugMode,
    });
    const { start: startGestureStream, stop: stopGestureStream, setVideoElement } = gestureStream;

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
        if (!maskCanvasRef.current) {
            maskCanvasRef.current = document.createElement("canvas");
            smoothMaskCanvasRef.current = document.createElement("canvas");
        }
        const maskCanvas = maskCanvasRef.current;
        const smoothMaskCanvas = smoothMaskCanvasRef.current;
        maskCanvas.width = videoWidth;
        maskCanvas.height = videoHeight;
        smoothMaskCanvas.width = videoWidth;
        smoothMaskCanvas.height = videoHeight;
        const maskCtx = maskCanvas.getContext("2d");
        const smoothMaskCtx = smoothMaskCanvas.getContext("2d");

        canvasCtx.save();
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

        if (showPersonRef.current) {
            maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
            maskCtx.drawImage(results.segmentationMask, 0, 0, maskCanvas.width, maskCanvas.height);

            // Soften mask edges for less "cut-out" look.
            smoothMaskCtx.clearRect(0, 0, smoothMaskCanvas.width, smoothMaskCanvas.height);
            smoothMaskCtx.filter = "blur(7px)";
            smoothMaskCtx.drawImage(maskCanvas, 0, 0);
            smoothMaskCtx.filter = "none";

            // Temporal smoothing by blending previous and current masks.
            maskCtx.globalAlpha = 0.35;
            maskCtx.drawImage(smoothMaskCanvas, 0, 0);
            maskCtx.globalAlpha = 1;

            // The cut-out is composited on its own canvas first, so the zoom
            // gesture can scale the speaker without scaling the slide behind.
            if (!personCanvasRef.current) {
                personCanvasRef.current = document.createElement("canvas");
            }
            const personCanvas = personCanvasRef.current;
            personCanvas.width = videoWidth;
            personCanvas.height = videoHeight;
            const personCtx = personCanvas.getContext("2d");

            personCtx.clearRect(0, 0, personCanvas.width, personCanvas.height);
            personCtx.save();
            personCtx.translate(personCanvas.width, 0);
            personCtx.scale(-1, 1);
            personCtx.drawImage(results.image, 0, 0, personCanvas.width, personCanvas.height);
            personCtx.filter = "contrast(1.06) saturate(1.05)";
            personCtx.globalCompositeOperation = 'destination-atop';
            personCtx.drawImage(maskCanvas, 0, 0, personCanvas.width, personCanvas.height);
            personCtx.filter = "none";
            personCtx.restore();

            const scale = personScaleRef.current;
            const drawWidth = canvasElement.width * scale;
            const drawHeight = canvasElement.height * scale;
            canvasCtx.save();
            canvasCtx.drawImage(
                personCanvas,
                (canvasElement.width - drawWidth) / 2,
                canvasElement.height - drawHeight,
                drawWidth,
                drawHeight
            );
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

    // The render loop runs outside React, so it reads the scale from a ref.
    useEffect(() => {
        personScaleRef.current = personScale;
    }, [personScale]);

    useEffect(() => {
        return () => {
            stopGestureStream();
            stopCameraTracks();
            setSubscribed(false);
        };
    }, [stopGestureStream]);

    useEffect(() => {
        if (!consentAccepted) {
            return;
        }
        const selfieSegmentation = new SelfieSegmentation({
            locateFile: (file) => `${SEGMENTATION_ASSET_BASE}/${file}`,
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
    }, [consentAccepted, videoReady, startCameraIfReady]);

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

    const onPdfPageChange = useCallback(async (pageNum) => {
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
    }, [pdfUrl]);

    const onPptSlideChange = useCallback((slideNum) => {
        const slide = pptSlides[slideNum];
        const slideHtml = slide.getHTML();

        html2canvas(slideHtml).then((canvas) => {
            const imgURL = canvas.toDataURL();
            setimageURL(imgURL);
        });
    }, [pptSlides]);

    useEffect(() => {
        if (fileType === "application/pdf") {
            onPdfPageChange(pdfPageNum);
        } else if (fileType === "application/vnd.ms-powerpoint" || fileType === "application/vnd.openxmlformats-officedocument.presentationml.presentation") {
            onPptSlideChange(pptSlideNum);
        }
    }, [pdfPageNum, pptSlideNum, fileType, onPdfPageChange, onPptSlideChange]);

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
        if (!consentAccepted) {
            return;
        }
        setSubscribed(true);
        startGestureStream(webcamRef.current?.video);
    };

    const unsubscribeFromWebhook = async () => {
        setSubscribed(false);
        stopGestureStream();
        setMarkerPosition(null);
    };

    const toggleFullScreen = useCallback(async () => {
        if (!document.fullscreenElement) {
            if (containerRef.current) {
                try {
                    await containerRef.current.requestFullscreen();
                    await lockLandscapeOrientation();
                } catch (err) {
                    console.error(`Error attempting to enable full-screen mode: ${err.message}`);
                }
            }
            setFullScreenMode(true);
        } else {
            await document.exitFullscreen();
            await unlockOrientation();
            setFullScreenMode(false);
        }
    }, [lockLandscapeOrientation, unlockOrientation]);

    useEffect(() => {
        if (!pendingAction) {
            return;
        }
        // Settings are keyed by the canonical gesture name the backend emits, so
        // custom mappings work identically in every interface language.
        const settings = loadSettings();
        const action = settings[pendingAction.gesture];
        if (!action) {
            return;
        }

        const isPdf = fileType === "application/pdf";
        const isPpt =
            fileType === "application/vnd.ms-powerpoint" ||
            fileType === "application/vnd.openxmlformats-officedocument.presentationml.presentation";

        switch (action) {
            case ACTION.NEXT_SLIDE:
                if (isPdf && pdfPageNum < totalPdfPages) {
                    setPdfPageNum((prev) => prev + 1);
                } else if (isPpt && pptSlideNum < pptSlides.length - 1) {
                    setPptSlideNum((prev) => prev + 1);
                }
                break;
            case ACTION.PREV_SLIDE:
                if (isPdf && pdfPageNum > 1) {
                    setPdfPageNum((prev) => prev - 1);
                } else if (isPpt && pptSlideNum > 0) {
                    setPptSlideNum((prev) => prev - 1);
                }
                break;
            case ACTION.SHOW_PERSON:
                setShowPerson(true);
                break;
            case ACTION.HIDE_PERSON:
                setShowPerson(false);
                break;
            case ACTION.ZOOM_IN:
                setPersonScale((prev) => Math.min(PERSON_SCALE_MAX, prev + PERSON_SCALE_STEP));
                break;
            case ACTION.ZOOM_OUT:
                setPersonScale((prev) => Math.max(PERSON_SCALE_MIN, prev - PERSON_SCALE_STEP));
                break;
            case ACTION.FULLSCREEN:
                if (!document.fullscreenElement) {
                    toggleFullScreen();
                }
                break;
            case ACTION.EXIT_FULLSCREEN:
                if (document.fullscreenElement) {
                    toggleFullScreen();
                }
                break;
            default:
                break;
        }
    }, [pendingAction, fileType, pdfPageNum, pptSlideNum, totalPdfPages, pptSlides.length, toggleFullScreen]);


    useEffect(() => {
        const handleFullScreenChange = () => {
            setFullScreenMode(!!document.fullscreenElement);
            if (!document.fullscreenElement) {
                unlockOrientation();
            }
        };

        document.addEventListener("fullscreenchange", handleFullScreenChange);
        return () => {
            document.removeEventListener("fullscreenchange", handleFullScreenChange);
        };
    }, [unlockOrientation]);

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
                            submitConsent(true).catch(() => {});
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
                                onUserMediaError={(err) => {
                                    setVideoReady(false);
                                    const name = err?.name || "";
                                    setCameraError(
                                        name === "NotAllowedError" || name === "PermissionDeniedError"
                                            ? t("cameraError.permissionDenied")
                                            : name === "NotReadableError" || name === "TrackStartError"
                                                ? t("cameraError.deviceBusy")
                                                : t("cameraError.unavailable")
                                    );
                                }}
                                onUserMedia={(stream) => {
                                    mediaStreamRef.current = stream;
                                    setCameraError(null);
                                    setVideoReady(true);
                                    setVideoElement(webcamRef.current?.video);
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
                        {debugMode && gestureStream.debugInfo && (
                            <p style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
                                {`raw: ${gestureStream.debugInfo.raw} · conf: ${gestureStream.debugInfo.confidence} · `}
                                {`kéz: ${gestureStream.debugInfo.hands} · ${gestureStream.debugInfo.inferenceMs} ms`}
                                {gestureStream.latency
                                    ? ` · RTT ${gestureStream.latency.roundtripMs} ms`
                                    : ""}
                            </p>
                        )}
                        {cameraError && <p role="alert">{cameraError}</p>}
                        {subscribed && gestureStream.status === STATUS.RECONNECTING && (
                            <p role="status">{t('connection.reconnecting')}</p>
                        )}
                        {subscribed && gestureStream.error === "server_busy" && (
                            <p role="alert">{t('connection.serverBusy')}</p>
                        )}
                    </div>
                </div>
            </div>
        </>
    )
}

export default PresentationPage;
