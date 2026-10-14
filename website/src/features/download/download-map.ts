import type { Download } from './catalog'
import type { BoardInfo, CatalogueWords, ProductInfo, Words } from './products-catalog'
import type { LocaleCode } from '@/shared/i18n'

/**
 * What the download pages call things: a file's category and form, a product,
 * a board. The words are the resource service's (`products-catalog.ts`); this
 * is how a page reads them, with the fallbacks its contract states, so
 * anything not yet worded there is shown under its own name.
 */

/** A worded field in a locale: that language, else the other, else nothing. */
export function wordIn(words: Words | undefined, locale: LocaleCode): string | undefined {
  const other = locale === 'zh' ? 'en' : 'zh'
  return words?.[locale] || words?.[other] || undefined
}

function fileType(words: CatalogueWords, download: Download) {
  return words.fileTypes.find(row => row.kind === download.kind && row.form === download.variant)
}

function categoryLabel(words: CatalogueWords, id: string, locale: LocaleCode): string {
  return wordIn(words.categories.find(category => category.id === id)?.title, locale) ?? id
}

/** The category a file is listed and filtered under: its file type's, else its kind. */
export function categoryOf(words: CatalogueWords, download: Download): string {
  return fileType(words, download)?.category ?? download.kind
}

/** What a row reads as: its category, and the wording of its form beside it. */
export function describeFile(words: CatalogueWords, download: Download, locale: LocaleCode): { category: string, detail?: string, description?: string } {
  const category = categoryLabel(words, categoryOf(words, download), locale)
  if (!download.variant)
    return { category }
  const type = fileType(words, download)
  const description = wordIn(type?.description, locale)
  return { category, detail: wordIn(type?.title, locale) ?? download.variant, ...(description ? { description } : {}) }
}

/** The categories these rows fall under, in the document's order, then any it does not define. */
export function categoriesOf(words: CatalogueWords, downloads: Download[], locale: LocaleCode): { id: string, label: string }[] {
  const present = new Set(downloads.map(download => categoryOf(words, download)))
  const defined = words.categories.map(category => category.id)
  const ids = [...defined.filter(id => present.has(id)), ...[...present].filter(id => !defined.includes(id)).sort()]
  return ids.map(id => ({ id, label: categoryLabel(words, id, locale) }))
}

/** The product a row belongs to, where the catalogue lists it. */
export function productOf(words: CatalogueWords, board: string, variant: string): ProductInfo | undefined {
  return words.products.find(product => product.board === board && product.variant === variant)
}

/** What a product variant is called on a board, where the catalogue words it. */
export function productNote(words: CatalogueWords, board: string, variant: string, locale: LocaleCode): string | undefined {
  return wordIn(productOf(words, board, variant)?.title, locale)
}

/** A board's hardware and status, where the catalogue words them. */
export function boardWords(words: CatalogueWords, board: string, locale: LocaleCode): { hardware?: string, status?: string } {
  const info: BoardInfo | undefined = words.boards.find(entry => entry.board === board)
  return { hardware: wordIn(info?.hardware, locale), status: wordIn(info?.status, locale) }
}
