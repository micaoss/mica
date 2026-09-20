/**
 * Builds the download catalogue from mica-build's latest index and writes it as
 * the two files the workflow puts into KV.
 *
 * It runs on a CI runner because the Worker cannot: refreshing from Cloudflare's
 * shared egress failed continuously against GitHub, with 403 from the API and
 * 429 from the release download.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import process from 'node:process'
import { storedCatalogue } from '../src/features/download/catalog-store'

const REPO = process.env.CATALOG_REPO ?? 'micaoss/mica-build'
const INDEX_ASSET = 'mica-index.json'
const OUT = '.tmp'

async function main(): Promise<void> {
  const now = new Date().toISOString()
  const entry = `https://github.com/${REPO}/releases/latest/download/${INDEX_ASSET}`

  const redirect = await fetch(entry, { redirect: 'manual' })
  const location = redirect.headers.get('location')
  if (!location)
    throw new Error(`${entry} answered ${redirect.status}, not a redirect to the asset`)

  const release = decodeURIComponent(
    /\/releases\/download\/([^/]+)\//.exec(new URL(location).pathname)?.[1] ?? location,
  )
  const response = await fetch(location)
  if (!response.ok)
    throw new Error(`${INDEX_ASSET} of ${release} answered ${response.status}`)

  const catalogue = storedCatalogue(await response.json(), release, now)
  const status = { lastAttemptAt: now, trigger: 'ci', lastSuccessAt: now, lastError: null }

  await mkdir(OUT, { recursive: true })
  await writeFile(`${OUT}/catalog.json`, JSON.stringify(catalogue))
  await writeFile(`${OUT}/catalog-status.json`, JSON.stringify(status))

  console.log(`${release}: ${catalogue.downloads.length} downloads ready to publish`)
}

main().catch((error: Error) => {
  console.error(error.message)
  process.exit(1)
})
