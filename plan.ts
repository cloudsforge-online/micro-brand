/**
 * The work list: which surface gets which assets, and the one idea each mark is built around.
 *
 * The surfaces, their names and their accents are COPIED FROM THE REGISTRY
 * (`ui/packages/ui/src/surfaces.ts`) and asserted against it at run time by `generate.ts`, so this
 * file cannot drift from it in silence. It is a copy rather than an import because the registry is
 * a TSX-adjacent package in another workspace and this runner deliberately has no workspace.
 *
 * The `idea` strings are prose renderings of the six hand-authored SVG marks in
 * `docs/ecosystem/assets/mark-*.svg` plus the `CloudsForgeLogo` component. They exist so the
 * generated art is recognisably THE SAME CONCEPT as the authored mark rather than a new logo that
 * happens to be the right colour. Each one names the ash ridge, because design-system.md §5 makes
 * the ground line the thing every mark in the family shares.
 *
 * No idea string names a letter, a digit or a punctuation glyph. `developers` is the case that
 * makes this a rule: its registry glyph is `⌗`, and describing it as "a hash" or "angle brackets"
 * reliably produces a mark with a character in it, which is a defect on every wordless kind.
 */

export interface PlannedSurface {
  /** Registry key. The directory name under `assets/`. */
  readonly key: string
  /** Registry name. This is the string a wordmark, OG card or social banner must spell. */
  readonly name: string
  /** Registry accent, verbatim. Interpolated into the prompt as a hex value. */
  readonly accent: string
  /** The one idea the mark is built around, from the hand-authored SVG. */
  readonly idea: string
  /** Which kinds to generate, in priority order within the surface. */
  readonly kinds: readonly PlannedKind[]
  /** 1 = company, 2 = products and Hub, 3 = operator and developer surfaces. */
  readonly tier: 1 | 2 | 3
}

export type PlannedKind = 'mark' | 'favicon' | 'wordmark' | 'og' | 'social'

/** Every kind for a public, marketed surface. */
const FULL: readonly PlannedKind[] = ['mark', 'favicon', 'wordmark', 'og', 'social']

/**
 * Operator tools and the developer console: a mark and a favicon, and for `developers` a wordmark.
 *
 * No OG card and no social banner for Admin, Lantern or Beacon. Those two kinds exist to be
 * scraped by a social platform or shown on a repository, and a surface nobody but an operator can
 * open is never linked from either — generating them would be spending on an asset with no
 * placement.
 */
const TOOL: readonly PlannedKind[] = ['mark', 'favicon']

/**
 * A PUBLIC surface that inherits its parent product's mark.
 *
 * `status` and `explorer` both carry `markId: null` in the registry — deliberately, because a
 * status page is Beacon with its internals removed and an explorer is part of Forge Network, and
 * neither should claim a mark of its own. But each is served from its OWN subdomain, and a browser
 * tab and a shared link inherit nothing: a surface with no favicon shows the browser's blank page
 * icon, and one with no `og` renders a shared link as a bare URL. That matters most for the status
 * page, which is the surface people share during an incident.
 *
 * So: no mark, no wordmark — the parent owns those — and the two artefacts a separate host needs.
 */
const PUBLIC_CHILD: readonly PlannedKind[] = ['favicon', 'og']

/**
 * Every entry here is a REGISTRY SURFACE, and `generate.ts`'s `assertPlanMatchesRegistry` walks
 * exactly this list. Anything that is not a surface of the product — see `CURRENCY` below — must
 * not be added here, because the guard would (correctly) refuse to run.
 */
export const PLAN: readonly PlannedSurface[] = [
  /* ---- tier 1: the company ------------------------------------------------------------- */
  {
    key: 'site',
    name: 'CloudsForge',
    accent: '#e8622c',
    tier: 1,
    kinds: FULL,
    idea:
      'a low ash ridge — one flat baseline with a single shallow arc rising from it, like the ' +
      'face of an anvil seen from the front — and one solid ember flame rising above the centre ' +
      'of that arc. The ridge is the ground and the flame is the fire the whole thing is built ' +
      'around. Two elements only: the ridge and the flame.',
  },

  /* ---- tier 2: the six products, in switcher order, then Hub ---------------------------- */
  {
    key: 'foresight',
    name: 'Forge Foresight',
    accent: '#1e89c7',
    tier: 2,
    kinds: FULL,
    // A prediction market is a claim about which of two futures happens, so the mark is the
    // moment before it is settled: one path arriving, two leaving, and no indication of which
    // wins. The solid/broken pair carries the difference without colour, which matters more here
    // than elsewhere — this accent is dE 7-8 from trade's teal under deuteranopia.
    idea:
      'a single straight line rising from the ash ridge to a solid round node, and from that ' +
      'node two straight lines diverging upward at equal angles — the left one solid, the right ' +
      'one drawn as three short dashes. Three elements only: the arriving line, the node, and ' +
      'the two diverging branches. The ash ridge is the flat baseline the first line stands on.',
  },
  {
    key: 'network',
    name: 'Forge Network',
    accent: '#d6412f',
    tier: 2,
    kinds: FULL,
    idea:
      'a hearth flame standing on a hearthstone: one large teardrop flame drawn as an outline, ' +
      'its point at the top and its base resting on a short flat bar, with a second much smaller ' +
      'solid flame nested inside it. The ash ridge is that bar, broken by a short gap at each ' +
      'end so it reads as a hearthstone rather than a floor.',
  },
  {
    key: 'trade',
    name: 'Forge Trade',
    accent: '#2a9e93',
    tier: 2,
    kinds: FULL,
    idea:
      'a quench curve crossing a baseline: one continuous polyline of four straight segments ' +
      'that dips down, climbs steeply, dips again and then rises past a short broken horizontal ' +
      'rule near the top. The ash ridge is the flat baseline underneath that the whole curve is ' +
      'measured against.',
  },
  {
    key: 'create',
    name: 'Forge Create',
    accent: '#b28e1e',
    tier: 2,
    kinds: FULL,
    idea:
      'a struck spark over an anvil: a four-point burst made of one vertical stroke crossed by ' +
      'one horizontal stroke, with a fainter diagonal cross of the same length set behind it at ' +
      'forty-five degrees. Below it the ash ridge is the flat face of an anvil with a short ' +
      'squared base beneath its centre.',
  },
  {
    key: 'market',
    name: 'Forge Market',
    accent: '#9b7bf0',
    tier: 2,
    kinds: FULL,
    idea:
      'a market stall: a shallow triangular awning, wide and low, with five short vertical ' +
      'strokes hanging from its front edge as a valance. Under it sits one squared open-topped ' +
      'crate, and under that the ash ridge is the flat floor the stall stands on.',
  },
  {
    key: 'worlds',
    name: 'Forge Worlds',
    accent: '#6d9a49',
    tier: 2,
    kinds: FULL,
    idea:
      'a settlement on a horizon: one tall gabled house outline beside one lower gabled house ' +
      'outline, both standing on a long flat line that runs the full width as the horizon. A ' +
      'single short ember stroke in the tall house is one lit window — someone is still here.',
  },
  {
    key: 'hub',
    name: 'Forge Hub',
    accent: '#e8622c',
    tier: 2,
    kinds: FULL,
    idea:
      'home on the ridge: the ash ridge drawn as one jagged skyline of four straight segments, ' +
      'rising and falling like a low mountain profile, with a single solid ember spark held ' +
      'centred in the empty space directly above its middle peak.',
  },

  /* ---- tier 3: operator tools and the developer console --------------------------------- */
  {
    key: 'admin',
    name: 'Admin',
    accent: '#c2704f',
    tier: 3,
    kinds: TOOL,
    idea:
      'a console panel: one squared outlined rectangle with a smaller solid rectangle set inside ' +
      'it against its upper edge, standing on the flat ash ridge.',
  },
  {
    key: 'lantern',
    name: 'Lantern',
    accent: '#f4a63c',
    tier: 3,
    kinds: TOOL,
    idea:
      'a hung lantern: a six-sided housing outline with a small solid flame held inside it, ' +
      'suspended from a straight hook above, with the flat ash ridge below it as the ground it ' +
      'is hung over.',
  },
  {
    key: 'beacon',
    name: 'Beacon',
    accent: '#7fae5c',
    tier: 3,
    kinds: TOOL,
    idea:
      'a beacon on the ridge: one solid dot on a short vertical mast, with two concentric arcs ' +
      'opening upward and outward from it as the signal it puts out, standing on the flat ash ' +
      'ridge.',
  },
  {
    key: 'status',
    name: 'Status',
    // Beacon's green, from the registry: the status page IS Beacon, with its internals removed.
    accent: '#7fae5c',
    tier: 3,
    kinds: PUBLIC_CHILD,
    // Echoes Beacon's beacon-on-the-ridge deliberately — a reader who has seen one should
    // recognise the other — but resolved to a single steady signal rather than a mast putting one
    // out, because this surface reports a state rather than watching for one.
    idea:
      'one solid dot centred above the flat ash ridge with a single wide arc beneath it, like a ' +
      'steady signal held above level ground. Two elements only: the dot and the one arc. No ' +
      'mast, no second arc.',
  },
  {
    key: 'explorer',
    name: 'Network Explorer',
    // Forge Network's accent, from the registry: the explorer is part of that product.
    accent: '#d6412f',
    tier: 3,
    kinds: PUBLIC_CHILD,
    // Network's mark is a flame on a hearthstone; this is the chain that flame secures, seen
    // end-on — three linked blocks reading left to right, so the family is legible without
    // repeating the flame the parent owns.
    // Reworded once: the first phrasing was refused outright for content safety, with no fallback
    // attempted. Nothing in it was objectionable — three squares and two bars — which is the point
    // worth recording: a refusal is not always a signal about meaning, and the cheapest response to
    // one is to say the same shape in plainer words rather than to argue with it.
    idea:
      'three equal outlined squares placed side by side above the flat ash ridge, evenly spaced, ' +
      'the centre one filled. A short horizontal stroke sits between each pair of squares. ' +
      'Simple flat geometry, nothing else in the frame.',
  },
  {
    key: 'developers',
    name: 'Developer Platform',
    accent: '#4a86e0',
    tier: 3,
    // `og` added: micro-devportal-web is a PUBLIC surface — the developer console and the docs —
    // so its links get shared, and a shared link with no card renders as a bare URL. The operator
    // tools below keep TOOL (mark + favicon) because nobody shares an admin console link outward.
    kinds: ['mark', 'favicon', 'wordmark', 'og'],
    idea:
      'a square lattice: two evenly spaced vertical bars crossed by two evenly spaced horizontal ' +
      'bars, forming a nine-cell grid whose outer bars overshoot the crossings slightly, held ' +
      'above the flat ash ridge. A woven grid, nothing more.',
  },
]

/* ------------------------------------------------------------------ the currency */

/**
 * The currency marks: EMBER, and its display subunit Sparks.
 *
 * ## Why these are not in `PLAN`
 *
 * `generate.ts` refuses to run if any entry in `PLAN` is absent from the surface registry
 * (`ui/packages/ui/src/surfaces.ts`). That guard is right and stays. A currency is **not a
 * surface** — nobody navigates to it, it has no host, no favicon and no OG card — so it is not in
 * the registry and must never be added to it just to get past a check. It is planned here instead,
 * and `assertCurrencyIsNotASurface` in `generate.ts` asserts the inverse: that no key below is a
 * registry surface, so this list cannot be used to smuggle a real surface past the registry.
 *
 * ## Why they live in micro-brand at all
 *
 * `docs/ecosystem/23-tessera.md:321` specifies `ember-coin` and `spark` as two of sixteen "status
 * & economy icons" at 256x256, destined for a `micro-tessera-assets` repository that **does not
 * exist yet**. The currency rename is happening now and needs its mark now. micro-brand is the
 * estate's brand repository, already holds every other estate-level mark, and already has the
 * generation, derivation, parity and verification machinery. When micro-tessera-assets is created
 * these two can be copied into it; nothing here assumes they will not be.
 *
 * ## What was searched for first, and not found
 *
 * There is **no existing currency artwork anywhere in the estate's three asset repositories** to
 * replace. `micro-brand` has zero occurrences of "shard" in any form; every one of its 94 prompts
 * in fact carries the NEGATIVE constraint "no currency symbols", from `studio/src/prompt.ts`'s
 * `NO_TEXT`, and that constraint is correct and kept — it is what stops a model drawing a dollar
 * sign instead of this mark. `micro-aetherholm-assets` has zero occurrences too. The 137-asset
 * Emberkin set's `ui/glyph-shard` IS a shard, but a shard of ROCK — `plan.ts:793` asks for "one
 * floating four-sided shard of rock, tilted, ... with one straight facet line down its face" — and
 * it is world-building, not money. `micro-emberkin/README.md:44` draws the distinction itself:
 * "| The world's floating **shards** | The internal currency, **Shards** |". The left column stays.
 * So this is net-new art, not a replacement, and nothing existing is re-prompted.
 *
 * ## One accent for both, deliberately
 *
 * Both marks take `#e8622c`, the CloudsForge ember from the registry's `site` and `hub`. A second
 * hue would say these are two different assets, and that is precisely the error the migration
 * warns against: `docs/ecosystem/23-tessera.md:716` — "**Sparks is a display denomination of
 * EMBER. It is not a second `assetCode`, and it must never become one.**" So the denomination is
 * carried by FORM, never by colour: EMBER is ENCLOSED in a struck disc and Spark is OPEN, with no
 * enclosure at all. That difference survives greyscale, survives 16 pixels, and survives a reader
 * who cannot tell two warm oranges apart — which is the bar `23-tessera.md:325` sets for this very
 * icon set ("distinguishable at 16 px by someone who cannot tell the two accent colours apart").
 *
 * ## No ratio is drawn, and no numeral
 *
 * The subunit ratio is genuinely unsettled in the estate — `23-tessera.md:712` says a Spark is
 * 10^-6 EMBER, `hearth/branding/brand.md:17` says 1e-8, and `hearth/docs/coinnomics.md:33` says
 * the spark was retired — against the 10^3 the rename proposes. Art that depicted a ratio would
 * bake one of four answers into a PNG and be wrong three ways. Neither prompt names a number, and
 * `NO_TEXT` already forbids numerals outright, so settling the ratio later costs no regeneration.
 */
export const CURRENCY: readonly PlannedSurface[] = [
  {
    key: 'currency-ember',
    name: 'EMBER',
    accent: '#e8622c',
    tier: 1,
    kinds: ['mark'],
    // ENCLOSED. A struck disc is what makes a mark read as a unit of money without a currency
    // glyph in it, and the flame inside it is the site mark's flame, so the money is visibly the
    // same family as the company rather than a coin borrowed from stock art.
    idea:
      'a struck coin: one perfect circle drawn as a single uniform-weight outline, and held ' +
      'centred inside that circle one solid ember flame — a teardrop with its point at the top ' +
      'and its base flat. Nothing else sits inside the circle. Below the circle, clear of it and ' +
      'not touching it, the ash ridge is one short flat bar, so the coin reads as standing on ' +
      'ground rather than sitting in a frame. Three elements only: the circle, the flame within ' +
      'it, and the bar beneath it.',
  },
  {
    key: 'currency-spark',
    name: 'Spark',
    accent: '#e8622c',
    tier: 1,
    kinds: ['mark'],
    // OPEN. No circle anywhere, which is the whole distinction from EMBER above and the reason
    // the two are told apart in greyscale at 16 pixels. Deliberately NOT a four-point burst:
    // `create`'s mark is already a struck spark drawn as a crossed burst, and repeating it here
    // would make the subunit read as Forge Create.
    idea:
      'one small solid ember flame — the same teardrop shape as the coin mark, point at the top, ' +
      'base flat — standing alone with no circle, no disc, no ring and no enclosure of any kind ' +
      'around it. Beneath it three short straight strokes rise from the ash ridge at slightly ' +
      'different heights, the outer two shorter than the middle one, like fire coming straight ' +
      'off the ground. The ash ridge is the flat baseline they stand on. Two elements only: the ' +
      'flame and the three rising strokes above the baseline. Not a burst, not a star, not a ' +
      'cross, no radiating rays.',
  },
]

/**
 * Priority order across the whole run, as instructed: the company set first, then the product
 * marks, then the wordmarks, then OG and social.
 *
 * If the run is cut short — quota, an outage, a budget ceiling — what exists is a complete
 * high-priority set rather than a partial everything, which is only true if the ordering is a
 * property of the plan rather than of the loop.
 */
const KIND_PRIORITY: Readonly<Record<PlannedKind, number>> = {
  mark: 0,
  favicon: 1,
  wordmark: 2,
  og: 3,
  social: 4,
}

export interface PlannedAsset {
  readonly surface: PlannedSurface
  readonly kind: PlannedKind
}

/**
 * Everything this repository generates: the registry surfaces, then the currency marks.
 *
 * `PLAN` alone is what the registry guard walks. This is what the RUN walks. Keeping them separate
 * is the only reason a currency can be generated here without either weakening that guard or
 * inventing a surface in `ui/packages/ui/src/surfaces.ts` that no browser ever opens.
 */
export const PLANNED_SURFACES: readonly PlannedSurface[] = [...PLAN, ...CURRENCY]

export function plannedAssets(): PlannedAsset[] {
  const out: PlannedAsset[] = []
  for (const surface of PLANNED_SURFACES) {
    for (const kind of surface.kinds) out.push({ surface, kind })
  }
  return out.sort((a, b) => {
    // The company set is generated whole, first, before anything else starts.
    if (a.surface.tier === 1 && b.surface.tier !== 1) return -1
    if (b.surface.tier === 1 && a.surface.tier !== 1) return 1
    const kind = KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind]
    if (kind !== 0) return kind
    // PLANNED_SURFACES, not PLAN: a currency mark is absent from PLAN, so `indexOf` would return
    // -1 for it and sort it ahead of `site` — the one asset the run is meant to start with.
    return PLANNED_SURFACES.indexOf(a.surface) - PLANNED_SURFACES.indexOf(b.surface)
  })
}
