import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { THEME_STORAGE_KEY } from '@/shared/hooks/use-theme-mode'
import { zh } from '@/shared/i18n/zh'
import { ThemeSelect } from './theme-select'

const labels = {
  auto: zh.nav.themeAuto,
  light: zh.nav.themeLight,
  dark: zh.nav.themeDark,
}

function renderSelect() {
  return render(<ThemeSelect label={zh.nav.themeLabel} labels={labels} />)
}

describe('themeSelect', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  it('shows the active mode on a labelled trigger', () => {
    renderSelect()
    const trigger = screen.getByRole('combobox', { name: zh.nav.themeLabel })
    expect(trigger).toHaveTextContent(zh.nav.themeAuto)
  })

  it('offers all three modes', async () => {
    const user = userEvent.setup()
    renderSelect()

    await user.click(screen.getByRole('combobox', { name: zh.nav.themeLabel }))

    for (const label of Object.values(labels))
      expect(await screen.findByRole('option', { name: label })).toBeInTheDocument()
  })

  it('applies and persists the mode that is chosen', async () => {
    const user = userEvent.setup()
    renderSelect()

    await user.click(screen.getByRole('combobox', { name: zh.nav.themeLabel }))
    await user.click(await screen.findByRole('option', { name: zh.nav.themeDark }))

    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(screen.getByRole('combobox', { name: zh.nav.themeLabel }))
      .toHaveTextContent(zh.nav.themeDark)
  })

  it('starts from the stored choice', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light')
    renderSelect()
    expect(screen.getByRole('combobox', { name: zh.nav.themeLabel }))
      .toHaveTextContent(zh.nav.themeLight)
  })
})
