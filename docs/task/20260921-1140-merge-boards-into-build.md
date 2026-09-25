# 20260921-1140-merge-boards-into-build Merge mica-boards into mica-build so a board owns its image

- **status**: in_progress
- **priority**: P1
- **owner**: claude/session-b7e5abcf
- **createdAt**: 2026-09-21 11:40

## Description

The user asked (2026-09-21) for a plan to merge `mica-build` and `mica-boards`
into one repository so that a board can define more of its own image: the
partition layout, what each partition holds, the boot medium and the delivered
file formats. Today the split forces every layout change through two
repositories and two releases, and the assembly refuses any layout other than
the two it compiles in. No backward compatibility is owed during development.

Acceptance:

- one repository, `mica-build`, holds the board trees with their history, the
  engine, the products and the release tooling; `mica-boards` is retired;
- a board declares its partition table as data in its own directory, the
  engine builds the image from that declaration, and the four boards' images
  come out byte-identical to the images built before the change from the same
  pins;
- a board-scoped release builds the board's components, pool and products in
  one run; components unchanged by their inputs are reused by digest as today;
- `make check` of the merged repository runs the union of both gate sets, and
  the docs, decisions and specs that named two repositories are rewritten.

The plan is `docs/plan/20260921-1142-merge-boards-into-build.md`.

## ActiveForm

Implementing P3 of the merge: the board-owned disk is in (layout.tsv, P3a and P3b); the backend axis is next.

## Dependencies

- **blocked by**: (none)
- **blocks**: (none)

## Notes

- 2026-09-21 11:40: investigation done at `mica-build` `e13b4f78`, `mica-boards`
  `e1e8231`, `mica-core` `b70b1fe`; findings in the plan's context section.
- 2026-09-22 07:30: P1 and P2 landed on `mica-build` `main` (`0e34a1b4`, 98 commits
  replayed onto `de476350`); proof and gates in the plan's *Progress*. P3 and
  P4 open; the task stays in progress for P3.
- 2026-09-25: P3a and P3b landed (`mica-build` `2ff265c3`, `34bc3932`): every board declares its disk
  in `layout.tsv` and the engine builds and verifies it by role; the geometry left `board.env`. Proof
  and what remains of P3 (the backend axis, the fact lint) in the plan's *Progress*.
