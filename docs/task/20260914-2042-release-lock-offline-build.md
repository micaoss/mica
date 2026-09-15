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
- 2026-09-15: `mica-core` `20260915-0728` at `2a4c98d` implements the
  accepted update packages (`docs/decisions/2026-09-15-update-packages.md`,
  `mica-core:docs/task/20260915-0657-update-packages.md` completed).
  - `SHA256SUMS` sha256
    `75187b8a312aae80cb02d34e8f92fbab310a742a79a4d75ebc30f4bfbea37590`;
    `mica-core.lock` sha256
    `8af278938b8333749da5cb6f20ad13b025158fc2c27147dbddf00cb0a04cf999`; pools
    `pool.amd64.20260915-0728@sha256:9bb23e1dec0429a05989cbe9d3b7dcc71a7da14c0366e0941d52c4906c88558d`
    and
    `pool.arm64.20260915-0728@sha256:fd7f4f4c3ea13c64a5dfb443c67c1daa7f3831c6c906466b49a1dbe979187ec9`;
    14 packages at `0.1.0+git2a4c98de1f64-1`. ci run 34940701911 and release
    run 34941852808 green; `make check` 1236 tests, package gate 99/99.
  - Code: partial `MICAUPD1` import (0 to the descriptor's objects; missing
    ones must be installed or verified, else "deployment objects are
    incomplete"); `mica/deployment/v2` with the signed `product`; the device
    product is the single unquoted `PRODUCT=` line of
    `/usr/lib/mica/product.conf`; check, fetch, import and install refuse
    another product; `mica/catalog/v2` heads
    `{board, product, channel, releaseId, generation}`.
  - Contract files `mica-core:crates/mica-deploy/tests/component-contracts/`
    at `2a4c98d`: `cases.json`
    (`6a52186d43d9d21d2b2f1f68bfd5103f02001a97de503b8b3c82b2928b20cfb1`),
    `deployment.json`
    (`7ef5225854a55b55906ea6fea26267225889379fe093dbfc2fb44116dca76f33`),
    `envelope.json`
    (`1132d5c780ab3f909d08d70d6cd5ffbea91a17952e4c2d15d3ae7ec77cc0671f`),
    `firmware.json` unchanged
    (`79d2a4ff72df13e0940b5af32fe1816906fd3f1a53f3cc1d816fcc82c3760ad3`).
  - `mica-build` pins `20260915-0728`, copies the contract files and
    implements the v2 descriptor, catalog v2 and the three archives, before
    the scoped releases.
- 2026-09-15: stage 4, `mica-boards` part, complete.
  - History: root `219527deffcbd9a0ff76cfa38272e07e8963c64c` (squash), then
    `55d0206` (`images.tsv`, `IMAGE_KINDS` removed, the contract rule) and
    `0f8e313516288aa3a9f6bc1547f96be7907aeae8` (single-artifact workflow fix:
    `ci-outputs.sh` tars with merge-multiple downloads, plan outputs, the
    `build-board` CI job). ci run 34943722823 green.
  - Four per-board releases at `0f8e313`, stamp `20260915-0824`, each with
    exactly `mica-boards.lock` and `SHA256SUMS`, accepted by
    `tools/docs/release-lock-check.py` and verified anonymously. `SHA256SUMS`
    sha256: `x64`
    `420dd058e5daccaf3533a0fa8d6e30735a216285551212447a6577b3db0f8707`;
    `virt-arm64`
    `52b93bd6f5aea994a8e03443ed9e01f7df09fb1ca730efa283e45c886b954cea`;
    `cx3576`
    `f3e3cd49a6052b92f70e994943e1408b3d3560a017d51c91b5d7cf169dcaef78`;
    `s905x5m`
    `22bbffb4c9576886cedbc93b22512a9a70d7ced1d9267b9d5e99416dbc3a8545`.
  - Components: `x64` and `virt-arm64` `board` and `kernel`; `cx3576` and
    `s905x5m` `board`, `kernel`, `uboot` and `firmware`; FIT boards carry
    `kernel/dev` and `kernel/prod`; `mica-kernel-<board>` retired; arm64
    kernels built natively. Every board's `images.tsv` declares only
    `image disk builtin mica-build-env:base img`.
  - An earlier cut `20260915-0715` failed in `release.yml`
    (`download-artifact` extracts a single artifact without a subdirectory)
    and was deleted with its tags on user instruction; `20260914-1603` and
    its ghcr versions were deleted; all Actions runs were deleted; ghcr holds
    exactly the 16 versions the four locks reach.
  - Next: the `mica-build` per-board switch, the certificate switch, eight
    products and the scoped releases; `mica-boards` investigates kernel build
    speed (user request) and adds the `images.tsv` update rows once
    `mica-build` confirms its reader.
- 2026-09-15: stage 4, `mica-build` part: `main` `0094a097`.
  - Inputs: the four `mica-boards` `<board>/20260915-0824` pins
    (`locks/mica-boards.<board>.lock` and pins with `SCOPE`); the legacy
    boards path removed; component board fetch with `outputs.tsv` checks;
    `tools/locks.py` at `mica` `a0ec066`.
  - Images and updates: the image-kinds executor and the `images.tsv`
    update-row reader; `mica-core` `20260915-0728` adopted with the
    `mica/deployment/v2` writer (product), the `full`, `root` and `kernel`
    `MICAUPD1` variants, and the update-server with catalog v2 and import.
  - Certificates: `60a93a48` lands the development certificate CN change;
    the repository variables `MICA_VERITY_TRUST_CERT` and
    `MICA_BOOT_TRUST_CERT` now equal `mica-boards`' (file sha256
    `c854172f...` and `9357ccc9...`, CN `MICA-development-verity` and
    `MICA-development-boot`); `MICA_UPDATES_PUBLIC_KEY` unchanged; the three
    release key secrets rewritten.
  - CI and the eight product builds are running; the scoped releases follow.
- 2026-09-15: `mica-system-base` `20260915-1102` at `3ae160d` is released, the
  first release with version-locked packages
  (`docs/decisions/2026-09-15-package-versions.md`, R0-R8).
  - Commit `3ae160dbca36afd50dd4ab38f007f8c7ff199d65`; ci run 34960768597 and
    release run 34961099912 green; verified anonymously.
  - `SHA256SUMS` sha256
    `2e3ab8029c2b0c2896c2e99bcaf88a7c955e23f57880444d8df7e11eddb0d5a2`;
    `mica-system-base.lock` sha256
    `759a4a7c23231d508ee4ccc89aa84a785021b8d8b9eaa00b0468b9d0b834b2c5`.
  - `rootfs.20260915-1102@sha256:547a8e04783c0dd238f672aeccff0e76bd5a8b342fbd2b6cb7100d25740b7fcd`;
    `pool.amd64.20260915-1102@sha256:1ab6a2e381b6e92e93e1d693e74a39134f8cc882601ba83e1c061eb811c63a83`
    and
    `pool.arm64.20260915-1102@sha256:b88a8c1bc03c7f9989b6b7fc37be6b1fd9e49a928513020ca533d9c07c9b1c65`;
    the pool manifests carry only `mica.arch` and `mica.source-repo`, and
    their layers the title and `mica.inputs`.
  - Packages: `mica-busybox` `1.38.0-mica1`, `mica-ca-trust`
    `20250419-mica1` (all), `mica-system` `1.0.0-1` (all),
    `mica-systemd-boot` `257.13-mica1`; no `Mica-Source-Commit`. The upstream
    rows are unchanged from `20260915-0209` (snapshot `20260905T000000Z`).
  - As the first release under the rules it built everything: the previous
    release `20260915-0209` predates version-locked packages, so the R5
    comparison did not apply (D1).
  - `mica-build` pins it only after its package-version adaptation;
    `mica-podman` may move its Base lock to it in its package-version change.
- 2026-09-15: `mica-podman` `20260915-1057` at `d47ffbc` is its first release
  under the package-version rules
  (`docs/decisions/2026-09-15-package-versions.md`).
  - Commit `d47ffbc8e67b4f45ab44a263725c3912d21a1491`; ci run 34959620045
    and release run 34960701595 green; verified anonymously.
  - `SHA256SUMS` sha256
    `d347fdf5a59ffa39509d9f621113a9a51a252a632b8338ce0e6f6edc839b7426`.
  - Pools
    `pool.amd64.20260915-1057@sha256:4163f573fd8570e12a89d22e75bd7ae5c355a89e66c4a1be62197e238ed4f043`
    and
    `pool.arm64.20260915-1057@sha256:0560c1f092417e38feef8e936f84e5548af935e53b97952d09c2616f96d9d360`,
    annotated only `mica.source-repo` and `mica.arch`; each layer carries
    its title and `mica.inputs` (amd64 `53593e2a...`, arm64 `7b404172...`).
  - Package `mica-podman` `5.8.6-1`: amd64
    `5b2505b1d42248c39a3c9b22b4c2f4a7e97132234a0b4bdf1f08571da1fee3df`, arm64
    `d9eb2513f6b5bede3f48283acf8a1ca8be6079779dd191c9e513360b283bf30e`; no
    `Mica-Source-Commit`; `SOURCE_DATE_EPOCH` `1786640584` declared.
  - `0ed321e` then moved its Base pin to `mica-system-base` `20260915-1102`
    (ci run 34961748584 green). The reuse check found the same inputs and
    bytes as `20260915-1057` on both architectures, so no new release was
    needed: the first proof of reuse under the rules.
  - `mica-build` (adaptation on `main` `c44dc645`) pins it together with
    `mica-system-base` `20260915-1102` before its first scoped release.
- 2026-09-15: `mica-boards` `<board>/20260915-1128` are its first releases
  under the package-version rules (`docs/decisions/2026-09-15-package-versions.md`).
  - Commit `ebf93f7`; ci run 34960627367 green; release runs 34963489937,
    34963490140, 34963491962 and 34963493385 green; verified anonymously.
  - `SHA256SUMS` sha256: `x64`
    `aa660c5cbd760bedf2550addd9dec26a2f1eac21395fe6a3291bb241970cd943`;
    `virt-arm64`
    `d7f2e84275ea1459f4f16951eb94835275997c2a3b3ad7378eb9710f4f7ed18f`;
    `cx3576`
    `1274a40264f793358eee4119772d37e7ea7bbaccd5712a0777bb212d43da0058`;
    `s905x5m`
    `eccd72480d67b17ccf6f5ff7a3114e0fe4befb589efcaa21bc90cc8bd5301bd2`.
  - Pools: `x64` `pool.x64.amd64` at
    `sha256:f1c89093da7e63fdb607657fe0658383d47ad49f9241ba39ba677c122218c7a4`;
    `virt-arm64` at
    `sha256:41f077a8180ae67ac89ee2cf936bddfea5bb5837e65fcda36226b45d357b3466`;
    `cx3576` at
    `sha256:c300d3c686a11a2de07f0b6324abd7f42bc3c85c8a11d245216fe2512cc3b47e`;
    `s905x5m` at
    `sha256:4f7d343f24b897343dc6daf1b295d3dcbd0203f2cf6316da23bc10b817e6f86b`.
    The manifests carry only `mica.source-repo` and `mica.arch`, and the
    layers `mica.inputs`.
  - Every package is `0.1.0-1`, with no `Mica-Source-Commit`;
    `SOURCE_DATE_EPOCH` `1789430400`. The `board`, `kernel`, `uboot` and
    `firmware` components are reused by digest from `<board>/20260915-0945`,
    unchanged.
  - The `<board>/20260915-0945` releases stay until `mica-build` has re-pinned
    and the user decides the clean-up.
  - The `<board>/20260915-0824` releases were deleted on user instruction
    ("可以删除 现在还是开发阶段"), carried out by the coordinator with `gh`
    after `mica-build` had pinned `<board>/20260915-0945`: the four releases
    with their tags, and the eight ghcr versions
    `board.<board>.20260915-0824` and `pool.<board>.<arch>.20260915-0824`
    that no `0945` lock reached. The `kernel`, `uboot` and `firmware` digests
    are shared with `0945` and stay. Verified afterwards: ghcr held exactly
    the 16 digests of the `0945` locks, all readable anonymously.
  - `mica-build` pins the four boards with `mica-podman` `20260915-1057` and
    `mica-system-base` `20260915-1102` before its first scoped release.
    `mica-boards` next investigates kernel build speed, including pinning the
    Debian toolchain packages that the `s905x5m` bluetooth userland build
    installs.
- 2026-09-15 (user, "可以"): the releases from before the package-version
  rules are cleaned up once `mica-build` no longer pins them, by the
  coordinator with `gh`, verified anonymously afterwards; nothing is re-tagged
  or re-cut meanwhile.
  - After `mica-build` pins `mica-system-base` `20260915-1102`, `mica-podman`
    `20260915-1057` and `mica-boards` `<board>/20260915-1128`: delete
    `mica-system-base` `20260915-0209`, `mica-podman` `20260915-0245` and
    `mica-boards` `<board>/20260915-0945` (releases and tags), and prune each
    ghcr package to exactly the digests its current locks reference.
  - After `mica-core`'s first release under the rules and `mica-build`'s pin
    of it: delete `mica-core` `20260915-0235` and `20260915-0728` the same
    way.
- 2026-09-15: `mica-build` `main` `718a1226` implements the scoped releases:
  `release.sh` `plan`, `collect`, `publish` and `attach`; `generation` is the
  previous `product` row's plus one, starting at 2; `root` and `kernel`
  assets only when the other identity is unchanged; a registry client;
  `release-test` 17/17; a local rehearsal of `x64-minimal` passed. The first
  `x64` cut waits for the new pins. No lock row or decision produces a
  `mica-build:root.<product>.<release>` tag, so the spec's tag list and the
  build and artifact designs name only the image and update bundles.
- 2026-09-15: `mica-core` `20260915-1135` at `610782c` is its first release
  under the package-version rules, together with `mica/rootfs/v2` and the
  release-identity removal (`docs/decisions/2026-09-15-package-versions.md`,
  `docs/decisions/2026-09-15-stable-component-ids.md`).
  - Target `610782c0d1e0acf8bd5b5ed504e088dd81cb4043` (commits `271f20b`,
    `610782c`); ci runs 34961492067 and 34962880143 and release run
    34964131576 green; build env `mica-build-env` `20260915-0138`.
  - `SHA256SUMS` sha256
    `f61c37c3c32566e7c2e00b9a5d15fe1edf8b2a8a41ef9ed952925f292df8f641`;
    `mica-core.lock` sha256
    `6aa265f662042ca61a9fe40a74137f8e03e48a660deee1d25943d7a988cededf`.
  - Pools
    `pool.amd64.20260915-1135@sha256:41cdba0a9f4add7cfc2d5b8e17b793587634691032b7a0484e1c5489df26a0e3`
    and
    `pool.arm64.20260915-1135@sha256:b3519eca7dcba449b3f473d328eb92233c7758a9295b03f9c18df51f21c27e19`,
    annotated only `mica.source-repo` and `mica.arch`, 7 layers per
    architecture with `mica.inputs`. All 14 packages `0.1.0-1`, no
    `Mica-Source-Commit`; the dependents pin `micad (= 0.1.0-1)`.
  - API: `GET /api/v1/system/info` `system` has only `version`, `package` and
    `fileEpoch`, and `daemon` only `name` and `version`; diagnostic snapshot
    schema 6, redaction schema 8; `micad` reads no `release-identity.env`;
    `--version` prints `micad 0.1.0-1` and `mica-apid 0.1.0-1`; `openapi.json`
    regenerated in `mica-apid` `0.1.0-1`.
  - Contract files `mica-core:crates/mica-deploy/tests/component-contracts/`
    at `610782c`: `cases.json`
    `22551a87e1e5382e0e6499b378c74ef89ae52da6a6a7d9113769a39087479f35`,
    `deployment.json`
    `142b536d5db0c108a463638c24fa1a1425b12ab222b351702f4b158c8a5ae697`,
    `envelope.json`
    `bd926d242b0e7b321634a9ee225121e4cf110e7b9fcd0f7d6c698373271a86d1`,
    `firmware.json`
    `79d2a4ff72df13e0940b5af32fe1816906fd3f1a53f3cc1d816fcc82c3760ad3`.
    `mica/rootfs/v2` has no `version` (v1 or a `version` field refused);
    `mica/deployment/v2` and `mica/catalog/v2` unchanged since `20260915-0728`;
    `mica/kernel/v1` and `mica/update-envelope/v1` unchanged.
  - `mica-build` pins it in one round with Base `20260915-1102`, podman
    `20260915-1057` and boards `<board>/20260915-1128` before its first scoped
    release, including its `--version` and `system/info` adaptations, the
    four contract fixtures, `mica/rootfs/v2` and the removal of
    `release-identity.env`; K1 and K2 may follow. The clean-up of the
    pre-rule releases starts from that pin commit.
- 2026-09-15: clean-up batch 1 executed by the coordinator (user, "可以").
  - Start: `mica-build` pin commit `10936ff873d6c55eabcaddd2b182667cc8d0531d`
    (ci run 34965915849 green), pinning `mica-system-base` `20260915-1102`,
    `mica-podman` `20260915-1057` and `mica-boards` `<board>/20260915-1128`;
    `mica-podman` `main` also pins Base `20260915-1102`.
  - Deleted with `gh`, release and tag: `mica-system-base` `20260915-0209`;
    `mica-podman` `20260915-0245`; `mica-boards` `x64`, `virt-arm64`,
    `cx3576` and `s905x5m` `/20260915-0945`.
  - ghcr pruned to the current locks: `mica-system-base` 5 versions
    (`rootfs.20260915-0209`, its index and two untagged per-architecture
    manifests, and `pool.amd64`/`pool.arm64.20260915-0209`); `mica-podman` 2
    (`pool.amd64`/`pool.arm64.20260915-0245`); `mica-boards` 4
    (`pool.<board>.<arch>.20260915-0945`; the `board`, `kernel`, `uboot` and
    `firmware` digests are shared with `20260915-1128` and stay).
  - Verified: the releases and remote tags are exactly Base `20260915-1102`,
    podman `20260915-1057` and boards `<board>/20260915-1128`; each ghcr
    package holds exactly the digests its current locks reference (Base 5,
    podman 2, boards 16), all readable anonymously.
  - Batch 2 (`mica-core` `20260915-0235` and `20260915-0728`) follows the
    `mica-build` pin commit for `mica-core` `20260915-1135`.
- 2026-09-15: clean-up batch 2 executed by the coordinator (user, "可以");
  the clean-up of the pre-rule releases is complete.
  - Start: `mica-build` pin commit `fe3ad07ac0c100f08128f35e416c5551cb88488a`
    (ci run 34969809761 green), pinning `mica-core` `20260915-1135`, Base
    `20260915-1102`, podman `20260915-1057` and boards `<board>/20260915-1128`.
  - Deleted with `gh`, release and tag: `mica-core` `20260915-0728` and
    `20260915-0235`.
  - ghcr `ghcr.io/micaoss/mica-core` pruned to the `20260915-1135` lock: 4
    versions deleted (`pool.amd64`/`pool.arm64.20260915-0728` and
    `pool.amd64`/`pool.arm64.20260915-0235`).
  - Verified: the `mica-core` releases and remote tags are exactly
    `20260915-1135`, and ghcr holds exactly the 2 pool digests of its lock,
    both readable anonymously.
- 2026-09-15: the first `mica-build` scoped release `x64/20260915-1458` is
  published and verified anonymously
  (`docs/decisions/2026-09-15-mica-build-scoped-releases.md`).
  - Target `9fe2d1841716905184b3bc429db53e8211ed392b`; release run
    34985278894 green (plan 13s, product `x64-dev` 6m05s, `x64-minimal`
    4m24s, publish 6m02s). CI on `9fe2d184` (run 34984000340, 17 jobs)
    includes the release-product jobs (`x64-minimal` 5m31s,
    `cx3576-minimal` 8m47s) through the reusable
    `.github/workflows/release-product.yml` shared with `release.yml`.
  - `SHA256SUMS` sha256
    `97126a89da28280433b0e6efdf87c004a15aad7ea5cdcbf2f155530a098910aa`;
    `mica-build.lock` sha256
    `432bac4489c8e0283e027df2edff2e0f0c40f5e4abeab6c369db84ab5097e344`;
    `tools/locks.py` and `mica`'s reference checker accept the lock.
  - Inputs: `mica-boards.x64` `20260915-1128`, `mica-build-env`
    `20260915-0138`, `mica-core` `20260915-1135`, `mica-podman`
    `20260915-1057`, `mica-system-base` `20260915-1102`.
  - Products at generation 2: `x64-dev` (deployment `d48d43a9...`, kernel
    `6e7ccf8b...`, rootfs `02a3045d...`) and `x64-minimal` (deployment
    `c7265e3b...`, kernel `5f1c90ce...`, rootfs `24810a9b...`).
  - Bundles in `ghcr.io/micaoss/mica-build` (public):
    `image.x64-dev.20260915-1458`, `update.x64-dev.20260915-1458`,
    `image.x64-minimal.20260915-1458`, `update.x64-minimal.20260915-1458`.
  - Assets: `mica-x64-dev-20260915-1458.img` (1881145344 bytes) and
    `.micaupd` (81425461), `mica-x64-minimal-20260915-1458.img` (1881145344)
    and `.micaupd` (47510585); `full` archives only, as the first release.
  - The failed earlier cuts `x64/20260915-1243`, `x64/20260915-1252` and
    `x64/20260915-1312` (no assets) were deleted with their tags by the
    coordinator under the user's development-phase deletion authorization.
    Fixes: `5e470205` (plan skips the current and empty releases), `8996653a`,
    `dc3a6483` and `4cf3b7d8` (fetches on a fresh runner), `c91c5fe1`
    (containerd image store), `1fc66393` (update archives mode 0644),
    `c843bd02` (the reusable release-product workflow and its CI jobs),
    `1fa95611`, `0b6bd6d2`, `9e5abf70`, `d2312c35`, `d2a2a11d`, `9fe2d184`.
  - Next: the `cx3576` scope; K1 and K2 after the first scoped releases; the
    user still decides `s905x5m` as a release target and a compressed image
    kind.
- 2026-09-15: `mica-build` scoped release `cx3576/20260915-1515` is published
  and verified anonymously.
  - Target `9fe2d1841716905184b3bc429db53e8211ed392b`; release run
    34987139279 green (plan 15s, `cx3576-dev` 10m06s and `cx3576-minimal`
    8m53s on `ubuntu-24.04-arm`, publish 2m28s).
  - `SHA256SUMS` sha256
    `01c261093177a07c576aa8dcbdac4943149770a693886f51467d9c7e665b828e`;
    `mica-build.lock` sha256
    `3666175948a8c4b9b5ecb3b3fc928698dc8c5393adec8a8f7aa8cabfc2689eb8`;
    `tools/locks.py` and `mica`'s reference checker accept the lock.
  - Inputs: `mica-boards.cx3576` `20260915-1128`, `mica-build-env`
    `20260915-0138`, `mica-core` `20260915-1135`, `mica-podman`
    `20260915-1057`, `mica-system-base` `20260915-1102`.
  - Products at generation 2, profile `dev`: `cx3576-dev` (deployment
    `bc2d86fa...`, kernel `6f8f9898...`, rootfs `8432f50d...`) and
    `cx3576-minimal` (deployment `1acc66f4...`, kernel `c6bec0b9...`, rootfs
    `3cd901ca...`).
  - Bundles `image.cx3576-dev.20260915-1515`, `update.cx3576-dev.20260915-1515`,
    `image.cx3576-minimal.20260915-1515` and
    `update.cx3576-minimal.20260915-1515`; assets
    `mica-cx3576-dev-20260915-1515.img` (1362100224 bytes) and `.micaupd`
    (84986579), `mica-cx3576-minimal-20260915-1515.img` (1362100224) and
    `.micaupd` (48609999); `full` archives only.
  - Both release-target boards are now released. `virt-arm64` and `s905x5m`
    are `BOARD_RELEASE_TARGET=0` in `mica-boards` (`s905x5m` pending a user
    decision). Every product is `PROFILE=dev` today; there is no prod product
    yet (pending a user decision).
  - Next in `mica-build`: K1 and K2 of
    `docs/decisions/2026-09-15-stable-component-ids.md`.
- 2026-09-15 (user): stage 4 follow-ups. `mica-boards` kernel builds
  (`docs/decisions/2026-09-15-board-kernel-builds.md`): an incremental prod
  kernel after dev on FIT boards with a byte-identical test, together with
  pinned kernel and U-Boot toolchains, followed by one planned release of all
  four boards; CI reuse of unchanged kernel and U-Boot components only after
  that; a `virt-arm64` config trim evaluated by `mica-build` first; no ccache.
  Release images and products
  (`docs/decisions/2026-09-15-release-images-and-products.md`): `s905x5m`
  stays out of the release targets; `mica-build` publishes disk images as
  deterministic `.img.gz`, never the raw `.img` (corrected the same day from
  zstd; the raw image is still built and verified, and its record is
  proposed by `mica-build`); `x64-prod` and `cx3576-prod` are added with
  development keys on the development channel.
- 2026-09-15 (user, "删除这个构建"): the minimal products are removed
  entirely (`docs/decisions/2026-09-15-no-minimal-products.md`). The products
  become `<board>-dev` for all four boards plus `x64-prod` and `cx3576-prod`;
  CI's release-product jobs run the prod product of each release-target
  board; the featureless floor stays as a cheap composition test. The
  published `x64/20260915-1458` and `cx3576/20260915-1515` keep their minimal
  assets as history; the next scoped releases carry dev and prod only.
  `mica-build` removes them in the prod-products round, after K1 and K2.
