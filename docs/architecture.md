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
| OS core | Debian trixie with systemd as PID 1, packed into a squashfs with a dm-verity hash tree over it | `rootfs/` |
| Management plane | `micad` — a settings tree, reconcilers that drive units, and a D-Bus surface | `mica-core:micad/`, `docs/design/micad.md` |
| API | `apid` — the HTTPS daemon; the dashboard is one client of the API it serves | `mica-core:apid/`, `docs/design/api.md` |
| Application data | `mica-mqttd` bridges only exact package-enrolled `com.mica.<class>[.<suffix>]` application item trees to MQTT; `com.mica.micad` is forbidden | `mica-core:mqttd/`, `mica-core:broker/`, `docs/design/bus.md` |
| A/B installer | Native durable file transactions with UEFI/FIT trial records | `mica-deploy`, `docs/design/uboot-ab-handshake.md` |
| Update trust | Signed deployment/catalog envelopes and kernel-enforced root/support signatures | `mica-deploy`, `docs/design/release-signing.md` |
| BSP artifacts | per-board buildkit Dockerfiles producing kernel, device tree and bootloader | `boards/`, `docs/boards/contract.md` |
| Workloads | podman plus the Quadlet systemd generator, off by default | `mica-podman`, `docs/design/containers.md` |

## 2. Component inventory (runtime)

```
                  settings tree (TOML, DATA namespaces)
                                  |
                     micad  --  com.mica.micad1, system bus
     _____________________________|_________________________
    |            |             |          |        |
  apid      reconcilers   Deployments    sshd    podman
  HTTPS     wifi, sshd,   InstallUpdate OpenSSH  Quadlet
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
  `mica-core:micad/src/reconciler/`. Its unit is `Type=dbus` (`mica-core:dist/micad.service`).
- **`apid`** terminates TLS, authenticates the operator, and reads and writes
  device state by calling micad over that bus; its TLS material, login-backoff
  counters and audit ring live under `/var/lib/mica/apid`
  (`mica-core:dist/apid.service`). The dashboard is one of its clients, and
  `mica-core:apid/openapi.json` is generated from the handlers.
- **Networking** is micad's `network`, `wifi.client` and `wifi.ap` subtrees,
  reconciled into systemd-networkd, wpa_supplicant and hostapd units. Wi-Fi
  is a pair of reconcilers, not a separate daemon (`docs/design/wifi.md`).
- **Interface kinds.** A `network` entry declares a **kind** — physical, `vlan`,
  `bridge` or `wireguard` — and the one optional block that belongs to it. The
  block is authoritative and the interface name is not:
  *"`eth0.100` is a convention, not a declaration"*
  (`mica-core:micad-settings/src/model.rs`). A physical entry renders
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
  (`mica-core:Cargo.toml`).
- **Containers** run through podman with the Quadlet generator. While the
  `container.enabled` switch is false — the default — `/etc/containers/systemd`
  is not mounted and no container unit exists (`docs/design/containers.md`).

## 3. Storage and boot

Current images contain ESP/SYSTEM/DATA on x64 and virt-arm64, or
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
2. **SSH** — OpenSSH, with micad rendering the only file that configures it.
   Shipped on both profiles, off by default on both; persistent access is by
   public key and a root password is the transient exception.
3. **Physical recovery** — a whole-disk reflash through the board's loader path
   (RockUSB on cx3576), below the OS and reachable when nothing else is.

Disablement is layered. One layer ships: the runtime switch, where
`enabled: false` stops and disables `ssh.service`, and every image seeds it
off. There is no image profile package or profile file
(`docs/decisions/2026-09-14-no-image-profile-packages.md`): development and
production images differ by the kernel command line parameter
`mica.profile=dev|prod`, carried only in signed boot configuration; no
difference is implemented yet (`docs/design/access.md` §5.3). The one-way
DATA/meta lockdown is designed, and marked not implemented
(`docs/design/access.md` §5.2).

## 6. Repository map

```
mica-build/
├── boards/        one board.env (and evidence.json) per board, derived from the
│                  pinned mica-kernel-<board> archive; the BSP, overlay and packaging
│                  live in mica-boards
├── boot/          mica-boot, a source pin: UKI/FIT tooling, initramfs, development keys;
│                  these tools move into this repository and the pin goes when
│                  mica-boot is split and retired (decision 2026-09-14)
├── build/         TypeScript: image assemblers, component and archive producers, toolset wrappers
├── build-env/     mica-build-env, a source pin: pinned builder images and the .deb helpers
├── deps/          sources/ (source pins: mica-boot, mica-build-env, mica-debian) and
│                  packages/ (one pin per imported package, from the release of its repository)
├── meta.example/  committed public factory defaults; private meta/ is git-ignored
├── rootfs/        the composer: debian/ (mica-debian, a source pin), packages/ (manifests
│                  and resolver), runtime/ (selection and composition), compose/ (the two
│                  composition Dockerfiles), scripts/ and build.sh
├── shared/        TypeScript shared by build/, verify/ and update-server/
├── tests/         shell and fixture suites over packages, boot paths and built images
├── tools/         QEMU and development helpers, and the pool readers (board-pool.sh,
│                  deploy-pool.sh, micad-pool.sh, podman-pool.sh)
├── update-server/ Bun service that serves signed catalogs, components and firmware
├── verify/        TypeScript: the board model and the checks an assembled image must pass
└── Makefile       top-level routing; `make help` lists every target
```

The assembly builds no package. Every archive in `_out/debs/<arch>/` is
imported at its pin from the release of the repository that owns it:
`mica-system-base` (the system policy, BusyBox, CA trust and the unsigned
systemd-boot loader), `mica-core` (micad, mica-apid, the MQTT services, the
SFTP server, mica-deploy and the lifecycle executable), `mica-podman` and
`mica-boards` (every board's kernel, firmware, board package and the radio
packages). Documentation and the
task and plan records live in `mica`.

The rootfs is **composed**: one APT transaction installs a resolved set of Mica OS
`.deb` packages out of the local pool at `_out/debs/<arch>/` onto a
digest-pinned Debian base, and one finalizer closes and packs the result
(`rootfs/compose/`, two files). What is in an image is a package list, and
what orders the configuration is `Depends` — adding a component is adding a
producer, not a stage. `docs/design/build.md` §1.1 has the whole model.

## 7. Boards

The current boards are `x64` and `virt-arm64` (UEFI, signed UKI) and `cx3576`
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
