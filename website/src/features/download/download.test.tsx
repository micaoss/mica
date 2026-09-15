import type { Artifact } from './catalog'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { en } from '@/shared/i18n/en'
import { zh } from '@/shared/i18n/zh'
import { ARTIFACTS, filterArtifacts } from './catalog'
import { DownloadExplorer } from './components/download-explorer'

const SAMPLE: Artifact[] = [
  {
    board: 'x64',
    profile: 'dev',
    version: '2026.09-1',
    deploymentId: 'dep-aa11',
    kind: 'image',
    bytes: 1_073_741_824,
    digest: 'sha256:aaaa',
    href: 'https://example.invalid/x64-dev.img',
  },
  {
    board: 'cx3576',
    profile: 'prod',
    version: '2026.08-3',
    deploymentId: 'dep-bb22',
    kind: 'update',
    bytes: 52_428_800,
    digest: 'sha256:bbbb',
    href: 'https://example.invalid/cx3576-prod.micaupd',
  },
]

describe('filterArtifacts', () => {
  it('returns everything when nothing is selected', () => {
    expect(filterArtifacts(SAMPLE, {})).toHaveLength(2)
  })

  it('narrows by board, profile and kind', () => {
    expect(filterArtifacts(SAMPLE, { board: 'x64' })).toEqual([SAMPLE[0]])
    expect(filterArtifacts(SAMPLE, { profile: 'prod' })).toEqual([SAMPLE[1]])
    expect(filterArtifacts(SAMPLE, { kind: 'update' })).toEqual([SAMPLE[1]])
  })

  it('matches the query against version and deployment id, case-insensitively', () => {
    expect(filterArtifacts(SAMPLE, { query: '2026.09' })).toEqual([SAMPLE[0]])
    expect(filterArtifacts(SAMPLE, { query: 'DEP-BB22' })).toEqual([SAMPLE[1]])
    expect(filterArtifacts(SAMPLE, { query: 'nothing' })).toEqual([])
  })

  it('combines criteria', () => {
    expect(filterArtifacts(SAMPLE, { board: 'x64', kind: 'update' })).toEqual([])
    expect(filterArtifacts(SAMPLE, { board: 'x64', kind: 'image', query: 'dep-aa' }))
      .toEqual([SAMPLE[0]])
  })
})

describe('the published catalogue', () => {
  // The content contract forbids hand-written release identities: rows arrive
  // from published artifact metadata or not at all.
  it('is empty until the update server publishes one', () => {
    expect(ARTIFACTS).toEqual([])
  })
})

describe('downloadExplorer', () => {
  it('lists the artifacts it is given', () => {
    render(<DownloadExplorer copy={zh} artifacts={SAMPLE} />)

    expect(screen.getByText('dep-aa11')).toBeInTheDocument()
    expect(screen.getByText('dep-bb22')).toBeInTheDocument()
    expect(screen.queryByText(zh.download.empty)).not.toBeInTheDocument()
  })

  it('explains an empty catalogue instead of showing an empty table', () => {
    render(<DownloadExplorer copy={zh} artifacts={[]} />)

    expect(screen.getByText(zh.download.empty)).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('renders the English dictionary just as well', () => {
    render(<DownloadExplorer copy={en} artifacts={[]} />)

    expect(screen.getByText(en.download.empty)).toBeInTheDocument()
  })
})

describe('the catalogue endpoint', () => {
  it('renders what /api/catalog answers', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ artifacts: SAMPLE })))
    vi.stubGlobal('fetch', fetchMock)

    render(<DownloadExplorer copy={zh} />)

    expect(await screen.findByText('dep-aa11')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/catalog'), expect.anything())
    vi.unstubAllGlobals()
  })

  it('shows the empty state when the endpoint is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('offline')
    }))

    render(<DownloadExplorer copy={zh} />)

    expect(await screen.findByText(zh.download.empty)).toBeInTheDocument()
    vi.unstubAllGlobals()
  })
})
