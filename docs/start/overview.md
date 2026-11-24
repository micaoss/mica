# Mica OS in one page

Mica OS is an embedded Linux system for industrial devices: a signed,
read-only dm-verity root, an independently signed kernel and support image,
two file-based A/B deployments, and a local management API with a dashboard.
A device runs one *product*: a board plus a variant, which fixes the init and
the features that product selects. This page names the pieces, how a release
is built from them, and where the files are.

The system map is [../architecture.md](../architecture.md). A system is built
from source with [build](build.md), an image reaches a board through
[flashing](flashing.md), updates are chosen with
[update packages](../operate/updates.md), a maintainer cuts a release with
[releasing](../releases/how-releases-work.md), and a new board is brought up with
[porting](https://github.com/micaoss/mica-build/blob/main/boards/README.md).

## 1. The repositories

| Repository | Produces |
|---|---|
| `mica-build-tools` | the one implementation of the release-lock and build rules, `bin/mica-tools` in every other repository |
| `mica-build-env` | the build images `base`, `c`, `go`, `rust` and `bsp`, and the rules every repository builds under |
| `mica-system-base` | the board-independent base: the pinned Debian packages, the Base's own packages (the system policy, busybox, the two inits `mica-systemd` and `mica-openrc`, SSH, Wi-Fi, Bluetooth, time zones) and the floor root, which carries no init |
| `mica-core` | the core components `micad` (with `mica-apid`) and the console `mica-apid-ui` — verity images composed over the root at boot, so they update without a new root — and the packages `mica-deploy` and `mica-lifecycle` |
| `mica-pkgs` | the feature packages a product chooses: the MQTT broker and bridge, each with its services for both inits, the SFTP server, and the Compute Engine agent of the cloud products |
| `mica-podman` | the container engine package `mica-podman`, with its supervisor `mica-containerd`, on either init |
| `mica-docker` | the Docker engine package `mica-docker`, the other container engine a product may carry |
| `mica-linux`, `mica-uboot` | the kernel and U-Boot trees the boards build: upstream mirrors and one branch per board, pinned by commit |
| `mica-build` | the boards (per board: the kernel, U-Boot, firmware, board metadata and the board package) and the assembly: it composes each product's root, signs the components, and publishes the images, the update archives and the core sets |
| `mica-res` | the resource service, `res.micaos.dev`: every release's files, the device update catalog and the transfer indexes |
| `mica` | this repository: the guides, the contracts and the website |

> status: shipped — evidence: `docs/architecture.md`, `docs/reference/release-lock.md`, `mica-build:boards`, `mica-system-base:docs/floor-and-options.md`

## 2. The release chain

Each repository publishes releases, and each consumer pins the releases it
builds on as a lock plus a pin record, never a branch
([release lock](../reference/release-lock.md)). Every pin is its producer's
latest release: `bin/mica-tools locks update` moves them all, and
`--check` only reports which are behind.

```text
mica-build-env ─▶ mica-system-base ─▶ mica-podman ─┐
               │                  ├─▶ mica-docker ─┤
               │                  └─▶ mica-pkgs ───┤
               └─▶ mica-core ─────────────────────┴─▶ mica-build ─▶ <board>.<variant>.<stamp>
                                                                  └▶ core.<channel>.<stamp>
```

- `mica-build-env` is the floor of the build: every other repository builds
  inside its images. It moves its pins monthly and releases when green.
- `mica-system-base` publishes the floor root and the package pools that
  products install, and updates itself monthly (the Debian snapshot, the
  upstream sources, the trust anchors), releasing when green.
- `mica-core`, `mica-pkgs`, `mica-podman` and `mica-docker` publish their
  packages into their own pools; `mica-podman` and `mica-docker` move to
  upstream's latest release weekly and release when green.
- `mica-build` releases **one product at a time**,
  `<board>.<variant>.<YYYYMMDD-HHMM>`, through its `release.yml`: the
  product's board components and pool, and the product itself, a compressed
  disk image and the update archives. There is no index of releases; a
  product's newest release is the one to take. A `dev` product is never
  released. A *core release*, `core.<channel>.<YYYYMMDD-HHMM>` through
  `release-core.yml`, publishes the core components alone as a core set, so a
  `mica-core` release reaches devices without a new root.
- The release run then posts the release to the resource service
  (`mica-build:README.md`): the files are served from
  `https://dl.res.micaos.dev/mica/<board>.<variant>/<stamp>/`, each object
  with its transfer index, and `https://res.micaos.dev/update/` is the update
  root a device is configured with and the website's download pages read. The
  GitHub release of `mica-build` carries the same files.
- Every repository's history and releases are kept short: a repository may be
  squashed to one commit and its superseded releases deleted, so a document
  names a release only where it is the current one.

> status: shipped — evidence: `docs/reference/release-lock.md`, `mica-build:README.md`, `mica-build-tools:README.md`

## 3. Products and boards

A board is one of two kinds: a **generic system**, named for its firmware
class and architecture (`uefi-x64`, `uefi-arm64`, `mini-x64`), whose one image
serves every machine of that class; or a **hardware board**, named for the
hardware (`cx3576`, `s905x5m`, `ssd202d`). `qemu-armhf` is QEMU's 32-bit Arm machine,
with no hardware behind it. A board name never contains a dot; a
product, tag or file name is parsed at its dots.

The kernel, the loader and the partition layout belong to a board; what is
installed in the root belongs to a product; the file a user downloads is an
image kind of that product (the board's `images.tsv`). So a variant is:

| The variant changes | It is |
|---|---|
| the kernel, the loader or the disk layout | a new board |
| only what is installed in the root | a product on an existing board |
| only the file format that is downloaded | an image kind, selected per product |

A product is `<board>.<variant>` (`mica-build:boards/products.md`). The
variant names what the product is for, and each board names its own: no
variant is a default, and none is defined as another plus a feature. The
products today, and which of them are released:

| Product | What it carries | Released |
|---|---|---|
| `cx3576.full` | systemd, the management plane and the console, OpenSSH, the tools, MQTT, WiFi and Bluetooth, Docker | yes |
| `s905x5m.emmc-full`, `s905x5m.sd-full` | systemd, the management plane and the console, Dropbear, the tools, MQTT, WiFi and Bluetooth, Podman; on the eMMC or on an SD card | yes |
| `uefi-x64.full` | systemd, the management plane and the console, Dropbear, the tools and MQTT, Podman | yes |
| `uefi-x64.docker` | the same with Docker | yes |
| `mini-x64.basic` | OpenRC, the management plane and the console, Dropbear; sized for 128 MB of flash | yes |
| `qemu-armhf.basic` | OpenRC, the management plane and the console, Dropbear | yes |
| `uefi-x64.gcp` | for Google Compute Engine: systemd, the management plane and the console, OpenSSH on from the first boot with logins from the instance metadata, Docker, no LAN discovery | yes |
| `uefi-x64.gcp-tpm2` | `uefi-x64.gcp` with DATA encrypted under the instance's TPM | no; a test product |
| `uefi-x64.basic`, `uefi-arm64.basic`, `cx3576.basic`, `s905x5m.basic` | the corresponding product without a container engine | no |
| `uefi-arm64.full` | as `uefi-x64.full`, on arm64 | no |
| `uefi-x64.openrc-full` | `uefi-x64.full`'s set on OpenRC | no |
| `uefi-x64.base` | the Base alone with Podman: no micad and no console, SSH on from the first boot, updates on the `auto` policy | no |
| `ssd202d.basic` | OpenRC, the management plane and the console, Dropbear, on SPI NAND | no: `ssd202d` is not a release target |
| `<board>.dev`, `s905x5m.emmc-dev` | a development build (`PROFILE=dev`) | never; built locally |

There are no minimal products. Every released product but `uefi-x64.gcp`
claims without the device code for now (`CLAIM_DEVICE_CODE=off`); the cloud
products ask for it.

Every board but `ssd202d` is a release target. That means its products are
published; it is not a claim that the board boots on hardware — `uefi-arm64`'s qualification
stays QEMU-only, and `s905x5m` stays at the bring-up tier with its physical
rows untested ([support tiers](../hardware/README.md#current-boards)). It
is not even a claim that the image has been started by anything automatic: no
suite boots a FIT image, so the `cx3576` and `s905x5m` products are started by
nothing in this tree.

> status: board-dependent — evidence: `docs/hardware/README.md`, `mica-build:boards/products.md`, `mica-build:boards/boards.tsv`

## 4. Where the files are

Everything published is a GitHub Release of its repository, plus OCI
artifacts in `ghcr.io/micaoss/<repository>`; both are public and read without
a token.

| I want | Where |
|---|---|
| a product's newest release | the latest release of `micaoss/mica-build` whose tag starts with `<board>.<variant>.` |
| an image for one product | that release: `mica-<board>.<variant>-<stamp>.img.gz` |
| an update archive | the same release: `mica-<board>.<variant>-<stamp>.micaupd`, and `.root.micaupd` or `.kernel.micaupd` when that release published them |
| what a release is made of | `mica-build.lock` in the release, and `SHA256SUMS` beside it |
| the same bytes as an OCI artifact | `ghcr.io/micaoss/mica-build:image.<board>.<variant>.<stamp>` and `update.<board>.<variant>.<stamp>` |

Images are published gzip-compressed and no raw image is uploaded; every
image layer records the uncompressed sha256 and size, so a download can be
checked before and after decompressing.

> status: shipped — evidence: `docs/reference/release-lock.md`, `mica-build:boards/products.md`

## 5. What is not here yet

- The only board-specific flashing format is the Amlogic USB burning package
  of `s905x5m`; every other board publishes the raw disk image alone.
- No suite starts a FIT image: `lifecycle-uboot-fit` reads the assembled
  medium (the loader, the boot records and their signatures) without booting
  it, and the U-Boot boards are started on hardware by hand
  ([harness](https://github.com/micaoss/mica-build/blob/main/README.md#build-and-verify)).
- A product without a release is offered by neither the download page nor
  the update root; it is built from source.

> status: unsupported
