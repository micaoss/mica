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
- **The three helpers that run inside the bsp image** (`common/kernel/mklogo.py`,
  `common/kernel/export-regdb-certs.py`, `common/scripts/git-pack-manifest.py`;
  262 lines). They run in the kernel and loader builds, in the
  `mica-build-env:bsp` image, which carries python3 (the kernel's own
  scripts need it) and no bun. Three ways to make them TypeScript, none free:
  (a) `mica-build-env` adds bun to `bsp` (one `COPY --from=base` line and a
  release), after which the three become `.ts` and every kernel and U-Boot
  inputs hash moves once (the bsp pin is an input), so every board rebuilds
  in CI once and reuse by hash resumes after; (b) each kernel and loader
  Dockerfile copies bun out of the base image itself, as the pack, boot and
  lab images do now -- no build-env release, but the same one-time rebuild
  and six Dockerfiles carrying the same three lines; (c) the logo and the
  regdb certificates are generated on the host before the container build
  and handed in as inputs, and the mirror manifest is read on the host, which
  is where P3 moves the fetch anyway -- no bun in any kernel container, but
  a change to what the kernel build takes as input. Recommendation: (a),
  because the rule is "TypeScript on bun everywhere the engine runs" and the
  bsp image is ours; (c) is the shape P3 arrives at for the fetch and can
  follow for the logo without waiting. Until decided, the three stay Python,
  which is the one place `python3` remains a build input of this tree.

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
- 2026-09-22 10:12: **P1b on `main`** (`2e68cb3d`, `5bf76bee`, `5151b5af`, with the
  bootstrap fix `5a91495d`). `tests/` is `gates/` (45 host-side gates and
  lints, the python runtime tests, the sanctions ledger), `fixtures/`
  (`component-contracts`, `release-lock` with the vectors pin,
  `fleet-protocol`, `quadlet-doc`, `runtime-sonames.json`, the two lint
  registers) and `suites/` (the seven docker and QEMU suites beside
  `apid-api` and `lifecycle-uefi`); `stages/compose/` is the root's two
  Dockerfiles, `compose-install.sh`, `compose-capture.sh` and the pack
  stage's seventeen scripts; `stages/boot/` the boot-tools image's
  Dockerfiles and the seven scripts they copy in. `boot/` keeps the four
  host-side tools and `rootfs/` its driver, the package selection, the
  runtime python and `validate-public-meta.sh` until P2 and P3.
  `common/scripts` and `common/trust/stage-inner.sh` stay under `common/`
  (a deviation from the layout as proposed: they are what every board's
  Dockerfile takes from the tree, hashed into every kernel's inputs, and
  moving them would rebuild every component for a rename alone; the shell
  homes are therefore `stages/`, `common/`, `boards/` and the suites'
  guest directories). Every reader followed (the Makefile, the workflows,
  the lints' scan roots and registers, the C includes of the FIT records
  lab, the boards' evidence references, the gates' own expectations),
  and 39 moved scripts compute the repository root one level deeper.
  Measured before the push: every Makefile gate green (the list of P1a
  plus `os-boot-test`, `os-fit-records-test`, `os-rootfs-runtime-test`,
  `os-quadlet-doc-test` 35, `os-netavark-kernel-test` 121, `uboot-env-test`,
  `mirror-test` 34, the fixture tests and the boards' tests), the image
  suite 584 and the verify suite 958, the release-shaped `uefi-x64-prod`
  build, `product-verify` 106, the QEMU boot and the session probe; byte
  identity as in P1a (the signed components identical to the `b76b23fe`
  reference; `board-evidence.json` differs only by the moved evidence
  paths). P1a's CI (`35711365754`) had two reds of the container route --
  `.tmp/` absent inside the container, `tmp/` created root-owned by a
  container and refused to the runner -- fixed by the bootstrap creating
  the scratch directories as the host user first. CI run `35714638101`.
- 2026-09-22 10:20: **P1c, flashing out of the tree** (`0ade0a58`, held locally until
  P1b's CI run `35714638101` is read): `boards/cx3576/flash/` (37 files),
  the targets `flash-mica`, `flash-maskrom` and `rkdeveloptool-macos`, the
  `cx3576-flash-verify-test` and the `flash/assets` entry of the kernel
  inputs are gone; the procedure is `docs/hardware/cx3576.md`,
  `docs/user/flashing.md` (both languages) and
  `docs/boards/cx3576/rkdeveloptool/` (the two patches and the pinned
  upstream commit, `3e381a1`). The kernel inputs hash of `cx3576` moves
  with its Makefile (a declared input); the rebuilt kernel component is
  byte-identical to the merged tree's reference build in 14 of 16 files,
  and the two that differ are the shipped `mica-required.fragment` copies,
  in two comment lines only (the paths P1a renamed) -- which also means
  P1a already moved every board's kernel inputs hash through that
  fragment, so the next release builds every component again; the
  non-comment lines are identical. **Sequencing decision**: the per-board
  Makefiles and the root Makefile's `board_delegation` are replaced when
  the engine's board driver is written in TypeScript (P3, `src/boards/`),
  not now -- doing it in shell first would be a port done twice. The
  boards' host-side tests move to TypeScript in P4 as planned.
- 2026-09-22 10:54: **P2, first slice** (held with P1c until P1b's CI was read; run
  `35714638101` was green but for the spec-pins step, whose fetch of the
  OpenAPI document the P1a target had lost -- restored). Ported, byte for
  byte on their outputs: the lock reader `tools/locks.py` to
  `src/locks/locks.ts` (`bun src/cli.ts locks ...`, the same commands and
  messages; the 82 canonical vectors and the 19 commands over the real
  `locks/` identical to the Python's output; `src/image` and `src/verify`
  import its `rows()` instead of spawning python), the Debian archive
  readers `tools/deb/control-fields.py` and `tools/deb-member.py` to
  `src/pool/deb.ts` (`deb control`, `deb member`; the control text of all
  38 pool archives and the payload members compared identical; a pure
  JavaScript xz decoder, `xz-decompress` 0.2.3, is the tree's one runtime
  dependency, because every archive is xz and Bun has no decoder; the
  refusal for a directory names the tar type as `"5"` where Python said
  `b'5'`), and the version index `tools/release-index.py` to
  `src/release/index.ts` (`release-index lock|json`; the release test's
  65 checks including the index dry-runs and the mirror rule pass through
  it). Shell callers invoke the commands through `bin/bun.sh`; the
  bootstrap installs the dependencies when no `node_modules` is found in
  the tree or above it and keeps the installer off stdout, because a
  caller captures stdout as the answer (that pollution and a `process.exit`
  after an unawaited `stdout.write` -- 131072 of 2.6 million bytes -- were
  the two defects the parity checks caught). `BUILD_FILES` names
  `src/locks/locks.ts` in place of the Python. Every Makefile gate and
  lint green on the slice; the bun suites and the release-shaped product
  build are the last checks before the push. Still Python: the runtime
  selection (`rootfs/runtime/*.py`, 1.5k, and its 2.2k of tests), the
  QEMU helpers of the lifecycle suite, `boot/elf-closure.py` (a boot-tools
  stage), `common/kernel/{mklogo,export-regdb-certs}.py` and
  `common/scripts/git-pack-manifest.py` (run inside the bsp image),
  `tests/gates/evidence-schema.py`, `tests/gates/mirror-hook-server.py`,
  `tests/suites/{lifecycle-uboot-fit/image.py,repart/measure.py}`, and
  the four under `boards/cx3576`.
- 2026-09-22 12:13: **P2, second slice: the runtime composition** (`9bb86d01`;
  30 files, +4,437/-3,834). `rootfs/runtime/{select,compose,source-lineage}.py`
  are `src/rootfs/runtime/{select,compose,lineage}.ts`, rule for rule and
  message for message, over `fsx.ts` (extended attributes, `lchown` and
  nanosecond `utimensat` through `bun:ffi`, the three facts Node's `fs`
  does not expose; Node errno errors rendered as Python's `OSError` text,
  which the refusals and their tests read), `pyjson.ts` (the bytes
  Python's `json` module writes -- sorted keys, `\uXXXX`, integers exact as
  bigint -- verified byte-identical) and `elf.ts`. The lineage record's
  reader stays in the runtime directory, which is all the pack stage
  mounts (nothing there imports outside it, so no `node_modules` enters
  the container); its writer, which reads the pool archives through
  `src/pool/deb.ts` and the checkout through git, is `src/rootfs/lineage.ts`
  (`bun src/cli.ts lineage`, called by `rootfs/build.sh`). The pack stage
  runs `bun` copied out of the pinned build-env base image (a fourth
  stage, `bun-source`; `MICA_IMAGE_BUILD_BASE` resolved by
  `tools/from.sh` beside the trixie image; bun links only glibc) and
  `python3` leaves `pack-tools`. Parity, measured: a release-shaped
  `uefi-x64-prod` build against the reference `_out/ref-prod-b76b23fe`
  (built by the Python at `b76b23fe`) -- root, kernel, firmware,
  deployments, updates and lifecycle components byte-identical, the drops
  table identical, the runtime report the same 6,697,986 bytes with 34
  differing lines, all of them the installation timestamps of the
  `configured` capture, the source commits and the hashes of the inputs
  that legitimately changed (`pack-tools.tsv` without python3, the moved
  stage scripts); `image/data.img` and the `kinds` image keep the known
  40-byte timestamp gap. The source lineage record over the real amd64
  pool: byte-identical to the Python's (12,006 bytes). The 2.2k lines of
  Python tests are `tests/suites/rootfs-runtime/` (89 + 46 + 14 = 149
  cases, one per Python case, the same fixture: real ELF files, device
  nodes over `mknod`, foreign owners, `security.capability`), run by
  `make os-rootfs-runtime-test` through `bin/bun.sh` -- as root, which the
  container route is, so CI drops its `sudo`; verified through that route
  (`MICA_BUN_CONTAINER=1`, 149 pass: `mknod` and `setxattr` work under
  docker's default capabilities). `release-manifest.test.ts` builds its
  runtime fixture through the same `Composition` class instead of an
  embedded Python program (74 pass). One fidelity gap the port surfaced:
  the Python tests read `No such file or directory` out of an `OSError`,
  which is why `fsx.ts` renders errno errors Python's way rather than the
  tests being loosened. Also in the commit: the three reds of CI run
  `35722671849` on `2a9a9180` (products, suites, boards) were one defect,
  `tools/podman-pool.sh` handing `bin/bun.sh` an output path under
  `/tmp`, which the container route writes inside the container and
  loses; its work directory is under `_out/` now (the rule: a path handed
  to the bootstrap is inside the tree). Green on the slice: the runtime
  suites, `src/image` and `src/verify` (958), the stages test (the
  target list gains `bun-source`), the board-name, host-toolchain and
  pipefail lints with their negative tests, `os-netavark-kernel-test`,
  `bun run lint`/`typecheck`. Still Python: the QEMU helpers of the
  lifecycle suite, `boot/elf-closure.py`, `common/kernel/{mklogo,
  export-regdb-certs}.py`, `common/scripts/git-pack-manifest.py`,
  `tests/gates/evidence-schema.py`, `tests/gates/mirror-hook-server.py`,
  `tests/suites/{lifecycle-uboot-fit/image.py,repart/measure.py}`, and
  the four under `boards/cx3576`.
- 2026-09-22 12:44: **P2, third slice: the host-side Python** (`5c770a23`; 44
  files, +1,013/-906). Ported, each with its measurement: `stages/boot/elf-closure.py`
  to `elf-closure.ts` (readelf-based as before; the boot tools image copies
  `bun` out of the build-env base image, `MICA_IMAGE_BUILD_BASE` through
  `tools/from.sh`, a `bun` row in the `mica.boot.inputs` label; a
  release-shaped `uefi-x64-prod` build: the two initramfs trees identical
  member for member but for `etc/mica/boot.json`, the closure's `/init`
  byte-identical, root, firmware and lifecycle components identical; the
  kernel `buildId` moves with its packager's inputs by design and takes the
  deployments and update archives with it; `product-verify` 106 checks,
  `os-boot-test` green on both boot-tools images); `tests/gates/evidence-schema.py`
  to `src/boards/evidence-schema.ts` (`bun src/cli.ts evidence-schema`; the
  same output as the Python over the four boards' `evidence.json` and eight
  mutations of one; `board-contract-test.sh` calls it); the mirror-hook gate
  and its Python server to `tests/gates/mirror-hook.test.ts` (the mirror is
  the test process, `Bun.serve` with the `/r/` redirect; the fetches run
  asynchronously, since a blocking spawn never lets the in-process mirror
  answer -- the first run showed every fetch timing out; 19 cases, green on
  both routes of `bin/bun.sh`); the lifecycle suite's `qmp-boot.py`,
  `timed-boot.py`, `metrics.py` to `.ts` (the lab image
  `tests/suites/signed-boot-lab/Dockerfile.lab` copies `bun` out of the base
  image, which retires `Dockerfile.maintenance` and the firmware lab image;
  the recorder runs the boot command under `setsid` so a timeout kills the
  QEMU group; exercised in the lab image against a fake QEMU: events
  recorded, exit status through, refusal without a server, group killed;
  `metrics.ts` byte-identical to the Python over a fixture log;
  `storage-metrics.py`, which nothing ran, deleted); `tests/suites/repart/measure.py`
  to `measure.ts` (byte-identical record over the product image, the same
  refusal when DATA did not grow); `lifecycle-uboot-fit/image.py` to
  `image.ts` (ported check for check, run against nothing: no cx3576
  medium on this host); the three `boards/cx3576/kernel/tests/*.py` to
  `.ts`, now under the package's lint and typecheck (`eslint.config.js`
  un-ignores `boards/*/kernel/tests/`; `resource-dt-test.ts` prints the
  same four lines as the Python over the dev DTB in the lab image; the
  other two need a kernel source tree that is not here). Two seam defects
  the slice measured and repaired in `bin/bun.sh`: (1) in P2's second
  slice, an output path under `/tmp` (`tools/podman-pool.sh`, `9bb86d01`);
  (2) here, the environment: `CI`, `GITHUB_ACTIONS` and `MICA_*` did not
  cross into the container, so the locks reader's CI mode was invisible
  there and the offline-pin refusal never fired (CI run `35725871542`,
  `os-pool-test` 2/23); the bootstrap forwards them now, 23/23 on both
  routes. Also this slice: `mica`'s world gate went red when `verify/src`
  became `src/verify` (the claim of absence for the deleted kernel-config
  check could not be made from a directory that no longer answered;
  `0f85934`), and a research page another session keeps untracked had been
  swept into `ac4c02d` and is untracked again (`83b652c`). Still Python in
  `mica-build`: `common/kernel/{mklogo,export-regdb-certs}.py` and
  `common/scripts/git-pack-manifest.py`, which run inside the bsp image,
  where there is no bun -- see *Open questions*; and the inline `python3 -`
  heredocs of the shell gates and suite scripts, which go with those files
  in P4. Two scripts nothing runs, noted rather than deleted:
  `tests/gates/boot-startup-pack-fixture.sh` and `tests/suites/repart/inner.sh`
  (the `measure.ts` caller) have no caller in the tree.
- 2026-09-22 13:23: **P2, third slice: what CI measured** (`3fa4e389`). Run
  `35728952530` on `5c770a23` went red in two places the host could not
  show. (1) Every arm64 `release-products` job: the packager image is
  x86-64 by design and runs under emulation on an arm64 runner
  (`src/image/kernel-package.ts` names the platform), and bun 1.4.2 aborted
  there the moment `initramfs.sh` ran `elf-closure.ts` (`panic(main
  thread): abort() called`, qemu's uncaught signal 6), while the same file
  had packed every amd64 product. A JIT runtime does not survive that
  emulation; the Python ran there because the interpreter has none. The
  closure is `stages/boot/elf-closure.sh` now, bash by the rule's own
  exception for a container where bun is not the toolchain (decision
  `2026-09-22-mica-build-one-language.md`), ported rule for rule from the
  Python: the closure of `/usr/bin/ls` on this host is the same six files at
  the same modes as the Python's, and the two refusals name what the Python
  named. bun leaves the boot tools image, whose `mica.boot.inputs` label goes
  back to its four rows; both images rebuilt, `os-boot-test` green. The
  13:40 entry's `elf-closure.ts` is superseded by this one. (2) `suites`,
  `os-release-test` 61/65: `bin/bun.sh` announced its route on stderr on
  every invocation, and `tests/gates/release-test.sh` compares a plan's
  combined output against the expected rows -- it saw the announcement. The
  bootstrap's header promises a caller cannot tell which route it got; the
  announcement goes to a terminal only now, and the release test is 65/65
  through the container route. Both are the same lesson as the two seam
  defects before them: the container route is measured only where it runs.
- 2026-09-22 14:01: **P2, third slice: the last red** (`8d565d39`). Run
  `35733135324` on `3fa4e389`: every product and release job green, the
  149 runtime cases green in CI, and one red left, `tests/gates/rootfs-reproducibility-test.sh`'s
  two pack-surgery cases. The gate rewrites `/rootfs`, `/runtime` and `/out`
  in the pack scripts to fixture paths with one substitution per line, so a
  line naming `/rootfs` twice kept its second one, and `mkdir -p
  /rootfs/var/lib/dbus /rootfs/var/lib/systemd` created `/rootfs/var/lib/systemd`
  on the host of every run. Under `sudo`, where the gate ran until
  `5c770a23`, that succeeded and the gate passed; as the runner user it was
  refused. A global substitution alone would have rewritten
  `/rootfs-report.txt` too, so the match is bounded by what follows (a
  slash, whitespace, the end of the line). Reproduced as uid 1001 in the
  pinned Ubuntu image before the fix, green after, green as root; this
  host's `/rootfs` and `/out` from earlier runs are removed. The privilege
  the old runner granted had hidden a gate that wrote outside its fixture
  since it was written.
- 2026-09-22 14:39: **P2, fourth slice: the bsp-image helpers** (`89fd5403`).
  The user's answer to the open question (15:30): the base image's bun
  computes the resources and the BSP build consumes them; the bsp image
  stays as it is, no build-env release. `common/kernel/mklogo.py` is
  `mklogo.ts`, run in a `logo` stage on `MICA_IMAGE_BUILD_BASE` in each of
  the four kernel Dockerfiles, and the BSP stage copies the PPM into the
  source tree (the uefi boards directly, the two BSP boards through their
  prepare hook's new fourth argument). Measured: the render byte-identical
  to the Python's over the committed master (2,115,709 bytes, only the
  generator's name in the PPM comment differs, which pnmtologo ignores),
  0.2 s against 1.6 s; the uefi-x64 kernel rebuilt through the new stage
  byte-identical in every output file to the build before it.
  `common/kernel/export-regdb-certs.py` is `export-regdb-certs.ts`, run in
  a `regdb` stage on the base image over what the first profile's build
  stages at `/regdb-inputs` (`.config`, `net/wireless/certs`, the Image),
  an `out` stage copying the PEM beside every profile; byte-identical to
  the Python over a synthetic kernel tree, the same refusal when a
  certificate is absent from the Image; its end-to-end run is CI's cx3576
  and s905x5m kernel builds. Every board's kernel inputs hash moves once
  for the Dockerfile change; CI rebuilds every board, reuse by hash resumes
  after. Still Python in `mica-build`: `common/scripts/git-pack-manifest.py`
  (in the bsp fetch step, until P3 moves the fetch to the host, as the user
  chose) and the inline heredocs of the shell gates (P4). python3 stays in
  the bsp image for the kernel's own scripts, which is not this tree's
  Python. The open question is closed by this answer.
- 2026-09-22 15:03: **P3, first slice: `from`, `upstream`, `source`** (`9f94575d`;
  87 files, +373/-295), after three CI-measured repairs on the way:
  `64509ba1` (the host-toolchain lint takes `// mica-build-side: container
  -- <why>` in a TypeScript file's leading comment, since P2 made `.ts`
  files container scripts; run `35741753681` had flagged
  `export-regdb-certs.ts` for its `openssl`), `801b220f` (the lint's
  declared-file counting, pushed before its fix the first time; and a stray
  line the fourth slice's edit had left at the top of the two BSP kernel
  Dockerfiles, which docker refused as an instruction) -- and `801b220f`
  also carried the deletions of `tools/from.sh`, `upstream.sh` and
  `source.sh` ahead of their callers, because a staged `git rm` rides along
  with a path-limited commit; main's pool jobs read "tools/from.sh: No such
  file or directory" for the twenty minutes until `9f94575d`. The slice:
  `src/locks/{from,upstream,source}.ts` (`bun src/cli.ts from|upstream|source`),
  message for message -- the 39 image rows resolve to the same references,
  `--check`, the `--build-arg` pairs and every refusal read the same but for
  the prefix, the 12 upstream rows answer the same fields, the
  mica-system-base checkout is the same commit; `from.ts` reads `locks/`
  once where the shell spawned `locks image` per selector.
  `src/image/images.ts` and `src/verify/tools.ts` import the resolver
  instead of spawning the script, so the two subprocess guards (absent
  script, empty answer), their tests and the `FROM_SH` anchor of `paths.ts`
  are gone; seventy call sites across the Makefiles, workflows, `tools/`,
  `boot/`, `rootfs/`, `common/trust`, the gates and the suites go through
  `bin/bun.sh`; `BUILD_FILES` hashes `src/locks/from.ts` and `upstream.ts`
  in the scripts' place (the inputs-hash move the plan expected at the
  phase end, taken now because the deleted files could not stay in the
  list). Green: `from --check`, the amd64 pool fetch, the three lints,
  board-contract-test, os-pool-test, os-boot-test, the images, paths,
  verity-signing, verify tools, release-manifest and stages suites. Next in
  the order: `oci`, `local-pins`, then `pool` and `deb/*`.
- 2026-09-22 15:17: **P3, second slice: `oci`, `local-pins`** (`1c2387b9`; 15
  files, +317/-243). `tools/oci.sh` is `src/pool/oci.ts`, message for
  message: over the real mica-core amd64 pool the manifest lands at the
  same cache path with the same bytes, the first layer's blob is
  byte-identical (4,128,140 bytes), the second read is the cache, the six
  refusals read the same but for the prefix. The transport stays the curl
  on PATH or the one `MICA_CURL` names -- `tests/gates/pool-test.sh`
  answers the registry with a curl of its own, which now lives under the
  tree and is handed over as `MICA_CURL` rather than through `PATH`, since
  the container never inherits a host `PATH` and the gate would have gone
  to the real ghcr.io in CI; 23/23 on both routes. The reader that goes
  through `fetch` arrives with that gate's port to bun (P4), where the
  registry is the test process. `tools/local-pins.sh`, embedded Python
  included, is `src/pool/local-pins.ts`, the archives' control fields read
  by `src/pool/deb.ts` on the host where the shell ran `dpkg-deb` in the
  base image: over a fixture checkout with an indexed pool of three
  archives, two of them the repository's, the shell and the TypeScript
  write the same eight-file offline layout and install the same lock and
  pin, and their refusals read the same. `bin/bun.sh` passes
  `MICA_BUN_ROUTE=container` and mounts every offline pin's `CHECKOUT`
  read-only at its own path, so an offline pool is readable on that route;
  `local-pins`, which writes outside the tree, refuses that route by name.
  Next in the order: `pool` and `deb/*`, whose gate (`pool-test.sh`,
  `package-gate`, `version-guard`) goes with them.
- 2026-09-22 15:47: **P3, third slice: `pool`; the bootstrap runs as the
  user** (`2b0285d2`, 31 files, +738/-674; `08e26e1d`). `tools/pool.sh` is
  `src/pool/pool.ts` (`bun src/cli.ts pool rows|own|fetch|index`): over the
  tree's locks `rows` and `own` print the same bytes as the shell; over the
  real amd64 pool `fetch` verifies the same twelve archives and `index` the
  same `Packages` and `SHA256SUMS`, and `manifest.txt` differs in the
  comment line naming its writer. The index still runs `dpkg-scanpackages`
  in the base image, as `stages/pool/index.sh`, the shell's inline block
  in a file with its container marker. `src/pool/oci.ts` fetches instead
  of spawning curl, from `https://ghcr.io` or the registry
  `MICA_OCI_REGISTRY` names, the real pool's manifests and blobs
  byte-identical either way; `tests/gates/pool-test.sh` is
  `tests/gates/pool.test.ts`, case for case, and the registry is the test
  process, so the `MICA_CURL` hand-over of the second slice is gone after
  one day; 23/23 on both routes. `src/pool/local-pins.ts` and
  `src/image/release-manifest.ts` read the rows in-process; every other
  caller reaches the pool through the bootstrap. A `Refused` now carries
  its whole message (`locks: refused <rule>: <detail>`), which every
  TypeScript entry had printed as the bare rule since the first slice.
  Green: lint, typecheck, the three lints, the pool gate on both routes,
  os-rootfs-manifest-test 48/48, the runtime suites 149, os-build-test
  578, os-offline-chain-test 18/18. What CI measured on `1c2387b9` (run
  35746126641, 27 green, `boards` and `suites` red, the rest cancelled):
  the container created `_out/cache/oci` as root, and the host's `mkdir
  _out/cache/pool` and the pool gate's `mv` beside it were refused --
  pre-creating the top-level scratch directories (`3fa4e389`) had covered
  one level, and the class is not a list of directories. `bin/bun.sh` runs
  the container as the calling uid and gid, with the docker socket's group
  and `HOME` under the tree (`.tmp/home`); reproduced and measured as uid
  1001 on a fresh checkout outside any `node_modules/` parent: the pool,
  the cache, `node_modules` and `HOME` are the user's, the host's `mkdir`
  beside them succeeds, the pool gate passes on that route as that user.
  Record correction in this entry's commit: the seven entries of this day
  from 12:13 on had been stamped ahead of the clock (up to three hours,
  the last at 18:30 while the clock read 15:17); each now carries the UTC
  time of the `mica` commit that added it. Next in the order: `deb/*`
  (`build`, `pack`, `package-gate`, `preflight`, `producers`, `publish`,
  `registry`, `version-guard`, `package-inputs`), then the boards group.
- 2026-09-22 16:15: **P3, fourth slice: `producers`, `package-inputs`,
  `pool-build`, `pool-preflight`; the bootstrap's ownership epilogue**
  (`afb1f095`; `b4bfcd4a`, 30 files, +733/-1004). What CI measured on
  `08e26e1d` first (run 35749459944, `suites` red, 79 of the build suite's
  tests): a container running AS the host user cannot `lchown` in a fixture
  root nor overwrite what a sibling container wrote as root under `.tmp/`,
  so the user mapping was right for the one symptom and wrong for the
  class. `bin/bun.sh` runs its container as root again and, when the
  command ends, hands every root-owned entry under `.tmp tmp _out .work
  node_modules` to the calling uid and gid (`chown -R --from=0`, so a
  sibling's output is handed over too; `exec bun` for root, as before).
  Measured as uid 1001 on a fresh checkout: the pool fetch, the host's
  `mkdir` beside its cache, the 46 composition fixture tests and the verity
  signing tests pass on the container route and nothing is root's after.
  Then the first half of `deb/*`: `tools/deb/producers.sh` is
  `src/pool/producers.ts` (`bun src/cli.ts producers`), the rows and every
  `--dir-for`, `--instance-for`, `--control-for` and `--version-for`
  answer byte-identical, `producer.env` and the instance files read rather
  than sourced (plain `KEY=value`, `${NAME}` over the instance's and earlier
  keys as bash under `set -u` left them, a substitution or an unset name
  refused); `tools/deb/package-inputs.sh` is `src/pool/package-inputs.ts`,
  the eight producers' manifests identical but for the three tool rows,
  which now name `src/pool/build.ts`, `stages/pool/pack.sh` and
  `src/pool/producers.ts` -- the one move of this hash the plan's Risks
  allow, and free today, since no release of this repository has published
  a pool (the version guard on every CI run: "has no published release
  carrying its pool; every archive is built"); `tools/deb/build.sh` is
  `src/pool/build.ts` (`pool-build`), the radio-wifi archives in both pools
  and the uefi-x64 board archive byte-identical to the shell's builds, the
  packer shell as `stages/pool/pack.sh` (it runs inside the base image);
  `tools/deb/preflight.sh` is `src/pool/preflight.ts` (`pool-preflight`),
  every board's and producer's report byte-identical. The package gate
  (still shell) rebuilds through `pool-build`, which on the container route
  found the host's buildx builder invisible inside (`docker buildx inspect`
  naming no driver): the bootstrap mounts the docker client's configuration
  directory at its own path and forwards `BUILDX_BUILDER` and
  `BUILDKIT_PROGRESS`, and the gate passes 32/32 with its rebuild on both
  routes. Green: lint, typecheck, the three lints, board-contract-test
  44/44, os-rootfs-manifest-test 48/48, the runtime suites 149,
  os-build-test 578, `make board-pool POOL_BOARD=uefi-x64` (same bytes),
  version-guard-test 16/16 and publish-test 21/21 against a local
  registry. Next: `package-gate` (`src/pool/gate.ts`, the archives read on
  the host by `src/pool/deb.ts` where the shell ran `dpkg-deb` in the base
  image), then `registry`/`oci`/`publish`/`version-guard` with their two
  gates as bun tests.
- 2026-09-23 11:12: **P3, fifth slice: the package gate, the publishers, the
  version guard; three gates as bun tests** (`5e3beb80`, `69d4a07d`,
  `1b43a904`, `7490bf76`). `tools/deb/package-gate.sh` is `src/pool/gate.ts`
  (`bun src/cli.ts pool-gate`), check for check: over both pools the static
  gate passes the same 111/111 with the same RESULT line as the shell, and
  with its rebuild for amd64 the same 32/32, byte-identical rebuild included,
  on both routes; the archives are read on the host by `src/pool/deb.ts`,
  which now lists a payload where the shell ran `dpkg-deb --contents` in the
  base image, and the maintainer scripts are parsed by this host's `sh`. The
  shell staged an always-empty lock for a pool this tree imports nothing
  into; those branches are not carried. `tests/gates/package-gate.test.ts`
  drives the static half over synthetic producers and dpkg-deb fixture
  archives, seventeen cases, every refusal by name; its `dpkg-deb` launch
  site is a registered host-toolchain exemption (`1b43a904`, after CI run
  35755559026 refused it: the lint scans tracked files, and the file was
  untracked when the lint ran locally -- a gate over the index runs after
  the add). `tools/deb/publish.sh` and `tools/deb/version-guard.sh` are
  `src/pool/publish.ts` (`pool-publish`) and `src/pool/version-guard.ts`
  (`version-guard`) over `src/pool/registry.ts`: the registry declaration,
  the token, the release a checkout is, the latest published lock carrying a
  row, and an OCI client that reads and pushes with fetch -- the manifest it
  writes is byte-identical to the one jq wrote, so an unchanged pool keeps
  its digest across the port; the Debian version order agrees with the
  shell's embedded Python over seventeen pairs. `tools/deb/registry.sh` and
  `oci.sh` stay for `tools/reuse.sh` and `tools/publish-components.sh` until
  those are ported. `tests/gates/{version-guard,publish}-test.sh` are bun
  tests over a sibling `registry:3.1.1` and a scratch clone
  (`tests/gates/release-fixture.ts`), 8/8 and 5/5 on both routes.
  `tests/gates/board-bundle-test.sh`, a reader of the curl the OCI reader
  no longer runs -- missed in the second slice and measured red by CI run
  35756001658 (7 of 23) -- is `tests/gates/board-bundle.test.ts`, the
  registry the test process, handed to `src/pool/oci.ts` as
  `MICA_OCI_REGISTRY` and to the shell client `tools/reuse.sh` sources
  through a `registry.env` over plain HTTP; 6 cases, both routes. The
  bootstrap: CI run 35752739496 measured the product jobs' own `docker
  buildx` refused by a root-owned `~/.docker/buildx/activity` after a build
  inside the container (the directory is mounted since the fourth slice);
  the epilogue hands that directory back too (`69d4a07d`), measured as uid
  1001. Green: lint, typecheck, the four lints, os-release-test 65/65 over
  the committed tree (its clone keeps a deleted file until the deletion is
  committed). Next: the boards group (`board-pool`, `inputs`, `reuse`,
  `boards`), which takes `registry.sh` and `oci.sh` with it.

## Annotations

- 2026-09-22 08:48 (user): "当前混合了python ts shell，目录结构散乱组织比较差" -- the
  diagnosis confirmed; and "为什么每个板卡目录还有meta这些？... 我们更倾向统一
  管理所有的构建，在boards里面不需要有刷机这些，这些属于文档部分，可以写文档不用
  刷机支持，除非是测试脚本" -- folded into the proposal as *The board
  directory under one management*.
