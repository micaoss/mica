import type { Artifact, ArtifactKind, Profile } from './catalog'

/**
 * Reads a remote catalogue. The content contract forbids hand-written release
 * identities, so an entry missing any field it should carry is dropped rather
 * than completed with a guess.
 */

const KINDS: ArtifactKind[] = ['image', 'update', 'kernel', 'root', 'firmware']
const PROFILES: Profile[] = ['dev', 'prod']

function readArtifact(value: unknown): Artifact | null {
  if (typeof value !== 'object' || value === null)
    return null

  const entry = value as Record<string, unknown>
  const strings = ['board', 'version', 'deploymentId', 'digest', 'href'] as const
  for (const key of strings) {
    if (typeof entry[key] !== 'string' || entry[key] === '')
      return null
  }
  if (typeof entry.bytes !== 'number' || !Number.isFinite(entry.bytes))
    return null
  if (!KINDS.includes(entry.kind as ArtifactKind))
    return null
  if (!PROFILES.includes(entry.profile as Profile))
    return null

  return {
    board: entry.board as string,
    profile: entry.profile as Profile,
    version: entry.version as string,
    deploymentId: entry.deploymentId as string,
    kind: entry.kind as ArtifactKind,
    bytes: entry.bytes,
    digest: entry.digest as string,
    href: entry.href as string,
  }
}

/** Whether the payload declares itself a sample rather than published metadata. */
export function isSample(payload: unknown): boolean {
  return typeof payload === 'object' && payload !== null
    && (payload as { sample?: unknown }).sample === true
}

/** Accepts `{ artifacts: [...] }` or a bare array; anything else reads as empty. */
export function parseCatalog(payload: unknown): Artifact[] {
  const list = Array.isArray(payload)
    ? payload
    : typeof payload === 'object' && payload !== null
      ? (payload as { artifacts?: unknown }).artifacts
      : undefined

  if (!Array.isArray(list))
    return []

  return list.map(readArtifact).filter((entry): entry is Artifact => entry !== null)
}
