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

const headers: Record<string, string> = {
  'accept': 'application/vnd.github+json',
  'user-agent': 'micaos.dev index check',
}
if (process.env.GITHUB_TOKEN)
  headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`

async function main(): Promise<void> {
  const latest = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers })
  if (!latest.ok)
    throw new Error(`the latest release answered ${latest.status}`)

  const release = (await latest.json()) as { tag_name: string, assets: { name: string, browser_download_url: string }[] }
  const asset = release.assets.find(candidate => candidate.name === INDEX_ASSET)
  if (!asset)
    throw new Error(`${release.tag_name}, the latest release, carries no ${INDEX_ASSET}`)

  const response = await fetch(asset.browser_download_url)
  if (!response.ok)
    throw new Error(`${INDEX_ASSET} answered ${response.status}`)

  const problems = checkIndex(await response.json(), zh.boards.rows.map(row => row.board))

  if (problems.length > 0) {
    console.error(`${release.tag_name}: ${problems.length} problem(s)`)
    for (const problem of problems)
      console.error(`  - ${problem}`)
    process.exit(1)
  }

  console.log(`${release.tag_name}: the site reads and lists every published product`)
}

main().catch((error: Error) => {
  console.error(error.message)
  process.exit(1)
})
