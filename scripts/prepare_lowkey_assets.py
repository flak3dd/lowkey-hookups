#!/usr/bin/env python3
"""Adapt the approved LOWKEY artwork; do not draw or replace its lettering."""
import argparse
import json
import shutil
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets" / "images"
BG = (16, 17, 19, 255)


def padded_crop(image, box, padding=24):
    left, top, right, bottom = box
    return image.crop((max(0, left - padding), max(0, top - padding),
                       min(image.width, right + padding), min(image.height, bottom + padding)))


def fit(image, size, fraction, background):
    canvas = Image.new("RGBA", (size, size), background)
    content = image.convert("RGBA").copy()
    content.thumbnail((round(size * fraction), round(size * fraction)), Image.Resampling.LANCZOS)
    canvas.alpha_composite(content, ((size - content.width) // 2, (size - content.height) // 2))
    return canvas


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--logo", type=Path, required=True)
    parser.add_argument("--mark", type=Path)
    args = parser.parse_args()
    ASSETS.mkdir(parents=True, exist_ok=True)
    destination = ASSETS / "lowkey-logo-master.png"
    if args.logo.resolve() != destination.resolve():
        shutil.copyfile(args.logo, destination)
    image = Image.open(args.logo).convert("RGB")
    # Locate visible artwork, discarding only empty dark padding, not any letters/symbol.
    bright = image.point(lambda value: 255 if value > 110 else 0).convert("RGB")
    channels = bright.split()
    from PIL import ImageChops
    visible = ImageChops.lighter(ImageChops.lighter(channels[0], channels[1]), channels[2])
    bounds = visible.getbbox()
    if not bounds:
        raise RuntimeError("Logo artwork was not found")
    wordmark = padded_crop(image, bounds)
    wordmark.save(ASSETS / "lowkey-wordmark.png", optimize=True)

    if args.mark is None:
        # An interim exact source crop lets Metro show the approved mark while the
        # isolated native-alpha version is prepared. No new graphic is drawn.
        red = Image.new("L", image.size)
        red.putdata([255 if r > 110 and r > g * 1.45 and r > b * 1.3 else 0
                     for r, g, b in image.getdata()])
        mark_bounds = red.getbbox()
        if not mark_bounds:
            raise RuntimeError("The approved lips symbol was not found")
        padded_crop(image, mark_bounds, padding=16).save(ASSETS / "lowkey-lips.png", optimize=True)
    else:
        mark = Image.open(args.mark).convert("RGBA")
        alpha = mark.getchannel("A")
        if alpha.getextrema()[0] != 0:
            raise RuntimeError("The generated lips master must have true alpha transparency")
        box = alpha.getbbox()
        if not box:
            raise RuntimeError("The lips master is empty")
        mark = padded_crop(mark, box, padding=4)
        mark.save(ASSETS / "lowkey-lips.png", optimize=True)
        fit(mark, 1024, .70, BG).convert("RGB").save(ASSETS / "icon.png", optimize=True)
        fit(mark, 64, .73, BG).convert("RGB").save(ASSETS / "favicon.png", optimize=True)
        fit(mark, 1024, .66, (0, 0, 0, 0)).save(ASSETS / "android-icon-foreground.png", optimize=True)
        Image.new("RGB", (1024, 1024), BG[:3]).save(ASSETS / "android-icon-background.png", optimize=True)
        mono = Image.new("RGBA", mark.size, (255, 255, 255, 255))
        mono.putalpha(mark.getchannel("A"))
        fit(mono, 1024, .66, (0, 0, 0, 0)).save(ASSETS / "android-icon-monochrome.png", optimize=True)
        fit(mark, 1024, .68, (0, 0, 0, 0)).save(ASSETS / "splash-icon.png", optimize=True)
        if (ASSETS / "icon.png").stat().st_size > 1_048_576:
            raise RuntimeError("Platform logo exceeds 1 MiB")

    print(json.dumps({"wordmark": list(wordmark.size), "native_assets_ready": args.mark is not None}))


if __name__ == "__main__":
    main()
