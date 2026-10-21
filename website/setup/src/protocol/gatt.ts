import type { Bytes } from './bytes'

// The GATT side of protocol 1, through Web Bluetooth. TypeScript's DOM library
// has no Web Bluetooth types; these are the parts the page uses.

export const SERVICE = 'a7f50001-aa05-4fbe-ae8a-39652ca94ed5'
export const INFO = 'a7f50002-aa05-4fbe-ae8a-39652ca94ed5'
export const SESSION = 'a7f50003-aa05-4fbe-ae8a-39652ca94ed5'
export const COMMAND = 'a7f50004-aa05-4fbe-ae8a-39652ca94ed5'
export const EVENT = 'a7f50005-aa05-4fbe-ae8a-39652ca94ed5'

export interface GattCharacteristic extends EventTarget {
  readonly value?: DataView | null
  readValue: () => Promise<DataView>
  writeValueWithResponse: (value: BufferSource) => Promise<void>
  startNotifications: () => Promise<GattCharacteristic>
}

export interface GattService {
  getCharacteristic: (uuid: string) => Promise<GattCharacteristic>
}

export interface GattServer {
  readonly connected: boolean
  connect: () => Promise<GattServer>
  disconnect: () => void
  getPrimaryService: (uuid: string) => Promise<GattService>
}

export interface BluetoothDeviceLike extends EventTarget {
  readonly name?: string | null
  readonly gatt?: GattServer | null
}

export interface BluetoothLike {
  requestDevice: (options: { filters: { services: string[] }[] }) => Promise<BluetoothDeviceLike>
}

/** What the protocol client needs from a connection; the tests stand in for it too. */
export interface Transport {
  readInfo: () => Promise<Bytes>
  writeSession: (fragment: Bytes) => Promise<void>
  writeCommand: (fragment: Bytes) => Promise<void>
  onSession: (fragment: Bytes) => void
  onEvent: (fragment: Bytes) => void
  onDisconnect: () => void
  disconnect: () => void
}

/** The chooser lists only devices that advertise the provisioning service. */
export function requestDevice(bluetooth: BluetoothLike): Promise<BluetoothDeviceLike> {
  return bluetooth.requestDevice({ filters: [{ services: [SERVICE] }] })
}

const bytesOf = (v: DataView): Bytes => new Uint8Array(v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength) as ArrayBuffer)

/** Connects and subscribes to session and event before anything is written. */
export async function connectGatt(device: BluetoothDeviceLike): Promise<Transport> {
  if (!device.gatt)
    throw new Error('device has no GATT server')
  const server = await device.gatt.connect()
  const service = await server.getPrimaryService(SERVICE)
  const [info, session, command, event] = await Promise.all(
    [INFO, SESSION, COMMAND, EVENT].map(uuid => service.getCharacteristic(uuid)),
  )
  const t: Transport = {
    readInfo: async () => bytesOf(await info.readValue()),
    writeSession: f => session.writeValueWithResponse(f),
    writeCommand: f => command.writeValueWithResponse(f),
    onSession: () => {},
    onEvent: () => {},
    onDisconnect: () => {},
    disconnect: () => server.disconnect(),
  }
  const value = (e: Event) => bytesOf((e.target as GattCharacteristic).value as DataView)
  session.addEventListener('characteristicvaluechanged', e => t.onSession(value(e)))
  event.addEventListener('characteristicvaluechanged', e => t.onEvent(value(e)))
  device.addEventListener('gattserverdisconnected', () => t.onDisconnect(), { once: true })
  await session.startNotifications()
  await event.startNotifications()
  return t
}
