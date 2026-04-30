"""Generate pixel-art-style minimalist logo SVGs on an 8x8 grid."""
from pathlib import Path

OUT = Path("/tmp/skiller-logo")
SIZE = 1024
GRID = 8
PIX = 112              # logical pixel size
OFF = (SIZE - GRID * PIX) // 2  # = 64
CORNER = 224
GAP = 4                # subtle pixel gap so blocks read as discrete pixels


def svg(bg, fg, pixels, name, fg_alt=None, alt_pixels=None):
    rects = []
    for row, line in enumerate(pixels):
        for col, ch in enumerate(line):
            if ch == "X":
                x = OFF + col * PIX + GAP
                y = OFF + row * PIX + GAP
                w = PIX - GAP * 2
                rects.append(f'<rect x="{x}" y="{y}" width="{w}" height="{w}" fill="{fg}"/>')
            elif ch == "O" and fg_alt:
                x = OFF + col * PIX + GAP
                y = OFF + row * PIX + GAP
                w = PIX - GAP * 2
                rects.append(f'<rect x="{x}" y="{y}" width="{w}" height="{w}" fill="{fg_alt}"/>')
    body = "\n  ".join(rects)
    out = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SIZE} {SIZE}">
  <rect width="{SIZE}" height="{SIZE}" rx="{CORNER}" fill="{bg}"/>
  {body}
</svg>
'''
    (OUT / name).write_text(out)


# 1. Pixel S
S = [
    "........",
    ".XXXXXX.",
    ".XX.....",
    ".XXXXXX.",
    "......XX",
    "......XX",
    ".XXXXXX.",
    "........",
]
svg("#FFFFFF", "#FF7A33", S, "p1-pixel-s.svg")

# 2. Pixel staircase / level up (each step lighter to darker)
STAIR = [
    "........",
    "......XX",
    "......XX",
    "....XX..",
    "....XX..",
    "..XX....",
    "..XX....",
    "........",
]
svg("#FFFFFF", "#FF7A33", STAIR, "p2-stair.svg")

# 3. Pixel arrow up (chunky)
ARROW = [
    "...XX...",
    "..XXXX..",
    ".XXXXXX.",
    "XXXXXXXX",
    "...XX...",
    "...XX...",
    "...XX...",
    "...XX...",
]
svg("#FF7A33", "#FFFFFF", ARROW, "p3-arrow.svg")

# 4. Pixel spark / 4-point star
SPARK = [
    "...XX...",
    "...XX...",
    "..XXXX..",
    "XXXXXXXX",
    "XXXXXXXX",
    "..XXXX..",
    "...XX...",
    "...XX...",
]
svg("#0E0E10", "#FF7A33", SPARK, "p4-spark.svg")

# 5. Pixel heart-mountain (skill peak, two-tone)
PEAK = [
    "........",
    "...XX...",
    "..XXXX..",
    "..XOOX..",
    ".XXOOXX.",
    ".XOOOOX.",
    "XXOOOOXX",
    "XOOOOOOX",
]
svg("#FFF7F1", "#FF7A33", PEAK, "p5-peak.svg", fg_alt="#FFB37A", alt_pixels=True)

print("done")
