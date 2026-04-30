#!/usr/bin/env python3
"""Draw a polished `>_` terminal-prompt app icon using SF Mono.

Renders the actual `>` and `_` glyphs from Apple's SF Mono font, in the
brand orange on a pure white background. Supersamples 4x then downscales
for crisp anti-aliased edges.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent.parent / "Skiller" / "Resources" / "AppIcon-1024.png"
SIZE = 1024
SUPER = 4
S = SIZE * SUPER

BG = (255, 255, 255)
FG = (217, 119, 87)             # #D97757

FONT_PATH = "/System/Library/Fonts/Menlo.ttc"
FONT_INDEX = 1  # Menlo Bold


def main():
    img = Image.new("RGB", (S, S), BG)
    draw = ImageDraw.Draw(img)

    # Find a font size where `>_` fills ~55% of canvas width.
    target_w = S * 0.55
    text = ">_"
    size = int(S * 0.40)
    for _ in range(40):
        font = ImageFont.truetype(FONT_PATH, size, index=FONT_INDEX)
        bbox = draw.textbbox((0, 0), text, font=font)
        w = bbox[2] - bbox[0]
        if abs(w - target_w) < S * 0.005:
            break
        size = int(size * target_w / max(w, 1))

    font = ImageFont.truetype(FONT_PATH, size, index=FONT_INDEX)
    bbox = draw.textbbox((0, 0), text, font=font)
    w = bbox[2] - bbox[0]
    h = bbox[3] - bbox[1]
    x = (S - w) / 2 - bbox[0]
    y = (S - h) / 2 - bbox[1]
    draw.text((x, y), text, fill=FG, font=font)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    img = img.resize((SIZE, SIZE), Image.LANCZOS)
    img.save(OUT, "PNG", optimize=True)
    print(f"saved -> {OUT}  ({OUT.stat().st_size // 1024} KB)  font_size={size}")


if __name__ == "__main__":
    main()
