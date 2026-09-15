# 20260914-0021-workspace-agents-file Keep agent instructions only in the workspace AGENTS.md

- **status**: completed
- **priority**: P2
- **owner**: main-session
- **createdAt**: 2026-09-14 00:21

## Description

The user asked to remove `AGENTS.md` and `CLAUDE.md` from every Mica OS
repository and keep them only in the workspace directory above the
repositories. The project-specific facts of each repository move into the
workspace `AGENTS.md` so nothing is lost.

Acceptance: no repository tracks `AGENTS.md` or `CLAUDE.md`; the workspace
`AGENTS.md` (with `CLAUDE.md` symlinked) carries the workspace constraints and
every repository's skill stack and facts; live references to a repository's
own `AGENTS.md` are updated; `make docs-verify` passes.

## ActiveForm

Moving agent instructions into the workspace AGENTS.md

## Dependencies

- **blocked by**: (none)
- **blocks**: (none)

## Notes

Plan: `docs/plan/20260914-0021-workspace-agents-file.md`.

- complete: Workspace AGENTS.md carries every repository section; 22 files removed; make docs-verify passes
