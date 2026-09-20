import { describe, expect, it } from 'vitest'
import worker from './index'

/** An in-memory KV with the one call the Worker makes. */
function fakeKv(entries: Record<string, unknown> = {}) {
  const store = new Map(Object.entries(entries).map(([key, value]) => [key, JSON.stringify(value)]))
  return {
    async get(key: string, type?: string) {
      const value = store.get(key)
      if (value === undefined)
        return null
      return type === 'json' ? JSON.parse(value) : value
    },
  } as unknown as KVNamespace
}

function get(env: { KV: KVNamespace, CATALOG_DEMO?: string }, path = '/api/catalog') {
  return worker.fetch(new Request(`https://micaos.dev${path}`), env)
}

describe('gET /api/catalog', () => {
  it('answers what CI stored, with the status beside it', async () => {
    const response = await get({
      KV: fakeKv({
        'catalog': { downloads: [{ board: 'uefi-x64' }], refreshedAt: '2026-09-20T09:00:00Z', latestRelease: 'mica.20260920-0046' },
        'catalog-status': { trigger: 'ci', lastSuccessAt: '2026-09-20T09:00:00Z', lastError: null },
      }),
    })
    const body = await response.json() as { downloads: unknown[], latestRelease: string, status: { trigger: string } }

    expect(response.status).toBe(200)
    expect(body.downloads).toHaveLength(1)
    expect(body.latestRelease).toBe('mica.20260920-0046')
    expect(body.status.trigger).toBe('ci')
  })

  it('answers an empty catalogue, and the status, when nothing is stored', async () => {
    const response = await get({ KV: fakeKv({ 'catalog-status': { lastError: { at: 'x', message: 'publish failed' } } }) })
    const body = await response.json() as { downloads: unknown[], status: { lastError: { message: string } } }

    expect(body.downloads).toEqual([])
    expect(body.status.lastError.message).toBe('publish failed')
  })

  it('answers the labelled sample when the demo switch is set', async () => {
    const response = await get({ KV: fakeKv(), CATALOG_DEMO: '1' })
    const body = await response.json() as { sample: boolean, downloads: { href: string }[] }

    expect(body.sample).toBe(true)
    // The table keys rows on their href; rows sharing one break rerenders.
    expect(new Set(body.downloads.map(row => row.href)).size).toBe(body.downloads.length)
  })

  it('refuses anything but a GET of that one path', async () => {
    expect((await get({ KV: fakeKv() }, '/api/other')).status).toBe(404)
    const post = await worker.fetch(new Request('https://micaos.dev/api/catalog', { method: 'POST' }), { KV: fakeKv() })
    expect(post.status).toBe(405)
  })
})
