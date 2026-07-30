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

  /* ---- tier 2: the five products, in switcher order, then Hub --------------------------- */
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
    key: 'developers',
    name: 'Developer Platform',
    accent: '#4a86e0',
    tier: 3,
    kinds: ['mark', 'favicon', 'wordmark'],
    idea:
      'a square lattice: two evenly spaced vertical bars crossed by two evenly spaced horizontal ' +
      'bars, forming a nine-cell grid whose outer bars overshoot the crossings slightly, held ' +
      'above the flat ash ridge. A woven grid, nothing more.',
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

export function plannedAssets(): PlannedAsset[] {
  const out: PlannedAsset[] = []
  for (const surface of PLAN) {
    for (const kind of surface.kinds) out.push({ surface, kind })
  }
  return out.sort((a, b) => {
    // The company set is generated whole, first, before anything else starts.
    if (a.surface.tier === 1 && b.surface.tier !== 1) return -1
    if (b.surface.tier === 1 && a.surface.tier !== 1) return 1
    const kind = KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind]
    if (kind !== 0) return kind
    return PLAN.indexOf(a.surface) - PLAN.indexOf(b.surface)
  })
}
