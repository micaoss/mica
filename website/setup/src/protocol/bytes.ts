export type Bytes = Uint8Array<ArrayBuffer>

const encoder = new TextEncoder()
const decoder = new TextDecoder('utf-8', { fatal: true })

export const utf8 = (s: string): Bytes => encoder.encode(s)
export const fromUtf8 = (b: Uint8Array): string => decoder.decode(b)

/** A copy backed by its own ArrayBuffer, which WebCrypto's types require. */
export const own = (b: Uint8Array): Bytes => new Uint8Array(b)

export function concat(...parts: Uint8Array[]): Bytes {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let off = 0
  for (const p of parts) {
    out.set(p, off)
    off += p.length
  }
  return out
}

export function toHex(b: Uint8Array): string {
  return Array.from(b, x => x.toString(16).padStart(2, '0')).join('')
}

export function fromHex(hex: string): Bytes {
  if (hex.length % 2 || /[^0-9a-f]/i.test(hex))
    throw new Error('not hex')
  return Uint8Array.from(hex.match(/../g) ?? [], h => Number.parseInt(h, 16))
}

export function toBase64(b: Uint8Array): string {
  return btoa(String.fromCharCode(...b))
}

export function fromBase64(s: string): Bytes {
  if (typeof s !== 'string' || !/^(?:[A-Z0-9+/]{4})*(?:[A-Z0-9+/]{2}==|[A-Z0-9+/]{3}=)?$/i.test(s))
    throw new Error('not base64')
  return Uint8Array.from(atob(s), c => c.charCodeAt(0))
}

/** Big-endian unsigned integer. */
export function toBigInt(b: Uint8Array): bigint {
  return b.length ? BigInt(`0x${toHex(b)}`) : 0n
}

export function fromBigInt(x: bigint, length: number): Bytes {
  return fromHex(x.toString(16).padStart(length * 2, '0'))
}

/** `len(x) || x` with an 8-byte little-endian length, as RFC 9383 frames its transcript. */
export function len8(b: Uint8Array): Bytes {
  const out = new Uint8Array(8 + b.length)
  new DataView(out.buffer).setBigUint64(0, BigInt(b.length), true)
  out.set(b, 8)
  return out
}

export function equal(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length)
    return false
  let d = 0
  for (let i = 0; i < a.length; i++)
    d |= a[i] ^ b[i]
  return d === 0
}
