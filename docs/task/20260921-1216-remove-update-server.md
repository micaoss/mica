# 20260921-1216-remove-update-server Remove the update server from mica-build

- **status**: completed
- **priority**: P1
- **owner**: claude/session-b7e5abcf
- **createdAt**: 2026-09-21 12:16

## Description

The user decided (2026-09-21): the fleet service implements update
distribution completely, so `mica-build` ships no update server of its own.
The assembly produces components, images and archives and nothing beyond
them; updates are not its responsibility. The device-side protocol
documentation stays.

Acceptance:

- `mica-build:update-server/` is gone, with its CI gate step and the
  lifecycle scripts that only existed to publish through it;
- every document in `mica` that named the server as the catalog producer says
  what is true now, and the protocol section (`docs/user/update-packages.md`
  section 10) is unchanged;
- `make docs-verify` in `mica` and the assembly's lints are green.

The plan is `docs/plan/20260921-1217-remove-update-server.md`.

## ActiveForm

Removing the update server from mica-build and rewriting the documents that named it.

## Dependencies

- **blocked by**: (none)
- **blocks**: (none)

## Notes

- 2026-09-21 12:16: readers measured at `mica-build` `e13b4f78`; see the plan.

- complete: Deleted in mica-build, documents rewritten; docs gates green except the other session's unindexed research page.
