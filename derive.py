#!/usr/bin/env python3
"""Cut and resample the derivative assets, and report their provenance on stdout as JSON.

Two derivations, and both exist because of a fact about the backend rather than a preference:

  * **The OG card.** 1200x630 is a platform requirement — a scraper rejects anything else — and
    630 is not a multiple of 16, which is the granularity FLUX floors every delivered dimension
    to. So 1200x640 is asked for, delivered exactly, and cut down by 5 pixels top and bottom.
    Down, never up: a centre crop invents no pixel, whereas upscaling turns a crisp vector edge
    into a soft one.
  * **The favicons.** 192 and 32 are resampled from the 512 source with Lanczos.

Pillow, not macOS `sips`. design-system.md §7 item 3 names `sips` as the reason the estate's
post-processing stage exists on exactly one laptop, and "twelve game masters currently sit at
1024 against declared 512/256 because the refit has never been run". This runs anywhere Python
does.

**A derivative is re-encoded, so it loses the PNG's C2PA chunk.** The invisible Microsoft pixel
watermark survives both operations; the signed provenance box does not survive being rewritten by
a library that has never heard of it. That is why every source file is kept beside its derivative
and why `c2pa` below is MEASURED on the bytes written rather than inherited from the parent. A
derivative that claimed provenance it no longer carries would be worse than one that admits it.
"""

from __future__ import annotations

import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
ASSETS = HERE / "assets"
MANIFEST = HERE / "MANIFEST.json"

# The OG card: what the platform demands, and what had to be asked for to get there.
OG_DECLARED = (1200, 630)
OG_SOURCE = (1200, 640)
# Favicon sizes resampled from the 512 source.
FAVICON_STEPS = (192, 32)

C2PA_MARKER = b"c2pa"


def load_parents() -> dict[tuple[str, str], dict]:
    """Index the existing manifest by (surface, kind) so a derivative inherits its source's record.

    The prompt, the model, the accent and the licence belong to the generation, not to the cut, so
    a derivative must carry the same ones. Only the facts that the cut CHANGES — size, checksum,
    byte count, C2PA state — are recomputed.
    """
    if not MANIFEST.exists():
        return {}
    document = json.loads(MANIFEST.read_text())
    return {(a["surface"], a["kind"]): a for a in document.get("assets", [])}


def digest(path: Path) -> tuple[str, int, bool]:
    data = path.read_bytes()
    return hashlib.sha256(data).hexdigest(), len(data), C2PA_MARKER in data


def entry(parent: dict, *, kind: str, path: Path, declared: tuple[int, int], source: Path, note: str) -> dict:
    sha, size, c2pa = digest(path)
    delivered = Image.open(path).size
    return {
        "surface": parent["surface"],
        "surfaceName": parent["surfaceName"],
        "kind": kind,
        "path": str(path.relative_to(HERE)),
        "accent": parent["accent"],
        "declaredSize": f"{declared[0]}x{declared[1]}",
        "requestedSize": parent["requestedSize"],
        "deliveredSize": f"{delivered[0]}x{delivered[1]}",
        "sizing": "exact" if tuple(delivered) == declared else "unsized",
        "cropped": kind.startswith("og"),
        "derivedFrom": str(source.relative_to(HERE)),
        "backend": parent["backend"],
        "model": parent["model"],
        "prompt": parent["prompt"],
        "seed": parent["seed"],
        "sha256": sha,
        "byteSize": size,
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "c2pa": c2pa,
        "retries": parent["retries"],
        "licence": parent["licence"],
        "providerCostUnits": parent["providerCostUnits"],
        "providerOutputMegapixels": parent["providerOutputMegapixels"],
        "attempts": parent["attempts"],
        "note": note,
    }


def main() -> int:
    parents = load_parents()
    out: list[dict] = []

    for surface_dir in sorted(p for p in ASSETS.iterdir() if p.is_dir()):
        surface = surface_dir.name

        # ---- the OG card: centre-crop 1200x640 down to the 1200x630 a scraper will accept.
        og_source = surface_dir / f"og-{OG_SOURCE[0]}x{OG_SOURCE[1]}-asdelivered.png"
        parent = parents.get((surface, "og-source"))
        if og_source.exists() and parent:
            with Image.open(og_source) as image:
                width, height = image.size
                top = (height - OG_DECLARED[1]) // 2
                cropped = image.crop((0, top, width, top + OG_DECLARED[1]))
                target = surface_dir / f"og-{OG_DECLARED[0]}x{OG_DECLARED[1]}.png"
                cropped.save(target, format="PNG", optimize=True)
            out.append(
                entry(
                    parent,
                    kind="og",
                    path=target,
                    declared=OG_DECLARED,
                    source=og_source,
                    note=(
                        f"Centre-cropped from {OG_SOURCE[0]}x{OG_SOURCE[1]} by removing "
                        f"{(OG_SOURCE[1] - OG_DECLARED[1]) // 2} pixels from the top and bottom. "
                        "No pixel was invented and nothing was upscaled. Re-encoding drops the "
                        "C2PA chunk; the invisible pixel watermark is unaffected and the "
                        "as-delivered source is kept beside this file."
                    ),
                )
            )

        # ---- the favicons: 192 and 32 resampled from the 512 source.
        favicon = surface_dir / "favicon-512x512.png"
        parent = parents.get((surface, "favicon"))
        if favicon.exists() and parent:
            for step in FAVICON_STEPS:
                with Image.open(favicon) as image:
                    resized = image.convert("RGBA").resize((step, step), Image.LANCZOS)
                    target = surface_dir / f"favicon-{step}x{step}.png"
                    resized.save(target, format="PNG", optimize=True)
                out.append(
                    entry(
                        parent,
                        kind="favicon",
                        path=target,
                        declared=(step, step),
                        source=favicon,
                        note=(
                            f"Lanczos downscale of the 512 source to {step}. Pillow, not macOS "
                            "sips, so the step runs anywhere. Re-encoding drops the C2PA chunk; "
                            "the invisible pixel watermark is unaffected."
                        ),
                    )
                )

    json.dump(out, sys.stdout)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
