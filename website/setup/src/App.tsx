import type { ReactNode, SubmitEvent } from 'react'
import type { Dict, Lang } from './i18n'
import type { DeviceEvent, DeviceInfo } from './protocol/client'
import type { BluetoothDeviceLike, BluetoothLike } from './protocol/gatt'
import type { Network } from './util'
import { Fragment, useEffect, useRef, useState } from 'react'
import { PROTOCOLS, SETUP_HOST } from './config'
import { DICTS, fill } from './i18n'
import { DisconnectedError, ProvisioningClient, SessionError } from './protocol/client'
import { connectGatt, requestDevice } from './protocol/gatt'
import { isCidr, isIp, isIpv4, mergeNetworks, splitList } from './util'

// The phone's provisioning flow, mica-network-spec chapter 5 section 3: step 0
// (this page) to step 9 (finish); step 10 is the console on the router's LAN.

interface Port {
  name: string
  kind: string
  carrier: boolean
  address: string | null
}

interface Status {
  wifiMode: string
  connected: boolean
  ssid: string | null
  ip: string | null
  interfaces: Port[]
}

/** What the wired form holds, kept when an attempt fails. */
interface Wired {
  port: string
  mode: 'dhcp' | 'static'
  address: string
  gateway: string
  dns: string
}

interface Reached {
  name: string
  kind: string
  address: string | null
}

type Step
  = | { k: 'start' }
    | { k: 'busy', text: string }
    | { k: 'stop', text: string }
    | { k: 'auth', mode: 'password' | 'temp-code' }
    | { k: 'admin' }
    | { k: 'status', status: Status }
    | { k: 'network', status: Status, networks: Network[] | null, manual: boolean }
    | { k: 'password', ssid: string, hidden: boolean, status: Status }
    | { k: 'wired', status: Status, form?: Wired }
    | { k: 'joined', text: string }
    // unclaimed: BLE claims nothing, the console does; claimedHere: a 0.0.3 device claimed in the session.
    | { k: 'done', reached: Reached | null, urls: string[], unclaimed: boolean, claimedHere: boolean, apOn: boolean }
    | { k: 'dropped', text: string }

const HOSTNAME = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i
const PSK = /^(?:[\x20-\x7E]{8,63}|[0-9a-f]{64})$/i
const byteLength = (s: string) => new TextEncoder().encode(s).length

function readStatus(e: DeviceEvent): Status {
  const ports = Array.isArray(e.interfaces) ? e.interfaces : []
  return {
    wifiMode: String(e.wifiMode),
    connected: e.connected === true,
    ssid: (e.ssid as string) ?? null,
    ip: (e.ip as string) ?? null,
    interfaces: ports
      .filter((p): p is Record<string, unknown> => typeof p?.name === 'string')
      .map(p => ({ name: p.name as string, kind: String(p.kind), carrier: p.carrier === true, address: typeof p.address === 'string' ? p.address : null })),
  }
}

const ethernetPorts = (s: Status) => s.interfaces.filter(p => p.kind === 'ethernet')
// A core 0.0.3 device claims in the session; later devices list no `claim` and claim in the console.
const claimsInSession = (i: DeviceInfo | null) => !!i?.ops.includes('claim')

interface Props {
  bluetooth: BluetoothLike | undefined
  ios: boolean
  initialLang: Lang
}

export function App({ bluetooth, ios, initialLang }: Props) {
  const [lang, setLang] = useState(initialLang)
  const t = DICTS[lang]
  const [step, setStep] = useState<Step>({ k: 'start' })
  const [notice, setNotice] = useState('')
  const clientRef = useRef<ProvisioningClient | null>(null)
  const deviceRef = useRef<BluetoothDeviceLike | null>(null)
  const infoRef = useRef<DeviceInfo | null>(null)
  const closingRef = useRef('')
  // The status that came with `ready`, used once instead of a getStatus.
  const statusRef = useRef<Status | null>(null)
  const stepRef = useRef(step)
  const tRef = useRef(t)
  tRef.current = t

  useEffect(() => () => clientRef.current?.disconnect(), [])

  const switchLang = (l: Lang) => {
    setLang(l)
    document.documentElement.lang = DICTS[l].lang
  }

  const go = (s: Step, n = '') => {
    // Set at once: the device disconnects right after `finished`, before a render.
    stepRef.current = s
    setStep(s)
    setNotice(n)
  }

  const stop = (text: string) => {
    go({ k: 'stop', text })
    clientRef.current?.disconnect()
  }

  const reason = (e: DeviceEvent) => tRef.current.results[e.reason ?? ''] ?? fill(tRef.current.failed, { reason: String(e.reason) })

  // Any error an operation can end with that the step itself does not handle.
  const broken = (e: unknown) => {
    if (e instanceof DisconnectedError)
      return
    stop(tRef.current.commError)
  }

  const onDrop = () => {
    const s = stepRef.current
    if (s.k === 'done' || s.k === 'stop' || s.k === 'start')
      return
    const t = tRef.current
    if (closingRef.current === 'claimed_elsewhere')
      return go({ k: 'stop', text: t.alreadyClaimed })
    const unclaimed = infoRef.current?.auth === 'none'
    const text = !unclaimed ? t.disconnectedClaimed : claimsInSession(infoRef.current) ? t.disconnectedUnclaimed : t.disconnected
    go({ k: 'dropped', text: closingRef.current === 'idle' ? `${t.closingIdle} ${text}` : text })
  }

  async function open(d: BluetoothDeviceLike) {
    go({ k: 'busy', text: t.connecting })
    closingRef.current = ''
    try {
      const c = new ProvisioningClient(await connectGatt(d))
      clientRef.current = c
      c.onDisconnect = onDrop
      c.onClosing = (r) => {
        closingRef.current = r
      }
      const i = await c.readInfo()
      infoRef.current = i
      if (!PROTOCOLS.includes(i.protocol))
        return stop(t.protocolMismatch)
      if (i.auth === 'password-unavailable')
        return stop(t.passwordUnavailable)
      if (i.auth !== 'none')
        return go({ k: 'auth', mode: i.auth })
      const st = await c.authenticate('none')
      statusRef.current = st ? readStatus(st) : null
      if (claimsInSession(i))
        return go({ k: 'admin' })
      await showStatus()
    }
    catch (e) {
      if (e instanceof SessionError && e.reason === 'busy')
        return go({ k: 'start' }, t.results.busy)
      broken(e)
    }
  }

  async function connect() {
    if (!bluetooth)
      return
    let d: BluetoothDeviceLike
    try {
      d = await requestDevice(bluetooth)
    }
    catch {
      return go({ k: 'start' }, t.noDevice)
    }
    deviceRef.current = d
    await open(d)
  }

  async function authenticate(mode: 'password' | 'temp-code', secret: string) {
    go({ k: 'busy', text: t.verifying })
    try {
      const st = await clientRef.current!.authenticate(mode, secret)
      statusRef.current = st ? readStatus(st) : null
    }
    catch (e) {
      if (!(e instanceof SessionError))
        return broken(e)
      if (e.reason === 'auth_failed') {
        const wrong = mode === 'password' ? t.wrongPassword : t.wrongCode
        return go({ k: 'auth', mode }, e.attemptsLeft === undefined ? wrong : wrong + fill(t.attemptsLeft, { n: e.attemptsLeft }))
      }
      if (e.reason === 'locked')
        return stop(fill(t.locked, { time: fill(t.minutes, { n: Math.ceil((e.retryAfter ?? 600) / 60) }) }))
      if (e.reason === 'busy')
        return go({ k: 'auth', mode }, t.results.busy)
      if (e.reason === 'password_unavailable')
        return stop(t.passwordUnavailable)
      return broken(e)
    }
    await showStatus()
  }

  async function getStatus(): Promise<Status | null> {
    const first = statusRef.current
    statusRef.current = null
    if (first)
      return first
    const e = await clientRef.current!.run('getStatus')
    if (e.event !== 'status') {
      setNotice(reason(e))
      return null
    }
    return readStatus(e)
  }

  async function showStatus(n = '') {
    try {
      const s = await getStatus()
      if (s)
        go({ k: 'status', status: s }, n)
    }
    catch (e) {
      broken(e)
    }
  }

  async function claim(password: string, hostname: string) {
    go({ k: 'busy', text: t.connecting })
    try {
      const e = await clientRef.current!.run('claim', hostname ? { password, hostname } : { password })
      if (e.event === 'claimStaged')
        return showStatus()
      if (e.reason === 'already_claimed')
        return stop(t.alreadyClaimed)
      go({ k: 'admin' }, reason(e))
    }
    catch (e) {
      broken(e)
    }
  }

  async function chooseNetwork(n = '') {
    go({ k: 'busy', text: t.scanning })
    try {
      const status = await getStatus()
      if (!status)
        return
      if (status.wifiMode === 'ap')
        return go({ k: 'network', status, networks: null, manual: true }, n || t.apNoScan)
      const e = await clientRef.current!.run('scanWifi')
      if (e.event === 'networks')
        return go({ k: 'network', status, networks: mergeNetworks(e.networks), manual: false }, n)
      const why = e.reason === 'ap_active' ? t.apNoScan : e.reason === 'scan_failed' ? t.scanFailed : reason(e)
      go({ k: 'network', status, networks: null, manual: true }, n || why)
    }
    catch (e) {
      broken(e)
    }
  }

  async function join(ssid: string, psk: string, hidden: boolean, status: Status) {
    go({ k: 'busy', text: fill(t.progress, { ssid }) })
    try {
      const e = await clientRef.current!.run('setWifi', { ssid, psk, hidden })
      if (e.event === 'connected')
        return go({ k: 'joined', text: fill(t.success, { ssid, ip: String(e.ip) }) })
      const back = { k: 'password', ssid, hidden, status } as const
      switch (e.reason) {
        case 'ssid_not_found':
        case 'unsupported_security':
        case 'invalid_ssid':
        case 'no_radio':
          return chooseNetwork(reason(e))
        case 'not_claimed':
          return go({ k: 'admin' }, reason(e))
        case 'already_claimed':
          return stop(t.alreadyClaimed)
        default: // wrong_password, dhcp_timeout, busy, connect_failed, invalid_psk
          return go(back, reason(e))
      }
    }
    catch (e) {
      broken(e)
    }
  }

  async function applyWired(status: Status, form: Wired) {
    go({ k: 'busy', text: fill(t.applying, { name: form.port }) })
    const params = form.mode === 'dhcp'
      ? { interface: form.port, dhcp: true }
      : {
          interface: form.port,
          static: {
            address: form.address,
            ...(form.gateway ? { gateway: form.gateway } : {}),
            ...(form.dns ? { dns: splitList(form.dns) } : {}),
          },
        }
    try {
      const e = await clientRef.current!.run('setNetwork', params)
      if (e.event === 'up')
        return go({ k: 'joined', text: fill(t.wiredUp, { name: String(e.interface), address: typeof e.address === 'string' ? e.address : '—' }) })
      if (e.reason === 'not_claimed')
        return go({ k: 'admin' }, reason(e))
      if (e.reason === 'already_claimed')
        return stop(t.alreadyClaimed)
      go({ k: 'wired', status, form }, reason(e))
    }
    catch (e) {
      broken(e)
    }
  }

  async function finish(joined: string) {
    go({ k: 'busy', text: t.finishing })
    try {
      const e = await clientRef.current!.run('finish')
      if (e.event === 'finished') {
        const session = infoRef.current?.auth === 'none'
        const legacy = claimsInSession(infoRef.current)
        const unclaimed = e.claimed !== true
        if (infoRef.current)
          infoRef.current = { ...infoRef.current, claimed: e.claimed === true, hostname: String(e.hostname) }
        const r = e.interface as Record<string, unknown> | null | undefined
        const reached = r && typeof r.name === 'string'
          ? { name: r.name, kind: String(r.kind), address: typeof r.address === 'string' ? r.address : null }
          : null
        // A core 0.0.3 device names no console; its console is plain HTTP on 8080.
        const urls = Array.isArray(e.consoleUrls)
          ? e.consoleUrls.filter((u): u is string => typeof u === 'string' && /^https?:\/\//.test(u))
          : [`http://${String(e.hostname)}.local:8080`]
        return go({ k: 'done', reached, urls, unclaimed, claimedHere: session && legacy, apOn: unclaimed && e.ap === 'on' })
      }
      if (e.reason === 'already_claimed')
        return stop(t.alreadyClaimed)
      if (e.reason === 'not_claimed')
        return go({ k: 'admin' }, reason(e))
      go({ k: 'joined', text: joined }, reason(e))
    }
    catch (e) {
      broken(e)
    }
  }

  let body: ReactNode
  if (!bluetooth) {
    body = (
      <>
        {ios && <p>{t.ios}</p>}
        <p className="alert" role="alert">{t.unsupported}</p>
        <p className="muted">{t.browsers}</p>
      </>
    )
  }
  else {
    body = (
      <>
        {infoRef.current && step.k !== 'start' && <DeviceCard t={t} info={infoRef.current} />}
        {notice && <p className="alert" role="alert">{notice}</p>}
        <StepView
          t={t}
          step={step}
          info={infoRef.current}
          onConnect={connect}
          onReconnect={() => (deviceRef.current ? open(deviceRef.current) : connect())}
          onRestart={() => go({ k: 'start' })}
          onAuth={authenticate}
          onClaim={claim}
          onConfigure={() => chooseNetwork()}
          onWired={status => go({ k: 'wired', status })}
          onStatus={status => go({ k: 'status', status })}
          onApply={applyWired}
          onPick={(ssid, hidden, status) => go({ k: 'password', ssid, hidden, status })}
          onJoin={join}
          onFinish={finish}
        />
      </>
    )
  }

  return (
    <main lang={t.lang}>
      <header>
        <h1>{t.title}</h1>
        <button type="button" className="link" onClick={() => switchLang(lang === 'zh' ? 'en' : 'zh')}>{t.switchTo}</button>
      </header>
      <p className="muted">{t.lead}</p>
      <section className="card">{body}</section>
      <footer className="muted">
        {t.address}
        {SETUP_HOST}
      </footer>
    </main>
  )
}

function DeviceCard({ t, info }: { t: Dict, info: DeviceInfo }) {
  return (
    <dl className="device">
      <dt>{t.hostname}</dt>
      <dd>{info.hostname}</dd>
      <dt>{t.model}</dt>
      <dd>{info.model}</dd>
      <dt>{t.device}</dt>
      <dd>{info.claimed ? t.claimed : t.unclaimed}</dd>
    </dl>
  )
}

interface StepProps {
  t: Dict
  step: Step
  info: DeviceInfo | null
  onConnect: () => void
  onReconnect: () => void
  onRestart: () => void
  onAuth: (mode: 'password' | 'temp-code', secret: string) => void
  onClaim: (password: string, hostname: string) => void
  onConfigure: () => void
  onWired: (status: Status) => void
  onStatus: (status: Status) => void
  onApply: (status: Status, form: Wired) => void
  onPick: (ssid: string, hidden: boolean, status: Status) => void
  onJoin: (ssid: string, psk: string, hidden: boolean, status: Status) => void
  onFinish: (joined: string) => void
}

function StepView(p: StepProps) {
  const { t, step } = p
  switch (step.k) {
    case 'start':
      return (
        <>
          <p>{t.connectHint}</p>
          <button type="button" onClick={p.onConnect}>{t.connect}</button>
        </>
      )
    case 'busy':
      return <p className="progress" role="status">{step.text}</p>
    case 'stop':
      return (
        <>
          <p className="alert" role="alert">{step.text}</p>
          <button type="button" className="secondary" onClick={p.onRestart}>{t.restart}</button>
        </>
      )
    case 'dropped':
      return (
        <>
          <p className="alert" role="alert">{step.text}</p>
          <button type="button" onClick={p.onReconnect}>{t.reconnect}</button>
        </>
      )
    case 'auth':
      return <AuthForm t={t} mode={step.mode} onSubmit={secret => p.onAuth(step.mode, secret)} />
    case 'admin':
      return <AdminForm t={t} hostname={p.info?.hostname ?? ''} onSubmit={p.onClaim} />
    case 'status':
      return (
        <StatusView
          t={t}
          status={step.status}
          wired={!!p.info?.ops.includes('setNetwork') && ethernetPorts(step.status).length > 0}
          onConfigure={p.onConfigure}
          onWired={() => p.onWired(step.status)}
        />
      )
    case 'wired':
      return <WiredForm t={t} step={step} onBack={() => p.onStatus(step.status)} onSubmit={form => p.onApply(step.status, form)} />
    case 'network':
      return <NetworkForm t={t} step={step} onRescan={p.onConfigure} onPick={(ssid, hidden) => p.onPick(ssid, hidden, step.status)} />
    case 'password':
      return <PasswordForm t={t} step={step} onBack={p.onConfigure} onSubmit={psk => p.onJoin(step.ssid, psk, step.hidden, step.status)} />
    case 'joined':
      return (
        <>
          <p className="ok" role="status">{step.text}</p>
          <button type="button" onClick={() => p.onFinish(step.text)}>{t.finish}</button>
        </>
      )
    case 'done':
      return <DoneView t={t} step={step} />
  }
}

function AuthForm({ t, mode, onSubmit }: { t: Dict, mode: 'password' | 'temp-code', onSubmit: (secret: string) => void }) {
  const [secret, setSecret] = useState('')
  const submit = (e: SubmitEvent) => {
    e.preventDefault()
    if (secret)
      onSubmit(secret)
  }
  return (
    <form onSubmit={submit}>
      <label>
        {mode === 'password' ? t.authPassword : t.authTempCode}
        <input
          type={mode === 'password' ? 'password' : 'text'}
          inputMode={mode === 'temp-code' ? 'numeric' : undefined}
          autoComplete={mode === 'password' ? 'current-password' : 'one-time-code'}
          value={secret}
          onChange={e => setSecret(e.target.value)}
          required
        />
      </label>
      {mode === 'temp-code' && <p className="muted">{t.authTempCodeHint}</p>}
      <button type="submit">{t.verify}</button>
    </form>
  )
}

function AdminForm({ t, hostname, onSubmit }: { t: Dict, hostname: string, onSubmit: (password: string, hostname: string) => void }) {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [host, setHost] = useState('')
  const [error, setError] = useState('')
  const submit = (e: SubmitEvent) => {
    e.preventDefault()
    const n = byteLength(pw)
    const problem = n < 8
      ? t.passwordTooShort
      : n > 1024
        ? t.passwordTooLong
        : pw !== pw2
          ? t.passwordMismatch
          : host && !HOSTNAME.test(host) ? t.hostnameInvalid : ''
    setError(problem)
    if (!problem)
      onSubmit(pw, host)
  }
  return (
    <form onSubmit={submit} noValidate>
      <h2>{t.adminTitle}</h2>
      <p className="muted">{t.adminHint}</p>
      <label>
        {t.adminPassword}
        <input type="password" autoComplete="new-password" value={pw} onChange={e => setPw(e.target.value)} />
      </label>
      <label>
        {t.adminPassword2}
        <input type="password" autoComplete="new-password" value={pw2} onChange={e => setPw2(e.target.value)} />
      </label>
      <label>
        {t.hostnameOptional}
        <input autoCapitalize="none" spellCheck={false} placeholder={hostname} value={host} onChange={e => setHost(e.target.value.trim())} />
      </label>
      {error && <p className="alert" role="alert">{error}</p>}
      <button type="submit">{t.next}</button>
    </form>
  )
}

function StatusView({ t, status, wired, onConfigure, onWired }: {
  t: Dict
  status: Status
  wired: boolean
  onConfigure: () => void
  onWired: () => void
}) {
  const mode = status.wifiMode === 'client' ? t.modeClient : status.wifiMode === 'ap' ? t.modeAp : t.modeOff
  const wifi = status.interfaces.length === 0 || status.interfaces.some(p => p.kind === 'wifi')
  const port = (p: Port) => [
    p.kind === 'ethernet' ? t.ethernet : t.wifi,
    p.kind === 'ethernet' ? (p.carrier ? t.cableIn : t.noCable) : (p.carrier ? t.linkUp : t.notConnected),
    ...(p.address ? [p.address] : []),
  ].join(' · ')
  return (
    <>
      <h2>{t.statusTitle}</h2>
      <dl className="device">
        <dt>{t.wifiMode}</dt>
        <dd>{mode}</dd>
        <dt>{t.connection}</dt>
        <dd>{status.connected && status.ssid ? fill(t.connectedTo, { ssid: status.ssid }) : t.notConnected}</dd>
        <dt>{t.ip}</dt>
        <dd>{status.ip ?? '—'}</dd>
        {status.interfaces.map(p => (
          <Fragment key={p.name}>
            <dt>{p.name}</dt>
            <dd>{port(p)}</dd>
          </Fragment>
        ))}
      </dl>
      {wired && <p className="muted">{t.chooseHint}</p>}
      <div className="row">
        {wifi && <button type="button" onClick={onConfigure}>{t.configureWifi}</button>}
        {wired && <button type="button" onClick={onWired}>{t.configureWired}</button>}
      </div>
    </>
  )
}

function WiredForm({ t, step, onBack, onSubmit }: {
  t: Dict
  step: Extract<Step, { k: 'wired' }>
  onBack: () => void
  onSubmit: (form: Wired) => void
}) {
  const ports = ethernetPorts(step.status)
  const [form, setForm] = useState<Wired>(step.form ?? { port: ports[0]?.name ?? '', mode: 'dhcp', address: '', gateway: '', dns: '' })
  const [error, setError] = useState('')
  const set = (patch: Partial<Wired>) => setForm(f => ({ ...f, ...patch }))
  const submit = (e: SubmitEvent) => {
    e.preventDefault()
    const problem = form.mode === 'dhcp'
      ? ''
      : !isCidr(form.address)
          ? t.results.invalid_address
          : form.gateway && !isIpv4(form.gateway)
            ? t.results.invalid_gateway
            : splitList(form.dns).some(d => !isIp(d)) ? t.results.invalid_dns : ''
    setError(problem)
    if (!problem)
      onSubmit(form)
  }
  return (
    <form onSubmit={submit} noValidate>
      <h2>{t.wiredTitle}</h2>
      <label>
        {t.port}
        <select value={form.port} onChange={e => set({ port: e.target.value })}>
          {ports.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
        </select>
      </label>
      <label className="check">
        <input type="radio" name="mode" checked={form.mode === 'dhcp'} onChange={() => set({ mode: 'dhcp' })} />
        {t.dhcp}
      </label>
      <label className="check">
        <input type="radio" name="mode" checked={form.mode === 'static'} onChange={() => set({ mode: 'static' })} />
        {t.static}
      </label>
      {form.mode === 'static' && (
        <>
          <label>
            {t.addressLabel}
            <input inputMode="decimal" autoCapitalize="none" spellCheck={false} value={form.address} onChange={e => set({ address: e.target.value.trim() })} />
          </label>
          <label>
            {t.gateway}
            <input inputMode="decimal" autoCapitalize="none" spellCheck={false} value={form.gateway} onChange={e => set({ gateway: e.target.value.trim() })} />
          </label>
          <label>
            {t.dns}
            <input autoCapitalize="none" spellCheck={false} value={form.dns} onChange={e => set({ dns: e.target.value })} />
          </label>
        </>
      )}
      {error && <p className="alert" role="alert">{error}</p>}
      <div className="row">
        <button type="button" className="secondary" onClick={onBack}>{t.back}</button>
        <button type="submit">{t.apply}</button>
      </div>
    </form>
  )
}

function NetworkForm({ t, step, onRescan, onPick }: {
  t: Dict
  step: Extract<Step, { k: 'network' }>
  onRescan: () => void
  onPick: (ssid: string, hidden: boolean) => void
}) {
  const [manual, setManual] = useState(step.manual)
  const [ssid, setSsid] = useState('')
  const [hidden, setHidden] = useState(false)
  const [error, setError] = useState('')
  const submit = (e: SubmitEvent) => {
    e.preventDefault()
    const n = byteLength(ssid)
    if (n < 1 || n > 32)
      return setError(t.ssidInvalid)
    onPick(ssid, hidden)
  }
  return (
    <>
      <h2>{t.networkTitle}</h2>
      {step.networks && (
        <>
          {step.networks.length === 0 && <p className="muted">{t.noNetworks}</p>}
          <ul className="networks">
            {step.networks.map(n => (
              <li key={n.ssid}>
                <button type="button" className="network" onClick={() => onPick(n.ssid, false)}>
                  <span>{n.ssid}</span>
                  <span className="muted">
                    {n.security === 'open' ? t.open : n.security}
                    {' · '}
                    {n.signalDbm}
                    {' dBm'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="row">
            <button type="button" className="secondary" onClick={onRescan}>{t.rescan}</button>
            {!manual && <button type="button" className="secondary" onClick={() => setManual(true)}>{t.manual}</button>}
          </div>
        </>
      )}
      {manual && (
        <form onSubmit={submit} noValidate>
          <label>
            {t.ssid}
            <input autoCapitalize="none" spellCheck={false} value={ssid} onChange={e => setSsid(e.target.value)} />
          </label>
          <label className="check">
            <input type="checkbox" checked={hidden} onChange={e => setHidden(e.target.checked)} />
            {t.hidden}
          </label>
          {error && <p className="alert" role="alert">{error}</p>}
          <button type="submit">{t.next}</button>
        </form>
      )}
    </>
  )
}

function PasswordForm({ t, step, onBack, onSubmit }: {
  t: Dict
  step: Extract<Step, { k: 'password' }>
  onBack: () => void
  onSubmit: (psk: string) => void
}) {
  const [psk, setPsk] = useState('')
  const [error, setError] = useState('')
  const submit = (e: SubmitEvent) => {
    e.preventDefault()
    if (psk && !PSK.test(psk))
      return setError(t.pskInvalid)
    onSubmit(psk)
  }
  return (
    <form onSubmit={submit} noValidate>
      <h2>{fill(t.passwordTitle, { ssid: step.ssid })}</h2>
      <label>
        {t.wifiPassword}
        <input type="password" autoComplete="off" value={psk} onChange={e => setPsk(e.target.value)} />
      </label>
      {step.status.wifiMode === 'ap' && <p className="warn">{fill(t.apWarning, { ssid: step.ssid })}</p>}
      {error && <p className="alert" role="alert">{error}</p>}
      <div className="row">
        <button type="button" className="secondary" onClick={onBack}>{t.back}</button>
        <button type="submit">{t.join}</button>
      </div>
    </form>
  )
}

function DoneView({ t, step }: { t: Dict, step: Extract<Step, { k: 'done' }> }) {
  const r = step.reached
  return (
    <>
      <h2>{t.done}</h2>
      {r && <p className="ok">{fill(t.doneConnected, { kind: r.kind === 'ethernet' ? t.ethernet : t.wifi, address: (r.address ?? '—').split('/')[0] })}</p>}
      {/* Only links: the HTTPS page never requests the device's HTTP itself. */}
      {step.urls.length === 0 && <p>{t.noConsole}</p>}
      {step.urls.length > 0 && (
        <p>
          {step.unclaimed ? t.setPasswordAt : t.consoleAt}
          {step.urls.map((u, i) => (
            <span key={u}>
              {i > 0 && t.or}
              <a href={u} target="_blank" rel="noreferrer">{u}</a>
            </span>
          ))}
          {t.period}
        </p>
      )}
      {step.unclaimed && step.urls.length > 0 && <p>{t.deviceCode}</p>}
      {step.apOn && <p className="muted">{t.apStillOn}</p>}
      {step.claimedHere && <p className="muted">{t.hotspotOff}</p>}
    </>
  )
}
