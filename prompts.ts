/**
 * The prompt for one asset, and the rule that guarantees three models receive the same one.
 *
 * Lifted out of `generate.ts` unchanged. It is its own module now for two reasons: `parity.test.ts`
 * has to be able to call it without starting a generation run, and the signature is the load-bearing
 * part of the guarantee — see below.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * ## PROMPT PARITY
 *
 * The comparison is worthless if the three models are asked different questions. That is enforced
 * three ways, in increasing order of how hard it is to defeat:
 *
 * 1. **`promptFor` has no provider parameter.** There is nowhere to put a per-model tweak. The
 *    provider-specific envelope — the route, the auth header, the body field names — lives
 *    entirely in `backends.ts`, on the other side of an interface that takes the prompt as an
 *    opaque string.
 *
 * 2. **Once an asset is on record, EVERY provider replays that record — including the reference.**
 *    `referencePrompts()` reads the string that was actually sent, out of the reference
 *    MANIFEST.json, and every run posts that string byte for byte. Only an asset that has never
 *    been generated computes a fresh prompt, and only the reference provider may do so, because
 *    the reference is the thing that establishes the record.
 *
 *    The first version of this module let the reference compute and only candidates replay. The
 *    parity test rejected it within a minute, and it was right to: `promptFor` no longer produces
 *    what 36 of the 54 recorded assets were actually generated from — the favicon, lettering and
 *    accent hardening clauses were added partway through the original run — so regenerating
 *    `site/mark` for FLUX would have asked it a 1,987-character question while Qwen and Cosmos
 *    were replaying the 1,653-character one. Three sets, still passing every other check, no
 *    longer comparable, and nothing on screen to say so.
 *
 *    Changing the question for an asset that already has one is therefore a deliberate act with a
 *    flag on it: `generate.ts --reprompt`, reference-only, after which the candidate sets for those
 *    assets are stale and `verify.py --parity` says so until they are regenerated.
 *
 *    This is also why the exercise needs no shared prompt library across the three asset
 *    repositories: replay does not need to know how a prompt is built, only what it was.
 *
 * 3. **`verify.py --parity` fails if any asset carries different prompts in two different sets.**
 *    That runs in CI, on the artefacts, and it is the check that would catch a backend quietly
 *    appending a negative prompt or a text encoder silently truncating a request the harness
 *    thought it had sent whole.
 *
 * The one thing none of this can guarantee is that the three models *perceive* the same prompt. A
 * text encoder with a 77-token budget receives the first paragraph and discards the ground clause,
 * which is deliberately last. That is a measurement to make against each live endpoint before the
 * run, not something a test can assert — it is `UNKNOWNS`' PROMPT LENGTH entry in `backends.ts`.
 *
 * ## AND WHAT A DIALECT CHANGES, WHICH IS ONE LINE AND NOT THE GUARANTEE
 *
 * That probe came back with a result the design above did not anticipate: **Qwen does not truncate.**
 * It receives the prohibitions in full and disregards them while honouring the positives. So the
 * prohibition-last technique this estate built against FLUX does not transfer, and the recorded
 * briefs — which are prohibition-heavy — may be close to the worst possible shape of brief for it.
 * That makes a second question worth asking: not "which model is better on identical input", which
 * the sets above answer, but "which is better when each is prompted the way it wants".
 *
 * A **dialect** is how that question is asked without damaging the first one. It is a named,
 * deterministic, total function from the recorded prompt to the prompt a set is sent; `literal` is
 * the identity and is what every set here was until now. Parity is asserted **within** a dialect
 * exactly as points 1–3 above assert it, and **across** dialects it is asserted by RE-DERIVATION,
 * which is strictly stronger than the equality it replaces: `verify.py --parity` applies the
 * dialect's rules to the reference's record and fails on one differing byte. `dialects.ts` holds the
 * full argument and `dialects.json` holds the rules.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

import { readFileSync, existsSync } from 'node:fs'

import { requestSizeFor, specFor, sizeString, type AssetSpec } from '../studio/src/specs.ts'
import { buildPrompt } from '../studio/src/prompt.ts'

import { REFERENCE, manifestPathOf, providerById } from './providers.ts'
import { LITERAL, applyDialect, residualNegations, ResidualNegationError } from './dialects.ts'
import type { PlannedKind, PlannedSurface } from './plan.ts'

/**
 * The one paragraph this run adds after the service's own prompt, and why it is here.
 *
 * `studio/src/prompt.ts` already names the ground — "high contrast against a warm ash ground
 * (#12100f)" — but it names it in the MIDDLE of the style paragraph, and the first live image of
 * this run came back on a mid-grey taupe field with faint construction guides ruled across it: a
 * margin box, a centre cross and a quarter grid. Both are the same failure. A constraint stated
 * mid-paragraph is treated as a suggestion, and the words "on a single grid" in the style
 * paragraph are read by the model as an instruction to DRAW the grid rather than to build on one.
 *
 * So the ground is restated last, as its own paragraph, alongside the prohibitions — which is the
 * placement `prompt.ts`'s own header argues for: "a prohibition placed before the subject is
 * routinely ignored by image models".
 */
export const GROUND_CLAUSE =
  'The background is one flat, uniform, unbroken near-black warm ash field, hex #12100f, ' +
  'filling the entire frame from edge to edge — not grey, not taupe, not beige, and not lighter ' +
  'at the corners. The artwork is bright against a dark ground, never dark against a light one. ' +
  'Draw only the finished mark: no construction lines, no grid, no guides, no ruled margins, no ' +
  'border, no frame, no bounding box, no registration marks, no drop shadow.'

/**
 * Per-kind hardening, each clause written against a defect seen in this run's own output.
 *
 * These are not guesses about what a model might get wrong. Every one of them names something that
 * came back wrong on the first full pass of 44 images and was found by looking at a contact sheet:
 *
 *   * **favicon — the inset duplicate.** Three of eleven favicons came back as the mark PLUS a
 *     second, smaller, framed copy of itself in the lower half, like a preview thumbnail pasted
 *     into the artwork.
 *   * **wordmark, og, social — the invented name.** `market`'s social banner came back reading
 *     "Sftware Company": a phrase from the style paragraph's own first sentence leaking into the
 *     artwork as text.
 *   * **every kind — the unaccented mark.** `hub`'s OG card drew the ridge in mid-grey and
 *     `worlds` drew its whole settlement in white — a mark that cannot be told from any other
 *     surface's, which is the entire job the accent does.
 */
export const HARDENING: Readonly<Record<PlannedKind, string>> = {
  mark: '',
  favicon:
    'Draw the mark exactly ONCE, filling the frame. Do not repeat it, do not inset a second ' +
    'smaller copy, do not add a thumbnail, a preview box, a framed panel, a tile, a mirror or a ' +
    'variant beside or below it. One mark, one frame, nothing else in the picture.',
  wordmark: '',
  og: '',
  social: '',
}

/**
 * The lettering clause, for the three kinds that carry a name.
 *
 * `prompt.ts` already states the spelling. This restates it as an exclusion — that string and no
 * other string — because the observed failure was never a misread of the name. It was a SECOND
 * phrase arriving that nobody asked for, from the style paragraph ("Sftware Company") and from
 * this repository's own vocabulary (`trade`'s OG card captioned "Quench Curve", its baseline
 * annotated "ash ridge"). The name is also spelled out character by character, which is the one
 * thing that reliably moves an image model off an invented string — `worlds` produced "Cartre
 * Pere" from nowhere before this was added.
 */
export function letteringClause(name: string): string {
  const spelled = name
    .split('')
    .map((character) => (character === ' ' ? 'space' : character))
    .join('-')
  return (
    `The ONLY text anywhere in this image is the name "${name}", set once. Spelled character by ` +
    `character it is: ${spelled}. Nothing else is written anywhere in the frame: no tagline, no ` +
    'strapline, no subtitle, no second line, no caption, no label, no annotation, no callout, no ' +
    'legend, no axis title, no word naming a part of the drawing, no word taken from any ' +
    'description of the drawing, no words such as "software", "company", "platform", "brand", ' +
    '"curve", "ridge", "spark", "flame", "awning" or "horizon", no invented words, no misspelled ' +
    'or partial words, no repeated name, no URL, no dot-com and no registered mark. If any other ' +
    'string would appear, leave that area empty instead.'
  )
}

/**
 * The accent clause. Applied to every kind, because the failure was not confined to one.
 *
 * The ridge exemption is deliberate and comes from design-system.md §5: "a ground line — the ash
 * ridge, in `--cf-fg-mute`" plus "one accent element — the product's idea, in `--cf-accent`". Bone
 * `#b7ae9b` is that `--cf-fg-mute`. Forbidding a second colour outright would forbid the family's
 * own construction.
 */
export function accentClause(accent: string): string {
  return (
    `Every drawn element is filled or stroked in ${accent} — that exact colour, at full ` +
    'strength. The only permitted exception is the ground line, which may instead be a muted bone ' +
    `#b7ae9b. Nothing is drawn in plain white, plain grey or the ground colour, and ${accent} is ` +
    'the dominant colour of the artwork rather than a small detail on it.'
  )
}

export const LETTERED: ReadonlySet<PlannedKind> = new Set<PlannedKind>(['wordmark', 'og', 'social'])

/**
 * Build the prompt for one asset. **No provider parameter, deliberately** — see the file header.
 */
export function promptFor(surface: PlannedSurface, spec: AssetSpec, kind: PlannedKind): string {
  const parts = [
    buildPrompt({
      kitName: surface.name,
      accent: surface.accent,
      stylePrompt: surface.idea,
      spec,
    }),
    GROUND_CLAUSE,
    accentClause(surface.accent),
    LETTERED.has(kind) ? letteringClause(surface.name) : '',
    HARDENING[kind],
  ]
  return parts.filter((part) => part.length > 0).join('\n\n')
}

/* ------------------------------------------------------------------ asset identity */

/**
 * How one planned asset is named in a manifest, computed in ONE place.
 *
 * `generate.ts`, the resume filter and the prompt replay all have to agree about the key of an
 * asset that has not been generated yet, and they used to derive it independently from
 * `requestSizeFor` three times over. A cropped kind is recorded as `<kind>-source` at the size that
 * was actually asked for, because the as-delivered file is the one that still carries its C2PA
 * chunk and it is not the shippable artefact.
 */
export interface AssetIdentity {
  readonly spec: AssetSpec
  readonly requested: { readonly width: number; readonly height: number }
  readonly onGrid: boolean
  /** `og` or `og-source`. What goes in the manifest's `kind` column. */
  readonly recordedKind: string
  readonly declaredSize: string
  readonly fileName: string
  /** `site/mark@1024x1024`. The manifest key, and the key parity is judged on. */
  readonly key: string
}

export function identityFor(surface: PlannedSurface, kind: PlannedKind): AssetIdentity {
  const spec = specFor(kind)
  const requested = requestSizeFor(spec)
  const onGrid = requested.width === spec.width && requested.height === spec.height
  const recordedKind = onGrid ? kind : `${kind}-source`
  const declaredSize = onGrid ? sizeString(spec) : `${requested.width}x${requested.height}`
  const fileName = onGrid
    ? `${kind}-${sizeString(spec)}.png`
    : `${kind}-${requested.width}x${requested.height}-asdelivered.png`
  return {
    spec,
    requested,
    onGrid,
    recordedKind,
    declaredSize,
    fileName,
    key: manifestKey(surface.key, recordedKind, declaredSize),
  }
}

export const manifestKey = (surface: string, kind: string, size: string): string =>
  `${surface}/${kind}@${size}`

/* ------------------------------------------------------------------ the replay */

export class MissingReferencePromptError extends Error {
  constructor(key: string) {
    super(
      `no reference prompt recorded for ${key}. A candidate set replays the prompt the reference ` +
        'set actually sent rather than recomputing one, so an asset the reference has never ' +
        'generated cannot be generated for a candidate either — generating it from freshly ' +
        'computed clauses would put a different question to this model than to FLUX, which is the ' +
        'one thing the comparison may not do. Generate it for the reference provider first.',
    )
    this.name = 'MissingReferencePromptError'
  }
}

export class RepromptNotForCandidateError extends Error {
  constructor(providerId: string, key: string) {
    super(
      `--reprompt was used with --provider ${providerId} on ${key}. Only the reference provider ` +
        'may change the question an asset is asked, because the reference manifest is the record ' +
        'the other sets replay. Reprompt against the reference first, then regenerate the ' +
        'candidates so all three sets are answering the same thing.',
    )
    this.name = 'RepromptNotForCandidateError'
  }
}

/**
 * `--reprompt` is refused outside the literal dialect, and this is a separate refusal from the one
 * above rather than an extension of it.
 *
 * The literal record is the INPUT every dialect derives from. Reprompting in a derived dialect
 * would mean writing a new record that no dialect produced from anything, and the moment that
 * exists `verify.py --parity` can no longer re-derive the set — the cross-dialect guarantee stops
 * being checkable while every file involved still looks correct. That is precisely the class of
 * silent failure the whole parity design exists to make impossible.
 */
export class RepromptNotForDialectError extends Error {
  constructor(providerId: string, dialect: string, key: string) {
    super(
      `--reprompt was used with --provider ${providerId} on ${key}, which generates in the ` +
        `"${dialect}" dialect. Only the "${LITERAL.id}" dialect may change the question an asset ` +
        'is asked, because it holds the record every other dialect is DERIVED from — a reprompt ' +
        'here would write a record nothing produced, and verify.py --parity could no longer ' +
        're-derive this set from the reference. Reprompt against the reference, then regenerate.',
    )
    this.name = 'RepromptNotForDialectError'
  }
}

interface ManifestShape {
  readonly assets?: ReadonlyArray<{
    readonly surface: string
    readonly kind: string
    readonly declaredSize: string
    readonly prompt: string
    readonly derivedFrom: string | null
  }>
}

let cached: Map<string, string> | null = null

/**
 * Every prompt the reference set actually sent, keyed the way `identityFor` keys an asset.
 *
 * Read from the manifest rather than recomputed from `promptFor`, and that distinction is the
 * whole point: the manifest records what WAS sent, and the code computes what WOULD BE sent. Those
 * two have already drifted apart in this estate — 80 of aetherholm-assets' 101 entries carry a
 * prompt that differs from the one its own PLAN.json now derives, because the clauses were edited
 * after the run. A candidate replaying PLAN.json would therefore have been asked a different
 * question from FLUX while every file involved looked correct.
 */
export function referencePrompts(): Map<string, string> {
  if (cached) return cached
  const path = manifestPathOf(REFERENCE)
  const out = new Map<string, string>()
  if (existsSync(path)) {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as ManifestShape
    for (const entry of parsed.assets ?? []) {
      // Derivatives inherit their parent's prompt and are not generated; replaying one would ask
      // the model for a file that is supposed to be cut from another file.
      if (entry.derivedFrom) continue
      out.set(manifestKey(entry.surface, entry.kind, entry.declaredSize), entry.prompt)
    }
  }
  cached = out
  return out
}

/**
 * The prompt to send, for this provider, for this asset.
 *
 * Replay if there is a record; compute only where there is none, and only for the reference. The
 * effect is that the question an asset is asked is fixed the first time it is asked, for every
 * model, until somebody deliberately changes it with `--reprompt`.
 *
 * **And then translate it into the provider's dialect.** That is one line and it is the only line
 * in the repository where a provider's prompt differs from the record, which is what keeps the
 * guarantee auditable. Note what it does NOT change:
 *
 *   * the record is still the reference set's, and still the only input — a positive-dialect
 *     candidate STILL cannot generate an asset the reference has never generated, because the
 *     transform has nothing to be applied to. `MissingReferencePromptError` fires exactly as before,
 *     which is asserted for every candidate regardless of dialect;
 *   * `promptFor` still takes no provider argument, so there is still nowhere to put a per-MODEL
 *     tweak. A dialect is per-SET and declared in a registry, not per-model and hidden in a builder;
 *   * within a dialect every provider gets the byte-identical string, because `applyDialect` is a
 *     pure function of the record and the dialect id.
 *
 * The residual check is the last gate: a "positive" prompt that still carries prohibitions would be
 * a set whose label is untrue of its own contents, so it refuses to be sent at all rather than
 * being generated and caught later — on a per-hour deployment, later costs money.
 */
export function promptForProvider(
  providerId: string,
  surface: PlannedSurface,
  kind: PlannedKind,
  options: { readonly reprompt?: boolean } = {},
): string {
  const identity = identityFor(surface, kind)
  const recorded = referencePrompts().get(identity.key)
  const dialect = providerById(providerId).dialect

  if (options.reprompt) {
    if (providerId !== REFERENCE.id) throw new RepromptNotForCandidateError(providerId, identity.key)
    if (dialect !== LITERAL.id) throw new RepromptNotForDialectError(providerId, dialect, identity.key)
    return promptFor(surface, identity.spec, kind)
  }
  // No record yet. The reference establishes it; a candidate has nothing to replay and must not
  // invent one, because an invented prompt is a different question asked of one model only. This
  // is unchanged by dialects, and deliberately: a dialect translates the record, it never
  // substitutes for one.
  const literal =
    recorded !== undefined
      ? recorded
      : providerId === REFERENCE.id
        ? promptFor(surface, identity.spec, kind)
        : (() => {
            throw new MissingReferencePromptError(identity.key)
          })()

  const translated = applyDialect(dialect, literal)
  const owed = residualNegations(dialect, translated)
  if (owed.length > 0) throw new ResidualNegationError(dialect, identity.key, owed)
  return translated
}
