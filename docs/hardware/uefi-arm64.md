# uefi-arm64: generic arm64 UEFI machines

`uefi-arm64` is the arm64 **generic system**: one image for machines whose
firmware is UEFI with ACPI. It has been a release target since 2026-09-16 and
carries a hardware driver set beyond virtio — while all of its evidence is
still the QEMU aarch64 `virt` machine. **Carrying a driver is not evidence that
a machine boots.**

Snapshot written 2026-09-20, from the dossier
[`docs/boards/uefi-arm64.md`](../boards/uefi-arm64.md) and
`mica-boards:boards/uefi-arm64/`; status is owned by the
[tiers table](../boards/support-tiers.md#current-boards).

## At a glance

| | |
|---|---|
| Architecture | `arm64` |
| Boot chain | UEFI firmware with an enrolled development anchor → signed `EFI/BOOT/BOOTAA64.EFI` → counted entry → signed UKI → authenticated native init → SYSTEM → signed verity root/support → systemd |
| Firmware form | `efi` — the boot loader lives inside the ESP |
| Partitions | ESP / SYSTEM / DATA |
| Kernel | mainline stable, pinned to the same tag as `uefi-x64` (currently `v6.12.107`), so a first-boot failure is never ambiguous between the port and the kernel version |
| Release target | yes, since 2026-09-16 |
| Tier | bring-up (QEMU reference) |
| Boot assurance | I1 |

There are **no vendor blobs** in the boot chain, because there is no vendor —
one of the reasons this board exists.

## Hardware and feature state

| Feature | State | Note |
|---|---|---|
| Containers (Podman) | ships | `BOARD_FEATURES="containers"` |
| virtio-blk / virtio-net | verified under QEMU | all evidence comes from this path |
| SATA (AHCI) | built in, **carried not qualified** | never exercised on a physical machine |
| NVMe | built in, **carried not qualified** | — |
| USB storage (xHCI / EHCI) | built in, **carried not qualified** | — |
| Common NICs (e1000, igb, igc, ixgbe, r8169, tg3, mlx5, aqtion) | carried as **modules**, not qualified | networking is not on the path to the root, so a module loads from the signed support image |
| MMC / SD / eMMC | **deliberately absent** | no MMC at all: a machine that boots from a platform MMC controller is a hardware board of its own, not this image |
| RTC | built in (PL031, EFI) | available under QEMU |
| Wi-Fi / Bluetooth | none | no bluez, wpasupplicant or hostapd in the image |
| Status LED, CAN, USB gadget, hardware init | none | `BOARD_HWINIT_CONFS=""`, `BOARD_FIRMWARE_FILES=""` |
| Physical recovery action | none | `BOARD_RECOVERY_ACTIONS=""`, so credential recovery and full-factory reset are refused on this board |

The driver set is enforced rather than hoped for:
`kernel/config/uefi-arm64.required` holds 122 symbols and the build fails if
the resolved configuration drops one. The measured cost is recorded too — 232
kernel modules instead of 71, a 24.5 MB `Image`, and a CI kernel job that goes
from 330 s to 718 s.

> status: board-dependent — evidence: `docs/boards/uefi-arm64.md`, `mica-boards:boards/uefi-arm64/board.env`, `mica-boards:boards/uefi-arm64/kernel/config`

## Partition layout

| Partition | Role | Start | Size |
|---|---|---|---|
| `esp` | FAT, label `MICAESP` | 1 MiB | 512 MiB |
| `system` | ext4 | 513 MiB | 1024 MiB |
| `data` | ext4 | 1537 MiB | 256 MiB, grown to the medium on first boot |

Root and support components are immutable files on SYSTEM and the UKIs live on
the ESP; DATA alone grows on first boot, and `/var` with its skeleton stays
read-only.

## Console

**One console**: the PL011 UART, `console=ttyAMA0,115200n8`. There is
deliberately no `tty0` — the aarch64 `virt` machine has no VGA and no
framebuffer, so `console=tty0` would name a console with no device behind it.

## Obtaining an image

The products are `uefi-arm64-dev` and `uefi-arm64-prod`.

**Avoid `20260916-0845`, `20260916-1653` and `20260919-2103`**: those images
power down at PID 1 after the board rename, because the pinned client did not
follow. Take `20260919-2356` or newer.

## Flashing

**Under QEMU** — the only path with evidence. Write the release's boot
certificate into an AAVMF variable store with `virt-fw-vars`, then:

```sh
qemu-system-aarch64 -machine virt -cpu max -m 1024 -smp 2 -nographic -no-reboot \
  -device i6300esb -watchdog-action reset \
  -drive if=pflash,format=raw,unit=0,readonly=on,file=/usr/share/AAVMF/AAVMF_CODE.secboot.fd \
  -drive if=pflash,format=raw,unit=1,file=vars.fd \
  -drive if=none,id=disk0,format=raw,file=disk.img \
  -device virtio-blk-pci,drive=disk0,bootindex=0
```

The guest has to provide a PL011 console and only one, the i6300esb watchdog,
an RTC through PL031 or EFI, and an enabled ACPI button so that a host's
graceful shutdown request reaches the guest. The whole acceptance run is one
target, `make lifecycle-uefi PRODUCT=uefi-arm64-dev`; importing an offline
update over 9p is in [flashing](../user/flashing.md) section 4.

**Onto a physical arm64 machine (unverified)**: as for `uefi-x64` — a
whole-device write, and the machine must trust the release's boot certificate.
No physical arm64 machine has been verified.

> status: unsupported

## First boot

As on `uefi-x64`: DATA grows, the image ships two deployments, entries are
counted three attempts deep, and the health gate confirms. See
[flashing](../user/flashing.md) section 7.

## Updates

`full`, `root` and `kernel` archives are published. Root-only, kernel-only and
combined updates have run under QEMU, including three failed health trials with
the retained fallback taken and firmware and identity unchanged. See
[update packages](../user/update-packages.md) and
[update and rollback](../user/update-rollback.md).

## Recovery

- Available: read-only diagnosis, manual rollback, configuration reset,
  application-data reset, rewriting the disk image.
- **Unavailable**: credential recovery and full-factory reset, for want of a
  physical-presence assertion.
- Recovery on this board is rewriting the image on the host. A host that can
  write that file has already replaced the device, so there is no in-band
  recovery to protect.

See [recovery](../user/recovery.md).

## Known limitations

- arm64 guests run under TCG on the current amd64 test host, so timings
  describe that executor and not a physical arm64 system.
- The generic hardware drivers are **carried, not qualified**: no AHCI, NVMe,
  USB or NIC above has been exercised on a physical machine.
- The gate's boot step is amd64-only, so this board carries **no automatic
  boot**; its QEMU evidence predates the 2026-09-16 rename.
- Development Secure Boot enrolment lives in disposable AAVMF variables and
  qualifies no other platform's firmware or debug policy.

## Verification record

Binding: QEMU aarch64 `virt`, `-cpu max`, virtio-blk, the lab's pinned AAVMF
firmware, and a freshly assembled three-partition image.

| Item | Result | Date |
|---|---|---|
| Factory layout and root composition | pass | 2026-09-09 |
| Signed boot, runtime and clean shutdown | pass | 2026-09-09 |
| Full apid API suite | pass | 2026-09-09 |
| Root-only, kernel-only and combined update | pass | 2026-09-09 |
| Metadata refusal and exhausted attempts | pass | 2026-09-09 |
| Network API | pass | 2026-09-09 |
| Physical power-cut | N/A | emulated storage |
| Radios and fieldbus | N/A | this board declares none |
| Physical recovery action | N/A | no physical presence assertion |

> status: board-dependent — evidence: `docs/boards/uefi-arm64.md`, `mica-boards:boards/uefi-arm64/evidence.json`, `docs/design/build-harness.md`
