import cv2
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

        self.prev_left_x = None
        self.prev_left_t = None

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
            return "None", 0.0

        hand_gesture = "None"
        confidence = 0.0
        now_tick = cv2.getTickCount() / cv2.getTickFrequency()

        for hand_landmarks, handedness in zip(result.hand_landmarks, result.handedness):
            hand_label = handedness[0].category_name
            handedness_score = float(handedness[0].score or 0.0)
            landmarks = hand_landmarks

            wrist = landmarks[WRIST]
            index_tip = landmarks[INDEX_FINGER_TIP]
            index_mcp = landmarks[INDEX_FINGER_MCP]

            def is_pointing():
                return index_tip.y < index_mcp.y

            if is_pointing():
                hand_gesture = "Pointing"
                confidence = max(confidence, handedness_score)

            if hand_label == "Left":
                delta_x = 0.0
                dt = 0.0
                velocity = 0.0
                if self.prev_left_x is not None and self.prev_left_t is not None:
                    delta_x = index_tip.x - self.prev_left_x
                    dt = now_tick - self.prev_left_t
                    if dt > 0:
                        velocity = delta_x / dt

                self.prev_left_x = index_tip.x
                self.prev_left_t = now_tick

                min_displacement = 0.08
                min_velocity = 0.30
                if abs(delta_x) > min_displacement and abs(velocity) > min_velocity:
                    if delta_x > 0:
                        hand_gesture = "Swipe Right"
                    else:
                        hand_gesture = "Swipe Left"
                    gesture_strength = min(1.0, max(abs(delta_x) / 0.2, abs(velocity) / 0.8))
                    confidence = max(confidence, handedness_score * gesture_strength)

        return hand_gesture, confidence
