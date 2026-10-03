import type { ResManifest } from './res-catalog'
import { downloadsFromRes } from './res-catalog'

/**
 * Checks what the resource service serves against what this site can read and what it
 * lists. The faults it names have each happened once with the earlier source
 * and passed every unit test, because the fixtures were written in the shape
 * the parser expected; run against the live documents, they fail loudly.
 *
 * A manifest with no products is not a fault: nothing is published.
 */
export function checkCatalog(manifest: unknown, releases: unknown[], siteBoards: string[]): string[] {
  const problems: string[] = []
  const listed = (manifest as ResManifest | null)?.products ?? []
  if (listed.length === 0)
    return problems

  const rows = downloadsFromRes(releases)
  if (rows.length === 0)
    problems.push(`the manifest names ${listed.length} products and none of their releases parses`)

  // One product at a time, so a partial change of shape names the product it
  // broke rather than surfacing as a shorter table nobody notices.
  const boards = new Set(siteBoards)
  for (const product of listed) {
    if (!rows.some(row => row.board === product.board && row.profile === product.variant))
      problems.push(`${product.product} parses to no downloads`)
    if (!boards.has(product.board))
      problems.push(`${product.product} is published for ${product.board}, which the site lists no page for`)
  }

  return problems
}
