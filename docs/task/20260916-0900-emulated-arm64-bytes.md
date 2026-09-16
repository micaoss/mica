# 20260916-0900-emulated-arm64-bytes Identify what differs inside an emulated arm64 archive

- **status**: pending
- **priority**: P3
- **owner**: unassigned; `mica-core` offered the first diff
- **createdAt**: 2026-09-16 09:00

## Description

An arm64 Debian archive built under emulation on an amd64 station differs, byte
for byte, from the same archive built natively on an arm64 runner with every
pinned input equal. Nobody has yet identified *what* differs inside it: a build
id, an embedded path, timestamp ordering, or code generation.

The measurement that established the fact (`mica-core`, 2026-09-16): on
build-env `20260916-0735` its amd64 pool reproduced release `20260915-1135`
six of six and its emulated arm64 pool differed six of six; the control, the
same station and emulation with the previous build-env lock `20260915-0138`,
produced exactly the same arm64 bytes, all six still unlike the published ones.
So the executor is the difference, not the toolchain move.

Scope: diff one binary from a released arm64 `.deb` against its emulated build
and name the cause. It decides whether the difference is removable (a stamp we
control) or inherent (codegen under emulation), which in turn decides whether
an offline build on an amd64 station could ever produce the published bytes.

## ActiveForm

Not started

## Dependencies

- **blocked by**: the current release round; the coordinator deferred this until after it
- **blocks**: nothing

## Notes

- 2026-09-16: opened from the coordinator's dispatch. Recorded in
  `docs/design/build-harness.md` section 4, `docs/design/build.md` and
  `docs/design/release-lock.md` section 5, and in `docs/user/build.md` for the
  offline path.
