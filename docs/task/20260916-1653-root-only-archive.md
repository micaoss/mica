# 20260916-1653-root-only-archive The root-only update archive, first exercised on real releases

- **status**: completed
- **priority**: P1
- **owner**: `mica-build` (the producing side); recorded here
- **createdAt**: 2026-09-16 17:09

## Description

`docs/decisions/2026-09-15-update-packages.md` has claimed since 2026-09-15
that a release whose kernel identity is unchanged publishes a `root` archive
beside `full`, and that the partial archive installs only where the component
it omits is already on the device. Nothing had ever exercised it: every
release until now moved both identities and shipped `full` only, or shipped
`kernel` archives.

The re-pin round of 2026-09-16 exercised it, on all six products at once, and
the result **applies to the devices that exist** rather than to a fixture.

## What was predicted, before the cut

1. The kernel identities hold on all four boards, because the `mica-boards`
   kernels came out byte-identical under the `bsp` toolchain.
2. Every product root moves, because `mica-apid` went `0.1.0-2`.
3. Therefore every product emits `full` plus `root`, and no `kernel` archive.

## What was measured, after the cut

All three, with no divergence. Releases `uefi-x64.20260916-1653`,
`uefi-arm64.20260916-1653` and `cx3576.20260916-1653`, index
`mica.20260916-1709`.

- `cx3576-dev`'s `root` archive requires kernel `620f60e6a012`, which is the
  kernel identity of the slash-form release the generation-4 devices are
  running. A real device population can take this archive: the component it
  omits is the one those devices already have.
- `requires.generationBelow` equals each product's own generation, so an
  archive applies strictly below itself. For `cx3576` that also means the
  archives refuse the generation-2 rows of the defective `cx3576.20260916-0847`
  without anyone having to remember that release is bad — the counter does it.
  That release is still published, by decision and not by oversight: this round
  re-cut every scope at the corrected generations, so a separate re-cut was
  cancelled, and `mica.20260916-0858` references `0847`, so deleting it would
  leave a published index that can never verify `--full` again
  (`docs/design/mica-index.md` section 5).

## Why this is a measurement and not a release that looked right

The three predictions were written down **before** the cut and checked
**after**. A release that happens to produce the expected artifacts proves
that it produced them; a prediction that survives the cut proves the rule the
prediction came from. The distinction is the whole value of this record.

## Dependencies

- **blocked by**: nothing
- **blocks**: nothing

## Notes

- 2026-09-16: the device side is still unexercised on hardware. What this
  record establishes is the producing side and the descriptor contents; what
  `mica-deploy` does with a `root` archive is stated in
  `docs/user/update-packages.md` from `mica-core`'s source and remains
  unverified on a device.
