# Mérések

A mérési adatok az éles használatból keletkeznek, nem kézzel bemásolt számokból.

## Munkafolyamat

1. **Export** az adatbázisból CSV-be (a futó stackben):

   ```bash
   docker compose exec api python3 -m meresek.export_data --out /srv/export
   # vagy lokálisan, beállított DATABASE_URL mellett:
   DATABASE_URL=postgresql+psycopg2://... python3 meresek/export_data.py
   ```

   Eredmény: `meresek/data/<időbélyeg>/*.csv` — ez a nyers kutatási adat, archiválandó.

2. **Elemzés** a CSV-kből:

   ```bash
   python3 meresek/analyze.py meresek/data/<időbélyeg>
   ```

   Eredmény: `summary.md` (latencia-statisztikák, pontosság Wilson-féle konfidencia-intervallummal,
   khi-négyzet próba) és `figures/` (latencia-eloszlás, pontosság gesztusonként, konfúziós mátrix).

## Milyen adatból mi lesz

| Forrás | Mit ad |
| --- | --- |
| `frame_samples` | latencia-eloszlás komponensekre bontva (dekódolás, inferencia, teljes) |
| `practice_attempts` | pontosság és **valódi többosztályos konfúziós mátrix** — a gyakorló felületen ismert az elvárt gesztus |
| `gesture_events` | gesztuseloszlás, használati minták |
| `session_metrics` | átbocsátás, eldobott képkockák, egyidejű munkamenetek csúcsa |
| `client_sessions` | résztvevők száma, hozzájárulás, nyelv |

Az exportból az azonosításra alkalmas mezők (IP-cím, user agent) kimaradnak.

## Küszöbkalibráció

```bash
python3 tools/gesture_probe.py --label "zoom in"
```

Élőben mutatja a saját kézre mért szögeket, és `docs/measurements/threshold_calibration.csv`-be
rögzíti a mintákat — ez a `.env`-ben beállított küszöbértékek dokumentált alapja.

## legacy/

A korábbi dolgozathoz készült szkriptek, beégetett adatokkal. Megőrizve hivatkozási alapként,
de új méréshez nem használandók: nem reprodukálhatók, mert nem élő adatforrásból számolnak.
