# 20260914-0021-workspace-agents-file Keep agent instructions only in the workspace AGENTS.md

- **status**: completed
- **createdAt**: 2026-09-14 00:21
- **approvedAt**: 2026-09-14 00:21
- **relatedTask**: 20260914-0021-workspace-agents-file

## Context

Every repository in the workspace (`mica`, `mica-boards`, `mica-boot`,
`mica-build`, `mica-build-env`, `mica-core`, `mica-debian`, `mica-deploy`,
`mica-podman`, `mica-system`, `mica-system-base`) tracks an `AGENTS.md` and a
`CLAUDE.md` (a symlink, except in `mica-core` where it is an identical regular
file). The workspace directory above them is not a git repository and holds a
thin `AGENTS.md` that points into `mica`. The workspace constraints live in
`mica/AGENTS.md` *Constraints*.

Live references to a repository's own `AGENTS.md`: `mica:README.md` and
`mica:docs/decisions/README.md`. The other mentions are in changelogs, plans
and tasks, which are history and stay as written.

## Proposal

1. Rewrite the workspace `AGENTS.md`: the PMA injection, the constraints, and
   one section per repository carrying that repository's skill stack,
   project-specific facts and record locations, moved as written.
2. Delete `AGENTS.md` and `CLAUDE.md` from every repository (`git rm`).
3. Update the two live references in `mica`.

The user approved this directly with the request.

## Risks

- The workspace file is not versioned; a fresh clone of one repository has no
  agent instructions. Accepted by the user's request.
- Facts that were already stale are moved unchanged and reported, not fixed.

## Scope

Eleven repositories, 22 deleted files, two edited files in `mica`, one
workspace file.

## Alternatives

- Keep a one-line `AGENTS.md` in each repository pointing to the workspace:
  rejected, the user asked for none.

## Annotations

(none)
