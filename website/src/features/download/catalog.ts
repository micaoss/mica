/**
 * The download catalogue.
 *
 * A row is something an integrator can obtain and put on a device: a system
 * image, an update package, or a firmware package. The components inside a
 * deployment — kernel, root, support — are not downloads; they arrive through an
 * update.
 *
 * The content contract binds entries to published artifact metadata and forbids
 * hand-written release identities, so the shape is fixed here and the catalogue
 * stays empty until something publishes one.
 */

/**
 * The product variant a download was built for — `basic`, `full`. Not a fixed
 * set: the catalogue names the variants, and the page offers what it finds.
 */
export type Profile = string

/** What form the download takes. */
export type DownloadKind = 'image' | 'update' | 'firmware'

export const DOWNLOAD_KINDS: DownloadKind[] = ['image', 'update', 'firmware']

/**
 * Which of a form's variants this is. A deployment publishes up to four update
 * archives — `full` always, `root` when the kernel identity is unchanged,
 * `kernel` when the rootfs is, `core` for the core components alone — and they
 * are not interchangeable, so the row says which one it is.
 */
export type UpdateVariant = 'full' | 'root' | 'kernel' | 'core'

/**
 * An image has a form as well: `disk`, the raw disk image, and whatever a
 * board's packers add (`usb-burn`, `sd-boot`). Not a fixed set: a board
 * declares its image kinds, and the page shows what the catalogue names.
 */
export type DownloadVariant = UpdateVariant | (string & {})

export interface Download {
  /** Board identifier, as `mica-build` names it. */
  board: string
  profile: Profile
  kind: DownloadKind
  /** Which variant of the form, where the form has more than one. */
  variant?: DownloadVariant
  /** Release version or generation. */
  version: string
  /** Signed deployment this download carries, when the source names one. */
  deploymentId?: string
  /** ISO 8601 date the release was published; orders the versions. */
  releasedAt: string
  bytes: number
  /** Size once decompressed, where the file is compressed. */
  uncompressedBytes?: number
  digest: string
  href: string
  /** File name as published, so the row says what lands on disk. */
  filename: string
}

export interface DownloadQuery {
  board?: string
  profile?: Profile
  kind?: DownloadKind
  /** Matched against version and deployment ID. */
  query?: string
}

/** Empty until a release is published. */
export const DOWNLOADS: Download[] = []

export function filterDownloads(all: Download[], query: DownloadQuery): Download[] {
  const text = query.query?.trim().toLowerCase()

  return all.filter((download) => {
    if (query.board && download.board !== query.board)
      return false
    if (query.profile && download.profile !== query.profile)
      return false
    if (query.kind && download.kind !== query.kind)
      return false
    if (!text)
      return true
    return `${download.version} ${download.deploymentId ?? ''}`.toLowerCase().includes(text)
  })
}

/**
 * Newest first, and only each product's newest release unless `history` asks
 * for the rest.
 *
 * The files of one release belong together: its update archives — `full`,
 * `root`, `kernel` — and its images — a disk image beside a boot loader
 * package — are different files with different uses, not versions of each
 * other, so all of them show. A file an earlier release carried and the newest
 * does not is history: a product that stopped publishing its disk image must
 * not go on offering the last one as current.
 */
export function selectVersions(all: Download[], history: boolean): Download[] {
  const ordered = [...all].sort((a, b) =>
    b.releasedAt.localeCompare(a.releasedAt) || b.version.localeCompare(a.version),
  )
  if (history)
    return ordered

  // Ordered newest first, so the first row of a product names its newest release.
  const newest = new Map<string, string>()
  for (const download of ordered) {
    const product = `${download.board}/${download.profile}`
    if (!newest.has(product))
      newest.set(product, download.version)
  }
  return ordered.filter(download => newest.get(`${download.board}/${download.profile}`) === download.version)
}

/** How many rows `history` would add, so the control can say whether it is worth using. */
export function historyCount(all: Download[]): number {
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
