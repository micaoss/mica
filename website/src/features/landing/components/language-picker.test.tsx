import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { en } from '@/shared/i18n/en'
import { zh } from '@/shared/i18n/zh'
import { LanguagePicker } from './language-picker'

const paths = { zh: '/docs/', en: '/en/docs/' }

describe('languagePicker', () => {
  it('shows the label of the active locale', () => {
    render(<LanguagePicker locale="zh" label={zh.nav.langLabel} paths={paths} />)

    const trigger = screen.getByRole('combobox', { name: zh.nav.langLabel })
    expect(trigger).toHaveTextContent(zh.label)
  })

  it('shows the English label when English is active', () => {
    render(<LanguagePicker locale="en" label={en.nav.langLabel} paths={paths} />)

    expect(screen.getByRole('combobox', { name: en.nav.langLabel }))
      .toHaveTextContent(en.label)
  })
})
