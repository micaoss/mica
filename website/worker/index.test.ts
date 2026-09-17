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

function githubAnswering(latest: Response) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/releases/latest'))
      return latest.clone()
    return new Response(JSON.stringify(INDEX))
  })
}

function LATEST() {
  return new Response(JSON.stringify({
    tag_name: 'mica.20260916-1709',
    assets: [{ name: 'mica-index.json', browser_download_url: 'https://github.invalid/mica-index.json' }],
  }))
}

describe('recordedRefresh', () => {
  beforeEach(() => vi.useFakeTimers({ now: new Date('2026-09-17T06:00:00Z') }))
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('records why a refresh failed, including the rate limit, and leaves the catalogue alone', async () => {
    const { kv, store } = fakeKv()
    store.set('catalog', JSON.stringify({ downloads: [{}], refreshedAt: '2026-09-16T19:30:38Z' }))
    vi.stubGlobal('fetch', githubAnswering(new Response('rate limited', {
      status: 403,
      headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1789628400' },
    })))

    await expect(recordedRefresh({ KV: kv }, 'cron')).rejects.toThrow('403')

    const status = JSON.parse(store.get('catalog-status')!)
    expect(status.lastAttemptAt).toBe('2026-09-17T06:00:00.000Z')
    expect(status.trigger).toBe('cron')
    expect(status.lastError.message).toContain('403')
    expect(status.lastError.message).toContain('rate limit remaining 0')
    expect(JSON.parse(store.get('catalog')!).refreshedAt).toBe('2026-09-16T19:30:38Z')
  })

  it('clears the error on the next success and keeps when it last succeeded', async () => {
    const { kv, store } = fakeKv()
    store.set('catalog-status', JSON.stringify({
      lastAttemptAt: '2026-09-17T05:30:00.000Z',
      lastSuccessAt: '2026-09-16T19:30:38.000Z',
      trigger: 'cron',
      lastError: { at: '2026-09-17T05:30:00.000Z', message: 'github answered 403' },
    }))
    vi.stubGlobal('fetch', githubAnswering(LATEST()))

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
