# 20260913-1735-lifecycle-uefi-micad-config-mount micad refuses to start on the lifecycle suite's acceptance disk: /mica is not mounted

- **status**: pending
- **priority**: P2
- **owner**: (unassigned)
- **createdAt**: 2026-09-13 17:35

## Description

Found running `make lifecycle-uefi PRODUCT=x64-dev` (phase 7 of
`20260913-0416-board-product-build-architecture`): the acceptance disk
`tests/lifecycle-uefi/build.ts` assembles boots, apid starts, but micad
exits with "load settings from /var/lib/mica/settings.toml and
/mica/config: /mica/config is not there ... `/mica` is not mounted. Refusing
to start on schema defaults", `mica-health` fails on it and the runtime
stage never prints `FILE_AB_RUNTIME_PASS`. The suite's own guest check
(`runtime.sh`) expects `/mica` among the mounts, so the acceptance disk
used to provide it; micad's refusal to start without `/mica/config` is
newer than the suite's last recorded green run (2026-09-06). Either the
acceptance disk's DATA layout no longer creates `/mica/config`, or the
product's `mica-data-layout` unit is not on the acceptance disk's path.

Reproduce: `make product PRODUCT=x64-dev`, `make lifecycle-uefi
PRODUCT=x64-dev`; the journal is in the evidence directory's
`runtime.log` (the guest check prints micad's and apid's journal on
failure since `mica-build` `9d830caa`+1).

## ActiveForm

Investigating why /mica is not mounted on the acceptance disk.

## Dependencies

- **blocked by**: (none)
- **blocks**: the lifecycle suite's runtime, update and fault stages

## Notes

2026-09-13 17:35: recorded; the suite's assembly stage and the unit tests
are green, the boot-driven stages are blocked on this.
