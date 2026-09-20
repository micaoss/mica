import { describe, expect, it } from 'vitest'
import allowlist from '../../../published-docs.json'
import { DOC_GROUPS, PUBLISHED_DOCS, SLUG_BY_SOURCE } from './published'

describe('the publishing allowlist', () => {
  it('gives every document a unique slug', () => {
    const slugs = PUBLISHED_DOCS.map(doc => doc.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('publishes every document in at least one locale', () => {
    for (const doc of PUBLISHED_DOCS)
      expect(Object.keys(doc.sources).length).toBeGreaterThan(0)
  })

  it('maps every declared source back to its slug', () => {
    for (const doc of PUBLISHED_DOCS) {
      for (const source of Object.values(doc.sources))
        expect(SLUG_BY_SOURCE.get(source)).toBe(doc.slug)
    }
  })

  it('keeps the engineering record out of the site', () => {
    const sources = PUBLISHED_DOCS.flatMap(doc => Object.values(doc.sources))
    for (const source of sources) {
      expect(source).not.toMatch(/^(?:design|decisions|task|plan|boards|research)\//)
      expect(source).not.toMatch(/^zh\/(?:design|decisions|task|plan)\//)
    }
  })

  it('publishes exactly what the allowlist file names', () => {
    const named = allowlist.groups.flatMap(group => group.docs.map((doc) => {
      const entry = doc as { name: string, dir?: string, slug?: string }
      return entry.slug ?? `${entry.dir ?? 'user'}/${entry.name}`
    }))
    expect(PUBLISHED_DOCS.map(doc => doc.slug)).toEqual(named)
  })

  it('reads an entry outside docs/user/ from its own directory in both locales', () => {
    const hardware = PUBLISHED_DOCS.find(doc => doc.slug === 'hardware/cx3576')
    expect(hardware?.sources).toEqual({
      en: 'hardware/cx3576.md',
      zh: 'zh/hardware/cx3576.md',
    })
  })

  it('lets an entry override its slug, so a directory index is not /README/', () => {
    const index = PUBLISHED_DOCS.find(doc => doc.sources.en === 'hardware/README.md')
    expect(index?.slug).toBe('hardware')
  })

  it('lists every group the sidebar renders', () => {
    expect(DOC_GROUPS.map(group => group.id)).toEqual([
      'start',
      'hardware',
      'operating',
      'trouble',
      'reference',
    ])
  })
})
