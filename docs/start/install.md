# Installing Mica OS on a device

Installation is a whole-image write: a complete factory image replaces the
target medium. There is no conversion or upgrade path from an earlier
partition layout, and nothing inside the written extent survives. A device
already running Mica OS moves forward with an update archive instead
([updates](../operate/updates.md)).

This page is the order of operations. The per-board write procedure — and
which boards have one — is [flashing](flashing.md).

> status: shipped — evidence: `mica-build:src/image/file-layout.ts`, `docs/start/flashing.md`, `docs/reference/storage.md`

## 1. Choose and verify the image

A product's release carries what it is installed from: a disk image,
`mica-<board>.<variant>-<stamp>.img.gz`, or for the `s905x5m` eMMC products a
USB burning package. It is bound to one board and architecture; the profile
(`dev` or `prod`) is fixed in the signed kernel command line of that product.
Take the file from a release and check its sha256, and the decompressed
image's, against what the release states: [download](download.md). For an
image you built yourself, `make product-verify PRODUCT=<name>` is the
equivalent gate.

A checksum proves the file arrived intact. It says nothing about who signed
it: obtain the fingerprint of the release's boot certificate from its
publisher through another channel, not from beside the download
([security lifecycle](../security/lifecycle.md)).

> status: shipped — evidence: `docs/start/download.md`, `mica-build:make product-verify`

## 2. Make the board trust the signer

The image's kernel and support components are signed, and verification at
install time does not enroll anything. A UEFI board must already carry the
release's boot certificate in its platform keys — or run with Secure Boot off,
which is not an installation Mica OS treats as trusted, and which still needs
a firmware that has Secure Boot — and a FIT board's
U-Boot accepts only a kernel signed by the certificate built into it.
Development releases are signed with development certificates and establish no
production trust.

> status: shipped — evidence: `docs/security/signing.md`, `mica-build:src/boot/trust-stage.ts`, `docs/hardware/assurance.md`

## 3. Write the image

| Board | How | State |
|---|---|---|
| `uefi-x64` | the whole image to a USB stick, SATA disk or NVMe drive; boots through UEFI | run under QEMU only |
| `uefi-arm64` | the whole image to the medium; boots through UEFI with ACPI | run under QEMU only |
| `mini-x64` | the whole image to a SATA, NVMe, SD or eMMC medium, not USB; boots through UEFI | run under QEMU only |
| `cx3576` | `rkdeveloptool` over USB, with read-back | not verified on hardware |
| `s905x5m` | the USB burning package for the eMMC products; for `sd-full`, the boot loader package by USB burning, then the disk image to an SD card | not verified on hardware |

Each case, with its commands, its refusals and what is not verified, is in
[flashing](flashing.md). The UEFI products also boot under QEMU from the same
image, with no device at all ([flashing](flashing.md) section 4).

> status: board-dependent — evidence: `docs/start/flashing.md`, `mica-build:boards/cx3576/images.tsv`, `mica-build:boards/s905x5m/images.tsv`

## 4. First boot

A healthy first boot authenticates the selected deployment, mounts the
matching signed root and support, establishes the device identity on DATA,
grows DATA to the medium and starts the management services. Health
confirmation keeps the other deployment as a fallback. What to expect and what
to do next is [first run](first-run.md).

Missing or corrupt shared storage, or exhausted boot records, needs explicit
recovery: there is no unsigned retry, no old-layout fallback, no regenerated
credential and no silent refill of the trial counter. See
[recovery](../operate/recovery.md) and [storage](../operate/storage.md).

> status: shipped — evidence: `mica-core:crates/mica-deploy`, `mica-system-base:debs/mica-system`, `docs/reference/recovery.md`
