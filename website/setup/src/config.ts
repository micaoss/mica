// The page's address. The device's documentation and packaging print it; the
// deploy route in wrangler.setup.jsonc names the same host (a test holds them
// together).
export const SETUP_HOST = 'setup-test.micaos.dev'

// The BLE provisioning protocol versions this page speaks
// (mica-core:docs/ble-provisioning.md).
export const PROTOCOLS: readonly number[] = [1]
