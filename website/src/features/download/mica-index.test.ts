import type { MicaIndex } from './mica-index'
import { describe, expect, it } from 'vitest'
import { downloadsFromIndex } from './mica-index'

const INDEX: MicaIndex = {
  schema: 'mica/index/v1',
  version: '20260915-2242',
  products: [{
    product: 'cx3576-dev',
    board: 'cx3576',
    profile: 'dev',
    deployment: 'de65d831b92b752c543779c6d010e4c8fae0611841130d32cc6429eba0882411',
    release: 'cx3576/20260915-2230',
    images: [{
      kind: 'disk',
      file: 'mica-cx3576-dev-20260915-2230.img.gz',
      url: 'https://github.com/micaoss/mica-build/releases/download/cx3576/20260915-2230/mica-cx3576-dev-20260915-2230.img.gz',
      sha256: '4d597e02002ba7f8cd0d5702d2daf10d97f553a7fcf62ac15a8aae07553a6ad8',
      size: 86_480_127,
      compression: 'gzip',
      uncompressedSize: 1_362_100_224,
    }],
    updates: [
      { kind: 'full', file: 'a.micaupd', url: 'https://example.invalid/a', sha256: 'aa', size: 10 },
      { kind: 'kernel', file: 'b.kernel.micaupd', url: 'https://example.invalid/b', sha256: 'bb', size: 20 },
      { kind: 'root', file: 'c.root.micaupd', url: 'https://example.invalid/c', sha256: 'cc', size: 30 },
    ],
  }],
}

describe('downloadsFromIndex', () => {
  it('reads an image with its compressed and uncompressed sizes', () => {
    const [image] = downloadsFromIndex(INDEX)

    expect(image).toMatchObject({
      board: 'cx3576',
      profile: 'dev',
      kind: 'image',
      version: '20260915-2230',
      releasedAt: '2026-09-15',
      bytes: 86_480_127,
      uncompressedBytes: 1_362_100_224,
      filename: 'mica-cx3576-dev-20260915-2230.img.gz',
    })
    expect(image.digest).toMatch(/^sha256:4d597e/)
    expect(image.deploymentId).toMatch(/^de65d831/)
  })

  it('keeps each update archive as its own variant', () => {
    const updates = downloadsFromIndex(INDEX).filter(entry => entry.kind === 'update')

    expect(updates.map(entry => entry.variant)).toEqual(['full', 'kernel', 'root'])
  })

  it('skips an update archive whose kind it does not know', () => {
    const updates = downloadsFromIndex({
      products: [{ ...INDEX.products![0], updates: [{ kind: 'partial', file: 'x', url: 'y', sha256: 'z', size: 1 }] }],
    }).filter(entry => entry.kind === 'update')

    expect(updates).toEqual([])
  })

  it('skips an asset missing a field it should carry', () => {
    const entries = downloadsFromIndex({
      products: [{
        ...INDEX.products![0],
        images: [{ kind: 'disk', file: '', url: 'u', sha256: 's', size: 1 }],
        updates: [],
      }],
    })

    expect(entries).toEqual([])
  })

  it('skips a product whose release stamp is not a date it can read', () => {
    expect(downloadsFromIndex({
      products: [{ ...INDEX.products![0], release: 'cx3576/nightly' }],
    })).toEqual([])
  })

  it('answers empty for anything that is not an index', () => {
    for (const input of [null, undefined, 42, {}, { products: 'no' }])
      expect(downloadsFromIndex(input)).toEqual([])
  })
})

describe('the real index', () => {
  it('reads the shape mica-build publishes', async () => {
    // A copy of what mica/20260915-2242 answered, trimmed to one product.
    const index = {
      schema: 'mica/index/v1',
      products: [{
        product: 'x64-dev',
        board: 'x64',
        profile: 'dev',
        generation: 4,
        deployment: 'abc',
        kernel: 'k',
        rootfs: 'r',
        release: 'x64/20260915-2230',
        bundles: { image: 'ghcr.io/…', update: 'ghcr.io/…' },
        images: [{ kind: 'disk', file: 'f.img.gz', url: 'https://u', sha256: 's', size: 1, compression: 'gzip', uncompressedSha256: 'u', uncompressedSize: 2 }],
        updates: [{ kind: 'full', file: 'f.micaupd', url: 'https://u2', sha256: 's2', size: 3, requires: { generationBelow: 4 } }],
      }],
      catalogue: { boards: [], products: [] },
    }

    expect(downloadsFromIndex(index).map(entry => [entry.kind, entry.variant])).toEqual([
      ['image', undefined],
      ['update', 'full'],
    ])
  })
})
