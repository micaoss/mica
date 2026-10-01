import type { Download, DownloadKind, DownloadVariant } from './catalog'

/**
 * Reads the documents `mica-res` derives from the releases posted to it
 * (`mica-res:docs/modules/resource.md`): `catalog/products.json` says which
 * products exist and where each one's document is, and
 * `catalog/products/<product>.json` (`mica/res-product/v1`) holds that
 * product's releases, newest first, each with its files.
 *
 * Every field shown comes from a release record the producer posted; nothing is
 * inferred from a file name, and a record missing what a row needs is skipped.
 */

/** Where res serves public bytes and its documents. */
export const RES_DOWNLOAD_BASE = 'https://dl.res.micaos.dev'

export interface ResAsset {
  kind: string
  form?: string
  path: string
  sha256: string
  size: number
  uncompressedSha256?: string
  uncompressedSize?: number
}

export interface ResRelease {
  release: string
  stamp: string
  product: string
  board: string
  variant: string
  version?: string
  generation?: number
  publishedAt?: string
  assets?: ResAsset[]
}

export interface ResProduct {
  schema?: string
  product: string
  board: string
  variant: string
  releases?: ResRelease[]
}

export interface ResDirectoryEntry {
  product: string
  board: string
  variant: string
  /** The product document's key on the download host. */
  document: string
}

export interface ResDirectory {
  schema?: string
  products?: ResDirectoryEntry[]
}

const UPDATE_FORMS: DownloadVariant[] = ['full', 'root', 'kernel', 'core']
const KINDS: DownloadKind[] = ['image', 'update', 'firmware']

/** `20260929-0107` -> `2026-09-29`. The stamp is a UTC minute, so the date is its prefix. */
function dateOf(release: ResRelease): string | null {
  if (release.publishedAt && /^\d{4}-\d{2}-\d{2}/.test(release.publishedAt))
    return release.publishedAt.slice(0, 10)
  const match = /^(\d{4})(\d{2})(\d{2})-\d{4}$/.exec(release.stamp ?? '')
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null
}

function row(product: ResProduct, release: ResRelease, asset: ResAsset, date: string, base: string): Download | null {
  if (!KINDS.includes(asset.kind as DownloadKind))
    return null
  if (!asset.path || !/^[0-9a-f]{64}$/.test(asset.sha256 ?? '') || typeof asset.size !== 'number')
    return null
  const kind = asset.kind as DownloadKind
  // An update archive's form decides which one applies, so an update whose form
  // this page does not know is skipped rather than shown as a plain update.
  if (kind === 'update' && !UPDATE_FORMS.includes(asset.form as DownloadVariant))
    return null
  const variant = kind === 'update' ? (asset.form as DownloadVariant) : undefined

  return {
    board: product.board,
    profile: product.variant,
    kind,
    ...(variant ? { variant } : {}),
    version: release.stamp,
    releasedAt: date,
    bytes: asset.size,
    ...(typeof asset.uncompressedSize === 'number' ? { uncompressedBytes: asset.uncompressedSize } : {}),
    digest: `sha256:${asset.sha256}`,
    href: `${base}/${asset.path}`,
    filename: asset.path.slice(asset.path.lastIndexOf('/') + 1),
  }
}

/** The download rows of a set of product documents. */
export function downloadsFromRes(documents: unknown[], base: string = RES_DOWNLOAD_BASE): Download[] {
  const downloads: Download[] = []
  for (const value of documents) {
    const product = value as ResProduct | null
    if (!product?.board || !product.variant || !Array.isArray(product.releases))
      continue
    for (const release of product.releases) {
      const date = release && dateOf(release)
      if (!date)
        continue
      for (const asset of release.assets ?? []) {
        const download = row(product, release, asset, date, base)
        if (download)
          downloads.push(download)
      }
    }
  }
  return downloads
}

/** The product documents `catalog/products.json` points at. */
export function documentKeys(directory: unknown): string[] {
  const products = (directory as ResDirectory | null)?.products
  if (!Array.isArray(products))
    return []
  return products
    .map(entry => entry?.document)
    .filter((key): key is string => typeof key === 'string' && /^catalog\/products\/[a-z0-9][a-z0-9.-]*\.json$/.test(key))
}

/** A document on the download host, or null when it does not exist yet. */
export async function readDocument(base: string, key: string, get: typeof fetch = fetch): Promise<unknown | null> {
  const url = `${base}/${key}`
  const response = await get(url, { headers: { accept: 'application/json' } })
  if (response.status === 404)
    return null
  if (!response.ok)
    throw new Error(`${url} answered ${response.status}`)
  return response.json()
}

/**
 * The directory and every product document it names. Before the first release
 * is posted the directory does not exist, which reads as no products.
 */
export async function readCatalogue(base: string, get: typeof fetch = fetch): Promise<{ directory: unknown, documents: unknown[] }> {
  const directory = await readDocument(base, 'catalog/products.json', get)
  const documents: unknown[] = []
  for (const key of documentKeys(directory)) {
    const document = await readDocument(base, key, get)
    if (document === null)
      throw new Error(`catalog/products.json names ${key}, which ${base} does not serve`)
    documents.push(document)
  }
  return { directory, documents }
}
