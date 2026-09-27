# 20260927-1552-dotted-products-and-no-index-lock A product scope may carry one dot, and the release lock has no index lock

- **status**: completed
- **priority**: P1
- **owner**: claude/mica-docs
- **createdAt**: 2026-09-27 15:52

## Description

The user asked `mica-build-tools` to accept product names and scopes of the form
`^[a-z0-9][a-z0-9-]*(\.[a-z0-9][a-z0-9-]*)?$` and to drop the retired index rules
(`INDEX_SCOPE`, the `index`, `origin` and `built` rows). The rules are this repository's, so
they change here first (`mica-build-tools:docs/design.md` section 7): a product is
`<board>.<variant>` or the board's own name, and `mica-build` cuts no index since plan
`20260927-1422-independent-board-releases-and-scoped-ci`.

## ActiveForm

Changing the scope form and removing the index lock from the release lock

## Dependencies

- **blocked by**: (none)
- **blocks**: the `mica-build-tools` release that implements it

## Notes

- 2026-09-27: `docs/design/release-lock.md` 1.0 (scope form, parsed at the last dot), 1.2
  (the `origin`, `built` and `index` rows removed), 1.2.2 (a product has the scope form, its
  board the board form), 1.2.3 removed, 1.4, 1.5 (twelve kinds; the five `index-*` rules
  removed), 9 and a note in 9.3; `tools/docs/release-lock-check.py` the same; vectors:
  `mica-build.mica.lock` and the seven `index-*` refusals removed,
  `lock/valid/mica-build.uefi-x64.basic.lock` and `lock/refused/scope-two-dots.lock`
  added. `docs/boards/contract.md` 1.1 and the naming decision take the product form;
  `docs/design/mica-index.md` and the version-index decision are marked retired and ended.
  The user and website pages that describe the index are not changed here.
