# 20260913-0440-micad-product-defaults Product defaults layer, validator CLI and a bluetooth section in micad

- **status**: pending
- **priority**: P2
- **owner**: (unassigned)
- **createdAt**: 2026-09-13 04:40

## Description

The `micad` half of `20260913-0416-board-product-build-architecture` C3:

1. a defaults layer in `micad-settings` -- `/usr/lib/mica/defaults.toml`,
   read once at store load, between the code defaults and DATA/state
   (code < product < device); a missing file is the code defaults, an
   invalid file refuses the subsystems it names, exactly as a poured
   document does (`docs/design/provisioning.md` §4.0);
2. `micad-settings validate --defaults FILE`, a CLI the assembly runs in
   the `mica-build-rust-check` image at compose time: the schema's own
   validation, unknown keys refused, and a refusal of every key the
   redactor names as secret (`psk`, `password`, `passwordHash`, `pin`,
   `key`);
3. a `bluetooth` section (`enabled`, `discoverable`,
   `pairableTimeoutSeconds`) with a reconciler over bluez, and a per-device
   pairing PIN minted at first boot beside the AP PSK
   (`docs/design/provisioning.md` §3.2), never a fleet constant.

Acceptance: a unit test proves the three-layer precedence; the validator
refuses each secret key by name and an unknown key; a first-boot test shows
the PIN differs per device and never appears in a served record; the
package gate is green and the release is pinned by the assembly.

## ActiveForm

Adding the product defaults layer, the validator CLI and the bluetooth section to micad.

## Dependencies

- **blocked by**: (none)
- **blocks**: 20260913-0416-board-product-build-architecture (work package 2.2, the composition of `defaults.toml` only)

## Notes

The plan's C3 is the contract; `docs/design/access.md` §5.3 and
`provisioning.md` §4.1 are updated by the plan's work package 2.4.
