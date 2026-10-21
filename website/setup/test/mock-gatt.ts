// Web Bluetooth's objects in front of a MockDevice: requestDevice, the GATT server, the service and
// its four characteristics, notifications and gattserverdisconnected.

import type { BluetoothDeviceLike, BluetoothLike, GattCharacteristic, GattServer, GattService } from '../src/protocol/gatt'
import type { MockDevice } from './mock-device'
import { COMMAND, EVENT, INFO, SERVICE, SESSION } from '../src/protocol/gatt'

type Bytes = Uint8Array<ArrayBuffer>

const view = (b: Uint8Array) => new DataView(new Uint8Array(b).buffer)
function bytes(v: BufferSource): Uint8Array {
  return ArrayBuffer.isView(v)
    ? new Uint8Array(v.buffer, v.byteOffset, v.byteLength).slice()
    : new Uint8Array(v).slice()
}

class Characteristic extends EventTarget implements GattCharacteristic {
  value: DataView | null = null
  notifying = false
  private readonly server: Server
  private readonly read?: () => Bytes
  private readonly write?: (b: Uint8Array) => void

  constructor(server: Server, read?: () => Bytes, write?: (b: Uint8Array) => void) {
    super()
    this.server = server
    this.read = read
    this.write = write
  }

  async readValue() {
    this.server.check()
    if (!this.read)
      throw new DOMException('not readable', 'NotSupportedError')
    this.value = view(this.read())
    return this.value
  }

  async writeValueWithResponse(v: BufferSource) {
    this.server.check()
    if (!this.write)
      throw new DOMException('not writable', 'NotSupportedError')
    this.write(bytes(v))
  }

  async startNotifications() {
    this.server.check()
    this.notifying = true
    return this
  }

  notify(b: Uint8Array) {
    if (!this.notifying || !this.server.connected)
      return
    this.value = view(b)
    this.dispatchEvent(new Event('characteristicvaluechanged'))
  }
}

class Server implements GattServer {
  connected = false
  readonly chars: Record<string, Characteristic>
  private readonly device: FakeDevice
  readonly mock: MockDevice

  constructor(device: FakeDevice, mock: MockDevice) {
    this.device = device
    this.mock = mock
    this.chars = {
      [INFO]: new Characteristic(this, () => mock.info()),
      [SESSION]: new Characteristic(this, undefined, b => mock.writeSession(b)),
      [COMMAND]: new Characteristic(this, undefined, b => mock.writeCommand(b)),
      [EVENT]: new Characteristic(this),
    }
    mock.notifySession = b => this.chars[SESSION].notify(b)
    mock.notifyEvent = b => this.chars[EVENT].notify(b)
    mock.dropLink = () => this.lost()
  }

  check() {
    if (!this.connected)
      throw new DOMException('GATT Server is disconnected.', 'NetworkError')
  }

  async connect() {
    this.connected = true
    this.mock.connect()
    return this
  }

  /** The page disconnects. */
  disconnect() {
    if (!this.connected)
      return
    this.mock.linkDown()
    this.lost()
  }

  /** The link is gone, whoever ended it. */
  lost() {
    if (!this.connected)
      return
    this.connected = false
    for (const c of Object.values(this.chars)) c.notifying = false
    this.device.dispatchEvent(new Event('gattserverdisconnected'))
  }

  async getPrimaryService(uuid: string): Promise<GattService> {
    this.check()
    if (uuid !== SERVICE)
      throw new DOMException('No Services matching UUID found in Device.', 'NotFoundError')
    return {
      getCharacteristic: async (c: string) => {
        this.check()
        const ch = this.chars[c]
        if (!ch)
          throw new DOMException('No Characteristics matching UUID found in Service.', 'NotFoundError')
        return ch
      },
    }
  }
}

export class FakeDevice extends EventTarget implements BluetoothDeviceLike {
  readonly gatt: Server
  readonly name: string

  constructor(name: string, mock: MockDevice) {
    super()
    this.name = name
    this.gatt = new Server(this, mock)
  }
}

/**
 * navigator.bluetooth for one mock device. `pick` stands for the user's choice in the chooser:
 * the device, or null for a cancelled chooser.
 */
export function fakeBluetooth(mock: MockDevice, pick: () => boolean = () => true) {
  const requests: unknown[] = []
  let device: FakeDevice | undefined
  const bluetooth: BluetoothLike & { requests: unknown[], device: () => FakeDevice | undefined } = {
    requests,
    device: () => device,
    async requestDevice(options) {
      requests.push(options)
      if (!options.filters.some(f => f.services.includes(SERVICE)) || !pick())
        throw new DOMException('User cancelled the requestDevice() chooser.', 'NotFoundError')
      device = new FakeDevice(mock.hostname, mock)
      return device
    },
  }
  return bluetooth
}
