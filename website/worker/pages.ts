import type { CatalogueWords } from '../src/features/download/products-catalog'
import type { LocaleCode } from '../src/shared/i18n'
import { boardWords, wordIn } from '../src/features/download/download-map'

/**
 * Board wording in the pages' HTML.
 *
 * What a board is called, its hardware and its status are the resource
 * service's, and they are in the HTML of the landing page and of each board's
 * download page, where a visitor and a crawler read them before any script
 * runs. The build cannot bake them in: an admin changes them without a deploy.
 * So the built pages carry fill points, and the Worker fills them from its
 * copy of the catalogue when a page is requested:
 *
 *   <tbody data-res-boards="<locale>" data-res-row="<one row's HTML>">
 *       the board table; the row template names `{board}`, `{hardware}` and
 *       `{status}`, and the rows become the catalogue's boards, in its order
 *   <p data-res-board="<board>" data-res-locale="<locale>">
 *       one board's hardware and status
 *
 * A page is served as built when the catalogue has no boards to offer.
 */

/** The part of an HTMLRewriter element these handlers use. */
export interface FillElement {
  getAttribute: (name: string) => string | null
  removeAttribute: (name: string) => unknown
  setInnerContent: (content: string, options?: { html?: boolean }) => unknown
}

/** The part of HTMLRewriter the Worker uses. */
export interface Rewriter {
  on: (selector: string, handlers: { element: (element: FillElement) => void }) => Rewriter
  transform: (response: Response) => Response
}

export const BOARDS_SELECTOR = '[data-res-boards]'
export const BOARD_SELECTOR = '[data-res-board]'

function escape(text: string): string {
  return text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' })[char]!)
}

/**
 * An attribute's value as written in the page. HTMLRewriter hands attributes
 * over undecoded, and the row template is markup, so its entities are read
 * back here; `&amp;` last, so an escaped entity stays one.
 */
function decode(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(?:39|x27);/g, '\'')
    .replace(/&amp;/g, '&')
}

function locale(value: string | null): LocaleCode {
  return value === 'en' ? 'en' : 'zh'
}

/** The board table's rows: every board the catalogue lists, in its order. */
export function boardRowsHtml(words: CatalogueWords, template: string, language: LocaleCode): string {
  return words.boards.map((board) => {
    const { hardware, status } = boardWords(words, board.board, language)
    const fill: Record<string, string> = {
      '{board}': wordIn(board.title, language) ?? board.board,
      '{hardware}': hardware ?? '',
      '{status}': status ?? '',
    }
    return template.replace(/\{(?:board|hardware|status)\}/g, name => escape(fill[name]!))
  }).join('')
}

/** One board's line: its hardware and status, as far as the catalogue words them. */
export function boardLine(words: CatalogueWords, board: string, language: LocaleCode): string {
  const { hardware, status } = boardWords(words, board, language)
  return [hardware, status].filter(Boolean).join(' · ')
}

/** Fills a page's board wording from the catalogue's words. */
export function fillBoards(page: Response, words: CatalogueWords, rewriter: Rewriter): Response {
  if (words.boards.length === 0)
    return page

  return rewriter
    .on(BOARDS_SELECTOR, {
      element(element) {
        const template = element.getAttribute('data-res-row')
        if (!template)
          return
        element.setInnerContent(boardRowsHtml(words, decode(template), locale(element.getAttribute('data-res-boards'))), { html: true })
        element.removeAttribute('data-res-row')
      },
    })
    .on(BOARD_SELECTOR, {
      element(element) {
        const line = boardLine(words, element.getAttribute('data-res-board') ?? '', locale(element.getAttribute('data-res-locale')))
        if (line)
          element.setInnerContent(line)
      },
    })
    .transform(page)
}
