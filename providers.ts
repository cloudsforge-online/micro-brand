/**
 * The TypeScript half of the provider registry. Reads the same `providers.json` `providers.py`
 * reads, so the two halves cannot disagree about where a set lives or what it costs.
 *
 * Nothing here knows how to CALL a provider — that is `backends.ts`. This file only answers "which
 * providers exist, which one is the reference, and which files belong to each", which is the
 * question every tool in the repository has to answer before it can do anything at all.
 */

import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const HERE = import.meta.dirname

export type AdapterKind = 'foundry-serverless' | 'foundry-managed-compute'

export interface ProviderBilling {
  /** The unit this model actually bills in. Never converted; see COMPARISON.md §6. */
  readonly unit: string
  readonly basis: string
  readonly source: string
  readonly sku: string | null
  readonly hourlyRate: number | null
}

export interface Provider {
  readonly id: string
  readonly label: string
  readonly vendor: string
  readonly adapter: AdapterKind
  /** Absolute. `assets/` and `MANIFEST.json` hang off this. */
  readonly root: string
  readonly shipped: boolean
  /** False for a backend that is still a stub. `backendFor` throws rather than guessing a body. */
  readonly implemented: boolean
  readonly concurrency: number
  readonly env: Readonly<Record<string, string>>
  readonly billing: ProviderBilling
}

interface RegistryDocument {
  readonly reference: string
  readonly providers: ReadonlyArray<Omit<Provider, 'root'> & { readonly root: string }>
}

const document = JSON.parse(readFileSync(join(HERE, 'providers.json'), 'utf8')) as RegistryDocument

export const PROVIDERS: readonly Provider[] = document.providers.map((raw) => ({
  ...raw,
  root: resolve(HERE, raw.root),
}))

export function providerById(id: string): Provider {
  const found = PROVIDERS.find((p) => p.id === id)
  if (!found) {
    throw new Error(
      `unknown provider "${id}"; providers.json registers: ${PROVIDERS.map((p) => p.id).join(', ')}`,
    )
  }
  return found
}

/**
 * The provider every other set is judged against — and, more importantly, the one whose recorded
 * prompts a candidate run REPLAYS rather than recomputes. See generate.ts's prompt-parity header.
 */
export const REFERENCE: Provider = providerById(document.reference)

export const assetsDirOf = (provider: Provider): string => join(provider.root, 'assets')
export const manifestPathOf = (provider: Provider): string => join(provider.root, 'MANIFEST.json')
