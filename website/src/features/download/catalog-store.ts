import type { Download } from './catalog'
import { downloadsFromRes } from './res-catalog'

/**
 * What the site stores for the download pages, and what publishing it means.
 *
 * The catalogue is read from the update documents the resource service builds from the
 * releases posted to it, in CI, and written into KV from there; the Worker
 * only reads that key.
 */

export interface StoredCatalogue {
  downloads: Download[]
  /** When this copy was built. */
  refreshedAt: string
  /** Where it was read from. */
  source?: string
}

export interface RefreshStatus {
  lastAttemptAt?: string
  /** What built the stored copy. */
  trigger?: string
  lastSuccessAt?: string
  /** Why the last attempt failed; null once one succeeds again. */
  lastError?: { at: string, message: string } | null
}

/**
 * Releases that parse to nothing mean the shape moved under the parser, not
 * that everything was unpublished, so they are refused rather than published:
 * an empty catalogue would blank every board page. No releases at all is an
 * honest empty catalogue: the manifest names no product.
 */
export function storedCatalogue(releases: unknown[], source: string, now: string): StoredCatalogue {
  const downloads = downloadsFromRes(releases)
  if (releases.length > 0 && downloads.length === 0)
    throw new Error(`${source}: ${releases.length} release(s) parsed to no downloads`)

  return { downloads, refreshedAt: now, source }
}
