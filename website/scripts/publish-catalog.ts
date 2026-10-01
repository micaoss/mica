/**
 * Builds the download catalogue from the documents `mica-res` derives from the
 * releases posted to it, and writes it as the two files the workflow puts into
 * KV. The Worker only reads that key.
 *
 * Before the first release is posted, res answers 404 for its directory: that is
 * published as an empty catalogue, which the pages show as "nothing published
 * yet", not as a failure.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import process from 'node:process'
import { storedCatalogue } from '../src/features/download/catalog-store'
import { readCatalogue, RES_DOWNLOAD_BASE } from '../src/features/download/res-catalog'

const BASE = process.env.CATALOG_BASE ?? RES_DOWNLOAD_BASE
const OUT = '.tmp'

async function main(): Promise<void> {
  const now = new Date().toISOString()
  const { documents } = await readCatalogue(BASE)
  const catalogue = storedCatalogue(documents, `${BASE}/catalog/products.json`, now)
  const status = { lastAttemptAt: now, trigger: 'ci', lastSuccessAt: now, lastError: null }

  await mkdir(OUT, { recursive: true })
  await writeFile(`${OUT}/catalog.json`, JSON.stringify(catalogue))
  await writeFile(`${OUT}/catalog-status.json`, JSON.stringify(status))

  console.log(`${BASE}: ${documents.length} product(s), ${catalogue.downloads.length} download(s) ready to publish`)
}

main().catch((error: Error) => {
  console.error(error.message)
  process.exit(1)
})
