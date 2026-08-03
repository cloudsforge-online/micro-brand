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

import { readFileSync } from 'node:fs'

import { SURFACES } from '../ui/packages/ui/src/surfaces.ts'
import { plannedAssets, CURRENCY } from './plan.ts'
import {
  identityFor,
  promptFor,
  promptForProvider,
  referencePrompts,
  MissingReferencePromptError,
  RepromptNotForCandidateError,
  RepromptNotForDialectError,
} from './prompts.ts'
import {
  PROVIDERS,
  REFERENCE,
  providerById,
  live,
  inDialect,
  dialectsInUse,
  ProviderWithdrawnError,
} from './providers.ts'
import {
  DIALECTS,
  LITERAL,
  NEGATION_VOCABULARY,
  applyDialect,
  dialectById,
  residualNegations,
  ResidualNegationError,
} from './dialects.ts'
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
  openAiImagesBackend,
  sizeParamFor,
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

test('every provider in a dialect is given the same prompt for the same asset', () => {
  const recorded = referencePrompts()
  assert.ok(recorded.size > 0, 'the reference manifest carries no prompts to replay')

  // Grouped by dialect rather than run over every provider at once. That is the ONE thing dialects
  // changed about this property, and the group is derived from the registry so a third dialect is
  // covered the day it is registered rather than the day somebody remembers to edit this test.
  let compared = 0
  for (const { surface, kind } of plannedAssets()) {
    const { key } = identityFor(surface, kind)
    if (!recorded.has(key)) continue // not generated for the reference yet; nothing to replay.

    for (const dialect of dialectsInUse()) {
      const group = inDialect(dialect)
      const prompts = new Map<string, string>()
      for (const provider of group) {
        try {
          prompts.set(provider.id, promptForProvider(provider.id, surface, kind))
        } catch (err) {
          // A prompt this dialect cannot yet clear of prohibitions is not a parity failure — it is
          // an asset that may not be generated in this dialect at all, which the residual test
          // below asserts separately and which promptForProvider enforces at run time.
          if (err instanceof ResidualNegationError) continue
          throw err
        }
      }
      if (prompts.size < 2) continue
      const distinct = new Set([...prompts.values()].map(digest))
      assert.equal(
        distinct.size,
        1,
        `${key}: the ${dialect}-dialect providers would be sent different prompts — ` +
          [...prompts].map(([id, p]) => `${id}=${digest(p).slice(0, 12)} (${p.length} chars)`).join(', '),
      )
    }
    compared += 1
  }
  assert.ok(compared >= 50, `only ${compared} assets had a recorded prompt to compare`)
})

/* ------------------------------------------------------------------ the dialect property */

test('a dialect is a pure function of the record, so a cross-dialect set is re-derivable', () => {
  // The claim that lets a second dialect exist without weakening anything. Within a dialect the
  // check is equality (above); ACROSS dialects it is this — the prompt a set is sent is exactly
  // what the named rules produce from the reference's own record, so the two sets are provably two
  // phrasings of ONE brief about ONE asset. verify.py --parity runs the same check on the
  // artefacts, from dialects.py, against the same dialects.json.
  const recorded = referencePrompts()
  let checked = 0
  for (const { surface, kind } of plannedAssets()) {
    const identity = identityFor(surface, kind)
    const record = recorded.get(identity.key)
    if (record === undefined) continue
    for (const provider of PROVIDERS) {
      if (provider.dialect === LITERAL.id) continue
      let sent: string
      try {
        sent = promptForProvider(provider.id, surface, kind)
      } catch (err) {
        if (err instanceof ResidualNegationError) continue
        throw err
      }
      assert.equal(sent, applyDialect(provider.dialect, record), `${identity.key} / ${provider.id}`)
      checked += 1
    }
  }
  assert.ok(checked > 0, 'no non-literal provider is registered, so this property is untested')
})

test('a dialect that is not the identity must actually differ, or its label is a lie', () => {
  // A no-op transform registered as a dialect would be the worst outcome available: two sets that
  // LOOK like a prompt-style experiment, are byte-identical in what they were asked, and produce a
  // difference that is pure sampling noise dressed up as a finding.
  const recorded = referencePrompts()
  for (const dialect of DIALECTS) {
    if (dialect.id === LITERAL.id) {
      assert.equal(dialect.rules.length, 0, 'the literal dialect grew a rule; it IS the record')
      for (const [, prompt] of recorded) assert.equal(applyDialect(dialect.id, prompt), prompt)
      continue
    }
    const moved = [...recorded.values()].filter((p) => applyDialect(dialect.id, p) !== p)
    assert.ok(
      moved.length > 0,
      `the ${dialect.id} dialect changes nothing on any recorded prompt — it is the identity ` +
        'transform under another name, and comparing a set generated with it against a literal ' +
        'set would present sampling noise as a prompting result',
    )
  }
})

test('a prompt that keeps its prohibitions cannot be sent in a dialect that forbids them', () => {
  // "Positive" is a measured property of the string, not a claim in a registry. The gate is at
  // generation time and it is a refusal to SPEND: a per-hour deployment makes "generate it and
  // notice later" cost real money, and a set labelled positive whose prompts are half-negative
  // would answer a question nobody asked while looking entirely correct on disk.
  const positive = DIALECTS.find((d) => d.checkResiduals)
  assert.ok(positive, 'no dialect checks its own residuals; the label is then unfalsifiable')

  // The vocabulary is real words, matched on word boundaries — "negative space" is in every brief
  // in this repository and is not a prohibition.
  assert.ok(NEGATION_VOCABULARY.includes('no') && NEGATION_VOCABULARY.includes('never'))
  assert.deepEqual(residualNegations(positive!.id, 'generous negative space, nonetheless'), [])
  assert.deepEqual(residualNegations(positive!.id, 'no bevels'), ['no'])
  // The literal dialect is the control and is SUPPOSED to be prohibition-heavy; flagging it would
  // be flagging the thing under test.
  assert.deepEqual(residualNegations(LITERAL.id, 'no bevels, never inverted'), [])

  // And through the front door: an asset whose rules do not clear it refuses to generate.
  const uncleared = plannedAssets().find(({ surface, kind }) => {
    const record = referencePrompts().get(identityFor(surface, kind).key)
    return record !== undefined && residualNegations(positive!.id, applyDialect(positive!.id, record)).length > 0
  })
  if (uncleared) {
    for (const provider of inDialect(positive!.id)) {
      assert.throws(
        () => promptForProvider(provider.id, uncleared.surface, uncleared.kind),
        ResidualNegationError,
      )
    }
  }
})

test('every registered provider declares a dialect that exists', () => {
  for (const provider of PROVIDERS) {
    assert.ok(provider.dialect, `${provider.id} declares no dialect`)
    assert.equal(dialectById(provider.dialect).id, provider.dialect)
  }
  // The reference is the record, so it is the literal dialect by definition. If this ever flips,
  // every other set's prompts derive from something that is itself a derivation.
  assert.equal(REFERENCE.dialect, LITERAL.id)
  assert.equal(LITERAL.source, null, 'the literal dialect derives from something; it IS the record')
  for (const dialect of DIALECTS) {
    if (dialect.id === LITERAL.id) continue
    assert.equal(dialect.source, LITERAL.id, `${dialect.id} does not derive from the record`)
  }
})

test('the two Qwen sets differ in exactly one field, and it is the dialect', () => {
  // The controlled part of the second experiment. If they differed in the model, the deployment,
  // the route or the concurrency, a difference in their output would have more than one available
  // explanation and the whole exercise would prove nothing.
  const literal = providerById('qwen-image-2512')
  const positive = providerById('qwen-image-2512-positive')
  const differs = (Object.keys(literal) as (keyof typeof literal)[]).filter(
    (k) => JSON.stringify(literal[k]) !== JSON.stringify(positive[k]),
  )
  assert.deepEqual(
    differs.sort(),
    // id/label/root are where a set LIVES; billing.source is a path and moves with the root; notes
    // are prose. `dialect` is the only field that changes what either set is asked.
    ['billing', 'dialect', 'id', 'label', 'notes', 'root'],
    'the two Qwen sets differ in something other than their dialect and their identity',
  )
  assert.equal(literal.dialect, LITERAL.id)
  assert.equal(positive.dialect, 'positive')
  // Everything that could give a difference in output a second explanation:
  assert.equal(literal.deployment, positive.deployment, 'same deployment, or it is not controlled')
  assert.equal(literal.adapter, positive.adapter)
  assert.equal(literal.route, positive.route)
  assert.equal(literal.concurrency, positive.concurrency)
  assert.deepEqual(literal.env, positive.env)
  assert.equal(literal.billing.unit, positive.billing.unit)
  assert.equal(literal.billing.sku, positive.billing.sku)
  // billing.source is the only part of billing that moved, and only because the file it names is
  // under the other root.
  assert.notEqual(literal.billing.source, positive.billing.source)
})

test('--reprompt is refused outside the dialect that holds the record', () => {
  // Unreachable while the reference is itself in the literal dialect, which it must be — the test
  // above pins that. It is here because the failure it prevents is silent and expensive: a reprompt
  // in a DERIVED dialect writes a record nothing produced, after which verify.py --parity can no
  // longer re-derive that set and the cross-dialect guarantee quietly stops being checkable while
  // every file on disk still looks correct.
  const message = new RepromptNotForDialectError('some-provider', 'positive', 'site/mark@1024x1024')
    .message
  assert.ok(message.includes('positive'))
  assert.ok(message.includes(LITERAL.id))
  assert.ok(message.includes('re-derive'))
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
      // The record, translated into that provider's dialect — which for every literal-dialect
      // provider is the record itself, unchanged, and that is still the case being tested here.
      // A dialect translates the RECORD; it never lets a provider fall back to promptFor.
      let sent: string
      try {
        sent = promptForProvider(provider.id, surface, kind)
      } catch (err) {
        if (err instanceof ResidualNegationError) continue
        throw err
      }
      assert.equal(
        sent,
        applyDialect(provider.dialect, recorded.get(identity.key)!),
        `${identity.key}: ${provider.id} was not given the recorded prompt`,
      )
      if (provider.dialect === LITERAL.id) {
        assert.equal(sent, recorded.get(identity.key), `${identity.key}: ${provider.id} recomputed`)
        assert.notEqual(sent, promptFor(surface, identity.spec, kind), 'it recomputed and matched')
      }
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
  // Qwen is implemented now that its wire shape was measured. What must still refuse is a
  // provider whose body shape is unknown — and the checklist has to survive, because the next
  // model will arrive the same way this one did.
  for (const candidate of CANDIDATES.filter((p) => p.adapter === 'foundry-managed-compute')) {
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
  // Qwen turned out to serve on an OpenAI-shaped images route, not under /managed-deployments/.
  assert.equal(qwen.route, '/openai/v1/images/generations')
  assert.equal(
    scoringUri({
      baseUrl: 'https://example.services.ai.azure.com/',
      apiKey: 'x',
      deployment: qwen.deployment!,
      route: qwen.route!,
    }),
    'https://example.services.ai.azure.com/openai/v1/images/generations',
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

test('the Qwen envelope carries the prompt verbatim and transposes the size', () => {
  const qwen = providerById('qwen-image-2512')
  assert.equal(qwen.adapter, 'foundry-openai-images')
  assert.equal(qwen.implemented, true)
  const backend = openAiImagesBackend(qwen, {
    baseUrl: 'https://h.example',
    apiKey: 'k',
    deployment: 'qwen--qwen-image-2512',
    route: '/openai/v1/images/generations',
  })
  const prompt = 'first paragraph\n\nthe name is "Forge Trade" — accent #2a9e93\n\nlast paragraph'
  const body = backend.bodyFor({
    prompt,
    spec: { kind: 'wordmark', width: 1024, height: 384, format: 'png' },
    requestWidth: 1024,
    requestHeight: 384,
    kitName: 'Forge Trade',
    accent: '#2a9e93',
  })

  // Parity: untouched, un-prefixed, un-truncated.
  assert.equal(body['prompt'], prompt)
  assert.equal(body['model'], 'qwen--qwen-image-2512')
  // Required; the OpenAI default `url` is a measured 400 from the model itself.
  assert.equal(body['response_format'], 'b64_json')
  assert.equal(body['n'], 1)

  // THE TRAP. Asking this endpoint for 1024x384 delivers 384x1024 while reporting 1024x384, so
  // the envelope asks for the transpose. A square probe cannot see this — which is how it survived
  // a careful handover — and every wordmark, OG card and banner in the estate is non-square.
  assert.equal(body['size'], '384x1024')
  assert.equal(sizeParamFor(1280, 640), '640x1280')
  assert.equal(sizeParamFor(512, 512), '512x512', 'squares are unaffected, which is why it hides')

  // width/height are a measured `unrecognized_request_argument` here; the reference provider is
  // the exact mirror image, taking those and ignoring `size`.
  assert.equal(body['width'], undefined)
  assert.equal(body['height'], undefined)
  assert.deepEqual(
    Object.keys(body).sort(),
    ['model', 'n', 'prompt', 'response_format', 'size'],
    'the body grew a field; if it is prompt-adjacent, parity is at risk',
  )
})

test('the two implemented backends are given the identical prompt for one asset', () => {
  // The end-to-end version of the parity property: same asset, both live providers, compare the
  // strings that reach the wire rather than the strings that go into the builders.
  const qwen = providerById('qwen-image-2512')
  const prompt = 'a prompt with\n\nparagraphs and "quotes" and — dashes'
  const request = {
    prompt,
    spec: { kind: 'mark' as const, width: 1024, height: 1024, format: 'png' as const },
    requestWidth: 1024,
    requestHeight: 1024,
    kitName: 'x',
    accent: '#e8622c',
  }
  const qwenBody = openAiImagesBackend(qwen, {
    baseUrl: 'https://h.example',
    apiKey: 'k',
    deployment: qwen.deployment!,
    route: qwen.route!,
  }).bodyFor(request)
  const fluxBody = referenceBackend(REFERENCE, {
    endpoint: 'https://f.example',
    apiKey: 'k',
    imagePath: '/p',
    model: 'FLUX.2-pro',
    fallbackModel: '',
  }).bodyFor(request)
  assert.equal(qwenBody['prompt'], fluxBody['prompt'])
  assert.equal(qwenBody['prompt'], prompt)
})

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

/* ------------------------------------------------------------------ the currency seam */

test('no currency identity is a registry surface', () => {
  // The inverse of generate.ts's registry guard, and the reason CURRENCY is allowed to sit outside
  // PLAN at all. PLAN is checked against ui/packages/ui/src/surfaces.ts so a hand-copied accent
  // cannot drift; CURRENCY escapes that check because a currency has no registry row to be checked
  // against. If a real surface were ever moved into CURRENCY it would escape the check too, and a
  // whole surface could be generated in a colour nobody chose — design-system.md §7 item 1.
  const registry = new Set(SURFACES.map((s) => String(s.key)))
  const smuggled = CURRENCY.filter((planned) => registry.has(planned.key)).map((p) => p.key)
  assert.deepEqual(smuggled, [], `registry surface(s) hiding in CURRENCY: ${smuggled.join(', ')}`)
})

test('EMBER and Sparks are one currency: same accent, told apart by form', () => {
  // 23-tessera.md:716 — "Sparks is a display denomination of EMBER. It is not a second assetCode,
  // and it must never become one." A second hue would say otherwise, and would also fail the bar
  // 23-tessera.md:325 sets for this icon set: legible to someone who cannot tell two accents
  // apart. So the denomination is carried by enclosure, and this asserts the colour never becomes
  // the carrier.
  const accents = new Set(CURRENCY.map((c) => c.accent.toLowerCase()))
  assert.equal(accents.size, 1, `the currency marks must share one accent, got ${[...accents]}`)
  assert.equal([...accents][0], '#e8622c')
})

test('derive.py ICON_SURFACES has not drifted from plan.ts CURRENCY', () => {
  // derive.py cannot import plan.ts, so it hand-copies the currency keys — the same arrangement
  // plan.ts itself has with the surface registry, and the same reason it needs asserting. If they
  // drift, a currency mark is generated and then silently gets no 256 icon, or a surface that is
  // not a currency gets one.
  const source = readFileSync(new URL('./derive.py', import.meta.url), 'utf8')
  const block = /ICON_SURFACES\s*=\s*\(([^)]*)\)/.exec(source)
  assert.ok(block, 'ICON_SURFACES not found in derive.py')
  const copied = [...block[1]!.matchAll(/"([^"]+)"/g)].map((m) => m[1]!)
  assert.deepEqual(copied.sort(), CURRENCY.map((c) => c.key).sort())
})
