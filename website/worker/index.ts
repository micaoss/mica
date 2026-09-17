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

export interface Env {
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

/** What started a refresh; recorded so a stale catalogue says whose attempt failed. */
export type RefreshTrigger = 'cron' | 'manual' | 'fill'

export interface RefreshStatus {
  lastAttemptAt?: string
  trigger?: RefreshTrigger
  /** The last attempt that stored a catalogue. */
  lastSuccessAt?: string
  /** Why the last attempt failed; null once one succeeds again. */
  lastError?: { at: string, message: string } | null
}

const CATALOG_PATH = '/api/catalog'
const REFRESH_PATH = '/api/catalog/refresh'
const KEY = 'catalog'
/**
 * Kept apart from the catalogue so a failed attempt is recorded without
 * rewriting what the pages read.
 */
const STATUS_KEY = 'catalog-status'
const DEFAULT_REPO = 'micaoss/mica-build'
const INDEX_ASSET = 'mica-index.json'
/** Long enough to stay cheap, short enough that a refresh surfaces quickly. */
const CACHE_SECONDS = 300

/**
 * A sample, and labelled as one everywhere it surfaces. Nothing here is a
 * release; it exists so the filters and the history control can be seen working
 * where no catalogue is stored. Every row needs its own href: the table keys on
 * it, and rows sharing one would reproduce the stale-list bug the key fixed.
 */
const SAMPLE: Download[] = [
  { board: 'uefi-x64', profile: 'dev', kind: 'image', version: '20260916-0845', deploymentId: 'sample-uefi-x64-dev-20260916-0845', releasedAt: '2026-09-16', bytes: 82000000, digest: 'sha256:0000000000000000000000000000000000000000000000000000000000000000', href: 'https://micaos.dev/docs/user/download/#mica-uefi-x64-dev-20260916-0845.img.gz', filename: 'mica-uefi-x64-dev-20260916-0845.img.gz' },
  { board: 'uefi-x64', profile: 'dev', kind: 'update', variant: 'full', version: '20260916-0845', deploymentId: 'sample-uefi-x64-dev-20260916-0845', releasedAt: '2026-09-16', bytes: 81000000, digest: 'sha256:1111111111111111111111111111111111111111111111111111111111111111', href: 'https://micaos.dev/docs/user/download/#mica-uefi-x64-dev-20260916-0845.micaupd', filename: 'mica-uefi-x64-dev-20260916-0845.micaupd' },
  { board: 'uefi-x64', profile: 'dev', kind: 'update', variant: 'kernel', version: '20260916-0845', deploymentId: 'sample-uefi-x64-dev-20260916-0845', releasedAt: '2026-09-16', bytes: 16000000, digest: 'sha256:2222222222222222222222222222222222222222222222222222222222222222', href: 'https://micaos.dev/docs/user/download/#mica-uefi-x64-dev-20260916-0845.kernel.micaupd', filename: 'mica-uefi-x64-dev-20260916-0845.kernel.micaupd' },
  { board: 'uefi-x64', profile: 'dev', kind: 'update', variant: 'root', version: '20260916-0845', deploymentId: 'sample-uefi-x64-dev-20260916-0845', releasedAt: '2026-09-16', bytes: 65000000, digest: 'sha256:3333333333333333333333333333333333333333333333333333333333333333', href: 'https://micaos.dev/docs/user/download/#mica-uefi-x64-dev-20260916-0845.root.micaupd', filename: 'mica-uefi-x64-dev-20260916-0845.root.micaupd' },
  { board: 'uefi-x64', profile: 'dev', kind: 'image', version: '20260915-2230', deploymentId: 'sample-uefi-x64-dev-20260915-2230', releasedAt: '2026-09-15', bytes: 82000000, digest: 'sha256:4444444444444444444444444444444444444444444444444444444444444444', href: 'https://micaos.dev/docs/user/download/#mica-uefi-x64-dev-20260915-2230.img.gz', filename: 'mica-uefi-x64-dev-20260915-2230.img.gz' },
  { board: 'cx3576', profile: 'dev', kind: 'image', version: '20260916-0845', deploymentId: 'sample-cx3576-dev-20260916-0845', releasedAt: '2026-09-16', bytes: 86000000, digest: 'sha256:5555555555555555555555555555555555555555555555555555555555555555', href: 'https://micaos.dev/docs/user/download/#mica-cx3576-dev-20260916-0845.img.gz', filename: 'mica-cx3576-dev-20260916-0845.img.gz' },
  { board: 'cx3576', profile: 'dev', kind: 'update', variant: 'full', version: '20260916-0845', deploymentId: 'sample-cx3576-dev-20260916-0845', releasedAt: '2026-09-16', bytes: 85000000, digest: 'sha256:6666666666666666666666666666666666666666666666666666666666666666', href: 'https://micaos.dev/docs/user/download/#mica-cx3576-dev-20260916-0845.micaupd', filename: 'mica-cx3576-dev-20260916-0845.micaupd' },
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

/**
 * GitHub answers a rate-limited anonymous call with 403, the same status as a
 * permission refusal. The rate-limit headers are what tell the two apart.
 */
function githubFailure(response: Response): string {
  const remaining = response.headers.get('x-ratelimit-remaining')
  const reset = Number(response.headers.get('x-ratelimit-reset'))
  const limit = remaining === null
    ? ''
    : ` (rate limit remaining ${remaining}${reset ? `, resets ${new Date(reset * 1000).toISOString()}` : ''})`
  return `github answered ${response.status}${limit}`
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
    throw new Error(githubFailure(latest))

  const release = (await latest.json()) as GithubRelease
  const asset = release.assets.find(candidate => candidate.name === INDEX_ASSET)
  if (!asset)
    throw new Error(`${release.tag_name} carries no ${INDEX_ASSET}`)

  const index = await fetch(asset.browser_download_url, { headers: { accept: 'application/json' } })
  if (!index.ok)
    throw new Error(`${INDEX_ASSET} answered ${index.status}`)

  const downloads = downloadsFromIndex(await index.json())
  // An index that names products but parses to nothing means the shape moved
  // under the parser, not that everything was unpublished. Keep what is stored:
  // an empty write would blank every board page until someone noticed.
  if (downloads.length === 0) {
    const previous = await env.KV.get<StoredCatalogue>(KEY, 'json')
    if (previous && previous.downloads.length > 0)
      throw new Error(`${release.tag_name} parsed to no downloads; keeping ${previous.latestRelease}`)
  }

  const stored: StoredCatalogue = {
    downloads,
    refreshedAt: new Date().toISOString(),
    latestRelease: release.tag_name,
  }

  await env.KV.put(KEY, JSON.stringify(stored))
  return stored
}

/**
 * Every refresh goes through here, so each attempt leaves a trace: when, what
 * started it, and why it failed. Before this, the cron swallowed its errors and
 * a catalogue could go stale for hours with nothing to say why.
 */
export async function recordedRefresh(env: Env, trigger: RefreshTrigger): Promise<StoredCatalogue> {
  const now = new Date().toISOString()
  const previous = (await env.KV.get<RefreshStatus>(STATUS_KEY, 'json')) ?? {}

  try {
    const stored = await refresh(env)
    const status: RefreshStatus = { lastAttemptAt: now, trigger, lastSuccessAt: now, lastError: null }
    await env.KV.put(STATUS_KEY, JSON.stringify(status))
    return stored
  }
  catch (error) {
    const status: RefreshStatus = {
      lastAttemptAt: now,
      trigger,
      lastSuccessAt: previous.lastSuccessAt,
      lastError: { at: now, message: (error as Error).message },
    }
    await env.KV.put(STATUS_KEY, JSON.stringify(status))
    throw error
  }
}

async function catalogue(env: Env, ctx: ExecutionContext): Promise<Response> {
  if (env.CATALOG_DEMO === '1')
    return json({ downloads: SAMPLE, sample: true, refreshedAt: null }, CACHE_SECONDS)

  const [stored, status] = await Promise.all([
    env.KV.get<StoredCatalogue>(KEY, 'json'),
    env.KV.get<RefreshStatus>(STATUS_KEY, 'json'),
  ])
  if (!stored) {
    // Nothing stored yet — a fresh deployment, before the first cron. Fill it in
    // the background rather than making this request wait on GitHub, and hold
    // the empty answer briefly so the next request finds the catalogue.
    ctx.waitUntil(recordedRefresh(env, 'fill').catch(() => {}))
    return json({ downloads: [], refreshedAt: null, status }, 60)
  }

  return json({ ...stored, status }, CACHE_SECONDS)
}

async function manualRefresh(request: Request, env: Env): Promise<Response> {
  const expected = env.REFRESH_TOKEN
  const given = request.headers.get('authorization')
  // With no token configured the endpoint is closed, not open: a refresh that
  // anyone can trigger is a way to spend the upstream rate limit.
  if (!expected || given !== `Bearer ${expected}`)
    return new Response('unauthorized', { status: 401 })

  try {
    const stored = await recordedRefresh(env, 'manual')
    return json({ refreshedAt: stored.refreshedAt, downloads: stored.downloads.length, release: stored.latestRelease }, 0)
  }
  catch (error) {
    // A failed refresh has to look failed to whoever called it.
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 502,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    })
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

  /** The cron trigger; a failure leaves the stored copy standing and is recorded. */
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(recordedRefresh(env, 'cron').catch(() => {}))
  },
}
