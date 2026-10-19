import type { CatalogueWords } from '../src/features/download/products-catalog'
import type { FillElement, Rewriter } from './pages'
import { describe, expect, it } from 'vitest'
import { boardLine, boardRowsHtml, BOARDS_SELECTOR, fillBoards } from './pages'

const WORDS: CatalogueWords = {
  categories: [],
  fileTypes: [],
  products: [],
  boards: [
    { board: 'uefi-x64', title: { zh: 'uefi-x64', en: 'uefi-x64' }, hardware: { zh: '通用 amd64', en: 'Generic amd64' }, status: { zh: 'QEMU 基线', en: 'QEMU baseline' } },
    { board: 'rk3588', title: { zh: '', en: '' }, hardware: { zh: '', en: 'RK <3588> & co' }, status: { zh: '', en: '' } },
  ],
}
const TEMPLATE = '<tr><td>{board}</td><td>{hardware}</td><td>{status}</td></tr>'

/** A rewriter that records its handlers and runs them over the elements given. */
function fakeRewriter(elements: Record<string, FillElement[]>) {
  const handlers: Record<string, (element: FillElement) => void> = {}
  const rewriter: Rewriter = {
    on(selector, handler) {
      handlers[selector] = handler.element
      return rewriter
    },
    transform(response) {
      for (const [selector, list] of Object.entries(elements))
        list.forEach(element => handlers[selector]?.(element))
      return response
    },
  }
  return rewriter
}

function element(attributes: Record<string, string>) {
  const state = { content: undefined as string | undefined, html: false, removed: [] as string[] }
  const fill: FillElement = {
    getAttribute: name => attributes[name] ?? null,
    removeAttribute: name => void state.removed.push(name),
    setInnerContent: (content, options) => {
      state.content = content
      state.html = options?.html === true
    },
  }
  return { fill, state }
}

describe('board wording in the pages', () => {
  it('makes the table\'s rows the catalogue\'s boards, in its order, in the page\'s language', () => {
    expect(boardRowsHtml(WORDS, TEMPLATE, 'zh')).toBe(
      '<tr><td>uefi-x64</td><td>通用 amd64</td><td>QEMU 基线</td></tr>'
      + '<tr><td>rk3588</td><td>RK &lt;3588&gt; &amp; co</td><td></td></tr>',
    )
  })

  it('shows a board without a title under its identifier, and an unfilled language in the other', () => {
    expect(boardRowsHtml(WORDS, TEMPLATE, 'zh')).toContain('<td>rk3588</td><td>RK &lt;3588&gt; &amp; co</td>')
  })

  it('words one board\'s line as far as the catalogue does', () => {
    expect(boardLine(WORDS, 'uefi-x64', 'en')).toBe('Generic amd64 · QEMU baseline')
    expect(boardLine(WORDS, 'rk3588', 'en')).toBe('RK <3588> & co')
    expect(boardLine(WORDS, 'unknown', 'en')).toBe('')
  })

  it('fills the table from its row template and a board\'s line by its attributes', () => {
    // As HTMLRewriter hands it over: the attribute's entities undecoded.
    const written = '&lt;tr class=&quot;[&amp;amp;_td]:p-2&quot;&gt;&lt;td&gt;{board}&lt;/td&gt;&lt;td&gt;{hardware}&lt;/td&gt;&lt;td&gt;{status}&lt;/td&gt;&lt;/tr&gt;'
    const table = element({ 'data-res-boards': 'en', 'data-res-row': written })
    const line = element({ 'data-res-board': 'uefi-x64', 'data-res-locale': 'zh' })
    const unknown = element({ 'data-res-board': 'ghost', 'data-res-locale': 'zh' })

    fillBoards(new Response('<html>'), WORDS, fakeRewriter({ [BOARDS_SELECTOR]: [table.fill], '[data-res-board]': [line.fill, unknown.fill] }))

    expect(table.state.content).toContain('<tr class="[&amp;_td]:p-2"><td>uefi-x64</td><td>Generic amd64</td>')
    expect(table.state.html).toBe(true)
    expect(table.state.removed).toEqual(['data-res-row'])
    expect(line.state.content).toBe('通用 amd64 · QEMU 基线')
    expect(line.state.html).toBe(false)
    expect(unknown.state.content).toBeUndefined()
  })

  it('serves the page as built when the catalogue has no boards', () => {
    const page = new Response('<html>')
    const rewriter = fakeRewriter({})

    expect(fillBoards(page, { ...WORDS, boards: [] }, rewriter)).toBe(page)
  })
})
