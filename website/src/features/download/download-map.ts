import type { Download } from './catalog'
import type { LocaleCode } from '@/shared/i18n'
import table from '../../../download-map.json'

/**
 * The mapping table of the download pages, read from `download-map.json`: what
 * the resource service names (a file's kind and form, a product's variant) and
 * what the site calls it. Anything the table has no row for is shown under its
 * own name, so a board's new image kind or product appears before it is worded.
 */

interface Words { zh: string, en: string }

const FILES: (Words & { kind: string, form: string, category: string })[] = table.files
const PRODUCTS: (Words & { board?: string, variant: string })[] = table.products

function fileRow(download: Download) {
  return FILES.find(row => row.kind === download.kind && row.form === download.variant)
}

function categoryLabel(id: string, locale: LocaleCode): string {
  return table.categories.find(category => category.id === id)?.[locale] ?? id
}

/** The category a file is listed and filtered under: the table's, else its kind. */
export function categoryOf(download: Download): string {
  return fileRow(download)?.category ?? download.kind
}

/** What a row reads as: its category, and the wording of its form beside it. */
export function describeFile(download: Download, locale: LocaleCode): { category: string, detail?: string } {
  const category = categoryLabel(categoryOf(download), locale)
  if (!download.variant)
    return { category }
  return { category, detail: fileRow(download)?.[locale] ?? download.variant }
}

/** The categories these rows fall under, in the table's order, then any it does not define. */
export function categoriesOf(downloads: Download[], locale: LocaleCode): { id: string, label: string }[] {
  const present = new Set(downloads.map(categoryOf))
  const defined = table.categories.map(category => category.id)
  const ids = [...defined.filter(id => present.has(id)), ...[...present].filter(id => !defined.includes(id)).sort()]
  return ids.map(id => ({ id, label: categoryLabel(id, locale) }))
}

/** What a product variant means on a board, where the table words it. */
export function productNote(board: string, variant: string, locale: LocaleCode): string | undefined {
  const row = PRODUCTS.find(entry => entry.board === board && entry.variant === variant)
    ?? PRODUCTS.find(entry => !entry.board && entry.variant === variant)
  return row?.[locale]
}
