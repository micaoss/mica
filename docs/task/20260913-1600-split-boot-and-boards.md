# 20260913-1600-split-boot-and-boards Split the boot tooling and every board out of the assembly

- **status**: completed
- **priority**: P1
- **owner**: worker/split-20260913-1600
- **createdAt**: 2026-09-13 16:00
- **completedAt**: 2026-09-13 05:20

## Description

Requested 2026-09-13 after `20260911-2003-split-package-repositories`
closed: `pkgs/` must be emptied entirely (what remains is `mica-boot`, the
UKI/FIT, initramfs and development signing tooling), and every board must
publish its outputs; revised the same evening: the boards live in one
repository, `mica-boards`, rather than one each.
The plan is `20260913-1600-split-boot-and-boards`.

## ActiveForm

Completed: `mica-boot` is a source pin and `mica-boards` publishes every
board's archives; the assembly imports all 27 packages and builds none.

## Dependencies

- **blocked by**: (none)
- **blocks**: (none)

## Notes

The question whether `micad` should become `mica-core` was raised in the
same message and is answered in the plan's annotations; no rename is
made until the user decides.

## Findings

- The board packages share `/etc/fstab` and the repart definitions; in one
  pool that is legal only as mutual `Conflicts`, which the gate now accepts
  for any set, not only a pair.
- The host has no arm64 binfmt handler; the s905x5m userland (the
  Bluetooth bridge) builds only from the `mica-arm64` builder's cache.
- `.gitignore` `/meta/` does not match a symlink named `meta`; the rule is
  `/meta` now, and the signing material was restored from the monorepo.
- No repository carries the `MICA_DEPS_TOKEN` secret the workflows read,
  so every CI run fails at `make deps`; releases are published from the
  developer machine.

## Verification

- `mica-boards` `ec968ea153f7`: `make check`, `make pool` (both
  architectures), `make package-gate` 104/104, release `build-ec968ea153f7`.
- `mica-build` `4725877b`: x64 compose and smoke 12/12, package gate
  342/342, install closure 99/99, `os-verify` 104, release gate 15
  artifacts, manifest test 51/51, verify suite 904/904, netavark 87/87,
  lints; `bash tools/board-pool.sh --check` over the four boards; `make
  help` lists no target under `pkgs/` or a board `bsp/`.
- `mica` docs gates 7/7.
