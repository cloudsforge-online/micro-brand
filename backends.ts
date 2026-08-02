/**
 * The provider seam: one interface, three implementations, one of which works.
 *
 * ## Why this file exists at all
 *
 * `generate.ts` used to call `fluxBackend` from the studio service directly, which was right while
 * there was one model. There are now three, and two of them are not FLUX-shaped: a Foundry Global
 * Managed Compute deployment gets its OWN scoring URI and its OWN key, and is NOT reachable on the
 * `/providers/blackforestlabs/v1/flux-2-pro` route the reference provider uses. So the thing that
 * varies — the envelope a prompt is posted inside — is named and isolated here, and everything
 * that must NOT vary stays outside it.
 *
 * ## What must not vary, and how this file guarantees it
 *
 * The whole comparison rests on the three models receiving the same prompt. `GenerationRequest`
 * carries `prompt` as an opaque string that no backend may alter, and every backend exposes
 * `bodyFor()` so that claim is testable rather than trusted: `parity.test.ts` asserts, for each
 * implemented backend, that the prompt in the body is `===` the prompt in the request. A backend
 * that prepended a system preamble, appended a negative prompt, or truncated to a token budget
 * would fail that test.
 *
 * ## Why the two new backends throw instead of guessing
 *
 * A Managed Compute endpoint's request schema is the model's own signature, not a standard. It is
 * cheaper to fail loudly on an unimplemented backend than to ship a plausible body that returns
 * 200 with a differently-interpreted prompt — that failure would not look like a failure, it would
 * look like "Qwen is worse at prompt adherence", which is exactly the conclusion this exercise is
 * supposed to produce honestly. So `UNKNOWNS` below is a checklist, not a lament: each line is a
 * fact to establish against the live endpoint, and the backend stays a stub until all of them are
 * answered.
 *
 * ## Credentials
 *
 * Read from `process.env`, which `generate.ts` populates from the gitignored `studio/.env.local`.
 * The names are in providers.json; the VALUES appear in exactly one place, the request headers.
 * Never in an error, never in an attempt detail, never in the manifest, never on stdout.
 */

import {
  fluxBackend,
  bodyFor as fluxBodyFor,
  ImageBackendError,
  type Attempt,
  type ImageRequest,
} from '../studio/src/backend.ts'
import type { AssetSpec } from '../studio/src/specs.ts'

import type { Provider } from './providers.ts'

/* ------------------------------------------------------------------ the request and the result */

/**
 * One asset, asked for. Identical for all three providers by construction: there is no provider
 * field on it, so there is nowhere for a provider-specific tweak to hide.
 */
export interface GenerationRequest {
  /** Verbatim, and never rewritten by a backend. The one thing parity depends on. */
  readonly prompt: string
  readonly spec: AssetSpec
  readonly requestWidth: number
  readonly requestHeight: number
  readonly kitName: string
  readonly accent: string
}

export interface GenerationResult {
  readonly bytes: Buffer
  /** What went in the manifest's `backend` column. The adapter, not the vendor's marketing name. */
  readonly backend: string
  readonly model: string | null
  /**
   * MEASURED on the bytes returned, never asserted from the vendor. This estate's standing rule,
   * and the one that already cost it 54 entries claiming a C2PA box the files had not carried
   * since the ground-normalisation commit. It is computed in exactly one place — `measureC2pa`
   * below — so a new backend cannot forget to do it or be tempted to hardcode it.
   */
  readonly c2pa: boolean
  /**
   * The provider's own per-call accounting, where the provider HAS per-call accounting. Null on a
   * Managed Compute deployment, and that null is meaningful: it bills per hour of existence, so
   * there is no per-image number to record and inventing one would be a lie. See COMPARISON.md §6.
   */
  readonly providerCostUnits: number | null
  readonly providerOutputMegapixels: number | null
  /** Null where the model accepts no seed. FLUX 2 Pro does not; the candidates may. */
  readonly seed: number | null
  readonly attempts: readonly Attempt[]
}

export interface ProviderBackend {
  readonly provider: Provider
  /** The exact JSON body this backend would POST. Exposed so parity is asserted, not assumed. */
  bodyFor(request: GenerationRequest): Record<string, unknown>
  generate(request: GenerationRequest, signal: AbortSignal): Promise<GenerationResult>
}

/** The C2PA box identifier, in the PNG's metadata chunks. One marker, read one way, everywhere. */
const C2PA_MARKER = Buffer.from('c2pa')

export const measureC2pa = (bytes: Buffer): boolean => bytes.includes(C2PA_MARKER)

/* ------------------------------------------------------------------ the unimplemented backends */

export class UnimplementedBackendError extends Error {
  readonly provider: string
  readonly unknowns: readonly string[]

  constructor(provider: Provider, unknowns: readonly string[]) {
    super(
      `the ${provider.label} backend is not implemented: ${unknowns.length} wire facts about the ` +
        `Managed Compute endpoint are not yet established. Establish them against the live ` +
        `deployment and implement managedComputeBackend() before running --provider ${provider.id}.` +
        `\n\n  ${unknowns.join('\n  ')}\n`,
    )
    this.name = 'UnimplementedBackendError'
    this.provider = provider.id
    this.unknowns = unknowns
  }
}

/**
 * What has to be true before `managedComputeBackend` can be written.
 *
 * Every line is a question with an observable answer, to be settled by ONE probe request against
 * the live deployment and recorded in providers.json and in this file's header — not by reading
 * the model card and hoping. The reference provider's own header carries six such facts, three of
 * which contradict what its URL implies, which is the reason this list is a list rather than an
 * assumption.
 */
export const UNKNOWNS: readonly string[] = [
  'ROUTE. The scoring URI in full, including the path. A Managed Online Endpoint is normally ' +
    'https://<name>.<region>.inference.ml.azure.com/score, but a Foundry Managed Compute ' +
    'deployment may expose an OpenAI-shaped route instead. It is NOT the reference provider\'s ' +
    '/providers/... path and it is NOT reachable with the Foundry resource key.',
  'AUTH HEADER. `Authorization: Bearer <key>` (the Managed Online Endpoint convention) or ' +
    '`api-key: <key>` (the Foundry convention). These endpoints have used both; sending the wrong ' +
    'one is a 401 that reads like a revoked credential.',
  'DEPLOYMENT HEADER. Whether `azureml-model-deployment: <deployment-name>` is required to reach ' +
    'a specific deployment behind the endpoint, or whether the endpoint has exactly one.',
  'BODY SHAPE. Whether the payload is flat ({"prompt": ...}), OpenAI-shaped ({"model", "prompt", ' +
    '"size"}) or the Azure ML wrapper ({"input_data": {"columns": [...], "data": [[...]]}}). ' +
    'Qwen-Image and Cosmos are different models with different signatures; assume nothing is ' +
    'shared between them.',
  'PROMPT FIELD NAME. `prompt`, `text`, `input`, or a column in an input_data table. The parity ' +
    'test asserts the prompt reaches the body verbatim, so this name must be known, not guessed.',
  'SIZE PARAMETERS. Whether width/height are accepted, whether a `size` string is accepted, and ' +
    'whether either is honoured or silently ignored — the reference provider accepts and IGNORES ' +
    '`aspect_ratio` and `size`, which is worse than rejecting them because nothing fails.',
  'DIMENSION GRANULARITY. The reference provider floors each delivered dimension to a multiple of ' +
    '16, which is the entire reason `requestSizeFor` rounds up and the reason an OG card is asked ' +
    'for at 1200x640 and cut to 1200x630. Probe 1200x630 and 1024x384 and MEASURE what comes back ' +
    'before reusing that arithmetic; if the granularity differs, the request sizes differ.',
  'OUTPUT FORMAT. Whether PNG is the default or has to be asked for. The reference provider ' +
    'returns JPEG unless `output_format:"png"` is sent, and a JPEG brand mark has visible ringing ' +
    'on flat vector edges.',
  'RESPONSE SHAPE. Base64 in a JSON field, a pre-signed URL, or raw image bytes with an ' +
    'image/png content-type — and the field name if JSON. All three are live conventions.',
  'SEED. Whether a seed parameter is accepted and echoed back. The reference provider takes none, ' +
    'so `seed` is null on all 94 entries; if a candidate accepts one, record it, because a seeded ' +
    'model makes a disagreement between two runs reproducible rather than anecdotal.',
  'NEGATIVE PROMPT. Whether the model has a separate negative-prompt parameter. If it does, it ' +
    'must be left EMPTY: the reference prompts carry their prohibitions inside the prompt text, ' +
    'and moving them into a different field would give this model a different instruction from ' +
    'the other two. That is a parity decision, not a quality one.',
  'PROMPT LENGTH. The text encoder\'s token budget, and whether an over-long prompt is truncated ' +
    'SILENTLY. These prompts run to roughly 2,000-3,000 characters. A model that truncates at 77 ' +
    'or 512 tokens receives a different instruction from one that does not, and the comparison ' +
    'would read that as a style failure rather than as a truncation. Probe with a prompt whose ' +
    'LAST clause is checkable in the image — the ground clause is deliberately last — and look at ' +
    'whether the last clause was obeyed.',
  'CONCURRENCY. How many requests one A100_80GB instance serves before latency collapses or it ' +
    'returns 429/503. This sets the run width and therefore the wall-clock, and the wall-clock is ' +
    'the bill: this deployment charges per hour of existence, not per image.',
  'ERROR VOCABULARY. Which status codes mean retry and which mean stop. The reference provider\'s ' +
    'rule (404/429/5xx and transport faults retry; 400/401/403 do not) is a good default but was ' +
    'established against ITS error bodies; a content filter on this endpoint may answer something ' +
    'else entirely.',
  'C2PA. Whether the bytes carry a C2PA box at all. Do not assume either way — `measureC2pa` reads ' +
    'it off the bytes and the manifest records what was measured. A candidate set with no C2PA is ' +
    'a legitimate outcome and a disclosure fact worth having; a candidate set CLAIMING C2PA it ' +
    'does not carry is the defect this repository has already shipped once.',
]

/**
 * The stub. It is a real object implementing the real interface, so the seam is exercised by the
 * test suite today rather than being a shape that only compiles.
 */
export function managedComputeBackend(provider: Provider): ProviderBackend {
  const refuse = (): never => {
    throw new UnimplementedBackendError(provider, UNKNOWNS)
  }
  return {
    provider,
    bodyFor: refuse,
    generate: refuse,
  }
}

/* ------------------------------------------------------------------ the reference backend */

/**
 * FLUX 2 Pro, via the studio service's own engine.
 *
 * A thin adapter and deliberately nothing more. Every verified fact about that endpoint —
 * `model` required in the body despite being in the path, the dotted spelling, `output_format:png`
 * required, the fallback rule, the redaction of keys out of attempt details — lives in
 * `studio/src/backend.ts` and is unit-tested there. Reimplementing any of it here would be a
 * second place for it to rot, and this repository deliberately has no dependencies of its own.
 */
export function referenceBackend(
  provider: Provider,
  config: { endpoint: string; apiKey: string; imagePath: string; model: string; fallbackModel: string },
): ProviderBackend {
  const inner = fluxBackend(config, { deadlineMs: 300_000 })

  const toImageRequest = (request: GenerationRequest): ImageRequest => ({
    prompt: request.prompt,
    spec: request.spec,
    requestWidth: request.requestWidth,
    requestHeight: request.requestHeight,
    kitName: request.kitName,
    accent: request.accent,
  })

  return {
    provider,

    // The service's own body builder, not a copy: `model` being required in the body is the single
    // most surprising thing about that API and the most likely line to be "cleaned up" by someone
    // who notices the model is already in the URL.
    bodyFor: (request) => fluxBodyFor(config.model, toImageRequest(request)),

    async generate(request, signal) {
      const result = await inner.generate(toImageRequest(request), signal)
      return {
        bytes: result.bytes,
        backend: result.backend,
        model: result.model,
        c2pa: measureC2pa(result.bytes),
        providerCostUnits: result.providerMeta?.cost ?? null,
        providerOutputMegapixels: result.providerMeta?.outputMegapixels ?? null,
        // FLUX 2 Pro accepts no seed parameter, so nothing true can be recorded.
        seed: null,
        attempts: result.attempts,
      }
    },
  }
}

/* ------------------------------------------------------------------ selection */

export function backendFor(provider: Provider, env: NodeJS.ProcessEnv = process.env): ProviderBackend {
  if (provider.adapter === 'foundry-managed-compute') return managedComputeBackend(provider)

  const read = (key: string | undefined, fallback = ''): string =>
    (key ? (env[key] ?? '').trim() : '') || fallback

  const endpoint = read(provider.env['endpoint']).replace(/\/+$/, '')
  const apiKey = read(provider.env['apiKey'])
  if (!endpoint || !apiKey) {
    // Names, never values.
    throw new Error(
      `${provider.env['endpoint']} and ${provider.env['apiKey']} must be set in studio/.env.local`,
    )
  }
  return referenceBackend(provider, {
    endpoint,
    apiKey,
    imagePath: read(provider.env['imagePath'], '/providers/blackforestlabs/v1/flux-2-pro'),
    // Dots, not hyphens. The hyphenated path segment is a 404 as a model name.
    model: read(provider.env['model'], 'FLUX.2-pro'),
    fallbackModel: read(env['STUDIO_IMAGE_FALLBACK_MODEL'] ? 'STUDIO_IMAGE_FALLBACK_MODEL' : undefined),
  })
}

export { ImageBackendError }
export type { Attempt }
