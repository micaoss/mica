/**
 * Reads the product catalogue the resource service serves and checks it against this
 * site. The logic is `src/features/download/catalog-check.ts`, unit-tested; this is the
 * network around it. Exits non-zero on any problem.
 */
import process from 'node:process'
import boards from '../boards.json'
import { checkCatalog } from '../src/features/download/catalog-check'
import { catalogueFrom, productsUrl, readProducts } from '../src/features/download/products-catalog'
import { RES_UPDATE_ROOT } from '../src/features/download/res-catalog'

const ROOT = process.env.CATALOG_ROOT ?? RES_UPDATE_ROOT

async function main(): Promise<void> {
  const document = await readProducts(ROOT)
  const catalogue = catalogueFrom(document, productsUrl(ROOT), new Date().toISOString())
  const problems = checkCatalog(document, catalogue.downloads, boards.boards.map(row => row.board))

  if (problems.length > 0) {
    console.error(`${ROOT}: ${problems.length} problem(s)`)
    for (const problem of problems)
      console.error(`  - ${problem}`)
    process.exit(1)
  }

  console.log(`${ROOT}: the site reads every listed product (${document.products?.length ?? 0} product(s), ${catalogue.downloads.length} download(s))`)
}

main().catch((error: Error) => {
  console.error(error.message)
  process.exit(1)
})
