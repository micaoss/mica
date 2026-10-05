import type { ProductsDocument } from './products-catalog'
import { describe, expect, it } from 'vitest'
import { catalogueFrom, productsUrl, readHistory, readProducts } from './products-catalog'

const SHA = (c: string) => c.repeat(64)
const ROOT = 'https://res.test/update/'

export const DOCUMENT: ProductsDocument = {
  schema: 'mica/products/v1',
  baseUrl: 'https://dl.test/',
  categories: [
    { id: 'image', title: { zh: '系统镜像', en: 'System image' } },
    { id: 'bootloader', title: { zh: '引导加载器', en: 'Boot loader' } },
    { id: 'update', title: { zh: '升级包', en: 'Update package' } },
  ],
  fileTypes: [
    { kind: 'image', form: 'disk', category: 'image', title: { zh: '整盘镜像', en: 'whole disk' } },
    { kind: 'image', form: 'sd-boot', category: 'bootloader', title: { zh: 'SD 卡引导镜像', en: 'SD card boot loader' } },
    { kind: 'update', form: 'full', category: 'update', title: { zh: '完整', en: 'full' } },
  ],
  boards: [
    { board: 'uefi-x64', title: { zh: 'uefi-x64', en: 'uefi-x64' }, hardware: { zh: '通用 amd64', en: 'Generic amd64' }, status: { zh: 'QEMU 基线', en: 'QEMU baseline' } },
    { board: 's905x5m', title: { zh: 's905x5m', en: 's905x5m' }, hardware: { zh: 'Amlogic S7D', en: 'Amlogic S7D' }, status: { zh: 'bring-up', en: 'Bring-up' } },
  ],
  products: [{
    product: 's905x5m.sd-full',
    board: 's905x5m',
    variant: 'sd-full',
    title: { zh: 'SD 卡，带容器引擎', en: 'SD card, with the container engine' },
    summary: { zh: '', en: '' },
    recommended: true,
    latest: {
      id: 's905x5m.sd-full.20261004-1510',
      version: '20261004-1510',
      generation: 2,
      publishedAt: '2026-10-04T15:24:21.309Z',
      files: [
        { kind: 'image', form: 'disk', path: 'mica/s905x5m.sd-full/20261004-1510/mica-s905x5m.sd-full-20261004-1510.img.gz', size: 92155861, sha256: SHA('a'), uncompressedSize: 1_500_000_000 },
        { kind: 'image', form: 'sd-boot', path: 'mica/s905x5m.sd-full/20261004-1510/mica-s905x5m.sd-full-20261004-1510.sd-boot.img.gz', size: 6662946, sha256: SHA('b') },
        { kind: 'update', form: 'full', path: 'mica/s905x5m.sd-full/20261004-1510/mica-s905x5m.sd-full-20261004-1510.micaupd', size: 90956281, sha256: SHA('c') },
      ],
    },
    releases: 'https://res.test/update/v2/s905x5m.sd-full/releases.json',
  }],
}

function host(files: Record<string, unknown>): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = String(input)
    return url in files
      ? new Response(JSON.stringify(files[url]), { status: 200 })
      : new Response('missing', { status: 404 })
  }) as typeof fetch
}

describe('readProducts', () => {
  it('reads the one document under the update root', async () => {
    expect(productsUrl(ROOT)).toBe('https://res.test/update/products/v1.json')
    expect(await readProducts(ROOT, host({ [productsUrl(ROOT)]: DOCUMENT }))).toEqual(DOCUMENT)
  })

  it('throws when the document does not answer: an address that moved is not "nothing published"', async () => {
    await expect(readProducts(ROOT, host({}))).rejects.toThrow('products/v1.json answered 404')
  })

  it('throws on a document that is not the catalogue', async () => {
    await expect(readProducts(ROOT, host({ [productsUrl(ROOT)]: { schema: 'other' } })))
      .rejects
      .toThrow('carries no baseUrl or no products list')
  })
})

describe('catalogueFrom', () => {
  it('lists the files of each product\'s newest release, linked under the document\'s baseUrl', () => {
    const catalogue = catalogueFrom(DOCUMENT, 'src', '2026-10-05T09:00:00.000Z')

    expect(catalogue.version).toBe(2)
    expect(catalogue.refreshedAt).toBe('2026-10-05T09:00:00.000Z')
    expect(catalogue.downloads.map(row => [row.board, row.profile, row.kind, row.variant, row.version])).toEqual([
      ['s905x5m', 'sd-full', 'image', 'disk', '20261004-1510'],
      ['s905x5m', 'sd-full', 'image', 'sd-boot', '20261004-1510'],
      ['s905x5m', 'sd-full', 'update', 'full', '20261004-1510'],
    ])
    expect(catalogue.downloads[0]).toMatchObject({
      href: 'https://dl.test/mica/s905x5m.sd-full/20261004-1510/mica-s905x5m.sd-full-20261004-1510.img.gz',
      filename: 'mica-s905x5m.sd-full-20261004-1510.img.gz',
      releasedAt: '2026-10-04',
      bytes: 92155861,
      uncompressedBytes: 1_500_000_000,
    })
  })

  it('carries the words as the document states them, and a product without its files', () => {
    const catalogue = catalogueFrom(DOCUMENT, 'src', 'now')

    expect(catalogue.categories).toEqual(DOCUMENT.categories)
    expect(catalogue.fileTypes).toEqual(DOCUMENT.fileTypes)
    expect(catalogue.boards).toEqual(DOCUMENT.boards)
    expect(catalogue.products).toEqual([{
      product: 's905x5m.sd-full',
      board: 's905x5m',
      variant: 'sd-full',
      title: { zh: 'SD 卡，带容器引擎', en: 'SD card, with the container engine' },
      summary: { zh: '', en: '' },
      recommended: true,
      releases: 'https://res.test/update/v2/s905x5m.sd-full/releases.json',
    }])
  })

  it('is an honest empty catalogue when no product is listed', () => {
    expect(catalogueFrom({ baseUrl: 'https://dl.test/', products: [] }, 'src', 'now').downloads).toEqual([])
  })

  it('refuses files that parse to nothing', () => {
    const broken = { ...DOCUMENT, products: [{ ...DOCUMENT.products![0], latest: { ...DOCUMENT.products![0].latest!, id: 's905x5m.sd-full.nightly' } }] }

    expect(() => catalogueFrom(broken, 'src', 'now')).toThrow('parsed to no downloads')
  })
})

describe('readHistory', () => {
  const RELEASES = 'https://res.test/update/v2/s905x5m.emmc-full/releases.json'
  const release = (stamp: string, form: string) => ({
    baseUrl: `https://dl.test/mica/s905x5m.emmc-full/${stamp}/`,
    id: `s905x5m.emmc-full.${stamp}`,
    product: 's905x5m.emmc-full',
    board: 's905x5m',
    variant: 'emmc-full',
    files: [{ kind: 'image', form, path: `f-${stamp}.img.gz`, sha256: SHA('a'), size: 1 }],
  })

  it('reads every release the product\'s history names', async () => {
    const rows = await readHistory(RELEASES, host({
      [RELEASES]: { baseUrl: 'https://dl.test/mica/', releases: [{ id: 'new', path: 'new/index.json' }, { id: 'old', path: 'old/index.json' }] },
      'https://dl.test/mica/new/index.json': release('20261004-1511', 'usb-burn'),
      'https://dl.test/mica/old/index.json': release('20261003-1942', 'disk'),
    }))

    expect(rows.map(row => [row.version, row.variant])).toEqual([['20261004-1511', 'usb-burn'], ['20261003-1942', 'disk']])
  })

  it('throws when the history does not answer', async () => {
    await expect(readHistory(RELEASES, host({}))).rejects.toThrow('answered 404')
  })
})
