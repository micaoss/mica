# Building Mica OS from source

Two ways to build: **online**, where each repository builds against the
releases it pins, and **offline**, where the side-by-side checkouts build
each other. Both produce the same product image; the online path is the one a
release uses.

The contract behind the build is [build.md](../design/build.md) and the
pinning rules are [release-lock.md](../design/release-lock.md); this page is
the operator's path through them.

## 1. Prerequisites

Docker with buildx, bash, make and git. Every compiler, filesystem maker and
signing tool runs inside the pinned build-env images, and a lint refuses a
toolchain invocation on the host. A build installs nothing from a package
archive either: the toolchains are baked into the images and pulled by digest
([decision](../decisions/2026-09-16-toolchains-live-in-build-env.md)).

Some targets need privileges (the repart test) or the network (fetching pools
and locks); each says so in `make help`.

> status: shipped — evidence: `mica-build:Makefile`, `mica-build:make os-host-toolchain-lint`, `docs/design/build.md`

## 2. What each repository builds

| Repository | Build | Gates |
|---|---|---|
| `mica-build-env` | the five build images, `bsp` among them | `bash from.sh --check`, `bash tests/publish-test.sh` |
| `mica-system-base` | the four policy packages and the base root | `bun run check`, `bun src/container.ts debs`, `bun src/container.ts rootfs --arch amd64\|arm64` |
| `mica-core` | the seven packages | `make check` |
| `mica-podman` | `mica-podman` | `make check` |
| `mica-boards` | per board: kernel, U-Boot, firmware, board metadata, packages | `make check`; one board with `make <board>-<target>` |
| `mica-build` | the products: root, signed components, images and update archives | the `make os-*` suites |

Each repository reads its inputs only from `locks/`: a producer's lock and
its pin. `make offline` exists in every repository and builds its own outputs
from those locks.

> status: shipped — evidence: `mica-boards:Makefile`, `mica-podman:Makefile`, `mica-core:Makefile`, `mica-system-base:package.json`, `mica-build-env:from.sh`

## 3. Online: build a product image

In `mica-build`:

```sh
make locks-verify                 # every lock and pin, and what they name
make board-fetch-all              # the board components of every board row of locks/
make os-pool                      # fetch and verify every pinned archive, index both pools
make product PRODUCT=uefi-x64-dev      # the product's closure: compose, sign, image, update archive
make product-verify PRODUCT=uefi-x64-dev
```

- `make products` builds every product whose board is a release target.
- `make os-rootfs PRODUCT=<name>` composes only the root, and
  `make os-components MICA_COMPONENT_ARGS='root|kernel|firmware|deployment|image|archive ...'`
  builds one component at a time.
- Outputs land under `mica-build:_out/products/<name>/` (and the fetched
  board trees under `_out/boards/<board>/`). A product whose receipt is
  unchanged is not rebuilt.
- Writing the image the build produced to a board is
  [flashing](flashing.md).

> status: shipped — evidence: `mica-build:Makefile`, `mica-build:tools/product-build.sh`

## 4. Building one package or one board component

- A package: build it in its own repository, with that repository's gates
  (`make check` in `mica-core`, `mica-podman` and `mica-boards`,
  `bun src/container.ts debs` in `mica-system-base`). A package is rebuilt
  only when its declared version is bumped
  ([package versions](../decisions/2026-09-15-package-versions.md)).
- One board's components: `make <board>-<target>` in `mica-boards` delegates
  to that board's `Makefile`; `make check` holds the board to the contract.
- The assembly reads a board out of its release with
  `make board-fetch BOARD=<board>` and checks it against the board's
  `outputs.tsv`.

> status: shipped — evidence: `mica-boards:Makefile`, `mica-build:Makefile`, `mica-boards:tools/boards.sh`

## 5. Offline: the side-by-side checkouts

Every repository has `make offline`, which builds its release outputs from
its `locks/` into `_out/offline/` with a git-ignored `repos/` source cache
managed by `tools/repos.sh`. The workspace driver chains them:

```sh
make offline-chain                       # in mica-build; MICA_WORKSPACE defaults to ..
make offline-chain PRODUCTS=uefi-x64-dev
```

It builds the repositories in dependency order in throw-away clones of each
checkout and composes the products from those builds. It is long and needs
docker.

On an amd64 workstation the arm64 halves are built under emulation, so an
offline build produces a **working** arm64 root, not the same bytes as the
published one; the amd64 half does reproduce the release exactly. Only CI,
which builds each architecture natively, answers whether an arm64 artefact
still matches its release.

> status: shipped — evidence: `mica-build:Makefile`, `mica-build:tools/offline-chain.sh`, `docs/design/release-lock.md`

`mica-build:tools/local-pins.sh` lets a sibling checkout's own pools stand in
for its release while developing, instead of the pinned release.

> status: shipped — evidence: `mica-build:tools/local-pins.sh`

## 6. Verifying what you built

- `make product-verify PRODUCT=<name>` verifies the product's image against
  the contract; `make os-verify` verifies an assembled image.
- `make os-smoke-test`, `os-smoke-negative-test` and `os-factory-root-gate`
  execute the shipped binaries in the root that ships and prove the negative
  cases fire.
- `make lifecycle-uefi PRODUCT=<name>` runs the QEMU lifecycle suite (boot,
  runtime, updates, faults, reset, shutdown) over a UEFI product.
- `make os-repart-test` proves first-boot growth, and `make os-layout-lint`
  the partition contracts.

> status: shipped — evidence: `mica-build:Makefile`, `mica-build:make product-verify`, `mica-build:make lifecycle-uefi`

## 7. What a build does not do

It does not invent keys or releases: signing inputs are explicit
(`make os-devkeys` creates development inputs), and inputs come from `locks/`.
It does not publish: only a release does
([releasing](releasing.md)).

> status: shipped — evidence: `mica-build:Makefile`, `docs/design/release-signing.md`
