# Current board.env and layout.tsv contract

`boards/<name>/board.env` declares the board's target architecture, backend,
loader facts and hardware capabilities; `boards/<name>/layout.tsv` beside it
declares its disk -- every partition with its role, geometry and identities, and
the raw regions inside them. The active system-image targets are uefi-x64,
uefi-arm64, cx3576 and the s905x5m development port. `src/image/file-layout.ts`
reads the table and holds it to the layout rules; `make os-layout-lint` and the
board contract test exercise every board's.

> status: shipped — evidence: `mica-build:src/image/file-layout.ts`, `mica-build:make os-layout-lint`

## Format and consumers

`board.env` is plain `KEY=value` assignments with the literal aliases already
used by the board definitions. Build orchestration parses these as data. Do not
add command substitution or executable policy. Boot firmware never imports this
source file from persistent device storage. `layout.tsv` is tab-separated rows
under the header `# mica layout v1`.

| Consumer | Contract |
|---|---|
| `src/image/file-layout.ts` | The layout rules over `layout.tsv`: partition order, alignment, roles, regions, identities, capacity |
| `src/image/roles/`, `src/image/regions.ts` | One builder per partition role, one writer per region source, in the factory image |
| `src/image/file-image.ts` | Signed deployment assembly over the layout's partitions |
| `src/rootfs/build.ts` | Architecture, root pack settings and hardware capabilities |
| `mica-build:producers/board/render.sh`, `stage.sh` | The device's fstab, repart set, ESP mount and growth drop-in from `layout.tsv`; service and hardware initialization files |
| `src/verify/file-image.ts`, `src/verify/roles.ts` | Exact assembled GPT, per-role partition, firmware, component and filesystem checks |

## Identity

| Key | Meaning |
|---|---|
| `LAYOUT_VERSION` | Exactly `3`: the interface version the image-kind packers read |
| `LAYOUT_BOARD` | Exact target board identity |
| `MICA_ARCH` | `amd64` or `arm64` userspace architecture |
| `BOOT_BACKEND` | `systemd-boot` or `uboot-fit` |
| `BOARD_RELEASE_TARGET` | Whether the board is a qualified release target |

No version dispatch or old-layout reader is provided. s905x5m supports current
development images with `BOARD_RELEASE_TARGET=0` pending physical qualification.

## The disk: layout.tsv

```
# mica layout v1
disk    <disk guid>  <sector size>  <alignment, sectors>
part    <number>  <GPT name>  <role>  <start sector>  <size, sectors>  <type guid>  <partition guid>  <filesystem id or ->
region  <partition name>  <region name>  <offset in the partition, bytes>  <size, bytes>  <source>
```

Roles: `esp` (FAT32, the loader tree, the boot entries and the factory seed),
`system` (ext4, the deployments store), `data` (ext4 with project quotas, the
DATA tree), `raw` (bytes placed by region rows), and a board's own `vfat` or
`ext4` partition seeded from `partitions/<name>/` of its directory. Region
sources: `loader` (the signed U-Boot binary), `records-a` and `records-b` (the two
boot record copies), `file:<path>` (a file of the board directory). The
filesystem id is the ext4 UUID, the FAT volume id of an `esp` or `vfat`
partition, and `-` for `raw`.

The rules: exactly one `system` and one `data` partition, and `data` last -- the
only partition grown after factory assembly; one `esp` on a `systemd-boot` board,
none on a `uboot-fit` board and one `raw` partition carrying both record regions;
partitions numbered 1..n in disk order, aligned, apart and inside the disk,
distinct in name and identity; regions only in `raw` partitions, inside them and
apart; sector size 512. The GPT names are the device's contract (micad and the
early loader find partitions by them).

SYSTEM contains signed deployment records and immutable root/support/FIT files.
UEFI boot executables are immutable UKI files on ESP. DATA holds state, metadata
and application/user namespaces. No state, metadata or writable-var partitions
exist. `/var` is an immutable skeleton with only audited writable leaves.

> status: shipped — evidence: `mica-build:boards/uefi-x64/layout.tsv`, `mica-build:src/image/roles/index.ts`, `mica-build:src/image/file-layout.test.ts`

## Capacity and reproducibility

The declared `system` size, and the `esp`'s where there is one, must cover
current, fallback and staged components plus explicit reserve. `checkCapacity`
refuses insufficient geometry before image creation. Actual installation checks
reusable object bytes and available capacity before publishing a candidate.

`EXT4_BLOCK_SIZE`, `EXT4_FEATURES`, `E2FSPROGS_FAKE_TIME`, `FILE_MTIME` and
`VERITY_SALT` are reproducible root/filesystem build inputs. They do not grant a
runtime override of authenticated verity geometry. The signed component contract
carries the exact geometry used by native init and the installer.

## FIT record geometry

The two record regions of a `uboot-fit` board's `raw` partition are where
`mica-deploy` writes the boot records, and it compiles that geometry in per board
until it reads it from the signed board policy (plan `20260921-1142`, P4). Until
then `src/image/device-fit-geometry.ts` holds the device's table and the layout
rules refuse a FIT layout that differs from it, or a FIT board it does not know.

## cx3576 protected firmware ranges

The `firmware` partition starts at sector 64 and covers the `loader` region at its
start and both 64 KiB record copies at absolute offsets 16 MiB and 17 MiB. SYSTEM
starts at 18 MiB. The loader region is `UBOOT_MAX_BYTES` long and stops at the
first record copy; the layout rules, the firmware maintenance writer and the
complete-image flash verifier enforce their respective boundaries. No generic
environment command interface is installed.

The native C boot policy validates these fixed ranges, persists and reads back a
trial decrement, and only then loads a required signed FIT. DATA growth compares
protected firmware/SYSTEM bytes and preserves their identities.

> status: shipped — evidence: `mica-build:boards/cx3576/loader/mica-file-boot.c`, `mica-build:src/image/firmware-maintenance.ts`, `mica-build:tests/gates/repart-loader-test.sh`

## s905x5m protected firmware ranges

The `firmware` partition starts at sector 64 and ends at 128 MiB. Its 64 KiB
native records are at absolute 120 and 124 MiB; SYSTEM starts at 128 MiB. Unlike
the CX3576 loader, the Amlogic loader is external to the SD GPT: the layout has
no `loader` region, and the loader travels beside the image. Its signed receipt
specifies eMMC boot0 framing and size independently. Offline image verification
checks the paired exported firmware; native boot0 readback checks installation.

> status: shipped — evidence: `mica-build:boards/s905x5m/layout.tsv`, `mica-deploy:src/firmware.rs`

## Hardware and product capabilities

`BOARD_CMDLINE_ARGS` records board console/platform settings for the authenticated
kernel package. `BOARD_FIRMWARE_FILES` names kernel-support firmware requirements;
they are not root-owned executable payloads. `BOARD_FEATURES` is the hardware's
capability set (`wifi bluetooth display status-led can usb-gadget audio
containers`): a product selects features from it, the board package installs
by it, and no second reading of it exists (`BOARD_RADIOS`,
`BOARD_HAS_STATUS_LED` and `BOARD_HAS_DISPLAY` are gone; the contract test
refuses them). `BOARD_HWINIT_CONFS` selects the board's hardware
initialisation units. There is no family key: a board carries its own
kernel and loader builds (`mica-build:boards/README.md`); there is no `IMAGE_KINDS`: a board's flashing formats are declared in
`images.tsv` beside `board.env` (`docs/boards/contract.md` section 3.1,
`docs/decisions/2026-09-15-board-image-packers.md`); `BOARD_PACKAGE_ENABLEMENT`
how many units the board package enables, which the package gate holds.

## The authenticated boot

The assembly's kernel component and firmware package dispatch on these
facts and never on the board's name (`mica-build:src/image/board-facts.ts`,
held by `mica-build:tests/gates/board-name-lint.sh`). `BOARD_CMDLINE_ARGS` is the
exact authenticated kernel command line on every board (a FIT board's
kernel forces it, `CONFIG_CMDLINE_FORCE`). `FIRMWARE_FORMAT` is `efi` on a
`systemd-boot` board, `rockchip-loader` or `amlogic-boot0` on a `uboot-fit`
board. A FIT board declares `FIT_DTB` (the device tree the bundle carries),
`FIT_WATCHDOG` (the watchdog symbol its kernel must build in) and
`FIT_LOAD_ADDRESSES` (kernel, initramfs and device tree), and its loader:
`UBOOT_BIN_NAME`, `UBOOT_MAX_BYTES`, with `LOADER_MAGIC_HEX` for a
`rockchip-loader` written into the `loader` region of its layout, or `UBOOT_MIN_BYTES` and `UBOOT_PAYLOAD_OFFSET_BYTES` for an
`amlogic-boot0` payload that executes from eMMC outside the image. `BOARD_SIZE_BUDGET_MB`
bounds userspace composition; it is separate from SYSTEM storage capacity.

`BOARD_RECOVERY_ACTIONS` lists implemented physical OS recovery actions. An empty
value means no OS presence assertion exists. cx3576's local rockusb loader button
does not implicitly authorize credential recovery or factory reset through apid.

> status: shipped — evidence: `mica-build:boards/cx3576/board.env`, `mica-build:boards/uefi-x64/board.env`, `mica-build:boards/uefi-arm64/board.env`
