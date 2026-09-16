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
