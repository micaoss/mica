import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { en } from '@/shared/i18n/en'
import { zh } from '@/shared/i18n/zh'
import { BoardGuides } from './components/board-guides'
import { BoardIndex } from './components/board-index'
import { boardFrom, indexFrom } from './products-catalog'
import { BOARD, INDEX, published } from './products-catalog.test'

const CATALOGUE = boardFrom('s905x5m', BOARD, published, 'src', 'now')

describe('the board index', () => {
  it('lists the catalogue\'s boards in its order, each worded and leading to its page', () => {
    render(<BoardIndex copy={zh} index={indexFrom(INDEX, 'src', 'now')} />)

    const cards = screen.getAllByRole('link')
    expect(cards.map(card => card.getAttribute('href'))).toEqual(['/download/uefi-x64/', '/download/s905x5m/'])
    expect(screen.getByText('通用 amd64')).toBeInTheDocument()
    expect(screen.getByText('QEMU 基线')).toBeInTheDocument()
  })

  it('names a board\'s newest version, and says so when it has no release', () => {
    render(<BoardIndex copy={zh} index={indexFrom(INDEX, 'src', 'now')} />)

    expect(screen.getByText(`${zh.download.latest} 20261004-1510`)).toBeInTheDocument()
    expect(screen.getByText(zh.download.nothingYet)).toBeInTheDocument()
  })

  it('leads to the pages of the page\'s own language', () => {
    render(<BoardIndex copy={en} index={indexFrom(INDEX, 'src', 'now')} />)

    expect(screen.getAllByRole('link')[0]).toHaveAttribute('href', '/en/download/uefi-x64/')
    expect(screen.getByText('Generic amd64')).toBeInTheDocument()
  })

  it('says so when the catalogue lists no board', () => {
    render(<BoardIndex copy={zh} index={indexFrom({ boards: [], products: [] }, 'src', 'now')} />)

    expect(screen.getByText(zh.download.nothingYet)).toBeInTheDocument()
  })
})

describe('a board\'s guides', () => {
  it('links a guide to this site\'s document in the page\'s language, and an outside one as given', () => {
    render(<BoardGuides copy={zh} board="s905x5m" catalogue={CATALOGUE} />)

    expect(screen.getByRole('heading', { name: zh.download.guides.heading })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /写入镜像/ })).toHaveAttribute('href', '/docs/start/flashing/')
    expect(screen.getByRole('link', { name: /板卡源码/ })).toHaveAttribute('href', 'https://github.com/micaoss/mica-build/tree/main/boards/s905x5m')
  })

  it('words a guide in the other language, with its body', () => {
    render(<BoardGuides copy={en} board="s905x5m" catalogue={CATALOGUE} />)

    expect(screen.getByRole('link', { name: /Writing the image/ })).toHaveAttribute('href', '/en/docs/start/flashing/')
    expect(screen.getByText('Board by board.')).toBeInTheDocument()
  })

  it('never links a guide to anything but an https address or a document of this site', () => {
    const guide = (target: object) => ({ title: { zh: '指南', en: 'Guide' }, body: { zh: '', en: '' }, ...target })
    // A copy kept in the browser is read without passing the Worker again.

    const kept = { ...CATALOGUE, guides: [guide({ url: 'javascript:alert(1)' }), guide({ url: 'http://example.invalid/' }), guide({ url: 'https://example.invalid/ok' })] }
    render(<BoardGuides copy={zh} board="s905x5m" catalogue={kept} />)

    expect(screen.getAllByRole('link').map(link => link.getAttribute('href'))).toEqual(['https://example.invalid/ok'])
  })

  it('leaves out a guide the catalogue has not titled, and the section when no guide is left', () => {
    const untitled = { ...CATALOGUE, guides: [{ title: { zh: '', en: '' }, body: { zh: '', en: '' }, doc: 'start/flashing' }] }
    const { container } = render(<BoardGuides copy={zh} board="s905x5m" catalogue={untitled} />)

    expect(container).toBeEmptyDOMElement()
  })
})
