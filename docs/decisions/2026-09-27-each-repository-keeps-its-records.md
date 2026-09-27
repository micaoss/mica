# Each repository keeps its own development records; mica holds the conventions and the public documentation

- **date**: 2026-09-27
- **kind**: working practice
- **owner**: every repository; `mica` records it
- **review sunset**: 2027-03-27
- **status**: accepted (user, 2026-09-27: "不需要每个项目开发文档都在mica 每个项目保留自己的 mica是全局约定和公开文档")

## Decision

- **A repository's development documentation lives in that repository**: its task, plan and
  changelog records, its module design and its decisions local to it, under its own `docs/`.
  A code change lands together with its record in the same repository.
- **`mica` holds two things**: the conventions every repository follows (the contracts, such as
  the board contract, the release lock and release signing, and the decisions that bind more
  than one repository), and the public documentation (the product, architecture, user,
  integrator and hardware documentation, and the website briefs).
- **`mica`'s own `docs/task/` and `docs/plan/` track work on those two things** and work that
  spans repositories. Work inside one repository is tracked there, and a cross-repository plan
  in `mica` links to each repository's own records rather than restating them.

## What this supersedes

- The rule that a code change in any repository lands together with its record in `mica`.
- The exception that kept `mica-build`'s records, and since the merge `mica-boards`' records, in
  `mica` (`docs/decisions/2026-09-21-mica-boards-merged-into-mica-build.md`). `mica-build` and
  `mica-build-env` start their own `docs/` with their next record.

## What does not move

The records already in `mica` stay where they are, under their identifiers: they are history,
and moving them would break every reference to them. Open ones are finished where they are.

## Removal condition

Revisit if a repository's records cannot be followed without the coordination they used to get
from being in one place.
