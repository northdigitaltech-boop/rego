#!/usr/bin/env python3
"""
REGO brand book — the printable one.

WHY THIS IS DRAWN, NOT PHOTOGRAPHED
    A photo-realistic mockup shows somebody what a mug could look
    like. It does not tell a printer anything: not the size, not
    the ink, not where the logo sits. This is the other document —
    every item at its real dimensions with the measurements a
    supplier needs. It is also the input to a photo-realistic
    render, whoever ends up making one.

EVERY FACT HERE COMES FROM THE CODEBASE
    Colours from tailwind.config.ts, contact details and the SECP
    number from src/lib/site.ts, the logo from assets/. Nothing is
    invented. In particular there are no Pantone numbers: a Pantone
    match is a physical thing a printer holds against a swatch, and
    a guessed number in a brand book is a guess somebody will spend
    money on.

Run:  python3 brand/build_brand_book.py
"""

import os
from reportlab.lib.colors import HexColor, Color
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# --------------------------------------------------------------------------
# Brand tokens. These are the values in tailwind.config.ts, not near-misses.
# --------------------------------------------------------------------------
FOREST = HexColor("#006951")
FOREST_DEEP = HexColor("#003F31")
FOREST_NIGHT = HexColor("#002A21")
GOLD = HexColor("#E5B94B")
GOLD_DEEP = HexColor("#B68421")
MINT = HexColor("#3FB8A0")
CREAM = HexColor("#FDF8EC")
WHITE = HexColor("#FFFFFF")
INK = HexColor("#1A2320")
GREY = HexColor("#6B7C75")
RULE = HexColor("#D8E3DF")

PALETTE = [
    ("Forest Green", "#006951", "C100 M0 Y23 K59", "Primary. Backgrounds, headings, the logo panel."),
    ("Forest Deep", "#003F31", "C100 M0 Y22 K75", "Darker panels, footers, print on light stock."),
    ("Forest Night", "#002A21", "C100 M0 Y21 K84", "The logo lockup background."),
    ("Rego Gold", "#E5B94B", "C0 M19 Y67 K10", "Accent only. The path in the mark, rules, one CTA."),
    ("Gold Deep", "#B68421", "C0 M27 Y82 K29", "Gold on light backgrounds, where the lighter gold fails contrast."),
    ("Mint", "#3FB8A0", "C66 M0 Y13 K28", "Highlights and gradients. Never for body text."),
    ("Cream", "#FDF8EC", "C0 M2 Y7 K1", "Paper tone, light panels."),
]

# --------------------------------------------------------------------------
# Real facts, from src/lib/site.ts
# --------------------------------------------------------------------------
LEGAL_NAME = "REGO. (SMC-PRIVATE) LIMITED"
CUIN = "0345252"
PHONE = "+92 316 1290604"
EMAIL = "info@rego.services"
WEB = "www.rego.services"
ADDRESS = "Skardu, Gilgit Baltistan, Pakistan"
TAGLINE = "Book · Explore · Experience"

# Change these two and re-run.
CARD_NAME = "Muhammad Bashir"
CARD_TITLE = "Director"

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGO_ROUND = os.path.join(ROOT, "presentation", "rego-logo.png")
LOGO_MARK = os.path.join(ROOT, "assets", "logo-mark.png")
OUT = os.path.join(ROOT, "brand", "REGO-Brand-Book.pdf")

PW, PH = A4
M = 18 * mm

# --------------------------------------------------------------------------
# Fonts. Montserrat is the site's font; fall back rather than fail, and say
# which was used on the typography page so nobody specifies the wrong one.
# --------------------------------------------------------------------------
FONT = "Helvetica"
FONT_B = "Helvetica-Bold"
FONT_NAME_SHOWN = "Montserrat"


def try_register_montserrat():
    global FONT, FONT_B
    candidates = [
        ("/usr/share/fonts/truetype/montserrat/Montserrat-Regular.ttf",
         "/usr/share/fonts/truetype/montserrat/Montserrat-Bold.ttf"),
    ]
    for reg, bold in candidates:
        if os.path.exists(reg) and os.path.exists(bold):
            pdfmetrics.registerFont(TTFont("Montserrat", reg))
            pdfmetrics.registerFont(TTFont("Montserrat-Bold", bold))
            FONT, FONT_B = "Montserrat", "Montserrat-Bold"
            return True
    return False


HAS_MONTSERRAT = try_register_montserrat()


# --------------------------------------------------------------------------
# Page furniture
# --------------------------------------------------------------------------
def page_header(c, num, title, kicker=None):
    """Runs on every content page: a thin gold rule, the section, the number."""
    c.setFillColor(FOREST)
    c.setFont(FONT_B, 20)
    c.drawString(M, PH - M - 6, title)
    if kicker:
        c.setFillColor(GREY)
        c.setFont(FONT, 9.5)
        c.drawString(M, PH - M - 20, kicker)
    c.setStrokeColor(GOLD)
    c.setLineWidth(2)
    c.line(M, PH - M - 30, M + 28 * mm, PH - M - 30)

    c.setFillColor(GREY)
    c.setFont(FONT, 8)
    c.drawRightString(PW - M, 12 * mm, f"REGO Brand Book · {num}")
    c.setStrokeColor(RULE)
    c.setLineWidth(0.5)
    c.line(M, 16 * mm, PW - M, 16 * mm)


def body(c, x, y, text, w=None, size=9.5, leading=13.5, color=INK, font=None):
    """Word-wrapped paragraph. Returns the y it finished at."""
    c.setFillColor(color)
    c.setFont(font or FONT, size)
    w = w or (PW - 2 * M)
    words, line = text.split(), ""
    for word in words:
        trial = (line + " " + word).strip()
        if c.stringWidth(trial, font or FONT, size) <= w:
            line = trial
        else:
            c.drawString(x, y, line)
            y -= leading
            line = word
    if line:
        c.drawString(x, y, line)
        y -= leading
    return y


def label(c, x, y, text, color=GREY, size=7.5):
    c.setFillColor(color)
    c.setFont(FONT_B, size)
    c.drawString(x, y, text.upper())


def spec(c, x, y, text, color=GREY, size=7.5):
    """A measurement caption under a drawn item."""
    c.setFillColor(color)
    c.setFont(FONT, size)
    c.drawString(x, y, text)


def dimension_line(c, x1, y1, x2, y2, text):
    """A drawn measurement, so a printer can read the intended size."""
    c.setStrokeColor(GOLD_DEEP)
    c.setLineWidth(0.5)
    c.line(x1, y1, x2, y2)
    tick = 1.5 * mm
    if abs(y2 - y1) < 0.1:
        c.line(x1, y1 - tick, x1, y1 + tick)
        c.line(x2, y2 - tick, x2, y2 + tick)
        c.setFillColor(GOLD_DEEP)
        c.setFont(FONT, 6.5)
        c.drawCentredString((x1 + x2) / 2, y1 + 2 * mm, text)
    else:
        c.line(x1 - tick, y1, x1 + tick, y1)
        c.line(x2 - tick, y2, x2 + tick, y2)
        c.saveState()
        c.translate(x1 - 2.5 * mm, (y1 + y2) / 2)
        c.rotate(90)
        c.setFillColor(GOLD_DEEP)
        c.setFont(FONT, 6.5)
        c.drawCentredString(0, 0, text)
        c.restoreState()


def logo(c, x, y, w, round_version=True):
    """The real logo file, never redrawn."""
    path = LOGO_ROUND if round_version else LOGO_MARK
    if not os.path.exists(path):
        return
    from PIL import Image
    iw, ih = Image.open(path).size
    h = w * ih / iw
    c.drawImage(path, x, y, width=w, height=h, mask="auto")
    return h


# ==========================================================================
# 1 — Cover
# ==========================================================================
def page_cover(c):
    c.setFillColor(FOREST_NIGHT)
    c.rect(0, 0, PW, PH, fill=1, stroke=0)

    # A single gold hairline near the top edge. The brand uses gold sparingly
    # and a cover is the wrong place to start spending it.
    c.setStrokeColor(GOLD)
    c.setLineWidth(1)
    c.line(M, PH - 30 * mm, PW - M, PH - 30 * mm)

    lw = 46 * mm
    lh = logo(c, (PW - lw) / 2, PH / 2 + 12 * mm, lw) or 0

    c.setFillColor(WHITE)
    c.setFont(FONT_B, 34)
    c.drawCentredString(PW / 2, PH / 2 - 6 * mm, "Brand Book")

    c.setFillColor(GOLD)
    c.setFont(FONT, 11)
    c.drawCentredString(PW / 2, PH / 2 - 16 * mm, TAGLINE)

    c.setFillColor(HexColor("#8FC8BB"))
    c.setFont(FONT, 9)
    c.drawCentredString(PW / 2, 34 * mm, LEGAL_NAME)
    c.drawCentredString(PW / 2, 29 * mm, f"CUIN {CUIN} · {ADDRESS}")
    c.drawCentredString(PW / 2, 24 * mm, f"{WEB} · {EMAIL} · {PHONE}")
    c.showPage()


# ==========================================================================
# 2 — How to use this
# ==========================================================================
def page_intro(c):
    page_header(c, 2, "How to use this", "What this document is for, and what it is not")
    y = PH - M - 48

    y = body(c, M, y,
        "This is the file you hand to a printer, a supplier or a designer. Every item is drawn at "
        "its real size with the measurements needed to produce it. Nothing on these pages is a "
        "picture of a finished product — a photograph of a mug tells you what it looks like and "
        "nothing about how to make it.",
        size=10.5, leading=15)

    y -= 8
    y = body(c, M, y,
        "The colours, the contact details and the registration number come from the Rego codebase "
        "and the SECP register. They are not approximations. If any of them changes, it changes "
        "there first and this book is rebuilt.",
        size=10.5, leading=15)

    y -= 16
    label(c, M, y, "Two rules that matter more than the rest")
    y -= 16

    for n, (head, txt) in enumerate([
        ("Gold is an accent, never a background",
         "The mark carries one gold element — the path under the trekker. On everything else gold is "
         "a rule, a border or a single highlight. A gold-filled panel reads as a different brand."),
        ("The logo is never redrawn",
         "Use the supplied files. Do not retype 'Rego' in a similar font, do not rebuild the mountain, "
         "do not recolour the mark to match a product. If a supplier asks for vector, send them the "
         "source rather than letting them trace it."),
    ], start=1):
        c.setFillColor(FOREST)
        c.setFont(FONT_B, 10.5)
        c.drawString(M, y, f"{n}.  {head}")
        y -= 14
        y = body(c, M + 6 * mm, y, txt, w=PW - 2 * M - 6 * mm)
        y -= 10

    y -= 6
    c.setFillColor(CREAM)
    c.roundRect(M, y - 42 * mm, PW - 2 * M, 42 * mm, 3 * mm, fill=1, stroke=0)
    c.setFillColor(FOREST)
    c.setFont(FONT_B, 10)
    c.drawString(M + 8 * mm, y - 10 * mm, "Before anything is printed")
    body(c, M + 8 * mm, y - 18 * mm,
         "Ask the printer for a physical proof on the actual stock. Forest green is a deep colour with "
         "a high black component (K59), and it shifts noticeably between coated and uncoated paper. "
         "A screen will not warn you about this; a proof will.",
         w=PW - 2 * M - 16 * mm, size=9.5, leading=13)
    c.showPage()


# ==========================================================================
# 3 — The logo
# ==========================================================================
def page_logo(c):
    page_header(c, 3, "The logo", "Clear space, minimum size, and what not to do")
    y = PH - M - 52

    # Primary lockup on its own background.
    panel_h = 62 * mm
    c.setFillColor(FOREST_NIGHT)
    c.roundRect(M, y - panel_h, (PW - 2 * M) * 0.52, panel_h, 3 * mm, fill=1, stroke=0)
    lw = 34 * mm
    logo(c, M + ((PW - 2 * M) * 0.52 - lw) / 2, y - panel_h + 14 * mm, lw)
    c.setFillColor(HexColor("#8FC8BB"))
    c.setFont(FONT, 7.5)
    c.drawCentredString(M + (PW - 2 * M) * 0.26, y - panel_h + 7 * mm, "Primary lockup")

    # The mark alone. On a DARK panel, because the supplied file is a light
    # mark with a hairline outline — on cream it vanishes. Drawing it on light
    # here would have shipped a guideline that cannot be followed.
    x2 = M + (PW - 2 * M) * 0.55
    w2 = (PW - 2 * M) * 0.45
    c.setFillColor(FOREST)
    c.roundRect(x2, y - panel_h, w2, panel_h, 3 * mm, fill=1, stroke=0)
    mw = 30 * mm
    logo(c, x2 + (w2 - mw) / 2, y - panel_h + 16 * mm, mw, round_version=False)
    c.setFillColor(HexColor("#C2E0D9"))
    c.setFont(FONT, 7.5)
    c.drawCentredString(x2 + w2 / 2, y - panel_h + 7 * mm, "Mark alone — dark backgrounds only")

    y -= panel_h + 16

    # Clear space, drawn rather than described.
    label(c, M, y, "Clear space")
    y -= 6
    y = body(c, M, y - 8,
        "Keep clear space equal to the height of the letter R in the mark on all four sides. Nothing "
        "sits inside it — no text, no rule, no edge of the page.")

    box_w, box_h = 52 * mm, 34 * mm
    bx, by = M, y - box_h - 6
    c.setStrokeColor(RULE)
    c.setLineWidth(0.5)
    c.setDash(2, 2)
    c.rect(bx, by, box_w, box_h, fill=0, stroke=1)
    c.setDash()
    c.setFillColor(FOREST_NIGHT)
    inner = 7 * mm
    c.roundRect(bx + inner, by + inner, box_w - 2 * inner, box_h - 2 * inner, 2 * mm, fill=1, stroke=0)
    lw3 = 16 * mm
    logo(c, bx + (box_w - lw3) / 2, by + inner + 3 * mm, lw3)
    c.setFillColor(GOLD_DEEP)
    c.setFont(FONT, 6.5)
    c.drawCentredString(bx + box_w / 2, by - 5 * mm, "dashed line = minimum clear space")

    # Minimum sizes, at actual size so they can be checked with a ruler.
    mx = M + 62 * mm
    label(c, mx, y - 4, "Minimum size")
    sizes = [("Print", 15 * mm, "15 mm wide"), ("Screen", 12 * mm, "44 px wide")]
    sy = y - 20
    for name, w, note in sizes:
        logo(c, mx, sy - 12 * mm, w)
        c.setFillColor(GREY)
        c.setFont(FONT, 7.5)
        c.drawString(mx + w + 4 * mm, sy - 6 * mm, f"{name} — {note}")
        sy -= 20 * mm

    # What not to do.
    ny = by - 14 * mm
    label(c, M, ny, "Never")
    ny -= 14
    for txt in [
        "Stretch, squash or rotate the mark.",
        "Recolour it — no all-black, no all-white, no matching it to a product.",
        "Add a shadow, an outline, or a second background behind the round lockup.",
        "Place the light lockup on a pale photograph where the white letters disappear.",
        "Retype the wordmark in another font.",
    ]:
        c.setFillColor(HexColor("#B3261E"))
        c.setFont(FONT_B, 9)
        c.drawString(M, ny, "×")
        c.setFillColor(INK)
        c.setFont(FONT, 9)
        c.drawString(M + 5 * mm, ny, txt)
        ny -= 12

    # A real gap, found while laying this book out rather than assumed.
    ny -= 6
    c.setFillColor(HexColor("#FFF6E5"))
    c.roundRect(M, ny - 26 * mm, PW - 2 * M, 26 * mm, 3 * mm, fill=1, stroke=0)
    c.setStrokeColor(GOLD)
    c.setLineWidth(0.6)
    c.roundRect(M, ny - 26 * mm, PW - 2 * M, 26 * mm, 3 * mm, fill=0, stroke=1)
    c.setFillColor(HexColor("#8E661C"))
    c.setFont(FONT_B, 9)
    c.drawString(M + 8 * mm, ny - 9 * mm, "There is no dark version of the mark")
    body(c, M + 8 * mm, ny - 16 * mm,
         "Both supplied files are light artwork meant for dark backgrounds. On cream, white or a pale "
         "photograph the mark disappears. Anything printed on light stock needs a dark version made "
         "first — one file, once, and it removes a whole category of problem.",
         w=PW - 2 * M - 16 * mm, size=8.5, leading=11.5)
    c.showPage()


# ==========================================================================
# 4 — Colour
# ==========================================================================
def page_colour(c):
    page_header(c, 4, "Colour", "Seven values, and where each one belongs")
    y = PH - M - 50

    y = body(c, M, y,
        "These are the exact values used on rego.services. The CMYK beside each one is converted from "
        "the hex — give the printer both, and let them tell you which they will match to.",
        size=10)
    y -= 12

    sw = 26 * mm
    for name, hexv, cmyk, use in PALETTE:
        c.setFillColor(HexColor(hexv))
        c.roundRect(M, y - sw + 4, sw, sw - 6, 2 * mm, fill=1,
                    stroke=1 if hexv == "#FDF8EC" else 0)
        if hexv == "#FDF8EC":
            c.setStrokeColor(RULE)
            c.setLineWidth(0.5)
            c.roundRect(M, y - sw + 4, sw, sw - 6, 2 * mm, fill=0, stroke=1)

        tx = M + sw + 7 * mm
        c.setFillColor(FOREST)
        c.setFont(FONT_B, 11)
        c.drawString(tx, y - 5, name)
        c.setFillColor(INK)
        c.setFont(FONT, 9)
        c.drawString(tx, y - 18, f"HEX {hexv}")
        c.setFillColor(GREY)
        c.drawString(tx + 34 * mm, y - 18, cmyk)
        body(c, tx, y - 31, use, w=PW - M - tx, size=8.5, leading=11, color=GREY)
        y -= sw + 3 * mm

    y -= 4
    c.setFillColor(CREAM)
    c.roundRect(M, y - 34 * mm, PW - 2 * M, 34 * mm, 3 * mm, fill=1, stroke=0)
    c.setFillColor(FOREST)
    c.setFont(FONT_B, 10)
    c.drawString(M + 8 * mm, y - 10 * mm, "No Pantone numbers in this book")
    body(c, M + 8 * mm, y - 18 * mm,
         "A Pantone match is decided by holding a printed sheet against a physical swatch, not by "
         "reading a number off a screen. Ask your printer to match Forest Green from a proof and "
         "record whichever number they arrive at — then it is true, and it goes here.",
         w=PW - 2 * M - 16 * mm, size=9, leading=12.5)
    c.showPage()


# ==========================================================================
# 5 — Typography
# ==========================================================================
def page_type(c):
    page_header(c, 5, "Typography", "One family, used at four sizes")
    y = PH - M - 52

    c.setFillColor(FOREST)
    c.setFont(FONT_B, 46)
    c.drawString(M, y - 30, "Montserrat")
    c.setFillColor(GREY)
    c.setFont(FONT, 9.5)
    c.drawString(M, y - 46, "The site's typeface. Free, on Google Fonts. Use it everywhere.")
    y -= 68

    c.setStrokeColor(RULE)
    c.setLineWidth(0.5)
    c.line(M, y, PW - M, y)
    y -= 22

    scale = [
        ("Display", 34, FONT_B, "Covers, posters, the one line people read from across a room"),
        ("Heading", 18, FONT_B, "Section titles"),
        ("Body", 10.5, FONT, "Everything you actually read"),
        ("Caption", 8, FONT, "Legal lines, photo credits, the small print on a card"),
    ]
    for name, size, fnt, use in scale:
        c.setFillColor(GOLD_DEEP)
        c.setFont(FONT_B, 7.5)
        c.drawString(M, y, name.upper())
        c.setFillColor(GREY)
        c.setFont(FONT, 7.5)
        c.drawString(M, y - 10, f"{size} pt")

        c.setFillColor(INK)
        c.setFont(fnt, size)
        c.drawString(M + 26 * mm, y - size * 0.25, "Book · Explore · Experience")

        c.setFillColor(GREY)
        c.setFont(FONT, 8)
        c.drawString(M + 26 * mm, y - size * 0.25 - 12, use)
        y -= max(size + 26, 40)

    y -= 6
    label(c, M, y, "Rules")
    y -= 16
    for txt in [
        "Bold for headings, regular for body. Nothing else — no light, no italic, no condensed.",
        "Body text is Forest Deep or near-black on light, white on dark. Never gold, never mint.",
        "Sentence case in headings. Capitals only in the small labels used on these pages.",
        "The tagline is always 'Book · Explore · Experience' with the middle dots, never hyphens.",
    ]:
        c.setFillColor(GOLD_DEEP)
        c.setFont(FONT_B, 9)
        c.drawString(M, y, "—")
        c.setFillColor(INK)
        c.setFont(FONT, 9.5)
        y = body(c, M + 5 * mm, y, txt, w=PW - 2 * M - 5 * mm) - 2

    if not HAS_MONTSERRAT:
        y -= 8
        c.setFillColor(HexColor("#8E661C"))
        c.setFont(FONT, 8)
        c.drawString(M, y, "Note: this PDF was rendered with a substitute face. Montserrat is still the specified font.")
    c.showPage()


# ==========================================================================
# 6 — Visiting card
# ==========================================================================
def draw_card_front(c, x, y, w, h):
    c.setFillColor(FOREST_NIGHT)
    c.roundRect(x, y, w, h, 2 * mm, fill=1, stroke=0)
    # The one gold element: a hairline, echoing the path in the mark.
    c.setStrokeColor(GOLD)
    c.setLineWidth(0.8)
    c.line(x + 8 * mm, y + 13 * mm, x + 30 * mm, y + 13 * mm)

    lw = 20 * mm
    logo(c, x + 8 * mm, y + h - 8 * mm - lw, lw)

    c.setFillColor(WHITE)
    c.setFont(FONT_B, 9.5)
    c.drawString(x + 8 * mm, y + 8 * mm, CARD_NAME)
    c.setFillColor(GOLD)
    c.setFont(FONT, 6.5)
    c.drawString(x + 8 * mm, y + 4.5 * mm, CARD_TITLE)


def draw_card_back(c, x, y, w, h):
    c.setFillColor(WHITE)
    c.roundRect(x, y, w, h, 2 * mm, fill=1, stroke=1)
    c.setStrokeColor(RULE)
    c.setLineWidth(0.4)
    c.roundRect(x, y, w, h, 2 * mm, fill=0, stroke=1)

    c.setFillColor(FOREST)
    c.setFont(FONT_B, 10)
    c.drawString(x + 8 * mm, y + h - 10 * mm, "REGO")
    c.setFillColor(GOLD_DEEP)
    c.setFont(FONT, 6)
    c.drawString(x + 8 * mm, y + h - 14.5 * mm, TAGLINE)

    c.setStrokeColor(GOLD)
    c.setLineWidth(0.8)
    c.line(x + 8 * mm, y + h - 18 * mm, x + 22 * mm, y + h - 18 * mm)

    c.setFillColor(INK)
    c.setFont(FONT, 6.5)
    ly = y + h - 24 * mm
    for line in [PHONE, EMAIL, WEB, ADDRESS]:
        c.drawString(x + 8 * mm, ly, line)
        ly -= 4 * mm

    c.setFillColor(GREY)
    c.setFont(FONT, 4.8)
    c.drawString(x + 8 * mm, y + 4.5 * mm, f"{LEGAL_NAME} · CUIN {CUIN}")


def page_card(c):
    page_header(c, 6, "Visiting card", "85 × 55 mm — drawn at actual size, so it can be measured")
    y = PH - M - 54

    cw, ch = 85 * mm, 55 * mm

    # Both cards stacked on the left at TRUE size. Side by side would need
    # 180 mm and the page has 174 — and shrinking them would cost the one
    # thing that makes this page useful, which is that a ruler works on it.
    draw_card_front(c, M, y - ch, cw, ch)
    spec(c, M, y - ch - 6 * mm, "Front — dark stock, white and gold")
    dimension_line(c, M, y - ch - 11 * mm, M + cw, y - ch - 11 * mm, "85 mm")
    dimension_line(c, M - 5 * mm, y - ch, M - 5 * mm, y, "55 mm")

    y2 = y - ch - 22 * mm
    draw_card_back(c, M, y2 - ch, cw, ch)
    spec(c, M, y2 - ch - 6 * mm, "Back — white, all the details")

    # Specs run down the right, filling the page instead of leaving it empty.
    sx = M + cw + 12 * mm
    sw_ = PW - M - sx
    sy = y
    label(c, sx, sy, "For the printer")
    sy -= 16
    for k, v in [
        ("Trim size", "85 × 55 mm"),
        ("Bleed", "3 mm all round — artwork 91 × 61 mm"),
        ("Safe margin", "5 mm from trim. Nothing readable inside it."),
        ("Stock", "350–400 gsm."),
        ("Finish", "Matt lamination on the dark side. Gloss shows every fingerprint on Forest Night."),
        ("Ink", "Forest Night #002A21 flood on the front. Ask for a proof — it is 84% black and goes muddy on cheap stock."),
        ("Optional", "Gold foil on the hairline rule only. Not on the logo: foil fills in the mountain detail."),
        ("Corners", "Square."),
    ]:
        c.setFillColor(FOREST)
        c.setFont(FONT_B, 8.5)
        c.drawString(sx, sy, k)
        sy -= 11
        c.setFillColor(INK)
        sy = body(c, sx, sy, v, w=sw_, size=8.5, leading=11) - 6

    sy -= 6
    c.setFillColor(CREAM)
    c.roundRect(sx, sy - 34 * mm, sw_, 34 * mm, 3 * mm, fill=1, stroke=0)
    c.setFillColor(FOREST)
    c.setFont(FONT_B, 8.5)
    c.drawString(sx + 5 * mm, sy - 8 * mm, "One card per person")
    body(c, sx + 5 * mm, sy - 15 * mm,
         "The name and title are the only things that change. Keep everything else fixed — a card "
         "where each person has moved the logo is five brands, not one.",
         w=sw_ - 10 * mm, size=8, leading=10.5)
    c.showPage()


# ==========================================================================
# 7 — Letterhead and envelope
# ==========================================================================
def page_letterhead(c):
    page_header(c, 7, "Letterhead & envelope", "A4 and DL — for SECP, banks and provider agreements")
    y = PH - M - 52

    # A4 letterhead shown at 42% so both fit the page.
    s = 0.42
    lw, lh = 210 * mm * s, 297 * mm * s
    lx, ly = M, y - lh

    c.setFillColor(WHITE)
    c.rect(lx, ly, lw, lh, fill=1, stroke=0)
    c.setStrokeColor(RULE)
    c.setLineWidth(0.5)
    c.rect(lx, ly, lw, lh, fill=0, stroke=1)

    # Header band
    band = 26 * mm * s
    c.setFillColor(FOREST_NIGHT)
    c.rect(lx, ly + lh - band, lw, band, fill=1, stroke=0)
    logo(c, lx + 8 * mm * s, ly + lh - band + 4 * mm * s, 26 * mm * s)
    c.setFillColor(HexColor("#8FC8BB"))
    c.setFont(FONT, 5)
    c.drawRightString(lx + lw - 8 * mm * s, ly + lh - band + 10 * mm * s, WEB)
    c.drawRightString(lx + lw - 8 * mm * s, ly + lh - band + 6 * mm * s, PHONE)

    # Body ruling, to show the text block
    c.setStrokeColor(HexColor("#EDF2F0"))
    c.setLineWidth(0.4)
    ty = ly + lh - band - 14 * mm * s
    for i in range(16):
        wfrac = 1.0 if i % 5 else 0.55
        c.line(lx + 18 * mm * s, ty, lx + 18 * mm * s + (lw - 36 * mm * s) * wfrac, ty)
        ty -= 5 * mm * s

    # Footer
    c.setStrokeColor(GOLD)
    c.setLineWidth(0.6)
    c.line(lx + 18 * mm * s, ly + 16 * mm * s, lx + lw - 18 * mm * s, ly + 16 * mm * s)
    c.setFillColor(GREY)
    c.setFont(FONT, 4.2)
    c.drawCentredString(lx + lw / 2, ly + 11 * mm * s, f"{LEGAL_NAME} · CUIN {CUIN} · {ADDRESS}")
    c.drawCentredString(lx + lw / 2, ly + 7 * mm * s, f"{EMAIL} · {WEB}")

    spec(c, lx, ly - 6 * mm, "A4 letterhead — 210 × 297 mm, shown at 42%")

    # DL envelope
    ex = M + lw + 14 * mm
    ew, eh = 220 * mm * s * 0.5, 110 * mm * s * 0.5
    ew, eh = 110 * mm * 0.62, 55 * mm * 0.62   # DL 220x110, shown smaller
    ey = y - eh
    c.setFillColor(CREAM)
    c.rect(ex, ey, ew, eh, fill=1, stroke=0)
    c.setStrokeColor(RULE)
    c.setLineWidth(0.5)
    c.rect(ex, ey, ew, eh, fill=0, stroke=1)
    logo(c, ex + 5 * mm, ey + eh - 5 * mm - 14 * mm, 14 * mm)
    c.setFillColor(GREY)
    c.setFont(FONT, 5)
    c.drawString(ex + 5 * mm, ey + 7 * mm, ADDRESS)
    c.drawString(ex + 5 * mm, ey + 4 * mm, f"{WEB} · {PHONE}")
    spec(c, ex, ey - 6 * mm, "DL envelope — 220 × 110 mm, shown at 62%")

    # Email signature, drawn at real proportions
    sy = ey - 22 * mm
    label(c, ex, sy, "Email signature")
    sy -= 6 * mm
    sw_, sh_ = ew, 26 * mm
    c.setFillColor(WHITE)
    c.rect(ex, sy - sh_, sw_, sh_, fill=1, stroke=0)
    c.setStrokeColor(RULE)
    c.rect(ex, sy - sh_, sw_, sh_, fill=0, stroke=1)
    logo(c, ex + 4 * mm, sy - sh_ + 6 * mm, 13 * mm)
    tx = ex + 21 * mm
    c.setFillColor(FOREST)
    c.setFont(FONT_B, 7)
    c.drawString(tx, sy - 8 * mm, CARD_NAME)
    c.setFillColor(GREY)
    c.setFont(FONT, 5.5)
    c.drawString(tx, sy - 12 * mm, CARD_TITLE)
    c.setStrokeColor(GOLD)
    c.setLineWidth(0.6)
    c.line(tx, sy - 14 * mm, tx + 20 * mm, sy - 14 * mm)
    c.setFillColor(INK)
    c.setFont(FONT, 5.5)
    c.drawString(tx, sy - 18 * mm, f"{PHONE} · {EMAIL}")
    c.drawString(tx, sy - 21.5 * mm, WEB)

    # Specs column under the letterhead
    ny = ly - 14 * mm
    label(c, M, ny, "For the printer")
    ny -= 14
    for k, v in [
        ("Letterhead", "A4, 210 × 297 mm. 100–120 gsm uncoated — it has to go through a printer and a fax."),
        ("Margins", "18 mm each side. Text block starts 40 mm from the top."),
        ("Envelope", "DL, 220 × 110 mm. Logo top-left, address bottom-left, right third kept clear for the stamp and the window."),
        ("Signature", "600 × 160 px at 2×. PNG on white — not a transparent background, which turns black in dark-mode mail clients."),
    ]:
        c.setFillColor(FOREST)
        c.setFont(FONT_B, 8.5)
        c.drawString(M, ny, k)
        c.setFillColor(INK)
        ny = body(c, M + 28 * mm, ny, v, w=lw + 6 * mm, size=8.5, leading=11.5) - 2
    c.showPage()


# ==========================================================================
# 8 — Brochure
# ==========================================================================
def page_brochure(c):
    page_header(c, 8, "Brochure", "A4 trifold — what a provider is handed at their shop")
    y = PH - M - 52

    # Outside: three panels across an A4 landscape, shown at 55%.
    s = 0.55
    total_w, total_h = 297 * mm * s, 210 * mm * s
    pw_ = total_w / 3
    bx, by = M, y - total_h

    for i in range(3):
        px = bx + i * pw_
        c.setFillColor(FOREST_NIGHT if i == 2 else WHITE)
        c.rect(px, by, pw_, total_h, fill=1, stroke=0)
        c.setStrokeColor(RULE)
        c.setLineWidth(0.4)
        c.rect(px, by, pw_, total_h, fill=0, stroke=1)

    # Panel 3 (rightmost) is the front cover when folded.
    fx = bx + 2 * pw_
    lw = pw_ * 0.5
    logo(c, fx + (pw_ - lw) / 2, by + total_h * 0.55, lw)
    c.setFillColor(WHITE)
    c.setFont(FONT_B, 11)
    c.drawCentredString(fx + pw_ / 2, by + total_h * 0.45, "Gilgit Baltistan,")
    c.drawCentredString(fx + pw_ / 2, by + total_h * 0.45 - 13, "booked in one place")
    c.setFillColor(GOLD)
    c.setFont(FONT, 6)
    c.drawCentredString(fx + pw_ / 2, by + total_h * 0.34, TAGLINE)
    c.setFillColor(HexColor("#8FC8BB"))
    c.setFont(FONT, 5.5)
    c.drawCentredString(fx + pw_ / 2, by + 10 * mm, WEB)

    # Panel 1 — back cover: contact
    c.setFillColor(FOREST)
    c.setFont(FONT_B, 8)
    c.drawString(bx + 8 * mm, by + total_h - 16 * mm, "Talk to us")
    c.setStrokeColor(GOLD)
    c.setLineWidth(0.6)
    c.line(bx + 8 * mm, by + total_h - 19 * mm, bx + 24 * mm, by + total_h - 19 * mm)
    c.setFillColor(INK)
    c.setFont(FONT, 6)
    cy = by + total_h - 26 * mm
    for line in [PHONE, EMAIL, WEB, ADDRESS]:
        c.drawString(bx + 8 * mm, cy, line)
        cy -= 4.5 * mm
    c.setFillColor(GREY)
    c.setFont(FONT, 4.5)
    c.drawString(bx + 8 * mm, by + 8 * mm, f"{LEGAL_NAME} · CUIN {CUIN}")

    # Panel 2 — the pitch
    mx_ = bx + pw_
    c.setFillColor(FOREST)
    c.setFont(FONT_B, 8)
    c.drawString(mx_ + 8 * mm, by + total_h - 16 * mm, "List your business")
    c.setStrokeColor(GOLD)
    c.line(mx_ + 8 * mm, by + total_h - 19 * mm, mx_ + 30 * mm, by + total_h - 19 * mm)
    ry = by + total_h - 27 * mm
    for line in [
        "Free to list",
        "Travellers contact you directly",
        "Rego takes no commission on your rate",
        "You confirm or decline every booking",
        "Written confirmation for both sides",
    ]:
        c.setFillColor(GOLD_DEEP)
        c.setFont(FONT_B, 6)
        c.drawString(mx_ + 8 * mm, ry, "—")
        c.setFillColor(INK)
        c.setFont(FONT, 6)
        c.drawString(mx_ + 12 * mm, ry, line)
        ry -= 6 * mm

    # Fold marks
    c.setStrokeColor(GOLD_DEEP)
    c.setLineWidth(0.4)
    c.setDash(2, 2)
    for i in (1, 2):
        fx2 = bx + i * pw_
        c.line(fx2, by - 3 * mm, fx2, by + total_h + 3 * mm)
    c.setDash()

    spec(c, bx, by - 8 * mm, "Outside — A4 landscape, trifold. Dashed lines are folds. Shown at 55%.")

    y = by - 18 * mm
    label(c, M, y, "For the printer")
    y -= 14
    for k, v in [
        ("Flat size", "297 × 210 mm (A4 landscape), folded to 99 × 210 mm"),
        ("Fold", "Roll fold. The panel that tucks inside is 2 mm narrower — ask the printer to allow for it."),
        ("Bleed", "3 mm all round. Keep text 8 mm clear of every fold."),
        ("Stock", "150–170 gsm silk. Heavier cracks along the fold."),
        ("Quantity", "Print few and often. Anything printed here has prices and a phone number in it, and both change."),
    ]:
        c.setFillColor(FOREST)
        c.setFont(FONT_B, 8.5)
        c.drawString(M, y, k)
        c.setFillColor(INK)
        y = body(c, M + 26 * mm, y, v, w=PW - M - (M + 26 * mm), size=8.5, leading=11.5) - 2

    y -= 6
    c.setFillColor(CREAM)
    c.roundRect(M, y - 24 * mm, PW - 2 * M, 24 * mm, 3 * mm, fill=1, stroke=0)
    c.setFillColor(FOREST)
    c.setFont(FONT_B, 9)
    c.drawString(M + 8 * mm, y - 9 * mm, "The claims on the inside panel")
    body(c, M + 8 * mm, y - 16 * mm,
         "Every line above is something Rego actually does today. Do not add numbers — provider counts, "
         "booking counts, ratings — to a printed brochure. They are wrong within a month and they are "
         "in somebody's hand for a year.",
         w=PW - 2 * M - 16 * mm, size=8.5, leading=11.5)
    c.showPage()


# ==========================================================================
# 9 — Merchandise: mug, T-shirt
# ==========================================================================
def draw_mug(c, x, y, w, h):
    """
    A mug from the side, with the print area marked.

    The handle is drawn as a filled ring clipped by the body rather than a
    stroked arc: the first attempt used arc() and produced a comma floating
    beside the mug, because an arc's endpoints do not have to touch anything.
    """
    body_w = w * 0.70
    cy = y + h * 0.46
    r_out, r_in = h * 0.28, h * 0.17
    hx = x + body_w

    # Handle: outer disc in the body colour, inner disc punched back to white.
    c.setFillColor(FOREST_NIGHT)
    c.circle(hx + r_out * 0.35, cy, r_out, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.circle(hx + r_out * 0.35, cy, r_in, fill=1, stroke=0)
    # Square off the side that meets the body, so it reads as attached.
    c.setFillColor(WHITE)
    c.rect(hx - r_out, cy - r_out - 1, r_out * 0.9, r_out * 2 + 2, fill=1, stroke=0)

    # Body last, so it sits over the handle root.
    c.setFillColor(FOREST_NIGHT)
    c.roundRect(x, y, body_w, h, 2 * mm, fill=1, stroke=0)

    # Rim highlight
    c.setStrokeColor(HexColor("#0E7A63"))
    c.setLineWidth(0.8)
    c.line(x + 1.5 * mm, y + h - 2 * mm, x + body_w - 1.5 * mm, y + h - 2 * mm)

    lw = body_w * 0.58
    logo(c, x + (body_w - lw) / 2, y + h * 0.40, lw)

    # Print area, clear of the artwork rather than through it.
    c.setStrokeColor(GOLD_DEEP)
    c.setLineWidth(0.4)
    c.setDash(2, 2)
    c.rect(x + body_w * 0.09, y + h * 0.28, body_w * 0.82, h * 0.55, fill=0, stroke=1)
    c.setDash()


def draw_tshirt(c, x, y, w, h):
    """Front view, sleeves sloped and the neckline cut out of the body."""
    c.setFillColor(FOREST_NIGHT)
    p = c.beginPath()
    p.moveTo(x + w * 0.30, y + h)            # left shoulder
    p.lineTo(x + w * 0.70, y + h)            # right shoulder
    p.lineTo(x + w, y + h * 0.78)            # right sleeve tip
    p.lineTo(x + w * 0.84, y + h * 0.60)
    p.lineTo(x + w * 0.84, y)
    p.lineTo(x + w * 0.16, y)
    p.lineTo(x + w * 0.16, y + h * 0.60)
    p.lineTo(x, y + h * 0.78)                # left sleeve tip
    p.close()
    c.drawPath(p, fill=1, stroke=0)

    # Neckline: a white shape cut into the top edge, not a floating arc.
    c.setFillColor(WHITE)
    n = c.beginPath()
    n.moveTo(x + w * 0.40, y + h)
    n.curveTo(x + w * 0.43, y + h * 0.90, x + w * 0.57, y + h * 0.90, x + w * 0.60, y + h)
    n.close()
    c.drawPath(n, fill=1, stroke=0)
    c.setStrokeColor(HexColor("#0E7A63"))
    c.setLineWidth(0.9)
    c.drawPath(n, fill=0, stroke=1)

    lw = w * 0.32
    logo(c, x + (w - lw) / 2, y + h * 0.46, lw)

    c.setStrokeColor(GOLD_DEEP)
    c.setLineWidth(0.4)
    c.setDash(2, 2)
    c.rect(x + w * 0.31, y + h * 0.42, w * 0.38, h * 0.26, fill=0, stroke=1)
    c.setDash()


def spec_rows(c, x, y, w, rows, gap=2):
    """A key/value block. Returns the y it ended at."""
    for k, v in rows:
        c.setFillColor(FOREST)
        c.setFont(FONT_B, 8.5)
        c.drawString(x, y, k)
        c.setFillColor(INK)
        y = body(c, x + 26 * mm, y, v, w=w - 26 * mm, size=8.5, leading=11.5) - gap
    return y



def combo_band(c, y, title, combos, note):
    """
    A strip of approved colour pairings.

    Worth its own band because the mark is light artwork: which background it
    goes on is the decision that most often gets made wrong, and a list of
    words does not settle it the way two swatches side by side do.
    """
    label(c, M, y, title)
    y -= 8 * mm
    bw = (PW - 2 * M - 3 * 6 * mm) / 4
    for i, (bg, fg_label, ok) in enumerate(combos):
        bx = M + i * (bw + 6 * mm)
        c.setFillColor(HexColor(bg))
        c.roundRect(bx, y - 22 * mm, bw, 22 * mm, 2 * mm, fill=1, stroke=0)
        if bg.upper() in ("#FDF8EC", "#FFFFFF"):
            c.setStrokeColor(RULE)
            c.setLineWidth(0.5)
            c.roundRect(bx, y - 22 * mm, bw, 22 * mm, 2 * mm, fill=0, stroke=1)
        lw = bw * 0.34
        logo(c, bx + (bw - lw) / 2, y - 16 * mm, lw, round_version=False)
        c.setFillColor(HexColor("#1E7A48") if ok else HexColor("#B3261E"))
        c.setFont(FONT_B, 8)
        c.drawCentredString(bx + bw / 2, y - 29 * mm, "✓" if ok else "×")
        c.setFillColor(GREY)
        c.setFont(FONT, 6.5)
        c.drawCentredString(bx + bw / 2, y - 34 * mm, fg_label)
    y -= 40 * mm
    c.setFillColor(GREY)
    c.setFont(FONT, 8)
    body(c, M, y, note, size=8, leading=11, color=GREY)
    return y


def page_merch_a(c):
    page_header(c, 9, "Mug & T-shirt", "Placement and print area, not a photograph")
    y = PH - M - 54

    # --- Mug row -----------------------------------------------------------
    mw, mh = 50 * mm, 46 * mm
    draw_mug(c, M, y - mh, mw, mh)
    dimension_line(c, M, y - mh - 6 * mm, M + mw * 0.70, y - mh - 6 * mm, "80 mm print width")
    spec(c, M, y - mh - 14 * mm, "11 oz mug — dashed line is the print area")

    sx = M + 62 * mm
    label(c, sx, y - 4, "Mug")
    spec_rows(c, sx, y - 18, PW - M - sx, [
        ("Type", "11 oz ceramic. Inner and handle in Forest Night, or plain white with the print only."),
        ("Print area", "200 × 85 mm full wrap, or 80 × 85 mm on one side"),
        ("Placement", "Logo centred, top of the mark 25 mm below the rim"),
        ("Method", "Sublimation on a coated mug. Screen print chips at the handle."),
        ("Careful", "On a dark mug the mountain outline disappears. Order one and look at it before ordering fifty."),
    ])

    y -= mh + 26 * mm

    # --- T-shirt row -------------------------------------------------------
    tw, th = 52 * mm, 56 * mm
    draw_tshirt(c, M, y - th, tw, th)
    dimension_line(c, M + tw * 0.31, y - th - 6 * mm, M + tw * 0.69, y - th - 6 * mm, "90 mm")
    spec(c, M, y - th - 14 * mm, "T-shirt, front")

    label(c, sx, y - 4, "T-shirt")
    spec_rows(c, sx, y - 18, PW - M - sx, [
        ("Colour", "Forest Night. Or off-white — but that needs the dark version of the mark, which does not exist yet."),
        ("Chest print", "90 mm wide, centred, top edge 70 mm below the collar seam"),
        ("Back", "Optional: the tagline across the shoulders at 160 mm, or nothing"),
        ("Method", "Screen print for fifty or more; DTF below that"),
        ("Careful", "The trekker and the mountain are hairlines. Below 70 mm wide they fill in and become a smudge."),
    ])

    combo_band(c, y - th - 26 * mm, "Which background the mark can go on",
        [("#002A21", "Forest Night", True),
         ("#006951", "Forest Green", True),
         ("#FDF8EC", "Cream", False),
         ("#FFFFFF", "White", False)],
        "The two on the right are not a style preference. The supplied mark is white line art — on a "
        "pale garment or mug it is invisible, and no amount of print quality fixes that. Until a dark "
        "version of the mark exists, order dark stock.")
    c.showPage()


def page_merch_b(c):
    page_header(c, 10, "Diary, pen & tote", "The three that stay with someone")
    y = PH - M - 54

    # --- Diary -------------------------------------------------------------
    dw, dh = 46 * mm, 65 * mm
    c.setFillColor(FOREST_NIGHT)
    c.roundRect(M, y - dh, dw, dh, 2 * mm, fill=1, stroke=0)
    c.setFillColor(HexColor("#001A14"))
    c.rect(M, y - dh, 3.5 * mm, dh, fill=1, stroke=0)
    c.setStrokeColor(GOLD)
    c.setLineWidth(1.2)
    c.line(M + dw - 7 * mm, y - dh, M + dw - 7 * mm, y)
    lw = dw * 0.48
    logo(c, M + 3.5 * mm + (dw - 3.5 * mm - 7 * mm - lw) / 2, y - dh * 0.58, lw)
    dimension_line(c, M, y - dh - 6 * mm, M + dw, y - dh - 6 * mm, "148 mm")
    dimension_line(c, M - 5 * mm, y - dh, M - 5 * mm, y, "210 mm")
    spec(c, M, y - dh - 14 * mm, "A5 hardcover diary")

    sx = M + 58 * mm
    label(c, sx, y - 4, "Diary")
    spec_rows(c, sx, y - 18, PW - M - sx, [
        ("Size", "A5, 148 × 210 mm, hardcover"),
        ("Cover", "Forest Night soft-touch laminate. Logo debossed, or foiled in gold."),
        ("Detail", "Gold elastic closure and gold ribbon marker. Nothing else."),
        ("Inside", "First page: the tagline and the contact block. Then plain ruled — no branding on every page."),
    ])

    y -= dh + 24 * mm

    # --- Pen ---------------------------------------------------------------
    pl, pth = 48 * mm, 5.5 * mm
    py = y - 10 * mm
    c.setFillColor(FOREST_NIGHT)
    c.roundRect(M + 5 * mm, py, pl * 0.76, pth, pth / 2, fill=1, stroke=0)
    c.setFillColor(GOLD)
    c.roundRect(M + 5 * mm + pl * 0.74, py, pl * 0.18, pth, pth / 2, fill=1, stroke=0)
    c.setFillColor(HexColor("#9AA5A1"))
    tp = c.beginPath()
    tp.moveTo(M + 5 * mm, py + pth)
    tp.lineTo(M, py + pth / 2)
    tp.lineTo(M + 5 * mm, py)
    tp.close()
    c.drawPath(tp, fill=1, stroke=0)
    c.setFillColor(GOLD)
    c.rect(M + 5 * mm + pl * 0.58, py + pth, 1.6 * mm, 8 * mm, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont(FONT_B, 4.5)
    c.drawString(M + 12 * mm, py + 2 * mm, "REGO")
    c.setFillColor(HexColor("#8FC8BB"))
    c.setFont(FONT, 3.4)
    c.drawString(M + 24 * mm, py + 2 * mm, WEB)
    dimension_line(c, M, py - 6 * mm, M + 5 * mm + pl * 0.92, py - 6 * mm, "140 mm")
    spec(c, M, py - 14 * mm, "Metal barrel pen")

    label(c, sx, y - 4, "Pen")
    spec_rows(c, sx, y - 18, PW - M - sx, [
        ("Type", "Metal barrel, 140 mm. Forest Night body, gold cap and clip."),
        ("Print", "'REGO' and www.rego.services along the barrel, 4 mm type, laser engraved"),
        ("Not", "Never the full logo. At 5 mm the mountain and the trekker are a smudge — the wordmark alone is the right call here."),
    ])

    y -= 38 * mm

    # --- Tote --------------------------------------------------------------
    tw, th = 42 * mm, 46 * mm
    ty = y - th
    c.setFillColor(FOREST_NIGHT)
    c.rect(M, ty, tw, th, fill=1, stroke=0)
    # Handles as filled loops rooted in the top edge. arc() endpoints float
    # free — that is how the first version produced two commas below the bag.
    for cx in (M + tw * 0.29, M + tw * 0.71):
        rr, ri = 8 * mm, 5.5 * mm
        c.setFillColor(HexColor("#001A14"))
        c.circle(cx, ty + th, rr, fill=1, stroke=0)
        c.setFillColor(WHITE)
        c.circle(cx, ty + th, ri, fill=1, stroke=0)
        c.setFillColor(WHITE)
        c.rect(cx - rr - 1, ty + th - rr - 1, rr * 2 + 2, rr + 1, fill=1, stroke=0)
    # Bag last, covering the handle roots.
    c.setFillColor(FOREST_NIGHT)
    c.rect(M, ty, tw, th, fill=1, stroke=0)
    lw2 = tw * 0.52
    logo(c, M + (tw - lw2) / 2, ty + th * 0.40, lw2, round_version=False)
    spec(c, M, ty - 6 * mm, "Cotton tote")

    label(c, sx, y - 4, "Tote")
    spec_rows(c, sx, y - 18, PW - M - sx, [
        ("Size", "380 × 420 mm, cotton"),
        ("Colour", "Forest Night, so the light mark reads. Natural cotton needs the dark version of the mark."),
        ("Print", "Mark alone, 150 mm wide, centred, 120 mm from the top hem"),
    ])

    y = ty - 22 * mm
    c.setFillColor(CREAM)
    c.roundRect(M, y - 34 * mm, PW - 2 * M, 34 * mm, 3 * mm, fill=1, stroke=0)
    c.setFillColor(FOREST)
    c.setFont(FONT_B, 9.5)
    c.drawString(M + 8 * mm, y - 10 * mm, "Before you order any of this")
    body(c, M + 8 * mm, y - 18 * mm,
         "Order one of each first and look at it in daylight. Every item on this page and the last is a "
         "minimum order of fifty or a hundred, and the two things that go wrong — the mark disappearing "
         "on a light surface, and the mountain filling in when printed small — are both obvious on a "
         "single sample and invisible on a screen.",
         w=PW - 2 * M - 16 * mm, size=8.5, leading=11.5)
    c.showPage()


# ==========================================================================
# 11 — Provider kit
# ==========================================================================
def draw_qr_placeholder(c, x, y, s):
    """A QR block, drawn as a placeholder — the real one is generated from a URL."""
    c.setFillColor(WHITE)
    c.rect(x, y, s, s, fill=1, stroke=0)
    c.setStrokeColor(INK)
    c.setLineWidth(0.4)
    c.rect(x, y, s, s, fill=0, stroke=1)
    # Three finder squares, so it reads as a QR without pretending to be one.
    fs = s * 0.26
    for fx, fy in [(x + s * 0.06, y + s * 0.68), (x + s * 0.68, y + s * 0.68), (x + s * 0.06, y + s * 0.06)]:
        c.setFillColor(INK)
        c.rect(fx, fy, fs, fs, fill=1, stroke=0)
        c.setFillColor(WHITE)
        c.rect(fx + fs * 0.22, fy + fs * 0.22, fs * 0.56, fs * 0.56, fill=1, stroke=0)
        c.setFillColor(INK)
        c.rect(fx + fs * 0.36, fy + fs * 0.36, fs * 0.28, fs * 0.28, fill=1, stroke=0)
    c.setFillColor(GREY)
    c.setFont(FONT, 4)
    c.drawCentredString(x + s / 2, y + s * 0.44, "QR placeholder")


def page_provider_kit(c):
    page_header(c, 11, "Provider kit", "What a hotel, jeep owner or guide gets given")
    y = PH - M - 50

    y = body(c, M, y,
        "These are the four items that do the most work. A traveller standing outside a guesthouse in "
        "Skardu has no way of knowing it is on Rego; a sticker in the window is how they find out, and "
        "how the provider gets something back for listing.",
        size=10)
    y -= 14

    # Window sticker
    sw_, sh_ = 46 * mm, 46 * mm
    c.setFillColor(FOREST_NIGHT)
    c.circle(M + sw_ / 2, y - sh_ / 2, sw_ / 2, fill=1, stroke=0)
    c.setStrokeColor(GOLD)
    c.setLineWidth(1)
    c.circle(M + sw_ / 2, y - sh_ / 2, sw_ / 2 - 1.6 * mm, fill=0, stroke=1)
    lw = sw_ * 0.46
    logo(c, M + (sw_ - lw) / 2, y - sh_ / 2 + 1 * mm, lw, round_version=False)
    c.setFillColor(WHITE)
    c.setFont(FONT_B, 6)
    c.drawCentredString(M + sw_ / 2, y - sh_ / 2 - 6 * mm, "LISTED ON REGO")
    c.setFillColor(GOLD)
    c.setFont(FONT, 4.5)
    c.drawCentredString(M + sw_ / 2, y - sh_ / 2 - 11 * mm, WEB)
    spec(c, M, y - sh_ - 6 * mm, "Window sticker — 100 mm circle")

    # QR standee
    qx = M + 60 * mm
    qw, qh = 42 * mm, 58 * mm
    c.setFillColor(WHITE)
    c.roundRect(qx, y - qh, qw, qh, 2 * mm, fill=1, stroke=0)
    c.setStrokeColor(RULE)
    c.setLineWidth(0.5)
    c.roundRect(qx, y - qh, qw, qh, 2 * mm, fill=0, stroke=1)
    band_h = 22 * mm
    c.setFillColor(FOREST_NIGHT)
    c.roundRect(qx, y - band_h, qw, band_h, 2 * mm, fill=1, stroke=0)
    c.rect(qx, y - band_h, qw, 4 * mm, fill=1, stroke=0)
    lw2 = qw * 0.40
    logo(c, qx + (qw - lw2) / 2, y - band_h + 4 * mm, lw2)
    draw_qr_placeholder(c, qx + (qw - 24 * mm) / 2, y - 46 * mm, 24 * mm)
    c.setFillColor(FOREST)
    c.setFont(FONT_B, 6)
    c.drawCentredString(qx + qw / 2, y - 51 * mm, "Scan to book")
    c.setFillColor(GREY)
    c.setFont(FONT, 4.5)
    c.drawCentredString(qx + qw / 2, y - 55 * mm, "rego.services/listings/…")
    spec(c, qx, y - qh - 6 * mm, "Counter standee — A6, 105 × 148 mm")

    # Lanyard + ID
    ix = M + 118 * mm
    iw, ih = 40 * mm, 58 * mm
    # Lanyard tape
    c.setFillColor(FOREST_NIGHT)
    c.rect(ix + iw / 2 - 3 * mm, y - 10 * mm, 6 * mm, 10 * mm, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.roundRect(ix, y - ih, iw, ih - 10 * mm, 2 * mm, fill=1, stroke=0)
    c.setStrokeColor(RULE)
    c.roundRect(ix, y - ih, iw, ih - 10 * mm, 2 * mm, fill=0, stroke=1)
    id_band = 20 * mm
    c.setFillColor(FOREST_NIGHT)
    c.roundRect(ix, y - 10 * mm - id_band, iw, id_band, 2 * mm, fill=1, stroke=0)
    c.rect(ix, y - 10 * mm - id_band, iw, 4 * mm, fill=1, stroke=0)
    lw3 = iw * 0.38
    logo(c, ix + (iw - lw3) / 2, y - 10 * mm - id_band + 3 * mm, lw3)
    c.setFillColor(FOREST)
    c.setFont(FONT_B, 6.5)
    c.drawCentredString(ix + iw / 2, y - 35 * mm, "[NAME]")
    c.setFillColor(GREY)
    c.setFont(FONT, 5)
    c.drawCentredString(ix + iw / 2, y - 39.5 * mm, "Verified Partner")
    draw_qr_placeholder(c, ix + (iw - 16 * mm) / 2, y - 54 * mm, 16 * mm)
    spec(c, ix, y - ih - 6 * mm, "Partner ID + lanyard — 54 × 86 mm")

    y -= max(sh_, qh, ih) + 20 * mm

    label(c, M, y, "For the supplier")
    y -= 14
    for k, v in [
        ("Window sticker", "100 mm circle, vinyl, printed to be read from OUTSIDE the glass. Say 'reverse print' when ordering, or it reads backwards."),
        ("Standee", "A6, 105 × 148 mm, 350 gsm with a folded easel back. Matt — a counter by a window turns gloss into a mirror."),
        ("Partner ID", "54 × 86 mm PVC, portrait, single-sided. Lanyard 900 mm, Forest Night, breakaway clip."),
        ("QR codes", "Generated per provider from their own listing URL. The blocks here are placeholders — a real QR is made from a real link, never drawn by hand."),
        ("Wording", "'Listed on Rego' on the sticker. 'Verified Partner' only on the ID of a provider who has actually been verified — the badge means something, and printing it for everyone empties it."),
    ]:
        c.setFillColor(FOREST)
        c.setFont(FONT_B, 8.5)
        c.drawString(M, y, k)
        c.setFillColor(INK)
        y = body(c, M + 30 * mm, y, v, w=PW - M - (M + 30 * mm), size=8.5, leading=11.5) - 1

    y -= 12
    c.setFillColor(FOREST)
    c.roundRect(M, y - 46 * mm, PW - 2 * M, 46 * mm, 3 * mm, fill=1, stroke=0)
    c.setFillColor(GOLD)
    c.setFont(FONT_B, 10)
    c.drawString(M + 8 * mm, y - 11 * mm, "Why this kit matters more than the mugs")
    body(c, M + 8 * mm, y - 19 * mm,
         "A mug is a gift. A sticker in a guesthouse window is distribution. It is the only item here "
         "that puts Rego in front of a traveller who has never heard of it, at the moment they are "
         "deciding where to stay — and it costs less than any of the merchandise on the previous two "
         "pages. If the budget only stretches to one thing, make it these.",
         w=PW - 2 * M - 16 * mm, size=9, leading=12.5, color=HexColor("#C2E0D9"))
    c.showPage()


# ==========================================================================
# 12 — Handover
# ==========================================================================
def page_handover(c):
    page_header(c, 12, "Handover", "What to send a printer, and what is still missing")
    y = PH - M - 50

    label(c, M, y, "Send with every job")
    y -= 16
    for k, v in [
        ("Logo files", "assets/logo-mark.png (the R mark) and presentation/rego-logo.png (the round lockup). Ask a designer for SVG or AI versions before the first large print run — PNG will not enlarge cleanly to a signboard."),
        ("Colours", "The hex and CMYK on page 4. Not a screenshot of this PDF."),
        ("Font", f"{FONT_NAME_SHOWN}, free from Google Fonts. Regular and Bold only."),
        ("Contact block", f"{PHONE} · {EMAIL} · {WEB} · {ADDRESS}"),
        ("Legal line", f"{LEGAL_NAME} · CUIN {CUIN}"),
    ]:
        c.setFillColor(FOREST)
        c.setFont(FONT_B, 8.5)
        c.drawString(M, y, k)
        c.setFillColor(INK)
        y = body(c, M + 28 * mm, y, v, w=PW - M - (M + 28 * mm), size=8.5, leading=11.5) - 2

    y -= 12
    c.setFillColor(HexColor("#FFF6E5"))
    c.roundRect(M, y - 56 * mm, PW - 2 * M, 56 * mm, 3 * mm, fill=1, stroke=0)
    c.setStrokeColor(GOLD)
    c.setLineWidth(0.6)
    c.roundRect(M, y - 56 * mm, PW - 2 * M, 56 * mm, 3 * mm, fill=0, stroke=1)
    c.setFillColor(HexColor("#8E661C"))
    c.setFont(FONT_B, 10)
    c.drawString(M + 8 * mm, y - 10 * mm, "Three things this book does not have")
    yy = y - 19 * mm
    for n, txt in enumerate([
        "A vector logo. Everything here uses the PNG files in the repository. That is fine for a card "
        "and a mug and wrong for a shopfront sign. Get the mark redrawn as vector once, by someone with "
        "the original artwork, before anything large is printed.",
        "Pantone numbers. Deliberately — see page 4.",
        "Photo-realistic mockups. These are working drawings. If you want images of the actual products, "
        "hand this file to a designer or a Canva template; every measurement they need is already here.",
    ], start=1):
        c.setFillColor(HexColor("#8E661C"))
        c.setFont(FONT_B, 8.5)
        c.drawString(M + 8 * mm, yy, f"{n}.")
        yy = body(c, M + 13 * mm, yy, txt, w=PW - 2 * M - 21 * mm, size=8.5, leading=11.5, color=INK) - 3

    y -= 68 * mm
    c.setFillColor(FOREST_NIGHT)
    c.roundRect(M, y - 30 * mm, PW - 2 * M, 30 * mm, 3 * mm, fill=1, stroke=0)
    lw = 20 * mm
    logo(c, M + 8 * mm, y - 24 * mm, lw)
    c.setFillColor(WHITE)
    c.setFont(FONT_B, 11)
    c.drawString(M + 34 * mm, y - 12 * mm, "REGO")
    c.setFillColor(GOLD)
    c.setFont(FONT, 8)
    c.drawString(M + 34 * mm, y - 18 * mm, TAGLINE)
    c.setFillColor(HexColor("#8FC8BB"))
    c.setFont(FONT, 7)
    c.drawString(M + 34 * mm, y - 25 * mm, f"{WEB} · {EMAIL} · {PHONE}")
    c.showPage()


# ==========================================================================
def main():
    c = canvas.Canvas(OUT, pagesize=A4)
    c.setTitle("REGO Brand Book")
    c.setAuthor(LEGAL_NAME)
    c.setSubject("Brand guidelines, stationery and merchandise specifications")

    page_cover(c)
    page_intro(c)
    page_logo(c)
    page_colour(c)
    page_type(c)
    page_card(c)
    page_letterhead(c)
    page_brochure(c)
    page_merch_a(c)
    page_merch_b(c)
    page_provider_kit(c)
    page_handover(c)

    c.save()
    print("wrote", OUT)


if __name__ == "__main__":
    main()
