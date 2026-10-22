// @vitest-environment node
import type { MockOptions } from '../../test/mock-device'
import type { DeviceEvent } from './client'
import { describe, expect, it } from 'vitest'
import { MockDevice } from '../../test/mock-device'
import { fakeBluetooth } from '../../test/mock-gatt'
import { referenceVerifier } from '../../test/reference-verifier'
import { utf8 } from './bytes'
import { DisconnectedError, parseInfo, ProtocolError, ProvisioningClient, SessionError } from './client'
import { connectGatt, requestDevice, SERVICE } from './gatt'

async function open(opts: MockOptions) {
  const mock = new MockDevice({ spake: referenceVerifier(), ...opts })
  const bluetooth = fakeBluetooth(mock)
  const device = await requestDevice(bluetooth)
  const client = new ProvisioningClient(await connectGatt(device))
  return { mock, bluetooth, device, client, info: await client.readInfo() }
}

const ROUTERS = { Harbour: { psk: 'harbour-wifi-1', ip: '192.168.8.41' } }
const PORTS = [
  { name: 'eth0', kind: 'ethernet', carrier: true, address: null },
  { name: 'wlan0', kind: 'wifi', carrier: false, address: null },
]

describe('the client over a mocked GATT, against the mock device and the Node reference', () => {
  it('asks the chooser for the provisioning service only', async () => {
    const { bluetooth, info } = await open({})
    expect(bluetooth.requests).toEqual([{ filters: [{ services: [SERVICE] }] }])
    expect(info).toEqual({
      protocol: 1,
      model: 'mica cx3576',
      hostname: 'mica-a4e2e69e',
      claimed: false,
      auth: 'none',
      ops: ['getStatus', 'scanWifi', 'setWifi', 'setNetwork', 'finish'],
      maxWrite: 20,
    })
  })

  it('sets up an unclaimed device over X25519: setWifi, finish; nothing is claimed', async () => {
    const { mock, client } = await open({ routers: ROUTERS })
    // `start` asks for the status, which comes as an event right after `ready`.
    expect(await client.authenticate('none')).toEqual({ event: 'status', wifiMode: 'ap', connected: false, ssid: null, ip: null, interfaces: PORTS })
    expect(mock.sessionLog[0]).toMatchObject({ t: 'start', auth: 'none', status: true })
    expect(await client.run('getStatus')).toEqual({ id: 1, event: 'status', wifiMode: 'ap', connected: false, ssid: null, ip: null, interfaces: PORTS })
    expect(await client.run('scanWifi')).toEqual({ id: 2, event: 'failed', reason: 'ap_active' })
    expect(await client.run('claim', { password: 'admin-pass-1' })).toEqual({ id: 3, event: 'failed', reason: 'unknown_op' })
    const progress: DeviceEvent[] = []
    const connected = await client.run('setWifi', { ssid: 'Harbour', psk: 'harbour-wifi-1', hidden: false }, e => progress.push(e))
    expect(progress).toEqual([{ id: 4, event: 'connecting' }])
    expect(connected).toEqual({ id: 4, event: 'connected', ip: '192.168.8.41', hostname: 'mica-a4e2e69e' })
    let dropped = false
    client.onDisconnect = () => {
      dropped = true
    }
    expect(await client.run('finish')).toEqual({
      id: 5,
      event: 'finished',
      claimed: false,
      hostname: 'mica-a4e2e69e',
      interface: { name: 'wlan0', kind: 'wifi', address: '192.168.8.41/24' },
      consoleUrls: ['http://192.168.8.41', 'http://mica-a4e2e69e.local'],
      ap: 'off',
    })
    await new Promise(r => setTimeout(r, 5))
    expect(dropped).toBe(true)
    expect(mock.claimed).toBe(false)
    // Every write fitted info.maxWrite, and the long ones were split.
    expect(mock.largestWrite).toBe(20)
    expect(mock.commands.map(c => c.op)).toEqual(['getStatus', 'scanWifi', 'claim', 'setWifi', 'finish'])
  })

  it('authenticates a claimed device with SPAKE2+ and its password', async () => {
    const { mock, client } = await open({ claimed: true, auth: 'password', secret: 'harbour-pw-1', wifiMode: 'client', maxWrite: 182 })
    expect(await client.authenticate('password', 'harbour-pw-1')).toMatchObject({ event: 'status', wifiMode: 'client' })
    expect(mock.sessionLog.map(m => m.t)).toEqual(['start', 'share', 'confirm'])
    expect(await client.run('getStatus')).toMatchObject({ event: 'status', wifiMode: 'client' })
  })

  it('returns no status from a device whose ready does not carry the member', async () => {
    const { client } = await open({ statusOnStart: false })
    expect(await client.authenticate('none')).toBeUndefined()
    expect(await client.run('getStatus')).toMatchObject({ id: 1, event: 'status' })
  })

  it('sets up the wired port: applying, then up', async () => {
    const { client } = await open({})
    await client.authenticate('none')
    expect(await client.run('setNetwork', { interface: 'eth9', dhcp: true })).toMatchObject({ event: 'failed', reason: 'unknown_interface' })
    const progress: DeviceEvent[] = []
    expect(await client.run('setNetwork', { interface: 'eth0', static: { address: '10.0.0.5/24', gateway: '10.0.0.1', dns: ['10.0.0.1'] } }, e => progress.push(e)))
      .toEqual({ id: 2, event: 'up', interface: 'eth0', address: '10.0.0.5/24' })
    expect(progress).toEqual([{ id: 2, event: 'applying' }])
    // Wired only: the access point stays on until the console claim.
    expect(await client.run('finish')).toMatchObject({ claimed: false, interface: { name: 'eth0', kind: 'ethernet', address: '10.0.0.5/24' }, consoleUrls: ['http://10.0.0.5', 'http://mica-a4e2e69e.local'], ap: 'on' })
  })

  it('authenticates with a temp-code typed with a space', async () => {
    const { client } = await open({ claimed: true, auth: 'temp-code', secret: '40718263' })
    await client.authenticate('temp-code', '4071 8263')
    expect(await client.run('getStatus')).toMatchObject({ event: 'status' })
  })

  it('stops after a wrong password without sending confirm, and the device has counted it', async () => {
    const { mock, client } = await open({ claimed: true, auth: 'password', secret: 'harbour-pw-1' })
    await expect(client.authenticate('password', 'wrong-pw')).rejects.toMatchObject({ reason: 'auth_failed' })
    expect(mock.sessionLog.map(m => m.t)).toEqual(['start', 'share'])
    expect(mock.attemptsLeft).toBe(4)
    // A new start on the same connection.
    await client.authenticate('password', 'harbour-pw-1')
    expect(mock.attemptsLeft).toBe(5)
  })

  it('reports the attempts left when the share message carries them', async () => {
    const { client } = await open({ claimed: true, auth: 'password', secret: 'harbour-pw-1', attemptsInShare: true })
    await expect(client.authenticate('password', 'wrong-pw')).rejects.toMatchObject({ reason: 'auth_failed', attemptsLeft: 4 })
  })

  it('reports a lockout with its retry time', async () => {
    const { client } = await open({ claimed: true, auth: 'password', secret: 'pw-123456', attemptsLeft: 0 })
    const e = await client.authenticate('password', 'pw-123456').catch(err => err)
    expect(e).toBeInstanceOf(SessionError)
    expect(e).toMatchObject({ reason: 'locked', retryAfter: 600 })
  })

  it('passes on the device\'s session errors', async () => {
    const busy = await open({ busy: true })
    await expect(busy.client.authenticate('none')).rejects.toMatchObject({ reason: 'busy' })
    const unavailable = await open({ claimed: true, auth: 'password-unavailable' })
    expect(unavailable.info.auth).toBe('password-unavailable')
    await expect(unavailable.client.authenticate('password', 'x')).rejects.toMatchObject({ reason: 'password_unavailable' })
  })

  it('runs one operation at a time', async () => {
    const { client, mock } = await open({ routers: ROUTERS, connectDelay: 30 })
    await client.authenticate('none')
    let done: Promise<DeviceEvent> | undefined
    await new Promise<void>((resolve) => {
      done = client.run('setWifi', { ssid: 'Harbour', psk: 'harbour-wifi-1', hidden: false }, () => resolve())
    })
    await expect(client.run('getStatus')).rejects.toThrow(/running/)
    expect(mock.commands.at(-1)).toMatchObject({ op: 'setWifi' })
    expect(await done).toMatchObject({ event: 'connected' })
  })

  it.each([
    ['ssid_not_found', 'Elsewhere', 'whatever-1', {}],
    ['wrong_password', 'Harbour', 'not-the-key', {}],
    ['dhcp_timeout', 'Marina', 'marina-key-1', { Marina: { psk: 'marina-key-1', fail: 'dhcp_timeout' } }],
    ['unsupported_security', 'Corp', 'corp-key-12', { Corp: { psk: 'corp-key-12', fail: 'unsupported_security' } }],
  ])('passes on setWifi failure %s', async (reason, ssid, psk, routers) => {
    const { client } = await open({ routers: { ...ROUTERS, ...routers } })
    await client.authenticate('none')
    expect(await client.run('setWifi', { ssid, psk, hidden: false })).toMatchObject({ event: 'failed', reason })
  })

  it('reports finish already_claimed, and bad_request for any member', async () => {
    const { client } = await open({ routers: ROUTERS, claimedElsewhere: true })
    await client.authenticate('none')
    expect(await client.run('finish', { hostname: 'quay-7' })).toMatchObject({ event: 'failed', reason: 'bad_request' })
    expect(await client.run('finish')).toMatchObject({ event: 'failed', reason: 'already_claimed' })
  })

  it('hears closing and rejects what waits when the link drops', async () => {
    const { mock, client } = await open({ routers: ROUTERS, connectDelay: 1000 })
    await client.authenticate('none')
    const reasons: string[] = []
    client.onClosing = r => reasons.push(r)
    const pending = client.run('setWifi', { ssid: 'Harbour', psk: 'harbour-wifi-1', hidden: false })
    await new Promise(r => setTimeout(r, 10))
    await mock.close('idle')
    await expect(pending).rejects.toBeInstanceOf(DisconnectedError)
    expect(reasons).toEqual(['idle'])
    expect(client.connected).toBe(false)
  })

  it('drops the link on an event that does not authenticate', async () => {
    const { mock, client } = await open({})
    await client.authenticate('none')
    let dropped = false
    client.onDisconnect = () => {
      dropped = true
    }
    mock.notifyEvent(utf8('\x00\x00\x01not a record'))
    await new Promise(r => setTimeout(r, 5))
    expect(dropped).toBe(true)
    expect(client.connected).toBe(false)
    expect(mock.connected).toBe(false)
  })
})

describe('parseInfo', () => {
  it('clamps maxWrite to 20..512 and reads an unknown auth as unavailable', () => {
    expect(parseInfo(utf8('{"protocol":1,"maxWrite":4096,"auth":"fingerprint"}'))).toMatchObject({ maxWrite: 512, auth: 'password-unavailable' })
    expect(parseInfo(utf8('{"protocol":2}'))).toMatchObject({ protocol: 2, maxWrite: 20 })
    expect(() => parseInfo(utf8('{}'))).toThrow(ProtocolError)
    expect(() => parseInfo(utf8('nope'))).toThrow(ProtocolError)
  })
})
