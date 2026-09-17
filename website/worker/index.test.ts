import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import worker, { recordedRefresh } from './index'

/** An in-memory KV with the two calls the Worker makes. */
function fakeKv() {
  const store = new Map<string, string>()
  return {
    store,
    kv: {
      async get(key: string, type?: string) {
        const value = store.get(key)
        if (value === undefined)
          return null
        return type === 'json' ? JSON.parse(value) : value
      },
      async put(key: string, value: string) {
        store.set(key, value)
      },
    } as unknown as KVNamespace,
  }
}

const INDEX = {
  products: [{
    product: 'uefi-x64-dev',
    board: 'uefi-x64',
    profile: 'dev',
    deployment: 'd',
    release: 'uefi-x64.20260916-0845',
    images: [{ kind: 'disk', file: 'a.img.gz', url: 'https://u/a', sha256: 's', size: 1 }],
    updates: [],
  }],
}

const INDEX_URL = 'https://github.com/micaoss/mica-build/releases/latest/download/mica-index.json'

/**
 * GitHub as the Worker now meets it: the latest-download URL answers a redirect
 * to the latest release's asset, and that asset answers the index. No call goes
 * to api.github.com.
 */
function githubAnswering(first: Response) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.startsWith('https://api.github.com'))
      throw new Error(`unexpected API call: ${url}`)
    if (url === INDEX_URL)
      return first.clone()
    return new Response(JSON.stringify(INDEX))
  })
}

function REDIRECT(tag = 'mica.20260916-1709') {
  return new Response(null, {
    status: 302,
    headers: { location: `https://github.com/micaoss/mica-build/releases/download/${encodeURIComponent(tag)}/mica-index.json` },
  })
}

describe('recordedRefresh', () => {
  beforeEach(() => vi.useFakeTimers({ now: new Date('2026-09-17T06:00:00Z') }))
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('records why a refresh failed and leaves the catalogue alone', async () => {
    const { kv, store } = fakeKv()
    store.set('catalog', JSON.stringify({ downloads: [{}], refreshedAt: '2026-09-16T19:30:38Z' }))
    vi.stubGlobal('fetch', githubAnswering(new Response('', { status: 404 })))

    await expect(recordedRefresh({ KV: kv }, 'cron')).rejects.toThrow('404')

    const status = JSON.parse(store.get('catalog-status')!)
    expect(status.lastAttemptAt).toBe('2026-09-17T06:00:00.000Z')
    expect(status.trigger).toBe('cron')
    expect(status.lastError.message).toContain('the latest release carries no mica-index.json')
    expect(JSON.parse(store.get('catalog')!).refreshedAt).toBe('2026-09-16T19:30:38Z')
  })

  it('reads the release from the redirect and never calls the API', async () => {
    const { kv, store } = fakeKv()
    const fetchMock = githubAnswering(REDIRECT())
    vi.stubGlobal('fetch', fetchMock)

    const stored = await recordedRefresh({ KV: kv }, 'cron')

    expect(stored.latestRelease).toBe('mica.20260916-1709')
    expect(stored.downloads).toHaveLength(1)
    expect(fetchMock.mock.calls.every(([url]) => !String(url).startsWith('https://api.github.com'))).toBe(true)
    expect(JSON.parse(store.get('catalog-status')!).lastError).toBeNull()
  })

  it('decodes a release tag written with a slash', async () => {
    const { kv } = fakeKv()
    vi.stubGlobal('fetch', githubAnswering(REDIRECT('mica/20260915-2242')))

    const stored = await recordedRefresh({ KV: kv }, 'manual')

    expect(stored.latestRelease).toBe('mica/20260915-2242')
  })

  it('clears the error on the next success and keeps when it last succeeded', async () => {
    const { kv, store } = fakeKv()
    store.set('catalog-status', JSON.stringify({
      lastAttemptAt: '2026-09-17T05:30:00.000Z',
      lastSuccessAt: '2026-09-16T19:30:38.000Z',
      trigger: 'cron',
      lastError: { at: '2026-09-17T05:30:00.000Z', message: 'github answered 403' },
    }))
    vi.stubGlobal('fetch', githubAnswering(REDIRECT()))

    await recordedRefresh({ KV: kv }, 'manual')

    const status = JSON.parse(store.get('catalog-status')!)
    expect(status.lastError).toBeNull()
    expect(status.lastSuccessAt).toBe('2026-09-17T06:00:00.000Z')
    expect(status.trigger).toBe('manual')
  })

  it('keeps the last success time through a failure', async () => {
    const { kv, store } = fakeKv()
    store.set('catalog-status', JSON.stringify({ lastSuccessAt: '2026-09-16T19:30:38.000Z', lastError: null }))
    vi.stubGlobal('fetch', githubAnswering(new Response('', { status: 502 })))

    await expect(recordedRefresh({ KV: kv }, 'cron')).rejects.toThrow()

    expect(JSON.parse(store.get('catalog-status')!).lastSuccessAt).toBe('2026-09-16T19:30:38.000Z')
  })
})

describe('gET /api/catalog', () => {
  it('answers the refresh status beside the catalogue', async () => {
    const { kv, store } = fakeKv()
    store.set('catalog', JSON.stringify({ downloads: [], refreshedAt: '2026-09-16T19:30:38Z' }))
    store.set('catalog-status', JSON.stringify({ lastError: { at: 'x', message: 'github answered 403' } }))

    const response = await worker.fetch(
      new Request('https://micaos.dev/api/catalog'),
      { KV: kv },
      { waitUntil: () => {} } as unknown as ExecutionContext,
    )
    const body = await response.json() as { status: { lastError: { message: string } } }

    expect(body.status.lastError.message).toBe('github answered 403')
  })
})
