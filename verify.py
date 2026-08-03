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

## Three sets, not one

Every check below runs per PROVIDER. `--provider` selects one; the default is every set that
exists on disk, which today is the reference set alone and tomorrow is three. A candidate set is
expected to be red while it is being worked on, and that must not be able to turn the shipped
reference set red with it, which is why each set has its own manifest and its own pass or fail line.

Two checks are ABOUT the set of sets rather than about any one image, and both run last:

  5. **assetCount.** The manifest's own count must equal the number of entries it carries. Trivial,
     and it was wrong in two of the estate's three asset repositories when this was written — 93
     against 94 here, 134 against 137 in emberkin-assets — because the count is written by the
     generator and the last few entries were added by a later tool that did not update it. A
     manifest whose own summary disagrees with its own body is a manifest nobody can quote.
  6. **PROMPT PARITY.** For every asset present in more than one set, all sets must record a
     byte-identical prompt. This is the check the whole three-way comparison rests on: three models
     asked different questions produce an incomparable answer, and the failure is invisible in the
     images — it looks like one model being worse at prompt adherence.

     It compares the MANIFESTS, not PLAN.json and not the prompt-building code, because the
     manifest is the only artefact that records what was actually sent. PLAN.json is regenerated
     from the current clauses on every run and drifts away from the run it describes the moment a
     clause is edited: 80 of aetherholm-assets' 101 entries already carry a manifest prompt its own
     PLAN.json no longer derives. Checking against the code would therefore be checking against a
     thing that has already moved.

     Vacuously true today, and deliberately shipped before there is a second set: it is binding the
     first minute a candidate lands, which is the minute it matters.

    python3 verify.py                                  # every set present, every asset
    python3 verify.py site hub                         # only these surfaces
    python3 verify.py --provider qwen-image-2512       # one set
"""

from __future__ import annotations

import argparse
import colorsys
import hashlib
import json
import sys
from pathlib import Path

from PIL import Image

import dialects
import providers

HERE = Path(__file__).resolve().parent

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


def check_parity(documents: dict[str, dict]) -> list[str]:
    """The cross-set prompt check, in two halves — within a dialect, and across dialects.

    Keyed on surface/kind@size — the manifest key — rather than on the file path, so that a
    provider whose delivered dimensions differ from FLUX's is still lined up with the right
    reference asset.

    WITHIN A DIALECT: unchanged, and this is the property the controlled comparison rests on. Every
    asset present in two or more sets of the same dialect must carry the byte-identical prompt in
    all of them. A set that disagrees with its own dialect-mates is not comparable with them and
    this says so.

    ACROSS DIALECTS: RE-DERIVED, which is strictly stronger than the equality above rather than a
    relaxation of it. A dialect is a pure function of the reference set's recorded prompt, so a
    candidate in another dialect does not merely get to be different — its prompt must be EXACTLY
    what applying its dialect's rules to the reference's record produces. Equality could only ever
    say "these two strings differ". This says "this string is not what this dialect produces from
    the record", which catches a hand-edited prompt, a rule added after a run, and a set whose
    declared dialect is not the one it was actually generated in — none of which plain equality
    could see, because none of them looks like agreement or disagreement.

    The effect is that a set generated from a different prompt can never be silently compared with
    one it does not match: either it is in the same dialect and must be identical, or it is in a
    declared dialect and must be derivable. There is no third state.

    Also reports an asset a candidate has that the reference does not. Every dialect derives from
    the reference record, so a candidate can only ever be a subset of it whatever dialect it is in;
    an extra key means something generated a prompt of its own, which is the failure this whole
    check exists to catch.
    """
    if len(documents) < 2:
        return []

    by_key: dict[str, dict[str, str]] = {}
    for provider_id, document in documents.items():
        for asset in document["assets"]:
            # providers.key_of, not a hand-built string: the three asset repositories identify an
            # asset differently and this function is the only place that difference lives.
            by_key.setdefault(providers.key_of(asset), {})[provider_id] = asset["prompt"]

    reference = providers.reference()
    dialect_of = {p.id: p.dialect for p in providers.load()}
    problems: list[str] = []

    for key, prompts in sorted(by_key.items()):
        if reference.id in documents and reference.id not in prompts:
            problems.append(
                f"{key}: present in {', '.join(sorted(prompts))} but not in the reference set "
                f"{reference.id} — every dialect derives from the reference's recorded prompt, so "
                "no set can hold an asset the reference has never generated"
            )
            continue

        # ---- within a dialect: byte-identical, exactly as before
        by_dialect: dict[str, dict[str, str]] = {}
        for provider_id, prompt in prompts.items():
            by_dialect.setdefault(dialect_of.get(provider_id, "?"), {})[provider_id] = prompt
        for dialect, group in sorted(by_dialect.items()):
            if len(group) < 2:
                continue
            distinct: dict[str, list[str]] = {}
            for provider_id, prompt in group.items():
                distinct.setdefault(
                    hashlib.sha256(prompt.encode()).hexdigest()[:12], []
                ).append(provider_id)
            if len(distinct) > 1:
                groups = "; ".join(
                    f'{digest} = {", ".join(sorted(ids))}' for digest, ids in sorted(distinct.items())
                )
                problems.append(
                    f"{key}: the {dialect}-dialect sets were given DIFFERENT prompts ({groups}). "
                    "The comparison between them is not valid until they agree — regenerate the "
                    "candidate, which replays the recorded prompt rather than computing one"
                )

        # ---- across dialects: re-derive from the record and compare bytes
        record = prompts.get(reference.id)
        if record is None:
            continue
        for provider_id, prompt in sorted(prompts.items()):
            dialect = dialect_of.get(provider_id, "?")
            if dialect == reference.dialect:
                continue
            expected = dialects.apply(dialect, record)
            if prompt != expected:
                problems.append(
                    f"{key}: {provider_id} declares the {dialect!r} dialect, but its recorded "
                    f"prompt is not what that dialect produces from the reference record "
                    f"(recorded {hashlib.sha256(prompt.encode()).hexdigest()[:12]}, derived "
                    f"{hashlib.sha256(expected.encode()).hexdigest()[:12]}). Either the set was "
                    "generated in a different dialect from the one it claims, or dialects.json "
                    "changed after the run — regenerate it, or the two sets are not two phrasings "
                    "of one brief and nothing may be concluded by putting them side by side"
                )
                continue
            owed = dialects.residuals(dialect, prompt)
            if owed:
                problems.append(
                    f"{key}: {provider_id} is labelled {dialect!r} but its prompt still carries "
                    f"{len(owed)} prohibition word(s) — {', '.join(owed)}. The label is a claim "
                    "about the prompt and this one is not true of it"
                )
    return problems


def verify_one(provider: providers.Provider, wanted: set[str]) -> tuple[list[str], list[str], dict]:
    document = json.loads(provider.manifest.read_text())
    ground_target = hex_to_rgb(GROUND)

    failures: list[str] = []
    rows: list[str] = []

    declared_count = document.get("assetCount")
    if declared_count is not None and declared_count != len(document["assets"]):
        failures.append(
            f'MANIFEST.json: assetCount says {declared_count} and the file carries '
            f'{len(document["assets"])} entries'
        )

    recorded = {asset["path"] for asset in document["assets"]}
    on_disk = {str(p.relative_to(provider.root)) for p in provider.root.glob("assets/**/*.png")}
    for orphan in sorted(on_disk - recorded):
        # The direction verify.py's per-asset checks cannot see: a file with no provenance at all.
        failures.append(f"{orphan}: on disk with no manifest entry")

    conformance_count = 0

    for asset in document["assets"]:
        if wanted and asset["surface"] not in wanted:
            continue
        path = provider.root / asset["path"]
        # INTEGRITY: is this manifest TRUE about these bytes. Fatal for every set, always.
        problems: list[str] = []
        # CONFORMANCE: does this art meet the brand specification. Fatal for the SHIPPED set;
        # reported, loudly and by name, for a candidate.
        #
        # A candidate is on trial. "Qwen returned a photograph where the design system asks for
        # flat vector on a near-black ground" is the answer to comparison criterion 1, not a broken
        # build — and turning CI red for it would mean the only way to land the evidence is to
        # weaken a check, which is the one thing that must not happen here. Nothing the shipped set
        # is held to has changed, and a candidate is still held to every claim it makes about
        # itself: checksum, dimensions, C2PA, and prompt parity are all integrity.
        conformance: list[str] = []

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
                conformance.append(f"ground {rgb_to_hex(ground)} is too light (luma {ground_luma:.3f})")

            reading = read_accent(image, asset["accent"])
            accent_hex = rgb_to_hex(reading.rendered) if reading.rendered else "-"
            floor = MIN_ACCENT_COVERAGE.get(asset["kind"], MIN_ACCENT_COVERAGE_DEFAULT)
            if reading.coverage < floor:
                conformance.append(
                    f'only {reading.coverage * 100:.2f}% of the image is drawn in the registry '
                    f'accent {asset["accent"]} (floor {floor * 100:.1f}%)'
                )
            if reading.stray > reading.coverage and reading.stray > 0.01:
                conformance.append(
                    f"a third hue at {reading.stray_hue:.0f} degrees covers {reading.stray * 100:.2f}% — "
                    f"more than the accent's {reading.coverage * 100:.2f}% — and neither the accent "
                    f"nor the company ember explains it"
                )

        fatal = problems + (conformance if provider.shipped else [])
        conformance_count += len(conformance)
        mark = "FAIL" if fatal else ("warn" if conformance else "ok  ")
        rows.append(
            f'{mark} {asset["surface"]:<11} {asset["kind"]:<12} {asset["declaredSize"]:>9}  '
            f"ground {rgb_to_hex(ground)} luma {ground_luma:.3f}  "
            f"accent {accent_hex} {reading.coverage * 100:5.2f}%"
        )
        for problem in problems + conformance:
            rows.append(f"       -> {problem}")
        for problem in fatal:
            failures.append(f'{asset["path"]}: {problem}')

    rows.append(
        f"\ntarget ground {GROUND} (luma {luma(ground_target):.3f}); "
        f"ceiling {MAX_GROUND_LUMA}, hue tolerance {MAX_HUE_DRIFT:.0f} degrees"
    )
    if conformance_count and not provider.shipped:
        rows.append(
            f"{conformance_count} brand-conformance deviation(s) in this CANDIDATE set — reported, "
            "not fatal. How far a candidate sits from the design system is comparison criterion 1 "
            "(see COMPARISON.md), measured by compare.py. The shipped set is still held to all of "
            "them."
        )
    return failures, rows, document


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Verify one or more generated asset sets.")
    providers.add_argument(parser)
    parser.add_argument("surfaces", nargs="*", help="only these registry surfaces")
    args = parser.parse_args(argv[1:])

    chosen = providers.selected(args)
    if not chosen:
        print("no provider has a manifest on disk", file=sys.stderr)
        return 1

    wanted = set(args.surfaces)
    all_failures: list[str] = []
    documents: dict[str, dict] = {}

    for provider in chosen:
        print(f"===== {provider.id}  ({provider.label})")
        failures, rows, document = verify_one(provider, wanted)
        documents[provider.id] = document
        print("\n".join(rows))
        print(f"{len(failures)} failure(s) in {provider.id}\n")
        all_failures.extend(f"{provider.id}: {f}" for f in failures)

    # Across the sets. Only meaningful once there is more than one, and free to run when there is
    # not — so it ships now rather than being added on the day a second set arrives and is forgotten.
    parity = check_parity(documents)
    if len(documents) > 1:
        spoken = {p.id: p.dialect for p in chosen if p.id in documents}
        grouped = ", ".join(
            f"{d}({', '.join(sorted(i for i, v in spoken.items() if v == d))})"
            for d in sorted(set(spoken.values()))
        )
        print(f"===== prompt parity across {len(documents)} sets: {len(parity)} disagreement(s)")
        print(f"      dialects: {grouped}")
        print(
            "      identical WITHIN a dialect; RE-DERIVED from the reference record across them, "
            "which is the stronger check of the two"
        )
        for problem in parity:
            print(f"  -> {problem}")
    all_failures.extend(f"parity: {p}" for p in parity)

    print(f"\n{len(all_failures)} failure(s) across {len(chosen)} set(s)")
    return 1 if all_failures else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
