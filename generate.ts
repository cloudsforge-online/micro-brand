/**
 * The generation run. Drives `@cloudsforge/studio`'s own engine against the live FLUX 2 Pro
 * deployment and records the provenance the service's `generation_jobs` and `assets` tables record.
 *
 * ## Why this imports the service rather than reimplementing it
 *
 * Every hard-won fact about this endpoint — `model` required in the body, the dotted spelling,
 * `aspect_ratio` accepted and ignored, dimensions floored to a multiple of 16, `output_format:png`
 * required, C2PA read from the bytes rather than assumed — is already encoded and unit-tested in
 * `studio/src/backend.ts`, `specs.ts`, `prompt.ts` and `sizing.ts`. A second copy of that
 * knowledge in this repository is a second place for it to rot. So the four modules are imported
 * verbatim and `studio/` is not modified.
 *
 * ## Why it does not drive the HTTP service
 *
 * The service's route path additionally requires Postgres with migrations applied, a JWT issuer,
 * a per-account credit ledger with a spend cap, and the leased-job worker — the whole of which
 * exists so a MULTI-TENANT service can charge an account for an image and survive a rolling
 * deploy mid-generation. None of that has a job to do in a one-off, single-operator run of the
 * estate's own artwork, and standing it up would put a database between this run and the only
 * thing being tested, which is the art. The brief permits calling FLUX directly provided the same
 * provenance record is written; MANIFEST.json carries every column `generation_jobs` and `assets`
 * would have carried, including the failed attempts, and `licence` is imported from the service
 * so the string cannot drift.
 *
 * ## Usage
 *
 *   cd ../studio && node --import tsx ../brand/generate.ts            # everything missing
 *   cd ../studio && node --import tsx ../brand/generate.ts --only site:wordmark,hub:mark
 *   cd ../studio && node --import tsx ../brand/generate.ts --force --only site:wordmark
 *
 * `--force` regenerates an asset that already exists and increments its recorded retry count;
 * that is the mechanism by which a wordmark with mangled lettering is replaced, and the count is
 * what makes "how many needed a retry" an answerable question months later.
 *
 * It is run from `studio/` so `tsx` resolves out of that workspace's `node_modules`. All paths
 * here are derived from `import.meta.dirname`, never from the working directory.
 */

import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, dirname } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { fluxBackend, ImageBackendError, type Attempt, type ImageRequest } from '../studio/src/backend.ts'
import { buildPrompt } from '../studio/src/prompt.ts'
import { requestSizeFor, specFor, sizeString, type AssetSpec } from '../studio/src/specs.ts'
import { reportSizing } from '../studio/src/sizing.ts'
import { GENERATED_LICENCE } from '../studio/src/assets.ts'
import type { FluxConfig } from '../studio/src/env.ts'

import { PLAN, plannedAssets, type PlannedKind, type PlannedSurface } from './plan.ts'
import { SURFACES } from '../ui/packages/ui/src/surfaces.ts'

const run = promisify(execFile)

const HERE = import.meta.dirname
const ASSETS = join(HERE, 'assets')
const MANIFEST = join(HERE, 'MANIFEST.json')
const ENV_FILE = join(HERE, '..', 'studio', '.env.local')

/* ------------------------------------------------------------------ configuration */

/**
 * Read `studio/.env.local` into this process without printing any of it.
 *
 * Deliberately not `dotenv`: this is fifteen lines, and the dependency would be the only one in
 * this repository. Values are never echoed — not on success, not in an error, not in a summary
 * line — because the Foundry key is a spend credential.
 */
async function loadEnvFile(path: string): Promise<void> {
  const text = await readFile(path, 'utf8')
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (!(key in process.env)) process.env[key] = value
  }
}

function fluxConfig(): FluxConfig {
  const endpoint = (process.env['AZURE_FOUNDRY_ENDPOINT'] ?? '').trim().replace(/\/+$/, '')
  const apiKey = (process.env['AZURE_FOUNDRY_API_KEY'] ?? '').trim()
  if (!endpoint || !apiKey) {
    throw new Error('AZURE_FOUNDRY_ENDPOINT and AZURE_FOUNDRY_API_KEY must be set')
  }
  return {
    endpoint,
    apiKey,
    imagePath:
      (process.env['AZURE_FOUNDRY_IMAGE_PATH'] ?? '').trim() ||
      '/providers/blackforestlabs/v1/flux-2-pro',
    // Dots, not hyphens. The hyphenated path segment is a 404 as a model name — trap 2.
    model: (process.env['STUDIO_IMAGE_MODEL'] ?? '').trim() || 'FLUX.2-pro',
    fallbackModel: (process.env['STUDIO_IMAGE_FALLBACK_MODEL'] ?? '').trim(),
  }
}

/* ------------------------------------------------------------------ registry guard */

/**
 * Refuse to run if `plan.ts` has drifted from the registry.
 *
 * The registry is the work list. A hand-copied accent that no longer matches it would produce a
 * whole brand set in a colour nobody chose — which is exactly the defect design-system.md §7 item
 * 1 describes (`asset-forge` baking `#ff4d00` into every surface's mark). Cheap check, and it
 * fails before anything is spent.
 */
function assertPlanMatchesRegistry(): void {
  const byKey = new Map(SURFACES.map((s) => [String(s.key), s]))
  const problems: string[] = []
  for (const planned of PLAN) {
    const registered = byKey.get(planned.key)
    if (!registered) {
      problems.push(`${planned.key}: not a registry surface`)
      continue
    }
    if (registered.accent.toLowerCase() !== planned.accent.toLowerCase()) {
      problems.push(
        `${planned.key}: accent ${planned.accent} does not match the registry's ${registered.accent}`,
      )
    }
    if (registered.name !== planned.name) {
      problems.push(`${planned.key}: name "${planned.name}" is not the registry's "${registered.name}"`)
    }
  }
  if (problems.length > 0) {
    throw new Error(`plan.ts has drifted from the surface registry:\n  ${problems.join('\n  ')}`)
  }
}

/* ------------------------------------------------------------------ the manifest */

export interface ManifestEntry {
  readonly surface: string
  readonly surfaceName: string
  readonly kind: string
  readonly path: string
  readonly accent: string
  /** What the design system declares this kind must end up at. */
  readonly declaredSize: string
  /** What was asked of FLUX — rounded UP to the 16-pixel grid, never down. */
  readonly requestedSize: string
  /** What the bytes on disk actually measure. */
  readonly deliveredSize: string
  /** `exact` | `unsized` | `unknown`, from the service's own sizing report. */
  readonly sizing: string
  readonly cropped: boolean
  /** Set on a derivative; names the as-delivered file it was cut or resampled from. */
  readonly derivedFrom: string | null
  readonly backend: string
  readonly model: string | null
  readonly prompt: string
  /**
   * Null on every asset here: this deployment of FLUX 2 Pro accepts no seed parameter, so nothing
   * true can be recorded. Kept as a column so a seeded model later has somewhere to put one, and
   * so the absence is a stated fact rather than a missing field.
   */
  readonly seed: number | null
  readonly sha256: string
  readonly byteSize: number
  readonly generatedAt: string
  /** Read from the bytes on disk, not assumed from the vendor. */
  readonly c2pa: boolean
  /** Generations beyond the first that were needed before this file was accepted. */
  readonly retries: number
  readonly licence: string
  readonly providerCostUnits: number | null
  readonly providerOutputMegapixels: number | null
  /** Every attempt made, including the ones that failed. Details are redacted by the service. */
  readonly attempts: readonly Attempt[]
  readonly note?: string
}

type Manifest = Record<string, ManifestEntry>

const keyOf = (surface: string, kind: string, size: string): string => `${surface}/${kind}-${size}`

async function readManifest(): Promise<Manifest> {
  if (!existsSync(MANIFEST)) return {}
  const parsed = JSON.parse(await readFile(MANIFEST, 'utf8')) as {
    assets?: ManifestEntry[]
  }
  const out: Manifest = {}
  for (const entry of parsed.assets ?? []) {
    out[keyOf(entry.surface, entry.kind, entry.declaredSize)] = entry
  }
  return out
}

async function writeManifest(manifest: Manifest): Promise<void> {
  const assets = Object.values(manifest).sort(
    (a, b) => a.surface.localeCompare(b.surface) || a.kind.localeCompare(b.kind) || a.path.localeCompare(b.path),
  )
  const document = {
    $comment:
      'Provenance for every image in this repository. One entry per file, carrying the columns ' +
      "studio's generation_jobs and assets tables carry. Generated by generate.ts; do not edit by hand.",
    generator: '@cloudsforge/studio via brand/generate.ts',
    endpoint: 'Azure AI Foundry, Black Forest Labs FLUX 2 Pro',
    disclosure:
      'Every image here is AI-generated. Each as-delivered file carries C2PA provenance and a ' +
      'Microsoft invisible watermark; derivatives lose the C2PA chunk on re-encode but keep the ' +
      'pixel watermark, and each names the file it came from.',
    licence: GENERATED_LICENCE,
    assetCount: assets.length,
    updatedAt: new Date().toISOString(),
    assets,
  }
  await writeFile(MANIFEST, `${JSON.stringify(document, null, 2)}\n`, 'utf8')
}

/* ------------------------------------------------------------------ generation */

/** The C2PA box identifier, in the PNG's metadata chunks. Same marker the service reads. */
const C2PA = Buffer.from('c2pa')

const sha256 = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex')

function specForKind(kind: PlannedKind): AssetSpec {
  return specFor(kind)
}

function fileNameFor(kind: PlannedKind, spec: AssetSpec, requested: { width: number; height: number }): string {
  const onGrid = requested.width === spec.width && requested.height === spec.height
  // A cropped kind keeps BOTH files: the as-delivered one, which still carries its C2PA chunk,
  // and the cut-down one the platform actually requires. Naming the as-delivered file for what it
  // is stops it being mistaken for the shippable asset.
  return onGrid
    ? `${kind}-${sizeString(spec)}.png`
    : `${kind}-${requested.width}x${requested.height}-asdelivered.png`
}

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
 *
 * This is appended here rather than edited into the service because `studio/` is read-only for
 * this run and because the finding belongs to the service as a change with its own tests, not as
 * a silent edit made in passing. It is recorded in every manifest entry's `prompt`, so what was
 * actually sent is what is stored.
 */
const GROUND_CLAUSE =
  'The background is one flat, uniform, unbroken near-black warm ash field, hex #12100f, ' +
  'filling the entire frame from edge to edge — not grey, not taupe, not beige, and not lighter ' +
  'at the corners. The artwork is bright against a dark ground, never dark against a light one. ' +
  'Draw only the finished mark: no construction lines, no grid, no guides, no ruled margins, no ' +
  'border, no frame, no bounding box, no registration marks, no drop shadow.'

/**
 * Per-kind hardening, each clause written against a defect seen in this run's own output.
 *
 * These are not guesses about what a model might get wrong. Every one of them names something
 * that came back wrong on the first full pass of 44 images and was found by looking at a contact
 * sheet, and each is worth keeping because the failure is characteristic of the kind rather than
 * of the surface:
 *
 *   * **favicon — the inset duplicate.** Three of eleven favicons came back as the mark PLUS a
 *     second, smaller, framed copy of itself in the lower half, like a preview thumbnail pasted
 *     into the artwork. The composition line asks for something "drawn heavier and simpler than
 *     the full mark", and the model appears to answer by showing both.
 *   * **wordmark, og, social — the invented name.** `market`'s social banner came back reading
 *     "Sftware Company": both a misspelling and a phrase from the style paragraph's own first
 *     sentence ("brand mark for a software company") leaking into the artwork as text. `worlds`
 *     came back with no name on it at all. So the name is restated as the only permitted string,
 *     and drawn exactly once.
 *   * **every kind — the unaccented mark.** `hub`'s OG card drew the ridge in mid-grey with a
 *     5-pixel ember diamond, and `worlds` drew its whole settlement in white. Both are a mark
 *     that cannot be told from any other surface's, which is the entire job the accent does.
 *     design-system.md §5 does allow a two-colour mark — the ground line in `--cf-fg-mute` — so
 *     the clause permits the ridge to be bone and requires everything else to be the accent.
 */
const HARDENING: Readonly<Record<PlannedKind, string>> = {
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
 * phrase arriving that nobody asked for, and it arrived from two distinct sources:
 *
 *   * **The style paragraph.** `market`'s banner came back reading "Sftware Company", which is
 *     the opening words of `prompt.ts`'s own `brandStyle` ("Brand mark for a software company"),
 *     misspelt and rendered as artwork.
 *   * **The idea paragraph.** After the first fix, `trade`'s OG card came back captioned
 *     "Quench Curve" with the baseline annotated "ash ridge" — this repository's own
 *     `plan.ts` vocabulary, drawn as a diagram label.
 *
 * Both are the same failure with different words, so the clause forbids the CATEGORY: any text
 * that is not the name, including any word used to describe the drawing. The name is also spelled
 * out character by character, which is the one thing that reliably moves an image model off an
 * invented string — `worlds` produced "Cartre Pere" from nowhere before this was added.
 */
function letteringClause(name: string): string {
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
function accentClause(accent: string): string {
  return (
    `Every drawn element is filled or stroked in ${accent} — that exact colour, at full ` +
    'strength. The only permitted exception is the ground line, which may instead be a muted bone ' +
    `#b7ae9b. Nothing is drawn in plain white, plain grey or the ground colour, and ${accent} is ` +
    'the dominant colour of the artwork rather than a small detail on it.'
  )
}

const LETTERED: ReadonlySet<PlannedKind> = new Set<PlannedKind>(['wordmark', 'og', 'social'])

function promptFor(surface: PlannedSurface, spec: AssetSpec, kind: PlannedKind): string {
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

interface GeneratedOne {
  readonly entry: ManifestEntry
  readonly retriedTransient: number
}

async function generateOne(
  backend: ReturnType<typeof fluxBackend>,
  surface: PlannedSurface,
  kind: PlannedKind,
  previousRetries: number,
): Promise<GeneratedOne> {
  const spec = specForKind(kind)
  const requested = requestSizeFor(spec)
  const prompt = promptFor(surface, spec, kind)

  const request: ImageRequest = {
    prompt,
    spec,
    requestWidth: requested.width,
    requestHeight: requested.height,
    kitName: surface.name,
    accent: surface.accent,
  }

  // Transport faults and 429s are the two things worth retrying here; the service's own chain
  // handles the model-level fallback, and there is only one model deployed for it to try.
  const MAX_TRANSIENT = 3
  let transient = 0
  let lastError: unknown = null
  const allAttempts: Attempt[] = []

  for (let go = 0; go <= MAX_TRANSIENT; go += 1) {
    try {
      const result = await backend.generate(request, AbortSignal.timeout(300_000))
      allAttempts.push(...result.attempts)
      const dir = join(ASSETS, surface.key)
      await mkdir(dir, { recursive: true })
      const fileName = fileNameFor(kind, spec, requested)
      const path = join(dir, fileName)
      await writeFile(path, result.bytes)

      const sizing = reportSizing(result.bytes, { width: requested.width, height: requested.height }, 'png')
      const declared = sizeString(spec)
      const delivered = sizing.actual ? `${sizing.actual.width}x${sizing.actual.height}` : 'unknown'
      const isSource = fileName.includes('asdelivered')

      return {
        retriedTransient: transient,
        entry: {
          surface: surface.key,
          surfaceName: surface.name,
          kind: isSource ? `${kind}-source` : kind,
          path: `assets/${surface.key}/${fileName}`,
          accent: surface.accent,
          declaredSize: isSource ? `${requested.width}x${requested.height}` : declared,
          requestedSize: `${requested.width}x${requested.height}`,
          deliveredSize: delivered,
          sizing: sizing.sizing,
          cropped: false,
          derivedFrom: null,
          backend: result.backend,
          model: result.model,
          prompt,
          seed: null,
          sha256: sha256(result.bytes),
          byteSize: result.bytes.length,
          generatedAt: new Date().toISOString(),
          c2pa: result.bytes.includes(C2PA),
          retries: previousRetries + transient,
          licence: GENERATED_LICENCE,
          providerCostUnits: result.providerMeta?.cost ?? null,
          providerOutputMegapixels: result.providerMeta?.outputMegapixels ?? null,
          attempts: allAttempts,
          ...(isSource
            ? {
                note:
                  `As delivered at ${requested.width}x${requested.height}. The declared ` +
                  `${declared} is not a multiple of 16, so it was asked for rounded UP and cut ` +
                  'down rather than upscaled. This file is kept because it is the one that still ' +
                  'carries the C2PA chunk.',
              }
            : {}),
        },
      }
    } catch (err) {
      lastError = err
      if (err instanceof ImageBackendError) {
        allAttempts.push(...err.attempts)
        // A refusal or a credential problem is wrong the same way on every retry. The service
        // already declines to fall back on these; retrying here would be the same mistake slower.
        if (err.code === 'bad_request' || err.code === 'unauthorised') throw err
      }
      transient += 1
      if (go === MAX_TRANSIENT) break
      const backoffMs = 2_000 * 2 ** go
      process.stdout.write(
        `    ${surface.key}/${kind}: transient failure, retrying in ${backoffMs / 1000}s\n`,
      )
      await new Promise((resolve) => setTimeout(resolve, backoffMs))
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

/* ------------------------------------------------------------------ derivatives */

/**
 * Crop the OG card and resample the favicons, in Python's Pillow.
 *
 * Pillow rather than macOS `sips`, so this is reproducible off one laptop — design-system.md §7
 * item 3 names `sips` as the reason twelve game masters still sit at 1024 against a declared 512.
 * A derivative is re-encoded, so it loses the PNG's C2PA chunk while keeping the invisible pixel
 * watermark; `derive.py` reports the C2PA state it measures rather than inheriting the claim.
 */
async function derive(): Promise<ManifestEntry[]> {
  const { stdout } = await run('python3', [join(HERE, 'derive.py')], { maxBuffer: 32 * 1024 * 1024 })
  return JSON.parse(stdout) as ManifestEntry[]
}

/* ------------------------------------------------------------------ main */

interface Selection {
  readonly force: boolean
  readonly only: ReadonlySet<string> | null
  readonly deriveOnly: boolean
}

function parseArgs(argv: readonly string[]): Selection {
  const force = argv.includes('--force')
  const deriveOnly = argv.includes('--derive-only')
  const onlyIndex = argv.indexOf('--only')
  const only =
    onlyIndex >= 0 && argv[onlyIndex + 1]
      ? new Set(
          argv[onlyIndex + 1]!
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        )
      : null
  return { force, only, deriveOnly }
}

async function main(): Promise<void> {
  await loadEnvFile(ENV_FILE)
  assertPlanMatchesRegistry()
  const selection = parseArgs(process.argv.slice(2))
  const manifest = await readManifest()

  if (!selection.deriveOnly) {
    const config = fluxConfig()
    const backend = fluxBackend(config, { deadlineMs: 300_000 })
    const work = plannedAssets().filter(({ surface, kind }) => {
      if (selection.only && !selection.only.has(`${surface.key}:${kind}`)) return false
      if (selection.force) return true
      const spec = specForKind(kind)
      const requested = requestSizeFor(spec)
      const onGrid = requested.width === spec.width && requested.height === spec.height
      const declared = onGrid ? sizeString(spec) : `${requested.width}x${requested.height}`
      const recordedKind = onGrid ? kind : `${kind}-source`
      return manifest[keyOf(surface.key, recordedKind, declared)] === undefined
    })

    process.stdout.write(`${work.length} asset(s) to generate\n`)

    // Three at a time. FLUX takes twenty to forty seconds an image, so serial would be half an
    // hour of wall clock; more than a handful in flight is how a shared deployment starts
    // answering 429 and the retry budget goes on capacity rather than on quality.
    const CONCURRENCY = 3
    let cursor = 0
    let failures = 0
    const worker = async (): Promise<void> => {
      for (;;) {
        const index = cursor
        cursor += 1
        const item = work[index]
        if (!item) return
        const { surface, kind } = item
        const spec = specForKind(kind)
        const requested = requestSizeFor(spec)
        const onGrid = requested.width === spec.width && requested.height === spec.height
        const recordedKind = onGrid ? kind : `${kind}-source`
        const declared = onGrid ? sizeString(spec) : `${requested.width}x${requested.height}`
        const previous = manifest[keyOf(surface.key, recordedKind, declared)]
        // A forced regeneration counts as a retry of the asset, whatever the reason: a transport
        // fault and "the lettering was wrong" both mean this file was not right the first time.
        const previousRetries = previous ? previous.retries + 1 : 0
        try {
          const { entry } = await generateOne(backend, surface, kind, previousRetries)
          manifest[keyOf(entry.surface, entry.kind, entry.declaredSize)] = entry
          process.stdout.write(
            `  ok  ${surface.key}/${kind} ${entry.deliveredSize} ` +
              `${(entry.byteSize / 1024).toFixed(0)}KB c2pa=${entry.c2pa} retries=${entry.retries}\n`,
          )
          await writeManifest(manifest)
        } catch (err) {
          failures += 1
          const message = err instanceof Error ? err.message : String(err)
          process.stdout.write(`  FAIL ${surface.key}/${kind}: ${message}\n`)
        }
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker))
    if (failures > 0) process.stdout.write(`\n${failures} asset(s) failed\n`)
  }

  // Derivatives are rebuilt from whatever is on disk every run, so a regenerated source can never
  // leave a stale crop or a stale favicon behind it.
  for (const entry of await derive()) {
    manifest[keyOf(entry.surface, entry.kind, entry.declaredSize)] = entry
  }
  await writeManifest(manifest)
  process.stdout.write(`\nmanifest: ${Object.keys(manifest).length} entries\n`)
}

await main()
