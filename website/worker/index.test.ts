import type { CatalogueCache } from './index'
import { describe, expect, it, vi } from 'vitest'
import { handle } from './index'

const ROOT = 'https://res.test/update/'
const RELEASE = {
  baseUrl: 'https://dl.test/mica/mini-x64.basic/20261001-2113/',
  id: 'mini-x64.basic.20261001-2113',
  product: 'mini-x64.basic',
  board: 'mini-x64',
  variant: 'basic',
  files: [{ kind: 'image', path: 'a.img.gz', sha256: 'a'.repeat(64), size: 1 }],
}
const MANIFEST = { products: [{ product: 'mini-x64.basic', board: 'mini-x64', variant: 'basic' }] }

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
function published(manifest: unknown = MANIFEST, releases: unknown[] = [RELEASE]) {
  return vi.fn(async () => ({ manifest, releases })) as never
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
}

describe('gET /api/catalog', () => {
  it('answers what the resource service serves now, and says where it read it', async () => {
    const read = published()
    const response = await get({ read, cache: fakeCache().cache })
    const body = await response.json() as Body

    expect(response.status).toBe(200)
    expect(read).toHaveBeenCalledWith(ROOT)
    expect(body.downloads).toHaveLength(1)
    expect(body.source).toBe(`${ROOT}v2/manifest.json`)
    expect(body.status.trigger).toBe('request')
    expect(body.status.lastError).toBeNull()
  })

  it('reads the resource service once while its answer is cached, for ten minutes', async () => {
    const read = published()
    const { cache, store } = fakeCache()

    await get({ read, cache })
    const second = await get({ read, cache })

    expect(read).toHaveBeenCalledTimes(1)
    expect((await second.json() as Body).downloads).toHaveLength(1)
    expect(store.get('https://micaos.dev/api/catalog/fresh')?.headers.get('cache-control')).toBe('public, max-age=600')
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
    store.delete('https://micaos.dev/api/catalog/fresh')

    const newer = { ...RELEASE, id: 'mini-x64.basic.20261002-0900', files: [...RELEASE.files, { kind: 'update', form: 'full', path: 'a.micaupd', sha256: 'b'.repeat(64), size: 2 }] }
    const read = published(MANIFEST, [newer])
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
    store.delete('https://micaos.dev/api/catalog/fresh')

    const failing = vi.fn(async () => {
      throw new Error('https://res.test/update/v2/manifest.json answered 503')
    }) as never
    await get({ read: failing, cache })
    const body = await (await get({ read: failing, cache })).json() as Body

    expect(body.downloads).toHaveLength(1)
    expect(body.status.lastError?.message).toContain('answered 503')
    expect(store.get('https://micaos.dev/api/catalog/fresh')?.headers.get('cache-control')).toBe('public, max-age=60')
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

    expect(store.get('https://micaos.dev/api/catalog/fresh')?.headers.get('cache-control')).toBe('public, max-age=60')
    expect(store.has('https://micaos.dev/api/catalog/last-good')).toBe(false)
  })

  it('serves the rows and names a product published for a board the site has no page for', async () => {
    const manifest = { products: [{ product: 'ghost.basic', board: 'ghost', variant: 'basic' }] }
    const release = { ...RELEASE, id: 'ghost.basic.20261001-2113', product: 'ghost.basic', board: 'ghost' }
    const body = await (await get({ read: published(manifest, [release]), cache: fakeCache().cache })).json() as Body

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
})
