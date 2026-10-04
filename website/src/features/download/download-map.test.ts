import type { Download } from './catalog'
import { describe, expect, it } from 'vitest'
import table from '../../../download-map.json'
import { categoriesOf, categoryOf, describeFile, productNote } from './download-map'

function file(partial: Partial<Download>): Download {
  return { board: 's905x5m', profile: 'sd-full', kind: 'image', version: 'v', releasedAt: 'd', bytes: 1, digest: 'x', href: 'h', filename: 'f', ...partial }
}

describe('the download mapping table', () => {
  it('lists a boot loader package under its own category, not as a system image', () => {
    const loader = file({ variant: 'sd-boot' })

    expect(categoryOf(loader)).toBe('bootloader')
    expect(describeFile(loader, 'zh')).toEqual({ category: '引导加载器', detail: 'USB 烧录包' })
    expect(describeFile(loader, 'en').category).toBe('Boot loader')
  })

  it('words the forms of a system image and of an update', () => {
    expect(describeFile(file({ variant: 'disk' }), 'zh')).toEqual({ category: '系统镜像', detail: '整盘镜像' })
    expect(describeFile(file({ variant: 'usb-burn' }), 'zh')).toEqual({ category: '系统镜像', detail: 'USB 烧录包' })
    expect(describeFile(file({ kind: 'update', variant: 'root' }), 'en')).toEqual({ category: 'Update package', detail: 'root only' })
  })

  it('shows a form it has no row for under its own name, in the kind\'s category', () => {
    const unknown = file({ variant: 'nand-raw' })

    expect(categoryOf(unknown)).toBe('image')
    expect(describeFile(unknown, 'zh')).toEqual({ category: '系统镜像', detail: 'nand-raw' })
  })

  it('names a file without a form by its category alone', () => {
    expect(describeFile(file({ variant: undefined }), 'zh')).toEqual({ category: '系统镜像' })
  })

  it('offers only the categories the rows fall under, in the table\'s order', () => {
    const rows = [file({ kind: 'update', variant: 'full' }), file({ variant: 'sd-boot' }), file({ variant: 'disk' })]

    expect(categoriesOf(rows, 'zh')).toEqual([
      { id: 'image', label: '系统镜像' },
      { id: 'bootloader', label: '引导加载器' },
      { id: 'update', label: '升级包' },
    ])
  })

  it('words a product, the board\'s own row before the general one', () => {
    expect(productNote('s905x5m', 'basic', 'zh')).toBe('eMMC，基础系统')
    expect(productNote('cx3576', 'basic', 'zh')).toBe('基础系统')
    expect(productNote('cx3576', 'nightly', 'zh')).toBeUndefined()
  })

  it('points every file row at a category the table defines', () => {
    const ids = new Set(table.categories.map(category => category.id))
    for (const row of table.files)
      expect(ids.has(row.category)).toBe(true)
  })
})
