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

## N sets, not one — and it is one today

Every check below runs per PROVIDER. `--provider` selects one; the default is every set that
exists on disk, which is the reference set alone since the owner withdrew the Qwen challenger and
its two candidate trees were deleted. A candidate set is expected to be red while it is being
worked on, and that must not be able to turn the shipped reference set red with it, which is why
each set has its own manifest and its own pass or fail line. That arrangement is kept whole rather
than collapsed into "there is one set": the estate has a stated 3D and animation gap FLUX cannot
fill, so a next challenger is a question of when, and it costs nothing to still be able to hold one.

Two checks are ABOUT the set of sets rather than about any one image, and both run last:

  5. **assetCount.** The manifest's own count must equal the number of entries it carries. Trivial,
     and it was wrong in two of the estate's three asset repositories when this was written — 93
     against 94 here, 134 against 137 in emberkin-assets — because the count is written by the
     generator and the last few entries were added by a later tool that did not update it. A
     manifest whose own summary disagrees with its own body is a manifest nobody can quote.
  6. **PROMPT PARITY — dormant for a year, and LIVE again since gpt-image-2 landed.** For every
     asset present in more than one set, all sets must record a byte-identical prompt. This is the
     check the whole comparison rests on: two models asked different questions produce an
     incomparable answer, and the failure is invisible in the images — it looks like one model
     being worse at prompt adherence.

     It compares the MANIFESTS, not PLAN.json and not the prompt-building code, because the
     manifest is the only artefact that records what was actually sent. PLAN.json is regenerated
     from the current clauses on every run and drifts away from the run it describes the moment a
     clause is edited: 80 of aetherholm-assets' 101 entries already carry a manifest prompt its own
     PLAN.json no longer derives. Checking against the code would therefore be checking against a
     thing that has already moved.

     It was shipped before there was a second set and it outlived the second set, and both of
     those are the same decision: it binds the first minute a candidate lands, which is the minute
     it matters. What must not happen in between is that the zero it returns gets read as a pass.


** THE CHECK THAT WAS DORMANT IS LIVE AGAIN, AND THE RUN SAYS WHICH IT IS. ** When the owner
withdrew Qwen-Image 2512 and its candidate trees were deleted, `check_parity` — the only check
here that compares SETS rather than reading one manifest and its bytes — was left with a single
operand and returned clean because it had been handed one document. It said DORMANT on every run
for as long as that was true. `candidates/gpt-image-2` is a second manifest on disk, so a full run
now compares two sets and prints the count of disagreements it actually found.

The DORMANT wording has NOT been deleted, because dormancy is a property of the SELECTION and not
of the estate: `verify.py --provider gpt-image-2` hands the function one document and is dormant
this afternoon whatever is on disk. What changed is which branch a full run takes. `--self-test`
still hands the real function two-set fixtures on every CI run, and still will after a candidate
is promoted and the loser deleted, so this cannot quietly stop being able to fail again.

    python3 verify.py --self-test    # break the cross-set guard on a fixture; no images needed
    python3 verify.py                                  # every set present, every asset
    python3 verify.py site hub                         # only these surfaces
    python3 verify.py --provider flux-2-pro            # one set — parity DORMANT by selection
    python3 verify.py --provider gpt-image-2           # the candidate alone
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

    THE CHECK THE WHOLE COMPARISON RESTS ON. Two models asked different questions produce an
    incomparable answer, and the failure is invisible in the images — it looks like one model being
    worse at prompt adherence, which is exactly the conclusion this exercise is supposed to reach
    honestly or not at all.

    It compares the MANIFESTS, not PLAN.json and not the prompt-building code, because the manifest
    is the only artefact that records what was actually SENT. PLAN.json is regenerated from the
    current clauses on every run and drifts away from the run it describes the moment a clause is
    edited. Checking against the code would be checking against a thing that has already moved.

    Keyed on the manifest key rather than on the file path, so that a provider whose delivered
    dimensions differ from FLUX's is still lined up with the right reference asset.

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

    ** THE EARLY RETURN BELOW IS NARROW ON PURPOSE, AND THE CALLER SAYS SO OUT LOUD. ** For the
    year between Qwen-Image 2512 being withdrawn and gpt-image-2 arriving, every repository here
    held exactly one manifest and this function had nothing to compare it against. It returned
    clean because it had been handed ONE DOCUMENT, not because it looked and found nothing — and an
    exit code cannot tell those two apart. That is this estate's recurring defect, found five times
    in a day: a CI job that read image metadata without decoding the image, a grep that skipped
    files containing NUL bytes, a secret scan whose `-I` discarded the binary stream it was meant
    to search.

    That state can always come back — a promotion deletes the loser, and `--provider X` narrows a
    live run to one document on any afternoon — so the guard below is spelled "fewer than two sets"
    and never "no problems"; `main` prints the word DORMANT instead of a reassuring zero whenever
    it fires; and `python3 verify.py --self-test` runs this exact function against two-set fixtures
    on every CI run regardless of what is on disk. A SECOND SET WHOSE PROMPT DIFFERS BY ONE WORD
    MUST STILL FAIL, and that sentence is executable rather than a claim.
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


# ══════════════════════════════════════════════════════════════════════════════════════════════
# THE CHECK THAT CAN GO DORMANT, AND THE MACHINERY THAT PROVES IT CAN STILL BITE
#
# `check_parity` above is the only check in this file that is ABOUT THE SET OF SETS. Every other
# check reads one manifest and the bytes it points at, and goes on working whatever else exists.
# This one compares sets to each other, so when the owner withdrew the only challenger it was left
# with one operand: its failure count went to zero at a stroke with nothing about the shipped set
# changed.
#
# That is the precise shape of a number improving because a check stopped looking, and this estate
# has been bitten by it repeatedly. The response was two things, neither of which is a comment:
# `main` prints DORMANT rather than 0, and everything below hands the real function a real second
# set and fails if it stays green.
#
# gpt-image-2 has since put a second manifest on disk, so a full run compares two real sets again.
# NONE OF THIS MACHINERY IS BEING REMOVED ON THAT NEWS. It is what makes the live run's number
# trustworthy, it is what will hold when the promotion deletes the loser and the count returns to
# one, and it costs a fixture and no images to run. A guard deleted the day its subject arrives is
# a guard that was never doing the work its author claimed.
# ══════════════════════════════════════════════════════════════════════════════════════════════

#: A recorded prompt that the positive dialect genuinely REWRITES, and whose rewrite comes out with
#: no negation vocabulary left. Both halves are load-bearing: a fixture the transform happens to
#: leave alone would pass the re-derivation check without the transform ever running.
_FIXTURE_RECORD = (
    "A flat mark, with exactly one accent colour — #e8622c — and no second hue anywhere."
)
#: A record the positive rule list does NOT cover. It transforms to itself, so it passes the
#: re-derivation half and must be caught by the residual half instead — which is the half that
#: makes "positive" a measured property of the prompt rather than a label somebody typed.
_FIXTURE_UNCOVERED = "A mark on the ash field. There is no chartreuse anywhere in the frame."


def _fixture_asset(name: str, prompt: str) -> dict:
    """One manifest entry, spelled with THIS repository's own identity fields.

    Built from providers.json's `identity` block rather than hardcoded, for two reasons. It makes
    the fixture travel through `providers.key_of` exactly as a real manifest entry does — and it
    lets this whole file's self-test be the same code in all three asset repositories, which key
    their assets differently. A hardcoded `surface`/`kind` entry would key on nothing at all in the
    game sets, and a check handed keys it cannot build is a check that passes for the wrong reason.
    """
    fields = json.loads((HERE / "providers.json").read_text())["identity"]["key"]
    entry = {field: "fixture" for field in fields}
    entry[fields[0]] = name
    entry["prompt"] = prompt
    return entry


class _registry_with:
    """providers.json with challenger entries appended, for the duration of one call.

    `check_parity` reads the registry every time it runs — the identity block, the reference id and
    every provider's declared dialect. A fixture made only of manifests would therefore be handed
    to a check that could not see a second provider at all, and would prove nothing.

    So this appends to the REAL document rather than inventing one: `identity`, `reference` and
    dialects.json are exactly what ships. What is synthetic is a second SET, which is precisely the
    thing that no longer exists on disk and nothing else. The challengers are registered `live`,
    because a withdrawn provider with a manifest present would get the same verdict — this function
    compares the manifests it is GIVEN — and registering them live is the harder case to pass.
    """

    def __init__(self, *challengers: tuple[str, str]) -> None:
        self._challengers = challengers
        self._real = providers._document

    def __enter__(self):
        document = json.loads((HERE / "providers.json").read_text())
        template = next(p for p in document["providers"] if p["id"] == document["reference"])
        for provider_id, dialect in self._challengers:
            entry = dict(template)
            entry.update(
                id=provider_id,
                label=provider_id,
                dialect=dialect,
                root=f"candidates/{provider_id}",
                shipped=False,
                status="live",
            )
            document["providers"].append(entry)
        providers._document = lambda: document
        return self

    def __exit__(self, *exc) -> None:
        providers._document = self._real


def self_test() -> int:
    """Break the cross-set guard on a fixture and watch it go red. No images, no endpoint, no keys.

    WHAT THIS IS FOR. `check_parity` lost its second operand when the Qwen challenger was deleted.
    Nothing about the shipped set changed, and nothing about this function's ability to find a
    defect changed either — but from the outside those are indistinguishable from the check having
    quietly died, because both look like a zero. Reading the source is not evidence; the source
    always looks like it works. So the real function is called here, unmodified, against manifests
    built in memory.

    BOTH DIRECTIONS ARE ASSERTED. A check that always fails is exactly as useless as one that never
    does, and it is the easier of the two mistakes to make when writing a test like this. Every
    property below is exercised twice: once with a fixture that should pass and once with a fixture
    that should fail, and only the pair is evidence.

    THE FOUR PROPERTIES, which are the four ways two sets can stop being comparable:

      within a dialect   two sets given different prompts for one asset
      across dialects    a set whose prompt is not what its declared dialect derives from the record
      the residual rule  a set labelled `positive` whose prompt still carries negation vocabulary
      the subset rule    a set holding an asset the reference has never generated

    And the dormant state itself is asserted last, on a document that WOULD fail if it had a
    partner — which is the difference between "there is nothing wrong" and "there is nothing here".
    Followed by the one check here that is about the repository rather than a fixture: that a full
    run hands the function every set on disk, so a filter added to `selected()` cannot leave a real
    candidate unread behind a green parity line. It deliberately does not assert HOW MANY sets are
    on disk; the assertion that used to do that failed the day a second one arrived.
    """
    document = json.loads((HERE / "providers.json").read_text())
    reference_id = document["reference"]
    reference_dialect = next(p["dialect"] for p in document["providers"] if p["id"] == reference_id)
    checks: list[tuple[str, bool, list[str]]] = []

    def check(name: str, ok: bool, detail=()) -> None:
        checks.append((name, bool(ok), [str(d) for d in detail]))

    # The fixtures below assume the record is in the literal dialect. If that ever stops being
    # true the cross-dialect cases silently become no-ops, so it is asserted rather than assumed.
    check(
        f"the reference set {reference_id} is the dialect the record is in",
        reference_dialect == "literal",
        [f"reference dialect is {reference_dialect!r}"],
    )

    # ---- WITHIN A DIALECT. Byte-identical, or the two sets answered different questions.
    with _registry_with(("fixture-literal", "literal")):
        agreeing = {
            reference_id: {"assets": [_fixture_asset("alpha", _FIXTURE_RECORD)]},
            "fixture-literal": {"assets": [_fixture_asset("alpha", _FIXTURE_RECORD)]},
        }
        check("parity passes two literal sets that agree", check_parity(agreeing) == [])

        divergent = {
            reference_id: {"assets": [_fixture_asset("alpha", _FIXTURE_RECORD)]},
            "fixture-literal": {
                "assets": [_fixture_asset("alpha", _FIXTURE_RECORD.replace("flat", "glossy"))]
            },
        }
        found = check_parity(divergent)
        check(
            "parity FAILS a live second set whose prompt differs by ONE WORD",
            len(found) == 1 and "DIFFERENT prompts" in found[0],
            found,
        )

        # ---- THE SUBSET RULE. Every dialect derives from the reference record, so a candidate can
        # only ever be a subset of it. An extra key means something generated a prompt of its own.
        orphan = {
            reference_id: {"assets": [_fixture_asset("alpha", _FIXTURE_RECORD)]},
            "fixture-literal": {"assets": [_fixture_asset("beta", _FIXTURE_RECORD)]},
        }
        found = check_parity(orphan)
        check(
            "parity FAILS an asset the reference has never generated",
            len(found) == 1 and "never generated" in found[0],
            found,
        )

    # ---- ACROSS DIALECTS. Re-derived from the record, which is stronger than equality: equality
    # could only ever say "these differ", and every case below looks like agreement to it.
    with _registry_with(("fixture-positive", "positive")):
        derived = dialects.apply("positive", _FIXTURE_RECORD)
        check(
            "the positive dialect actually rewrites the fixture, so the next two cases are real",
            derived != _FIXTURE_RECORD,
            [derived],
        )

        correct = {
            reference_id: {"assets": [_fixture_asset("alpha", _FIXTURE_RECORD)]},
            "fixture-positive": {"assets": [_fixture_asset("alpha", derived)]},
        }
        check("parity passes a cross-dialect set that IS derivable", check_parity(correct) == [])

        # The case plain equality is blind to: a prompt that differs from the reference's exactly
        # as a different dialect would — but is not what THIS dialect produces from the record.
        undertransformed = {
            reference_id: {"assets": [_fixture_asset("alpha", _FIXTURE_RECORD)]},
            "fixture-positive": {"assets": [_fixture_asset("alpha", _FIXTURE_RECORD)]},
        }
        found = check_parity(undertransformed)
        check(
            "parity FAILS a set declaring a dialect it was not generated in",
            len(found) == 1 and "is not what that dialect produces" in found[0],
            found,
        )

        # ---- THE RESIDUAL RULE. Derivable and still wrong: the label is a claim about the prompt.
        uncovered = dialects.apply("positive", _FIXTURE_UNCOVERED)
        residual = {
            reference_id: {"assets": [_fixture_asset("alpha", _FIXTURE_UNCOVERED)]},
            "fixture-positive": {"assets": [_fixture_asset("alpha", uncovered)]},
        }
        found = check_parity(residual)
        check(
            "parity FAILS a 'positive' set whose prompt still carries a prohibition word",
            len(found) == 1 and "prohibition word" in found[0],
            found,
        )

    # ---- AND THE DORMANT STATE ITSELF, asserted rather than described.
    #
    # The single document handed in here is the SAME divergent fixture that went red above, minus
    # its partner. It comes back clean. That is the whole point: the clean result is a statement
    # about how many sets are on disk and about nothing else, and it is why `main` refuses to print
    # it as a zero.
    lone = {reference_id: {"assets": [_fixture_asset("alpha", _FIXTURE_RECORD)]}}
    check(
        "one set is DORMANT, not clean — the same fixture fails the moment it has a partner",
        check_parity(lone) == [],
        [],
    )
    # ---- AND THAT A FULL RUN REALLY COMPARES EVERYTHING ON DISK.
    #
    # This slot used to assert `len(providers.present()) == 1` — "and the repository really is in
    # that state, so the DORMANT line is not decoration". That was true when it was written and it
    # went false the hour gpt-image-2's manifest landed, failing the self-test for the one reason a
    # self-test must never fail: the estate got BETTER. Pinning a headcount pins the weather.
    #
    # What that line was really guarding is worth keeping, so it is asserted directly instead: a
    # full run must hand `check_parity` every set that exists. The way this check silently dies is
    # not the count changing, it is `selected()` growing a filter — on `shipped`, on `status`, on
    # anything — that quietly drops the candidate, at which point two sets sit on disk and the
    # comparison between them never runs while the output still says how many failures it found.
    # That is falsifiable, it is about the code rather than about today, and it holds at one set,
    # at two, and after a promotion deletes the loser.
    present = {p.id for p in providers.present()}
    full_run = {p.id for p in providers.selected(argparse.Namespace(provider=None))}
    check(
        "a full run selects every set on disk, so nothing can sit unread beside a green parity line",
        full_run == present,
        [f"on disk: {sorted(present)}", f"a full run reads: {sorted(full_run)}"],
    )
    print(
        f"      (informational: {len(present)} set(s) on disk — "
        + (
            "a full run compares them, so parity is LIVE"
            if len(present) > 1
            else "a full run is therefore DORMANT, which is what main will print"
        )
        + ")"
    )

    print("===== self-test: the cross-set guard, broken on a fixture")
    failed = 0
    for name, ok, detail in checks:
        print(f"  {'ok  ' if ok else 'FAIL'} {name}")
        if not ok:
            failed += 1
            for line in detail:
                print(f"         {line}")
    print(f"\n{failed} of {len(checks)} self-test(s) failed")
    return 1 if failed else 0



NATIVE_COLUMNS = ("nativePath", "nativeSize", "nativeSha256", "nativeC2pa")


def check_native(asset: dict, root: Path) -> list[str]:
    """The four `native*` columns, re-derived from the file they name. INTEGRITY, never conformance.

    ## What these columns are, and why they need a check of their own

    Some endpoints refuse to generate at a size this set declares. gpt-image-2 has a minimum pixel
    budget, measured by bisection to sit in (524288, 655360], which the 1024x384 wordmark and the
    512x512 favicon both fall under. Those two are generated at an exact multiple of the same
    aspect ratio and Lanczos'd DOWN by `derive.py --resample`, and the as-delivered file is kept at
    `native/<surface>/<kind>-<w>x<h>-asdelivered.png` — outside `assets/`, so the orphan walk above
    does not see it and so materialise.py can never ship it.

    That leaves the shipped-looking PNG one step removed from anything the model returned, which is
    exactly the situation in which "generated at 1024x384" quietly becomes an upscale of something
    smaller. Four columns say what the model actually delivered; without this function they are
    four strings nobody has ever compared to a file, which is this estate's favourite kind of
    defect. `verify.py`'s whole claim is that a manifest is TRUE about bytes, and the native
    columns are part of the manifest.

    Five things are checked and every one of them is fatal for a candidate as well as for the
    shipped set, because all five are claims the manifest makes about itself:

      * the columns arrive together or not at all — three of four is a half-written record
      * the named file exists, and its sha256 and c2pa state are what the row says (c2pa MEASURED,
        because re-encoding drops the chunk and the derivative is expected to have lost it while
        the native is expected to have kept it — the pair is the evidence)
      * the file's real pixel size is `nativeSize`
      * the native is not SMALLER than the declared size on either axis. That is the upscale check.
        A native under the declared size means the shipped file was invented, not downscaled.
      * the two aspect ratios agree to within half a pixel, so the "derived" file really is this
        file's downscale and not a differently-shaped image that happens to sit beside it.
    """
    if not any(column in asset for column in NATIVE_COLUMNS):
        return []
    missing = [column for column in NATIVE_COLUMNS if column not in asset]
    if missing:
        return [f"records {', '.join(sorted(set(NATIVE_COLUMNS) - set(missing)))} but not {', '.join(missing)}"]

    problems: list[str] = []
    native = root / asset["nativePath"]
    if not native.exists():
        return [f'nativePath {asset["nativePath"]} is not on disk']

    data = native.read_bytes()
    if hashlib.sha256(data).hexdigest() != asset["nativeSha256"]:
        problems.append(f'{asset["nativePath"]}: checksum does not match nativeSha256')
    carries = b"c2pa" in data
    if carries != asset["nativeC2pa"]:
        problems.append(
            f'{asset["nativePath"]}: manifest says nativeC2pa={asset["nativeC2pa"]} and the bytes '
            f"say {carries}"
        )

    with Image.open(native) as raw:
        measured = raw.size
    stated = tuple(int(n) for n in asset["nativeSize"].split("x"))
    if measured != stated:
        problems.append(
            f'{asset["nativePath"]}: {measured[0]}x{measured[1]} against a recorded nativeSize '
            f'{asset["nativeSize"]}'
        )

    declared = tuple(int(n) for n in asset["declaredSize"].split("x"))
    if measured[0] < declared[0] or measured[1] < declared[1]:
        problems.append(
            f'native {measured[0]}x{measured[1]} is smaller than the declared '
            f'{asset["declaredSize"]} on at least one axis — the shipped file would be an UPSCALE '
            "of it, and no set here upscales"
        )
    elif abs(measured[0] / measured[1] - declared[0] / declared[1]) > 0.5 / max(declared):
        problems.append(
            f'native {measured[0]}x{measured[1]} is not the same shape as the declared '
            f'{asset["declaredSize"]}, so the shipped file is not a downscale of it'
        )
    return problems


def verify_one(
    provider: providers.Provider, wanted: set[str], as_shipped: bool = False
) -> tuple[list[str], list[str], dict]:
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

    # The same walk over the as-delivered natives, which live OUTSIDE assets/ and are therefore
    # invisible to the walk above. They are named by a column rather than by an entry of their own
    # (an entry the reference does not hold fails check_parity's subset rule, and a PNG under
    # assets/ with no entry fails the walk above — the column is the only shape that satisfies
    # both), so "named by nobody" is a state only this walk can catch. It matters because a
    # leftover native from a re-run is a file a reader would reasonably believe is the source of
    # the asset beside it, and it would not be.
    claimed = {asset["nativePath"] for asset in document["assets"] if asset.get("nativePath")}
    natives = {str(p.relative_to(provider.root)) for p in provider.root.glob("native/**/*.png")}
    for orphan in sorted(natives - claimed):
        failures.append(f"{orphan}: an as-delivered native no manifest entry claims")

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

        # INTEGRITY, for the same reason the checksum above is: a claim about bytes, re-derived
        # from the bytes. Absent on every entry of every set that generates at its declared size,
        # which is all of the reference set.
        problems.extend(check_native(asset, provider.root))

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

        fatal = problems + (conformance if (provider.shipped or as_shipped) else [])
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
        if as_shipped:
            rows.append(
                f"{conformance_count} brand-conformance deviation(s), FATAL HERE because --as-shipped "
                "asked what this set would score if it were the shipped one. It is not the shipped "
                "one, so nothing is red today; this is the answer to 'may it be promoted', and the "
                "answer is no until these are fixed or knowingly accepted."
            )
        else:
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
    parser.add_argument(
        "--self-test",
        action="store_true",
        help="break the cross-set guard against a fixture and prove it goes red. No images needed.",
    )
    # WHY THIS EXISTS, and it was found by running promote.py rather than by reasoning about it.
    #
    # Conformance is fatal for the SHIPPED set and reported-not-fatal for a candidate, which is the
    # right split and is argued at length beside `fatal =` above. The consequence nobody had stated
    # is that a candidate can pass `verify.py --provider <id>` with 0 failures, be promoted on the
    # strength of it, and turn the repository RED the instant it lands — because the same deviation
    # is now being read under the shipped set's rules. That is exactly what gpt-image-2 did on the
    # first real promotion: `hub/social` carries 0.32% accent against a 1% floor, which was a `warn`
    # line for the whole evaluation and became `FAIL hub social` one second after the move.
    #
    # So this flag asks the only question a promotion actually cares about: what would this set
    # score IF IT WERE SHIPPED. promote.py runs it as its pre-move gate, which is the difference
    # between a switch that is refused and a switch that has to be undone. It changes what counts
    # as fatal and NOTHING else — no check is added, removed, loosened or re-ordered, and a set
    # that is already shipped is unaffected because it is held to these rules anyway.
    parser.add_argument(
        "--as-shipped",
        action="store_true",
        help="hold a CANDIDATE to the shipped set's rules: brand conformance becomes fatal. What "
        "promote.py asks before it moves anything.",
    )
    args = parser.parse_args(argv[1:])

    if args.self_test:
        return self_test()

    chosen = providers.selected(args)
    if not chosen:
        print("no provider has a manifest on disk", file=sys.stderr)
        return 1

    wanted = set(args.surfaces)
    all_failures: list[str] = []
    documents: dict[str, dict] = {}

    for provider in chosen:
        print(f"===== {provider.id}  ({provider.label})")
        failures, rows, document = verify_one(provider, wanted, as_shipped=args.as_shipped)
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
    else:
        # NEVER A BARE ZERO. This check compares sets to each other, and it was handed one
        # document — so it returned clean for want of an operand, NOT because it looked and found
        # nothing. Those two states produce the identical exit code and the identical count, and
        # this estate has spent a day finding checks in the second one. The word is printed so that
        # a reader scanning the output cannot mistake an absent operand for a passing comparison.
        #
        # Since gpt-image-2 landed there are two manifests on disk and a full run takes the branch
        # above, so the usual way to arrive HERE is `--provider X`: one set was ASKED for. That
        # reads very differently to a year of dormancy and the message distinguishes the two, on
        # what was actually selected rather than on what the file was written believing.
        only = next(iter(documents), "the only set")
        narrowed = len(providers.present()) > len(documents)
        because = (
            f"{only} is the only set this run selected, and {len(providers.present())} are on disk"
            if narrowed
            else f"{only} is the only set on disk"
        )
        print(
            f"===== prompt parity: DORMANT — {because}, so this check has nothing to compare it "
            "against. It returned clean because it was handed ONE document, not because it looked "
            "and found nothing."
        )
        if narrowed:
            print("      Drop --provider to compare the sets against each other.")
        print(
            "      It is exercised against two-set fixtures by `python3 verify.py --self-test`, "
            "which CI runs before this command, so it is not a check that has quietly stopped "
            "being able to fail. Every other check in this file reads one manifest and its bytes, "
            "and is unaffected."
        )
    all_failures.extend(f"parity: {p}" for p in parity)

    print(f"\n{len(all_failures)} failure(s) across {len(chosen)} set(s)")
    return 1 if all_failures else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
