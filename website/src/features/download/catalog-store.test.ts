import { describe, expect, it } from 'vitest'
import { storedCatalogue } from './catalog-store'

const PRODUCT = {
  product: 'mini-x64.basic',
  board: 'mini-x64',
  variant: 'basic',
  releases: [{
    release: 'mini-x64.basic.20260930-2247',
    stamp: '20260930-2247',
    product: 'mini-x64.basic',
    board: 'mini-x64',
    variant: 'basic',
    assets: [{ kind: 'image', path: 'mica/mini-x64.basic/20260930-2247/a.img.gz', sha256: 'a'.repeat(64), size: 1 }],
  }],
}

describe('storedCatalogue', () => {
  it('records what it read, from where and when', () => {
    const stored = storedCatalogue([PRODUCT], 'https://dl.test/catalog/products.json', '2026-10-01T09:00:00.000Z')

    expect(stored.source).toBe('https://dl.test/catalog/products.json')
    expect(stored.refreshedAt).toBe('2026-10-01T09:00:00.000Z')
    expect(stored.downloads).toHaveLength(1)
  })

  it('publishes an empty catalogue when nothing has been posted', () => {
    expect(storedCatalogue([], 'res', 'now').downloads).toEqual([])
  })

  it('refuses product documents that parse to nothing', () => {
    expect(() => storedCatalogue([{ ...PRODUCT, releases: [{ ...PRODUCT.releases[0], stamp: 'nightly' }] }], 'res', 'now'))
      .toThrow('parsed to no downloads')
  })
})
