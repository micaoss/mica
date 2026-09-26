# Mica OS in one page

Mica OS is an embedded Linux system for industrial devices: a signed,
read-only dm-verity root, an independently signed kernel and support image,
two file-based A/B deployments, and a local management API with a dashboard.
A device runs one *product*: a board plus a profile plus the features that
product selects. This page names the pieces, how a release is built from
them, and where the files are.

The system map is [architecture.md](../architecture.md). A system is built
from source with [build](build.md), an image reaches a board through
[flashing](flashing.md), updates are chosen with
[update packages](update-packages.md), a maintainer cuts a release with
[releasing](releasing.md), and a new board is brought up with
[porting](../boards/porting.md).

## 1. The seven repositories

| Repository | Produces |
|---|---|
| `mica-build-env` | the build images `base`, `c`, `go`, `rust` and `bsp`, and the rules every repository builds under |
| `mica-system-base` | the board-independent base: the pinned Debian packages, the four policy packages and the base root image |
| `mica-core` | `micad`, `mica-apid`, the MQTT services, the SFTP server, `mica-deploy` and the lifecycle binary |
| `mica-podman` | the container engine package `mica-podman` |
| `mica-boards` | per board: the kernel, U-Boot, firmware, board metadata and the board's packages |
| `mica-build` | the assembly: it composes each product's root, signs the components, and publishes the images, the update archives and the version index |
| `mica` | this repository: the design contracts, the decisions, the guides and the workspace records |

> status: shipped — evidence: `docs/architecture.md`, `docs/design/release-lock.md`, `mica-build:products`, `mica-build:boards`

## 2. The release chain

Each repository publishes releases, and each consumer pins the releases it
builds on as a lock plus a pin record, never a branch
([release lock](../design/release-lock.md)):

```text
mica-build-env ─▶ mica-system-base ─▶ mica-podman ─┐
               └─▶ mica-core ─────────────────────┤
               └─▶ mica-boards (per board) ───────┴─▶ mica-build ─▶ mica.<stamp>
```

- `mica-build-env` is the floor: every other repository builds inside its
  images.
- `mica-system-base` publishes the base root and the package pools that
  products install.
- `mica-core` and `mica-podman` publish their packages into their own pools.
- `mica-boards` releases **per board**, `<board>.<YYYYMMDD-HHMM>`, and
  publishes the board's components and pool.
- `mica-build` releases **per scope**, `<board>.<YYYYMMDD-HHMM>` today, and
  publishes each product of that scope: a compressed disk image and the
  update archives.
- After every successful scoped release, `mica-build` cuts the **version
  index** `mica.<YYYYMMDD-HHMM>`, which names the newest release of every
  published product. The index is the GitHub latest release, so the greatest
  `mica.*` tag is the newest Mica version.
- A scoped tag separates its scope with a dot since 2026-09-16
  ([decision](../decisions/2026-09-16-scoped-tags-use-a-dot.md)); the releases
  cut before that date keep their slash and are history.

> status: shipped — evidence: `docs/design/release-lock.md`, `docs/design/mica-index.md`, `docs/decisions/2026-09-15-mica-version-index.md`

State on 2026-09-16, and the sentence worth reading twice: **every published
product is built entirely from released producers, with no in-flight pin.**
Six pins, each verified anonymously when it was taken, none of them pointing
at a branch, a local build or an unreleased commit — `mica-boards`
`uefi-x64`, `uefi-arm64`, `cx3576` and `s905x5m` at `20260916-0857`,
`mica-core` `20260916-0916`, `mica-podman` `20260916-0846`,
`mica-system-base` `20260915-1102` and `mica-build-env` `20260916-0735`.

`mica-build` published `uefi-x64.20260916-1653`,
`uefi-arm64.20260916-1653` and `cx3576.20260916-1653` from those pins, and
the index job cut `mica.20260916-1709`, which is the GitHub latest release.
The index was rebuilt byte-identically from a fresh clone, both incrementally
from its previous and in full from all three releases it references.

## 3. Products and boards

A board is one of two kinds: a **generic system**, named for its firmware
class and architecture (`uefi-x64`, `uefi-arm64`), whose one image serves every
machine of that class; or a **hardware board**, named for the hardware
(`cx3576`, `s905x5m`). What makes a variant a new board, a new product or just
another image kind is
[the naming rules](../decisions/2026-09-16-board-and-product-naming.md).

Every board is a release target: `uefi-x64`, `uefi-arm64`, `cx3576` and
`s905x5m`, the last since the user decision of 2026-09-19 and its first
release `s905x5m.20260920-0033`. Being a release target means the board's
images are published and its products are indexed; it is not a claim that the
board boots on hardware — `uefi-arm64`'s qualification stays QEMU-only, and
`s905x5m` stays at the bring-up tier with its physical rows untested
([support tiers](../boards/support-tiers.md#current-boards)). It is not even a
claim that the image has been started by anything automatic: no suite boots a
FIT image, so the four `cx3576` and `s905x5m` products are started by nothing
in this tree ([download](download.md#1-what-exists-to-download)). The product set is a
`dev` and a `prod` product for each of the four boards, eight in all. There
are no minimal products
([decision](../decisions/2026-09-16-minimal-products-removed.md)).

> status: board-dependent — evidence: `docs/boards/support-tiers.md`, `docs/decisions/2026-09-16-minimal-products-removed.md`, `docs/decisions/2026-09-15-release-images-and-products.md`

## 4. Where the files are

Everything published is a GitHub Release of its repository, plus OCI
artifacts in `ghcr.io/micaoss/<repository>`; both are public and read without
a token.

| I want | Where |
|---|---|
| the newest Mica version | the greatest `mica.*` release of `micaoss/mica-build` (the GitHub latest), whose `mica-index.json` names every product's newest release, asset URLs, sizes and digests |
| an image for one product | the scoped release `<board>.<YYYYMMDD-HHMM>`: `mica-<product>-<stamp>.<suffix>.gz` |
| an update archive | the same release: `mica-<product>-<stamp>.micaupd`, and `.root.micaupd` or `.kernel.micaupd` when that release published them |
| what a release is made of | `mica-build.lock` in the release, and `SHA256SUMS` beside it |
| the same bytes as an OCI artifact | `ghcr.io/micaoss/mica-build:image.<product>.<stamp>` and `update.<product>.<stamp>` |

Images are published gzip-compressed and no raw image is uploaded; every
image layer records the uncompressed sha256 and size, so a download can be
checked before and after decompressing.

> status: shipped — evidence: `docs/design/mica-index.md`, `docs/design/release-lock.md`, `docs/decisions/2026-09-15-release-images-and-products.md`

## 5. What is not here yet

- Board-specific flashing formats (a Rockchip `update.img`, an Amlogic burn
  image) are designed but not implemented: every board declares only the
  `disk` image kind today.
- Nothing starts a FIT image: there is no suite that boots one, and the two
  suites that boot refuse a FIT board by name, so the `cx3576` and `s905x5m`
  products are published and never started
  ([harness](../design/build-harness.md) section 4). A FIT boot suite would be
  a new suite; it is unscoped and is a user decision.
- `s905x5m` and `uefi-arm64` are no longer on this list: their product images
  exist, from `s905x5m.20260920-0033` and `uefi-arm64.20260916-1653` on.

> status: unsupported
