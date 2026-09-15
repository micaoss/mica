import type { Copy, LocaleCode } from '@/shared/i18n'
import { docsPageHref } from '@/features/landing/links'
import config from '../../../boards.json'

/**
 * Per-board configuration, read from `boards.json`. Which documents a board's
 * page links to is data: a board with a bench session or its own dossier lists
 * them, a board without one does not.
 */

type GuideId = keyof Omit<Copy['download']['guides'], 'heading'>

interface GuideConfig {
  id: string
  /** A published documentation slug under `/docs/`. */
  doc?: string
  /** An external target, for records this site does not publish. */
  url?: string
}

export interface Guide {
  title: string
  body: string
  href: string
}

function guides(board: string): GuideConfig[] {
  return config.boards.find(entry => entry.board === board)?.guides ?? []
}

/** The guides a board's page shows, in configured order; an unknown id is skipped. */
export function boardGuides(copy: Copy, locale: LocaleCode, board: string): Guide[] {
  const vocabulary = copy.download.guides

  return guides(board).flatMap((guide) => {
    const words = vocabulary[guide.id as GuideId]
    const href = guide.url ?? (guide.doc ? docsPageHref(locale, guide.doc) : undefined)
    if (!words || !href)
      return []
    return [{ title: words.title, body: words.body, href }]
  })
}

/** Every board `boards.json` configures, for the tests that keep it aligned. */
export const CONFIGURED_BOARDS: string[] = config.boards.map(entry => entry.board)
