"""Refine owl pixel icon — v2 with depth, eye highlights, softer body."""
from pathlib import Path

OUT = Path("/tmp/skiller-logo")
SIZE = 1024
GRID = 16
PIX = 56
OFF = (SIZE - GRID * PIX) // 2
CORNER = 224

PALETTE = {
    '.': None,
    'D': '#6B4520',   # dark brown outline
    'T': '#8C5A2E',   # mid brown
    'Y': '#F4C57A',   # body tan base
    'L': '#FFD89E',   # body highlight (chest)
    'W': '#FFF6E8',   # eye cream
    'H': '#FFFFFF',   # eye highlight (life)
    'B': '#1A1A1A',   # pupil
    'O': '#FF8A3D',   # beak / feet (brand orange)
    'C': '#D4621C',   # beak shadow
}

def render(pixels, name, bg="#FFF7F0"):
    rects = []
    for row, line in enumerate(pixels):
        for col, ch in enumerate(line):
            color = PALETTE.get(ch)
            if color is None:
                continue
            x = OFF + col * PIX
            y = OFF + row * PIX
            rects.append(f'<rect x="{x}" y="{y}" width="{PIX}" height="{PIX}" fill="{color}"/>')
    body = "\n  ".join(rects)
    out = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SIZE} {SIZE}" shape-rendering="crispEdges">
  <rect width="{SIZE}" height="{SIZE}" rx="{CORNER}" fill="{bg}"/>
  {body}
</svg>
'''
    (OUT / name).write_text(out)


# Refined owl - bigger eyes with highlights, softer body, feet
OWL_V2 = [
    "................",
    "...DD......DD...",
    "..DTTD....DTTD..",
    ".DTYYTDDDDTYYTD.",
    "DTYYYYYYYYYYYYTD",
    "DTWWWWYYYYWWWWTD",
    "TWHBBWYYYYWBBHWT",
    "TWWBBWYYYYWBBWWT",
    "DTWWWWYOOYWWWWTD",
    "DTYYYYOCCOYYYYTD",
    "DTYYLLLLLLLLYYTD",
    "DTYLLLLLLLLLLYTD",
    ".DTYLLLLLLLLYTD.",
    "..DTTYYYYYYTTD..",
    "...DDDTTTTDDD...",
    "...OO......OO...",
]
render(OWL_V2, "a3-owl-v2.svg")


# Variant: cuter sleepy/winking owl
OWL_SLEEPY = [
    "................",
    "...DD......DD...",
    "..DTTD....DTTD..",
    ".DTYYTDDDDTYYTD.",
    "DTYYYYYYYYYYYYTD",
    "DTWWWWYYYYWWWWTD",
    "TWWWWWYYYYWWWWWT",
    "TWBBBWYYYYWBBBWT",   # closed eye lines
    "DTWWWWYOOYWWWWTD",
    "DTYYYYOCCOYYYYTD",
    "DTYYLLLLLLLLYYTD",
    "DTYLLLLLLLLLLYTD",
    ".DTYLLLLLLLLYTD.",
    "..DTTYYYYYYTTD..",
    "...DDDTTTTDDD...",
    "...OO......OO...",
]
render(OWL_SLEEPY, "a3-owl-sleepy.svg")

print("done")
