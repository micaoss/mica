# Page brief: Supported hardware

- **Purpose**: tell a visitor whether their board runs Mica OS, at what support
  level, and on what evidence — and route integrators with a new board to the
  porting contract.
- **Audience**: integrators selecting or qualifying a board; support engineers
  checking what a claimed board is actually entitled to.
- **Navigation position**: page 4, after [downloads](downloads.md). Links to
  [`mica-build:boards/README.md`](https://github.com/micaoss/mica-build/blob/main/boards/README.md) as the integrator entry point and to
  [support](support.md) for lifecycle ownership.

## Content outline

1. The support taxonomy: three levels, defined by evidence and ownership.
2. The board table: one row per board, each naming its board page.
3. "Bringing your own board": the porting route.

## Draft copy

### How support levels work

Mica OS does not call any image that boots "supported". A board's level is defined
by who qualified it and what evidence exists, using the taxonomy the BSP
documentation defines in
[the support tiers](../hardware/README.md#support-tiers):

- **mica-qualified** — qualified by the Mica OS project against the field
  reliability matrix (dated boot, A/B update, power-cut, storage, recovery
  results), with Mica OS as the named lifecycle owner. Every row of the matrix is
  pass, fail, N/A or not tested — never implicitly green.
- **integrator-qualified / bring-up** — ported by an integrator through the
  published board contract; the integrator owns qualification evidence and
  lifecycle. Mica OS supplies the contract and guidance, not the guarantee.
- **unsupported** — no board page exists. Mica OS makes no claim that the
  board works, and the site says so.

> status: shipped — evidence: `docs/hardware/README.md`

The taxonomy is published vocabulary, not a claim about any board: a level is
earned by a completed qualification matrix in the board's page, and no
board on this page may be labelled mica-qualified until one exists.

### Boards

Each row names the board, its architecture, its support level and its board
page. The board page, not the site, is where the claim lives: the site renders
the [board status table](../hardware/README.md#current-boards) and links each
row to that board's page. No board is presented as mica-qualified, because no
board page carries a dated physical qualification row.

> status: board-dependent — evidence: `docs/hardware/README.md`

### Bringing your own board

The default Mica OS customer selects and integrates the board; Mica OS supplies the
contract. A new board declares its partition geometry and layout constants in
one `board.env`, produces kernel, device tree and bootloader artifacts through
the BSP boundary, and must satisfy the shared kernel assertion set.

> status: shipped — evidence: `mica-build:boards/README.md`, `mica-build:common/kernel/mica-required.fragment`

The staged porting manual, intake rubric, board template and qualification
procedure are published, and together they are the integrator's path from a
blank board to a supported row on this page; start at
[`mica-build:boards/README.md`](https://github.com/micaoss/mica-build/blob/main/boards/README.md).

> status: shipped — evidence: `mica-build:boards/README.md`, `docs/hardware/board-template.md`, `docs/hardware/qualification.md`
