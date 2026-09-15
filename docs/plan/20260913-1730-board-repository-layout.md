# 20260913-1730-board-repository-layout A board is a data directory: the layout of mica-boards

- **status**: implementing
- **createdAt**: 2026-09-13 17:30
- **approvedAt**: 2026-09-13 18:05 (user: 执行; publishing is CI's, not a developer machine's)
- **relatedTask**: 20260913-1730-board-repository-layout

## Context

Requested 2026-09-13: "the directory layout is still the old one; adding a
board is not clear". Measured on `mica-boards` at `375cdb9`:

- **A board sits beside the infrastructure.** The root holds `x64/`,
  `virt-arm64/`, `cx3576/`, `s905x5m/` next to `families/`, `tools/`,
  `tests/`, `gate/`, `docs/`, `meta/` and the fetched `build-env/`, `boot/`,
  `debian/`. Nothing says which directories are boards; the Makefile finds
  them by `*/board.env`.
- **A board directory is half copied infrastructure.** `x64/` is 20 files;
  12 of them are `deb/board-x64/{Dockerfile,Dockerfile.dockerignore,
  producer.env,render.sh,copyright,control/}` and `deb/kernel-x64/{Dockerfile,
  Dockerfile.dockerignore,producer.env,prepare.sh,control/}`, which differ
  from `virt-arm64/`'s only by the board's name (`diff` shows 4 lines).
  `tools/new-board.sh` copies and renames them; a fix to the board package's
  Dockerfile is four commits.
- **A board's own inputs are scattered** over `board.env`, `evidence.json`,
  `manifests/`, `bsp/{kernel,uboot,init,bsp.env}`, `hwinit/`, `overlay/`,
  `meta/`, `deb/*/control`, `deb/*/copyright`, `tests/`; the board package's
  producer names six of them as build contexts.
- **The producer carries the board's name** (`deb/board-cx3576`,
  `mica-board-cx3576`), so the producer directory, its `producer.env` and
  its control file are per board although the recipe is one.

What is right and stays: `board.env` as plain facts, `families/` building
the kernel and the loader, the bundle contract (`docs/boards/contract.md`
§3), the producer convention of `build-env` (a directory with a
`Dockerfile` and a `producer.env`), the board-name lint in the assembly.

## Proposal

### L1. The tree

```
mica-boards/
  boards/<name>/          what a board IS -- data, and the board's own hooks; no Dockerfile
    board.env  evidence.json  README.md
    manifests/            board.pkgs, radio-<r>.pkgs, component-<c>.pkgs
    kernel/               config/, fragments, patches/, hooks/, dts/, versions.env   (today bsp/kernel)
    loader/               U-Boot: bsp.env's loader half, patches/, tests/, config   (today bsp/uboot, bsp.env)
    package/              the board package's inputs: control.env, copyright, overlay/, hwinit/, init/
                          (today deb/board-<b>/{control,copyright}, overlay/, hwinit/, bsp/init/)
    extras/<producer>/    board-specific packages that are real producers (s905x5m: wireless, bluetooth, front-panel)
    tests/                the board's own tests (cx3576's bench collector)
  families/<family>/      unchanged: family.env, Makefile.inc, kernel/, uboot/, hooks
  producers/board/        ONE producer for every board's package (Dockerfile, render.sh, producer.env)
  producers/kernel/       ONE producer for every board's bundle (Dockerfile, prepare.sh, producer.env)
  tools/  tests/  docs/   as today; gate/shell-lint.sh moves to tests/
  meta/  build-env/  boot/  debian/   the signing workspace and the three fetched pins, unchanged
```

`boards/<name>/` is discovered (`boards/*/board.env`); a board is added by
`tools/new-board.sh <name> --from <nearest>`, which copies data only.

### L2. One producer per package kind, over every board

`build-env` gains the **matrix producer**: a `producer.env` may declare
`FOR_EACH=boards/*/board.env`, and `build.sh`/`producers.sh` run the
producer once per match with the file's `KEY=value` pairs in the
environment and expanded in `PACKAGES`, `ARCHES`, `ENABLEMENT`,
`BUILD_CONTEXTS` and `BUILD_ARGS` (`PACKAGES="mica-board-${LAYOUT_BOARD}"`,
`ARCHES="${MICA_ARCH}"`, `BUILD_CONTEXTS="board=boards/${LAYOUT_BOARD}"`).
`producers.sh` prints one row per instance (`board@cx3576`); `make
os-deb-board@cx3576` selects one; the package gate and the pool are
unchanged (they read archives). The control file becomes
`boards/<b>/package/control.env` (the fields that vary: Description, the
extra Depends) rendered by the producer over a template, so no board
carries a Debian control file. `producers/kernel/prepare.sh` reads the board
from the environment instead of hard-coding it.

### L3. The assembly and the documents

`mica-build` changes nothing structural (`deps/boards/` is already the
board's pin); `tools/board-pool.sh --source` and the signed-boot lab read
`boards/<b>/kernel` and `boards/<b>/loader` at the pinned commit instead of
`<b>/bsp/...`. `docs/boards/contract.md` §2 (the board directory layout),
`porting.md`, `families/README.md` and `tools/new-board.sh` describe the
new tree.

### Work packages

| # | Repository | Change | Proof |
|---|---|---|---|
| 1 | `mica-boards` | `git mv` every board under `boards/` and regroup its inputs (kernel/, loader/, package/, extras/, tests/); families' relative paths; Makefile discovery; `new-board.sh`, `kernel-config-test.sh`, `publish-boards.sh`, the contract test | `make check`; `make pool` byte-identical to `375cdb9`'s archives (same versions, same sha256) |
| 2 | `mica-build-env` | the matrix producer (`FOR_EACH`), `producers.sh` rows per instance, `build.sh` expansion, `package-gate.sh` unchanged; published | a fixture producer over two fixture boards builds two archives; `tests/oci-test.sh` green |
| 3 | `mica-boards` | `producers/board` and `producers/kernel` replace the eight `deb/{board,kernel}-<b>/` directories; `package/control.env` replaces the control files | the pool byte-identical to work package 1's (the same four board packages, the same four bundles) |
| 4 | `mica-build`, `mica` | `board-pool.sh --source` and the labs on the new paths; contract §2, porting, families README, new-board | `make os-board-name-lint`, the FIT labs' source check, `make docs-verify` |
| 5 | both | dry run: `new-board.sh proof --from virt-arm64` copies data only (no Dockerfile, no producer.env, no control file), builds, publishes, is pinned by the assembly, deleted | the copy is `boards/proof/` and nothing else |

Bit-identical pools are the proof that a move is a move: the archives'
versions carry the commit, so the comparison is of the payload tar
members' digests, not of the archive files.

### Verification

Per work package. Plan-level: `boards/<name>/` holds no Dockerfile, no
producer.env and no control file (a test in `tests/board-contract-test.sh`
refuses them); `git ls-files boards/x64 | wc -l` is 8 (board.env,
evidence.json, README, manifests/board.pkgs, kernel/{config,fragment,versions.env},
package/{control.env,copyright}) and every one of them is data.

## Risks

- The matrix producer touches `build-env`'s driver, which every repository
  runs; it is additive (a producer without `FOR_EACH` runs as today) and
  the fixture test covers both.
- The pinned `mica-boards` commit in the assembly names paths under
  `<b>/bsp` for the FIT labs; work package 4 follows the bump.
- `git mv` keeps history; `git log --follow` still reads it.

## Scope

In: `mica-boards`' tree, the matrix producer in `mica-build-env`, the
assembly's two readers of a board's source paths, the documents. Out: the
family layer's internals, the bundle contract, the assembly's own tree
(`products/`, `rootfs/`, `build/`, `verify/` are keyed by product and pin
already), the registry migration (`20260913-1700`).

## Alternatives

- Keep per-board producer directories and generate them from a template
  (`new-board.sh` does this today): the copies stay and drift.
- Symlink each board's `Dockerfile` to a shared one: a symlink as a
  producer is not something `build-env` discovers deliberately, and buildx
  remote contexts do not follow it.
- Move the boards into `mica-build`: undone by `20260913-1600`, for the
  reasons recorded there.

## Annotations

- 2026-09-13 17:30: created from the user's request; awaits approval.
- 2026-09-13 17:35: work packages 1-5 landed. `mica-boards` `080dbfd`: every
  board under `boards/<name>/` regrouped as L1 says (`kernel/`, `loader/`,
  `firmware/`, `package/`, `extras/`, `flash/`, `userland/`, `components/`,
  `tests/`; `bsp.env` and the `Makefile` at the root); the eight per-board
  producer directories replaced by `producers/board` and `producers/kernel`,
  matrix producers of `mica-build-env` `cf4898e` (`FOR_EACH`, `CONTROL_DIR`,
  `MICA_DEB_INSTANCE`; `tests/producers-test.sh`); s905x5m's radios and
  front panel are its `extras/wireless` and `extras/bluetooth` with their
  own hwinit and init files; `board.env` declares `BOARD_PACKAGE_ENABLEMENT`;
  the contract test refuses a `producer.env` in a board directory. Proof:
  the pool built through the new producers is member for member the pool
  built before the move (`tools/pool-payload-diff.sh`; the only difference
  is `board.env`, which changed by its own commits), `make check` and the
  package gate (99/99) green; the dry run `new-board.sh proof --from
  virt-arm64` copied eleven data files and nothing else, was discovered as
  `board@proof`/`kernel@proof`, passed the checks and was removed.
  `mica-build` `024e67b9`: the FIT labs read `boards/<b>/loader` of the
  pinned checkout. Deviations: the control templates stay Debian control
  files under `package/control/` and `kernel/control/` (data the gate
  reads; a `control.env` template would have been a second format);
  `bsp.env` stays a file at the board's root rather than a half under
  `loader/`; the readings' deletion and `BOARD_PACKAGE_ENABLEMENT` are the
  two `board.env` changes the comparison tolerates. Publishing is CI's from
  here (the user's instruction): `mica-build-env` and `mica-debian`
  `publish-source.yml`, `mica-boards` `release.yml` and the assembly's
  privileged lane push with their own tokens (`packages: write`); the
  runbook `20260913-1700-registry-migration` is rewritten to that.
- 2026-09-15: pre-reset history: the `mica-build-env` commits cited here
  (`cf4898e`) are no longer on its `main`, which the user reset to one root
  commit (`5c05745`); the current `mica-build-env` facts (release
  `20260915-0138` at `f7b896b`) are in
  `docs/task/20260914-2042-release-lock-offline-build.md`.
