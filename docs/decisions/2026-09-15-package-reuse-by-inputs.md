# Packages are reused by inputs across releases, first in mica-boards

- **date**: 2026-09-15
- **kind**: engineering decision
- **owner**: the mica-boards owner (first adopter); the mica-build owner (release-varying content in the root)
- **review sunset**: 2027-03-15
- **status**: superseded the same day by `docs/decisions/2026-09-15-package-versions.md` (user, 2026-09-15): packages are locked by their own version and a release never changes it; the reuse key is name, architecture and version, and the inputs hash below stays only as a guard. This record keeps the replaced design

## Problem

Package versions carry the release commit (`0.1.0+git<commit12>-1`), so every
board release repacks every package of its pool even when nothing in it
changed. A board-only change then changes the product root, and a
`kernel` update package, published only when the rootfs identity is
unchanged (`docs/decisions/2026-09-15-update-packages.md`), can never be
produced.

## Decision

At release, a package whose inputs hash is unchanged since the previous
release of the same scope is not rebuilt (user, 2026-09-15):

- the previous `.deb`, with the same bytes and the same version, is taken
  from that release's pool, verified and placed in the new pool;
- only a package whose inputs changed is rebuilt, with the new commit
  version;
- the inputs hash is recorded with the published package, as the pool layer
  annotation `mica.inputs=<sha256>` (`docs/design/release-lock.md` section 2);
- when no package changed, the pool itself is reused by digest, as board
  components already are (`docs/decisions/2026-09-15-mica-boards-per-board-releases.md`).

CI and the package gate still build every package from source and prove
byte-identical rebuilds; a cache never decides reuse.

**Design** (`mica-boards`, accepted 2026-09-15):

- `mica-boards:tools/deb/package-inputs.sh` hashes a producer: its
  `producer.env` and instance file, its tracked producer files, its
  `BUILD_CONTEXTS` narrowed to the paths the build copies, the inputs of its
  `PREPARE` hook, `tools/deb/`, `VERSION`, the build-env image rows and the
  architecture. Every package of that producer carries the hash.
- A board release reads its previous `<board>/*` release lock and pool
  manifest. For a producer whose hash is unchanged it downloads the archives
  anonymously by digest (each must equal its layer digest and its lock row),
  rebuilds them with the recorded identity (`Version`, `Mica-Source-Commit`,
  `SOURCE_DATE_EPOCH`) and requires byte-identical results; any difference
  fails the release. Changed producers are built with the new commit
  version.
- An unchanged pool is re-tagged under the new release at the same digest.
- CI and the package gate are unchanged.
- The first release after this lands rebuilds everything once, to record the
  hashes.

`mica-build` checks whether its root carries content that varies with the
release: the release identity belongs in the signed deployment, not in the
root.

Whether `mica-core`, `mica-podman` and `mica-system-base` adopt the same rule
is not decided yet.

## Alternatives not chosen

- Versions derived from the inputs hash.
- Versions from the commit that last changed a package.
- Stripping package metadata from the root.
- A separately signed deployment of a new kernel on the previous root.
- Board packages outside the root.

## Rationale

Reusing the exact published bytes keeps a version meaning one set of bytes
and needs no new version scheme. An unchanged board package then leaves the
product root unchanged, so a kernel-only change can ship as a `kernel`
update package, and a release rebuilds and republishes only what changed.
Proving rebuilds in CI keeps reuse from hiding a package that no longer
builds.

## Removal condition

Revisited when package versions stop carrying the release commit, or when
reuse cannot be proven against a from-source rebuild.
