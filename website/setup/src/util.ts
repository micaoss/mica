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

const OCTET = '(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)'
const IPV4 = new RegExp(`^${OCTET}(?:\\.${OCTET}){3}$`)
const CIDR = new RegExp(`^${OCTET}(?:\\.${OCTET}){3}/(?:3[0-2]|[12]?\\d)$`)
// Loose on purpose: the device holds the DNS list to its own rules; this catches typing slips.
const IPV6 = /^[0-9a-f]{0,4}(?::[0-9a-f]{0,4}){2,7}$/i

export const isIpv4 = (v: string) => IPV4.test(v)
/** An IPv4 address with its prefix, as `setNetwork`'s `static.address` takes it. */
export const isCidr = (v: string) => CIDR.test(v)
export const isIp = (v: string) => IPV4.test(v) || IPV6.test(v)

/** DNS servers as typed: separated by spaces or commas. */
export function splitList(v: string): string[] {
  return v.split(/[\s,]+/).filter(Boolean)
}
