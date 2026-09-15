import type { Copy } from '@/shared/i18n'
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

export function BoardsSection({ copy }: { copy: Copy }) {
  const rows = copy.boards.rows

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
            <TableBody>
              {rows.map(row => (
                <TableRow key={row.board}>
                  <TableCell className="px-5 font-mono text-[13px]">{row.board}</TableCell>
                  <TableCell className="text-[15px]">{row.hw}</TableCell>
                  <TableCell className="pr-5 text-[15px] text-muted-foreground">
                    {row.status}
                  </TableCell>
                </TableRow>
              ))}
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
