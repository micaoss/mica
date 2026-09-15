import type { Image } from './catalog'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { en } from '@/shared/i18n/en'
import { zh } from '@/shared/i18n/zh'
import { filterImages, historyCount, IMAGES, selectVersions } from './catalog'
import { DownloadExplorer } from './components/download-explorer'

function image(partial: Partial<Image>): Image {
  return {
    board: 'x64',
    profile: 'dev',
    version: '2026.09-1',
    deploymentId: 'dep-aa11',
    releasedAt: '2026-09-01',
    bytes: 1_073_741_824,
    digest: 'sha256:aaaa',
    href: 'https://example.invalid/x64.img',
    ...partial,
  }
}

const NEWEST = image({ version: '2026.09-2', deploymentId: 'dep-new', releasedAt: '2026-09-10' })
const OLDER = image({ version: '2026.08-1', deploymentId: 'dep-old', releasedAt: '2026-08-01' })
const OTHER_BOARD = image({ board: 'cx3576', profile: 'prod', deploymentId: 'dep-cx', releasedAt: '2026-09-05' })
const SAMPLE = [OLDER, NEWEST, OTHER_BOARD]

describe('filterImages', () => {
  it('returns everything when nothing is selected', () => {
    expect(filterImages(SAMPLE, {})).toHaveLength(3)
  })

  it('narrows by board and profile', () => {
    expect(filterImages(SAMPLE, { board: 'cx3576' })).toEqual([OTHER_BOARD])
    expect(filterImages(SAMPLE, { profile: 'prod' })).toEqual([OTHER_BOARD])
  })

  it('matches the query against version and deployment id, case-insensitively', () => {
    expect(filterImages(SAMPLE, { query: '2026.08' })).toEqual([OLDER])
    expect(filterImages(SAMPLE, { query: 'DEP-CX' })).toEqual([OTHER_BOARD])
    expect(filterImages(SAMPLE, { query: 'nothing' })).toEqual([])
  })
})

describe('selectVersions', () => {
  it('opens on the newest image of each board and profile', () => {
    expect(selectVersions(SAMPLE, false)).toEqual([NEWEST, OTHER_BOARD])
  })

  it('keeps every version when history is asked for, newest first', () => {
    expect(selectVersions(SAMPLE, true)).toEqual([NEWEST, OTHER_BOARD, OLDER])
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
    expect(IMAGES).toEqual([])
  })
})

describe('downloadExplorer', () => {
  it('opens on the newest image per board and profile', () => {
    render(<DownloadExplorer copy={zh} images={SAMPLE} />)

    expect(screen.getByText('dep-new')).toBeInTheDocument()
    expect(screen.getByText('dep-cx')).toBeInTheDocument()
    expect(screen.queryByText('dep-old')).not.toBeInTheDocument()
  })

  it('offers history only when there is history, and shows it when asked', async () => {
    const { rerender } = render(<DownloadExplorer copy={zh} images={[NEWEST]} />)
    expect(screen.queryByRole('button', { name: new RegExp(zh.download.history) })).not.toBeInTheDocument()

    rerender(<DownloadExplorer copy={zh} images={SAMPLE} />)
    const button = screen.getByRole('button', { name: new RegExp(zh.download.history) })
    button.click()

    expect(await screen.findByText('dep-old')).toBeInTheDocument()
  })

  it('explains an empty catalogue instead of showing an empty table', () => {
    render(<DownloadExplorer copy={zh} images={[]} />)

    expect(screen.getByText(zh.download.empty)).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('renders the English dictionary just as well', () => {
    render(<DownloadExplorer copy={en} images={[]} />)

    expect(screen.getByText(en.download.empty)).toBeInTheDocument()
  })
})

describe('the catalogue endpoint', () => {
  it('renders what /api/catalog answers', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ images: SAMPLE })))
    vi.stubGlobal('fetch', fetchMock)

    render(<DownloadExplorer copy={zh} />)

    expect(await screen.findByText('dep-new')).toBeInTheDocument()
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
