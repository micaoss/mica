import type { Download, DownloadKind, DownloadVariant } from './catalog'

/**
 * Reads the update documents `mica-res` builds from the releases posted to it
 * (`mica-res:docs/modules/resource.md`):
 *
 *   <root>v2/manifest.json            every product and its latest release
 *   <root>v2/<product>/releases.json  that product's releases, newest first
 *   <baseUrl><path>                   one release, complete: its files
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

/** `mica/catalog/v2`: the manifest. */
export interface ResManifest {
  schema?: string
  revision?: number
  baseUrl?: string
  products?: { product: string, board: string, variant: string, latest?: { id: string, generation?: number, path: string } }[]
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
  const variant = kind === 'update' ? (file.form as DownloadVariant) : undefined

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

async function readJson(url: string, get: typeof fetch): Promise<unknown> {
  const response = await get(url, { headers: { accept: 'application/json' } })
  if (!response.ok)
    throw new Error(`${url} answered ${response.status}`)
  return response.json()
}

/**
 * The manifest and every release document of every product it names.
 *
 * Nothing here reads as "nothing published": before the first release res
 * answers a manifest with no products, so a missing document is a fault -- an
 * address that moved, or a release whose document is gone -- and is thrown.
 */
export async function readCatalogue(root: string, get: typeof fetch = fetch): Promise<{ manifest: ResManifest, releases: ResRelease[] }> {
  const manifest = await readJson(`${root}v2/manifest.json`, get) as ResManifest
  if (!Array.isArray(manifest?.products))
    throw new Error(`${root}v2/manifest.json names no products list`)

  const releases: ResRelease[] = []
  for (const product of manifest.products) {
    const history = await readJson(`${root}v2/${encodeURIComponent(product.product)}/releases.json`, get) as ResHistory
    if (!history?.baseUrl?.endsWith('/') || !Array.isArray(history.releases))
      throw new Error(`the history of ${product.product} carries no baseUrl or no releases`)
    for (const entry of history.releases)
      releases.push(await readJson(`${history.baseUrl}${entry.path}`, get) as ResRelease)
  }
  return { manifest, releases }
}
