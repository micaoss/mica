# 20260926-1125-apt-row-per-source One `apt` row per Debian source

- **status**: in_progress
- **priority**: P1
- **owner**: claude/apt-row-per-source
- **createdAt**: 2026-09-26 11:25

## Description

Let a release lock carry one `apt` row per Debian source, so Base can resolve from
`trixie-security` and `trixie-updates` beside `trixie` (plan
docs/plan/20260926-1125-apt-row-per-source.md). The user asked for it on 2026-09-26,
alongside the snapshot move of mica-system-base.

## ActiveForm

Changing the release-lock apt row to one per source

## Dependencies

- **blocked by**: (none)
- **blocks**: mica-system-base publishing its security source

## Notes

(none)

2026-09-26: the specification, vectors and checker are done (plan Progress). The readers
follow in their repositories; Base publishes three rows last.
