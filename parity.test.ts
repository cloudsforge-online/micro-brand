/**
 * The prompt-parity suite: the property the whole three-way comparison rests on, asserted rather
 * than maintained by convention.
 *
 *     cd ../studio && node --import tsx --test ../brand/parity.test.ts
 *
 * ## What is asserted, and what deliberately is not
 *
 * The property is **"all three models are asked the same question about a given asset"**. It is NOT
 * "the prompt-building code produces the prompt that is on record" — and the difference is the
 * whole design.
 *
 * Measured on this repository at the time of writing: 36 of the 54 generated assets in the
 * reference set carry a recorded prompt that `promptFor` no longer produces, because the favicon,
 * lettering and accent hardening clauses were added partway through the original run and the
 * assets generated before them were never regenerated. The same is true next door — 80 of
 * aetherholm-assets' 101 entries have drifted from their own PLAN.json.
 *
 * A test asserting code-equals-record would therefore be red on arrival, and "fixing" it would
 * mean either regenerating the whole reference set or weakening the assertion. Neither is what the
 * comparison needs. What it needs is that when Qwen and Cosmos are asked for `site/mark`, they are
 * asked the SAME thing FLUX was asked when `site/mark` was made — whatever that was. That is what
 * `promptForProvider` guarantees by replaying the record, and it is what these tests assert.
 *
 * The reference set not being internally prompt-uniform is a real caveat and it is written down in
 * COMPARISON.md §7 rather than hidden here.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

import { plannedAssets } from './plan.ts'
import {
  identityFor,
  promptFor,
  promptForProvider,
  referencePrompts,
  MissingReferencePromptError,
  RepromptNotForCandidateError,
} from './prompts.ts'
import { PROVIDERS, REFERENCE, providerById, live, ProviderWithdrawnError } from './providers.ts'
import {
  backendFor,
  managedComputeBackend,
  referenceBackend,
  UnimplementedBackendError,
  UNKNOWNS,
  measureC2pa,
  scoringUri,
  managedHeaders,
  MODEL_FIELD,
  modelValueFor,
  isWarming,
  awaitWarm,
  resetWarmingGate,
  WARMING,
  type GenerationRequest,
} from './backends.ts'

// Derived from the registry, never counted. Cosmos 3 Super failed to deploy and is `withdrawn`;
// a third model will be tried again, so the tests below assert SHAPE rather than arity.
const CANDIDATES = PROVIDERS.filter((p) => p.id !== REFERENCE.id)
const LIVE_CANDIDATES = CANDIDATES.filter((p) => p.status === 'live')
const digest = (value: string): string => createHash('sha256').update(value).digest('hex')

const sampleRequest = (prompt: string): GenerationRequest => ({
  prompt,
  spec: { kind: 'mark', width: 1024, height: 1024, format: 'png' },
  requestWidth: 1024,
  requestHeight: 1024,
  kitName: 'CloudsForge',
  accent: '#e8622c',
})

/* ------------------------------------------------------------------ the parity property */

test('every provider is given the same prompt for the same asset', () => {
  const recorded = referencePrompts()
  assert.ok(recorded.size > 0, 'the reference manifest carries no prompts to replay')

  let compared = 0
  for (const { surface, kind } of plannedAssets()) {
    const { key } = identityFor(surface, kind)
    if (!recorded.has(key)) continue // not generated for the reference yet; nothing to replay.

    const prompts = new Map<string, string>()
    for (const provider of PROVIDERS) prompts.set(provider.id, promptForProvider(provider.id, surface, kind))

    const distinct = new Set([...prompts.values()].map(digest))
    assert.equal(
      distinct.size,
      1,
      `${key}: the providers would be sent different prompts — ` +
        [...prompts].map(([id, p]) => `${id}=${digest(p).slice(0, 12)} (${p.length} chars)`).join(', '),
    )
    compared += 1
  }
  assert.ok(compared >= 50, `only ${compared} assets had a recorded prompt to compare`)
})

test('every provider replays the recorded prompt, including the reference', () => {
  const recorded = referencePrompts()
  // The case that makes this test worth having: an asset whose recorded prompt the current code no
  // longer produces. 36 of the 54 generated assets here are in that state. If ANY provider — the
  // reference included — recomputed instead of replaying, regenerating one of these would ask that
  // model a different question from the one the other two answered, and every other check in the
  // repository would stay green while the comparison quietly stopped meaning anything.
  const drifted = plannedAssets().filter(({ surface, kind }) => {
    const identity = identityFor(surface, kind)
    const record = recorded.get(identity.key)
    return record !== undefined && record !== promptFor(surface, identity.spec, kind)
  })
  assert.ok(
    drifted.length > 0,
    'no drifted asset to test against — if the code and the record have converged this test is ' +
      'no longer exercising replay and should be given a synthetic fixture instead',
  )
  for (const { surface, kind } of drifted) {
    const identity = identityFor(surface, kind)
    for (const provider of PROVIDERS) {
      assert.equal(
        promptForProvider(provider.id, surface, kind),
        recorded.get(identity.key),
        `${identity.key}: ${provider.id} was not given the recorded prompt`,
      )
    }
  }
})

test('changing the question is deliberate, reference-only, and visibly different', () => {
  const drifted = plannedAssets().find(({ surface, kind }) => {
    const identity = identityFor(surface, kind)
    const record = referencePrompts().get(identity.key)
    return record !== undefined && record !== promptFor(surface, identity.spec, kind)
  })!
  const { surface, kind } = drifted
  const identity = identityFor(surface, kind)

  // --reprompt on the reference asks the NEW question, and says so by being different.
  const reprompted = promptForProvider(REFERENCE.id, surface, kind, { reprompt: true })
  assert.equal(reprompted, promptFor(surface, identity.spec, kind))
  assert.notEqual(reprompted, referencePrompts().get(identity.key))

  // --reprompt on a candidate is refused: it would be that model alone answering a new question.
  for (const candidate of CANDIDATES) {
    assert.throws(
      () => promptForProvider(candidate.id, surface, kind, { reprompt: true }),
      RepromptNotForCandidateError,
    )
  }
})

test('an asset the reference has never generated cannot be generated for a candidate', () => {
  const { surface, kind } = plannedAssets()[0]!
  const invented = { ...surface, key: 'no-such-surface' }
  for (const candidate of CANDIDATES) {
    assert.throws(
      () => promptForProvider(candidate.id, invented, kind),
      MissingReferencePromptError,
      `${candidate.id} invented a prompt for an asset with no reference record`,
    )
  }
  // ...and the reference itself may, because it is the thing that establishes the record.
  assert.ok(promptForProvider(REFERENCE.id, invented, kind).length > 0)
})

test('promptFor takes no provider argument, so there is nowhere to put a per-model tweak', () => {
  // Structural rather than behavioural: the guarantee above is only cheap to keep true because the
  // builder cannot see who is asking. A fourth parameter here is the first step to losing it.
  assert.equal(promptFor.length, 3, 'promptFor gained a parameter; check it is not a provider')
})

/* ------------------------------------------------------------------ the envelope */

test('the reference backend puts the prompt in the body verbatim', () => {
  const backend = referenceBackend(REFERENCE, {
    endpoint: 'https://example.invalid',
    apiKey: 'not-a-real-key',
    imagePath: '/providers/blackforestlabs/v1/flux-2-pro',
    model: 'FLUX.2-pro',
    fallbackModel: '',
  })
  // A prompt with the shapes that get mangled by a helpful envelope: newlines between paragraphs,
  // a quoted name, an em dash and a hex value.
  const prompt = 'first paragraph\n\nthe name is "Forge Trade" — accent #2a9e93\n\nlast paragraph'
  const body = backend.bodyFor(sampleRequest(prompt))

  assert.equal(body['prompt'], prompt, 'the backend altered the prompt on its way into the body')
  // `model` in the body is required by that API even though the path already names the model, and
  // it is the line most likely to be deleted as duplication.
  assert.equal(body['model'], 'FLUX.2-pro')
  assert.equal(body['output_format'], 'png', 'without this the response is JPEG')
  assert.equal(body['width'], 1024)
  assert.equal(body['height'], 1024)
  // No negative prompt, no system preamble, no style suffix. The prohibitions live inside the
  // prompt text so that all three models receive them the same way.
  assert.deepEqual(
    Object.keys(body).sort(),
    ['height', 'model', 'output_format', 'prompt', 'width'],
    'the body grew a field; if it is prompt-adjacent, parity is at risk',
  )
})

/* ------------------------------------------------------------------ the stubs */

test('an unimplemented backend throws rather than guessing a wire shape', async () => {
  for (const candidate of CANDIDATES) {
    assert.equal(candidate.implemented, false, `${candidate.id} claims to be implemented`)
    const backend = managedComputeBackend(candidate)
    assert.throws(() => backend.bodyFor(sampleRequest('anything')), UnimplementedBackendError)
    // And through generate, which must refuse BEFORE it makes a request: an unknown body has to
    // cost nothing, and on a per-hour deployment "nothing" includes not making a billable call.
    await assert.rejects(
      backend.generate(sampleRequest('anything'), AbortSignal.timeout(1)),
      (err: unknown) => err instanceof Error,
    )
    // And through the front door, which is what generate.ts calls.
    if (candidate.status === 'live') {
      assert.throws(
        () => backendFor(candidate, {}).bodyFor(sampleRequest('anything')),
        UnimplementedBackendError,
      )
    }
  }
})

test('the unimplemented error names what has to be established, and leaks nothing', () => {
  const backend = managedComputeBackend(providerById('qwen-image-2512'))
  let message = ''
  try {
    backend.bodyFor(sampleRequest('x'))
  } catch (err) {
    message = (err as Error).message
  }

  // Route and auth came off this list when they were measured against the live deployment; the
  // body did not, and it is the one that blocks the rest.
  assert.ok(UNKNOWNS.length >= 8, 'the checklist has been trimmed; that is how a body gets guessed')
  assert.ok(UNKNOWNS[0]!.startsWith('BODY FIELD NAMES'), 'the blocking unknown is no longer first')
  for (const heading of ['BODY FIELD NAMES', 'RESPONSE SHAPE', 'C2PA', 'PROMPT LENGTH', 'CONCURRENCY']) {
    assert.ok(message.includes(heading), `the error no longer mentions ${heading}`)
  }
  // Nothing that could be a credential. The bound is the same one studio's redact uses: the live
  // Foundry key is 84 characters and the shortest thing worth redacting is 32.
  assert.equal(
    /[A-Za-z0-9_-]{32,}/.test(message),
    false,
    'the unimplemented error contains a token-shaped string',
  )
})

test('providers.json and the adapters agree about which backends work', () => {
  assert.equal(REFERENCE.implemented, true)
  assert.equal(REFERENCE.shipped, true)
  // Deliberately NOT an arity assertion. The comparison was three-way, is two-way because Cosmos
  // failed to deploy, and will be three-way again — the estate has a 3D/animation gap FLUX cannot
  // fill. A test that pinned the count would have to be edited every time that changes, which is
  // how a design gets quietly collapsed back into two hardcoded providers.
  assert.ok(CANDIDATES.length >= 1, 'there is nothing to compare the reference against')
  assert.ok(live().length >= 1)
  assert.ok(live().every((p) => p.status === 'live'))
  for (const candidate of CANDIDATES) {
    assert.equal(candidate.adapter, 'foundry-managed-compute')
    assert.equal(candidate.shipped, false)
    // The billing unit is not decoration: compare.py refuses to add costs across units, and the
    // whole honesty of §6 depends on this string being right.
    assert.equal(candidate.billing.unit, 'deployment hour')
    assert.equal(candidate.billing.hourlyRate, null, 'a rate was filled in; check it was measured')
  }
  // Withdrawn is a distinct state from unimplemented: the first is "the deployment is gone", the
  // second is "we do not know its wire shape". Cosmos is both, and only the first is why it cannot
  // be run.
  const cosmos = providerById('cosmos-3-super')
  assert.equal(cosmos.status, 'withdrawn')
  assert.throws(() => backendFor(cosmos, {}), ProviderWithdrawnError)
  assert.equal(providerById('qwen-image-2512').status, 'live')
  assert.equal(REFERENCE.billing.unit, 'provider image unit')
})

/* ------------------------------------------------------------------ the managed compute wire */

test('the scoring URI is built from the measured route, with the deployment name in it', () => {
  const qwen = providerById('qwen-image-2512')
  assert.equal(qwen.deployment, 'qwen--qwen-image-2512')
  assert.equal(qwen.deploymentVerified, true)
  assert.equal(
    scoringUri({
      baseUrl: 'https://example.services.ai.azure.com/',
      apiKey: 'x',
      deployment: qwen.deployment!,
      route: qwen.route!,
    }),
    'https://example.services.ai.azure.com/managed-deployments/qwen--qwen-image-2512/v1/chat/completions',
  )

  // Cosmos shares the host, so the deployment name is the only thing separating the two — and it
  // is still an assumption. If this ever flips to true without probe.ts having said so, the run
  // will be pointed at a name nobody checked.
  const cosmos = providerById('cosmos-3-super')
  assert.equal(cosmos.deploymentVerified, true)
  assert.equal(cosmos.status, 'withdrawn', 'the deployment was deleted after failing to come up')
  assert.notEqual(cosmos.deployment, qwen.deployment)
  // The near miss. `nvidia--cosmos-3-super` is the spelling anyone would type and it is a measured
  // 404 DeploymentNotFound; the extra hyphen is the whole difference. Pinned because this is the
  // second time this estate has lost time to a model name that differs by one character.
  assert.equal(cosmos.deployment, 'nvidia--cosmos3-super')
  assert.notEqual(cosmos.deployment, 'nvidia--cosmos-3-super')
})

test('the one settled body field is `model`, and its value is the deployment name', () => {
  // Measured, not assumed: {} -> 400 "Missed model deployment" named the field, the catalogue name
  // Qwen-Image-2512 -> 404, and the deployment name -> 500 warming. So the field is required and
  // the value is the deployment. Everything else about the body is still unknown, which is why
  // bodyFor still throws.
  assert.equal(MODEL_FIELD, 'model')
  const config = {
    baseUrl: 'https://example.services.ai.azure.com',
    apiKey: 'x',
    deployment: 'qwen--qwen-image-2512',
    route: '/managed-deployments/{deployment}/v1/chat/completions',
  }
  assert.equal(modelValueFor(config), 'qwen--qwen-image-2512')
  assert.notEqual(modelValueFor(config), 'Qwen-Image-2512', 'the catalogue name is a measured 404')
})

test('a warming 500 is not a failure, and a real 500 is', () => {
  assert.equal(isWarming(500, 'Model service is unavailable'), true)
  assert.equal(isWarming(500, 'MODEL SERVICE IS UNAVAILABLE'), true, 'the match must be case-insensitive')
  assert.equal(isWarming(503, 'model is not ready'), true)
  // The distinction the whole retry policy turns on. A 500 that is a genuine fault must NOT be
  // waited out for half an hour, and a 400 is never warming however it is worded.
  assert.equal(isWarming(500, 'internal server error'), false)
  assert.equal(isWarming(400, 'model service is unavailable'), false)
  assert.equal(isWarming(200, ''), false)
})

test('concurrent workers share one warming wait rather than each starting their own', async () => {
  resetWarmingGate()
  let polls = 0
  let slept = 0
  let clock = 0
  const poll = async (): Promise<boolean> => {
    polls += 1
    return polls >= 3 // serving on the third look
  }
  const sleep = async (ms: number): Promise<void> => {
    slept += 1
    clock += ms
  }
  const logs: string[] = []

  // Four workers hit the warming container at once. Ten workers hammering a container that is
  // loading weights do not make it load faster, and on dedicated hardware there is no 429 to tell
  // them to stop.
  await Promise.all(
    Array.from({ length: 4 }, () => awaitWarm(poll, (m) => logs.push(m), () => clock, sleep)),
  )
  assert.equal(polls, 3, 'the endpoint was polled once per wait, not once per worker per wait')
  assert.equal(slept, 3)
  assert.ok(logs.some((line) => line.includes('serving')))
  resetWarmingGate()
})

test('warming gives up at the budget rather than billing for ever', async () => {
  resetWarmingGate()
  let clock = 0
  const logs: string[] = []
  await awaitWarm(
    async () => false, // never comes up
    (m) => logs.push(m),
    () => clock,
    async (ms) => {
      clock += ms
    },
  )
  assert.ok(clock > WARMING.budgetMs, 'it stopped before the budget was spent')
  assert.ok(
    logs.some((line) => line.includes('past the budget')),
    'it gave up silently; a deployment that never warms must say so, because it is still billing',
  )
  resetWarmingGate()
})

test('the managed host is addressed with api-key, never a Bearer token', () => {
  // Measured: Bearer is a flat 401 there, and it is the natural mistake because Bearer is what
  // every other Azure ML scoring endpoint wants. Asserted on the object the code actually sends
  // rather than by grepping the source, so a comment mentioning Bearer cannot fail the build and
  // a real Bearer header cannot pass it.
  const headers = managedHeaders({
    baseUrl: 'https://example.services.ai.azure.com',
    apiKey: 'a-key',
    deployment: 'qwen--qwen-image-2512',
    route: '/managed-deployments/{deployment}/v1/chat/completions',
  })
  assert.deepEqual(Object.keys(headers).sort(), ['api-key', 'content-type'])
  assert.equal(headers['api-key'], 'a-key')
  assert.equal(headers['authorization'], undefined)
  assert.equal(headers['Authorization'], undefined)
})

/* ------------------------------------------------------------------ c2pa is measured */

test('c2pa is read off the bytes, never asserted', () => {
  assert.equal(measureC2pa(Buffer.from('\x89PNG\r\n\x1a\n....c2pa....')), true)
  assert.equal(measureC2pa(Buffer.from('\x89PNG\r\n\x1a\n....IDAT....')), false)
  assert.equal(measureC2pa(Buffer.alloc(0)), false)
})

/* ------------------------------------------------------------------ identity */

test('every generated entry in the reference manifest is a key identityFor produces', () => {
  const produced = new Set(plannedAssets().map(({ surface, kind }) => identityFor(surface, kind).key))
  const recorded = [...referencePrompts().keys()]
  const orphans = recorded.filter((key) => !produced.has(key))
  // `site/avatar@1024x1024` is a legitimate orphan: the org avatar was derived by hand from the
  // site mark and is not in plan.ts. Anything else means the plan and the manifest disagree about
  // what this set contains, which would make a candidate run silently skip assets.
  assert.deepEqual(orphans, [], `manifest keys with no place in the plan: ${orphans.join(', ')}`)
})
