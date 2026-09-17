/**
 * Fetches mica-build's live version index and checks it against this site.
 * The logic is `src/features/download/index-check.ts`, unit-tested; this is the
 * network around it. Exits non-zero on any problem.
 */
import process from 'node:process'
import { checkIndex } from '../src/features/download/index-check'
import { zh } from '../src/shared/i18n/zh'

const REPO = process.env.CATALOG_REPO ?? 'micaoss/mica-build'
const INDEX_ASSET = 'mica-index.json'

async function main(): Promise<void> {
  // The same URL the Worker reads, so this checks the path production takes.
  const entry = `https://github.com/${REPO}/releases/latest/download/${INDEX_ASSET}`
  const redirect = await fetch(entry, { redirect: 'manual' })
  const location = redirect.headers.get('location')
  if (!location)
    throw new Error(`${entry} answered ${redirect.status}, not a redirect to the asset`)

  const tag = decodeURIComponent(/\/releases\/download\/([^/]+)\//.exec(new URL(location).pathname)?.[1] ?? location)
  const response = await fetch(location)
  if (!response.ok)
    throw new Error(`${INDEX_ASSET} of ${tag} answered ${response.status}`)

  const problems = checkIndex(await response.json(), zh.boards.rows.map(row => row.board))

  if (problems.length > 0) {
    console.error(`${tag}: ${problems.length} problem(s)`)
    for (const problem of problems)
      console.error(`  - ${problem}`)
    process.exit(1)
  }

  console.log(`${tag}: the site reads and lists every published product`)
}

main().catch((error: Error) => {
  console.error(error.message)
  process.exit(1)
})
