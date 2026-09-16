# 20260915-2327-product-guides Complete the product documentation: overview, build, porting, flashing, updates and releasing

- **status**: in_progress
- **priority**: P1
- **owner**: olea2l5k
- **createdAt**: 2026-09-15 23:27

## Description

The user asked for the product-facing documentation to be completed: a build
guide, a new-board porting guide, a flashing guide and the guides around them,
in English, against the chain as it stands on 2026-09-15 (`mica-build-env`
`20260915-0138`, `mica-system-base` `20260915-1102`, `mica-podman`
`20260915-1057`, `mica-core` `20260915-1135`, `mica-boards`
`<board>/20260915-1926`, `mica-build` `x64` and `cx3576` `20260915-2230`,
index `mica/20260915-2242`).

Scope: `docs/user/overview.md`, `docs/user/build.md`, `docs/user/flashing.md`,
`docs/user/update-packages.md` and `docs/user/releasing.md` are new;
`docs/boards/porting.md` is rewritten to the current board contract;
`docs/user/download.md` and the stale parts of `quickstart.md` and
`install.md` are corrected. The guides cross-link `docs/design/` and
`docs/decisions/` instead of restating them, and every page carries its
truth-status lines and a coverage row.

Command sequences come from `mica-build` and `mica-boards` through the
coordinator, or are read from those repositories; anything not confirmed is
marked unverified.

Acceptance: the six guides exist and are current, the catalogue and the
coverage table list them, and `make docs-verify` passes.

## ActiveForm

Writing the product guides

## Dependencies

- **blocked by**: the authoritative command sequences of `mica-build` and `mica-boards`
- **blocks**: (none)

## Notes

- 2026-09-15: plan reported to the coordinator: new overview, build, flashing,
  update-packages and releasing guides; `boards/porting.md` rewritten;
  `download.md`, `quickstart.md` and `install.md` corrected; catalogue and
  coverage rows with each page. `docs/architecture.md` and the existing design
  pages are left to task `20260915-0316-docs-multi-repo-ownership`, which is
  in progress in this repository.
- 2026-09-15: written and pushed, each piece gated on `make docs-verify`:
  `aa9e6a8` overview and this record, `c7780c1` releasing, `35c78b0`
  update-packages, `b43ed6f` porting, `e34d561` build, `1906d17` flashing,
  `6cc6e73` download, `534f170` quickstart, `5b8f5bd` install. `3fd60fa` fixes
  a race in `tools/docs/verify-release-lock.sh` found while gating: a vector
  near the head of the list could be reported as unlisted because `grep -q`
  exits early and the writing `printf` dies of SIGPIPE under `pipefail`.
- 2026-09-15: the facts came from the coordinator's handoff files for
  `mica-build` (main `19e7c9ce`) and `mica-boards` (main `07e499a`). Only items
  marked as run are published as commands; the unverified ones are flagged in
  the text: no physical x64 write (the x64 path is qualified under QEMU only),
  no cx3576 hardware flash or Maskrom entry sequence, no s905x5m boot0 install
  path, and no vendor packers. `mica-core`'s device-side facts had not arrived,
  so the first-boot and `mica-deploy` refusal detail of `flashing.md` and
  `update-packages.md` stays at what the assembly guarantees.
- 2026-09-15: the Chinese set keeps pace only where a translation already
  existed (`download.md`, `quickstart.md`, `install.md`, retranslated with
  their English pages). The five new pages carry `not-translated` rows.
- 2026-09-15: reopened. The coordinator delivered the completing handoffs:
  `mica-boards` section 8 (cx3576 end to end at `9ce875d`, s905x5m has no write
  path, the x64 kernel's media drivers, the virt-arm64 device constraints),
  `mica-build` sections 10 and 11 (the x64 write form and Secure Boot, the QEMU
  lines, the four-step digest chain, first boot, update-server, defaults.toml
  and loader selection) and `mica-core-facts.md` (the device-side refusals,
  the install and confirmation flow, first boot and thirteen traps, marked
  SOURCE / TESTED / NOT VERIFIED). The guides are being completed from them.
- 2026-09-16: the Chinese set. `user/flashing.md` (`c77f7cc`),
  `user/update-packages.md` (`586e013`), `user/overview.md` (`7c16661`),
  `user/build.md` (`a64cc85`) and `user/releasing.md` (`4710258`) are
  translated, one commit per page, each gated on `make docs-verify`; every
  Chinese page carries its English page's truth-status lines in the same
  order, so all 21 rows of `docs/user/` in the coverage table are now
  `current`. `docs/boards/` and `docs/website/` stay `not-translated` by
  policy, so `boards/porting.md` is not translated.
- 2026-09-16: scoped release tags changed from a slash to a dot (user;
  `docs/decisions/2026-09-16-scoped-tags-use-a-dot.md`). The spec, the
  reference checker and the vectors moved first (`f742615`), then the index
  spec, the decisions and the guides (`e707e9e`), so the Chinese pages were
  translated against the new form and need no second pass.
