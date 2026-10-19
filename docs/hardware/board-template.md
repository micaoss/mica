# Board page template

A board page is the one document where a reader finds what a board is, how an
image gets onto it, how it is recovered, and what has been proven about it.
Every board in the [status table](README.md#current-boards) has exactly one,
`docs/hardware/<board>.md`, whose title is `# <board>: <hardware>`.

A board's engineering — its kernel, loader, packages, their provenance and the
digests of what it takes in — is not on this page: it is in
`mica-build:boards/<board>/`, and the board contract is
`mica-build:boards/README.md`.

**Validation.** A board page MUST carry the eleven H2 headings below, spelled
exactly and in this order, with no H2 heading outside this list.
`tools/docs/verify-board.sh`, run by `make docs-verify`, asserts that heading
list and the qualification-row grammar mechanically; the required fields under
each heading are asserted by review.

> status: shipped — evidence: `tools/docs/verify-board.sh`

The section list:

1. `## At a glance`
2. `## Hardware and feature state`
3. `## Partition layout`
4. `## Console`
5. `## Obtaining an image`
6. `## Flashing`
7. `## First boot`
8. `## Updates`
9. `## Recovery`
10. `## Known limitations`
11. `## Qualification results`

An empty section is never silently empty: a section with nothing to say
carries the reason ("no radios on this board"), the same discipline as an
empty list in `board.env` being a statement rather than an omission.

## Required fields per section

### At a glance

- Hardware and SoC, `MICA_ARCH`, the boot chain from the first stage to the
  root's init, where the firmware lives, the partitions.
- The tier, as the [status table](README.md#current-boards) states it, and the
  evidenced [assurance level](assurance.md) (I1–I4), never above what the
  board's `evidence.json` supports.
- Vendor blobs in the boot chain, named.

### Hardware and feature state

- One row per feature the board declares (`BOARD_FEATURES`) and per
  peripheral a reader will ask about: whether it ships, and whether it has
  been exercised on hardware.
- Hardware variants (alternative radio modules, storage parts) and whether
  each is covered.
- The physical recovery actions the board declares, or that it declares none.

### Partition layout

- The partitions, their ranges and what each holds; the authoritative
  geometry is named in `mica-build`.

### Console

- Device, baud rate and connector facts a person needs before wiring.

### Obtaining an image

- The board's products and the file names of a release.

### Flashing

- The procedure, with read-back verification, and which steps have been run
  on a unit. A procedure nobody has driven is marked unverified.

### First boot

- What the first boot does and how long a reader should wait before calling
  it failed.

### Updates

- The update archive kinds the board publishes, and anything that differs
  from [updates and rollback](../operate/updates.md).

### Recovery

- The steps of the [recovery ladder](../operate/recovery.md) that exist on
  this board, the ones that do not, and the floor: the transport that restores
  a unit whose loader is gone, and what it costs.

### Known limitations

- Reduced-auditability entries for every opaque boot stage.
- Hardware or BSP limitations that constrain claims.
- Anything a support engineer must know before promising behaviour.

### Qualification results

- The binding: the board revision, storage device, radio module and BSP
  version the rows apply to ([qualification](qualification.md) section 1).
- The owners: who owns BSP sync and CVE response, and who owns the
  qualification.
- The matrix per [qualification](qualification.md), as a table whose columns
  are the row, the result, the date and the evidence or reason. Every result
  is `pass` | `fail` | `N/A` | `not tested`; pass and fail rows carry an ISO
  date and an evidence note. Never implicitly green.
- The installation row records the flash and first-boot procedure as actually
  exercised on a unit. Describing the procedure is not running it.
