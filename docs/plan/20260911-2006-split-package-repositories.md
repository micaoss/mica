# 20260911-2006-split-package-repositories Split the tree into an assembly repository and independently released package repositories

- **status**: completed
- **createdAt**: 2026-09-11 20:06
- **revisedAt**: 2026-09-12 21:30
- **completedAt**: 2026-09-13 15:40
- **approvedAt**: 2026-09-12 21:00
- **relatedTask**: 20260911-2003-split-package-repositories

## Context

### What the tree is today (`7742a596`)

One repository holds both halves. The **software** is under `pkgs/`: the
`micad` Cargo workspace (micad, apid with its React UI, mqttd, broker,
mqtt-reference, busname, micad-settings, ui-bundle; 354 tracked files), the
`mica-deploy` workspace (`mica-deploy`, the static `mica-init` and
`mica-shutdown`, `lifecycle-sys`; 47 files) and the `podman` source build (six
pinned upstreams, four toolchains, about 45 minutes of emulated arm64
compile; 15 files). The **assembly** is everything else: `boards/`,
`rootfs/`, `build/`, `verify/`, `tests/`, `build-env/`, `update-server/`,
`docs/`. `pkgs/mica-boot` (UKI/FIT, initramfs, verity tool, dev keys, the
boot-tools image; 17 files) is assembly tooling that lives under `pkgs/`; it
does not move.

Every shipped userspace binary reaches an image as a Debian archive. A
**producer** is a directory holding `Dockerfile` + `producer.env`; fifteen
are discovered by `build-env/deb/producers.sh` (`pkgs/micad/deb/{micad,mqtt}`,
`pkgs/mica-deploy/deb/deploy`, `pkgs/podman/deb/podman`, six under
`rootfs/packages-src/`, five under `boards/*/deb/`). `build-env/deb/build.sh`
runs a producer's `PREPARE` hook on the host and packs at the target
architecture in `localhost/mica-build-deb`; `make os-debs` fills
`_out/debs/<arch>/pool/` and `repo.sh` writes `Packages`, `SHA256SUMS` and
`manifest.txt` beside it. The composer (`rootfs/build.sh`) installs from that
pool in one APT transaction and never compiles.

One shipped thing is not an archive: the kernel component takes `mica-init`
and `mica-shutdown` as static PIE files that
`pkgs/mica-deploy/hack/build-deb.sh --producer boot --stage <dir>` compiles
into a stage directory; `build/src/kernel-package.ts` checks their ELF shape
(`kernelExecutables()`) and seals their digests into the signed kernel
identity.

### The bindings the split has to replace

Six rules bind the pool to *this* commit; each is exactly what stops a
package built elsewhere from being accepted.

1. **One stamp across the pool.** `build-env/deb/version.sh` reads the micad
   crate version and appends `+git<commit>[.dirty]-1` to every producer's
   output; `tests/deb-package-gate.sh` asserts one stamp over the pool and
   `rootfs/build.sh` ("stale, sense 3") refuses a pool at another stamp.
2. **The micad build record.** `pkgs/micad/hack/build-deb.sh` writes
   `_out/micad-build-<arch>.txt`; the composer copies it beside the image and
   `verify/src/smoke.ts` compares the commit the binary reports with it.
3. **Version pins read from source.** `verify/src/smoke-pins.ts`,
   `tests/install-closure-gate.sh` and `tests/netavark-kernel-config-test.sh`
   read `pkgs/podman/versions.env` and the crate manifests.
4. **The fixed producer join.** `rootfs/runtime/source-lineage.py` and
   `build/src/release-manifest.ts` carry hard-coded constants (`JOIN_*`,
   `STARTUP_*`, `GPT_*`, `BOOT_ROLE_SHA`: commits, trees, epochs, pool and
   receipt digests, per-file blob ids) describing one reviewed reuse of a
   pool built at an earlier commit, entered through `MICA_ROOTFS_PRODUCER_JOIN`,
   `MICA_ROOTFS_PACKAGE_SOURCE` and `MICA_ROOTFS_PACKAGE_RECEIPT`. The file
   calls itself "one reviewed producer transition, not a caller-extensible
   reuse policy": it is this plan's problem solved once by hand, and a second
   reuse means editing two constant tables and their tests.
5. **Native lifecycle digests.** The same constants pin the bytes and sha256
   of `mica-init` and `mica-shutdown`, so the kernel component is bound to one
   compile of `pkgs/mica-deploy`.
6. **The boot-tools witness.** The lineage record carries the immutable
   manifest of the `ai-agent/mica-boot-tools-*` image, compared with
   `LOCAL_BOOT_TOOLS_X64` in `build-env/images.env`. Boot tools stay in the
   assembly; this binding survives unchanged.

### Coupling inventory

Assembly files reaching into `pkgs/` (tracked, non-docs): 100. The ones that
execute or read package source rather than cite it in a comment:

| Site | What it needs from `pkgs/` |
|---|---|
| `Makefile` | `os-rust-gate`, `os-dbus-policy-test`, `podman`, `podman-pins`, `os-apid-api-test`, `os-apid-api-spec-pins`, `os-apid-ui-build-contract-test`, `os-file-transaction-faults` run scripts under `pkgs/` |
| `tests/rust-gate.sh` | `pkgs/{micad,mica-deploy}/hack/check.sh` in `mica-build-rust-check` |
| `tests/{deb-preflight-test,podman-pins-test,quadlet-doc-test,netavark-kernel-config-test}.sh` | `pkgs/podman/{versions.env,versions-stamp.sh,check-pins.sh,out-arm64/quadlet,deb/podman/prepare.sh}` |
| `tests/apid-ui-build-contract-test.sh` | `pkgs/micad/apid/{ui/build.sh,ui/run.sh,build.rs}` and the `hack/` scripts |
| `tests/file-ab-faults/run.sh`, `tests/file-ab-x64/early-hang-init.sh`, `tests/boot-shutdown-test.sh` | compile `pkgs/mica-deploy` source |
| `tests/p1-writable-path-audit/boot.sh`, `tests/file-ab-x64/api-launcher-docker.ts`, `tests/shell-pipefail-lint.sh` | `pkgs/micad/tests/apid-api` |
| `tests/component-contracts/*.json` | golden fixtures `include_str!`'d by mica-deploy tests and read by `build/src/*.test.ts`, `update-server/src/*` |
| `build/src/kernel-package.ts` | the staged `mica-init` and `mica-shutdown` |
| `verify/src/{smoke,smoke-pins,smoke-register}.ts` | the pins above and the micad build record |
| `rootfs/build.sh`, `rootfs/runtime/source-lineage.py`, `build/src/release-manifest.ts` (+ tests) | bindings 1, 2, 4 to 6; `producers.sh` for the composition record |
| `build-env/deb/version.sh` | the micad crate manifests |
| `.github/workflows/check.yml`, `.gitattributes` | the `rust` job, UI and spec-pin steps; two `linguist-generated` rows |

`pkgs/` reaching into the assembly:

| Site | What it needs |
|---|---|
| every `pkgs/*/hack/*.sh`, `pkgs/podman/build.sh`, `pkgs/micad/apid/ui/build.sh` | `build-env/from.sh` + `build-env/images.env`; each derives `REPO_ROOT` three levels up |
| `pkgs/podman/deb/podman/producer.env` | `BUILD_CONTEXTS="overlay=rootfs/overlay"` for `containers.conf` and `etc-containers-systemd.mount` |
| `pkgs/micad/tests/apid-api/run.sh` | `boards/<board>/board.env`, `_out/<board>/`, `verify/Dockerfile` |
| `pkgs/micad/deb/*/control/*`, `pkgs/podman/deb/podman/control` | `Depends: mica-system (= @VERSION@)` / `(= @SYSTEM_VERSION@)` |

Exact-version pins across the future boundary (`micad`, `mica-apid`,
`mica-podman` on `mica-system`) cannot hold once versions are per repository;
pins within one repository stay exact.

### Forge and tooling facts (probed 2026-09-12)

- `origin` is the GitHub repository `mica` since 2026-09-12 23:25; the
  internal Gitea remote (`mica-build` on `git.ds.cc`,
  Gitea `1.26.1`, organisation renamed from `miehq` and repository from
  its former project name earlier that day) is kept as the `gitea` remote for the registry.
  On GitHub the organisation holds `mica` (existing, empty) and the
  six package repositories created empty and private on 2026-09-12; on
  Gitea the four repositories created earlier that day (`mica-build-env`,
  `micad`, `mica-deploy`, `mica-podman`) are superseded.
- The Debian registry is enabled and round-tripped on 2026-09-12 with a
  throwaway archive: `PUT .../pool/mica/<component>/upload` answers 201 (409
  for a duplicate name), the download is byte-identical and answers 401
  without a token, the component's `Packages` index carries the custom
  `Mica-Source-*` control fields, and
  `DELETE .../pool/mica/<component>/<name>/<version>/<arch>` answers 204.
  `GITEA_DS_URL` and `GITEA_DS_TOKEN` are exported on this development machine
  (API user `roy`).
- **No Actions runner is registered** for the organisation, for `mica-build`
  or for the new repositories (the runner lists are empty and every recent
  `check.yml` run on `mica-build` is `cancelled` or `queued`). Until one is,
  nothing publishes from CI: archives are published from a developer machine
  with `publish.sh`, which the provenance fields make visible, and the
  repository gates run locally. The runner is a prerequisite for Phase 2's
  "CI green", not for Phase 1.
- `git subtree split` is available (per-directory history survives);
  `git-filter-repo` is not.
- `tools/docs/verify-links.sh` checks relative links only; the one relative link
  into `pkgs/` (`docs/README.md` to `../pkgs/micad/apid/openapi.json`) will
  break, prose citations will not.

## Proposal

### Target repository set

One repository per package, named for Mica OS (the project's current
name), under one organisation on **GitHub** (decided 2026-09-12
23:20, superseding `git.ds.cc` as the source host, which stays as a
mirror): **`mica` is the project management and documentation repository**
(this record lives there; decided 2026-09-13 04:10), **`mica-build` the
image assembly**, the daemon repository `micad`, the others `mica-`
prefixed. Locally every repository is its own checkout under
`<workspace>/<repository>/`, so the hierarchy on disk is the
organisation's. Package, binary, unit, bus and path names
inside the archives are renamed to Mica OS by the phase that moves them
(section 12); the split and the rename are one operation per repository,
decided and confirmed 2026-09-12.

Archives travel as GitHub Release assets (section 1, decided 2026-09-13);
the Gitea instance keeps a mirror of every repository (`gitea` remote,
pushed in step with `origin`) and nothing else. The `mica-build` rows the
Phase 1 proof locked from the Gitea registry are replaced by rows from the
`mica` release at the next `os-lock-bump`.

| Repository | Content | Publishes |
|---|---|---|
| `mica` | `docs/` (the PMA records of every repository, the design, board, user and research documents, the changelog) and the documentation gates `tools/docs/`; records cite code as `<repository>:<path>` | nothing; `make docs-verify` is its gate |
| `mica-build` (the assembly, formerly this tree) | `boards/`, `rootfs/` less `debian/` and `packages-src/`, `build/`, `verify/`, `tests/`, `pkgs/mica-boot/`, `update-server/`, `boards/*/deb/`, `deps/` (the pins), `build/release-verify.md` and `tests/quadlet-doc/containers.md` (the two documents code executes, kept as executed copies) | factory images, update archives, release directories |
| `mica-build-env` | today's `build-env/` unchanged in layout, plus `tests/deb-package-gate.sh` and the new `fetch.sh`, `lock.sh`, `publish.sh`, `source.sh` | consumed as a git submodule at `build-env/` by every other repository |
| `micad` | `pkgs/micad/*` incl. `deb/`, `hack/`, `tests/` (dbus policy, apid-api harness), `apid/ui` | `micad`, `mica-apid`, `mica-mqttd`, `mica-mqtt-broker` |
| `mica-deploy` | `pkgs/mica-deploy/*`, `tests/file-ab-faults/`, `tests/component-contracts/`, `tests/boot-shutdown-test.sh` | `mica-deploy`, and a new `mica-lifecycle` archive carrying the static `mica-init` and `mica-shutdown` per architecture |
| `mica-podman` | `pkgs/podman/*`, `rootfs/overlay/etc/containers/containers.conf`, `rootfs/overlay/etc/systemd/system/etc-containers-systemd.mount`, `tests/podman-pins-test.sh` | `mica-podman` |
| `mica-debian` | today's `rootfs/debian/` unchanged in layout (the 179 pinned upstream records, `sources.env`, `run.sh`, `docker.sh`, `fetch.ts`, `manifest.ts`, `consumers.pkgs`), plus `tests/debian-base-test.sh` and `tests/debian-lock-test.sh` | nothing: consumed as a git submodule at `rootfs/debian/`; its commit is the pin of the Debian base, bumped like a lock row |
| `mica-system` | `rootfs/packages-src/*` (the six system producers), `rootfs/overlay/` (less the two podman files) | `mica-system`, `mica-busybox`, `mica-ca-trust`, `mica-profile-dev`, `mica-profile-prod`, `mica-wifi`, `mica-wifi-ap`, `mica-bluetooth` |

The registry component of each archive is its source repository name.

**Why `rootfs/debian` and `rootfs/packages-src` leave and the composer
stays.** `rootfs/debian` is already a module with one interface -- `run.sh
cache|verify|install|select` and `manifest.ts helper`, driven from the
composer's bootstrap stage, `make os-debian-*` and two tests -- and its own
cadence (Debian point releases and security updates). Its product is a pin
set, not an archive, so a submodule commit is the right pin and the registry
is not involved; the cache stays in the assembly's `_out/debian-base`. Its
outward coupling is `build-env/from.sh` for the Bun image and the cache
path, both already arguments. `rootfs/packages-src` is six ordinary
producers and moves the way the others do, through the lock. The composer
(`rootfs/build.sh`, `rootfs/compose`, `rootfs/runtime`, `rootfs/packages`,
`rootfs/scripts`) is the assembly: it reads `boards/*`, the lock, the pool
and `meta/`, and the release gate re-verifies its record; moved out, it
would need the boards and the lock from here and the assembly would have
nothing left to assemble.

### 1. Transport: GitHub Releases, one per source commit

Decided 2026-09-13 (user): archives are published as **release assets by
each repository's workflow**, not through a package registry of our own.
Every push to `main` that passes a package repository's gates creates the
release `build-<commit12>` of `<repository>` on that commit, with one
asset per archive named `<package>_<version>_<arch>.deb`; `publish.sh` is
that step, runnable from a developer machine as well:

```sh
# build-env/deb/publish.sh [--pool _out/debs] [--arch <a>] [--package <name> ...]
POST https://api.github.com/repos/<former organisation>/<repository>/releases        {tag_name: build-<commit12>, target_commitish: <commit>}
POST https://uploads.github.com/repos/<former organisation>/<repository>/releases/<id>/assets?name=<archive>
```

A lock row names the repository and the full commit, so `fetch.sh` derives
the release tag and the asset and follows nothing "latest"; it verifies the
bytes against the row's sha256 (and the API's `digest` on `--check`) and the
five control fields against the row. `lock.sh --bump <component>
[--tag build-…]` downloads every `.deb` asset of a release and writes the
rows from the archives' own fields. `registry.env` declares the API, the
organisation, the token variable (`GH_TOKEN`, falling back to
`gh auth token`) and the source URL prefix. `publish.sh` refuses a `.dirty`
version, a dirty checkout, an archive from another repository or commit, an
asset already present with other bytes, and a HEAD not yet pushed (GitHub
refuses to tag an unknown commit). The Gitea Debian registry used by the
Phase 1 proof is retired; Gitea stays as a git mirror only.

### 2. Provenance inside the archive

`pack.sh` reads `MICA_DEB_SOURCE_REPO` and `MICA_DEB_SOURCE_COMMIT` from the
environment (the `SOURCE_DATE_EPOCH` pattern; each producer Dockerfile
declares the two `ARG`s) and writes them as `Mica-Source-Repo:` and
`Mica-Source-Commit:` control fields (dpkg keeps unknown fields; `dpkg-deb -f`
reads them back). `build.sh` supplies them from `origin` and `HEAD` of the
repository the producer lives in; `repo.sh` adds both columns to
`manifest.txt` and refuses an archive without them.

This retires `_out/micad-build-<arch>.txt`: the composer writes
`_out/<board>/micad-build.txt` from the `micad` archive's field (through the
lineage record, so no `dpkg-deb` runs on the host) and `verify/src/smoke.ts`
asserts what it asserts today.

### 3. The lock: one pin per package

Decided 2026-09-13 (user): package versions and hashes are declared in JSON
in the shape of the Debian pins, one file per package under
`deps/packages/`, so every dependency of a repository -- upstream Debian,
Mica OS packages, source trees (section 7) -- is the same kind of record:

```json
deps/packages/mica-podman.json
{ "name": "mica-podman", "repository": "mica-podman", "commit": "1a2b3c4d5e6f…",
  "targets": {
    "amd64": { "version": "5.8.6+git1a2b3c4d5e6f-1", "architecture": "amd64",
               "sha256": "…", "asset": "mica-podman_5.8.6.git1a2b3c4d5e6f-1_amd64.deb" },
    "arm64": { "version": "5.8.6+git1a2b3c4d5e6f-1", "architecture": "arm64",
               "sha256": "…", "asset": "mica-podman_5.8.6.git1a2b3c4d5e6f-1_arm64.deb" } } }
```

An `Architecture: all` archive serves both pools with one target each.
`lock.sh --rows` is the one reader, printing the pins as
`package version arch sha256 source-repo source-commit` rows for every other
consumer, so the composer, the gate and the release gate read one shape.
The TSV lock of Phase 1 (`rootfs/packages/lock.tsv`) was converted on
2026-09-13 and retired.

- `fetch.sh --arch <a>` downloads every row for `<a>` and `all` into
  `_out/debs/<a>/pool/`, verifies sha256 and both control fields against the
  row, deletes and refuses on any mismatch naming the package, and skips an
  archive already present at the right digest. `repo.sh` then indexes as
  today, so the composer's `Packages`/`SHA256SUMS`/`manifest.txt` contract is
  untouched.
- `lock.sh --bump <component> [--version <v>] [--package <p> ...]` reads the
  component's `Packages` index from the registry, rewrites that component's
  rows and prints the diff. It is the lock's only writer; a lock diff is the
  reviewable import. `lock.sh --rows [--arch <a>]` is the one parser every
  other reader uses.
- `source.sh <component>` checks the source repository out at the locked
  commit into `_out/src/<component>/` for the two assembly tests that need
  package *source* (the component-contract fixtures, the early-hang init).

### 3a. What the lock retires: the fixed producer join

Binding 4 is the lock in hand-made form, so Phase 1 retires it rather than
keeping both:

- `source-lineage.py` keeps schema `mica/source-lineage/v1` for archives the
  assembly builds. The `join-v1` schema, the three `MICA_ROOTFS_*` inputs and
  every `JOIN_*`, `STARTUP_*`, `GPT_*` constant go, with the tests that pin
  them; the `delta` and `receipt_sha256` fields go with the explicit package
  source they described (package and composition source are now one). No
  compatibility path: migration was waived on 2026-09-11.
- The lineage record gains a `lock` array (package, version, arch, sha256,
  source repo, source commit), an `unlocked` array, and `source_repo` /
  `source_commit` on every pool package row. The two-class rule is
  implemented once, in `source-lineage.py` (`--lock`, `--unlocked`,
  `--local-packages`); `release-manifest.ts` re-checks the record and, at
  assembly, compares its rows with the tree's `lock.tsv`, replacing the fixed
  `producerJoin()` validation with a rule any future import satisfies.
- Binding 5 becomes the `mica-lifecycle` archive: `kernel-package.ts` extracts
  `mica-init` and `mica-shutdown` from the fetched archive into the stage
  directory it already reads; `kernelExecutables()` keeps its ELF checks;
  the lock row's sha256 is what the release gate compares.
- Binding 6 is unchanged.

### 4. The composer's rule

"Stale, sense 3" becomes a two-class rule over every archive in the pool:

- **built here**: a package a producer of *this* repository emits must carry
  this tree's stamp;
- **imported**: a package the lock names must match its row's sha256;
- anything else refuses, naming the archive.

`MICA_POOL_UNLOCKED="<pkg> ..."` lets named imported packages bypass the
digest check for local development. The bypass is announced, written into
`rootfs-packages.txt` and the image's `release-identity.env`, and
`release-manifest.ts` refuses such an image in the `candidate` and `stable`
channels as it refuses the development marker today.

### 5. Targets

- `make os-debs` keeps its name and builds the producers discovered in this
  tree (after the split: `rootfs/packages-src/*`, `boards/*/deb/*`).
- `make os-pool` = `fetch.sh` for both architectures + `os-debs` + `repo.sh`;
  it is what `rootfs/build.sh` names in its refusal message.
- `make os-deb-preflight` additionally checks that every lock row is
  reachable (one one-byte ranged GET per row; the registry answers HEAD with 405).
- `make os-lock-bump COMPONENT=<name>` wraps `lock.sh`.

### 6. Versioning

`version.sh` reads `${REPO_ROOT}/VERSION` (one line, e.g. `0.1.0`) instead of
the micad crate manifests. Each repository gets a `VERSION`; `micad`'s
`hack/check.sh` asserts it equals the workspace crate version. The
`deb-package-gate` one-stamp rule holds per repository pool.

Cross-repository `Depends` lose their exact pin: a dependency across the lock
boundary (either side imported) is unversioned, and `deb-package-gate.sh`
requires exactly that -- exact within a class, unversioned across. Phase 1
unpins `mica-podman` on `mica-system` and removes `@SYSTEM_VERSION@` and
`--system-version` with it; `micad` and `mica-apid` stay exactly pinned on
`mica-system` until Phase 5 moves them across the boundary.

### 7. The shared substrate as a source pin

Decided 2026-09-13 (user): repositories are not linked by submodules but by
pins in the shape of the Debian pins -- a JSON file per dependency naming a
version (commit) and a hash -- so each repository builds on its own and
depends by pin. `build-env/` becomes `mica-build-env`, published on every
commit as the release asset `mica-build-env-<commit12>.tar.gz`, and every
consumer carries `deps/sources/mica-build-env.json` (name, repository,
commit, path, asset, sha256) and a vendored `tools/deps.sh` that fetches,
verifies and unpacks it into the gitignored `build-env/`, recording the pin
in `build-env/.deps-pin`; no consumer changes path. `mica-debian` is pinned
the same way at `rootfs/debian/`. Each repository's `Makefile` refuses with
`make deps` when `build-env/from.sh` is absent, and the lineage record
requires each directory at its pin. Builder images stay locally built
(`make build-env`); publishing them to the container registry is decision 3.

### 8. Local development loop

```sh
cd /srv/micad
MICA_POOL_DIR=/srv/mica-build/_out/debs make os-debs   # dirty stamp, into the assembly's pool
cd /srv/mica-build
bash build-env/deb/repo.sh --arch amd64
MICA_POOL_UNLOCKED="micad mica-apid" MICA_BOARD=x64 bash rootfs/build.sh
```

`MICA_POOL_DIR` is a new optional override of `_out/debs` in `build.sh` and
`repo.sh`; unset, both behave as today.

### 9. Gate relocation

| Gate | Today | After |
|---|---|---|
| `os-rust-gate` (fmt, clippy, nextest, deny, openapi drift) | `mica-build` CI | `micad` and `mica-deploy` CI, each over its own workspace |
| `os-apid-ui-build-contract-test`, `os-apid-api-spec-pins`, `apid/ui/run.sh` | `mica-build` CI | `micad` CI |
| `os-dbus-policy-test` | manual (root) | `micad`, same privilege note |
| `os-apid-api-test` (boots the image) | manual | `micad`, driven with `MICA_QEMU_IMAGE` at an assembly image; the assembly's delivery record names the micad commit it ran |
| `os-file-transaction-faults`, `tests/boot-shutdown-test.sh` | `mica-build` CI | `mica-deploy` CI |
| `podman`, `podman-pins`, `podman-pins-test` | `mica-build` | `mica-podman` |
| `deb-package-gate.sh` | `mica-build`, whole pool | every repository with producers, over its own pool, before publish; the assembly over its own archives |
| `os-install-closure-gate` | `mica-build` | `mica-build`, over the fetched + assembly-built pool |
| `os-smoke-test`, `os-verify`, `os-factory-root-gate`, image assembly | `mica-build` | unchanged; pins come from the pool's control fields and the lock |
| `netavark-kernel-config-test` | reads `pkgs/podman/versions.env` | reads `/usr/share/mica/podman/versions.env` shipped in the `mica-podman` archive from `mica-podman` (new payload file) |
| `quadlet-doc-test` | runs `pkgs/podman/out-arm64/quadlet` | runs `quadlet` extracted from the fetched arm64 archive |
| `host-toolchain-lint` | whole tree | unchanged in `mica-build`; each package repository runs it through the submodule |

### 10. Repository hygiene for the new repositories

Each new repository gets `AGENTS.md` with `CLAUDE.md` symlinked (PMA
injection naming its stack skill), `README.md`, `LICENSE`, `.gitignore`,
`.gitattributes` (the two `linguist-generated` rows move with `micad`),
`.editorconfig`, `VERSION`, `docs/{task,plan}/index.md`, `docs/changelog.md`
and the `build-env` submodule. History comes from
`git subtree split -P pkgs/<dir>`.

### 11. Documentation

Decided 2026-09-13 (user): `mica` is the documentation and project
management repository. The whole `docs/` tree and the documentation gates
(`tools/docs/`, `make docs-verify`, `docs-verify-test`) moved there from the
assembly on 2026-09-13 with their history (1667 commits); every task, plan,
decision and changelog entry of every Mica OS repository is recorded there,
and each code repository's `AGENTS.md` names it as its documentation entry
point. Citations of code are `<repository>:<path>` (or
`<repository>:make <target>`), which the status gate accepts by shape; 39
links and 327 evidence references were rewritten that way. Two documents
the code executes stay beside it as executed copies: the release
verification commands (`mica-build:build/release-verify.md`) and the
containers guide's examples (`mica-build:tests/quadlet-doc/containers.md`);
a drift between copy and record is a diff to review. `docs/architecture.md`
gains a *Repositories* section in Phase 6.

### 12. Renaming to Mica OS

Decided 2026-09-12: the split and the rename proceed together. The phase
that moves a component renames what it moves, so no repository is created
under a name it will not keep and no archive is published twice for a
rename. The table was confirmed by the user on 2026-09-12 23:20:

| Former name | Name | Renamed in |
|---|---|---|
| (the former project prefix) | `micad`, `mica-apid`, `mica-mqttd`, `mica-mqtt-broker`; `micad.service`, `mica-apid.service` | Phase 5 (`micad`) |
| (the former project prefix) | `mica-deploy`, `mica-init`, `mica-shutdown` | Phase 4 (`mica-deploy`) |
| (the former project prefix) | `mica-podman` | Phase 3 (`mica-podman`) |
| (the former project prefix) | `mica-system`, `mica-busybox`, `mica-ca-trust`, `mica-profile-*`, `mica-wifi*`, `mica-bluetooth`, `mica-health.service` | Phase 3a (`mica-system`) |
| (the former project prefix) | `mica-board-*`, `mica-s905x5m-*`, `mica-bm201-front-panel` | Phase 6 |
| (the former project prefix) | `com.mica.*` | Phase 5, with `micad` |
| (the former project prefix) | `/usr/lib/mica`, `/etc/mica`, `/var/lib/mica`, `/usr/share/mica` | Phase 3a (`mica-system` owns the layout), consumers follow in 4 and 5 |
| (the former project prefix) | `MICA_*`, `make os-*` unchanged, `mica-build-*`, `Mica-Source-*` | Phase 6, last, as one mechanical sweep |

The on-device names (bus, paths, state directories) are a runtime
compatibility break for existing installs; migration was waived on
2026-09-11 and the rename lands while the tree is in its development
phase. `rootfs/runtime/consumers.json` (115 rows keyed by package) and
`rootfs/packages/*.pkgs` are rewritten with each package rename, and
`verify/src/smoke-register.ts` with each binary rename.

### Phase order

Each phase ends with an x64 image composed, verified (`os-verify`) and
smoke-tested from the pool as it stands.

- **Phase 0 — preflight and decisions.** Closed 2026-09-12: registry and
  token confirmed, repository renamed, the four repositories created,
  `origin` repointed, the throwaway upload/download/delete round trip done,
  the runner question answered (none registered; see *Forge facts*),
  decisions 3 and 4 recorded under *Annotations*.
- **Phase 1 — the mechanism, inside this tree.** Done 2026-09-12
  (commits `882ed749` to `42b76d50`): provenance fields, manifest columns,
  `VERSION` + `version.sh`, `fetch.sh`/`lock.sh`/`publish.sh`/`source.sh`,
  `MICA_POOL_DIR`, the composer's two-class rule, retirement of the fixed
  producer join (3a), `os-pool`, the unlocked marker and its release refusal,
  the negative tests. Proven by publishing the locally built `mica-podman`,
  locking it (`3a731a71`), deleting the local archive and composing x64 and
  virt-arm64 from the fetched copy; the x64 image passed `os-verify` and the
  release gate with the lock rows in `provenance.json`. Pre-existing defects
  met on the way are `20260912-2236-phase1-findings`.
- **Phase 2a — release transport.** Done 2026-09-13: `fetch.sh`,
  `lock.sh` and `publish.sh` moved from the Gitea Debian registry to GitHub
  Releases (section 1); `tests/pool-lock-test.sh` drives them against a stub
  of the release API (20 checks).
- **Phase 2 — `mica-build-env` and `mica-debian`.** Done 2026-09-13:
  `build-env/` (14 commits) and `rootfs/debian/` (20 commits) subtree-split
  from `75a29d4d`, pushed to GitHub, added back as submodules at their old
  paths; `tests/deb-package-gate.sh` became `build-env/deb/package-gate.sh`
  and the two Debian tests `rootfs/debian/tests/`, each deriving the
  consumer from its new depth. Revised the same night per section 7: the
  submodules were replaced by source pins (`deps/sources/*.json`, `make
  deps`, `tools/deps.sh`), the directories are gitignored, CI runs `make
  deps` with the `MICA_DEPS_TOKEN` secret, and the lineage identity requires
  each directory at its pin. Neither new repository runs standalone: both are
  consumed through `mica`. Gitea mirrors pending (host down).
- **Phase 2b — the rename (section 12).** Done 2026-09-13 (`mica-build`
  `f9860057`, `89311b8e`; `mica-build-env` `48592fbdb9b8`; `mica-debian`
  `bacf18dfb65e`): packages, crates, units, bus names and root paths in one
  sweep, proven by the Rust gate, the offline suites, the x64 compose and
  smoke, the install-closure gate, the image pipeline (`os-verify` 104
  checks) and the release gate at `89311b8e`. What the sweep missed and the
  gates found is in the changelog. Left with the former project name on
  purpose, for later sweeps: the data mount and its units, boot-side
  identifiers, partition and device-mapper names, the `50-*` file prefixes,
  docker stage and builder image names, the build variables and control
  fields (Phase 6).
- **Phase 3 — `mica-podman`.** Done 2026-09-13: `mica-podman`
  (5 commits split, then the renamed tree; `overlay/` holds the container
  configuration and the Quadlet mount unit, `tests/podman-pins/` the pin
  check's recorded responses, `tests/deb-preflight-test.sh` the stamp half
  of the preflight test), release `build-3e8375d5c1dd`, pinned in
  `mica-build` as `deps/packages/mica-podman.json` (`f4bbcbdc`). The
  archive ships `/usr/share/mica-podman/versions.env`; the assembly keeps
  `deps/packages/mica-podman.versions.env` as a derived copy
  (`tools/podman-pool.sh --refresh` after a bump, `--check` in `os-pool`)
  for the smoke register, the install-closure gate and the netavark check,
  and `os-pool` extracts the arm64 quadlet for `quadlet-doc-test`
  (`tools/deb-member.py`). The composed overlay's loose copies of the five
  container files stay in `rootfs/overlay` until the composer stops
  installing them (Phase 3a).
- **Phase 3a — `mica-system`.** Done 2026-09-13: `mica-system`
  (`rootfs/packages-src` 20 commits and `rootfs/overlay` 12 commits split,
  the overlay added back under `overlay/`, then the renamed tree; `radio/`
  holds the units and the Bluetooth hwinit the radio producers take from
  the cx3576 board tree, `ca-trust/scripts/` the CA generation script,
  `tests/` the five overlay tests), release `build-4cd6a0064d68`, pinned in
  `mica-build` as eight pins (`a27bb661`, merged as `f6b72253`). The
  template fstab and the board copyright stay in the assembly at
  `boards/common/`; the composition tests seed their fixtures from the
  imported archives (`tools/deb-member.py`) rather than a checkout; the
  container configuration under `/etc/containers` was dropped from the
  overlay (mica-podman ships it). The board packages depend on
  `mica-system`, `mica-wifi` and `mica-bluetooth` unversioned now
  (`3bad5e45`, `ccde58ec`). Proven at `3bad5e45`/`ccde58ec`: x64 compose
  and smoke (12/12), the install-closure gate (99/99), `os-verify` (104
  checks), the release gate, and the package gate with only the two known
  `/etc/fstab` findings.
- **Phase 4 — `mica-deploy`.** Done 2026-09-13: `mica-deploy`
  (13 commits split, then the renamed tree; `gate/` holds the Rust gate,
  the shutdown suite and the IO fault suite, `tests/component-contracts/`
  the fixtures its readers include; a new `mica-lifecycle` producer packs
  the static `mica-init` and `mica-shutdown` under
  `/usr/lib/mica/lifecycle/`), release `build-91d0173ecfbb`, pinned in
  `mica-build` as `deps/packages/mica-deploy.json` and
  `deps/packages/mica-lifecycle.json` (`ee4fa960`). The kernel component's
  inputs come out of the pinned archive (`tools/deploy-pool.sh --lifecycle`),
  the contract fixtures are held equal to the pinned source by
  `tools/deploy-pool.sh --check` in `os-pool`, the early-hang fixture builds
  from `source.sh`'s checkout, and the deployment client's expected version
  is the pin's. Proven at `ee4fa960`: x64 compose and smoke (12/12), the
  install-closure gate (99/99), `os-verify` (104 checks) and the release gate
  with `mica-deploy`, `mica-lifecycle` and `mica-podman` in the provenance
  lock; the package gate reports only the two known `/etc/fstab` findings.
- **Phase 5 — `micad`.** Done 2026-09-13: `micad` (163 commits
  split, then the renamed tree; `gate/` holds the Rust gate with the UI
  build and the UI build contract test, `tests/` the D-Bus policy test),
  releases `build-97426adbfa8c` and `build-3ea7e297ab6f` (the second
  depends on `mica-system` unversioned, as the lock boundary requires),
  pinned in `mica-build` as four pins (`e49b3583`, `c389d7b0`). The API
  harness stays in the assembly as `tests/apid-api/`; its build-time half
  reads the OpenAPI document the `mica-apid` archive ships
  (`tools/micad-pool.sh --openapi`), verify's connd family reads the
  reconcilers' contract out of the pinned source (`--source`), and the
  four binaries' expected versions are their pins'. The micad build record
  comes from the lineage (since Phase 1); `os-rust-gate`,
  `os-dbus-policy-test` and `os-apid-ui-build-contract-test` are gone.
  Proven at `c389d7b0`: x64 compose and smoke (12/12), the install-closure
  gate, `os-verify` (104 checks) and the release gate. The package gate
  refused micad's own packages for pinning each other exactly across what
  it took for the lock boundary; `mica-build-env` `19165d01f2ac` draws the
  boundary between origins (repository and commit) instead.
- **Phase 6 — the last rename and the clean-up.** Done 2026-09-13. One
  mechanical sweep per repository, substrate first: the build variables
  became `MICA_*` (`LOCAL_MICA_BUILD_*` included), the builder images and
  their markers `mica-build-*` (`localhost/mica-build-{base,c,deb,go,
  openssl,rust,rust-check}`, `/etc/mica-build/*.env`), the control fields
  `Mica-Source-*` and the release properties `mica:*`.
  `mica-build-env` `c9174f82d5d9` (and `211634797dde`, which checks package
  sources out over https with the release token so a runner without an
  SSH key can), `mica-debian` `8a3ef0d1e67a`; the four package repositories
  swept, bumped and re-released on the renamed substrate (`mica-podman`
  `build-4c84b4b13e03`, `mica-deploy` `build-2c71324ad30e`, `micad`
  `build-6211503847b9`, `mica-system` `build-6a714846d443`); the assembly
  swept and re-pinned on all of them (`60d3244f`, `7afa4820`). The
  clean-up landed with the phases: Makefile help and targets, `check.yml`,
  `AGENTS.md`'s skill stack, `pkgs/README.md`, and the permanent
  documents, which now speak Mica OS and cite the split repositories
  (`mica` `0878127`). Proven at `7afa4820`: x64 compose and smoke (12/12),
  the package gate with only the two known `/etc/fstab` findings, the
  install-closure gate, `os-verify` (104 checks) and the release gate.

## Verification

### Phase 1

Run 2026-09-12; results in the task record's *Verification*.

- `fetch.sh` negatives, each red by name: altered sha256; `source-commit`
  differing from the control field; a version the registry does not hold;
  401/403 with no token. (`tests/pool-lock-test.sh`, 16 checks, against a
  stub registry that requires the token.)
- Composer negatives, each red by name: an archive no lock row and no local
  producer names; a lock-named archive with one byte changed; `MICA_POOL_UNLOCKED`
  naming a package not in the pool.
- Positive: `os-pool`, then `rootfs/build.sh` for x64 and virt-arm64, then
  `os-verify`, `os-smoke-test`, `os-install-closure-gate`,
  `os-factory-root-gate` green with `mica-podman` fetched and the rest built
  here. (All green except the factory-root gate's device negative case and
  the package gate's board-package overlap, both pre-existing; see the
  findings task.)
- `release-manifest.ts` refuses an unlocked image in `candidate` and
  `stable`, accepts it in `development`; fixture test beside the
  development-marker cases.
- The fixed join is gone: `git grep` finds no `producer-join`,
  `MICA_ROOTFS_PRODUCER_JOIN`, `JOIN_`, `STARTUP_NATIVE` or `GPT_NATIVE`
  outside `docs/changelog.md`; `source_lineage_test.py` and
  `release-manifest.test.ts` prove the lock-row path, positive and with one
  altered row.
- `docs-verify`, `os-host-toolchain-lint`, `os-shell-pipefail-lint` green.

### Phases 2 to 5 (each extraction)

- The new repository's CI runs its gates and `deb-package-gate.sh` and
  publishes; the archive's control fields name the new repository and its
  `HEAD`.
- In `mica-build`: `lock.sh --bump` produces the expected diff; `os-pool` fetches;
  the x64 image composes and passes the gate set above; `git grep pkgs/<dir>`
  outside `docs/` returns nothing.
- `mica-deploy`: the kernel component builds with the archive's executables;
  `tests/file-ab-x64/` runtime, update and fault cases pass under QEMU; the
  early-hang case still trips the watchdog.
- `micad`: `os-apid-api-test` from its checkout against the assembly's
  image passes; the smoke commit row is green from the control field with no
  `_out/micad-build-<arch>.txt` present.

### Phase 6

- `make docs-verify docs-verify-test` green; `check.yml` runs without the
  moved jobs; `make help` lists no target under a deleted directory.

## Risks

- **CI for the new repositories.** The arm64 packaging is emulated and the
  podman build is long; the package repositories need the same docker+buildx
  runner. A repository without one publishes from a developer machine with
  `publish.sh`, which the provenance fields make visible.
- **Provenance becomes two-level.** An image is reproduced from the assembly
  commit *plus* the lock; `provenance.json` records the lock rows and the
  release gate reconstructs and compares them as it does the SBOM.
- **The fixed join is retired, not generalised.** Until Phase 1 lands, every
  further pool reuse costs a reviewed edit of two constant tables and their
  tests; that cost is the argument for Phase 1 first. Its delta allowlists
  also name task and plan files (one already deleted); no replacement may
  list a document.
- **Unlocked images leaking.** Covered by the release-channel refusal and
  the identity marker.
- **Submodule ergonomics.** A checkout without `--recurse-submodules` has an
  empty `build-env/`; every Makefile refuses with the init command.
  Worktrees need `git submodule update` each.
- **Assembly tests that compile package source** now depend on a clone at
  the locked commit; they are already docker-and-network tests and
  `source.sh` refuses offline by name.
- **Exact pins dropped across the boundary.** APT no longer refuses a
  mismatched `micad`/`mica-system` pair; the lock expresses it at the assembly
  and the install-closure gate still proves the set installs together.
- **Concurrent work.** Branches touching `pkgs/micad` and `boards/` should be
  merged or rebased before Phase 5; Phases 1 to 3 do not move `pkgs/micad`.
- **Docs churn.** Sixty-odd prose citations of `pkgs/...` rewritten in
  Phase 6; the link gate catches the relative ones, grep the rest.

## Scope

- Phase 1: `build-env/deb/{pack.sh,build.sh,repo.sh,version.sh,preflight.sh}`,
  new `build-env/deb/{fetch.sh,lock.sh,publish.sh,source.sh}`, `VERSION`,
  `rootfs/packages/lock.tsv`, `rootfs/build.sh`, `rootfs/runtime/source-lineage.py`,
  `Makefile`, `build/src/release-manifest.ts` (+ test), `verify/src/smoke.ts`,
  `tests/deb-package-gate.sh`, `tests/rootfs-runtime/source_lineage_test.py`,
  new negative tests, `docs/design/build.md`. About 18 files.
- Phase 2: `build-env/` out, `.gitmodules` in, `Makefile` preflight, CI
  checkout step. About 6 files plus the new repository.
- Phase 3: `pkgs/podman/` (15 files) and two overlay files out;
  `tests/{podman-pins-test,quadlet-doc-test,netavark-kernel-config-test,deb-preflight-test,install-closure-gate}.sh`,
  `verify/src/smoke-pins.ts`, `Makefile`, `check.yml`. About 12 files.
- Phase 4: `pkgs/mica-deploy/` (47 files), `tests/component-contracts/`,
  `tests/file-ab-faults/`, `tests/boot-shutdown-test.sh` out;
  `build/src/kernel-package.ts`, fixture paths in `build/src/*.test.ts` and
  `update-server/src/*`, `tests/file-ab-x64/early-hang-init.sh`, `Makefile`,
  `check.yml`. About 15 files.
- Phase 5: `pkgs/micad/` (354 files) out; `tests/rust-gate.sh`,
  `tests/apid-ui-build-contract-test.sh`, `tests/p1-writable-path-audit/boot.sh`,
  `rootfs/build.sh`, `verify/src/smoke-pins.ts`, `Makefile`, `check.yml`,
  `.gitattributes`. About 10 files.
- Phase 6: docs and `AGENTS.md`; about 60 files, prose only.

## Alternatives

- **OCI images instead of Debian archives.** Both registries exist, so this
  is a format question. An image carries no dependency metadata (the
  `dpkg-shlibdeps` `Depends` computed at the target architecture is lost),
  no install transaction (the install-closure gate no longer proves the
  selected set installs into the pinned base, and the Debian base stays
  `.deb` either way, so the root is composed from two formats), no maintainer
  scripts (three `postinst` and the `ENABLEMENT` contract become composer
  steps) and no ownership database (`consumers.json` keys 115 rows by
  package; `select.py`, `shipped_packages`, the copyright inventory and
  `manifest.tsv` read dpkg ownership). What it adds, a content-addressed
  digest and layer de-duplication, the lock already gives per archive.
  OCI as transport only gains nothing over the Debian registry, which also
  serves the APT index `lock.sh` reads. OCI stays where it already is:
  builder images, the `factory-root.oci` export, buildx stage hand-off.
  **Decided 2026-09-12: archives.**
- **APT straight at the registry from the compose Dockerfile, no lock.**
  No offline compose, no reviewable import diff, a reproduced build can
  differ. Rejected.
- **Submodules of package source into the assembly.** The assembly still
  compiles and re-gates every package on every image. Rejected.
- **`git subtree` instead of a submodule for `build-env`.** No pin to a
  commit, duplicated history. Rejected.
- **Publishing raw binaries per package.** Needs a second packaging step in
  the assembly and loses `dpkg-shlibdeps` at the producer. Rejected.

## Annotations

- Decided 2026-09-12: one repository per package, named for Mica OS:
  `mica-build` (this repository), `mica-build-env`, `micad`, `mica-deploy`,
  `mica-podman` under the organisation; Debian archives remain the package format.
  `mica-build-env` is the prefix rule applied to the substrate; not
  explicitly confirmed by the user. History of the earlier drafts and probes is in
  `docs/changelog.md`.
- Approved 2026-09-12 21:00 ("你来做拆分计划"); Phase 1 implemented the same
  evening inside this tree.
- Decision 3 (2026-09-12): builder images stay locally built with
  `make build-env` in every repository; publishing them to the container
  registry is not part of this plan.
- Decided 2026-09-12 (user): the split and the Mica OS rename proceed
  together, per section 12; the table was confirmed at 23:20 together with
  the move to GitHub (`mica` on GitHub as the documentation
  and main repository, one GitHub repository per package) and the local
  layout `<workspace>/<repository>/`. `mica` already existed on
  GitHub (empty); `mica-build-env`, `micad`, `mica-deploy`, `mica-podman`,
  `mica-debian` and `mica-system` were created private on 2026-09-12 23:25
  after the `aamf` account's pending organisation membership was accepted.
  `origin` of this checkout is the GitHub `mica` (the Gitea
  remote is kept as `gitea`); nothing has been pushed, and this machine's
  SSH key is not registered with GitHub yet (`git@github.com` answers
  "Permission denied (publickey)"), so the first push needs either
  `gh ssh-key add ~/.ssh/id_ed25519.pub` or an https remote. Asked the same day whether `rootfs/`, and the Debian base in
  particular, should be a repository of its own: `rootfs/debian` yes, as
  the `mica-debian` submodule; `rootfs/packages-src` + `overlay` yes, as
  `mica-system` through the lock; the composer no (rationale under *Target
  repository set*).
- Decision 4 (2026-09-13, revised): the token is `GH_TOKEN` (named, never
  printed, by `build-env/deb/registry.env`; `gh auth token` on a developer
  machine); in a package repository's workflow it is the job's
  `GITHUB_TOKEN` with `contents: write`, which may create releases and
  upload assets of its own repository, and in the assembly's workflow a
  fine-grained token that reads the package repositories' releases.
  Runners are GitHub-hosted; the builder images are built by `make
  build-env` in each job until decision 3 is revisited for speed.
- Decided 2026-09-13 (user): packages are published by workflows as
  releases, not through a package registry of our own (section 1).
- Decided 2026-09-13 04:10 (user): `mica-build` stays the assembly; `mica`
  is a new repository for project management and documentation (section
  11). Renamed on both forges (`gh repo rename`, Gitea PATCH), the empty
  `mica` created on both, `docs/` split out with history, the local
  checkouts in the workspace follow (`mica-build`, `mica`).
  `mica-podman` is republished from `mica-build` and re-pinned, since the
  archives name their repository.
- 2026-09-15: pre-reset history: the `mica-build-env` commits cited here
  (`19165d01f2ac`, `211634797dde`, `48592fbdb9b8`, `c9174f82d5d9`) are no
  longer on its `main`, which the user reset to one root commit (`5c05745`);
  the current `mica-build-env` facts (release `20260915-0138` at `f7b896b`)
  are in `docs/task/20260914-2042-release-lock-offline-build.md`.
