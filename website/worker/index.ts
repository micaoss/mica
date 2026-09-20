import type { RefreshStatus, StoredCatalogue } from '../src/features/download/catalog-store'

/**
 * The site is static; this Worker exists for one route.
 *
 * `GET /api/catalog` answers what CI stored in KV and talks to nothing else.
 * The Worker used to refresh the catalogue itself, on a cron: that failed
 * continuously against GitHub — 403 from the API and 429 from the release
 * download — because Cloudflare's egress addresses are shared and heavily used
 * against GitHub, and neither an anonymous allowance nor a redirect around the
 * API survives that. The catalogue is built on a CI runner and written here
 * (`scripts/publish-catalog.ts`, the website workflow's `index` job).
 */

export interface Env {
  /** Holds the catalogue and the status of the job that wrote it. */
  KV: KVNamespace
  /** `1` answers a labelled sample instead of reading KV. */
  CATALOG_DEMO?: string
}

const CATALOG_PATH = '/api/catalog'
const KEY = 'catalog'
/** Written beside the catalogue, so a stale copy can say what happened. */
const STATUS_KEY = 'catalog-status'
/** Long enough to stay cheap, short enough that a publish surfaces quickly. */
const CACHE_SECONDS = 300

/**
 * A sample, and labelled as one everywhere it surfaces. Nothing here is a
 * release; it exists so the filters and the history control can be seen working
 * where no catalogue is stored. Every row needs its own href: the table keys on
 * it, and rows sharing one would reproduce the stale-list bug the key fixed.
 */
const SAMPLE: StoredCatalogue['downloads'] = [
  { board: 'uefi-x64', profile: 'dev', kind: 'image', version: '20260916-0845', deploymentId: 'sample-uefi-x64-dev', releasedAt: '2026-09-16', bytes: 82_000_000, digest: 'sha256:0000000000000000000000000000000000000000000000000000000000000000', href: 'https://micaos.dev/docs/user/download/#image', filename: 'mica-uefi-x64-dev-20260916-0845.img.gz' },
  { board: 'uefi-x64', profile: 'dev', kind: 'update', variant: 'full', version: '20260916-0845', deploymentId: 'sample-uefi-x64-dev', releasedAt: '2026-09-16', bytes: 81_000_000, digest: 'sha256:1111111111111111111111111111111111111111111111111111111111111111', href: 'https://micaos.dev/docs/user/download/#full', filename: 'mica-uefi-x64-dev-20260916-0845.micaupd' },
  { board: 'cx3576', profile: 'prod', kind: 'image', version: '20260916-0847', deploymentId: 'sample-cx3576-prod', releasedAt: '2026-09-16', bytes: 86_000_000, digest: 'sha256:2222222222222222222222222222222222222222222222222222222222222222', href: 'https://micaos.dev/docs/user/download/#cx-image', filename: 'mica-cx3576-prod-20260916-0847.img.gz' },
]

function json(body: unknown, seconds: number): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // The browser holds it briefly; the edge holds it for the window a publish
      // takes to matter. Without `cdn-cache-control` the zone's default browser
      // TTL applies and a change takes hours to surface.
      'cache-control': 'public, max-age=60',
      'cdn-cache-control': `public, max-age=${seconds}`,
    },
  })
}

async function catalogue(env: Env): Promise<Response> {
  if (env.CATALOG_DEMO === '1')
    return json({ downloads: SAMPLE, sample: true, refreshedAt: null }, CACHE_SECONDS)

  const [stored, status] = await Promise.all([
    env.KV.get<StoredCatalogue>(KEY, 'json'),
    env.KV.get<RefreshStatus>(STATUS_KEY, 'json'),
  ])

  // Nothing stored yet means CI has not published since the namespace was made.
  // The page shows its empty state, and the status says whether a publish tried.
  if (!stored)
    return json({ downloads: [], refreshedAt: null, status }, 60)

  return json({ ...stored, status }, CACHE_SECONDS)
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname !== CATALOG_PATH)
      return new Response('not found', { status: 404 })
    if (request.method !== 'GET')
      return new Response('method not allowed', { status: 405, headers: { allow: 'GET' } })

    return catalogue(env)
  },
}
