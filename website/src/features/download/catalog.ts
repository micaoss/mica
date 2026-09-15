/**
 * The artifact catalogue the download page renders. The content contract binds
 * entries to published artifact metadata and forbids hand-written release
 * identities, so the shape is fixed here and the catalogue stays empty until an
 * update server publishes one.
 */

export type ArtifactKind = 'image' | 'update' | 'kernel' | 'root' | 'firmware'

export type Profile = 'dev' | 'prod'

export interface Artifact {
  /** Board identifier, as `mica-boards` names it. */
  board: string
  profile: Profile
  /** Release version or generation the artifact belongs to. */
  version: string
  /** Signed deployment this artifact is part of. */
  deploymentId: string
  kind: ArtifactKind
  bytes: number
  digest: string
  href: string
}

export interface ArtifactQuery {
  board?: string
  profile?: Profile
  kind?: ArtifactKind
  /** Matched against version and deployment ID. */
  query?: string
}

/** Empty until the update server publishes a catalogue. */
export const ARTIFACTS: Artifact[] = []

export function filterArtifacts(all: Artifact[], query: ArtifactQuery): Artifact[] {
  const text = query.query?.trim().toLowerCase()

  return all.filter((artifact) => {
    if (query.board && artifact.board !== query.board)
      return false
    if (query.profile && artifact.profile !== query.profile)
      return false
    if (query.kind && artifact.kind !== query.kind)
      return false
    if (!text)
      return true
    return `${artifact.version} ${artifact.deploymentId}`.toLowerCase().includes(text)
  })
}

/** Byte lengths are metadata: shown as reported, in binary units. */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KiB', 'MiB', 'GiB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`
}
