import type { Download } from '../src/features/download/catalog'
import type { Catalogue } from '../src/features/download/products-catalog'
import boards from '../boards.json'
import { checkCatalog } from '../src/features/download/catalog-check'
import { CATALOGUE_VERSION, catalogueFrom, NO_WORDS, productsUrl, readProducts } from '../src/features/download/products-catalog'
import { RES_UPDATE_ROOT } from '../src/features/download/res-catalog'

/**
 * The site is static; this Worker exists for one route.
 *
 * `GET /api/catalog` reads the product catalogue the resource service serves
 * for the website (one document: the listed boards and products, each
 * product's newest release, and the words they are called by), parses it into
 * the download rows and answers both. The answer is held in the edge cache for
 * ten minutes, so a release, or a word an admin changed, shows on the site
 * within that window with nothing to run.
 *
 * A copy of the last answer that parsed is kept beside it. Once the ten minutes
 * are over that copy is answered at once, marked `refreshing`, while the
 * document is read again behind the response: a visitor never waits for the
 * resource service unless nothing was ever read. The same copy is what a
 * failing resource service is answered from.
 */

export interface Env {
  /** `1` answers a labelled sample instead of reading the resource service. */
  CATALOG_DEMO?: string
  /** The update root the document is read under. */
  CATALOG_ROOT?: string
}

/** The two calls made on the edge cache. */
export interface CatalogueCache {
  match: (key: string) => Promise<Response | undefined>
  put: (key: string, response: Response) => Promise<void>
}

export interface Deps {
  read: typeof readProducts
  cache: CatalogueCache
}

interface Context {
  waitUntil: (promise: Promise<unknown>) => void
}

/** How the last read went, beside the rows, so a stale answer says so. */
export interface RefreshStatus {
  lastAttemptAt?: string
  /** What read the copy: `request`. */
  trigger?: string
  lastSuccessAt?: string
  /** Why the last attempt failed; null once one succeeds again. */
  lastError?: { at: string, message: string } | null
}

type Answer = Omit<Catalogue, 'refreshedAt' | 'source'> & {
  refreshedAt: string | null
  source?: string
  status: RefreshStatus
  /** Set on an answer served from the last good copy while a new one is read. */
  refreshing?: true
}

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
 * release; it exists so the filters can be seen working where nothing is
 * published. Every row needs its own href: the table keys on it, and rows
 * sharing one would reproduce the stale-list bug the key fixed.
 */
const SAMPLE: Download[] = [
  { board: 'uefi-x64', profile: 'basic', kind: 'image', variant: 'disk', version: '20260916-0845', deploymentId: 'sample-uefi-x64-basic', releasedAt: '2026-09-16', bytes: 82_000_000, digest: 'sha256:0000000000000000000000000000000000000000000000000000000000000000', href: 'https://micaos.dev/docs/start/download/#image', filename: 'mica-uefi-x64.basic-20260916-0845.img.gz' },
  { board: 'uefi-x64', profile: 'basic', kind: 'update', variant: 'full', version: '20260916-0845', deploymentId: 'sample-uefi-x64-basic', releasedAt: '2026-09-16', bytes: 81_000_000, digest: 'sha256:1111111111111111111111111111111111111111111111111111111111111111', href: 'https://micaos.dev/docs/start/download/#full', filename: 'mica-uefi-x64.basic-20260916-0845.micaupd' },
  { board: 'cx3576', profile: 'full', kind: 'image', variant: 'disk', version: '20260916-0847', deploymentId: 'sample-cx3576-full', releasedAt: '2026-09-16', bytes: 86_000_000, digest: 'sha256:2222222222222222222222222222222222222222222222222222222222222222', href: 'https://micaos.dev/docs/start/download/#cx-image', filename: 'mica-cx3576.full-20260916-0847.img.gz' },
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

/** An answer that is about to be replaced is not for a browser to keep. */
function replyStale(answer: Answer): Response {
  return new Response(JSON.stringify({ ...answer, refreshing: true }), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

/** Reads the resource service; a board the site has no page for is named in the status. */
async function fromRes(root: string, read: Deps['read'], now: string): Promise<Answer> {
  const document = await read(root)
  const catalogue = catalogueFrom(document, productsUrl(root), now)
  const problems = checkCatalog(document, catalogue.downloads, SITE_BOARDS)

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

/**
 * Reads the document and stores the answer. A document that does not answer
 * must not read as "nothing published": the last answer that parsed is kept,
 * with what failed in its status, and the resource service is asked again a
 * minute later.
 */
async function refresh(root: string, keys: { fresh: string, lastGood: string }, previous: Answer | null, { read, cache }: Deps): Promise<Answer> {
  const now = new Date().toISOString()
  try {
    const answer = await fromRes(root, read, now)
    await Promise.all([
      cache.put(keys.fresh, json(answer, FRESH_SECONDS)),
      cache.put(keys.lastGood, json(answer, LAST_GOOD_SECONDS)),
    ])
    return answer
  }
  catch (error) {
    const lastError = { at: now, message: (error as Error).message }
    const answer: Answer = previous
      ? { ...previous, status: { ...previous.status, lastAttemptAt: now, lastError } }
      : { version: CATALOGUE_VERSION, downloads: [], ...NO_WORDS, refreshedAt: null, status: { lastAttemptAt: now, trigger: 'request', lastError } }

    await cache.put(keys.fresh, json(answer, FAILURE_SECONDS))
    return answer
  }
}

async function catalogue(origin: string, env: Env, ctx: Context, deps: Deps): Promise<Response> {
  if (env.CATALOG_DEMO === '1')
    return reply({ version: CATALOGUE_VERSION, downloads: SAMPLE, ...NO_WORDS, sample: true, refreshedAt: null })

  // The page asks with its build id in the query; the cached answer is one.
  // The shape's version is in the key, so a copy of another shape is never read.
  const keys = {
    fresh: `${origin}${CATALOG_PATH}/v${CATALOGUE_VERSION}/fresh`,
    lastGood: `${origin}${CATALOG_PATH}/v${CATALOGUE_VERSION}/last-good`,
  }
  const root = env.CATALOG_ROOT ?? RES_UPDATE_ROOT

  const held = await deps.cache.match(keys.fresh)
  if (held)
    return reply(await held.json())

  const last = await deps.cache.match(keys.lastGood)
  if (last) {
    const previous = await last.json() as Answer
    ctx.waitUntil(refresh(root, keys, previous, deps))
    return replyStale(previous)
  }

  return reply(await refresh(root, keys, null, deps))
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
    return handle(request, env, ctx, { read: readProducts, cache })
  },
}
