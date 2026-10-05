import type { Download } from './catalog'
import type { ResHistory, ResRelease } from './res-catalog'
import { downloadsFromRes, readJson } from './res-catalog'

/**
 * Reads the product catalogue the resource service serves for the website
 * (`mica-res:docs/spec/product-catalogue.md`):
 *
 *   <root>products/v1.json   every listed board and product, each product's
 *                            newest release with its files, and the words a
 *                            board, a product and a file type are called by
 *
 * It is the only source of that wording and of what is listed: an admin edits
 * it in the resource service's console and this site keeps no copy. A
 * product's earlier releases are not in it; they are read when a visitor asks
 * for them, from the history the product names.
 */

/** A worded field: both languages, an unfilled one an empty string. */
export interface Words { zh: string, en: string }

export interface Category { id: string, title: Words }
export interface FileType { kind: string, form: string, category: string, title: Words, description?: Words }
export interface BoardInfo { board: string, title: Words, hardware: Words, status: Words }

/** A product as the page needs it: its words, and where its history is. */
export interface ProductInfo {
  product: string
  board: string
  variant: string
  title: Words
  summary: Words
  recommended: boolean
  /** The full URL of the product's `releases.json`. */
  releases: string
}

/** `mica/products/v1`, as served. */
export interface ProductsDocument {
  schema?: string
  baseUrl: string
  categories?: Category[]
  fileTypes?: FileType[]
  boards?: BoardInfo[]
  products?: (ProductInfo & {
    latest?: { id: string, version?: string, generation?: number, publishedAt?: string, files?: ResRelease['files'] }
  })[]
}

/** The words of the document: what the page calls things by. */
export interface CatalogueWords {
  categories: Category[]
  fileTypes: FileType[]
  boards: BoardInfo[]
  products: ProductInfo[]
}

/** What the Worker answers and a browser keeps. */
export interface Catalogue extends CatalogueWords {
  /** The shape's version: a kept copy of another version is not read. */
  version: 2
  /** The files of each listed product's newest release, in the document's order. */
  downloads: Download[]
  /** When this copy was read. */
  refreshedAt: string
  /** Where it was read from. */
  source: string
}

export const CATALOGUE_VERSION = 2

export const NO_WORDS: CatalogueWords = { categories: [], fileTypes: [], boards: [], products: [] }

/** The document's address under an update root. */
export function productsUrl(root: string): string {
  return `${root}products/v1.json`
}

/**
 * Nothing here reads as "nothing published": a document that does not answer,
 * or is not the catalogue, is thrown. A catalogue with no products is honest.
 */
export async function readProducts(root: string, get: typeof fetch = fetch): Promise<ProductsDocument> {
  const url = productsUrl(root)
  const document = await readJson(url, get) as ProductsDocument | null
  if (!document?.baseUrl?.endsWith('/') || !Array.isArray(document.products))
    throw new Error(`${url} carries no baseUrl or no products list`)
  return document
}

/** The newest release of a product, shaped as the release it was posted as. */
function latestRelease(document: ProductsDocument, product: NonNullable<ProductsDocument['products']>[number]): ResRelease | null {
  if (!product.latest)
    return null
  return {
    baseUrl: document.baseUrl,
    id: product.latest.id,
    product: product.product,
    board: product.board,
    variant: product.variant,
    publishedAt: product.latest.publishedAt,
    files: product.latest.files,
  }
}

/**
 * The catalogue of a document. Files that parse to nothing mean the shape
 * moved under the parser, not that everything was unpublished, so they are
 * refused rather than served: an empty catalogue would blank every board page.
 */
export function catalogueFrom(document: ProductsDocument, source: string, now: string): Catalogue {
  const products = document.products ?? []
  const releases = products.map(product => latestRelease(document, product)).filter(release => release !== null)
  const downloads = downloadsFromRes(releases)
  const files = releases.reduce((count, release) => count + (release.files?.length ?? 0), 0)
  if (files > 0 && downloads.length === 0)
    throw new Error(`${source}: ${files} file(s) parsed to no downloads`)

  return {
    version: CATALOGUE_VERSION,
    downloads,
    categories: document.categories ?? [],
    fileTypes: document.fileTypes ?? [],
    boards: document.boards ?? [],
    products: products.map(({ product, board, variant, title, summary, recommended, releases: history }) =>
      ({ product, board, variant, title, summary, recommended: recommended === true, releases: history })),
    refreshedAt: now,
    source,
  }
}

/** Every release of one product, from the history it names: read when a visitor asks. */
export async function readHistory(releasesUrl: string, get: typeof fetch = fetch): Promise<Download[]> {
  const history = await readJson(releasesUrl, get) as ResHistory | null
  if (!history?.baseUrl?.endsWith('/') || !Array.isArray(history.releases))
    throw new Error(`${releasesUrl} carries no baseUrl or no releases`)
  const releases = await Promise.all(history.releases.map(entry => readJson(`${history.baseUrl}${entry.path}`, get)))
  return downloadsFromRes(releases)
}
