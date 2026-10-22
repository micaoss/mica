import { SETUP_HOST } from '../setup/src/config'

/**
 * The provisioning page's old host: every request, http or https, is sent to
 * the same path on SETUP_HOST with a 301. A Worker of its own, so the page's
 * deployment stays assets-only and keeps its `_headers`.
 */
export default {
  async fetch(request: Request): Promise<Response> {
    const { pathname, search } = new URL(request.url)
    return new Response(null, {
      status: 301,
      headers: {
        'Location': `https://${SETUP_HOST}${pathname}${search}`,
        'Strict-Transport-Security': 'max-age=31536000',
      },
    })
  },
}
