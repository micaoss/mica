import type { Download } from './catalog'
import type { CatalogueWords } from './products-catalog'
import { describe, expect, it } from 'vitest'
import { boardWords, categoriesOf, categoryOf, describeFile, productNote, wordIn } from './download-map'
import { catalogueFrom } from './products-catalog'
import { DOCUMENT } from './products-catalog.test'

const WORDS: CatalogueWords = catalogueFrom(DOCUMENT, 'src', 'now')

function file(partial: Partial<Download>): Download {
  return { board: 's905x5m', profile: 'sd-full', kind: 'image', version: 'v', releasedAt: 'd', bytes: 1, digest: 'x', href: 'h', filename: 'f', ...partial }
}

describe('the words of the catalogue', () => {
  it('lists a boot loader package under its own category, not as a system image', () => {
    const loader = file({ variant: 'sd-boot' })

    expect(categoryOf(WORDS, loader)).toBe('bootloader')
    expect(describeFile(WORDS, loader, 'zh')).toEqual({ category: '引导加载器', detail: 'SD 卡引导镜像' })
    expect(describeFile(WORDS, loader, 'en').category).toBe('Boot loader')
  })

  it('shows a form with no file type under its own name, in the kind\'s category', () => {
    const unknown = file({ variant: 'nand-raw' })

    expect(categoryOf(WORDS, unknown)).toBe('image')
    expect(describeFile(WORDS, unknown, 'zh')).toEqual({ category: '系统镜像', detail: 'nand-raw' })
  })

  it('shows a category with no row under its id', () => {
    expect(describeFile(WORDS, file({ kind: 'firmware', variant: undefined }), 'zh')).toEqual({ category: 'firmware' })
  })

  it('carries a file type\'s description where one is written', () => {
    const words = { ...WORDS, fileTypes: [{ kind: 'image', form: 'disk', category: 'image', title: { zh: '整盘镜像', en: '' }, description: { zh: '写入 SD 卡后启动', en: '' } }] }

    expect(describeFile(words, file({ variant: 'disk' }), 'zh').description).toBe('写入 SD 卡后启动')
  })

  it('falls back to the other language, then to nothing, for an unfilled word', () => {
    expect(wordIn({ zh: '', en: 'whole disk' }, 'zh')).toBe('whole disk')
    expect(wordIn({ zh: '', en: '' }, 'zh')).toBeUndefined()
    expect(wordIn(undefined, 'en')).toBeUndefined()
  })

  it('offers only the categories the rows fall under, in the document\'s order', () => {
    const rows = [file({ kind: 'update', variant: 'full' }), file({ variant: 'sd-boot' }), file({ variant: 'disk' })]

    expect(categoriesOf(WORDS, rows, 'zh')).toEqual([
      { id: 'image', label: '系统镜像' },
      { id: 'bootloader', label: '引导加载器' },
      { id: 'update', label: '升级包' },
    ])
  })

  it('words a product and a board, and says nothing for one the catalogue does not list', () => {
    expect(productNote(WORDS, 's905x5m', 'sd-full', 'zh')).toBe('SD 卡，带容器引擎')
    expect(productNote(WORDS, 's905x5m', 'nightly', 'zh')).toBeUndefined()
    expect(boardWords(WORDS, 's905x5m', 'en')).toEqual({ hardware: 'Amlogic S7D', status: 'Bring-up' })
    expect(boardWords(WORDS, 'rk3588', 'en')).toEqual({ hardware: undefined, status: undefined })
  })
})
