import type { Download } from '../src/features/download/catalog'
import { downloadsFromIndex } from '../src/features/download/mica-index'

/**
 * The site is static; this Worker exists for the download catalogue.
 *
 * `GET /api/catalog` answers from KV and never calls GitHub: the read path is a
 * key lookup. `POST /api/catalog/refresh` and the cron trigger are what rebuild
 * the stored catalogue, so a rate limit or an outage upstream costs a stale
 * answer rather than a broken page.
 */

interface Env {
  /** Stores the parsed catalogue. */
  KV: KVNamespace
  /** `owner/repo` whose releases are parsed. */
  CATALOG_REPO?: string
  /** Read-only GitHub token; without one the API allows 60 calls an hour per IP. */
  GITHUB_TOKEN?: string
  /** Bearer token the manual refresh requires. */
  REFRESH_TOKEN?: string
  /** `1` answers the sample catalogue instead of reading KV. */
  CATALOG_DEMO?: string
}

interface StoredCatalogue {
  downloads: Download[]
  /** When the stored copy was built. */
  refreshedAt: string
  /** The index release the stored copy was read from. */
  latestRelease?: string
}

const CATALOG_PATH = '/api/catalog'
const REFRESH_PATH = '/api/catalog/refresh'
const KEY = 'catalog'
const DEFAULT_REPO = 'micaoss/mica-build'
const INDEX_ASSET = 'mica-index.json'
/** Long enough to stay cheap, short enough that a refresh surfaces quickly. */
const CACHE_SECONDS = 300

/**
 * A sample, and labelled as one everywhere it surfaces. Nothing here is a
 * release; it exists so the filters and the history control can be seen working
 * where no catalogue is stored.
 */
const SAMPLE: Download[] = [
  { board: 'x64', profile: 'dev', kind: 'image', version: '20260915-1458', deploymentId: 'sample-x64-dev', releasedAt: '2026-09-15', bytes: 1_881_145_344, digest: 'sha256:0000000000000000000000000000000000000000000000000000000000000000', href: 'https://micaos.dev/docs/user/download/', filename: 'mica-x64-dev-20260915-1458.img' },
  { board: 'x64', profile: 'dev', kind: 'update', version: '20260915-1458', deploymentId: 'sample-x64-dev', releasedAt: '2026-09-15', bytes: 81_425_461, digest: 'sha256:1111111111111111111111111111111111111111111111111111111111111111', href: 'https://micaos.dev/docs/user/download/', filename: 'mica-x64-dev-20260915-1458.micaupd' },
  { board: 'x64', profile: 'minimal', kind: 'image', version: '20260915-1458', deploymentId: 'sample-x64-minimal', releasedAt: '2026-09-15', bytes: 1_881_145_344, digest: 'sha256:2222222222222222222222222222222222222222222222222222222222222222', href: 'https://micaos.dev/docs/user/download/', filename: 'mica-x64-minimal-20260915-1458.img' },
  { board: 'x64', profile: 'dev', kind: 'image', version: '20260901-1200', deploymentId: 'sample-x64-dev-old', releasedAt: '2026-09-01', bytes: 1_870_000_000, digest: 'sha256:3333333333333333333333333333333333333333333333333333333333333333', href: 'https://micaos.dev/docs/user/download/', filename: 'mica-x64-dev-20260901-1200.img' },
  { board: 'cx3576', profile: 'dev', kind: 'image', version: '20260915-1515', deploymentId: 'sample-cx3576-dev', releasedAt: '2026-09-15', bytes: 1_362_100_224, digest: 'sha256:4444444444444444444444444444444444444444444444444444444444444444', href: 'https://micaos.dev/docs/user/download/', filename: 'mica-cx3576-dev-20260915-1515.img' },
  { board: 'cx3576', profile: 'dev', kind: 'update', version: '20260915-1515', deploymentId: 'sample-cx3576-dev', releasedAt: '2026-09-15', bytes: 84_986_579, digest: 'sha256:5555555555555555555555555555555555555555555555555555555555555555', href: 'https://micaos.dev/docs/user/download/', filename: 'mica-cx3576-dev-20260915-1515.micaupd' },
]

function json(body: unknown, seconds: number): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // The browser holds it briefly; the edge holds it for the same window the
      // stored copy is refreshed in.
      'cache-control': 'public, max-age=60',
      'cdn-cache-control': `public, max-age=${seconds}`,
    },
  })
}

interface GithubRelease {
  tag_name: string
  assets: { name: string, browser_download_url: string }[]
}

/**
 * Reads `mica-index.json` from the repository's latest release and stores what
 * it names.
 *
 * The index release is the one GitHub marks latest, cut automatically after a
 * scoped release, and it is the documented entry point: one file names every
 * current product with its files, sizes and hashes
 * (`mica:docs/design/mica-index.md`). Walking the release list and parsing file
 * names would reconstruct less, and reconstruct it worse.
 */
async function refresh(env: Env): Promise<StoredCatalogue> {
  const repo = env.CATALOG_REPO ?? DEFAULT_REPO
  const headers: Record<string, string> = {
    'accept': 'application/vnd.github+json',
    'user-agent': 'micaos.dev',
  }
  if (env.GITHUB_TOKEN)
    headers.authorization = `Bearer ${env.GITHUB_TOKEN}`

  const latest = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, { headers })
  if (!latest.ok)
    throw new Error(`github answered ${latest.status}`)

  const release = (await latest.json()) as GithubRelease
  const asset = release.assets.find(candidate => candidate.name === INDEX_ASSET)
  if (!asset)
    throw new Error(`${release.tag_name} carries no ${INDEX_ASSET}`)

  const index = await fetch(asset.browser_download_url, { headers: { accept: 'application/json' } })
  if (!index.ok)
    throw new Error(`${INDEX_ASSET} answered ${index.status}`)

  const stored: StoredCatalogue = {
    downloads: downloadsFromIndex(await index.json()),
    refreshedAt: new Date().toISOString(),
    latestRelease: release.tag_name,
  }

  await env.KV.put(KEY, JSON.stringify(stored))
  return stored
}

async function catalogue(env: Env, ctx: ExecutionContext): Promise<Response> {
  if (env.CATALOG_DEMO === '1')
    return json({ downloads: SAMPLE, sample: true, refreshedAt: null }, CACHE_SECONDS)

  const stored = await env.KV.get<StoredCatalogue>(KEY, 'json')
  if (!stored) {
    // Nothing stored yet — a fresh deployment, before the first cron. Fill it in
    // the background rather than making this request wait on GitHub, and hold
    // the empty answer briefly so the next request finds the catalogue.
    ctx.waitUntil(refresh(env).catch(() => {}))
    return json({ downloads: [], refreshedAt: null }, 60)
  }

  return json(stored, CACHE_SECONDS)
}

async function manualRefresh(request: Request, env: Env): Promise<Response> {
  const expected = env.REFRESH_TOKEN
  const given = request.headers.get('authorization')
  // With no token configured the endpoint is closed, not open: a refresh that
  // anyone can trigger is a way to spend the upstream rate limit.
  if (!expected || given !== `Bearer ${expected}`)
    return new Response('unauthorized', { status: 401 })

  try {
    const stored = await refresh(env)
    return json({ refreshedAt: stored.refreshedAt, downloads: stored.downloads.length }, 0)
  }
  catch (error) {
    return json({ error: (error as Error).message }, 0)
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === REFRESH_PATH) {
      return request.method === 'POST'
        ? manualRefresh(request, env)
        : new Response('method not allowed', { status: 405, headers: { allow: 'POST' } })
    }

    if (url.pathname !== CATALOG_PATH)
      return new Response('not found', { status: 404 })
    if (request.method !== 'GET')
      return new Response('method not allowed', { status: 405, headers: { allow: 'GET' } })

    return catalogue(env, ctx)
  },

  /** The cron trigger; a failure leaves the stored copy standing. */
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(refresh(env).catch(() => {}))
  },
}
