// Types for the vendored reference: points are [x, y] BigInt pairs, null the identity.
export type Pt = [bigint, bigint] | null
export const M: Pt
export const N: Pt
export function mul(k: bigint, P: Pt): Pt
export function add(P: Pt, Q: Pt): Pt
export function neg(P: Pt): Pt
export function enc(P: Pt): Buffer
export function dec(buf: Uint8Array): Pt
export function hkdf(salt: Uint8Array, ikm: Uint8Array, info: string, length: number): Buffer
export function register(pw: string, salt: Uint8Array, iterations: number, idProver: string, idVerifier: string):
{ input: Buffer, w0: bigint, w1: bigint, L: Pt }
export function shareV(y: bigint, w0: bigint): Pt
export function exchange(args: {
  context: string
  idProver: string
  idVerifier: string
  w0: bigint
  w1: bigint
  L: Pt
  x: bigint
  y: bigint
}): Record<'X' | 'Y' | 'Z' | 'V' | 'TT' | 'Kmain' | 'KconfirmP' | 'KconfirmV' | 'Kshared' | 'confirmP' | 'confirmV', Buffer>
export function be(x: bigint, len: number): Buffer
export function big(buf: Uint8Array): bigint
export function sha256(buf: Uint8Array): Buffer
