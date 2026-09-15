# Board flashing formats: mica-boards declares and packs, mica-build executes

- **date**: 2026-09-15
- **kind**: engineering decision
- **owner**: the mica-boards owner (`images.tsv`, the `packer` component, the packers); the mica-build owner (the executor, product subsets, publication)
- **review sunset**: 2027-03-15
- **status**: accepted (user, 2026-09-15); `mica-boards` `55d0206` adds `images.tsv` (every board `disk` only) and removes `IMAGE_KINDS`; `mica-build` `0094a097` implements the image-kinds executor (builtin `disk` and the packer interface) and reads the `update` rows; the `packer` component is not implemented; supersedes `docs/decisions/2026-09-15-board-image-kinds.md` in its packer ownership, `IMAGE_KINDS` and reserved-kind parts; `mica-boards`' first four board releases are `disk` only and are not delayed; `images.tsv` also declares update kinds (`docs/decisions/2026-09-15-update-packages.md`)

## Decision

`mica-boards` declares each board's flashing formats and supplies their
packers; `mica-build` only executes them (user, 2026-09-15).

**Declaration.** `mica-boards:boards/<board>/images.tsv`, carried in the
board's `board` component: line 1 `# mica-boards images v1`, then one row per
image kind, `image <kind> <packer> <runtime image> <suffix>`:

- `<kind>`: for example `disk`, `rockchip-update`, `amlogic-burn`;
- `<packer>`: `builtin` (`mica-build`'s own raw disk image, only for `disk`)
  or a path inside the board's `packer` component;
- `<runtime image>`: an `image` row of `locks/mica-build-env.lock`, for
  example `mica-build-env:base`, or `-` for a `builtin` packer;
- `<suffix>`: the suffix of the output file.

`disk` is mandatory: it is the canonical image every other kind derives from.
`IMAGE_KINDS` in `board.env` is removed, with no compatibility.

**The `packer` component.** A new board component, the OCI artifact
`packer.<board>.<YYYYMMDD-HHMM>`, reused by its inputs hash like the others,
holds the packer tools of the non-builtin kinds and the board-level pieces
they need (a Rockchip loader and `idblock.img`, an Amlogic packer binary and
its ini, ...), listed in `outputs.tsv` as `file packer <path>`. The `uboot`
component keeps only U-Boot and the FIT host tools. A board with only `disk`
has no `packer` component.

**The packer interface**, executed by `mica-build`:

- `pack <input dir> <output file>` and `verify <input dir> <output file>`.
- The input directory is produced by `mica-build` after signing: `disk.img`
  (the signed canonical image), `<partition>.img` per partition,
  `layout.json` (layout version, sectors, GUIDs), `board/` (the `board`
  component tree) and `product.json` (product, release, profile).
- `verify` unpacks the output and proves that every byte it writes to
  storage equals `disk.img`, exiting non-zero on any difference.
- A packer runs in its declared runtime image with `--network none`, a
  read-only input and no key material mounted. Its output is deterministic:
  `mica-build` packs twice and compares at release.

**Product selection.** `mica-build:products/<product>/product.env`
`IMAGE_KINDS` lists kinds from the board's `images.tsv` (default: all of
them; `disk` is always included); selecting a kind the board does not
declare is refused.

**Failure.** A failed pack, verify or determinism check, or an asset over
2 GiB, fails that product's whole release.

**Publishing** (per product, `docs/decisions/2026-09-15-mica-build-scoped-releases.md`):
one release asset per kind, gzip-compressed as
`mica-<product>-<YYYYMMDD-HHMM>.<suffix>.gz`,
`docs/decisions/2026-09-15-release-images-and-products.md`); one
OCI manifest `image.<product>.<YYYYMMDD-HHMM>` with one layer per kind
(title the file name, annotation `mica.image-kind`); `asset` rows per kind in
`mica-build.lock` (row shape still proposed by `mica-build`).

**Update packages** (user, 2026-09-15: "可以复用images.tsv，因为我们可以独立升级内核和系统").
`images.tsv` also declares what a board can be updated with, since the kernel
and the system (root) are upgraded independently. `mica-build`'s proposal is
accepted (`docs/decisions/2026-09-15-update-packages.md`): the rows are
`update <kind> builtin - <suffix>`, with `full` (mandatory, `micaupd`), `root`
(`root.micaupd`) and `kernel` (`kernel.micaupd`); `-` is the runtime image of
every `builtin` row, `image disk builtin - img` included. `mica-build` signs
and packs the `MICAUPD1` archives itself; a product selects `IMAGE_KINDS`
and `UPDATE_KINDS` in `product.env` (default all; `disk` and `full` always).
A `root` or `kernel` archive is published only when the other part is
unchanged, `full` every release; an update kind `firmware` is refused.

## Order

`mica-boards`' first four board releases are not delayed: every board is
`disk` only, and `images.tsv` with only `image disk builtin - img` may land with
them or right after. After the releases and their clean-up, `mica-boards`
adds `images.tsv` to every board, the `packer` component, its `outputs.tsv`,
input and publishing support, removes `IMAGE_KINDS`, and adds a
board-contract-test rule (`disk` present, kinds unique, packer paths present
in the `packer` component, runtime image named by the build-env lock).
`mica-build` replaces its reserved `IMAGE_KINDS` dispatch with the generic
executor (builtin `disk`, `packer` component tools through the interface),
the product subset, the double pack and the failure rule, tested with a fake
packer.

## What this supersedes

- From `docs/decisions/2026-09-15-board-image-kinds.md`: `mica-build` owning
  the packers, `board.env` `IMAGE_KINDS`, the reserved kinds refused in
  `mica-build`, and the board-level pieces in the `uboot` component.

## Rationale

The board repository knows its SoC, its vendor tools and their pieces, so it
also owns the packers that use them; the assembly stays one generic executor
that signs, hands over a fixed input and checks the result byte for byte.
`verify` against the canonical `disk.img` keeps every format bound to the
image that was verified, and the sandbox and double pack keep packers from
adding inputs or nondeterminism.

## Removal condition

Revisited when a flashing format cannot be expressed through `pack` and
`verify` over the signed disk image, or when image distribution changes.
