import type { RefreshStatus, StoredCatalogue } from '../src/features/download/catalog-store'
import boards from '../boards.json'
import { checkCatalog } from '../src/features/download/catalog-check'
import { storedCatalogue } from '../src/features/download/catalog-store'
import { readCatalogue, RES_UPDATE_ROOT } from '../src/features/download/res-catalog'

/**
 * The site is static; this Worker exists for one route.
 *
 * `GET /api/catalog` reads the update documents the resource service serves
 * (the manifest, each product's history, each release's document), parses them
 * into the download rows and answers them. The answer is held in the edge
 * cache for ten minutes, so a release shows on the site within that window
 * with nothing to run. A copy of the last answer that parsed is kept beside
 * it, and is what a failing resource service is answered from.
 */

export interface Env {
  /** `1` answers a labelled sample instead of reading the resource service. */
  CATALOG_DEMO?: string
  /** The update root the documents are read from. */
  CATALOG_ROOT?: string
}

/** The two calls made on the edge cache. */
export interface CatalogueCache {
  match: (key: string) => Promise<Response | undefined>
  put: (key: string, response: Response) => Promise<void>
}

export interface Deps {
  read: typeof readCatalogue
  cache: CatalogueCache
}

interface Context {
  waitUntil: (promise: Promise<unknown>) => void
}

type Answer = Omit<StoredCatalogue, 'refreshedAt'> & { refreshedAt: string | null, status: RefreshStatus }

const CATALOG_PATH = '/api/catalog'
/** How long an answer read from the resource service is served. */
const FRESH_SECONDS = 600
/** How long a failure is served before the resource service is asked again. */
const FAILURE_SECONDS = 60
/** How long the last answer that parsed stays available as the fallback. */
const LAST_GOOD_SECONDS = 7 * 24 * 60 * 60
const SITE_BOARDS = boards.boards.map(row => row.board)

/**
 * A sample, and labelled as one everywhere it surfaces. Nothing here is a
 * release; it exists so the filters and the history control can be seen working
 * where nothing is published. Every row needs its own href: the table keys on
 * it, and rows sharing one would reproduce the stale-list bug the key fixed.
 */
const SAMPLE: StoredCatalogue['downloads'] = [
  { board: 'uefi-x64', profile: 'basic', kind: 'image', version: '20260916-0845', deploymentId: 'sample-uefi-x64-basic', releasedAt: '2026-09-16', bytes: 82_000_000, digest: 'sha256:0000000000000000000000000000000000000000000000000000000000000000', href: 'https://micaos.dev/docs/start/download/#image', filename: 'mica-uefi-x64.basic-20260916-0845.img.gz' },
  { board: 'uefi-x64', profile: 'basic', kind: 'update', variant: 'full', version: '20260916-0845', deploymentId: 'sample-uefi-x64-basic', releasedAt: '2026-09-16', bytes: 81_000_000, digest: 'sha256:1111111111111111111111111111111111111111111111111111111111111111', href: 'https://micaos.dev/docs/start/download/#full', filename: 'mica-uefi-x64.basic-20260916-0845.micaupd' },
  { board: 'cx3576', profile: 'full', kind: 'image', version: '20260916-0847', deploymentId: 'sample-cx3576-full', releasedAt: '2026-09-16', bytes: 86_000_000, digest: 'sha256:2222222222222222222222222222222222222222222222222222222222222222', href: 'https://micaos.dev/docs/start/download/#cx-image', filename: 'mica-cx3576.full-20260916-0847.img.gz' },
]

function json(body: unknown, seconds: number): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': `public, max-age=${seconds}`,
    },
  })
}

/** What a browser gets: the body, held for a minute whatever the edge holds. */
function reply(body: unknown): Response {
  return json(body, 60)
}

/** Reads the resource service; a board the site has no page for is named in the status. */
async function fromRes(root: string, read: Deps['read'], now: string): Promise<Answer> {
  const { manifest, releases } = await read(root)
  const catalogue = storedCatalogue(releases, `${root}v2/manifest.json`, now)
  const problems = checkCatalog(manifest, releases, SITE_BOARDS)

  return {
    ...catalogue,
    status: {
      lastAttemptAt: now,
      trigger: 'request',
      lastSuccessAt: now,
      lastError: problems.length > 0 ? { at: now, message: problems.join('; ') } : null,
    },
  }
}

async function catalogue(origin: string, env: Env, ctx: Context, { read, cache }: Deps): Promise<Response> {
  if (env.CATALOG_DEMO === '1')
    return reply({ downloads: SAMPLE, sample: true, refreshedAt: null })

  // The page asks with its build id in the query; the cached answer is one.
  const fresh = `${origin}${CATALOG_PATH}/fresh`
  const lastGood = `${origin}${CATALOG_PATH}/last-good`

  const held = await cache.match(fresh)
  if (held)
    return reply(await held.json())

  const now = new Date().toISOString()
  try {
    const answer = await fromRes(env.CATALOG_ROOT ?? RES_UPDATE_ROOT, read, now)
    ctx.waitUntil(Promise.all([
      cache.put(fresh, json(answer, FRESH_SECONDS)),
      cache.put(lastGood, json(answer, LAST_GOOD_SECONDS)),
    ]))
    return reply(answer)
  }
  catch (error) {
    // A document that does not answer must not read as "nothing published":
    // the last answer that parsed is served, and the status says what failed.
    const lastError = { at: now, message: (error as Error).message }
    const last = await cache.match(lastGood)
    const previous = last ? await last.json() as Answer : null
    const answer: Answer = previous
      ? { ...previous, status: { ...previous.status, lastAttemptAt: now, lastError } }
      : { downloads: [], refreshedAt: null, status: { lastAttemptAt: now, trigger: 'request', lastError } }

    ctx.waitUntil(cache.put(fresh, json(answer, FAILURE_SECONDS)))
    return reply(answer)
  }
}

export async function handle(request: Request, env: Env, ctx: Context, deps: Deps): Promise<Response> {
  const url = new URL(request.url)

  if (url.pathname !== CATALOG_PATH)
    return new Response('not found', { status: 404 })
  if (request.method !== 'GET')
    return new Response('method not allowed', { status: 405, headers: { allow: 'GET' } })

  return catalogue(url.origin, env, ctx, deps)
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // The DOM's CacheStorage type has no `default`; the Workers runtime does.
    const cache = (caches as unknown as { default: CatalogueCache }).default
    return handle(request, env, ctx, { read: readCatalogue, cache })
  },
}
