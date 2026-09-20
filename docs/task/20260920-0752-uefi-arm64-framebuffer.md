# 20260920-0752-uefi-arm64-framebuffer `uefi-arm64` gets a framebuffer back, and a page changes when it lands

- **status**: waiting — `mica-boards` is pricing display **and** input together;
  **do not edit `docs/design/access.md` until it reports**
- **priority**: P2
- **owner**: `mica` (the edit); the work is `mica-boards`'
- **createdAt**: 2026-09-20 07:52

## What the user decided

*"arm64也加回去framebuffer"* (2026-09-20): the `uefi-arm64` trim is reversed on
the display side.

## Why this file exists rather than an edit

`docs/design/access.md` section 2 currently says `uefi-arm64` **cannot render
a VT by construction** — no framebuffer, no DRM, no keyboard driver class —
**and declares no `display` feature**, and calls that agreement the one place
in the whole investigation where a capability and a declaration matched
without anyone checking. That sentence is now **a statement about the past**,
and it stays exactly as it is until `mica-boards` reports, because the
replacement needs the release that carries it.

`mica-boards` is pricing **display and input together**: a logo nobody can
type under is half a decision, and the **+6.8%** it measured was the display
half alone.

## The edit to make when it lands

1. The claim changes from *cannot, by construction* to **can, as of
   `<release>`**, naming the release rather than the day.
2. The clean case is **marked as having been one**, not deleted: it was a
   capability absent and a declaration absent, agreeing — and it stopped being
   an example because the capability came back, not because the reasoning was
   wrong. A record that quietly loses its own examples teaches that they were
   never there.
3. Whatever the `display` declaration does — gained or still absent — is
   stated in the same sentence as the capability, since the pair agreeing was
   the whole point of the example.

## Dependencies

- **blocked by**: `mica-boards`' display-and-input pricing and the release
  that carries it
- **blocks**: nothing
