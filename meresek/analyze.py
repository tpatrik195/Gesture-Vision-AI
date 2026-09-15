#!/usr/bin/env python3
"""Analyse exported measurement data and produce figures plus a summary.

Reads the CSVs written by export_data.py - never hardcoded numbers - so every
figure can be regenerated from the raw observations:

    python3 meresek/analyze.py meresek/data/20260915-1200

Outputs into <input>/figures: latency distribution, per-gesture accuracy, a
multi-class confusion matrix, and summary.md with the figures needed for the
results chapter (n, mean, median, p95, Wilson confidence intervals, chi-square).
"""
from __future__ import annotations

import argparse
import csv
import math
import statistics
import sys
from collections import Counter, defaultdict
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

INK = "#14181a"
ACCENT = "#0d6b63"
GRID = "#dde4e1"


def read_csv(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with path.open(encoding="utf-8") as fh:
        return list(csv.DictReader(fh))


def to_float(value: str | None) -> float | None:
    try:
        return float(value) if value not in (None, "") else None
    except ValueError:
        return None


def wilson_interval(successes: int, total: int, z: float = 1.96) -> tuple[float, float]:
    """Wilson score interval - valid for the small samples typical here,
    unlike the normal approximation."""
    if total == 0:
        return 0.0, 0.0
    p = successes / total
    denominator = 1 + z**2 / total
    centre = (p + z**2 / (2 * total)) / denominator
    margin = z * math.sqrt(p * (1 - p) / total + z**2 / (4 * total**2)) / denominator
    return max(0.0, centre - margin), min(1.0, centre + margin)


def chi_square_2x2(a: int, b: int, c: int, d: int) -> tuple[float, float]:
    """Chi-square test of independence with Yates' correction."""
    n = a + b + c + d
    if n == 0 or (a + b) == 0 or (c + d) == 0 or (a + c) == 0 or (b + d) == 0:
        return float("nan"), float("nan")
    numerator = n * (abs(a * d - b * c) - n / 2) ** 2
    denominator = (a + b) * (c + d) * (a + c) * (b + d)
    chi2 = numerator / denominator
    try:
        from scipy.stats import chi2 as chi2_dist

        p = float(chi2_dist.sf(chi2, 1))
    except ImportError:
        p = float("nan")
    return chi2, p


def style_axis(ax) -> None:
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.spines["left"].set_color(GRID)
    ax.spines["bottom"].set_color(GRID)
    ax.grid(axis="y", color=GRID, linewidth=0.6)
    ax.set_axisbelow(True)


def latency_report(frames: list[dict], figures: Path) -> list[str]:
    pipeline = [v for v in (to_float(r.get("pipeline_ms")) for r in frames) if v is not None]
    inference = [v for v in (to_float(r.get("inference_ms")) for r in frames) if v is not None]
    decode = [v for v in (to_float(r.get("decode_ms")) for r in frames) if v is not None]

    if not pipeline:
        return ["No frame samples available yet."]

    ordered = sorted(pipeline)
    p95 = ordered[min(len(ordered) - 1, int(len(ordered) * 0.95))]
    p50 = statistics.median(ordered)
    lines = [
        "## Latencia (szerveroldali feldolgozás)",
        "",
        f"- Minta: **n = {len(pipeline)}** képkocka",
        f"- Átlag: **{statistics.mean(pipeline):.1f} ms**, medián: **{p50:.1f} ms**",
        f"- Szórás: {statistics.pstdev(pipeline):.1f} ms, p95: **{p95:.1f} ms**",
        f"- Tartomány: {min(pipeline):.1f} – {max(pipeline):.1f} ms",
    ]
    if inference:
        lines.append(f"- Ebből MediaPipe inferencia: átlag {statistics.mean(inference):.1f} ms")
    if decode:
        lines.append(f"- JPEG dekódolás: átlag {statistics.mean(decode):.1f} ms")
    lines.append("")

    fig, (ax_hist, ax_box) = plt.subplots(1, 2, figsize=(11, 4.2))
    ax_hist.hist(pipeline, bins=min(30, max(8, len(pipeline) // 10)), color=ACCENT, alpha=0.85)
    ax_hist.set_xlabel("feldolgozási idő (ms)")
    ax_hist.set_ylabel("képkocka")
    ax_hist.set_title("Latencia eloszlása", color=INK)
    style_axis(ax_hist)

    parts = [pipeline] + ([inference] if inference else []) + ([decode] if decode else [])
    labels = ["teljes"] + (["inferencia"] if inference else []) + (["dekódolás"] if decode else [])
    box = ax_box.boxplot(parts, labels=labels, patch_artist=True)
    for patch in box["boxes"]:
        patch.set_facecolor(ACCENT)
        patch.set_alpha(0.35)
    ax_box.set_ylabel("ms")
    ax_box.set_title("Komponensek", color=INK)
    style_axis(ax_box)

    fig.tight_layout()
    fig.savefig(figures / "latency.png", dpi=150)
    plt.close(fig)
    return lines


def accuracy_report(attempts: list[dict], figures: Path) -> list[str]:
    if not attempts:
        return ["## Pontosság", "", "Még nincs címkézett gyakorlási adat.", ""]

    per_gesture: dict[str, list[dict]] = defaultdict(list)
    for row in attempts:
        per_gesture[row["expected_gesture"]].append(row)

    lines = ["## Felismerési pontosság (gyakorló felület, ismert elvárt gesztus)", "",
             "| Gesztus | n | Helyes | Pontosság | 95% CI (Wilson) |",
             "| --- | --- | --- | --- | --- |"]

    labels, values = [], []
    for gesture, rows in sorted(per_gesture.items()):
        total = len(rows)
        correct = sum(1 for r in rows if r.get("succeeded", "").lower() in ("true", "t", "1"))
        low, high = wilson_interval(correct, total)
        lines.append(f"| {gesture} | {total} | {correct} | {correct / total * 100:.1f}% | "
                     f"{low * 100:.1f}–{high * 100:.1f}% |")
        labels.append(gesture)
        values.append(correct / total * 100)
    lines.append("")

    participants = len({r["client_id"] for r in attempts})
    lines.append(f"Résztvevő munkamenetek száma: **{participants}**, összes próbálkozás: **{len(attempts)}**.")
    lines.append("")

    if labels:
        fig, ax = plt.subplots(figsize=(7.5, 4))
        ax.bar(labels, values, color=ACCENT, alpha=0.85)
        ax.set_ylabel("pontosság (%)")
        ax.set_ylim(0, 100)
        ax.set_title("Pontosság gesztusonként", color=INK)
        plt.setp(ax.get_xticklabels(), rotation=20, ha="right")
        style_axis(ax)
        fig.tight_layout()
        fig.savefig(figures / "accuracy_by_gesture.png", dpi=150)
        plt.close(fig)

    return lines


def confusion_report(attempts: list[dict], figures: Path) -> list[str]:
    if not attempts:
        return []

    expected_labels = sorted({r["expected_gesture"] for r in attempts})
    detected_labels = sorted({r.get("detected_gesture") or "None" for r in attempts})
    labels = sorted(set(expected_labels) | set(detected_labels))
    index = {label: i for i, label in enumerate(labels)}

    matrix = [[0] * len(labels) for _ in labels]
    for row in attempts:
        expected = row["expected_gesture"]
        detected = row.get("detected_gesture") or "None"
        matrix[index[expected]][index[detected]] += 1

    fig, ax = plt.subplots(figsize=(1.5 + 1.1 * len(labels), 1.2 + 1.0 * len(labels)))
    image = ax.imshow(matrix, cmap="Blues")
    ax.set_xticks(range(len(labels)), labels, rotation=30, ha="right")
    ax.set_yticks(range(len(labels)), labels)
    ax.set_xlabel("felismert gesztus")
    ax.set_ylabel("elvárt gesztus")
    ax.set_title("Konfúziós mátrix", color=INK)
    peak = max((max(row) for row in matrix), default=0)
    for i in range(len(labels)):
        for j in range(len(labels)):
            ax.text(j, i, matrix[i][j], ha="center", va="center",
                    color="white" if matrix[i][j] > peak / 2 else INK, fontsize=9)
    fig.colorbar(image, ax=ax, shrink=0.8)
    fig.tight_layout()
    fig.savefig(figures / "confusion_matrix.png", dpi=150)
    plt.close(fig)

    return ["## Konfúziós mátrix", "",
            f"Minden valódi osztályra, {len(attempts)} próbálkozásból: `figures/confusion_matrix.png`.", ""]


def comparison_report(attempts: list[dict]) -> list[str]:
    """Static vs dynamic gestures, the comparison the thesis makes."""
    static = {"Zoom In", "Zoom Out", "Pointing"}
    groups = {"statikus": [0, 0], "dinamikus": [0, 0]}
    for row in attempts:
        key = "statikus" if row["expected_gesture"] in static else "dinamikus"
        ok = row.get("succeeded", "").lower() in ("true", "t", "1")
        groups[key][0 if ok else 1] += 1

    (sa, sb), (da, db) = groups["statikus"], groups["dinamikus"]
    if sa + sb == 0 or da + db == 0:
        return []

    chi2, p = chi_square_2x2(sa, sb, da, db)
    lines = ["## Statikus és dinamikus gesztusok összehasonlítása", "",
             "| Típus | Felismerte | Nem ismerte fel | Pontosság |",
             "| --- | --- | --- | --- |",
             f"| Statikus | {sa} | {sb} | {sa / (sa + sb) * 100:.1f}% |",
             f"| Dinamikus | {da} | {db} | {da / (da + db) * 100:.1f}% |", ""]
    if not math.isnan(chi2):
        verdict = "szignifikáns" if p < 0.05 else "nem szignifikáns"
        lines.append(f"Khi-négyzet próba (Yates-korrekcióval): χ² = {chi2:.3f}, p = {p:.3f} — "
                     f"a különbség statisztikailag **{verdict}**.")
        lines.append("")
    return lines


def usage_report(events: list[dict], sessions: list[dict], metrics: list[dict]) -> list[str]:
    lines = ["## Használati és skálázhatósági adatok", ""]
    if events:
        counts = Counter(row["gesture"] for row in events)
        lines.append("Kiküldött gesztusesemények: " +
                     ", ".join(f"{name} ({count})" for name, count in counts.most_common()) + ".")
    if sessions:
        consented = sum(1 for r in sessions if r.get("consent_accepted", "").lower() in ("true", "t", "1"))
        lines.append(f"Munkamenetek: {len(sessions)}, ebből hozzájárulást adott: {consented}.")
    if metrics:
        peaks = [to_float(r.get("concurrent_sessions_peak")) for r in metrics]
        peaks = [p for p in peaks if p is not None]
        dropped = sum(int(float(r.get("frames_dropped_rate_limit") or 0)) for r in metrics)
        if peaks:
            lines.append(f"Egyidejű munkamenetek csúcsértéke: {int(max(peaks))}.")
        lines.append(f"Sebességkorlát miatt eldobott képkockák összesen: {dropped}.")
    lines.append("")
    return lines


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("data_dir", type=Path, help="directory produced by export_data.py")
    args = parser.parse_args()

    if not args.data_dir.is_dir():
        print(f"No such directory: {args.data_dir}", file=sys.stderr)
        return 1

    figures = args.data_dir / "figures"
    figures.mkdir(exist_ok=True)

    frames = read_csv(args.data_dir / "frame_samples.csv")
    attempts = read_csv(args.data_dir / "practice_attempts.csv")
    events = read_csv(args.data_dir / "gesture_events.csv")
    sessions = read_csv(args.data_dir / "client_sessions.csv")
    metrics = read_csv(args.data_dir / "session_metrics.csv")

    report = [f"# Mérési eredmények — {args.data_dir.name}", "",
              "Automatikusan generálva az éles használat során gyűjtött adatokból.", ""]
    report += latency_report(frames, figures)
    report += accuracy_report(attempts, figures)
    report += confusion_report(attempts, figures)
    report += comparison_report(attempts)
    report += usage_report(events, sessions, metrics)

    summary = args.data_dir / "summary.md"
    summary.write_text("\n".join(report), encoding="utf-8")
    print(f"Wrote {summary} and figures in {figures}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
