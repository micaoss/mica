import type { Copy } from '@/shared/i18n'
import { renderToStaticMarkup } from 'react-dom/server'
import { CONFIGURED_BOARDS } from '@/features/download/boards'
import { ButtonLink } from '@/shared/components/ui/button'
import { Card } from '@/shared/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table'
import { NEW_ISSUE_URL, SUPPORT_TIERS_URL } from '../links'
import { SectionHeading } from './section-heading'

export interface BoardRow { board: string, hw: string, status: string }

function Row({ board, hw, status }: BoardRow) {
  return (
    <TableRow>
      <TableCell className="px-5 font-mono text-[13px]">{board}</TableCell>
      <TableCell className="text-[15px]">{hw}</TableCell>
      <TableCell className="pr-5 text-[15px] text-muted-foreground">{status}</TableCell>
    </TableRow>
  )
}

/**
 * The board table. What a board is called, its hardware and its status are the
 * resource service's, so the built page carries the boards this site has pages
 * for, under their identifiers, and one row's markup as a template; the Worker
 * replaces the rows with the catalogue's boards when the page is requested
 * (`worker/pages.ts`).
 */
export function BoardsSection({ copy, rows }: { copy: Copy, rows?: BoardRow[] }) {
  const shown = rows ?? CONFIGURED_BOARDS.map(board => ({ board, hw: '', status: '' }))
  const template = renderToStaticMarkup(<Row board="{board}" hw="{hardware}" status="{status}" />)

  return (
    <section className="py-16">
      <SectionHeading>{copy.boards.heading}</SectionHeading>

      <Card className="mt-12 gap-0 p-0">
        {/* A spec sheet scrolls rather than reflows; `min-w-0` keeps the
            scroller from being widened by its content. */}
        <div className="w-full min-w-0 overflow-x-auto rounded-xl">
          <Table className="min-w-[560px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[24%] px-5">{copy.boards.cols.board}</TableHead>
                <TableHead className="w-[30%]">{copy.boards.cols.hw}</TableHead>
                <TableHead className="pr-5">{copy.boards.cols.status}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody data-res-boards={copy.locale} data-res-row={template}>
              {shown.map(row => <Row key={row.board} {...row} />)}
            </TableBody>
          </Table>
        </div>
      </Card>

      <div className="mt-6 flex flex-wrap gap-3">
        <ButtonLink variant="secondary" href={SUPPORT_TIERS_URL}>{copy.boards.more}</ButtonLink>
        <ButtonLink variant="ghost" size="ghost" href={NEW_ISSUE_URL}>{copy.boards.request}</ButtonLink>
      </div>
    </section>
  )
}
