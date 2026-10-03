/**
 * Reads what the resource service serves and checks it against this site. The logic is
 * `src/features/download/catalog-check.ts`, unit-tested; this is the network
 * around it. Exits non-zero on any problem.
 */
import process from 'node:process'
import { checkCatalog } from '../src/features/download/catalog-check'
import { readCatalogue, RES_UPDATE_ROOT } from '../src/features/download/res-catalog'
import { zh } from '../src/shared/i18n/zh'

const ROOT = process.env.CATALOG_ROOT ?? RES_UPDATE_ROOT

async function main(): Promise<void> {
  const { manifest, releases } = await readCatalogue(ROOT)
  const problems = checkCatalog(manifest, releases, zh.boards.rows.map(row => row.board))

  if (problems.length > 0) {
    console.error(`${ROOT}: ${problems.length} problem(s)`)
    for (const problem of problems)
      console.error(`  - ${problem}`)
    process.exit(1)
  }

  console.log(`${ROOT}: the site reads every published product (${manifest.products?.length ?? 0} product(s), ${releases.length} release(s))`)
}

main().catch((error: Error) => {
  console.error(error.message)
  process.exit(1)
})
