# 20260914-0503-retire-mica-boot Split mica-boot into Base, boards and build, then retire it

- **status**: in_progress
- **priority**: P1
- **owner**: olea2l5k (records); each step by its repository owner
- **createdAt**: 2026-09-14 05:03

## Description

The user decided on 2026-09-14 that `mica-boot` is split three ways and then
retired: systemd-boot goes to `mica-system-base`, the packaging, signing and
key tools go to `mica-build`, and `common/` with `verity-tool.sh stage` goes
to `mica-boards`. Decision: `docs/decisions/2026-09-14-mica-boot-split.md`.
Plan: `docs/plan/20260914-0503-retire-mica-boot.md`.

Acceptance: no repository pins or calls `mica-boot`; the Base pool carries the
unsigned loader and `mica-build` signs it; the boards build from public
certificates only; the user has retired the repository.

## ActiveForm

Splitting mica-boot into Base, boards and build

## Dependencies

- **blocked by**: step 4 waits for the `mica-system-base` loader release, the `mica-boards` import, and the end of the `mica-build` pause
- **blocks**: (none)

## Notes

- 2026-09-14: step 1 (the records) done. Step 2's package is implemented in
  `mica-system-base` (`db2f33e`), release in progress. Steps 3-5 not started.
- 2026-09-14: the user states that `mica-boot` is removed from the project; it
  does not move to `micaoss`. The code has not caught up: the local checkouts
  of `mica-boards` (`c36728a`) and `mica-build` (`1584825a`) still pin
  `deps/sources/mica-boot.json`, so steps 3 and 4 remain.
- 2026-09-14: step 3 done. `mica-boards` moved to `micaoss` on user
  instruction (public, `main` a single root commit `5b7fd98`); it carries
  `common/` (`kernel/`, `uboot/`, `trust/` with the certificate-only
  `stage.sh`, `package/`, `scripts/`), has no `boot/` source pin, and
  merged its families into the boards (each board's kernel and loader build
  under `boards/<board>/`). Its build env is the `build-env-image.lock` of
  `20260914-0128`. Not yet released: CI needs the certificate secrets the
  user adds. Step 4 remains.
- 2026-09-15: the `mica-build-env` release `20260914-0128` cited here is
  deleted and no longer pulls (user); the `mica-build-env` release to pin is
  `20260915-0138` in the `mica-lock v1` format
  (`docs/task/20260914-2042-release-lock-offline-build.md`).
- 2026-09-15: the `mica-system-base` commit `db2f33e` cited here is pre-reset
  history (its history is squashed into the root `4d63430`, user);
  `debs/mica-systemd-boot` is part of that root, and the current Base is
  `20260915-1102` at `3ae160d`, whose release carries only
  `mica-system-base.lock` and `SHA256SUMS`
  (`docs/task/20260914-2042-release-lock-offline-build.md`).
