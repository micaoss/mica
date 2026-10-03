# mini-x64: small amd64 UEFI machines with 128 MB of flash

`mini-x64` is a **generic system** like [`uefi-x64`](uefi-x64.md) — one image
for amd64 machines whose firmware is UEFI — cut down to run from 128 MB of
flash: its own `tinyconfig`-based kernel, an xz root, and one product,
`mini-x64.basic`, which runs OpenRC with the management plane, SSH and
containers. Status is owned by the [status table](README.md#current-boards).

## At a glance

| | |
|---|---|
| Architecture | `amd64` |
| Boot chain | UEFI firmware → signed `EFI/BOOT/BOOTX64.EFI` (systemd-boot) → counted entry → signed UKI → authenticated native init → SYSTEM → signed verity root/support → OpenRC |
| Firmware form | `efi` — the boot loader lives inside the ESP |
| Partitions | ESP / SYSTEM / DATA |
| Size budget | 130 MB (`BOARD_SIZE_BUDGET_MB`); the root is xz squashfs |
| Tier | bring-up (QEMU) |
| Boot assurance | I1 |

## Hardware and feature state

| Feature | State | Note |
|---|---|---|
| Containers (Podman) | ships | `BOARD_FEATURES="containers"`; `mini-x64.basic` carries the engine and `mica-containerd` on OpenRC |
| virtio-blk | verified under QEMU | the path the automatic boot takes |
| SATA (AHCI), NVMe | driver built in, unverified on hardware | — |
| SD / eMMC (SDHCI over PCI or ACPI) | driver built in, unverified on hardware | the small flash parts this board is for |
| USB | **not supported** | `CONFIG_USB_SUPPORT` is off |
| Network | virtio-net, Intel e1000 and e1000e | — |
| Display, Wi-Fi, Bluetooth, status LED, CAN, USB gadget | none | headless |
| Physical recovery action | none | credential recovery and full-factory reset are refused on this board |

> status: board-dependent — evidence: `mica-build:boards/mini-x64/board.env`, `mica-build:boards/mini-x64/kernel/config/mini-x64.fragment`, `mica-build:boards/mini-x64/evidence.json`

## Partition layout

| Partition | Role | Start | Size |
|---|---|---|---|
| `esp` | FAT | 1 MiB | 16 MiB |
| `system` | ext4 | 17 MiB | 98 MiB |
| `data` | ext4 | 115 MiB | 12 MiB, grown to the medium on first boot |

The authoritative geometry is `mica-build:boards/mini-x64/layout.tsv`.

## Console

Serial, `console=ttyS0,115200n8`; `net.ifnames=0`, so interfaces are addressed
as `eth0`.

## Obtaining an image

The product is `mini-x64.basic`, released as
`mini-x64.basic.<YYYYMMDD-HHMM>` with the image
`mica-mini-x64.basic-<YYYYMMDD-HHMM>.img.gz`. Verification is in
[download](../start/download.md).

## Flashing

**Under QEMU** — as for `uefi-x64`: enrol the release's boot certificate into an
OVMF variable store with `virt-fw-vars`, then start the decompressed image with
`qemu-system-x86_64 -machine q35`. The command lines are in
[flashing](../start/flashing.md) section 4.

**Onto a physical machine (unverified)**: write the whole device, never a
partition, then `sync` and read back to compare
([flashing](../start/flashing.md) section 3).

> status: unsupported

## First boot

As on [`uefi-x64`](uefi-x64.md#first-boot): DATA grows to the medium, the image
carries two signed deployments, and the health gate confirms the one that
booted. The root's init is OpenRC, and micad drives the services each package
ships for that init (`mica-core:docs/mica-core.md` section 3.8).

## Updates

`full`, `root` and `kernel` archives, and `core` for a core release, with the
A/B switch, health confirmation and rollback of every board. See
[updates and rollback](../operate/updates.md).

## Recovery

As for [`uefi-x64`](uefi-x64.md#recovery): read-only diagnosis, manual
rollback, configuration reset and application-data reset are available;
credential recovery and full-factory reset are refused, because the board
declares no physical recovery action; the floor is a whole-disk reflash, which
costs every partition and the device identity. See
[recovery](../operate/recovery.md).

## Known limitations

- All evidence is emulator evidence, not field evidence.
- No USB at all: a machine that has to boot or be installed from USB media is
  not this image.
- No web console and no MQTT: `mini-x64.basic` carries the management plane,
  SSH and containers only.

## Qualification results

**Binding**: QEMU `q35` with OVMF Secure Boot firmware and virtio-blk, over
`mini-x64.basic`; no physical machine.

**Owners**: the Mica OS project owns the port and its qualification. There is
no vendor and no integrator of record.

Emulator rows are evidence about the emulated platform, never a hardware pass.
Each release run of the product boots it once under QEMU.

| Row | Result | Date | Evidence / reason |
|---|---|---|---|
| QEMU runtime, component updates, trial fallback, fault recovery | pass | 2026-09-30 | the UEFI lifecycle suite over `mini-x64.basic`, `mica-build:tests/suites/lifecycle-uefi` |
| Installation and first boot | not tested | — | no physical machine |
| Cold boot and warm boot | not tested | — | no physical machine |
| A/B switch and update | not tested | — | no physical machine |
| Power-cut during update | not tested | — | no physical machine |
| Storage growth/health | not tested | — | no physical machine; flash endurance is unqualified |
| Recovery | not tested | — | no physical machine |
| Radios and fieldbus | N/A | — | the board declares none |

> status: board-dependent — evidence: `mica-build:boards/mini-x64/evidence.json`, `mica-build:tests/suites/lifecycle-uefi/boot.sh`, `mica-build:README.md`
