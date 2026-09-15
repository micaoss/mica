# Install a current development image

Installation uses a complete freshly built Mica OS system image. The supported image
targets are x64, virt-arm64 and cx3576. There is no conversion or upgrade path
from an earlier partition layout. A full write replaces the target system and
data inside the written image extent; keep any files you need elsewhere first.

> status: shipped — evidence: `mica-build:build/src/file-image.ts`, `mica-boards:boards/x64/board.env`, `mica-boards:boards/virt-arm64/board.env`, `mica-boards:boards/cx3576/board.env`

## Prepare and identify

Factory image names use `mica-BOARD-YYYYMMDD-HHmmss.img`, with UTC build time
to the second distinguishing builds. Use the actual delivered filename in the
commands below.

Use the exact board's image and obtain its metadata public key from the build's
trusted handover. Run the image verifier with explicit inputs:

```sh
bash verify/run.sh --verify --board x64 \
  --image /path/to/image/mica-x64-20260909-164233.img --public-key /path/to/metadata-public.key
```

Substitute `virt-arm64` or `cx3576` only for that board's own image. Verification
checks signed objects and layout; it does not enroll platform boot keys. The
boot signer must be accepted by the corresponding UEFI platform or signed-policy
U-Boot build. Development key generation does not establish production trust.

> status: shipped — evidence: `mica-build:verify/src/file-image.ts`, `docs/design/key-delivery.md`

## x64 and virt-arm64

Write the complete image to the explicitly identified disposable target medium
using the platform's disk-writing workflow, flush it and compare readback before
booting. Boot through UEFI from its removable-media EFI entry. The disk contains
ESP/SYSTEM/DATA; only DATA grows when the physical medium is larger.

For virtual acceptance, the repository harness uses a fresh disk copy and
explicit public boot certificate:

```sh
MICA_PRODUCT=x64-dev bash mica-build:tests/apid-api/run.sh
```

The product names the board, the image and the boot signer; a copied release
image and its certificate are given as `MICA_QEMU_IMAGE` and
`MICA_QEMU_BOOT_CERT`. The ARM64 variant is `MICA_PRODUCT=virt-arm64-dev`.
Physical PC/platform enrollment is owned by that platform's operator.

> status: board-dependent — evidence: `mica-core:tests/apid-api/src/qemu.ts`, `docs/design/release-signing.md`

## cx3576

Use the local bench board's RockUSB loader/maskrom interface and identify the
attached device before writing. The board BSP in `mica-boards` provides complete-image flashing:

```sh
make cx3576-flash-mica MICA_IMAGE=/path/to/image/mica-cx3576-20260909-164233.img
```

Without `MICA_IMAGE`, the BSP selects the newest timestamped cx3576 image in
`_out/cx3576/image/`. Set `MICA_IMAGE` explicitly to flash a particular build.

Preflight checks the current GPT and loader placement before issuing a device
write. The flashing path reads back and compares every image byte before reset;
a mismatch leaves the board in the recovery interface. Firmware starts at LBA
64, and its reserved partition includes both trial-record copies.

Physical loader/maskrom entry, full flashing, successful boot, watchdog behavior
and power-cut recovery remain bench qualification items. Host stub tests prove
preflight/readback control flow, not that a particular board has been flashed.
Do not treat software evidence as a completed physical installation.

> status: board-dependent — evidence: `mica-boards:boards/cx3576/Makefile`, `mica-boards:boards/cx3576/flash/scripts/verify-flash.sh`, `mica-boards:boards/cx3576/flash/scripts/verify-flash.py`

## First boot and recovery

Healthy boot authenticates the selected deployment, mounts matching signed
root/support, establishes persistent identity on DATA, grows DATA and starts
management services. Health confirmation retains a usable fallback. Use the
[update page](update-rollback.md) for subsequent component updates.

Missing/corrupt shared storage or exhausted boot records requires explicit
recovery. No unsigned retry, old layout, regenerated credentials or silent trial
refill is used. See [recovery](recovery.md) and [storage](storage.md).

> status: shipped — evidence: `mica-deploy:src/bin/mica-init.rs`, `mica-system:overlay/usr/lib/mica/mica-health`
