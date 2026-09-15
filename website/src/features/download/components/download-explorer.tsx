import type { Artifact, ArtifactKind, Profile } from '../catalog'
import type { Copy } from '@/shared/i18n'
import { useEffect, useMemo, useState } from 'react'
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
import { ARTIFACTS, filterArtifacts, formatBytes } from '../catalog'
import { parseCatalog } from '../catalog-schema'

const KINDS: ArtifactKind[] = ['image', 'update', 'kernel', 'root', 'firmware']
const PROFILES: Profile[] = ['dev', 'prod']

/** The primitive needs a real value, so "no constraint" gets a sentinel. */
const ALL = 'all'

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

/** Where the Worker answers the catalogue. Static pages fetch it at runtime. */
const CATALOG_ENDPOINT = '/api/catalog'

export function DownloadExplorer({
  copy,
  artifacts,
}: {
  copy: Copy
  /** Given in tests; in the page the catalogue is fetched from the endpoint. */
  artifacts?: Artifact[]
}) {
  const [fetched, setFetched] = useState<Artifact[]>(ARTIFACTS)
  const [board, setBoard] = useState(ALL)
  const [profile, setProfile] = useState(ALL)
  const [kind, setKind] = useState(ALL)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (artifacts)
      return
    const cancel = new AbortController()
    // A failed or unreadable catalogue leaves the empty state standing: the page
    // says there is nothing published rather than showing a broken table.
    fetch(CATALOG_ENDPOINT, { signal: cancel.signal })
      .then(async response => (response.ok ? parseCatalog(await response.json()) : []))
      .then(setFetched)
      .catch(() => {})
    return () => cancel.abort()
  }, [artifacts])

  const catalogue = artifacts ?? fetched

  const boards = useMemo(
    () => [...new Set(catalogue.map(artifact => artifact.board))].sort(),
    [catalogue],
  )

  const rows = filterArtifacts(catalogue, {
    board: board === ALL ? undefined : board,
    profile: profile === ALL ? undefined : (profile as Profile),
    kind: kind === ALL ? undefined : (kind as ArtifactKind),
    query,
  })

  const { filters, kinds, cols } = copy.download

  return (
    <div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-4">
        <Facet
          label={filters.board}
          allLabel={filters.all}
          value={board}
          onChange={setBoard}
          options={boards.map(value => ({ value, label: value }))}
        />
        <Facet
          label={filters.profile}
          allLabel={filters.all}
          value={profile}
          onChange={setProfile}
          options={PROFILES.map(value => ({ value, label: value }))}
        />
        <Facet
          label={filters.kind}
          allLabel={filters.all}
          value={kind}
          onChange={setKind}
          options={KINDS.map(value => ({ value, label: kinds[value] }))}
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
            <Card className="mt-8 gap-0 p-0">
              <div className="w-full min-w-0 overflow-x-auto rounded-xl">
                <Table className="min-w-[720px]">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="px-5">{cols.artifact}</TableHead>
                      <TableHead>{cols.board}</TableHead>
                      <TableHead>{cols.profile}</TableHead>
                      <TableHead>{cols.version}</TableHead>
                      <TableHead>{cols.deployment}</TableHead>
                      <TableHead className="pr-5">{cols.size}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map(artifact => (
                      <TableRow key={`${artifact.deploymentId}-${artifact.kind}`}>
                        <TableCell className="px-5 text-[15px]">
                          <a href={artifact.href}>{kinds[artifact.kind]}</a>
                        </TableCell>
                        <TableCell className="font-mono text-[13px]">{artifact.board}</TableCell>
                        <TableCell className="font-mono text-[13px]">{artifact.profile}</TableCell>
                        <TableCell className="font-mono text-[13px]">{artifact.version}</TableCell>
                        <TableCell className="font-mono text-[13px] text-muted-foreground">
                          {artifact.deploymentId}
                        </TableCell>
                        <TableCell className="pr-5 font-mono text-[13px] text-muted-foreground tabular-nums">
                          {formatBytes(artifact.bytes)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
    </div>
  )
}
