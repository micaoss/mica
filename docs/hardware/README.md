# Supported hardware

One page per board, answering four questions in the same order every time:
**does this board run Mica OS, how far has that been proven, how does an image
get onto it, and how do you get back when it goes wrong.** This page holds the
board status table and the support tiers the table uses.

## Current boards

This table is the single source for board status; other documents link here
instead of restating it.

| Board | Hardware | Arch | Boot | Disk layout | Evidence on file | Tier |
|---|---|---|---|---|---|---|
| [`uefi-x64`](uefi-x64.md) | generic amd64 machine (UEFI + ACPI) | amd64 | systemd-boot, signed UKI | ESP / SYSTEM / DATA | QEMU lifecycle: API, power actions, runtime, updates, faults and reset | bring-up (QEMU baseline) |
| [`uefi-arm64`](uefi-arm64.md) | generic arm64 machine (UEFI + ACPI) | arm64 | systemd-boot, signed UKI | ESP / SYSTEM / DATA | QEMU `virt`: API, update, fault and reboot rows | bring-up (QEMU reference) |
| [`mini-x64`](mini-x64.md) | small amd64 machine (UEFI), 128 MB of flash | amd64 | systemd-boot, signed UKI | ESP / SYSTEM / DATA | QEMU lifecycle over `mini-x64.basic` | bring-up (QEMU) |
| [`cx3576`](cx3576.md) | CX3576-Z / Rockchip RK3576 | arm64 | U-Boot, signed FIT | FIRMWARE / SYSTEM / DATA | static verification; one hardware observation, no qualification row | bring-up |
| [`s905x5m`](s905x5m.md) | BM201 / Amlogic S905X5M (S7D) | arm64 | U-Boot, signed FIT | FIRMWARE / SYSTEM / DATA, on SD or eMMC | static verification and fixtures; no physical row | bring-up |

No board is `mica-qualified`: no board page carries a dated physical
qualification row.

`uefi-x64`, `uefi-arm64` and `mini-x64` are **generic systems**, named for the
firmware class that starts them; `cx3576` and `s905x5m` are **hardware
boards**, named for the product
([decision](../decisions/2026-09-16-generic-systems-named-by-firmware.md)).

> status: board-dependent — evidence: `mica-build:boards/boards.tsv`, `mica-build:boards/uefi-x64/evidence.json`, `mica-build:boards/uefi-arm64/evidence.json`, `mica-build:boards/mini-x64/evidence.json`, `mica-build:boards/cx3576/evidence.json`, `mica-build:boards/s905x5m/evidence.json`

## What the table does and does not claim

**Every board is a release target** (`BOARD_RELEASE_TARGET` in its
`board.env`): its products are built and can be released, each on its own, as
`<board>.<variant>`. `basic` is every board's default product, and `full` adds the
container engine on `uefi-x64`, `uefi-arm64` and `cx3576`; `mini-x64` has
`basic` alone, which already carries it. `s905x5m` names its products by
storage: `basic` and `emmc-full` for its eMMC, `sd-full` for an SD card. A `dev` product is
built locally and never released. Which products have a release to download is
on the [download page](https://micaos.dev/download/); a product without one is
built from source ([build](../start/build.md)).

**Being a release target is not a claim about hardware.** What actually starts
an image splits three ways:

| How far it is started | Board | What that means |
|---|---|---|
| Booted in each release run | `uefi-x64`, `mini-x64` | every amd64 product boots one runtime stage of the UEFI lifecycle under QEMU |
| Built and statically verified; QEMU on request | `uefi-arm64` | the release run's boot step is amd64-only |
| Started by nothing in these repositories | `cx3576`, `s905x5m` | no suite boots a FIT image; the FIT suite runs on the host without QEMU |

A published image is not a booted image, and emulator evidence is not field
evidence. Every physical step on the board pages is marked unverified until a
dated row says otherwise.

> status: shipped — evidence: `mica-build:boards/products.md`, `mica-build:README.md`, `mica-build:.github/workflows/release-product.yml`

## Support tiers

A tier is a claim about evidence and ownership, not about whether an image
boots. Mica OS normally supplies the contract and the guidance while the
integrating customer selects and integrates the board, so the tiers keep three
different situations from blurring into one word "supported".

| | `mica-qualified` | `integrator-qualified` / bring-up | `unsupported` |
|---|---|---|---|
| Means | Mica OS owns the port and its evidence | the port exists and the contract is met; the field evidence belongs to the integrator or is still being gathered | everything else |
| Evidence | a complete board page, and a [qualification matrix](qualification.md) run by Mica OS on a named revision, with dated `pass` rows for cold and warm boot, update, power-cut during update and recovery | the same page and matrix, its rows filled by the integrator or honestly `not tested` | none required |
| Lifecycle owner | Mica OS: BSP sync, CVE response, requalification on change | the integrator, with Mica OS providing the contract and templates; the board page names who owns what | nobody |
| Permitted claims | "supported" at the named revision, with the evidenced [assurance level](assurance.md) and nothing above it | "builds and passes the repository's gates"; never "supported" or "qualified" without naming whose qualification it is | none; mentioned only as unsupported |

"It boots" does not move a board out of `unsupported`: field reliability,
recovery, update and lifecycle ownership are exactly what a booting image
leaves unproven.

A tier is assigned per board **and revision combination**. Movement up needs
the evidence, not intent: bring-up becomes integrator-qualified when the
integrator's rows are dated, and either becomes mica-qualified only when
Mica OS runs and owns the matrix. Movement down is automatic: a
re-qualification trigger ([qualification](qualification.md) section 5) returns
rows to `not tested` for the new combination, and the tier's claims lapse with
them.

> status: shipped — evidence: `docs/hardware/qualification.md`, `docs/hardware/board-template.md`, `docs/hardware/assurance.md`

## Choosing a board

- **To see what the system is**: [`uefi-x64`](uefi-x64.md) under QEMU, the
  baseline with automatic boot evidence.
- **To fit into 128 MB of flash**: [`mini-x64`](mini-x64.md). OpenRC, the
  management plane, SSH and containers; no USB.
- **To try a generic arm64 machine**: [`uefi-arm64`](uefi-arm64.md). It carries
  generic hardware drivers (AHCI, NVMe, USB storage, the common NICs), but
  carrying a driver is not evidence that a machine boots, and it has no MMC
  support.
- **To build an RK3576 product**: [`cx3576`](cx3576.md), the in-tree porting
  reference.
- **To use a BM201 / S905X5M**: [`s905x5m`](s905x5m.md).
- **To bring up a new board**: the board contract and porting guide,
  `mica-build:boards/README.md`, and the [board page template](board-template.md).

## The same ground, by topic

| To learn | Read |
|---|---|
| What a release contains and how to verify it | [download](../start/download.md) |
| Flashing in full, including the QEMU command lines | [flashing](../start/flashing.md) |
| Which update archive applies, and how a device takes it | [updates and rollback](../operate/updates.md) |
| The recovery ladder | [recovery](../operate/recovery.md) |
| Partitions and where data belongs | [storage](../operate/storage.md) |
| How the whole system fits together | [overview](../start/overview.md), [architecture](../architecture.md) |

Each board page summarises flashing, updates and recovery from that board's
point of view; the topic pages own the detail. A board's engineering (its
kernel, loader, packages and their provenance) is in
`mica-build:boards/<board>/`.
