# Provisioning

How a device gets its identity, its first credentials and its first
configuration when no network can be assumed. The operator's walk-through is
[first run](../start/first-run.md); the mechanisms are `mica-core`'s
(`mica-core:docs/mica-core.md` section 3.7).

## 1. First boot provisions itself

A device whose DATA holds no state mints its own on the first boot, before
anything is configured and with no network:

- a device id, 16 random bytes;
- the hostname `mica-<first 8 hex of the device id>`;
- its per-device secrets, drawn from the system's random source;
- SSH off, no network configuration, Wi-Fi at its defaults.

It records that provisioning is complete in the same write, so a device is
never left half-seeded, and a later boot changes nothing.

**Nothing secret is in an image.** The root is byte-identical on every device,
so a credential inside it would be one secret shared by the fleet; every
per-device secret is minted on the device. Nothing is derived from the
hostname, a MAC address, the machine id or the clock.

> status: shipped — evidence: `mica-core:crates/micad/src/provisioning.rs`, `mica-core:crates/micad/src/identity.rs`, `mica-system-base:payload/usr/lib/mica/mica-seed-state`

## 2. The secrets a device mints

| Secret | Authenticates |
|---|---|
| the access-point key | Wi-Fi clients joining the device's own provisioning access point ([Wi-Fi](../reference/wifi.md)) |
| the device password | **nothing today**: it is minted and reserved, and no login path checks it |

The two are independent draws: a Wi-Fi key can be recovered from a captured
handshake, so it must never also be a login credential. Neither is ever
regenerated on a running device, and there is no rotation path short of a
reset that returns the device to its unprovisioned state, after which the next
boot mints new ones.

The administrator's credential is not minted: it is set by whoever claims the
device ([access](../reference/access.md) section 3).

> status: shipped — evidence: `mica-core:crates/micad/src/identity.rs`, `docs/reference/access.md`

## 3. Three ways to configure a device before it has a network

| Way | Who | When it is read |
|---|---|---|
| **The provisioning document**, a file on the boot partition or on removable media | an operator next to the device, or the factory | at boot, on an unclaimed device |
| **Writing `/mica/config/` on DATA** before the device runs | an integrator holding the storage medium | at every boot |
| **A seed carried by the product** | the product's builder | at first boot, as a provisioning document |

Once any network exists, the API and the console are the way
([configuration](../operate/configuration.md)). There is no setup wizard, no
captive portal and no serial wizard.

Every way ends in the same place: the typed settings tree and its validators.
None edits a file behind the management daemon's back.

> status: shipped — evidence: `mica-core:crates/micad/src/provisioning_doc.rs`, `mica-core:crates/micad-settings/src/configuration.rs`, `mica-build:boards/products.md`

## 4. The provisioning document

One file, `mica-provisioning.toml`, at the root of the medium's filesystem.

```toml
version = 1

[identity]
deviceId = "0123456789abcdef0123456789abcdef"

[admin]
password = "the-first-administrator-password"
authorizedKeys = ["ssh-ed25519 AAAA... ops@factory"]

[network.eth0]
dhcp = true

[wifi]
enabled = true
interface = "wlan0"

[[wifi.networks]]
ssid = "site-ap"
psk = "the-site-key"
priority = 10

[time]
timezone = "Europe/Berlin"

[time.ntp]
servers = ["0.pool.ntp.org"]
```

Every section but `version` is optional. `identity`, `admin`, `network`,
`wifi` and `time` are the whole vocabulary: there is no hostname, no
certificate and no other section, and an unknown key refuses the document.

**Where it is looked for.** Once, at boot, before anything listens: first the
boot partition (the ESP of a UEFI board), then, only if that carried nothing,
an attached removable device. A FIT board has no ESP and uses removable media.
Every mount is read-only, and the file must be a regular file.

**The rules.**

- **Validated whole, applied whole.** One bad field applies nothing. A refusal
  names the key and a reason, never the value, and leaves the device unclaimed
  and configurable: a bad file cannot brick a device.
- **Only on an unclaimed device.** Once an administrator credential exists the
  document is refused as `already-claimed`. This is what makes an unsigned file
  safe: a stick pushed into a fielded device reconfigures nothing.
- **Idempotent.** The same document on a later boot is `unchanged`, whatever
  its comments or key order.
- **Not signed.** Authorisation is physical possession of the medium, bounded
  by the rule above.
- **Read at boot only.** Inserting media does not reconfigure a running
  device.
- **Left on the medium, untouched.** The device never writes to the operator's
  medium. A document may carry a password and a Wi-Fi key, so treat the medium
  as credential material.

`GET /api/v1/provisioning/status` reports the version and digest of the
document last applied, the outcome of the last attempt (`applied`,
`unchanged`, `rejected` with its reason) and whether the device is still
unclaimed. It returns no value a document carried.

> status: shipped — evidence: `mica-core:crates/micad/src/provisioning_doc.rs`, `mica-system-base:payload/usr/lib/mica/mica-provisioning-import`, `mica-core:crates/mica-apid/src/provisioning_api.rs`

## 5. Writing the configuration directly

System configuration lives on DATA as one JSON document per concern under
`/mica/config/` ([configuration](../operate/configuration.md)), so an integrator
can write an image, write the configuration beside it, and have a working
device with no ceremony between the two.

Unlike the provisioning document, this is honoured on a claimed device too.
The two rest on different authority: the document arrives on media put into a
device by whoever stands next to it, and the claim rule stops a stranger; a
write to DATA is made by somebody holding the storage of a device that is not
running, who could equally rewrite its credentials. Custody of the medium is
the bound.

A document that does not parse disables only the settings it carries, and the
rest of the device comes up.

> status: shipped — evidence: `mica-core:crates/micad-settings/src/configuration.rs`, `mica-core:docs/mica-core.md`

## 6. A seed in the product

A product may carry a provisioning document of its own
(`boards/<board>/products/<variant>/provisioning.toml` in `mica-build`). The
build places it on the image's boot medium, where section 4 reads it, so every
device written from that image provisions itself from the seed. The build is
marked factory-seeded. A seed is the one place a product may state a secret;
its settings defaults may not.

No product in the tree carries one.

> status: shipped — evidence: `mica-build:boards/products.md`

## 7. Invariants

- No fleet-shared credential or key in any image.
- No provisioning path bypasses validation.
- A reset to the unprovisioned state runs section 1 again and mints new
  secrets; identity survives the reset tiers that say so
  ([recovery](../reference/recovery.md)).
- A provisioning medium is credential material.

Volume provisioning, with its factory records and quarantine, is
[manufacturing](manufacturing.md).

> status: shipped — evidence: `mica-core:crates/micad/src/provisioning.rs`, `docs/reference/recovery.md`
