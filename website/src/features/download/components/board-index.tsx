import type { IndexCatalogue } from '../products-catalog'
import type { Copy } from '@/shared/i18n'
import { boardDownloadHref } from '@/features/landing/links'
import { Card, CardContent } from '@/shared/components/ui/card'
import { wordIn } from '../download-map'
import { useIndex } from '../use-catalogue'

/** The newest version published for a board, or nothing if it has none. */
function latestFor(index: IndexCatalogue, board: string): string | undefined {
  return index.products
    .filter(product => product.board === board && product.latest)
    .map(product => product.latest!.version)
    .sort()
    .at(-1)
}

/**
 * The boards to choose from: every board the catalogue lists, in its order,
 * each leading to its download page. Which boards there are is the resource
 * service's, so a board an admin adds or hides appears or disappears here
 * with no deploy.
 */
export function BoardIndex({
  copy,
  index,
}: {
  copy: Copy
  /** Given in tests; in the page the index is fetched from the endpoint. */
  index?: IndexCatalogue
}) {
  const { data, loading } = useIndex(index)
  const boards = data?.boards ?? []

  if (boards.length === 0) {
    return (
      <p className="m-0 text-[15px] leading-7 text-muted-foreground">
        {loading ? copy.download.loading : copy.download.nothingYet}
      </p>
    )
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-6">
      {boards.map((board) => {
        const latest = latestFor(data!, board.board)
        return (
          <a
            key={board.board}
            href={boardDownloadHref(copy.locale, board.board)}
            className="group block text-foreground no-underline hover:no-underline"
          >
            <Card className="h-full gap-0 p-6 transition-colors group-hover:border-ring">
              <CardContent className="p-0">
                <h2 className="m-0 font-mono text-lg leading-6 font-semibold">{wordIn(board.title, copy.locale) ?? board.board}</h2>
                <p className="mt-2.5 mb-0 text-[15px] leading-7 text-muted-foreground">
                  {wordIn(board.hardware, copy.locale)}
                </p>
                <p className="mt-1 mb-0 text-[13px] leading-6 text-muted-foreground">
                  {wordIn(board.status, copy.locale)}
                </p>
                <span className="mt-4 inline-block font-mono text-[13px] text-brand-strong">
                  {latest ? `${copy.download.latest} ${latest}` : copy.download.nothingYet}
                </span>
              </CardContent>
            </Card>
          </a>
        )
      })}
    </div>
  )
}
