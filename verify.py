#!/usr/bin/env python3
"""Check every generated asset against the numbers it claims, and against the design system.

Looking at an image tells you whether the lettering is mangled and whether the idea is right. It
does not reliably tell you that a ground is #2b2b2d rather than #12100f, or that an accent has
drifted twenty degrees of hue — the eye adapts, and a set of eleven surfaces adapts it eleven
times. So the measurable things are measured here and the rest is done by looking.

Five checks per asset:

  1. **Dimensions.** The bytes must measure exactly what the manifest declares. This is the check
     the estate currently fails silently — design-system.md section 7 item 3, twelve game masters
     at 1024 against a declared 512.
  2. **Checksum.** The file on disk must be the file the manifest recorded. A manifest that has
     drifted from its artefacts is worse than no manifest.
  2a. **Disclosure.** The manifest's `c2pa` flag must be what the bytes actually say. Added after
     the check that was missing let 54 of the 93 entries ship claiming `c2pa: true` with no C2PA
     box in the file: `normalise_ground.py` rewrites the ground pixels, its PNG writer keeps no
     ancillary chunk, and the first version of its `refresh_manifest` re-recorded the checksum but
     not the disclosure. Nothing here was measuring the one field that had gone stale, so the
     verifier stayed green while the repository asserted provenance it no longer carried — the
     exact thing README.md section 4 says is worse than admitting the loss. This check is about
     TRUTH, not about presence: an asset is free to have no C2PA box, and every derivative
     legitimately does not. It may not say otherwise.
  3. **Ground.** Sampled from the four corners, which no composition puts a mark in. Must be dark:
     the system is dark-only and has no light mode. Reported as a hex and as a distance from
     #12100f, because "it came back taupe" was a real outcome on the first live image of this run.
  4. **Accent.** How much of the image is drawn in the registry accent, and whether any OTHER hue
     has taken the mark over. This is the check that would have caught asset-forge baking #ff4d00
     into every surface.

Hue rather than full colour distance, deliberately: a model renders a flat fill lighter or darker
than the hex it was given and that is a tolerable variation, whereas rendering it in a different
HUE means the mark is the wrong colour and the surface is unidentifiable in the switcher.

**Coverage rather than "the dominant colour", also deliberately, and this was learned the hard
way.** The first version of this check read the median hue of the most saturated tenth of the
pixels and compared that to the accent. It then failed all seven `worlds` assets at 50 to 66
degrees of drift — every one of which was correctly drawn in moss green. What it had actually
found was the single ember lit window and the bone ground line, both of which are MORE saturated
than moss and both of which design-system.md §5 explicitly puts there: "a ground line — the ash
ridge, in --cf-fg-mute" and, in mark-worlds.svg, "one lit window: someone is still here".

A check that fails the specification is a broken check, not a finding. So the question asked here
is the one that was always meant: is a substantial part of this image drawn in the surface's own
accent, and is there any third hue present that neither the accent nor the company ember explains.

No numpy. It is not installed and this is a few hundred thousand pixel samples, not a workload.

    python3 verify.py            # every asset
    python3 verify.py site hub   # only these surfaces
"""

from __future__ import annotations

import colorsys
import hashlib
import json
import sys
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
MANIFEST = HERE / "MANIFEST.json"

GROUND = "#12100f"
# The ground must be dark. #12100f is luma 0.005 and the marks come back around 0.02-0.04, so 0.12
# passes a near-black with room to spare and fails the mid-grey taupe field (about 0.23) that came
# back on the first live image, before the ground clause was pinned to the last paragraph.
MAX_GROUND_LUMA = 0.12
# Degrees of hue. A flat fill rendered lighter or darker is variation; a different hue is a bug.
# 30 rather than 25: FLUX renders every accent lighter than the hex it is given, and lightening a
# flat fill drags its hue a little as well. Measured across 44 images the honest drift sits at 1
# to 22 degrees, so 30 admits the real spread and still fails a mark drawn in the wrong colour.
MAX_HUE_DRIFT = 30.0
# Below this saturation a pixel is ground or ink, not accent, and its hue is noise. Bone
# (--cf-fg-mute, #b7ae9b) measures 0.16 here, so the ground line is excluded by construction.
MIN_ACCENT_SAT = 0.18

# The company ember. design-system.md §5 permits exactly one second element in a mark and §3 makes
# ember the company's own chrome, so ember appearing inside a product mark — the lit window in
# Forge Worlds, the spark in Forge Hub — is the specification, not a defect.
EMBER = "#e8622c"

# The share of the image that must be drawn in the surface's accent, per kind. A mark fills its
# square; an OG card is mostly deliberate emptiness ("the right two thirds left deliberately
# empty"), so the same floor there would fail a correct card.
MIN_ACCENT_COVERAGE = {"mark": 0.015, "favicon": 0.015}
MIN_ACCENT_COVERAGE_DEFAULT = 0.005


def hex_to_rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]


def rgb_to_hex(rgb: tuple[int, int, int]) -> str:
    return "#%02x%02x%02x" % rgb


def luma(rgb: tuple[int, int, int]) -> float:
    """Relative luminance, sRGB-linearised. The same transfer function WCAG contrast uses."""

    def channel(value: int) -> float:
        c = value / 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    r, g, b = (channel(v) for v in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def hue_degrees(rgb: tuple[int, int, int]) -> float:
    h, _, _ = colorsys.rgb_to_hls(*(v / 255 for v in rgb))
    return h * 360


def hue_gap(a: float, b: float) -> float:
    """Shortest way round the hue circle. 350 and 10 are twenty degrees apart, not three hundred."""
    gap = abs(a - b) % 360
    return min(gap, 360 - gap)


def median(values: list[float]) -> float:
    ordered = sorted(values)
    return ordered[len(ordered) // 2] if ordered else 0.0


def sample_ground(image: Image.Image) -> tuple[int, int, int]:
    """Median of four corner patches. A corner is where no composition in the plan puts a mark."""
    width, height = image.size
    patch = max(8, min(width, height) // 24)
    pixels = []
    for left, top in ((0, 0), (width - patch, 0), (0, height - patch), (width - patch, height - patch)):
        for y in range(top, top + patch):
            for x in range(left, left + patch):
                pixels.append(image.getpixel((x, y)))
    return (
        int(median([p[0] for p in pixels])),
        int(median([p[1] for p in pixels])),
        int(median([p[2] for p in pixels])),
    )


class AccentReading:
    """What the chromatic pixels of one image say about the colour it was drawn in."""

    def __init__(self, coverage: float, rendered: tuple[int, int, int] | None, stray: float, stray_hue: float):
        #: Share of the whole image drawn within tolerance of the registry accent.
        self.coverage = coverage
        #: The accent AS RENDERED — the median of those pixels. Always lighter than the hex given.
        self.rendered = rendered
        #: Share of the image in a chromatic hue that is neither the accent nor the company ember.
        self.stray = stray
        #: The median hue of that stray share, for the failure message.
        self.stray_hue = stray_hue


def read_accent(image: Image.Image, accent: str) -> AccentReading:
    """Measure accent coverage, and any third hue the design system does not account for.

    Sampled on a grid rather than exhaustively: a 1280x640 banner is 800k pixels and every sixth
    row and column is a 20,000-pixel sample, which is far more than a share needs and is
    instantaneous.
    """
    width, height = image.size
    step = max(1, min(width, height) // 200)
    accent_hue = hue_degrees(hex_to_rgb(accent))
    ember_hue = hue_degrees(hex_to_rgb(EMBER))

    total = 0
    matched: list[tuple[int, int, int]] = []
    stray: list[float] = []
    for y in range(0, height, step):
        for x in range(0, width, step):
            total += 1
            pixel = image.getpixel((x, y))[:3]
            _, lightness, saturation = colorsys.rgb_to_hls(*(v / 255 for v in pixel))
            # Near-white and near-black have a meaningless hue whatever their nominal saturation.
            if saturation < MIN_ACCENT_SAT or not 0.12 < lightness < 0.92:
                continue
            hue = hue_degrees(pixel)
            if hue_gap(hue, accent_hue) <= MAX_HUE_DRIFT:
                matched.append(pixel)
            elif hue_gap(hue, ember_hue) > MAX_HUE_DRIFT:
                # Neither the surface's accent nor the one second colour the family allows.
                stray.append(hue)

    rendered = (
        (
            int(median([p[0] for p in matched])),
            int(median([p[1] for p in matched])),
            int(median([p[2] for p in matched])),
        )
        if matched
        else None
    )
    return AccentReading(len(matched) / total, rendered, len(stray) / total, median(stray))


def main(argv: list[str]) -> int:
    document = json.loads(MANIFEST.read_text())
    wanted = set(argv[1:])
    ground_target = hex_to_rgb(GROUND)

    failures: list[str] = []
    rows: list[str] = []

    for asset in document["assets"]:
        if wanted and asset["surface"] not in wanted:
            continue
        path = HERE / asset["path"]
        problems: list[str] = []

        if not path.exists():
            failures.append(f'{asset["path"]}: missing')
            continue

        data = path.read_bytes()
        if hashlib.sha256(data).hexdigest() != asset["sha256"]:
            problems.append("checksum does not match the manifest")

        # The same marker generate.ts reads, and read the same way: off the bytes on disk.
        carries_c2pa = b"c2pa" in data
        if carries_c2pa != asset["c2pa"]:
            problems.append(
                f'manifest says c2pa={asset["c2pa"]} and the bytes say {carries_c2pa} — '
                "the disclosure must be measured, never inherited"
            )

        with Image.open(path) as raw:
            image = raw.convert("RGB")
            declared = tuple(int(n) for n in asset["declaredSize"].split("x"))
            if image.size != declared:
                problems.append(f'{image.size[0]}x{image.size[1]} against a declared {asset["declaredSize"]}')

            ground = sample_ground(image)
            ground_luma = luma(ground)
            if ground_luma > MAX_GROUND_LUMA:
                problems.append(f"ground {rgb_to_hex(ground)} is too light (luma {ground_luma:.3f})")

            reading = read_accent(image, asset["accent"])
            accent_hex = rgb_to_hex(reading.rendered) if reading.rendered else "-"
            floor = MIN_ACCENT_COVERAGE.get(asset["kind"], MIN_ACCENT_COVERAGE_DEFAULT)
            if reading.coverage < floor:
                problems.append(
                    f'only {reading.coverage * 100:.2f}% of the image is drawn in the registry '
                    f'accent {asset["accent"]} (floor {floor * 100:.1f}%)'
                )
            if reading.stray > reading.coverage and reading.stray > 0.01:
                problems.append(
                    f"a third hue at {reading.stray_hue:.0f} degrees covers {reading.stray * 100:.2f}% — "
                    f"more than the accent's {reading.coverage * 100:.2f}% — and neither the accent "
                    f"nor the company ember explains it"
                )

        mark = "FAIL" if problems else "ok  "
        rows.append(
            f'{mark} {asset["surface"]:<11} {asset["kind"]:<12} {asset["declaredSize"]:>9}  '
            f"ground {rgb_to_hex(ground)} luma {ground_luma:.3f}  "
            f"accent {accent_hex} {reading.coverage * 100:5.2f}%"
        )
        for problem in problems:
            rows.append(f"       -> {problem}")
            failures.append(f'{asset["path"]}: {problem}')

    print("\n".join(rows))
    print(
        f"\ntarget ground {GROUND} (luma {luma(ground_target):.3f}); "
        f"ceiling {MAX_GROUND_LUMA}, hue tolerance {MAX_HUE_DRIFT:.0f} degrees"
    )
    print(f"{len(failures)} failure(s)")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
