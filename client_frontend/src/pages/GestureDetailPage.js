import React, { useRef, useEffect, useState, useCallback } from "react";
import Webcam from "react-webcam";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import "../App.css";
import { getGestures } from "../utils/gestureOptions";
import { useParams } from "react-router-dom";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button as MuiButton, Typography } from "@mui/material";
import { useTheme, useMediaQuery } from "@mui/material";
import useGestureStream, { STATUS } from "../hooks/useGestureStream";
import { submitConsent } from "../api/client";

const GestureDetailPage = () => {
    const webcamRef = useRef(null);
    const [gesture, setGesture] = useState("");
    const [cameraError, setCameraError] = useState(null);
    const [consentAccepted, setConsentAccepted] = useState(
        sessionStorage.getItem("cameraConsentAccepted") === "true"
    );
    const mediaStreamRef = useRef(null);
    const { t } = useTranslation();
    const location = useLocation();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
    const navigate = useNavigate();

    const gestures = getGestures(t);
    const { gestureId } = useParams();
    const currentGestureData = gestures.find((g) => g.id === Number(gestureId));

    const handleGesture = useCallback((detectedGesture) => {
        setGesture(detectedGesture);
    }, []);

    const { start, stop, setVideoElement, setPracticeTarget, status } = useGestureStream({
        page: "practice",
        onGesture: handleGesture,
    });

    const stopCameraTracks = useCallback(() => {
        const videoEl = webcamRef.current?.video;
        const stream = mediaStreamRef.current || webcamRef.current?.stream || videoEl?.srcObject;
        if (stream && stream.getTracks) {
            stream.getTracks().forEach((track) => track.stop());
        }
        if (videoEl) {
            videoEl.srcObject = null;
        }
        mediaStreamRef.current = null;
    }, []);

    useEffect(() => {
        const handleUnload = () => stopCameraTracks();
        window.addEventListener("beforeunload", handleUnload);
        return () => window.removeEventListener("beforeunload", handleUnload);
    }, [stopCameraTracks]);

    // Telling the server which gesture is being practised turns every attempt
    // into a labelled sample for the confusion matrix.
    useEffect(() => {
        if (currentGestureData) {
            setPracticeTarget(currentGestureData.key);
        }
        return () => setPracticeTarget(null);
    }, [currentGestureData, setPracticeTarget]);

    useEffect(() => {
        if (!consentAccepted) {
            return undefined;
        }
        return () => {
            stop();
            stopCameraTracks();
        };
    }, [consentAccepted, stop, stopCameraTracks]);

    useEffect(() => {
        return () => {
            if (location.pathname.startsWith("/practice/")) {
                stop();
                stopCameraTracks();
            }
        };
    }, [location.pathname, stop, stopCameraTracks]);

    let backgroundColor = "white";
    if (gesture !== "no hand detected" && gesture !== "Normal" && currentGestureData) {
        backgroundColor = gesture === currentGestureData.key
            ? "rgba(0, 255, 0, 0.3)"
            : "rgba(255, 0, 0, 0.3)";
    }

    return (
        <div
            style={{
                minHeight: isMobile ? "auto" : "100vh",
                background: "linear-gradient(135deg, #faf7f2 0%, #f3efe7 100%)",
                display: "flex",
                justifyContent: "center",
                alignItems: "flex-start",
                paddingTop: isMobile ? "68px" : "30px",
                paddingBottom: isMobile ? "0" : "0",
                paddingLeft: isMobile ? "10px" : "16px",
                paddingRight: isMobile ? "10px" : "16px",
            }}
        >
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
                        onClick={() => navigate("/practice")}
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
                className="container"
                style={{
                    backgroundColor,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: isMobile ? "0" : "auto",
                    height: isMobile ? "auto" : "85vh",
                    minHeight: isMobile ? "auto" : "85vh",
                    width: isMobile ? "100%" : "58%",
                    padding: isMobile ? "10px 8px 14px" : "10px",
                    borderRadius: "10px",
                }}
            >
                {currentGestureData && (
                    <p style={{ marginRight: "3px", marginLeft: "3px", marginTop: isMobile ? "6px" : "15px", marginBottom: isMobile ? "8px" : "8px", fontSize: isMobile ? "14px" : "16px", fontWeight: "bold", textAlign: "center", }}>
                        {currentGestureData.description}
                    </p>
                )}
                {consentAccepted && (
                    <Webcam
                        ref={webcamRef}
                        onUserMedia={(stream) => {
                            mediaStreamRef.current = stream;
                            setCameraError(null);
                            setVideoElement(webcamRef.current?.video);
                            start(webcamRef.current?.video);
                        }}
                        onUserMediaError={(err) => {
                            mediaStreamRef.current = null;
                            const name = err?.name || "";
                            setCameraError(
                                name === "NotAllowedError" || name === "PermissionDeniedError"
                                    ? t("cameraError.permissionDenied")
                                    : name === "NotReadableError" || name === "TrackStartError"
                                        ? t("cameraError.deviceBusy")
                                        : t("cameraError.unavailable")
                            );
                        }}
                        style={{ width: "100%", maxWidth: "840px", borderRadius: "10px", transform: "scaleX(-1)" }}
                    />
                )}
                <p style={{ marginTop: isMobile ? "8px" : "10px", fontSize: isMobile ? "16px" : "20px", fontWeight: "bold", textAlign: "center" }}>
                    {t("presentationPage.recognizedGesture")} {gesture}
                </p>
                {cameraError && <p role="alert" style={{ textAlign: "center" }}>{cameraError}</p>}
                {!cameraError && status === STATUS.RECONNECTING && (
                    <p role="status" style={{ textAlign: "center" }}>{t("connection.reconnecting")}</p>
                )}
            </div>
        </div>
    );
};

export default GestureDetailPage;
