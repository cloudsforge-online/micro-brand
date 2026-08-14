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
 * comparison needs. What it needs is that when ANY challenger is asked for `site/mark`, it is
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
  isWarming,
  awaitWarm,
  resetWarmingGate,
  WARMING,
  openaiImagesBackend,
  nativeRequestFor,
  retryAfterSeconds,
  MIN_PIXEL_BUDGET,
  OPENAI_IMAGES_GRID,
  OPENAI_IMAGES_QUALITY,
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
  // ---- THE PROPERTY, OVER EVERY REGISTERED DIALECT. This half always has an operand.
  //
  // It used to loop over registered PROVIDERS and end with
  // `assert.ok(checked > 0, 'no non-literal provider is registered, so this property is untested')`
  // — a dormancy guard the original author was right to write, and which started failing the day
  // the owner withdrew Qwen and its positive-dialect entry went with it.
  //
  // The guard was NOT relaxed to `>= 0`, which would have made a check pass by removing its
  // ability to fail. The loop was moved onto the set the property is actually about. "A dialect is
  // a pure function of the record" is a statement about DIALECTS; providers were only ever how the
  // estate happened to reach them, and `dialects.json` still registers `positive` whether or not
  // any set was generated in it. So this half is broader than what it replaces: it covers a
  // dialect with no provider today, and it covers a third dialect the day it is registered rather
  // than the day a set is generated in it.
  let derived = 0
  for (const dialect of DIALECTS) {
    if (dialect.id === LITERAL.id) continue
    for (const record of referencePrompts().values()) {
      const sent = applyDialect(dialect.id, record)
      // Pure: same input, same output, no hidden state between calls.
      assert.equal(sent, applyDialect(dialect.id, record), `${dialect.id} is not deterministic`)
      // Total: it returns a prompt for every record rather than throwing on the awkward ones.
      assert.equal(typeof sent, 'string')
      derived += 1
    }
  }
  assert.ok(derived > 0, 'no non-literal dialect is registered, so this property is untested')

  // ---- AND THE SAME PROPERTY THROUGH promptForProvider, which is what actually runs at
  // generation time. DORMANT while every registered provider is literal: the loop below has
  // nothing to iterate, and `checkedViaProvider` is reported rather than asserted away, because a
  // zero here means "there is no non-literal set to send" and not "the transform agreed".
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
  assert.equal(
    checked === 0,
    PROVIDERS.every((p) => p.dialect === LITERAL.id),
    'checkedViaProvider disagrees with the registry: either a non-literal provider was skipped, ' +
      'or one was iterated that is not registered',
  )
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

/**
 * WHAT REPLACED THE DIALECT-PAIR TEST, AND WHY IT IS NOT A REDUCTION.
 *
 * A test used to assert that `qwen-image-2512` and `qwen-image-2512-positive` differed in exactly
 * one meaningful field — the dialect — so that a difference in their output had exactly one
 * available explanation. The owner withdrew that model and both entries went; a test that looks up
 * a deleted provider id can only ever fail for the wrong reason.
 *
 * The property it protected is not "those two entries exist". It is **"the registry can express two
 * sets that share every wire fact and differ only in what was asked"**, which is the thing that
 * made the §9 experiment controlled rather than suggestive. That is asserted below against a pair
 * CONSTRUCTED here, so it holds with one provider registered, with four, and on the day the next
 * challenger lands and somebody wants to ask it the same question twice.
 */
test('the registry can still express a controlled dialect pair', () => {
  const base = providerById(REFERENCE.id)
  const positive = { ...base, id: `${base.id}-positive`, dialect: 'positive' }
  const differs = (Object.keys(base) as (keyof typeof base)[]).filter(
    (k) => JSON.stringify(base[k]) !== JSON.stringify(positive[k]),
  )
  // Everything that could give a difference in output a second explanation is equal by
  // construction; `dialect` is the only field that changes what either set is asked.
  assert.deepEqual(differs.sort(), ['dialect', 'id'])
  assert.equal(base.dialect, LITERAL.id)
  assert.ok(dialectById('positive'), 'the positive dialect is no longer registered')

  // A clause from the real rule list rather than an invented one, so this asserts the dialect
  // still transforms THIS estate's briefs and not merely that it transforms something.
  const clause = 'with exactly one accent colour — #e8622c — and no second hue anywhere'
  assert.notEqual(
    applyDialect('positive', clause),
    clause,
    'the positive dialect has become the identity transform, so the pair could not differ',
  )
  assert.deepEqual(
    residualNegations('positive', applyDialect('positive', clause)),
    [],
    'the positive dialect no longer clears the clause it was written for',
  )
  for (const provider of PROVIDERS) {
    assert.ok(DIALECTS.some((d) => d.id === provider.dialect), `${provider.id}: unknown dialect`)
  }
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
  // What must refuse is a provider whose body shape is unknown, and the checklist has to survive
  // the withdrawal of the one model whose shape WAS measured — because the next model will arrive
  // exactly the way that one did, and UNKNOWNS is the list that stops a plausible body being
  // guessed and returning 200 with a differently-interpreted prompt.
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
  const backend = managedComputeBackend(providerById('cosmos-3-super'))
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
  // Deliberately NOT an arity assertion, and that decision has now been tested by events. The
  // comparison was briefed three-way, ran two-way because Cosmos failed to deploy, and is one-way
  // since the owner withdrew Qwen — and not one of those three transitions needed an edit here.
  // The estate has a 3D/animation gap FLUX cannot fill, so the count will move again. A test that
  // pinned it would have to be edited every time, which is how a design gets quietly collapsed
  // back into two hardcoded providers.
  assert.ok(CANDIDATES.length >= 1, 'there is nothing to compare the reference against')
  assert.ok(live().length >= 1)
  assert.ok(live().every((p) => p.status === 'live'))
  for (const candidate of CANDIDATES) {
    assert.equal(candidate.shipped, false)
    assert.equal(candidate.billing.hourlyRate, null, 'a rate was filled in; check it was measured')
  }

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // BILLING IS ASSERTED AS A CONSISTENT SHAPE, NOT AS A LIST OF KNOWN UNIT STRINGS.
  //
  // This used to read `assert.equal(candidate.billing.unit, 'deployment hour')` for every
  // candidate, on the reasoning that the unit string is not decoration — compare.py refuses to add
  // costs across units and the honesty of COMPARISON.md §6 depends on it being right. The
  // reasoning was correct and the assertion was the wrong shape for it: it pinned the two units
  // that happened to exist, so a third one could only ever arrive by editing a test, and the
  // obvious edit is to widen it into a set of allowed strings that then has to be widened again.
  //
  // gpt-image-2 is the third unit — output image tokens, per image, and neither of the other two.
  // What actually has to hold is not WHICH unit it is but that the unit and the BASIS agree, and
  // that the basis is one compare.py knows how to read: `per image generated` takes the per-image
  // path and needs a response field named as its source, `per hour…` takes the deployment-hour
  // path and needs a DEPLOYMENT.json and a SKU. compare.py branches on `basis` for exactly this
  // reason. A provider whose blocks disagree would send it down a path that reads a file that is
  // not there, or would silently report a per-image cost for something that has none.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  for (const provider of PROVIDERS) {
    const { unit, basis, source, sku } = provider.billing
    assert.ok(unit.length > 0, `${provider.id}: no billing unit`)
    assert.ok(
      basis.startsWith('per image generated') || basis.startsWith('per hour'),
      `${provider.id}: billing basis "${basis}" is one compare.py cannot dispatch on`,
    )
    if (basis.startsWith('per image generated')) {
      // A per-image provider has to name the response field its figure comes off, because that
      // figure lands in providerCostUnits on every row and there is no other record of where it
      // came from months later.
      assert.ok(
        source.includes('providerCostUnits'),
        `${provider.id}: a per-image basis must say which response field providerCostUnits holds`,
      )
      assert.equal(sku, null, `${provider.id}: a per-image provider has no hardware SKU`)
    } else {
      assert.ok(
        source.includes('DEPLOYMENT.json'),
        `${provider.id}: an hourly basis must name the operator's deployment record as its source`,
      )
      assert.ok(sku !== null, `${provider.id}: an hourly provider bills for a SKU; name it`)
    }
  }
  // Withdrawn is a distinct state from unimplemented: the first is "the deployment is gone", the
  // second is "we do not know its wire shape". Cosmos is both, and only the first is why it cannot
  // be run.
  const cosmos = providerById('cosmos-3-super')
  assert.equal(cosmos.status, 'withdrawn')
  assert.throws(() => backendFor(cosmos, {}), ProviderWithdrawnError)
  assert.equal(REFERENCE.status, 'live')
  assert.equal(REFERENCE.billing.unit, 'provider image unit')
})

/* ------------------------------------------------------------------ the managed compute wire */

test('the scoring URI is built from the measured route, with the deployment name in it', () => {
  // FACTS ABOUT THE HOST, NOT ABOUT A MODEL. The withdrawn Qwen deployment is what most of these
  // were learned on, and they are kept because the next Managed Compute challenger lands on the
  // same route with the same header and the same deployment-name rule. Every line cost a real
  // request; re-establishing them would cost the same requests again.
  const cosmos = providerById('cosmos-3-super')
  assert.equal(cosmos.route, '/managed-deployments/{deployment}/v1/chat/completions')
  assert.equal(
    scoringUri({
      baseUrl: 'https://example.services.ai.azure.com/',
      apiKey: 'x',
      deployment: cosmos.deployment!,
      route: cosmos.route!,
    }),
    'https://example.services.ai.azure.com/managed-deployments/nvidia--cosmos3-super/v1/chat/completions',
  )
  // The trailing slash on the base URL must not double up. Measured: a doubled slash is a 404 that
  // looks exactly like a deployment that was never created.
  assert.ok(!scoringUri({
    baseUrl: 'https://example.services.ai.azure.com/',
    apiKey: 'x',
    deployment: cosmos.deployment!,
    route: cosmos.route!,
  }).includes('.com//'))

  assert.equal(cosmos.deploymentVerified, true)
  assert.equal(cosmos.status, 'withdrawn', 'the deployment was deleted after failing to come up')
  // The near miss. `nvidia--cosmos-3-super` is the spelling anyone would type and it is a measured
  // 404 DeploymentNotFound; the extra hyphen is the whole difference. Pinned because this is the
  // second time this estate has lost time to a model name that differs by one character.
  assert.equal(cosmos.deployment, 'nvidia--cosmos3-super')
  assert.notEqual(cosmos.deployment, 'nvidia--cosmos-3-super')
})

test('the one settled body field is `model`, and its value is the deployment name', () => {
  // Measured on this host, not assumed: {} -> 400 "Missed model deployment" named the field, a
  // CATALOGUE name -> 404, and the DEPLOYMENT name -> 500 warming. So the field is required and its
  // value is the deployment. That is a property of the host and it outlives the deployment it was
  // learned on; everything else about the body is still unknown, which is why bodyFor still throws.
  assert.equal(MODEL_FIELD, 'model')
  const config = {
    baseUrl: 'https://example.services.ai.azure.com',
    apiKey: 'x',
    deployment: 'nvidia--cosmos3-super',
    route: '/managed-deployments/{deployment}/v1/chat/completions',
  }
  assert.equal(modelValueFor(config), 'nvidia--cosmos3-super')
  assert.notEqual(modelValueFor(config), 'Cosmos-3-Super', 'the catalogue name is a measured 404')
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
    deployment: 'nvidia--cosmos3-super',
    route: '/managed-deployments/{deployment}/v1/chat/completions',
  })
  assert.deepEqual(Object.keys(headers).sort(), ['api-key', 'content-type'])
  assert.equal(headers['api-key'], 'a-key')
  assert.equal(headers['authorization'], undefined)
  assert.equal(headers['Authorization'], undefined)
})

/* ------------------------------------------------------------------ c2pa is measured */

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT REPLACED THE TWO QWEN ENVELOPE TESTS, AND WHY IT IS NOT A REDUCTION
 *
 * Two tests were deleted with the Qwen deployment. One asserted that its OpenAI-images envelope
 * carried the prompt verbatim and that `sizeParamFor` transposed the requested size; the other put
 * both live backends side by side and compared the strings that reached the wire.
 *
 * The transposition half pinned a WORKAROUND for one vendor's bug, in an endpoint that no longer
 * exists. A test that pins a deleted workaround can only ever fail for the wrong reason, and
 * keeping it would be keeping a green tick rather than a check.
 *
 * The property both really protected is not "we transpose". It is **"a delivered image is the size
 * that was asked for, measured on the bytes"** and **"the prompt reaches the wire untouched"**.
 * Both survive here and neither is specific to any model: `generate.ts`'s `TransposedDeliveryError`
 * still refuses to keep a rotated file for ANY provider, and `verify.py`'s cross-set check still
 * re-measures every non-square asset. Both are blind on a square, so the size of the population
 * they can see is pinned below — a suite that stopped knowing how many non-square assets exist
 * would not notice the day that number went to zero.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
test('the reference envelope carries the prompt verbatim', () => {
  const prompt = 'first paragraph\n\nthe name is "Forge Trade" — accent #2a9e93\n\nlast paragraph'
  const body = referenceBackend(REFERENCE, {
    endpoint: 'https://f.example',
    apiKey: 'k',
    imagePath: '/p',
    model: 'FLUX.2-pro',
    fallbackModel: '',
  }).bodyFor({
    prompt,
    spec: { kind: 'wordmark', width: 1024, height: 384, format: 'png' },
    requestWidth: 1024,
    requestHeight: 384,
    kitName: 'Forge Trade',
    accent: '#2a9e93',
  })
  // Untouched, un-prefixed, un-truncated. A backend that prepended a system preamble, appended a
  // negative prompt or trimmed to a token budget fails right here.
  assert.equal(body['prompt'], prompt)
})

test('the reference asks for the size it wants, and the non-square population is pinned', () => {
  const backend = referenceBackend(REFERENCE, {
    endpoint: 'https://f.example',
    apiKey: 'k',
    imagePath: '/p',
    model: 'FLUX.2-pro',
    fallbackModel: '',
  })

  // Read off the shipped MANIFEST rather than off the plan, because the manifest is the record of
  // what was actually generated at what size — and it is the same artefact verify.py measures.
  const manifest = JSON.parse(
    readFileSync(new URL('./MANIFEST.json', import.meta.url), 'utf8'),
  ) as { assets: { declaredSize: string; derivedFrom?: string }[] }
  const sizes = manifest.assets
    .filter((a) => !a.derivedFrom)
    .map((a) => a.declaredSize.split('x').map(Number) as [number, number])
  const nonSquare = sizes.filter(([w, h]) => w !== h)

  // Not a decoration. `TransposedDeliveryError` and verify.py's delivered-size check are both blind
  // on a square, so the number of non-square assets IS the population those two can see. Every
  // wordmark, OG card and social banner in this estate is non-square, which is exactly the set the
  // withdrawn endpoint's transposition bug would have silently rotated while every log line looked
  // correct. A suite that stopped knowing this number would not notice the day it went to zero.
  assert.ok(
    nonSquare.length > 0,
    'no non-square asset is generated, so nothing in this repository can observe a rotation',
  )

  for (const [width, height] of nonSquare.slice(0, 8)) {
    const body = backend.bodyFor({
      prompt: 'x',
      spec: { kind: 'wordmark', width, height, format: 'png' },
      requestWidth: width,
      requestHeight: height,
      kitName: 'x',
      accent: '#e8622c',
    })
    // Width and height as themselves. The reference provider takes exactly these and ignores
    // `size`; nothing in this repository transposes anything any more.
    assert.equal(body['width'], width)
    assert.equal(body['height'], height)
  }
})

/* ------------------------------------------------------------------ the openai-images wire */

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * EVERY ASSERTION BELOW PINS A MEASUREMENT, NOT A DOCUMENTED BEHAVIOUR.
 *
 * Eleven probe requests were made against the live deployment, serialised forty seconds apart,
 * before one asset was generated. Three of the results contradict what the OpenAI images API
 * documents for this route, and the two that shaped the run are the size rules — 16-pixel
 * divisibility, and an undocumented minimum pixel budget that had to be bisected.
 *
 * These are here rather than in a comment because backends.ts's header is a paragraph a future
 * reader can disagree with and this is a check that fails. The previous challenger's envelope
 * tests were deleted with its endpoint; these belong to facts about a deployment that exists.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const GPT = () => providerById('gpt-image-2')
const gptBackend = () =>
  openaiImagesBackend(GPT(), { url: 'https://images.example/v1', apiKey: 'k', model: 'gpt-image-2' })

const requestFor = (width: number, height: number, prompt = 'x'): GenerationRequest => ({
  prompt,
  spec: { kind: 'mark', width, height, format: 'png' },
  requestWidth: width,
  requestHeight: height,
  kitName: 'Forge Site',
  accent: '#e8622c',
})

test('the openai-images envelope carries the prompt verbatim and names the model in the body', () => {
  const prompt = 'first paragraph\n\nthe name is "Forge Trade" — accent #2a9e93\n\nlast paragraph'
  const body = gptBackend().bodyFor(requestFor(1024, 1024, prompt))
  // Untouched, un-prefixed, un-truncated. The whole comparison is this string being identical to
  // the one FLUX was sent for the same asset.
  assert.equal(body['prompt'], prompt)
  // Measured: the route is model-agnostic, so `model` is required in the body. The reference
  // provider sets the same trap from the other direction — model in the path AND in the body.
  assert.equal(body['model'], 'gpt-image-2')
  assert.equal(body['n'], 1)
  // Measured: `quality` defaults to "low" (91 output tokens at 1280x640). The set is generated at
  // "high" (7,024 at 1024x1024) because FLUX's serverless deployment has no quality tier, so the
  // cheap default would be scoring the challenger against a handicap FLUX never had to accept.
  assert.equal(body['quality'], OPENAI_IMAGES_QUALITY)
  assert.equal(OPENAI_IMAGES_QUALITY, 'high')
  // NOT sent, and each absence is a measurement:
  //   output_format — PNG is this endpoint's default; FLUX returns JPEG unless asked.
  //   background    — "transparent" is a 400 on this model, and every asset here is on #12100f.
  //   seed          — a 400 `unknown_parameter`. There is no seed to record on any entry.
  assert.deepEqual(Object.keys(body).sort(), ['model', 'n', 'prompt', 'quality', 'size'])
})

test('the size rules are the measured ones: the 16-grid, and a bisected minimum pixel budget', () => {
  // Both dimensions divisible by 16 — the same granularity FLUX floors to. 1200x630 is a 400.
  assert.equal(OPENAI_IMAGES_GRID, 16)
  // The smallest pixel count MEASURED to be accepted (1024x640), not the largest measured to be
  // refused (1024x512) and not a number interpolated between them. 768x768 sits in that gap.
  assert.equal(MIN_PIXEL_BUDGET, 655_360)
  assert.ok(1024 * 512 < MIN_PIXEL_BUDGET, '1024x512 was refused and must stay below the budget')
  assert.ok(1024 * 640 >= MIN_PIXEL_BUDGET, '1024x640 was accepted and must stay above it')

  // Asked for as they stand: every one of these was delivered at exactly these dimensions.
  for (const [width, height] of [[1024, 1024], [1200, 640], [1280, 640], [1536, 1024]] as const) {
    assert.equal(nativeRequestFor(width, height), null, `${width}x${height} needs no native`)
  }

  // The two this set declares that fall under the budget, and the two sizes that were probed for
  // them. Both are EXACT integer multiples of the declared size, so the downscale is a clean ratio
  // rather than a resample onto a fractional grid — 1024x384 x1.5 and 512x512 x2.
  assert.deepEqual(nativeRequestFor(1024, 384), { width: 1536, height: 576 })
  assert.deepEqual(nativeRequestFor(512, 512), { width: 1024, height: 1024 })

  // The property that makes the downscale honest, asserted rather than described: the native is
  // the same shape and it is BIGGER. Nothing anywhere is upscaled.
  for (const [width, height] of [[1024, 384], [512, 512], [256, 256], [1024, 512]] as const) {
    const native = nativeRequestFor(width, height)!
    assert.ok(native.width > width && native.height > height, `${width}x${height} did not grow`)
    assert.equal(native.width / width, native.height / height, 'the aspect ratio moved')
    assert.equal(native.width % OPENAI_IMAGES_GRID, 0)
    assert.equal(native.height % OPENAI_IMAGES_GRID, 0)
    assert.ok(native.width * native.height >= MIN_PIXEL_BUDGET)
  }
})

test('a native request is reported on the result, so the transposition check stays measurable', async () => {
  // A 1x1 PNG, IHDR only — enough for reportSizing, which reads bytes 16..24.
  const png = (width: number, height: number): string => {
    const bytes = Buffer.alloc(24)
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes, 0)
    bytes.write('IHDR', 12, 'ascii')
    bytes.writeUInt32BE(width, 16)
    bytes.writeUInt32BE(height, 20)
    return bytes.toString('base64')
  }
  const respond = (body: string): Response =>
    new Response(body, { status: 200, headers: { 'content-type': 'application/json' } })

  const backend = openaiImagesBackend(
    GPT(),
    { url: 'https://images.example/v1', apiKey: 'k', model: 'gpt-image-2' },
    {
      fetch: async () =>
        respond(JSON.stringify({ data: [{ b64_json: png(1536, 576) }], usage: { output_tokens: 2493 } })),
      log: () => {},
    },
  )
  const result = await backend.generate(requestFor(1024, 384), AbortSignal.timeout(5_000))
  // The wordmark falls under the budget, so the backend asked for 1536x576 and SAYS SO. Without
  // this, generate.ts would measure 1536x576 bytes against a 1024x384 request, report every
  // wordmark in the set as unsized, and the transposition check would be switched off to quieten
  // it — which is exactly how a real rotation gets through.
  assert.deepEqual(result.nativeRequest, { width: 1536, height: 576 })
  // The provider's own accounting, not ours. Tokens, which is a third billing unit.
  assert.equal(result.providerCostUnits, 2493)
  // Null on purpose: this provider reports no megapixel figure, and our own measurement of the
  // delivered area does not belong in a column named for theirs.
  assert.equal(result.providerOutputMegapixels, null)
  // Measured: `seed` is an unknown_parameter here, so there is nothing true to record.
  assert.equal(result.seed, null)
  assert.equal(result.backend, 'openai-images')

  // And an asset that clears the budget reports null, which is the normal case.
  const square = openaiImagesBackend(
    GPT(),
    { url: 'https://images.example/v1', apiKey: 'k', model: 'gpt-image-2' },
    {
      fetch: async () => respond(JSON.stringify({ data: [{ b64_json: png(1024, 1024) }] })),
      log: () => {},
    },
  )
  const plain = await square.generate(requestFor(1024, 1024), AbortSignal.timeout(5_000))
  assert.equal(plain.nativeRequest, null)
  assert.equal(plain.providerCostUnits, null)
})

test('a real-sized success envelope is decoded whole, not truncated into a parse error', async () => {
  // ════════════════════════════════════════════════════════════════════════════════════════════
  // THE REGRESSION TEST FOR THE DEFECT THAT COST TEN GENERATED IMAGES.
  //
  // The backend read the response with `(await response.text()).slice(0, 4_000)` and then parsed
  // THAT. Every test above passed, because a fixture PNG is 24 bytes and its envelope is around
  // 150 characters. A real one is a 154KB PNG carried as base64: roughly 205,000 characters. So
  // the first live run threw `Unterminated string in JSON at position 4000` on every asset, three
  // retries each, after the endpoint had generated and billed each image.
  //
  // This is therefore the one test in this file that cares about SIZE rather than shape, and the
  // padding below is not decoration — a fixture smaller than the cap cannot fail this way, which
  // is precisely why nothing caught it. It asserts the bytes come back intact, not merely that
  // the call resolved: a decode that silently returned a prefix would be worse than a throw.
  // ════════════════════════════════════════════════════════════════════════════════════════════
  const bytes = Buffer.alloc(160_000)
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes, 0)
  bytes.write('IHDR', 12, 'ascii')
  bytes.writeUInt32BE(1024, 16)
  bytes.writeUInt32BE(1024, 20)
  // Not zeroes: base64 of a zero-filled buffer compresses to nothing interesting and would not
  // resemble the payload that broke this. Deterministic rather than random, so a failure is one
  // a second run reproduces.
  for (let index = 24; index < bytes.length; index += 1) bytes[index] = (index * 37) % 251

  const envelope = JSON.stringify({
    data: [{ b64_json: bytes.toString('base64') }],
    usage: { output_tokens: 7024 },
  })
  assert.ok(envelope.length > 200_000, 'the fixture envelope is not the size of a real one')

  let recorded: readonly { detail: string }[] = []
  const backend = openaiImagesBackend(
    GPT(),
    { url: 'https://images.example/v1', apiKey: 'k', model: 'gpt-image-2' },
    {
      fetch: async () =>
        new Response(envelope, { status: 200, headers: { 'content-type': 'application/json' } }),
      log: () => {},
    },
  )
  const result = await backend.generate(requestFor(1024, 1024), AbortSignal.timeout(10_000))
  assert.equal(result.bytes.length, bytes.length)
  assert.ok(result.bytes.equals(bytes), 'the decoded bytes are not the bytes that were sent')
  assert.equal(result.providerCostUnits, 7024)

  // And the other half of the fix: the cap moved to where the string is REPORTED. An ok attempt
  // must not carry a quarter of a megabyte of shredded base64 into the manifest.
  recorded = result.attempts
  assert.equal(recorded.length, 1)
  assert.ok(recorded[0]!.detail.length < 200, `an ok attempt stored ${recorded[0]!.detail.length} chars`)
  assert.match(recorded[0]!.detail, /^ok, \d+ character envelope$/)
})

test('a 429 is waited out on the endpoint`s own terms, and counted', async () => {
  // Measured: AIServices S0 in Sweden Central answers 429 RateLimitReached with "Please retry
  // after 32 seconds" in the BODY. The standard Retry-After header is not always sent, which is
  // why both are read and the larger is taken.
  assert.equal(retryAfterSeconds(new Headers(), 'Please retry after 32 seconds.'), 33)
  assert.equal(retryAfterSeconds(new Headers({ 'retry-after': '47' }), 'nothing useful'), 48)
  assert.equal(retryAfterSeconds(new Headers({ 'retry-after': '5' }), 'retry after 32 seconds'), 33)
  // Null rather than a number invented here: the caller then uses its own blind backoff and says
  // on stdout that the response did not specify one.
  assert.equal(retryAfterSeconds(new Headers(), 'nothing useful'), null)

  const slept: number[] = []
  let call = 0
  const backend = openaiImagesBackend(
    GPT(),
    { url: 'https://images.example/v1', apiKey: 'k', model: 'gpt-image-2' },
    {
      fetch: async () => {
        call += 1
        if (call <= 2) {
          return new Response(
            JSON.stringify({ error: { code: '429', message: 'Please retry after 32 seconds.' } }),
            { status: 429 },
          )
        }
        const bytes = Buffer.alloc(24)
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes, 0)
        bytes.write('IHDR', 12, 'ascii')
        bytes.writeUInt32BE(1024, 16)
        bytes.writeUInt32BE(1024, 20)
        return new Response(JSON.stringify({ data: [{ b64_json: bytes.toString('base64') }] }), {
          status: 200,
        })
      },
      log: () => {},
      sleep: async (ms) => {
        slept.push(ms)
      },
    },
  )
  const result = await backend.generate(requestFor(1024, 1024), AbortSignal.timeout(5_000))
  assert.deepEqual(slept, [33_000, 33_000])
  // Recorded as attempts, not swallowed. "How many 429s did this set absorb" is a real property of
  // this provider and one of the things COMPARISON.md has to be able to answer honestly.
  assert.equal(result.attempts.filter((a) => a.outcome === 'rate_limited').length, 2)
  assert.equal(result.attempts.at(-1)?.outcome, 'ok')
})

test('the openai-images backend never puts a credential or a URL in an error', async () => {
  // THE RULE THIS ESTATE LEARNED THE EXPENSIVE WAY. Node's fetch puts the whole request URL into
  // the message of any transport exception it throws, and this endpoint's URL names the resource.
  // That is how bitcoind's rpcauth leaked here, and no redaction rule catches it reliably because
  // a URL is not token-shaped. So the backend reads the exception's class name and cause code and
  // never its message.
  const secret = 'sk-abcdefghijklmnopqrstuvwxyz0123456789ABCDEF'
  const url = `https://very-secret-resource.services.ai.azure.com/openai/v1/images/generations`
  const backend = openaiImagesBackend(
    GPT(),
    { url, apiKey: secret, model: 'gpt-image-2' },
    {
      fetch: async () => {
        const err = new TypeError(`fetch failed for ${url} with api-key ${secret}`)
        ;(err as Error & { cause?: unknown }).cause = { code: 'ECONNRESET' }
        throw err
      },
      log: () => {},
    },
  )
  let message = ''
  try {
    await backend.generate(requestFor(1024, 1024), AbortSignal.timeout(5_000))
  } catch (err) {
    message = (err as Error).message
  }
  assert.ok(message.includes('TypeError'), 'the class name is what makes the failure diagnosable')
  assert.ok(message.includes('ECONNRESET'), 'the syscall code is safe and is the useful half')
  assert.ok(!message.includes(secret), 'THE KEY IS IN AN ERROR MESSAGE')
  assert.ok(!message.includes('very-secret-resource'), 'THE ENDPOINT IS IN AN ERROR MESSAGE')
  assert.ok(!message.includes('azure.com'), 'THE ENDPOINT IS IN AN ERROR MESSAGE')
})

test('an unconfigured openai-images backend names the variables and never a value', async () => {
  // Constructible without credentials, and it refuses at generate time rather than at build time —
  // the same rule the Managed Compute backend follows, so the seam stays exercisable in a test
  // that never opens a socket.
  const backend = backendFor(providerById('gpt-image-2'), {})
  await assert.rejects(
    () => backend.generate(requestFor(1024, 1024), AbortSignal.timeout(1_000)),
    (err: Error) => {
      assert.ok(err.message.includes('AZURE_IMAGES_ENDPOINT'))
      assert.ok(err.message.includes('AZURE_IMAGES_KEY'))
      assert.equal(/[A-Za-z0-9_-]{32,}/.test(err.message), false, 'a token-shaped string')
      return true
    },
  )
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
  // 23-tessera.md — "Sparks is a display denomination of EMBER. It is not a second assetCode,
  // and it must never become one." A second hue would say otherwise, and would also fail the bar
  // 23-tessera.md sets for this icon set: legible to someone who cannot tell two accents
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

test('promote.py asks verify.py the SHIPPED question, not the candidate one', () => {
  // The defect this pins was found by running the switch rather than by reading it, and it is the
  // kind that only appears once: verify.py holds brand conformance FATAL for the shipped set and
  // reported-not-fatal for a candidate — correctly, because a candidate is on trial — so a set can
  // exit 0 as a candidate, be promoted on the strength of that, and turn the repository red the
  // instant it lands under rules it was never held to. gpt-image-2 did exactly that on the first
  // real promotion: hub/social carries 0.32% accent against a 1% floor, a `warn` line for the whole
  // evaluation and a `FAIL` one second after the move.
  //
  // Asserted from the source text because the two files are Python and this suite is the only
  // place the estate checks them together. If either half is removed the gate silently reverts to
  // asking the wrong question, and the symptom would be a red repository rather than a refused
  // switch — which is the difference between a promotion that did not happen and one that has to
  // be undone by hand.
  const promote = readFileSync(new URL('./promote.py', import.meta.url), 'utf8')
  const verify = readFileSync(new URL('./verify.py', import.meta.url), 'utf8')

  assert.ok(
    /"verify\.py"\)[^\]]*"--provider", provider_id, "--as-shipped"/.test(promote),
    'promote.py must run verify.py with --as-shipped as its pre-move gate',
  )
  assert.ok(
    /add_argument\(\s*"--as-shipped"/.test(verify),
    'verify.py must offer --as-shipped for promote.py to ask for it',
  )
  assert.ok(
    /fatal = problems \+ \(conformance if \(provider\.shipped or as_shipped\) else \[\]\)/.test(verify),
    'verify.py --as-shipped must make conformance fatal, which is the only thing it may change',
  )
})
