# Access

How an operator reaches a device: the API and console, SSH, the local
consoles, and what happens when every credential is lost. The mechanisms are
`mica-core`'s (`mica-core:docs/mica-core.md` sections 3 and 4); this page
states the rules a product relies on.

## 1. Principles

- **Access channels are services under the settings tree**, never side doors
  around it: a setting, a reconciler, a service. Nothing is configured by
  editing a file on the device.
- **Nothing secret is in an image.** A signed root is byte-identical on every
  device, so a password or key inside it would be one secret shared by the
  fleet. Credentials are minted on the device or supplied by its owner.
- **Persistent access is by key. A password is the exception, and it is
  transient.**
- **A fresh device is closed**: no authorized key and no account that accepts
  a password, on every product, and SSH off unless the product turns it on
  (`SSH=on`), when it takes keys alone.

> status: shipped — evidence: `mica-core:docs/mica-core.md`, `mica-system-base:payload/usr/lib/mica/mica-shadow-reconcile`

## 2. Channels

| Channel | Grants | Authenticated by | State |
|---|---|---|---|
| Management API and web console | everything the management plane does | the admin password (browser session) or an API token | on every product; the console only where the product carries it |
| SSH (Dropbear or OpenSSH, as `mica-sshd`) | root | an authorized public key, or the transient root password | off unless the product sets `SSH=on` or an administrator enables it |
| Local console on a display (`tty2`) | root | the transient root password | boards with a display; the first VT keeps the boot logo |
| Serial console | a login prompt | the transient root password | present where the board has one; nothing to log in with by default |
| Whole-disk reflash (board loader mode or external boot media) | a new device | physical access | every board; see the [board pages](../hardware/README.md) |

There is no network setup wizard, no managed console shell setting that takes
effect, and no rescue boot entry.

> status: shipped — evidence: `mica-core:crates/micad/src/reconciler/sshd.rs`, `mica-core:crates/micad/src/transient.rs`, `docs/integrate/display.md`

## 3. The claim

A device is **unclaimed** until an admin password exists, and exactly two
things can create the first one:

- `POST /api/v1/setup`, the first-run page of the console, or
- a provisioning document applied at boot
  ([provisioning](../integrate/provisioning.md)).

Every other route requires a credential an unclaimed device does not have, and
a provisioning document is refused once the device is claimed. The device
records which channel claimed it and when.

From core 0.0.4, on a device with a device code, setup also asks for that code:
it is printed on the label and shown on the device's own login prompt, serial
or display, so whoever claims the device has it in hand. A wrong code only
delays the next try. A product with `CLAIM_DEVICE_CODE=off` claims with the
password alone. Bluetooth provisioning claims nothing from 0.0.4: it sets up the
network, and the claim is the console's ([first run](../start/first-run.md)
section 5). A credential that arrived in a
provisioning document is a bootstrap secret, and the console requires it to be
rotated.

> status: shipped — evidence: `mica-core:docs/mica-core.md`, `mica-core:crates/micad/src/provisioning_doc.rs`

## 4. The API and the console

- Browsers exchange the admin password for an HMAC-signed, HttpOnly session
  cookie and send the session's CSRF token on every mutation. Automation uses
  bearer tokens, stored on the device as digests.
- Passwords are hashed with argon2id.
- **Failed logins back off, and the backoff survives a restart.** The delay
  doubles from one second and is capped at five minutes; it is never a
  permanent lockout.
- Security-relevant actions are written to a small local audit ring. It is a
  record of those events, not a complete history of who was on the device, and
  nothing uploads it.
- The API listens on plain HTTP port 8080 by default. With HTTPS enabled it
  serves on 8443 with a self-signed identity, which an administrator can
  replace, and the HTTP port only redirects; the session cookie is `Secure`
  exactly then.
- Settings and state pass a redactor before they leave the device, so secrets
  such as password hashes are never served.

> status: shipped — evidence: `mica-core:crates/mica-apid/src/auth.rs`, `mica-core:crates/mica-apid/src/audit.rs`, `mica-core:docs/mica-core.md`

### 4.1 Finding a device on the network: mDNS and SSDP

From core 0.0.4 micad announces the device on the local network, with two
responders of its own, on every interface with an address except the
loopback, the container engines' links, WireGuard and CAN. Each answers only a
query from the subnet it arrived on, and rate-limits its answers.

- **mDNS** answers `<hostname>.local` and publishes `_mica._tcp`, with the
  product and the hostname and nothing else (no version, no claim state, no
  device code). While the console is on the network (`access.web.mode` is
  `network`) it also publishes the console as `_http._tcp` or `_https._tcp`.
- **SSDP** answers UPnP discovery, so the device shows in a computer's network
  view. Its description, `http://<address>:<HTTP port>/ssdp/device.xml`, names
  the hostname, the product and an opaque serial, and links the console. It
  runs only while the console is on the network.
- **SSH is never announced**, by either.
- **The switches** are `access.mdns.enabled` and `access.ssdp.enabled`, both on
  the console's overview (局域网发现, "LAN discovery") and in `micad mdns
  on|off` and `micad ssdp on|off`. Unset, the product's `MDNS=` and `SSDP=`
  lines decide, and both are on when the product says nothing. Off means no
  socket at all. `micad mdns status`, `micad ssdp status`, `GET /api/v1/mdns`
  and `GET /api/v1/ssdp` show what runs and what is announced.
- **More services over mDNS**: a JSON drop-in in `/usr/share/mica/mdns.d/`
  (the image's) or `/run/mica/mdns.d/` (gone at reboot), `micad mdns add` and
  `micad mdns remove`, or an app's `mdns` manifest field, published while the
  app runs:

  ```json
  {"version": 1, "services": [
    {"instance": "Grafana", "type": "_http._tcp", "port": 3000, "txt": {"path": "/dashboards"}}
  ]}
  ```

  The rules for names, ports and TXT records are `mica-core:docs/mica-core.md`
  section 3.13.

Without micad neither responder runs ([without micad](../operate/without-micad.md)
section 8).

> status: shipped — evidence: `mica-core:crates/micad/src/reconciler/mdns.rs`, `mica-core:crates/micad/src/reconciler/ssdp.rs`, `mica-core:crates/mica-apid/src/routes/mdns.rs`, `mica-core:crates/mica-apid/src/routes/ssdp.rs`

## 5. SSH and the accounts

The root has two accounts, `root` and the operator `mica`, and neither has a
password: the shadow file is rebuilt at every boot and anything not locked is
locked again.

- **SSH is off until enabled** through the API (`access.ssh`), which also sets
  its port and listen addresses, unless the product sets `SSH=on`, when it runs
  from the first boot. An empty address list means every address.
- **Every authorized key is a root key.** One key list is rendered for both
  accounts. `mica` is a persistent working directory and a non-root default
  shell, not a lesser privilege level.
- **The transient root password** covers the case a key cannot: an operator in
  front of a device with no key installed. It is set through the API (8 to 72
  bytes), works for SSH and the local consoles, is stored in no setting, and is
  gone at the next boot. SSH offers password authentication only while one is
  active.
- The SSH server is Dropbear or, where the product sets `SSH_SERVER=openssh`,
  OpenSSH, and micad writes the only configuration it reads, on DATA. The init
  starts the server at boot as that configuration says, so SSH does not wait
  for micad and keeps working without it. Without micad, `mica-add-keys` adds
  the keys of a provisioning medium's `mica-authorized-keys`.
- Containers are rootful, so anyone who can run the container engine is
  already root. There is no unprivileged-user story on a device.

> status: shipped — evidence: `mica-core:crates/micad/src/reconciler/sshd.rs`, `mica-core:crates/micad/src/transient.rs`, `mica-system-base:payload/usr/lib/mica/mica-shadow-reconcile`

## 6. What persists

Configuration persists **through the settings tree**. There is no writable
`/etc` overlay: the root is a verified read-only image, so a setting the tree
does not model is a setting the device does not support.

| What | Reboot and update | Reset |
|---|---|---|
| Settings and configuration documents | kept, on DATA | a configuration reset reseeds them and identity survives; a factory reset erases them with the identity |
| `/home`, `/root`, `/srv` | kept, on DATA | an application-data reset clears `/srv`; a factory reset clears all three |
| Authorized keys, the SSH host key | kept | cleared with configuration; a factory reset draws a new host key |
| A write under `/etc` | refused by the read-only root | — |
| `/run` and the volatile log | lost at reboot | — |
| The transient root password | cleared at the next boot | — |

The reset tiers and the factory reset are [recovery](recovery.md).

> status: shipped — evidence: `mica-core:crates/micad/src/reset.rs`, `docs/reference/recovery.md`, `docs/reference/storage.md`

## 7. Locked out

An operator who loses the admin password, every API token and every authorized
key has **no software path back in**: the API needs the credential, SSH needs a
key that is not there, and the consoles have no account that accepts a
password.

Credential recovery exists in code — it mints a new admin credential under a
physical-presence assertion and never discloses the old one — but no current
board declares a physical recovery action, so it is refused on every board
today ([recovery](recovery.md)). What remains is a whole-disk reflash, which
costs every partition and the device identity.

> status: board-dependent — evidence: `mica-core:crates/mica-apid/src/routes/reset.rs`, `docs/reference/recovery.md`, `docs/hardware/README.md`

## 8. What does not exist

- An irreversible shell lockdown. SSH is disabled reversibly, by a setting an
  administrator can turn back on.
- A permanent login lockout, shell or session auditing, or audit upload.
- A difference in access between `dev` and released products: SSH is off and
  root is locked on both.

> status: unsupported
