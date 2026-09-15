/**
 * The site is static; this Worker exists for one route.
 *
 * `GET /api/catalog` answers the download page's artifact catalogue. It reads
 * `CATALOG_SOURCE` — a URL serving the same JSON — and passes it through, so the
 * page has one contract whatever ends up publishing the metadata. With no
 * source configured it answers an empty catalogue, which is the honest state
 * until a product image is published: `mica-build` cuts no release yet.
 *
 * Static assets are served by Cloudflare before this runs; only a request that
 * matches no asset reaches here.
 */

interface Env {
  /** URL of the upstream catalogue. Unset until something publishes one. */
  CATALOG_SOURCE?: string
  /** `1` serves the sample catalogue below, marked as a sample in the answer. */
  CATALOG_DEMO?: string
}

/**
 * A sample, and labelled as one everywhere it surfaces. Nothing here is a
 * release: no repository publishes a product image yet, and the content
 * contract refuses hand-written release identities presented as real. Several
 * boards carry more than one version and more than one form, so a board page's
 * filters and history control have something to work on.
 */
const SAMPLE = [
  { board: 'x64', profile: 'dev', kind: 'image', version: '2026.09-2', deploymentId: 'sample-x64-dev-2', releasedAt: '2026-09-12', bytes: 1_073_741_824, digest: 'sha256:0000000000000000000000000000000000000000000000000000000000000000', href: 'https://micaos.dev/docs/user/download/', filename: 'disk.img' },
  { board: 'x64', profile: 'dev', kind: 'image', version: '2026.09-1', deploymentId: 'sample-x64-dev-1', releasedAt: '2026-09-02', bytes: 1_070_000_000, digest: 'sha256:1111111111111111111111111111111111111111111111111111111111111111', href: 'https://micaos.dev/docs/user/download/', filename: 'disk.img' },
  { board: 'x64', profile: 'dev', kind: 'update', version: '2026.09-2', deploymentId: 'sample-x64-dev-2', releasedAt: '2026-09-12', bytes: 52_428_800, digest: 'sha256:2222222222222222222222222222222222222222222222222222222222222222', href: 'https://micaos.dev/docs/user/download/', filename: 'x64-2026.09-2.micaupd' },
  { board: 'x64', profile: 'prod', kind: 'image', version: '2026.09-2', deploymentId: 'sample-x64-prod-2', releasedAt: '2026-09-12', bytes: 1_020_000_000, digest: 'sha256:3333333333333333333333333333333333333333333333333333333333333333', href: 'https://micaos.dev/docs/user/download/', filename: 'disk.img' },
  { board: 'virt-arm64', profile: 'dev', kind: 'image', version: '2026.09-1', deploymentId: 'sample-virt-dev-1', releasedAt: '2026-09-02', bytes: 998_000_000, digest: 'sha256:4444444444444444444444444444444444444444444444444444444444444444', href: 'https://micaos.dev/docs/user/download/', filename: 'disk.img' },
  { board: 'cx3576', profile: 'prod', kind: 'image', version: '2026.08-3', deploymentId: 'sample-cx3576-3', releasedAt: '2026-08-20', bytes: 1_240_000_000, digest: 'sha256:5555555555555555555555555555555555555555555555555555555555555555', href: 'https://micaos.dev/docs/user/download/', filename: 'disk.img' },
  { board: 'cx3576', profile: 'prod', kind: 'image', version: '2026.08-1', deploymentId: 'sample-cx3576-1', releasedAt: '2026-08-04', bytes: 1_230_000_000, digest: 'sha256:6666666666666666666666666666666666666666666666666666666666666666', href: 'https://micaos.dev/docs/user/download/', filename: 'disk.img' },
  { board: 'cx3576', profile: 'prod', kind: 'firmware', version: '2026.08-3', deploymentId: 'sample-cx3576-3', releasedAt: '2026-08-20', bytes: 4_194_304, digest: 'sha256:7777777777777777777777777777777777777777777777777777777777777777', href: 'https://micaos.dev/docs/user/download/', filename: 'cx3576-firmware.tar' },
  { board: 's905x5m', profile: 'dev', kind: 'image', version: '2026.08-1', deploymentId: 'sample-s905x5m-1', releasedAt: '2026-08-04', bytes: 1_180_000_000, digest: 'sha256:8888888888888888888888888888888888888888888888888888888888888888', href: 'https://micaos.dev/docs/user/download/', filename: 'disk.img' },
]

const CATALOG_PATH = '/api/catalog'
/** Long enough to stay inside GitHub's rate limit, short enough to be current. */
const CACHE_SECONDS = 300

function json(body: unknown, seconds: number): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // The browser holds it briefly; the edge holds it for the same window the
      // Worker's own cache uses. Without `cdn-cache-control` the zone's default
      // browser TTL applies and a catalogue change takes hours to surface.
      'cache-control': 'public, max-age=60',
      'cdn-cache-control': `public, max-age=${seconds}`,
    },
  })
}

async function catalog(env: Env): Promise<Response> {
  if (!env.CATALOG_SOURCE) {
    return env.CATALOG_DEMO === '1'
      ? json({ downloads: SAMPLE, sample: true }, CACHE_SECONDS)
      : json({ downloads: [] }, CACHE_SECONDS)
  }

  try {
    const upstream = await fetch(env.CATALOG_SOURCE, {
      headers: { accept: 'application/json' },
    })
    if (!upstream.ok)
      return json({ downloads: [] }, 60)

    // Passed through unchanged: the page validates every entry and drops what it
    // cannot read, so a malformed upstream degrades to an empty table rather
    // than to invented rows.
    return json(await upstream.json(), CACHE_SECONDS)
  }
  catch {
    return json({ downloads: [] }, 60)
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname !== CATALOG_PATH)
      return new Response('not found', { status: 404 })
    if (request.method !== 'GET')
      return new Response('method not allowed', { status: 405, headers: { allow: 'GET' } })

    const cache = (caches as unknown as { default: Cache }).default
    const hit = await cache.match(request)
    if (hit)
      return hit

    const response = await catalog(env)
    await cache.put(request, response.clone())
    return response
  },
}
