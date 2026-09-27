# 20260926-1829-rules-name-mica-build-tools The release-lock text names mica-build-tools as its one implementation

- **status**: completed
- **priority**: P1
- **owner**: claude/mica-docs
- **createdAt**: 2026-09-26 18:29

## Description

Step 6 of `mica-build-tools:docs/plan/20260926-1609-first-implementation.md`, the part in
this repository: `docs/design/release-lock.md` stops describing per-repository copies of its
implementation (`tools/repos.sh`, `tools/local-lock.sh`, a vectors copy and a `vectors.pin` in
every reader) and names `mica-build-tools` (design section 8 there). Its first release is
`20260926-2005`, commit `8bb0331` (its history was rewritten after this task was opened; `20260926-1825` and `5619810` no longer exist). The user asked for it on
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
- 2026-09-26: the user moved the pin into `locks/` ("放在locks里面的pin"), after weighing a
  release lock for `mica-build-tools` and keeping a pin: `locks/mica-build-tools.pin`, lock
  4.2. `mica-build-tools` follows in its design 2.1 and 2.2, its bootstrap and its tests.
- 2026-09-26 23:10: brought up to `mica-build-tools` `20260926-2232` (`5467dbc`): lock 4.2 says
  `locks check` checks the pin and a pin at the repository root is refused; lock 5 says a
  download may come from the `MICA_MIRROR` mirror, verified the same; the user guides name
  `bin/mica-tools repos`, since no repository keeps `tools/repos.sh` any more; the decision
  record's status names the first release and each repository's switch.
  `mica-build-env:RULES.md` and `README.md` were changed in that repository's switch.
