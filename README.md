# Gesture Vision AI

Valós idejű kézgesztus-felismerő rendszer prezentációvezérléshez, gyakorláshoz és eseményalapú integrációkhoz (okosotthon, mobil értesítés). A kamerakép feldolgozása a szerveren történik, a felismert gesztusok WebSocketen, eseményként jutnak vissza a kliensekhez.

TDK-kutatás — Sapientia EMTE, Marosvásárhelyi Kar.

---

## Mit tud a rendszer

- **Valós idejű gesztusfelismerés** MediaPipe Hand Landmarker alapon, kliensenként külön követési állapottal.
- **Prezentációvezérlés**: PDF/PPTX feltöltés, lapozás gesztusokkal, teljes képernyő, előadó kivágása a háttérből és rávetítése a diára.
- **Lézermutató**: a mutatóujj pozíciója simított, normalizált koordinátaként érkezik, a kurzor a dián követi az ujjat.
- **Gyakorló felület**: a felhasználó kiválaszt egy gesztust és visszajelzést kap a felismerésről.
- **Testreszabható gesztus→funkció leképezés**, három nyelven (magyar, román, angol).
- **Beépített telemetria** a kutatáshoz: latencia-bontás, felismerési események és címkézett gyakorlási próbálkozások adatbázisba mentve.

### Felismert gesztusok

| Gesztus | Típus | Alapértelmezett funkció |
| --- | --- | --- |
| `Pointing` | statikus + koordináta | lézermutató, parancs mód élesítése |
| `Swipe Left` | dinamikus | előző dia |
| `Swipe Right` | dinamikus | következő dia |
| `Zoom In` | statikus | nagyítás |
| `Zoom Out` | statikus | kicsinyítés |

A gesztuskészletet az API adja meg (`GET /api/health`, `POST /api/session`), a felület ez alapján épül fel — új gesztus bevezetéséhez nem kell frontendet módosítani.

---

## Architektúra

```
böngésző                        Nginx                      API (FastAPI)
┌────────────────────┐          ┌──────────┐               ┌──────────────────────┐
│ kamera             │          │          │   /api        │ session, consent     │
│  ├─ szegmentálás   │ ───────► │  proxy   │ ────────────► │ egészség             │
│  │  (MediaPipe,    │          │          │   /ws         │                      │
│  │   WASM, helyben)│ ◄──────► │          │ ◄───────────► │ gesztus-pipeline     │
│  └─ képkocka (JPEG)│          └──────────┘               │  ├─ MediaPipe VIDEO  │
└────────────────────┘                                     │  ├─ állapotgép       │
                                                           │  └─ telemetria       │
                                                           └──────────┬───────────┘
                                                                      │
                                                                PostgreSQL
```

**Tervezési elvek**

1. **Egyetlen átviteli csatorna.** A képkockák és az események is a WebSocketen mennek. Nincs párhuzamos HTTP-képküldés, nincs polling.
2. **Kliensenkénti izoláció.** Minden munkamenet saját detektorpéldányt és saját állapotgépet kap, így több felhasználó nem zavarja egymást.
3. **A szerver adja az identitást.** A kliens nem választhat magának azonosítót; a `POST /api/session` ad egy tokent, a WebSocket kizárólag ezt fogadja el.
4. **Privacy by design.** Nyers képkocka soha nem kerül lemezre vagy adatbázisba — csak metaadat (gesztus, időbélyeg, confidence, latencia).
5. **A mérés a rendszer része.** A kutatáshoz szükséges adatok éles használatból, automatikusan keletkeznek.
6. **Erőforrás-tudatosság.** Kliensenkénti képkocka-korlát, munkamenet-limit, visszanyomás-kezelés, mintavételezett telemetria.

### Technológiák

| Réteg | Technológia |
| --- | --- |
| Frontend | React 19, Material UI, react-router, i18next, pdf.js, MediaPipe Selfie Segmentation (WASM, helyben kiszolgálva) |
| Backend | Python 3.10, FastAPI, Uvicorn, MediaPipe Tasks Vision, OpenCV (headless), SQLAlchemy |
| Adatbázis | PostgreSQL 16 |
| Infrastruktúra | Docker Compose, Nginx reverse proxy |

---

## Indítás

Minden konfiguráció `.env`-ből jön. Először:

```bash
cp .env.example .env
# írj be egy erős POSTGRES_PASSWORD értéket, és igazítsd a DATABASE_URL-t
```

### 1. Docker (ajánlott)

Fejlesztői stack, hot reloaddal, egyetlen belépési ponton:

```bash
docker compose -f docker/docker-compose.yml up --build
# app:  http://localhost:3000
```

Production-szerű stack (Nginx szolgálja ki a buildet):

```bash
docker compose -f docker/docker-compose.prod.yml up --build -d
# app:  http://localhost:3000
```

### 2. Docker nélkül

Backend (Python 3.9+ ajánlott, 3.8 is támogatott):

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r docker/requirements-api.txt
export $(grep -v '^#' .env | xargs)      # vagy állítsd be kézzel
uvicorn app.main:app --reload            # a repó gyökeréből
```

Frontend:

```bash
cd client_frontend
npm install
DEV_API_TARGET=http://localhost:8000 npm start
# app: http://localhost:3000
```

A frontend mindig azonos origin-ről hívja az API-t, a dev szerver pedig a `DEV_API_TARGET` felé proxyzza a `/api` és `/ws` útvonalakat — így ugyanaz a kód fut lokálisan, Dockerben, ngrok mögött és éles domainen is.

### Ellenőrzés

```bash
curl http://localhost:3000/api/health
```

---

## API

| Végpont | Leírás |
| --- | --- |
| `POST /api/session` | Munkamenet nyitása; `clientId`, `token` és a támogatott gesztusok listája |
| `POST /api/consent` | Kamerahasználati hozzájárulás rögzítése (`Authorization: Bearer <token>`) |
| `GET /api/health` | Állapot, aktív munkamenetek, gesztuskészlet |
| `WS /ws?token=…` | Gesztusfolyam |

### WebSocket protokoll

**Kliens → szerver (bináris):** 4 bájt big-endian sorszám, utána a JPEG képkocka. A sorszám teszi lehetővé, hogy a kliens saját óráján mérje a körbeérési időt — óraszinkron nélkül.

**Kliens → szerver (szöveg):**

```json
{"type": "hello",    "page": "presentation"}
{"type": "practice", "expected": "Swipe Left"}
```

**Szerver → kliens (szöveg):**

```json
{"type": "ready",   "clientId": "…"}
{"type": "gesture", "gesture": "Swipe Right", "confidence": 0.87, "seq": 42, "pipelineMs": 18.4}
{"type": "pointer", "x": 0.42, "y": 0.31}
{"type": "ack",     "seq": 40, "pipelineMs": 17.9}
{"type": "status",  "state": "tracking"}
{"type": "error",   "code": "frame_too_large", "message": "…"}
```

---

## Mérés és kutatási adatok

A rendszer éles használat közben gyűjti a kutatáshoz szükséges adatokat. Négy tábla:

| Tábla | Tartalom | Mire használható |
| --- | --- | --- |
| `client_sessions` | munkamenet, hozzájárulás, nyelv, eszköz | résztvevők száma, consent-bizonyíték |
| `gesture_events` | minden kiküldött gesztus, confidence, feldolgozási idő | gesztuseloszlás, használati minták |
| `frame_samples` | minden 10. képkocka latencia-bontása | latencia-eloszlás, hisztogram, boxplot |
| `practice_attempts` | elvárt és felismert gesztus párok | **valódi többosztályos konfúziós mátrix** |
| `session_metrics` | munkamenet-összesítők, eldobott képkockák, csúcs-párhuzamosság | skálázhatósági mérés |

A `practice_attempts` a kulcs: a gyakorló felületen a felhasználó megmondja, melyik gesztust próbálja, így minden próbálkozás címkézett adatpont — pontosan az, amiből statisztikailag érvényes pontosságmérés készíthető, sok résztvevővel.

A latencia három komponensre bontható: `pipelineMs` (szerveroldali feldolgozás), a kliensoldali körbeérés, és a kettő különbségéből a hálózati idő.

### Gesztusküszöbök kalibrálása

A statikus gesztusok szögküszöbei `.env`-ből hangolhatók. Az élő értékek leolvasásához:

```bash
python3 tools/gesture_probe.py --label "zoom in"
# 'r' = minta rögzítése, 'q' = kilépés
# eredmény: docs/measurements/threshold_calibration.csv
```

---

## Adatvédelem

- A kamerakép feldolgozása a memóriában történik, **a képkockák sem lemezre, sem adatbázisba nem kerülnek**.
- Az adatbázis kizárólag metaadatot tárol: gesztus neve, időbélyeg, confidence, latencia, munkamenet-azonosító.
- A kamerahasználathoz a felhasználó kifejezett hozzájárulása szükséges; ezt a rendszer verziószámmal és időbélyeggel rögzíti.
- A munkamenet-azonosító véletlenszerű, nem kötődik személyhez.

---

## Projektstruktúra

```
app/                    FastAPI backend
  api/                  REST végpontok és a WebSocket
  core/                 biztonság, rate limiting, szálkezelés
  db/                   séma, kapcsolat, adatelérés
  models/               MediaPipe detektor, szegmentálás
  services/             munkamenet- és állapotkezelés
client_frontend/        React alkalmazás
  src/api/              API kliens, munkamenet-kezelés
  src/hooks/            useGestureStream — a teljes gesztus-átvitel
docker/                 Dockerfile-ok, Compose stackek, Nginx konfigok
docs/                   generált dokumentáció (PDF) és forrásai
tools/                  kalibráló és dokumentációs eszközök
browser_extension/      Zoom/Meet kiegészítő (külön fejlesztés alatt)
meresek/                mérési szkriptek
```

---

## Dokumentáció

A `docs/` mappában a fejlesztés során készült elemzések és naplók találhatók PDF-ben, a forrásuk `docs/source/` alatt. Új dokumentum generálása:

```bash
python3 tools/md2pdf.py docs/source/valami.md docs/valami.pdf
```
