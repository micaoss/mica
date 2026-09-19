# Writing a Mica OS image to a board

A release publishes one compressed image per product,
`mica-<product>-<release>.img.gz`. That file is a whole GPT disk image: the
partition table, the boot pieces, the signed root and an empty DATA. This page
is how it reaches a board, board by board, and what is not a verified
procedure yet.

- Picking a release and checking the digests: [download](download.md).
- What the image contains and how big each partition is:
  [storage](../design/storage.md).
- After the board boots: [first run](first-run.md).
- Replacing a running system instead of writing a whole image:
  [update packages](update-packages.md).

**What is qualified, stated once.** Every boot anyone here has seen was QEMU.
No Mica OS image has been written to a USB stick, a SATA disk, an NVMe drive
or an eMMC, and no physical board has booted one. The QEMU sections below are
run; the hardware sections are read out of the repositories and are marked
where they are not verified. Those QEMU boots are also dated: the newest is
2026-09-15 20:17 UTC, before the board rename, and the `uefi` images published
after it power the machine down at PID 1 instead of booting
([download](download.md) section 1). Writing one to a board today produces a
unit that starts the kernel and switches off.

> status: board-dependent — evidence: `mica-boards:boards/uefi-x64/evidence.json`, `mica-build:tests/lifecycle-uefi/boot.sh`, `docs/boards/support-tiers.md`

## 1. Before you write

Verify the file, then decompress it:

```sh
sha256sum -c SHA256SUMS                              # the release's own list, covers the .gz
gzip -dc mica-uefi-x64-dev-<release>.img.gz > disk.img
sha256sum disk.img                                   # compare with uncompressedSha256
```

The full chain — release list, the lock's `asset` row, the index's
`uncompressedSha256`, the OCI layer annotations — is
[download](download.md#4-which-digest-at-which-step). For
`mica-x64-dev-20260915-2230.img.gz` — published before the boards were renamed
on 2026-09-16, so it carries the old product name — the decompressed image is
1 881 145 344 bytes with sha256
`e27709a9e54f6ffe92f4737cac18f3c00023547e406f7c670bfedb0d3849c6ef`, which the
index and the OCI layer both state.

Then know three things about the write:

- **It replaces the medium.** The image is a whole disk: writing it destroys
  every partition on the target within the image's extent. Identify the device
  before writing, not after.
- **The image is signed, and the board must trust the signer.** Releases are
  signed with the Mica development boot certificate. A UEFI machine that
  trusts only the Microsoft keys refuses the loader and falls through to the
  next boot entry or shows a Secure Boot violation; there is no unsigned
  fallback. A FIT board's U-Boot accepts only a kernel signed by the
  certificate built into it.
- **DATA is small on purpose.** It ships at 256 MiB and grows to the medium on
  first boot; SYSTEM is exactly 1 GiB and holds both deployments.

> status: shipped — evidence: `mica-build:build/src/file-layout.ts`, `docs/design/release-signing.md`, `docs/user/download.md`

## 2. What the image carries, per board

Every board declares exactly one image kind, `disk`, built in — no vendor
packer is implemented. What differs is where the bootloader lives.

| Board | Firmware format | Does the raw image boot a blank board? | State |
|---|---|---|---|
| `uefi-x64` | `efi` (systemd-boot in the ESP) | yes, where UEFI starts `EFI/BOOT/BOOTX64.EFI` | qualified under QEMU only |
| `uefi-arm64` | `efi` (systemd-boot in the ESP) | yes, where UEFI with ACPI starts `EFI/BOOT/BOOTAA64.EFI` | a release target since 2026-09-16; qualified under QEMU only |
| `cx3576` | `rockchip-loader` | yes — U-Boot is written inside the image at sector 64 | not verified on hardware |
| `s905x5m` | `amlogic-boot0` | **no** — U-Boot runs from eMMC boot0, outside the image | no supported path |

`uefi-x64`, `uefi-arm64` and `cx3576` have published images since
`20260916-1653`; `s905x5m` was opened as a release target on
2026-09-19 and publishes from its first release on — which changes what exists
to download, not what can be written: its image still installs no bootloader,
for the reason in section 6. There is no A/B partition pair to choose between
and no conversion from an older layout: a write is a full write.

> status: board-dependent — evidence: `mica-boards:boards/uefi-x64/board.env`, `mica-boards:boards/cx3576/board.env`, `mica-boards:boards/s905x5m/board.env`, `mica-boards:boards/cx3576/images.tsv`

## 3. uefi-x64

### The image

The published uefi-x64 image is a GPT disk with disk GUID
`5AC35760-0064-4000-8000-000000000000` and three partitions, read out of
`mica-x64-dev-20260915-2230.img` (the last image published under the old
`x64` name; the layout is the board's and did not change with it):

| Partition | Type | Start sector | Size |
|---|---|---|---|
| `esp` | `C12A7328-F81F-11D2-BA4B-00A0C93EC93B` | 2048 | 512 MiB |
| `system` | `0FC63DAF-8483-4772-8E79-3D69D8477DE4` | 1050624 | 1024 MiB |
| `data` | `0FC63DAF-8483-4772-8E79-3D69D8477DE4` | 3147776 | 256 MiB |

The ESP is FAT, labelled `MICAESP`, and carries `EFI/BOOT/BOOTX64.EFI` and
`loader/loader.conf`. The image boots wherever UEFI firmware starts
`BOOTX64.EFI`, so the whole image goes to the target medium.

> status: shipped — evidence: `mica-boards:boards/uefi-x64/board.env`, `mica-build:build/src/file-layout.ts`

### Which media the kernel can drive

The pinned uefi-x64 kernel has built in: USB host XHCI and EHCI with
`USB_STORAGE`, SATA through AHCI and `ATA_PIIX`, NVMe, and virtio-blk and
virtio-scsi for VMs. `CONFIG_USB_UAS` is not set, so a UAS-only enclosure
falls back to bulk-only transport or is not driven, and `CONFIG_MMC` is not
set at all: an SD card reader on an MMC controller is not driven, though a USB
card reader is ordinary USB mass storage.

So the driver answer is USB sticks and disks, SATA and NVMe. Which of those
media the assembly qualifies is still open — nothing physical has been tested.

> status: board-dependent — evidence: `mica-boards:boards/uefi-x64/kernel/config/uefi-x64.config`, `mica-boards:make kernel-config-test`

### Writing it (not verified)

No physical uefi-x64 write has been performed or witnessed here. The commands below
are the form the assembly would document; publish nothing from this block as
qualified, and expect the target identification to be the risky part:

> ```sh
> # NOT VERIFIED: never run against physical hardware by this project
> lsblk -o NAME,SIZE,TYPE,TRAN,MODEL,MOUNTPOINTS      # before and after plugging it in
> udevadm info --query=property --name=/dev/sdX | grep -E 'ID_BUS|ID_MODEL|ID_SERIAL'
> gzip -dc mica-uefi-x64-dev-<release>.img.gz | sudo dd of=/dev/sdX bs=4M status=progress conv=fsync
> sync
> sudo cmp -n 1881145344 /dev/sdX disk.img            # or re-read and compare sha256
> sudo sfdisk -d /dev/sdX                             # expect 2048, 1050624, 3147776
> ```
>
> Write to the whole device (`/dev/sdX`), never to a partition; unmount
> whatever the desktop auto-mounted first. `bs=4M` is a throughput choice,
> `conv=fsync` plus `sync` is what makes the write durable before the medium
> is pulled.

> status: unsupported

### Secure Boot on a real machine (not verified)

To boot a release image the operator must either enrol the release's boot
certificate into the firmware `db` — usually through the firmware's Setup
Mode, which is vendor-specific — or disable Secure Boot. Disabling it does not
weaken the root: the signed kernel command line still carries
`dm_verity.require_signatures=1`, so the root stays verity-protected. Secure
Boot governs who may load the kernel, not whether the root is verified.

> status: unsupported

## 4. QEMU: uefi-x64 and uefi-arm64

This is the path that is actually run, and for `uefi-arm64` it is the only
path with evidence behind it. Since 2026-09-16 that board is a release target
and its kernel carries generic hardware drivers — AHCI, NVMe, USB storage over
xHCI and EHCI, and the common NICs as modules — but **carrying a driver is not
evidence that a machine boots**: the qualification is QEMU `virt` only, as it
is for `uefi-x64` ([dossier](../boards/uefi-arm64.md)).

Firmware files, as the acceptance lab uses them:

| Guest | Code | Variables | Machine |
|---|---|---|---|
| amd64 | `/usr/share/OVMF/OVMF_CODE_4M.secboot.fd` | `/usr/share/OVMF/OVMF_VARS_4M.fd` | `qemu-system-x86_64 -machine q35` |
| arm64 | `/usr/share/AAVMF/AAVMF_CODE.secboot.fd` | `/usr/share/AAVMF/AAVMF_VARS.fd` | `qemu-system-aarch64 -machine virt` |

Build the variable store once, enrolling the release's boot certificate — this
is what makes the guest trust the image:

```sh
cp /usr/share/AAVMF/AAVMF_VARS.fd vars.template.fd          # OVMF_VARS_4M.fd for uefi-x64
virt-fw-vars --input vars.template.fd --output vars.fd \
  --set-pk 6b62601e-3448-4418-8923-7c9fa22ab09b db.cert.pem \
  --add-kek 6b62601e-3448-4418-8923-7c9fa22ab09b db.cert.pem \
  --add-db 6b62601e-3448-4418-8923-7c9fa22ab09b db.cert.pem --no-microsoft --sb
```

Then boot the image:

```sh
qemu-system-aarch64 -machine virt -cpu max -m 1024 -smp 2 \
  -nographic -no-reboot -device i6300esb -watchdog-action reset \
  -netdev user,id=net0 -device virtio-net-pci,netdev=net0 \
  -drive if=pflash,format=raw,unit=0,readonly=on,file=/usr/share/AAVMF/AAVMF_CODE.secboot.fd \
  -drive if=pflash,format=raw,unit=1,file=vars.fd \
  -drive if=none,id=disk0,format=raw,file=disk.img \
  -device virtio-blk-pci,drive=disk0,bootindex=0
```

uefi-x64 is the same line with `qemu-system-x86_64 -machine q35` and the OVMF
files. Append `,readonly=on` to the `-drive if=none,id=disk0,…` value to boot
the image read-only. The guest writes to `disk.img`, so copy it first.

What the guest must provide on `uefi-arm64`: the console is PL011
(`console=ttyAMA0,115200n8`) and there is no other, the watchdog is the
built-in i6300esb, the RTC is PL031 or EFI, and ACPI button is on so a
host-requested graceful powerdown reaches the guest. `virtio-blk-pci` and
`virtio-net-pci` are what the suite uses; since 2026-09-16 the kernel also
drives AHCI, NVMe, USB storage and the common NICs, so another disk or network
model boots in principle — untested, like every non-virtio path here. There is
no MMC driver at all, on purpose: a machine that boots from a platform MMC
controller is a hardware board of its own.

An offline update medium is handed in over 9p:

```sh
  -fsdev local,id=import,path=/path/to/offline,security_model=none,readonly=on \
  -device virtio-9p-pci,fsdev=import,mount_tag=mica-update
```

and on the device the suite mounts and imports it:

```sh
mount -t 9p -o trans=virtio,version=9p2000.L,ro mica-update /run/mica/import
mica-deploy import /run/mica/import/update.micaupd
```

The whole acceptance suite — boot, runtime, updates, faults, reset, shutdown —
is one target in `mica-build`:

```sh
make lifecycle-uefi PRODUCT=uefi-arm64-dev
```

> status: shipped — evidence: `mica-build:tests/lifecycle-uefi/boot.sh`, `mica-build:make lifecycle-uefi`, `mica-boards:boards/uefi-arm64/kernel/config`, `docs/boards/uefi-arm64.md`

A stock release image boots to its login prompt and its services. The
`FILE_AB_*` markers the acceptance console prints come from the suite's own
in-image script, not from a shipped image; do not expect them on a device.

> status: shipped — evidence: `mica-build:tests/lifecycle-uefi/boot.sh`

## 5. cx3576

On cx3576 the image is the whole medium and carries the bootloader: GPT with
`FIRMWARE` (LBA 64–36863), `SYSTEM` (36864–2134015, ext4 + verity) and `DATA`
(2134016–2658303). Our U-Boot (`u-boot-rockchip.bin`, idbloader + FIT) sits at
sector 64, inside the protected range — the four bytes `RKNS` at byte offset
32768 are its magic — and the two 64 KiB CRC-protected boot records are at
16 MiB and 17 MiB. Writing the image writes the bootloader too: there is no
separate idblock step, and no vendor `update.img` is produced for this board.

The write path lives in `mica-boards` (read at `9ce875d`), over
`rkdeveloptool` on USB:

```sh
make -C boards/cx3576 flash-mica      # the device is already in Loader/RockUSB mode
make -C boards/cx3576 flash-maskrom   # the device is in Maskrom
```

`MICA_IMAGE=<path>` selects the image; without it the Makefile takes the
newest `_out/image/mica-cx3576-*.img`. **It must be the decompressed `.img`**:
the preflight asserts the file is exactly 1 299 MiB = 1 362 100 224 bytes, so
a `.img.gz` fails immediately with `wrong factory image size`.

What each target does, in order:

| Step | `flash-mica` | `flash-maskrom` |
|---|---|---|
| 1 | preflight `--check` | preflight `--check` |
| 2 | `rkdeveloptool wl 0 <image>` | `sha256sum -c loader/MiniLoaderAll.bin.sha256` |
| 3 | readback: `--check` again, then `rl 0 36864` and `rl 36864 2623488`, each compared with the image | `rkdeveloptool db loader/MiniLoaderAll.bin` |
| 4 | `rkdeveloptool rd` — the reset, only after both comparisons passed | the whole `flash-mica` sequence |

The preflight touches no device: it checks the size, both GPTs (header CRC,
version, the 128×128-byte table and its CRC, the byte-identical backup at the
last LBA), the three partition ranges and labels, and the `RKNS` magic. On
success it prints `Factory geometry verified: 1362100224 bytes`; after the
readback, `Verified all 1362100224 written bytes; firmware and counter region
first.`

The committed vendor loader `boards/cx3576/loader/MiniLoaderAll.bin`
(786 937 bytes) is downloaded into RAM by `rkdeveloptool db`; it is never
embedded in the image and is not a U-Boot build input. **Do not cut power,
unplug or reset the board between `db` and `rd`.**

If a step fails: a failed preflight means nothing was written. A readback
mismatch prints `device readback differs at image byte N` and
`Readback retained at <path>`, and `rd` is *not* run — the device stays in
Loader mode and can be re-flashed straight away. Recovery for a board that no
longer boots is Maskrom, the SoC's USB recovery mode, plus `flash-maskrom`.

Operator prerequisites: `python3` and `rkdeveloptool` on `PATH` and USB access
to the device. On macOS, `brew install autoconf automake libusb pkg-config`
then `make -C boards/cx3576 rkdeveloptool-macos`, which builds upstream
`rkdeveloptool` at a pinned commit with two committed patches and installs it
where the Makefile looks for it.

> status: board-dependent — evidence: `mica-boards:boards/cx3576/Makefile`, `mica-boards:boards/cx3576/flash/scripts/verify-flash.py`, `mica-boards:boards/cx3576/loader`, `docs/boards/cx3576.md`

What is proven is the control flow, not a board: the repository's
`cx3576-flash-verify-test.sh` drives the whole target against a stub
`rkdeveloptool` and a fabricated image, asserting the call order, the two
readback ranges and that a single corrupted byte in the loader, at 20 MiB and
near the end is detected and leaves `rd` unrun. Not verified: every step
against real hardware, the button or pad sequence that enters Maskrom, the
udev rules or permissions a non-root operator needs (the repository ships
none), and any SD-card boot fallback.

> status: unsupported

## 6. s905x5m

There is no supported way to put Mica OS on a blank s905x5m today. The board
was opened as a release target on 2026-09-19, so its images will be published
like any other board's — and that changes nothing here: being published is not
being installable, the board's physical qualification is still pending, and
the paragraphs below are why.

The reason is where the firmware lives. Mica OS U-Boot (`u-boot.bin.signed`)
executes from the eMMC boot0 area, behind a target-generated 512-byte Amlogic
header, and the loader refuses an automatic boot when its source is not boot0.
The disk image covers the SD medium only — `FIRMWARE` at sector 64, `SYSTEM`,
`DATA` — so writing it to a card installs no bootloader, and only a board
whose boot0 already carries the paired Mica OS U-Boot boots from it.

What exists towards a future procedure: `make -C boards/s905x5m uboot` builds
the signed U-Boot and its DDR blob, and `make -C boards/s905x5m uboot-package`
builds an Amlogic v2 `update.img` (pinned `aml_image_v2_packer`, verified by
unpacking it again) carrying the signed U-Boot as `bootloader.PARTITION` and
deliberately omitting `gpt.bin` and `bootloader_a`, so a burn frames the
hardware boot areas and cannot touch a user-area GPT. Which host tool consumes
that image, how boot0 is written and read back, and how a bricked board is
recovered are all unwritten and untested — bench work owned jointly by
`mica-boards` and `mica-build`.

> status: unsupported

## 7. First boot

- **DATA grows.** `systemd-repart` grows the DATA partition to the device and
  `systemd-growfs@mnt-data` grows its filesystem; both units must be active,
  and the acceptance suite fails a boot where they are not.
  `make os-repart-test` (privileged docker) proves the growth cannot wipe the
  loader; it exists and CI does not run it.
- **Two deployments from the start.** The factory image carries two signed
  deployment records, generations g-1 and g — for `x64-dev` `20260915-2230`,
  generations 3 and 4. On the device that is exactly two descriptors in
  `/mnt/system/deployments/` and exactly two boot entries; an update never
  leaves a device without a bootable fallback.
- **How the loader chooses.** The factory ESP carries `loader/loader.conf`
  with `timeout 0`, `editor no` and `auto-entries no`, and one entry per
  deployment named `loader/entries/mica-<deployment id>+3.conf` — systemd-boot
  boot counting, three tries, renamed on a successful bless. Kernels live at
  `EFI/mica/kernels/<kernel id>.efi`. FIT boards keep the same records, with
  `tries = 3`, in the redundant U-Boot environment inside the firmware region.
- **No factory provisioning seed today.** A product may carry a
  `provisioning.toml`, which the build places on the ESP as
  `mica-provisioning.toml` (UEFI boards only); no product in the tree carries
  one, so shipped images have none. What a device does with one is
  [first run](first-run.md).
- **Which version is running.** `mica-deploy status` and `mica-deploy booted`
  report the running deployment id; map it back with the index:
  `jq -r '.products[]|[.product,.release,.generation,.deployment]|@tsv' mica-index.json`.

> status: shipped — evidence: `mica-build:build/src/file-image.ts`, `mica-build:make os-repart-test`, `mica-core:crates/mica-deploy`, `docs/design/storage.md`

No full device cycle — write, first boot, update, confirmation, rollback — has
been run on hardware. The device-side half of this section is read out of
`mica-core` and exercised in QEMU, not on a board.

> status: unsupported

## 8. What flashing does not cover

- **No vendor image kinds.** Every board declares `image disk builtin`; the
  `rockchip-update` packer is named in the tooling and refused. A release
  carries the raw disk image and the update archives, nothing else.
- **No partition-level A/B.** Both deployments are files on SYSTEM, so there
  is no "other slot" to flash ([updates](../design/updates.md)).
- **No upgrade by re-flashing.** Writing an image wipes DATA. To move a
  running device to a newer release, take an update archive
  ([update packages](update-packages.md)).

> status: shipped — evidence: `mica-boards:boards/uefi-x64/images.tsv`, `docs/design/updates.md`, `docs/user/update-packages.md`
