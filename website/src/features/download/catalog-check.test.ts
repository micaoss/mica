import { describe, expect, it } from 'vitest'
import { checkCatalog } from './catalog-check'

function product(board: string, variant: string, stamp = '20260930-2247') {
  return {
    product: `${board}.${variant}`,
    board,
    variant,
    releases: [{
      release: `${board}.${variant}.${stamp}`,
      stamp,
      product: `${board}.${variant}`,
      board,
      variant,
      assets: [{ kind: 'image', path: `mica/${board}.${variant}/${stamp}/f.img.gz`, sha256: 'a'.repeat(64), size: 1 }],
    }],
  }
}

function directory(...products: { product: string, board: string, variant: string }[]) {
  return { products: products.map(p => ({ ...p, document: `catalog/products/${p.product}.json` })) }
}

describe('checkCatalog', () => {
  it('passes a catalogue the site reads and lists', () => {
    const p = product('mini-x64', 'basic')
    expect(checkCatalog(directory(p), [p], ['mini-x64'])).toEqual([])
  })

  it('passes an empty catalogue: nothing has been posted yet', () => {
    expect(checkCatalog(null, [], ['mini-x64'])).toEqual([])
    expect(checkCatalog({ products: [] }, [], ['mini-x64'])).toEqual([])
  })

  it('fails when a changed shape leaves every product unparsed', () => {
    const p = product('mini-x64', 'basic', 'nightly')
    expect(checkCatalog(directory(p), [p], ['mini-x64'])[0]).toContain('none of them parses')
  })

  it('names the one product that stopped parsing', () => {
    const good = product('mini-x64', 'basic')
    const bad = product('cx3576', 'full', 'broken')
    expect(checkCatalog(directory(good, bad), [good, bad], ['mini-x64', 'cx3576']))
      .toEqual(['cx3576.full parses to no downloads'])
  })

  it('fails when a product is published for a board the site has no page for', () => {
    const p = product('rk3588', 'basic')
    expect(checkCatalog(directory(p), [p], ['mini-x64']))
      .toEqual(['rk3588.basic is published for rk3588, which the site lists no page for'])
  })
})
