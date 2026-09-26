# BSP porting manual: blank board to supported board

This is the procedure companion to the BSP contract in
[docs/boards/contract.md](../boards/contract.md). The contract says what a board
must provide; this manual says in what order to provide it, what each stage
consumes, and what proves the stage is done. Where the two disagree, the
design record wins.

Two boards run through this manual as references:

- **cx3576** (CX3576-Z, RK3576) — the full-effort case: the board builds its
  own boot chain under `mica-build:boards/cx3576/`, so every stage below applies.
- **uefi-x64** and **uefi-arm64** use the platform's UEFI firmware plus the
  independently built signed systemd-boot manager and UKI. Each has a BSP kernel
  and current board definition; no boot script is used.

Every stage ends with an exit criterion a reviewer can check. Do not start a
stage whose predecessor has no passing exit criterion; the stages are ordered
so that each one's inputs are the previous one's outputs.

The tiering of the finished board — what Mica OS may claim about it — is defined
in [support-tiers.md](support-tiers.md). The evidence the claims rest on is
collected per [qualification.md](qualification.md) into a dossier following
[board-template.md](board-template.md).

## Stage 1 — SoC/vendor intake, redistribution rights and provenance

**Goal.** Decide whether the vendor's deliverables can carry a Mica OS port at
all, and record where every input comes from before any of it enters the tree.

**Inputs.** Vendor BSP (source tree, Yocto layers, or binaries), SoC
documentation, license terms for every blob, the kernel version the vendor
ships.

**Procedure.** Run the intake rubric in [intake.md](intake.md) to completion:
classify every input as source, source-plus-blobs, or binary-only; check the
kernel version against the support tiers in the BSP contract (5.10 LTS or
newer is full support, 5.4 is per-board evaluation, 4.x is out of support);
confirm redistribution rights for every artifact that will ship in an image;
open the board's provenance record. For a vendored upstream tree, the record
follows the sync-record practice of
[docs/boards/cx3576-bsp-sync.md](../boards/cx3576-bsp-sync.md): upstream
repository, synced-to commit, per-commit disposition, and a deviation
register for every deliberate difference.

**Exit criteria.** The intake rubric has no open row; the kernel tier
decision is written down; binary-only inputs meet the acceptance conditions in
[intake.md](intake.md) or the port stops here.

**Contract artifact.** The board's provenance record (for cx3576:
`docs/boards/cx3576-bsp-sync.md`) and the Provenance section of the board
dossier.

## Stage 2 — boot ROM, SPL, TF-A and U-Boot

**Goal.** An authenticated boot-executable path with bounded, persistent trials.
Record every first mutable stage and vendor blob from intake. For cx3576, build
the fixed Mica OS firmware with the required public FIT keys and protected record
ranges. Assert required configuration verification, disabled persistent command
import, watchdog start before storage, and decrement/flush/readback before FIT
load. Debug BSP firmware is not a Mica OS installation substitute.

UEFI boards build the pinned systemd-boot manager and matching UKI stub and use
explicit Secure Boot enrollment. Test refusal when attempt persistence fails.
Each firmware result is a separate signed component maintenance input.

**Exit criteria.** Pinned builds and signature/persistence negatives pass;
physical boot/watchdog/recovery observations are recorded separately. Use
`make os-fit-records-test` for the cx3576 native C policy and the UEFI QEMU
harness for actual boot-manager selection.

> status: board-dependent — evidence: `mica-build:boards/cx3576/loader/build-mica.sh`, `mica-build:boot`, `mica-build:tests/suites/lifecycle-uboot-fit`

## Stage 3 — kernel, config and DTS

**Goal.** A kernel that can mount the verity-protected root with no
initramfs, which means every boot-path option built in, `=y`, never `=m`.

**Inputs.** The vendor or mainline kernel tree pinned by commit; the shared
baseline fragment `mica-build:common/kernel/mica-required.fragment`; the board's device
tree.

**Procedure.** Start from the vendor config, merge the shared fragment
*before* `olddefconfig`, then assert every `=y` line of the fragment against
the built `.config` — the cx3576 kernel build fails on a missing mica-required
option rather than producing a kernel that cannot boot the root. Maintain the
board DTS in-tree under `kernel/dts/` (open-source route, no overlay
stacking) and local fixes as an ordered patch series under
`kernel/patches/`, listed in that directory's `series` file.

> status: board-dependent — evidence: `mica-build:boards/cx3576/kernel/configure.sh`, `mica-build:boards/cx3576/kernel/hooks/configure.sh`, `mica-build:boards/cx3576/kernel/patches/series`

uefi-x64 follows the same procedure over mainline rather than a vendor tree, with
no patch series and no DTS: `mica-build:boards/uefi-x64/kernel/` pins the tag and the
sha256 of `git archive` over it, merges the shared fragment and its own on top
of `x86_64_defconfig`, and records the resolved `.config` in-tree so the build
can refuse one that drifted.

**Exit criteria.** The kernel build passes its config assertions; `Image`,
`modules.tar` and the `.dtb` land in the BSP output; the modules tree version
equals the kernel release (the image assembler asserts this coupling — it is
absolute).

**Contract artifact.** `boards/<name>/kernel/` and its three artifacts.

## Stage 4 — firmware and calibration

**Goal.** Exactly the runtime firmware set in the signed root — no more, no
less — and a plan for per-unit calibration data that cannot live in a signed
image.

**Inputs.** Radio/peripheral firmware blobs from the vendor BSP, with their
redistribution rights confirmed in stage 1.

**Procedure.** Declare every firmware file the board needs as an installed
path in `BOARD_FIRMWARE_FILES` in `board.env`. The board package build stages
each declared entry and refuses paths outside `/usr/lib/firmware/`; the
verification suite asserts the assembled image carries the same set. Per-unit
calibration (MAC addresses, radio calibration) is factory data, not image
content — route it to stage 8.

> status: board-dependent — evidence: `mica-build:producers/board/render.sh`

**Exit criteria.** `BOARD_FIRMWARE_FILES` names only confirmed runtime files;
the board package builds; nothing firmware-shaped hides in the overlay.

**Contract artifact.** The `BOARD_FIRMWARE_FILES` list and
`boards/<name>/firmware/`.

## Stage 5 — board.env

**Goal.** The board definition: one file, plain `KEY=value`, the single
source of truth every consumer reads and none duplicates.

**Inputs.** The partition layout decided with the bootloader (stage 2) and
the storage medium; the board facts accumulated so far.

**Procedure.** Start from the nearest board: `bun src/cli.ts new-board <name>
--from <board>` in `mica-build` copies it, rewrites every name, mints fresh
GPT and filesystem identities in its `layout.tsv` and sets
`BOARD_RELEASE_TARGET=0`. Then write the disk in `<name>/layout.tsv` --
the partitions with their roles, sizes and identities, and the raw regions --
and `<name>/board.env` against the reference in [board-env.md](board-env.md)
(`make os-layout-lint` holds the table to the layout rules), the
hardware as `BOARD_FEATURES` and lists (`BOARD_FIRMWARE_FILES`,
`BOARD_HWINIT_CONFS`) where empty is a statement, the authenticated boot
(`FIRMWARE_FORMAT`, the `FIT_*` facts, the exact `BOARD_CMDLINE_ARGS`), and
declare the flashing formats in `<name>/images.tsv`, at least
`image disk builtin - img` and `update full builtin - micaupd`
([contract.md](contract.md) section 3.1). `manifests/board.pkgs` names the board package; a radio's
transport packages and optional components go beside it. `make check` in
`mica-boards` holds the directory to the contract
(`tests/gates/board-contract.ts`).

> status: shipped — evidence: `mica-build:make os-layout-lint`

**Exit criteria.** The current layout tests and explicit image verification pass.
`make os-layout-lint` is the existing contract gate.

**Contract artifact.** `mica-build:boards/<name>/board.env` and `manifests/` — the
definition itself, published in the board bundle (`make pool`, `make
publish`) that the assembly pins.

## Stage 6 — image layout

**Goal.** A complete current factory image with two authenticated deployments.
Use the layout the board declares in `layout.tsv`; there is no old-layout
reader, frozen historical geometry or in-place migration requirement.

In the assembly, the board enters as an input, `locks/mica-boards.<name>.lock`
with its pin (`docs/design/release-lock.md` section 4), and as the products
`products/<name>-dev/`; `make product PRODUCT=<name>-dev` composes
the root, signs the root, kernel and firmware, two deployment records, the
image and the update archive, and `make product-verify` verifies the image.
No source in the assembly changes for a new board: the engine dispatches on
the board's facts, and `make os-board-name-lint` refuses a name in it. The
Debian base needs no change either while the board package depends on what
the `mica-board-*` consumer family pulls (`mica-debian:consumers.pkgs`);
a dependency beyond it is a named consumer and a lock change there. The
image command's capacity gate reserves current, fallback and candidate
space; DATA is last and is the only partition grown after assembly;
firmware and SYSTEM ranges/identities must remain unchanged.

**Exit criteria.** `make product` and `make product-verify` pass for the
board's `dev` product, then the complete image reaches actual firmware boot and
clean shutdown. The DATA growth test validates the actual packed policy
against a disposable disk.

> status: shipped — evidence: `mica-build:src/product/build.ts`, `mica-build:make product-verify`, `mica-build:tests/gates/repart-loader.ts`

## Stage 7 — hwinit

**Goal.** Board hardware brought up by declarative units, with board facts
separated from shared logic.

**Inputs.** The board's hardware inventory: radios, CAN, USB OTG/gadget,
LEDs, MAC provisioning needs.

**Procedure.** Ship one systemd unit plus one script per concern under
`boards/<name>/hwinit/`, reading its facts from `/etc/mica/<concern>.conf`;
declare the conf set in `BOARD_HWINIT_CONFS`. The facts themselves come from
`package/init/` and are staged by the board package. A board with no such
hardware declares the list empty — uefi-x64 does.

> status: board-dependent — evidence: `mica-build:boards/cx3576/package/hwinit`

**Exit criteria.** Every declared conf has a unit that reads it and vice
versa (the rootfs build refuses a fact no script reads); units are inert on
absent hardware rather than failing.

**Contract artifact.** `boards/<name>/hwinit/` and the `BOARD_HWINIT_CONFS`
list.

## Stage 8 — factory provisioning

**Goal.** A repeatable path from a blank board to a flashed, individualized
unit.

**Inputs.** The assembled image; per-unit data (MAC, serial, calibration);
the SoC's recovery/flash mechanism.

**Procedure.** Document and script the flash path (cx3576: `rkdeveloptool`
via maskrom or the rockusb loader mode, driven from the BSP Makefile). Define
where per-unit identity lands — DATA/state, or hardware fuses/OTP
where the platform provides them — and how the factory writes it. The
three-layer configuration model in
[docs/design/provisioning.md](../design/provisioning.md) defines how a device
is configured without a network after flashing.

> status: board-dependent — evidence: `mica-build:boards/cx3576/Makefile`

**Exit criteria.** A written factory procedure a technician can follow; a
blank board becomes a booting, individually identified unit using only
documented steps.

**Contract artifact.** The board's flash targets and the factory section of
the board dossier.

## Stage 9 — update and recovery integration

**Goal.** Independent component updates, retained fallback and explicit recovery.
Exercise signed root-only, kernel-only and combined deployments on complete
current images. Verify unchanged object reuse, three failed trials, health-owned
confirmation, manual rollback refusal cases, reset retention and missing/shared
storage failure. Firmware writes belong only to its separate signed maintenance
flow.

Inject interrupted publication, confirmation and GC, and insufficient space.
For cx3576, add physical power cuts at object writes/sync, record activation,
trial decrement and health confirmation. No counter refill or boot-variable
editing may conceal a failure. Record the actual watchdog reset and cause.

**Exit criteria.** Applicable automated gates pass, and every claimed physical
path has dated board/image-bound evidence. Unrun physical cases remain pending.

> status: shipped — evidence: `mica-build:tests/suites/lifecycle-uefi/updates.sh`, `mica-build:make os-fit-records-test`, `mica-build:make os-file-transaction-faults`

## Stage 10 — release registration

**Goal.** The board exists as a product fact: registered, tiered, and
qualified — or honestly not.

**Inputs.** Everything above, plus qualification runs on real hardware.

**Procedure.** Set `BOARD_RELEASE_TARGET=1` in the board's `board.env` and
declare the products it ships (`mica-build:products/`). Add the board's row
to the current-boards table in [support-tiers.md](support-tiers.md). Fill a dossier per [board-template.md](board-template.md) — the
cx3576 instance is [cx3576.md](cx3576.md). Run the
field-reliability matrix per [qualification.md](qualification.md) on a named
revision; rows without hardware evidence stay `not tested`. Assign the
support tier per [support-tiers.md](support-tiers.md) — the tier is earned by
the evidence, not by the port compiling. Release signing follows
[docs/design/release-signing.md](../design/release-signing.md).

**Exit criteria.** Dossier complete and validating against the template;
qualification matrix filled with dated rows; tier assigned; the power-cut rig
run done before the board is called supported.

**Contract artifact.** The board dossier and the BSP contract's board table.

## The board's files, in one list

A board is a data directory. `bash bin/bun.sh src/cli.ts new-board <name> --from <board>`
in `mica-boards` creates it; these are the files it must end up with, and the
contract for each is [contract.md](contract.md):

| Path | Holds |
|---|---|
| `boards/boards.tsv` (one row) | `<board> <arch> <boot backend>`, the machine-readable board list |
| `boards/<board>/board.env` | the board definition: layout, features, firmware and hwinit lists, the authenticated boot facts, `BOARD_RELEASE_TARGET` ([board-env.md](board-env.md)) |
| `boards/<board>/manifests/` | `board.pkgs`, `radio-<r>.pkgs` and `component-<c>.pkgs`: what the board installs |
| `boards/<board>/kernel/` | the kernel build, its `config`, and `config/<board>.required`, the symbols the assembly's suites need (`builtin` as `=y`, `runtime` as `=y` or `=m`) |
| `boards/<board>/loader/`, `bsp.env` | a FIT board's U-Boot build and its file names |
| `boards/<board>/images.tsv` | the flashing formats and update kinds: `image disk builtin - img` is mandatory, `update full builtin - micaupd` and the optional `root` and `kernel` rows beside it |
| `boards/<board>/outputs.tsv` | what a release of this board outputs: `package <name>` rows and `file <component> <path>` rows; it travels in the board component |
| `boards/<board>/meta/`, `package/` | the board package's payload and policy |
| `boards/<board>/evidence.json` | the board's assurance statements ([assurance.md](assurance.md)) |

A release publishes the board as component artifacts — `board`, `kernel`,
`uboot` (FIT boards), `firmware` (when the board carries firmware) and
`packer` (only when a non-builtin image kind exists) — plus the board's
package pool. The `board` and `kernel` components carry the verity trust
certificate annotation; a component whose inputs are unchanged is reused from
the board's latest release by digest.

> status: shipped — evidence: `mica-build:src/boards/new-board.ts`, `mica-build:boards/boards.tsv`, `mica-build:boards/uefi-x64/images.tsv`, `mica-build:boards/uefi-x64/outputs.tsv`, `docs/boards/contract.md`

The board's packages are built by the producers in `mica-build:producers/`
(`board`, `radio`, `radio-wifi`, `radio-bluetooth`). Each package declares its
own version and `SOURCE_DATE_EPOCH`; a release never changes a version, and an
unchanged package is reused from the previous release of that board
([package versions](../decisions/2026-09-15-package-versions.md)).

> status: shipped — evidence: `mica-build:producers`, `docs/decisions/2026-09-15-package-versions.md`

## Gates

`make check` in `mica-boards` runs the lint and the suites the contract
depends on: `locks-test`, `ci-outputs-test`, `board-contract-test`,
`uboot-env-test`, `kernel-config-test`, `kernel-cmdline-test`,
`bench-collector-test`, `mac-stable-test`, `can-network-test`,
`gadget-configfs-test` and `wireless-test`. A new board
is not done until they pass with its directory in the tree;
`board-contract-test` is the one that reads the layout above, and
`kernel-config-test` the one that reads `config/<board>.required`.

> status: shipped — evidence: `mica-build:Makefile`, `mica-build:src/boards/kernel-config.ts`

## The first release, and what the assembly needs

1. `mica-boards` cuts the board's first release on GitHub,
   `<board>.<YYYYMMDD-HHMM>`, which builds that board alone and publishes its
   components and pool; the release carries `mica-boards.lock` and
   `SHA256SUMS` ([releasing](../user/releasing.md)).
2. `mica-build` pins it as `locks/mica-boards.<board>.lock` with
   `locks/pins/mica-boards.<board>.pin` (`SCOPE=<board>`) and fetches the
   components, checking them against the board's `outputs.tsv`.
3. `mica-build` carries a `<board>-dev` product for the board, and a
   `<board>-prod` product where the board has one. There are no minimal
   products (`docs/decisions/2026-09-16-minimal-products-removed.md`).
4. Only then does `BOARD_RELEASE_TARGET=1` mean anything: the board's
   products are built and published by `mica-build`'s scoped releases.

> status: shipped — evidence: `docs/design/release-lock.md`, `docs/decisions/2026-09-16-minimal-products-removed.md`, `mica-build:locks`
