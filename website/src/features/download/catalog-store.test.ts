import { describe, expect, it } from 'vitest'
import { storedCatalogue } from './catalog-store'

const INDEX = {
  products: [{
    product: 'uefi-x64-dev',
    board: 'uefi-x64',
    profile: 'dev',
    deployment: 'd',
    release: 'uefi-x64.20260916-0845',
    images: [{ kind: 'disk', file: 'a.img.gz', url: 'https://u/a', sha256: 's', size: 1 }],
    updates: [],
  }],
}

describe('storedCatalogue', () => {
  it('records what it read and when', () => {
    const stored = storedCatalogue(INDEX, 'mica.20260916-1709', '2026-09-20T09:00:00.000Z')

    expect(stored.latestRelease).toBe('mica.20260916-1709')
    expect(stored.refreshedAt).toBe('2026-09-20T09:00:00.000Z')
    expect(stored.downloads).toHaveLength(1)
  })

  it('refuses to publish an index that parses to nothing', () => {
    expect(() => storedCatalogue({ products: [{ ...INDEX.products[0], release: 'nightly' }] }, 'mica.x', 'now'))
      .toThrow('parsed to no downloads')
    expect(() => storedCatalogue({ products: [] }, 'mica.x', 'now')).toThrow('parsed to no downloads')
  })
})
