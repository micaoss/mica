import type { BoardDocument, IndexDocument } from '../src/features/download/products-catalog'
import type { CatalogueCache, Deps } from './index'
import { describe, expect, it, vi } from 'vitest'
import { handle } from './index'

const ROOT = 'https://res.test/update/'
const FILE = { kind: 'image', form: 'disk', path: 'mica/mini-x64.basic/20261001-2113/a.img.gz', sha256: 'a'.repeat(64), size: 1 }
const WORDS = { zh: '小型 amd64', en: 'Small amd64' }

/** The index: the boards given, one product on the first. */
function index(...boards: string[]): IndexDocument {
  const [first = 'mini-x64'] = boards
  return {
    schema: 'mica/products/v1',
    boards: boards.map(board => ({ board, title: { zh: board, en: board }, hardware: WORDS, status: { zh: 'QEMU', en: 'QEMU' } })),
    products: [{
      product: `${first}.basic`,
      kind: 'product',
      board: first,
      variant: 'basic',
      title: { zh: '基础系统', en: 'base system' },
      summary: { zh: '', en: '' },
      recommended: false,
      latest: { id: `${first}.basic.20261001-2113`, version: '20261001-2113', publishedAt: '2026-10-01T21:13:00.000Z' },
      releases: `https://res.test/update/v1/${first}.basic/releases.json`,
    }],
  }
}

/** One board's document: one product with its newest release, and its guides. */
function board(name = 'mini-x64', files: unknown[] = [FILE], guides: BoardDocument['guides'] = []): BoardDocument {
  return {
    schema: 'mica/products-board/v1',
    baseUrl: 'https://dl.test/',
    board: name,
    title: { zh: name, en: name },
    hardware: WORDS,
    status: { zh: 'QEMU', en: 'QEMU' },
    guides,
    categories: [{ id: 'image', title: { zh: '系统镜像', en: 'System image' } }],
    fileTypes: [{ kind: 'image', form: 'disk', category: 'image', title: { zh: '整盘镜像', en: 'whole disk' } }],
    products: [{
      product: `${name}.basic`,
      variant: 'basic',
      title: { zh: '基础系统', en: 'base system' },
      summary: { zh: '', en: '' },
      recommended: false,
      latest: { id: `${name}.basic.20261001-2113`, version: '20261001-2113', publishedAt: '2026-10-01T21:13:00.000Z', files: files as never },
      releases: `https://res.test/update/v1/${name}.basic/releases.json`,
    }],
  }
}

/** An in-memory cache with the two calls the Worker makes. */
function fakeCache() {
  const store = new Map<string, Response>()
  const cache: CatalogueCache = {
    async match(key) {
      return store.get(key)?.clone()
    },
    async put(key, response) {
      store.set(key, response)
    },
  }
  return { cache, store }
}

/** What the resource service answers. */
function res(answers: { index?: IndexDocument | Error, board?: BoardDocument | null | Error } = {}) {
  const give = <T>(value: T | Error) => async () => {
    if (value instanceof Error)
      throw value
    return value
  }
  return {
    readIndex: vi.fn(give(answers.index ?? index('mini-x64'))),
    readBoard: vi.fn(give(answers.board === undefined ? board() : answers.board)),
  }
}

type Reads = ReturnType<typeof res>

async function get(reads: Reads, cache: CatalogueCache, path = '/api/catalog', env: { CATALOG_DEMO?: string, ASSETS?: Deps extends never ? never : { fetch: (request: Request) => Promise<Response> } } = {}, rewriter?: () => never, headers: Record<string, string> = {}) {
  const pending: Promise<unknown>[] = []
  const response = await handle(
    new Request(`https://micaos.dev${path}`, { headers }),
    { CATALOG_ROOT: ROOT, ...env },
    { waitUntil: promise => void pending.push(promise) },
    { ...reads, cache, rewriter } as unknown as Deps,
  )
  await Promise.all(pending)
  return response
}

interface Status { trigger: string, lastError: { message: string } | null }
interface IndexBody { version: number, boards: { board: string }[], products: { product: string, latest: { version: string } | null }[], source: string, status: Status, refreshing?: boolean }
interface BoardBody { version: number, board: string, downloads: { board: string, href: string }[], products: { product: string }[], fileTypes: unknown[], guides: { doc?: string, url?: string }[], source: string, refreshedAt: string | null, status: Status, refreshing?: boolean, sample?: boolean }

const FRESH = 'https://micaos.dev/api/catalog/v1/board/mini-x64/fresh'
const LAST_GOOD = 'https://micaos.dev/api/catalog/v1/board/mini-x64/last-good'

describe('gET /api/catalog', () => {
  it('answers the index: the catalogue\'s boards and products, without files', async () => {
    const reads = res({ index: index('uefi-x64', 'mini-x64') })
    const body = await (await get(reads, fakeCache().cache)).json() as IndexBody

    expect(reads.readIndex).toHaveBeenCalledWith(ROOT)
    expect(reads.readBoard).not.toHaveBeenCalled()
    expect(body.version).toBe(1)
    expect(body.boards.map(entry => entry.board)).toEqual(['uefi-x64', 'mini-x64'])
    expect(body.products).toEqual([expect.objectContaining({ product: 'uefi-x64.basic', latest: { version: '20261001-2113', publishedAt: '2026-10-01T21:13:00.000Z' } })])
    expect(body.source).toBe(`${ROOT}products/v1.json`)
    expect(body.status.lastError).toBeNull()
  })

  it('reads the index once while its answer is cached', async () => {
    const reads = res()
    const { cache } = fakeCache()

    await get(reads, cache)
    await get(reads, cache, '/api/catalog?v=abc')

    expect(reads.readIndex).toHaveBeenCalledTimes(1)
  })

  it('answers an empty index and the error when nothing was ever read', async () => {
    const body = await (await get(res({ index: new Error('unreachable') }), fakeCache().cache)).json() as IndexBody

    expect(body.boards).toEqual([])
    expect(body.status.lastError?.message).toBe('unreachable')
  })
})

describe('gET /api/catalog/<board>', () => {
  it('answers one board: its rows, their words and where it read them', async () => {
    const reads = res()
    const response = await get(reads, fakeCache().cache, '/api/catalog/mini-x64')
    const body = await response.json() as BoardBody

    expect(response.status).toBe(200)
    expect(reads.readBoard).toHaveBeenCalledWith(ROOT, 'mini-x64')
    expect(reads.readIndex).not.toHaveBeenCalled()
    expect(body.board).toBe('mini-x64')
    expect(body.downloads).toHaveLength(1)
    expect(body.fileTypes).toHaveLength(1)
    expect(body.products[0]).not.toHaveProperty('latest')
    expect(body.source).toBe(`${ROOT}products/v1/mini-x64.json`)
    expect(body.status.trigger).toBe('request')
    expect(body.status.lastError).toBeNull()
  })

  it('reads the resource service once while its answer is cached, for ten minutes, each board on its own', async () => {
    const reads = res()
    const { cache, store } = fakeCache()

    await get(reads, cache, '/api/catalog/mini-x64')
    await get(reads, cache, '/api/catalog/mini-x64?v=abc')
    expect(reads.readBoard).toHaveBeenCalledTimes(1)
    expect(store.get(FRESH)?.headers.get('cache-control')).toBe('public, max-age=600')

    await get(reads, cache, '/api/catalog/uefi-x64')
    expect(reads.readBoard).toHaveBeenCalledTimes(2)
  })

  it('answers the last good catalogue at once when the ten minutes are over, and reads again behind it', async () => {
    const { cache, store } = fakeCache()
    await get(res(), cache, '/api/catalog/mini-x64')
    store.delete(FRESH)

    const reads = res({ board: board('mini-x64', [FILE, { kind: 'update', form: 'full', path: 'a.micaupd', sha256: 'b'.repeat(64), size: 2 }]) })
    const stale = await get(reads, cache, '/api/catalog/mini-x64')
    const body = await stale.json() as BoardBody

    expect(body.refreshing).toBe(true)
    expect(body.downloads).toHaveLength(1)
    expect(stale.headers.get('cache-control')).toBe('no-store')
    expect(reads.readBoard).toHaveBeenCalledTimes(1)

    const next = await (await get(reads, cache, '/api/catalog/mini-x64')).json() as BoardBody
    expect(next.refreshing).toBeUndefined()
    expect(next.downloads).toHaveLength(2)
    expect(reads.readBoard).toHaveBeenCalledTimes(1)
  })

  it('keeps answering the last good catalogue, with the error, when the resource service fails', async () => {
    const { cache, store } = fakeCache()
    await get(res(), cache, '/api/catalog/mini-x64')
    store.delete(FRESH)

    const failing = res({ board: new Error('https://res.test/update/products/v1/mini-x64.json answered 503') })
    await get(failing, cache, '/api/catalog/mini-x64')
    const body = await (await get(failing, cache, '/api/catalog/mini-x64')).json() as BoardBody

    expect(body.downloads).toHaveLength(1)
    expect(body.status.lastError?.message).toContain('answered 503')
    expect(store.get(FRESH)?.headers.get('cache-control')).toBe('public, max-age=60')
  })

  it('holds a first failure for a minute, not ten, and keeps no last good copy of it', async () => {
    const { cache, store } = fakeCache()
    const body = await (await get(res({ board: new Error('unreachable') }), cache, '/api/catalog/mini-x64')).json() as BoardBody

    expect(body.downloads).toEqual([])
    expect(body.status.lastError?.message).toBe('unreachable')
    expect(store.get(FRESH)?.headers.get('cache-control')).toBe('public, max-age=60')
    expect(store.has(LAST_GOOD)).toBe(false)
  })

  it('answers 404 for a board the catalogue does not list', async () => {
    const response = await get(res({ board: null }), fakeCache().cache, '/api/catalog/ghost')

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'not_listed' })
  })

  it('shows the guides this site can link to, and names a slug it does not publish', async () => {
    const guides = [
      { title: { zh: '写入镜像', en: 'Writing the image' }, body: { zh: '', en: '' }, doc: 'start/flashing' },
      { title: { zh: '旧文档', en: 'Old page' }, body: { zh: '', en: '' }, doc: 'start/gone' },
      { title: { zh: '板卡源码', en: 'Board source' }, body: { zh: '', en: '' }, url: 'https://example.invalid/source' },
    ]
    const body = await (await get(res({ board: board('mini-x64', [FILE], guides) }), fakeCache().cache, '/api/catalog/mini-x64')).json() as BoardBody

    expect(body.guides.map(guide => guide.doc ?? guide.url)).toEqual(['start/flashing', 'https://example.invalid/source'])
    expect(body.status.lastError?.message).toBe('mini-x64: guides name documents this site does not publish: start/gone')
  })

  it('answers the labelled sample when the demo switch is set, and reads nothing', async () => {
    const reads = res()
    const body = await (await get(reads, fakeCache().cache, '/api/catalog/uefi-x64', { CATALOG_DEMO: '1' })).json() as BoardBody

    expect(body.sample).toBe(true)
    expect(reads.readBoard).not.toHaveBeenCalled()
    // The table keys rows on their href; rows sharing one break rerenders.
    expect(new Set(body.downloads.map(row => row.href)).size).toBe(body.downloads.length)
  })

  it('refuses a name that is not a board\'s, and anything but a GET', async () => {
    const reads = res()
    expect((await get(reads, fakeCache().cache, '/api/catalog/..%2Fx')).status).toBe(404)
    expect((await get(reads, fakeCache().cache, '/api/other')).status).toBe(404)
    const post = await handle(new Request('https://micaos.dev/api/catalog', { method: 'POST' }), {}, { waitUntil: () => {} }, { ...reads, cache: fakeCache().cache } as unknown as Deps)
    expect(post.status).toBe(405)
    expect(reads.readBoard).not.toHaveBeenCalled()
  })
})

describe('the pages', () => {
  /** A rewriter that says which fill points it was asked to fill. */
  function rewriter() {
    const selectors: string[] = []
    const made = {
      on(selector: string) {
        selectors.push(selector)
        return made
      },
      transform: (response: Response) => new Response(response.body, response),
    }
    return { make: (() => made) as unknown as () => never, selectors }
  }

  /** The built site: the pages given, 404 for the rest. */
  function assets(pages: Record<string, string>, headers: Record<string, string> = { 'content-type': 'text/html; charset=utf-8', 'etag': '"built"' }) {
    const seen: Request[] = []
    return {
      seen,
      fetch: async (request: Request) => {
        seen.push(request)
        const body = pages[new URL(request.url).pathname]
        return body === undefined ? new Response('missing', { status: 404, headers: { 'content-type': 'text/html' } }) : new Response(body, { headers })
      },
    }
  }

  const TEMPLATE = { '/download/board-page/': '<title>__board__</title><h1>__board__</h1>', '/en/download/board-page/': '<h1>en __board__</h1>' }

  it('serves a listed board\'s download page from the one template, under the board\'s name', async () => {
    const fill = rewriter()
    const response = await get(res(), fakeCache().cache, '/download/mini-x64/', { ASSETS: assets(TEMPLATE) }, fill.make)

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('<title>mini-x64</title><h1>mini-x64</h1>')
    expect(fill.selectors).toEqual(['[data-res-boards]', '[data-res-board]'])
    expect(response.headers.get('etag')).toBeNull()
    expect(response.headers.get('cache-control')).toBe('public, max-age=0, must-revalidate')
  })

  it('serves the same page in the other language', async () => {
    const response = await get(res(), fakeCache().cache, '/en/download/mini-x64/', { ASSETS: assets(TEMPLATE) }, rewriter().make)

    expect(await response.text()).toBe('<h1>en mini-x64</h1>')
  })

  it('answers 404 for a board the catalogue does not list, and for the template\'s own address', async () => {
    const built = assets(TEMPLATE)

    expect((await get(res(), fakeCache().cache, '/download/ghost/', { ASSETS: built }, rewriter().make)).status).toBe(404)
    expect((await get(res(), fakeCache().cache, '/download/board-page/', { ASSETS: built }, rewriter().make)).status).toBe(404)
  })

  it('serves a board\'s page when the catalogue cannot say which boards there are', async () => {
    const response = await get(res({ index: new Error('unreachable') }), fakeCache().cache, '/download/mini-x64/', { ASSETS: assets(TEMPLATE) }, rewriter().make)

    expect(response.status).toBe(200)
    expect(await response.text()).toContain('<h1>mini-x64</h1>')
  })

  it('sends a board\'s address without its slash to the one with it', async () => {
    const response = await get(res(), fakeCache().cache, '/download/mini-x64', { ASSETS: assets(TEMPLATE) }, rewriter().make)

    expect(response.status).toBe(301)
    expect(response.headers.get('location')).toBe('https://micaos.dev/download/mini-x64/')
  })

  it('fills the board wording of any other page, and does not let a browser keep it as it is', async () => {
    const fill = rewriter()
    const response = await get(res(), fakeCache().cache, '/', { ASSETS: assets({ '/': '<html>home' }) }, fill.make)

    expect(await response.text()).toBe('<html>home')
    expect(fill.selectors).toEqual(['[data-res-boards]', '[data-res-board]'])
    expect(response.headers.get('etag')).toBeNull()
  })

  it('asks for the built page whole, so a filled page is never revalidated into keeping old words', async () => {
    const built = assets({ '/': '<html>home' })
    await get(res(), fakeCache().cache, '/', { ASSETS: built }, rewriter().make, { 'if-none-match': '"built"' })

    expect(built.seen[0].headers.get('if-none-match')).toBeNull()
  })

  it('serves a page as built when the catalogue cannot be read, or filling it throws', async () => {
    const built = assets({ '/': '<html>built' })
    const broken = (() => {
      throw new Error('no rewriter')
    }) as unknown as () => never

    expect(await (await get(res({ index: new Error('unreachable') }), fakeCache().cache, '/', { ASSETS: built }, rewriter().make)).text()).toBe('<html>built')
    expect(await (await get(res(), fakeCache().cache, '/', { ASSETS: built }, broken)).text()).toBe('<html>built')
  })

  it('passes anything that is not a built HTML page through untouched', async () => {
    const fill = rewriter()
    const response = await get(res(), fakeCache().cache, '/download/x.json', { ASSETS: assets({ '/download/x.json': '{}' }, { 'content-type': 'application/json' }) }, fill.make)

    expect(await response.text()).toBe('{}')
    expect(fill.selectors).toEqual([])
  })
})
