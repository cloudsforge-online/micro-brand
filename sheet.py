#!/usr/bin/env python3
"""Build labelled contact sheets into review/, so a whole kind can be judged in one look.

`verify.py` measures what is measurable. Three things are not: whether a wordless mark has a
letter in it, whether a wordmark's lettering actually spells the product's name, and whether the
generated mark is recognisably the same IDEA as the hand-authored SVG it was derived from. Those
need eyes, and eyes are much better at them side by side — a set of eleven marks judged one at a
time is eleven separate judgements, each made against a memory of the last.

Sheets land in review/, which is gitignored: they are scaffolding for a judgement, not artefacts.

    python3 sheet.py             # every kind
    python3 sheet.py wordmark og # only these
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
MANIFEST = HERE / "MANIFEST.json"
REVIEW = HERE / "review"

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


def build(kind: str, assets: list[dict]) -> Path | None:
    chosen = [a for a in assets if a["kind"] == kind]
    # One tile per surface. Favicons ship at three sizes and the 512 is the one worth looking at;
    # the 32 is judged by whether it still reads, which is a separate sheet nobody needs.
    if kind == "favicon":
        chosen = [a for a in chosen if a["declaredSize"] == "512x512"]
    if not chosen:
        return None
    chosen.sort(key=lambda a: a["surface"])

    tile_width, columns = LAYOUT.get(kind, (360, 4))
    first = Image.open(HERE / chosen[0]["path"])
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
        with Image.open(HERE / asset["path"]) as image:
            sheet.paste(image.convert("RGB").resize((tile_width, tile_height), Image.LANCZOS), (x, y))
        draw.text(
            (x, y + tile_height + 6),
            f'{asset["surface"]}  {asset["accent"]}  {asset["deliveredSize"]}',
            fill=(190, 185, 175),
            font=typeface,
        )

    REVIEW.mkdir(exist_ok=True)
    out = REVIEW / f"sheet-{kind}.png"
    sheet.save(out, format="PNG")
    return out


def main(argv: list[str]) -> int:
    assets = json.loads(MANIFEST.read_text())["assets"]
    kinds = argv[1:] or ["mark", "favicon", "wordmark", "og", "social"]
    for kind in kinds:
        built = build(kind, assets)
        if built:
            print(f"{built.relative_to(HERE)}  {Image.open(built).size}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
