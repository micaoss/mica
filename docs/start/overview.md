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
| `mica-core` | the core components `micad` (with `mica-apid`) and the console `mica-apid-ui` — verity images composed over the root at boot, so they update without a new root — and the packages for MQTT, SFTP, `mica-deploy` and the lifecycle binary, each with its services for both inits |
| `mica-podman` | the container engine package `mica-podman`, with its supervisor `mica-containerd`, on either init |
| `mica-build` | the boards (per board: the kernel, U-Boot, firmware, board metadata and the board package) and the assembly: it composes each product's root, signs the components, and publishes the images and the update archives |
| `mica` | this repository: the design contracts, the decisions and the guides |

> status: shipped — evidence: `docs/architecture.md`, `docs/reference/release-lock.md`, `mica-build:boards`, `mica-system-base:docs/floor-and-options.md`

## 2. The release chain

Each repository publishes releases, and each consumer pins the releases it
builds on as a lock plus a pin record, never a branch
([release lock](../reference/release-lock.md)). Every pin is its producer's
latest release: `bin/mica-tools locks update` moves them all, and
`--check` only reports which are behind.

```text
mica-build-env ─▶ mica-system-base ─▶ mica-podman ─┐
               └─▶ mica-core ─────────────────────┴─▶ mica-build ─▶ <board>.<variant>.<stamp>
```

- `mica-build-env` is the floor of the build: every other repository builds
  inside its images. It moves its pins monthly and releases when green.
- `mica-system-base` publishes the floor root and the package pools that
  products install, and updates itself monthly (the Debian snapshot, the
  upstream sources, the trust anchors), releasing when green.
- `mica-core` and `mica-podman` publish their packages into their own pools;
  `mica-podman` moves to upstream's latest release weekly and releases when
  green.
- `mica-build` releases **one product at a time**,
  `<board>.<variant>.<YYYYMMDD-HHMM>`, through its `release.yml`: the
  product's board components and pool, and the product itself, a compressed
  disk image and the update archives. There is no index of releases; a
  product's newest release is the one to take. A `dev` product is never
  released. A *core release* carries the previous release's kernel and root
  with new core components, so a `mica-core` release reaches devices without a
  new root.
- The release run then posts the release to the resource service
  (`mica-build:README.md`): the files are served from
  `https://dl.res.micaos.dev/mica/<board>.<variant>/<stamp>/`, and
  `https://res.micaos.dev/update/` is the update root a device is configured
  with and the website's download pages read. The GitHub release of
  `mica-build` carries the same files.
- Every repository's history and releases are kept short: a repository may be
  squashed to one commit and its superseded releases deleted, so a document
  names a release only where it is the current one.

> status: shipped — evidence: `docs/reference/release-lock.md`, `mica-build:README.md`, `mica-build-tools:README.md`

## 3. Products and boards

A board is one of two kinds: a **generic system**, named for its firmware
class and architecture (`uefi-x64`, `uefi-arm64`, `mini-x64`), whose one image
serves every machine of that class; or a **hardware board**, named for the
hardware (`cx3576`, `s905x5m`). What makes a variant a new board, a new
product or just another image kind is
[the naming rules](../decisions/2026-09-16-board-and-product-naming.md).

A product is `<board>.<variant>` (`mica-build:boards/products.md`):

| Variant | What it is | Released |
|---|---|---|
| `basic` | the default: the management plane, the console, SSH, the tools and MQTT, and the board's radios | yes |
| `full` | `basic` with the container engine | yes |
| `dev` | a development build (`PROFILE=dev`) | never; built locally |

Every board has `basic`; `uefi-x64`, `uefi-arm64`, `cx3576` and `s905x5m` also
have `full` and `dev`. `mini-x64`, sized for 128 MB of flash, has
`mini-x64.basic` alone, which runs OpenRC with the management plane, SSH and
containers; every other product runs systemd.
There are no minimal products
([decision](../decisions/2026-09-16-minimal-products-removed.md)).

Every board is a release target. That means its products are published; it is
not a claim that the board boots on hardware — `uefi-arm64`'s qualification
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
| an update archive | the same release: `mica-<board>.<variant>-<stamp>.micaupd`, and `.root.micaupd`, `.kernel.micaupd` or `.core.micaupd` when that release published them |
| what a release is made of | `mica-build.lock` in the release, and `SHA256SUMS` beside it |
| the same bytes as an OCI artifact | `ghcr.io/micaoss/mica-build:image.<board>.<variant>.<stamp>` and `update.<board>.<variant>.<stamp>` |

Images are published gzip-compressed and no raw image is uploaded; every
image layer records the uncompressed sha256 and size, so a download can be
checked before and after decompressing.

> status: shipped — evidence: `docs/reference/release-lock.md`, `docs/decisions/2026-09-15-release-images-and-products.md`

## 5. What is not here yet

- The only board-specific flashing format is the Amlogic USB burning package
  of `s905x5m`; every other board publishes the raw disk image alone.
- Nothing starts a FIT image: there is no suite that boots one, so the
  `cx3576` and `s905x5m` products are published and never started
  ([harness](https://github.com/micaoss/mica-build/blob/main/README.md) section 4).
- A product without a release is offered by neither the download page nor
  the update root; it is built from source.

> status: unsupported
