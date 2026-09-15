# Board image kinds: the board delivers the pieces, the assembly packs the image

- **date**: 2026-09-15
- **kind**: engineering decision
- **owner**: the mica-boards owner (board-level pieces, `IMAGE_KINDS`); the mica-build owner (packers, publication)
- **review sunset**: 2027-03-15
- **status**: accepted (user, 2026-09-15); superseded the same day by `docs/decisions/2026-09-15-board-image-packers.md` in its packer ownership, `IMAGE_KINDS` and reserved-kind parts; the Rockchip plan's deferral (*Plans*) stands

## Decision

A board-specific whole-disk flashing format is split between the two
repositories (user, 2026-09-15):

- **The board repository** delivers the board-level pieces in the board's
  `uboot` component: for example a Rockchip Mica OS loader and its
  `idblock.img`, or an Amlogic burn package and its packer tool, kept x86-64
  like the FIT host tools. It lists them in `boards/<board>/outputs.tsv`
  (`file uboot <path>`) and declares the board's image kinds in `board.env`
  `IMAGE_KINDS`.
- **The assembly** (`mica-build`) builds the whole-disk flashing format of
  each product by image kind and publishes it as a product release asset and
  as an OCI artifact (`docs/decisions/2026-09-15-mica-build-scoped-releases.md`).
- Image kinds: `disk`, the raw whole-disk image, is the only one implemented.
  `rockchip-update` (a Rockchip `update.img`) and `amlogic-burn` (an Amlogic
  burn image) are reserved: `mica-build` keeps the dispatch interface for
  them now and refuses them until their packers are implemented.
- A board may declare an image kind in `IMAGE_KINDS` only when `mica-build`
  implements a packer for it, and only with its board-level pieces listed in
  `outputs.tsv` (`docs/boards/contract.md` sections 2 and 3).

## Plans

- The Rockchip `update.img` plan (`docs/plan/20260912-2253-rockchip-update-image.md`,
  task `20260912-2251-rockchip-update-image`) stays deferred and is not
  resumed; its milestones map onto this split, and its bench measurement (M0)
  is still the blocker.
- No Amlogic whole-disk burn plan exists.

## Rationale

The loader and vendor tools depend on the board's SoC and BSP, which the
board repository already builds and pins, while the partition geometry, the
signed components and the product image are the assembly's. Splitting at
that line keeps vendor tooling out of the assembly and product composition
out of the board repository. Refusing reserved kinds keeps a board from
promising a format nothing can produce.

## Removal condition

Revisited when a flashing format needs pieces that neither the `uboot`
component nor the assembly can own, or when image distribution changes.
