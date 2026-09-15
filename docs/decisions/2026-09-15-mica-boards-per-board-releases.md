# mica-boards releases per board

- **date**: 2026-09-15
- **kind**: engineering decision
- **owner**: the mica-boards owner; the consumer side, the mica-build owner
- **review sunset**: 2027-03-15
- **status**: accepted (user, 2026-09-15); implemented at `mica-boards` `0f8e313` with the per-board releases `x64/20260915-0824`, `virt-arm64/20260915-0824`, `cx3576/20260915-0824` and `s905x5m/20260915-0824`; specified in `docs/design/release-lock.md` 1.0 and section 4; the board list format is `mica-boards`' own (`mica-boards` `ce44907`, `docs/boards/contract.md` section 3)

## Decision

`mica-boards` stays its own repository; it is not merged into `mica-build`
(user, 2026-09-15). It releases per board:

- The git tag and GitHub Release are `<board>/<YYYYMMDD-HHMM>`, and a release
  builds and publishes only that board.
- A board is published as separate component artifacts (2026-09-15, agreed
  by `mica-boards` and `mica-build`): `kernel`, `uboot` (FIT boards),
  `firmware`, `packer` (boards with a non-builtin image kind) and `board`, tagged `<component>.<board>.<YYYYMMDD-HHMM>` with
  `artifactType` `application/vnd.mica.board[.kernel|.uboot|.firmware]` and
  the annotations `mica.component` and `mica.inputs=<sha256>`; the pool is
  `pool.<board>.<arch>.<YYYYMMDD-HHMM>`, all in `ghcr.io/micaoss/mica-boards`.
  A release reuses an unchanged component by digest: the same manifest bytes
  under the new tag, never a re-pointed tag.
- Board-specific flashing formats: `boards/<board>/images.tsv` in the `board`
  component declares them, and the `packer` component carries the packers
  and their board-level pieces, listed in `outputs.tsv`; `mica-build` executes
  them (`docs/decisions/2026-09-15-board-image-packers.md`).
- The `mica-kernel-<board>` packages are retired: the pools hold
  `mica-board-<board>`, the radio packages and s905x5m's component packages,
  and the assembly takes the kernel files from the `kernel` artifact.
- A release carries exactly `mica-boards.lock` and `SHA256SUMS`; the lock's
  release row is `release mica-boards <board>/<YYYYMMDD-HHMM> <commit>`. Each
  component is a row `board <board> <component> <arch> <reference>` (key
  board and component), two to five per lock (`board` and `kernel` required,
  `uboot`, `firmware` and `packer` optional; refused otherwise as `board-components`), and the lock holds only that
  board: every `board` row names it with a tag `<component>.<board>.<...>` and
  every pool tag is `pool.<board>.<arch>.<...>` (refused otherwise as
  `scope-content`).
- A consumer keeps each board as its own input,
  `locks/mica-boards.<board>.lock` with `locks/pins/mica-boards.<board>.pin`
  (`mica-pin v1` with `SCOPE=<board>`), so moving one board replaces exactly
  its two files.
- `mica-boards` keeps a machine-readable board list in `boards/` naming every
  supported board and its expected outputs; its format is `mica-boards`' to
  define, and it defined it in `ce44907`: `mica-boards:boards/boards.tsv`
  (`# mica-boards boards v1`, rows `<board> <arch> <boot backend>`) and
  `mica-boards:boards/<board>/outputs.tsv` (`# mica-boards board outputs v1`);
  with the component artifacts its rows become `package <name>` and
  `file <component> <path>` (assembled paths, such as `firmware/<file>`), and
  it travels in the `board` component. A consumer reads the board list from
  `boards/boards.tsv` and a board's expected outputs from its `board`
  component (`docs/boards/contract.md` section 3).

Scoped releases are allowed for `mica-boards` and `mica-build` only
(`docs/decisions/2026-09-15-mica-build-scoped-releases.md`); the release-lock
checker refuses a scoped release of any other repository.

## What this supersedes

- `mica-boards` releases covering every board at once
  (`20260914-1603` was one) and its `pool.<arch>.<YYYYMMDD-HHMM>` tags.
- The single board bundle `board.<board>.<YYYYMMDD-HHMM>`, the four-column
  `board` row and the `mica-kernel-<board>` packages.

## Rationale

Boards are built and brought up independently, and a board's kernel and
U-Boot builds are the slowest in the system. Releasing per board lets one
board move without rebuilding or republishing the others, and a consumer
that follows one board is not moved by another. Keeping the repository
separate keeps board bring-up out of the assembly.

## Removal condition

Revisited if boards stop being released independently, or if `mica-boards`
is ever merged into another repository.
