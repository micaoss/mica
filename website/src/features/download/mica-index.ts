import type { Download, DownloadVariant } from './catalog'

/**
 * Reads `mica-index.json`, the version index `mica-build` publishes.
 *
 * The index is the entry point by design: it names every current product, its
 * files, their sizes and their hashes, so nothing here has to be inferred from a
 * file name. `docs/design/mica-index.md` specifies the shape; this reads the
 * `mica/index/v1` members the download pages show.
 *
 * A product absent from `products` is absent on purpose — the catalogue lists it
 * with `publish: false` — so nothing is reconstructed for it.
 */

export interface IndexAsset {
  kind: string
  file: string
  url: string
  sha256: string
  size: number
  compression?: string
  uncompressedSize?: number
}

export interface IndexProduct {
  product: string
  board: string
  profile: string
  deployment: string
  release: string
  images?: IndexAsset[]
  updates?: IndexAsset[]
}

export interface MicaIndex {
  schema?: string
  version?: string
  products?: IndexProduct[]
}

const UPDATE_VARIANTS: DownloadVariant[] = ['full', 'root', 'kernel']

/** `cx3576/20260915-2230` -> `20260915-2230`; a release without a scope is its own stamp. */
function stamp(release: string): string {
  const slash = release.indexOf('/')
  return slash === -1 ? release : release.slice(slash + 1)
}

/** `20260915-2230` -> `2026-09-15`. The stamp is a UTC minute, so the date is its prefix. */
function releasedAt(release: string): string | null {
  const match = /^(\d{4})(\d{2})(\d{2})-\d{4}$/.exec(stamp(release))
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null
}

function entry(
  product: IndexProduct,
  asset: IndexAsset,
  kind: Download['kind'],
  variant: DownloadVariant | undefined,
  date: string,
): Download | null {
  if (!asset.file || !asset.url || !asset.sha256 || typeof asset.size !== 'number')
    return null

  return {
    board: product.board,
    profile: product.profile,
    kind,
    ...(variant ? { variant } : {}),
    version: stamp(product.release),
    deploymentId: product.deployment,
    releasedAt: date,
    bytes: asset.size,
    ...(typeof asset.uncompressedSize === 'number'
      ? { uncompressedBytes: asset.uncompressedSize }
      : {}),
    digest: `sha256:${asset.sha256}`,
    href: asset.url,
    filename: asset.file,
  }
}

export function downloadsFromIndex(index: unknown): Download[] {
  const products = (index as MicaIndex | null)?.products
  if (!Array.isArray(products))
    return []

  const downloads: Download[] = []

  for (const product of products) {
    if (!product?.board || !product.profile || !product.release)
      continue
    const date = releasedAt(product.release)
    if (!date)
      continue

    for (const image of product.images ?? []) {
      const download = entry(product, image, 'image', undefined, date)
      if (download)
        downloads.push(download)
    }

    for (const update of product.updates ?? []) {
      // An unknown archive kind is skipped rather than shown as a plain update:
      // which archive applies depends on which one it is.
      if (!UPDATE_VARIANTS.includes(update.kind as DownloadVariant))
        continue
      const download = entry(product, update, 'update', update.kind as DownloadVariant, date)
      if (download)
        downloads.push(download)
    }
  }

  return downloads
}
