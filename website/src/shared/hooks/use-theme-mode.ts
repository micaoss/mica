import { useCallback, useEffect, useState } from 'react'

export const THEME_STORAGE_KEY = 'mica-site-theme'

export const themeModes = ['auto', 'light', 'dark'] as const

export type ThemeMode = (typeof themeModes)[number]
export type ResolvedTheme = 'light' | 'dark'

const DARK_QUERY = '(prefers-color-scheme: dark)'

export function readStoredMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (themeModes.includes(stored as ThemeMode))
      return stored as ThemeMode
  }
  catch {
    // Private-mode browsers can refuse storage; the default mode still works.
  }
  return 'auto'
}

export function resolveTheme(mode: ThemeMode, systemDark: boolean): ResolvedTheme {
  if (mode === 'auto')
    return systemDark ? 'dark' : 'light'
  return mode
}

/**
 * Owns the three-mode colour scheme. There is no React context here on purpose:
 * Astro islands do not share one, so the state lives in the DOM
 * (`<html data-theme>`) and in `localStorage`, which every island and the
 * pre-paint script already agree on.
 */
export function useThemeMode() {
  const [mode, setMode] = useState<ThemeMode>('auto')
  const [systemDark, setSystemDark] = useState(false)

  // The island is server-rendered as `auto` because neither localStorage nor
  // the media query exists there. Reading them in an effect is what keeps the
  // first client render identical to the server's, so hydration stays clean;
  // the pre-paint script in the document head means the visitor never sees the
  // intermediate state anyway.
  useEffect(() => {
    const query = window.matchMedia(DARK_QUERY)
    // eslint-disable-next-line react/set-state-in-effect -- see above: client-only values
    setMode(readStoredMode())
    // eslint-disable-next-line react/set-state-in-effect -- see above: client-only values
    setSystemDark(query.matches)

    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  const resolved = resolveTheme(mode, systemDark)

  useEffect(() => {
    document.documentElement.dataset.theme = resolved
    document.documentElement.style.colorScheme = resolved
  }, [resolved])

  const selectMode = useCallback((next: ThemeMode) => {
    setMode(next)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    }
    catch {
      // Persistence is best-effort; the choice still applies for this visit.
    }
  }, [])

  return { mode, resolved, selectMode }
}
