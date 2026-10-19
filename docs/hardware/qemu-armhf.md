# qemu-armhf: QEMU's 32-bit Arm virt machine with NOR flash

`qemu-armhf` is the 32-bit Arm and UBI reference of Mica OS: QEMU's `virt`
machine with a Cortex-A15, booted by U-Boot from NOR flash, its root on UBI.
There is no hardware behind it. Its one product, `qemu-armhf.basic`, runs
OpenRC with the management plane and SSH. Status is owned by the
[status table](README.md#current-boards).

## At a glance

| | |
|---|---|
| Architecture | `armhf` |
| Boot chain | U-Boot from the first NOR bank → FIT read from UBI (hashes checked, no signature) → kernel and initramfs → authenticated native init → SYSTEM → signed verity root/support → OpenRC |
| Firmware form | `mtd-loader` — U-Boot is the first region of the flash |
| Partitions | MTD regions `u-boot`, `boot-rest`, `ubi`; UBI volumes records, SYSTEM and DATA |
| Size budget | 44 MB (`BOARD_SIZE_BUDGET_MB`); the root is xz squashfs |
| Tier | bring-up (QEMU) |
| Boot assurance | I1 |

The boot trust is none: QEMU hands U-Boot its own control device tree, so no
key can be embedded in it, and U-Boot checks the FIT's hashes without a
signature. The kernel requires a signed verity root. No vendor blob is in the
boot chain.

## Hardware and feature state

| Feature | State | Note |
|---|---|---|
| NOR flash (CFI, two 64 MiB banks) under UBI | verified under QEMU | the boot test attaches the UBI region |
| Watchdog (i6300esb) | verified under QEMU | the kernel arms it; the loader has none |
| Network | virtio-net | — |
| Display, Wi-Fi, Bluetooth, status LED, CAN, USB gadget, containers | none | `BOARD_FEATURES=""` |
| Physical recovery action | none | credential recovery and full-factory reset are refused on this board |

> status: board-dependent — evidence: `mica-build:boards/qemu-armhf/board.env`, `mica-build:boards/qemu-armhf/evidence.json`

## Partition layout

| Region | Role | Offset | Size |
|---|---|---|---|
| `u-boot` | the loader | 0 | 1 MiB |
| `boot-rest` | the rest of the first bank, erased | 1 MiB | 63 MiB |
| `ubi` | UBI: the record volumes, SYSTEM and DATA | 64 MiB | 64 MiB |

The erase block is 256 KiB. The authoritative geometry is
`mica-build:boards/qemu-armhf/flash.tsv`.

## Console

QEMU's PL011, `console=ttyAMA0`, on the terminal QEMU runs in with
`-nographic`.

## Obtaining an image

The product is `qemu-armhf.basic`, released as
`qemu-armhf.basic.<YYYYMMDD-HHMM>` with the flash image
`mica-qemu-armhf.basic-<YYYYMMDD-HHMM>.img.gz`. Verification is in
[download](../start/download.md).

## Flashing

**Under QEMU (unverified for the product image).** The flash image is both
banks, 128 MiB; split it into the two `pflash` drives and start the machine:

```sh
gunzip -k mica-qemu-armhf.basic-<YYYYMMDD-HHMM>.img.gz
dd if=mica-qemu-armhf.basic-<YYYYMMDD-HHMM>.img of=pflash0.img bs=1M count=64
dd if=mica-qemu-armhf.basic-<YYYYMMDD-HHMM>.img of=pflash1.img bs=1M skip=64
qemu-system-arm -M virt,highmem=off -cpu cortex-a15 -m 128M -nographic -no-reboot \
  -drive if=pflash,format=raw,file=pflash0.img \
  -drive if=pflash,format=raw,file=pflash1.img \
  -device i6300esb
```

The machine options and the flash split are those of the board's boot test,
which boots U-Boot and the kernel with a test initramfs; no suite has booted
the product image this way.

> status: unsupported

## First boot

As on the other boards: the early init verifies the deployment, and the
health gate confirms the deployment that booted. DATA is a fixed UBI volume
and does not grow. The root's init is OpenRC, and micad drives the services
each package ships for that init (`mica-core:docs/mica-core.md` section 3.8).

`qemu-armhf.basic` carries no web console; it serves the API on port 8080.

## Updates

The update kinds the board declares are in
`mica-build:boards/qemu-armhf/images.tsv`, with the A/B switch, health
confirmation and rollback of every board; the two deployments and their
records are UBI volumes. See [updates and rollback](../operate/updates.md).

## Recovery

Read-only diagnosis, manual rollback, configuration reset and
application-data reset are available; credential recovery and full-factory
reset are refused, because the board declares no physical recovery action.
The floor is rewriting the flash image on the host, which costs every volume
and the device identity. See [recovery](../operate/recovery.md).

## Known limitations

- All evidence is emulator evidence; there is no hardware to qualify.
- The FIT is not signed: anything that can write the flash can replace the
  kernel. The verity root still has to be signed.
- No web console, no MQTT and no container engine: `qemu-armhf.basic`
  carries the management plane and SSH only.

## Qualification results

**Binding**: QEMU `virt` (`highmem=off`, Cortex-A15, 128 MiB) with two CFI
flash banks; no physical machine.

**Owners**: the Mica OS project owns the port and its qualification. There is
no vendor and no integrator of record.

Emulator rows are evidence about the emulated platform, never a hardware pass.

| Row | Result | Date | Evidence / reason |
|---|---|---|---|
| Loader and kernel boot from UBI, trial counting, both record copies | pass | 2026-10-17 | the board's boot test, `mica-build:boards/qemu-armhf/tests/boot/run.sh` |
| Installation and first boot | not tested | — | no suite boots the product image |
| Cold boot and warm boot | not tested | — | no physical machine |
| A/B switch and update | not tested | — | no suite boots the product image |
| Power-cut during update | not tested | — | no physical machine |
| Storage growth/health | N/A | — | DATA is a fixed UBI volume |
| Recovery | not tested | — | no physical machine |
| Radios and fieldbus | N/A | — | the board declares none |

> status: board-dependent — evidence: `mica-build:boards/qemu-armhf/evidence.json`, `mica-build:boards/qemu-armhf/tests/boot/run.sh`
