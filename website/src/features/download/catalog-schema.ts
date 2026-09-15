import type { Download, DownloadKind } from './catalog'
import { DOWNLOAD_KINDS } from './catalog'

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
  if (!DOWNLOAD_KINDS.includes(entry.kind as DownloadKind))
    return null

  return {
    board: entry.board as string,
    profile: entry.profile as string,
    kind: entry.kind as DownloadKind,
    version: entry.version as string,
    ...(typeof entry.deploymentId === 'string' && entry.deploymentId !== ''
      ? { deploymentId: entry.deploymentId }
      : {}),
    releasedAt: entry.releasedAt as string,
    bytes: entry.bytes,
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
