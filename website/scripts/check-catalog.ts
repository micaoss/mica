/**
 * Reads what `mica-res` serves and checks it against this site. The logic is
 * `src/features/download/catalog-check.ts`, unit-tested; this is the network
 * around it. Exits non-zero on any problem.
 */
import process from 'node:process'
import { checkCatalog } from '../src/features/download/catalog-check'
import { readCatalogue, RES_DOWNLOAD_BASE } from '../src/features/download/res-catalog'
import { zh } from '../src/shared/i18n/zh'

const BASE = process.env.CATALOG_BASE ?? RES_DOWNLOAD_BASE

async function main(): Promise<void> {
  const { directory, documents } = await readCatalogue(BASE)
  const problems = checkCatalog(directory, documents, zh.boards.rows.map(row => row.board))

  if (problems.length > 0) {
    console.error(`${BASE}: ${problems.length} problem(s)`)
    for (const problem of problems)
      console.error(`  - ${problem}`)
    process.exit(1)
  }

  console.log(`${BASE}: the site reads every published product (${documents.length})`)
}

main().catch((error: Error) => {
  console.error(error.message)
  process.exit(1)
})
