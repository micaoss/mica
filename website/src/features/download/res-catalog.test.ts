import type { ResRelease } from './res-catalog'
import { describe, expect, it } from 'vitest'
import { selectVersions } from './catalog'
import { downloadsFromRes } from './res-catalog'

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
  it('tells the images of one release apart by their form', () => {
    const release = {
      ...RELEASE,
      id: 's905x5m.sd-full.20261004-1510',
      board: 's905x5m',
      variant: 'sd-full',
      files: [
        { kind: 'image', form: 'disk', sha256: SHA('a'), size: 1, path: 'mica-s905x5m.sd-full-20261004-1510.img.gz' },
        { kind: 'image', form: 'sd-boot', sha256: SHA('b'), size: 2, path: 'mica-s905x5m.sd-full-20261004-1510.sd-boot.img.gz' },
      ],
    }
    const rows = downloadsFromRes([release])

    expect(rows.map(row => row.variant)).toEqual(['disk', 'sd-boot'])
    // Both are the newest of their own form, so neither hides behind the other.
    expect(selectVersions(rows, false)).toHaveLength(2)
  })

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
