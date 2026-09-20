# 20260913-0409-bun-from-build-base Run bun from mica-build-base instead of IMAGE_BUN_1

- **status**: implementing
- **createdAt**: 2026-09-13 04:09
- **approvedAt**: 2026-09-13 (revision 2; user: public package, CI publishes)
- **relatedTask**: 20260913-0409-bun-from-build-base

## Context

Two buns are pinned today:

- `IMAGE_BUN_1=oven/bun:1@sha256:5ff6...` in `mica-build-env:images.env`: a
  public, multi-architecture image (bun 1.4.0, Debian trixie, root,
  `WORKDIR /home/bun/app`, `docker-entrypoint.sh`, `bunx`, a `node` fallback).
- `localhost/mica-build-base:<arch>`, built by `mica-build-env:build.sh` since
  `c9174f8`: Debian trixie plus bun 1.4.2 from the upstream zip, verified by
  `BASE_BUN_SHA256_{AMD64,ARM64}`, asserted exactly and recorded in
  `/etc/mica-build/base.env`. Every consumer pins a mica-build-env at or after
  that commit.

Every call site runs `bun ...` or `bash ...` explicitly; none relies on the
oven/bun entrypoint, `bunx`, `node` or the working directory.

Call sites of `IMAGE_BUN_1` (code, re-surveyed 2026-09-13 after the split):

| Repository | File | Use |
|---|---|---|
| mica-build | `build/run.sh` | `--ref`, base of the derived bun + docker CLI image |
| mica-build | `verify/run.sh` | `--ref`, `docker pull`, `MICA_BUN_IMAGE` for `verify/Dockerfile` |
| mica-build | `rootfs/build.sh`, `rootfs/compose/10-compose.Dockerfile` | pair form `MICA_IMAGE_BUN=IMAGE_BUN_1`; `FROM --platform=$TARGETPLATFORM ${MICA_IMAGE_BUN} AS bootstrap` |
| mica-build | `rootfs/scripts/validate-public-meta.sh` | `--ref`, `docker run ... bun -e` |
| mica-build | `tests/apid-api/run.sh`, `tests/apid-api/spec-pins.sh` | `--ref` with the `MICA_APID_BUN_IMAGE` override, `docker pull` |
| mica-build | `tests/lifecycle-uefi/bun.sh`, `tests/lifecycle-uefi/firmware.sh` | `--ref`, derived images |
| mica-build | `tests/p1-writable-path-audit/boot.sh` | `--ref`, derived image |
| mica-build | `build/src/images.test.ts` | asserts the key is a digest pin and resolves |
| mica-build | `.github/workflows/check.yml` | CI has no bun by design; the verify suite and UI checks run in `IMAGE_BUN_1` and assert its reference in the log |
| mica-core | `apid/ui/build.sh`, `gate/apid-ui-build-contract-test.sh` | `--ref`; the gate greps for the key |
| mica-debian | `docker.sh`, `tests/debian-base-test.sh`, `tests/debian-lock-test.sh` | `--ref`, `docker run ... bash run.sh` |

**What this table is a census of, and what it is not** *(2026-09-20)*. It
lists **call sites of the key** — files that would break if `IMAGE_BUN_1`
moved — and says nothing about whether each one is invoked.
`mica-build:tests/lifecycle-uefi/firmware.sh` **has no caller anywhere in that
repository** *(swept across 151 shell scripts by `mica-build`; checked here
only that its `Makefile`, `tests/lifecycle-uefi/run.sh` and the three
workflows do not name it)*. **For this table's purpose that changes nothing**
— an uninvoked call site still breaks the moment somebody wires it up, which
is exactly what a key survey must catch. **For a reader looking for coverage
it changes everything**, and this table cannot tell them: a file is listed
here because it *mentions the key*, never because it runs. Whether that
instrument is dead or merely unwired is `mica-build`'s question and it is
open; nine other uncalled scripts there are named `reset`, `large-root`,
`dirty-system`, `read-system` and so on, which read as gaps rather than as
dead code.

Why not the local tag (revision 1 of this plan): a `LOCAL_` key resolves only
from the local store, so CI and every fresh host would have to build the base
first, and the cross composition (`FROM --platform=$TARGETPLATFORM`) would need
the target architecture's base exported as an OCI layout through the build
driver. Revision 1's step 1 (`build.sh [<image> ...]`, `mica-build-env`
`f222a7b`) stays useful and is kept.

Why GHCR now: `docs/decisions/2026-09-13-ghcr-artifact-registry.md` makes
`ghcr.io/<former organisation>/` the registry for every artifact, pinned by digest, and
`20260913-0416-board-product-build-architecture` phase 6 (in progress in
`mica-build-env`: `deb/oci.sh`, `deb/registry.{env,sh}`) builds the client.
A digest-pinned multi-architecture base on GHCR is an ordinary `IMAGE_` key:
`docker pull` and `--platform` resolution keep working at every call site.

Facts that shape the proposal:

1. `build.sh` already resolves an `IMAGE_*=name:tag@PENDING` by
   `docker buildx imagetools inspect` and prints the index digest to record;
   `from.sh` accepts `ghcr.io/<former organisation>/...:<tag>@sha256:<64 hex>` as a pin.
2. The base's content does not depend on an `IMAGE_MICA_BUILD_BASE` key (only
   `BASE_*` keys reach its lock), so recording the published digest in a
   later commit does not change the image it names.
3. The local `gh` token (account `aamf`) carries `repo, workflow, gist,
   read:org` and no `read:packages`/`write:packages`; pushing needs a token with
   `write:packages`, or a workflow with `permissions: packages: write`.
4. The repositories are private. A private GHCR package needs
   `docker login ghcr.io` on every host and CI job that pulls it; oven/bun
   needed none.
5. bun moves 1.4.0 -> 1.4.2; `mica-core:apid/ui/build.sh` notes that a
   different bun produces different UI chunk hashes.

## Proposal

### 1. mica-build-env: publish the base to GHCR

- `publish-image.sh base`: for each of `amd64 arm64`, run
  `MICA_BUILD_PLATFORM=linux/<arch> build.sh base`, tag
  `localhost/mica-build-base:<arch>` as
  `ghcr.io/<former organisation>/mica-builder/base:build-<commit12>-<arch>` (repository name
  from `oci_repo builder base`, the C6 convention), `docker push` both, then
  `docker buildx imagetools create -t ghcr.io/<former organisation>/mica-builder/base:build-<commit12>`
  over the two pushed digests, and print the index digest. Refuses a dirty
  tree (the tag names a commit) and a missing `write:packages` token by name.
  OCI annotations: `org.opencontainers.image.revision`, `.source`, `.created`.
- `images.env`: `IMAGE_MICA_BUILD_BASE=ghcr.io/<former organisation>/mica-builder/base:build-<commit12>@sha256:<index>`,
  recorded through the existing PENDING flow in the commit after the publish.
- Drift guard in `build.sh`: read `/etc/mica-build/images.env` out of the
  pinned image's amd64 manifest (`docker create` + `docker cp`, no exec) and
  refuse when its `BASE_*` pins differ from `images.env`, naming
  `publish-image.sh base` as the remedy. A `BASE_BUN_VERSION` bump then cannot
  ship without republishing.
- `.github/workflows/publish-base.yml` in mica-build-env, on a push that
  changes `base/`, `lib/` or `BASE_*` keys: the same script with
  `permissions: packages: write` and `GITHUB_TOKEN`, arm64 under QEMU.

### 2. Consumers: switch every call site

- `--ref IMAGE_BUN_1` -> `--ref IMAGE_MICA_BUILD_BASE` in every file of the
  table; `MICA_IMAGE_BUN=IMAGE_BUN_1` -> `MICA_IMAGE_BUN=IMAGE_MICA_BUILD_BASE`
  in `rootfs/build.sh` (the compose Dockerfile's ARG keeps its name, or is
  renamed `MICA_IMAGE_BUILD_BASE` in the same change).
- The `docker pull` fallbacks stay; their messages name the new key and, if
  the package is private, `docker login ghcr.io`.
- `build/src/images.test.ts` and `mica-core:gate/apid-ui-build-contract-test.sh`
  name the new key; `check.yml` asserts the new reference in its logs and, if
  private, logs in to GHCR with `MICA_DEPS_TOKEN`.
- Bump the mica-build-env pin in mica-build, mica-core and mica-debian.

### 3. mica-build-env: remove IMAGE_BUN_1

- Delete `IMAGE_BUN_1`; reword the `IMAGE_DOCKER_CLI_28` comment that names it.
  Publish and bump.

Verification:

1. `publish-image.sh base` pushes both architectures;
   `docker buildx imagetools inspect ghcr.io/<former organisation>/mica-builder/base:build-<c12>`
   lists linux/amd64 and linux/arm64; `docker run --rm --platform linux/arm64
   <ref> bun --version` prints 1.4.2 on an emulating host; `make build-env`
   passes with the key recorded and fails when `BASE_BUN_VERSION` is changed
   without republishing.
2. `rg IMAGE_BUN_1` over mica-build, mica-core, mica-debian is empty;
   `make os-verify-test`, `make os-apid-api-spec-pins`, `bun test build/src`,
   `make lifecycle-uefi PRODUCT=x64-dev` (assembly stage), mica-debian's
   `tests/debian-base-test.sh` and `tests/debian-lock-test.sh`, mica-core's UI
   build and contract gate, `make product PRODUCT=x64-minimal` natively and
   `make product PRODUCT=cx3576-minimal` through the cross builder; CI green.
3. `rg IMAGE_BUN_1` over mica-build-env is empty; `from.sh --check` passes.

## Risks

- Access: pushing needs `write:packages` (not held by the local token), and a
  private package needs `docker login ghcr.io` wherever it is pulled, which
  oven/bun did not.
- The base on GHCR can lag the tree; the drift guard turns that into a refusal
  rather than a silent older bun.
- Two builds of the same Dockerfile coexist: the published base for bun
  routes and the local base the toolchain images stand on. Their `BASE_*`
  pins are held equal by the drift guard, but their apt layers are separate
  resolutions.
- bun 1.4.2 changes apid UI chunk hashes and possibly other bun-produced
  artefacts, once.
- Coordination: phase 6 of `20260913-0416-board-product-build-architecture`
  is editing `mica-build-env` (uncommitted `deb/oci.sh`, `registry.*`) and
  may change how consumers bump pins; this plan touches `images.env`, a new
  `publish-image.sh` and a new workflow there, and follows whatever pin
  mechanism is current when step 2 bumps.

## Scope

- mica-build-env: `publish-image.sh` (new), `build.sh` (drift guard),
  `images.env`, `.github/workflows/publish-base.yml` (new).
- mica-build: 10 files plus `check.yml`. mica-core: 2 files. mica-debian: 3 files.
- Two mica-build-env commits (key, then removal), three consumer pin bumps.

## Alternatives

- **Local tag (revision 1)**: no registry, but CI builds the base itself and the
  cross composition needs OCI layout plumbing through `build/src/stages.ts`.
- **Pin oven/bun exactly** (`oven/bun:1.4.2@sha256:...`): a one-line change
  with no access work, but two bun installs remain, bumped by hand in step.
- **Push the base to GHCR from `build.sh` itself** (`--push`): one script
  fewer, but every local `make build-env` would need push credentials or a
  flag, and publishing is a release act, not a build.

## Annotations

- 2026-09-13 (user): reuse the base image rather than keep a separate bun image.
- 2026-09-13 (user, "a"): take the GHCR route. Open questions for approval:
  GHCR package visibility (public, no login anywhere; or private, login on
  every host and job), and which token publishes (a `write:packages` PAT, or
  only the mica-build-env workflow).
- 2026-09-13 (user): the GHCR package is public; only CI publishes it (no local write:packages token).
- 2026-09-13 17:30: step 1 landed in mica-build-env. `f222a7b` `build.sh [<image> ...]`;
  `17f0bf7` `publish-base.sh` and `.github/workflows/publish-base.yml`; `23a640e`
  the inputs check keyed by tag; `3c8105e` `IMAGE_MICA_BUILD_BASE=ghcr.io/<former organisation>/mica-builder/base:inputs-5945e2709ded73a9@sha256:6efc38f6...`.
  The workflow built both architectures under QEMU, pushed them and the index,
  and is green once the pin is recorded. Tested first against a local
  `registry:2`: both platforms in the index, `bun --version` 1.4.2 from the
  pulled image, `--check` green on the recorded pin and red after a `BASE_*`
  change. Deviations: the script is `publish-base.sh` (no image argument);
  the drift guard is `publish-base.sh --check` in the workflow, comparing the
  pin's `inputs-<sha256 prefix>` tag with the tree offline, not a registry read
  in `build.sh` -- the first CI run showed that the runner's docker image store
  pushes a docker manifest list, which drops index annotations. Open: the
  package was created private and needs its visibility set to public in the
  GitHub UI (no API); consumers can pin 3c8105e only after mica-build-env is
  published as a source artifact, which needs a `write:packages` token.
- 2026-09-13 18:49: the two open items above are resolved. At mica-build-env
  `41f292694f9e` the base index `sha256:6efc38f6e1fb44d6ada7abe15291ed5edf253f1426933a13b34b522daa3704a7`
  and the source artifact `mica-source:mica-build-env.build-41f292694f9e`
  (manifest `sha256:013c0bab9fa39fe0b3cf27d1c00945134cd7aea529d2820ef81e4cfab0407948`)
  are anonymously readable, and the inputs check passed. Step 2 remains for
  mica-build and mica-core; mica-debian no longer calls `IMAGE_BUN_1`, so its
  three rows in the table need no change. Step 3 waits on those two
  migrations. `LOCAL_MICA_BUILD_BASE` is unaffected: it stays the local base
  the toolchain images are built on.
- 2026-09-15: pre-reset history: the `mica-build-env` commits cited here
  (`f222a7b`, `17f0bf7`, `23a640e`, `3c8105e`, `41f292694f9e`, `c9174f8`) are
  no longer on its `main`, which the user reset to one root commit
  (`5c05745`); the current `mica-build-env` facts (release `20260915-0138` at
  `f7b896b`) are in `docs/task/20260914-2042-release-lock-offline-build.md`.
