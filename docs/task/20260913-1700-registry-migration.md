# 20260913-1700-registry-migration Move the pinned artifacts to GHCR and bump every consumer

- **status**: pending
- **priority**: P1
- **owner**: (unassigned)
- **createdAt**: 2026-09-13 17:00

## Description

Phase 6 of `20260913-0416-board-product-build-architecture` landed the OCI
backend (`mica-build-env` `775c90e`, `3b1c8d0`; `mica-boards` `375cdb9`;
`mica-build` `9d830caa`), proven against a local registry container
(`build-env/tests/oci-test.sh`, `mica-build:tests/board-artifact-test.sh`).
Nothing has been pushed to the former organisation's GHCR yet: the token this workspace
holds (`gh auth token`, scopes `gist read:org repo workflow`) has no
`write:packages`/`read:packages`, and GHCR refuses every push with it. The
consumers therefore still fetch through the pinned older `build-env` and
the GitHub Releases it reads; the new scripts are landed, tested and
unused until this runbook runs.

## Steps (publishing is CI's; the user decided 2026-09-13 that no developer machine pushes)

> Superseded in part 2026-09-13 18:41 (user): each repository publishes to
> packages named for that repository, not to the four shared packages named
> in step 2. The steps are kept as recorded; see Notes, 2026-09-13 18:49.

1. Every producing repository publishes from its own workflow with its own
   token (`permissions: packages: write`): `mica-build-env` and `mica-debian`
   `publish-source.yml` on every push to `main`; `mica-boards` `release.yml`
   (`workflow_dispatch`: the pool and every board's bundle); the assembly's
   privileged lane (`make product-release` after every product passed).
   The package repositories (`mica-core`, `mica-deploy`, `mica-system`,
   `mica-podman`) gain the same once they vendor the OCI `tools/deps.sh`
   and bump `build-env`; until then their pools are on GitHub Releases.
2. The packages are PUBLIC (the user's decision, 2026-09-13): a read needs
   no token at all -- the client asks the registry for an anonymous pull
   token (`mica-build-env` `690a879`) -- so no consumer's CI and no
   developer machine needs `read:packages`. GHCR creates every package
   private and has no API to change that: after a repository's first
   publish, set each package public in the organisation's package settings
   (Packages -> the package -> Package settings -> Danger Zone -> Change
   visibility), and allow public packages in the organisation's Packages
   settings. Since `mica-build-env` `ebe01e9` there are exactly four
   packages, `mica-source`, `mica-pool`, `mica-board`, `mica-root`, and an
   artifact is a tag in its kind's package (`<name>[.<arch>].build-<commit12>`),
   so each is made public once and every later publish is public;
   `mica-build-env:.github/workflows/packages.yml` creates all four and
   reports which are still private, and every publisher fails on a private
   one. The first packages, `mica-source/mica-build-env` and
   `mica-source/mica-debian`, are superseded by `mica-source`.
   `mica-boards:release.yml`'s `check` job fails today because
   `MICA_DEPS_TOKEN` is unset in that repository; once the pins point at
   public artifacts it needs no token.
3. Migrate what the assembly pins from the package repositories: run each
   repository's release workflow (or bump its `build-env` and let its
   workflow publish) so `mica-pool:<repo>.<arch>.build-<commit12>` exists
   for the pinned commit, or re-lock to the commit it does publish
   (`make os-lock-bump COMPONENT=<repo>`).
4. In `mica-build`, `mica-boards` and every consumer: vendor
   `mica-build-env:tools/deps.sh` (the OCI one; `mica-debian` has it),
   `make deps-bump DEP=mica-build-env` to a published commit, `make deps`;
   in `mica-build` also `DEP=mica-debian` and `DEP=mica-boot`.
5. In `mica-build`: `make board-add BOARD=<b>` for every board (writes
   `deps/boards/<b>.json` and re-locks the board's packages), then delete
   `deps/packages/mica-kernel-*.json` and the kernel-archive path in
   `tools/board-pool.sh` (marked TRANSITIONAL), `pinnedBoards` in
   `build/src/paths.ts` and `verify/src/paths.ts`, the `KERNEL_PIN` line
   of `tools/product-build.sh`, and the `deps/packages/mica-kernel` filter
   in `check.yml`. `make product PRODUCT=<name>` for every product.
6. Remove the GitHub Releases from the documents once no consumer reads
   them (`docs/design/build.md` already describes the registry).

## ActiveForm

Migrating the pinned artifacts to the registry.

## Dependencies

- **blocked by**: the new package `mica-build-env` being set public (user action in its package settings, no API), and so a published build substrate the consumers' CI can read (see Notes, 2026-09-13 19:05); each later new package being set public after its first publish; the package repositories' bumps
- **blocks**: (none)

## Notes

2026-09-13 17:00: created at the end of phase 6; every step is scripted or
a `make` target, and every script is tested against a local registry.

2026-09-13 18:49: new user direction, given 2026-09-13 18:41 UTC: every
repository owns its CI and publishes to packages named for that repository.
This supersedes the four shared packages (`mica-source`, `mica-pool`,
`mica-board`, `mica-root`) as the target layout of step 2 and
`docs/decisions/2026-09-13-ghcr-artifact-registry.md`, and removes the
dependency of one repository's workflow on write access to a package another
repository created. Evidence for the change: the `mica-debian` publish run 34774732546 (head
`332ab7da6c66`) failed with HTTP 403 when starting its upload to the shared
`mica-source` package. The follow-up is per-repository publication,
not requesting cross-repository Actions grants on the shared packages. Still
in force: public visibility, publication by CI only, no local publication.
Artifacts already published under the shared packages stay (consumers pin
them by digest); no package is deleted. The new package names and tag
grammar are pending the mica-build-env owner's contract and are not recorded
here until it is handed off; steps 3-5 follow it.

2026-09-13 19:05: the contract is settled (full table in
`docs/decisions/2026-09-13-ghcr-artifact-registry.md`, *Per-repository
packages*): `<repository>:source.build-<commit12>`,
`<repository>:pool.<arch>.build-<commit12>`,
`mica-boards:board.<board>.build-<commit12>`,
`mica-build:root.<product>.build-<commit12>`, and the planned
`mica-debian:rootfs.build-<commit12>`. `oci_repo` takes the producer
repository and `oci_tag` keeps dot joining. Pins keep their repository
identity and blob sha256 checks, the only fallback is the 404-only legacy
read with the same checks (decision record), and the old shared packages
are neither deleted nor rewritten. Source layers are byte-stable under the
pinned `gzip -cn` archive command, and historical revisions are published
only by full commit with a required expected sha256 (decision record,
*Source artifacts are byte-stable*). A first publication
counts only after an anonymous read succeeds, not when the upload does.
Separate facts at this point:

- mica-build-env `cb4080d` (on `origin/main`) implements the helpers
  (`deb/oci.sh` `oci_repo <repository>`). Its first publications to the new
  package did not count: `publish-source` run 34776208690 pushed
  `mica-build-env:source.build-cb4080d0bbe8` and `publish-base` run
  34776208488 pushed `mica-build-env:base.inputs-5945e2709ded73a9`, and both
  failed the anonymous read because the package `mica-build-env` was
  private.
- Implementation milestone: mica-build `565d5250` (on `origin/main`) reads
  board bundles from `mica-boards:board.<board>.build-<commit12>`, refusing a
  manifest from another source repository, and pushes product roots as
  `mica-build:root.<product>.build-<commit12>`. It needs mica-build-env's
  `oci_repo <repository>`. Its CI is still blocked:
  `check` run 34775557056 and `privileged.yml` run 34775556553 fail at
  `make deps` because `deps.sh` still fetches the substrate from the private
  GitHub Releases without a token.
- mica-boot `5ac0371` is on `origin/main`; its `release` run 34775603339
  failed at "Fetch the build substrate at its pin" on the same
  private-Releases fetch, so no mica-boot source artifact was published.
- mica-debian `4d2f37c` (dropbear replaces OpenSSH in the lock; procps kept)
  was committed on the user's "commit current" instruction at 18:40:31. It is
  not on `origin/main` (still `332ab7da6c66` at 19:05). The user's 18:43:26
  instruction requests publishing that current source from mica-debian's own
  CI as `mica-debian:source.build-<commit12>`; a source artifact may exist
  before any consumer adopts the changed lock, and it is neither an image
  release nor a device update. mica-build does not adopt the Dropbear content
  pin until the mica-core, mica-system and consumer contracts and gates are
  compatible. Its rootfs plan
  `mica-debian:docs/plan/20260913-1842-publish-system-rootfs.md` and the
  base-only and layered proposals around it are superseded (next note).

The migration is not complete.

2026-09-13: the user requested a new repository, `mica-system-base` (owner:
the mica-system owner), merging `mica-debian` and `mica-system`, with Bun and
TypeScript build tooling (device-side scripts and payload exempt) and radio
and SFTP as board features; the old repositories retire after the migration
(decision record, *One base system repository*). For this runbook the base
system's source, pool and rootfs artifacts move to that repository's own
package once its CI publishes them; the scaffold `c1b9441` publishes nothing.
Until the consumers have moved, the pins to `mica-debian` and `mica-system`
and the artifacts already published for them stay.

2026-09-14: the organisation migration is complete. Every Mica OS repository
(`mica`, `mica-build`, `mica-build-env`, `mica-core`, `mica-system-base`,
`mica-boards`, `mica-podman`) is on `micaoss`, with artifacts under
`ghcr.io/micaoss` and GitHub Releases named by UTC release time; the retired
`mica-debian`, `mica-system`, `mica-deploy` and `mica-boot` did not move.

2026-09-15: pre-reset history: the `mica-build-env` commits cited here
(`cb4080d`, `775c90e`, `3b1c8d0`, `690a879`, `ebe01e9`) are no longer on its
`main`, which the user reset to one root commit (`5c05745`); the current
`mica-build-env` facts (release `20260915-0138` at `f7b896b`) are in
`docs/task/20260914-2042-release-lock-offline-build.md`.

2026-09-15: the `mica-system-base` commit `c1b9441` cited here is pre-reset
history (its history is squashed into the root `4d63430`, user); the current
Base is `20260915-1102` at `3ae160d`, whose release carries only
`mica-system-base.lock` and `SHA256SUMS`
(`docs/task/20260914-2042-release-lock-offline-build.md`).
