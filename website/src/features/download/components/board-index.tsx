import type { Download } from '../catalog'
import type { Copy } from '@/shared/i18n'
import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/shared/components/ui/card'
import { DOWNLOADS, selectVersions } from '../catalog'
import { parseCatalog } from '../catalog-schema'

declare const __BUILD_ID__: string | undefined

const CATALOG_ENDPOINT = `/api/catalog?v=${typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev'}`

export interface BoardCard {
  board: string
  hardware: string
  status: string
  href: string
}

/** The newest version published for a board, or nothing if it has none. */
function latestFor(downloads: Download[], board: string): Download | undefined {
  return selectVersions(downloads.filter(download => download.board === board), false)[0]
}

export function BoardIndex({
  copy,
  boards,
  downloads,
}: {
  copy: Copy
  boards: BoardCard[]
  /** Given in tests; in the page the catalogue is fetched from the endpoint. */
  downloads?: Download[]
}) {
  const [fetched, setFetched] = useState<Download[]>(DOWNLOADS)

  useEffect(() => {
    if (downloads)
      return
    const cancel = new AbortController()
    fetch(CATALOG_ENDPOINT, { signal: cancel.signal })
      .then(async response => (response.ok ? parseCatalog(await response.json()) : []))
      .then(setFetched)
      .catch(() => {})
    return () => cancel.abort()
  }, [downloads])

  const catalogue = downloads ?? fetched
  const known = new Set(boards.map(board => board.board))
  // A catalogue entry for a board this site has no page for would otherwise be
  // invisible: the row exists upstream and nothing here would ever show it.
  const unlisted = [...new Set(catalogue.map(download => download.board))]
    .filter(board => !known.has(board))
    .sort()

  return (
    <div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-6">
        {boards.map((board) => {
          const latest = latestFor(catalogue, board.board)
          return (
            <a
              key={board.board}
              href={board.href}
              className="group block text-foreground no-underline hover:no-underline"
            >
              <Card className="h-full gap-0 p-6 transition-colors group-hover:border-ring">
                <CardContent className="p-0">
                  <h2 className="m-0 font-mono text-lg leading-6 font-semibold">{board.board}</h2>
                  <p className="mt-2.5 mb-0 text-[15px] leading-7 text-muted-foreground">
                    {board.hardware}
                  </p>
                  <p className="mt-1 mb-0 text-[13px] leading-6 text-muted-foreground">
                    {board.status}
                  </p>
                  <span className="mt-4 inline-block font-mono text-[13px] text-brand-strong">
                    {latest ? `${copy.download.latest} ${latest.version}` : copy.download.nothingYet}
                  </span>
                </CardContent>
              </Card>
            </a>
          )
        })}
      </div>

      {unlisted.length > 0 && (
        <p className="mt-6 mb-0 rounded-lg border border-border bg-muted px-4 py-3 text-[13px] leading-6 text-muted-foreground">
          {copy.download.unlisted}
          {' '}
          <span className="font-mono">{unlisted.join('、')}</span>
        </p>
      )}
    </div>
  )
}
