import type { ProductsDocument } from './products-catalog'
import { describe, expect, it } from 'vitest'
import { checkCatalog } from './catalog-check'
import { catalogueFrom } from './products-catalog'

function product(board: string, variant: string, stamp = '20261001-2113') {
  return {
    product: `${board}.${variant}`,
    board,
    variant,
    title: { zh: '', en: '' },
    summary: { zh: '', en: '' },
    recommended: false,
    latest: { id: `${board}.${variant}.${stamp}`, files: [{ kind: 'image', form: 'disk', path: `mica/${board}.${variant}/f.img.gz`, sha256: 'a'.repeat(64), size: 1 }] },
    releases: `https://res.test/update/v2/${board}.${variant}/releases.json`,
  }
}

function check(products: ReturnType<typeof product>[], siteBoards: string[], listed: string[] = siteBoards): string[] {
  const title = { zh: '', en: '' }
  const boards = [...new Set(products.map(entry => entry.board)), ...listed].map(board => ({ board, title, hardware: title, status: title }))
  const document: ProductsDocument = { baseUrl: 'https://dl.test/', boards, products }
  return checkCatalog(document, catalogueFrom(document, 'src', 'now').downloads, siteBoards)
}

describe('checkCatalog', () => {
  it('passes a catalogue the site reads and has pages for', () => {
    expect(check([product('mini-x64', 'basic')], ['mini-x64'])).toEqual([])
  })

  it('passes a catalogue with no products: nothing is published', () => {
    expect(check([], ['mini-x64'])).toEqual([])
  })

  it('names the one product that stopped parsing', () => {
    expect(check([product('mini-x64', 'basic'), product('cx3576', 'full', 'broken')], ['mini-x64', 'cx3576']))
      .toEqual(['cx3576.full parses to no downloads'])
  })

  it('fails when a product is published for a board the site has no page for', () => {
    expect(check([product('rk3588', 'basic')], ['mini-x64']))
      .toEqual(['rk3588.basic is published for rk3588, which the site lists no page for'])
  })

  it('names a board the site has a page for and the catalogue does not list', () => {
    expect(check([], ['mini-x64', 'uefi-x64'], ['mini-x64']))
      .toEqual(['uefi-x64 has a page on the site and is not listed in the catalogue'])
  })
})
