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

  it('never writes a placeholder theme over the pre-paint one on mount', () => {
    // A dark system: the pre-paint script has already set dark before hydration.
    // Hydrating used to write the server placeholder (auto + light system =
    // light) and then correct it, which painted one light frame.
    document.documentElement.dataset.theme = 'dark'
    // Replaced by hand and put back in `finally`: the setup file's matchMedia is
    // itself a mock, and restoring a spy on it strips its implementation from
    // every later test.
    const original = window.matchMedia
    window.matchMedia = (query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })

    const written: (string | null)[] = []
    const observer = new MutationObserver((records) => {
      for (const record of records)
        written.push(record.oldValue, document.documentElement.dataset.theme ?? null)
    })
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
      attributeOldValue: true,
    })

    try {
      renderHook(() => useThemeMode())
      observer.takeRecords().forEach(record => written.push(record.oldValue))
    }
    finally {
      observer.disconnect()
      window.matchMedia = original
    }

    expect(written).not.toContain('light')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('starts from the stored choice', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    const { result } = renderHook(() => useThemeMode())
    expect(result.current.mode).toBe('dark')
    expect(result.current.resolved).toBe('dark')
  })
})
