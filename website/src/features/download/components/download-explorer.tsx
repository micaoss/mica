import type { Download, DownloadKind } from '../catalog'
import type { Copy } from '@/shared/i18n'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Card } from '@/shared/components/ui/card'
import { Input } from '@/shared/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table'
import {
  DOWNLOAD_KINDS,
  DOWNLOADS,
  filterDownloads,
  formatBytes,
  historyCount,
  selectVersions,
} from '../catalog'
import { isSample, parseCatalog } from '../catalog-schema'

/** The primitive needs a real value, so "no constraint" gets a sentinel. */
const ALL = 'all'

/** Enough of a deployment identity to recognise it; the cell's title has it whole. */
function shortId(id: string | undefined): string {
  if (!id)
    return '—'
  return id.length > 16 ? `${id.slice(0, 12)}…` : id
}

declare const __BUILD_ID__: string | undefined

/**
 * Where the Worker answers the catalogue. The build stamp is the cache key: a
 * deploy asks for a fresh answer, and within one deploy the edge serves one.
 */
const CATALOG_ENDPOINT = `/api/catalog?v=${typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev'}`

interface FacetProps {
  label: string
  allLabel: string
  value: string
  options: { value: string, label: string }[]
  onChange: (value: string) => void
}

function Facet({ label, allLabel, value, options, onChange }: FacetProps) {
  const items = [{ value: ALL, label: allLabel }, ...options]

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">
        {label}
      </span>
      <Select
        items={items}
        value={value}
        onValueChange={(next: string | null) => onChange(next ?? ALL)}
      >
        <SelectTrigger aria-label={label} className="h-9 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map(item => (
            <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  )
}

export function DownloadExplorer({
  copy,
  board,
  downloads,
}: {
  copy: Copy
  /** The board whose page this is; its rows are the only ones shown. */
  board: string
  /** Given in tests; in the page the catalogue is fetched from the endpoint. */
  downloads?: Download[]
}) {
  const [fetched, setFetched] = useState<Download[]>(DOWNLOADS)
  const [sample, setSample] = useState(false)
  const [profile, setProfile] = useState(ALL)
  const [kind, setKind] = useState(ALL)
  const [query, setQuery] = useState('')
  const [history, setHistory] = useState(false)

  useEffect(() => {
    if (downloads)
      return
    const cancel = new AbortController()
    // A failed or unreadable catalogue leaves the empty state standing: the page
    // says there is nothing published rather than showing a broken table.
    fetch(CATALOG_ENDPOINT, { signal: cancel.signal })
      .then(async (response) => {
        if (!response.ok)
          return []
        const payload: unknown = await response.json()
        setSample(isSample(payload))
        return parseCatalog(payload)
      })
      .then(setFetched)
      .catch(() => {})
    return () => cancel.abort()
  }, [downloads])

  const catalogue = useMemo(
    () => (downloads ?? fetched).filter(download => download.board === board),
    [downloads, fetched, board],
  )

  const profiles = useMemo(
    () => [...new Set(catalogue.map(download => download.profile))].sort(),
    [catalogue],
  )

  const matching = filterDownloads(catalogue, {
    profile: profile === ALL ? undefined : profile,
    kind: kind === ALL ? undefined : (kind as DownloadKind),
    query,
  })
  const rows = selectVersions(matching, history)
  const earlier = historyCount(matching)

  const { filters, cols, kinds } = copy.download

  return (
    <div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-4">
        <Facet
          label={filters.profile}
          allLabel={filters.all}
          value={profile}
          onChange={setProfile}
          options={profiles.map(value => ({ value, label: value }))}
        />
        <Facet
          label={cols.kind}
          allLabel={filters.all}
          value={kind}
          onChange={setKind}
          options={DOWNLOAD_KINDS.map(value => ({ value, label: kinds[value] }))}
        />
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">
            {filters.query}
          </span>
          <Input
            type="search"
            value={query}
            placeholder={filters.query}
            onChange={event => setQuery(event.target.value)}
          />
        </label>
      </div>

      {rows.length === 0
        ? (
            <p className="mt-8 mb-0 text-[15px] leading-7 text-muted-foreground">
              {copy.download.empty}
            </p>
          )
        : (
            <>
              {sample && (
                <p className="mt-8 mb-0 rounded-lg border border-border bg-muted px-4 py-3 text-[13px] leading-6 text-muted-foreground">
                  {copy.download.sample}
                </p>
              )}
              <Card className="mt-4 gap-0 p-0">
                <div className="w-full min-w-0 overflow-x-auto rounded-xl">
                  <Table className="min-w-[720px]">
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="px-5">{cols.kind}</TableHead>
                        <TableHead>{cols.profile}</TableHead>
                        <TableHead>{cols.version}</TableHead>
                        <TableHead>{cols.released}</TableHead>
                        <TableHead>{cols.deployment}</TableHead>
                        <TableHead>{cols.size}</TableHead>
                        <TableHead className="pr-5">{cols.download}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map(download => (
                        <TableRow key={`${download.deploymentId}-${download.kind}-${download.version}`}>
                          <TableCell className="px-5 text-[15px]">
                            {kinds[download.kind]}
                            {download.variant && (
                              <span className="ml-1.5 font-mono text-[13px] text-muted-foreground">
                                {copy.download.variants[download.variant]}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-[13px]">{download.profile}</TableCell>
                          <TableCell className="font-mono text-[13px]">{download.version}</TableCell>
                          <TableCell className="font-mono text-[13px] text-muted-foreground">
                            {download.releasedAt}
                          </TableCell>
                          {/* A deployment identity is 64 hex characters; in full it
                              pushes the download link out of the viewport. The row
                              shows enough to recognise it and carries the whole
                              value for anyone who needs to compare it. */}
                          <TableCell
                            className="font-mono text-[13px] text-muted-foreground"
                            title={download.deploymentId}
                          >
                            {shortId(download.deploymentId)}
                          </TableCell>
                          <TableCell className="font-mono text-[13px] text-muted-foreground tabular-nums">
                            {formatBytes(download.bytes)}
                          </TableCell>
                          <TableCell className="pr-5 font-mono text-[13px]">
                            <a href={download.href}>{download.filename}</a>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>

              {(earlier > 0 || history) && (
                <Button
                  variant="secondary"
                  className="mt-4"
                  onClick={() => setHistory(!history)}
                >
                  {history ? copy.download.historyHide : `${copy.download.history} (${earlier})`}
                </Button>
              )}
            </>
          )}
    </div>
  )
}
