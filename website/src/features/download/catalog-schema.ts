import type { Download, DownloadKind } from './catalog'
import type { BoardCatalogue, CatalogueWords, Guide, IndexCatalogue } from './products-catalog'
import { DOWNLOAD_KINDS } from './catalog'
import { CATALOGUE_VERSION, outsideUrl } from './products-catalog'

/**
 * Reads a remote catalogue. The content contract forbids hand-written release
 * identities, so an entry missing any field it should carry is dropped rather
 * than completed with a guess.
 */

function readDownload(value: unknown): Download | null {
  if (typeof value !== 'object' || value === null)
    return null

  const entry = value as Record<string, unknown>
  const strings = ['board', 'profile', 'version', 'releasedAt', 'digest', 'href', 'filename'] as const
  for (const key of strings) {
    if (typeof entry[key] !== 'string' || entry[key] === '')
      return null
  }
  if (typeof entry.bytes !== 'number' || !Number.isFinite(entry.bytes))
    return null
  // The row's link: an https address, or the row is not shown.
  if (!outsideUrl(entry.href))
    return null
  if (!DOWNLOAD_KINDS.includes(entry.kind as DownloadKind))
    return null
  const variant = typeof entry.variant === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(entry.variant)
    ? entry.variant
    : undefined

  return {
    board: entry.board as string,
    profile: entry.profile as string,
    kind: entry.kind as DownloadKind,
    ...(variant ? { variant } : {}),
    version: entry.version as string,
    ...(typeof entry.deploymentId === 'string' && entry.deploymentId !== ''
      ? { deploymentId: entry.deploymentId }
      : {}),
    releasedAt: entry.releasedAt as string,
    bytes: entry.bytes,
    ...(typeof entry.uncompressedBytes === 'number' && Number.isFinite(entry.uncompressedBytes)
      ? { uncompressedBytes: entry.uncompressedBytes }
      : {}),
    digest: entry.digest as string,
    href: entry.href as string,
    filename: entry.filename as string,
  }
}

/** Whether the payload declares itself a sample rather than published metadata. */
export function isSample(payload: unknown): boolean {
  return typeof payload === 'object' && payload !== null
    && (payload as { sample?: unknown }).sample === true
}

/** Accepts `{ downloads: [...] }` or a bare array; anything else reads as empty. */
export function parseCatalog(payload: unknown): Download[] {
  const list = Array.isArray(payload)
    ? payload
    : typeof payload === 'object' && payload !== null
      ? (payload as { downloads?: unknown }).downloads
      : undefined

  if (!Array.isArray(list))
    return []

  return list.map(readDownload).filter((entry): entry is Download => entry !== null)
}

/** The words beside the rows; a list that is absent or not a list reads as empty. */
export function parseWords(payload: unknown): CatalogueWords {
  const entry = (typeof payload === 'object' && payload !== null ? payload : {}) as Record<string, unknown>
  const list = <T>(value: unknown): T[] => (Array.isArray(value) ? value.filter(item => typeof item === 'object' && item !== null) as T[] : [])

  return {
    categories: list(entry.categories),
    fileTypes: list(entry.fileTypes),
    boards: list(entry.boards),
    products: list(entry.products),
  }
}

/** An answer of the shape this build reads; a copy of another version is not one. */
function current(payload: unknown): Record<string, unknown> | null {
  const entry = (typeof payload === 'object' && payload !== null ? payload : {}) as Record<string, unknown>
  return entry.version === CATALOGUE_VERSION ? entry : null
}

/** The index as the endpoint answers it, or null for anything else. */
export function parseIndex(payload: unknown): IndexCatalogue | null {
  const entry = current(payload)
  if (!entry || !Array.isArray(entry.boards) || !Array.isArray(entry.products))
    return null
  const { boards, products } = parseWords(entry)
  return { ...(entry as unknown as IndexCatalogue), boards, products: products as IndexCatalogue['products'] }
}

/** One board as the endpoint answers it, or null for anything else. */
export function parseBoard(payload: unknown): BoardCatalogue | null {
  const entry = current(payload)
  if (!entry || typeof entry.board !== 'string' || !Array.isArray(entry.downloads))
    return null
  const guides = Array.isArray(entry.guides) ? entry.guides.filter(item => typeof item === 'object' && item !== null) as Guide[] : []
  return { ...(entry as unknown as BoardCatalogue), downloads: parseCatalog(entry), ...parseWords(entry), guides }
}
