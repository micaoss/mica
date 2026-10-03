import type { ResRelease } from './res-catalog'
import { describe, expect, it } from 'vitest'
import { downloadsFromRes, readCatalogue } from './res-catalog'

const SHA = (c: string) => c.repeat(64)

const RELEASE: ResRelease = {
  schema: 'mica/release/v1',
  baseUrl: 'https://dl.test/mica/mini-x64.basic/20261001-2113/',
  id: 'mini-x64.basic.20261001-2113',
  product: 'mini-x64.basic',
  board: 'mini-x64',
  variant: 'basic',
  version: 'basic-20261001-2113',
  generation: 2,
  publishedAt: '2026-10-02T11:06:39.623Z',
  files: [
    { kind: 'image', sha256: SHA('a'), size: 30_000_000, uncompressedSha256: SHA('b'), uncompressedSize: 134_217_728, path: 'mica-mini-x64.basic-20261001-2113.img.gz' },
    { kind: 'update', form: 'full', sha256: SHA('c'), size: 33_000_000, path: 'mica-mini-x64.basic-20261001-2113.micaupd' },
    { kind: 'update', form: 'core', sha256: SHA('d'), size: 9_000_000, path: 'mica-mini-x64.basic-20261001-2113.core.micaupd' },
  ],
}

describe('downloadsFromRes', () => {
  it('reads every file of a release, under the release\'s own baseUrl', () => {
    const rows = downloadsFromRes([RELEASE])

    expect(rows).toHaveLength(3)
    expect(rows[0]).toEqual({
      board: 'mini-x64',
      profile: 'basic',
      kind: 'image',
      version: '20261001-2113',
      releasedAt: '2026-10-02',
      bytes: 30_000_000,
      uncompressedBytes: 134_217_728,
      digest: `sha256:${SHA('a')}`,
      href: 'https://dl.test/mica/mini-x64.basic/20261001-2113/mica-mini-x64.basic-20261001-2113.img.gz',
      filename: 'mica-mini-x64.basic-20261001-2113.img.gz',
    })
    expect(rows.map(row => row.variant)).toEqual([undefined, 'full', 'core'])
  })

  it('skips what a row cannot be built from rather than guessing', () => {
    const broken: ResRelease = {
      ...RELEASE,
      files: [
        { kind: 'update', form: 'delta', path: 'z.micaupd', sha256: SHA('e'), size: 1 },
        { kind: 'image', path: 'z.img.gz', sha256: 'short', size: 1 },
        { kind: 'manual', path: 'z.pdf', sha256: SHA('f'), size: 1 },
      ],
    }
    expect(downloadsFromRes([broken])).toEqual([])
    expect(downloadsFromRes([null, { id: 'x' }, { ...RELEASE, id: 'mini-x64.basic.nightly' }])).toEqual([])
  })

  it('dates a release by its stamp when res gives no publication time', () => {
    const { publishedAt: _, ...release } = RELEASE
    expect(downloadsFromRes([release])[0]?.releasedAt).toBe('2026-10-01')
  })
})

describe('readCatalogue', () => {
  const host = (files: Record<string, unknown>): typeof fetch =>
    (async (input: string | URL | Request) => {
      const url = String(input)
      return url in files
        ? new Response(JSON.stringify(files[url]), { status: 200 })
        : new Response('missing', { status: 404 })
    }) as typeof fetch

  const ROOT = 'https://res.test/update/'
  const manifest = {
    schema: 'mica/catalog/v2',
    baseUrl: 'https://dl.test/',
    products: [{ product: 'mini-x64.basic', board: 'mini-x64', variant: 'basic', latest: { id: RELEASE.id, path: 'mica/mini-x64.basic/20261001-2113/index.json' } }],
  }
  const history = { schema: 'mica/releases/v1', baseUrl: 'https://dl.test/mica/', product: 'mini-x64.basic', releases: [{ id: RELEASE.id, path: 'mini-x64.basic/20261001-2113/index.json' }] }

  it('reads a manifest with no products as nothing published', async () => {
    const empty = { schema: 'mica/catalog/v2', baseUrl: 'https://dl.test/', products: [] }
    expect(await readCatalogue(ROOT, host({ [`${ROOT}v2/manifest.json`]: empty }))).toEqual({ manifest: empty, releases: [] })
  })

  it('reads the manifest, each product\'s history and each release document', async () => {
    const read = await readCatalogue(ROOT, host({
      [`${ROOT}v2/manifest.json`]: manifest,
      [`${ROOT}v2/mini-x64.basic/releases.json`]: history,
      'https://dl.test/mica/mini-x64.basic/20261001-2113/index.json': RELEASE,
    }))
    expect(read.releases).toEqual([RELEASE])
  })

  it('fails when the manifest is not where it is read: an address that moved is not an empty catalogue', async () => {
    await expect(readCatalogue(ROOT, host({}))).rejects.toThrow('v2/manifest.json answered 404')
  })

  it('fails when a release the history names has no document', async () => {
    await expect(readCatalogue(ROOT, host({
      [`${ROOT}v2/manifest.json`]: manifest,
      [`${ROOT}v2/mini-x64.basic/releases.json`]: history,
    }))).rejects.toThrow('index.json answered 404')
  })
})
