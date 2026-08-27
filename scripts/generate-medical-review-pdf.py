from __future__ import annotations

import html
import re
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    ListFlowable,
    ListItem,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs" / "07_医学的レビュー_原典修正点.md"
OUTPUT = ROOT / "output" / "pdf" / "抗菌薬投与マニュアル第9版_医学的レビュー_原典修正点.pdf"

pdfmetrics.registerFont(TTFont("Meiryo", r"C:\Windows\Fonts\meiryo.ttc", subfontIndex=0))
pdfmetrics.registerFont(TTFont("Meiryo-Bold", r"C:\Windows\Fonts\meiryo.ttc", subfontIndex=1))

PAGE_W, PAGE_H = A4
MARGIN_X = 18 * mm
MARGIN_TOP = 18 * mm
MARGIN_BOTTOM = 17 * mm


def inline(text: str) -> str:
    escaped = html.escape(text)
    escaped = re.sub(r"`([^`]+)`", r"<font name='Meiryo'>\1</font>", escaped)
    escaped = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", escaped)
    escaped = re.sub(
        r"(https://[^\s<]+)",
        lambda m: f"<link href='{m.group(1)}' color='#0e6b63'>{m.group(1)}</link>",
        escaped,
    )
    return escaped


base = getSampleStyleSheet()
styles = {
    "title": ParagraphStyle("title", parent=base["Title"], fontName="Meiryo-Bold", fontSize=17, leading=24, textColor=colors.HexColor("#123d3a"), alignment=TA_CENTER, spaceAfter=10),
    "h2": ParagraphStyle("h2", parent=base["Heading2"], fontName="Meiryo-Bold", fontSize=12.5, leading=18, textColor=colors.HexColor("#0e6b63"), spaceBefore=10, spaceAfter=6, keepWithNext=True),
    "h3": ParagraphStyle("h3", parent=base["Heading3"], fontName="Meiryo-Bold", fontSize=10.5, leading=16, textColor=colors.HexColor("#263940"), spaceBefore=8, spaceAfter=4, keepWithNext=True),
    "body": ParagraphStyle("body", parent=base["BodyText"], fontName="Meiryo", fontSize=8.6, leading=14, textColor=colors.HexColor("#1d292e"), wordWrap="CJK", spaceAfter=5),
    "small": ParagraphStyle("small", parent=base["BodyText"], fontName="Meiryo", fontSize=7.5, leading=11, textColor=colors.HexColor("#35464d"), wordWrap="CJK"),
    "quote": ParagraphStyle("quote", parent=base["BodyText"], fontName="Meiryo", fontSize=8.6, leading=14, leftIndent=9, rightIndent=6, borderColor=colors.HexColor("#0e6b63"), borderWidth=1.5, borderPadding=7, backColor=colors.HexColor("#e8f2f0"), wordWrap="CJK", spaceAfter=6),
}


def header_footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Meiryo", 7)
    canvas.setFillColor(colors.HexColor("#65757b"))
    canvas.drawString(MARGIN_X, 9 * mm, "抗菌薬投与マニュアル 第9版 - 医学的レビュー")
    canvas.drawRightString(PAGE_W - MARGIN_X, 9 * mm, f"{doc.page}")
    canvas.setStrokeColor(colors.HexColor("#d5dcdd"))
    canvas.line(MARGIN_X, 12 * mm, PAGE_W - MARGIN_X, 12 * mm)
    canvas.restoreState()


def make_table(rows: list[list[str]]) -> Table:
    n = len(rows[0])
    available = PAGE_W - 2 * MARGIN_X
    if n == 2:
        widths = [available * 0.22, available * 0.78]
    elif n == 5:
        widths = [available * 0.10, available * 0.10, available * 0.24, available * 0.28, available * 0.28]
    else:
        widths = [available / n] * n
    data = [[Paragraph(inline(cell.strip()), styles["small"]) for cell in row] for row in rows]
    table = Table(data, colWidths=widths, repeatRows=1, hAlign="LEFT")
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#dcece9")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#123d3a")),
        ("FONTNAME", (0, 0), (-1, 0), "Meiryo-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#c6d0d1")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return table


def parse_markdown(text: str):
    lines = text.splitlines()
    story = []
    i = 0
    while i < len(lines):
        line = lines[i].rstrip()
        if not line:
            i += 1
            continue
        if line.startswith("# "):
            story.append(Paragraph(inline(line[2:]), styles["title"]))
            i += 1
            continue
        if line.startswith("## "):
            story.append(Paragraph(inline(line[3:]), styles["h2"]))
            i += 1
            continue
        if line.startswith("### "):
            story.append(Paragraph(inline(line[4:]), styles["h3"]))
            i += 1
            continue
        if line.startswith("|") and i + 1 < len(lines) and re.match(r"^\|[\s:|-]+\|$", lines[i + 1]):
            rows = []
            rows.append([c for c in line.strip("|").split("|")])
            i += 2
            while i < len(lines) and lines[i].startswith("|"):
                rows.append([c for c in lines[i].strip("|").split("|")])
                i += 1
            story.extend([make_table(rows), Spacer(1, 5)])
            continue
        if line.startswith("> "):
            parts = []
            while i < len(lines) and lines[i].startswith("> "):
                parts.append(lines[i][2:])
                i += 1
            story.append(Paragraph(inline(" ".join(parts)), styles["quote"]))
            continue
        if re.match(r"^[-*] ", line):
            items = []
            while i < len(lines) and re.match(r"^[-*] ", lines[i]):
                items.append(ListItem(Paragraph(inline(lines[i][2:]), styles["body"]), leftIndent=10))
                i += 1
            story.append(ListFlowable(items, bulletType="bullet", leftIndent=14, bulletFontName="Meiryo", bulletFontSize=6, spaceAfter=4))
            continue
        if re.match(r"^\d+\. ", line):
            items = []
            while i < len(lines) and re.match(r"^\d+\. ", lines[i]):
                items.append(ListItem(Paragraph(inline(re.sub(r"^\d+\. ", "", lines[i])), styles["body"]), leftIndent=12))
                i += 1
            story.append(ListFlowable(items, bulletType="1", leftIndent=18, bulletFontName="Meiryo", bulletFontSize=8, spaceAfter=4))
            continue
        parts = [line]
        i += 1
        while i < len(lines) and lines[i].strip() and not re.match(r"^(#|>|[-*] |\d+\. |\|)", lines[i]):
            parts.append(lines[i].strip())
            i += 1
        story.append(Paragraph(inline(" ".join(parts)), styles["body"]))
    return story


OUTPUT.parent.mkdir(parents=True, exist_ok=True)
doc = BaseDocTemplate(
    str(OUTPUT),
    pagesize=A4,
    leftMargin=MARGIN_X,
    rightMargin=MARGIN_X,
    topMargin=MARGIN_TOP,
    bottomMargin=MARGIN_BOTTOM,
    title="抗菌薬投与マニュアル 第9版 医学的レビュー（原典修正点）",
    author="OpenAI Codex / 医学的レビュー補助",
)
frame = Frame(MARGIN_X, MARGIN_BOTTOM, PAGE_W - 2 * MARGIN_X, PAGE_H - MARGIN_TOP - MARGIN_BOTTOM, id="normal")
doc.addPageTemplates([PageTemplate(id="main", frames=[frame], onPage=header_footer)])
doc.build(parse_markdown(SOURCE.read_text(encoding="utf-8")))
print(OUTPUT)
