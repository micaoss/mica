# Mica OS System Architecture

The top-level map; each section names the record it summarises.

---

## 1. What Mica OS is

An embedded appliance operating system for industrial devices: a read-only
Debian root under systemd or OpenRC, as each product chooses, updated through
signed file deployments. The root boots, runs and updates on its own; a small
Rust plane, where the product carries it, owns the device's settings and
writes the files the root starts its services from.

**Naming.** The product is Mica OS (identifier `mica`). Package, binary,
service, D-Bus and path names use the `mica` prefix (`micad`, `mica-deploy`,
`com.mica.micad`, `/mica/config`).

| Layer | What it is | Where |
|---|---|---|
| OS core | a Debian trixie floor with no init and busybox as its command set, plus the product's init (`mica-systemd`, or `mica-openrc` with `mica-mdev`), packed into a squashfs with a dm-verity hash tree over it | `mica-system-base:docs/floor-and-options.md`, `mica-build:rootfs/` |
| Management plane | `micad`, optional (the product feature `micad`) — a settings tree, reconcilers that write the base's files and drive its services, and a D-Bus surface; a **core component**, a verity image composed over the root at boot, so it updates without a new root | `mica-core:crates/micad/`, `mica-core:docs/mica-core.md`, `docs/reference/management.md` |
| API | `mica-apid` — the API daemon, in micad's component: plain HTTP on 8080 by default, HTTPS on 8443 once enabled; the console (`mica-apid-ui`, a component of its own) is one client of the API it serves | `mica-core:crates/mica-apid/`, `docs/reference/api.md` |
| Application data | `mica-mqttd` bridges only exact package-enrolled `com.mica.<class>[.<suffix>]` application item trees to MQTT; `com.mica.micad` is forbidden | `mica-pkgs:crates/mica-mqttd/`, `mica-pkgs:crates/mica-mqtt-broker/`, `mica-pkgs:docs/mica-pkgs.md`, `docs/integrate/bus.md` |
| A/B installer | Native durable file transactions with UEFI/FIT trial records | `mica-core:crates/mica-deploy/`, `docs/reference/boot.md` |
| Update trust | Signed deployment/catalog envelopes and kernel-enforced root/support signatures | `mica-core:crates/mica-deploy/`, `docs/security/signing.md` |
| BSP artifacts | per-board kernel, device tree and loader inputs, built into a board bundle | `mica-build:boards/`, `mica-build:boards/README.md` |
| Workloads | Compose projects declared to micad and run by the product's container engine (podman, supervised by `mica-containerd`) on either init, off by default; in the products with the `containers` feature (the `full` variants) | `mica-podman:README.md`, `docs/integrate/containers.md` |

### 1.1 The base and the management add-on

A device runs in two layers, and the second is optional.

- **The base** is the signed root: the init, the mounts, the accounts, the
  hostname, the network and DNS, time, SSH, the feature services the product
  chose (Wi-Fi, the access point, MQTT, containers), the health gate, the
  boot-failure handler and `mica-deploy`. Every service reads its configuration
  from its own file on DATA, in a format the service owns, and starts from that
  file at boot. A device with the base alone boots, joins its
  network, takes SSH logins by key, confirms its boot on the init
  (`mica-system-base:payload/etc/mica/health.conf`), updates by hand, from an
  archive or on a timer, and resets to factory.
- **micad** is the management add-on: the product feature `micad`, which
  selects the daemon from the core set at boot (`mica-core:docs/mica-core.md`
  6.2), and with it apid and the console. It adds the settings tree and its
  API, update policy and approval, provisioning, containers and apps, LAN
  discovery and the transient root password.

The contract between them is the files on DATA. micad is a writer of them,
never the reason a service runs: a reconciler writes a service's file, then
restarts or stops the service. A feature service the image does not enable is
switched on by the reconciler's enablement, which is recorded in
`/var/lib/mica/units/enabled` because enablement on the read-only root lasts
only until the next boot; the base's `mica-units` starts every unit listed
there at boot. The base never reads the settings tree, and removing micad
leaves every service as micad last configured it.

| Service | Its file on DATA | Started at boot by | Without micad |
|---|---|---|---|
| Network (OpenRC) | `/var/lib/mica/network/interfaces` | the init | as last configured; DHCP on every `eth*` until then |
| Network and DNS (systemd) | `/var/lib/mica/network/networkd`, `/var/lib/mica/dns/resolved.conf.d`, linked from `/run/systemd/network` and `/run/systemd/resolved.conf.d` | the init | as last configured; DHCP until then |
| Static hosts records, global DNS | `/var/lib/mica/dns/hosts`, `/var/lib/mica/dns/resolv.global` (OpenRC) | the init | as last configured |
| Network time | `/var/lib/mica/time/` | the init | the servers last configured, or the default pool |
| SSH | `/var/lib/mica/ssh/sshd.env` | the init | as last configured, else as the product's `SSH=on\|off` says; keys from a provisioning medium's `mica-authorized-keys` |
| Wi-Fi station, access point | `/var/lib/mica/wifi/` (OpenRC), the STATE binds of `/etc/wpa_supplicant` and `/etc/hostapd` (systemd) | `mica-units` | as last configured; off until micad first configures them |
| MQTT broker and bridge | `/var/lib/mica/mqtt/` | `mica-units` | as last configured; off until micad first configures them |
| Containers | the projects under `/mica/containers` | `mica-units` (the supervisor) | as last configured; off until micad first turns them on |
| Bluetooth | the adapter's state under `/var/lib/bluetooth` | the init (systemd), micad (OpenRC) | systemd: runs where the adapter exists; OpenRC: not started |
| Health gate | -- | the init | checks the init, and micad only where the image carries it |
| Updates | `/mica/config/updates.json` | -- | `mica-deploy update` by hand, `update --archive` offline, and on systemd a daily timer under `policy: auto` that never reboots (OpenRC: planned) |
| Factory reset | -- | -- | `mica-deploy factory-reset` |

## 2. Component inventory (runtime)

```
  management add-on (optional)
    apid + console --- com.mica.micad1 (system bus) --- micad
    HTTP(S) API                                   settings tree on DATA
                                                  reconcilers, Deployments
                                                          |
                     writes each service's file, restarts or stops it,
                     records what it enabled
                                                          v
  DATA      /var/lib/mica/<service>/      /var/lib/mica/units/enabled
                     |                                    |
  base      the init, at boot                    mica-units, at boot
                     |                                    |
            network, DNS, time, SSH,          Wi-Fi station, access point,
            health gate, mica-update.timer    MQTT broker and bridge,
                                              mica-containerd (podman)
            mica-deploy: update, rollback, factory-reset

  mica-mqttd -> MQTT, from exact-enrolled com.mica.* applications only
```

- **The init** is systemd or OpenRC, as the product states in
  `/usr/lib/mica/product.conf` (`INIT`). Every piece above is a service of it,
  shipped by the package that carries the daemon for both inits. The init
  starts each from its file on DATA, and micad re-renders, restarts and stops
  them rather than supervising processes of its own (`docs/reference/wifi.md`).
  What each reconciler drives on either init is `mica-core:docs/mica-core.md`
  sections 3.4 and 3.8; what the base starts at boot is
  `mica-system-base:docs/floor-and-options.md`.
- **`micad`** owns the settings tree persisted on DATA/state, exports it over the
  system bus as `com.mica.micad`, and runs one reconciler per concern in
  `mica-core:crates/micad/src/reconciler/`. Its unit is `Type=dbus` (`mica-core:crates/micad/dist/micad.service`).
- **`apid`** listens where `access.web` says — plain HTTP on 8080 by default,
  HTTPS on 8443 with a per-device certificate once enabled, the HTTP port then
  only redirecting — authenticates the operator, and reads and writes
  device state by calling micad over that bus; its TLS material, login-backoff
  counters and audit ring live under `/var/lib/mica/apid`
  (`mica-core:crates/mica-apid/dist/apid.service`). The dashboard is one of its clients, and
  `mica-core:crates/mica-apid/openapi.json` is generated from the handlers.
- **Networking** is micad's `network`, `wifi.client` and `wifi.ap` subtrees,
  reconciled into systemd-networkd, wpa_supplicant and hostapd units (on
  OpenRC, busybox ifupdown and the `mica-wifi-*` services). Wi-Fi
  is a pair of reconcilers, not a separate daemon (`docs/reference/wifi.md`).
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
  (`mica-core:docs/mica-core.md` section 3.4).
- **`mica-mqttd`** dynamically publishes only exact package-enrolled
  `com.mica.<class>[.<suffix>]` application item trees and, in full mode,
  applies writes to the exact application service. It has zero D-Bus access to
  `com.mica.micad`; micad renders its topic identity into a one-purpose file on
  DATA, `/var/lib/mica/mqtt/mqttd-device.env`.
  SSH, networking, credentials, containers, MQTT
  configuration, health, updates and power stay on the management plane and
  never become MQTT items (`docs/integrate/bus.md`). `mica-mqtt-broker` is the
  local broker, built from `rumqttd` as a library
  (`mica-core:Cargo.toml`, one Cargo workspace over `crates/`).
- **Containers** are Compose projects declared in micad's `container`
  settings and handed to `mica-containerd`, which runs them with podman,
  restarts them by policy and starts them at boot; systemd or OpenRC only
  starts the supervisor. While the `container.enabled` switch is false — the
  default — the supervisor is stopped and the projects stay declared (`mica-podman:README.md`,
  `docs/integrate/containers.md`).

## 3. Storage and boot

Current images contain ESP/SYSTEM/DATA on uefi-x64 and uefi-arm64, or
FIRMWARE/SYSTEM/DATA on cx3576. SYSTEM owns immutable root/support objects and
signed deployment records, and the device's core sets with their components
under `sets/core/`. DATA owns persistent state, metadata, applications,
user data and bounded disposable namespaces. Only DATA grows.

The signed UKI/FIT starts `mica-init`. It authenticates the selected descriptor,
opens signed root/support verity mappings, establishes persistent identity and
binds modules and firmware before the init. Native trial records are decremented
before launch and confirmed only by the health path. Shutdown uses a bounded
exitramfs to release loops/mappings before their backing filesystem.

DATA/var provides the writable `/var` tree under a byte/inode project limit.
Protected identity and management state use separate DATA/state binds; project
accounting separates container and system/user usage without limiting either.
Only general variable data has a project quota limit.
DATA/containers is a separate bind at `/mica/containers`.
See [storage](reference/storage.md) and [read-only root](reference/ro-root.md).

## 4. Trust chain

Boot, content and metadata signing use independent keys. Firmware authenticates
the UKI/FIT; the kernel authenticates signed verity roots; native tools authenticate
strict component/deployment/catalog metadata against embedded public policy.
Normal updates never write firmware. Firmware publication and offline maintenance
have a separate signed receipt and mandatory readback.

See [release signing](security/signing.md) for overlap/removal and measured
limits. Development signing does not establish physical ROM/SPL provisioning.
QEMU evidence and pending cx3576 bench evidence are tracked separately.

## 5. Access model

Provisioning and debugging are different problems, and Mica OS does not answer both
with one shell (`docs/reference/access.md`). Three ways in exist today:

1. **The API**, over HTTP or, once enabled, HTTPS, authenticated by an argon2id password hash held in
   the settings tree, with persistent login-backoff counters and an audit ring.
2. **SSH** — `mica-sshd`, Dropbear or, where the product sets
   `SSH_SERVER=openssh`, OpenSSH, started by the init from
   `/var/lib/mica/ssh/sshd.env` on DATA. micad writes that file and the
   authorized keys of the two managed accounts; without micad, `mica-add-keys`
   takes the keys from a provisioning medium. A product carries it with the
   feature `ssh` and says with `SSH=on|off` whether it runs at first boot (off
   by default); persistent access is by public key and a root password is the
   transient exception.
3. **Physical recovery** — a whole-disk reflash through the board's loader path
   (RockUSB on cx3576), below the OS and reachable when nothing else is.

Disablement is layered. One layer ships: the runtime switch, where
`enabled: false` stops `mica-sshd` and saves SSH off on DATA, where the init
reads it at every boot, and every image seeds it as its product's `SSH=` says. There is no image profile package or profile file: development and
production images differ by the kernel command line parameter
`mica.profile=dev|prod`, carried only in signed boot configuration; no
difference in access follows from it, and there is no irreversible shell
lockdown (`docs/reference/access.md` section 8).

## 6. Repository map

Mica OS is built from the repositories below. Each produces one thing, and
consumes the others only at a pinned release — never by reaching into another's
build tree — and every pin is its producer's latest release, moved with
`bin/mica-tools locks update`.

| Repository | Produces | Consumes |
|---|---|---|
| `mica` | the product's design contracts and the public documentation | nothing |
| `mica-build-tools` | the one implementation of the release-lock and build rules (`bin/mica-tools`), pinned by commit in every other repository's `locks/mica-build-tools.pin` | nothing |
| `mica-build-env` | five build-env images (`base`, `c`, `go`, `rust`, `bsp`), armhf cross-built in the amd64 ones | `mica-build-tools` |
| `mica-system-base` | the board-independent base: the pinned Debian lock, the Base's own packages (the two inits among them), the floor root | `mica-build-env`, `mica-build-tools` |
| `mica-core` | the management plane: the core components `micad` (with `mica-apid`) and `mica-apid-ui`, and the packages `mica-deploy` and `mica-lifecycle` | `mica-build-env`, `mica-build-tools`, `mica-system-base` |
| `mica-pkgs` | the feature packages a product chooses: `mica-mqtt-broker`, `mica-mqttd` and `mica-sftp-server`; micad only configures and starts them | `mica-build-env`, `mica-build-tools`, `mica-system-base` |
| `mica-podman` | `mica-podman`, the container engine and its supervisor `mica-containerd`, from pinned upstream source | `mica-build-env`, `mica-build-tools`, `mica-system-base` |
| `mica-docker` | `mica-docker`, the Docker engine (dockerd, the `docker` and `docker compose` CLIs, containerd, runc), from pinned upstream source; the engine of `uefi-x64.docker` | `mica-build-env`, `mica-build-tools`, `mica-system-base` |
| `mica-build` | per board: kernel, device tree, loader, firmware and the board package (`boards/`); and the products `<board>.<variant>`, each released on its own: a composed root, signed components, factory images and update archives | all of the above, each at its pin |

The interfaces between them are files, not directories:

- **`locks/mica-build-env.lock`** — the build-env release every repository builds in.
- **`locks/mica-build-tools.pin`** — the mica-build-tools commit every repository runs.
- **`mica-system-base.lock`** and its `locks/pins/<repository>.pin` — the floor root, the
  Debian pools by digest and the archive any other package resolves from
  ([release lock](reference/release-lock.md)).
- **The Debian pool** — every `.deb` a product installs is imported at its pin from the
  release of the repository that produces it, except the board packages,
  which `mica-build` builds from `boards/` and `common/` into the board's pool.
- **The board bundle** — a board directory under `mica-build:boards/` produces a
  board's kernel, loader, firmware and board package; the engine consumes them
  and never reaches into a board's build (`mica-build:boards/README.md`).
- **The signed deployment envelope** — what `mica-build` signs and what `mica-deploy`
  authenticates on the device ([release signing](security/signing.md)).

Each repository's own layout is documented in its README; this map does not restate it.
Product documentation lives here, module documentation lives with the module
(`docs/README.md`, *Where documentation lives*).

## 7. Boards

The current boards are `uefi-x64`, `uefi-arm64` and `mini-x64` (UEFI, signed UKI),
`cx3576` and `s905x5m` (U-Boot, signed FIT) and `qemu-armhf` (U-Boot, an unsigned
FIT, the root on UBI). Each has the product `<board>.basic`; `uefi-x64`,
`uefi-arm64` and `cx3576` also `<board>.full`, `s905x5m` names its products by
storage, and a `dev` product is built locally and never released
(`mica-build:boards/products.md`). Their build, acceptance and support tier
are kept in one table: [support tiers](hardware/README.md#current-boards).

A board produces artifacts and the OS build consumes artifacts; neither side
reaches into the other's build. Kernel configs must satisfy the shared
floor: the `core` fragment and the kernel features each board names in
`KERNEL_FEATURES` (`mica-build:common/kernel/features.tsv`,
`mica-build:boards/README.md`).

## 8. Where to read next

| Question | Document |
|---|---|
| What runs without micad, and from which file? | section 1.1, `mica-system-base:docs/floor-and-options.md` |
| What does micad own, and what is in the settings tree? | `docs/reference/management.md` |
| What is on the bus, and what are the item conventions? | `docs/integrate/bus.md` |
| What does the API serve? | `docs/reference/api.md`, `docs/integrate/console.md` |
| Why is the root read-only, and where do writes go? | `docs/reference/ro-root.md` |
| How is a deployment installed and confirmed? | `docs/reference/updates.md` |
| How is a release signed, and by whom? | `docs/security/signing.md` |
| How does a device get its first credentials? | `docs/integrate/provisioning.md` |
| How do I run a container here? | `docs/integrate/containers.md` |
