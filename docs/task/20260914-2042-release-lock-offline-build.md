# 20260914-2042-release-lock-offline-build Move every repository to the release lock format and build the chain offline

- **status**: in_progress
- **priority**: P1
- **owner**: olea2l5k (step 0 and records); each step by its repository owner
- **createdAt**: 2026-09-14 20:42

## Description

The user decided one release format and an offline build
(`docs/decisions/2026-09-14-release-lock-and-offline-build.md`): every
release carries `<repository>.lock` and `SHA256SUMS`, packages live only in
OCI pools, consumers keep `locks/<repository>.lock` and `locks/pins/<repository>.pin`, and
every repository gets a `repos/` source cache with `tools/repos.sh` and a
`make offline`. The specification with test vectors is
`docs/design/release-lock.md`. Plan:
`docs/plan/20260914-2042-release-lock-offline-build.md`.

Acceptance: every producer releases only in the new format; every consumer
names its inputs only in `locks/`; an offline chain with `MICA_OFFLINE=1`
reproduces the online bytes.

## ActiveForm

Moving the repositories to the release lock format

## Dependencies

- **blocked by**: (none)
- **blocks**: (none)

## Notes

- 2026-09-14: step 0 done in `mica`: `docs/design/release-lock.md` and 36
  vectors under `docs/design/release-lock/vectors/` (`expected.tsv`), proven
  by `make docs-verify`. The coordinator dispatches the step 1 writers.
- 2026-09-14 (user): the offline driver is `mica-build:tools/offline-chain.sh`.
- 2026-09-14 (user): sequential migration by dependency: stage 1
  `mica-build-env` (in progress), stage 2 `mica-system-base`, stage 3
  `mica-podman` and `mica-core`, stage 4 `mica-boards` and `mica-build`; each
  stage after the previous one has released, readers and writer switched
  together per repository.
- 2026-09-14 (user): no transition period (a new-format release carries only
  the lock and `SHA256SUMS`); third-party pins move into `locks/upstream.lock`
  (spec 4.1) in each repository's stage, `mica-build-env` now in stage 1.
- 2026-09-14: first `mica-lock v1` releases of `mica-build-env` (pre-reset
  history: the commits cited here are no longer on its `main`, and every
  release named here is deleted; the current facts are the 2026-09-15 note
  on `20260915-0138` below).
  - A release carries exactly `mica-build-env.lock` and `SHA256SUMS` (no
    `build-env-image.lock`). The lock names base, c, go and rust by index
    (tag `<image>.inputs-<16>`, informational) and by `amd64` and `arm64`
    platform manifest, and every upstream mirror as
    `image upstream.<path>.<tag> <platform>
    ghcr.io/micaoss/mica-build-env:upstream.<path>.<tag>.<digest12>@<index digest>`,
    one row per guaranteed platform (`386` too for `debian:trixie-slim`).
  - Third-party inputs are pinned only in `mica-build-env:locks/upstream.lock`:
    the `image` rows are the mirror source list, the `source` rows bun, go,
    rust, rust-std, cargo-nextest and cargo-deny per architecture.
    `images.env` and `mirrors.list` are removed; `params.env` keeps the
    floors, local tags and Rust triples; inside the images
    `/etc/mica-build/images.env` is now `inputs.env` (consumers still read
    `/etc/mica-build/<image>.env`).
  - `release.yml` runs a mirror job (whole-index `imagetools create`, refusal
    of a re-pointed tag, anonymous read-back) before plan; the images build
    from their own Debian and Dockerfile-frontend mirrors; CI runs actionlint
    from its mirror.
  - User decision: `registry` is unified to 3.1.1, `alpine` to 3.24.1 and
    Debian to `trixie-slim`; `registry:2`, `alpine:3.21` and
    `debian:bookworm-slim` are dropped and their consumers move.
  - Release `20260914-2353` at `8ec2ff0f5959` (`SHA256SUMS` sha256
    `c932a7386b32799a5f42015cf87c3596b0fb0477a69eab96c18bb5d6aa2aed21`,
    release run 34910805318), verified anonymously: 33 image rows read at
    their digests, the mirrors equal their upstream pins, no former project
    name in the image configurations. Superseded: `20260914-2311` and
    `20260914-2341`; `20260914-2350` has no assets (a `release.yml`
    skip-propagation bug, fixed in `8ec2ff0`). Evidence: ci runs 34907625982,
    34909198580, 34910563307, 34910739173; release runs 34907697201,
    34909968799, 34910631704, 34910805318; the spec checker accepts the lock
    and `locks/upstream.lock`; `tests/publish-test.sh` 115 passed, 0 failed.
- 2026-09-15, on user instruction: the release `20260914-2350`, which had no
  assets, is deleted, and so are the ghcr mirror tags of `registry:2`,
  `alpine:3.21` and `debian:bookworm-slim` with their untagged manifests. The
  locks of `20260914-2311` and `20260914-2341` therefore no longer read back
  in full; `20260914-2353` is the `mica-build-env` release to pin.
- 2026-09-15, on user instruction: the superseded releases `20260914-2311`
  and `20260914-2341` and their tags are deleted; `20260914-2353` is the only
  `mica-lock v1` release of `mica-build-env`.
- 2026-09-15, on user instruction: the `mica-build-env` package was pruned to
  the versions release `20260914-2353` names (164 kept, 72 deleted: the
  build-env images of `20260914-0128`, `20260914-1129` and `20260914-2311`).
  Correction: the prune did not end the older releases; the user then deleted
  the whole package (next note).
- 2026-09-14: stage 2 (`mica-system-base`) started.
- 2026-09-15 (user): the `image` row is now
  `image <source> <name> <platform> <reference>` with source the producing
  repository or `upstream`, original names and references and no ghcr
  mirrors of upstream images (spec 1.2.1; section 2.1 removed; checker and
  vectors updated, 102 vector checks). `20260914-2353`'s lock used the
  superseded row shape and mirrors; `20260915-0030` replaces it.
- 2026-09-15: stage 1 done. `mica-build-env` `20260915-0030` at `e042744` was
  the release to pin, deleted since (see the `20260915-0138` note below)
  (`SHA256SUMS` sha256
  `02b712ffbe3cd289a242e63af68e1f81a1cbe7f50bf466d36d34e50122a6dcff`), in the
  source-column image row format (spec 1.2.1).
  - `mica-build-env` rows: base, c, go and rust on
    `ghcr.io/micaoss/mica-build-env`. `upstream` rows: taken unchanged from
    `locks/upstream.lock`, with original `docker.io` references
    (`alpine:3.24.1`, `debian:trixie-slim` including `386`,
    `docker/dockerfile:1` and `1-labs`, `docker:28-cli`,
    `moby/buildkit:v0.33.0`, `registry:3.1.1`, `rhysd/actionlint:1.7.12`,
    `tonistiigi/binfmt:qemu-v10.2.3`, `ubuntu:24.04`).
  - Nothing is republished: the mirror job and `publish-mirrors.sh` are
    removed, and the images build from the original references by digest.
    Docker Hub rate limits are accepted (a failed run is rerun).
  - Preceding events: the user reset `main` to one root commit (`5c05745`),
    removing the `Co-Authored-By` trailers; the user deleted the ghcr package
    and the releases `20260914-2353`, `20260914-1129` and `20260914-0128`
    (after the mirror-tag and version prune done on user instruction);
    `20260915-0026` failed in `build.sh` (an image-table split on `:`),
    fixed in `e042744`, and still exists without assets; the recreated
    package is public and holds only `20260915-0030`'s twelve versions.
  - Evidence: ci run 34913397657; release run 34913426635; the spec checker
    accepts the lock and `locks/upstream.lock`; 33 rows read anonymously at
    their digests; tests 113 passed, 0 failed.
  - Every `mica-build-env` commit cited in records from before 2026-09-15 is
    pre-reset history and no longer on its `main` (`5c05745`, `2aa9e94`,
    `e042744`).
- 2026-09-15: stage 2 (`mica-system-base`) in progress.
- 2026-09-15: stage 2 done: `mica-system-base` moved to the unified format
  and, on the user's direct instruction, was reset to a clean first version
  (root `a6db959` and release `20260915-0059`, both replaced since; see the
  `20260915-0209` note below).
  - It reads `locks/mica-build-env.lock` (built on `20260915-0030`, since
    deleted; Base moves to `20260915-0138`) with its pin and
    pins its third-party inputs in `locks/upstream.lock`; the Dockerfile
    frontend `docker/dockerfile:1-labs` and BuildKit `moby/buildkit:v0.33.0`
    come from the build-env `upstream` rows, and a tree test refuses a
    third-party image reference outside `locks/`.
  - History squashed into the root commit `a6db959` (force-pushed); its old
    records removed and its changelog reduced to one entry; the releases
    `20260914-0455`, `20260914-0654`, `20260914-0742`, `20260914-0809`,
    `20260914-0829`, `20260914-1148`, `20260914-1931` and `20260914-2206`
    and their tags deleted; 40 old ghcr versions deleted.
  - First release `20260915-0059` at `a6db959`: assets
    `mica-system-base.lock` (sha256
    `1c569e4bc27ca1f3afc12698f384841b309a6944d3882e77efc5d9998cce2dc1`) and
    `SHA256SUMS` (sha256
    `88feb509dc516bb97b1b7473d9af8a3e617fa8467958a29b0f93ac72e6620cb4`, the
    trust hash); the spec checker accepts the lock. Rows: `image
    mica-system-base rootfs` `index`, `amd64`, `arm64`; `pool` `amd64`,
    `arm64`; `package` rows for the four packages per architecture
    (`20260915-0059-1`); 42 `upstream` rows with roots; the `apt` row.
  - Verified anonymously: the manifests read at their digests, `/etc/issue`
    is `Mica OS 20260915-0059`, the shadow day is 18262.
  - Records citing the deleted Base releases, the three former Base files or
    pre-reset `mica-system-base` commits say so.
- 2026-09-15: stage 3 (`mica-podman`, `mica-core`) started.
- 2026-09-15 (user): every OCI tag is `<kind>[.<name>]*.<YYYYMMDD-HHMM>`,
  the publishing release's tag, never `build-<commit12>` or `inputs-<16>`;
  a tag is never re-pointed, and an unchanged artifact is reused by digest
  (decision `2026-09-15-oci-tags-follow-release-version`, spec 1.3 and 2).
- 2026-09-15: `mica-build-env` `20260915-0138` at `f7b896b` is its only
  release and the release to pin (`SHA256SUMS` sha256
  `8efc21bab0b959f436f1131cbfbd0fb37d7f546c447cd6ec5e86f81592e3385c`).
  - Image tags are the release number: `<image>.<release>`, and per
    architecture `<image>.<arch>.<release>`; there are no hash or commit
    tags.
  - An image's inputs are the label `com.mica.build-env.inputs` on every
    platform config; an unchanged image is reused under the new release tag
    with its digest.
  - Release `20260915-0130` failed because an index annotation does not
    survive a Docker manifest list; fixed in `f7b896b`.
  - On user instruction the releases `20260915-0030` and `20260915-0130` and
    every ghcr version `20260915-0138` does not use were deleted; the package
    holds only its 12 versions.
  - Every OCI tag in Mica is `<kind>[.<name>]*.<release>` (user decision;
    `mica-build-env` `RULES.md` section 3).
  - `mica-system-base` (built on the deleted `20260915-0030`) and the stage 3
    consumers `mica-podman` and `mica-core` move to `20260915-0138`.
- 2026-09-15: stage 3, `mica-podman` part, done: `mica-podman` `20260915-0138`
  at `6a15000` in the unified format (replaced since by the clean release
  `20260915-0245`; see below).
  - Assets `mica-podman.lock` (sha256
    `61a8783769791a4cb0c76ef9c368a27c00c76460e10fb105032a588c36758b5a`) and
    `SHA256SUMS` (sha256
    `39b47945017d1e6f1bede9f99c686aee89150faa89735773f409860530456873`, the
    trust hash). Rows: `release`; `pool` `amd64` and `arm64` at
    `ghcr.io/micaoss/mica-podman:pool.<arch>.20260915-0138`; `package`
    `mica-podman` `5.8.6+git6a150004dc49-1` per architecture. The spec
    checker accepts the lock; verified anonymously.
  - Inputs: `locks/mica-build-env.lock` (`20260915-0030` when released,
    being moved to `20260915-0138` since `0030` was deleted),
    `locks/mica-system-base.lock` (`20260915-0059`), and `locks/upstream.lock`
    `git` rows for podman `v5.8.6`, crun `1.29.1`, conmon `v2.2.1`, netavark
    `v2.1.0`, aardvark-dns `v2.1.0` and catatonit `v0.2.1`, their commits
    checked against the former tree hashes. `versions.env`,
    `build-env-image.lock`, the three Base files and `debian-packages.lock`
    are removed; the package ships `/usr/share/mica-podman/upstream.lock`
    instead of `versions.env`.
  - Not yet: `repos/` with `tools/repos.sh`, and the `_out/offline` lock
    form. The previous release `20260914-0158` with `.deb` assets still
    exists.
  - `mica-core` part in progress; its first attempt `20260915-0145` failed on
    the deleted build-env `20260915-0030` and exists without assets.
- 2026-09-15 (user, for `mica-system-base`, `mica-podman` and `mica-core`):
  after moving to `mica-build-env` `20260915-0138` and the final format, each
  squashes its history, deletes its previous Actions runs, tags and
  releases, publishes a completely new version, then prunes ghcr to the new
  lock.
  - `mica-system-base` done: root `4d63430` (tree `7feff723`), force-pushed;
    release `20260915-0059` and its tag deleted, all 30 old Actions runs
    deleted. New release `20260915-0209` at `4d63430` (ci run 34919795292,
    release run 34920086004): assets `mica-system-base.lock` (sha256
    `c77fdf94a9365ce5db9c7c2741f4e6bd57ee491c1cc1844db478feb745081712`) and
    `SHA256SUMS` (sha256
    `19672ed41506466679d2a93d18d7ba5ecf5ef30817bc0219e859ac80db918ab3`, the
    trust hash); the spec checker accepts the lock. Rows: `rootfs` `index`,
    `amd64`, `arm64`; both pools; the four packages at `20260915-0209-1`;
    42 `upstream` rows unchanged from `20260915-0059`; the `apt` row.
    Verified anonymously (`/etc/issue` is `Mica OS 20260915-0209`); ghcr
    pruned to the 5 versions of `20260915-0209`.
  - The Base release to pin is `20260915-0209`; `20260915-0059` is deleted.
    `mica-podman` (released on `0059`) and `mica-core` move to it and follow
    the same instruction.
- 2026-09-15: stage 3, `mica-core` part, done under the user's clean-release
  instruction.
  - Root `239e423` (tree `07a2d984`), force-pushed; `ci.yml` gained
    `workflow_dispatch`, since a force-push of rewritten history starts no
    push run; `.gitignore` adds `/repos/`.
  - Deleted: the releases `20260915-0145`, `20260914-1212` and
    `20260914-0529` with their tags, and all 16 earlier Actions runs.
  - New release `20260915-0235` at `239e423` (ci run 34920808928 by
    dispatch, release run 34921735102): assets `mica-core.lock` (sha256
    `0d92a2f62c8fa81bf5cc9d29ca96b6697a3f1a2897aef3b3fa4ea59f99557790`) and
    `SHA256SUMS` (sha256
    `fb2eb30600f49b5c4b016063f7304bc3106cf9782662331e1cfdc0151ce2db21`, the
    trust hash). Rows: `release`; `pool` `amd64` and `arm64` at
    `ghcr.io/micaoss/mica-core:pool.<arch>.20260915-0235` (the package
    created public); `package` `micad`, `mica-apid`, `mica-mqttd`,
    `mica-mqtt-broker`, `mica-sftp-server`, `mica-deploy` and
    `mica-lifecycle` at `0.1.0+git239e42340795-1` per architecture. The spec
    checker accepts the lock; verified anonymously.
  - The signed update contract is unchanged (`mica/*/v1`, `MICAUPD1`,
    `.micaupd`; fixture hashes unchanged).
  - `mica-core` consumes only `locks/mica-build-env.lock` (`20260915-0138`).
    The earlier core pins (`20260914-0529`, `20260914-1212`) no longer
    resolve.
  - Stage 3: `mica-core` done; `mica-podman` pending, its squash awaiting the
    user's authorization in its issue.
- 2026-09-15: stage 3 complete: `mica-podman` clean release under the user's
  instruction.
  - Root `b385fa19` (tree `4a87dec8`), force-pushed by the user after the
    agent's guard refused; the releases `20260915-0138` and `20260914-0158`
    with their tags and 25 old Actions runs deleted.
  - Release `20260915-0245` at `b385fa1` (ci run 34921836884, release run
    34922395674): assets `mica-podman.lock` (sha256
    `3b8a0cc6b8e3dae02b865dd8b22e1562fb3af95fc918dd5e905a57601bfb29e5`) and
    `SHA256SUMS` (sha256
    `64e2ec07c90947e5e323d15537033f14f720256e304134cc1810c8a34a09bf32`, the
    trust hash). Rows: `release`; `pool` `amd64` and `arm64` at
    `pool.<arch>.20260915-0245`; `package` `mica-podman`
    `5.8.6+gitb385fa19ea71-1` per architecture. Inputs: build-env
    `20260915-0138` and Base `20260915-0209`. The spec checker accepts the
    lock; verified anonymously; ghcr pruned to the two `20260915-0245` pools.
- 2026-09-15: stage 4 (`mica-boards`, then `mica-build` and the final image
  assembly) started.
- 2026-09-15 (user), stage 4: `mica-build` releases are scoped and carry
  image files (`docs/decisions/2026-09-15-mica-build-scoped-releases.md`).
  - Scope: a board (all its products) or a single product; tag and GitHub
    Release `<scope>/<YYYYMMDD-HHMM>` (for example `x64/20260915-0300`);
    only the products in the scope are built, verified and published.
  - Assets: per product the compressed factory image, the update archive
    and, for FIT boards, the vendor flashing format; plus `mica-build.lock`
    and `SHA256SUMS` (listing only the lock). The OCI artifacts
    `image.<product>.<release>` and `update.<product>.<release>` in
    `ghcr.io/micaoss/mica-build` are the canonical copies; the lock ties
    each asset to its OCI digest and records the five input releases.
  - Pending: the `mica-build.lock` row kinds (input, asset), proposed by
    `mica-build`, enter the spec with its first scoped release.
- 2026-09-15 (user), stage 4: `mica-boards` releases per board
  (`docs/decisions/2026-09-15-mica-boards-per-board-releases.md`).
  - Not merged into `mica-build`. Tag and GitHub Release
    `<board>/<YYYYMMDD-HHMM>`; a release builds and publishes only that
    board; OCI tags `board.<board>.<YYYYMMDD-HHMM>` and
    `pool.<board>.<arch>.<YYYYMMDD-HHMM>`; assets exactly `mica-boards.lock`
    and `SHA256SUMS`; release row
    `release mica-boards <board>/<YYYYMMDD-HHMM> <commit>`.
  - Spec: scoped releases (1.0) for `mica-boards` (per board) and
    `mica-build` (per board or product; its `asset` and `input` rows still
    pending); the release field may be `<scope>/<YYYYMMDD-HHMM>` for those two
    only (`release-scope`); a consumer keeps a scoped input as
    `locks/<repository>.<scope>.lock` with
    `locks/pins/<repository>.<scope>.pin` (`REPOSITORY`, `SCOPE`, `RELEASE`,
    `SHA256SUMS`), names and release row matching (`scope-mismatch`).
    Vectors: `lock/valid/mica-boards.x64.lock`, `pins/valid/scoped`,
    `lock/refused/scoped-release-not-allowed.lock`,
    `lock/refused/unscoped-release.lock`, `pins/refused/scope-file-name`,
    `pins/refused/scope-release-row`, `pins/refused/scope-not-allowed`
    (114 vector checks).
  - `mica-boards` keeps a machine-readable board list in `boards/` with every
    supported board and its expected outputs; its format is `mica-boards`'
    and is cited once it lands.
  - Order: `mica-boards` per-board releases first, then its clean-up;
    `mica-build` after.
