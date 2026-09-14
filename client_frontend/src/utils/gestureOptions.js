import option1_image from '../pictures/option_1.png';
import option2_image from '../pictures/option_2.png';
import option3_image from '../pictures/option_3.png';
import option4_image from '../pictures/option_4.png';
import option5_image from '../pictures/option_5.png';
import zoom_in_image from '../pictures/zoom_in.png';
import zoom_out_image from '../pictures/zoom_out.png';
import swipe_left_image from '../pictures/swipe_left.png';
import swipe_right_image from '../pictures/swipe_right.png';
import laser_pointer_image from '../pictures/laser_pointer.png';

// `key` is the canonical gesture name the backend emits. Everything persisted
// or compared uses the key; translated names are for display only, otherwise
// settings silently break whenever the interface language changes.
export const GESTURE = {
    POINTING: 'Pointing',
    SWIPE_LEFT: 'Swipe Left',
    SWIPE_RIGHT: 'Swipe Right',
    ZOOM_IN: 'Zoom In',
    ZOOM_OUT: 'Zoom Out',
    OPTION_1: 'Option 1',
    OPTION_2: 'Option 2',
    OPTION_3: 'Option 3',
    OPTION_4: 'Option 4',
    OPTION_5: 'Option 5',
};

export const ACTION = {
    NEXT_SLIDE: 'nextSlide',
    PREV_SLIDE: 'prevSlide',
    ZOOM_IN: 'zoomIn',
    ZOOM_OUT: 'zoomOut',
    FULLSCREEN: 'fullscreen',
    EXIT_FULLSCREEN: 'exitFullscreen',
    SHOW_PERSON: 'showPerson',
    HIDE_PERSON: 'hidePerson',
};

const ACTION_LABEL_KEYS = {
    [ACTION.NEXT_SLIDE]: 'settingsPage.swipeRight',
    [ACTION.PREV_SLIDE]: 'settingsPage.swipeLeft',
    [ACTION.ZOOM_IN]: 'settingsPage.zoomIn',
    [ACTION.ZOOM_OUT]: 'settingsPage.zoomOut',
    [ACTION.FULLSCREEN]: 'presentationPage.fullScreen',
    [ACTION.EXIT_FULLSCREEN]: 'settingsPage.exitFullScreen',
    [ACTION.SHOW_PERSON]: 'presentationPage.showPerson',
    [ACTION.HIDE_PERSON]: 'presentationPage.hidePerson',
};

const ALL_GESTURES = [
    { id: 1, key: GESTURE.OPTION_1, labelKey: 'settingsPage.option1', descriptionKey: 'practicePage.option1Description', image: option1_image },
    { id: 2, key: GESTURE.OPTION_2, labelKey: 'settingsPage.option2', descriptionKey: 'practicePage.option2Description', image: option2_image },
    { id: 3, key: GESTURE.OPTION_3, labelKey: 'settingsPage.option3', descriptionKey: 'practicePage.option3Description', image: option3_image },
    { id: 4, key: GESTURE.OPTION_4, labelKey: 'settingsPage.option4', descriptionKey: 'practicePage.option4Description', image: option4_image },
    { id: 5, key: GESTURE.OPTION_5, labelKey: 'settingsPage.option5', descriptionKey: 'practicePage.option5Description', image: option5_image },
    { id: 6, key: GESTURE.ZOOM_IN, labelKey: 'settingsPage.zoomIn', descriptionKey: 'practicePage.zoomInDescription', image: zoom_in_image },
    { id: 7, key: GESTURE.ZOOM_OUT, labelKey: 'settingsPage.zoomOut', descriptionKey: 'practicePage.zoomOutDescription', image: zoom_out_image },
    { id: 8, key: GESTURE.SWIPE_LEFT, labelKey: 'settingsPage.swipeLeft', descriptionKey: 'practicePage.swipeLeftDescription', image: swipe_left_image },
    { id: 9, key: GESTURE.SWIPE_RIGHT, labelKey: 'settingsPage.swipeRight', descriptionKey: 'practicePage.swipeRightDescription', image: swipe_right_image },
    { id: 10, key: GESTURE.POINTING, labelKey: 'settingsPage.laserPointer', descriptionKey: 'practicePage.laserPointerDescription', image: laser_pointer_image },
];

const SUPPORTED_GESTURES_KEY = 'supportedGestures';

/** Gesture vocabulary reported by the API at session start. */
export function getSupportedGestureKeys() {
    try {
        const stored = sessionStorage.getItem(SUPPORTED_GESTURES_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed;
            }
        }
    } catch {
        // fall through to the built-in default
    }
    return [GESTURE.POINTING, GESTURE.SWIPE_LEFT, GESTURE.SWIPE_RIGHT, GESTURE.ZOOM_IN, GESTURE.ZOOM_OUT];
}

export function storeSupportedGestureKeys(keys) {
    if (!Array.isArray(keys) || keys.length === 0) return;
    try {
        sessionStorage.setItem(SUPPORTED_GESTURES_KEY, JSON.stringify(keys));
    } catch {
        // non-critical
    }
}

/** Gestures the backend can currently recognise, with translated labels. */
export const getGestures = (t) => {
    const supported = getSupportedGestureKeys();
    return ALL_GESTURES.filter((gesture) => supported.includes(gesture.key)).map((gesture) => ({
        ...gesture,
        name: t(gesture.labelKey),
        description: t(gesture.descriptionKey),
    }));
};

export const getActions = (t) =>
    Object.values(ACTION).map((action) => ({ action, label: t(ACTION_LABEL_KEYS[action]) }));

export const getActionLabel = (t, action) =>
    ACTION_LABEL_KEYS[action] ? t(ACTION_LABEL_KEYS[action]) : action;

export const defaultSettings = {
    [GESTURE.SWIPE_LEFT]: ACTION.PREV_SLIDE,
    [GESTURE.SWIPE_RIGHT]: ACTION.NEXT_SLIDE,
    [GESTURE.ZOOM_IN]: ACTION.ZOOM_IN,
    [GESTURE.ZOOM_OUT]: ACTION.ZOOM_OUT,
};

const SETTINGS_KEY = 'gestureSettings';

export function loadSettings() {
    try {
        const stored = sessionStorage.getItem(SETTINGS_KEY);
        if (!stored) return { ...defaultSettings };
        const parsed = JSON.parse(stored);
        // Migrate legacy settings that were keyed by translated gesture labels.
        const known = new Set(Object.values(GESTURE));
        const cleaned = Object.fromEntries(
            Object.entries(parsed).filter(([key]) => known.has(key) || key === 'debugMode')
        );
        return { ...defaultSettings, ...cleaned };
    } catch {
        return { ...defaultSettings };
    }
}

export function saveSettings(settings) {
    try {
        sessionStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
        // non-critical
    }
}
