import type { Bytes } from './bytes'
import type { SessionKeys, SpakeMode } from './crypto'
import type { Transport } from './gatt'
import { fromBase64, fromUtf8, toBase64, utf8 } from './bytes'
import { ConfirmationError, RecordCipher, spakeExchange, x25519Start } from './crypto'
import { fragment, Reassembler } from './fragments'

// The page's end of a protocol 1 session: info, authentication on `session`,
// then encrypted operations on `command` and `event`.

export type Auth = 'none' | 'password' | 'temp-code' | 'password-unavailable'

export interface DeviceInfo {
  protocol: number
  model: string
  hostname: string
  claimed: boolean
  auth: Auth
  ops: string[]
  maxWrite: number
}

export interface DeviceEvent {
  id?: number
  event: string
  reason?: string
  [member: string]: unknown
}

/** The device answered `session` with `{"t":"error"}`, or the page refused its confirmation. */
export class SessionError extends Error {
  readonly reason: string
  readonly attemptsLeft?: number
  readonly retryAfter?: number

  constructor(reason: string, attemptsLeft?: number, retryAfter?: number) {
    super(`session: ${reason}`)
    this.reason = reason
    this.attemptsLeft = attemptsLeft
    this.retryAfter = retryAfter
  }
}

/** The connection dropped while the page waited for the device. */
export class DisconnectedError extends Error {
  constructor() {
    super('disconnected')
  }
}

/** The device sent something protocol 1 does not allow. */
export class ProtocolError extends Error {}

type SessionMessage = Record<string, unknown> & { t: string }

const clampWrite = (n: unknown) => typeof n === 'number' && Number.isInteger(n) ? Math.min(512, Math.max(20, n)) : 20

export function parseInfo(raw: Uint8Array): DeviceInfo {
  let v: Record<string, unknown>
  try {
    v = JSON.parse(fromUtf8(raw))
  }
  catch {
    throw new ProtocolError('info is not JSON')
  }
  if (typeof v !== 'object' || v === null || typeof v.protocol !== 'number')
    throw new ProtocolError('info has no protocol')
  return {
    protocol: v.protocol,
    model: typeof v.model === 'string' ? v.model : '',
    hostname: typeof v.hostname === 'string' ? v.hostname : '',
    claimed: v.claimed === true,
    auth: (['none', 'password', 'temp-code', 'password-unavailable'] as const).find(a => a === v.auth) ?? 'password-unavailable',
    ops: Array.isArray(v.ops) ? v.ops.filter((o): o is string => typeof o === 'string') : [],
    maxWrite: clampWrite(v.maxWrite),
  }
}

export class ProvisioningClient {
  onClosing: (reason: string) => void = () => {}
  onDisconnect: () => void = () => {}

  private maxWrite = 20
  private closed = false
  private readonly sessionIn = new Reassembler()
  private readonly eventIn = new Reassembler()
  private readonly sessionQueue: SessionMessage[] = []
  private sessionWaiter?: { resolve: (m: SessionMessage) => void, reject: (e: Error) => void }
  private sealer?: RecordCipher
  private opener?: RecordCipher
  private nextId = 1
  private pending?: {
    id: number
    resolve: (e: DeviceEvent) => void
    reject: (e: Error) => void
    onProgress?: (e: DeviceEvent) => void
  }

  private eventChain = Promise.resolve()
  // Set while a session is being authenticated: events (the `status` that follows `ready`) wait
  // for the keys instead of failing.
  private opening?: Promise<void>
  private statusWaiter?: { resolve: (e: DeviceEvent) => void, reject: (e: Error) => void }

  private readonly t: Transport

  constructor(t: Transport) {
    this.t = t
    t.onSession = f => this.sessionFragment(f)
    t.onEvent = f => this.eventFragment(f)
    t.onDisconnect = () => this.dropped()
  }

  get connected() {
    return !this.closed
  }

  get authenticated() {
    return this.sealer !== undefined
  }

  async readInfo(): Promise<DeviceInfo> {
    const info = parseInfo(await this.t.readInfo())
    this.maxWrite = info.maxWrite
    return info
  }

  /**
   * Runs the exchange `auth` names; `secret` is the password or temp-code. Resolves with the
   * `status` event the device sends after `ready` when it honours `"status": true`, else undefined.
   */
  async authenticate(auth: 'none' | SpakeMode, secret = ''): Promise<DeviceEvent | undefined> {
    let opened = () => {}
    this.opening = new Promise<void>((resolve) => {
      opened = resolve
    })
    try {
      return await this.exchange(auth, secret, opened)
    }
    finally {
      opened()
      this.opening = undefined
    }
  }

  private async exchange(auth: 'none' | SpakeMode, secret: string, opened: () => void): Promise<DeviceEvent | undefined> {
    let keys: SessionKeys
    let ready: SessionMessage
    const status = new Promise<DeviceEvent>((resolve, reject) => {
      this.statusWaiter = { resolve, reject }
    })
    status.catch(() => {})
    if (auth === 'none') {
      const x = x25519Start()
      ready = await this.session({ t: 'start', auth: 'none', pub: toBase64(x.pub), status: true }, 'ready')
      keys = await x.finish(this.b64(ready.pub))
    }
    else {
      const params = await this.session({ t: 'start', auth, status: true }, 'params')
      if (typeof params.iterations !== 'number')
        throw new ProtocolError('params without iterations')
      let confirmP: Bytes, derive: () => Promise<SessionKeys>
      // Optional in `share`: the attempts left once this one is counted.
      let attemptsLeft: number | undefined
      try {
        ({ confirmP, keys: derive } = await spakeExchange(auth, secret, this.b64(params.salt), params.iterations, async (shareP) => {
          const m = await this.session({ t: 'share', shareP: toBase64(shareP) }, 'share')
          attemptsLeft = typeof m.attemptsLeft === 'number' ? m.attemptsLeft : undefined
          return { shareV: this.b64(m.shareV), confirmV: this.b64(m.confirmV) }
        }))
      }
      catch (e) {
        // A wrong password shows as a confirmation that does not match; the
        // device has counted the attempt, and the page sends nothing more.
        if (e instanceof ConfirmationError)
          throw new SessionError('auth_failed', attemptsLeft)
        throw e
      }
      ready = await this.session({ t: 'confirm', confirmP: toBase64(confirmP) }, 'ready')
      keys = await derive()
    }
    this.sealer = await RecordCipher.create(keys.phoneToDevice)
    this.opener = await RecordCipher.create(keys.deviceToPhone)
    opened()
    if (ready.status !== true) {
      this.statusWaiter = undefined
      return undefined
    }
    return status
  }

  /** Sends one operation; resolves with its final event (`failed` included). */
  async run(op: string, params: Record<string, unknown> = {}, onProgress?: (e: DeviceEvent) => void): Promise<DeviceEvent> {
    if (!this.sealer)
      throw new Error('not authenticated')
    if (this.pending)
      throw new Error('an operation is running')
    if (this.closed)
      throw new DisconnectedError()
    const id = this.nextId++
    const done = new Promise<DeviceEvent>((resolve, reject) => {
      this.pending = { id, resolve, reject, onProgress }
    })
    try {
      const record = await this.sealer.seal(utf8(JSON.stringify({ id, op, ...params })))
      await this.write(f => this.t.writeCommand(f), record)
    }
    catch (e) {
      this.pending = undefined
      done.catch(() => {})
      throw e
    }
    return done
  }

  disconnect() {
    this.t.disconnect()
  }

  private b64(v: unknown): Bytes {
    try {
      return fromBase64(v as string)
    }
    catch {
      throw new ProtocolError('a binary member is not base64')
    }
  }

  private async write(send: (f: Bytes) => Promise<void>, message: Uint8Array) {
    for (const f of fragment(message, this.maxWrite))
      await send(f)
  }

  private async session(msg: object, want: string): Promise<SessionMessage> {
    if (this.closed)
      throw new DisconnectedError()
    this.sessionQueue.length = 0
    await this.write(f => this.t.writeSession(f), utf8(JSON.stringify(msg)))
    const reply = this.sessionQueue.shift() ?? await new Promise<SessionMessage>((resolve, reject) => {
      this.sessionWaiter = { resolve, reject }
    })
    if (reply.t === 'error') {
      const n = (v: unknown) => typeof v === 'number' ? v : undefined
      throw new SessionError(String(reply.reason), n(reply.attemptsLeft), n(reply.retryAfter))
    }
    if (reply.t !== want)
      throw new ProtocolError(`expected ${want}, got ${reply.t}`)
    return reply
  }

  private sessionFragment(f: Bytes) {
    let msg: SessionMessage
    try {
      const whole = this.sessionIn.push(f)
      if (!whole)
        return
      msg = JSON.parse(fromUtf8(whole))
      if (typeof msg !== 'object' || msg === null || typeof msg.t !== 'string')
        throw new Error('no t')
    }
    catch {
      this.sessionWaiter?.reject(new ProtocolError('malformed session message'))
      this.sessionWaiter = undefined
      return
    }
    if (this.sessionWaiter) {
      this.sessionWaiter.resolve(msg)
      this.sessionWaiter = undefined
    }
    else {
      this.sessionQueue.push(msg)
    }
  }

  private eventFragment(f: Bytes) {
    let whole: Bytes | null
    try {
      whole = this.eventIn.push(f)
    }
    catch {
      return this.fatal(new ProtocolError('malformed event fragment'))
    }
    if (!whole)
      return
    const record = whole
    this.eventChain = this.eventChain.then(async () => {
      if (!this.opener && this.opening)
        await this.opening
      if (!this.opener)
        throw new ProtocolError('event before the session is ready')
      let e: DeviceEvent
      try {
        e = JSON.parse(fromUtf8(await this.opener.open(record)))
      }
      catch {
        throw new ProtocolError('an event record does not authenticate')
      }
      this.dispatch(e)
    }).catch(err => this.fatal(err))
  }

  private dispatch(e: DeviceEvent) {
    if (e.id === undefined) {
      if (e.event === 'closing')
        this.onClosing(String(e.reason))
      if (e.event === 'status') {
        this.statusWaiter?.resolve(e)
        this.statusWaiter = undefined
      }
      return
    }
    const p = this.pending
    if (!p || e.id !== p.id)
      return
    if (e.event === 'connecting' || e.event === 'applying') {
      p.onProgress?.(e)
      return
    }
    this.pending = undefined
    p.resolve(e)
  }

  private fatal(err: Error) {
    this.pending?.reject(err)
    this.pending = undefined
    this.statusWaiter?.reject(err)
    this.statusWaiter = undefined
    this.t.disconnect()
  }

  private dropped() {
    if (this.closed)
      return
    this.closed = true
    const err = new DisconnectedError()
    this.sessionWaiter?.reject(err)
    this.sessionWaiter = undefined
    // Events that arrived before the link went down are still delivered:
    // the device sends `finished` and then disconnects.
    void this.eventChain.then(() => {
      this.sealer = undefined
      this.opener = undefined
      this.pending?.reject(err)
      this.pending = undefined
      this.statusWaiter?.reject(err)
      this.statusWaiter = undefined
      this.onDisconnect()
    })
  }
}
