# mini-x64: small amd64 UEFI machines with 128 MB of flash

`mini-x64` is a **generic system** like [`uefi-x64`](uefi-x64.md) — one image
for amd64 machines whose firmware is UEFI — cut down to run from 128 MB of
flash: its own `tinyconfig`-based kernel, an xz root, and one product,
`mini-x64.basic`, which runs OpenRC with the management plane, SSH and
containers.

Snapshot written 2026-10-01; status is owned by the
[tiers table](../boards/support-tiers.md#current-boards).

**It has no board dossier.** What follows is read from
`mica-build:boards/mini-x64/board.env`, its `layout.tsv`, `evidence.json` and
kernel configuration, and the [flashing](../user/flashing.md) page.

## At a glance

| | |
|---|---|
| Architecture | `amd64` |
| Boot chain | UEFI firmware → signed `EFI/BOOT/BOOTX64.EFI` (systemd-boot) → counted entry → signed UKI → authenticated native init → SYSTEM → signed verity root/support → OpenRC |
| Firmware form | `efi` — the boot loader lives inside the ESP |
| Partitions | ESP / SYSTEM / DATA |
| Size budget | 130 MB (`BOARD_SIZE_BUDGET_MB`); the root is xz squashfs |
| Release target | yes |
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
[download](../user/download.md).

## Flashing

**Under QEMU** — as for `uefi-x64`: enrol the release's boot certificate into an
OVMF variable store with `virt-fw-vars`, then start the decompressed image with
`qemu-system-x86_64 -machine q35`. The command lines are in
[flashing](../user/flashing.md) section 4.

**Onto a physical machine (unverified)**: write the whole device, never a
partition, then `sync` and read back to compare
([flashing](../user/flashing.md) section 3).

> status: unsupported

## Updates and recovery

As for [`uefi-x64`](uefi-x64.md#updates): `full`, `root` and `kernel` update
archives, the A/B switch with health confirmation and rollback, and a
whole-disk reflash as the floor of recovery. Under OpenRC, micad drives the
services each package ships for that init
(`mica-core:docs/mica-core.md` section 3.8).

## Known limitations

- All evidence is emulator evidence, not field evidence.
- No USB at all: a machine that has to boot or be installed from USB media is
  not this image.
- No web console and no MQTT: `mini-x64.basic` carries the management plane,
  SSH and containers only.

## Verification record

| Item | Result | Note |
|---|---|---|
| QEMU runtime, component updates, trial fallback, fault recovery | pass | `evidence.json` |
| Automatic boot in each release run | yes | amd64 products boot one runtime stage of the UEFI lifecycle |
| Physical cold boot, write, recovery | not tested | no hardware |

> status: board-dependent — evidence: `docs/boards/support-tiers.md`, `mica-build:boards/mini-x64/evidence.json`, `mica-build:tests/suites/lifecycle-uefi/boot.sh`
