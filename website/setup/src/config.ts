// The page's address. The device's documentation and packaging print it; the
// deploy route in wrangler.setup.jsonc names the same host (a test holds them
// together).
export const SETUP_HOST = 'init.micaos.dev'

// The page's first address, answered with a 301 to SETUP_HOST by
// worker/setup-redirect.ts (wrangler.setup-redirect.jsonc).
export const OLD_SETUP_HOST = 'setup-test.micaos.dev'

// The BLE provisioning protocol versions this page speaks
// (mica-core:docs/ble-provisioning.md).
export const PROTOCOLS: readonly number[] = [1]
