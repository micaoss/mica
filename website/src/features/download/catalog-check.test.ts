import { describe, expect, it } from 'vitest'
import { checkCatalog } from './catalog-check'

function release(board: string, variant: string, stamp = '20261001-2113') {
  return {
    baseUrl: `https://dl.test/mica/${board}.${variant}/${stamp}/`,
    id: `${board}.${variant}.${stamp}`,
    product: `${board}.${variant}`,
    board,
    variant,
    files: [{ kind: 'image', path: 'f.img.gz', sha256: 'a'.repeat(64), size: 1 }],
  }
}

function manifest(...releases: { product: string, board: string, variant: string }[]) {
  return { products: releases.map(({ product, board, variant }) => ({ product, board, variant })) }
}

describe('checkCatalog', () => {
  it('passes a catalogue the site reads and lists', () => {
    const r = release('mini-x64', 'basic')
    expect(checkCatalog(manifest(r), [r], ['mini-x64'])).toEqual([])
  })

  it('passes a manifest with no products: nothing is published', () => {
    expect(checkCatalog({ products: [] }, [], ['mini-x64'])).toEqual([])
  })

  it('fails when a changed shape leaves every release unparsed', () => {
    const r = release('mini-x64', 'basic', 'nightly')
    expect(checkCatalog(manifest(r), [r], ['mini-x64'])[0]).toContain('none of their releases parses')
  })

  it('names the one product that stopped parsing', () => {
    const good = release('mini-x64', 'basic')
    const bad = release('cx3576', 'full', 'broken')
    expect(checkCatalog(manifest(good, bad), [good, bad], ['mini-x64', 'cx3576']))
      .toEqual(['cx3576.full parses to no downloads'])
  })

  it('fails when a product is published for a board the site has no page for', () => {
    const r = release('rk3588', 'basic')
    expect(checkCatalog(manifest(r), [r], ['mini-x64']))
      .toEqual(['rk3588.basic is published for rk3588, which the site lists no page for'])
  })
})
