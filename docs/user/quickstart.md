# Quickstart

The shortest honest path to a running Mica OS system is a published `x64-dev`
image under QEMU. That is also the only path that is qualified today: no
physical machine has been booted from a release image
([flashing](flashing.md)).

## 1. What you need

To run a published image: `curl`, `jq`, `sha256sum`, `gzip` and
`qemu-system-x86_64` with OVMF secure-boot firmware. To build one instead:
docker with a working daemon, plus bash, make, git and python3 — every
compiler, filesystem maker and signing tool runs inside the pinned build-env
images.

> status: shipped — evidence: `mica-build:tests/lifecycle-uefi/boot.sh`, `mica-build:Makefile`, `docs/user/build.md`

## 2. Take a published image

```sh
REL=https://github.com/micaoss/mica-build/releases/download
curl -fsSLO "$REL/x64/<release>/SHA256SUMS"
curl -fsSLO "$REL/x64/<release>/mica-x64-dev-<release>.img.gz"
sha256sum -c SHA256SUMS
gzip -dc mica-x64-dev-<release>.img.gz > disk.img
```

Which release, and how to check the decompressed image against the version
index, is [download](download.md). The image is a whole GPT disk — ESP,
SYSTEM and DATA — carrying two signed deployment records.

> status: shipped — evidence: `docs/user/download.md`, `mica-build:build/src/file-layout.ts`

## 3. Boot it under QEMU

The guest must trust the release's boot certificate: the acceptance suites
enroll it into throwaway secure-boot variables (`vars.fd` from `OVMF_VARS.fd`,
`AAVMF_VARS.fd` on ARM64) and boot the image as a virtio disk. The reference
command lines are in [flashing](flashing.md#4-qemu-x64-and-virt-arm64).

From a `mica-build` checkout the whole thing is one target:

```sh
make lifecycle-uefi PRODUCT=x64-dev
```

It boots the product and exercises runtime, updates, faults, reset and
shutdown.

> status: shipped — evidence: `mica-build:tests/lifecycle-uefi/boot.sh`, `mica-build:make lifecycle-uefi`

## 4. Or build the image first

```sh
make locks-verify
make os-pool
make product PRODUCT=x64-dev
make product-verify PRODUCT=x64-dev
```

The result lands in `mica-build:_out/products/x64-dev/`. A build never invents
keys or inputs: signing material is explicit (`make os-devkeys` writes a
development set) and every input comes from `locks/`. The full path, online
and offline, is the [build guide](build.md).

> status: shipped — evidence: `mica-build:Makefile`, `mica-build:tools/product-build.sh`, `docs/user/build.md`

## 5. First contact

The first boot establishes a machine identity on DATA before services start,
grows DATA to the medium, and brings up micad and apid; wired interfaces use
DHCP, the dashboard is at `/_ui/` over HTTPS, and SSH is off by default. See
[first run](first-run.md) and [configuration](configuration.md).

> status: shipped — evidence: `mica-core:crates/micad`, `mica-core:crates/mica-apid`, `docs/design/provisioning.md`

## 6. Next steps

- [Flashing](flashing.md) — writing an image to a board, per board.
- [Update and rollback](update-rollback.md) and
  [update packages](update-packages.md) — moving a running device forward.
- [Applications](applications.md) — workloads and persistent data.

> status: shipped — evidence: `docs/user/flashing.md`, `docs/user/update-packages.md`, `docs/user/applications.md`
