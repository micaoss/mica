import type { Download } from './catalog'
import { downloadsFromIndex } from './mica-index'

/**
 * What the site stores for the download pages, and what publishing it means.
 *
 * The catalogue is built where GitHub can be read reliably — a CI runner — and
 * written into KV from there. The Worker only reads it: refreshing from a
 * Cloudflare egress address failed continuously, first with the API's anonymous
 * 403 and then with 429 from the release download, because that egress is shared
 * and heavily used against GitHub.
 */

export interface StoredCatalogue {
  downloads: Download[]
  /** When this copy was built. */
  refreshedAt: string
  /** The index release it was read from. */
  latestRelease?: string
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
 * An index that names products but parses to nothing means the shape moved under
 * the parser, not that everything was unpublished, so it is refused rather than
 * published: an empty catalogue would blank every board page.
 */
export function storedCatalogue(index: unknown, release: string, now: string): StoredCatalogue {
  const downloads = downloadsFromIndex(index)
  if (downloads.length === 0)
    throw new Error(`${release} parsed to no downloads`)

  return { downloads, refreshedAt: now, latestRelease: release }
}
