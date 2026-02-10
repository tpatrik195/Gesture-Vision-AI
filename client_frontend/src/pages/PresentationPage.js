 import React, { useRef, useEffect, useState } from "react";
import Webcam from "react-webcam";
import { SelfieSegmentation } from "@mediapipe/selfie_segmentation";
import * as cam from "@mediapipe/camera_utils";
import '../App.css';
import defaultImg from '../background.jpg'
import DisplayLottie from "../DisplayLottie";
import loader from '../85646-loading-dots-blue.json'
import PptxGenJS from "pptxgenjs";
import html2canvas from "html2canvas";
import { io } from "socket.io-client";
import { useTranslation } from 'react-i18next';
import CursorFollower from "../components/CursorFollower";

import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";
import { GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf";
GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    import.meta.url
).toString();

const SERVER_URL = "http://127.0.0.1:8000";
const WEBHOOK_URL = "http://127.0.0.1:9000/webhook";

const socket = io("http://localhost:9000");

const PresentationPage = () => {
    const webcamRef = useRef(null);
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const [imageURL, setimageURL] = useState(defaultImg);
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
    const showPersonRef = useRef(showPerson);
    const cameraRef = useRef(null);
    const segmentationRef = useRef(null);

    const { t } = useTranslation();

    const onResults = async (results) => {
        if (!webcamRef.current || !webcamRef.current.video) {
            return;
        }
        const img = document.getElementById('vbackground')
        const videoWidth = webcamRef.current.video.videoWidth;
        const videoHeight = webcamRef.current.video.videoHeight;

        canvasRef.current.width = videoWidth;
        canvasRef.current.height = videoHeight;

        const canvasElement = canvasRef.current;
        const canvasCtx = canvasElement.getContext("2d");

        canvasCtx.save();
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

        if (showPersonRef.current) {
            canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
            canvasCtx.globalCompositeOperation = 'destination-atop';
            canvasCtx.drawImage(results.segmentationMask, 0, 0, canvasElement.width, canvasElement.height);
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

        if (
            typeof webcamRef.current !== "undefined" &&
            webcamRef.current !== null
        ) {
            const camera = new cam.Camera(webcamRef.current.video, {
                onFrame: async () => {
                    await selfieSegmentation.send({ image: webcamRef.current.video });
                },
                width: 1280,
                height: 720
            });

            cameraRef.current = camera;
            camera.start();
        }

        return () => {
            try {
                cameraRef.current?.stop();
            } catch (e) {}
            try {
                segmentationRef.current?.close();
            } catch (e) {}
            cameraRef.current = null;
            segmentationRef.current = null;
        };
    }, []);

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
        try {
            const response = await fetch(`${SERVER_URL}/subscribe_webhook?url=${WEBHOOK_URL}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) {
                throw new Error(`Subscription failed with status ${response.status}`);
            }

            await response.json();

            setSubscribed(true);
            startFrameStreaming();
        } catch (error) {
            console.error("Subscription failed", error);
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

            setSubscribed(false);
            stopFrameStreaming();
        } catch (error) {
            console.error("Unsubscription failed", error);
        }
    };

    let frameCounter = 0;

    const startFrameStreaming = () => {
        frameInterval.current = setInterval(async () => {
            if (webcamRef.current) {
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
                            await fetch(`${SERVER_URL}/process_frame?frameId=${frameId}`, {
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
        socket.on("gesture_event", async (data) => {
            setGesture(data.gesture);

            if (data.gesture.includes(",")) {
                const [x, y] = data.gesture.split(',').map(Number);
                setMarkerPosition({ x, y });
            }
        });

        return () => {
            socket.off("gesture_event");
        };
    }, []);

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
                        <Webcam
                            ref={webcamRef}
                            style={{
                                display: "none",
                                width: "100%",
                                height: "100%",
                            }}
                        />

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
                            <img id="vbackground" src={imageURL} alt="The Screan" className="background" />
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
