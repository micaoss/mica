import type { Download } from './catalog'
import type { ResHistory, ResRelease } from './res-catalog'
import { downloadsFromRes, readJson } from './res-catalog'

/**
 * Reads the product catalogue the resource service serves for the website
 * (`mica-res:docs/spec/product-catalogue.md`), in its two levels:
 *
 *   <root>products/v1.json           the index: every listed board and product,
 *                                    with its words and its newest release's
 *                                    identity; no files
 *   <root>products/v1/<board>.json   one board: its guides, its products with
 *                                    the files of their newest release, and the
 *                                    words of the file types those files use
 *
 * The resource service is the only source of all of it: which boards and
 * products exist, in what order, what they are called and which documents a
 * board's page links to. An admin edits it in the resource service's console
 * and this site keeps no copy. A product's earlier releases are in neither
 * document; they are read when a visitor asks, from the history it names.
 */

/** A worded field: both languages, an unfilled one an empty string. */
export interface Words { zh: string, en: string }

export interface Category { id: string, title: Words }
export interface FileType { kind: string, form: string, category: string, title: Words, description?: Words }
export interface BoardInfo { board: string, title: Words, hardware: Words, status: Words }

/** A document a board's page links to: one of this site's, or an outside one. */
export interface Guide {
  title: Words
  body: Words
  /** A documentation slug of this site, under `/docs/`. */
  doc?: string
  /** An absolute https URL, for a target this site does not publish. */
  url?: string
}

/** A product as a page needs it: its words, and where its history is. */
export interface ProductInfo {
  product: string
  /** `product`, or `core` for a core channel, which belongs to no board. */
  kind?: string
  board: string
  variant: string
  title: Words
  summary: Words
  recommended: boolean
  /** The full URL of the product's `releases.json`. */
  releases: string
}

/** A product in the index: with the identity of its newest release. */
export interface ProductLine extends ProductInfo {
  latest: { version: string, publishedAt?: string } | null
}

interface Latest { id: string, version?: string, generation?: number, publishedAt?: string, files?: ResRelease['files'] }

/** `mica/products/v1`, as served. */
export interface IndexDocument {
  schema?: string
  boards?: BoardInfo[]
  products?: (ProductInfo & { latest?: Latest })[]
}

/** `mica/products-board/v1`, as served. */
export interface BoardDocument extends Partial<BoardInfo> {
  schema?: string
  baseUrl: string
  guides?: Guide[]
  categories?: Category[]
  fileTypes?: FileType[]
  products?: (Omit<ProductInfo, 'board'> & { latest?: Latest })[]
}

/** The words a board's page calls things by. */
export interface CatalogueWords {
  categories: Category[]
  fileTypes: FileType[]
  boards: BoardInfo[]
  products: ProductInfo[]
}

/** The shape's version: a kept copy of another version is not read. */
export const CATALOGUE_VERSION = 1

interface Read {
  version: typeof CATALOGUE_VERSION
  /** When this copy was read. */
  refreshedAt: string
  /** Where it was read from. */
  source: string
}

/** What the Worker answers for the board list. */
export interface IndexCatalogue extends Read {
  boards: BoardInfo[]
  products: ProductLine[]
}

/** What the Worker answers for one board's page. */
export interface BoardCatalogue extends Read, CatalogueWords {
  board: string
  /** The files of each of the board's products' newest release, in the document's order. */
  downloads: Download[]
  /** The guides this site can show: an outside target, or a document it publishes. */
  guides: Guide[]
  /** The documentation slugs the catalogue names and this site does not publish. */
  staleGuides: string[]
}

export const NO_WORDS: CatalogueWords = { categories: [], fileTypes: [], boards: [], products: [] }

/** A board's identifier, as it appears in a URL. */
export const BOARD_NAME = /^[a-z0-9][a-z0-9-]*$/

/** A documentation slug of this site: the path under `/docs/`, no slash at either end. */
const DOC_SLUG = /^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/

/**
 * An address a page may link to: an absolute https URL, or nothing. What the
 * catalogue names ends in an `href`, so any other scheme is refused here, in
 * the Worker and again in the browser, which also reads a copy it kept.
 */
export function outsideUrl(url: unknown): string | undefined {
  if (typeof url !== 'string')
    return undefined
  try {
    return new URL(url).protocol === 'https:' ? url : undefined
  }
  catch {
    return undefined
  }
}

/** A guide's documentation slug, where it is one. */
export function docSlug(doc: unknown): string | undefined {
  return typeof doc === 'string' && DOC_SLUG.test(doc) ? doc : undefined
}

export function indexUrl(root: string): string {
  return `${root}products/v1.json`
}

export function boardUrl(root: string, board: string): string {
  return `${root}products/v1/${board}.json`
}

/**
 * Nothing here reads as "nothing published": a document that does not answer,
 * or is not the catalogue, is thrown. A catalogue with no products is honest.
 */
export async function readIndex(root: string, get: typeof fetch = fetch): Promise<IndexDocument> {
  const url = indexUrl(root)
  const document = await readJson(url, get) as IndexDocument | null
  if (!Array.isArray(document?.boards) || !Array.isArray(document.products))
    throw new Error(`${url} carries no boards or no products list`)
  return document
}

/** One board's document, or null for a board the catalogue does not list. */
export async function readBoard(root: string, board: string, get: typeof fetch = fetch): Promise<BoardDocument | null> {
  const url = boardUrl(root, board)
  const response = await get(url, { headers: { accept: 'application/json' } })
  if (response.status === 404)
    return null
  if (!response.ok)
    throw new Error(`${url} answered ${response.status}`)
  const document = await response.json() as BoardDocument | null
  if (!document?.baseUrl?.endsWith('/') || !Array.isArray(document.products))
    throw new Error(`${url} carries no baseUrl or no products list`)
  return document
}

/** The index, as answered: each product with its newest release's identity alone. */
export function indexFrom(document: IndexDocument, source: string, now: string): IndexCatalogue {
  return {
    version: CATALOGUE_VERSION,
    boards: document.boards ?? [],
    products: (document.products ?? []).map(({ product, kind, board, variant, title, summary, recommended, releases, latest }) => ({
      product,
      kind,
      board,
      variant,
      title,
      summary,
      recommended: recommended === true,
      releases,
      latest: latest?.version ? { version: latest.version, publishedAt: latest.publishedAt } : null,
    })),
    refreshedAt: now,
    source,
  }
}

/**
 * One board's catalogue. Files that parse to nothing mean the shape moved
 * under the parser, not that everything was unpublished, so they are refused
 * rather than served: an empty catalogue would blank the board's page.
 *
 * `published` says whether this site publishes a documentation slug: a guide
 * to one it does not is left out and named, so an admin can find a stale slug.
 */
export function boardFrom(board: string, document: BoardDocument, published: (slug: string) => boolean, source: string, now: string): BoardCatalogue {
  const products = document.products ?? []
  const releases: ResRelease[] = products.flatMap(product => product.latest
    ? [{ baseUrl: document.baseUrl, id: product.latest.id, product: product.product, board, variant: product.variant, publishedAt: product.latest.publishedAt, files: product.latest.files }]
    : [])
  const downloads = downloadsFromRes(releases)
  const files = releases.reduce((count, release) => count + (release.files?.length ?? 0), 0)
  if (files > 0 && downloads.length === 0)
    throw new Error(`${source}: ${files} file(s) parsed to no downloads`)

  const guides = document.guides ?? []
  const shown = guides.filter(guide => (guide.doc ? Boolean(docSlug(guide.doc)) && published(guide.doc) : Boolean(outsideUrl(guide.url))))
  const empty: Words = { zh: '', en: '' }

  return {
    version: CATALOGUE_VERSION,
    board,
    downloads,
    categories: document.categories ?? [],
    fileTypes: document.fileTypes ?? [],
    boards: [{ board, title: document.title ?? empty, hardware: document.hardware ?? empty, status: document.status ?? empty }],
    products: products.map(({ product, kind, variant, title, summary, recommended, releases: history }) =>
      ({ product, kind, board, variant, title, summary, recommended: recommended === true, releases: history })),
    guides: shown,
    staleGuides: guides.flatMap(guide => (guide.doc && !published(guide.doc) ? [guide.doc] : [])),
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
