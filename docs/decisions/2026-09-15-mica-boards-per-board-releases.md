# mica-boards releases per board

- **date**: 2026-09-15
- **kind**: engineering decision
- **owner**: the mica-boards owner; the consumer side, the mica-build owner
- **review sunset**: 2027-03-15
- **status**: accepted (user, 2026-09-15); not implemented; specified in `docs/design/release-lock.md` 1.0 and section 4; the board list format is `mica-boards`' own, cited here once it lands

## Decision

`mica-boards` stays its own repository; it is not merged into `mica-build`
(user, 2026-09-15). It releases per board:

- The git tag and GitHub Release are `<board>/<YYYYMMDD-HHMM>`, and a release
  builds and publishes only that board.
- OCI tags name the board: `board.<board>.<YYYYMMDD-HHMM>` and
  `pool.<board>.<arch>.<YYYYMMDD-HHMM>` in `ghcr.io/micaoss/mica-boards`.
- A release carries exactly `mica-boards.lock` and `SHA256SUMS`; the lock's
  release row is `release mica-boards <board>/<YYYYMMDD-HHMM> <commit>`.
- A consumer keeps each board as its own input,
  `locks/mica-boards.<board>.lock` with `locks/pins/mica-boards.<board>.pin`
  (`mica-pin v1` with `SCOPE=<board>`), so moving one board replaces exactly
  its two files.
- `mica-boards` keeps a machine-readable board list in `boards/` naming every
  supported board and its expected outputs; its format is `mica-boards`'
  to define.

Scoped releases are allowed for `mica-boards` and `mica-build` only
(`docs/decisions/2026-09-15-mica-build-scoped-releases.md`); the release-lock
checker refuses a scoped release of any other repository.

## What this supersedes

- `mica-boards` releases covering every board at once
  (`20260914-1603` was one) and its `pool.<arch>.<YYYYMMDD-HHMM>` tags.

## Rationale

Boards are built and brought up independently, and a board's kernel and
U-Boot builds are the slowest in the system. Releasing per board lets one
board move without rebuilding or republishing the others, and a consumer
that follows one board is not moved by another. Keeping the repository
separate keeps board bring-up out of the assembly.

## Removal condition

Revisited if boards stop being released independently, or if `mica-boards`
is ever merged into another repository.
