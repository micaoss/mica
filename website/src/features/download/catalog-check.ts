import type { ResDirectory, ResProduct } from './res-catalog'
import { downloadsFromRes } from './res-catalog'

/**
 * Checks what `mica-res` serves against what this site can read and what it
 * lists. The faults it names have each happened once with the earlier source
 * and passed every unit test, because the fixtures were written in the shape
 * the parser expected; run against the live documents, they fail loudly.
 *
 * A directory with no products is not a fault: nothing has been posted yet.
 */
export function checkCatalog(directory: unknown, documents: unknown[], siteBoards: string[]): string[] {
  const problems: string[] = []
  const listed = (directory as ResDirectory | null)?.products ?? []
  if (listed.length === 0)
    return problems

  if (documents.length !== listed.length)
    problems.push(`the directory names ${listed.length} products and ${documents.length} of their documents were read`)

  const rows = downloadsFromRes(documents)
  if (rows.length === 0)
    problems.push(`the directory names ${listed.length} products and none of them parses`)

  // One product at a time, so a partial change of shape names the product it
  // broke rather than surfacing as a shorter table nobody notices.
  for (const value of documents) {
    const product = value as ResProduct
    if (!rows.some(row => row.board === product.board && row.profile === product.variant))
      problems.push(`${product.product} parses to no downloads`)
  }

  const boards = new Set(siteBoards)
  for (const entry of listed) {
    if (!boards.has(entry.board))
      problems.push(`${entry.product} is published for ${entry.board}, which the site lists no page for`)
  }

  return problems
}
