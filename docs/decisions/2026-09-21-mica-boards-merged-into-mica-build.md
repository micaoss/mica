# mica-boards is merged into mica-build: a board owns its build and its image

- **date**: 2026-09-21
- **kind**: engineering decision
- **owner**: the mica-build owner
- **review sunset**: 2027-03-21
- **status**: accepted (user, 2026-09-21: "开始处理合并工作", after the plan `docs/plan/20260921-1142-merge-boards-into-build.md` and its four answers); P1 (the move and one release model) implemented in `mica-build`; P3 (the board-owned image, `layout.tsv`) follows in the same plan; P4 (the device-side geometry) is a `mica-core` task of its own

## Decision

`mica-boards` is merged into `mica-build`, with its history, and retired. One
repository holds the boards and the assembly:

- **The board directory is the unit.** `boards/<board>/` carries the board's
  whole build as before (`boards/README.md`), beside `common/` and
  `producers/`; the assembly's engine, products and release tooling are
  unchanged in place. Every board's kernel and U-Boot are built here, natively
  per architecture in CI, and its packages are built into the one pool per
  architecture the composer installs from (`make board-pool`; `tools/pool.sh
  rows` lists them beside the imported package rows of `locks/`).
- **The board is no input.** `locks/mica-boards.<board>.lock` and its pin are
  gone; a board exists exactly when `boards/boards.tsv` lists it, and every
  reader of a board reads `boards/<board>/`. A product takes the board's
  kernel and U-Boot from a local build under `_out/<board>/` or, when there
  is none, from the latest release of this repository that published them
  with the same inputs hash (`tools/inputs.sh`, `tools/reuse.sh`,
  `tools/board-pool.sh --fetch`). Neither present is a refusal naming `make
  <board>-kernel`, never a silent build.
- **One release model.** A scoped release `<scope>.<YYYYMMDD-HHMM>` of a
  board or a product builds the scope's board (reusing unchanged components
  by digest), publishes its pool as `mica-build:pool.<board>.<arch>.<stamp>`
  and its built components as `mica-build:<component>.<board>.<stamp>`
  (`kernel`, and `uboot` and `firmware` where the board has them), then its
  products, and `mica-build.lock` carries the board's `pool`, `package` and
  `board` rows beside the `input`, `product`, `bundle` and `asset` rows
  (`docs/design/release-lock.md` 1.2.2). `mica-build` is the only repository
  with scoped releases.
- **Two components stop being published.** The `board` component (the board
  definition, manifests, flashing formats, outputs and trust certificate) and
  the `packer` component are source files of the commit a release is cut
  from, so they travel nowhere; the packers of `images.tsv` run from the
  checkout (user, 2026-09-21).
- **The trust material is one set.** The kernels embed the certificate of the
  repository variable `MICA_VERITY_TRUST_CERT`, which `trust-certificates.sha256`
  records, in the same repository that signs with its private half.
- **The records of `mica-boards` move to `mica`**, like `mica-build`'s, under
  their own identifiers.

## What this supersedes

- `2026-09-15-mica-boards-per-board-releases` (a record deleted 2026-09-26) in its
  premise, "`mica-boards` stays its own repository; it is not merged into
  `mica-build`", whose removal condition was this merge; its per-board scoped
  tags and component artifacts stand, published by `mica-build` now.
- `docs/decisions/2026-09-15-board-image-packers.md` in its `packer`
  component: a packer no longer needs an artifact to cross a repository.
- `docs/boards/contract.md` section 1's separation rule, which assumed two
  repositories: the boundary stays -- a board directory produces artifacts
  the engine consumes, and neither side reaches into the other's build -- and
  it is a directory boundary inside one repository, held by the board
  contract test and the board-name lint.

## Rationale

The user's request (2026-09-21): every layout change went through two
repositories and two releases, the assembly compiled in the only two
partition layouts it accepted while the board declared forty layout keys it
did not read, and the trust certificate lived in two places. With the boards
in the assembly a board can own its image -- its partition table, what each
partition holds and the delivered file formats -- as data in its directory
(P3 of the plan), and adding a board that reuses an existing boot backend and
partition roles is a directory, not a code change. Kernel builds join the
assembly's CI without lengthening it: a component whose inputs hash equals
the latest release's is reused by digest, so a push that touches the engine
builds no kernel.

## Removal condition

Revisited only if boards are ever released independently of the assembly
again.
