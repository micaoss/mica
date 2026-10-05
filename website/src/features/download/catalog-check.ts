import type { Download } from './catalog'
import type { ProductsDocument } from './products-catalog'

/**
 * Checks what the resource service serves against what this site can read and
 * what it has pages for. The faults it names have each happened once with an
 * earlier source and passed every unit test, because the fixtures were written
 * in the shape the parser expected; run against the live document, they fail
 * loudly.
 *
 * A catalogue with no products is not a fault: nothing is published.
 */
export function checkCatalog(document: ProductsDocument, downloads: Download[], siteBoards: string[]): string[] {
  const problems: string[] = []
  const boards = new Set(siteBoards)

  // One product at a time, so a partial change of shape names the product it
  // broke rather than surfacing as a shorter table nobody notices.
  for (const product of document.products ?? []) {
    const files = product.latest?.files?.length ?? 0
    if (files > 0 && !downloads.some(row => row.board === product.board && row.profile === product.variant))
      problems.push(`${product.product} parses to no downloads`)
    if (!boards.has(product.board))
      problems.push(`${product.product} is published for ${product.board}, which the site lists no page for`)
  }

  return problems
}
