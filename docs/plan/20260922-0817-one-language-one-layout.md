# 20260922-0817-one-language-one-layout One language and one layout for the mica-build engine

- **status**: implementing
- **createdAt**: 2026-09-22 08:17
- **approvedAt**: 2026-09-22 08:55 (user: "开始处理", with "容器内的构建脚本如果是外部的就保留外部的shell即可"; the three open questions take their recommended answers)
- **relatedTask**: 20260922-0815-one-language-one-layout

## Context

Measured at `mica-build` `2e8ebaef` (the merged main, 2026-09-22), tracked
files only.

**The languages.** Outside `boards/` (whose C, Makefiles and Dockerfiles are
vendor kernel, loader and driver trees and stay what they are):

| Language | Files | Lines | Where |
|---|---|---|---|
| TypeScript | 153 | 41,432 | `build/src` (10.9k), `verify/src` (23.2k), `tests/apid-api/src` (3.7k), `tests/lifecycle-uefi` (0.6k), `shared/`, `tools/qemu-seed-data.ts` |
| bash | 229 | 29,041 | `tests/` (105 files, 13.0k), `tools/` (40, 6.7k), `rootfs/` (22, 2.9k), `common/` (12, 0.9k), `boot/` (10, 0.4k), `producers/` (2), `build/run.sh`, `verify/run.sh` |
| Python | 26 | 5,690 | `tools/locks.py` (527, the lock reader every tool calls), `tools/release-index.py` (334), `tools/deb/control-fields.py`, `tools/deb-member.py`, `rootfs/runtime/{compose,select,source-lineage}.py` (1.5k, run inside the pack stage), their tests `tests/rootfs-runtime/*.py` (2.2k), `tests/evidence-schema.py`, the QEMU helpers of `tests/lifecycle-uefi/*.py`, `boot/elf-closure.py`, `common/kernel/{mklogo,export-regdb-certs}.py`, `common/scripts/git-pack-manifest.py`, and four under `boards/cx3576` |
| Dockerfile | 36 | 2,636 | 18 under `boards/`, 6 under `producers/`, `rootfs/compose/` (2), `boot/` (2), `build/`, `verify/`, `tests/` (6) |
| Make | 1 + 12 | 1,365 root | 82 targets; `boards/<board>/Makefile` per board; the rest vendor |

Three Bun packages carry three `bun.lock`, three `node_modules`, three
`tsconfig.json` and identical dependencies (`@types/bun`, `typescript`);
none has a lint; `build/` and `verify/` each own a `file-image.ts` and a
`paths.ts`. The bash calls Python at 130 sites and Bun at 14; the
TypeScript spawns shells from 34 files. `ci.yml` has 49 `run:` steps, 25
of them `make`.

**Where the shell cannot go.** The tree already declares, with the
`# mica-build-side: container` marker the host-toolchain lint reads, which
scripts run inside an image rather than on the host: 8 in `boot/` (the
boot-tools image: `fit.sh`, `kernel.sh`, `initramfs.sh`,
`verity-tool-inner.sh`, `init-keys.sh`), 6 in `common/` (the trust stage,
patch and source fetching inside the bsp image), 5 in `rootfs/` (the pack
stage's `rootfs/scripts/*.sh`, `compose-install.sh`, `compose-capture.sh`),
7 in `tools/`, 1 in `producers/`, 38 in `tests/` (the guests and the lab
containers of `signed-boot-lab`, `lifecycle-uefi`, `lifecycle-uboot-fit`,
`factory-root-gate`, `repart`, `apid-api/guest`, `p1-writable-path-audit`,
`bare-host-gate`). The device root and the initramfs are busybox; the
boot-tools and bsp images carry no Bun; the build-env `base` image carries
both `python3` and `bun` (`mica-build-env:RULES.md`), so the pack stage's
Python can become TypeScript in place.

**Precedent.** `mica-system-base` is the workspace's Bun decision (user,
2026-09-13, `docs/decisions/2026-09-13-ghcr-artifact-registry.md`): "its
build tooling is Bun and TypeScript; scripts and payload that run on the
device are exempt"; its tree is one package (`src/`, `tests/`, `payload/`,
`debs/`, `locks/`), its gates `bun run check` (`eslint`, `tsc`, `bun test`),
and its single shell file is device payload. `mica-core`'s shell is
`scripts/gate/` and `scripts/build/` entry points around `cargo`.

**What is fixed by contract and stays where it is.** `boards/<board>/`
(`docs/boards/contract.md`; the board contract test and the board-name
lint), `boards/boards.tsv`, `common/` and `producers/` (what every board
takes and the board package producers, from the merge of 2026-09-21),
`products/<product>/`, `locks/` and `locks/pins/` (`docs/design/release-lock.md`
2), `trust-certificates.sha256`, `.github/workflows/`, and the vectors pin
`tests/release-lock/vectors.pin` read by `mica`'s canonical vectors (moves
with `tests/fixtures/`, the pin's reader updated). `tests/component-contracts/`
is one contract with `mica-core:crates/mica-deploy/tests/component-contracts/`,
compared by `tools/deploy-pool.sh --check`; its path here is this
repository's to choose and the comparer follows it.

**What reads the paths.** `tools/inputs.sh` hashes a `BUILD_FILES` list
(`build-boards.yml` line 114) that names `tools/locks.py`, `tools/from.sh`,
`tools/ci-outputs.sh`, `tools/inputs.sh`, `tools/reuse.sh`,
`tools/deb/registry.sh`; renaming them moves every board's inputs hash once,
so the first release after the rename builds every component again, and the
byte-identical rebuild is the check that nothing but the hash moved. The
workspace `AGENTS.md`, `docs/user/build.md`, `docs/user/releasing.md`,
`docs/design/build.md`, `docs/design/build-harness.md`, `docs/architecture.md`,
`mica-build:README.md`, `build/HARNESS.md`, `build/release-verify.md`,
`rootfs/README.md`, `tools/deb/README.md`, `tests/apid-api/HARNESS.md` and
the merge plan `20260921-1142` (P3 names `build/src/roles/`,
`build/src/backends/`) name paths that move.

## Proposal

**The rule** (recorded as `docs/decisions/2026-09-22-mica-build-one-language.md`
when approved): everything that runs on the build host is TypeScript on
Bun, in one package at the repository root; shell exists only where Bun is
not the toolchain -- inside a container whose image is not the build-env
base, a guest, an initramfs, a device root -- and lives only under
`stages/` and the suites' guest directories; Python exists nowhere in the
engine. `boards/<board>/` keeps its own languages for what builds the board
inside the bsp image (vendor Makefiles, kernel hooks, loader builds,
Dockerfiles), because those are BSP work driven by vendor build systems;
what a board runs on the host -- its tests -- follows the host rule. The
Makefile stays the entry point people and CI use, and every target is one
line calling `bun src/cli.ts <command> …`, as `mica-system-base`'s
`bun src/container.ts` and `mica-core`'s `scripts/` are.

**The layout:**

```
Makefile  package.json  bunfig.toml  tsconfig.json  eslint.config.js  trust-certificates.sha256
src/                     the engine, one Bun package; unit tests co-located as *.test.ts
  cli.ts                 the one entry: bun src/cli.ts <command> [args]
  locks/                 lock and pin readers, upstream rows, source pins   (tools/locks.py, from.sh, upstream.sh, local-pins.sh, source.sh)
  pool/                  package rows, fetch, index; deb build, pack, gate, publish, registry, version guard   (tools/pool.sh, tools/deb/*)
  boards/                boards.tsv, board bundle, inputs hash, reuse, board.env reader   (tools/board-pool.sh, boards.sh, inputs.sh, reuse.sh; verify/src/board-env.ts)
  rootfs/                package selection, the composition driver, the runtime selection   (rootfs/build.sh, packages/resolve.sh, runtime/*.py)
  boot/                  boot-tools image build, development keys, signing drivers   (boot/build-tools.sh, dev-keys.sh, elf-closure.py)
  image/                 components, layout, images, release manifest, roles and backends   (build/src; P3 of 20260921-1142 lands here)
  verify/                the image checks, smoke, parity   (verify/src)
  release/               plan, publish, index, assets, component publication   (tools/release.sh, release-index.py, publish-components.sh)
  offline/               the offline chain and the source cache   (tools/offline.sh, offline-chain.sh, repos)
  shared/                exec, the container route, paths, tsv, sha256, errors, logging
stages/                  what runs inside a container or a guest: shell by necessity, one directory per image
  compose/               rootfs/compose/*.Dockerfile, compose-install.sh, compose-capture.sh, rootfs/scripts/*
  boot/                  boot/Dockerfile*, fit.sh, kernel.sh, initramfs.sh, verity-tool-inner.sh, init-keys.sh
  trust/                 common/trust/stage-inner.sh (common/trust/stage.sh becomes src/boot)
  fetch/                 common/scripts/{apply-patches,fetch-archive,fetch-source,buildx,mirror}.sh where they run in the bsp image
boards/  common/  producers/  products/  locks/     unchanged
tests/
  gates/                 the host-side gates and lints, TypeScript, run by bun test   (tests/*-test.sh, *-lint.sh)
  suites/                the docker and QEMU suites, each a directory: a TypeScript driver and its guest shell
                         (lifecycle-uefi, lifecycle-uboot-fit, apid-api, signed-boot-lab, bare-host-gate, factory-root-gate,
                          session-probe, repart, p1-writable-path-audit, rootfs-runtime)
  fixtures/              component-contracts, release-lock (vectors + pin), fleet-protocol, quadlet-doc, runtime-sonames.json,
                         host-toolchain-exemptions, board-name-lint.allow
.github/
```

Gone from the top: `build/`, `verify/`, `shared/`, `boot/`, `rootfs/`,
`tools/`, `meta.example/` (its two files move to `src/boot/`), the three
`bun.lock` and `node_modules`.

**The phases.** Each phase is its own commit series on `main`, and each ends
with the byte-identity gate of the task's acceptance (the four products'
images and update archives, both pools, the four board bundles and a
release dry-run's `mica-build.lock`, compared with the phase's start).

- **P1. One package and the skeleton (mechanical; the first thing to land).**
  `build/src`, `verify/src`, `tests/apid-api/src`, `shared/` and
  `tests/lifecycle-uefi/*.ts` move into `src/{image,verify,…}` and
  `tests/suites/` with one root `package.json`, `bun.lock`, `tsconfig.json`,
  `bunfig.toml` and an `eslint.config.js` (the `mica-system-base` one);
  `bun run lint`, `typecheck`, `test`, `check`. `src/cli.ts` dispatches the
  commands `build/run.sh` and `verify/run.sh` dispatch today, and the two
  launchers go. Everything that stays shell moves to its final home
  (`stages/`, the suites' guest directories), `tests/` is split into
  `gates/`, `suites/`, `fixtures/`, and every reader of a moved path
  (Makefile, workflows, `BUILD_FILES`, the lints' allowlists, the docs) is
  updated. No logic changes. Gate: every existing test and gate green
  (`bun test` over the merged package, the shell gates from their new
  paths), byte identity.
- **P2. Python to TypeScript (5.7k lines, 26 files).** In dependency order:
  `tools/locks.py` becomes `src/locks/` with the lock, pin and upstream
  readers as typed functions, keeping the `rows`/`latest` command shapes
  the shell still calls until P3; `release-index.py`, `control-fields.py`,
  `deb-member.py`, `evidence-schema.py`; `rootfs/runtime/*.py` become
  `src/rootfs/runtime/` and the pack stage runs `bun` in the same base
  image where it ran `python3`; their tests become `bun test` cases from
  the same fixtures; the QEMU helpers and `elf-closure.py`, `mklogo.py`,
  `export-regdb-certs.py`, `git-pack-manifest.py`. The four Python files
  of `boards/cx3576` follow the host rule (`flash/scripts/verify-flash.py`
  and `kernel/tests/*.py` run on the host). Gate: the runtime selection
  report, `mica-index.json`, every lock-derived output byte-identical.
- **P3. The drivers (`tools/`, `tools/deb/`, the host halves of `rootfs/`,
  `boot/`, `common/scripts`; ~9k lines).** One module at a time into
  `src/…`, the Makefile target switching to `bun src/cli.ts` as each lands,
  the shell file deleted in the same commit. Order by dependency: `from`,
  `source`, `upstream`, `local-pins` (P2 gave them the readers); `pool` and
  `deb/*` (the pool rows, fetch, index, build, pack, gate, publish; the
  version guard); `boards` (`board-pool`, `inputs`, `reuse`, `boards`);
  `rootfs/build.sh` and `packages/resolve.sh`; `boot/build-tools.sh`,
  `dev-keys.sh`, `common/trust/stage.sh`; `product-build`, `product`,
  `component`, `image-kinds`, `publish-components`, `release`,
  `release-index`; `offline`, `offline-chain`, `cache-prune`, `ci-outputs`,
  `measure-rootfs`, `micad-pool`, `podman-pool`, `base-packages`,
  `deploy-pool`, `pool-payload-diff`, `oci`, `registry`, `new-board`,
  `version`. Gate per module: its existing test ported with it (the
  negative fixtures kept), the byte-identity gate at the phase end; the
  `BUILD_FILES` list is rewritten to the `src/` modules it hashes, which
  is the one inputs-hash move.
- **P4. The host-side gates and suite drivers (~10k lines).** `tests/gates/`
  as `bun test` files, one per today's script, each keeping its negative
  fixture and its self-test where one exists (`host-toolchain-lint`,
  `board-name-lint`, `shell-pipefail-lint` become one `lint/` module with
  the marker grammar and the exemption files as fixtures); the suite
  drivers (`run.sh` of `lifecycle-uefi`, `apid-api`, `signed-boot-lab`,
  `bare-host-gate`, …) as TypeScript around their unchanged guest shell.
  The lint that closes the rule lands here: a `.sh` file outside
  `stages/`, `tests/suites/*/guest*`, `boards/` and the device payload of
  `producers/` is refused; a `.py` file anywhere is refused; every `.sh`
  that remains carries a `# mica-build-side: container` marker; negative
  fixture with it.
- **P5. The record.** The decision, `docs/design/build.md`,
  `build-harness.md`, `architecture.md`, the user guides, the workspace
  `AGENTS.md` (`/pma-bun` covers the whole engine; the bash exemptions
  are named), `mica-build:README.md` and the harness pages; the merge plan
  `20260921-1142` P3 re-pointed at `src/image/`.

P1 lands before P3 of the merge plan (`layout.tsv`, the registries), so
that work is written once, in `src/image/roles/` and `src/image/backends/`.
P2 through P4 and the merge plan's P3 touch different files and can
proceed side by side.

**Effort.** P1 is a day of moves and reader updates. P2 through P4 port
about 24k lines of bash and Python into perhaps 15--18k lines of
TypeScript with their tests; that is several sessions of work, done in
mergeable slices (one module or one gate per commit), each slice
byte-identical at its end. The user chooses the pace and may stop after
any phase with the tree consistent.

## Risks

- **Silent behaviour change in a port.** A shell pipeline's edge (an empty
  `grep`, a `set -e` exit in a subshell, word splitting) can be lost in a
  port and the tests were written against the shell. Mitigation: the
  byte-identity gate at every phase end, the negative fixtures ported
  first, and no port of a script without its test in the same commit.
- **The inputs hash moves once (P3)** and every component rebuilds at the
  next release; if the rebuild is not byte-identical the port changed a
  build input, which is the finding. Mitigation: `tools/reuse.sh`'s
  byte-identity check is the gate before that release.
- **The pack stage switching from `python3` to `bun`** inside the base
  image changes the stage's process, not its inputs; the runtime selection
  report is compared byte-for-byte across the switch.
- **Other sessions** commit to `mica-build` while a phase is open (main
  moved 64 commits under the merge). Mitigation: small commits straight to
  `main`, each leaving the tree consistent; no long-lived branch.
- **Two contracts cross repositories** (`component-contracts` with
  `mica-core`, the vectors pin with `mica`): their paths here move under
  `tests/fixtures/` and only this repository's readers change.

## Scope

In: `mica-build`'s engine (everything outside `boards/<board>/`'s BSP
builds), its tests and gates, its Makefile and workflows, and the records
that name its paths. Out: the boards' vendor builds (Makefiles, kernel
hooks, Dockerfiles, C), `mica-build-env`, `mica-system-base`, `mica-core`
(`component-contracts` stays theirs), the lock format, the release model,
the product recipes, any behaviour of the built images.

## Alternatives

- **Bash everywhere.** 41k lines of TypeScript are the image producer,
  the verifier and the API harness; rewriting them in shell would lose
  typed structures, unit tests and the container route. Rejected.
- **Keep the mix, tidy the tree only.** Leaves the lock reader in Python
  and its callers in bash, and every new tool choosing a language. Does
  not answer the request.
- **Port the engine (P1--P3) and leave the test shell (P4) as is.** A
  legitimate stopping point if the cost of P4 is judged too high: the
  engine is one language, the gates stay shell under `tests/gates/` with
  the rule "new gates are TypeScript". Offered as the fallback, not the
  recommendation, because 13k lines of test shell is where the two
  CI-only misses of 2026-09-22 lived.
- **A Bun workspace with packages per area** (`packages/image`,
  `packages/verify`, …). `pma-bun` reserves workspaces for several
  deployable apps or shared packages with several consumers; this is one
  tool with one CLI. Rejected.

**The board directory under one management (user, 2026-09-22: "我们更倾向统一
管理所有的构建，在boards里面不需要有刷机这些").** Measured at `2e8ebaef`:
every `.sh`, Makefile and Dockerfile under `boards/` is ours (the kernel and
loader builds that run inside the bsp image, the kconfig hooks, the tests);
the vendor content is `s905x5m/kernel/third` (the Seekwave SDIO driver, 88
files), `s905x5m/userland/{skwbt,skw_bridge}` (its Bluetooth library and
bridge), `loader/blobs` and `cx3576/loader/MiniLoaderAll.bin` (DDR, BL31
and loader blobs), the radio firmware under `firmware/`, and the patch
series over the pinned upstream kernel and U-Boot trees. `cx3576/flash/`
(37 files: an rkdeveloptool macOS build with two patches, `verify-flash`,
an Alpine recovery root) and the `flash-mica`, `flash-maskrom`,
`rkdeveloptool-macos` targets of the board Makefile are flashing support
nothing in the engine reads; `tests/bench/` is a bench qualification
collector. The four `boards/<board>/meta` entries are absolute symlinks to
one checkout's `meta/` committed by the layout move of 2026-09-21; nothing
reads them and they are removed (`e26ee3cf`). So, added to P1:

- a board directory is data and vendor inputs -- `board.env`, `layout.tsv`
  (P3 of `20260921-1142`), `images.tsv`, `outputs.tsv`, `bsp.env`,
  `evidence.json`, `manifests/`, `package/`, `firmware/`, `kernel/`
  (config, dts, patches, hooks, the vendor driver trees), `loader/`
  (config, dts, patches, blobs, `mica-file-boot.c`), the package producers
  (`extras/`, `components/`) and `tests/`; the engine drives every build
  from that data (`bun src/cli.ts board kernel|loader|firmware <board>`),
  and the per-board Makefiles go with the root Makefile's `board_delegation`;
- the in-image build scripts a board needs (`kernel/build.sh`,
  `configure.sh`, `loader/build*.sh`, the hooks) stay shell because they
  run inside the bsp image, and they are the only shell a board carries;
- flashing leaves the tree: `cx3576/flash/` and its three Makefile targets
  are deleted, the rkdeveloptool patches and the recovery procedure are
  recorded in `docs/boards/cx3576.md` (*Recovery method*) with the two
  patch files kept under `docs/boards/cx3576/` as reference; the
  `cx3576-flash-verify-test` goes with `verify-flash`; `tests/bench/` stays
  as a test;
- `tools/inputs.sh` stops hashing `flash/assets` (a path no board has).

## Open questions for the user

1. **Boards' host-side tests.** `boards/<board>/tests/*-test.sh` and the
   four Python files of `cx3576` run on the host; the proposal ports them
   to TypeScript under `boards/<board>/tests/` (the board contract test
   adjusts), leaving the BSP builds in their vendor languages. Confirm, or
   keep the whole board directory exempt.
2. **P4's scope.** Port the 13k lines of host-side test shell (full
   unification, the recommendation) or stop after P3 with the fallback
   above.
3. **The names** `src/`, `stages/`, `tests/{gates,suites,fixtures}/`.

## Progress

- 2026-09-22 08:55: approved. Answers taken: (1) the boards' host-side tests move to
  TypeScript, the BSP builds keep their languages; (2) all five phases;
  (3) `src/`, `stages/`, `tests/{gates,suites,fixtures}/`. The user's
  addition: shell that runs inside a container and comes from outside
  (vendor build scripts, upstream trees) stays the external shell it is;
  nothing is rewritten for the sake of the rule. P1 lands in three slices,
  each pushed and gated: P1a one Bun package (`src/`, `tests/suites/`,
  `bin/bun.sh` as the one bootstrap that finds Bun on the host or in the
  pinned container, the Makefile and CI on it); P1b the `tests/` split and
  `stages/`; P1c the board directory under one management (no per-board
  Makefile, `flash/` out). The kernel rebuild that P1b's `common/` move
  forces is compared against the merged tree's builds under
  `tmp/wt-merge2/_out/built/`.
- 2026-09-22 09:37: **P1a on `main`** (`e26ee3cf`, `6b7b991e`, `336fb2e7`, `44993e32`;
  270 files, +5,642/-6,091). One Bun package at the root (`package.json`,
  `bun.lock`, `tsconfig.json`, `eslint.config.js`; gates `lint`,
  `typecheck`, `test`): `build/src` is `src/image`, `verify/src` is
  `src/verify`, `shared/` is `src/shared`, `tests/apid-api` and
  `tests/lifecycle-uefi` are `tests/suites/`, `tools/qemu-seed-data.ts` is
  `src/image/qemu-seed-data.ts`; `src/cli.ts` is the one entry (its
  commands: `test`, `components`, `release`, `build-rootfs`,
  `compare-roots`, `seed-data`, `lint`, `verify`, `smoke`,
  `smoke-negative`, `spec-pins`) and `bin/bun.sh` the one bootstrap in place
  of the four launchers (`build/run.sh`, `verify/run.sh`,
  `tests/lifecycle-uefi/bun.sh`, `tests/apid-api/spec-pins.sh`): bun on the
  host or the pinned image plus the docker client (`bin/Dockerfile`), the
  tree, the socket and the git metadata (read-only) mounted,
  `safe.directory` set. The lint is `mica-system-base`'s eslint
  configuration with four rules off for this tree (named in
  `eslint.config.js`); its auto-fix reformatted the TypeScript once (the
  bulk of the line count). Measured before the push, all on the moved tree:
  `bun run lint` and `typecheck` clean; the image suite 584, the verify
  suite 958, the apid spec pins 43 (its literal check reads both quote
  styles and bare keys now), `os-release-test` 65, `publish-test` 21,
  `version-guard-test` 16, `os-board-bundle-test` 23, `os-pool-test` 23,
  `os-offline-chain-test` 18, `os-rootfs-manifest-test` 48,
  `os-product-test` 33, the board contract 44, `os-image-kinds-test` 29,
  `ci-outputs-test` 16, `trust-stage-test` 10, the vectors pin (131), the
  layout lint, the three shell lints and both lint self-tests; the
  release-shaped `uefi-x64-prod` build, `product-verify` (106), the QEMU
  runtime boot and the session probe (12 claims). **Byte identity** against
  the same product built at `b76b23fe` before the move: `root/` (the
  squashfs, the root hash and its signature), `kernel/`, `firmware/`,
  `deployments/`, `update.micaupd` and `updates/` identical; the records
  that carry the source commit and build time differ as they must
  (`release/manifest.json`, `provenance.json`, `sbom.cdx.json`,
  `licenses.json`, `rootfs-report.runtime.json`, `receipt.txt`, the image
  name); and `image/data.img` differs in 40 bytes (8 in block 0, 32 in
  block 37), a DATA-image reproducibility gap of the producer that predates
  this plan and is measured here for the first time -- open, not this
  plan's. Found and fixed on the way: the four `boards/<board>/meta`
  symlinks (`e26ee3cf`); the lifecycle suite's three unit test files
  (`api-launcher`, `native-input`, `bun-identity`) were never run by any
  target and fail on `main` before the move (20 of 25 at `b76b23fe`), so
  `src/cli.ts test` runs `src/` and `tests/gates/` and a suite's own tests
  run with the suite (P4). The workspace `AGENTS.md` and the living records
  name the new paths (`ac4c02d`). CI run `35711365754`.

## Annotations

- 2026-09-22 08:48 (user): "当前混合了python ts shell，目录结构散乱组织比较差" -- the
  diagnosis confirmed; and "为什么每个板卡目录还有meta这些？... 我们更倾向统一
  管理所有的构建，在boards里面不需要有刷机这些，这些属于文档部分，可以写文档不用
  刷机支持，除非是测试脚本" -- folded into the proposal as *The board
  directory under one management*.
