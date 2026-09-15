import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { en } from '@/shared/i18n/en'
import { zh } from '@/shared/i18n/zh'
import { ArchitectureSection } from './components/architecture-section'
import { BoardsSection } from './components/boards-section'
import { FlowSection } from './components/flow-section'
import { HeroSection } from './components/hero-section'
import { SiteFooter } from './components/site-footer'
import { StartSection } from './components/start-section'
import { docsHref, downloadHref, homeHref } from './links'

describe('landing sections', () => {
  it('renders the hero and points its call to action at the docs', () => {
    render(<HeroSection copy={zh} docsHref="/docs/" downloadHref="/download/" />)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(zh.hero.title)
    expect(screen.getByText(zh.hero.sub)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: zh.hero.cta1 })).toHaveAttribute('href', '/docs/')
    expect(screen.getByRole('link', { name: zh.hero.cta2 })).toHaveAttribute('href', '/download/')
  })

  it('marks the responsibility groups: one brand band, one shared by the integrity layers', () => {
    const { container } = render(<ArchitectureSection copy={zh} />)
    const cards = [...container.querySelectorAll('[data-slot="card"]')]
    const bands = cards.map(card =>
      // The card's ring colour is the group marker; `ring-<n>` is only its width.
      [...card.classList].find(name => name.startsWith('ring-') && !/^ring-\d+$/.test(name)),
    )

    // Layers run 05, 04, 03, 02, 01 — the management plane carries the only
    // brand band, and the two integrity layers share theirs.
    expect(bands.filter(band => band?.startsWith('ring-brand'))).toHaveLength(1)
    expect(bands[0]).toMatch(/^ring-brand/)
    expect(bands[2]).toBe(bands[3])
    expect(new Set(bands).size).toBe(4)
  })

  it('describes every architecture layer with its bullet points', () => {
    render(<ArchitectureSection copy={zh} />)

    for (const layer of zh.arch.layers) {
      expect(screen.getByText(layer.name)).toBeInTheDocument()
      expect(screen.getByText(layer.impl)).toBeInTheDocument()
      // A layer whose title and points say enough carries no description.
      if (layer.desc)
        expect(screen.getByText(layer.desc)).toBeInTheDocument()
      for (const point of layer.points ?? [])
        expect(screen.getByText(point)).toBeInTheDocument()
    }
  })

  it('lists every board of the support table', () => {
    render(<BoardsSection copy={zh} />)

    for (const row of zh.boards.rows) {
      expect(screen.getByRole('cell', { name: row.board })).toBeInTheDocument()
      expect(screen.getByRole('cell', { name: row.hw })).toBeInTheDocument()
      // Two boards genuinely share a status, so this one is not unique.
      expect(screen.getAllByRole('cell', { name: row.status }).length).toBeGreaterThan(0)
    }
  })

  it('walks through every workflow step', () => {
    render(<FlowSection copy={zh} />)

    for (const step of zh.flow.steps) {
      expect(screen.getByText(step.title)).toBeInTheDocument()
      expect(screen.getByText(step.body)).toBeInTheDocument()
    }
  })

  it('closes on the documentation and the GitHub organisation', () => {
    render(<StartSection copy={zh} docsHref="/docs/" />)

    expect(screen.getByRole('heading', { name: zh.start.heading })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: zh.nav.docs })).toHaveAttribute('href', '/docs/')
    expect(screen.getByRole('link', { name: 'GitHub' }))
      .toHaveAttribute('href', 'https://github.com/micaoss')
  })

  it('states the licence and links the organisation, on every page', () => {
    render(<SiteFooter copy={zh} />)
    expect(screen.getByText(zh.footer.license)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: zh.footer.repo }))
      .toHaveAttribute('href', 'https://github.com/micaoss')
  })

  it('renders the English dictionary just as well', () => {
    render(<HeroSection copy={en} docsHref="/en/docs/" downloadHref="/en/download/" />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(en.hero.title)
    expect(screen.getByRole('link', { name: en.hero.cta1 })).toHaveAttribute('href', '/en/docs/')
    expect(screen.getByRole('link', { name: en.hero.cta2 })).toHaveAttribute('href', '/en/download/')
  })
})

describe('locale-aware links', () => {
  it('serves Chinese from the root and English under its own prefix', () => {
    expect(homeHref('zh')).toBe('/')
    expect(homeHref('en')).toBe('/en/')
    expect(docsHref('zh')).toBe('/docs/')
    expect(docsHref('en')).toBe('/en/docs/')
    expect(downloadHref('zh')).toBe('/download/')
    expect(downloadHref('en')).toBe('/en/download/')
  })
})
