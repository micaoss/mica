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
 * contract refuses hand-written release identities presented as real.
 */
const SAMPLE = [
  { board: 'x64', profile: 'dev', version: '2026.09-1', deploymentId: 'sample-x64-dev', kind: 'image', bytes: 1_073_741_824, digest: 'sha256:0000000000000000000000000000000000000000000000000000000000000000', href: 'https://micaos.dev/docs/user/download/' },
  { board: 'x64', profile: 'prod', version: '2026.09-1', deploymentId: 'sample-x64-prod', kind: 'image', bytes: 1_020_000_000, digest: 'sha256:1111111111111111111111111111111111111111111111111111111111111111', href: 'https://micaos.dev/docs/user/download/' },
  { board: 'virt-arm64', profile: 'dev', version: '2026.09-1', deploymentId: 'sample-virt-dev', kind: 'image', bytes: 998_000_000, digest: 'sha256:2222222222222222222222222222222222222222222222222222222222222222', href: 'https://micaos.dev/docs/user/download/' },
  { board: 'cx3576', profile: 'prod', version: '2026.08-3', deploymentId: 'sample-cx3576', kind: 'update', bytes: 52_428_800, digest: 'sha256:3333333333333333333333333333333333333333333333333333333333333333', href: 'https://micaos.dev/docs/user/download/' },
  { board: 'cx3576', profile: 'prod', version: '2026.08-3', deploymentId: 'sample-cx3576', kind: 'kernel', bytes: 18_874_368, digest: 'sha256:4444444444444444444444444444444444444444444444444444444444444444', href: 'https://micaos.dev/docs/user/download/' },
  { board: 's905x5m', profile: 'dev', version: '2026.08-1', deploymentId: 'sample-s905x5m', kind: 'firmware', bytes: 4_194_304, digest: 'sha256:5555555555555555555555555555555555555555555555555555555555555555', href: 'https://micaos.dev/docs/user/download/' },
]

const CATALOG_PATH = '/api/catalog'
/** Long enough to stay inside GitHub's rate limit, short enough to be current. */
const CACHE_SECONDS = 300

function json(body: unknown, seconds: number): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': `public, max-age=${seconds}`,
    },
  })
}

async function catalog(env: Env): Promise<Response> {
  if (!env.CATALOG_SOURCE) {
    return env.CATALOG_DEMO === '1'
      ? json({ artifacts: SAMPLE, sample: true }, CACHE_SECONDS)
      : json({ artifacts: [] }, CACHE_SECONDS)
  }

  try {
    const upstream = await fetch(env.CATALOG_SOURCE, {
      headers: { accept: 'application/json' },
    })
    if (!upstream.ok)
      return json({ artifacts: [] }, 60)

    // Passed through unchanged: the page validates every entry and drops what it
    // cannot read, so a malformed upstream degrades to an empty table rather
    // than to invented rows.
    return json(await upstream.json(), CACHE_SECONDS)
  }
  catch {
    return json({ artifacts: [] }, 60)
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
