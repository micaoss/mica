# mica-build releases are scoped and carry image files

- **date**: 2026-09-15
- **kind**: engineering decision
- **owner**: the mica-build owner
- **review sunset**: 2027-03-15
- **status**: accepted (user, 2026-09-15); not implemented; the `mica-build.lock` row kinds are pending (proposed by `mica-build`, added to `docs/design/release-lock.md` when its first scoped release lands)

## Decision

`mica-build` is the last exit of the system: it assembles the images, and no
repository consumes it. It therefore follows its own release logic, an
explicit exception to the uniform release rules (the workspace release rules
and `docs/design/release-lock.md` section 1) that applies to `mica-build`
only (user, 2026-09-15). The scoped tag and scoped release row are shared with
`mica-boards`, which releases per board
(`docs/decisions/2026-09-15-mica-boards-per-board-releases.md`); the image
assets and product scopes are `mica-build`'s alone.

**Scoped releases.** A release is scoped to a board, meaning all of that
board's products, or to a single product. Its git tag and GitHub Release are
`<scope>/<YYYYMMDD-HHMM>`, for example `x64/20260915-0300`. Only the products
in the scope are built, verified and published; other products are not
rebuilt or republished (user: "比如我只编译x64 就可以只发布x64，不需要严格按照规则去发布所有其他的版本").

**Image files as release assets.** A release also carries the images as
downloadable GitHub Release assets (user: "需要额外放镜像文件，不然无法下载"):

- per product in the scope: the update archive and one asset per image kind
  the product selects from its board's `images.tsv` (`disk` always),
  `mica-<product>-<YYYYMMDD-HHMM>.<suffix>`, packed by the board's packer and
  verified against the signed `disk.img`
  (`docs/decisions/2026-09-15-board-image-packers.md`);
- `mica-build.lock` and `SHA256SUMS`, which lists only the lock.

The OCI artifacts `image.<product>.<release>` (one manifest, one layer per
image kind, titled by file name and annotated `mica.image-kind`) and
`update.<product>.<release>` in `ghcr.io/micaoss/mica-build` are the
canonical copies, where `<release>` is the `<YYYYMMDD-HHMM>` part of the
scoped tag (`docs/decisions/2026-09-15-oci-tags-follow-release-version.md`).
A failed pack, verify or determinism check, or an asset over 2 GiB, fails
the product's whole release. `mica-build.lock` ties each asset (an `asset`
row per kind) to its OCI digest and records the five
input releases (`mica-build-env`, `mica-system-base`, `mica-core`,
`mica-podman`, and the per-board `mica-boards` release of each board in the
scope). Its release row is `release mica-build <scope>/<YYYYMMDD-HHMM>
<commit>`, and its inputs are read from `locks/` like any consumer, a board as
`locks/mica-boards.<board>.lock` (`docs/design/release-lock.md` 1.0 and
section 4).

**Pending.** The exact row kinds of `mica-build.lock` (an input row and an
asset row) are proposed by `mica-build`. They are added to
`docs/design/release-lock.md` when its first scoped release lands; until then
this record fixes only what the lock must state, not its row shapes.

## What this changes for mica-build

- The release tag is `<scope>/<YYYYMMDD-HHMM>` instead of `<YYYYMMDD-HHMM>`.
- A release carries image assets beside `mica-build.lock` and `SHA256SUMS`,
  instead of exactly the lock and `SHA256SUMS`.
- A release covers its scope only, not every product.

Every other repository keeps the uniform rules, except that `mica-boards`
also releases by scope (per board) with the uniform assets.

## Rationale

Producers are consumed by later stages and need one uniform shape so that
one reader serves all of them. `mica-build`'s output is consumed by people
and devices, not by another repository. Building and publishing one board or
one product at a time avoids rebuilding everything for a single change, and
images need to be downloadable directly from the release.

## Removal condition

Revisited if another repository ever consumes `mica-build`'s releases, or
when the image distribution moves off GitHub Releases.
