# Mica OS System Architecture

The top-level map; each section names the record it summarises.

---

## 1. What Mica OS is

An embedded appliance operating system for industrial devices: a read-only
Debian root under systemd, updated through signed file deployments, managed by a
small Rust plane that owns the device's settings and drives systemd to match
them.

**Naming.** The product is Mica OS (identifier `mica`). Package, binary,
service, D-Bus and path names use the `mica` prefix (`micad`, `mica-deploy`,
`com.mica.micad`, `/mica/config`).

| Layer | What it is | Where |
|---|---|---|
| OS core | Debian trixie with systemd as PID 1, packed into a squashfs with a dm-verity hash tree over it | `mica-system-base:src/`, `mica-build:rootfs/` |
| Management plane | `micad` — a settings tree, reconcilers that drive units, and a D-Bus surface | `mica-core:crates/micad/`, `docs/design/micad.md` |
| API | `mica-apid` — the HTTPS daemon; the dashboard is one client of the API it serves | `mica-core:crates/mica-apid/`, `docs/design/api.md` |
| Application data | `mica-mqttd` bridges only exact package-enrolled `com.mica.<class>[.<suffix>]` application item trees to MQTT; `com.mica.micad` is forbidden | `mica-core:crates/mica-mqttd/`, `mica-core:crates/mica-mqtt-broker/`, `docs/design/bus.md` |
| A/B installer | Native durable file transactions with UEFI/FIT trial records | `mica-core:crates/mica-deploy/`, `docs/design/uboot-ab-handshake.md` |
| Update trust | Signed deployment/catalog envelopes and kernel-enforced root/support signatures | `mica-core:crates/mica-deploy/`, `docs/design/release-signing.md` |
| BSP artifacts | per-board kernel, device tree and loader inputs, built into a board bundle | `mica-boards:boards/`, `docs/boards/contract.md` |
| Workloads | podman plus the Quadlet systemd generator, off by default | `mica-podman:deb/`, `docs/design/containers.md` |

## 2. Component inventory (runtime)

```
                  settings tree (TOML, DATA namespaces)
                                  |
                     micad  --  com.mica.micad1, system bus
     _____________________________|_________________________
    |            |             |          |        |
  apid      reconcilers   Deployments    sshd    podman
  HTTPS     wifi, sshd,   InstallUpdate Dropbear Quadlet
  API +     hostname,     GetUpdateState driven   units,
  dashboard network,      Confirm/Reject     by micad   off
            mqtt, container                       by default
                    |
            /run/mica/mqttd-device.env -> mica-mqttd -> MQTT
                                               |
                              exact-enrolled com.mica.* apps
```

- **systemd** is PID 1. Every piece above is a unit, and micad starts, stops and
  re-renders those units rather than supervising processes of its own
  (`docs/design/wifi.md`).
- **`micad`** owns the settings tree persisted on DATA/state, exports it over the
  system bus as `com.mica.micad`, and runs one reconciler per concern in
  `mica-core:crates/micad/src/reconciler/`. Its unit is `Type=dbus` (`mica-core:crates/micad/dist/micad.service`).
- **`apid`** terminates TLS, authenticates the operator, and reads and writes
  device state by calling micad over that bus; its TLS material, login-backoff
  counters and audit ring live under `/var/lib/mica/apid`
  (`mica-core:crates/mica-apid/dist/apid.service`). The dashboard is one of its clients, and
  `mica-core:crates/mica-apid/openapi.json` is generated from the handlers.
- **Networking** is micad's `network`, `wifi.client` and `wifi.ap` subtrees,
  reconciled into systemd-networkd, wpa_supplicant and hostapd units. Wi-Fi
  is a pair of reconcilers, not a separate daemon (`docs/design/wifi.md`).
- **Interface kinds.** A `network` entry declares a **kind** — physical, `vlan`,
  `bridge` or `wireguard` — and the one optional block that belongs to it. The
  block is authoritative and the interface name is not:
  *"`eth0.100` is a convention, not a declaration"*
  (`mica-core:crates/micad-settings/src/model.rs`). A physical entry renders
  one `.network` file, as it always did; each of the other three additionally
  renders a `.netdev` that creates the device, and the attachment is a line on
  the *other* interface's unit — `VLAN=` on the parent, `Bridge=` on the port.
  A removed virtual entry is torn down, not just unlinked, and a WireGuard
  tunnel's private key is drawn on the device into a `networkd-secrets/`
  directory beside the settings file, never into the settings tree
  (`docs/design/micad.md` §2.3a).
- **`mica-mqttd`** dynamically publishes only exact package-enrolled
  `com.mica.<class>[.<suffix>]` application item trees and, in full mode,
  applies writes to the exact application service. It has zero D-Bus access to
  `com.mica.micad`; micad renders its topic identity as a one-purpose `/run` input.
  SSH, networking, credentials, containers, MQTT
  configuration, health, updates and power stay on the management plane and
  never become MQTT items (`docs/design/bus.md`). `mica-mqtt-broker` is the
  local broker, built from `rumqttd` as a library
  (`mica-core:Cargo.toml`, one Cargo workspace over `crates/`).
- **Containers** run through podman with the Quadlet generator. While the
  `container.enabled` switch is false — the default — `/etc/containers/systemd`
  is not mounted and no container unit exists (`docs/design/containers.md`).

## 3. Storage and boot

Current images contain ESP/SYSTEM/DATA on uefi-x64 and uefi-arm64, or
FIRMWARE/SYSTEM/DATA on cx3576. SYSTEM owns immutable root/support objects and
signed deployment records. DATA owns persistent state, metadata, applications,
user data and bounded disposable namespaces. Only DATA grows.

The signed UKI/FIT starts `mica-init`. It authenticates the selected descriptor,
opens signed root/support verity mappings, establishes persistent identity and
binds modules and firmware before systemd. Native trial records are decremented
before launch and confirmed only by the health path. Shutdown uses a bounded
exitramfs to release loops/mappings before their backing filesystem.

DATA/var provides the writable `/var` tree under a byte/inode project limit.
Protected identity and management state use separate DATA/state binds; project
accounting separates container and system/user usage without limiting either.
Only general variable data has a project quota limit.
DATA/containers is a separate bind at `/mica/containers`.
See [storage](design/storage.md) and [read-only root](design/ro-root.md).

## 4. Trust chain

Boot, content and metadata signing use independent keys. Firmware authenticates
the UKI/FIT; the kernel authenticates signed verity roots; native tools authenticate
strict component/deployment/catalog metadata against embedded public policy.
Normal updates never write firmware. Firmware publication and offline maintenance
have a separate signed receipt and mandatory readback.

See [release signing](design/release-signing.md) for overlap/removal and measured
limits. Development signing does not establish physical ROM/SPL provisioning.
QEMU evidence and pending cx3576 bench evidence are tracked separately.

## 5. Access model

Provisioning and debugging are different problems, and Mica OS does not answer both
with one shell (`docs/design/access.md`). Three ways in exist today:

1. **The API**, over HTTPS, authenticated by an argon2id password hash held in
   the settings tree, with persistent login-backoff counters and an audit ring.
2. **SSH** — Dropbear, with micad rendering the only file that configures it
   (`/run/mica/dropbear.env`, one `DROPBEAR_ARGS` line) and the authorized keys
   of the two managed accounts. Shipped on both profiles, off by default on
   both; persistent access is by public key and a root password is the
   transient exception. OpenSSH is not in the image: the base root's gate
   asserts `usr/sbin/sshd`, `usr/bin/ssh` and `usr/lib/openssh` are absent
   (`mica-system-base:src/rootfs.ts`).
3. **Physical recovery** — a whole-disk reflash through the board's loader path
   (RockUSB on cx3576), below the OS and reachable when nothing else is.

Disablement is layered. One layer ships: the runtime switch, where
`enabled: false` stops and disables `dropbear.service`, and every image seeds it
off. There is no image profile package or profile file
(`docs/decisions/2026-09-14-no-image-profile-packages.md`): development and
production images differ by the kernel command line parameter
`mica.profile=dev|prod`, carried only in signed boot configuration; no
difference is implemented yet (`docs/design/access.md` §5.3). The one-way
DATA/meta lockdown is designed, and marked not implemented
(`docs/design/access.md` §5.2).

## 6. Repository map

Mica OS is seven repositories. Each produces one thing, and consumes the others only at a
pinned release — never by reaching into another's build tree.

| Repository | Produces | Consumes |
|---|---|---|
| `mica` | the product documentation, decisions and the project's task and plan records | nothing |
| `mica-build-env` | five build-env images (`base`, `c`, `go`, `rust`, `bsp`) and `RULES.md`, the rules every repository implements | nothing |
| `mica-system-base` | the board-independent base: the pinned Debian lock, the Base's own packages, the base root | `mica-build-env` |
| `mica-core` | the management plane as Debian packages: `micad`, `mica-apid`, `mica-mqttd`, `mica-mqtt-broker`, `mica-sftp-server`, `mica-deploy`, `mica-lifecycle` | `mica-build-env`, `mica-system-base` |
| `mica-podman` | `mica-podman`, the container engine package, from pinned upstream source | `mica-build-env`, `mica-system-base` |
| `mica-boards` | per board: kernel, device tree, loader, firmware and the board package; plus the radio packages | `mica-build-env`, `mica-system-base` |
| `mica-build` | the products: a composed root, signed components, factory images and update archives | all of the above, each at its pin |

The interfaces between them are files, not directories:

- **`build-env-image.lock`** — the build-env release every repository builds in.
- **`mica-system-base.lock`** and its `locks/pins/<repository>.pin` — the base root, the
  Debian pools by digest and the archive any other package resolves from
  ([release lock](design/release-lock.md)).
- **The Debian pool** — every `.deb` a product installs is imported at its pin from the
  release of the repository that produces it. `mica-build` builds no package.
- **The board bundle** — `mica-boards` publishes a board's kernel, firmware and board
  package; `mica-build` consumes them and never reaches into a board's build
  (`docs/boards/contract.md`).
- **The signed deployment envelope** — what `mica-build` signs and what `mica-deploy`
  authenticates on the device ([release signing](design/release-signing.md)).

Each repository's own layout is documented in its README; this map does not restate it.
Product documentation lives here, module documentation lives with the module
(`docs/README.md`, *Where documentation lives*).

## 7. Boards

The current boards are `uefi-x64` and `uefi-arm64` (UEFI, signed UKI) and `cx3576`
and `s905x5m` (U-Boot, signed FIT). Their build, acceptance and support tier
are kept in one table: [support tiers](boards/support-tiers.md#current-boards).

A board produces artifacts and the OS build consumes artifacts; neither side
reaches into the other's build. Kernel configs must satisfy the shared
assertion set `mica-boards:common/kernel/mica-required.fragment`
(`docs/boards/contract.md`).

## 8. Where to read next

| Question | Document |
|---|---|
| What does micad own, and what is in the settings tree? | `docs/design/micad.md` |
| What is on the bus, and what are the item conventions? | `docs/design/bus.md` |
| What does the HTTPS API serve? | `docs/design/api.md`, `docs/design/dashboard.md` |
| Why is the root read-only, and where do writes go? | `docs/design/ro-root.md` |
| How is a deployment installed and confirmed? | `docs/design/updates.md` |
| How is a release signed, and by whom? | `docs/design/release-signing.md` |
| How does a device get its first credentials? | `docs/design/provisioning.md` |
| How do I run a container here? | `docs/design/containers.md` |
