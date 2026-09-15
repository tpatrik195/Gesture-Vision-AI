#!/usr/bin/env python3
"""Live calibration probe for the static gesture thresholds.

Shows the measured inter-finger angles and the resulting classification for
your own hand, so the thresholds can be chosen from observed data instead of
guesswork. Press 'r' to record the current angles into a CSV, 'q' to quit.

    python3 tools/gesture_probe.py --label "zoom in"

The recorded CSV (docs/measurements/threshold_calibration.csv) is the evidence
behind the threshold values in .env, and can be cited in the methodology
chapter of the thesis.
"""
from __future__ import annotations

import argparse
import csv
import sys
import time
from pathlib import Path

import cv2

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.models.hand_detector import (  # noqa: E402
    HandGestureDetector,
    extended_finger_count,
    finger_angles,
)

OUTPUT = Path(__file__).resolve().parent.parent / "docs" / "measurements" / "threshold_calibration.csv"
FIELDS = ["timestamp", "label", "thumb_index", "index_middle", "middle_ring", "ring_pinky",
          "extended_fingers", "classified_as", "confidence"]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--label", default="unlabelled", help="gesture you are demonstrating")
    parser.add_argument("--camera", type=int, default=0)
    args = parser.parse_args()

    capture = cv2.VideoCapture(args.camera)
    if not capture.isOpened():
        print("Cannot open camera", args.camera, file=sys.stderr)
        return 1

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    new_file = not OUTPUT.exists()
    csv_file = OUTPUT.open("a", newline="")
    writer = csv.DictWriter(csv_file, fieldnames=FIELDS)
    if new_file:
        writer.writeheader()

    detector = HandGestureDetector()
    recorded = 0
    print(f"Probing for label {args.label!r}. 'r' records a sample, 'q' quits.")

    try:
        while True:
            ok, frame = capture.read()
            if not ok:
                break
            frame = cv2.flip(frame, 1)
            result = detector.detect(frame)

            raw = detector.last_landmarks
            lines = [f"gesture: {result.gesture} ({result.confidence:.2f})",
                     f"inference: {result.inference_ms:.0f} ms",
                     f"recorded: {recorded}"]
            angles = None
            if raw:
                angles = finger_angles(raw)
                lines.append(f"extended fingers: {extended_finger_count(raw)}")
                lines += [f"{name}: {value:6.1f}deg" for name, value in angles.items()]

            for index, text in enumerate(lines):
                cv2.putText(frame, text, (12, 28 + index * 24), cv2.FONT_HERSHEY_SIMPLEX,
                            0.6, (0, 0, 0), 3, cv2.LINE_AA)
                cv2.putText(frame, text, (12, 28 + index * 24), cv2.FONT_HERSHEY_SIMPLEX,
                            0.6, (0, 255, 0), 1, cv2.LINE_AA)

            cv2.imshow("gesture probe", frame)
            key = cv2.waitKey(1) & 0xFF
            if key == ord("q"):
                break
            if key == ord("r") and angles is not None:
                writer.writerow({
                    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
                    "label": args.label,
                    **{k: round(v, 2) for k, v in angles.items()},
                    "extended_fingers": extended_finger_count(raw),
                    "classified_as": result.gesture,
                    "confidence": round(result.confidence, 3),
                })
                csv_file.flush()
                recorded += 1
    finally:
        capture.release()
        cv2.destroyAllWindows()
        detector.close()
        csv_file.close()

    print(f"Wrote {recorded} samples to {OUTPUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
