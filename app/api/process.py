import cv2
from models.hand_detectation import HandGestureDetector
# from models.segmentation import BackgroundSegmenter

hand_gesture_detector = HandGestureDetector(min_detection_conf=0.5, min_tracking_conf=0.5)
# background_segmenter = BackgroundSegmenter()

def process_hand_gesture(frame):
    frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    hand_results = hand_gesture_detector.detect_hands(frame_rgb)

    if hand_results.hand_landmarks:
        gesture = hand_gesture_detector.detect_gesture(hand_results, frame)
    else:
        gesture = "no hand detected"

    return gesture, frame

# def process_segmentation(frame):
#     segmented_frame = background_segmenter.segment_background(frame)
#     return segmented_frame

def process_pose(frame):
    return frame