import type { Bytes } from './bytes'

// Every message on session, command and event travels as fragments: a 3-byte
// header (seq, big-endian; flags, bit 0 = last) and up to size - 3 bytes.

export const MAX_MESSAGE = 16384
const HEADER = 3

export function fragment(message: Uint8Array, size: number): Bytes[] {
  const body = size - HEADER
  if (!Number.isInteger(size) || body < 1)
    throw new Error(`fragment size ${size} is too small`)
  if (message.length > MAX_MESSAGE)
    throw new Error('message too long')
  const out: Bytes[] = []
  for (let seq = 0, off = 0; seq === 0 || off < message.length; seq++, off += body) {
    const chunk = message.subarray(off, off + body)
    const f = new Uint8Array(HEADER + chunk.length)
    f[0] = seq >> 8
    f[1] = seq & 0xFF
    f[2] = off + body >= message.length ? 1 : 0
    f.set(chunk, HEADER)
    out.push(f)
  }
  return out
}

/** Joins one direction's fragments back into messages; throws on a broken stream. */
export class Reassembler {
  private parts: Uint8Array[] = []
  private size = 0

  /** The whole message once its last fragment arrives, otherwise null. */
  push(f: Uint8Array): Bytes | null {
    if (f.length < HEADER || (f[2] & ~1)) {
      this.reset()
      throw new Error('malformed fragment')
    }
    const seq = (f[0] << 8) | f[1]
    if (seq !== this.parts.length) {
      this.reset()
      throw new Error(`fragment ${seq} out of order`)
    }
    this.size += f.length - HEADER
    if (this.size > MAX_MESSAGE) {
      this.reset()
      throw new Error('message too long')
    }
    this.parts.push(f.subarray(HEADER))
    if (!(f[2] & 1))
      return null
    const out = new Uint8Array(this.size)
    let off = 0
    for (const p of this.parts) {
      out.set(p, off)
      off += p.length
    }
    this.reset()
    return out
  }

  private reset() {
    this.parts = []
    this.size = 0
  }
}
