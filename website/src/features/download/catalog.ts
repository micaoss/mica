/**
 * The image catalogue the download page renders.
 *
 * A row is a bootable image for one board and profile. Component packages —
 * kernel, root, firmware, `.micaupd` — are not downloads: they reach a device
 * through an update, not through this page.
 *
 * The content contract binds entries to published artifact metadata and forbids
 * hand-written release identities, so the shape is fixed here and the catalogue
 * stays empty until something publishes one.
 */

export type Profile = 'dev' | 'prod'

export interface Image {
  /** Board identifier, as `mica-boards` names it. */
  board: string
  profile: Profile
  /** Release version or generation. */
  version: string
  /** Signed deployment this image carries. */
  deploymentId: string
  /** ISO 8601 date the release was published; orders the versions. */
  releasedAt: string
  bytes: number
  digest: string
  href: string
}

export interface ImageQuery {
  board?: string
  profile?: Profile
  /** Matched against version and deployment ID. */
  query?: string
}

/** Empty until a release is published. */
export const IMAGES: Image[] = []

export function filterImages(all: Image[], query: ImageQuery): Image[] {
  const text = query.query?.trim().toLowerCase()

  return all.filter((image) => {
    if (query.board && image.board !== query.board)
      return false
    if (query.profile && image.profile !== query.profile)
      return false
    if (!text)
      return true
    return `${image.version} ${image.deploymentId}`.toLowerCase().includes(text)
  })
}

/**
 * Newest first, and one row per board and profile unless `history` asks for the
 * rest. A board's older images stay reachable; they are not what the page opens
 * on.
 */
export function selectVersions(all: Image[], history: boolean): Image[] {
  const ordered = [...all].sort((a, b) =>
    b.releasedAt.localeCompare(a.releasedAt) || b.version.localeCompare(a.version),
  )
  if (history)
    return ordered

  const seen = new Set<string>()
  return ordered.filter((image) => {
    const key = `${image.board}/${image.profile}`
    if (seen.has(key))
      return false
    seen.add(key)
    return true
  })
}

/** How many rows `history` would add, so the control can say whether it is worth using. */
export function historyCount(all: Image[]): number {
  return all.length - selectVersions(all, false).length
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
