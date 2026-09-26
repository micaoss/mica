# 20260926-1829-rules-name-mica-build-tools The release-lock text names mica-build-tools as its one implementation

- **status**: in_progress
- **priority**: P1
- **owner**: claude/mica-docs
- **createdAt**: 2026-09-26 18:29

## Description

Step 6 of `mica-build-tools:docs/plan/20260926-1609-first-implementation.md`, the part in
this repository: `docs/design/release-lock.md` stops describing per-repository copies of its
implementation (`tools/repos.sh`, `tools/local-lock.sh`, a vectors copy and a `vectors.pin` in
every reader) and names `mica-build-tools` (design section 8 there). Its first release is
`20260926-1825`, commit `5619810`, the commit consumers pin. The user asked for it on
2026-09-26 ("你看看build-tools来修改规则").

`mica-build-env:RULES.md` and `README.md` are the other half of step 6 and change in that
repository.

## ActiveForm

Rewriting the release-lock sections that describe per-repository copies

## Dependencies

- **blocked by**: (none)
- **blocks**: the switch of each repository (step 7 of the mica-build-tools plan)

## Notes

- 2026-09-26: `docs/design/release-lock.md` changed: the introduction, 1.2.5's last
  paragraph, 4.1, 5, 7, 8, 9, 9.1 (rewritten), 9.2 and 9.3; the decision record's status. The
  user guides (`docs/user/build.md` section 5 and its Chinese page, `tools/repos.sh`) describe
  what the repositories run today and change with each repository's switch, not here.
