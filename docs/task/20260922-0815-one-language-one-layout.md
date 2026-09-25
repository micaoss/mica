# 20260922-0815-one-language-one-layout One language and one layout for the mica-build engine

- **status**: in_progress
- **priority**: P1
- **owner**: claude/session-b7e5abcf
- **createdAt**: 2026-09-22 08:15

## Description

The user asked (2026-09-22, "统一下build的语言和重构一下目录结构") for
`mica-build`'s language to be unified and its directory structure
restructured. Measured at `mica-build` `2e8ebaef` (the merged main): the
engine outside `boards/` is 41,432 lines of TypeScript in three separate Bun
packages (`build/`, `verify/`, `tests/apid-api/`) plus `shared/`, 29,041
lines of bash in 229 files, 5,690 lines of Python in 26 files, 36
Dockerfiles and a 1,365-line Makefile with 82 targets; the same job is done
in two or three languages side by side (the lock reader is Python, its
callers bash, the release manifest TypeScript), `tools/` is a forty-script
directory with no internal order, and `tests/` mixes lints, gates, QEMU
suites, guest scripts, fixtures and contracts at one level.

Acceptance:

- one language for everything that runs on the build host: TypeScript on
  Bun, in one package at the repository root with one lockfile and the
  gates `lint`, `typecheck`, `test`; the Makefile stays the entry point and
  every target is one `bun` invocation;
- shell remains only where Bun is not the toolchain -- inside a container
  whose image is not the build-env base, a guest, an initramfs or a device
  root -- and only under the directories that hold those stages, held by a
  lint with a negative fixture; no Python anywhere in the engine;
- the tree is `src/` (the engine), `stages/` (what runs inside containers
  and guests), `boards/`, `common/`, `producers/`, `products/`, `locks/`,
  `tests/{gates,suites,fixtures}/`, and nothing else at the top beside the
  Makefile, the package files, `.github/` and `trust-certificates.sha256`;
- every phase ends with the product images, the pools, the board bundles
  and a release dry-run's `mica-build.lock` byte-identical to the phase's
  start (the inputs hash may move once when the hashed file list is
  renamed, and that rebuild must reproduce the components byte-identically);
- the records, the workspace instructions and the user guides name the new
  paths and no old one.

The plan is `docs/plan/20260922-0817-one-language-one-layout.md`.

## ActiveForm

Implementing one language and one layout for the mica-build engine: P3 done but for `tools/deb/` and the bsp-image fetch helper; P4 next.

## Dependencies

- **blocked by**: (none)
- **blocks**: P3 of `20260921-1140-merge-boards-into-build` lands in the new
  layout once P1 of this plan is in

## Notes

- 2026-09-22 08:15: investigation done at `mica-build` `2e8ebaef`; the
  measurements and the proposal are in the plan.
- 2026-09-25: P3 slices eleven to thirteen landed (`mica-build` `bc542d3b`, `0675f0e2`, `fa6bed8a`), with
  the repairs CI measured (`b4ea175b`, `8d4a67b3`); `tools/` holds only `tools/deb/`. Details in the plan.
