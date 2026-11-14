# Mica OS System Architecture

The top-level map of Mica OS as it is released: what runs on a device, how it
boots and updates, and which repository produces each part. Each section names
the record it summarises; the record is authoritative where the two differ.

---

## 1. What Mica OS is

An appliance operating system for embedded and industrial devices: a
read-only Debian root, under systemd or OpenRC as each product chooses, booted
from signed images and updated by signed, transactional deployments with an
automatic fallback. The root boots, runs and updates on its own. A small Rust
management plane, where the product carries it, owns the device's settings,
writes the files the root starts its services from, and serves an API and a
web console.

**Naming.** The product is Mica OS (identifier `mica`). Package, binary,
service, D-Bus and path names use the `mica` prefix (`micad`, `mica-deploy`,
`com.mica.micad`, `/mica/config`).

| Layer | What it is | Record |
|---|---|---|
| Root | a Debian trixie floor with BusyBox as its command set, one init (`mica-systemd`, or `mica-openrc` with `mica-mdev`) and the options the product names, packed as a squashfs under a signed dm-verity tree | `mica-system-base:docs/floor-and-options.md` |
| Kernel | per board: a signed UKI (UEFI boards) or a signed FIT (U-Boot boards), carrying the initramfs whose PID 1 is `mica-runkit` | `mica-build:boards/README.md`, `mica-core:docs/mica-core.md` 6.5 |
| Core components | `micad` (with `mica-apid` and the device's command line) and `mica-apid-ui` (the console), each a verity image composed over the root at boot from the device's **core set**, so they update without a new root | `mica-core:docs/mica-core.md` 2, 6.2 |
| Deployment client | `mica-deploy`, in the root: check, fetch, import, install, confirm, roll back, factory reset | `mica-core:docs/mica-core.md` 6.3 |
| Feature packages | the MQTT broker and bridge, the SFTP server, the Compute Engine agent; the container engine, Podman (with its supervisor `mica-containerd`) or Docker | `mica-pkgs:docs/mica-pkgs.md`, `mica-podman:README.md`, `mica-docker:README.md` |
| Board | kernel, device tree, loader, firmware and the board package (its hardware facts) | `mica-build:boards/README.md` |
| Resource service | `res.micaos.dev`: release files, the device update catalog and transfer indexes | `mica-res:docs/spec/release-publishing.md` |

## 2. The repositories

Each repository produces one thing and consumes the others only at a pinned
release, never by reaching into another's build tree.

| Repository | Produces | Consumes |
|---|---|---|
| `mica` | the public documentation and the website (`micaos.dev`, the setup page `init.micaos.dev`) | nothing |
| `mica-build-tools` | the one implementation of the release-lock, packing and build rules, `bin/mica-tools`, pinned by commit in every other repository | nothing |
| `mica-build-env` | five build images (`base`, `c`, `go`, `rust`, `bsp`); armhf is cross-built in the amd64 ones | `mica-build-tools` |
| `mica-system-base` | the Base: the pinned Debian packages (`upstream` rows), the floor root, both inits and the option packages (SSH, Wi-Fi, Bluetooth, time zones, sudo) | `mica-build-env`, `mica-build-tools` |
| `mica-core` | the core components `micad` and `mica-apid-ui`, and the packages `mica-deploy` and `mica-lifecycle` (the runkit) | `mica-build-env`, `mica-build-tools`, `mica-system-base` |
| `mica-pkgs` | `mica-mqtt-broker`, `mica-mqttd`, `mica-sftp-server`, `mica-gce-agent` | the same |
| `mica-podman` | `mica-podman`: Podman, crun, conmon, netavark and the supervisor `mica-containerd` | the same |
| `mica-docker` | `mica-docker`: dockerd, the `docker` CLI with `docker compose`, containerd and runc | the same |
| `mica-linux` | the kernel trees: upstream mirrors, one branch per board, dated snapshots | upstream kernel trees |
| `mica-uboot` | the U-Boot trees: mirrors and one branch per board loader (`mica/<board>-<medium>`) | upstream U-Boot trees |
| `mica-build` | per board the kernel, loader, firmware and board package; per product the composed root, the signed components, the factory images and update archives; the core sets (`core.<channel>`) | all of the above, each at its pin, and the kernel and U-Boot trees by commit |
| `mica-res` | the resource service behind `res.micaos.dev` and `dl.res.micaos.dev` | the releases posted to it |
| `mica-app` | an Android app for BLE provisioning, speaking micad's BLE protocol | `mica-core:docs/ble-provisioning.md` |
| `mica-fleet` | the fleet service; nothing on a device is a client of it yet | -- |

```
mica-build-tools ─▶ every repository (bin/mica-tools, pinned by commit)
mica-build-env ──▶ mica-system-base ─▶ mica-core ─┐
                         │       ├──▶ mica-pkgs ──┤
                         │       ├──▶ mica-podman ┤
                         │       └──▶ mica-docker ┤
mica-linux, mica-uboot ──┴───────────────────────▶ mica-build ─▶ GitHub releases ─▶ mica-res ─▶ devices
```

## 3. Pins and release locks

- **Every input is pinned.** A consumer keeps `locks/<repository>.lock`, the
  producer's release lock as published, and `locks/pins/<repository>.pin`,
  the release and the sha256 of its `SHA256SUMS`. A lock names the release's
  pool images by digest and each package (and each core component's image and
  record, as `item` rows) by version and sha256.
- **Every pin is its producer's latest release**, moved with
  `bin/mica-tools locks update`; `--check` only reports.
- **The Base's `upstream` rows are the only source of Debian packages.** A
  later stage installs a Debian package from its row and never pins one itself,
  so every consumer of a Base release runs the same archives.
- **The kernel and U-Boot** are pinned by commit in
  `mica-build:locks/upstream.lock`, each a dated snapshot branch of
  `mica-linux` (`mica/<board>-<YYYYMMDD>`) or a board branch of `mica-uboot`.
- **A release is named by its UTC minute**, `YYYYMMDD-HHMM`; a product release
  by `<board>.<variant>.<YYYYMMDD-HHMM>`, a core set by
  `core.<channel>.<YYYYMMDD-HHMM>`.

The lock format, the vectors and the version rules are
`mica-build-tools:docs/spec/release-lock.md` and
`mica-build-tools:docs/spec/package-versions.md`
([release lock](reference/release-lock.md)).

## 4. Products, images and core sets

A **product** is a variant of its board, `<board>.<variant>`, declared in
`mica-build:boards/<board>/products/<variant>/product.env`: its profile, its
init, its features, its container engine and SSH server, how it is claimed
and which images it publishes. The variant names what the product is for;
there is no default variant. A product with `PROFILE=dev` is built locally and
never released. The product's own facts reach the device in
`/usr/lib/mica/product.conf` (`PRODUCT`, `FEATURES`, `INIT`,
`CONTAINER_ENGINE`, `SSH_SERVER`, `CLAIM_DEVICE_CODE`, `MDNS`, `SSDP`,
`CLOUD_ADMINS`, `DOCS_URL`, `DOCS_URL_EN`).

A device runs two separately released things:

| | The system: a **deployment** | The core: a **core set** |
|---|---|---|
| What | the product's kernel (with the runkit) and root, `mica/deployment/v1` | every core component of a channel and architecture, `mica/set/v1` |
| Released as | one product, `<board>.<variant>.<stamp>` | one channel, `core.<channel>.<stamp>`, for every architecture |
| Taken by | devices of that product | every device of the architecture on the channel |
| Ordered by | its `generation` | its `generation` within its channel and architecture |
| Kept on SYSTEM | at most two: the running one and its fallback | at most three: current, on trial, and the ones bound to retained deployments |

- **Every image carries a seed set**, the newest `general` set at its build,
  and its deployment names it (`coreSet`). A device with no set does not boot.
- **Selection.** At boot the runkit composes the components of the set whose
  features meet the product's `FEATURES` (`micad` the daemon, `ui` the
  console). A component states the root interface levels it runs on and the
  root packages it requires; a set that does not select on a root is not
  composed over it, and a deployment is not installed with one.
- **A core update alone** is offered once the latest set of the device's
  channel selects on the running root; one that does not waits for a system
  update (`waitsForSystem`).
- **A system update on `general`** takes the channel's latest set for the new
  root with it, as one **pair** on one trial; a system update never
  downgrades core and never moves a device off its channel.

The rules are `mica-core:docs/mica-core.md` 6.2; how the build releases both is
`mica-build:README.md` (*Releases*) and [how releases work](releases/how-releases-work.md).

## 5. Boot

```
UEFI boards:   firmware ─▶ systemd-boot (boot counting) ─▶ signed UKI ─┐
U-Boot boards: ROM ─▶ U-Boot `micaboot` (records, trial count) ─▶ FIT ─┤
                                                                       ▼
   mica-runkit (PID 1 of the initramfs): verity root + support, core set,
   DATA, staged factory reset, owner keyring, driver extensions, identity
                                                                       ▼
   the root's init (systemd or OpenRC) ─▶ services ─▶ health gate ─▶ confirm
```

- **The loader picks a deployment.** Two boot record copies name at most two
  deployments; one on trial starts with three attempts, and the loader
  decrements and persists an attempt before it launches anything. UEFI boards
  keep the records on the ESP (systemd-boot with persisted boot attempts,
  `mica-system-base`'s `mica-systemd-boot`); U-Boot boards keep them in two
  64 KiB copies in the FIRMWARE partition, or in two UBI volumes, read by the
  `micaboot` command
  ([cx3576 boot](reference/boot.md)).
- **The kernel is signed.** Firmware with Secure Boot verifies the UKI; U-Boot
  verifies the FIT's signature against the key in its control device tree.
  `qemu-armhf` and `ssd202d` say `bootTrust: none`: their loader checks the
  FIT's hashes only, so they have no verified boot, and every other check below
  still holds.
- **`mica-runkit init`** (PID 1 of the initramfs; no network and no shell)
  requires dm-verity signature enforcement and arms the watchdog; reads the
  signed boot policy; authenticates the selected deployment; maps the support
  image and the root as signed dm-verity devices; composes the core set's
  selected components over `/usr` and `/etc` as read-only overlays; opens and
  mounts DATA (section 6), carrying out a staged factory reset first; seals
  the owner keyring; maps the driver extensions and composes modules and
  firmware; seeds the machine identity; and hands over to the root's init.
- **The health gate confirms.** `mica-health` (`/etc/mica/health.conf`)
  requires the init up and not in `maintenance` or `stopping`, and micad
  answering where the image carries it. It then runs `mica-deploy confirm`,
  which makes the booted deployment, set or extension change current. A trial
  that never confirms runs out of attempts and the loader boots the fallback.
- **Shutdown.** On systemd the runkit's `shutdown` is the exit ramdisk: it
  releases the verity, loop and DATA mappings in order and powers off or
  reboots only once nothing is left to write. An OpenRC root and a UBI board
  get none: the init leaves DATA read-only and reboots.

`mica-core:docs/mica-core.md` 6.4 and 6.5 are the runkit's contract.

## 6. Storage

### 6.1 Partitions

| Board storage | Partitions or volumes |
|---|---|
| GPT disk, UEFI (`uefi-x64`, `uefi-arm64`, `mini-x64`) | ESP (systemd-boot, UKIs, boot records), SYSTEM, DATA |
| GPT disk, U-Boot (`cx3576`, `s905x5m`) | FIRMWARE (loader and both record copies), SYSTEM, DATA |
| Raw NAND under UBI (`qemu-armhf`, `ssd202d`) | UBI volumes: `system` and `data` (UBIFS), `records-a`/`records-b`, and one static volume per kernel, support image, root, core component and driver extension |

- **SYSTEM** holds what the signed metadata names: at most two deployments
  (descriptors, signatures and content-addressed objects), the core sets,
  driver extensions, the owner's certificates and a staged factory reset. It
  is mounted read-only and made writable only inside a `mica-deploy`
  transaction.
- **DATA** holds everything the device writes and is the only partition that
  grows: the factory image's DATA is small (256 MiB on most boards) and, on a
  disk, grows to the end of it at the first boot. On ext4 it carries project quotas:
  `mica` and `srv` (project 100), the disposable `cache`, `tmp` and `var`
  (project 101, an eighth of DATA, 32 to 256 MiB), and `containers`
  (project 102).

### 6.2 The write map

The root is never written. What a running device can write:

| Path | Backing | Options |
|---|---|---|
| `/`, `/usr`, `/etc` | the root's and the core components' squashfs on dm-verity | `ro,nodev` |
| `/mnt/data` | DATA | `rw,noatime`, project quotas where on |
| `/mica`, `/mica/containers`, `/srv`, `/var` | binds of DATA's `mica/`, `containers/`, `srv/`, `var/` | `nosuid,nodev`, private |
| `/var/lib/mica`, `/root`, `/home` | binds of DATA's `state/mica`, `/mica/root`, `/mica/home` | `nosuid,nodev` |
| `/etc/hostname`, `/usr/local/lib/systemd/system`, `/usr/local/etc`, the network daemons' `/etc` directories | binds of DATA's `state/` | bind |
| `/run`, `/dev/shm` | tmpfs | `nosuid,nodev` |

Configuration lives in `/mica/config` (one JSON document per concern, written
by micad) and on STATE (`/var/lib/mica`, what the device mints: identity,
credentials, the settings file, each service's rendered configuration).

### 6.3 The user's own disks and external media

- **A user mounts their own disks** in the places that are theirs: `/srv` and
  below, `/var/mnt/<name>`, `/home/<user>`, and exactly at a container
  engine's root (`/mica/containers/storage` for Podman,
  `/mica/containers/docker` for Docker). They declare it with a `.mount`,
  `.automount` or `.swap` unit on systemd, or a line of
  `/usr/local/etc/fstab` on OpenRC; Base refuses any other target. An engine
  whose root is declared on a disk does not start without it, so a missing
  disk fails the engine instead of filling DATA. No reset crosses into a mount.
- **External media** (USB mass storage, SD cards) are listed by micad, mounted
  read-only (`ro,nosuid,nodev,noexec`) under `/run/mica/media/<id>` when they
  are clean and of a supported file system (vfat, exFAT, ext2/3/4), and can be
  unmounted and ejected from the console. An update archive on a stick is
  imported from there. A device whose kernel has no host for them (`ssd202d`)
  reports media as unsupported.

[Storage](operate/storage.md) is the operator's view;
`mica-core:docs/mica-core.md` 6.1 and `mica-system-base:docs/floor-and-options.md`
(*The user's own mounts*) are the contracts.

## 7. The base and the management plane

A device runs in two layers, and the second is optional.

- **The base** is the signed root: the init, the mounts, the accounts, the
  hostname, the network and DNS, time, SSH, the log, the feature services the
  product chose (Wi-Fi, the access point, Bluetooth, MQTT, a container
  engine), the health gate and `mica-deploy`. Every service reads its
  configuration from its own file on DATA and starts from it at boot. A device
  with the base alone boots, joins its network, takes SSH logins by key,
  confirms its boot, updates by hand, from an archive or on a daily timer, and
  resets to factory.
- **micad** is the management add-on (the product feature `micad`), with apid
  and the console. It adds the settings tree and its API, the console, update
  policy (cadence, maintenance windows, the reboot gate), provisioning and the
  claim, Wi-Fi and the access point, container projects and the user's
  services, LAN discovery and the transient root password.

The contract between them is the files on DATA. micad writes a service's file,
then restarts or stops the service; the base never reads the settings tree, and
removing micad leaves every service as micad last configured it. A feature
service micad switches on is recorded in `/var/lib/mica/units/enabled`, which
the base's `mica-units` starts at boot, because enablement on the read-only
root lasts only until the next boot. Without micad an operator writes the same
files and uses `mica-units` ([without micad](operate/without-micad.md)).

| Service | Its file on DATA | Started at boot by |
|---|---|---|
| Network (systemd) | `/var/lib/mica/network/networkd`, linked from `/run/systemd/network` | the init |
| Network (OpenRC) | `/var/lib/mica/network/interfaces`, for BusyBox ifupdown | the init |
| DNS | `/var/lib/mica/dns/` (resolved's drop-ins, the static hosts records, the global servers on OpenRC) | the init |
| Time | `/var/lib/mica/time/` (timesyncd, or BusyBox `ntpd` on OpenRC) | the init |
| Log | `/var/lib/mica/log/log.env` (persistence, size, a remote collector) | the init |
| SSH | `/var/lib/mica/ssh/sshd.env` | the init, as last configured, else as the product's `SSH=` says |
| Wi-Fi station and access point | `/var/lib/mica/wifi/`, the STATE binds of `/etc/wpa_supplicant` and `/etc/hostapd` | `mica-units` |
| MQTT broker and bridge | `/var/lib/mica/mqtt/` | `mica-units` |
| Container engine | the engine's state under `/mica/containers` | `mica-units` |
| The user's services | `/usr/local/lib/systemd/system` or `/usr/local/etc` (DATA state) | the init |
| Updates without micad | `/mica/config/updates.json` | `mica-update.timer` (systemd) or `mica-update` (OpenRC), daily, `policy: auto` only |

### 7.1 systemd and OpenRC products

Each product installs exactly one init; every package ships the start-up
files of its own services for both.

| | systemd | OpenRC |
|---|---|---|
| Devices | udev | BusyBox `mdev` |
| Network | networkd and resolved | BusyBox ifupdown and `udhcpc` (`mica-udhcpc`) |
| Time | timesyncd | BusyBox `ntpd` |
| Log | journald, `systemd-netlogd` for forwarding | BusyBox `syslogd`, `logread` |
| User mounts | `.mount`/`.automount`/`.swap` units | `/usr/local/etc/fstab`, `mica-fstab` |
| Shutdown | the runkit's exit ramdisk | `openrc-init`; no exit ramdisk |
| Products today | every other product | `mini-x64.basic`, `qemu-armhf.basic`, `ssd202d.basic`, `uefi-x64.openrc-full` |

A 32-bit board runs an OpenRC root: the exit ramdisk exists on x86-64 and
aarch64 only.

### 7.2 micad, apid and the console

```
   browser / automation ─HTTP(S)─▶ apid ◀─ /run/mica/apid.sock ─ root on the device
                                    │
                         com.mica.micad1 (system bus, root only)
                                    ▼
   micad: settings tree (/mica/config, STATE), reconcilers, observers,
          provisioning, updates (via mica-deploy), resets, LAN discovery
                                    │ writes files, starts/stops services
                                    ▼
   the base's services: network, DNS, time, log, SSH, Wi-Fi, AP, Bluetooth,
   MQTT, the container engine, the user's units
```

- **micad** (`micad daemon`, one instance, no network listener) loads the
  settings, applies a staged reset, imports a provisioning document, mints
  first-boot identity and credentials, runs one reconciler per subtree, keeps
  the live state and observers, and serves `com.mica.micad` on the system bus.
  It answers mDNS (`<hostname>.local`, `_mica._tcp`, the console) and SSDP
  itself, each switchable, and never announces SSH.
- **apid** (`mica-apid`, the same executable) serves the API and the console as
  `access.web.mode` says: `network` (default: plain HTTP on 8080, or HTTPS on
  8443 once enabled, plus the local socket), `local` (the local socket alone)
  or `off`. Every read and change goes through micad. Browsers use an argon2id
  password and a session cookie, automation bearer tokens; failed logins back
  off persistently, and security-relevant actions go to an audit ring.
- **The console** (`mica-apid-ui`) is a client of the API, served at `/_ui/`;
  an operator may upload and activate a console bundle of their own.
- **On the device**, root runs `micad` subcommands over the bus: `micad update`
  (also `mica-update`), `micad ctr` (also `mica-ctr`), `micad unit`, `micad web`,
  `micad mdns`, `micad ssdp`, `micad factory-reset`, `micad diag` and
  `micad device-code`.

The settings, reconcilers and bus are `mica-core:docs/mica-core.md` 3; the API
is section 4 and [the API](operate/api.md).

### 7.3 Workloads

A device runs the user's software in two ways, both kept on DATA and both
surviving every update:

- **The user's own services**: a systemd unit or an OpenRC script with its
  binaries on DATA (in `/srv`, say), installed with Base's `mica-unit` or
  declared in micad's `services.units`, running as a service account of its
  own when it wants one.
- **Containers**, in a product with the `containers` feature. On Podman,
  Compose projects are declared to micad and run by `mica-containerd`; on
  Docker, containers are made on the device with `docker` and `docker compose`
  and micad only switches dockerd on and off. Either is off until switched on
  ([containers](integrate/containers.md)).

Application data reaches MQTT only through `mica-mqttd`, from services enrolled
by exact name on the bus; configuration, credentials and updates never become
MQTT items ([the bus](integrate/bus.md)).

## 8. Updates, rollback and resets

- **The catalog** is unsigned and read from an update root,
  `https://res.micaos.dev/update/` by default: `v1/manifest.json` names each
  product's current release and each channel's current set; a release's
  document names its signed descriptor and objects. Trust comes from the signed
  descriptor and set: a device takes only its own board, architecture and
  product, only a generation above the one it runs, and checks every byte.
- **micad's policy** decides when: the check cadence and time of day, the
  maintenance windows (UTC, by weekday), metered or offline links, the fetch
  budget and the reboot gate. Without micad, `mica-deploy update` runs by hand
  and the daily timer runs it under `policy: auto`, never rebooting.
- **Offline**, an `MICAUPD1` archive (a system, a set or a driver extension) is
  uploaded through the console or imported from a USB stick.
- **Installation is a durable file transaction**, proven by a fault suite that
  interrupts it at every IO. The new deployment, set or pair boots on trial and
  is confirmed by the health gate; a failed trial falls back by itself.
- **Rollback** to the retained deployment is an operator action; the API binds
  it to the target the caller confirmed, and the next boot reports whether the
  booted deployment is that target (`lastRollback`).
- **Delta transfer**: `fetch` first assembles a missing object from chunks the
  device already holds, by the object's transfer index, and fetches only the
  missing chunks; nothing in that path is trusted, and any failure falls back
  to the whole object.
- **Driver extensions** are out-of-tree modules and firmware for exactly one
  kernel, mapped only after the owner keyring is sealed; a kernel update waits
  for a build of each installed extension, or for the owner to drop it.

| Reset | Erases | Keeps |
|---|---|---|
| `configuration` | `/mica/config` (the settings, the SSH keys among them, return to the product's defaults) and the console's HTTPS identity | identity, the claim, the administrator password and API tokens, `/srv`, data |
| `application-data` | `/mica/volumes`, the container projects and engine storage on DATA, the user's services and service accounts | settings, identity, credentials, `/srv` |
| factory reset | everything on DATA: settings, the claim, tokens, keys, SSH host keys, machine-id, containers, `/srv`, `/mica`, logs; DATA is formatted again | the installed software (the running deployment and its core set), the device code |

No tier opens `/srv` or crosses into a mount. The factory reset asks for the
administrator password, is refused on an unclaimed device, during an update or trial and on an encrypted DATA, and
brings the device back unclaimed on its factory access point. Credential
recovery is gated on a physical-presence action no current board declares.
[Updates](operate/updates.md) and [recovery](operate/recovery.md) are the
operator's guides.

## 9. Trust

| What | Signed with | Checked by |
|---|---|---|
| UKI or FIT | the boot key | firmware with Secure Boot, or U-Boot with the key in its control device tree (not on `bootTrust: none` boards) |
| Root, support image, core components | the content key, as PKCS#7 over each dm-verity root hash | the kernel, against its builtin keyring, when it maps the image |
| Deployment, set and firmware metadata | the release key (Ed25519, canonical JSON) | `mica-deploy` and the runkit, against keys in the signed kernel |
| Driver extensions | the vendor's or the owner's key, chained to the builtin keyring or an owner certificate | the kernel, once the runkit has sealed the owner keyring |

- **Nothing secret is in an image**: identity, credentials and the SSH host key
  are minted on the device at first boot.
- **The owner keyring** (`.mica_owner`) holds the certificates the owner
  enrolled; the runkit maps the system's images while only the builtin keys
  are trusted, then adds the owner's certificates and seals the keyring, so an
  owner key can sign an extension and never a root or core component.
- **DATA encryption** is available groundwork and off on every product: a
  product may have the runkit open DATA as LUKS2, unlocked by a TPM2 key
  sealed to PCR 7 and 15, with a recovery passphrase. No released product
  turns it on.

[Release signing](security/signing.md) and the [security model](security/model.md)
carry the detail and the evidence limits.

## 10. The resource service

`mica-build`'s release run posts every product and core release to `mica-res`,
which files the bytes under `https://dl.res.micaos.dev/<namespace>/...` (the
`mica` namespace is immutable; test images go to the `test` namespace) and
feeds the device catalog at `https://res.micaos.dev/update/v1/manifest.json`.
Beside every object a producer publishes its **transfer index**
(`objects/<sha256>.index`, `MICAIDX1`); res answers `chunks/<digest>` as a
checked range of the object that holds it, so no chunk is stored twice. The
website's download pages read the same service
(`mica-res:docs/spec/release-publishing.md`).

## 11. Boards

| Board | Arch | Boot | Storage | Kernel tree (`mica-linux`) |
|---|---|---|---|---|
| `uefi-x64` | amd64 | systemd-boot, signed UKI | GPT | `mica/general`, stable 6.12 |
| `uefi-arm64` | arm64 | systemd-boot, signed UKI | GPT | `mica/general` |
| `mini-x64` | amd64 | systemd-boot, signed UKI | GPT, 128 MB of flash | `mica/general` |
| `cx3576` | arm64 | U-Boot, signed FIT | GPT on eMMC | `mica/cx3576`, Rockchip 6.1 with stable merges |
| `s905x5m` | arm64 | U-Boot, signed FIT | GPT on eMMC or SD | `mica/s905x5m`, Hardkernel 6.12 with stable merges |
| `qemu-armhf` | armhf | U-Boot, FIT, `bootTrust: none` | UBI on NAND | `mica/qemu-armhf` |
| `ssd202d` | armhf | U-Boot, FIT, `bootTrust: none` | UBI on SPI NAND | `mica/ssd202d`; not a release target |

A board produces artifacts and the product build consumes them; neither
reaches into the other's build. A kernel configuration satisfies the shared
floor and the kernel features the board names
(`mica-build:boards/README.md`). Build, acceptance and support tier per board
are kept in one table: [support tiers](hardware/README.md#current-boards).

## 12. Where to read next

| Question | Document |
|---|---|
| Which products exist and what each carries? | [overview](start/overview.md), [download](start/download.md) |
| What runs without micad, and from which file? | section 7, [without micad](operate/without-micad.md) |
| What does the settings tree hold? | [configuration](operate/configuration.md), `mica-core:docs/mica-core.md` 3.3 |
| What does the API serve? | [the API](operate/api.md), [API reference](reference/api.md) |
| Where do writes go, and where may I mount a disk? | [storage](operate/storage.md), [read-only root](reference/ro-root.md) |
| How is an update installed, confirmed or rolled back? | [updates](operate/updates.md), [update reference](reference/updates.md) |
| How is a release signed, and by whom? | [release signing](security/signing.md) |
| How does a device get its first credentials? | [first run](start/first-run.md), [provisioning](integrate/provisioning.md) |
| How do I run my own software? | [applications](integrate/applications.md), [containers](integrate/containers.md) |
