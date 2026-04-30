#!/usr/bin/env python3
import os
import sys
import urllib.request
from pathlib import Path

import fal_client

os.environ.setdefault(
    "FAL_KEY",
    "05178228-3c91-41fc-912a-9476ad632e68:e32f9471753b6cc9d721d7d00a33322f",
)

OUT = Path(__file__).resolve().parent.parent / "Skiller" / "Resources" / "AppIcon-1024.png"

PROMPT = (
    "Minimalist app icon. Solid burnt sienna terracotta orange background "
    "filling the entire square canvas edge to edge with no border and no "
    "margin. In the exact center a single bold thick four-pointed white "
    "sparkle star symbol with sharp clean vector edges, like the Anthropic "
    "Claude logo but white on orange, centered, occupying about 50 percent "
    "of the canvas. Pure flat vector logo design, no particles, no glow, no "
    "scatter dots, no rays, no extras around the symbol, no shadow, no "
    "gradient, no text. Just one clean geometric star shape on a perfectly "
    "uniform orange background."
)


def main():
    model = sys.argv[1] if len(sys.argv) > 1 else "recraft"
    if model == "recraft":
        print("[fal] submitting recraft v3 request...")
        handler = fal_client.submit(
            "fal-ai/recraft-v3",
            arguments={
                "prompt": PROMPT,
                "image_size": "square_hd",
                "style": "vector_illustration",
            },
        )
    elif model == "ideogram":
        print("[fal] submitting ideogram v2 request...")
        handler = fal_client.submit(
            "fal-ai/ideogram/v2",
            arguments={
                "prompt": PROMPT,
                "aspect_ratio": "1:1",
                "style": "design",
                "expand_prompt": False,
            },
        )
    else:
        print("[fal] submitting flux-pro request...")
        handler = fal_client.submit(
            "fal-ai/flux-pro/v1.1",
            arguments={
                "prompt": PROMPT,
                "image_size": {"width": 1024, "height": 1024},
                "num_inference_steps": 28,
                "num_images": 1,
                "enable_safety_checker": True,
                "output_format": "png",
            },
        )
    result = handler.get()
    url = result["images"][0]["url"]
    print(f"[fal] got image: {url}")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    urllib.request.urlretrieve(url, OUT)
    print(f"[fal] saved -> {OUT}")
    print(f"size: {OUT.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
