# How the models were judged

> ## ONE EVALUATION FINISHED AND A SECOND IS OPEN. §0 to §10 are the finished one; §11 is the open one.
>
> **FLUX 2 Pro ships, and a second challenger is now on disk.** `gpt-image-2` was generated against
> the same 56 assets, on the byte-identical recorded prompts, in the same `literal` dialect, and
> `candidates/gpt-image-2/` is present with its own manifest. **§11 is that trial**, written to the
> criteria below rather than to new ones — which is the whole reason the criteria were fixed in
> advance and are left in the tense they were written in. Nothing in §0 to §10 has been re-scored,
> re-weighted or reopened to accommodate a second challenger's strengths.
>
> **The verdict in §11 is split by kind rather than given as a winner**, because that is what the
> measurements say and a single-winner sentence would have to suppress half of them.
>
> **FLUX 2 Pro ships.** The Qwen-Image 2512 challenger was generated in full across all three asset
> repositories, measured against every criterion below, and lost on criterion 1 by margins nothing
> else offsets. A 15-asset pilot in a `positive` prompt dialect (§9) tested whether the verdict was
> partly an artefact of this estate's own prompt style; it was not. **The owner has since withdrawn
> Qwen-Image 2512 from the estate, and this repository's `candidates/qwen-image-2512/` and
> `candidates/qwen-image-2512-positive/` trees, their manifests, their deployment records and their
> two registry entries have been deleted** — as have the sibling repositories'.
>
> **Read every challenger figure below as history that was taken, not as something you can
> re-derive.** `compare.py` reads manifests and no Qwen manifest is left, so it cannot print those
> columns again for that challenger — the second manifest now on disk is `gpt-image-2`'s and it
> measures a different model. The last run it printed for Qwen is transcribed into §10 and must be
> read as history. Where a figure used to point at
> `candidates/qwen-image-2512/DEPLOYMENT.json`, that file is gone and what it recorded is in §10.6.
> Deleting the images must not delete the reason the estate chose what it chose.
>
> **Sections 0 to 7 were written before either candidate set existed and are left in the tense they
> were written in.** Sections 8 and 9 were written afterwards and say which criteria the result
> turned on. Rewriting a criterion after the result is the one thing this document exists to
> prevent, so the two halves are not blended.
>
> **What survived the deletion and is still checked on every run:** `claims.py` re-derives every
> figure here that has a live source, and says so when one does not; `review/compare/artefacts.json`
> keeps the by-eye tallies with their scope stated; `MANIFEST.json` keeps the recorded literal
> prompts. The provider seam — `providers.json`, `backends.ts`, the dialect registry, `verify.py`'s
> `check_parity` — is kept whole because the estate has a stated 3D and animation gap FLUX cannot
> fill and a next challenger is a question of when rather than if.
>
> **And one consequence that is easy to miss, now reversed.** While there was one set on disk
> `check_parity` was DORMANT — it returned clean because it had been handed one document, not because
> it looked and found nothing, and `verify.py` printed that word on every run instead of a
> reassuring zero. **It is LIVE again.** Two manifests are present, so it compares real recorded
> prompts against each other and reports `prompt parity across 2 sets: 0 disagreement(s)`. The word
> DORMANT is still in the code and still printed, because dormancy is a property of the SELECTION
> and not of the estate: `verify.py --provider gpt-image-2` reads one manifest and says so, and the
> line now also names how many sets are on disk that the run did not read. `verify.py --self-test`
> proves on every CI run that the check still fails when given something to fail on.

The criteria were written **before** the challenger sets existed, which is the only time criteria
can be written honestly. Once the images are on screen it is very easy to discover that the thing
the winner happens to be good at was the thing that mattered all along.

The question the owner asked is *"which is best and why"*. This document fixes what "best" means,
in advance, for all 336 assets across the three asset repositories — `micro-brand` (98),
`micro-emberkin-assets` (137), `micro-aetherholm-assets` (101). `compare.py` measures the parts
that are arithmetic and refuses to score the parts that are not.

**Every count in this document is re-derived by `python3 claims.py`**, which reads the figure out
of this file and computes it from the manifests, the dialect registry and the scored artefacts.
It is here because the counts in this file had already rotted once inside a day: it said 94 and 54
after the currency marks took the set to 98 and 56, it asserted a clean C2PA sheet on a set that
is no longer clean, it said 32 dialect rules against a registry holding 31, and its section 9.3
table disagreed with its own prose about idea drift. Where a figure is NOT pinned — the retention
percentages in section 3, the prompt-uniformity counts in section 7.1 — it is because deriving it
needs a per-repository tool rather than a manifest, and that is said at the figure.

---

## 0. What is being compared, and what is not

**Compared:** the 235 assets that are GENERATED by a model — 56 here, 83 in emberkin, 96 in
aetherholm.

**Not compared:** the 101 that are DERIVED. A favicon at 192 is a Lanczos downscale of that
provider's own 512, and an OG card at 1200x630 is a centre crop of its own 1200x640. Those are
deterministic Pillow operations on the model's own output; running them against a candidate set
costs nothing and tells you nothing about the model. Asking a model for them separately would also
break the relationship the `derivedFrom` column asserts.

They are still verified, and they still appear in the side-by-side sheets, because a model whose
mark stops reading when it is shrunk has failed criterion 3 — but that is a property of the mark,
not of the downscale.

**One number that is not what it looks like.** Summing `providerCostUnits` across a whole manifest
double-counts, because a derivative inherits its parent's cost so that a reader can see what the
file behind it cost. Aetherholm reads as 316.5 units that way; the true figure is 289.5 over its 96
generations. `compare.py` sums over generated entries only.

---

## 1. Prompt adherence

*Did it draw what it was asked for?*

Partly arithmetic. `compare.py` counts:

- **Ground fidelity** — corner-sampled luma against the target `#12100f`, and how many assets are
  over the ceiling. The first live image of the original FLUX run came back on a mid-grey taupe
  field; this is not hypothetical.
- **Accent coverage** — the share of the image drawn in the surface's registry accent, against a
  per-kind floor. This is the check that would have caught `asset-forge` baking `#ff4d00` into
  every mark.
- **Third hue** — a chromatic hue covering more of the frame than the accent does, that neither the
  accent nor the company ember explains.
- **Delivered size against declared size.**

Not arithmetic, and judged by eye from the side-by-side sheets: **is it the idea?** Every entry in
`plan.ts` names one specific construction — "a quench curve crossing a baseline", "three equal
outlined squares... the centre one filled". A model that returns a beautiful generic mark has
failed this criterion completely, and no measurement will say so.

## 2. Style coherence within the set

*Do these look like they came from one hand?*

**The one that matters most, and the hardest thing for an image model.** A brand is not 98 good
images; it is 98 images that are recognisably siblings. Single-image quality is where models look
alike and set-level consistency is where they come apart.

It also carries more weight now that the comparison is two-way rather than three-way. With a single
challenger, "which is better" collapses into a per-asset beauty contest unless the set-level
judgement is doing real work.

Measured as **spread, not average** — this distinction is the whole criterion. A model that renders
every accent 18% lighter than the hex it was given has a *bias*, which is uniform, correctable and
invisible once the set is seen together. A model that renders one accent 4% light and the next 34%
light has no house style, and nothing downstream fixes that. `compare.py` reports both, and the
verdict is on the second:

- accent lightness error: bias **and spread**
- accent hue error: mean **and spread**
- ink coverage spread, within each kind (a mark and an OG card are supposed to differ)
- ground luma spread

**Judged within each set, never between them.** The three sets are deliberately unalike: a flat
geometric brand system, Emberkin's species sheets, Aetherholm's painterly islands under its own
`ART_BIBLE.md`. A model that makes Emberkin and Aetherholm look like each other has failed, not
succeeded. There is no cross-set coherence number and there must not be one.

## 3. Legibility at the size the asset is actually used at

*Does it survive being a browser tab?*

A favicon is seen at 16 and 32 pixels. Nobody but us sees the 512, and a contact sheet — which is
how the original set was reviewed — shows the 512. This is the failure a contact sheet structurally
cannot show.

Measured as **contrast retention**: RMS deviation of luma from the ground after a Lanczos downscale
to 16 and 32, over the same at full resolution. A heavy, simple mark keeps most of it; one built
from hairlines averages itself into the background.

The reference set's own baseline, for calibration: **83% median retention at 32px, 53% at 16px, and
11 of its marks fall below 50% at 16px** — `foresight/mark` keeps 38%, `hub/mark` 41%,
`admin/mark` 44%. So this is not a criterion FLUX passes and a challenger might fail. It is one
FLUX already partly fails, and a model that beats it here wins something real.

These four are the one group of figures `claims.py` does not pin: they are Pillow measurements over
the marks rather than manifest arithmetic, and deriving them would couple the shared checker to
this repository's own `compare.py`. `python3 compare.py` section 3 prints them, and it is the only
place they should be read from. The 16px median was 52% here until the currency marks were added.

## 4. Artefact rate

*How often does it produce something that is simply wrong?*

The taxonomy is fixed here in advance, and every entry is a defect this estate actually saw rather
than a defect a model might in principle have:

| Defect | Countable? | Where it was first seen |
| --- | --- | --- |
| Pale or non-uniform ground | yes, `compare.py` | first live image of the brand run, a taupe field |
| Unaccented mark | yes | `hub`'s OG card in grey, `worlds` drawn entirely in white |
| Third hue taking over | yes | the check that would have caught `#ff4d00` everywhere |
| Inset duplicate | **by eye** | 3 of 11 favicons came back as the mark plus a smaller framed copy |
| Invented lettering | **by eye** | `market`'s banner reading "Sftware Company"; `worlds` producing "Cartre Pere" |
| Construction guides drawn | **by eye** | margin box, centre cross and quarter grid ruled across the first image |
| Nameplate / card frame | **by eye** | Emberkin portraits returning as trading cards with a name banner |

The three countable ones are in the report. The four that only an eye can catch are tallied by hand
into `review/compare/artefacts.json`, keyed by provider id and defect name; `compare.py` reads it if
it exists and **says the criterion has no verdict if it does not**, rather than printing zero.

**Procedure, so the tally is comparable:** open `review/compare/compare-<kind>.png`, which puts the
same asset from every model in one row, and score left to right per row. Never one model's whole set
followed by another's — that is eleven separate judgements each made against a memory of the last.

## 5. Retries

*How much work was it to get an acceptable set?*

**Read this row with care, and after the run it needs a bigger caveat than it had.** The reference
set's 16-of-56 was accumulated over repeated human review passes — a contact sheet was looked at,
bad assets were re-rolled, and the count is the record of that. The candidate set was generated in
one pass and nobody re-rolled anything, so it reads 0-of-56. **That is not Qwen being more
reliable. It is the two sets having had completely different amounts of human attention**, and
comparing the numbers directly would credit a model for work nobody did to it.

What the row can honestly be used for is `attempts` with a non-`ok` outcome, which is the machine's
own count of things that went wrong on the wire rather than a record of anyone's taste.

Free, from the manifests, and the one criterion collected without any extra effort — `retries` is
incremented by every forced regeneration, whatever the reason, and `attempts` records the failures.

Reference baseline: **16 of 56 assets needed at least one retry, 26 retries in total, 5 failed
attempts logged.** Emberkin needed 24 of 83, aetherholm 72 of 96.

A caveat that has to be stated: a retry count reflects the operator's patience as much as the
model's output. It is a real signal at 3× difference and noise at 1.2×.

## 6. Cost — in the unit each model bills in

**These are not the same number and are never combined.**

| | FLUX 2 Pro | Managed Compute (Qwen, and any future A100 model) |
| --- | --- | --- |
| Bills for | each image generated | **each hour the deployment exists** |
| Unit | provider image unit | deployment hour |
| Source | `request_meta.cost`, per asset | the operator's deployment record — deleted with the candidate tree, transcribed into §10.6 |
| Idle cost | zero | full |

`compare.py` prints each in its own unit and derives **no** per-image figure for a per-hour
provider. The reason is not pedantry:

- Per-image billing charges for **output**. Per-hour billing charges for **existence** — including
  every hour the deployment sat idle before the run, between interruptions, and after the last
  asset if nobody deleted it.
- A per-image figure for a per-hour provider is therefore a statement about **how well the run was
  organised**, not about the model. Run the same 235 assets twice, once starting the moment the
  endpoint went healthy and once starting the next morning, and the "cost per image" differs by an
  order of magnitude with byte-identical output.

This is already concrete: Cosmos 3 Super billed for its entire deployment lifetime and produced
**zero images**, because it never came up. There is no per-image number that can express that, and
any arithmetic that produced one would be wrong.

**What the run must therefore do**, and what `generate.ts` is built to do: start the instant the
endpoint serves, resume without regenerating anything that already succeeded, and print a
`SET COMPLETE` line naming teardown the moment the last asset lands. Each deployment is deleted when
its own set finishes; neither waits for the other.

**Wall-clock estimate, stated before anyone spends money.** 235 generations per model. The reference
provider's own median successful attempt is 11–18s, but that is a shared serverless endpoint. A
dedicated A100_80GB should be faster per image and cannot be rate-limited by a neighbour, so at a
10–25s median and a concurrency of 2 the generation itself is **roughly 20 to 50 minutes**, plus
about 25% for retries at the reference set's observed rate. Provisioning and warming dominate: the
Qwen deployment showed Succeeded in the portal and then returned `500 Model service is unavailable`
for at least 17 minutes of continuous probing. **Budget 2–3 deployment-hours per model, of which
under one is images.** The corollary is the point: the images are not the cost, the deployment
lifetime is.

---

## 7. Known asymmetries, stated rather than discovered later

0. **The reference set has been post-processed and curated; a candidate set has not.** This is the
   largest confound in the whole comparison and it cuts more than one way:

   - `normalise_ground.py` was run over the reference set (commit `8314af3`, "snap every ground to
     the exact ash value"), which is why its ground-luma spread is exactly 0.0000 against the
     candidate's 0.0911. **Ground spread is therefore not a like-for-like model measurement.** The
     honest reading is the candidate's absolute figure on its own terms.
   - The reference set was reviewed and re-rolled; the candidate was generated once. See §5.

   The accent, ink-coverage and KB-per-megapixel rows are *not* affected: ground normalisation
   rewrites near-ground pixels and leaves the artwork alone. Neither is the artefact tally, which
   is scored on what is drawn.

   The fair comparison to draw is therefore about **what the model put in the frame** — the idea,
   the colour, the register, the prohibitions it did or did not honour — and not about how uniform
   the background pixels ended up.

1. **The reference set is not internally prompt-uniform.** 36 of its 56 generated assets carry a
   prompt the current code no longer produces, because the favicon, lettering and accent hardening
   clauses were added partway through the original run and the earlier assets were never
   regenerated. Aetherholm is worse: 80 of its 101 entries.

   The 36 and the 80 are the other figures `claims.py` does not pin — establishing them means
   rebuilding every prompt through `prompts.ts` and diffing, which needs node rather than a
   manifest. They are recorded in `prompts.ts`'s own header, which is where the transform lives.
   The denominators beside them are pinned.

   This does **not** break the comparison, because parity is per asset — a candidate replays the
   exact string that asset was generated from, so FLUX and Qwen answer the same question about
   `site/mark` whatever that question was. It does mean the reference set is a slightly weaker
   version of itself in places, and a challenger that beats it on an asset generated before the
   hardening has beaten an easier opponent.

2. **`c2pa` is measured off the bytes, never asserted.** The reference brand set carries C2PA on
   **2 of 98** files, and both of them are the currency marks. Every other file lost it to ground
   normalisation, which rewrites the pixels and whose PNG writer keeps no ancillary chunk; the two
   currency marks were never ground-normalised, so theirs survived. Emberkin keeps it on 83 of 137,
   aetherholm on 96 of 101, because their normalisers copy ancillary chunks through. Whether Qwen
   emits C2PA at all is unknown and will be recorded as measured — a candidate set with no C2PA is
   a legitimate finding; one *claiming* C2PA it does not carry is the defect this repository has
   already shipped once.

   **This row read "0 of 94" until the currency marks were counted**, which is the same defect one
   level up: a clean sheet asserted on a set that is not clean, in the very paragraph that says the
   figure is measured rather than asserted. `claims.py` now measures it off the bytes on every run,
   the same way `verify.py` does per asset, so the sentence cannot outlive the fact again.

3. **Delivered dimensions may not floor the same way.** FLUX floors each dimension to a multiple of
   16, which is why an OG card is asked for at 1200x640 and cut to 1200x630. That arithmetic is
   FLUX's, measured, and must be re-measured per provider before it is reused.

4. **A text encoder may silently truncate.** These prompts run to roughly 2,000 characters with the
   ground clause deliberately last. A model with a 77-token budget receives the first paragraph and
   discards the prohibitions — and the comparison would read that as a style failure rather than as
   truncation. This must be probed before the run, not diagnosed from the output.

5. **Nothing here counts providers, and that is why the seam outlived the challenger.** The
   comparison was briefed three-way, ran two-way because Cosmos 3 Super failed to deploy and was
   deleted, and is one-way today because the owner withdrew Qwen-Image 2512. The registry, the
   backend interface, the dialect seam and the parity check are all kept rather than collapsed —
   the estate has a
   stated 3D and animation gap FLUX cannot fill (`docs/ecosystem/19-new-products.md`). The
   registry is the list; a withdrawn provider keeps its entry because the wire facts in it were
   measured, and measured facts are cheaper to re-read than to re-establish.

## 8. The currency marks: the one asset generated after the verdict

`currency-ember/mark` and `currency-spark/mark` were generated for the EMBER/Sparks rename, after
the comparison had already concluded FLUX decisively. They are worth recording because they are the
cleanest single reproduction of the two defects sections 1 and 4 describe, on a prompt neither model
had seen.

Both models replayed the identical recorded prompt — `verify.py --parity` reports 0 disagreements —
and that prompt says, verbatim: "no gradients, no photographic texture, no bevels, no drop shadows,
no glow, no 3D, no photo-realism", and "no construction lines, no grid, no guides, no ruled margins,
no border, no frame, no bounding box".

* **FLUX** returned both marks flat, on the ash ground, in one accent, with the enclosure difference
  the brief asked for intact — `currency-ember` a circle outline holding a solid flame, and
  `currency-spark` an open flame over three rising strokes with no enclosure at all. Both pass
  `verify.py`'s brand conformance with zero deviations.

* **Qwen** returned, for `currency-ember`, a bevelled three-dimensional ring with a specular
  highlight and a cast shadow, standing on a chamfered stone plinth — a rendered object, not a mark.
  For `currency-spark` it **drew the construction grid**: a ruled square lattice with circle guides
  across the whole frame, inside a drawn bounding box, around a campfire of kindling sticks with
  smoke. That is the failure the `GROUND_CLAUSE` was written to prevent, reproduced in full against
  the clause that names it.

This is the section-1 finding at its sharpest: the challenger reads a flat brief photographically,
and the prohibition list does not move it. Nothing here changes the verdict; it extends it to a kind
of asset — a currency glyph — that the original 94 did not contain.

## 9. The second question: is the verdict partly an artefact of our prompt style?

Everything above is one controlled experiment — every model replays the recorded prompt byte for
byte — and it answers **"which model is better on identical input"**. It cannot answer a second
question, and the truncation probe is what made that second question worth asking.

**Qwen does not truncate.** A 2,238-character prompt with the ground clause deliberately last was
obeyed. So the prohibitions are received in full and disregarded, while the positives are honoured.
The prohibition-last technique this estate built against FLUX therefore does not transfer, and these
briefs are heavy with prohibitions — "no gradients, no photographic texture, no bevels, no drop
shadows, no glow, no 3D", "no construction lines, no grid, no guides, no ruled margins, no border,
no frame, no bounding box". If a model honours positives and disregards negatives, that is close to
the worst possible shape of brief for it, and §8's currency marks would then be partly OUR failure
rather than the model's.

**The hypothesis: restating the prohibitions as positive assertions fixes Qwen's defects.**

### 9.1 How a second prompt style exists without weakening §7's parity

Prompt parity is what makes everything above mean anything, and it may not be softened to make room
for this. A **dialect** is the mechanism: a named, deterministic, total function from the prompt on
record for an asset to the prompt a set is actually sent. `literal` is the identity transform, has
zero rules, and is what every set in this document was generated in. `positive` is one ordered rule
list in `dialects.json`, read by both `dialects.ts` and `dialects.py` — the same one-file-two-loaders
arrangement `providers.json` already uses, so the halves cannot drift.

Parity is now enforced **within** a dialect and **across** dialects, and the second is *stronger*
than the equality it replaces rather than weaker:

| | before | now |
| --- | --- | --- |
| two sets, same dialect | byte-identical prompts | **unchanged** — byte-identical prompts |
| two sets, different dialects | could not happen | the candidate's recorded prompt must be **exactly what its dialect's rules produce from the reference's record** |

Equality could only ever say *"these two strings differ"*. Re-derivation says *"this string is not
what this dialect produces from the record"* — which catches a hand-edited prompt, a rule added
after a run, and a set whose declared dialect is not the one it was generated in. None of those look
like disagreement, so none of them was catchable before. It was tested by hand: editing four words
of one recorded prompt in the positive manifest turned `verify.py --parity` red with the asset named
and both digests printed.

Four further properties hold, and they are asserted rather than described:

* **A candidate still cannot invent an asset.** The transform's input is the reference record, so a
  positive-dialect set with no reference record has nothing to transform and
  `MissingReferencePromptError` fires exactly as before.
* **`promptFor` still takes no provider argument.** A dialect is per-SET and declared in a registry;
  it is not a per-model tweak hidden in a builder.
* **`--reprompt` is refused outside the literal dialect**, because that dialect holds the record
  every other one derives from.
* **"Positive" is measured, not claimed.** The dialect declares the vocabulary it forbids itself —
  *no, not, never, nothing, neither, nor, without, cannot, avoid, omit, exclude* — the transformed
  prompt is scanned for it on word boundaries, and a prompt that still carries any of it **cannot be
  sent**: `promptForProvider` throws before a socket is opened. Every prompt in the pilot passed at
  zero residuals. `python3 dialects.py --residuals` reports the state of the whole corpus.

And nothing lets the two be confused on the page: the dialect is on the provider entry, printed as a
row in `compare.py`'s header, and a cross-dialect selection prints a refusal saying in full that
those columns were not asked the same question.

**Nothing above §9 changed.** The FLUX sets are byte-identical, the existing Qwen candidate set is
byte-identical, and `qwen-image-2512-positive` differs from `qwen-image-2512` in one field: the
dialect. Same model, same deployment, same route, same key, same concurrency — asserted by test, so
a difference in output has exactly one available explanation.

### 9.2 The restatement

The method, in four moves. A forbidden **rendering** becomes a described one; a forbidden **object**
becomes a statement of what occupies that space instead; a forbidden **ground** becomes a
measurement; a forbidden **hue** becomes a coordinate computed from the accent hex itself.

| the estate's clause | the positive restatement |
| --- | --- |
| *Flat fills only: no gradients, no photographic texture, no bevels, no drop shadows, no glow, no 3D, no photo-realism, no weathering.* | *Flat fills only: this is a vector graphic of the kind an SVG file holds. Every shape is one single solid block of colour, exactly the same value at its centre as at its rim, and every edge is a hard boundary where one flat colour stops and the next flat colour begins. The whole image lies on one plane and is built from pure areas of colour, in the register of a printed pictogram on a road sign.* |
| *Draw only the subject itself: no construction lines, no grid, no guides, no ruled margins, no border, no frame, no bounding box, no registration marks, no colour swatches and no drop shadow.* | *Draw only the finished subject: the subject and the flat field are the whole of the image, and the subject's own outline is the only edge anywhere in the frame.* |
| *It is not standing on anything: no floor, no ground plane, no platform, no pedestal, no podium, no horizon line, no cast shadow and no contact shadow.* | *The subject floats free: the #12100f field continues unbroken beneath it and on all four sides of it, right up to its outline, so the last pixel outside its edge is #12100f and the first pixel inside it is the accent.* |
| *— not grey, not taupe, not beige, not cream, not ivory, not off-white, not paper, not parchment, not a gradient, not a vignette, not a radial glow, not a spotlight, not a studio backdrop, and not lighter at the corners or behind the subject.* | *Sample that field at any point — a corner, an edge, the centre, the area directly behind the subject — and it reads exactly #12100f every time: one constant value across the entire field, as though the finished subject had been pasted onto a solid #12100f rectangle.* |
| *Do not repeat it, do not inset a second smaller copy, do not add a thumbnail, a preview box, a framed panel, a tile, a mirror, a variant or a sheet of alternates.* | *The frame holds one instance of one subject at one size, and every pixel outside that one subject is bare background.* |
| *Nothing is written anywhere in this image: no text, no lettering, no numerals, no caption…* | *This image is wordless and consists purely of shape. Every region of the frame is either part of the drawn subject or bare background, and wherever a caption, a label or a signature would sit there is bare background instead.* |
| *…never olive, never teal.* (per accent) | *…sitting at 86 degrees on the hue wheel at 47 percent saturation and 53 percent lightness.* (computed from `#8fbf4f`) |

The **subject sentence is carried through untouched** wherever it holds no prohibition, which is what
keeps the two dialects two phrasings of one brief rather than two briefs. 31 rules, applied in order.

### 9.3 The pilot: 15 assets, the worst-documented failures, Qwen only

Every one measured on the criteria §§1–6 fix, so it is comparable with the run it is testing.
`--common` restricts every set to the assets all three hold, because a spread computed over 15 icons
is not the same measurement as one computed over a brand system.

**Criterion 4, the artefact taxonomy, scored row by row off the side-by-side sheets.** The 15 are
not one repository's: they are micro-brand's 2 currency marks, emberkin's 9 `types` icons and
aetherholm's 4 `icons/resource-*`, each scored in that repository's own
`review/compare/artefacts.json` under `$pilot`. Every row below is the **sum of those three**, and
`claims.py` recomputes the sum and checks this table against it.

| | FLUX (literal) | Qwen (literal) | **Qwen (positive)** | pinned |
| --- | --- | --- | --- | --- |
| framed / bordered / boxed | 0 / 15 | 14 / 15 | **15 / 15** | yes |
| non-flat (3D, bevel, gradient, glow) | 0 / 15 | 15 / 15 | **15 / 15** | yes |
| construction guides drawn | 0 / 15 | 1 / 15 | **0 / 15** | no |
| ground not the flat ash field | 0 / 15 | 8 / 15 | **9 / 15** | yes |
| idea not recognisable from the plan | 0 / 15 | 1 / 15 | **8 / 15** | yes |
| recognisable pastiche of an existing artwork | 0 / 15 | 1 / 15 | **0 / 15** | no |

The two unpinned rows are unpinned because they have no source in all three: neither game set's
reviewer scored a guides row, and aetherholm's did not score pastiche. Those absences are recorded
in `$unscored` rather than filled with zeros, so the sum is refused instead of guessed — an
unscored row and a row scored zero are different statements and only one of them is evidence.
The figures shown are what the repositories that DID score them recorded.

**The literal idea-drift row said 2 and the three scored contributions sum to 1.** Emberkin
recorded 1 of 9 (`types/gale`), aetherholm 0 of 4, and micro-brand's two currency marks are both
recognisable in the literal dialect: `currency-ember` came back as a uniform-weight ring holding a
solid flame with the ash bar below it and clear of it, which is exactly `plan.ts`'s struck coin,
and `currency-spark` as the flame over rising strokes with no enclosure, which is exactly its idea
and the whole distinction from EMBER. Both fail the *rendering* rows heavily — bevel, gradient,
plinth, drawn grid — and neither fails the *idea* row. The prose in "Where it made things worse"
below has always said 1; the table was wrong, and it was wrong in the direction that made the
positive dialect's regression look smaller than it is.

The one cell where the literal column is not already at 15 is `currency-ember`, which Qwen returned
as a plinth-mounted 3D ring with no frame around it. The positive dialect added the frame.

**Criteria 1–3 and 6, arithmetic** (emberkin's 9 type icons; the other two sets agree in direction):

| | FLUX | Qwen literal | Qwen positive |
| --- | --- | --- | --- |
| ground off-target (>0.12 luma) | 0 | 0 | 0 |
| below accent floor | 0 | 1 | 1 |
| delivered ≠ declared | 0 | 0 | 0 |
| accent lightness SPREAD | 0.112 | 0.133 | **0.197** |
| accent hue error SPREAD (deg) | 4.6 | 8.5 | 7.4 |
| ink coverage spread (in-kind) | 0.0652 | 0.1092 | **0.1946** |
| KB per megapixel (median) | 292 | 958 | **851** |
| median retention at 16px | — | — | 77% (brand marks; FLUX 73%) |
| cost | per image | shared deployment hours | **zero marginal hours** — the deployment was already running and, per the deployment record transcribed in §10.6, could not be torn down |

**The one number that is not a defeat.** KB/megapixel — the flat-versus-photographic proxy — fell
from 958 to 851. That is the register moving in the right direction by about 11%, against a FLUX
baseline of 292. It moved; it did not arrive.

**Per asset, the two that matter most.** `currency-ember`: the literal set returned a bevelled 3D
ring on a stone plinth. The positive set returned **the same bevelled 3D disc, with a cast shadow
and a grey plinth bar, now additionally inside a drawn orange rounded-square frame** — the framing
is new, against the clause that replaced "no border, no frame, no bounding box".
`currency-spark`: the literal set drew the construction grid. The positive set **did not draw the
grid** — the one clean win — but returned the flame inside a bevelled ring *and* a cream parchment
panel *and* a teal third hue, against a brief whose subject sentence now reads *"standing alone in
open ground, with bare ash field on every side of it out to the frame edge."*

**Where positive phrasing genuinely helped.** Both assets §8 flagged as a different class of failure
moved: `types/gale` stopped being a recursive grid of framed picture-boxes, and `types/tide` stopped
being a Hokusai pastiche and came back as a plain wave curl. Construction guides went to zero across
all 15. So the dialect *does* pull the model back onto the subject when it has wandered off it.

**Where it made things worse.** Idea drift went from 1 of 15 to 8 of 15. Restating a shape
prohibition as a positive description hands the model more shape vocabulary, and it elaborates on
it: `types/lumen` grew three bevelled spheres, `types/umbra` became a segmented ring rather than a
disc with a crescent bitten out, `icons/resource-skysteel` became a plain cube rather than a notched
ingot. Accent-lightness spread and ink spread both got worse.

### 9.4 Verdict, and why phase 2 was not run

**The hypothesis is rejected.** Framing and bevelling survived a brief containing *not one
prohibition word* — verified, not assumed: the residual gate refuses to send a prompt that still
carries any. 15 of 15 framed and 15 of 15 non-flat, against the literal dialect's 14 and 15. The
positive dialect is the only one of the two that framed *everything*.

That is the model's register. It is not a misread brief, it is not truncation, and no phrasing of
ours moves it: we asked in the negative and it framed everything; we asked in the positive and it
framed everything. **The §8 finding stands and is strengthened** — what looked like it might be our
prompt style was the model.

So phase 2 was **not** run. Regenerating all 235 in this dialect would spend a deployment lifetime
to confirm a negative already established at 15 of 15 with zero variance, and it would also require
writing rules for the 197 recorded prompts the transform does not yet clear (`dialects.py
--residuals`: 38 of 235 clean today). Stopping is the finding.

**What is kept.** The dialect mechanism, because it is the honest way to ask this class of question
and the next model will raise it again; the 15 assets, because they are the evidence; and the
measurement, because "the register did not move under a positively-phrased brief" is a stronger
statement about Qwen than anything in §§1–8, and it could only be made by running it.

**The verdict of §§1–8 is unchanged: FLUX, decisively.**

---

## 10. What the comparison measured, transcribed before the sets were deleted

`compare.py` produced these columns from the three manifests and the delivered pixels. Two of them
no longer exist, so the tool cannot print this again and the last run it printed is copied here.

**Nothing in this section is re-derivable and `claims.py` does not pin any of it.** That is stated
rather than left to be discovered, because a figure that outlives its source while keeping a
confident tone is precisely the defect `claims.json` was written after. Every figure elsewhere in
this document that HAS a live source is still pinned and still re-derived on demand; these are the
ones that stopped having one, and they are labelled instead of quietly demoted.

**The third column is a DIFFERENT PROMPT DIALECT.** It is not a controlled comparison with the
first two and no row here reads across all three. It answers *"which is better when each model is
prompted the way it wants"*, which is a different question from *"which is better on identical
input"* — see §9.1 for why that is a legitimate second question rather than a softening of §7.

### 10.1 Prompt adherence

| | FLUX 2 Pro | Qwen-Image 2512 | Qwen positive |
| --- | ---: | ---: | ---: |
| entries in the set | 98 | 97 | 4 |
| generated (rest are derived) | 56 | 56 | 2 |
| ground off-target (>0.12 luma) | 0 | 3 | 0 |
| median ground luma | 0.0053 | 0.0173 | 0.0125 |
| below the accent floor | 0 | 27 | 0 |
| a third hue dominating the mark | 0 | 31 | 0 |
| delivered size != declared | 0 | 0 | 0 |

**The two rows that decided it.** 27 of the challenger's 56 generations put less of the image in
the surface's own registry accent than the floor allows, and 31 had a third hue covering more of
the frame than the accent did — against zero and zero for the reference. A brand mark drawn in a
colour the registry does not name is not a near miss; it is unidentifiable in the surface switcher,
which is the one job the mark has. Named examples from the run: `explorer/favicon` came back at
`#dacbad` and `worlds/social` at `#989898`, both pale grounds against a dark-only system;
`beacon/mark` was dominated by a hue at 199 degrees that neither the accent nor the company ember
explains.

### 10.2 Style coherence within the set — spread, not average; lower is one hand

| | FLUX 2 Pro | Qwen-Image 2512 | Qwen positive |
| --- | ---: | ---: | ---: |
| accent lightness: bias | +0.063 | -0.102 | -0.061 |
| accent lightness: SPREAD | 0.108 | 0.165 | 0.013 |
| accent hue error: mean degrees | 8.4 | 11.5 | 2.5 |
| accent hue error: SPREAD | 6.9 | 8.3 | 1.1 |
| ink coverage spread (within kind) | 0.0233 | 0.0792 | 0.1328 |
| ground luma spread | 0.0050 | 0.0893 | 0.0010 |
| KB per megapixel (median) | 122 | 834 | 1008 |

**The confound §7.0 warned about, restated so this table is not over-read.** The reference set has
had `normalise_ground.py` run over it and a candidate set as generated has not, so the ground-luma
row is NOT a like-for-like model measurement; the honest reading is each candidate's absolute figure
on its own. The accent, ink and KB/MP rows are unaffected — normalisation rewrites near-ground
pixels only and leaves the artwork alone.

**KB per megapixel is a proxy and not a verdict, and here it is the loudest single number in the
run.** Flat geometric art is large areas of one colour and compresses hard; photographic texture
does not. **122 against 834 is a factor of 6.8 on a brief that says "flat vector"**, which is the
same finding as §10.4's non-flat tally arriving by a completely different route — one measured off
file sizes, one scored by eye. Two independent instruments agreeing is worth more than either.

### 10.3 Legibility at the size the asset is used at

| | FLUX 2 Pro | Qwen-Image 2512 | Qwen positive |
| --- | ---: | ---: | ---: |
| median contrast retained at 32px | 83% | 81% | 85% |
| median contrast retained at 16px | 53% | 63% | 77% |
| marks under 50% at 16px | 11 | 9 | 0 |

**This is the criterion the challenger won, and it is recorded as a win.** At 16px it retained more
contrast than the reference and put fewer marks under the half-way line. The verdict does not turn
on it — a mark that is legible at 16px and drawn in the wrong colour in a bevelled three-dimensional
style is still the wrong mark — but a comparison that only recorded the winner's wins would not be
a comparison. The reference's own weak marks are named in the run output: `foresight/mark` keeps
38% at 16px, `hub/mark` 41%.

### 10.4 Artefact rate, tallied by eye

Scored row by row off `review/compare/compare-mark.png` and `compare-wordmark.png`. The first rows
are counts out of the 12 `mark` assets; the lettering row is out of the 9 `wordmark` assets, which
are the only kind on that sheet carrying a name. Marks and wordmarks only — not the whole 56 — and
that scope is stated because a rate with an unstated denominator is not a measurement.

| | FLUX 2 Pro | Qwen-Image 2512 |
| --- | ---: | ---: |
| accent absent or wrong hue | 0 | 5 |
| construction guides drawn | 0 | 6 |
| frame / border / bounding box | 0 | 5 |
| ground not the brand near-black | 0 | 3 |
| idea not recognisable from `plan.ts` | 0 | 3 |
| inset duplicate of the mark | 0 | 0 |
| lettering: name misspelt or invented | 1 | 0 |
| non-flat rendering (3D, bevel, gradient, glow) | 0 | 6 |

**The reference's one defect is in the table too.** It misspelt or invented a name on one of the
nine wordmarks and the challenger did not. That is the one row where the challenger is clean and
the winner is not, and it is left in place at full size.

### 10.5 Retries and disclosure, free from the manifests

| | FLUX 2 Pro | Qwen-Image 2512 | Qwen positive |
| --- | ---: | ---: | ---: |
| assets needing at least one retry | 16 / 56 | 0 / 56 | 0 / 2 |
| total retries | 26 | 0 | 0 |
| failed attempts logged | 5 | 1 | 0 |
| carries C2PA, measured off the bytes | 2 / 98 | 0 / 97 | 0 / 4 |

**Read §5 before reading this table.** The reference's retries are overwhelmingly `429
RateLimitReached` on a shared serverless endpoint — wire contention on a neighbour's traffic, not
output quality — and the challenger had a dedicated deployment to itself and could not be
rate-limited by anyone. A retry count is a real signal at a 3x difference on comparable wires; this
is not a comparable wire, and the row is here because deleting an inconvenient measurement is worse
than printing one with its caveat attached.

### 10.6 Cost, in the unit each model billed in

These are **not the same number** and were never added, averaged or divided into each other.

- **FLUX 2 Pro: 168 provider image units** over 56 generations, 3.00 per image, 42 derivatives free.
- **Qwen-Image 2512: deployment hours.** **No per-image figure exists or was invented** — the
  endpoint returned `background`, `quality` and `usage` all null, so there was no per-image signal
  at all. That null is load-bearing: this deployment billed per hour of existence and inventing a
  per-image figure would have been a lie with a decimal point on it.

  The deployment record was deleted with the candidate tree, so what it measured is transcribed here
  rather than left as a dangling path. One `GlobalManagedCompute` deployment at capacity 1, named
  `qwen--qwen-image-2512`, served **all three asset repositories one after another**. Its hours are
  therefore joint and cannot be attributed to this repository alone — by asset count, by wall clock,
  by pixels? Each gives a different answer and none of them is a fact, so `compare.py` reported the
  figure and refused to divide it by any set's generation count.

  **Creation time: never observed, and deliberately never guessed.** The deployment existed before
  the run began, and ARM exposes no creation timestamp for a project-scoped managed-compute
  deployment, so its true billed lifetime is LONGER than any window below. Writing a plausible
  timestamp would have turned an unknown into a figure somebody would later quote as measured.

  | | literal-dialect run | positive-dialect pilot |
  | --- | --- | --- |
  | window, first to last generation | 07:43:31Z to 08:25:31Z | 10:57:49Z to 10:59:33Z |
  | observed working hours | 0.7 | 0.03, and MARGINAL |
  | generations in the window, all three repositories | 233 | 15 |
  | this repository's share | 54 | 2 |
  | mean seconds per generation | 10.8 | 6.8 |

  All times 2026-08-03. The 0.7 hours **exclude provisioning and warming, which are billed**: the
  endpoint showed Succeeded in the portal and then returned `500 Model service is unavailable` for
  at least 17 minutes of continuous observed probing before it served anything — which is the §6
  wall-clock estimate's central claim, confirmed. The pilot's 0.03 is marginal hours over a
  deployment that was already running and already billing. That cuts both ways and must not be
  quoted as "the experiment was free": it was free only because a deployment nobody could delete was
  already burning.

  **It was not torn down from here, and the record says so rather than showing a bill that looks
  closed.** A `GlobalManagedCompute` deployment on an AIServices account is project-scoped and none
  of three routes reached it: the ARM account-level deployments collection listed only
  `claude-opus-5` at every api-version tried (2024-10-01, 2025-06-01, 2025-07-01-preview,
  2025-09-01, 2025-10-01-preview); the project-scoped ARM path answered `500 InternalServerError` on
  both GET and DELETE, which is an Azure-side fault; the data-plane path was 200 on GET and 404 on
  DELETE, so it existed for reads only. Deleting it required a human in the Azure AI Foundry portal
  under the `test01cloud01` resource, project `proj-default`. It was confirmed still present at
  08:30:17Z, and that confirmation is the last thing this repository knows about it.

**The operational finding is worth more than either number, and §6 predicted it.** The challenger
ran on dedicated hardware at roughly 11 seconds an image and was idle for most of its billed life,
because a candidate can only be generated once the reference set whose prompts it replays is
complete. That is a fact about how the comparison had to be sequenced, not about the model — which
is exactly why a per-hour provider must never be handed a per-image figure.

---

## 11. The second challenger: gpt-image-2, on the same 56 assets

Written after §0 to §10 and scored against them unchanged. Nothing below reopens a criterion,
reweights one or adds one, because the entire value of having fixed them in advance is spent the
first time a result is allowed to edit the rubric.

**The short version, and it is not a single winner.** gpt-image-2 wins criterion 1's *measurable*
half and criterion 2 outright, by margins that are not close. It loses criterion 1's unmeasurable
half — **is it the idea?** — on the kind the brand is actually built on, and that is the criterion
§1 says no measurement will speak for. Read §11.5 before quoting a row out of §11.4.

### 11.1 What was run, and what it cost to find out

| | |
| --- | --- |
| model | `gpt-image-2`, OpenAI, served by Azure AI Foundry (AIServices S0, Sweden Central) |
| adapter | `openai-images` in `backends.ts` |
| dialect | `literal` — the identity transform, so every prompt is the reference record replayed byte for byte |
| concurrency | **1**, measured and not chosen for caution: two back-to-back requests returned `429 RateLimitReached, "Please retry after 32 seconds"` |
| set | `candidates/gpt-image-2/`, its own `MANIFEST.json`, its own `native/` |

`verify.py --parity` reports **0 disagreements across 2 sets**, which is the precondition for
everything below: the two models answered the same question, character for character, and any
difference in the output is the model's.

**Two of the five kinds could not be generated at their declared size, and were not upscaled.** This
deployment enforces a minimum pixel budget that no documentation states, so it was bisected:
1024x512 (524,288 px) is refused and 1024x640 (655,360 px) is accepted, putting the floor in
(524288, 655360]. The 1024x384 wordmark (393,216 px) and the 512x512 favicon (262,144 px) both fall
under it. They are generated at an exact integer multiple — 1536x576 and 1024x1024, both on the
required 16-grid, both measured — and **Lanczos-downscaled** to the declared size, with the
as-delivered native kept at `candidates/gpt-image-2/native/` and recorded on the entry in four
columns (`nativePath`, `nativeSize`, `nativeSha256`, `nativeC2pa`). `verify.py`'s `check_native`
fails any entry whose native is *smaller* than its declared size, so the one thing this arrangement
could have been used to hide — an upscale reported as a generation — is the one thing it is checked
for on every run.

**Billing is in a third unit.** `usage.output_tokens`, per image, varying with size and quality:
91 at 1280x640 low, 7,024 at 1024x1024 high. It is per-image accounting like FLUX's cost units, so
`compare.py` takes the per-image path — but an output image token and a provider image unit are not
convertible without two price lists this repository does not hold, and §6's rule stands unchanged:
report each figure in its own unit, never add them, and take the money question to the invoices.
`compare.py` now branches on `billing.basis` rather than on `billing.unit`, because a third unit is
exactly the thing a unit-string branch breaks on.

### 11.2 The confound in the ground comparison, restated because it now cuts the other way

§7.0 already says the reference set has been post-processed and a candidate set has not. Against
Qwen that confound *flattered* the reference. Against this challenger it does the opposite, and the
honest thing is to say so with the same emphasis.

**54 of the reference set's 56 generated files have a perfectly flat `#12100f` border** — one unique
colour, standard deviation 0.00 — because `normalise_ground.py` snapped them after generation
(commit `8314af3`). The two exceptions are `currency-ember/mark` and `currency-spark/mark`,
generated after the last normalisation run and never put through it. **Those two are the only
apples-to-apples ground comparison this repository can offer**, and on them gpt-image-2's raw ground
is closer to specification than FLUX's raw ground was.

gpt-image-2's grounds as delivered are `#0b0908` to `#0c0a0a`, with faint vertical banding — 83 to
88 unique colours in a 24-pixel border band, standard deviation about 0.0012 in luma. Against the
`#12100f` target that is **too dark**, by a consistent amount, on every asset. So the finding is a
**bias, not a spread**, and §2 says in as many words which of those two matters: a bias is uniform,
correctable and invisible once the set is seen together; a spread is no house style at all.

**And the two-file apples-to-apples comparison goes decisively the challenger's way.** Measured on
the same 24-pixel border band, the two never-normalised reference marks are:

| | ground, as delivered | unique colours in the band |
| --- | --- | --- |
| target | `#12100f` | 1 |
| `currency-ember/mark`, FLUX raw | `#343235` | 214 |
| `currency-spark/mark`, FLUX raw | `#31302e` | 232 |
| `currency-ember/mark`, gpt-image-2 raw | `#0b0908` | 88 |
| `currency-spark/mark`, gpt-image-2 raw | `#0a0909` | 84 |

`#343235` is mid-charcoal. It is the defect §1 names first — "the first live image of the original
FLUX run came back on a mid-grey taupe field; this is not hypothetical" — surviving in the shipped
set on the only two files the post-process never reached, and it is plainly visible when the two
`currency-ember` marks are put beside each other. gpt-image-2 misses the target in the other
direction by roughly a fifth of that distance. **On raw delivery, the challenger holds the brand
ground and the reference does not.**

**The candidate was deliberately NOT normalised.** Two reasons, and the second is the one that
matters: a candidate set that has been through the reference set's post-process is no longer a
measurement of the model, and it would destroy the C2PA boxes that are §11.4's most decisive row.

**And a hazard that came out of looking at this.** `normalise_ground.py` hardcodes `Path("assets")`
and takes no `--provider`. Running it today, for any reason, would rewrite **the shipped set** —
including the two currency marks that have never been through it, which are the only unnormalised
reference files left and carry the only two C2PA boxes in the repository. It is recorded here rather
than fixed silently because the fix is a signature change to a script the reference set's provenance
depends on, and README §8 names it as something a promotion must not acquire.

### 11.3 What was looked at, by eye — and the distinction it turned on

The measurements are in §11.4. This is criterion 1's other half — *is it the idea?* — and it needs
one distinction stated before any of it makes sense, because the first pass of this review got it
wrong and wrote the opposite conclusion down.

**gpt-image-2 answers the WORDS of `plan.ts`. FLUX answers what the words are FOR.** On asset after
asset the challenger is the more literally compliant of the two and the reference is the one whose
output a person would recognise. Both readings are defensible and they are not the same criterion,
so both are recorded rather than averaged.

- **`currency-ember/mark` — the clearest case, and it goes against first impressions.** `plan.ts`
  asks for "one perfect circle drawn as a single uniform-weight outline, and held centred inside
  that circle one **solid** ember flame — **a teardrop with its point at the top and its base
  flat**", with a short bar below, clear of the circle. gpt-image-2 draws exactly that sentence: a
  clean uniform ring, a solid teardrop with a pointed top and a flat base, a bone bar below and
  clear. FLUX draws a *prettier* flame with an inner negative-space cut-out and a rounded bottom —
  which is **not solid** and **not flat-based**, and is therefore not what the brief says. The first
  pass of this review recorded gpt-image-2's as "a water droplet on a currency called EMBER". That
  criticism is of the plan's own words, not of the model that followed them. What is true is
  narrower and still worth saying: FLUX's reads as *fire* at a glance and gpt-image-2's reads as a
  *droplet*, and for a currency glyph the glance is what it is for.
- **`site/mark` — the same split, with the challenger losing it.** The idea is "one flat baseline
  with a single shallow arc rising from it, like the face of an anvil seen from the front — and one
  **solid** ember flame rising above the centre of that arc. Two elements only." gpt-image-2's
  baseline-with-a-shallow-arc is the more accurate reading — FLUX drew a heavy filled semicircular
  dome on a separate base bar, which is three elements and not shallow — and its flame is genuinely
  solid where FLUX's is not. But the solid form it drew is **a chamfered octagonal blob with a
  single notch**. It reads as a shield or a gem. Here the referent is the whole asset, it is the
  company's own mark, and losing it is not offset by the arc being more correct.
- **`network/mark` — the challenger wins this one outright.** The idea is an outlined teardrop flame
  with a smaller solid flame nested inside, standing on a short bar. Both models draw it. FLUX's
  outer flame meets its plinth in a notched, asymmetric joint and its stroke weight visibly varies;
  gpt-image-2's is symmetric, of one weight throughout, and its accent measures 0.7 degrees off the
  registry hex against FLUX's 7.4. FLUX keeps one detail the challenger drops — the bar "broken by a
  short gap at each end", which gpt-image-2 puts in the middle instead.
- **`site/favicon` — the challenger wins this one too, and it is the one that complicates
  everything.** gpt-image-2 returns a genuine flame, with the inner negative-space notch, sitting on
  a bowed anvil, drawn entirely in the registry accent: one colour, no second hue, which is what the
  brief asks for in those words. FLUX draws its arch in bone — permitted, since the ground line may
  be `#b7ae9b` — but the result is a two-colour mark whose heavier element is the one that is not
  the accent, and its measured accent coverage suffers for it.
- **`site/wordmark`** — both spell "CloudsForge" correctly, with the medial capital `F`. That is
  worth recording, because §5 already flags wide lettered compositions as this brief's weak point
  and predicted the challenger would fail there. It did not. FLUX sets the name in a rounded
  geometric sans beside a proper flame-and-arch lockup; gpt-image-2 sets it in a squared techno face
  with wide, slightly uneven tracking, beside a thin spiky flame over a very shallow arc. The
  challenger's lettering is physically *sharper* — it is a Lanczos downscale from a 1536-wide native
  — and its typeface is further from the estate's own.
- **`site/og`** — the same lockup on a wide field, and neither model invented text on it. The
  challenger's mark is disjoint: the flame floats clear of the arc rather than standing on it.

**The one finding that belongs to criterion 2 rather than to criterion 1.** gpt-image-2's
`site/favicon` and `site/mark` **are not the same drawing**. They are supposed to be one idea at two
sizes; one is a proper flame on an anvil and the other is an octagonal blob on a bridge. FLUX's two
differ in colour and weight and remain recognisably siblings. So the challenger's *colour* coherence
is excellent — §11.4's spread rows are not close — and its *idea* coherence is not. That is why the
numbers and the prose in this section point in opposite directions, and why neither is allowed to
stand in for the other.


### 11.4 What `compare.py` measured, over all 98 assets

Unlike §10, **this table is live**. Both sets are on disk, both manifests are complete, and
`python3 compare.py` reprints every figure below on demand. Nothing here is transcribed from a run
that can no longer be repeated.

Both columns are the `literal` dialect and `verify.py --parity` reports 0 disagreements across
them, so every row is a like-for-like comparison on identical input — with one exception, called
out where it appears and already argued in §11.2.

#### Prompt adherence

| | FLUX 2 Pro | gpt-image-2 |
| --- | ---: | ---: |
| entries in the set | 98 | 98 |
| generated (rest are derived) | 56 | 56 |
| ground off-target (>0.12 luma) | 0 | 0 |
| median ground luma | 0.0053 | 0.0031 |
| below the accent floor | 0 | 1 |
| a third hue dominating the mark | 0 | 0 |
| delivered size != declared | 0 | 0 |

**The single failure is named rather than aggregated: `hub/social`.** It is one asset out of 56 and
it is the same defect that cost the previous challenger the comparison 27 times over, so it is
recorded at full weight rather than rounded to "essentially zero". The ground-luma row is the
confound of §11.2 and is not a like-for-like model measurement in either direction.

#### Style coherence within the set — spread, not average; lower is one hand

| | FLUX 2 Pro | gpt-image-2 |
| --- | ---: | ---: |
| accent lightness: bias | +0.063 | −0.023 |
| accent lightness: SPREAD | 0.108 | **0.049** |
| accent hue error: mean degrees | 8.4 | **2.6** |
| accent hue error: SPREAD | 6.9 | **2.7** |
| ink coverage spread (within kind) | 0.0233 | 0.0238 |
| ground luma spread | 0.0050 | 0.0006 |
| KB per megapixel (median) | 122 | 245 |

**This is the table the challenger wins, and it wins it by a distance.** §2 fixed in advance that
this criterion is judged on *spread* rather than on average, on the argument that a set drawn by one
hand is one whose deviations are consistent. gpt-image-2's accent hue lands 2.6 degrees from the
registry hex on average against the reference's 8.4, and — the row that matters more — the spread of
that error is 2.7 against 6.9. Its accent lightness spread is 0.049 against 0.108. On the terms
§2 set for itself, before either set existed, that is not close.

**KB per megapixel doubles, and §2 says a large gap here means the two models answered in different
registers.** 122 against 245 is a factor of two, not the factor of 6.8 that convicted Qwen of
photographic rendering, and the by-eye tally in §11.3 and `artefacts.json` finds no bevels,
gradients, glows or three-dimensional forms to explain it. What explains it is measurable: the
challenger's grounds carry faint banding — 82 to 125 unique colours in the border band of the twelve
marks, median 101 — where the reference's shipped grounds hold exactly one. **That is the §11.2
confound again and it is doing all the work in this row**: the only two reference files the
normaliser never reached hold 214 and 232. Raw against raw the challenger's ground is about twice as
flat, and this row would invert if either set were compared in the state the model actually
delivered it in.

#### Legibility at the size the asset is used at

| | FLUX 2 Pro | gpt-image-2 |
| --- | ---: | ---: |
| median contrast retained at 32px | 83% | **90%** |
| median contrast retained at 16px | 53% | **67%** |
| marks under 50% at 16px | 11 | **7** |

**The second challenger in a row to beat the reference here, by a wider margin than the first.**
§10.3 recorded Qwen at 63% against 53% at 16px and called it a win the verdict did not turn on;
gpt-image-2 reaches 67% and puts four fewer marks under the half-way line. Some of that is
mechanical and is stated rather than claimed as artistry: the 14 favicons are Lanczos downscales
from a 1024x1024 native (§11.1), and a downscale from a larger original keeps more contrast than a
native small render. The 32px and 16px figures for the marks, which are generated at their declared
1024x1024 in both sets, carry no such advantage.

Both sets' weak marks are named by the tool rather than summarised:

- FLUX 2 Pro: `foresight/mark` 38%, `hub/mark` 41%, `admin/mark` 44%, `hub/favicon` 45%,
  `developers/mark` 47%, `foresight/favicon` 49%.
- gpt-image-2: `foresight/mark` 31%, `trade/favicon` 34%, `trade/mark` 39%,
  `currency-spark/mark` 40%, `lantern/mark` 46%, `market/mark` 49%.

**`foresight/mark` is the worst mark in both sets**, which is a finding about the *idea* — a thin
line, a small node and three dashes — rather than about either model, and it is the strongest
argument in this document that some of what `compare.py` attributes to a model belongs to `plan.ts`.

#### Artefact rate, tallied by eye

Same twelve marks and same nine wordmarks as §10.4, scored off the sheets `compare.py` rebuilt for
this run. The full reasoning per row, including two rows that were nearly scored the other way, is
in `review/compare/artefacts.json`.

| | FLUX 2 Pro | gpt-image-2 |
| --- | ---: | ---: |
| accent absent or wrong hue | 0 | 0 |
| construction guides drawn | 0 | 0 |
| frame / border / bounding box | 0 | 0 |
| ground not the brand near-black | 0 | 0 |
| idea not recognisable from `plan.ts` | 0 | **1** |
| inset duplicate of the mark | 0 | 0 |
| lettering: name misspelt or invented | **1** | 0 |
| non-flat rendering (3D, bevel, gradient, glow) | 0 | 0 |

**Two almost-clean columns tripping one row each, and different rows — which makes this the least
useful table in §11, and saying so is the point of keeping it.** The taxonomy was fixed in §4 to
catch what the previous challenger did, and gpt-image-2 does none of it: no guides, no frames, no
bevels, no pale grounds, no missing accents, and all nine names spelled correctly including `hub`,
where the reference invented "Home on the Ridge" out of its own idea text. The one row it trips is
`site/mark`, and the rubric has no way to record that this is the company's own primary mark rather
than one twelfth of a rate. **A rubric that catches the last model's failures is not the same thing
as a rubric that catches this one's**, and §11.5 is where that gap is answered.

#### Retries, and provenance

| | FLUX 2 Pro | gpt-image-2 |
| --- | ---: | ---: |
| assets needing at least one retry | 16 / 56 | **0 / 56** |
| total retries | 26 | **0** |
| failed attempts logged | 5 | **0** |
| carries C2PA, measured off the bytes | 2 / 98 | **33 / 98** |

**§5 and §10.5's caveat applies again and is weaker this time.** The reference's 26 retries were
overwhelmingly `429 RateLimitReached` on a shared serverless endpoint. This challenger ran against a
rate limit severe enough to force concurrency 1 (§11.1) and still logged zero retries and zero
failed attempts across 56 generations — not because it was never throttled, but because serialising
and sleeping meant it never was. The retry counter measures the *harness* as much as the model, and
this row is a fair comparison of two harnesses rather than of two models.

**The C2PA row is exact and worth reading precisely.** 33 of the 56 generations arrive carrying a
C2PA box and 23 do not, and the 23 are not a sample: they are exactly the 14 favicons and 9
wordmarks that had to be Lanczos-downscaled from a larger native (§11.1). Re-encoding a PNG through
Pillow drops the box. **All 23 of those natives carry C2PA at `candidates/gpt-image-2/native/`**, so
no provenance was lost by the derivation — it moved to the as-delivered file, which is where the
manifest's `nativeC2pa` column says to look for it. Against the reference's 2 of 98, this is a
sixteen-fold improvement in signed provenance, and it is the one row in §11 where the challenger's
advantage is a property of the *vendor* rather than of the model.

#### Cost, in the unit each model billed in

These are **not the same number**, were never added, averaged or divided into each other, and
`compare.py` refuses to derive a ratio between them.

- **FLUX 2 Pro: 168 provider image units** over 56 generations, 3.00 per image, 42 derivatives free.
- **gpt-image-2: 282,372 output image tokens** over 56 generations, 5,042.36 per image, 42
  derivatives free.

Both bill per image and they still do not compare, which is the case §6 anticipated in principle and
this run produced in fact: an output image token and a provider image unit are convertible only
through two price lists this repository does not hold and will not guess at. What *is* comparable is
each provider against its own runs, and the useful figure for the next run is the second one:
**5,042 output image tokens is the cost of one 1024x1024 image at `quality: "high"`**, against 91 for
one 1280x640 at `low`. The quality parameter, not the pixel count, is what this endpoint charges
for.

### 11.5 Verdict: by kind, because there is no single winner

**The recommendation is: do not promote gpt-image-2 to `assets/` today.** Keep it on disk as a
candidate, keep the switch reversible, and read the rest of this section before treating that as a
loss for the challenger, because on five of the eight tables above it is ahead.

**What the challenger wins, and none of these are marginal.** Colour discipline is the clearest:
2.6 degrees of accent hue error against 8.4, with the spread of that error at 2.7 against 6.9, on a
criterion §2 fixed in advance as the one that decides whether a set looks like one hand. Legibility
at the size the asset is used at: 67% retention at 16px against 53%, four fewer marks under the
half-way line. Lettering: nine names of nine, against a reference that shipped "Home on the Ridge".
Provenance: 33 signed files against 2. And literal compliance clause by clause — five valance
strokes where the reference draws four scallops, a solid flat-based teardrop where the reference
draws a prettier flame the brief does not describe, one accent and no second hue where the reference
lights `worlds`' window in ember on a green mark.

**What it loses is one thing, and the one thing is `site/mark`.** The company's own primary mark
came back as a chamfered octagon with a notch, standing on a single bowed bar, and it reads as a
shield or a gem rather than as a flame over an anvil face. Every measurement passes it. It is flat,
it is one accent, the ground is right, it is legible at 16px, and it is arguably a *more* accurate
reading of the sentence in `plan.ts` than the reference's. It is still not the mark. And its
`site/favicon` sibling — which is a genuinely good flame, better than the reference's on colour —
is not the same drawing, so the surface that every other surface is a family member of does not have
a coherent identity in this set. **§1 said no measurement would speak for this criterion and then a
run happened where nothing else disagreed with it.**

By kind, on all 98:

| kind | better set | why |
| --- | --- | --- |
| `mark` (14) | **split, reference on balance** | The challenger draws the written construction more accurately on `market`, `worlds`, `developers`, `trade`, `currency-spark` and `network`; the reference draws the thing the construction is *for*. `site/mark` decides it, because that one is not a tie-break, it is the mark. |
| `favicon` (14) | **gpt-image-2** | Sharper by construction (Lanczos from a 1024 native), better colour, and the best single asset in either set is arguably its `site/favicon`. `trade/favicon` at 34% retention is its one weak one. |
| `wordmark` (9) | **gpt-image-2 on correctness, reference on type** | Nine names right against eight. But the letterforms are a squared techno face with wide, uneven tracking, further from the estate's own type than the reference's rounded geometric sans, and the mark component is set noticeably small beside them. |
| `og-source` (11) | **reference** | The challenger's lockups come apart on a wide field — `site/og`'s flame floats clear of the arc it should stand on — and a composition failure on a 1200x630 card is visible at full size, where a mark's failure has to be looked for. |
| `social` (8) | **reference** | The one accent-floor failure in the entire run is `hub/social`, and social cards are the assets seen by people who have never seen the brand before. |
| everything derived (42) | **neither** | 28 favicons, 11 `og` crops, 2 icons and 1 avatar, cut by `derive.py` from the generated file by identical code in both sets. Any difference here is inherited from its source and is not a measurement of the model. |

**What would change the verdict, and it is cheap.** The challenger logged zero retries and zero
failed attempts, so a targeted regeneration of `site/mark` — one image, roughly 5,000 output image
tokens and under two minutes — is all that stands between this set and a genuine argument for
promotion. `generate.ts` resumes from its own manifest and would re-bill nothing else. That was not
done for this evaluation on purpose: **re-rolling the one asset that failed, and only that one,
until it passes is how a comparison stops measuring a model and starts measuring the patience of the
person running it.** The reference set's 26 retries were `429`s, not re-rolls for taste, and the
challenger is entitled to the same rule.

**The verdict is not only prose: `promote.py` refuses to make the switch.** It was run for real to
prove the round trip, and the run found something no amount of reading would have. `verify.py`
holds brand conformance fatal for the SHIPPED set and reported-not-fatal for a candidate — the split
argued in §11.1's tooling and correct on its own terms — so `hub/social` at 0.32% accent was a
`warn` line for this entire evaluation and became `FAIL hub social` one second after the tree
landed on `assets/`. **A set can pass every gate as a candidate and turn the repository red by being
promoted.** `verify.py --as-shipped` now asks the question a promotion actually cares about, and
`promote.py` uses it as the pre-move gate, so the switch is refused today with the failing asset
named. The verdict above and the tooling now agree, and they agree because the tooling was corrected
rather than because the verdict was.

**Two defects in the switch itself, both found by running it and both fixed on this branch.** The
first: the collision check asked `dst.exists()` over every planned move, and the winner's
destinations are `assets/` and `MANIFEST.json` at the root — occupied by the outgoing reference
until the first two moves carry it away. **No promotion could ever have succeeded**, and nobody
knew, because the completeness gate upstream of it failed first for the whole life of the branch
(`site/avatar@1024x1024` had no derivation recipe until `derive.py` was given one). It now walks the
plan in order and treats a path as free once an earlier move vacates it. The second is cosmetic and
recorded anyway: the emptied `candidates/<winner>/` was left behind, which reads as "there is a set
here" to everyone except the registry. **The round trip was then run twice and `assets/` and
`MANIFEST.json` came back byte-identical both times** — one sha256 over the whole tree, taken
before and after — which is the property the brief's "the old artwork must remain byte-identical"
depends on and the only one worth proving by execution.

**And one honest limit on all of the above.** This is one run of 56 images at one setting
(`quality: "high"`), on one brief, judged against a set that has had a post-process the candidate
has not (§11.2), by one pair of eyes that got `currency-ember` backwards on the first pass and had
to write the correction into §11.3. The measurements are reproducible on demand and the by-eye
scoring is not. Where the two disagree — and in this section they disagree more than in any other —
the tables are what can be checked and the prose is what has to be argued with.

## 12. The repair run, and the promotion §11.5 argued against

§11.5 recommended against promoting gpt-image-2, named exactly what would change its mind, and then
said the change was not going to be attempted:

> a targeted regeneration of `site/mark` — one image, roughly 5,000 output image tokens and under
> two minutes — is all that stands between this set and a genuine argument for promotion. That was
> not done for this evaluation on purpose: **re-rolling the one asset that failed, and only that
> one, until it passes is how a comparison stops measuring a model and starts measuring the patience
> of the person running it.**

**It has now been done, deliberately and as a separate act from the evaluation**, which is why it is
a new section rather than an edit to §11. §11 is the comparison and it still says what it said. This
section is the repair, and it reverses §11.5's recommendation.

### 12.1 What was actually done to the candidate, in full

Two things, and only the first is a re-roll.

**Two assets were regenerated. Not thirty-seven, not the whole set.**

| asset | draws | why it stopped there |
| --- | ---: | --- |
| `site/mark@1024x1024` | 1 | Draw 2 came back a tapered flame curling over the bowed arc. §11.5's complaint — "a chamfered octagon with a notch … it reads as a shield or a gem" — does not describe it, so there was nothing left to re-roll for. |
| `hub/social@1280x640` | 3 | Draws 2 and 3 both came back at **0.07%** and **0.10%** accent against a 0.5% floor, worse than draw 1's 0.32%. Draw 4 passes at **1.38%**. Four draws is where this stopped, and §12.3 is the part of that outcome worth arguing with. |

Everything else that changed changed for one reason: **the candidate had never been ground-normalised
at all**, and §11.2 spent a page explaining why the ground row could not be read as a model
comparison because of it. It can be read now.

- The reference measured 98 of 98 grounds at exactly `#12100f`. The candidate measured **0 of 98**,
  with delivered grounds running `#090606` to `#0d0c0b` — every one of them *darker* than the ash
  value, which is why `verify.py`'s luma **ceiling** passed all 98 and nothing complained for the
  whole life of the branch.
- The cost of not noticing would not have been subtle. `materialise.py` copies these files onto
  seventeen web surfaces that set `--cf-bg` to `#12100f` in CSS, so every mark, favicon, OG card and
  social banner in the estate would have sat in a visibly darker square on a page whose own
  background is the value the artwork was supposed to be drawn on.
- The repair is the repository's own tool and nothing else: `normalise_ground.py`, run once over the
  candidate tree, 98 checksums re-recorded. The artwork is untouched — the script rewrites
  near-ground pixels only.

`brand/normalise_ground.py` is **not** the script of the same name in the three sibling repositories,
and finding that out cost a full revert of the reference set. It takes no `--provider`, resolves
`assets/` and `MANIFEST.json` relative to the **current working directory**, walks every png
including derivatives, and is **not idempotent** — a second full pass over an already-normalised tree
remapped a further 148 pixels and shrank `worlds/wordmark` from 32,252 to 30,707 bytes. Point it at a
candidate with `cd candidates/<id> && python3 ../../normalise_ground.py`, run it once, and because it
normalises derivatives in place the order here is **derive then normalise**, which is the opposite of
the order the sibling repositories need.

### 12.2 A defect the candidate gates could not see: a derivative cut from a mark that no longer exists

Re-rolling `site/mark` and re-running `derive.py` left `site/org-avatar-1024x1024.png` **unchanged on
disk** — still the avatar cut from the superseded octagon, still passing every check, still recorded
in the manifest as current. `already_derived` compared the derivative to its own recorded checksum,
found them equal, and kept it. Nothing in the set was in a position to notice, because the stale file
was internally consistent; only its *source* had moved.

`derive.py` now compares the source too, by time rather than by checksum: a derivative whose
`generatedAt` predates its parent's is re-cut. Missing or unparseable timestamps answer "cannot prove
it is stale" and keep the file, so the guard can only ever cause extra work, never silent loss. Both
sets were re-derived after the fix: 42 entries each, **zero rewrites** beyond the one avatar, which
is the result that says the guard is narrow.

This would have shipped the company's GitHub organisation avatar as a mark the company had already
rejected. It is the second finding in this run of the same shape as §11.5's `promote.py` discovery —
**a candidate can pass every gate and still be wrong in a way only promotion or execution reveals** —
and it is worth stating plainly that both were found by running things rather than by reading them.

### 12.3 What the four draws of `hub/social` actually show, including the part that is not flattering

The honest reading of draw 4 is not "the model got it right on the fourth try".

All four draws put the Forge Hub ridge in **bone**, not in ember, with a small solid ember spark
above the middle peak. Draws 1–3 failed the accent floor because a spark alone is not 0.5% of a
1280×640 field. Draw 4 passes at 1.38% because its ridge and its type are drawn in a *warmer* bone —
`#ede1d0` is the median of the pixels the check counted — not because the ridge became ember. **The
gate went green on a colour decision the gate was not written to have an opinion about.**

Whether that is a defect depends on which text is authoritative, and it is worth noticing that the
model has the better claim. `plan.ts` says: *"the **ash** ridge drawn as one jagged skyline of four
straight segments … with a single solid **ember** spark held centred in the empty space directly
above its middle peak."* An ash-coloured ridge under an ember spark is that sentence. The reference's
all-ember ridge is prettier and is not that sentence. The same reading holds across the kind: on the
eight social cards and eleven OG cards the challenger draws each surface's mark in **its own registry
accent** — amber for `create`, blue for `foresight`, violet for `market`, teal for `trade`, green for
`worlds` — and `hub` is the one surface whose brief names a colour for the mark that is not its
accent.

So this section does not claim the challenger won `hub/social`. It records that the asset now clears
the floor, that it clears it for a reason the floor does not measure, and that **anyone who wants the
reference's reading should say so in `plan.ts`, where the disagreement actually lives, rather than in
the accent floor.**

### 12.4 What `compare.py` says now, against the same reference, on the same 98 assets

Re-run in full after the two re-rolls and the normalisation. Winners in bold.

| | FLUX 2 Pro | gpt-image-2 |
| --- | ---: | ---: |
| below the accent floor | **0** | **0** |
| third hue dominating | **0** | **0** |
| accent hue error: mean deg | 8.4 | **2.6** |
| accent hue error: SPREAD | 6.9 | **2.6** |
| accent lightness: SPREAD | 0.108 | **0.044** |
| ink coverage spread (in-kind) | 0.0233 | **0.0227** |
| ground luma spread | 0.0050 | **0.0000** |
| median contrast retained at 32px | 83% | **90%** |
| median contrast retained at 16px | 53% | **68%** |
| marks under 50% at 16px | 11 | **7** |

Two rows carry the weight.

**The ground row is now a real comparison and it was not one before.** Both sets have had the same
post-process from the same script; §11.2's confound is discharged rather than argued around.

**The legibility rows are the reason this set promotes and its three siblings do not.** In
`emberkin-assets` and `aetherholm-assets` the challenger's outline register costs it the 16px table
outright — 13 marks under the half-way line against 9, and 37 against 8. Here the register goes the
other way: the challenger's marks are *solid* and it is the reference that hollows out, 7 under the
line against 11, with 15 points more contrast retained at the size a favicon is actually seen at.
**The same model, the same setting, the same literal dialect, and the opposite result on the one
criterion that decided all four repositories.** That is a fact about the briefs, not about the model,
and it is the most useful thing this run found.

### 12.5 Verdict: promote, and what promoting costs

**gpt-image-2 is promoted to `assets/` and flux-2-pro is demoted to `candidates/flux-2-pro/`.**
`verify.py --provider gpt-image-2 --as-shipped` reports **0 failures** with conformance and
completeness held fatal, every measured criterion §2 fixed in advance now favours the challenger, and
§11.5's single named blocker is a flame over an anvil face.

**What is worse after the switch, stated here rather than left to be found.**

1. **The wordmark type.** Nine names spelled correctly against the reference's eight, in a squared
   techno face with wide, uneven tracking that is further from the estate's own type than the
   reference's rounded geometric sans, with the mark component set noticeably small beside it. §11.5
   scored this a split and nothing in the repair run changed it. It is the largest standing cost of
   this promotion and it is a typography objection, not a measurement.
2. **`hub/social`'s bone ridge**, per §12.3.
3. **Six web repositories are carrying brand chrome that nothing compares.** `sync-chrome.py --dry-run`
   against the *reference* set reports 23 files that would be replaced — favicons and marks in
   `hub-web`, `lantern-web`, `site`, `status-web`, `web-template` and one more that have been stale
   since before this trial began. The promotion does not cause that and does not fix it; the sync
   does, and it is a separate act with a separate diff.

**The switch is one variable and it is reversible in both directions.** `providers.json`'s
`reference` names the shipped set; `promote.py` moves five lines of it and vacates the outgoing set
into `candidates/flux-2-pro/` rather than deleting it; the round trip was executed twice during §11
and `assets/` came back byte-identical both times under one sha256 over the whole tree.
`python3 promote.py --provider flux-2-pro` puts it back, today or in a year.

**And the limit that has not moved.** This is still one run at one setting on one brief, judged by
one pair of eyes, and §11.5's admission stands: the tables are what can be checked and the prose is
what has to be argued with. What §12 adds is that two of §11's tables were measuring a missing
post-process rather than a model, and that the one asset §11.5 said would decide it was decided by
looking at it.
