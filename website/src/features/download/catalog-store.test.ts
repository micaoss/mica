import { describe, expect, it } from 'vitest'
import { storedCatalogue } from './catalog-store'

const RELEASE = {
  baseUrl: 'https://dl.test/mica/mini-x64.basic/20261001-2113/',
  id: 'mini-x64.basic.20261001-2113',
  product: 'mini-x64.basic',
  board: 'mini-x64',
  variant: 'basic',
  files: [{ kind: 'image', path: 'a.img.gz', sha256: 'a'.repeat(64), size: 1 }],
}

describe('storedCatalogue', () => {
  it('records what it read, from where and when', () => {
    const stored = storedCatalogue([RELEASE], 'https://res.test/update/v2/manifest.json', '2026-10-03T09:00:00.000Z')

    expect(stored.source).toBe('https://res.test/update/v2/manifest.json')
    expect(stored.refreshedAt).toBe('2026-10-03T09:00:00.000Z')
    expect(stored.downloads).toHaveLength(1)
  })

  it('publishes an empty catalogue when no release is published', () => {
    expect(storedCatalogue([], 'res', 'now').downloads).toEqual([])
  })

  it('refuses releases that parse to nothing', () => {
    expect(() => storedCatalogue([{ ...RELEASE, id: 'mini-x64.basic.nightly' }], 'res', 'now'))
      .toThrow('parsed to no downloads')
  })
})
