import cv2
import numpy as np
import mediapipe as mp

from mediapipe.tasks.python.vision import HandLandmarker
from mediapipe.tasks.python.vision import HandLandmarkerOptions
from mediapipe.tasks.python.vision import RunningMode
from mediapipe.tasks.python.core.base_options import BaseOptions


# ✅ landmark indexek (mp.solutions helyett)
WRIST = 0
INDEX_FINGER_MCP = 5
INDEX_FINGER_TIP = 8


class HandGestureDetector:
    def __init__(self, min_detection_conf=0.5, min_tracking_conf=0.5):
        options = HandLandmarkerOptions(
            base_options=BaseOptions(model_asset_path="/app/hand_landmarker.task"),
            running_mode=RunningMode.IMAGE,
            num_hands=2,
            min_hand_detection_confidence=min_detection_conf,
            min_tracking_confidence=min_tracking_conf,
        )

        self.hands = HandLandmarker.create_from_options(options)

        # ❌ TÖRÖLVE: mp.solutions
        # self.mp_drawing = mp.solutions.drawing_utils
        # self.mp_hands = mp.solutions.hands

        self.prev_left_orientation = None
        self.prevprev_left_orientation = None

    def detect_hands(self, frame_rgb):
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame_rgb)
        return self.hands.detect(mp_image)

    def draw_hands(self, frame, result):
        if not result.hand_landmarks:
            return

        h, w, _ = frame.shape

        for hand_landmarks, handedness in zip(result.hand_landmarks, result.handedness):
            for lm in hand_landmarks:
                cx, cy = int(lm.x * w), int(lm.y * h)
                cv2.circle(frame, (cx, cy), 3, (0, 255, 0), -1)

            hand_label = handedness[0].category_name

            x_min = int(min([lm.x for lm in hand_landmarks]) * w)
            y_min = int(min([lm.y for lm in hand_landmarks]) * h)
            x_max = int(max([lm.x for lm in hand_landmarks]) * w)
            y_max = int(max([lm.y for lm in hand_landmarks]) * h)

            cv2.rectangle(frame, (x_min, y_min), (x_max, y_max), (0, 0, 255), 2)
            cv2.putText(frame, hand_label, (x_min, y_min - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)

    def get_index_tip_position(self, result, image_shape):
        if not result.hand_landmarks:
            return None

        landmark = result.hand_landmarks[0][INDEX_FINGER_TIP]
        h, w, _ = image_shape
        return int(landmark.x * w), int(landmark.y * h)

    def get_landmark_px(self, landmark, image_shape):
        h, w, _ = image_shape
        return landmark.x * w, landmark.y * h

    def detect_gesture(self, result, frame):
        if not result.hand_landmarks or not result.handedness:
            return "None"

        hand_gesture = "None"
        left_orientation = "unknown"
        right_orientation = "unknown"

        for hand_landmarks, handedness in zip(result.hand_landmarks, result.handedness):
            hand_label = handedness[0].category_name
            landmarks = hand_landmarks

            wrist = landmarks[WRIST]
            index_tip = landmarks[INDEX_FINGER_TIP]
            index_mcp = landmarks[INDEX_FINGER_MCP]

            def is_pointing():
                return index_tip.y < index_mcp.y

            def is_hand_upward():
                return index_tip.y < wrist.y

            def is_hand_leftward():
                return index_tip.x < wrist.x

            def is_hand_rightward():
                return index_tip.x > wrist.x

            if is_hand_upward():
                if hand_label == "Left":
                    left_orientation = "upward"
                else:
                    right_orientation = "upward"

            if is_hand_leftward():
                if hand_label == "Left":
                    left_orientation = "leftward"
                else:
                    right_orientation = "leftward"

            if is_hand_rightward():
                if hand_label == "Left":
                    left_orientation = "rightward"
                else:
                    right_orientation = "rightward"

            if is_pointing():
                hand_gesture = "Pointing"

            # swipe logika
            if hand_label == "Left":
                if self.prev_left_orientation == "leftward" and left_orientation == "rightward":
                    hand_gesture = "Swipe Right"
                elif self.prev_left_orientation == "rightward" and left_orientation == "leftward":
                    hand_gesture = "Swipe Left"

                self.prevprev_left_orientation = self.prev_left_orientation
                self.prev_left_orientation = left_orientation

        return hand_gesture