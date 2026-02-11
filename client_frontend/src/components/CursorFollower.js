import React, { useEffect, useRef } from "react";

const CursorFollower = ({ markerPosition }) => {
    const cursorRef = useRef(null);
    const targetRef = useRef(null);
    const currentRef = useRef({ x: 0, y: 0 });
    const rafRef = useRef(null);

    useEffect(() => {
        const tick = () => {
            if (targetRef.current && cursorRef.current) {
                const { x: tx, y: ty } = targetRef.current;
                const cx = currentRef.current.x + (tx - currentRef.current.x) * 0.35;
                const cy = currentRef.current.y + (ty - currentRef.current.y) * 0.35;
                currentRef.current = { x: cx, y: cy };
                cursorRef.current.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
            }
            rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
        return () => {
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (markerPosition && cursorRef.current) {
            targetRef.current = { x: markerPosition.x, y: markerPosition.y };
        }
    }, [markerPosition]);

    return (
        <div
            ref={cursorRef}
            style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "12px",
                height: "12px",
                borderRadius: "50%",
                backgroundColor: "#e0291f",
                boxShadow: "0 0 12px rgba(224, 41, 31, 0.7)",
                pointerEvents: "none",
                willChange: "transform",
                zIndex: 9999,
            }}
        />
    );
};

export default CursorFollower;
