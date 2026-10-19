import type { BoardDocument, IndexDocument } from './products-catalog'
import { describe, expect, it } from 'vitest'
import { boardFrom, boardUrl, indexFrom, indexUrl, readBoard, readHistory, readIndex } from './products-catalog'

const SHA = (c: string) => c.repeat(64)
const ROOT = 'https://res.test/update/'

export const INDEX: IndexDocument = {
  schema: 'mica/products/v1',
  boards: [
    { board: 'uefi-x64', title: { zh: 'uefi-x64', en: 'uefi-x64' }, hardware: { zh: '通用 amd64', en: 'Generic amd64' }, status: { zh: 'QEMU 基线', en: 'QEMU baseline' } },
    { board: 's905x5m', title: { zh: 's905x5m', en: 's905x5m' }, hardware: { zh: 'Amlogic S7D', en: 'Amlogic S7D' }, status: { zh: 'bring-up', en: 'Bring-up' } },
  ],
  products: [{
    product: 's905x5m.sd-full',
    kind: 'product',
    board: 's905x5m',
    variant: 'sd-full',
    title: { zh: 'SD 卡，带容器引擎', en: 'SD card, with the container engine' },
    summary: { zh: '', en: '' },
    recommended: true,
    latest: { id: 's905x5m.sd-full.20261004-1510', version: '20261004-1510', generation: 2, publishedAt: '2026-10-04T15:24:21.309Z' },
    releases: 'https://res.test/update/v1/s905x5m.sd-full/releases.json',
  }],
}

export const BOARD: BoardDocument = {
  schema: 'mica/products-board/v1',
  baseUrl: 'https://dl.test/',
  board: 's905x5m',
  title: { zh: 's905x5m', en: 's905x5m' },
  hardware: { zh: 'Amlogic S7D', en: 'Amlogic S7D' },
  status: { zh: 'bring-up', en: 'Bring-up' },
  guides: [
    { title: { zh: '写入镜像', en: 'Writing the image' }, body: { zh: '按板卡写入。', en: 'Board by board.' }, doc: 'start/flashing' },
    { title: { zh: '旧文档', en: 'Old page' }, body: { zh: '', en: '' }, doc: 'start/gone' },
    { title: { zh: '板卡源码', en: 'Board source' }, body: { zh: '', en: '' }, url: 'https://github.com/micaoss/mica-build/tree/main/boards/s905x5m' },
  ],
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
  products: [{
    product: 's905x5m.sd-full',
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
    releases: 'https://res.test/update/v1/s905x5m.sd-full/releases.json',
  }],
}

/** This site publishes every slug but the one the fixture calls gone. */
export const published = (slug: string): boolean => slug !== 'start/gone'

function host(files: Record<string, unknown>): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = String(input)
    return url in files
      ? new Response(JSON.stringify(files[url]), { status: 200 })
      : new Response('missing', { status: 404 })
  }) as typeof fetch
}

describe('readIndex', () => {
  it('reads the index under the update root', async () => {
    expect(indexUrl(ROOT)).toBe('https://res.test/update/products/v1.json')
    expect(await readIndex(ROOT, host({ [indexUrl(ROOT)]: INDEX }))).toEqual(INDEX)
  })

  it('throws when the index does not answer: an address that moved is not "nothing published"', async () => {
    await expect(readIndex(ROOT, host({}))).rejects.toThrow('products/v1.json answered 404')
  })

  it('throws on a document that is not the index', async () => {
    await expect(readIndex(ROOT, host({ [indexUrl(ROOT)]: { schema: 'other' } })))
      .rejects
      .toThrow('carries no boards or no products list')
  })
})

describe('readBoard', () => {
  it('reads one board\'s document', async () => {
    expect(boardUrl(ROOT, 's905x5m')).toBe('https://res.test/update/products/v1/s905x5m.json')
    expect(await readBoard(ROOT, 's905x5m', host({ [boardUrl(ROOT, 's905x5m')]: BOARD }))).toEqual(BOARD)
  })

  it('answers null for a board the catalogue does not list', async () => {
    expect(await readBoard(ROOT, 'ghost', host({}))).toBeNull()
  })

  it('throws on a document that is not a board\'s', async () => {
    await expect(readBoard(ROOT, 's905x5m', host({ [boardUrl(ROOT, 's905x5m')]: { schema: 'other' } })))
      .rejects
      .toThrow('carries no baseUrl or no products list')
  })
})

describe('indexFrom', () => {
  it('carries the boards in the document\'s order and each product with its newest version', () => {
    const index = indexFrom(INDEX, 'src', '2026-10-12T09:00:00.000Z')

    expect(index.version).toBe(1)
    expect(index.boards.map(board => board.board)).toEqual(['uefi-x64', 's905x5m'])
    expect(index.products).toEqual([{
      product: 's905x5m.sd-full',
      kind: 'product',
      board: 's905x5m',
      variant: 'sd-full',
      title: { zh: 'SD 卡，带容器引擎', en: 'SD card, with the container engine' },
      summary: { zh: '', en: '' },
      recommended: true,
      releases: 'https://res.test/update/v1/s905x5m.sd-full/releases.json',
      latest: { version: '20261004-1510', publishedAt: '2026-10-04T15:24:21.309Z' },
    }])
  })

  it('keeps a product that has no release, without a newest version', () => {
    const { latest: _, ...unreleased } = INDEX.products![0]

    expect(indexFrom({ ...INDEX, products: [unreleased] }, 'src', 'now').products[0].latest).toBeNull()
  })
})

describe('boardFrom', () => {
  it('lists the files of each product\'s newest release, linked under the document\'s baseUrl', () => {
    const catalogue = boardFrom('s905x5m', BOARD, published, 'src', '2026-10-12T09:00:00.000Z')

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

  it('carries the words, the board and each product without its files', () => {
    const catalogue = boardFrom('s905x5m', BOARD, published, 'src', 'now')

    expect(catalogue.categories).toEqual(BOARD.categories)
    expect(catalogue.fileTypes).toEqual(BOARD.fileTypes)
    expect(catalogue.boards).toEqual([{ board: 's905x5m', title: BOARD.title, hardware: BOARD.hardware, status: BOARD.status }])
    expect(catalogue.products[0]).toMatchObject({ product: 's905x5m.sd-full', board: 's905x5m', variant: 'sd-full', recommended: true })
    expect(catalogue.products[0]).not.toHaveProperty('latest')
  })

  it('shows a guide to a document this site publishes or to an outside target, and names the stale one', () => {
    const catalogue = boardFrom('s905x5m', BOARD, published, 'src', 'now')

    expect(catalogue.guides.map(guide => guide.doc ?? guide.url)).toEqual(['start/flashing', 'https://github.com/micaoss/mica-build/tree/main/boards/s905x5m'])
    expect(catalogue.staleGuides).toEqual(['start/gone'])
  })

  it('leaves out a guide whose outside target is not an https address', () => {
    const guide = (url: string) => ({ title: { zh: 'x', en: 'x' }, body: { zh: '', en: '' }, url })

    const hostile = ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'http://example.invalid/', '//example.invalid/', 'not a url']
    const catalogue = boardFrom('s905x5m', { ...BOARD, guides: [...hostile.map(guide), guide('https://example.invalid/ok')] }, published, 'src', 'now')

    expect(catalogue.guides.map(entry => entry.url)).toEqual(['https://example.invalid/ok'])
  })

  it('is an honest empty catalogue for a board with no release: its guides stand', () => {
    const catalogue = boardFrom('uefi-x64', { ...BOARD, products: [] }, published, 'src', 'now')

    expect(catalogue.downloads).toEqual([])
    expect(catalogue.guides).toHaveLength(2)
  })

  it('refuses files that parse to nothing', () => {
    const broken = { ...BOARD, products: [{ ...BOARD.products![0], latest: { ...BOARD.products![0].latest!, id: 's905x5m.sd-full.nightly' } }] }

    expect(() => boardFrom('s905x5m', broken, published, 'src', 'now')).toThrow('parsed to no downloads')
  })
})

describe('readHistory', () => {
  const RELEASES = 'https://res.test/update/v1/s905x5m.emmc-full/releases.json'
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
