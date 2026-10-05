import { describe, expect, it } from 'vitest'
import { en } from '@/shared/i18n/en'
import { zh } from '@/shared/i18n/zh'
import { boardGuides, CONFIGURED_BOARDS } from './boards'

describe('per-board guides', () => {
  it('gives every board an identifier usable as a URL segment, once', () => {
    for (const board of CONFIGURED_BOARDS)
      expect(board).toMatch(/^[a-z0-9][a-z0-9-]*$/)
    expect(new Set(CONFIGURED_BOARDS).size).toBe(CONFIGURED_BOARDS.length)
  })

  it('resolves a documentation slug against the locale', () => {
    const [first] = boardGuides(zh, 'zh', 'uefi-x64')
    expect(first.href).toBe('/docs/start/install/')
    expect(boardGuides(en, 'en', 'uefi-x64')[0].href).toBe('/en/docs/start/install/')
  })

  it('keeps an external target as given', () => {
    const source = boardGuides(zh, 'zh', 'cx3576').find(guide => guide.href.startsWith('http'))
    expect(source?.href).toContain('micaoss/mica')
  })

  it('gives every configured guide wording in both locales', () => {
    for (const board of CONFIGURED_BOARDS) {
      const zhGuides = boardGuides(zh, 'zh', board)
      const enGuides = boardGuides(en, 'en', board)
      // A guide whose id has no wording is skipped, so a mismatch shows up as a
      // shorter list rather than as a broken card.
      expect(zhGuides.length).toBe(enGuides.length)
      for (const guide of [...zhGuides, ...enGuides]) {
        expect(guide.title.length).toBeGreaterThan(0)
        expect(guide.body.length).toBeGreaterThan(0)
      }
    }
  })

  it('answers empty for a board it does not configure', () => {
    expect(boardGuides(zh, 'zh', 'nothing-here')).toEqual([])
  })
})

describe('the board index', () => {
  it('marks a board with nothing published, and names catalogue boards it has no page for', async () => {
    const { render, screen } = await import('@testing-library/react')
    const { BoardIndex } = await import('./components/board-index')

    const boards = [{ board: 'x64', href: '/download/x64/' }]
    const downloads = [{
      board: 'rk3588',
      profile: 'dev' as const,
      kind: 'image' as const,
      version: '2026.09-1',
      deploymentId: 'dep-rk',
      releasedAt: '2026-09-01',
      bytes: 1,
      digest: 'sha256:aa',
      href: 'https://example.invalid/x.img',
      filename: 'disk.img',
    }]

    render(<BoardIndex copy={zh} boards={boards} downloads={downloads} />)

    expect(screen.getByText(zh.download.nothingYet)).toBeInTheDocument()
    expect(screen.getByText('rk3588')).toBeInTheDocument()
  })

  it('words a board from the catalogue', async () => {
    const { render, screen } = await import('@testing-library/react')
    const { BoardIndex } = await import('./components/board-index')
    const title = { zh: '', en: '' }
    const words = { categories: [], fileTypes: [], products: [], boards: [{ board: 'x64', title, hardware: { zh: '通用 amd64', en: '' }, status: { zh: 'QEMU 基线', en: '' } }] }

    render(<BoardIndex copy={zh} boards={[{ board: 'x64', href: '/download/x64/' }]} downloads={[]} words={words} />)

    expect(screen.getByText('通用 amd64')).toBeInTheDocument()
    expect(screen.getByText('QEMU 基线')).toBeInTheDocument()
  })
})
