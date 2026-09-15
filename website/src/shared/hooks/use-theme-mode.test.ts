import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { readStoredMode, resolveTheme, THEME_STORAGE_KEY, useThemeMode } from './use-theme-mode'

describe('resolveTheme', () => {
  it('follows the system only in auto mode', () => {
    expect(resolveTheme('auto', true)).toBe('dark')
    expect(resolveTheme('auto', false)).toBe('light')
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })
})

describe('readStoredMode', () => {
  beforeEach(() => localStorage.clear())

  it('defaults to auto when nothing is stored', () => {
    expect(readStoredMode()).toBe('auto')
  })

  it('ignores a stored value that is not a mode', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'chartreuse')
    expect(readStoredMode()).toBe('auto')
  })

  it('returns a stored mode', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    expect(readStoredMode()).toBe('dark')
  })
})

describe('useThemeMode', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  it('applies and persists the mode it is given', () => {
    const { result } = renderHook(() => useThemeMode())
    expect(result.current.mode).toBe('auto')

    act(() => result.current.selectMode('dark'))
    expect(result.current.mode).toBe('dark')
    expect(result.current.resolved).toBe('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')

    act(() => result.current.selectMode('light'))
    expect(result.current.mode).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')

    act(() => result.current.selectMode('auto'))
    expect(result.current.mode).toBe('auto')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('auto')
  })

  it('starts from the stored choice', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    const { result } = renderHook(() => useThemeMode())
    expect(result.current.mode).toBe('dark')
    expect(result.current.resolved).toBe('dark')
  })
})
