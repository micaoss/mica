import type { ResProduct } from './res-catalog'
import { describe, expect, it } from 'vitest'
import { documentKeys, downloadsFromRes, readCatalogue } from './res-catalog'

const SHA = (c: string) => c.repeat(64)

const PRODUCT: ResProduct = {
  schema: 'mica/res-product/v1',
  product: 'mini-x64.basic',
  board: 'mini-x64',
  variant: 'basic',
  releases: [{
    release: 'mini-x64.basic.20260930-2247',
    stamp: '20260930-2247',
    product: 'mini-x64.basic',
    board: 'mini-x64',
    variant: 'basic',
    version: '20260930-2247',
    generation: 2,
    publishedAt: '2026-09-30T22:59:00.000Z',
    assets: [
      { kind: 'image', path: 'mica/mini-x64.basic/20260930-2247/mica-mini-x64.basic-20260930-2247.img.gz', sha256: SHA('a'), size: 30_000_000, uncompressedSha256: SHA('b'), uncompressedSize: 134_217_728 },
      { kind: 'update', form: 'full', path: 'mica/mini-x64.basic/20260930-2247/mica-mini-x64.basic-20260930-2247.micaupd', sha256: SHA('c'), size: 33_000_000 },
      { kind: 'update', form: 'core', path: 'mica/mini-x64.basic/20260930-2247/mica-mini-x64.basic-20260930-2247.core.micaupd', sha256: SHA('d'), size: 9_000_000 },
    ],
  }],
}

describe('downloadsFromRes', () => {
  it('reads every file of a release, on the download host', () => {
    const rows = downloadsFromRes([PRODUCT])

    expect(rows).toHaveLength(3)
    expect(rows[0]).toEqual({
      board: 'mini-x64',
      profile: 'basic',
      kind: 'image',
      version: '20260930-2247',
      releasedAt: '2026-09-30',
      bytes: 30_000_000,
      uncompressedBytes: 134_217_728,
      digest: `sha256:${SHA('a')}`,
      href: 'https://dl.res.micaos.dev/mica/mini-x64.basic/20260930-2247/mica-mini-x64.basic-20260930-2247.img.gz',
      filename: 'mica-mini-x64.basic-20260930-2247.img.gz',
    })
    expect(rows.map(row => row.variant)).toEqual([undefined, 'full', 'core'])
  })

  it('skips what a row cannot be built from rather than guessing', () => {
    const broken: ResProduct = {
      ...PRODUCT,
      releases: [{
        ...PRODUCT.releases![0]!,
        assets: [
          { kind: 'update', form: 'delta', path: 'mica/x/y/z.micaupd', sha256: SHA('e'), size: 1 },
          { kind: 'image', path: 'mica/x/y/z.img.gz', sha256: 'short', size: 1 },
          { kind: 'manual', path: 'mica/x/y/z.pdf', sha256: SHA('f'), size: 1 },
        ],
      }],
    }
    expect(downloadsFromRes([broken])).toEqual([])
    expect(downloadsFromRes([null, { product: 'x' }])).toEqual([])
  })

  it('dates a release by its stamp when res gives no publication time', () => {
    const { publishedAt: _, ...release } = PRODUCT.releases![0]!
    expect(downloadsFromRes([{ ...PRODUCT, releases: [release] }])[0]?.releasedAt).toBe('2026-09-30')
  })
})

describe('documentKeys', () => {
  it('takes only product documents under catalog/products/', () => {
    expect(documentKeys({
      products: [
        { product: 'a', board: 'a', variant: 'basic', document: 'catalog/products/a.basic.json' },
        { product: 'b', board: 'b', variant: 'basic', document: '../etc/passwd' },
      ],
    })).toEqual(['catalog/products/a.basic.json'])
    expect(documentKeys(null)).toEqual([])
  })
})

describe('readCatalogue', () => {
  const host = (files: Record<string, unknown>): typeof fetch =>
    (async (input: string | URL | Request) => {
      const key = String(input).replace('https://dl.test/', '')
      return key in files
        ? new Response(JSON.stringify(files[key]), { status: 200 })
        : new Response('missing', { status: 404 })
    }) as typeof fetch

  it('reads nothing before the first release is posted', async () => {
    expect(await readCatalogue('https://dl.test', host({}))).toEqual({ directory: null, documents: [] })
  })

  it('reads the directory and each product document it names', async () => {
    const directory = { products: [{ product: 'mini-x64.basic', board: 'mini-x64', variant: 'basic', document: 'catalog/products/mini-x64.basic.json' }] }
    const read = await readCatalogue('https://dl.test', host({ 'catalog/products.json': directory, 'catalog/products/mini-x64.basic.json': PRODUCT }))
    expect(read.documents).toEqual([PRODUCT])
  })

  it('refuses a directory naming a document the host does not serve', async () => {
    const directory = { products: [{ product: 'a', board: 'a', variant: 'basic', document: 'catalog/products/a.json' }] }
    await expect(readCatalogue('https://dl.test', host({ 'catalog/products.json': directory })))
      .rejects
      .toThrow('does not serve')
  })
})
