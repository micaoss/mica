// A mica device's end of protocol 1, for tests: the GATT characteristics' behaviour, the session
// state machine and the operations, written from mica-core:docs/ble-provisioning.md and not from the
// page's code. It uses only WebCrypto, so it also runs in a browser; the SPAKE2+ Verifier is passed
// in (the Node reference in tests).

import type { Auth } from '../src/protocol/client'

type Bytes = Uint8Array<ArrayBuffer>
type Json = Record<string, unknown>

export interface VerifierRecord {
  salt: Bytes
  iterations: number
  w0: bigint
  L: unknown
}

export interface SpakeVerifier {
  register: (pw: string, salt: Bytes, iterations: number) => Promise<VerifierRecord>
  respond: (record: VerifierRecord, context: string, shareP: Bytes) =>
  Promise<{ shareV: Bytes, confirmV: Bytes, confirmP: Bytes, Kshared: Bytes }>
}

export interface Network {
  ssid: string
  signalDbm: number
  security: string
  channel: number
}

export interface Router {
  psk: string
  /** A failure reason to answer instead of connecting. */
  fail?: string
  ip?: string
}

/** A physical port, as `getStatus` lists it. */
export interface Port {
  name: string
  kind: 'ethernet' | 'wifi'
  carrier: boolean
  address: string | null
}

export interface MockOptions {
  protocol?: number
  model?: string
  hostname?: string
  claimed?: boolean
  auth?: Auth
  ops?: string[]
  /** info.maxWrite; the device refuses a larger write. */
  maxWrite?: number
  /** The largest notification, header included. */
  notifySize?: number
  wifiMode?: 'client' | 'ap' | 'off'
  networks?: Network[]
  routers?: Record<string, Router>
  /** The administrator password or the temp-code. */
  secret?: string
  iterations?: number
  attemptsLeft?: number
  spake?: SpakeVerifier
  /** Another channel claims the device before `finish`. */
  claimedElsewhere?: boolean
  /** Another phone holds the session. */
  busy?: boolean
  /** How long setWifi and setNetwork take, in ms. */
  connectDelay?: number
  /** The device's ports. */
  ports?: Port[]
  /** The address a DHCP lease gives a wired port; null: no lease within 30 s. */
  lease?: string | null
  /** A reason setNetwork fails with after `applying`, as the network settings refuse an entry. */
  wiredFail?: string
  /** Whether `ready` honours `"status": true` in `start`. */
  statusOnStart?: boolean
  /** The `share` message carries the optional `attemptsLeft`. */
  attemptsInShare?: boolean
}

const enc = new TextEncoder()
const dec = new TextDecoder()
const AAD = enc.encode('mica-provisioning/1')
const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b))
const unb64 = (s: string): Bytes => Uint8Array.from(atob(s), c => c.charCodeAt(0))
const tick = (ms = 0) => new Promise(r => setTimeout(r, ms))

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: string, length: number): Promise<Bytes> {
  const k = await crypto.subtle.importKey('raw', new Uint8Array(ikm), 'HKDF', false, ['deriveBits'])
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(salt), info: enc.encode(info) }, k, length * 8))
}

class Direction {
  private counter = 0n
  private readonly key: CryptoKey

  constructor(key: CryptoKey) {
    this.key = key
  }

  private iv() {
    const iv = new Uint8Array(12)
    new DataView(iv.buffer).setBigUint64(4, this.counter++)
    return iv
  }

  seal(p: Uint8Array) {
    return crypto.subtle.encrypt({ name: 'AES-GCM', iv: this.iv(), additionalData: AAD }, this.key, new Uint8Array(p)).then(b => new Uint8Array(b))
  }

  open(r: Uint8Array) {
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: this.iv(), additionalData: AAD }, this.key, new Uint8Array(r)).then(b => new Uint8Array(b))
  }
}

async function directions(keys: Bytes) {
  const imp = (k: Bytes) => crypto.subtle.importKey('raw', k, 'AES-GCM', false, ['encrypt', 'decrypt'])
  return { command: new Direction(await imp(keys.slice(0, 32))), event: new Direction(await imp(keys.slice(32))) }
}

function fragments(message: Uint8Array, size: number): Bytes[] {
  const body = size - 3
  const out: Bytes[] = []
  for (let seq = 0, off = 0; seq === 0 || off < message.length; seq++, off += body) {
    const chunk = message.subarray(off, off + body)
    const f = new Uint8Array(3 + chunk.length)
    f[0] = seq >> 8
    f[1] = seq & 255
    f[2] = off + body >= message.length ? 1 : 0
    f.set(chunk, 3)
    out.push(f)
  }
  return out
}

class Joiner {
  private parts: Uint8Array[] = []
  push(f: Uint8Array): Bytes | null {
    const seq = (f[0] << 8) | f[1]
    if (f.length < 3 || seq !== this.parts.length)
      throw new Error('fragment out of order')
    this.parts.push(f.subarray(3))
    if (!(f[2] & 1))
      return null
    const all = new Uint8Array(this.parts.reduce((n, p) => n + p.length, 0))
    let off = 0
    for (const p of this.parts) {
      all.set(p, off)
      off += p.length
    }
    this.parts = []
    return all
  }
}

const HOSTNAME = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i
const PSK = /^(?:[\x20-\x7E]{8,63}|[0-9a-f]{64})$/i
const OCTET = '(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)'
const IPV4 = new RegExp(`^${OCTET}(?:\\.${OCTET}){3}$`)
const CIDR = new RegExp(`^${OCTET}(?:\\.${OCTET}){3}/(?:3[0-2]|[12]?\\d)$`)
const isIp = (v: unknown) => typeof v === 'string' && (IPV4.test(v) || /^[0-9a-f]{0,4}(?::[0-9a-f]{0,4}){2,7}$/i.test(v))

export class MockDevice {
  readonly o: Required<Omit<MockOptions, 'spake' | 'routers' | 'networks' | 'wiredFail'>> & Pick<MockOptions, 'spake' | 'wiredFail'>
  readonly routers: Record<string, Router>
  networks: Network[]
  /** Every decrypted command, in order. */
  readonly commands: Json[] = []
  /** Every session message the page sent. */
  readonly sessionLog: Json[] = []
  /** The largest write the page made. */
  largestWrite = 0
  connected = false
  claimed: boolean
  hostname: string
  wifi: { mode: 'client' | 'ap' | 'off', connected: boolean, ssid: string | null, ip: string | null }
  attemptsLeft: number
  ports: Port[]
  /** The port the session brought up last. */
  private brought?: Port

  // Set by the mocked GATT.
  notifySession: (f: Bytes) => void = () => {}
  notifyEvent: (f: Bytes) => void = () => {}
  dropLink: () => void = () => {}

  private sessionIn = new Joiner()
  private commandIn = new Joiner()
  private auth: 'none' | 'password' | 'temp-code' | null = null
  private spakeState?: { confirmP: Bytes, Kshared: Bytes }
  private dirs?: { command: Direction, event: Direction }
  private staged?: { password: string, hostname?: string, apPsk?: string }
  private statusAsked = false
  private running = false
  private record?: VerifierRecord
  private chain = Promise.resolve()

  constructor(opts: MockOptions = {}) {
    this.o = {
      protocol: 1,
      model: 'mica cx3576',
      hostname: 'mica-a4e2e69e',
      claimed: false,
      auth: opts.claimed ? 'password' : 'none',
      ops: ['getStatus', 'scanWifi', 'claim', 'setWifi', 'setNetwork', 'finish'],
      maxWrite: 20,
      notifySize: 20,
      wifiMode: 'ap',
      secret: '',
      iterations: 10000,
      attemptsLeft: 5,
      claimedElsewhere: false,
      busy: false,
      connectDelay: 5,
      attemptsInShare: false,
      ports: [
        { name: 'eth0', kind: 'ethernet', carrier: true, address: null },
        { name: 'wlan0', kind: 'wifi', carrier: false, address: null },
      ],
      lease: '192.168.1.40/24',
      statusOnStart: true,
      ...opts,
    }
    this.routers = opts.routers ?? {}
    this.networks = opts.networks ?? []
    this.claimed = this.o.claimed
    this.hostname = this.o.hostname
    this.attemptsLeft = this.o.attemptsLeft
    this.wifi = { mode: this.o.wifiMode, connected: this.o.wifiMode === 'client', ssid: null, ip: null }
    this.ports = this.o.ports.map(p => ({ ...p }))
  }

  private status(): Json {
    return { event: 'status', wifiMode: this.wifi.mode, connected: this.wifi.connected, ssid: this.wifi.ssid, ip: this.wifi.ip, interfaces: this.ports }
  }

  /** `ready`, and the `status` event after it when `start` asked for one. */
  private async ready(m: Json) {
    const asked = this.statusAsked && this.o.statusOnStart
    await this.sendSession(asked ? { ...m, status: true } : m)
    if (asked)
      await this.event(this.status())
  }

  info(): Bytes {
    const { protocol, model, ops, maxWrite } = this.o
    return enc.encode(JSON.stringify({ protocol, model, hostname: this.hostname, claimed: this.claimed, auth: this.o.auth, ops, maxWrite }))
  }

  connect() {
    this.connected = true
  }

  /** The link went down, from either end. */
  linkDown() {
    this.connected = false
    this.staged = undefined
    this.auth = null
    this.dirs = undefined
    this.sessionIn = new Joiner()
    this.commandIn = new Joiner()
  }

  /** The device ends the session itself, as after `finish` or 2 minutes idle. */
  async close(reason?: string) {
    if (reason)
      await this.event({ event: 'closing', reason })
    this.linkDown()
    this.dropLink()
  }

  writeSession(f: Uint8Array) {
    this.checkWrite(f)
    const m = this.sessionIn.push(f)
    if (m)
      this.serial(() => this.onSession(JSON.parse(dec.decode(m))))
  }

  writeCommand(f: Uint8Array) {
    this.checkWrite(f)
    const m = this.commandIn.push(f)
    if (m)
      this.serial(() => this.onCommand(m))
  }

  private serial(fn: () => Promise<void>) {
    this.chain = this.chain.then(fn)
  }

  private checkWrite(f: Uint8Array) {
    if (f.length > this.o.maxWrite)
      throw new DOMException(`write of ${f.length} bytes over maxWrite`, 'NotSupportedError')
    this.largestWrite = Math.max(this.largestWrite, f.length)
  }

  private async sendSession(m: Json) {
    for (const f of fragments(enc.encode(JSON.stringify(m)), this.o.notifySize)) {
      await tick()
      this.notifySession(f)
    }
  }

  private async event(m: Json) {
    if (!this.dirs)
      return
    const record = await this.dirs.event.seal(enc.encode(JSON.stringify(m)))
    for (const f of fragments(record, this.o.notifySize)) {
      await tick()
      this.notifyEvent(f)
    }
  }

  private async onSession(m: Json) {
    this.sessionLog.push(m)
    const error = (reason: string, extra: Json = {}) => this.sendSession({ t: 'error', reason, ...extra })
    if (this.o.busy)
      return error('busy')
    if (m.t === 'start') {
      this.statusAsked = m.status === true
      this.auth = null
      this.dirs = undefined
      if (this.o.auth === 'password-unavailable')
        return error('password_unavailable')
      if (m.auth !== this.o.auth)
        return error('unsupported_auth')
      if (this.attemptsLeft <= 0)
        return error('locked', { retryAfter: 600 })
      if (m.auth === 'none') {
        const pair = await crypto.subtle.generateKey({ name: 'X25519' }, true, ['deriveBits']) as CryptoKeyPair
        const phonePub = unb64(m.pub as string)
        const devicePub = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
        const peer = await crypto.subtle.importKey('raw', phonePub, { name: 'X25519' }, false, [])
        const s = new Uint8Array(await crypto.subtle.deriveBits({ name: 'X25519', public: peer }, pair.privateKey, 256))
        const salt = new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array([...enc.encode('mica-provisioning/1 none'), ...phonePub, ...devicePub])))
        this.dirs = await directions(await hkdf(salt, s, 'mica-provisioning/1 session keys', 64))
        this.auth = 'none'
        return this.ready({ t: 'ready', pub: b64(devicePub) })
      }
      const salt = Uint8Array.from({ length: 16 }, (_, i) => i * 17)
      this.record = await this.o.spake!.register(this.o.secret, salt, this.o.iterations)
      this.auth = m.auth as 'password' | 'temp-code'
      return this.sendSession({ t: 'params', salt: b64(salt), iterations: this.o.iterations })
    }
    if (m.t === 'share' && this.record && this.auth && this.auth !== 'none') {
      let r
      try {
        r = await this.o.spake!.respond(this.record, `mica-provisioning/1 ${this.auth}`, unb64(m.shareP as string))
      }
      catch {
        return error('bad_message')
      }
      this.attemptsLeft--
      this.spakeState = { confirmP: r.confirmP, Kshared: r.Kshared }
      const count = this.o.attemptsInShare ? { attemptsLeft: this.attemptsLeft } : {}
      return this.sendSession({ t: 'share', shareV: b64(r.shareV), confirmV: b64(r.confirmV), ...count })
    }
    if (m.t === 'confirm' && this.spakeState) {
      const ok = b64(this.spakeState.confirmP) === m.confirmP
      if (!ok)
        return error(this.attemptsLeft <= 0 ? 'locked' : 'auth_failed', this.attemptsLeft <= 0 ? { retryAfter: 600 } : { attemptsLeft: this.attemptsLeft })
      this.attemptsLeft = this.o.attemptsLeft
      this.dirs = await directions(await hkdf(new Uint8Array(0), this.spakeState.Kshared, 'mica-provisioning/1 session keys', 64))
      this.spakeState = undefined
      return this.ready({ t: 'ready' })
    }
    return error('bad_message')
  }

  private async onCommand(record: Uint8Array) {
    if (!this.dirs)
      return this.close()
    let c: Json
    try {
      c = JSON.parse(dec.decode(await this.dirs.command.open(record)))
    }
    catch {
      return this.close()
    }
    this.commands.push(c)
    const id = c.id as number
    const failed = (reason: string) => this.event({ id, event: 'failed', reason })
    if (this.running)
      return failed('busy')
    switch (c.op) {
      case 'getStatus':
        return this.event({ id, ...this.status() })
      case 'scanWifi':
        if (this.wifi.mode === 'ap')
          return failed('ap_active')
        return this.event({ id, event: 'networks', networks: this.networks })
      case 'claim': {
        if (this.auth !== 'none')
          return failed('not_allowed')
        if (this.claimed)
          return failed('already_claimed')
        const pw = c.password
        if (typeof pw !== 'string' || enc.encode(pw).length < 8 || enc.encode(pw).length > 1024)
          return failed('invalid_password')
        if (c.hostname !== undefined && (typeof c.hostname !== 'string' || !HOSTNAME.test(c.hostname)))
          return failed('invalid_hostname')
        this.staged = { password: pw, hostname: c.hostname as string | undefined, apPsk: c.apPsk as string | undefined }
        return this.event({ id, event: 'claimStaged' })
      }
      case 'setWifi': {
        if (this.auth === 'none' && !this.staged)
          return failed('not_claimed')
        const ssid = c.ssid
        const psk = c.psk
        if (typeof ssid !== 'string' || !enc.encode(ssid).length || enc.encode(ssid).length > 32)
          return failed('invalid_ssid')
        if (typeof psk !== 'string' || (psk !== '' && !PSK.test(psk)))
          return failed('invalid_psk')
        this.running = true
        await this.event({ id, event: 'connecting' })
        // The connection runs beside further commands, which get `busy`.
        void tick(this.o.connectDelay).then(() => this.serial(async () => {
          this.running = false
          this.wifi = { mode: 'client', connected: false, ssid: null, ip: null }
          const r = this.routers[ssid]
          if (!r)
            return failed('ssid_not_found')
          if (r.fail)
            return failed(r.fail)
          if (r.psk !== psk)
            return failed('wrong_password')
          this.wifi = { mode: 'client', connected: true, ssid, ip: r.ip ?? '192.168.1.57' }
          const wifi = this.ports.find(p => p.kind === 'wifi')
          if (wifi) {
            Object.assign(wifi, { carrier: true, address: `${this.wifi.ip}/24` })
            this.brought = wifi
          }
          return this.event({ id, event: 'connected', ip: this.wifi.ip, hostname: this.staged?.hostname ?? this.hostname })
        }))
        return
      }
      case 'setNetwork': {
        if (this.auth === 'none' && !this.staged)
          return failed('not_claimed')
        const port = this.ports.find(p => p.name === c.interface && p.kind === 'ethernet')
        if (!port)
          return failed('unknown_interface')
        const st = c.static as Json | undefined
        if ((c.dhcp === true) === (st !== undefined))
          return failed('bad_request')
        if (st) {
          if (typeof st.address !== 'string' || !CIDR.test(st.address))
            return failed('invalid_address')
          if (st.gateway !== undefined && !(typeof st.gateway === 'string' && IPV4.test(st.gateway)))
            return failed('invalid_gateway')
          if (st.dns !== undefined && !(Array.isArray(st.dns) && st.dns.every(isIp)))
            return failed('invalid_dns')
        }
        this.running = true
        await this.event({ id, event: 'applying' })
        void tick(this.o.connectDelay).then(() => this.serial(async () => {
          this.running = false
          if (this.o.wiredFail)
            return failed(this.o.wiredFail)
          if (!port.carrier)
            return failed('no_carrier')
          const address = st ? st.address as string : this.o.lease
          if (!address)
            return failed('dhcp_timeout')
          port.address = address
          this.brought = port
          return this.event({ id, event: 'up', interface: port.name, address })
        }))
        return
      }
      case 'finish': {
        if (this.auth !== 'none') {
          await this.event({ id, event: 'finished', claimed: true, ...this.reached() })
          return this.close()
        }
        if (this.o.claimedElsewhere) {
          this.staged = undefined
          return failed('already_claimed')
        }
        if (!this.staged)
          return failed('not_claimed')
        this.claimed = true
        this.hostname = this.staged.hostname ?? this.hostname
        await this.event({ id, event: 'finished', claimed: true, ...this.reached() })
        return this.close()
      }
      default:
        return failed('unknown_op')
    }
  }

  /** What `finished` carries for the page's last screen. */
  private reached(): Json {
    const port = this.brought ?? [...this.ports].sort((a, b) => Number(b.kind === 'ethernet') - Number(a.kind === 'ethernet')).find(p => p.address)
    const address = port?.address?.split('/')[0]
    return {
      hostname: this.hostname,
      interface: port ? { name: port.name, kind: port.kind, address: port.address } : null,
      consoleUrls: [...(address ? [`http://${address}`] : []), `http://${this.hostname}.local`],
    }
  }
}
