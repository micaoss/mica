import type { Download, DownloadKind, DownloadVariant } from './catalog'

/**
 * Reads the release documents the resource service builds from the releases
 * posted to it (the resource service behind `res.micaos.dev`):
 *
 *   <root>v2/<product>/releases.json  that product's releases, newest first
 *   <baseUrl><path>                   one release, complete: its files
 *
 * The page's own document is the product catalogue (`products-catalog.ts`),
 * which carries each product's newest release in this same shape; these two
 * are read for a product's history.
 *
 * Every document that links to others carries a `baseUrl` and names each link
 * as a `path` relative to it. Every field shown comes from a release the
 * producer posted; nothing is inferred from a file name, and a record missing
 * what a row needs is skipped.
 */

/** The update root a device is configured with. */
export const RES_UPDATE_ROOT = 'https://res.micaos.dev/update/'

export interface ResFile {
  kind: string
  form?: string
  path: string
  sha256: string
  size: number
  uncompressedSha256?: string
  uncompressedSize?: number
}

/** `mica/release/v1`: one release, at `<its directory>/index.json`. */
export interface ResRelease {
  schema?: string
  baseUrl: string
  id: string
  product: string
  board: string
  variant: string
  version?: string
  generation?: number
  publishedAt?: string
  files?: ResFile[]
}

/** `mica/releases/v1`: a product's history. */
export interface ResHistory {
  schema?: string
  baseUrl?: string
  product?: string
  releases?: { id: string, generation?: number, path: string }[]
}

const UPDATE_FORMS: DownloadVariant[] = ['full', 'root', 'kernel', 'core']
const KINDS: DownloadKind[] = ['image', 'update', 'firmware']
/** A form as the resource service writes one. */
const FORM = /^[a-z0-9][a-z0-9-]*$/

/** The UTC-minute stamp a release id ends with: `mini-x64.basic.20261001-2113` -> `20261001-2113`. */
function stampOf(id: string): string | null {
  return /(\d{8}-\d{4})$/.exec(id ?? '')?.[1] ?? null
}

/** The publication date res recorded, else the date the stamp begins with. */
function dateOf(release: ResRelease, stamp: string): string {
  if (release.publishedAt && /^\d{4}-\d{2}-\d{2}/.test(release.publishedAt))
    return release.publishedAt.slice(0, 10)
  return `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}`
}

function row(release: ResRelease, file: ResFile, stamp: string): Download | null {
  if (!KINDS.includes(file.kind as DownloadKind))
    return null
  if (!file.path || !/^[0-9a-f]{64}$/.test(file.sha256 ?? '') || typeof file.size !== 'number')
    return null
  const kind = file.kind as DownloadKind
  // An update archive's form decides which one applies, so an update whose form
  // this page does not know is skipped rather than shown as a plain update.
  if (kind === 'update' && !UPDATE_FORMS.includes(file.form as DownloadVariant))
    return null
  // An image's form says which image it is: a product may publish its disk
  // image beside a boot loader image, or a vendor burning package alone.
  const variant = FORM.test(file.form ?? '') ? file.form : undefined

  return {
    board: release.board,
    profile: release.variant,
    kind,
    ...(variant ? { variant } : {}),
    version: stamp,
    releasedAt: dateOf(release, stamp),
    bytes: file.size,
    ...(typeof file.uncompressedSize === 'number' ? { uncompressedBytes: file.uncompressedSize } : {}),
    digest: `sha256:${file.sha256}`,
    href: `${release.baseUrl}${file.path}`,
    filename: decodeURIComponent(file.path.slice(file.path.lastIndexOf('/') + 1)),
  }
}

/** The download rows of a set of release documents. */
export function downloadsFromRes(releases: unknown[]): Download[] {
  const downloads: Download[] = []
  for (const value of releases) {
    const release = value as ResRelease | null
    if (!release?.board || !release.variant || !release.baseUrl?.endsWith('/'))
      continue
    const stamp = stampOf(release.id)
    if (!stamp)
      continue
    for (const file of release.files ?? []) {
      const download = row(release, file, stamp)
      if (download)
        downloads.push(download)
    }
  }
  return downloads
}

/** One document; anything but an answer is thrown, never read as empty. */
export async function readJson(url: string, get: typeof fetch): Promise<unknown> {
  const response = await get(url, { headers: { accept: 'application/json' } })
  if (!response.ok)
    throw new Error(`${url} answered ${response.status}`)
  return response.json()
}
