import { describe, expect, it } from 'vitest'
import { quickHrefs, sectionHrefs } from './portal-links'
import { PUBLISHED_DOCS } from './published'

const REPO = 'https://github.com/micaoss/mica'

describe('portal links', () => {
  it('keeps the three start-here cards on the site', () => {
    for (const href of quickHrefs('zh')) expect(href).toMatch(/^\/docs\//)
    for (const href of quickHrefs('en')) expect(href).toMatch(/^\/en\/docs\//)
  })

  it('only points the cards at documents that are actually published', () => {
    const slugs = new Set(PUBLISHED_DOCS.map(doc => doc.slug))
    for (const href of quickHrefs('zh')) {
      const slug = href.replace(/^\/docs\//, '').replace(/\/$/, '')
      expect(slugs.has(slug)).toBe(true)
    }
  })

  it('lists one href for each of the portal\'s seven sections', () => {
    expect(sectionHrefs('zh')).toHaveLength(7)
    expect(sectionHrefs('en')).toHaveLength(7)
  })

  it('sends the engineering record to the repository, not the site', () => {
    const hrefs = sectionHrefs('zh')
    // Boards, design records, decisions, tasks and plans, changelog.
    for (const index of [0, 2, 3, 4, 5, 6]) expect(hrefs[index]).toContain(REPO)
  })

  it('keeps the published user documentation on the site', () => {
    expect(sectionHrefs('zh')[1]).toBe('/docs/user/quickstart/')
    expect(sectionHrefs('en')[1]).toBe('/en/docs/user/quickstart/')
  })
})
