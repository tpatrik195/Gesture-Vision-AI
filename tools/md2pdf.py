#!/usr/bin/env python3
"""Render a Markdown document to PDF for the docs/ archive.

Used to keep a permanent, reviewable record of development work and
measurements alongside the code:

    python3 tools/md2pdf.py docs/source/my-note.md docs/my-note.pdf

Supports headings, paragraphs, bullet and numbered lists, fenced code blocks,
pipe tables, bold/inline code spans and horizontal rules - enough for technical
notes, and Unicode-safe (DejaVu) so Hungarian text renders correctly.
"""
from __future__ import annotations

import argparse
import html
import re
import sys
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    Preformatted,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.platypus.flowables import HRFlowable

FONT_DIR = Path("/usr/share/fonts/truetype/dejavu")
INK = colors.HexColor("#14181a")
MUTED = colors.HexColor("#5b6966")
ACCENT = colors.HexColor("#0d6b63")
RULE = colors.HexColor("#dde4e1")
CODE_BG = colors.HexColor("#eef2f0")


def register_fonts() -> tuple[str, str]:
    try:
        pdfmetrics.registerFont(TTFont("DejaVu", str(FONT_DIR / "DejaVuSans.ttf")))
        pdfmetrics.registerFont(TTFont("DejaVu-Bold", str(FONT_DIR / "DejaVuSans-Bold.ttf")))
        pdfmetrics.registerFont(TTFont("DejaVuMono", str(FONT_DIR / "DejaVuSansMono.ttf")))
        pdfmetrics.registerFontFamily("DejaVu", normal="DejaVu", bold="DejaVu-Bold")
        return "DejaVu", "DejaVuMono"
    except Exception:
        # Fall back to the built-in fonts; accented characters may be missing.
        return "Helvetica", "Courier"


def build_styles(body_font: str, mono_font: str) -> dict:
    base = getSampleStyleSheet()["BodyText"]
    return {
        "title": ParagraphStyle("title", parent=base, fontName=f"{body_font}-Bold" if body_font == "DejaVu" else "Helvetica-Bold",
                                fontSize=21, leading=26, spaceAfter=4, textColor=INK),
        "subtitle": ParagraphStyle("subtitle", parent=base, fontName=body_font, fontSize=10.5,
                                   leading=15, textColor=MUTED, spaceAfter=14),
        "h1": ParagraphStyle("h1", parent=base, fontName=f"{body_font}-Bold" if body_font == "DejaVu" else "Helvetica-Bold",
                             fontSize=15, leading=19, spaceBefore=16, spaceAfter=6, textColor=INK),
        "h2": ParagraphStyle("h2", parent=base, fontName=f"{body_font}-Bold" if body_font == "DejaVu" else "Helvetica-Bold",
                             fontSize=12.5, leading=16, spaceBefore=13, spaceAfter=5, textColor=ACCENT),
        "h3": ParagraphStyle("h3", parent=base, fontName=f"{body_font}-Bold" if body_font == "DejaVu" else "Helvetica-Bold",
                             fontSize=11, leading=14, spaceBefore=10, spaceAfter=4, textColor=INK),
        "body": ParagraphStyle("body", parent=base, fontName=body_font, fontSize=9.8, leading=14.5,
                               alignment=TA_LEFT, textColor=INK, spaceAfter=7),
        "bullet": ParagraphStyle("bullet", parent=base, fontName=body_font, fontSize=9.8, leading=14,
                                 textColor=INK, spaceAfter=2),
        "code": ParagraphStyle("code", parent=base, fontName=mono_font, fontSize=8.2, leading=11.4,
                               textColor=INK, backColor=CODE_BG, borderPadding=7, spaceAfter=9),
        "cell": ParagraphStyle("cell", parent=base, fontName=body_font, fontSize=8.6, leading=12, textColor=INK),
        "cellhead": ParagraphStyle("cellhead", parent=base, fontName=f"{body_font}-Bold" if body_font == "DejaVu" else "Helvetica-Bold",
                                   fontSize=8.6, leading=12, textColor=INK),
    }


def inline(text: str, mono_font: str) -> str:
    text = html.escape(text, quote=False)
    text = re.sub(r"`([^`]+)`", rf'<font face="{mono_font}" size="8.6">\1</font>', text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", text)
    text = re.sub(r"(?<!\*)\*([^*\n]+)\*(?!\*)", r"<i>\1</i>", text)
    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<link href="\2"><font color="#0d6b63">\1</font></link>', text)
    return text


def parse(md: str, styles: dict, mono_font: str) -> list:
    story: list = []
    lines = md.split("\n")
    index = 0
    first_heading = True

    while index < len(lines):
        line = lines[index]
        stripped = line.strip()

        if not stripped:
            index += 1
            continue

        if stripped == "<!-- pagebreak -->":
            story.append(PageBreak())
            index += 1
            continue

        if stripped.startswith("```"):
            index += 1
            block: list[str] = []
            while index < len(lines) and not lines[index].strip().startswith("```"):
                block.append(lines[index])
                index += 1
            index += 1
            story.append(Preformatted("\n".join(block) or " ", styles["code"]))
            continue

        if re.match(r"^(-{3,}|\*{3,})$", stripped):
            story.append(Spacer(1, 4))
            story.append(HRFlowable(width="100%", thickness=0.6, color=RULE))
            story.append(Spacer(1, 6))
            index += 1
            continue

        if stripped.startswith("|") and index + 1 < len(lines) and re.match(r"^\|[\s:|-]+\|$", lines[index + 1].strip()):
            rows = []
            while index < len(lines) and lines[index].strip().startswith("|"):
                cells = [c.strip() for c in lines[index].strip().strip("|").split("|")]
                if not re.match(r"^[\s:|-]+$", "|".join(cells)):
                    rows.append(cells)
                index += 1
            if rows:
                header, *body_rows = rows
                width = (A4[0] - 40 * mm) / max(len(header), 1)
                data = [[Paragraph(inline(c, mono_font), styles["cellhead"]) for c in header]]
                data += [[Paragraph(inline(c, mono_font), styles["cell"]) for c in row] for row in body_rows]
                table = Table(data, colWidths=[width] * len(header), hAlign="LEFT")
                table.setStyle(TableStyle([
                    ("LINEBELOW", (0, 0), (-1, 0), 0.8, ACCENT),
                    ("LINEBELOW", (0, 1), (-1, -2), 0.3, RULE),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("TOPPADDING", (0, 0), (-1, -1), 5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                    ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ]))
                story.append(table)
                story.append(Spacer(1, 10))
            continue

        heading = re.match(r"^(#{1,4})\s+(.*)$", stripped)
        if heading:
            level = len(heading.group(1))
            text = inline(heading.group(2), mono_font)
            if level == 1 and first_heading:
                story.append(Paragraph(text, styles["title"]))
                first_heading = False
            else:
                story.append(Paragraph(text, styles[f"h{min(level, 3)}"]))
            index += 1
            continue

        if re.match(r"^[-*+]\s+", stripped) or re.match(r"^\d+[.)]\s+", stripped):
            ordered = bool(re.match(r"^\d+[.)]\s+", stripped))
            items = []
            while index < len(lines):
                current = lines[index].strip()
                match = re.match(r"^(?:[-*+]|\d+[.)])\s+(.*)$", current)
                if not match:
                    break
                items.append(ListItem(Paragraph(inline(match.group(1), mono_font), styles["bullet"]),
                                      leftIndent=14))
                index += 1
            story.append(ListFlowable(items, bulletType="1" if ordered else "bullet",
                                      bulletColor=ACCENT, start="1" if ordered else None,
                                      leftIndent=16, bulletFontSize=8))
            story.append(Spacer(1, 7))
            continue

        paragraph = [stripped]
        index += 1
        while index < len(lines) and lines[index].strip() and not re.match(
                r"^(#{1,4}\s|[-*+]\s|\d+[.)]\s|\||```|-{3,}$)", lines[index].strip()):
            paragraph.append(lines[index].strip())
            index += 1
        story.append(Paragraph(inline(" ".join(paragraph), mono_font), styles["body"]))

    return story


def render(source: Path, target: Path, subtitle: str | None) -> None:
    body_font, mono_font = register_fonts()
    styles = build_styles(body_font, mono_font)
    story = parse(source.read_text(encoding="utf-8"), styles, mono_font)

    if subtitle:
        insert_at = 1 if story and isinstance(story[0], Paragraph) else 0
        story.insert(insert_at, Paragraph(html.escape(subtitle), styles["subtitle"]))

    target.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(target), pagesize=A4,
        leftMargin=20 * mm, rightMargin=20 * mm, topMargin=18 * mm, bottomMargin=18 * mm,
        title=source.stem, author="Gesture Vision AI",
    )

    def decorate(canvas, _doc):
        canvas.saveState()
        canvas.setFont(mono_font, 7.5)
        canvas.setFillColor(MUTED)
        canvas.drawString(20 * mm, 11 * mm, "Gesture Vision AI")
        canvas.drawRightString(A4[0] - 20 * mm, 11 * mm, str(canvas.getPageNumber()))
        canvas.setStrokeColor(RULE)
        canvas.setLineWidth(0.4)
        canvas.line(20 * mm, 14 * mm, A4[0] - 20 * mm, 14 * mm)
        canvas.restoreState()

    doc.build(story, onFirstPage=decorate, onLaterPages=decorate)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("target", type=Path, nargs="?")
    parser.add_argument("--subtitle", default=None)
    args = parser.parse_args()

    if not args.source.exists():
        print(f"No such file: {args.source}", file=sys.stderr)
        return 1

    target = args.target or Path("docs") / f"{args.source.stem}.pdf"
    render(args.source, target, args.subtitle)
    print(f"Wrote {target}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
