import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { OLD_SETUP_HOST, SETUP_HOST } from '../setup/src/config'
import redirect from './setup-redirect'

describe('the provisioning page\'s old host', () => {
  it('is init.micaos.dev, and setup-test.micaos.dev is the old one', () => {
    expect(SETUP_HOST).toBe('init.micaos.dev')
    expect(OLD_SETUP_HOST).toBe('setup-test.micaos.dev')
  })

  it('answers every request with a permanent redirect to the same path on the page\'s host', async () => {
    for (const url of [`https://${OLD_SETUP_HOST}/`, `http://${OLD_SETUP_HOST}/sw.js?lang=en`]) {
      const res = await redirect.fetch(new Request(url))
      const { pathname, search } = new URL(url)
      expect(res.status).toBe(301)
      expect(res.headers.get('Location')).toBe(`https://${SETUP_HOST}${pathname}${search}`)
      expect(res.headers.get('Strict-Transport-Security')).toBe('max-age=31536000')
    }
  })

  it('deploys on the old host alone', () => {
    const wrangler = readFileSync('wrangler.setup-redirect.jsonc', 'utf8')
    expect(wrangler).toContain(`{ "pattern": "${OLD_SETUP_HOST}", "custom_domain": true }`)
    expect(wrangler).not.toContain(`"${SETUP_HOST}"`)
  })
})
