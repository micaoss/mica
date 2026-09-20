# 20260917-1033-zh-hardware-list Chinese hardware list and current-state guide per board

- **status**: draft
- **createdAt**: 2026-09-17 10:33
- **approvedAt**: (pending)
- **relatedTask**: 20260917-1033-zh-hardware-list

## Context

- Board status has one owner, `docs/boards/support-tiers.md` (English). Board
  dossiers exist for `cx3576`, `s905x5m` and `uefi-arm64`; `uefi-x64` has none.
- Flashing, update and recovery are covered by `docs/zh/user/flashing.md`,
  `update-packages.md`, `update-rollback.md` and `recovery.md`, organised by
  topic rather than by board: a reader with one board reads four long pages.
- No page lists hardware features (Wi-Fi, Bluetooth, CAN, HDMI, RTC, ...) per
  board with their verification state, in Chinese or English.
- Stale: the board tables in `README.md` and `README.zh-CN.md` still say `x64`,
  `virt-arm64` and "no public release"; `docs/zh/user/download.md` section 1
  says "today uefi-x64 and cx3576" before adding uefi-arm64.
- Live state (2026-09-17): `mica-build` latest index `mica.20260916-1709`,
  scoped releases `uefi-x64`, `uefi-arm64` and `cx3576` `.20260916-1653`;
  `mica-boards` has `cx3576.20260917-1007` (the boot logo), not yet consumed by
  a `mica-build` release. No physical board has a dated qualification row; all
  runtime evidence is QEMU.
- Gates: `docs/zh/hardware/` is outside `verify-coverage.sh` and
  `verify-status.sh`; `verify-links.sh` checks its links.

## Proposal

1. `docs/zh/hardware/README.md`: the current state in one screen (what is
   published, what is verified and what is not), the board list table, what
   the tiers mean, how to choose, links to the per-board pages.
2. `docs/zh/hardware/<board>.md` for the four boards, one section order:
   overview; hardware and feature state (feature | state | note); layout and
   boot chain; console; obtaining an image; flashing; first boot; updates;
   recovery; known limitations; verification record. Each page names its
   English sources and the date of its snapshot.
3. `docs/zh/README.md` links the hardware list; `docs/README.md` mentions
   `zh/hardware/` in its ownership row and catalog.
4. `README.md` and `README.zh-CN.md`: correct the board table and link the
   hardware list.
5. A changelog entry; `make docs-verify`.

## Risks

- Restating board status duplicates `support-tiers.md`, which asks other
  documents to link rather than restate. Mitigation: each page dates its
  snapshot and names the English table as authoritative.
- `uefi-x64` has no dossier; its facts come from `board.env`, `flashing.md`
  and `support-tiers.md`, and the page says so.

## Scope

Documentation only: 5 new files, 5-6 edited files. No code.

## Alternatives

- English `docs/boards/` pages plus a translation: the request is for a
  Chinese list, and `boards/` is English-only by policy.
- One single Chinese page: shorter, but the per-board feature detail asked for
  would make it long and harder to keep current.

## Annotations

(none)
