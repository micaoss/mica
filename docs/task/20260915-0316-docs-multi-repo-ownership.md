# 20260915-0316-docs-multi-repo-ownership Restate the documentation system for seven repositories

- **status**: in_progress
- **priority**: P1
- **owner**: claude/docs-multi-repo-20260915
- **createdAt**: 2026-09-15 03:16

## Description

`20260912-2049-docs-restructure` reorganised `docs/` while Mica OS was one
repository plus a few satellites. The project is now seven repositories — `mica`,
`mica-core`, `mica-build`, `mica-boards`, `mica-system-base`, `mica-build-env`,
`mica-podman` — and the documentation still describes the old shape.

What the audit found, with evidence:

- **`architecture.md` maps directories that are no longer here.** Its component table
  points at `rootfs/` and `boards/`, and its tree lists `boards/`, `boot/`, `deps/`,
  `rootfs/` as directories of this repository. They belong to `mica-build` and
  `mica-boards`. The same file already states that `mica-boot` "is split and retired
  (decision 2026-09-14)" without restating the structure around it.
- **Component paths are wrong.** The table cites `mica-core:micad/`, `mica-core:apid/`,
  `mica-core:mqttd/`, `mica-core:broker/`. `mica-core` is one Cargo workspace under
  `crates/`.
- **Five designs have two owners.** `micad`, `apid`, `mqtt`, `deployment` and
  `packaging-and-release` exist both here (`docs/design/`) and in `mica-core/docs/design/`,
  and they have already diverged: this repository's `micad.md` (575 lines) opens on the
  settings/reconciler/D-Bus contract; `mica-core`'s opens on the crate and package it
  actually builds.
- **Record ownership is inconsistent.** `mica-core`, `mica-boards`, `mica-system-base` and
  `mica-podman` each keep `docs/{task,plan,changelog}`, while `mica-build` has no `docs/`
  and its README routes its records here. This repository holds 37 tasks and 21 plans, many
  of them work that happens in another repository.
- **The gates only see this repository.** `tools/docs/verify-index.sh` checks
  `design/ user/ website/ boards/ research/` against `docs/README.md`. Nothing detects that
  a document here contradicts its counterpart in another repository.

Scope: decide and implement one ownership rule across the seven repositories, move the
documents that are in the wrong place, rewrite `architecture.md` as a repository map, and
extend the gates so cross-repository references are checked rather than assumed.

Acceptance criteria:

- every fact has exactly one owning repository and no document duplicates another
- `architecture.md` describes repositories and the interfaces between them, not directories
  of a single tree
- every cross-repository reference resolves, and the gates fail when one does not
- the website still builds from the allowlist and publishes the same user documentation
- `make docs-verify docs-verify-test` passes

## ActiveForm

Restating the documentation system for seven repositories

## Dependencies

- **blocked by**: (none)
- **blocks**: (none)

## Notes

Supersedes the single-repository assumption of `20260912-2049-docs-restructure`, which was
correct when it was written.
