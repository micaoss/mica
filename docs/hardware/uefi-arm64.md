# uefi-arm64: generic arm64 UEFI machines

`uefi-arm64` is the arm64 **generic system**: one image for machines whose
firmware is UEFI with ACPI. It
carries a hardware driver set beyond virtio — while all of its evidence is
still the QEMU aarch64 `virt` machine. **Carrying a driver is not evidence that
a machine boots.** Status is owned by the
[status table](README.md#current-boards).

## At a glance

| | |
|---|---|
| Architecture | `arm64` |
| Boot chain | UEFI firmware with an enrolled development anchor → signed `EFI/BOOT/BOOTAA64.EFI` → counted entry → signed UKI → authenticated native init → SYSTEM → signed verity root/support → systemd |
| Firmware form | `efi` — the boot loader lives inside the ESP |
| Partitions | ESP / SYSTEM / DATA |
| Kernel | mainline stable, pinned to the same tag as `uefi-x64`, so a first-boot failure is never ambiguous between the port and the kernel version |
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

> status: board-dependent — evidence: `mica-build:boards/uefi-arm64/evidence.json`, `mica-build:boards/uefi-arm64/board.env`, `mica-build:boards/uefi-arm64/kernel/config`

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

The products are `uefi-arm64.basic` (the default) and `uefi-arm64.full`
(with containers), each released as `uefi-arm64.<variant>.<YYYYMMDD-HHMM>` with
the image `mica-uefi-arm64.<variant>-<YYYYMMDD-HHMM>.img.gz`.

## Flashing

**Under QEMU.** Decompress the image to `disk.img` and start it:

```sh
cp /usr/share/AAVMF/AAVMF_VARS.fd vars.fd
qemu-system-aarch64 -machine virt -cpu max -m 1024 -smp 2 -nographic -no-reboot \
  -device i6300esb -watchdog-action reset \
  -netdev user,id=net0,hostfwd=tcp:127.0.0.1:8080-:8080 -device virtio-net-pci,netdev=net0 \
  -drive if=pflash,format=raw,unit=0,readonly=on,file=/usr/share/AAVMF/AAVMF_CODE.secboot.fd \
  -drive if=pflash,format=raw,unit=1,file=vars.fd \
  -drive if=none,id=disk0,format=raw,file=disk.img \
  -device virtio-blk-pci,drive=disk0,bootindex=0
```

The guest has a PL011 console and only one, needs the i6300esb watchdog, and
takes its RTC from PL031 or EFI. On an amd64 host every instruction is
emulated, so the boot takes minutes. The acceptance suite runs this line with
the release's certificate enrolled and Secure Boot on; with the plain variable
store, as here, it has not been run, because no `uefi-arm64` product has a
release yet. Getting the image, Secure Boot on and troubleshooting are in
[flashing](../start/flashing.md) section 4.

**Onto a physical arm64 machine (unverified).** As for `uefi-x64`: a
whole-device write, on a machine whose firmware is UEFI with ACPI and either
trusts the release's boot certificate or has Secure Boot off. No physical
arm64 machine has been verified.

> status: unsupported

## First boot

As on [`uefi-x64`](uefi-x64.md#first-boot): the early init verifies the
deployment, DATA grows, the health gate confirms, and the device serves the
web console and the API on port 8080, unclaimed until somebody sets the
administrator password ([first run](../start/first-run.md)).

## Updates

`full`, `root` and `kernel` archives are published. Root-only, kernel-only and
combined updates have run under QEMU, including three failed health trials with
the retained fallback taken and firmware and identity unchanged. See
[updates and rollback](../operate/updates.md).

## Recovery

- Available: read-only diagnosis, manual rollback, configuration reset,
  application-data reset, rewriting the disk image.
- **Unavailable**: credential recovery and full-factory reset, for want of a
  physical-presence assertion.
- Recovery on this board is rewriting the image on the host. A host that can
  write that file has already replaced the device, so there is no in-band
  recovery to protect.

See [recovery](../operate/recovery.md).

## Known limitations

- arm64 guests run under TCG on the current amd64 test host, so timings
  describe that executor and not a physical arm64 system.
- The generic hardware drivers are **carried, not qualified**: no AHCI, NVMe,
  USB or NIC above has been exercised on a physical machine.
- The gate's boot step is amd64-only, so this board carries **no automatic
  boot**.
- Development Secure Boot enrolment lives in disposable AAVMF variables and
  qualifies no other platform's firmware or debug policy.

## Qualification results

**Binding**: QEMU aarch64 `virt`, `-cpu max`, virtio-blk, the lab's pinned AAVMF
Secure Boot firmware and a freshly assembled three-partition image; no
physical machine.

**Owners**: the Mica OS project owns the port and its qualification. There is
no vendor, no BSP supplier and no integrator of record.

Emulator rows are evidence about the emulated platform, never a hardware pass.

| Row | Result | Date | Evidence / reason |
|---|---|---|---|
| Factory layout and root composition | pass | 2026-09-09 | QEMU `virt` lab run |
| Signed boot, runtime and clean shutdown | pass | 2026-09-09 | QEMU `virt` lab run: authenticated root and support, identity, service checks |
| Full API suite | pass | 2026-09-09 | QEMU `virt` lab run |
| Root-only, kernel-only and combined update | pass | 2026-09-09 | QEMU `virt` lab run: three failed health trials, the retained fallback taken, firmware and identity unchanged |
| Metadata refusal and exhausted attempts | pass | 2026-09-09 | QEMU `virt` lab run |
| Network API | pass | 2026-09-09 | QEMU `virt` lab run |
| Installation and first boot | not tested | — | no physical machine |
| Cold boot and warm boot | not tested | — | no physical machine |
| Power-cut during update | N/A | — | emulated storage; process interruption is separate evidence |
| Radios and fieldbus | N/A | — | the board declares none |
| Physical recovery action | N/A | — | no physical presence assertion |

> status: board-dependent — evidence: `mica-build:boards/uefi-arm64/evidence.json`, `mica-build:tests/suites/lifecycle-uefi/updates.sh`, `mica-build:README.md`
