# 20260917-1033-zh-hardware-list Chinese hardware list and current-state guide per board

- **status**: in_progress
- **priority**: P2
- **owner**: session-zh-hardware
- **createdAt**: 2026-09-17 10:33

## Description

Consolidate the current state of Mica OS for a Chinese reader: which boards
exist, at what tier, what each one's hardware features are and how far each is
verified, and per board how an image is obtained, flashed, updated and
recovered. Requested in Chinese, so it lives under `docs/zh/hardware/`: one
list page plus one page per board (`uefi-x64`, `uefi-arm64`, `cx3576`,
`s905x5m`). Also correct the stale board table in `README.md` and
`README.zh-CN.md` (old names `x64`/`virt-arm64`, "no public release").

Acceptance: every fact on the new pages traces to an English source page or a
`mica-boards` board file; `make docs-verify` passes; the English
`docs/boards/support-tiers.md` stays the authoritative status table.

## ActiveForm

Writing the Chinese hardware list and per-board pages

## Dependencies

- **blocked by**: (none)
- **blocks**: (none)

## Notes

Plan: `docs/plan/20260917-1033-zh-hardware-list.md`.
