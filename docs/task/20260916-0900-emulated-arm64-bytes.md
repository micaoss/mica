# 20260916-0900-emulated-arm64-bytes Identify what in a Rust build is sensitive to emulation

- **status**: pending
- **priority**: P2
- **owner**: `mica-core` (vtv87o8e), assigned 2026-09-16
- **createdAt**: 2026-09-16 09:00

## Description

`mica-core`'s six Rust packages differ, byte for byte, between an emulated
arm64 build on the amd64 station and the native arm64 build that was released,
with every pinned input equal. **Emulation itself is not the cause**: two
controls in other repositories reproduce across the same boundary, so the
question is what in a Rust build is sensitive to the emulated environment when
C, make, meson, ninja and data packaging are not.

The measurement that established the fact (`mica-core`, 2026-09-16): on
build-env `20260916-0735` its amd64 pool reproduced release `20260915-1135`
six of six and its emulated arm64 pool differed six of six; the control, the
same station and emulation with the previous build-env lock `20260915-0138`,
produced exactly the same arm64 bytes, all six still unlike the published ones.
So the executor is the difference, not the toolchain move.

Scope: diff one binary from a released arm64 `.deb` against its emulated build
and name the cause — build id, embedded path, timestamp ordering, code
generation, or something outside those four.

**What makes it decidable.** Three of the four candidate causes — a build id,
an embedded path, timestamp ordering — are stamps this project controls and
could pin, so finding one of them means emulated arm64 bytes can be made to
match. The fourth, code generation differing under emulation, is not something
we can fix; it can only be avoided by building natively. So the answer decides
the property, not just the defect: whether byte-identical builds on a foreign
architecture are achievable at all, or whether a native build is a hard
requirement of byte-identical reproduction.

That is also why the answer matters more than any fix that follows it. Until
it is known, `docs/design/release-lock.md` section 5 states the bound as
measured — byte-identical on the same architecture natively — rather than
guessing which way it will fall.

## ActiveForm

Not started

## Dependencies

- **blocked by**: the current release round; the coordinator deferred this until after it
- **blocks**: nothing

## Controls that bound it

- `mica-system-base`, 2026-09-16 on build-env `20260916-0735`: all eight
  archives byte-identical to `20260915-1102` on both architectures, in CI over
  natively built artefacts and locally with arm64 under QEMU. It compiles
  BusyBox and systemd-boot — C, make, meson, ninja — and packs two data
  packages.
- `mica-podman`, 2026-09-14 at `09ccebe`: a local `make offline` with arm64
  under emulation compared byte for byte against the CI artefacts of the same
  commit, both architectures identical across the `.deb`, `Packages` and
  `SHA256SUMS`. Its re-check against the natively published arm64 archive of
  `20260916-0846` is pending, so treat it as a strong prior rather than
  settled.

## Notes

- 2026-09-16: owner deliberately unassigned while the release round runs. The
  coordinator assigns it when the round is done; `mica-core` is the natural
  owner, having both halves measured and the station set up, and is mid-release.
- 2026-09-16: opened from the coordinator's dispatch. Recorded in
  `docs/design/build-harness.md` section 4, `docs/design/build.md` and
  `docs/design/release-lock.md` section 5, and in `docs/user/build.md` for the
  offline path.
- 2026-09-16: assigned to `mica-core` and raised to P2 after two controls
  narrowed the finding from "emulation changes bytes" to "something in a Rust
  build is sensitive to emulation". `mica-core` is the only repository showing
  the difference and has both halves measured on one machine.
