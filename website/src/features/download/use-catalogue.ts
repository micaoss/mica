import type { Download } from './catalog'
import { useEffect, useState } from 'react'
import { DOWNLOADS } from './catalog'
import { isSample, parseCatalog } from './catalog-schema'

declare const __BUILD_ID__: string | undefined

/**
 * Where the Worker answers the catalogue. The build stamp only tells one
 * deploy's requests from another's; the Worker holds one answer for all.
 */
const CATALOG_ENDPOINT = `/api/catalog?v=${typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev'}`
/** The last catalogue this browser was answered, shown while the next is read. */
const STORAGE_KEY = 'mica.catalogue'
/** How long after a `refreshing` answer the new one is asked for. */
const REFRESH_DELAY_MS = 4000

export interface Catalogue {
  downloads: Download[]
  /** The rows are the labelled sample, not a release. */
  sample: boolean
  /** Nothing is known yet: no kept copy, and the endpoint has not answered. */
  loading: boolean
}

function kept(): unknown {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
  }
  catch {
    return null
  }
}

function keep(payload: unknown): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  }
  catch {
    // Storage that is full or switched off costs the instant first paint only.
  }
}

/**
 * The catalogue for a download page: the copy this browser kept is shown at
 * once, then the endpoint's answer replaces it. An answer the Worker marks
 * `refreshing` is its last good copy, served while it reads the resource
 * service again, so the endpoint is asked once more for the new one.
 *
 * A failed or unreadable answer leaves what is shown standing.
 */
export function useCatalogue(given?: Download[]): Catalogue {
  const [state, setState] = useState<Catalogue>({ downloads: DOWNLOADS, sample: false, loading: !given })

  useEffect(() => {
    if (given)
      return
    const cancel = new AbortController()
    let again: ReturnType<typeof setTimeout> | undefined

    // Storage cannot be read while the page is rendered on the server, so the
    // kept copy is shown on mount, ahead of the request, through this same call.
    const show = (payload: unknown): void =>
      // eslint-disable-next-line react/set-state-in-effect
      setState({ downloads: parseCatalog(payload), sample: isSample(payload), loading: false })

    const before = kept()
    if (before)
      show(before)

    const ask = async (retry: boolean): Promise<void> => {
      try {
        const response = await fetch(CATALOG_ENDPOINT, { signal: cancel.signal, ...(retry ? { cache: 'reload' as const } : {}) })
        if (!response.ok)
          throw new Error(`the catalogue answered ${response.status}`)
        const payload: unknown = await response.json()
        show(payload)
        if (!isSample(payload))
          keep(payload)
        if (!retry && (payload as { refreshing?: unknown } | null)?.refreshing === true)
          again = setTimeout(() => void ask(true), REFRESH_DELAY_MS)
      }
      catch {
        if (!cancel.signal.aborted)
          setState(current => ({ ...current, loading: false }))
      }
    }
    void ask(false)

    return () => {
      cancel.abort()
      clearTimeout(again)
    }
  }, [given])

  return given ? { downloads: given, sample: false, loading: false } : state
}
