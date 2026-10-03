/**
 * Builds the download catalogue from the update documents the resource service builds
 * from the releases posted to it, and writes it as the two files the workflow
 * puts into KV. The Worker only reads that key.
 *
 * A manifest with no products is published as an empty catalogue. A document
 * that does not answer is a failure: an address that moved must not read as
 * "nothing published".
 */
import { mkdir, writeFile } from 'node:fs/promises'
import process from 'node:process'
import { storedCatalogue } from '../src/features/download/catalog-store'
import { readCatalogue, RES_UPDATE_ROOT } from '../src/features/download/res-catalog'

const ROOT = process.env.CATALOG_ROOT ?? RES_UPDATE_ROOT
const OUT = '.tmp'

async function main(): Promise<void> {
  const now = new Date().toISOString()
  const { manifest, releases } = await readCatalogue(ROOT)
  const catalogue = storedCatalogue(releases, `${ROOT}v2/manifest.json`, now)
  const status = { lastAttemptAt: now, trigger: 'ci', lastSuccessAt: now, lastError: null }

  await mkdir(OUT, { recursive: true })
  await writeFile(`${OUT}/catalog.json`, JSON.stringify(catalogue))
  await writeFile(`${OUT}/catalog-status.json`, JSON.stringify(status))

  console.log(`${ROOT}: ${manifest.products?.length ?? 0} product(s), ${releases.length} release(s), ${catalogue.downloads.length} download(s) ready to publish`)
}

main().catch((error: Error) => {
  console.error(error.message)
  process.exit(1)
})
