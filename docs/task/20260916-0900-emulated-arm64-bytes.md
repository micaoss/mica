# 20260916-0900-emulated-arm64-bytes Identify what a cross-compiled arm64 build carries that the native one does not

> The record id keeps the word `emulated` because it is cited from
> `docs/design/`, `docs/user/` and `mica-core`'s own task; the word is wrong
> and the title is the corrected one. Emulation was the first hypothesis and
> was overturned on 2026-09-16 by the repository that raised it.

- **status**: pending
- **priority**: P2
- **owner**: `mica-core` (vtv87o8e), assigned 2026-09-16
- **createdAt**: 2026-09-16 09:00

## Description

`mica-core`'s six Rust packages differ, byte for byte, between the local arm64
build on the amd64 station and the native arm64 build that was released, with
every pinned input equal.

**Emulation is not involved at all.** `mica-core` runs its rust container on
the *host* platform and cross-compiles with
`--target aarch64-unknown-linux-gnu`, while its CI arm64 job runs on an arm64
runner where the same command is a native build. Two different builds, not one
build run two ways. The evidence is in the artefact: the local binary carries
an ELF note `.note.package` naming `cross-toolchain-base`, architecture
`amd64` — the linker identifying itself — which the released binary does not
carry at all, and the Rust crate disambiguators differ because the `rustc`
host triple feeds `-C metadata`. The compilers are the same version in both,
so the difference is the toolchain path, not the toolchain release.

So the question is what a cross-compiled build carries that a native one does
not, and whether all of it is pinnable.

The measurement that established the fact (`mica-core`, 2026-09-16): on
build-env `20260916-0735` its amd64 pool reproduced release `20260915-1135`
six of six and its emulated arm64 pool differed six of six; the control, the
same station and emulation with the previous build-env lock `20260915-0138`,
produced exactly the same arm64 bytes, all six still unlike the published ones.
So the executor is the difference, not the toolchain move.

Scope: diff one binary from a released arm64 `.deb` against its cross-built
counterpart and name the cause — build id, embedded path, timestamp ordering,
code generation, or something outside those four.

The next measurement is already asked for: force `-C metadata` and re-diff one
binary. That separates stamps and linker inputs, which are pinnable in
principle, from genuinely different machine code, which would be a permanent
bound. The answer may narrow this record again.

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

Both controls are the *on-target* shape: their build container runs on the
platform it builds for, so local and CI differ only by emulation. Their
byte-identical results are what that shape predicts, and they are why the
first framing — emulation changes bytes — could not survive.

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

## The sorting question, for any repository

Is the local build the same build as the CI one?

| The build container runs | Local versus CI | What to expect |
|---|---|---|
| on the target platform | one build, emulated locally | reproduces; measured twice |
| on the host with a cross toolchain, CI native | two builds | differs; this record |
| on the host with a cross toolchain, CI the same | one build | nothing to compare |

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
- 2026-09-16: the mechanism is corrected. `mica-core` overturned its own
  finding with evidence — it does not emulate arm64, it cross-compiles — so
  every page that named emulation as the cause now names cross-compilation,
  and nothing measured anywhere says emulation changes bytes. This record is
  **the** record of the investigation: it is workspace-wide and carries the
  controls from repositories that are not the owner. `mica-core`'s task is the
  working record and cites this one rather than restating them.
