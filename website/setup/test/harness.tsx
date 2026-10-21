// The dev harness (mock.html, `bun run dev:setup`): the real page against a mock device in the
// browser, for screenshots and manual checks. ?s=unclaimed (default), claimed or none; ?ios=1.
// Not part of the build.

import type { MockOptions } from './mock-device'
import { createRoot } from 'react-dom/client'
import { App } from '../src/App'
import { detectLang } from '../src/i18n'
import { browserVerifier } from './browser-verifier'
import { MockDevice } from './mock-device'
import { fakeBluetooth } from './mock-gatt'
import '../src/styles.css'

const q = new URLSearchParams(location.search)
const common: MockOptions = {
  spake: browserVerifier,
  connectDelay: 400,
  routers: { 'Harbour': { psk: 'harbour-wifi-1', ip: '192.168.8.41' }, 'Marina Office': { psk: 'marina-office-9', ip: '10.20.0.15' } },
  networks: [
    { ssid: 'Harbour', signalDbm: -48, security: 'wpa2-psk', channel: 36 },
    { ssid: 'Harbour', signalDbm: -61, security: 'wpa2-psk', channel: 6 },
    { ssid: 'Marina Office', signalDbm: -63, security: 'wpa2-wpa3', channel: 11 },
    { ssid: 'Marina Guest', signalDbm: -72, security: 'open', channel: 1 },
  ],
}
const scenarios: Record<string, MockOptions> = {
  unclaimed: {},
  claimed: { claimed: true, auth: 'password', secret: 'harbour-pw-1', wifiMode: 'client', hostname: 'quay-7' },
}
const s = q.get('s') ?? 'unclaimed'
const mock = new MockDevice({ ...common, ...scenarios[s] })

createRoot(document.getElementById('root')!).render(
  <App
    bluetooth={s === 'none' ? undefined : fakeBluetooth(mock)}
    ios={q.get('ios') === '1'}
    initialLang={detectLang(navigator.languages, location.search)}
  />,
)
