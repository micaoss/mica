import type { BoardCatalogue, IndexCatalogue } from './products-catalog'
import { useEffect, useState } from 'react'
import { parseBoard, parseIndex } from './catalog-schema'
import { CATALOGUE_VERSION } from './products-catalog'

declare const __BUILD_ID__: string | undefined

/** The build stamp only tells one deploy's requests from another's; the Worker holds one answer for all. */
const BUILD = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev'
/** How long after a `refreshing` answer the new one is asked for. */
const REFRESH_DELAY_MS = 4000

/** What a page reads from the catalogue endpoint, and how it stands. */
export interface CatalogueState<T> {
  /** The answer, or the copy this browser kept; null until either is there. */
  data: T | null
  /** The rows are the labelled sample, not a release. */
  sample: boolean
  /** Nothing is known yet: no kept copy, and the endpoint has not answered. */
  loading: boolean
}

function kept(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null')
  }
  catch {
    return null
  }
}

function keep(key: string, payload: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(payload))
  }
  catch {
    // Storage that is full or switched off costs the instant first paint only.
  }
}

/**
 * One document of the catalogue endpoint: the copy this browser kept is shown
 * at once, then the endpoint's answer replaces it. An answer the Worker marks
 * `refreshing` is its last good copy, served while it reads the resource
 * service again, so the endpoint is asked once more for the new one.
 *
 * A failed or unreadable answer leaves what is shown standing. A value given
 * by a test is used as it is, and nothing is read.
 */
function useDocument<T>(path: string, parse: (payload: unknown) => T | null, given?: T): CatalogueState<T> {
  const [state, setState] = useState<CatalogueState<T>>({ data: null, sample: false, loading: !given })

  useEffect(() => {
    if (given)
      return
    const cancel = new AbortController()
    let again: ReturnType<typeof setTimeout> | undefined
    // The shape's version is in the key, so a copy of another shape is never read.
    const key = `mica.catalogue.v${CATALOGUE_VERSION}${path}`

    // Storage cannot be read while the page is rendered on the server, so the
    // kept copy is shown on mount, ahead of the request, through this same call.
    const show = (payload: unknown): boolean => {
      const data = parse(payload)
      if (data)
        // eslint-disable-next-line react/set-state-in-effect
        setState({ data, sample: (payload as { sample?: unknown }).sample === true, loading: false })
      return data !== null
    }

    show(kept(key))

    const ask = async (retry: boolean): Promise<void> => {
      try {
        const response = await fetch(`${path}?v=${BUILD}`, { signal: cancel.signal, ...(retry ? { cache: 'reload' as const } : {}) })
        if (!response.ok)
          throw new Error(`the catalogue answered ${response.status}`)
        const payload: unknown = await response.json()
        if (!show(payload))
          throw new Error('the catalogue answered another shape')
        if ((payload as { sample?: unknown }).sample !== true)
          keep(key, payload)
        if (!retry && (payload as { refreshing?: unknown }).refreshing === true)
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
  }, [given, path, parse])

  return given ? { data: given, sample: false, loading: false } : state
}

/** The index: every listed board and product. */
export function useIndex(given?: IndexCatalogue): CatalogueState<IndexCatalogue> {
  return useDocument('/api/catalog', parseIndex, given)
}

/** One board: its download rows, their words and its guides. */
export function useBoard(board: string, given?: BoardCatalogue): CatalogueState<BoardCatalogue> {
  return useDocument(`/api/catalog/${board}`, parseBoard, given)
}
