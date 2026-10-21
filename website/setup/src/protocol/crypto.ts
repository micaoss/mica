import type { Bytes } from './bytes'
import { x25519 } from '@noble/curves/ed25519.js'
import { p256 } from '@noble/curves/nist.js'
import { concat, equal, fromBigInt, len8, own, toBigInt, utf8 } from './bytes'

// The key exchanges of protocol 1 (mica-core:docs/ble-provisioning.md): X25519
// for an unclaimed device, SPAKE2+ (RFC 9383, P256-SHA256-HKDF-SHA256-HMAC-SHA256)
// with the page as the Prover otherwise. Point arithmetic is noble-curves';
// every hash, MAC, KDF and cipher is WebCrypto's.

export const ID_PROVER = 'mica-provisioning phone'
export const ID_VERIFIER = 'mica-provisioning device'
const KEYS_INFO = 'mica-provisioning/1 session keys'
const NONE_SALT = 'mica-provisioning/1 none'
const RECORD_AAD = utf8('mica-provisioning/1')
const EMPTY = new Uint8Array(0)

export const MIN_ITERATIONS = 10_000
export const MAX_ITERATIONS = 10_000_000

const { Point } = p256
type P256Point = typeof Point.BASE
const ORDER = Point.Fn.ORDER

// RFC 9383 section 4, P-256.
export const M = Point.fromHex('02886e2f97ace46e55ba9dd7242579f2993b64e16ef3dcab95afd497333d8fa12f')
export const N = Point.fromHex('03d8bbd6c639c62937b04d997f38c3770719c629d7014d49a24b4f98baa1292b49')

const subtle = () => globalThis.crypto.subtle

export async function sha256(data: Uint8Array): Promise<Bytes> {
  return new Uint8Array(await subtle().digest('SHA-256', own(data)))
}

export async function hmac(key: Uint8Array, msg: Uint8Array): Promise<Bytes> {
  const k = await subtle().importKey('raw', own(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await subtle().sign('HMAC', k, own(msg)))
}

export async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: string, length: number): Promise<Bytes> {
  const k = await subtle().importKey('raw', own(ikm), 'HKDF', false, ['deriveBits'])
  const bits = await subtle().deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: own(salt), info: utf8(info) }, k, length * 8)
  return new Uint8Array(bits)
}

export interface SessionKeys {
  phoneToDevice: Bytes
  deviceToPhone: Bytes
}

async function sessionKeys(salt: Uint8Array, ikm: Uint8Array): Promise<SessionKeys> {
  const k = await hkdf(salt, ikm, KEYS_INFO, 64)
  return { phoneToDevice: k.slice(0, 32), deviceToPhone: k.slice(32) }
}

// --- auth none: X25519 -------------------------------------------------------

export interface X25519Start {
  pub: Bytes
  finish: (devicePub: Uint8Array) => Promise<SessionKeys>
}

/** `secret` is fixed only by tests; a session draws it at random. */
export function x25519Start(secret: Uint8Array = x25519.utils.randomSecretKey()): X25519Start {
  const pub = own(x25519.getPublicKey(secret))
  return {
    pub,
    async finish(devicePub) {
      if (devicePub.length !== 32)
        throw new Error('device key is not 32 bytes')
      const s = x25519.getSharedSecret(secret, devicePub)
      if (s.every(b => b === 0))
        throw new Error('all-zero shared secret')
      return sessionKeys(await sha256(concat(utf8(NONE_SALT), pub, devicePub)), s)
    },
  }
}

// --- password and temp-code: SPAKE2+ -----------------------------------------

export type SpakeMode = 'password' | 'temp-code'

/** The secret as the device registers it: a temp-code without spaces and dashes. */
export function spakeSecret(mode: SpakeMode, typed: string): string {
  return mode === 'temp-code' ? typed.replace(/[\s-]/g, '') : typed
}

export function pbkdfInput(pw: string): Bytes {
  return concat(len8(utf8(pw)), len8(utf8(ID_PROVER)), len8(utf8(ID_VERIFIER)))
}

/** w0 and w1 from the password, the device's salt and its iteration count. */
export async function spakeScalars(pw: string, salt: Uint8Array, iterations: number): Promise<{ w0: bigint, w1: bigint }> {
  const k = await subtle().importKey('raw', pbkdfInput(pw), 'PBKDF2', false, ['deriveBits'])
  const out = new Uint8Array(await subtle().deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: own(salt), iterations }, k, 80 * 8))
  return { w0: toBigInt(out.subarray(0, 40)) % ORDER, w1: toBigInt(out.subarray(40)) % ORDER }
}

export interface SpakeTranscript {
  Z: Bytes
  V: Bytes
  TT: Bytes
  Kmain: Bytes
  KconfirmP: Bytes
  KconfirmV: Bytes
  Kshared: Bytes
  confirmP: Bytes
  confirmV: Bytes
}

export interface SpakeProver {
  shareP: Bytes
  /** The Prover's side of the rest; `confirmV` is checked by the caller. */
  transcript: (shareV: Uint8Array) => Promise<SpakeTranscript>
}

const encode = (P: P256Point): Bytes => own(P.toBytes(false))

/** `x` is fixed only by tests; a session draws it at random. */
export function spakeProver(
  { context, idProver, idVerifier, w0, w1, x }:
  { context: string, idProver: string, idVerifier: string, w0: bigint, w1: bigint, x?: bigint },
): SpakeProver {
  const xs = x ?? toBigInt(p256.utils.randomSecretKey())
  const X = Point.BASE.multiply(xs).add(M.multiply(w0))
  const shareP = encode(X)
  return {
    shareP,
    async transcript(shareV) {
      if (shareV.length !== 65 || shareV[0] !== 4)
        throw new Error('shareV is not an uncompressed point')
      // fromBytes checks the point is on the curve; the identity has no encoding.
      const Y = Point.fromBytes(shareV)
      const Yn = Y.subtract(N.multiply(w0))
      const Z = encode(Yn.multiply(xs))
      const V = encode(Yn.multiply(w1))
      const TT = concat(
        len8(utf8(context)),
        len8(utf8(idProver)),
        len8(utf8(idVerifier)),
        len8(encode(M)),
        len8(encode(N)),
        len8(shareP),
        len8(shareV),
        len8(Z),
        len8(V),
        len8(fromBigInt(w0, 32)),
      )
      const Kmain = await sha256(TT)
      const conf = await hkdf(EMPTY, Kmain, 'ConfirmationKeys', 64)
      const KconfirmP = conf.slice(0, 32)
      const KconfirmV = conf.slice(32)
      const Kshared = await hkdf(EMPTY, Kmain, 'SharedKey', 32)
      return {
        Z,
        V,
        TT,
        Kmain,
        KconfirmP,
        KconfirmV,
        Kshared,
        confirmP: await hmac(KconfirmP, shareV),
        confirmV: await hmac(KconfirmV, shareP),
      }
    },
  }
}

export class ConfirmationError extends Error {}

/** The page's whole SPAKE2+ run, given the device's params and a way to send the share. */
export async function spakeExchange(
  mode: SpakeMode,
  typed: string,
  salt: Uint8Array,
  iterations: number,
  sendShare: (shareP: Bytes) => Promise<{ shareV: Uint8Array, confirmV: Uint8Array }>,
  x?: bigint,
): Promise<{ confirmP: Bytes, keys: () => Promise<SessionKeys> }> {
  if (!Number.isInteger(iterations) || iterations < MIN_ITERATIONS || iterations > MAX_ITERATIONS)
    throw new Error(`refusing ${iterations} iterations`)
  const { w0, w1 } = await spakeScalars(spakeSecret(mode, typed), salt, iterations)
  const prover = spakeProver({ context: `mica-provisioning/1 ${mode}`, idProver: ID_PROVER, idVerifier: ID_VERIFIER, w0, w1, x })
  const { shareV, confirmV } = await sendShare(prover.shareP)
  const t = await prover.transcript(shareV)
  if (!equal(t.confirmV, confirmV))
    throw new ConfirmationError('confirmV does not match')
  return { confirmP: t.confirmP, keys: () => sessionKeys(EMPTY, t.Kshared) }
}

// --- records -----------------------------------------------------------------

const MAX_COUNTER = 0xFFFFFFFFFFFFFFFFn

/** One direction's AES-256-GCM records: a 64-bit counter nonce, the protocol's AAD. */
export class RecordCipher {
  private counter = 0n
  private readonly key: CryptoKey

  private constructor(key: CryptoKey) {
    this.key = key
  }

  static async create(raw: Uint8Array): Promise<RecordCipher> {
    return new RecordCipher(await subtle().importKey('raw', own(raw), 'AES-GCM', false, ['encrypt', 'decrypt']))
  }

  private nonce(): Bytes {
    if (this.counter > MAX_COUNTER)
      throw new Error('record counter would wrap')
    const iv = new Uint8Array(12)
    new DataView(iv.buffer).setBigUint64(4, this.counter++)
    return iv
  }

  async seal(plaintext: Uint8Array): Promise<Bytes> {
    const iv = this.nonce()
    return new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: RECORD_AAD }, this.key, own(plaintext)))
  }

  async open(record: Uint8Array): Promise<Bytes> {
    const iv = this.nonce()
    return new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv, additionalData: RECORD_AAD }, this.key, own(record)))
  }
}
