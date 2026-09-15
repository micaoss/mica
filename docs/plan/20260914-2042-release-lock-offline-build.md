# 20260914-2042-release-lock-offline-build Move every repository to the release lock format and build the chain offline

- **status**: implementing
- **createdAt**: 2026-09-14 20:42
- **approvedAt**: 2026-09-14 (user decisions on the proposal of `mica-build` issue `lppm7hfw`: `locks/`, one pin per input in `locks/pins/`, releases with only the lock and `SHA256SUMS`, packages only in OCI pools, `repos/` with one tool; the driver in `mica-build:tools/offline-chain.sh`)
- **relatedTask**: 20260914-2042-release-lock-offline-build

## Context

Five producers publish five release shapes: `mica-build-env` a
`build-env-image.lock`, `mica-system-base` three files plus per-architecture
pools, `mica-core` and `mica-podman` `.deb` assets (with `core-pkgs.lock` and a
planned `podman-pkgs.lock`), `mica-boards` pools and bundles with a
`SHA256SUMS` over layer titles. Each consumer carries its own readers and
release records. The decision
`docs/decisions/2026-09-14-release-lock-and-offline-build.md` replaces them
with one format, specified in `docs/design/release-lock.md` with test vectors.

## Proposal

### Unified release format (decision section 1)

**Step 0 -- the specification** (`mica`): `docs/design/release-lock.md` and
the vectors under `docs/design/release-lock/vectors/`. Each repository keeps
its own scripts and proves them with the vectors.

**Steps 1 and 2 -- the migration, one repository after another** (user,
2026-09-14). The order follows the dependencies. Each stage starts only after
the previous one has released, and each repository switches its readers and
its writer together in its own stage: it reads its inputs from `locks/`
(`locks/<repository>.lock` and `locks/pins/<repository>.pin`) and releases in
the new format.

| Stage | Repository | Owner | Reads | Writes |
|---|---|---|---|---|
| 1 | `mica-build-env` (done: `20260915-0138`) | its owner issue | its own pins only | `mica-build-env.lock`: `mica-build-env` `image` rows for base, c, go, rust, and `upstream` `image` rows for every approved third-party image (spec 1.2.1) |
| 2 | `mica-system-base` (done: `20260915-0209`) | issue `5jfipe3b` | `mica-build-env` | `mica-system-base.lock` (spec section 3) |
| 3 | `mica-podman` (done: `20260915-0245`), `mica-core` (done: `20260915-0235`) | its owner issue; issue `vtv87o8e` | `mica-build-env`, `mica-system-base` | `mica-podman.lock` (its pool plan adopts this shape); `mica-core.lock`, pools split per architecture |
| 4 | `mica-boards` (done: `<board>/20260915-0824`; current `<board>/20260915-1128`), `mica-build` (in progress: per-board inputs and update packages on `main` `0094a097`; product builds and scoped releases pending) | issue `tdpnmgkr`; issue `lppm7hfw` | `mica-build-env`, `mica-system-base`; `mica-build` also `mica-core`, `mica-podman`, `mica-boards` | `mica-boards.lock` with `pool`, `package` and `board` rows; `mica-build`'s package pins become the lock rows |

Within stage 4, `mica-build` reads `mica-boards`, so `mica-boards` releases in
the new format before `mica-build` switches.

Each stage's switch also takes every third-party image from the `upstream`
`image` rows of `locks/mica-build-env.lock`, by the original name and digest,
and removes the old
files without compatibility (`build-env-image.lock`, `build-env-release`, the
three Base files and `system-base-release`, `core-pkgs.lock`,
`podman-pkgs.lock`, `mica-build`'s `deps/packages/` and `deps/releases/`, the
build-env block of `environment.json`).

There is no transition period (user, 2026-09-14): a repository's first
release in the new format already carries exactly `<repository>.lock` and
`SHA256SUMS`, and no release carries old assets beside it.

Each stage also moves the repository's third-party pins into
`locks/upstream.lock` (spec 4.1): `mica-build-env`'s `images.env` upstream
images and toolchain archives in stage 1, `mica-system-base`'s `sources.json`
and `packages/*.json` in stage 2, `mica-podman`'s `versions.env` in stage 3,
`mica-boards`' `base-images.env` and `sources.env` and `mica-build`'s
`base-images.env` in stage 4. Build parameters that are not pins stay in the
repository's own configuration.

**Rule:** a producer releases in the new format before any consumer reads it
in that format; no stage starts before the previous stage has released.

### Offline build (decision section 2)

| Increment | Scope | Owners |
|---|---|---|
| O1 | No format change: `make offline` in `mica-core`, `mica-podman` and `mica-boards` as a thin name over the existing builds writing `_out/debs`; the driver takes those three through `local-pins.sh` and builds one product; build-env and Base still come from releases | `mica-core`, `mica-podman`, `mica-boards`; driver `mica-build:tools/offline-chain.sh` |
| O2 | After stage 4: `_out/offline/<repository>.lock` and `oci/`, `local-pins.sh` becomes `tools/local-lock.sh` | every producer; `mica-build` |
| O3 | build-env and Base built locally; `repos/` with `tools/repos.sh` in every repository; `MICA_OFFLINE=1` enforced; `docker --network none` where possible | every repository |

## Verification

- Step 0: `make docs-verify` in `mica` proves every vector against
  `expected.tsv`.
- Every writer and reader: its own tests pass the vectors it applies (all lock
  vectors for a lock writer or reader, the pins vectors for a consumer, the
  repos vectors for `repos.sh`); a published lock reads back anonymously at
  every digest and every `package` sha256 is a layer of its pool.
- Each stage: the repository's tree has no old input file, names every input
  only in `locks/`, and its release carries `<repository>.lock`.
- O3: an offline chain with `MICA_OFFLINE=1` produces the same bytes as the
  online build.

## Risks

- A reader that switches before one of its producers has a new-format release
  cannot build; the rule above and the order prevent it.
- With no transition period, a consumer can read a producer only once that
  producer's new-format release exists; the stage order provides it.

## Scope

Specification and records in `mica`; code in every repository, each by its
owner, dispatched by the coordinator.

## Alternatives

- **Keep per-repository formats and teach every reader each one**: rejected by
  the user's decision; five readers per consumer is what this replaces.

## Annotations

- 2026-09-14 (user): the shape is decided; open: where the offline driver
  lives (proposed `mica-build:tools/offline-chain.sh`).
- 2026-09-14 (user, correction): `locks/pins` is a directory with one
  `locks/pins/<repository>.pin` (`mica-pin v1`) per input, not one shared
  file; the `.pin` suffix is `mica-build`'s reading. Moving one input
  replaces its lock and its pin together.
- 2026-09-14 (user, "用ghcr"): `mica-build-env` mirrors every pinned
  third-party image into `ghcr.io/micaoss/mica-build-env` as
  `upstream.<path>.<tag>.<digest12>` and lists them as `image` rows; open with
  the user: index digest on every row (recommended) or the platform manifest.
- 2026-09-14 (user): the offline driver lives in
  `mica-build:tools/offline-chain.sh`, as proposed.
- 2026-09-14 (user, option a): every upstream mirror row names the index
  digest; the platform column states the guaranteed platforms. `mica-build-env`
  implements it this way in its first new-format release.
- 2026-09-14 (user): the migration is sequential by dependency, replacing the
  earlier writers-then-readers layout: `mica-build-env`, then
  `mica-system-base`, then `mica-podman` and `mica-core`, then `mica-boards`
  and `mica-build`; each stage starts after the previous one has released,
  and each repository switches its readers and writer in its own stage.
- 2026-09-14 (user): no transition period; every new-format release carries
  only `<repository>.lock` and `SHA256SUMS`. Third-party pins move into
  `locks/upstream.lock` in each repository's own stage; `mica-build-env` does
  it now in stage 1.
- 2026-09-14 (pre-reset history; the release and commit are deleted): stage 1
  first done. `mica-build-env` `20260914-2353` (`8ec2ff0f5959`,
  `SHA256SUMS` sha256
  `c932a7386b32799a5f42015cf87c3596b0fb0477a69eab96c18bb5d6aa2aed21`) carries
  only `mica-build-env.lock` and `SHA256SUMS`; the lock names base, c, go and
  rust by index and platform manifest and every upstream mirror by index
  digest, one row per guaranteed platform; third-party inputs are pinned only
  in `mica-build-env:locks/upstream.lock`. Stage 2 (`mica-system-base`) has
  started.
- 2026-09-15 (user): the `image` row gains a source column,
  `image <source> <name> <platform> <reference>`, the producing repository
  or `upstream`; names
  and references are the original ones, with no rewriting; `ghcr.io/micaoss`
  republishes no upstream image, so the mirrors (former spec 2.1) are
  dropped. Consumers take third-party images from the `upstream` rows of
  `locks/mica-build-env.lock` by original name and digest. `20260914-2353`
  uses the superseded row shape and mirrors; the next `mica-build-env`
  release replaces it.
- 2026-09-15: stage 1 done at `mica-build-env` `20260915-0030`, deleted since
  (see the `20260915-0138` annotation) (`e042744`,
  `SHA256SUMS` sha256
  `02b712ffbe3cd289a242e63af68e1f81a1cbe7f50bf466d36d34e50122a6dcff`) in the
  source-column row format, with `upstream` rows at their original
  `docker.io` references and nothing republished. The user reset its `main`
  to one root commit (`5c05745`) and deleted the ghcr package and the
  releases `20260914-2353`, `20260914-1129` and `20260914-0128`; the
  recreated package holds only `20260915-0030`. Stage 2 (`mica-system-base`)
  is in progress.
- 2026-09-15: stage 2 done at `mica-system-base` `20260915-0059`, deleted since
  (see the `20260915-0209` annotation)
  (`a6db959`, `SHA256SUMS` sha256
  `88feb509dc516bb97b1b7473d9af8a3e617fa8467958a29b0f93ac72e6620cb4`). On the
  user's direct instruction its history was squashed into that root commit
  and its old releases, tags and ghcr versions deleted. It reads
  `locks/mica-build-env.lock` (`20260915-0030`, since deleted) with its pin and pins its
  third-party inputs in `locks/upstream.lock`. Stage 3 (`mica-podman`,
  `mica-core`) has started.
- 2026-09-15 (user): OCI tags follow the release version,
  `<kind>[.<name>]*.<YYYYMMDD-HHMM>`, never a commit or a hash; unchanged
  artifacts are reused by digest under the new release tag
  (`docs/decisions/2026-09-15-oci-tags-follow-release-version.md`, spec 1.3).
  Each stage adopts it with its release format; `mica-build-env` states it in
  `RULES.md` section 3 (`4a04b7e`).
- 2026-09-15: `mica-build-env` `20260915-0138` (`f7b896b`, `SHA256SUMS`
  sha256 `8efc21bab0b959f436f1131cbfbd0fb37d7f546c447cd6ec5e86f81592e3385c`)
  is its only release and the one to pin: image tags are `<image>.<release>`
  and `<image>.<arch>.<release>`, an image's rebuild key is the config label
  `com.mica.build-env.inputs`, and an unchanged image is reused by digest.
  On user instruction `20260915-0030`, `20260915-0130` and every unused ghcr
  version were deleted. `mica-system-base` and the stage 3 consumers
  (`mica-podman`, `mica-core`) move to `20260915-0138`.
- 2026-09-15: stage 3, `mica-podman` part, done at `mica-podman`
  `20260915-0138` (`6a15000`, `SHA256SUMS` sha256
  `39b47945017d1e6f1bede9f99c686aee89150faa89735773f409860530456873`): only
  `mica-podman.lock` and `SHA256SUMS`, its pools and package by digest; its
  inputs are `locks/` only (build-env, Base and `upstream.lock` `git` rows).
  `repos/` with `tools/repos.sh` and the `_out/offline` lock form are not
  done yet. `mica-core` is in progress; its first attempt `20260915-0145`
  failed on the deleted build-env `20260915-0030` and has no assets.
- 2026-09-15 (user): `mica-system-base`, `mica-podman` and `mica-core`, once
  on `mica-build-env` `20260915-0138` and the final format, each squash their
  history, delete their previous Actions runs, tags and releases, publish a
  completely new version and prune ghcr to the new lock. `mica-system-base`
  is done: root `4d63430`, release `20260915-0209` (`SHA256SUMS` sha256
  `19672ed41506466679d2a93d18d7ba5ecf5ef30817bc0219e859ac80db918ab3`), the
  Base to pin; `20260915-0059` is deleted. `mica-podman` and `mica-core`
  follow.
- 2026-09-15: stage 3, `mica-core` part, done under the clean-release
  instruction: root `239e423`, release `20260915-0235` (`SHA256SUMS` sha256
  `fb2eb30600f49b5c4b016063f7304bc3106cf9782662331e1cfdc0151ce2db21`),
  consuming only `locks/mica-build-env.lock` (`20260915-0138`); its releases
  `20260915-0145`, `20260914-1212` and `20260914-0529` are deleted. The
  `mica-podman` clean release is pending (its squash awaits the user's
  authorization).
- 2026-09-15: stage 3 complete. `mica-podman`'s clean release: root
  `b385fa19`, release `20260915-0245` (`SHA256SUMS` sha256
  `64e2ec07c90947e5e323d15537033f14f720256e304134cc1810c8a34a09bf32`) on
  build-env `20260915-0138` and Base `20260915-0209`; `20260915-0138` and
  `20260914-0158` deleted. Stage 4 (`mica-boards`, then `mica-build` and the
  final image assembly) has started.
- 2026-09-15 (user), stage 4: `mica-build` is the last exit and nothing
  consumes it, so it follows its own release logic
  (`docs/decisions/2026-09-15-mica-build-scoped-releases.md`). A release is
  scoped to a board (all its products) or one product, tagged
  `<scope>/<YYYYMMDD-HHMM>`, and builds, verifies and publishes only that
  scope. It carries per product the compressed factory image, the update
  archive and, for FIT boards, the vendor flashing format as release assets,
  plus `mica-build.lock` and `SHA256SUMS`; `image.<product>.<release>` and
  `update.<product>.<release>` in `ghcr.io/micaoss/mica-build` are the
  canonical copies. The lock row kinds (input, asset) are pending, proposed
  by `mica-build`.
- 2026-09-15 (user), stage 4: `mica-boards` is not merged into `mica-build`
  and releases per board (`<board>/<YYYYMMDD-HHMM>`, only that board, OCI
  tags `board.<board>.<release>` and `pool.<board>.<arch>.<release>`, assets
  exactly `mica-boards.lock` and `SHA256SUMS`), and keeps a machine-readable
  board list in `boards/`
  (`docs/decisions/2026-09-15-mica-boards-per-board-releases.md`). The spec
  gains scoped releases for `mica-boards` and `mica-build` only and scoped
  consumer inputs `locks/<repository>.<scope>.lock` with
  `locks/pins/<repository>.<scope>.pin` (spec 1.0, section 4; vectors and
  checker updated). Stage 4 order: `mica-boards` per-board releases first,
  then its clean-up; `mica-build` after.
- 2026-09-15: `mica-core` `20260915-0728` (`2a4c98d`, `SHA256SUMS` sha256
  `75187b8a312aae80cb02d34e8f92fbab310a742a79a4d75ebc30f4bfbea37590`)
  implements the update packages (partial `MICAUPD1` import,
  `mica/deployment/v2` with `product`, `mica/catalog/v2`); `mica-build` pins
  it and implements its side before the scoped releases.
- 2026-09-15: stage 4, `mica-boards` part, done: the four per-board releases
  `x64`, `virt-arm64`, `cx3576` and `s905x5m` `/20260915-0824` at `0f8e313`,
  each with only `mica-boards.lock` and `SHA256SUMS` and its board's component
  artifacts; `20260914-1603` deleted. Next: the `mica-build` per-board switch,
  the certificate switch, eight products and the scoped releases.
- 2026-09-15: `mica-build` `main` `0094a097` has switched to the per-board
  `mica-boards` inputs and `mica-core` `20260915-0728`: the four
  `<board>/20260915-0824` locks with `SCOPE` pins, component board fetch with
  `outputs.tsv` checks, the image-kinds executor, the `images.tsv` update-row
  reader, `tools/locks.py` at `mica` `a0ec066`, and the `mica/deployment/v2`
  writer, `full`/`root`/`kernel` archives and update-server catalog v2.
  `60a93a48` switched the development certificates to
  `MICA-development-<domain>`. CI and the eight product builds are running;
  the scoped releases follow.
- 2026-09-15: `mica-system-base` `20260915-1102` (`3ae160d`, `SHA256SUMS`
  sha256 `2e3ab8029c2b0c2896c2e99bcaf88a7c955e23f57880444d8df7e11eddb0d5a2`)
  is the first release with version-locked packages; it built everything,
  since `20260915-0209` predates them (D1). Consumers move to it after their
  package-version adaptation.
- 2026-09-15: `mica-podman` `20260915-1057` (`d47ffbc`, `SHA256SUMS` sha256
  `d347fdf5a59ffa39509d9f621113a9a51a252a632b8338ce0e6f6edc839b7426`) is its
  first release under the package-version rules (`mica-podman` `5.8.6-1`).
  Its Base move to `20260915-1102` (`0ed321e`) kept the same inputs and bytes,
  proving reuse without a new release. `mica-build` pins `20260915-1057` and
  Base `20260915-1102` before its first scoped release.
- 2026-09-15: `mica-boards` `<board>/20260915-1128` at `ebf93f7` are its first
  releases under the package-version rules: every package `0.1.0-1` with no
  `Mica-Source-Commit`, pools annotated only `mica.source-repo` and
  `mica.arch` with `mica.inputs` layers, and the board components reused by
  digest from `<board>/20260915-0945`. `mica-build` pins them with
  `mica-podman` `20260915-1057` and `mica-system-base` `20260915-1102` before
  its first scoped release.
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
