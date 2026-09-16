import type { IndexProduct } from './mica-index'
import { downloadsFromIndex } from './mica-index'

/**
 * Checks the published index against what this site can read and what it lists.
 *
 * Each of the three faults it names has already happened, and each passed every
 * unit test, because the unit tests run against fixtures written in the shape
 * the parser expected: the release stamp changed separator and every product
 * parsed to nothing; the generic systems were renamed and their board pages went
 * empty. Run against the live index, the same faults fail loudly instead.
 */

interface CatalogueBoard {
  board: string
  releaseTarget?: boolean
}

interface CheckedIndex {
  version?: string
  products?: IndexProduct[]
  catalogue?: { boards?: CatalogueBoard[] }
}

export function checkIndex(index: unknown, siteBoards: string[]): string[] {
  const problems: string[] = []
  const checked = index as CheckedIndex | null
  const products = Array.isArray(checked?.products) ? checked.products : []

  if (products.length === 0) {
    problems.push('the index names no products')
    return problems
  }

  const rows = downloadsFromIndex(index)
  if (rows.length === 0)
    problems.push(`the index names ${products.length} products and none of them parses`)

  // One product at a time, so a partial change of shape names the product it
  // broke rather than surfacing as a shorter table nobody notices.
  for (const product of products) {
    const own = rows.filter(row => row.board === product.board && row.profile === product.profile)
    if (own.length === 0)
      problems.push(`${product.product} (${product.release}) parses to no downloads`)
  }

  const listed = new Set(siteBoards)
  for (const board of checked?.catalogue?.boards ?? []) {
    if (board.releaseTarget && !listed.has(board.board))
      problems.push(`${board.board} is a release target upstream but the site lists no such board`)
  }

  return problems
}
