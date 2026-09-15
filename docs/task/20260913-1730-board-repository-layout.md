# 20260913-1730-board-repository-layout A board is a data directory: the layout of mica-boards

- **status**: completed
- **priority**: P1
- **owner**: (unassigned)
- **createdAt**: 2026-09-13 17:30

## Description

Requested 2026-09-13: the directory layout is still the old one and adding
a board is not clear. The plan `20260913-1730-board-repository-layout`
puts every board under `boards/<name>/` as data only (kernel/, loader/,
package/, manifests/, extras/, tests/), replaces the eight per-board
producer directories with one `producers/board` and one `producers/kernel`
over a `build-env` matrix producer, and keeps the pool byte-identical
through every step.

## ActiveForm

Landed: a board is a data directory, the producers are two.

## Dependencies

- **blocked by**: (none)
- **blocks**: (none)

## Notes

2026-09-13 17:30: plan written; awaits approval.

2026-09-13 17:35: landed; see the plan's annotations. The reference boards' packages and bundles are member for member what they were.
