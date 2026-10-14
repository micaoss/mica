import type { Download } from '../src/features/download/catalog'
import type { BoardCatalogue, IndexCatalogue } from '../src/features/download/products-catalog'
import type { Rewriter } from './pages'
import { BOARD_NAME, boardFrom, boardUrl, CATALOGUE_VERSION, indexFrom, indexUrl, NO_WORDS, readBoard, readIndex } from '../src/features/download/products-catalog'
import { RES_UPDATE_ROOT } from '../src/features/download/res-catalog'
import { PUBLISHED_DOCS } from '../src/shared/docs/published'
import { BOARD_PLACEHOLDER, BOARD_TEMPLATE, fillBoards } from './pages'

/**
 * The site is static; this Worker exists for what the resource service owns.
 *
 * The resource service says which boards and products there are, what they are
 * called and which documents a board's page links to. The Worker reads its
 * product catalogue and answers it in the two levels it is served in:
 *
 *   GET /api/catalog           the index: every listed board and product
 *   GET /api/catalog/<board>   one board: its download rows, their words, its guides
 *
 * An answer is held in the edge cache for ten minutes, so a release, a board
 * or a word an admin changed shows on the site within that window with nothing
 * to run. A copy of the last answer that parsed is kept beside it. Once the ten
 * minutes are over that copy is answered at once, marked `refreshing`, while
 * the document is read again behind the response: a visitor never waits for
 * the resource service unless nothing was ever read. The same copy is what a
 * failing resource service is answered from.
 *
 * The pages that depend on the catalogue are served through here as well
 * (`run_worker_first` in `wrangler.jsonc`). A board's download page is not
 * built per board: `/download/<board>/` is the one built template, served for
 * any board the catalogue lists and 404 for one it does not, so a board an
 * admin adds or hides appears or disappears with no deploy. Board wording in a
 * page's HTML is filled from the index (`pages.ts`). Whatever goes wrong on
 * that path, the page is served as built.
 */

export interface Env {
  /** `1` answers a labelled sample instead of reading the resource service. */
  CATALOG_DEMO?: string
  /** The update root the documents are read under. */
  CATALOG_ROOT?: string
  /** The built site. */
  ASSETS?: { fetch: (request: Request) => Promise<Response> }
}

/** The two calls made on the edge cache. */
export interface CatalogueCache {
  match: (key: string) => Promise<Response | undefined>
  put: (key: string, response: Response) => Promise<void>
}

export interface Deps {
  readIndex: typeof readIndex
  readBoard: typeof readBoard
  cache: CatalogueCache
  /** A new HTMLRewriter; absent where pages are not rewritten. */
  rewriter?: () => Rewriter
}

interface Context {
  waitUntil: (promise: Promise<unknown>) => void
}

/** How the last read went, beside the answer, so a stale one says so. */
export interface RefreshStatus {
  lastAttemptAt?: string
  /** What read the copy: `request`. */
  trigger?: string
  lastSuccessAt?: string
  /** Why the last attempt failed, or what is wrong with what was read; null otherwise. */
  lastError?: { at: string, message: string } | null
}

/** An answer as held: what was read, or that the catalogue lists no such document. */
type Held<T> = (T & { status: RefreshStatus, notListed?: undefined }) | { notListed: true, status: RefreshStatus }

const CATALOG_PATH = '/api/catalog'
/** How long an answer read from the resource service is served. */
const FRESH_SECONDS = 600
/** How long a failure is served before the resource service is asked again. */
const FAILURE_SECONDS = 60
/** How long the last answer that parsed stays available as the fallback. */
const LAST_GOOD_SECONDS = 7 * 24 * 60 * 60
const PUBLISHED = new Set(PUBLISHED_DOCS.map(doc => doc.slug))

/**
 * A sample, and labelled as one everywhere it surfaces. Nothing here is a
 * release; it exists so the filters can be seen working where nothing is
 * published. Every row needs its own href: the table keys on it.
 */
const SAMPLE: Download[] = [
  { board: 'uefi-x64', profile: 'basic', kind: 'image', variant: 'disk', version: '20260101-0845', deploymentId: 'sample-uefi-x64-basic', releasedAt: '2026-01-01', bytes: 82_000_000, digest: 'sha256:0000000000000000000000000000000000000000000000000000000000000000', href: 'https://micaos.dev/docs/start/download/#image', filename: 'mica-uefi-x64.basic-20260916-0845.img.gz' },
  { board: 'uefi-x64', profile: 'basic', kind: 'update', variant: 'full', version: '20260101-0845', deploymentId: 'sample-uefi-x64-basic', releasedAt: '2026-01-01', bytes: 81_000_000, digest: 'sha256:1111111111111111111111111111111111111111111111111111111111111111', href: 'https://micaos.dev/docs/start/download/#full', filename: 'mica-uefi-x64.basic-20260916-0845.micaupd' },
  { board: 'cx3576', profile: 'full', kind: 'image', variant: 'disk', version: '20260101-0847', deploymentId: 'sample-cx3576-full', releasedAt: '2026-01-01', bytes: 86_000_000, digest: 'sha256:2222222222222222222222222222222222222222222222222222222222222222', href: 'https://micaos.dev/docs/start/download/#cx-image', filename: 'mica-cx3576.full-20260916-0847.img.gz' },
]

function json(body: unknown, seconds: number, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': `public, max-age=${seconds}`,
    },
  })
}

/** What a browser gets: held for a minute whatever the edge holds, or not kept while it is being replaced. */
function reply<T>(answer: Held<T>, stale: boolean): Response {
  if (answer.notListed)
    return json({ error: 'not_listed' }, 60, 404)
  if (!stale)
    return json(answer, 60)
  return new Response(JSON.stringify({ ...answer, refreshing: true }), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

/**
 * Reads a document and stores the answer. A document that does not answer must
 * not read as "nothing published": the last answer that parsed is kept, with
 * what failed in its status, and the resource service is asked again a minute
 * later.
 */
async function refresh<T>(keys: { fresh: string, lastGood: string }, read: (now: string) => Promise<{ answer: T, problem?: string } | null>, previous: Held<T> | null, empty: T, cache: CatalogueCache): Promise<Held<T>> {
  const now = new Date().toISOString()
  try {
    const got = await read(now)
    const status: RefreshStatus = { lastAttemptAt: now, trigger: 'request', lastSuccessAt: now, lastError: got?.problem ? { at: now, message: got.problem } : null }
    const answer: Held<T> = got ? { ...got.answer, status } : { notListed: true, status }
    await Promise.all([
      cache.put(keys.fresh, json(answer, FRESH_SECONDS)),
      cache.put(keys.lastGood, json(answer, LAST_GOOD_SECONDS)),
    ])
    return answer
  }
  catch (error) {
    const lastError = { at: now, message: (error as Error).message }
    const answer: Held<T> = previous
      ? { ...previous, status: { ...previous.status, lastAttemptAt: now, lastError } }
      : { ...empty, status: { lastAttemptAt: now, trigger: 'request', lastError } }

    await cache.put(keys.fresh, json(answer, FAILURE_SECONDS))
    return answer
  }
}

/**
 * A document as it is held: the fresh answer, else the last good one while a
 * new one is read behind the response, else a first read.
 */
async function held<T>(name: string, origin: string, ctx: Context, cache: CatalogueCache, read: (now: string) => Promise<{ answer: T, problem?: string } | null>, empty: T): Promise<{ answer: Held<T>, stale: boolean }> {
  // The page asks with its build id in the query; the cached answer is one.
  // The shape's version is in the key, so a copy of another shape is never read.
  const base = `${origin}${CATALOG_PATH}/v${CATALOGUE_VERSION}/${name}`
  const keys = { fresh: `${base}/fresh`, lastGood: `${base}/last-good` }

  const fresh = await cache.match(keys.fresh)
  if (fresh)
    return { answer: await fresh.json() as Held<T>, stale: false }

  const last = await cache.match(keys.lastGood)
  if (last) {
    const previous = await last.json() as Held<T>
    ctx.waitUntil(refresh(keys, read, previous, empty, cache))
    return { answer: previous, stale: true }
  }

  return { answer: await refresh(keys, read, null, empty, cache), stale: false }
}

function root(env: Env): string {
  return env.CATALOG_ROOT ?? RES_UPDATE_ROOT
}

function heldIndex(origin: string, env: Env, ctx: Context, deps: Deps) {
  const empty: IndexCatalogue = { version: CATALOGUE_VERSION, boards: [], products: [], refreshedAt: '', source: indexUrl(root(env)) }
  return held<IndexCatalogue>('index', origin, ctx, deps.cache, async now => ({ answer: indexFrom(await deps.readIndex(root(env)), indexUrl(root(env)), now) }), empty)
}

function heldBoard(board: string, origin: string, env: Env, ctx: Context, deps: Deps) {
  const source = boardUrl(root(env), board)
  const empty: BoardCatalogue = { version: CATALOGUE_VERSION, board, downloads: [], ...NO_WORDS, guides: [], staleGuides: [], refreshedAt: '', source }
  return held<BoardCatalogue>(`board/${board}`, origin, ctx, deps.cache, async (now) => {
    const document = await deps.readBoard(root(env), board)
    if (!document)
      return null
    const answer = boardFrom(board, document, slug => PUBLISHED.has(slug), source, now)
    // A guide to a document this site does not publish is left out; an admin finds it here.
    const problem = answer.staleGuides.length > 0 ? `${board}: guides name documents this site does not publish: ${answer.staleGuides.join(', ')}` : undefined
    return { answer, problem }
  }, empty)
}

async function catalogue(path: string, origin: string, env: Env, ctx: Context, deps: Deps): Promise<Response> {
  const board = path.slice(CATALOG_PATH.length + 1)
  if (path !== CATALOG_PATH && !BOARD_NAME.test(board))
    return new Response('not found', { status: 404 })

  if (env.CATALOG_DEMO === '1') {
    const boards = [...new Set(SAMPLE.map(row => row.board))]
    const empty = { zh: '', en: '' }
    return path === CATALOG_PATH
      ? json({ version: CATALOGUE_VERSION, boards: boards.map(name => ({ board: name, title: empty, hardware: empty, status: empty })), products: [], sample: true, refreshedAt: null }, 60)
      : json({ version: CATALOGUE_VERSION, board, downloads: SAMPLE.filter(row => row.board === board), ...NO_WORDS, guides: [], staleGuides: [], sample: true, refreshedAt: null }, 60)
  }

  const { answer, stale } = path === CATALOG_PATH
    ? await heldIndex(origin, env, ctx, deps)
    : await heldBoard(board, origin, env, ctx, deps)
  return reply(answer, stale)
}

/** A built asset, asked for whole: a filled page is never revalidated into keeping old words. */
function asset(request: Request, url: string, env: Env): Promise<Response> {
  const headers = new Headers(request.headers)
  headers.delete('if-none-match')
  headers.delete('if-modified-since')
  return env.ASSETS!.fetch(new Request(url, { method: request.method, headers }))
}

/** A filled page is not for a browser to keep as it is. */
function filled(body: BodyInit | null, from: Response): Response {
  const out = new Response(body, from)
  out.headers.delete('etag')
  out.headers.delete('last-modified')
  out.headers.delete('content-length')
  out.headers.set('cache-control', 'public, max-age=0, must-revalidate')
  return out
}

/**
 * A page of the site. A board's download page is the built template, for a
 * board the catalogue lists; any page has its board wording filled from the
 * index. A page is served as built when anything on the way fails, and a
 * board's page is served when the index cannot say which boards there are.
 */
async function page(request: Request, url: URL, env: Env, ctx: Context, deps: Deps): Promise<Response> {
  const board = /^(\/en)?\/download\/([^/]+)\/?$/.exec(url.pathname)
  if (!board || !BOARD_NAME.test(board[2]))
    return fill(request, await asset(request, request.url, env), url.origin, env, ctx, deps)

  const [, prefix = '', name] = board
  if (!url.pathname.endsWith('/'))
    return Response.redirect(`${url.origin}${url.pathname}/`, 301)

  const listed = name !== BOARD_TEMPLATE && await isListed(name, url.origin, env, ctx, deps)
  if (!listed)
    return asset(request, `${url.origin}${prefix}/download/${BOARD_TEMPLATE}/not-a-board`, env)

  const template = await asset(request, `${url.origin}${prefix}/download/${BOARD_TEMPLATE}/`, env)
  if (request.method !== 'GET' || template.status !== 200)
    return template
  const html = (await template.text()).replaceAll(BOARD_PLACEHOLDER, name)
  return fill(request, filled(html, template), url.origin, env, ctx, deps)
}

/** Whether the catalogue lists a board; yes when it cannot be asked, so the page still opens. */
async function isListed(board: string, origin: string, env: Env, ctx: Context, deps: Deps): Promise<boolean> {
  try {
    const { answer } = await heldIndex(origin, env, ctx, deps)
    if (answer.notListed || answer.boards.length === 0)
      return true
    return answer.boards.some(entry => entry.board === board)
  }
  catch {
    return true
  }
}

async function fill(request: Request, built: Response, origin: string, env: Env, ctx: Context, deps: Deps): Promise<Response> {
  if (!deps.rewriter || env.CATALOG_DEMO === '1' || request.method !== 'GET' || built.status !== 200 || !built.headers.get('content-type')?.includes('text/html'))
    return built

  try {
    const { answer } = await heldIndex(origin, env, ctx, deps)
    if (answer.notListed)
      return built
    const out = fillBoards(built, { ...NO_WORDS, boards: answer.boards }, deps.rewriter())
    return out === built ? built : filled(out.body, out)
  }
  catch {
    return built
  }
}

export async function handle(request: Request, env: Env, ctx: Context, deps: Deps): Promise<Response> {
  const url = new URL(request.url)

  if (url.pathname !== CATALOG_PATH && !url.pathname.startsWith(`${CATALOG_PATH}/`))
    return env.ASSETS ? page(request, url, env, ctx, deps) : new Response('not found', { status: 404 })
  if (request.method !== 'GET')
    return new Response('method not allowed', { status: 405, headers: { allow: 'GET' } })

  return catalogue(url.pathname, url.origin, env, ctx, deps)
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // The DOM's CacheStorage type has no `default`; the Workers runtime does.
    const cache = (caches as unknown as { default: CatalogueCache }).default
    return handle(request, env, ctx, { readIndex, readBoard, cache, rewriter: () => new HTMLRewriter() as unknown as Rewriter })
  },
}
