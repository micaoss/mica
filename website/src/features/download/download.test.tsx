import type { Download } from './catalog'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { en } from '@/shared/i18n/en'
import { zh } from '@/shared/i18n/zh'
import { DOWNLOADS, filterDownloads, historyCount, selectVersions } from './catalog'
import { DownloadExplorer } from './components/download-explorer'

function download(partial: Partial<Download>): Download {
  return {
    board: 'x64',
    profile: 'dev',
    kind: 'image',
    version: '2026.09-1',
    deploymentId: 'dep-aa11',
    releasedAt: '2026-09-01',
    bytes: 1_073_741_824,
    digest: 'sha256:aaaa',
    href: 'https://example.invalid/x64.img',
    filename: 'disk.img',
    ...partial,
  }
}

const NEWEST = download({ version: '2026.09-2', deploymentId: 'dep-new', releasedAt: '2026-09-10' })
const OLDER = download({ version: '2026.08-1', deploymentId: 'dep-old', releasedAt: '2026-08-01' })
const UPDATE = download({ kind: 'update', deploymentId: 'dep-upd', releasedAt: '2026-09-08', filename: 'x64.micaupd' })
const OTHER_BOARD = download({ board: 'cx3576', profile: 'prod', deploymentId: 'dep-cx', releasedAt: '2026-09-05' })
const SAMPLE = [OLDER, NEWEST, UPDATE, OTHER_BOARD]

describe('filterDownloads', () => {
  it('narrows by profile, form and query', () => {
    expect(filterDownloads(SAMPLE, { profile: 'prod' })).toEqual([OTHER_BOARD])
    expect(filterDownloads(SAMPLE, { kind: 'update' })).toEqual([UPDATE])
    expect(filterDownloads(SAMPLE, { query: 'DEP-CX' })).toEqual([OTHER_BOARD])
    expect(filterDownloads(SAMPLE, { query: 'nothing' })).toEqual([])
  })
})

describe('selectVersions', () => {
  it('keeps every archive of one deployment: they are files, not versions', () => {
    const deployment = [
      download({ kind: 'update', variant: 'full', deploymentId: 'dep-1' }),
      download({ kind: 'update', variant: 'kernel', deploymentId: 'dep-1' }),
      download({ kind: 'update', variant: 'root', deploymentId: 'dep-1' }),
      download({ kind: 'image', deploymentId: 'dep-1' }),
    ]

    expect(selectVersions(deployment, false)).toHaveLength(4)
    expect(historyCount(deployment)).toBe(0)
  })

  it('opens on the newest of each board, profile and form', () => {
    expect(selectVersions(SAMPLE, false)).toEqual([NEWEST, UPDATE, OTHER_BOARD])
  })

  it('keeps every version when history is asked for, newest first', () => {
    expect(selectVersions(SAMPLE, true)).toEqual([NEWEST, UPDATE, OTHER_BOARD, OLDER])
  })

  it('counts what history would add', () => {
    expect(historyCount(SAMPLE)).toBe(1)
    expect(historyCount([NEWEST])).toBe(0)
  })
})

describe('the published catalogue', () => {
  // The content contract forbids hand-written release identities: rows arrive
  // from published artifact metadata or not at all.
  it('is empty until a release is published', () => {
    expect(DOWNLOADS).toEqual([])
  })
})

describe('downloadExplorer', () => {
  it('shows only its own board, newest of each form', () => {
    render(<DownloadExplorer copy={zh} board="x64" downloads={SAMPLE} />)

    expect(screen.getByText('dep-new')).toBeInTheDocument()
    expect(screen.getByText('dep-upd')).toBeInTheDocument()
    expect(screen.queryByText('dep-old')).not.toBeInTheDocument()
    expect(screen.queryByText('dep-cx')).not.toBeInTheDocument()
  })

  it('names the form of each row and the file it downloads', () => {
    render(<DownloadExplorer copy={zh} board="x64" downloads={[UPDATE]} />)

    expect(screen.getByText(zh.download.kinds.update)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'x64.micaupd' })).toHaveAttribute('href', UPDATE.href)
  })

  it('offers history only when there is history, and shows it when asked', async () => {
    const { rerender } = render(<DownloadExplorer copy={zh} board="x64" downloads={[NEWEST]} />)
    expect(screen.queryByRole('button', { name: new RegExp(zh.download.history) })).not.toBeInTheDocument()

    rerender(<DownloadExplorer copy={zh} board="x64" downloads={SAMPLE} />)
    screen.getByRole('button', { name: new RegExp(zh.download.history) }).click()

    expect(await screen.findByText('dep-old')).toBeInTheDocument()
  })

  it('gives each row its own identity, so a rerender does not reuse the wrong one', () => {
    // A deployment's three archives share deployment id, form and version; only
    // the file differs. Keying on the first three collapsed them for React.
    const deployment = [
      download({ kind: 'image', href: 'https://example.invalid/disk.img.gz' }),
      download({ kind: 'update', variant: 'full', href: 'https://example.invalid/a.micaupd' }),
      download({ kind: 'update', variant: 'kernel', href: 'https://example.invalid/a.kernel.micaupd' }),
      download({ kind: 'update', variant: 'root', href: 'https://example.invalid/a.root.micaupd' }),
    ]

    const { rerender, container } = render(
      <DownloadExplorer copy={zh} board="x64" downloads={deployment} />,
    )
    const links = () => [...container.querySelectorAll('tbody a')].map(a => a.getAttribute('href'))
    const first = links()

    rerender(<DownloadExplorer copy={zh} board="x64" downloads={deployment.slice(0, 2)} />)
    rerender(<DownloadExplorer copy={zh} board="x64" downloads={deployment} />)

    expect(links()).toEqual(first)
    expect(new Set(first).size).toBe(4)
  })

  it('explains an empty catalogue instead of showing an empty table', () => {
    render(<DownloadExplorer copy={zh} board="x64" downloads={[]} />)

    expect(screen.getByText(zh.download.empty)).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('renders the English dictionary just as well', () => {
    render(<DownloadExplorer copy={en} board="x64" downloads={[]} />)

    expect(screen.getByText(en.download.empty)).toBeInTheDocument()
  })
})

describe('the catalogue endpoint', () => {
  it('renders what /api/catalog answers, for this board', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ downloads: SAMPLE })))
    vi.stubGlobal('fetch', fetchMock)

    render(<DownloadExplorer copy={zh} board="cx3576" />)

    expect(await screen.findByText('dep-cx')).toBeInTheDocument()
    expect(screen.queryByText('dep-new')).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/catalog'), expect.anything())
    vi.unstubAllGlobals()
  })

  it('shows the empty state when the endpoint is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('offline')
    }))

    render(<DownloadExplorer copy={zh} board="x64" />)

    expect(await screen.findByText(zh.download.empty)).toBeInTheDocument()
    vi.unstubAllGlobals()
  })
})
