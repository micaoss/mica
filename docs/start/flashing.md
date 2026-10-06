# Writing a Mica OS image to a board

A release publishes what its product is installed from. For most products
that is one compressed disk image, `mica-<board>.<variant>-<stamp>.img.gz`: a
whole GPT disk with the partition table, the boot pieces, the signed root and
an empty DATA. This page is how each product reaches a device, how the UEFI
products boot under QEMU, and what is not a verified procedure yet.

- Picking a release and checking the digests: [download](download.md).
- What the image contains and how big each partition is:
  [storage](../reference/storage.md).
- After the board boots: [first run](first-run.md).
- Replacing a running system instead of writing a whole image:
  [updates](../operate/updates.md).

**What is qualified, stated once.** Every boot anyone here has seen was QEMU.
No Mica OS image written to a USB stick, a SATA disk, an NVMe drive or an
eMMC is on record here, and no physical boot has a qualification row; the one
hardware observation on file, of a `cx3576`, is not one
([board status](../hardware/README.md#current-boards)). The QEMU section below is
run, its amd64 walk-through against a published image; the hardware sections are read out of the repositories and are marked
where they are not verified. Every amd64 product is booted automatically in
its release run, while a `uefi-arm64` image is built and verified but started
by nothing automatic, and a `cx3576` or `s905x5m` image has never been started
by anything automatic: no suite boots a FIT image — the FIT suite runs on the
host and carries no QEMU ([download](download.md) section 1).

> status: board-dependent — evidence: `mica-build:boards/uefi-x64/evidence.json`, `mica-build:tests/suites/lifecycle-uefi/boot.sh`, `docs/hardware/README.md`

## 1. Before you write

Verify the file, then decompress it:

```sh
sha256sum -c SHA256SUMS                              # the release's own list: the lock
gzip -dc mica-uefi-x64.basic-<stamp>.img.gz > disk.img
sha256sum disk.img                                   # compare with the layer's mica.uncompressed-sha256
```

The full chain — `SHA256SUMS`, the lock's `asset` row, the OCI layer and its
`mica.uncompressed-*` annotations — is
[download](download.md#4-which-digest-at-which-step).

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

> status: shipped — evidence: `mica-build:src/image/file-layout.ts`, `docs/security/signing.md`, `docs/start/download.md`

## 2. Every product: what it publishes and how it gets onto a device

| Product | Its release carries | Onto the device | Then |
|---|---|---|---|
| `uefi-x64.basic`, `uefi-x64.full` | a disk image, `.img.gz` | write the whole image to a USB stick, SATA disk or NVMe drive (section 3), or boot it under QEMU (section 4) | the machine's firmware starts `EFI/BOOT/BOOTX64.EFI` |
| `uefi-arm64.basic`, `uefi-arm64.full` | a disk image, `.img.gz` | as `uefi-x64`; under QEMU, section 4.6 | UEFI with ACPI starts `EFI/BOOT/BOOTAA64.EFI` |
| `mini-x64.basic` | a disk image, `.img.gz` | write the whole image to a SATA, NVMe, SD or eMMC medium (section 3), or boot it under QEMU (section 4); **not from USB**, the kernel has no USB driver | as `uefi-x64` |
| `cx3576.basic`, `cx3576.full` | a disk image, `.img.gz`, with the boot loader inside it | `rkdeveloptool` over USB, with read-back (section 5) | the board starts from its eMMC |
| `s905x5m.basic`, `s905x5m.emmc-full` | a USB burning package, `.burn.img.gz` | the vendor's USB Burning Tool, the board in USB burning mode (section 6) | the board starts from its eMMC |
| `s905x5m.sd-full` | a disk image, `.img.gz`, and a boot loader package, `.sd-boot.img.gz` | the boot loader package once, by USB burning; then the disk image to an SD card (section 6) | the board starts from the card |

Every release also carries its update archives; those are for a device that
already runs Mica OS ([updates](../operate/updates.md)). A `dev` product is
built locally and is written the same way as its board's others.

Whichever way the image went on, the first contact is the same: the device
takes an address by DHCP on its wired interface and serves the management API
on port 8080, unclaimed, until somebody sets the administrator password
([first run](first-run.md)).

Where the boot loader lives is what differs between boards:

| Board | Boot loader | Does the disk image boot a blank device? | State |
|---|---|---|---|
| `uefi-x64` | systemd-boot, in the image's ESP | yes, where UEFI starts `EFI/BOOT/BOOTX64.EFI` | run under QEMU only |
| `uefi-arm64` | systemd-boot, in the image's ESP | yes, where UEFI with ACPI starts `EFI/BOOT/BOOTAA64.EFI` | run under QEMU only |
| `mini-x64` | systemd-boot, in the image's ESP | yes, where UEFI starts `EFI/BOOT/BOOTX64.EFI` | run under QEMU only |
| `cx3576` | U-Boot, inside the image at sector 64 | yes | not verified on hardware |
| `s905x5m` | U-Boot, in eMMC boot0, outside the disk image | **no**; the USB burning package of an eMMC product carries it, and `sd-full` ships it as a package of its own | not verified on hardware |

There is no A/B partition pair to choose between and no conversion from an
older layout: a write is a full write.

> status: board-dependent — evidence: `mica-build:boards/uefi-x64/board.env`, `mica-build:boards/cx3576/board.env`, `mica-build:boards/s905x5m/board.env`, `mica-build:boards/mini-x64/board.env`, `mica-build:boards/s905x5m/images.tsv`

## 3. uefi-x64, uefi-arm64 and mini-x64 on a physical machine

### The image

A uefi-x64 image is a GPT disk with disk GUID
`5AC35760-0064-4000-8000-000000000000` and three partitions:

| Partition | Type | Start sector | Size |
|---|---|---|---|
| `esp` | `C12A7328-F81F-11D2-BA4B-00A0C93EC93B` | 2048 | 512 MiB |
| `system` | `0FC63DAF-8483-4772-8E79-3D69D8477DE4` | 1050624 | 1024 MiB |
| `data` | `0FC63DAF-8483-4772-8E79-3D69D8477DE4` | 3147776 | 256 MiB |

The ESP is FAT, labelled `MICAESP`, and carries `EFI/BOOT/BOOTX64.EFI` and
`loader/loader.conf`. The image boots wherever UEFI firmware starts
`BOOTX64.EFI`, so the whole image goes to the target medium. `uefi-arm64` has
the same three partitions at the same sectors and `BOOTAA64.EFI`; `mini-x64`
has a 16 MiB ESP, a 98 MiB SYSTEM and a 12 MiB DATA, for 128 MB of flash.

> status: shipped — evidence: `mica-build:boards/uefi-x64/board.env`, `mica-build:src/image/file-layout.ts`

### Which media the kernel can drive

The pinned uefi-x64 kernel has built in: USB host XHCI and EHCI with
`USB_STORAGE`, SATA through AHCI and `ATA_PIIX`, NVMe, and virtio-blk and
virtio-scsi for VMs. `CONFIG_USB_UAS` is not set, so a UAS-only enclosure
falls back to bulk-only transport or is not driven, and `CONFIG_MMC` is not
set at all: an SD card reader on an MMC controller is not driven, though a USB
card reader is ordinary USB mass storage.

So the driver answer is USB sticks and disks, SATA and NVMe. Which of those
media the assembly qualifies is still open — nothing physical has been tested.

> status: board-dependent — evidence: `mica-build:boards/uefi-x64/kernel/config/uefi-x64.config`, `mica-build:make kernel-config-test`

### Writing it (not verified)

No physical uefi-x64 write has been performed or witnessed here. The commands below
are the form the assembly would document; publish nothing from this block as
qualified, and expect the target identification to be the risky part:

> ```sh
> # NOT VERIFIED: never run against physical hardware by this project
> lsblk -o NAME,SIZE,TYPE,TRAN,MODEL,MOUNTPOINTS      # before and after plugging it in
> udevadm info --query=property --name=/dev/sdX | grep -E 'ID_BUS|ID_MODEL|ID_SERIAL'
> gzip -dc mica-uefi-x64.basic-<stamp>.img.gz | sudo dd of=/dev/sdX bs=4M status=progress conv=fsync
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

The firmware must still *have* Secure Boot, switched off: the early init reads
the firmware's `SecureBoot` variable and refuses the boot when there is none.
Under QEMU that is the difference between the two firmware builds
(section 4.1); a machine whose firmware never implemented Secure Boot does not
boot these images. Section 4.5 shows how to read the certificate out of an
image.

> status: unsupported

## 4. QEMU: uefi-x64, mini-x64 and uefi-arm64

A UEFI product's disk image boots under QEMU as it is: no conversion, no
extra file. This is the path that is actually run. The amd64 walk-through
below was run end to end against the published `mini-x64.basic` image
(release `20261003-1916`, QEMU 10.0 under software emulation); the arm64 line
is the one the acceptance suite runs.

### 4.1 What you need

On Debian or Ubuntu:

```sh
sudo apt-get install qemu-system-x86 ovmf curl jq             # amd64 guests
sudo apt-get install qemu-system-arm qemu-efi-aarch64         # arm64 guests
sudo apt-get install python3-virt-firmware sbsigntool mtools  # only for Secure Boot on (4.5)
```

| Guest | QEMU | Firmware code | Variable store template |
|---|---|---|---|
| amd64 (`uefi-x64`, `mini-x64`) | `qemu-system-x86_64 -machine q35` | `/usr/share/OVMF/OVMF_CODE_4M.secboot.fd` | `/usr/share/OVMF/OVMF_VARS_4M.fd` |
| arm64 (`uefi-arm64`) | `qemu-system-aarch64 -machine virt` | `/usr/share/AAVMF/AAVMF_CODE.secboot.fd` | `/usr/share/AAVMF/AAVMF_VARS.fd` |

**Use the `secboot` firmware build even with Secure Boot off.** The early init
reads the firmware's `SecureBoot` variable, and a firmware built without
Secure Boot support has none: the boot is then refused
(`boot selection could not be established`).

### 4.2 Take the image

```sh
PRODUCT=mini-x64.basic        # or uefi-x64.basic, uefi-x64.full, uefi-arm64.basic, ...
curl -fsS https://res.micaos.dev/update/products/v1.json -o products.json
BASE=$(jq -r .baseUrl products.json)
jq -r --arg p "$PRODUCT" '.products[] | select(.product == $p) | .latest.files[]
      | select(.kind == "image" and .form == "disk") | "\(.path) \(.sha256) \(.uncompressedSha256)"' products.json |
while read -r path sha256 raw; do
  curl -fsSLO "$BASE$path"
  echo "$sha256  ${path##*/}" | sha256sum -c -
  gzip -dc "${path##*/}" > disk.img
  echo "$raw  disk.img" | sha256sum -c -
done
```

A product with no release prints nothing here; it is built from source
([build](build.md)) and its image is `_out/products/<product>/image/` of the
`mica-build` checkout. What else can be checked about a release is
[download](download.md).

The guest writes to `disk.img`. Keep the download and work on the copy, and
give DATA room: it ships small and grows to the end of the disk on first boot.

```sh
truncate -s 4G disk.img
```

### 4.3 Boot it, amd64

```sh
cp /usr/share/OVMF/OVMF_VARS_4M.fd vars.fd
qemu-system-x86_64 -machine q35 -cpu max -m 1024 -smp 2 \
  -nographic -no-reboot \
  -device i6300esb -watchdog-action reset \
  -netdev user,id=net0,hostfwd=tcp:127.0.0.1:8080-:8080,hostfwd=tcp:127.0.0.1:2222-:22 \
  -device virtio-net-pci,netdev=net0 \
  -drive if=pflash,format=raw,unit=0,readonly=on,file=/usr/share/OVMF/OVMF_CODE_4M.secboot.fd \
  -drive if=pflash,format=raw,unit=1,file=vars.fd \
  -drive if=none,id=disk0,format=raw,file=disk.img \
  -device virtio-blk-pci,drive=disk0,bootindex=0
```

Each part is there for a reason:

- `-device i6300esb` is **required**. The early init arms a watchdog before
  it does anything else and refuses the boot when there is none
  (`boot refused: required watchdog unavailable`).
- `vars.fd` is a fresh copy of the template: no key is enrolled, so Secure
  Boot is off and the guest boots without being given a certificate. The root
  is verified all the same: the kernel requires a valid signature on every
  verity mapping whatever the firmware does.
- `hostfwd` brings the management API, on the guest's port 8080, to
  `127.0.0.1:8080` on the host, and SSH to port 2222 for when it is enabled.
- `-nographic` puts the serial console on the terminal. Leave QEMU with
  `Ctrl-a x`.
- Add `-enable-kvm` on a host of the guest's own architecture; without it the
  guest is emulated, and comes up in about fifteen seconds all the same.

### 4.4 What a healthy boot looks like

On the console, in order: the early init (`mica-init: boot watchdog armed`,
`selected deployment <id>`, `verified deployment <id>`), the root's init
starting its services, DATA growing to the end of the disk, and the health
gate's last line:

```
mica-health: booted slot <id> marked good (PENDING_CONFIRM -> CONFIRMED)
```

Then, from the host:

```sh
curl http://127.0.0.1:8080/healthz
curl http://127.0.0.1:8080/api/v1/session        # {"state":"setup"}: the device is unclaimed
```

A product that carries the web console (`uefi-x64.*`, `uefi-arm64.*`) serves
it at `http://127.0.0.1:8080/`, and its first page sets the administrator
password. A product without it (`mini-x64.basic`) is claimed over the API:

```sh
curl -X POST -H 'content-type: application/json' \
  -d '{"password":"at-least-eight-bytes"}' http://127.0.0.1:8080/api/v1/setup   # 201
```

What claiming means, and what comes after it, is [first run](first-run.md).
Power the guest off from the API or the console, or leave QEMU with
`Ctrl-a x`; the device's state is in `disk.img` and `vars.fd`, and the next
start continues from it.

### 4.5 With Secure Boot on

Secure Boot on means the firmware refuses any loader it has no certificate
for. Enrol the certificate the release is signed with into the variable
store, in place of the plain copy of 4.3:

```sh
# The certificate, read out of the image's own boot loader. The ESP starts at
# sector 2048 on every UEFI board; the loader is BOOTAA64.EFI on arm64.
mcopy -i disk.img@@$((2048*512)) ::EFI/BOOT/BOOTX64.EFI loader.efi
sbattach --detach loader.sig loader.efi
openssl pkcs7 -inform DER -in loader.sig -print_certs -out db.cert.pem
openssl x509 -in db.cert.pem -noout -subject -fingerprint -sha256

virt-fw-vars --input /usr/share/OVMF/OVMF_VARS_4M.fd --output vars.fd \
  --set-pk 6b62601e-3448-4418-8923-7c9fa22ab09b db.cert.pem \
  --add-kek 6b62601e-3448-4418-8923-7c9fa22ab09b db.cert.pem \
  --add-db 6b62601e-3448-4418-8923-7c9fa22ab09b db.cert.pem --no-microsoft --sb
```

Then start QEMU exactly as in 4.3, without the `cp`. The console says
`UEFI Secure Boot is enabled`.

A certificate read out of the image proves only that the loader is signed
with it. To know who signed, compare its fingerprint with the one the
release's publisher gives you through another channel. Releases so far are
signed with the development certificate, `CN=MICA-development-boot`, which
establishes no production trust ([security lifecycle](../security/lifecycle.md)).

### 4.6 arm64

`uefi-arm64` is the same procedure with the other firmware and machine; the
image's console is PL011 and there is no other:

```sh
cp /usr/share/AAVMF/AAVMF_VARS.fd vars.fd
qemu-system-aarch64 -machine virt -cpu max -m 1024 -smp 2 \
  -nographic -no-reboot \
  -device i6300esb -watchdog-action reset \
  -netdev user,id=net0,hostfwd=tcp:127.0.0.1:8080-:8080,hostfwd=tcp:127.0.0.1:2222-:22 \
  -device virtio-net-pci,netdev=net0 \
  -drive if=pflash,format=raw,unit=0,readonly=on,file=/usr/share/AAVMF/AAVMF_CODE.secboot.fd \
  -drive if=pflash,format=raw,unit=1,file=vars.fd \
  -drive if=none,id=disk0,format=raw,file=disk.img \
  -device virtio-blk-pci,drive=disk0,bootindex=0
```

On an amd64 host every instruction is emulated, so expect minutes where the
amd64 guest takes seconds. For Secure Boot on, 4.5 applies with
`AAVMF_VARS.fd` and `BOOTAA64.EFI`.

The acceptance suite runs this line with the certificate enrolled, which is
the evidence the board has. Booting it with the plain variable store, as
above, follows from the same code path the amd64 run exercised and has not
been run here: no `uefi-arm64` product has a release yet.

`virtio-blk-pci` and `virtio-net-pci` are what the suite uses. The kernel also
drives AHCI, NVMe, USB storage and the common NICs, so another disk or network
model boots in principle, untested like every non-virtio path here. There is
no MMC driver, on purpose.

### 4.7 When it does not come up

| On the console | Cause | Do |
|---|---|---|
| `boot refused: required watchdog unavailable` | no watchdog device | add `-device i6300esb -watchdog-action reset` |
| `boot selection could not be established`, right after `signature policy ready` | the firmware has no `SecureBoot` variable | use the `secboot` firmware build of 4.1 |
| the firmware's own shell or boot menu, no kernel output | Secure Boot is on and the certificate is not enrolled, or the disk is not the boot device | rebuild `vars.fd` (4.3 or 4.5); keep `bootindex=0` |
| nothing answers on `127.0.0.1:8080` | the `hostfwd` rule is missing, or the port is taken on the host | choose another host port |
| the guest restarts by itself | the watchdog fired because the boot stalled | read the console above the restart |

### 4.8 Offline updates and the acceptance suite

An offline update medium is handed in over 9p:

```sh
  -fsdev local,id=import,path=/path/to/offline,security_model=none,readonly=on \
  -device virtio-9p-pci,fsdev=import,mount_tag=mica-update
```

and imported on the device:

```sh
mount -t 9p -o trans=virtio,version=9p2000.L,ro mica-update /run/mica/import
mica-deploy import /run/mica/import/update.micaupd
```

The whole acceptance suite — boot, runtime, updates, faults, reset, shutdown —
is one target in a `mica-build` checkout, over a product built there:

```sh
make lifecycle-uefi PRODUCT=uefi-x64.dev
```

> status: shipped — evidence: `mica-build:tests/suites/lifecycle-uefi/boot.sh`, `mica-build:make lifecycle-uefi`, `mica-core:crates/mica-deploy/src/bin/mica-runkit/init/boot.rs`, `mica-build:boards/uefi-arm64/kernel/config`

A stock release image boots to its services. The `FILE_AB_*` markers the
acceptance console prints come from the suite's own in-image script, not from
a shipped image; do not expect them on a device.

> status: shipped — evidence: `mica-build:tests/suites/lifecycle-uefi/boot.sh`

## 5. cx3576

On cx3576 the image is the whole medium and carries the bootloader: GPT with
`FIRMWARE` (LBA 64–36863), `SYSTEM` (36864–2134015, ext4 + verity) and `DATA`
(2134016–2658303). Our U-Boot (`u-boot-rockchip.bin`, idbloader + FIT) sits at
sector 64, inside the protected range — the four bytes `RKNS` at byte offset
32768 are its magic — and the two 64 KiB CRC-protected boot records are at
16 MiB and 17 MiB. Writing the image writes the bootloader too: there is no
separate idblock step, and no vendor `update.img` is produced for this board.

The write path is `rkdeveloptool` over USB, run by the operator; the build
tree carries no flashing tooling. **It must be the
decompressed `.img`**, exactly 1 299 MiB = 1 362 100 224 bytes.

| Step | Loader/RockUSB mode | Maskrom mode |
|---|---|---|
| 1 | -- | `sha256sum -c boards/cx3576/loader/MiniLoaderAll.bin.sha256` |
| 2 | -- | `rkdeveloptool db boards/cx3576/loader/MiniLoaderAll.bin` |
| 3 | `rkdeveloptool wl 0 <image>` | the same |
| 4 | `rkdeveloptool rl 0 36864 boot.bin`, compared with the image's first 36 864 sectors; then `rkdeveloptool rl 36864 2623488 rest.bin`, compared with the rest | the same |
| 5 | `rkdeveloptool rd` -- the reset, only after both comparisons passed | the same |

The loader region is read back first and on its own, because a partial or
corrupt write there is the one failure that bricks the board past the
recovery key. The committed vendor loader `boards/cx3576/loader/MiniLoaderAll.bin`
(786 937 bytes) is downloaded into RAM by `rkdeveloptool db`; it is never
embedded in the image and is not a U-Boot build input. **Do not cut power,
unplug or reset the board between `db` and `rd`.**

If a readback differs, `rd` is not run: the device stays in Loader mode and
can be re-flashed straight away. Recovery for a board that no longer boots is
Maskrom, the SoC's USB recovery mode, and the Maskrom column above.

Operator prerequisites: `rkdeveloptool` on `PATH` and USB access to the
device. On macOS build it natively at the pinned upstream commit with the two
patches kept in [`docs/hardware/cx3576/rkdeveloptool`](../hardware/cx3576/rkdeveloptool/README.md).

> status: board-dependent — evidence: `mica-build:boards/cx3576/loader/MiniLoaderAll.bin.sha256`, `docs/hardware/cx3576/rkdeveloptool/README.md`, `docs/hardware/cx3576.md`

> status: unsupported

## 6. s905x5m

The board starts Mica OS U-Boot from the eMMC boot0 area, never from the disk
image, so every route begins with Amlogic USB burning. Neither route below has
been run on a unit by this project; the build unpacks every package it makes
and proves each payload is its source.

**Entering USB burning mode.** Hold the recovery key while applying power,
with the board's USB port connected to the host. The board then waits for the
vendor's USB Burning Tool instead of booting; releasing the key before power
is applied boots normally.

### 6.1 The eMMC products: `s905x5m.basic` and `s905x5m.emmc-full`

A release carries one file to write, the USB burning package
`mica-s905x5m.<variant>-<stamp>.burn.img.gz`, and no disk image.

1. Download it and check its sha256 ([download](download.md)), then decompress
   it: `gzip -dk mica-s905x5m.<variant>-<stamp>.burn.img.gz`.
2. Put the board into USB burning mode.
3. Load the `.burn.img` in the vendor's USB Burning Tool and burn it. It writes
   the partition table, both bootloader targets, the vendor device tree and
   the three Mica OS partitions, and leaves the vendor's other partitions
   alone.
4. Disconnect and power the board on. It starts from its eMMC.

Burning replaces the system and the data on the eMMC: it is an installation,
not an update.

### 6.2 The SD product: `s905x5m.sd-full`

A release carries two files: the disk image `mica-s905x5m.sd-full-<stamp>.img.gz`
and the boot loader package `mica-s905x5m.sd-full-<stamp>.sd-boot.img.gz`.
The disk image covers the SD medium only — `FIRMWARE` at sector 64, `SYSTEM`,
`DATA` — so writing it to a card installs no boot loader, and the loader
refuses an automatic boot when it was not itself started from boot0.

1. **Once per board, the boot loader.** Decompress the `.sd-boot.img.gz`, put
   the board into USB burning mode and burn the `.sd-boot.img` with the
   vendor's USB Burning Tool. It installs Mica OS U-Boot in eMMC boot0 and
   touches nothing else. A later release needs this again only when its loader
   changed.
2. **The system, onto a card.** Decompress the `.img.gz` and write it to the
   whole SD card, never to a partition, as in section 3:

   ```sh
   gzip -dc mica-s905x5m.sd-full-<stamp>.img.gz | sudo dd of=/dev/sdX bs=4M status=progress conv=fsync
   ```

3. Insert the card and power the board on. It starts the system on the card.

Take both files from the same release: the loader accepts only a kernel
signed with the certificate built into it.

> status: unsupported

## 7. First boot

- **DATA grows.** On a systemd product `systemd-repart` grows the DATA
  partition to the device and `systemd-growfs@mnt-data` grows its filesystem;
  both units must be active, and the acceptance suite fails a boot where they
  are not. An OpenRC product grows it with `mica-data-layout`.
  `make os-repart-test` (privileged docker) proves the growth cannot wipe the
  loader; it exists and CI does not run it.
- **Two deployments from the start.** The factory image carries two signed
  deployment records, generations g-1 and g. On the device that is exactly two descriptors in
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
  report the running deployment id; the `product` row of a release's
  `mica-build.lock` names the deployment id it published:
  `awk -F'\t' '$1 == "product"' mica-build.lock`.

> status: shipped — evidence: `mica-build:src/image/file-image.ts`, `mica-build:make os-repart-test`, `mica-core:crates/mica-deploy`, `docs/reference/storage.md`

No full device cycle — write, first boot, update, confirmation, rollback — has
been run on hardware. The device-side half of this section is read out of
`mica-core` and exercised in QEMU, not on a board.

> status: unsupported

## 8. What flashing does not cover

- **One vendor format.** A release carries its images and its update
  archives; the only vendor format is the Amlogic USB burning package, which
  `s905x5m` uses for its eMMC products and for its boot loader.
- **No partition-level A/B.** Both deployments are files on SYSTEM, so there
  is no "other slot" to flash ([updates](../reference/updates.md)).
- **No upgrade by re-flashing.** Writing an image wipes DATA. To move a
  running device to a newer release, take an update archive
  ([updates](../operate/updates.md)).

> status: shipped — evidence: `mica-build:boards/uefi-x64/images.tsv`, `docs/reference/updates.md`, `docs/operate/updates.md`
