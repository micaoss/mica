import type { Download } from './catalog'
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { en } from '@/shared/i18n/en'
import { zh } from '@/shared/i18n/zh'
import { DOWNLOADS, filterDownloads, historyCount, selectVersions } from './catalog'
import { DownloadExplorer } from './components/download-explorer'
import { catalogueFrom } from './products-catalog'
import { DOCUMENT } from './products-catalog.test'

/** The words of a catalogue document, as the endpoint answers them. */
const WORDS = catalogueFrom(DOCUMENT, 'src', 'now')

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

const NEWEST = download({ version: '2026.09-2', deploymentId: 'dep-new', releasedAt: '2026-09-10', href: 'https://example.invalid/new.img' })
const OLDER = download({ version: '2026.08-1', deploymentId: 'dep-old', releasedAt: '2026-08-01', href: 'https://example.invalid/old.img' })
// The update archive of the same release as NEWEST.
const UPDATE = download({ kind: 'update', variant: 'full', version: '2026.09-2', deploymentId: 'dep-upd', releasedAt: '2026-09-10', filename: 'x64.micaupd', href: 'https://example.invalid/x64.micaupd' })
const OTHER_BOARD = download({ board: 'cx3576', profile: 'prod', deploymentId: 'dep-cx', releasedAt: '2026-09-05', href: 'https://example.invalid/cx.img' })
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

  it('opens on the newest release of each board and profile', () => {
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
  it('shows only its own board, at its newest release', () => {
    render(<DownloadExplorer copy={zh} board="x64" downloads={SAMPLE} />)

    expect(screen.getByText('dep-new')).toBeInTheDocument()
    expect(screen.getByText('dep-upd')).toBeInTheDocument()
    expect(screen.queryByText('dep-old')).not.toBeInTheDocument()
    expect(screen.queryByText('dep-cx')).not.toBeInTheDocument()
  })

  it('names the form of each row and the file it downloads', () => {
    render(<DownloadExplorer copy={zh} board="x64" downloads={[UPDATE]} words={WORDS} />)

    expect(screen.getByText('升级包')).toBeInTheDocument()
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

  it('offers only the forms the board publishes', async () => {
    const { container } = render(
      <DownloadExplorer copy={zh} board="x64" downloads={[NEWEST, UPDATE]} words={WORDS} />,
    )
    const trigger = container.querySelectorAll<HTMLElement>('[data-slot="select-trigger"]')[1]
    trigger.click()

    const options = (await screen.findAllByRole('option')).map(option => option.textContent)
    expect(options).toEqual([zh.download.filters.all, '系统镜像', '升级包'])
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

describe('the newest release of a product', () => {
  const older = { version: '20261003-1942', releasedAt: '2026-10-03' }
  const newer = { version: '20261004-1511', releasedAt: '2026-10-04' }
  const rows = [
    download({ ...older, variant: 'disk', href: 'https://example.invalid/old.img.gz' }),
    download({ ...older, variant: 'usb-burn', href: 'https://example.invalid/old.burn.img.gz' }),
    download({ ...newer, variant: 'usb-burn', href: 'https://example.invalid/new.burn.img.gz' }),
    download({ ...newer, kind: 'update', variant: 'full', href: 'https://example.invalid/new.micaupd' }),
  ]

  it('shows only what that release carries: a form it dropped is history', () => {
    const latest = selectVersions(rows, false)

    expect(latest.map(row => row.href)).toEqual([
      'https://example.invalid/new.burn.img.gz',
      'https://example.invalid/new.micaupd',
    ])
    expect(historyCount(rows)).toBe(2)
  })

  it('keeps each product at its own newest release', () => {
    const other = download({ ...older, profile: 'sd-full', variant: 'disk', href: 'https://example.invalid/sd.img.gz' })

    expect(selectVersions([...rows, other], false).map(row => row.profile)).toEqual(['dev', 'dev', 'sd-full'])
  })
})

describe('the catalogue endpoint', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('renders what /api/catalog answers, for this board', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ downloads: SAMPLE })))
    vi.stubGlobal('fetch', fetchMock)

    render(<DownloadExplorer copy={zh} board="cx3576" />)

    expect(await screen.findByText('dep-cx')).toBeInTheDocument()
    expect(screen.queryByText('dep-new')).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/catalog'), expect.anything())
  })

  it('shows the empty state when the endpoint is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('offline')
    }))

    render(<DownloadExplorer copy={zh} board="x64" />)

    expect(await screen.findByText(zh.download.empty)).toBeInTheDocument()
  })

  it('says it is reading, not that nothing is published, until the endpoint answers', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})))

    render(<DownloadExplorer copy={zh} board="x64" />)

    expect(screen.getByText(zh.download.loading)).toBeInTheDocument()
    expect(screen.queryByText(zh.download.empty)).not.toBeInTheDocument()
  })

  it('shows the catalogue this browser kept before the endpoint answers', async () => {
    localStorage.setItem('mica.catalogue.v2', JSON.stringify({ version: 2, downloads: SAMPLE }))
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})))

    render(<DownloadExplorer copy={zh} board="cx3576" />)

    expect(await screen.findByText('dep-cx')).toBeInTheDocument()
  })

  it('keeps what the endpoint answered for the next visit', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ downloads: SAMPLE }))))

    render(<DownloadExplorer copy={zh} board="cx3576" />)
    await screen.findByText('dep-cx')

    expect(JSON.parse(localStorage.getItem('mica.catalogue.v2') ?? 'null').downloads).toHaveLength(SAMPLE.length)
  })

  it('keeps showing the kept catalogue when the endpoint is unreachable', async () => {
    localStorage.setItem('mica.catalogue.v2', JSON.stringify({ version: 2, downloads: SAMPLE }))
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('offline')
    }))

    render(<DownloadExplorer copy={zh} board="cx3576" />)

    expect(await screen.findByText('dep-cx')).toBeInTheDocument()
  })

  it('asks again for the new catalogue when the answer says one is being read', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ downloads: [], refreshing: true })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ downloads: SAMPLE })))
    vi.stubGlobal('fetch', fetchMock)

    render(<DownloadExplorer copy={zh} board="cx3576" />)
    await screen.findByText(zh.download.empty)
    await vi.advanceTimersByTimeAsync(4000)

    expect(await screen.findByText('dep-cx')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ cache: 'reload' })
  })

  it('names a row by the catalogue\'s words, and an unknown form by its own name', () => {
    const images = [
      download({ variant: 'disk', href: 'https://example.invalid/a.img.gz' }),
      download({ variant: 'sd-boot', href: 'https://example.invalid/a.sd-boot.img.gz' }),
      download({ variant: 'nand-raw', href: 'https://example.invalid/a.nand.img.gz' }),
    ]

    render(<DownloadExplorer copy={zh} board="x64" downloads={images} words={WORDS} />)

    expect(screen.getByText('整盘镜像')).toBeInTheDocument()
    expect(screen.getByText('引导加载器')).toBeInTheDocument()
    expect(screen.getByText('nand-raw')).toBeInTheDocument()
  })

  it('shows a row under its own names where the catalogue has no words', () => {
    render(<DownloadExplorer copy={zh} board="x64" downloads={[download({ variant: 'disk' })]} />)

    expect(screen.getByText('image')).toBeInTheDocument()
    expect(screen.getByText('disk')).toBeInTheDocument()
  })

  it('filters a boot loader package apart from the system images', async () => {
    const images = [
      download({ variant: 'disk', deploymentId: 'dep-disk', href: 'https://example.invalid/a.img.gz' }),
      download({ variant: 'sd-boot', deploymentId: 'dep-loader', href: 'https://example.invalid/a.sd-boot.img.gz' }),
    ]
    const { container } = render(<DownloadExplorer copy={zh} board="x64" downloads={images} words={WORDS} />)

    container.querySelectorAll<HTMLElement>('[data-slot="select-trigger"]')[1].click()
    ;(await screen.findByRole('option', { name: '引导加载器' })).click()

    expect(await screen.findByText('dep-loader')).toBeInTheDocument()
    expect(screen.queryByText('dep-disk')).not.toBeInTheDocument()
  })

  it('says what a product is and marks the recommended one, in the catalogue\'s words', async () => {
    const rows = [download({ board: 's905x5m', profile: 'sd-full', variant: 'disk' })]
    const { container } = render(<DownloadExplorer copy={zh} board="s905x5m" downloads={rows} words={WORDS} />)

    expect(screen.getByText(zh.download.recommended)).toBeInTheDocument()
    container.querySelectorAll<HTMLElement>('[data-slot="select-trigger"]')[0].click()
    expect(await screen.findByRole('option', { name: 'sd-full · SD 卡，带容器引擎' })).toBeInTheDocument()
  })

  it('reads a product\'s earlier releases only when the visitor asks for them', async () => {
    const latest = download({ board: 's905x5m', profile: 'sd-full', variant: 'disk', version: '20261004-1510', releasedAt: '2026-10-04', deploymentId: 'dep-latest', href: 'https://dl.test/new.img.gz' })
    const earlier = {
      baseUrl: 'https://dl.test/mica/s905x5m.sd-full/20261003-1942/',
      id: 's905x5m.sd-full.20261003-1942',
      product: 's905x5m.sd-full',
      board: 's905x5m',
      variant: 'sd-full',
      files: [{ kind: 'image', form: 'disk', path: 'old.img.gz', sha256: 'a'.repeat(64), size: 1 }],
    }
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url === 'https://res.test/update/v2/s905x5m.sd-full/releases.json')
        return new Response(JSON.stringify({ baseUrl: 'https://dl.test/mica/', releases: [{ id: earlier.id, path: 'old/index.json' }] }))
      if (url === 'https://dl.test/mica/old/index.json')
        return new Response(JSON.stringify(earlier))
      return new Response('missing', { status: 404 })
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<DownloadExplorer copy={zh} board="s905x5m" downloads={[latest]} words={WORDS} />)
    expect(fetchMock).not.toHaveBeenCalled()
    screen.getByRole('button', { name: zh.download.history }).click()

    expect(await screen.findByRole('link', { name: 'old.img.gz' })).toBeInTheDocument()
    expect(screen.getByText('dep-latest')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
