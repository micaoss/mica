# The generic systems are named by their firmware class

- **date**: 2026-09-16
- **kind**: engineering decision
- **owner**: `mica-boards` (the board directories, packages and releases) and `mica-build` (the products and their scopes)
- **review sunset**: 2027-03-16
- **status**: accepted (user, 2026-09-16); the records are renamed here; `mica-boards` and `mica-build` implement it in the same cycle as `docs/decisions/2026-09-16-scoped-tags-use-a-dot.md`, tracked by `docs/task/20260916-0040-uefi-board-names.md`

## Decision

A board name says what the system is, not which instruction set it runs:

| Was | Is | What it is |
|---|---|---|
| `x64` | `uefi-x64` | the generic amd64 UEFI system |
| `virt-arm64` | `uefi-arm64` | the generic arm64 UEFI system |
| `cx3576` | `cx3576` | a hardware board (Rockchip RK3576) |
| `s905x5m` | `s905x5m` | a hardware board (Amlogic S7D) |

So the taxonomy is two kinds of board: **generic systems**, named for their
firmware class, which run on any machine whose firmware matches and are
qualified by class rather than by model; and **hardware boards**, named for
the product, which are qualified on that hardware.

Consequences:

- `mica-boards`: `boards/uefi-x64/` and `boards/uefi-arm64/`; the board
  packages become `mica-board-uefi-x64` and `mica-board-uefi-arm64`, which are
  new package names with fresh declared versions rather than version bumps of
  the old ones; `boards.tsv`, `outputs.tsv`, `images.tsv`, the kernel
  configuration and required lists, the tests and the dossiers follow. Every
  identity stays: the partition GUIDs, the ESP volume ids and the disk GUID
  are the same boards under new names.
- `uefi-arm64` becomes the generic UEFI/ACPI arm64 system and a release target
  (`BOARD_RELEASE_TARGET=1`), with a driver set beyond virtio — NVMe, USB
  storage, AHCI, the common NICs, xHCI, PCIe and RTC — so that one image boots
  QEMU and ordinary arm64 UEFI machines. `uefi-x64` keeps its current generic
  amd64 configuration.
- `mica-build`: the products become `uefi-x64-dev`, `uefi-x64-prod`,
  `uefi-arm64-dev` and a new `uefi-arm64-prod` — no minimal products are
  carried over, they were removed the same day
  (`docs/decisions/2026-09-16-minimal-products-removed.md`); the pins become `locks/mica-boards.uefi-x64.lock` and
  `locks/mica-boards.uefi-arm64.lock` with `SCOPE=uefi-x64` / `uefi-arm64`;
  the release scopes and the image file names follow
  (`mica-uefi-x64-dev-<stamp>.img.gz`).
- The renamed products are **new products**: they start at generation 2 and
  carry no generation floor from the old names. A device pinned to `x64-dev`
  would refuse a `uefi-x64-dev` deployment in any case, and nothing is
  deployed on hardware.
- Releases, products and image files published before 2026-09-16 keep their old
  names. They are history and are not rewritten.

## Rationale

`x64` and `virt-arm64` named an instruction set and an emulator. Neither says
what a reader needs to know: whether their machine can run the image. A
generic system is defined by the firmware that starts it — UEFI with
systemd-boot and a signed UKI — and the architecture is a suffix of that name,
not the name itself. It also removes the accident that the arm64 generic
system was named after QEMU's `virt` machine while it is meant to boot
ordinary UEFI arm64 hardware.

## Removal condition

Revisited if a second firmware class appears for the same architecture, or if
the generic systems stop being built as boards.
