# Writing a Mica OS image to a board

A release publishes one compressed image per product,
`mica-<product>-<release>.img.gz`. That file is a whole GPT disk image: the
partition table, the boot pieces, the signed root and an empty DATA. This page
is how it reaches a board, board by board, and what is not a verified
procedure yet.

- Picking a release and getting the file: [download](download.md).
- What the image contains and how big each partition is:
  [storage](../design/storage.md).
- After the board boots: [first run](first-run.md).
- Replacing a running system instead of writing a whole image:
  [update packages](update-packages.md).

## 1. Before you write

Verify the file first. Both steps are anonymous, no token and no registry
login:

```sh
sha256sum -c SHA256SUMS                          # the release's own list
gzip -dc mica-x64-dev-<release>.img.gz | sha256sum
```

The second value is the raw image the build signed and gated. Compare it with
`uncompressedSha256` for that file in `mica-index.json`
([version index](../design/mica-index.md)); the image's OCI layer carries the
same value as `mica.uncompressed-sha256`.

> status: shipped — evidence: `mica-build:tools/release.sh`, `docs/design/mica-index.md`, `docs/design/release-lock.md`

Then know three things about the write:

- **It replaces the medium.** The image is a whole disk: writing it destroys
  every partition on the target within the image's extent. Identify the device
  before writing, not after.
- **The image is signed, and the board must trust the signer.** The kernel and
  boot components are signed with the release's boot key; a UEFI platform that
  does not carry that certificate refuses to start the image, and a FIT board's
  U-Boot refuses an unsigned or foreign-signed kernel. Development releases are
  signed with development certificates
  ([release signing](../design/release-signing.md),
  [key delivery](../design/key-delivery.md)).
- **DATA is small on purpose.** It ships at 256 MiB and grows to the medium on
  first boot; SYSTEM is exactly 1 GiB and holds both deployments.

> status: shipped — evidence: `mica-build:build/src/file-layout.ts`, `docs/design/release-signing.md`, `docs/design/storage.md`

## 2. What the image carries, per board

Every board declares exactly one image kind, `disk`, built in (no vendor
packer is implemented). What differs is where the bootloader lives.

| Board | Firmware format | Does the raw image boot a blank board? | Qualified |
|---|---|---|---|
| `x64` | `efi` (systemd-boot in the ESP) | yes, where UEFI starts `EFI/BOOT/BOOTX64.EFI` | under QEMU only |
| `virt-arm64` | `efi` (systemd-boot in the ESP) | yes, as a QEMU guest | QEMU, not a release target |
| `cx3576` | `rockchip-loader` | yes — U-Boot is written inside the image at sector 64 | not on hardware |
| `s905x5m` | `amlogic-boot0` | **no** — U-Boot runs from eMMC boot0, outside the image | no, not a release target |

Only `x64` and `cx3576` are release targets, so only their images exist as
release assets. There is no A/B partition pair to choose between and no
conversion from an older layout: a write is a full write.

> status: board-dependent — evidence: `mica-boards:boards/x64/board.env`, `mica-boards:boards/cx3576/board.env`, `mica-boards:boards/s905x5m/board.env`, `mica-boards:boards/cx3576/images.tsv`, `docs/boards/support-tiers.md`

## 3. x64

The x64 image is a GPT disk with `ESP` (512 MiB, FAT, label `MICAESP`,
carrying `EFI/BOOT/BOOTX64.EFI` and `loader/loader.conf`), `SYSTEM` (1 GiB)
and `DATA`. It boots wherever UEFI firmware starts `BOOTX64.EFI`, so the whole
image is written to the target medium — a USB stick, a SATA or NVMe disk.

**The x64 path is qualified under QEMU only.** The assembly's acceptance runs
`qemu-system-x86_64 -machine q35` with OVMF secure-boot firmware and the
release's boot certificate enrolled in disposable variables; nobody has booted
a physical x64 machine from one of these images, and `mica-boards`'
`evidence.json` records the board's qualification as that disposable
enrollment, not physical firmware.

The QEMU path is the same shape as [section 4](#4-qemu-x64-and-virt-arm64); it
is what `make lifecycle-uefi PRODUCT=x64-dev` and the apid API harness drive.

> status: board-dependent — evidence: `mica-boards:boards/x64/evidence.json`, `mica-build:tests/lifecycle-uefi/boot.sh`, `mica-build:make lifecycle-uefi`

**Not verified — writing to physical media.** No physical x64 write has been
performed or witnessed here, so the following is a description of the image,
not a qualified procedure. The image is a raw GPT disk image and would be
written the way any raw image is:

> ```sh
> # NOT VERIFIED: never run against physical hardware by this project
> gzip -dc mica-x64-dev-<release>.img.gz | sudo dd of=/dev/sdX bs=4M status=progress conv=fsync
> ```
>
> A stock machine carrying only the Microsoft keys refuses a development-signed
> image unless Secure Boot is turned off or the release's boot certificate is
> enrolled first. Which media the assembly would qualify — USB, SATA, NVMe —
> is undecided.

> status: unsupported

## 4. QEMU: x64 and virt-arm64

This is the path that is actually run. `virt-arm64` exists for it: it is a
QEMU board, not a release target, and the suite boots the product image as a
virtio disk behind secure-boot firmware.

```sh
qemu-system-aarch64 -machine virt -cpu max -m 1024 -smp 2 \
  -nographic -no-reboot -device i6300esb -watchdog-action reset \
  -netdev user,id=net0 -device virtio-net-pci,netdev=net0 \
  -drive if=pflash,format=raw,unit=0,readonly=on,file=/usr/share/AAVMF/AAVMF_CODE.secboot.fd \
  -drive if=pflash,format=raw,unit=1,file=vars.fd \
  -drive if=none,id=disk0,format=raw,file=image/disk.img \
  -device virtio-blk-pci,drive=disk0,bootindex=0
```

- `image/disk.img` is the decompressed image, copied — the guest writes to it.
- `vars.fd` is made once from `AAVMF_VARS.fd` with
  `virt-fw-vars … --set-pk/--add-kek/--add-db <the release's boot certificate>
  --no-microsoft --sb`, which is what makes the guest trust the release.
- x64 is the same line with `qemu-system-x86_64 -machine q35` and the OVMF
  secure-boot firmware.
- An offline update medium is handed in over 9p:
  `-fsdev local,id=import,path=<dir>,security_model=none,readonly=on -device virtio-9p-pci,fsdev=import,mount_tag=mica-update`.

The whole acceptance suite — boot, runtime, updates, faults, reset, shutdown —
is one target in `mica-build`:

```sh
make lifecycle-uefi PRODUCT=virt-arm64-dev
```

> status: shipped — evidence: `mica-build:tests/lifecycle-uefi/boot.sh`, `mica-build:make lifecycle-uefi`, `docs/boards/virt-arm64.md`

## 5. cx3576

On cx3576 the image is the whole medium and carries the bootloader: GPT with
`FIRMWARE` at sector 64, `SYSTEM` (1 GiB, ext4 + verity) and `DATA`. Our
U-Boot (`u-boot-rockchip.bin`, idbloader + FIT) sits inside the image at
sector 64, inside the protected range, and the two 64 KiB CRC-protected boot
records are at 16 MiB and 17 MiB. Writing the image therefore writes the
bootloader too: there is no separate idblock step, and no vendor `update.img`
is produced for this board.

`mica-boards` carries the write path, over `rkdeveloptool` on USB:

```sh
make -C boards/cx3576 flash-mica      # the device is already in loader mode
make -C boards/cx3576 flash-maskrom   # the device is in Maskrom
```

Both validate the image first, write it, read every written byte back and
compare it — the firmware and counter region first — and only then reset the
board. `flash-maskrom` first downloads the committed vendor loader
`boards/cx3576/loader/MiniLoaderAll.bin` with `rkdeveloptool db`; that loader
is never embedded in the image and is not a U-Boot build input. **Do not cut
power, unplug or reset the board between the loader download and the final
reset.**

Recovery for a board that no longer boots is the same route: enter Maskrom,
the SoC's USB recovery mode, and run `flash-maskrom`.

> status: board-dependent — evidence: `mica-boards:boards/cx3576/Makefile`, `mica-boards:boards/cx3576/loader`, `mica-boards:make flash-verify-test`, `docs/boards/cx3576.md`

Not verified, and needed before this is a procedure someone can follow
unattended: no cx3576 has been flashed from a release image on hardware here;
the physical button or pad sequence that enters Maskrom on this board is not
written down; and no SD-card boot fallback has been exercised. The host tests
prove the preflight, readback and reset ordering against a stubbed
`rkdeveloptool`, not that a board came up.

> status: unsupported

## 6. s905x5m

There is no supported way to put Mica OS on a blank s905x5m today, and no
release carries it: `BOARD_RELEASE_TARGET=0`.

The reason is where the firmware lives. Mica OS U-Boot (`u-boot.bin.signed`)
executes from the eMMC boot0 area, behind a 512-byte Amlogic header, and the
loader refuses an automatic boot when its source is not boot0. The disk image
covers the SD medium only — `FIRMWARE` at sector 64, `SYSTEM`, `DATA` — so
writing it to an SD card installs no bootloader, and a board whose boot0 does
not already carry Mica OS U-Boot will not boot from it.

The repository does build the vendor burn image
(`make -C boards/s905x5m uboot-package`, an Amlogic v2 `update.img` carrying
the signed U-Boot as `bootloader.PARTITION`, deliberately without `gpt.bin` or
`bootloader_a` so the burn does not touch a user-area GPT). How that image is
delivered to the board, how boot0 is written and read back, and how a bricked
board is recovered are all unwritten and untested. Treat the board as
bring-up work, not as an installation target.

> status: unsupported

## 7. First boot

The factory image ships two signed deployment records, generations g-1 and g,
as files on SYSTEM; DATA is shared. On first boot systemd-repart grows DATA to
the physical medium — only DATA grows — and the device establishes its
persistent identity there. What happens next, including the offline
provisioning document, is [first run](first-run.md); the failure paths are
[recovery](recovery.md).

The growth targets exist (`make os-repart-test` under privileged docker, and
`make product-repart-test PRODUCT=<name>` over a built product) but are not
run in CI.

> status: shipped — evidence: `mica-build:build/src/file-layout.ts`, `mica-build:make os-repart-test`, `docs/design/storage.md`

## 8. What flashing does not cover

- **No vendor image kinds.** Every board declares `image disk builtin`; the
  `rockchip-update` packer is named in the tooling and refused. A release
  carries the raw disk image and the update archives, nothing else.
- **No partition-level A/B.** Both deployments are files on SYSTEM, so there
  is no "other slot" to flash ([updates](../design/updates.md)).
- **No upgrade by re-flashing.** Writing an image wipes DATA. To move a running
  device to a newer release, take an update archive
  ([update packages](update-packages.md)).

> status: shipped — evidence: `mica-boards:boards/x64/images.tsv`, `docs/design/updates.md`, `docs/user/update-packages.md`
