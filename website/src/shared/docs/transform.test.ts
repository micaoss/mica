import { describe, expect, it } from 'vitest'
import { rewriteLinks, siteUrl, takeTitle } from './transform'

const slugBySource = new Map([
  ['user/quickstart.md', 'user/quickstart'],
  ['user/install.md', 'user/install'],
  ['zh/user/quickstart.md', 'user/quickstart'],
  ['zh/user/install.md', 'user/install'],
])

const upstreamPaths = new Set([
  'architecture.md',
  'user/quickstart.md',
  'user/install.md',
  'zh/user/quickstart.md',
  'zh/user/install.md',
  'design/build.md',
  'design/',
  'boards/porting.md',
  'boards/',
])

function rewrite(body: string, sourcePath = 'user/quickstart.md', locale: 'zh' | 'en' = 'en') {
  return rewriteLinks(body, { sourcePath, locale, slugBySource, upstreamPaths })
}

describe('takeTitle', () => {
  it('lifts the H1 out of the body', () => {
    const { title, body } = takeTitle('# Quickstart\n\nStart with x64 under QEMU.\n')
    expect(title).toBe('Quickstart')
    expect(body).toBe('Start with x64 under QEMU.\n')
  })

  it('rejects a document with no H1, since Starlight needs a title', () => {
    expect(() => takeTitle('Just a paragraph.\n')).toThrow(/H1/)
  })
})

describe('siteUrl', () => {
  it('serves the root locale without a prefix', () => {
    expect(siteUrl('zh', 'user/quickstart')).toBe('/docs/user/quickstart/')
    expect(siteUrl('en', 'user/quickstart')).toBe('/en/docs/user/quickstart/')
  })
})

describe('rewriteLinks', () => {
  it('sends a link to a published document to the site', () => {
    const result = rewrite('See [install](install.md).')
    expect(result.body).toBe('See [install](/en/docs/user/install/).')
    expect(result.internal).toBe(1)
    expect(result.problems).toEqual([])
  })

  it('uses the root locale path for Chinese documents', () => {
    const result = rewrite('见 [安装](install.md)。', 'zh/user/quickstart.md', 'zh')
    expect(result.body).toContain('(/docs/user/install/)')
  })

  it('sends a link to an unpublished but real document to the repository', () => {
    const result = rewrite('Follow [the build](../design/build.md).')
    expect(result.body).toBe(
      'Follow [the build](https://github.com/micaoss/mica/blob/main/docs/design/build.md).',
    )
    expect(result.external).toBe(1)
    expect(result.problems).toEqual([])
  })

  it('reports a link whose target does not exist upstream', () => {
    const result = rewrite('Read [nothing](../design/missing.md).')
    expect(result.problems).toHaveLength(1)
    expect(result.problems[0]).toContain('does not exist upstream')
    // The defective link is left untouched so the failure is traceable.
    expect(result.body).toContain('(../design/missing.md)')
  })

  it('reports a link that escapes the documentation root', () => {
    const result = rewrite('Up [and out](../../secrets.md).')
    expect(result.problems[0]).toContain('escapes the documentation root')
  })

  it('keeps the anchor when retargeting', () => {
    expect(rewrite('[step](install.md#step-2)').body).toBe('[step](/en/docs/user/install/#step-2)')
    expect(rewrite('[why](../design/build.md#rule)').body).toContain('/design/build.md#rule')
  })

  it('leaves absolute, protocol and in-page links alone', () => {
    const body = '[a](https://example.com) [b](mailto:x@y.z) [c](#section) [d](/already/absolute)'
    const result = rewrite(body)
    expect(result.body).toBe(body)
    expect(result.internal + result.external).toBe(0)
  })

  it('resolves directory links', () => {
    const result = rewrite('[boards](../boards/)')
    expect(result.body).toBe('[boards](https://github.com/micaoss/mica/blob/main/docs/boards/)')
    expect(result.external).toBe(1)
  })

  it('rewrites every link in a document, not just the first', () => {
    const result = rewrite('[a](install.md) and [b](install.md) and [c](../design/build.md)')
    expect(result.internal).toBe(2)
    expect(result.external).toBe(1)
  })
})
