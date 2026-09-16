import { describe, expect, it } from 'vitest'
import { checkIndex } from './index-check'

function product(board: string, release: string) {
  return {
    product: `${board}-dev`,
    board,
    profile: 'dev',
    deployment: 'd',
    release,
    images: [{ kind: 'disk', file: `mica-${board}-dev.img.gz`, url: `https://u/${board}`, sha256: 's', size: 1 }],
    updates: [],
  }
}

describe('checkIndex', () => {
  it('passes an index the site reads and lists', () => {
    const index = {
      products: [product('uefi-x64', 'uefi-x64.20260916-0845')],
      catalogue: { boards: [{ board: 'uefi-x64', releaseTarget: true }] },
    }
    expect(checkIndex(index, ['uefi-x64'])).toEqual([])
  })

  it('fails when a changed release form leaves every product unparsed', () => {
    const index = { products: [product('uefi-x64', 'uefi-x64@nightly')] }
    const problems = checkIndex(index, ['uefi-x64'])

    expect(problems[0]).toContain('none of them parses')
  })

  it('names the one product that stopped parsing', () => {
    const index = {
      products: [
        product('uefi-x64', 'uefi-x64.20260916-0845'),
        product('cx3576', 'cx3576@broken'),
      ],
    }
    expect(checkIndex(index, ['uefi-x64', 'cx3576'])).toEqual([
      'cx3576-dev (cx3576@broken) parses to no downloads',
    ])
  })

  it('fails when upstream renames a release-target board the site still lists by its old name', () => {
    const index = {
      products: [product('uefi-x64', 'uefi-x64.20260916-0845')],
      catalogue: { boards: [{ board: 'uefi-x64', releaseTarget: true }] },
    }
    expect(checkIndex(index, ['x64'])).toEqual([
      'uefi-x64 is a release target upstream but the site lists no such board',
    ])
  })

  it('does not ask the site to list a board that is not a release target', () => {
    const index = {
      products: [product('uefi-x64', 'uefi-x64.20260916-0845')],
      catalogue: { boards: [{ board: 'uefi-x64', releaseTarget: true }, { board: 'lab-board', releaseTarget: false }] },
    }
    expect(checkIndex(index, ['uefi-x64'])).toEqual([])
  })

  it('fails on an index with no products at all', () => {
    expect(checkIndex({ products: [] }, [])).toEqual(['the index names no products'])
    expect(checkIndex(null, [])).toEqual(['the index names no products'])
  })
})
