import type { ReactNode, SubmitEvent } from 'react'
import type { Dict, Lang } from './i18n'
import type { DeviceEvent, DeviceInfo } from './protocol/client'
import type { BluetoothDeviceLike, BluetoothLike } from './protocol/gatt'
import type { Network } from './util'
import { useEffect, useRef, useState } from 'react'
import { PROTOCOLS, SETUP_HOST } from './config'
import { DICTS, fill } from './i18n'
import { DisconnectedError, ProvisioningClient, SessionError } from './protocol/client'
import { connectGatt, requestDevice } from './protocol/gatt'
import { mergeNetworks } from './util'

// The phone's provisioning flow, mica-network-spec chapter 5 section 3: step 0
// (this page) to step 9 (finish); step 10 is the console on the router's LAN.

interface Status {
  wifiMode: string
  connected: boolean
  ssid: string | null
  ip: string | null
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
    | { k: 'joined', ssid: string, ip: string }
    | { k: 'done', ssid: string, ip: string, hostname: string, apPsk?: string }
    | { k: 'dropped', text: string }

const HOSTNAME = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i
const PSK = /^(?:[\x20-\x7E]{8,63}|[0-9a-f]{64})$/i
const byteLength = (s: string) => new TextEncoder().encode(s).length

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
    const text = unclaimed ? t.disconnectedUnclaimed : t.disconnectedClaimed
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
      await c.authenticate('none')
      go({ k: 'admin' })
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
      await clientRef.current!.authenticate(mode, secret)
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
    const e = await clientRef.current!.run('getStatus')
    if (e.event !== 'status') {
      setNotice(reason(e))
      return null
    }
    return { wifiMode: String(e.wifiMode), connected: e.connected === true, ssid: (e.ssid as string) ?? null, ip: (e.ip as string) ?? null }
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
        return go({ k: 'joined', ssid, ip: String(e.ip) })
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

  async function finish(ssid: string, ip: string) {
    go({ k: 'busy', text: t.finishing })
    try {
      const e = await clientRef.current!.run('finish')
      if (e.event === 'finished') {
        const apPsk = typeof e.apPsk === 'string' ? e.apPsk : undefined
        if (infoRef.current)
          infoRef.current = { ...infoRef.current, claimed: e.claimed === true, hostname: String(e.hostname) }
        return go({ k: 'done', ssid, ip, hostname: String(e.hostname), apPsk })
      }
      if (e.reason === 'already_claimed')
        return stop(t.alreadyClaimed)
      if (e.reason === 'not_claimed')
        return go({ k: 'admin' }, reason(e))
      go({ k: 'joined', ssid, ip }, reason(e))
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
  onPick: (ssid: string, hidden: boolean, status: Status) => void
  onJoin: (ssid: string, psk: string, hidden: boolean, status: Status) => void
  onFinish: (ssid: string, ip: string) => void
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
      return <StatusView t={t} status={step.status} onConfigure={p.onConfigure} />
    case 'network':
      return <NetworkForm t={t} step={step} onRescan={p.onConfigure} onPick={(ssid, hidden) => p.onPick(ssid, hidden, step.status)} />
    case 'password':
      return <PasswordForm t={t} step={step} onBack={p.onConfigure} onSubmit={psk => p.onJoin(step.ssid, psk, step.hidden, step.status)} />
    case 'joined':
      return (
        <>
          <p className="ok" role="status">{fill(t.success, { ssid: step.ssid, ip: step.ip })}</p>
          <button type="button" onClick={() => p.onFinish(step.ssid, step.ip)}>{t.finish}</button>
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

function StatusView({ t, status, onConfigure }: { t: Dict, status: Status, onConfigure: () => void }) {
  const mode = status.wifiMode === 'client' ? t.modeClient : status.wifiMode === 'ap' ? t.modeAp : t.modeOff
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
      </dl>
      <button type="button" onClick={onConfigure}>{t.configureWifi}</button>
    </>
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
  return (
    <>
      <h2>{t.done}</h2>
      <p>{fill(t.doneText, { ssid: step.ssid, ip: step.ip, hostname: step.hostname })}</p>
      {/* Only a link: the HTTPS page never requests the device's HTTP itself. */}
      <a className="button" href={`http://${step.ip}`} target="_blank" rel="noreferrer">{t.openConsole}</a>
      {step.apPsk && (
        <div className="secret">
          <p>{t.apPsk}</p>
          <code>{step.apPsk}</code>
          <p className="muted">{t.apPskOnce}</p>
        </div>
      )}
    </>
  )
}
