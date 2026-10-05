import type { CatalogueCache } from './index'
import { describe, expect, it, vi } from 'vitest'
import site from '../boards.json'
import { handle } from './index'

const ROOT = 'https://res.test/update/'
const FILE = { kind: 'image', form: 'disk', path: 'mica/mini-x64.basic/20261001-2113/a.img.gz', sha256: 'a'.repeat(64), size: 1 }

/** The product catalogue: one board, one product, its newest release. */
function document(board = 'mini-x64', files: unknown[] = [FILE]) {
  return {
    schema: 'mica/products/v1',
    baseUrl: 'https://dl.test/',
    categories: [{ id: 'image', title: { zh: '系统镜像', en: 'System image' } }],
    fileTypes: [{ kind: 'image', form: 'disk', category: 'image', title: { zh: '整盘镜像', en: 'whole disk' } }],
    // Every board the site has a page for, and the one the product is for.
    boards: [...new Set([...site.boards.map(row => row.board), board])].map(name => ({ board: name, title: { zh: name, en: name }, hardware: { zh: '小型 amd64', en: 'Small amd64' }, status: { zh: 'QEMU', en: 'QEMU' } })),
    products: [{
      product: `${board}.basic`,
      board,
      variant: 'basic',
      title: { zh: '基础系统', en: 'base system' },
      summary: { zh: '', en: '' },
      recommended: false,
      latest: { id: `${board}.basic.20261001-2113`, version: '20261001-2113', publishedAt: '2026-10-01T21:13:00.000Z', files },
      releases: `https://res.test/update/v2/${board}.basic/releases.json`,
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

/** What the resource service answers: one product with one release. */
function published(answer: unknown = document()) {
  return vi.fn(async () => answer) as never
}

async function get(deps: { read: never, cache: CatalogueCache }, env: { CATALOG_DEMO?: string } = {}, path = '/api/catalog') {
  const pending: Promise<unknown>[] = []
  const response = await handle(
    new Request(`https://micaos.dev${path}`),
    { CATALOG_ROOT: ROOT, ...env },
    { waitUntil: promise => void pending.push(promise) },
    deps,
  )
  await Promise.all(pending)
  return response
}

interface Body {
  downloads: { board: string }[]
  refreshedAt: string | null
  source?: string
  sample?: boolean
  status: { trigger: string, lastError: { message: string } | null }
  refreshing?: boolean
  version?: number
  products?: { product: string, title: { zh: string } }[]
  boards?: { board: string }[]
  fileTypes?: unknown[]
}

describe('gET /api/catalog', () => {
  it('answers what the resource service serves now, and says where it read it', async () => {
    const read = published()
    const response = await get({ read, cache: fakeCache().cache })
    const body = await response.json() as Body

    expect(response.status).toBe(200)
    expect(read).toHaveBeenCalledWith(ROOT)
    expect(body.downloads).toHaveLength(1)
    expect(body.source).toBe(`${ROOT}products/v1.json`)
    expect(body.status.trigger).toBe('request')
    expect(body.status.lastError).toBeNull()
  })

  it('answers the words beside the rows: the site keeps no copy of them', async () => {
    const body = await (await get({ read: published(), cache: fakeCache().cache })).json() as Body

    expect(body.version).toBe(2)
    expect(body.products).toEqual([expect.objectContaining({ product: 'mini-x64.basic', title: { zh: '基础系统', en: 'base system' } })])
    expect(body.boards?.map(board => board.board)).toContain('mini-x64')
    expect(body.fileTypes).toHaveLength(1)
    // A product's files are the rows; they are not answered twice.
    expect(body.products?.[0]).not.toHaveProperty('latest')
  })

  it('reads the resource service once while its answer is cached, for ten minutes', async () => {
    const read = published()
    const { cache, store } = fakeCache()

    await get({ read, cache })
    const second = await get({ read, cache })

    expect(read).toHaveBeenCalledTimes(1)
    expect((await second.json() as Body).downloads).toHaveLength(1)
    expect(store.get('https://micaos.dev/api/catalog/v2/fresh')?.headers.get('cache-control')).toBe('public, max-age=600')
  })

  it('ignores the query, so every build of the page shares one cached answer', async () => {
    const read = published()
    const { cache } = fakeCache()

    await get({ read, cache })
    await get({ read, cache }, {}, '/api/catalog?v=abc')

    expect(read).toHaveBeenCalledTimes(1)
  })

  it('answers the last good catalogue at once when the ten minutes are over, and reads again behind it', async () => {
    const { cache, store } = fakeCache()
    await get({ read: published(), cache })
    store.delete('https://micaos.dev/api/catalog/v2/fresh')

    const read = published(document('mini-x64', [FILE, { kind: 'update', form: 'full', path: 'a.micaupd', sha256: 'b'.repeat(64), size: 2 }]))
    const stale = await get({ read, cache })
    const body = await stale.json() as Body

    expect(body.refreshing).toBe(true)
    expect(body.downloads).toHaveLength(1)
    expect(stale.headers.get('cache-control')).toBe('no-store')
    expect(read).toHaveBeenCalledTimes(1)

    const next = await (await get({ read, cache })).json() as Body
    expect(next.refreshing).toBeUndefined()
    expect(next.downloads).toHaveLength(2)
    expect(read).toHaveBeenCalledTimes(1)
  })

  it('keeps answering the last good catalogue, with the error, when the resource service fails', async () => {
    const { cache, store } = fakeCache()
    await get({ read: published(), cache })
    store.delete('https://micaos.dev/api/catalog/v2/fresh')

    const failing = vi.fn(async () => {
      throw new Error('https://res.test/update/v2/manifest.json answered 503')
    }) as never
    await get({ read: failing, cache })
    const body = await (await get({ read: failing, cache })).json() as Body

    expect(body.downloads).toHaveLength(1)
    expect(body.status.lastError?.message).toContain('answered 503')
    expect(store.get('https://micaos.dev/api/catalog/v2/fresh')?.headers.get('cache-control')).toBe('public, max-age=60')
  })

  it('answers an empty catalogue and the error when nothing was ever read', async () => {
    const failing = vi.fn(async () => {
      throw new Error('unreachable')
    }) as never
    const body = await (await get({ read: failing, cache: fakeCache().cache })).json() as Body

    expect(body.downloads).toEqual([])
    expect(body.refreshedAt).toBeNull()
    expect(body.status.lastError?.message).toBe('unreachable')
  })

  it('holds a failure for a minute, not ten', async () => {
    const failing = vi.fn(async () => {
      throw new Error('unreachable')
    }) as never
    const { cache, store } = fakeCache()

    await get({ read: failing, cache })

    expect(store.get('https://micaos.dev/api/catalog/v2/fresh')?.headers.get('cache-control')).toBe('public, max-age=60')
    expect(store.has('https://micaos.dev/api/catalog/v2/last-good')).toBe(false)
  })

  it('serves the rows and names a product published for a board the site has no page for', async () => {
    const body = await (await get({ read: published(document('ghost')), cache: fakeCache().cache })).json() as Body

    expect(body.downloads).toHaveLength(1)
    expect(body.status.lastError?.message).toContain('which the site lists no page for')
  })

  it('answers the labelled sample when the demo switch is set, and reads nothing', async () => {
    const read = published()
    const response = await get({ read, cache: fakeCache().cache }, { CATALOG_DEMO: '1' })
    const body = await response.json() as { sample: boolean, downloads: { href: string }[] }

    expect(body.sample).toBe(true)
    expect(read).not.toHaveBeenCalled()
    // The table keys rows on their href; rows sharing one break rerenders.
    expect(new Set(body.downloads.map(row => row.href)).size).toBe(body.downloads.length)
  })

  it('refuses anything but a GET of that one path', async () => {
    const deps = { read: published(), cache: fakeCache().cache }
    expect((await get(deps, {}, '/api/other')).status).toBe(404)
    const post = await handle(new Request('https://micaos.dev/api/catalog', { method: 'POST' }), {}, { waitUntil: () => {} }, deps)
    expect(post.status).toBe(405)
  })

  it('names a board the site has a page for and the catalogue does not list', async () => {
    const answer = { ...document(), boards: [] }
    const body = await (await get({ read: published(answer), cache: fakeCache().cache })).json() as Body

    expect(body.status.lastError?.message).toContain('has a page on the site and is not listed in the catalogue')
  })
})

describe('a page with board wording', () => {
  /** A rewriter that says which words it was asked to fill a page with. */
  function rewriter() {
    const selectors: string[] = []
    const made = {
      on(selector: string) {
        selectors.push(selector)
        return made
      },
      transform: (response: Response) => new Response('filled', response),
    }
    return { make: () => made, selectors }
  }

  function assets(body = '<html>', headers: Record<string, string> = { 'content-type': 'text/html; charset=utf-8', 'etag': '"built"' }, status = 200) {
    const seen: Request[] = []
    return { seen, fetch: async (request: Request) => {
      seen.push(request)
      return new Response(body, { status, headers })
    } }
  }

  async function page(deps: { read: never, cache: CatalogueCache, rewriter?: () => never }, built: ReturnType<typeof assets>, path = '/', headers: Record<string, string> = {}) {
    const pending: Promise<unknown>[] = []
    const response = await handle(
      new Request(`https://micaos.dev${path}`, { headers }),
      { CATALOG_ROOT: ROOT, ASSETS: built },
      { waitUntil: promise => void pending.push(promise) },
      deps,
    )
    await Promise.all(pending)
    return response
  }

  it('is the built page with its fill points filled, and is not kept by a browser as it is', async () => {
    const fill = rewriter()
    const response = await page({ read: published(), cache: fakeCache().cache, rewriter: fill.make as never }, assets())

    expect(await response.text()).toBe('filled')
    expect(fill.selectors).toEqual(['[data-res-boards]', '[data-res-board]'])
    expect(response.headers.get('etag')).toBeNull()
    expect(response.headers.get('cache-control')).toBe('public, max-age=0, must-revalidate')
  })

  it('asks for the built page whole, so a filled page is never revalidated into keeping old words', async () => {
    const built = assets()
    await page({ read: published(), cache: fakeCache().cache, rewriter: rewriter().make as never }, built, '/', { 'if-none-match': '"built"' })

    expect(built.seen[0].headers.get('if-none-match')).toBeNull()
  })

  it('is served as built when the resource service cannot be read and nothing is held', async () => {
    const failing = vi.fn(async () => {
      throw new Error('unreachable')
    }) as never
    const response = await page({ read: failing, cache: fakeCache().cache, rewriter: rewriter().make as never }, assets('<html>built'))

    expect(await response.text()).toBe('<html>built')
  })

  it('is served as built when filling it throws', async () => {
    const broken = () => {
      throw new Error('no rewriter')
    }
    const response = await page({ read: published(), cache: fakeCache().cache, rewriter: broken as never }, assets('<html>built'))

    expect(await response.text()).toBe('<html>built')
  })

  it('passes anything that is not a built HTML page through untouched', async () => {
    const fill = rewriter()
    const deps = { read: published(), cache: fakeCache().cache, rewriter: fill.make as never }

    expect(await (await page(deps, assets('{}', { 'content-type': 'application/json' }), '/download/x.json')).text()).toBe('{}')
    expect((await page(deps, assets('missing', { 'content-type': 'text/html' }, 404), '/download/nothing/')).status).toBe(404)
    expect(fill.selectors).toEqual([])
  })
})
