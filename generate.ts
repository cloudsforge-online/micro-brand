/**
 * The generation run, for any one of the three models in `providers.json`.
 *
 * ## What this run is now
 *
 * It was a run against one model. It is now a run against ONE NAMED model, chosen with
 * `--provider`, producing a set that sits beside the other two rather than replacing them. The
 * reference set — FLUX 2 Pro, at `assets/` with its provenance in `MANIFEST.json` — is the shipped
 * set and is not touched by a candidate run: a candidate writes only under its own root, so a
 * half-finished Qwen run cannot leave the set twenty sibling repositories point at in a worse
 * state than it found it.
 *
 * ## Why it imports the service rather than reimplementing it
 *
 * Every hard-won fact about the FLUX endpoint — `model` required in the body, the dotted spelling,
 * `aspect_ratio` accepted and ignored, dimensions floored to a multiple of 16, `output_format:png`
 * required, C2PA read from the bytes rather than assumed — is already encoded and unit-tested in
 * `studio/src/backend.ts`, `specs.ts`, `prompt.ts` and `sizing.ts`. A second copy of that knowledge
 * here is a second place for it to rot. `backends.ts` adapts it to the provider interface; it does
 * not restate it.
 *
 * ## Prompt parity
 *
 * Once an asset has been generated once, EVERY provider replays the prompt that is on record for
 * it — read out of the reference manifest, byte for byte, the reference provider included. Only an
 * asset that has never been generated gets a freshly computed prompt, and only from the reference.
 * Changing the question afterwards takes `--reprompt`, which is reference-only and makes the
 * candidate sets for those assets stale until they are regenerated.
 *
 * See `prompts.ts`'s header for why that is stronger than all three runs calling the same function
 * (the code no longer produces what 36 of the 54 recorded assets were generated from), and
 * `verify.py` for the cross-set check that fails if two sets ever disagree.
 *
 * ## Usage
 *
 *   cd ../studio && node --import tsx ../brand/generate.ts --plan
 *   cd ../studio && node --import tsx ../brand/generate.ts                       # the reference
 *   cd ../studio && node --import tsx ../brand/generate.ts --provider qwen-image-2512
 *   cd ../studio && node --import tsx ../brand/generate.ts --only site:wordmark,hub:mark
 *   cd ../studio && node --import tsx ../brand/generate.ts --force --only site:wordmark
 *   cd ../studio && node --import tsx ../brand/generate.ts --force --reprompt --only site:wordmark
 *
 * `--force` regenerates an asset that already exists and increments its recorded retry count; that
 * is the mechanism by which a wordmark with mangled lettering is replaced, and the count is what
 * makes "how many needed a retry" an answerable question months later — one of the six criteria in
 * COMPARISON.md, and the only one that is free to collect.
 *
 * **Resuming.** The manifest is written after every single asset and the work list is filtered
 * against it, so an interrupted run resumes by being run again and regenerates nothing that
 * already succeeded. That property is not a convenience here: an agent has already been killed
 * mid-run in this estate with 134 generated images at stake, and on a Managed Compute deployment
 * every re-run of an asset that was already fine is billed as deployment minutes.
 *
 * It is run from `studio/` so `tsx` resolves out of that workspace's `node_modules`. All paths here
 * are derived from `import.meta.dirname`, never from the working directory.
 */

import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { reportSizing } from '../studio/src/sizing.ts'
import { GENERATED_LICENCE } from '../studio/src/assets.ts'

import {
  backendFor,
  ImageBackendError,
  UnimplementedBackendError,
  type Attempt,
  type GenerationRequest,
  type ProviderBackend,
} from './backends.ts'
import { PROVIDERS, REFERENCE, providerById, assetsDirOf, manifestPathOf, type Provider } from './providers.ts'
import { identityFor, manifestKey, promptFor, promptForProvider } from './prompts.ts'
import { PLAN, plannedAssets, type PlannedKind, type PlannedSurface } from './plan.ts'
import { SURFACES } from '../ui/packages/ui/src/surfaces.ts'

const run = promisify(execFile)

const HERE = import.meta.dirname
const PLAN_JSON = join(HERE, 'PLAN.json')
const ENV_FILE = join(HERE, '..', 'studio', '.env.local')

/* ------------------------------------------------------------------ configuration */

/**
 * Read `studio/.env.local` into this process without printing any of it.
 *
 * Deliberately not `dotenv`: this is fifteen lines, and the dependency would be the only one in
 * this repository. Values are never echoed — not on success, not in an error, not in a summary
 * line — because every key in that file is a spend credential, and the two Managed Compute
 * deployments add two more of them.
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

/* ------------------------------------------------------------------ registry guard */

/**
 * Refuse to run if `plan.ts` has drifted from the registry.
 *
 * The registry is the work list. A hand-copied accent that no longer matches it would produce a
 * whole brand set in a colour nobody chose — which is exactly the defect design-system.md §7 item
 * 1 describes (`asset-forge` baking `#ff4d00` into every surface's mark). Cheap check, and it
 * fails before anything is spent. On a per-hour deployment "before anything is spent" now also
 * means before the clock has been running for the length of a failed run.
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
  /**
   * The provider id from providers.json. Added when the set stopped being the only set: without
   * it, three manifests describing three different models would be distinguishable only by which
   * directory they were found in, and `compare.py` would be reading a fact off a path.
   */
  readonly provider: string
  readonly surface: string
  readonly surfaceName: string
  readonly kind: string
  readonly path: string
  readonly accent: string
  /** What the design system declares this kind must end up at. */
  readonly declaredSize: string
  /** What was asked of the model — rounded UP to the 16-pixel grid, never down. */
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
   * Null on every FLUX asset: that deployment accepts no seed parameter, so nothing true can be
   * recorded. Kept as a column so a seeded model has somewhere to put one — the two candidates may
   * well accept a seed, and a seeded model turns "these two runs disagree" into something
   * reproducible rather than anecdotal.
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
  /**
   * The provider's own per-image accounting, where it has one. **Null on a Managed Compute
   * provider and that null is load-bearing**: those deployments bill per hour of existence, so
   * there is no per-image figure, and writing one here would invent a number. Their cost lives in
   * DEPLOYMENT.json instead. COMPARISON.md §6 states why the two may not be added together.
   */
  readonly providerCostUnits: number | null
  readonly providerOutputMegapixels: number | null
  /** Every attempt made, including the ones that failed. Details are redacted by the service. */
  readonly attempts: readonly Attempt[]
  readonly note?: string
}

type Manifest = Record<string, ManifestEntry>

const keyOf = (entry: { surface: string; kind: string; declaredSize: string }): string =>
  manifestKey(entry.surface, entry.kind, entry.declaredSize)

async function readManifest(provider: Provider): Promise<Manifest> {
  const path = manifestPathOf(provider)
  if (!existsSync(path)) return {}
  const parsed = JSON.parse(await readFile(path, 'utf8')) as { assets?: ManifestEntry[] }
  const out: Manifest = {}
  for (const entry of parsed.assets ?? []) out[keyOf(entry)] = entry
  return out
}

async function writeManifest(provider: Provider, manifest: Manifest): Promise<void> {
  const assets = Object.values(manifest).sort(
    (a, b) => a.surface.localeCompare(b.surface) || a.kind.localeCompare(b.kind) || a.path.localeCompare(b.path),
  )
  const document = {
    $comment:
      'Provenance for every image in this set. One entry per file, carrying the columns ' +
      "studio's generation_jobs and assets tables carry. Generated by generate.ts; do not edit " +
      'by hand. assetCount is len(assets) by construction — it has been wrong here before.',
    generator: `@cloudsforge/studio via brand/generate.ts --provider ${provider.id}`,
    provider: provider.id,
    providerLabel: provider.label,
    endpoint: provider.vendor,
    billing: provider.billing,
    disclosure:
      'Every image here is AI-generated. Whether a given file carries C2PA provenance is MEASURED ' +
      'on its bytes and recorded per entry — never inherited from the vendor and never inherited ' +
      'from a parent file. Derivatives are re-encoded and lose the C2PA chunk while keeping the ' +
      'pixel watermark, and each names the file it came from.',
    licence: GENERATED_LICENCE,
    assetCount: assets.length,
    updatedAt: new Date().toISOString(),
    assets,
  }
  await mkdir(provider.root, { recursive: true })
  await writeFile(manifestPathOf(provider), `${JSON.stringify(document, null, 2)}\n`, 'utf8')
}

/* ------------------------------------------------------------------ generation */

const sha256 = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex')

interface GeneratedOne {
  readonly entry: ManifestEntry
  readonly retriedTransient: number
}

async function generateOne(
  provider: Provider,
  backend: ProviderBackend,
  surface: PlannedSurface,
  kind: PlannedKind,
  previousRetries: number,
  reprompt: boolean,
): Promise<GeneratedOne> {
  const identity = identityFor(surface, kind)
  const prompt = promptForProvider(provider.id, surface, kind, { reprompt })

  const request: GenerationRequest = {
    prompt,
    spec: identity.spec,
    requestWidth: identity.requested.width,
    requestHeight: identity.requested.height,
    kitName: surface.name,
    accent: surface.accent,
  }

  // Transport faults and 429s are the two things worth retrying here; the backend's own chain
  // handles any model-level fallback.
  const MAX_TRANSIENT = 3
  let transient = 0
  let lastError: unknown = null
  const allAttempts: Attempt[] = []

  for (let go = 0; go <= MAX_TRANSIENT; go += 1) {
    try {
      const result = await backend.generate(request, AbortSignal.timeout(300_000))
      allAttempts.push(...result.attempts)
      const dir = join(assetsDirOf(provider), surface.key)
      await mkdir(dir, { recursive: true })
      const path = join(dir, identity.fileName)
      await writeFile(path, result.bytes)

      const sizing = reportSizing(result.bytes, identity.requested, 'png')
      const delivered = sizing.actual ? `${sizing.actual.width}x${sizing.actual.height}` : 'unknown'
      const isSource = !identity.onGrid

      return {
        retriedTransient: transient,
        entry: {
          provider: provider.id,
          surface: surface.key,
          surfaceName: surface.name,
          kind: identity.recordedKind,
          path: `assets/${surface.key}/${identity.fileName}`,
          accent: surface.accent,
          declaredSize: identity.declaredSize,
          requestedSize: `${identity.requested.width}x${identity.requested.height}`,
          deliveredSize: delivered,
          sizing: sizing.sizing,
          cropped: false,
          derivedFrom: null,
          backend: result.backend,
          model: result.model,
          prompt,
          seed: result.seed,
          sha256: sha256(result.bytes),
          byteSize: result.bytes.length,
          generatedAt: new Date().toISOString(),
          // Measured, never asserted. The standing rule.
          c2pa: result.c2pa,
          retries: previousRetries + transient,
          licence: GENERATED_LICENCE,
          providerCostUnits: result.providerCostUnits,
          providerOutputMegapixels: result.providerOutputMegapixels,
          attempts: allAttempts,
          ...(isSource
            ? {
                note:
                  `As delivered at ${identity.requested.width}x${identity.requested.height}. The ` +
                  `declared ${identity.spec.width}x${identity.spec.height} is not a multiple of ` +
                  '16, so it was asked for rounded UP and cut down rather than upscaled. This ' +
                  'file is kept because it is the one that still carries the C2PA chunk, where ' +
                  'the provider emits one at all.',
              }
            : {}),
        },
      }
    } catch (err) {
      lastError = err
      // An unimplemented backend is wrong on every retry and wrong for every asset. Fail the whole
      // run at once rather than three times per asset across ninety-four assets.
      if (err instanceof UnimplementedBackendError) throw err
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
 * Crop the OG card and resample the favicons, in Python's Pillow, for this provider's set.
 *
 * Pillow rather than macOS `sips`, so this is reproducible off one laptop — design-system.md §7
 * item 3 names `sips` as the reason twelve game masters still sit at 1024 against a declared 512.
 * A derivative is re-encoded, so it loses the PNG's C2PA chunk while keeping the invisible pixel
 * watermark; `derive.py` reports the C2PA state it measures rather than inheriting the claim.
 *
 * **Derivatives are never generated by the model.** A favicon is a Lanczos downscale of THIS
 * provider's own 512 mark and an OG card is a centre crop of THIS provider's own as-delivered
 * card; asking a model for them separately would break the relationship the `derivedFrom` column
 * asserts and would spend forty more generations per set to get a worse answer.
 */
async function derive(provider: Provider): Promise<ManifestEntry[]> {
  const { stdout } = await run('python3', [join(HERE, 'derive.py'), '--provider', provider.id], {
    maxBuffer: 32 * 1024 * 1024,
  })
  return JSON.parse(stdout) as ManifestEntry[]
}

/* ------------------------------------------------------------------ the reviewable plan */

/**
 * Write PLAN.json: every asset and every prompt, before anything is spent.
 *
 * Adopted from the sibling asset repositories, with one correction learned from them. Theirs are
 * regenerated on every run from the current clauses, so PLAN.json drifts away from what was
 * actually sent the moment a clause is edited — 80 of aetherholm-assets' 101 entries now carry a
 * manifest prompt that its own PLAN.json no longer derives. So this file is documented for what it
 * is: **a preview of what the next run would send, not a record of what a past run did send.**
 * The record is the manifest, and that is what `verify.py --parity` compares across providers.
 */
async function writePlanJson(): Promise<number> {
  const planned = plannedAssets()
  const document = {
    $comment:
      'The generation plan: what the NEXT reference run would send, derived from plan.ts and ' +
      'prompts.ts and written before a single generation is paid for. It is NOT a record of what ' +
      'was sent — that is MANIFEST.json, per provider, and it is the manifests that verify.py ' +
      'compares for prompt parity. Do not edit by hand; it is regenerated, which is the point.',
    generatedAt: new Date().toISOString(),
    referenceProvider: REFERENCE.id,
    total: planned.length,
    assets: planned.map(({ surface, kind }) => {
      const identity = identityFor(surface, kind)
      return {
        key: identity.key,
        surface: surface.key,
        surfaceName: surface.name,
        kind,
        recordedKind: identity.recordedKind,
        declaredSize: identity.declaredSize,
        requestedSize: `${identity.requested.width}x${identity.requested.height}`,
        accent: surface.accent,
        tier: surface.tier,
        prompt: promptFor(surface, identity.spec, kind),
      }
    }),
  }
  await writeFile(PLAN_JSON, `${JSON.stringify(document, null, 2)}\n`, 'utf8')
  return planned.length
}

/* ------------------------------------------------------------------ main */

interface Selection {
  readonly provider: Provider
  readonly force: boolean
  readonly only: ReadonlySet<string> | null
  readonly deriveOnly: boolean
  readonly planOnly: boolean
  /**
   * Deliberately change the question an already-generated asset is asked. Reference-only, and it
   * makes every candidate's copy of that asset stale — `verify.py --parity` will say so until they
   * are regenerated. Without it, a regeneration replays the prompt that is on record, which is what
   * keeps three sets comparable across time.
   */
  readonly reprompt: boolean
  readonly concurrency: number
  readonly limit: number | null
}

function parseArgs(argv: readonly string[]): Selection {
  const valueOf = (flag: string): string | null => {
    const index = argv.indexOf(flag)
    return index >= 0 && argv[index + 1] ? argv[index + 1]! : null
  }
  const providerId = valueOf('--provider') ?? REFERENCE.id
  const provider = providerById(providerId)
  const only = valueOf('--only')
  const limit = valueOf('--limit')
  const concurrency = valueOf('--concurrency')
  return {
    provider,
    force: argv.includes('--force'),
    deriveOnly: argv.includes('--derive-only'),
    planOnly: argv.includes('--plan'),
    reprompt: argv.includes('--reprompt'),
    only: only ? new Set(only.split(',').map((s) => s.trim()).filter(Boolean)) : null,
    // Per provider, from providers.json: a shared serverless endpoint and a dedicated A100 have
    // completely different reasons to be narrow, and the right width for one is wrong for the
    // other. Overridable because the honest value is measured, not predicted.
    concurrency: concurrency && Number(concurrency) > 0 ? Number(concurrency) : provider.concurrency,
    // The only real budget control is arithmetic on the number of calls.
    limit: limit && Number.isInteger(Number(limit)) ? Number(limit) : null,
  }
}

async function main(): Promise<void> {
  const selection = parseArgs(process.argv.slice(2))
  const provider = selection.provider
  assertPlanMatchesRegistry()

  const plannedCount = await writePlanJson()
  process.stdout.write(`PLAN.json: ${plannedCount} asset(s) planned\n`)
  if (selection.planOnly) return

  await loadEnvFile(ENV_FILE)
  const manifest = await readManifest(provider)
  const startedAt = Date.now()

  process.stdout.write(
    `provider ${provider.id} (${provider.label}) — ` +
      `${provider.shipped ? 'the shipped reference set' : 'a candidate set'}, ` +
      `billed per ${provider.billing.unit}\n`,
  )

  if (!selection.deriveOnly) {
    const backend = backendFor(provider)
    let work = plannedAssets().filter(({ surface, kind }) => {
      if (selection.only && !selection.only.has(`${surface.key}:${kind}`)) return false
      if (selection.force) return true
      // The resume rule: anything already recorded in THIS provider's manifest is done.
      return manifest[identityFor(surface, kind).key] === undefined
    })
    if (selection.limit !== null) work = work.slice(0, selection.limit)

    process.stdout.write(
      `${work.length} asset(s) to generate, ${selection.concurrency} at a time\n`,
    )

    let cursor = 0
    let failures = 0
    const worker = async (): Promise<void> => {
      for (;;) {
        const index = cursor
        cursor += 1
        const item = work[index]
        if (!item) return
        const { surface, kind } = item
        const previous = manifest[identityFor(surface, kind).key]
        // A forced regeneration counts as a retry of the asset, whatever the reason: a transport
        // fault and "the lettering was wrong" both mean this file was not right the first time.
        const previousRetries = previous ? previous.retries + 1 : 0
        try {
          const { entry } = await generateOne(
            provider,
            backend,
            surface,
            kind,
            previousRetries,
            selection.reprompt,
          )
          manifest[keyOf(entry)] = entry
          process.stdout.write(
            `  ok  ${surface.key}/${kind} ${entry.deliveredSize} ` +
              `${(entry.byteSize / 1024).toFixed(0)}KB c2pa=${entry.c2pa} retries=${entry.retries}\n`,
          )
          // After every single asset. An interrupted run must lose at most one image.
          await writeManifest(provider, manifest)
        } catch (err) {
          if (err instanceof UnimplementedBackendError) throw err
          failures += 1
          const message = err instanceof Error ? err.message : String(err)
          process.stdout.write(`  FAIL ${surface.key}/${kind}: ${message}\n`)
        }
      }
    }
    await Promise.all(Array.from({ length: selection.concurrency }, worker))
    if (failures > 0) process.stdout.write(`\n${failures} asset(s) failed\n`)
  }

  // Derivatives are rebuilt from whatever is on disk every run, so a regenerated source can never
  // leave a stale crop or a stale favicon behind it.
  for (const entry of await derive(provider)) manifest[keyOf(entry)] = entry
  await writeManifest(provider, manifest)

  const minutes = ((Date.now() - startedAt) / 60_000).toFixed(1)
  process.stdout.write(`\nmanifest: ${Object.keys(manifest).length} entries in ${minutes} minutes\n`)

  const outstanding = plannedAssets().filter(
    ({ surface, kind }) => manifest[identityFor(surface, kind).key] === undefined,
  ).length
  if (outstanding === 0 && provider.billing.unit === 'deployment hour') {
    // The bill is wall-clock, not images. Saying this on stdout is the difference between a
    // deployment torn down at the end of the run and one torn down when somebody next looks.
    process.stdout.write(
      `\nSET COMPLETE for ${provider.id}. This deployment bills per ${provider.billing.unit} ` +
        'whether or not it generates anything — delete it now. It does not need to wait for the ' +
        'other candidate, which runs against its own endpoint and its own manifest.\n',
    )
  } else if (outstanding > 0) {
    process.stdout.write(`${outstanding} asset(s) still outstanding; re-run to resume\n`)
  }
}

// Surfacing the checklist is the entire value of an unimplemented backend, so it is printed in
// full rather than being flattened into a one-line stack trace.
await main().catch((err: unknown) => {
  if (err instanceof UnimplementedBackendError) {
    process.stderr.write(`\n${err.message}\n`)
    process.exitCode = 2
    return
  }
  throw err
})

export { PROVIDERS }
