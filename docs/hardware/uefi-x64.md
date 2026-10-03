# uefi-x64: generic amd64 UEFI machines

`uefi-x64` is not a board but a **generic system**: one image for amd64
machines whose firmware is UEFI, named for the firmware class that starts it
rather than for a machine. It is also this project's baseline, booted
automatically in every release run of its products.

Snapshot written 2026-09-29; status is owned by the
[tiers table](support-tiers.md#current-boards).

**It has no board dossier.** `docs/hardware/` holds dossiers for `cx3576`,
`s905x5m` and `uefi-arm64`, not for this one. What follows is read from
`mica-build:boards/uefi-x64/board.env`, its `evidence.json`, its kernel
configuration, and the [flashing](../start/flashing.md) page.

## At a glance

| | |
|---|---|
| Architecture | `amd64` |
| Boot chain | UEFI firmware → signed `EFI/BOOT/BOOTX64.EFI` (systemd-boot) → counted entry → signed UKI → authenticated native init → SYSTEM → signed verity root/support → systemd |
| Firmware form | `efi` — the boot loader lives inside the ESP |
| Partitions | ESP / SYSTEM / DATA |
| Release target | yes |
| Tier | bring-up (QEMU baseline) |
| Boot assurance | I1 |

## Hardware and feature state

| Feature | State | Note |
|---|---|---|
| Containers (Podman) | ships in `uefi-x64.full` | `BOARD_FEATURES="containers"`; `uefi-x64.basic` leaves the engine out |
| USB storage | driver built in, unverified on hardware | XHCI and EHCI with `USB_STORAGE`; `USB_UAS` is off, so a UAS-only enclosure falls back to bulk-only transport or is not driven |
| SATA | driver built in, unverified on hardware | AHCI and `ATA_PIIX` |
| NVMe | driver built in, unverified on hardware | — |
| virtio-blk / virtio-scsi | verified under QEMU | this is the path the automatic boot takes |
| MMC / SD card readers | **not supported** | `CONFIG_MMC` is off entirely; a USB card reader is ordinary USB mass storage and is driven |
| Wi-Fi / Bluetooth | none | no radio in `BOARD_FEATURES`; the image ships no bluez, wpasupplicant or hostapd |
| Status LED, CAN, USB gadget | none | a generic machine declares none of them |
| Physical recovery action | none | `BOARD_RECOVERY_ACTIONS=""`, so credential recovery and full-factory reset are refused on this board |

Those storage drivers have to be built in: a dm-verity root has no initramfs,
so nothing can load before the root is mounted.

> status: board-dependent — evidence: `mica-build:boards/uefi-x64/board.env`, `mica-build:boards/uefi-x64/kernel/config`, `mica-build:boards/uefi-x64/evidence.json`

## Partition layout

| Partition | Role | Start | Size |
|---|---|---|---|
| `esp` | FAT, label `MICAESP` | 1 MiB | 512 MiB |
| `system` | ext4 | 513 MiB | 1024 MiB |
| `data` | ext4 | 1537 MiB | 256 MiB, grown to the medium on first boot |

SYSTEM is exactly 1 GiB and holds both deployments at once. The ESP carries
`EFI/BOOT/BOOTX64.EFI` and `loader/loader.conf`. The authoritative geometry is
`mica-build:boards/uefi-x64/board.env`.

## Console

Serial, `console=ttyS0,115200n8`; `net.ifnames=0`, so interfaces are addressed
as `eth0`.

## Obtaining an image

The products are `uefi-x64.basic` (the default) and `uefi-x64.full` (with
containers), each released as `uefi-x64.<variant>.<YYYYMMDD-HHMM>` with the
image `mica-uefi-x64.<variant>-<YYYYMMDD-HHMM>.img.gz`. Verification is in
[download](../start/download.md).

## Flashing

**Under QEMU** — the only path anyone here has executed: enrol the release's
boot certificate into an OVMF variable store with `virt-fw-vars`, then start
the decompressed image with `qemu-system-x86_64 -machine q35`. The command
lines are in [flashing](../start/flashing.md) section 4.

**Onto a physical machine (unverified)**: write the whole device, never a
partition, then `sync` and read back to compare. No physical write has been
performed by this project; the commands and their warnings are in
[flashing](../start/flashing.md) section 3.

**Secure Boot (unverified)**: the machine must carry the release's boot
certificate in its firmware `db`, or Secure Boot must be off. Turning it off
does not weaken the root — the signed kernel command line still carries
`dm_verity.require_signatures=1`.

> status: unsupported

## First boot

DATA grows to the medium; the factory image already carries two signed
deployments (generations g-1 and g), so an update never leaves the device
without a bootable fallback; the loader carries one entry per deployment with
three attempts, blessed once the health gate passes. See
[flashing](../start/flashing.md) section 7 and [first run](../start/first-run.md).

## Updates

Upgrade with an update archive, not by reflashing — a reflash erases DATA.
This board publishes `full`, `root` and `kernel` archives; which one applies is
[update packages](../operate/update-packages.md), and the A/B switch, health
confirmation and rollback are [update and rollback](../operate/update-rollback.md).
The full update, fault and fallback acceptance runs under QEMU.

## Recovery

- Available: read-only diagnosis, guarded manual rollback, configuration
  reset, application-data reset, whole-disk reflash.
- **Unavailable**: credential recovery and full-factory reset. Both are gated
  by a physical-presence assertion, and this board declares no physical
  recovery action, so every such request is refused (`403`,
  `presence_required`).
- The floor is a whole-disk reflash: boot other media and rewrite the disk. It
  costs every partition **and the device identity**.
- There is no secure erase. A device leaving your control means destroying the
  medium.

The full ladder and the cost of each step is [recovery](../operate/recovery.md).

## Known limitations

- All evidence is emulator evidence, not field evidence.
- No physical amd64 machine has been verified: USB, SATA and NVMe are "the
  kernel carries the driver" and nothing more.
- No dossier exists, so there is no qualification matrix for this board; its
  results live in the tiers table and in the acceptance suites.
- No MMC driver: a machine that boots from a platform MMC controller is a
  hardware board of its own, not this image.

## Verification record

| Item | Result | Note |
|---|---|---|
| QEMU lifecycle: API, power actions, reboot, runtime, updates, reset | pass | the acceptance column of the tiers table |
| Automatic boot in each release run | yes | amd64 products boot one runtime stage of the UEFI lifecycle |
| Physical cold boot, write, recovery | not tested | no hardware |

> status: board-dependent — evidence: `docs/hardware/support-tiers.md`, `mica-build:tests/suites/lifecycle-uefi/boot.sh`, `mica-build:README.md`
