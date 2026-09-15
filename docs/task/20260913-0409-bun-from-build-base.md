# 20260913-0409-bun-from-build-base Run bun from mica-build-base instead of IMAGE_BUN_1

- **status**: in_progress
- **priority**: P2
- **owner**: claude/bun-base-20260913
- **createdAt**: 2026-09-13 04:09

## Description

`mica-build-base` now carries a sha256-pinned bun 1.4.2 (mica-build-env
`20260913-0116-trim-comments-extract-dockerfile-scripts`), while every bun
container route in the consumers still uses `IMAGE_BUN_1=oven/bun:1@sha256:5ff6...`
(bun 1.4.0). Publish the base to GHCR as a digest-pinned multi-architecture
image (`IMAGE_MICA_BUILD_BASE`), move those routes onto it so the tree runs
one bun, then drop `IMAGE_BUN_1` from `build-env/images.env`.

Acceptance:

- No reference to `IMAGE_BUN_1` remains in mica-build-env, mica-build, mica-core or
  mica-debian.
- CI pulls the published base and runs the verify suite and the other bun
  jobs in it.
- `make product` composes x64 natively and cx3576 cross on the new base.
- The verify, apid-api, lifecycle-uefi and mica-debian suites pass.

## ActiveForm

Moving bun container routes onto mica-build-base

## Dependencies

- **blocked by**: step 3 (removing `IMAGE_BUN_1`) waits on the mica-build and mica-core consumer migrations; the earlier GHCR access and visibility blockers are resolved (see Notes, 2026-09-13 18:49)
- **blocks**: (none)

## Notes

Plan: `docs/plan/20260913-0409-bun-from-build-base.md`.

2026-09-13: step 1 code landed as mica-build-env f222a7b (`build.sh [<image> ...]`),
verified through a throwaway consumer: `build.sh base` and `build.sh deb` each
built only that image, an unknown name and a selected row with no parent in
the store were refused. Not published: mica-build-env holds another worker's
uncommitted GHCR registry migration (deb/oci.sh, registry.{env,sh}), and
`tools/deps.sh publish-source` refuses a dirty tree. Step 2 paused: it edits
`rootfs/build.sh`, CI and the verify routes that
20260913-0416-board-product-build-architecture (implementing, P1) is rewriting,
and that plan's C6 puts artifacts on GHCR, which makes a digest-pinned
mica-build-base on GHCR an option.

2026-09-13: on the user's choice the plan was revised to the GHCR route (revision 2, draft, awaiting approval).

2026-09-13 17:30: step 1 done (mica-build-env f222a7b, 17f0bf7, 23a640e, 3c8105e;
publish-base workflow green). Blocked on: package visibility (set public in
the GitHub UI) and a mica-build-env source publish for the consumer bumps.

2026-09-13 18:49: both blockers are resolved. At mica-build-env `41f292694f9e`
the multi-architecture base `ghcr.io/<former organisation>/mica-builder/base@sha256:6efc38f6e1fb44d6ada7abe15291ed5edf253f1426933a13b34b522daa3704a7`
and the source artifact `ghcr.io/<former organisation>/mica-source:mica-build-env.build-41f292694f9e`
(manifest `sha256:013c0bab9fa39fe0b3cf27d1c00945134cd7aea529d2820ef81e4cfab0407948`)
are anonymously readable (an anonymous registry token read both manifests at
those digests) and the inputs check passed (mica-build-env owner's report). Remaining: step 2 in mica-build
and mica-core (the table's call sites); mica-debian has no `IMAGE_BUN_1`
caller left, so it needs no migration. Step 3 waits on those two migrations.
`LOCAL_MICA_BUILD_BASE` keeps its separate role: the local base the toolchain
images are built on.

2026-09-15: pre-reset history: the `mica-build-env` commits cited here
(`f222a7b`, `17f0bf7`, `23a640e`, `3c8105e`, `41f292694f9e`) are no longer on
its `main`, which the user reset to one root commit (`5c05745`); the current
`mica-build-env` facts (release `20260915-0138` at `f7b896b`) are in
`docs/task/20260914-2042-release-lock-offline-build.md`.
