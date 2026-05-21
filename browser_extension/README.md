# Gesture Vision Browser Extension (Mozilla-first)

WebExtension váz, ami lokális HTTP bridge-ről (`/latest`) gesture eseményt olvas, és akciót küld Zoom / Google Meet tabokra.

## Mappa

- `manifest.json`: extension beállítások
- `background/service-worker.js`: polling + action broadcast
- `content/zoom.js`: Zoom action handler
- `content/meet.js`: Google Meet action handler
- `shared/actions.js`: támogatott akciók + default mapping
- `docs/local-bridge-example.py`: minimál lokális bridge teszteléshez

## Event formátum (`GET /latest`)

```json
{
  "gesture": "thumbs_up",
  "action": "toggle_mute",
  "confidence": 0.95,
  "timestamp": 1710000000000
}
```

`action` opcionális: ha hiányzik, a `gesture` alapján map-el a plugin.

## Gyors teszt Firefoxban

1. Nyisd meg: `about:debugging#/runtime/this-firefox`
2. `Load Temporary Add-on`
3. Válaszd ki: `browser_extension/manifest.json`
4. Indítsd a lokális bridge-et:
   ```bash
   python3 browser_extension/docs/local-bridge-example.py
   ```
5. Nyiss egy Zoom vagy Meet oldalt ugyanabban a böngészőben.
6. Küldj eseményt:
   ```bash
   curl -X POST http://127.0.0.1:8765/latest \
     -H 'Content-Type: application/json' \
     -d '{"gesture":"peace","action":"toggle_video","confidence":0.91}'
   ```

## Safari megjegyzés

A Safari extensionhöz ezt a WebExtensiont át kell csomagolni Xcode projektbe (`safari-web-extension-converter`).
Ez a kódstruktúra erre alkalmas kiindulás.
