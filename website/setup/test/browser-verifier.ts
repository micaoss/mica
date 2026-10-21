// A SPAKE2+ Verifier that runs in a browser, for the dev harness only (mock.html): the Node reference
// cannot. The tests use the reference (reference-verifier.ts).

import type { SpakeVerifier } from './mock-device'
import { p256 } from '@noble/curves/nist.js'
import { concat, fromBigInt, len8, toBigInt, utf8 } from '../src/protocol/bytes'
import { hkdf, hmac, ID_PROVER, ID_VERIFIER, M, N, sha256, spakeScalars } from '../src/protocol/crypto'

const { Point } = p256
type P = typeof Point.BASE

export const browserVerifier: SpakeVerifier = {
  async register(pw, salt, iterations) {
    const { w0, w1 } = await spakeScalars(pw, salt, iterations)
    return { salt, iterations, w0, L: Point.BASE.multiply(w1) }
  },
  async respond({ w0, L }, context, shareP) {
    const X = Point.fromBytes(shareP)
    const y = toBigInt(p256.utils.randomSecretKey())
    const Y = Point.BASE.multiply(y).add(N.multiply(w0))
    const enc = (p: P) => p.toBytes(false)
    const shareV = new Uint8Array(enc(Y))
    const TT = concat(
      len8(utf8(context)),
      len8(utf8(ID_PROVER)),
      len8(utf8(ID_VERIFIER)),
      len8(enc(M)),
      len8(enc(N)),
      len8(shareP),
      len8(shareV),
      len8(enc(X.subtract(M.multiply(w0)).multiply(y))),
      len8(enc((L as P).multiply(y))),
      len8(fromBigInt(w0, 32)),
    )
    const Kmain = await sha256(TT)
    const conf = await hkdf(new Uint8Array(0), Kmain, 'ConfirmationKeys', 64)
    return {
      shareV,
      confirmV: await hmac(conf.slice(32), shareP),
      confirmP: await hmac(conf.slice(0, 32), shareV),
      Kshared: await hkdf(new Uint8Array(0), Kmain, 'SharedKey', 32),
    }
  },
}
