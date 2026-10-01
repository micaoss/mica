# Supported hardware

One page per board, answering four questions in the same order every time:
**does this board run Mica OS, how far has that been proven, how does an image
get onto it, and how do you get back when it goes wrong.**

This is a dated snapshot, written 2026-10-01. The authoritative status table is
[board support tiers](../boards/support-tiers.md#current-boards); where the two
disagree, the tiers table wins and this page is the defect.

## The boards

| Board | Hardware | Arch | Boot | Release target | Tier | Physical evidence |
|---|---|---|---|---|---|---|
| [`uefi-x64`](uefi-x64.md) | generic amd64 machine (UEFI + ACPI) | amd64 | systemd-boot, signed UKI | yes | bring-up (QEMU baseline) | none |
| [`uefi-arm64`](uefi-arm64.md) | generic arm64 machine (UEFI + ACPI) | arm64 | systemd-boot, signed UKI | yes | bring-up (QEMU reference) | none |
| [`cx3576`](cx3576.md) | CX3576-Z / Rockchip RK3576 | arm64 | U-Boot, signed FIT | yes | bring-up | one user report, no evidence row |
| [`s905x5m`](s905x5m.md) | BM201 / Amlogic S905X5M (S7D) | arm64 | U-Boot, signed FIT, SD boot | yes | bring-up | none |
| [`mini-x64`](mini-x64.md) | small amd64 machine (UEFI), 128 MB of flash | amd64 | systemd-boot, signed UKI | yes | bring-up (QEMU) | none |

No board is `mica-qualified`: no dossier carries a dated physical
qualification row. The tiers themselves are defined by evidence and ownership —
`mica-qualified` (Mica OS ran and owns the matrix), `integrator-qualified /
bring-up` (the contract is met; the field evidence belongs to the integrator or
is still being accumulated), `unsupported` (no dossier, no claim).

> status: board-dependent — evidence: `docs/boards/support-tiers.md`, `mica-build:boards/uefi-x64/board.env`, `mica-build:boards/uefi-arm64/board.env`, `mica-build:boards/cx3576/board.env`, `mica-build:boards/s905x5m/board.env`, `mica-build:boards/mini-x64/board.env`

## Where the project actually stands (2026-10-01)

**Every board is a release target**, and each of its products is released on
its own: `<board>.basic`, the default, on every board, and `<board>.full`, with
the container engine, on all but `mini-x64`. **Two of the nine have a release
so far**: `cx3576.full` and `mini-x64.basic`. The others have none yet, so
there is no image to download for them; they are built from source
([build guide](../user/build.md)).

**Being a release target is not a claim about hardware.** It says the images
are published. What has actually started an image splits three ways:

| How far it is started | Board | What that means |
|---|---|---|
| Booted in each release run | `uefi-x64`, `mini-x64` | Every amd64 product boots one runtime stage of the UEFI lifecycle in QEMU |
| Built and statically verified; a manual QEMU record | `uefi-arm64` | The gate's boot step is amd64-only, so this board carries no automatic boot; its QEMU evidence predates the board rename |
| Started by nothing in these repositories | `cx3576`, `s905x5m` | No suite boots a FIT image: the FIT suite runs on the host with no QEMU, and both suites that do start a guest refuse a FIT board by name |

**No physical boot has an evidence row**, and there is no record of a Mica OS
image being written to a USB stick, SATA disk, NVMe or eMMC. A `cx3576` bench
boot was reported by the user on 2026-09-20; it arrived as a sentence with no
artefact, so it is a report and not a qualification row, and it moves nothing
in the tiers table. Every physical step on these pages is marked unverified.

> status: shipped — evidence: `mica-build:boards/products.md`, `mica-build:README.md`, `docs/user/download.md`

## Choosing a board

- **To see what the system is** → [`uefi-x64`](uefi-x64.md) under QEMU, the
  baseline with automatic boot evidence.
- **To fit into 128 MB of flash** → [`mini-x64`](mini-x64.md): OpenRC, the
  management plane, SSH and containers, no USB.
- **To try a generic arm64 machine** → [`uefi-arm64`](uefi-arm64.md). It
  carries generic hardware drivers (AHCI, NVMe, USB storage, the common NICs),
  but **carrying a driver is not evidence that a machine boots**, and it has no
  MMC support at all.
- **To build an RK3576 product** → [`cx3576`](cx3576.md), the in-tree porting
  reference. Its flashing path is implemented with read-back verification; the
  control flow is proven against a stubbed tool, never against real hardware.
- **To use a BM201 / S905X5M** → [`s905x5m`](s905x5m.md). **There is no
  supported way to install Mica OS onto a blank board**: its U-Boot runs from
  eMMC boot0 while the published disk image covers SD media only and installs
  no bootloader.
- **To bring up a new board** → the [board contract](https://github.com/micaoss/mica-build/blob/main/boards/README.md) and
  the [porting guide](https://github.com/micaoss/mica-build/blob/main/boards/README.md).

## The same ground, by topic instead of by board

| To learn | Read |
|---|---|
| What a release contains and how to verify it | [download](../user/download.md) |
| Flashing in full, including the QEMU command lines | [flashing](../user/flashing.md) |
| Which update archive applies, and how a device takes it | [update packages](../user/update-packages.md), [update and rollback](../user/update-rollback.md) |
| The recovery ladder, and which steps exist today | [recovery](../user/recovery.md) |
| Partitions and where data belongs | [storage](../user/storage.md) |
| How the whole system fits together | [overview](../user/overview.md), [architecture](../architecture.md) |

Each board page summarises flashing, updates and recovery from that board's
point of view; the topic pages above own the detail.

## Where these pages come from

Each page draws on the English board dossier (`docs/boards/<board>.md`), the
board's own `board.env` and `evidence.json` in `mica-build:boards/<board>/`, and the user
documentation. `uefi-x64` and `mini-x64` have no dossier, and their pages name
the source of each fact instead.

> status: board-dependent — evidence: `docs/boards/cx3576.md`, `docs/boards/s905x5m.md`, `docs/boards/uefi-arm64.md`, `mica-build:boards`
