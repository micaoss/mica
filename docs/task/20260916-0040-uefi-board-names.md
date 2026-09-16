# 20260916-0040-uefi-board-names Rename the generic systems to uefi-x64 and uefi-arm64

- **status**: in_progress
- **priority**: P1
- **owner**: olea2l5k (records); `mica-boards` and `mica-build` implement
- **createdAt**: 2026-09-16 00:40

## Description

The user decided on 2026-09-16 that the two generic systems are named by their
firmware class rather than their architecture: `virt-arm64` becomes
`uefi-arm64` and `x64` becomes `uefi-x64`. The hardware boards keep their
names, `cx3576` and `s905x5m`. The rename is folded into the dot tag cut-over
(`docs/decisions/2026-09-16-scoped-tags-use-a-dot.md`) so it costs one build
cycle instead of a throwaway release set.

`uefi-arm64` also becomes the generic UEFI/ACPI arm64 system and a release
target, with a driver set beyond virtio (NVMe, USB storage, AHCI, common NICs,
xHCI, PCIe, RTC); `uefi-x64` keeps its current generic amd64 configuration.
That part is `mica-boards`' proposal and is not implemented yet.

Scope here: the taxonomy and the new names in `docs/`, the decision record,
the board dossier rename, the Chinese pages that carry the names, and the
release-lock vectors whose example scope is a board name. Tags, products and
image files published before today keep their old names as history.

## ActiveForm

Renaming the generic systems in the records

## Dependencies

- **blocked by**: none for the records; the qualification rows of `uefi-arm64` wait for `mica-boards`
- **blocks**: nothing in this repository

## Notes

- 2026-09-16: `mica-boards` renames the board directories and packages and cuts
  `uefi-x64.<stamp>`, `uefi-arm64.<stamp>`, `cx3576.<stamp>` and
  `s905x5m.<stamp>`; `mica-build` renames the products, re-pins to
  `locks/mica-boards.uefi-x64.lock` and `locks/mica-boards.uefi-arm64.lock`
  and cuts its scoped releases. The renamed products are new products and
  start at generation 2; `cx3576` keeps its floors.
- 2026-09-16: the records are done, each gated on `make docs-verify` and
  pushed: `7ed4103` the decision, the task record and the changelog;
  `f7714c5` the boards and user pages with their Chinese translations and the
  dossier move to `boards/uefi-arm64.md`; `91fce7c` the design pages, the
  website briefs and the release-lock vectors (scope, board rows, pool tags,
  product rows, asset file names and ten renamed vector files, 156/156);
  `c2cc95e` the earlier decisions. Published tags, products and image files
  keep their old names and are labelled as history wherever they appear.
- 2026-09-16: two more user decisions landed in this round. The minimal
  products are removed outright
  (`docs/decisions/2026-09-16-minimal-products-removed.md`, `966303e`), which
  supersedes the 2026-09-15 "kept but never published" position; and the
  naming rules are written down
  (`docs/decisions/2026-09-16-board-and-product-naming.md`) with the normative
  text in `docs/boards/contract.md` 1.1, cross-linked from the release-lock
  spec, `user/overview.md` and `user/releasing.md` and their Chinese versions.
  Open with `mica-build`: whether `PUBLISH=0` still has a user once the
  minimal products are gone.
- 2026-09-16: process item closed. Records changes now run as one gated
  sequence, `tools/docs/record.sh` (`2af92fb`, fixture fix `f2154c5`): under
  `set -euo pipefail` it applies the edit, refuses a named path that did not
  change, runs `make docs-verify`, stages only the named paths, refuses an
  attributed message, commits and pushes, rebasing once when another session
  pushed first. `tools/docs/record-test.sh` proves each refusal in a
  throw-away clone and runs in `make docs-verify-test` (6/6). There is no
  hand-assembled chain left to forget.
- 2026-09-16: `PUBLISH` settled (`1300e41`). It goes with the minimal
  products; the index catalogue's `publish` field is redefined as "the
  product's board is a release target", which reproduces today's output. No
  page documents `PUBLISH` as a product key any more. Nothing is open on this
  repository's side; the remaining wait is the `uefi-arm64` symbol list, which
  arrives with `mica-boards`' release.
- 2026-09-16: `mica-boards` cut the renamed boards, `uefi-x64.20260916-0744`
  and `uefi-arm64.20260916-0744` from `65c25c8`, with `cx3576.20260916-0558`
  and `s905x5m.20260916-0558`. `uefi-arm64` is a release target carrying the
  generic driver set; the records state it as fact and keep the qualification
  where it is, QEMU `virt` only. Left in this round: `mica-build`'s renamed
  products and their first scoped releases, which are its own to cut.
- 2026-09-16: paused after `mica-build`'s current round (user). This record
  stays open for that round's result — the renamed products and their first
  scoped releases — and for nothing else; the `bsp` switch and the pinned
  build closure are held and are not part of it.
- 2026-09-16: the pause is lifted and `mica-build` cuts the round's releases
  first. Two places in this repository go stale the moment they exist and are
  corrected in one commit then: the state paragraph of `user/overview.md` with
  its Chinese twin, which still names the 2026-09-15 product releases, and the
  three pages saying `uefi-arm64` images appear from the next `mica-build`
  round (`user/download.md`, `user/overview.md` and their Chinese versions).
