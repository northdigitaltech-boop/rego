#!/usr/bin/env python3
"""
REGO visiting card — print-ready.

WHAT "PRINT-READY" MEANS HERE
    Page size is 91 × 61 mm, not 85 × 55. The extra 3 mm on every
    side is bleed: the press cuts through a stack of cards and the
    blade wanders by a millimetre or so, so artwork has to run past
    where the cut is meant to be. A file supplied at exactly 85 × 55
    comes back with a white sliver down one edge.

    Crop marks sit outside the bleed. They tell the guillotine
    operator where 85 × 55 actually is.

THREE DIRECTIONS, NOT ONE
    Choosing a card is a taste decision and taste is not mine to
    make. Each one is the same information and the same brand — the
    difference is what carries the weight: the mark, the name, or
    the space.

ONE CONSTRAINT THAT SHAPED ALL THREE
    The supplied logo is light artwork with a hairline outline. On
    white it disappears. So every front here is dark, and the white
    back carries the wordmark set in type rather than the mark.
    That is not a style choice; it is what the asset allows.

Run:  python3 brand/build_visiting_card.py
"""

import os
from reportlab.lib.colors import HexColor
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from PIL import Image

FOREST = HexColor("#006951")
FOREST_DEEP = HexColor("#003F31")
FOREST_NIGHT = HexColor("#002A21")
GOLD = HexColor("#E5B94B")
GOLD_DEEP = HexColor("#B68421")
WHITE = HexColor("#FFFFFF")
INK = HexColor("#1A2320")
GREY = HexColor("#6B7C75")
MIST = HexColor("#C2E0D9")

NAME = "Muhammad Bashir"
TITLE = "Director"
PHONE = "+92 316 1290604"
EMAIL = "info@rego.services"
WEB = "www.rego.services"
ADDRESS = "Skardu, Gilgit Baltistan, Pakistan"
TAGLINE = "Book · Explore · Experience"
LEGAL = "REGO. (SMC-PRIVATE) LIMITED · CUIN 0345252"

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGO_ROUND = os.path.join(ROOT, "presentation", "rego-logo.png")
LOGO_MARK = os.path.join(ROOT, "assets", "logo-mark.png")

TRIM_W, TRIM_H = 85 * mm, 55 * mm
BLEED = 3 * mm
PAGE_W, PAGE_H = TRIM_W + 2 * BLEED, TRIM_H + 2 * BLEED

FONT = "Helvetica"
FONT_B = "Helvetica-Bold"


def img(c, path, x, y, w):
    iw, ih = Image.open(path).size
    h = w * ih / iw
    c.drawImage(path, x, y, width=w, height=h, mask="auto")
    return h


def crop_marks(c):
    """Outside the bleed, so they are cut away with it."""
    c.setStrokeColor(HexColor("#000000"))
    c.setLineWidth(0.25)
    L = 2.5 * mm
    gap = 1 * mm
    for x in (BLEED, BLEED + TRIM_W):
        for y in (BLEED, BLEED + TRIM_H):
            # horizontal arms
            if x == BLEED:
                c.line(x - gap - L, y, x - gap, y)
            else:
                c.line(x + gap, y, x + gap + L, y)
            # vertical arms
            if y == BLEED:
                c.line(x, y - gap - L, x, y - gap)
            else:
                c.line(x, y + gap, x, y + gap + L)


# --------------------------------------------------------------------------
# The three fronts. Coordinates are relative to the trim box, so each design
# is written as though the card were 85 × 55 and BLEED does the rest.
# --------------------------------------------------------------------------

def lockup(c, x, y, mark_w, name_size, tagline=True, on_dark=True):
    """
    Mark + wordmark, built here rather than using the round logo file.

    THE ROUND LOCKUP CANNOT GO ON A COLOURED CARD
        presentation/rego-logo.png carries its own background — a disc of
        #011F11, which is not a brand colour, it is whatever that file
        happens to be. Placed on Forest Night it leaves a visible ring where
        the two greens disagree, and on press that ring is more obvious than
        on screen. The badge is for avatars and app icons, where it sits on
        something it does not have to match.

        So the card uses the transparent mark and sets REGO in type beside
        it. Returns the width it occupied.
    """
    ih = img(c, LOGO_MARK, x, y, mark_w)
    tx = x + mark_w + 3.2 * mm
    c.setFillColor(WHITE if on_dark else FOREST)
    c.setFont(FONT_B, name_size)
    c.drawString(tx, y + ih * 0.42, "REGO")
    w = tx + c.stringWidth("REGO", FONT_B, name_size) - x
    if tagline:
        c.setFillColor(GOLD if on_dark else GOLD_DEEP)
        c.setFont(FONT, name_size * 0.30)
        c.drawString(tx, y + ih * 0.42 - name_size * 0.52, TAGLINE)
        w = max(w, tx + c.stringWidth(TAGLINE, FONT, name_size * 0.30) - x)
    return w


def front_a(c):
    """
    A — The quiet one.

    Almost all space. The mark sits small in the top-left and the name sits on
    the baseline, with one gold hairline between them doing the only work. It
    reads as expensive because nothing is competing.
    """
    c.setFillColor(FOREST_NIGHT)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)

    ox, oy = BLEED, BLEED
    pad = 9 * mm

    lockup(c, ox + pad, oy + TRIM_H - pad - 13 * mm, 13 * mm, 15)

    c.setStrokeColor(GOLD)
    c.setLineWidth(0.7)
    c.line(ox + pad, oy + 20 * mm, ox + pad + 13 * mm, oy + 20 * mm)

    c.setFillColor(WHITE)
    c.setFont(FONT_B, 10.5)
    c.drawString(ox + pad, oy + 13 * mm, NAME)
    c.setFillColor(GOLD)
    c.setFont(FONT, 7)
    c.drawString(ox + pad, oy + 9 * mm, TITLE)

    c.setFillColor(MIST)
    c.setFont(FONT, 6.2)
    c.drawRightString(ox + TRIM_W - pad, oy + 13 * mm, PHONE)
    c.drawRightString(ox + TRIM_W - pad, oy + 9.5 * mm, EMAIL)
    c.drawRightString(ox + TRIM_W - pad, oy + 6 * mm, WEB)


def front_b(c):
    """
    B — The mark, large.

    The R monogram scaled up and cropped by the edge of the card, so it reads
    as a texture rather than a logo. The round lockup would fight this, so the
    mark alone is used and the wordmark is set in type.
    """
    c.setFillColor(FOREST_NIGHT)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)

    ox, oy = BLEED, BLEED
    pad = 9 * mm

    # Oversized mark, low opacity, running off the right edge.
    c.saveState()
    c.setFillAlpha(0.16)
    img(c, LOGO_MARK, ox + TRIM_W - 34 * mm, oy - 4 * mm, 54 * mm)
    c.restoreState()

    lockup(c, ox + pad, oy + TRIM_H - pad - 12 * mm, 12 * mm, 14)

    c.setStrokeColor(GOLD)
    c.setLineWidth(0.7)
    c.line(ox + pad, oy + 22 * mm, ox + pad + 13 * mm, oy + 22 * mm)

    c.setFillColor(WHITE)
    c.setFont(FONT_B, 10)
    c.drawString(ox + pad, oy + 15 * mm, NAME)
    c.setFillColor(MIST)
    c.setFont(FONT, 6.5)
    c.drawString(ox + pad, oy + 11 * mm, TITLE)

    c.setFillColor(MIST)
    c.setFont(FONT, 6.2)
    c.drawString(ox + pad, oy + 6 * mm, f"{PHONE}  ·  {EMAIL}")


def front_c(c):
    """
    C — The band.

    A gold band across the foot, which is the only design here with a second
    colour doing structural work. More assertive; reads well in a stack of
    cards where the other two would look like everyone else's dark card.
    """
    c.setFillColor(FOREST_NIGHT)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)

    ox, oy = BLEED, BLEED
    pad = 9 * mm

    # Band runs into the bleed on both sides, or it shows a white edge.
    band_h = 13 * mm
    c.setFillColor(GOLD)
    c.rect(0, 0, PAGE_W, BLEED + band_h, fill=1, stroke=0)

    # No tagline in the lockup here — it is already on the gold band, and
    # printing it twice on one card reads as an oversight.
    lockup(c, ox + pad, oy + TRIM_H - pad - 12 * mm, 12 * mm, 15, tagline=False)

    # Everything readable stays ABOVE the band. The first version put the
    # phone and email at 13 and 9 mm from the trim edge, which is inside a
    # 13 mm band — mist-green type on gold, invisible.
    text_floor = band_h + 4 * mm

    c.setFillColor(WHITE)
    c.setFont(FONT_B, 10.5)
    c.drawRightString(ox + TRIM_W - pad, oy + text_floor + 11 * mm, NAME)
    c.setFillColor(GOLD)
    c.setFont(FONT, 6.8)
    c.drawRightString(ox + TRIM_W - pad, oy + text_floor + 7.5 * mm, TITLE)

    c.setFillColor(MIST)
    c.setFont(FONT, 6.2)
    c.drawRightString(ox + TRIM_W - pad, oy + text_floor + 2 * mm, f"{PHONE}  ·  {EMAIL}")

    # On the band, dark ink. White would be unreadable on #E5B94B.
    c.setFillColor(HexColor("#3F2E10"))
    c.setFont(FONT_B, 7)
    c.drawString(ox + pad, oy + 5.5 * mm, WEB)
    c.setFont(FONT, 5.6)
    c.drawRightString(ox + TRIM_W - pad, oy + 5.5 * mm, TAGLINE)


def back_dark(c):
    """The back that pairs with A and B — white, so the pair is not two dark faces."""
    c.setFillColor(WHITE)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)

    ox, oy = BLEED, BLEED
    pad = 9 * mm

    c.setFillColor(FOREST)
    c.setFont(FONT_B, 13)
    c.drawString(ox + pad, oy + TRIM_H - pad - 5 * mm, "REGO")
    c.setFillColor(GOLD_DEEP)
    c.setFont(FONT, 5.6)
    c.drawString(ox + pad, oy + TRIM_H - pad - 10 * mm, TAGLINE)

    c.setStrokeColor(GOLD)
    c.setLineWidth(0.7)
    c.line(ox + pad, oy + TRIM_H - pad - 13 * mm, ox + pad + 13 * mm, oy + TRIM_H - pad - 13 * mm)

    c.setFillColor(INK)
    c.setFont(FONT, 6.5)
    ly = oy + TRIM_H - pad - 20 * mm
    for line in [PHONE, EMAIL, WEB, ADDRESS]:
        c.drawString(ox + pad, ly, line)
        ly -= 4.2 * mm

    c.setFillColor(GREY)
    c.setFont(FONT, 4.6)
    c.drawString(ox + pad, oy + 5.5 * mm, LEGAL)


def back_forest(c):
    """The back that pairs with C — Forest Green, so the gold band has a partner."""
    c.setFillColor(FOREST)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)

    ox, oy = BLEED, BLEED
    pad = 9 * mm

    # Centred by measuring the lockup first, then drawing it in place.
    probe_w = 15 * mm + 3.2 * mm + c.stringWidth("REGO", FONT_B, 17)
    lockup(c, ox + (TRIM_W - probe_w) / 2, oy + TRIM_H - 26 * mm, 15 * mm, 17)

    c.setFillColor(WHITE)
    c.setFont(FONT, 6.5)
    ly = oy + 22 * mm
    for line in [PHONE, EMAIL, WEB]:
        c.drawCentredString(ox + TRIM_W / 2, ly, line)
        ly -= 4.4 * mm

    c.setStrokeColor(GOLD)
    c.setLineWidth(0.7)
    c.line(ox + TRIM_W / 2 - 8 * mm, oy + 9.5 * mm, ox + TRIM_W / 2 + 8 * mm, oy + 9.5 * mm)

    c.setFillColor(MIST)
    c.setFont(FONT, 4.6)
    c.drawCentredString(ox + TRIM_W / 2, oy + 5.5 * mm, LEGAL)


# --------------------------------------------------------------------------
DESIGNS = [
    ("A", "Quiet", front_a, back_dark),
    ("B", "Monogram", front_b, back_dark),
    ("C", "Gold band", front_c, back_forest),
]


def build_one(letter, front, back):
    """One PDF per design: front page, back page, crop marks on both."""
    path = os.path.join(ROOT, "brand", f"REGO-Visiting-Card-{letter}.pdf")
    c = canvas.Canvas(path, pagesize=(PAGE_W, PAGE_H))
    c.setTitle(f"REGO visiting card {letter} — print ready")
    for draw in (front, back):
        draw(c)
        crop_marks(c)
        c.showPage()
    c.save()
    return path


def main():
    made = []
    for letter, _name, front, back in DESIGNS:
        made.append(build_one(letter, front, back))
    for p in made:
        print("wrote", p)


if __name__ == "__main__":
    main()
