#!/usr/bin/env python3
"""Refine the hand-drawn `>_` icon via fal img2img.

Uploads the current PIL-drawn icon as reference, asks flux to render a
polished, premium app-icon version while keeping the same composition.
"""
import os
import sys
import urllib.request
from pathlib import Path

import fal_client

os.environ.setdefault(
    "FAL_KEY",
    "05178228-3c91-41fc-912a-9476ad632e68:e32f9471753b6cc9d721d7d00a33322f",
)

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "Skiller" / "Resources" / "AppIcon-1024.png"
OUT = ROOT / "Skiller" / "Resources" / "AppIcon-1024-refined.png"

PROMPT = (
    "Premium iOS app icon, square, pure white background filling entire "
    "canvas edge to edge with no border and no margin. Centered: a single "
    "bold geometric terminal prompt symbol consisting of a thick rounded "
    "right-pointing chevron `>` next to a short rounded horizontal "
    "underscore `_`, both rendered in the same warm terracotta orange color "
    "(#D97757). Clean monospace developer aesthetic, minimal flat vector "
    "design, smooth perfectly rounded line caps, balanced proportions, "
    "negative space, no text, no letters, no shadow, no gradient, no "
    "rounded corners on the canvas, no frame, no border. Apple App Store "
    "icon quality."
)


def main():
    model = sys.argv[1] if len(sys.argv) > 1 else "flux"
    print(f"[fal] uploading reference image: {SRC}")
    image_url = fal_client.upload_file(str(SRC))
    print(f"[fal] uploaded: {image_url}")

    if model == "recraft":
        print("[fal] submitting recraft v3 img2img...")
        handler = fal_client.submit(
            "fal-ai/recraft-v3/image-to-image",
            arguments={
                "prompt": PROMPT,
                "image_url": image_url,
                "strength": 0.55,
                "style": "digital_illustration",
            },
        )
    else:
        print("[fal] submitting flux-pro v1.1 redux (img2img)...")
        handler = fal_client.submit(
            "fal-ai/flux-pro/v1.1-ultra/redux",
            arguments={
                "prompt": PROMPT,
                "image_url": image_url,
                "image_size": {"width": 1024, "height": 1024},
                "num_inference_steps": 30,
                "num_images": 1,
                "output_format": "png",
            },
        )
    result = handler.get()
    url = result["images"][0]["url"]
    print(f"[fal] got image: {url}")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    urllib.request.urlretrieve(url, OUT)
    print(f"[fal] saved -> {OUT}  ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
