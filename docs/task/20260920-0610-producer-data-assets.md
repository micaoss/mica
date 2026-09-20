# 20260920-0610-producer-data-assets Where a producer publishes data about its own output

- **status**: proposed — the user decides
- **priority**: P1
- **owner**: `mica` (the specification); raised by `mica-system-base`, routed by the coordinator
- **createdAt**: 2026-09-20 06:10

## Description

`mica-system-base` produces a list a consumer needs and has nowhere to put it.
Its composer proves a declaration by **package ownership**, so a path no
package owns is dropped unless a rule names it — and a path a package *does*
own is dropped too, unless a rule names it. That is how `/etc/pam.d/login` and
the four generated `common-*` files left every published image of every board,
which is why no published Mica OS image has a console login. The measurement
from a real compose: **2980 paths carried, 703 left behind — 626 owned by a
package and claimed by nothing, 77 shipped by no package at all.**

The 77 are the ones no consumer can reason about unaided, so `mica-system-base`
built `_out/rootfs/<arch>.unowned.tsv`: 93 rows per architecture, sorted,
tab-separated, one row per unowned path **with its writer named** —
`pam-auth-update`, `update-alternatives`, `ldconfig`, `deb-systemd-helper`,
`update-rc.d`, `systemd-hwdb`, `systemd-machine-id-setup`, the maintainer
script that names the path, or its own build code with the function named. The
attribution is mechanical, so a Debian change surfaces as a new `unknown`
rather than as silence (`d2119cb0`).

It then stopped instead of publishing it, because
`docs/design/release-lock.md` 1 says a release carries exactly
`<repository>.lock` and a `SHA256SUMS` listing that one file, and the `asset`
row of 1.2.2 is `mica-build` only (`build-only-kind`). Its publisher refuses a
second asset by design — that refusal is what keeps the old three-asset shape
from coming back — so the correct reading of the spec is what blocked it.

The question this task answers: **where does a producer publish data about its
own output that a consumer must be able to read reproducibly from a pinned
release?** A CI artifact is not content-addressed, expires and cannot be
pinned, so it cannot serve a consumer that must read the data at the release
it already pins.

The proposal is `docs/plan/20260920-0610-producer-data-assets.md`. Nothing is wired into any
release until the user decides: this touches a constraint written into the
workspace instructions themselves.

## ActiveForm

Proposing where producer data lives in a release

## Dependencies

- **blocked by**: the user decision on the proposal
- **blocks**: `mica-system-base` publishing its unowned list; any consumer
  that would declare from it

## Notes

- 2026-09-20: the 2026-09-14 format freeze was checked rather than recalled.
  Its terms, as the coordination record holds them, are "no new release asset,
  lock or OCI formats until the common `locks/` and offline-build proposal is
  decided", with each repository frozen "until the coordinator dispatches its
  step". Both conditions are met: the proposal was **decided** by the user on
  2026-09-14
  (`docs/decisions/2026-09-14-release-lock-and-offline-build.md`, status
  *accepted*), and all four migration stages are recorded done in
  `docs/plan/20260914-2042-release-lock-offline-build.md`, with `locks/` and
  `make offline` in every repository. **The freeze is spent.** One thing worth
  saying with it: the freeze is not written in any record of this repository —
  it lives in coordination memory — so nobody could have checked it from the
  tree. A constraint only its holder can verify is a constraint that decays
  silently; this note is where it now exists in the records.
- 2026-09-20: the statuses of `20260914-2042-release-lock-offline-build` are
  stale — task *in_progress*, plan *implementing*, while every stage in the
  plan's own table reads done. Two of its three acceptance clauses are
  verifiable today (every producer releases in the format; every consumer
  names its inputs only in `locks/`); the third, an offline chain reproducing
  the online bytes, is not something this repository can assert. Left open
  rather than closed on two of three.
