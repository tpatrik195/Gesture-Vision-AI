#!/usr/bin/env python3
"""Export measurement data from the live database to CSV.

The CSV files are the raw research data: version them or archive them next to
the analysis, so every figure in the thesis can be traced back to the exact
observations it was computed from.

    DATABASE_URL=postgresql+psycopg2://... python3 meresek/export_data.py

Inside the running stack:

    docker compose exec api python3 -m meresek.export_data --out /srv/export
"""
from __future__ import annotations

import argparse
import csv
import os
import sys
from datetime import datetime
from pathlib import Path

from sqlalchemy import create_engine, text

TABLES = {
    "gesture_events": "SELECT * FROM gesture_events ORDER BY created_at",
    "frame_samples": "SELECT * FROM frame_samples ORDER BY created_at",
    "practice_attempts": "SELECT * FROM practice_attempts ORDER BY created_at",
    "session_metrics": "SELECT * FROM session_metrics ORDER BY created_at",
    "client_sessions": (
        # Never export identifying columns: IP address and user agent stay in
        # the database, the research data set only needs coarse attributes.
        "SELECT client_id, consent_accepted, consent_at, consent_version, "
        "language, created_at, last_seen_at FROM client_sessions ORDER BY created_at"
    ),
}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=Path("meresek/data"))
    parser.add_argument("--database-url", default=os.getenv("DATABASE_URL"))
    args = parser.parse_args()

    if not args.database_url:
        print("DATABASE_URL is not set", file=sys.stderr)
        return 1

    stamp = datetime.now().strftime("%Y%m%d-%H%M")
    out_dir = args.out / stamp
    out_dir.mkdir(parents=True, exist_ok=True)

    engine = create_engine(args.database_url)
    total = 0
    with engine.connect() as conn:
        for name, query in TABLES.items():
            try:
                result = conn.execute(text(query))
            except Exception as exc:
                print(f"  {name}: skipped ({exc.__class__.__name__})")
                continue
            rows = result.fetchall()
            path = out_dir / f"{name}.csv"
            with path.open("w", newline="", encoding="utf-8") as fh:
                writer = csv.writer(fh)
                writer.writerow(result.keys())
                writer.writerows(rows)
            total += len(rows)
            print(f"  {name}: {len(rows)} rows -> {path}")

    print(f"Exported {total} rows to {out_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
