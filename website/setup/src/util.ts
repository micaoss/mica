// Scan results and the platform, for the page.

import { SETUP_HOST } from './config'

export interface Network {
  ssid: string
  signalDbm: number
  security: string
}

export function isIos(userAgent: string, maxTouchPoints: number): boolean {
  return /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)
}

/** Scan results merged by name, strongest first; hidden networks have no name to show. */
export function mergeNetworks(list: unknown): Network[] {
  const best = new Map<string, Network>()
  for (const n of Array.isArray(list) ? list : []) {
    if (typeof n?.ssid !== 'string' || !n.ssid)
      continue
    const cur = best.get(n.ssid)
    if (!cur || n.signalDbm > cur.signalDbm)
      best.set(n.ssid, { ssid: n.ssid, signalDbm: Number(n.signalDbm), security: String(n.security) })
  }
  return [...best.values()].sort((a, b) => b.signalDbm - a.signalDbm)
}

/**
 * The https address for a plain-http visit to the page's host: Web Bluetooth needs a secure
 * context, and the zone does not redirect by itself. Null when no redirect is due.
 */
export function httpsRedirect(loc: { protocol: string, hostname: string, href: string }): string | null {
  return loc.protocol === 'http:' && loc.hostname === SETUP_HOST ? `https:${loc.href.slice('http:'.length)}` : null
}
