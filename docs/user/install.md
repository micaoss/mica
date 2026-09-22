# Installing Mica OS on a device

Installation is a whole-image write: a complete factory image replaces the
target medium. There is no conversion or upgrade path from an earlier
partition layout, and nothing inside the written extent survives. A device
already running Mica OS moves forward with an update archive instead
([update packages](update-packages.md)).

This page is the order of operations. The per-board write procedure — and
which boards have one — is [flashing](flashing.md).

> status: shipped — evidence: `mica-build:src/image/file-layout.ts`, `docs/user/flashing.md`, `docs/design/storage.md`

## 1. Choose and verify the image

An image is published per product as `mica-<product>-<release>.img.gz` and is
bound to one board and architecture; the profile (`dev` or `prod`) is fixed in
the signed kernel command line of that product. Take the file from a release,
check it against `SHA256SUMS`, and check the decompressed image against
`uncompressedSha256` in the version index: [download](download.md). For an
image you built yourself, `make product-verify PRODUCT=<name>` is the
equivalent gate.

A checksum proves the file arrived intact. It says nothing about who signed
it: obtain the release's public boot certificate through the handover it
belongs to ([key delivery](../design/key-delivery.md)), not from beside the
download.

> status: shipped — evidence: `docs/user/download.md`, `mica-build:make product-verify`, `docs/design/key-delivery.md`

## 2. Make the board trust the signer

The image's kernel and support components are signed, and verification at
install time does not enroll anything. A UEFI board must already carry the
release's boot certificate in its platform keys — or run with Secure Boot off,
which is not an installation Mica OS treats as trusted — and a FIT board's
U-Boot accepts only a kernel signed by the certificate built into it.
Development releases are signed with development certificates and establish no
production trust.

> status: shipped — evidence: `docs/design/release-signing.md`, `mica-boards:common/trust/stage.sh`, `docs/boards/assurance.md`

## 3. Write the image

| Board | How | State |
|---|---|---|
| `uefi-x64` | the whole image to the medium; boots through UEFI | qualified under QEMU only |
| `uefi-arm64` | the whole image to the medium; boots through UEFI with ACPI | release target since 2026-09-16; qualified under QEMU only |
| `cx3576` | `rkdeveloptool` over USB from `mica-boards`, with readback | not verified on hardware |
| `s905x5m` | no supported path: the loader lives in eMMC boot0 | bring-up work |

Each case, with its commands, its refusals and what is not verified, is in
[flashing](flashing.md).

> status: board-dependent — evidence: `docs/user/flashing.md`, `mica-boards:boards/cx3576/Makefile`, `mica-boards:boards/s905x5m/board.env`

## 4. First boot

A healthy first boot authenticates the selected deployment, mounts the
matching signed root and support, establishes the device identity on DATA,
grows DATA to the medium and starts the management services. Health
confirmation keeps the other deployment as a fallback. What to expect and what
to do next is [first run](first-run.md).

Missing or corrupt shared storage, or exhausted boot records, needs explicit
recovery: there is no unsigned retry, no old-layout fallback, no regenerated
credential and no silent refill of the trial counter. See
[recovery](recovery.md) and [storage](storage.md).

> status: shipped — evidence: `mica-core:crates/mica-deploy`, `mica-system-base:debs/mica-system`, `docs/design/recovery.md`
