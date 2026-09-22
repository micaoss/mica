# 20260921-1142-merge-boards-into-build Merge mica-boards into mica-build so a board owns its image

- **status**: implementing
- **createdAt**: 2026-09-21 11:42
- **approvedAt**: 2026-09-21 12:25 (user: "开始处理合并工作", after the four answers of 12:00)
- **relatedTask**: 20260921-1140-merge-boards-into-build

## Context

Measured at `mica-build` `e13b4f78`, `mica-boards` `e1e8231`, `mica-core`
`b70b1fe`, `mica` `ccad216`.

### The two trees

| | files | lines | largest directories |
|---|---|---|---|
| `mica-build` | 608 | 84,587 | `tests/` 301, `build/` 72, `verify/` 67, `update-server/` 44, `rootfs/` 38 |
| `mica-boards` | 691 | 143,892 | `boards/` 444, `tests/` 135, `tools/` 30, `docs/` 26, `producers/` 23, `common/` 21 |

Top-level names both trees use: `.editorconfig`, `.github`, `.gitignore`,
`LICENSE`, `locks`, `Makefile`, `README.md`, `tests`, `tools`. Inside them the
only file both carry is `tools/from.sh`; no test name collides.

### How the assembly consumes a board today

`mica-build` pins each board as `locks/mica-boards.<board>.lock` with its
pin, fetches the board's component artifacts (`board`, `kernel`, `uboot`,
`firmware`, `packer`) by digest into `_out/boards/<board>/`
(`mica-build:tools/board-pool.sh`), and reads everything from there: 80 files
of `mica-build` read `board.env`. The board's layout, boot backend and
firmware format are declared in `board.env` (about 40 layout keys per board);
`images.tsv` declares the delivered formats and the update kinds; a
non-builtin packer is a board-supplied program run over the signed `disk.img`
(decision `2026-09-15-board-image-packers.md`).

### What the board declares and what the engine actually allows

The declaration is wider than the engine. `mica-build:build/src/file-layout.ts`
accepts exactly:

- `LAYOUT_PARTITIONS` = `ESP SYSTEM DATA` (systemd-boot) or `FIRMWARE SYSTEM
  DATA` (uboot-fit), in that order, numbered 1..3, contiguous;
- `SYSTEM` exactly 1 GiB; sector size 512; `LAYOUT_VERSION=3`;
- GPT alignment 2048 (UEFI) or 1 (FIT); the FIT firmware partition at sector
  64 with the one Rockchip type GUID;
- the U-Boot environment copies at 16 and 17 MiB (rockchip-loader) or 120
  and 124 MiB (amlogic-boot0), 64 KiB each, and `SYSTEM` starting at 18 or
  128 MiB respectively.

`build/src/file-image.ts` keys each partition's contents on its name:
`FIRMWARE` is the raw region `fit-environment.ts` writes (loader plus two
environment copies), `ESP` is vfat with the loader tree and the boot entries,
anything else is ext4 with the deployments store or the DATA tree. There is no
board hook: a board with a fourth partition, a different environment offset, a
vendor recovery partition or a different `SYSTEM` size is a code change in
`file-layout.ts`, `file-image.ts`, `fit-environment.ts`, `board-facts.ts`, the
verifier and the tests. `board-facts.ts` also enumerates the backends
(`systemd-boot`, `uboot-fit`) and firmware formats (`efi`, `rockchip-loader`,
`amlogic-boot0`); 40 files in `mica-build` branch on those literals (the
largest: `tests/board-bundle-test.sh` 14, `build/src/board-facts.ts` 11,
`tools/board-pool.sh` 10, `boot/Dockerfile` 9).

So the packer decision gave a board the delivered *file format* but not the
*image*: what goes where on the disk is the assembly's, and the board's
`board.env` values are checked against constants rather than read.

### The device side has the same constants

`mica-core:crates/mica-deploy/src/fit_env.rs` compiles the FIT geometry per
board name: `FitLayout::{Cx3576, S905x5m}` with the environment offsets and
the firmware partition's sector count, chosen by `for_board(<name>)`;
`firmware.rs` lines 134 and 147 do the same. The comment says why: "disk
contents never choose writable offsets". A third FIT board is therefore a
`mica-core` change today, merge or no merge, and the repair is not to read the
layout from the disk but to carry it in the signed board policy the device
already verifies.

### What the split costs, from the records

- Every kernel embeds the assembly's verity certificate, so both repositories
  hold the same repository variables and `mica-boards` gates them with
  `trust-certificates.sha256`; `tools/board-pool.sh` refuses a component built
  against another certificate.
- A layout or kernel change is a board release (`<board>.<stamp>`), a pin bump
  in `mica-build` (two files per board), then a product release; the
  contract's section 4.6 records a kernel that rode a week of images because
  the pin, not the build, decides what the assembly sees.
- `mica-boards` keeps its own `docs/` (20 tasks, 3 plans, a changelog) while
  `mica-build`'s records live in `mica`.
- Two CI pipelines, two release workflows, two `locks/upstream.lock` files
  (`mica-boards`: seven `git` rows for the kernels, U-Boots and rkbin plus
  the s905x5m toolchain and packer archives; `mica-build`: `wireless-regdb`),
  and two build-env pins (`mica-boards` `20260915-0138`, `mica-build`
  `20260916-0735`).

### What already works and is kept

- The board directory contract (`mica-boards:boards/README.md`,
  `tests/board-contract-test.sh`): one directory per board with its whole
  build, `boards.tsv`, `outputs.tsv`, `images.tsv`, `manifests/`, `package/`.
- Component artifacts reused by their inputs hash (`mica.inputs`,
  `mica-boards:tools/reuse.sh`), so an unchanged kernel is never rebuilt or
  republished.
- Scoped releases `<board>.<stamp>` and `<product>.<stamp>`, the Mica version
  index, and the product recipe (`products/<name>/product.env`).
- The board-name lint in `mica-build` that keeps board names out of the
  engine.

### Where the engine dispatches on board facts (the user's rule, 2026-09-21)

The user's rule for the merged repository: every board carries a
`layout.tsv`, the layout is read from it, and nothing of the form
`case "$LAYOUT_PARTITIONS"` or its TypeScript equivalent decides what a
board's image is. Measured to know what that rule removes:

| Where | Sites | What they branch on | What it becomes |
|---|---|---|---|
| `build/src/file-layout.ts` | 8 | backend, the partition set, the firmware format | deleted: the table is read and checked against rules only |
| `build/src/file-image.ts` | 11 | backend and partition *names* (`FIRMWARE`, `ESP`, `DATA`) | role dispatch through one registry |
| `build/src/fit-environment.ts` | 2 | backend, firmware format | `region` rows |
| `verify/src/file-image.ts` | 4 | the same, on the verifier side | reads the same table |
| `build/src/board-facts.ts` | 4 | backend, firmware format | keeps backend and FIT facts; loses the geometry |
| `build/src/kernel-package.ts` | 12 | backend (`boot.itb` vs `boot.efi`, watchdog symbols, `CONFIG_CMDLINE`), firmware format bounds | one boot-packaging module per backend behind a registry keyed by `BOOT_BACKEND`; loader bounds become board data |
| `build/src/firmware.ts`, `firmware-maintenance.ts` | 7 | firmware format | the same registry |
| `build/src/components.ts`, `component-archive.ts`, `component-cli.ts`, `release-manifest.ts`, `verify/src/board-scope.ts` | 6 | `uki` vs `fit` | the same registry |
| `tools/board-pool.sh` `kernel_dirs()` | 1 | backend chooses `kernel/` or `kernel/dev,prod` | every board ships `kernel/<profile>/`; the case goes |
| `rootfs/scripts/pack-export-debug.sh` | 1 | `MICA_ARCH` | stays: an architecture table, not a board branch |
| `mica-boards:tools/component.sh` | 1 | firmware format chooses the U-Boot output directory | the board's `outputs.tsv` names the files; the case goes |
| `mica-boards:Makefile` | 8 | board tests listed by name (`boards/cx3576/tests/...`) | discovered as `boards/*/tests/*-test.sh` |

Fifty-four TypeScript sites in 13 files and three bash sites. The board-name
lint (`mica-build:tests/board-name-lint.sh`, allowlist of 19 test files, all
labs and fixtures) already keeps board *names* out of the engine; what it does
not catch is a branch on a board *fact* that only two boards satisfy, which
is what the layout constants are. The rule this plan adds is therefore about
facts, not names: a board fact is consumed at exactly one dispatch point per
axis, and that point is a table keyed by the declared value.

### The in-flight work in `mica-boards` (the user's question 3)

Checked at `e1e8231` (2026-09-21): the working tree is clean, and every open
record is owned by one agent, `tdpnmgkr`. `20260916-0620` (s905x5m U-Boot
reproducibility) is a measurement blocked on the rename round; `20260920-0900`
(tier-two symbols, pstore) and the two plans `20260920-0627` (kernel
capabilities beside each board) and `20260920-0730` (the boot logo on every
board) are proposals that turn nothing on until the user decides;
`20260920-cx3576-first-hardware-capture` is a record of a console capture;
`20260919-2130` is done. None is mid-implementation, so none blocks the move:
they travel with `docs/` into `mica/docs/` under their own IDs and continue
there. **Decision: handle after the merge.** The move is announced on BKD
issue `uj991oa2` before it is cut so the owner re-homes the records rather
than writing into a retired checkout.

### Decisions this plan supersedes

- `docs/decisions/2026-09-15-mica-boards-per-board-releases.md` says
  "`mica-boards` stays its own repository; it is not merged into
  `mica-build`" with the removal condition "if `mica-boards` is ever merged
  into another repository". The user's request of 2026-09-21 is that merge.
- `docs/boards/contract.md` section 1, the separation rule ("neither side
  reaches into the other's build"), which assumed two repositories.
- `docs/decisions/2026-09-15-board-image-packers.md` in its `packer`
  component: a packer no longer needs an artifact to cross a repository.

## Proposal

One repository, `mica-build`, in which a board directory owns its build *and*
its image, and the engine is generic over partition roles rather than
partition names. Three phases, each proven before the next.

### P1. The move

`mica-boards`' tree lands in `mica-build` with its history (a subtree merge,
as the 2026-09-13 split was done in the other direction), at these paths:

| From `mica-boards` | To `mica-build` | Note |
|---|---|---|
| `boards/` | `boards/` | unchanged; `boards/<board>/../../` is the repository root as before |
| `common/` | `common/` | the shared kernel floor, U-Boot helpers, trust staging, package templates |
| `producers/` | `producers/` | the board package and radio package producers |
| `tools/*` except `from.sh` | `tools/` | `from.sh`, `locks.sh`, `upstream.sh` are reconciled with the assembly's `from.sh`, `locks.py`, `source.sh`: one resolver per lock kind |
| `tests/*` | `tests/` | no name collides |
| `locks/upstream.lock` | `locks/upstream.lock` | the union of both files' rows |
| `locks/mica-build-env.lock` + pin | dropped | the merged repository keeps the assembly's pin (`20260916-0735`) |
| `docs/` | `mica/docs/` | the open tasks and plans re-listed in `mica`'s indexes under their own IDs; the changelog appended as one section |
| `.github/workflows/build.yml` | merged into `ci.yml` and `release.yml` | see P2 |
| `Makefile` | merged | `make check` is the union; the board targets become `board-kernel BOARD=`, `board-uboot BOARD=`, `pool` |

Prerequisite, done in `mica-boards` first: re-pin its build-env to
`20260916-0735` and cut the last `mica-boards` releases from it, so the
byte-identity proof below compares kernels built with one toolchain. If the
toolchain move changes a kernel, that is measured and recorded there, not
inside the merge.

`mica-build`'s `locks/mica-boards.<board>.lock` and pins are deleted;
`tools/board-pool.sh --fetch` reads the board's components from this
repository's own published artifacts (`ghcr.io/micaoss/mica-build:
<component>.<board>.<release>`) or from a local `make board-kernel` output,
still checking `mica.verity-cert-sha256` (a reused component may predate a
certificate). The `board` and `packer` components are not published any
more: their contents are source files of the same commit. `kernel`, `uboot`
and `firmware` stay OCI artifacts, reused by `mica.inputs`.

Proof: `make check` green; every board's kernel, U-Boot and firmware
components built from the merged tree byte-identical to the last
`mica-boards` release's (digest for digest); every product's root and kernel
components byte-identical to a product build from the same pins before the
move; `make docs-verify` in `mica`.

### P2. One release model

The tag namespace is already shared. A board-scoped release
`<board>.<stamp>` now runs, in order: plan (which components the inputs hash
lets it reuse), the kernel and U-Boot jobs of that board (native runners,
skipped when reused), its pool, the components published and read back, then
its products as today, then `mica-build.lock`. A product-scoped release
reuses the board's components from the board's latest release by inputs and
is refused when the board's inputs moved since (the answer is a board
release). `mica-build.lock` gains the rows `mica-boards.lock` carried
(`board`, `pool`, `package`) as its own output rows; the `input
mica-boards.<board>` rows disappear. The index job and `mica-index.json` are
unchanged, so the website and `mica-res` are not touched.

`ci.yml` on push: the union of both pipelines, with the kernel and U-Boot
jobs planned by inputs hash exactly as `build.yml` plans them today, so a
push that touches the engine reuses every kernel and costs what `mica-build`'s
CI costs now. `privileged.yml` stays.

Proof: one board-scoped release per board from the merged repository,
verified anonymously; the index job cuts `mica.<stamp>`; a product-scoped
release after it reuses the components; `tests/release-test` and
`locks-verify` cover the new rows.

### P3. The board-owned image

Every board carries `boards/<board>/layout.tsv`; the board contract test
refuses a board without one. The layout leaves `board.env` and becomes a
table the board writes and the engine reads without constants:

```
# mica layout v1
disk	<disk guid>	<sector size>	<align sectors>
part	<number>	<name>	<role>	<start sector>	<size sectors>	<type guid>	<part guid>	<fs uuid or ->
region	<partition name>	<region name>	<offset bytes>	<size bytes>	<source>
```

Roles the engine implements: `esp` (vfat; the loader tree, the boot entries,
the provisioning seed), `system` (ext4; the deployments store), `data` (ext4;
the DATA tree with quota), `raw` (bytes placed by `region` rows), `vfat` and
`ext4` with a seed directory out of the board directory (a vendor recovery or
configuration partition). A `region` source is `loader` (the signed U-Boot
binary), `records-a` / `records-b` (the two boot-record environment copies
the engine encodes; the format stays the contract with `mica-deploy` and
`common/uboot/mica-records.h`), or a file of the board directory.

Rules, held by the engine and by the board contract test: exactly one
`system` and one `data`; exactly one boot medium (`esp` on systemd-boot; on
uboot-fit one `raw` partition carrying both record regions); partitions
ordered, non-overlapping, inside the disk, aligned; regions inside their
partition and non-overlapping; the capacity check (two deployments plus
reserve) over the declared `system` size instead of a fixed 1 GiB. Sizes,
offsets, alignment, GUIDs and type codes become board data.

**The dispatch rule.** A board fact is consumed at one point per axis, and
that point is a table keyed by the declared value, never a `case` or an
`if fit` scattered through the engine:

| Axis | Declared in | The one dispatch point | Members today |
|---|---|---|---|
| partition role | `layout.tsv` `part` rows | `build/src/roles/<role>.ts`, a registry `ROLES[role]` with `build`, `verify` | `esp`, `system`, `data`, `raw`, `vfat`, `ext4` |
| region source | `layout.tsv` `region` rows | `build/src/regions.ts`, one writer per source | `loader`, `records-a`, `records-b`, a board file |
| boot backend | `board.env` `BOOT_BACKEND` | `build/src/backends/<backend>.ts`, a registry `BACKENDS[backend]` with `packageBoot`, `bootFile`, `kernelSymbols`, `verifyKernel` | `systemd-boot`, `uboot-fit` |
| loader bounds | `board.env` (`UBOOT_MIN_BYTES`, `UBOOT_MAX_BYTES`, `LOADER_MAGIC_HEX`) | read as data by the `loader` region writer; no format enum | -- |
| architecture | `board.env` `MICA_ARCH` | the existing architecture tables (`efiArch`, `kernelImage`, runners) | `amd64`, `arm64` |

Adding a board that reuses existing members is data only: a directory with
`board.env`, `layout.tsv`, `images.tsv`, `outputs.tsv`, its kernel build and
its package. Adding a member (a new role or backend) is one new module
registered in one table, and the contract test refuses a declared value no
registry carries, naming the file and the legal values. A lint over
`build/src`, `verify/src`, `tools/`, `rootfs/` and the Makefile refuses the
literals `uboot-fit`, `systemd-boot`, `rockchip-loader`, `amlogic-boot0`,
`LAYOUT_PARTITIONS` and the partition names outside the registries and the
readers of the tables, with a negative fixture; it joins the board-name lint
in `make check`.

What changes, site by site (the audit in *Context*): `file-layout.ts` reads
the table and holds the rules only; `file-image.ts` and
`verify/src/file-image.ts` iterate the rows and call `ROLES[role]`;
`fit-environment.ts` becomes the `records-*` region writer; `board-facts.ts`
loses `FirmwareFacts` and keeps backend, FIT and architecture facts;
`kernel-package.ts`, `firmware.ts`, `firmware-maintenance.ts`, `components.ts`,
`component-archive.ts`, `component-cli.ts`, `release-manifest.ts` and
`board-scope.ts` call `BACKENDS[backend]`; `FIRMWARE_FORMAT` leaves
`board.env`. Every board's kernel component ships `kernel/<profile>/` (a UEFI
board's two profiles are the same files and, by content addressing, the same
layers), so `board-pool.sh` reads `kernel/${PROFILE}` without a case;
`component.sh` takes the U-Boot output directory from `outputs.tsv`; the
board tests are discovered as `boards/*/tests/*-test.sh`. `images.tsv` and
the packers stay as they are, now run from the checkout.

Proof: the four boards' `disk.img` byte-identical to P2's from the same pins
(the layout is unchanged, only where it is declared); `os-verify` and the
lifecycle suites on `uefi-x64` and `cx3576`; negative fixtures refused by
name: overlapping partitions, two `system` roles, a region outside its
partition, a FIT board without record regions, a role no registry carries; a
synthetic fifth board in the contract test with four partitions and a vendor
`raw` partition whose assembled GPT equals its table; the fact lint green
over the tree and red on its fixture; `grep -c` of the six literals outside
the registries is zero.

### P4 (separate task, `mica-core`)

`FitLayout` stops being an enum keyed on the board name: the record offsets
and the firmware partition's sector count travel in the signed board policy
`mica-deploy` already verifies, and `for_board` goes. Until it lands, the P3
engine refuses a FIT layout whose record regions differ from the two the
device knows, with a refusal that names this task. That guard is the only
place the merged repository still knows a board by name, and it is deleted
with P4.

## Risks

- **Two accepted decisions are reversed** (per-board releases in a separate
  repository, the separation rule). Both are recorded with their removal
  condition, which this is; a superseding decision is written in P1, not
  implied.
- **CI wall time.** Kernel builds join the assembly's pipeline. The
  inputs-hash reuse keeps them out of every run that does not touch a board's
  inputs; the per-board kernel job time is read from the last `build.yml`
  runs before P2 and written into the P2 record, so the cost is a measured
  number and not a guess.
- **In-flight work in `mica-boards`.** Checked (Context): records only, one
  owner, nothing mid-implementation; they move with `docs/` and the move is
  announced on BKD issue `uj991oa2` before it is cut.
- **History and published artifacts.** The subtree merge keeps every
  `mica-boards` commit; published `mica-boards` releases, their locks and the
  `ghcr.io/micaoss/mica-boards` artifacts stay as history and nothing
  rewrites them. Archiving the repository is the user's action.
- **The device boundary.** P3 delivers the customization for everything the
  device does not compile in; a FIT board with a new record geometry still
  waits for P4. The guard makes that visible rather than silent.
- **80 readers of `board.env` and 40 backend-literal sites** are the P3 edit;
  the board-name lint and the byte-identity proof are what keep it honest.

## Scope

- `mica-boards`: the whole tree moves; one last release before the move
  (build-env re-pin).
- `mica-build`: `Makefile`, `.github/workflows/{ci,release,release-product}.yml`,
  `tools/` (release, board-pool, product-build, image-kinds, locks), `locks/`,
  `build/src/` (file-layout, file-image, fit-environment, board-facts,
  firmware, kernel-package, release-manifest and their tests), `verify/src/`,
  `tests/` (board bundle, repart, board-name lint, release), `boards/<board>/`
  (`layout.tsv`, `board.env`).
- `mica`: `docs/boards/contract.md`, `docs/design/release-lock.md` (1.0,
  1.2.2, section 4), `docs/decisions/` (one superseding decision), the
  workspace `CLAUDE.md`/`AGENTS.md`, this plan's records, the imported
  `mica-boards` records.
- `mica-core`: P4 as its own task, not in this plan.

## Alternatives

- **A. Keep two repositories; move the layout into the board component.**
  P3's table travels in the `board` artifact and the engine reads it. Gives
  the customization without the merge and is the smallest change. Keeps
  every cost in *What the split costs*: the release round trip for each
  layout change, the duplicated trust variables, and no single CI that can
  build a kernel and the image it boots in one run.
- **B. Merge, keep the fixed layout** (P1 and P2 only). Removes the round trip
  and the duplication; does not give a board its image, which was the
  request.
- **C. P1 to P3, recommended.** A's contract inside B's repository.
- **D. Merge `mica-core`'s device side too.** Rejected: the device contract
  is signed data the updater verifies, not repository co-location; P4 is a
  `mica-core` change on its own release cadence.

## Progress

- 2026-09-21: P1 and the one-release-model wiring of P2 are implemented on
  the branch `merge-boards` of `mica-build` (worktree `tmp/wt-merge`), as
  four commits: the history-preserving import of `mica-boards` at `925e31d`,
  the layout, the wiring and the tests. Measured before the push:
  - every kernel and U-Boot file of the four boards, built in the merged
    tree, is byte-identical to a build of `mica-boards` at the same commit
    in a reference worktree (cx3576's U-Boot also byte-identical to the
    published `uboot.cx3576.20260917-1007`; s905x5m's U-Boot differs from
    its published one as `20260916-0620` records, not from the reference
    build);
  - the kernels differ from the published components of the last board
    releases because the boards' inputs moved since (the floor and the
    configs, 2026-09-20), which is why the reference is a build of the same
    commit and not the registry;
  - gates green on the branch: the lock vectors (68), the shell and
    host-toolchain lints with their self-tests, the board-name lint with its
    self-test, the board contract (44), the kernel-config floor (52), the
    boards' fixtures, `os-product-test` (33), `os-rootfs-manifest-test`
    (37), `os-offline-chain-test` (18), `os-build-test` (579),
    `os-verify-test` (945), `os-release-test` (65), `publish-test` (21),
    `version-guard-test`, `board-bundle-test` (23), `os-pool-test` (23),
    `os-image-kinds-test` (29), `os-fit-records-test`, the static package
    gate over the boards' pools (111);
  - `make board-pool` builds the eight producers into the two pools, and a
    product build of `uefi-x64-dev` from the local kernel is the end-to-end
    check before the push.
  The spec (`docs/design/release-lock.md`), its reference checker and
  canonical vectors, the board contract, the architecture map, the user
  guides and the workspace instructions are rewritten in this repository in
  the same round; the records of `mica-boards` moved here (changelog
  2026-09-21 13:40). Not in this round: P3 (`layout.tsv` and the dispatch
  rule) and P4 (`mica-core`).
- 2026-09-22: pushed. `origin/main` had moved 64 commits under the branch
  (`e13b4f78` to `de476350`, the package-version work among them), so the
  import and the wiring were replayed as `merge-boards-2` on a worktree cut
  from `origin/main`; conflicts in the lock reader, the Makefile and the
  vectors resolved in favour of both sides (main's `getty@tty1` runtime-link
  declaration of `4cea5665` stands; the vectors are pinned at this
  repository's `3bddfcb`). On the replayed branch, before the push: every
  gate of the list above green again, `os-vectors-pin-check` (131 files
  identical), the `uefi-x64-dev` product built from the tree's own kernel on
  a clean checkout, `make product-verify PRODUCT=uefi-x64-dev` (106 checks)
  and `tests/lifecycle-uefi/run.sh uefi-x64-dev --runtime-only` (boot and
  ordered shutdown in QEMU) pass. Pushed to `mica-build` `main` as
  `de476350..0e34a1b4` (98 commits), then the update-server removal of
  `20260921-1216` as `abc59de2` and `90b72919`. The first CI run on the
  merged main builds every board's kernel and U-Boot (nothing to reuse:
  no `mica-build` release has published components yet); its outcome is
  the next thing to read. Open: P3 (`layout.tsv`, the dispatch rule, the
  fact lint) and P4; the worktree `tmp/wt-merge2` of `mica-build` keeps the
  built kernels under `_out/` until the first releases publish them.

## Annotations

- 2026-09-21 (user): (1) the repository stays `mica-build`; (2) the `board`
  and `packer` components are dropped; (3) the in-flight `mica-boards` work is
  for the agent to check and sequence -- checked, handled after the merge
  (Context); (4) after the merge every board has a `layout.tsv`, the layout is
  read from it, nothing like `case "$LAYOUT_PARTITIONS"` remains, and the
  other `case`-style dispatches on board facts are found and removed so that
  a board is clean to add. Folded into P3 as *The dispatch rule* and the audit
  table in Context. Option C stands.
