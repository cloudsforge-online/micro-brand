#!/usr/bin/env python3
"""Build labelled contact sheets into review/, so a whole kind can be judged in one look.

`verify.py` measures what is measurable. Three things are not: whether a wordless mark has a
letter in it, whether a wordmark's lettering actually spells the product's name, and whether the
generated mark is recognisably the same IDEA as the hand-authored SVG it was derived from. Those
need eyes, and eyes are much better at them side by side — a set of eleven marks judged one at a
time is eleven separate judgements, each made against a memory of the last.

Sheets land in review/<provider>/, which is gitignored: they are scaffolding for a judgement, not
artefacts. One provider per sheet — for the same asset seen across all three models at once, which
is a different question, use compare.py.

    python3 sheet.py                                  # every kind, every set present
    python3 sheet.py wordmark og                      # only these kinds
    python3 sheet.py --provider qwen-image-2512       # only this set
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

import providers

HERE = Path(__file__).resolve().parent

# Tile width per kind, and how many across. Wide kinds get fewer columns so lettering stays
# legible at review size — a wordmark shrunk to a thumbnail cannot be checked for a mangled
# letter, which is the single thing wordmark review exists to catch.
LAYOUT = {
    "mark": (360, 4),
    "favicon": (300, 4),
    "wordmark": (760, 2),
    "og": (760, 2),
    "og-source": (760, 2),
    "social": (760, 2),
}

PAD = 16
LABEL = 30
BACKDROP = (24, 24, 26)


def font() -> ImageFont.ImageFont:
    try:
        return ImageFont.load_default(size=20)
    except TypeError:  # Pillow older than 9.2 has no size argument on the default font.
        return ImageFont.load_default()


def build(provider: providers.Provider, kind: str, assets: list[dict]) -> Path | None:
    chosen = [a for a in assets if a["kind"] == kind]
    # One tile per surface. Favicons ship at three sizes and the 512 is the one worth looking at;
    # the 32 is judged by whether it still reads, which is a separate sheet nobody needs.
    if kind == "favicon":
        chosen = [a for a in chosen if a["declaredSize"] == "512x512"]
    if not chosen:
        return None
    chosen.sort(key=lambda a: a["surface"])

    tile_width, columns = LAYOUT.get(kind, (360, 4))
    first = Image.open(provider.root / chosen[0]["path"])
    tile_height = round(tile_width * first.size[1] / first.size[0])
    first.close()

    rows = (len(chosen) + columns - 1) // columns
    sheet = Image.new(
        "RGB",
        (
            columns * tile_width + (columns + 1) * PAD,
            rows * (tile_height + LABEL) + (rows + 1) * PAD,
        ),
        BACKDROP,
    )
    draw = ImageDraw.Draw(sheet)
    typeface = font()

    for index, asset in enumerate(chosen):
        column, row = index % columns, index // columns
        x = PAD + column * (tile_width + PAD)
        y = PAD + row * (tile_height + LABEL + PAD)
        with Image.open(provider.root / asset["path"]) as image:
            sheet.paste(image.convert("RGB").resize((tile_width, tile_height), Image.LANCZOS), (x, y))
        draw.text(
            (x, y + tile_height + 6),
            f'{asset["surface"]}  {asset["accent"]}  {asset["deliveredSize"]}',
            fill=(190, 185, 175),
            font=typeface,
        )

    review = HERE / "review" / provider.id
    review.mkdir(parents=True, exist_ok=True)
    out = review / f"sheet-{kind}.png"
    sheet.save(out, format="PNG")
    return out


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Contact sheets, one set at a time.")
    providers.add_argument(parser)
    parser.add_argument("kinds", nargs="*", help="only these kinds")
    args = parser.parse_args(argv[1:])

    kinds = args.kinds or ["mark", "favicon", "wordmark", "og", "social"]
    for provider in providers.selected(args):
        assets = json.loads(provider.manifest.read_text())["assets"]
        for kind in kinds:
            built = build(provider, kind, assets)
            if built:
                print(f"{built.relative_to(HERE)}  {Image.open(built).size}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
