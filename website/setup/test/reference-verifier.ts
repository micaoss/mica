// The mock device's SPAKE2+ Verifier, built on the Node reference of mica-core (BigInt P-256,
// node:crypto): an implementation independent of the page's noble-curves and WebCrypto one.

import type { SpakeVerifier } from './mock-device'
import { Buffer } from 'node:buffer'
import crypto from 'node:crypto'
import * as ref from './reference/spake2plus.mjs'

const PROVER = 'mica-provisioning phone'
const VERIFIER = 'mica-provisioning device'
const n = 0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551n

function len8(b: Uint8Array) {
  const l = Buffer.alloc(8)
  l.writeBigUInt64LE(BigInt(b.length))
  return Buffer.concat([l, b])
}
const hmac = (key: Uint8Array, msg: Uint8Array) => crypto.createHmac('sha256', key).update(msg).digest()
const own = (b: Uint8Array) => new Uint8Array(b)

export function referenceVerifier(fixedY?: bigint): SpakeVerifier {
  return {
    async register(pw, salt, iterations) {
      const r = ref.register(pw, salt, iterations, PROVER, VERIFIER)
      return { salt, iterations, w0: r.w0, L: r.L }
    },
    async respond({ w0, L }, context, shareP) {
      const X = ref.dec(shareP)
      const y = fixedY ?? ref.big(crypto.randomBytes(32)) % n
      const Y = ref.shareV(y, w0)
      const Z = ref.mul(y, ref.add(X, ref.neg(ref.mul(w0, ref.M))))
      const V = ref.mul(y, L as ref.Pt)
      const TT = Buffer.concat([
        len8(Buffer.from(context)),
        len8(Buffer.from(PROVER)),
        len8(Buffer.from(VERIFIER)),
        len8(ref.enc(ref.M)),
        len8(ref.enc(ref.N)),
        len8(shareP),
        len8(ref.enc(Y)),
        len8(ref.enc(Z)),
        len8(ref.enc(V)),
        len8(ref.be(w0, 32)),
      ])
      const Kmain = ref.sha256(TT)
      const conf = ref.hkdf(Buffer.alloc(0), Kmain, 'ConfirmationKeys', 64)
      const shareV = ref.enc(Y)
      return {
        shareV: own(shareV),
        confirmV: own(hmac(conf.subarray(32), shareP)),
        confirmP: own(hmac(conf.subarray(0, 32), shareV)),
        Kshared: own(ref.hkdf(Buffer.alloc(0), Kmain, 'SharedKey', 32)),
      }
    },
  }
}
