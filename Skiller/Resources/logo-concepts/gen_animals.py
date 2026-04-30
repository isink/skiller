"""Generate pixel-art animal icons on a 16x16 grid."""
from pathlib import Path

OUT = Path("/tmp/skiller-logo")
SIZE = 1024
GRID = 16
PIX = 56
OFF = (SIZE - GRID * PIX) // 2  # = 64
CORNER = 224
GAP = 0  # no gap for tighter pixel-art look

PALETTE = {
    '.': None,
    'O': '#FF8A3D',   # orange base
    'D': '#D4621C',   # dark orange (shadow / ear interior)
    'L': '#FFB374',   # light orange (highlight)
    'W': '#FFF6E8',   # cream
    'B': '#1A1A1A',   # black (eyes / nose)
    'P': '#FFA89B',   # pink (cheek / nose)
    'Y': '#F4C57A',   # tan
    'T': '#8C5A2E',   # tan dark
    'G': '#5B5B5B',   # gray
    'E': '#2A2A2A',   # darker than black for outline
}


def render(pixels, name, bg="#FFFFFF"):
    rects = []
    for row, line in enumerate(pixels):
        for col, ch in enumerate(line):
            color = PALETTE.get(ch)
            if color is None:
                continue
            x = OFF + col * PIX + GAP
            y = OFF + row * PIX + GAP
            w = PIX - GAP * 2
            rects.append(f'<rect x="{x}" y="{y}" width="{w}" height="{w}" fill="{color}"/>')
    body = "\n  ".join(rects)
    out = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SIZE} {SIZE}" shape-rendering="crispEdges">
  <rect width="{SIZE}" height="{SIZE}" rx="{CORNER}" fill="{bg}"/>
  {body}
</svg>
'''
    (OUT / name).write_text(out)


# ---------------- Fox (orange) ----------------
FOX = [
    "................",
    "................",
    "...OO......OO...",
    "..ODDO....ODDO..",
    "..ODDO....ODDO..",
    ".OOOOOOOOOOOOOO.",
    ".OLLOOOOOOOOLLO.",
    ".OLLBOOOOOOBLLO.",
    "OOLLBOOOOOOBLLOO",
    "OWWWWWWWWWWWWWWO",
    "OWWWWWWWWWWWWWWO",
    "OWWWWWWBBWWWWWWO",
    ".OWWWWWBBWWWWWO.",
    "..OWWWWWWWWWWO..",
    "...OWWWWWWWWO...",
    "....OOOOOOOO....",
]
render(FOX, "a1-fox.svg", bg="#FFF7F0")


# ---------------- Cat (orange tabby) ----------------
CAT = [
    "................",
    "................",
    "..OO........OO..",
    ".OOOO......OOOO.",
    ".ODDO......ODDO.",
    ".OOOOOOOOOOOOOO.",
    "OOOOOOOOOOOOOOOO",
    "OOOOBBOOOOBBOOOO",
    "OOOOBBOOOOBBOOOO",
    "OOOOOOOOOOOOOOOO",
    "OOOOOOPPPPOOOOOO",
    "OOOOOWWPPWWOOOOO",
    "OOOOWWWWWWWWOOOO",
    ".OOOOWWWWWWOOOO.",
    "..OOOOOOOOOOOO..",
    "....OOOOOOOO....",
]
render(CAT, "a2-cat.svg", bg="#FFFFFF")


# ---------------- Owl ----------------
OWL = [
    "................",
    "...TT......TT...",
    "..TYYT....TYYT..",
    ".TYYYTTTTTTYYYT.",
    ".TYYYYYYYYYYYYT.",
    "TYYYWWWYYWWWYYYT",
    "TYYWWBWYYWBWWYYT",
    "TYYWWBWYYWBWWYYT",
    "TYYYWWWOOWWWYYYT",
    "TYYYYYYOOYYYYYYT",
    "TYYYYYYYYYYYYYYT",
    "TYTYTYTYTYTYTYTT",
    "TYTYTYTYTYTYTYTT",
    ".TTTTTTTTTTTTTT.",
    "...TT......TT...",
    "................",
]
render(OWL, "a3-owl.svg", bg="#FFF7F0")


# ---------------- Shiba ----------------
SHIBA = [
    "................",
    "..YY........YY..",
    ".YYYY......YYYY.",
    ".YTTY......YTTY.",
    ".YYYYYYYYYYYYYY.",
    "YYYYYYYYYYYYYYYY",
    "YYWWYYYYYYYYWWYY",
    "YWWBWYYYYYYWBWWY",
    "YWWBWYYYYYYWBWWY",
    "YWWWWYYYYYYWWWWY",
    "YWWWWWWWWWWWWWWY",
    "YWWWWWBBBBWWWWWY",
    ".WWWWWBBBBWWWWW.",
    "..WWWWWWWWWWWW..",
    "...WWWWWWWWWW...",
    "....YYYYYYYY....",
]
render(SHIBA, "a4-shiba.svg", bg="#FFFFFF")

print("done")
