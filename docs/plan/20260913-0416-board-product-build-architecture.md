# 20260913-0416-board-product-build-architecture Define the board/profile/product build architecture for the assembly

- **status**: implementing
- **createdAt**: 2026-09-13 04:16
- **approvedAt**: 2026-09-13 04:35 (user: complete the plan, implementation starts when the split lands)
- **relatedTask**: 20260913-0416-board-product-build-architecture

## Context

Base: `mica-build` at `b97a20bf` (the `mica-boards` import), `mica-boards`
at `047c5a6`, `mica-boot` at `e702216`, `mica-build-env` at `386a2eb`.

### What the repositories already separate

| Concern | Where | Delivered as |
|---|---|---|
| Builder images, packaging contract | `mica-build-env` | source pin `build-env/` |
| Pinned Debian base | `mica-debian` | source pin `rootfs/debian/` |
| UKI/FIT, initramfs, verity, signing inputs, shared kernel floor | `mica-boot` | source pin `boot/` |
| Boards: `board.env`, BSP, board packages, evidence, board tests | `mica-boards/<b>/` | archives `mica-kernel-<b>`, `mica-board-<b>` |
| Userspace packages | `micad`, `mica-deploy`, `mica-podman`, `mica-system` | archives under `deps/packages/` |
| Composition, signing, image, verify, tests | `mica-build` | the assembly |

The producer convention (`Dockerfile` + `producer.env`), the two-class pool
(built here / imported at a pin), the lineage record and `board.env` as a
plain-facts file are sound and are kept. What does not scale is the assembly.

### What still mixes the boards into the assembly

Measured on `mica-build` at `b97a20bf`:

- **48 files read `boards/<b>/board.env`**, and the file is a committed
  copy of what the `mica-kernel-<b>` archive carries, held equal by
  `tools/board-pool.sh --check`. Board discovery is "a directory under
  `boards/` with a `board.env`", so a board exists in two places: its pin
  and its copy.
- **Board names are literals in the engine**: 44 in `Makefile`, 28 in
  `build/src/kernel-package.ts`, 19 in `build/src/component-cli.ts`, 13 in
  `build/src/firmware.ts`, 11 in `build/src/file-image.ts`, 11 in
  `build/src/release-manifest.ts`, 8 in `build/src/image-name.ts`, 6 in
  `build/src/fit-board.ts`, 10 in `verify/src/smoke.ts`. The Makefile has
  per-board targets (`os-rootfs-x64`, `os-rootfs-cx3576`,
  `os-rootfs-virt-arm64`, `os-rootfs-s905x5m`, `os-image-s905x5m-sd`).
  Boot behaviour is keyed by board name where it is a property of the
  backend (`BOOT_BACKEND=systemd-boot|uboot-fit`) or of the image kind
  (disk, SD, update.img).
- **The board's package manifests live in the assembly**:
  `rootfs/packages/board-<b>.pkgs`, `board-radio-<b>-<r>.pkgs`,
  `component-<b>-<c>.pkgs`. The board repository publishes the packages;
  the assembly decides which of them a board installs.
- **There is no image recipe.** What an image is comes from environment
  variables read by an 811-line `rootfs/build.sh`: `MICA_BOARD`,
  `MICA_PROFILE`, `WITH_MICAD`, `WITH_CONTAINERS`, `MICA_ROOTFS_WITHOUT`,
  `MICA_ROOTFS_COMPONENTS`, plus `bsp/containers.env` from the board.
  Features are opt-out; the identity of a build is reconstructed afterwards
  from `rootfs-packages.txt` and the lineage record rather than declared
  before it.
- **Everything builds for everything.** `make os-pool` fetches every pin
  for both architectures; `os-rootfs-manifest-test` resolves every board,
  profile and feature set; `check` runs every board's tests; the CI
  workflow is one job over the whole tree. With 4 boards this is tolerable;
  with 20 it multiplies every change by 20.
- **Tests carry board names in their paths**: `tests/file-ab-x64/` (the
  UEFI lifecycle suite, run for virt-arm64 too), `tests/cx3576-bench/`,
  `tests/signed-boot-lab/cx3576-*`.

Adding a board today therefore touches: `deps/packages/` (2 pins), a
`boards/<b>/` copy, three manifest files, the Makefile, up to eight
TypeScript modules, the manifest test's board list, and CI.

### Industry comparison

| Framework | Board axis | Policy axis | Image axis | Scoping and reuse |
|---|---|---|---|---|
| Yocto / OpenEmbedded | `MACHINE` = a BSP layer (`meta-<bsp>`): kernel, bootloader, DT, `MACHINE_FEATURES`, wic partition layout | `DISTRO` + `DISTRO_FEATURES` | an image recipe: `IMAGE_INSTALL`, `IMAGE_FEATURES`; `core-image-minimal` is a recipe | `bitbake <image>` builds only that closure; sstate cache reuses by input hash; a board is one layer added to `bblayers.conf` |
| Isar | the same `MACHINE`/`DISTRO`/image triad over Debian binary packages and `apt` | idem | idem | the Yocto model without compiling Debian; the closest to Mica's Debian pool |
| Buildroot | `board/<vendor>/<board>/` (overlay, post-image, `genimage.cfg`) + `configs/<board>_defconfig`; `BR2_EXTERNAL` trees for out-of-tree boards | in the defconfig | the defconfig is the image | one target per defconfig; no binary feed, so no cross-board reuse |
| mkosi (systemd) | `mkosi.conf.d/` drop-ins matched on `Architecture=` | `Profiles=` | `Packages=`, sub-images, `mkosi.repart/` partition definitions; emits UKI, verity, signed | one invocation = one image; incremental by cached base tree |
| Ubuntu Core | gadget snap (partition layout, bootloader) + kernel snap | model assertion (brand, store, grade) | the model assertion lists the snaps; `ubuntu-image` assembles signed snaps it never builds | every part is an independently signed artifact; the image is a manifest |
| Android | `device/<vendor>/<board>/`: `BoardConfig.mk`, `device.mk`, the vendor partition (Treble) | build variant (`user`, `userdebug`) | a product (`PRODUCT_PACKAGES`), selected by `lunch <product>-<variant>` | one system image for many boards; board specifics confined to vendor/odm |
| NixOS | `nixos-hardware` module per board | modules and options | a configuration is an expression | closure-addressed store; only the changed derivations rebuild |

What every mature framework has and the assembly lacks:

1. **Three orthogonal axes**, named: *machine* (board), *policy* (distro,
   profile, variant), *image* (product, recipe, model). Mica has the first
   as `board.env` and the second as `MICA_PROFILE`; the third is
   environment variables.
2. **The board is one self-contained unit** the engine discovers, never a
   name the engine knows. Yocto's layer, Buildroot's board directory,
   Android's device directory and Ubuntu Core's gadget all carry the board's
   package list and its partition layout.
3. **Feature gating is declarative and intersected**: `MACHINE_FEATURES`
   says what the hardware has, `IMAGE_FEATURES` what the image wants; the
   resolver takes the intersection and refuses the rest. Minimal is a
   recipe (`core-image-minimal`), not the absence of flags.
4. **Behaviour keys on capabilities, not names**: a bootloader class, an
   image type, a partition table class. Adding a board that reuses an
   existing class costs data, not code.
5. **The build is scoped to one target** and reuse is by input identity.

Ubuntu Core's shape matches Mica most closely -- an assembler that takes
independently signed parts and a manifest that names them -- and it is the
shape this plan completes; the vocabulary is Yocto's because it is the one
board vendors and integrators already know.

Two further comparisons the user asked for:

- **SoC family layer.** Yocto's `conf/machine/include/<soc>.inc` and
  Armbian's `config/sources/families/<family>.conf` hold the kernel and
  U-Boot sources, patch sets and the bootloader write rule once per SoC, so
  a board file is ten to twenty lines of differences. `mica-boards` has no
  such layer: `cx3576/bsp` and `s905x5m/bsp` each carry a full kernel
  Dockerfile and Makefile, and the next Rockchip board would copy cx3576's.
- **Artifact transport.** Armbian publishes every artifact (kernel, U-Boot,
  firmware, bsp, rootfs -- still `.deb` inside) to `ghcr.io/armbian/os` as
  OCI artifacts named by input hash and fetches before building; bootc and
  image mode build the root as an OCI image from distribution packages and
  make that image the unit of test and distribution. None replaces the
  package manager with OCI layers: an OCI layer has no dependency model and
  a later layer overwrites silently. Mica's release channel is already one
  seam (`build-env/deb/registry.env` with `fetch.sh`, `publish.sh`,
  `lock.sh`, `source.sh`) pointed at GitHub Releases of the former organisation, while the
  `mica-kernel-<b>` and `mica-lifecycle` archives are `.deb` files never
  installed into a root and opened with `tools/deb-member.py`.

### Defaults, accounts and first-boot values in the frameworks

| Framework | Build-time image policy (in the root) | First-boot seed (data, not root) |
|---|---|---|
| Yocto | `IMAGE_FEATURES` (`ssh-server-openssh`, `debug-tweaks`, `allow-root-login`), `EXTRA_USERS_PARAMS` | none built in |
| Isar | `image-account-extension`: `USERS`, `USER_x[password]`; `ROOTFS_FEATURES` | none |
| mkosi | `RootPassword=`, `Ssh=`; systemd credentials `passwd.hash-password.root`, `ssh.authorized_keys.root` | `firstboot.*` credentials |
| Armbian | `BUILD_MINIMAL`, extensions | `PRESET_ROOT_PASSWORD`, `PRESET_USER_*`, `PRESET_NET_WIFI_*` in `userpatches/config-*.conf` |
| Raspberry Pi OS | none | `custom.toml` on the boot partition: `[system]`, `[user]`, `[ssh]`, `[wlan]`, `[locale]` |
| Ubuntu Core | model assertion; `gadget.yaml` `defaults:` per snap | signed `system-user` assertion |
| Android | `PRODUCT_PROPERTY_OVERRIDES`, runtime resource overlays (`def_bluetooth_on`) | OEM partition |

Mica already has the seed tier -- `mica-provisioning.toml` on the boot
medium or removable media (`docs/design/provisioning.md` §4.1) and the
`/mica/config/` pour -- and the invariant that no secret is baked into the
byte-identical verity root (the pack stage fails a usable shadow hash). What
it lacks is a **product-level, non-secret defaults tier** between the code
defaults and DATA/state (SSH on, port, MQTT on, timezone, NTP), and a
`bluetooth` section in the settings tree at all (`micad-settings` models
hostname, network, access, provisioning, wifi, container, mqtt, time,
reset).

## Prerequisites

Implementation starts when `20260913-1600-split-boot-and-boards` is
complete, which means, checked at the start of phase 1:

- `mica-build` main imports every board through `deps/packages/
  mica-kernel-<b>.json` and `mica-board-<b>.json`, builds no kernel, and
  `tools/board-pool.sh --check` is green;
- `mica-boards` main publishes the four boards' pools as one release;
- `mica-boot` is pinned at `boot/` in both;
- the x64 image composes, verifies and passes the release gate from those
  pins (the split plan's own verification).

Work runs on `x64` first for every phase, then `virt-arm64`, then the two
FIT boards; a phase is complete when all four boards pass its
verification. Long builds run in tmux; every produced image is named with
its source commits in the delivery record.

## Proposal

Three declared axes and one generic engine:

```
board    mica-boards/<b>/        MACHINE   board.env, manifests/, bsp/, deb/, tests/; families/<soc>/ shared per SoC
                                           -> the board bundle (mica-kernel-<b>) and the board packages, published
profile  mica-build/profiles/    DISTRO    dev | prod: trust and access policy (mica-profile-* packages)
product  mica-build/products/    IMAGE     one directory: product.env, meta/, defaults.toml, provisioning.toml
engine   mica-build/{rootfs,build,verify}  no board name anywhere: resolve -> fetch -> compose -> sign -> image -> verify
```

### C1. Board bundle contract v2

What `mica-kernel-<b>` carries, under `/usr/lib/mica/board/<b>/` while it
is a `.deb` (phase 1) and as one layer per file once it is an OCI artifact
(phase 6):

| Path | Required | Consumer |
|---|---|---|
| `board.env` | yes | every host-time reader, through `_out/boards/<b>/` |
| `evidence.json` | when the board carries one | release manifest |
| `manifests/board.pkgs` | yes | the resolver |
| `manifests/radio-<r>.pkgs` | per radio in `BOARD_FEATURES` | the resolver |
| `manifests/component-<c>.pkgs` | per optional component | the resolver |
| `kernel/{Image\|bzImage,config,kernel.release,modules.tar,*.dtb}` | yes | kernel component |
| `firmware/*`, `component-copyright` | when `BOARD_FIRMWARE_FILES` is non-empty | support image |
| `uboot/*` | when `BOOT_BACKEND=uboot-fit` | firmware package, image |
| `trust/verity-signer.cert.pem` | yes | `board-fetch` refuses a mismatch |
| `containers.env` | removed | the product decides features |

`board.env` keys added and retired:

| Key | Change |
|---|---|
| `BOARD_FEATURES` | new; space-separated subset of the vocabulary `wifi bluetooth display status-led can usb-gadget audio containers`; `containers` means the board has room for the engine, not that an image ships it |
| `BOARD_FAMILY` | new; a directory under `mica-boards/families/` |
| `IMAGE_KINDS` | new; subset of `disk sd rockchip-update`; `disk` is the factory image of every board today, `sd` is s905x5m's SD image, `rockchip-update` is `20260912-2251` |
| `BOARD_RADIOS`, `BOARD_HAS_STATUS_LED`, `BOARD_HAS_DISPLAY` | derived from `BOARD_FEATURES` by `verify/src/board-env.ts` during phase 1; deleted from the board files in phase 3 when the last reader is re-keyed |

The manifest format and refusals are those of `rootfs/packages/README.md`
today; only the location and the family prefixes change (`board.pkgs`,
`radio-<r>.pkgs`, `component-<c>.pkgs`, no board name in the file name
because the directory is the board).

### C2. Family layer

```
mica-boards/families/<family>/
  family.env            KERNEL_SOURCE, KERNEL_REF, UBOOT_SOURCE, UBOOT_REF, patch directories, FIT parameters
  kernel/Dockerfile     the shared kernel build; takes the board's defconfig, DT list and patches as build contexts
  uboot/Dockerfile      when the family boots through U-Boot
  Makefile.inc          the kernel, kernel-config and uboot targets a board's bsp/Makefile includes
mica-boards/<b>/bsp/
  Makefile              `include ../../families/$(BOARD_FAMILY)/Makefile.inc` plus board-only targets (flash)
  kernel/config/        the board's defconfig and fragments
  kernel/dts/           the board's device tree sources or the list of in-tree DTBs
  patches/              board-only patches
  rootfs/firmware/      the firmware inputs
```

Families at the end of phase 1: `uefi` (x64, virt-arm64), `rockchip`
(cx3576), `amlogic` (s905x5m). A family is data plus two Dockerfiles; the
kernel-config floor test runs per board as today.

### C3. Product directory

```
products/<name>/
  product.env          composition: what the signed root contains
  meta/                the public factory manifest (today's MICA_META_DIR), baked into the root
  defaults.toml        product-level settings defaults, non-secret, baked as /usr/lib/mica/defaults.toml
  provisioning.toml    optional factory seed: today's mica-provisioning.toml, written to the image's
                       boot medium, never into the root; secrets allowed
```

`product.env` keys, plain `KEY=value`, all required except `COMPONENTS`:

| Key | Rule |
|---|---|
| `PRODUCT` | equals the directory name; the image name prefix |
| `BOARD` | a pinned board |
| `PROFILE` | `dev` or `prod` |
| `FEATURES` | subset of the engine's `feature-*.pkgs` and `radio-*.pkgs` names; a radio must be in the board's `BOARD_FEATURES`; `containers` requires `containers` in `BOARD_FEATURES` |
| `COMPONENTS` | subset of the board's `manifests/component-*.pkgs` |
| `IMAGE_KINDS` | subset of the board's `IMAGE_KINDS` |
| `SIZE_BUDGET_MB` | optional; defaults to the board's `BOARD_SIZE_BUDGET_MB`, may only lower it |

`defaults.toml` sits between the code defaults and DATA/state (code <
product < device), in the settings tree's own shape:

```
version = 1
[access.ssh]
enabled = true                 # prod products: only with passwordAuthentication = false
port = 22
passwordAuthentication = false
[mqtt]
enabled = true
[time]
timezone = "Asia/Shanghai"
[time.ntp]
servers = ["ntp.aliyun.com"]
[bluetooth]                    # new section in micad-settings: enabled, discoverable, pairableTimeoutSeconds
enabled = true
discoverable = false
```

Rules: validated by `micad-settings` itself (unknown keys refused) at
compose time through `micad-settings validate --defaults FILE` run in the
`mica-build-rust-check` image, so a bad file fails the build and not the
first boot; a key the redactor names as secret (`psk`, `password`,
`passwordHash`, `pin`, `key`) is refused in `defaults.toml`, so a password
or a Bluetooth PIN can only travel in `provisioning.toml`; `[access.ssh]
enabled = true` with `passwordAuthentication = true` is refused for
`PROFILE=prod`; a product carrying `provisioning.toml` is marked
`factory-seeded` in the lineage record, which the release gate refuses on
the prod channel. A Bluetooth PIN follows the AP PSK precedent: minted per
device at first boot, never a fleet constant. The `micad` side is
`20260913-0440-micad-product-defaults`; until it lands, `defaults.toml` is
validated for shape only and not composed.

Every board has `products/<b>-minimal/` with `FEATURES=""`: the floor
(`common.pkgs`: `mica-system`, `mica-deploy`, `mica-ca-trust`,
`mica-busybox`) plus the board package. Today's four release images become
`products/x64-dev/`, `virt-arm64-dev/`, `cx3576-dev/`, `s905x5m-dev/` with
the features they carry now, written explicitly.

`rootfs/packages/resolve.sh --product <name>` replaces the four-argument
form. Retired inputs: `MICA_BOARD`, `MICA_PROFILE`, `WITH_MICAD`,
`WITH_CONTAINERS`, `MICA_ROOTFS_WITHOUT`, `MICA_ROOTFS_COMPONENTS`,
`MICA_META_DIR`, `bsp/containers.env`. `MICA_PRODUCT` is the one input.

### C4. Engine dispatch and the lint

`build/src/backends/uefi.ts` and `backends/uboot-fit.ts` (today's
`fit-board.ts`, `fit-environment.ts` and the halves of
`kernel-package.ts`, `firmware.ts`, `file-image.ts` that switch on the
board), selected by `BOOT_BACKEND`; `build/src/images/{disk,sd,rockchip-update}.ts`
selected by `IMAGE_KINDS`. `image-name.ts` derives names from `PRODUCT`
(`<product>-<UTC>.img`, `<product>-latest.img`); `IMAGE_NAME_*` leave
`board.env`. `verify/src/smoke.ts`, `release-manifest.ts`, `seed-data.ts`
and `component-cli.ts` take `--product` and read the board through
`_out/boards/<b>/board.env`.

`tests/board-name-lint.sh`: reads the board names from
`deps/artifacts/mica-kernel-*.json` (`deps/packages/` before phase 6) and
refuses any occurrence as a word in `Makefile`, `build/src`, `verify/src`,
`rootfs/`, `tools/`, `.github/workflows/`, excluding `products/`,
`deps/`, `_out/` and fixture directories named in an allowlist file beside
the lint that must be empty at the end of phase 3. Negative fixture: a copy
of `build/src/paths.ts` with one literal added must fail.

### C5. Targets

Final Makefile surface of the assembly; everything else routes through
these or is deleted:

| Target | Does |
|---|---|
| `deps`, `deps-check`, `deps-bump DEP=` | source pins, unchanged |
| `build-env` | builder images, unchanged |
| `board-add BOARD=<b>` | writes `deps/artifacts/mica-kernel-<b>.json`, `mica-board-<b>.json` from the latest `mica-boards` release and `products/<b>-minimal/` |
| `board-fetch BOARD=<b>` | the bundle into `_out/boards/<b>/`; refuses a trust certificate mismatch |
| `product PRODUCT=<name>` | resolve; fetch the pins the resolution names for the board's arch; compose; root, kernel, firmware, two deployments; every `IMAGE_KINDS`; into `_out/products/<name>/` with the lineage record; a no-op when inputs are unchanged |
| `product-verify PRODUCT=<name>` | `os-verify` and the backend's lifecycle suite over that product's image |
| `product-release PRODUCT=<name>` | the release gate and the publish |
| `products` | `product` for every product whose board has `BOARD_RELEASE_TARGET=1` |
| `check` | lint, board-name lint, manifest test over every product, build and verify suites, closure gate |

`os-rootfs-<b>`, `os-image-s905x5m-sd`, `os-board-kernel`, the `<board>-%`
rules, `os-components`, `os-image`, `os-rootfs-manifest-test`'s board loop
are deleted or folded into the table; `make help` is generated from it.

### C6. Artifacts on GHCR

Decision (`docs/decisions/2026-09-13-ghcr-artifact-registry.md`): the
registry is GHCR (`ghcr.io/<former organisation>/`), no dependency on `git.ds.cc`
packages, every artifact OCI-compatible. Transport and package format are
separate answers:

| Artifact | Reference | Format |
|---|---|---|
| Userspace package pool of one repository | `ghcr.io/<former organisation>/mica-pool/<repository>/<arch>:build-<commit12>` | OCI artifact: the `.deb` files and `Packages` index as layers, `application/vnd.mica.deb` and `application/vnd.mica.packages-index` |
| Board bundle | `ghcr.io/<former organisation>/mica-board/<b>:build-<commit12>` | OCI artifact: one layer per C1 file, media types `application/vnd.mica.board.<kind>`, annotations `mica.board`, `mica.arch`, `mica.verity-cert-sha256`, `mica.source-commit` |
| Lifecycle binaries | `ghcr.io/<former organisation>/mica-lifecycle/<arch>:build-<commit12>` | OCI artifact, one layer per binary |
| Product root | `ghcr.io/<former organisation>/mica-root/<product>:build-<commit12>` | OCI image, the composed root `rootfs/compose` exports today as `factory-root.oci` |
| Source pin | `ghcr.io/<former organisation>/mica-source/<repository>:build-<commit12>` | OCI artifact, one tarball layer |

`deps/artifacts/<name>.json`:

```
{ "kind": "pool" | "board" | "lifecycle" | "source",
  "repository": "micad", "commit": "<40 hex>",
  "ref": "ghcr.io/<former organisation>/mica-pool/micad/arm64:build-6211503847b9",
  "digest": "sha256:..." }
```

`build-env/deb/{fetch,publish,lock,source}.sh` gain the OCI backend behind
`registry.sh` (`MICA_REGISTRY=ghcr.io/<former organisation>`, token from `GH_TOKEN`),
`oras` pinned in `images.env` and run from the `mica-build-base` image;
GitHub Releases are no longer written; `tools/deb-member.py` retires.

### Work packages

Each package names its repository, its files, its commit order and its
proof. A package lands as one reviewed change per repository, board
repository first, published, then the assembly bumps the pin.

**Phase 1 -- board contract v2 and the family layer**

| # | Repository | Change | Proof |
|---|---|---|---|
| 1.1 | `mica-boards` | `<b>/manifests/` from the assembly's three manifest families; `BOARD_FEATURES`, `BOARD_FAMILY`, `IMAGE_KINDS` in every `board.env`; `deb/kernel-<b>/prepare.sh` stages `manifests/`; `containers.env` deleted (s905x5m) | `make pool`, `make package-gate`; `dpkg-deb -c` of each bundle lists `manifests/` |
| 1.2 | `mica-boards` | `families/{uefi,rockchip,amlogic}/` per C2; each `<b>/bsp/Makefile` includes its family; the kernel Dockerfiles de-duplicated into the family with the board's config and DT as contexts | `make <b>-kernel` for all four; `kernel.release`, `config` and `Image`/`bzImage` sha256 equal to the pre-change build from the same pins |
| 1.3 | `mica-boards` | `make publish`; `docs/boards/contract.md` and `board-template.md` in `mica` rewritten to C1 and C2 | release exists; `make docs-verify` |
| 1.4 | `mica-build` | `tools/board-pool.sh --kernel` becomes `board-fetch` (extracts `manifests/`, refuses a trust mismatch, no `--check`); `verify/src/board-env.ts` derives `BOARD_RADIOS`/`BOARD_HAS_*` from `BOARD_FEATURES`; every reader of `boards/<b>/board.env` re-pointed to `_out/boards/<b>/board.env` (48 files, listed by `grep -rl boards/ --include=*.sh --include=*.ts --include=*.py`); `boards/` deleted; `rootfs/packages/board-*.pkgs`, `board-radio-*`, `component-*` deleted and `resolve.sh` reads them from `_out/boards/<b>/manifests/`; `shippedBoards()` lists the pins | `make os-pool`; x64 and cx3576 `rootfs-packages.txt` identical to the pre-change composition; `make os-build-test os-verify-test os-rootfs-manifest-test`; x64 image passes `os-verify` |

**Phase 2 -- products**

| # | Repository | Change | Proof |
|---|---|---|---|
| 2.1 | `mica-build` | `products/<b>-minimal/` and `products/<b>-dev/` for the four boards; `product.env` validator in `rootfs/packages/resolve.sh --product`; `meta/` per product replaces `MICA_META_DIR` (`meta.example/` moves to `products/x64-dev/meta/`) | `resolve.sh --product x64-dev` equals today's `--board x64 --profile dev --radios "" --without ""` byte for byte, likewise the other three; every refusal in `tests/rootfs-manifest-test.sh` re-keyed and red on its fixture |
| 2.2 | `mica-build` | `rootfs/build.sh` takes `MICA_PRODUCT` only; the retired variables refused by name; `defaults.toml` shape-validated and, once `20260913-0440` is pinned, composed to `/usr/lib/mica/defaults.toml`; lineage record carries the product and `factory-seeded` | four minimal images compose and pass `os-verify`; installed size per product in the delivery record; a `defaults.toml` with `password =` fails compose; a prod product with password SSH fails compose |
| 2.3 | `mica-build` | `seed-data.ts` writes `provisioning.toml` to the image's boot medium when present | `tests/file-ab-x64` provisioning row green on a seeded x64-dev image |
| 2.4 | `mica` | `docs/design/build.md` §1.1 and §3, `access.md` §5.3, `provisioning.md` §4.1 gain the product tier | `make docs-verify` |

**Phase 3 -- dispatch and the lint**

| # | Repository | Change | Proof |
|---|---|---|---|
| 3.1 | `mica-build` | `build/src/backends/`, `build/src/images/` per C4; `component-cli.ts` and `verify` take `--product`; `image-name.ts` from `PRODUCT`; `IMAGE_NAME_*` dropped from `board.env` (a `mica-boards` change published first) | `make os-build-test os-verify-test`; x64 and cx3576 images verify; the signed-boot lab green for both backends |
| 3.2 | `mica-build` | `tests/board-name-lint.sh` with its negative fixture, wired into `check`; the allowlist emptied; `BOARD_RADIOS`/`BOARD_HAS_*` deleted from the board files | the lint is green with an empty allowlist; the fixture is red |

**Phase 4 -- one product, one closure**

| # | Repository | Change | Proof |
|---|---|---|---|
| 4.1 | `mica-build-env` | `deb/fetch.sh --packages <list>`; published | a fetch of x64-minimal's resolution downloads no arm64 archive and no `micad` |
| 4.2 | `mica-build` | `make product`, `product-verify`, `product-release`, `products`, `board-add` per C5; `_out/products/<name>/`; the reuse check over the lineage record; the deleted targets gone; `make help` generated | `make product PRODUCT=x64-minimal` from a clean clone; a second run is a no-op; `make board-add` on a fixture release writes the two pins and the product |
| 4.3 | `mica-build` | `check.yml`: a `products` matrix from `products/*/product.env`; path filter so a `mica-kernel-<b>` pin change selects only that board's products; `os-rootfs-manifest-test` over products | one CI job per product; a pin bump of cx3576 runs cx3576's products only |

**Phase 5 -- tests, template, onboarding proof**

| # | Repository | Change | Proof |
|---|---|---|---|
| 5.1 | `mica-build` | `tests/file-ab-x64/` -> `tests/lifecycle-uefi/`, `tests/file-ab-fit/` -> `tests/lifecycle-uboot-fit/`, both keyed by `MICA_PRODUCT`; `tests/cx3576-bench/` and `tests/signed-boot-lab/cx3576-*` to `mica-boards/cx3576/tests/`; the API harness takes a product | both suites green on x64-dev and virt-arm64-dev; the moved tests run from `mica-boards` `make check` |
| 5.2 | `mica-boards`, `mica` | `template/` board directory; `docs/boards/porting.md` rewritten to the C1-C5 sequence | `make docs-verify` |
| 5.3 | both | dry run: `virt-arm64-proof` cloned from the template, published, `make board-add`, `make product PRODUCT=virt-arm64-proof-minimal`, then deleted | the assembly diff of the dry run touches only `deps/` and `products/` |

**Phase 6 -- OCI on GHCR**

| # | Repository | Change | Proof |
|---|---|---|---|
| 6.1 | `mica-build-env` | `oras` in `images.env`; the OCI backend behind `registry.sh` (`fetch`, `publish`, `lock`, `source`), pool artifacts per C6; the release-asset code deleted; published | a package repository's `make publish` pushes one artifact per arch; `make deps` in a consumer pulls source pins from GHCR |
| 6.2 | `mica-boards` | `deb/kernel-<b>/` becomes `bundle/<b>/` pushing the board bundle per C6; `mica-deploy` pushes `mica-lifecycle` likewise | the bundle's manifest lists the C1 files with their media types and annotations |
| 6.3 | `mica-build` | `deps/artifacts/` replaces `deps/packages/` and `deps/sources/`; `board-fetch` reads an OCI layout; `deb-member.py` deleted; `product-release` pushes the product root image | a product builds from a clean clone with GHCR as the only remote; `deps-bump` rewrites one digest |
| 6.4 | `mica` | `docs/design/release-artifacts.md`, `build.md` §1.1 rewritten; the decision record's status | `make docs-verify` |

Phases 1-2 are sequential; 3, 4, 5 and 6 follow 2 and are independent of
each other, except that 6.2 follows 1.1 and 5.3 follows 4.2.

### Verification

Per phase, in the tables above. Plan-level, at the end:

- a new board is added to the assembly by `make board-add` and one product
  directory, with no source edit, proven by the phase 5 dry run;
- `make product PRODUCT=<name>` builds one product's closure only, proven
  by the fetch log and by a second run being a no-op;
- the board-name lint is green with an empty allowlist;
- every board has a minimal product that composes, verifies and has its
  installed size on record;
- every artifact the assembly consumes is a GHCR digest.

## Risks

- The 48 `board.env` readers move to `_out/boards/<b>/` in one step; a
  reader left on `boards/<b>/` fails on a missing file. Mitigated by
  deleting `boards/` in the same commit so nothing can pass by accident.
- The family de-duplication (1.2) rebuilds every kernel; the proof is a
  byte-identical `Image`/`bzImage` from the same pins, and a difference
  stops the phase until explained.
- Retiring `WITH_*`, `MICA_ROOTFS_WITHOUT` and `MICA_META_DIR` breaks any
  operator script that sets them; there is no compatibility shim by design,
  and the changelog says so.
- Opt-in features change the default: a product that forgets `micad` gets
  the minimal image. That is the intended reading, and the products for
  today's four images are written explicitly in 2.1.
- Backend dispatch touches the signed-boot code paths; each backend keeps
  its lifecycle suite and the signed-boot lab, run over the product images
  before and after phase 3.
- Phase 6 changes every consumer's fetch path at once; the substrate is
  published first and each consumer bumps its pin in turn, exactly as the
  split did for the rename.
- `20260912-2043-unify-board-behavior` (draft) also proposes shared policy
  at the board boundary; this plan supplies the boundary it needs
  (`BOARD_FEATURES`, backend dispatch) and neither reopens the other's
  compression or signing-profile scope.

## Scope

`mica-build`: `Makefile`, `rootfs/build.sh`, `rootfs/packages/`,
`build/src/`, `verify/src/`, `tools/board-pool.sh`, `tests/`, `deps/`,
`.github/workflows/check.yml`, new `products/`.
`mica-boards`: `<b>/manifests/`, `<b>/board.env`, `<b>/bsp/`,
`<b>/deb/kernel-<b>/` (later `bundle/`), `<b>/tests/`, `families/`,
`template/`. `mica-build-env`: `deb/{registry,fetch,publish,lock,source}.sh`,
`images.env` (`oras`). `mica-deploy`: the `mica-lifecycle` publish.
`mica`: `docs/boards/contract.md`, `porting.md`, `board-template.md`,
`docs/design/build.md`, `build-harness.md`, `architecture.md`,
`release-artifacts.md`, `access.md`, `provisioning.md`, the decision
record. In `micad`, as `20260913-0440-micad-product-defaults`: the
defaults layer, the validator CLI and the `bluetooth` section. Not in
scope: the signing model, any BSP's kernel or U-Boot content, the update
server, the compression and algorithm work of the unify plan, replacing
the Debian base.

## Alternatives

- **Adopt mkosi as the engine.** Its `[Match]`, profile and repart model is
  the pattern, and it emits UKI and verity natively; but it has no U-Boot or
  FIT path and no place for Mica's signed component and deployment
  contract, so it would replace the UEFI half and leave the FIT half as it
  is. Rejected; the pattern is taken, the tool is not.
- **Adopt Isar (bitbake over Debian).** The full triad and sstate for free,
  at the cost of replacing every producer, the pool, the pins and the
  packaging contract with recipes, and of bitbake as the one entry point.
  Rejected as a rewrite of what already works.
- **Keep the tree and add `<board>-%` rules and manifests per board.** What
  the tree does today; each board is another row in the Makefile, another
  literal in eight modules and another copy in `boards/`. Rejected: it is
  the failure mode this plan exists for.
- **OCI layers instead of `.deb` for the userspace packages.** Rejected:
  it rewrites dependency resolution, conflict detection, ownership and
  four gates for no runtime gain, since the device never pulls layers.
- **Dropping the Debian base.** Buildroot or Yocto territory: systemd,
  glibc, bluez, wpa_supplicant, openssh and e2fsprogs built here and their
  CVE response owned here. Rejected; the pins exist to avoid exactly that.
- **One repository per board** (tried 2026-09-13 morning and folded back
  into `mica-boards` on the user's instruction). Orthogonal to this plan:
  the board contract here is the same whether the board directories share a
  repository or not.

## Annotations

- 2026-09-13 04:16: created from the user's request to abstract the build
  architecture against the industry frameworks so that 10-20 boards can be
  assembled and built automatically, with a minimal image per board. Awaits
  approval.
- 2026-09-13 04:25: on the user's questions, the Yocto and Armbian models
  were compared in detail; the SoC family layer (section 1) is taken from
  them.
- 2026-09-13 04:30: on the user's request, Isar was added to the comparison
  and the defaults question (default account, SSH, Bluetooth PIN) answered
  with the three-tier product directory of section 2; the `micad` side is
  a separate task.
- 2026-09-13 04:32 (user): the registry is GHCR, with no dependency on
  `git.ds.cc`, and everything from here on is OCI-compatible; section 7 and
  phase 6 record it. `.deb` stays the format of the userspace packages;
  OCI is the transport for all artifacts and the format for the board
  bundles, the lifecycle binaries and the product root.
- 2026-09-13 04:35 (user): complete the plan; implementation starts when
  `20260913-1600-split-boot-and-boards` lands. Approved on that condition:
  the proposal is restated as contracts C1-C6 and work packages per phase
  with their proofs; the `micad` side is `20260913-0440-micad-product-defaults`.
- 2026-09-13 08:30: phase 1 landed. `mica-boards` `f4ad268` (release
  `build-f4ad2684729f`): 1.1 manifests, `BOARD_FEATURES`/`BOARD_FAMILY`/
  `IMAGE_KINDS`, `containers.env` retired, `tests/board-contract-test.sh`;
  1.2 the family layer (`families/{uefi,rockchip,amlogic,common}`), every
  kernel rebuilt through its family byte-identical to a pre-change build
  of the same pins (x64 and virt-arm64 against a rebuild with the old
  Dockerfiles, cx3576 against its fresh baseline; s905x5m identical in
  config, release, System.map, DTB and modules, its `Image` carrying a
  vendor build stamp recorded as `20260913-0755-s905x5m-build-determinism`);
  1.3 the contract docs. `mica-build` `46537bc6`: 1.4, `boards/` and the
  board manifests deleted, discovery from the pins, `board-fetch`, the
  resolver's `--board-dir`; build (538), verify (904), manifest, layout
  and netavark suites green. Deviations from the plan text: `IMAGE_KINDS`
  vocabulary is `disk rockchip-update` (s905x5m's SD image is its `disk`);
  `BOARD_RADIOS`/`BOARD_HAS_*` stay in `board.env` beside `BOARD_FEATURES`
  until phase 3 re-keys their readers, rather than being derived now; the
  amlogic and rockchip families keep single-board hooks (the generic
  Dockerfile plus `hooks/`) until a second board of each arrives.
- 2026-09-13 10:30: phase 2 landed in `mica-build` (`3c201969` products,
  `7bc81cb2` the factory seed, and the smoke scoping that follows): 2.1
  `products/<name>/` with `tools/product.sh` the one reader and eight
  products (`<board>-dev`, `<board>-minimal`); 2.2 `MICA_PRODUCT` the
  composer's one input, the retired variables refused by name, `resolve.sh
  --features` opt-in, `make os-rootfs PRODUCT=`, the composition record
  carrying product, features, components and `factory-seeded`; 2.3
  `--provisioning` on the image command (ESP only; a FIT board refuses by
  name); 2.4 the design records. Proof: `x64-dev` composes the same
  eleven packages as the pre-change x64 root (198 MB installed);
  `x64-minimal` composes six (108 MB), and the smoke runner now executes
  what the root carries (each register entry names its owning package;
  coverage is still judged over the whole register). Deviations:
  `defaults.toml` is validated with the host Python's `tomllib`/`tomli`
  rather than a `micad-settings` CLI until `20260913-0440` lands;
  `_out/<board>/` stays the output directory until phase 4's
  `_out/products/<name>/`; the `provisioning.toml` boot proof through the
  lifecycle suite is deferred to phase 5 with that suite's re-keying.
- 2026-09-13 11:40: phase 3 landed. `mica-boards` `0ff6d58` (release
  `build-0ff6d58798cb`): `board.env` declares the authenticated boot --
  `FIRMWARE_FORMAT`, `FIT_DTB`, `FIT_WATCHDOG`, `FIT_LOAD_ADDRESSES`, the
  boot0 bounds, and `BOARD_CMDLINE_ARGS` as the exact authenticated line on
  every board -- asserted by the contract test, which also holds
  `BOARD_RADIOS`/`BOARD_HAS_*` to `BOARD_FEATURES`. `mica-build` `83ba78c4`:
  `build/src/board-facts.ts` and every branch on a board's name re-keyed to
  a fact (kernel and firmware packagers, the firmware manifest parser with
  optional exact facts, the image assembler, the FIT firmware region, the
  release manifest, the CLIs, image names, the verifier's board model);
  `tests/board-name-lint.sh` green with an empty allowlist and red on a
  planted literal; build (548), verify (904), layout, manifest, product
  and netavark suites green. Deviations: the `backends/` and `images/`
  module split of C4 is not made -- the dispatch lives in the modules that
  already own each concern, keyed by `facts.backend` and
  `facts.firmware.format`, which the lint holds just as well; image names
  still carry the board (`mica-<board>-<UTC>.img`) until phase 4 names them
  by product; `BOARD_RADIOS`/`BOARD_HAS_*` stay in `board.env` as readings
  of `BOARD_FEATURES` (the board packages' Dockerfiles and the compose
  stages still read them), enforced equal by the contract test, deleted
  with phase 5's test re-keying; tests/ and the workflows are outside the
  lint's scope until phase 5 re-keys them.
- 2026-09-13 13:30: phase 4 landed in `mica-build` (`dd3a65fe` the product
  driver, `20ca4133` the CI matrix and the scoped fetch, `4cf3d42a` and
  `e3759e2a` the verifier scoped to the product) and `mica-build-env`
  (`a743f83`, `fetch.sh --packages`, pinned as `build-a743f8394521`).
  `make product PRODUCT=<name>` resolves the product's closure, fetches
  exactly that plus the board bundle and the lifecycle binaries, composes,
  signs root, kernel and firmware, two deployments, the image and the
  update archive under `_out/products/<name>/`, and records a receipt; a
  second run with unchanged inputs is a no-op (proved on `x64-minimal`).
  The root carries `/usr/lib/mica/product.conf` (declared among the public
  files the runtime selection keeps), and the verifier runs only the checks
  whose features the product selected, reporting the rest as NOT RUN:
  `make product-verify PRODUCT=x64-minimal` passes (68 checks, 36 not
  run). `check.yml` gains one job per product, selected by the push's
  diff. Deviations: the composition still writes to `_out/<board>/` (one
  composition per board at a time; the product directory holds the
  components and the image); `os-image`, `os-components`, `os-verify`
  remain as the building blocks the driver calls.
- 2026-09-13 09:48: phase 5 landed, and the onboarding dry run did what it
  was for: it found five places a new board still had to be typed in, and
  each is now a rule instead of a list. `mica-boards` (`0c877ef`,
  `bc2ea38`, release `build-bc2ea38c5931`): the Makefile discovers a board
  by its `board.env`; `tools/new-board.sh <new> --from <existing>` is the
  template (a copy with fresh GPT, filesystem and ESP identities, the name
  rewritten, `BOARD_RELEASE_TARGET=0`); every `mica-board-<b>` provides and
  conflicts with the virtual `mica-board` instead of enumerating its
  siblings; the cx3576 bench collector lives at `cx3576/tests/bench`.
  `mica-build-env` (`f9e9c57`, `6fd51c9`): the package gate resolves
  Conflicts through virtual names; `lock.sh --bump` takes the newest
  release by its commit date (the listing is unordered, and `board-add`
  had pinned an older one). `mica-debian` (`01aa376`): `consumers.pkgs`
  names a family `mica-board-*`, so a new board's package selects the
  family's ten Debian packages with no lock entry; more is a named
  consumer and a lock change. `mica-build` (`674d972e` .. the dry run):
  `rootfs/runtime/consumers.json` likewise declares `mica-board-*` once
  for the identical board declarations (s905x5m keeps its own);
  `tests/lifecycle-uefi/` and `tests/lifecycle-uboot-fit/` keyed by
  product (`product-inputs.sh`, `make lifecycle-uefi PRODUCT=`), the API
  harness by `MICA_PRODUCT` (its `qemu.ts` reads the board's facts, and
  its imports of `build/src/` resolved five directories up since the
  import from `micad` -- it had not run since); `verify/run.sh` anchored
  on `deps/packages` rather than the `boards/` directory the split
  removed (an empty leftover had kept it green); `make product` builds the
  packager image it runs (the arm64 one predated the `mica-init` rename)
  and stages the bundle's FIT tools executable; the pack stage asserts the
  radios the product selected (`MICA_RADIOS`), not the board's; the regdb
  checks are `wifi` checks. Every board's minimal product composes and
  verifies: virt-arm64 137 MB (68 checks), cx3576 137 MB (69),
  s905x5m 143 MB (68), beside x64-minimal 108 MB and x64-dev 198 MB
  (104). The dry run: `make board-add BOARD=virt-arm64-proof` wrote two
  pins and `products/virt-arm64-proof-minimal/` and nothing else, and
  `make product PRODUCT=virt-arm64-proof-minimal` built and verified; the
  board, its pins and its product are then deleted. Deviations: there is
  no `template/` directory, the template is the nearest board through
  `new-board.sh --from`; `tests/signed-boot-lab/cx3576-*` stay in the
  assembly (they read the fetched bundle and the lab images there);
  `make lifecycle-uefi` runs the suite's assembly stage (green on x64-dev),
  the boot-driven stages stay hand-run as before; `BOARD_RADIOS` and
  `BOARD_HAS_*` remain in `board.env` as the board packages' own readings
  (the assembly reads neither); `tests/` stays outside the board-name
  lint (`runtime-build.sh`, `selftest.ts` name the two QEMU boards).
- 2026-09-13 16:30 (user): "全部处理，到所有阶段完成" -- phase 6 and
  the coupling phase 5 left are to be finished. Phase 7, on that
  instruction, is what phase 5's assessment listed: `privileged.yml`
  keyed by product (it still calls the per-board targets phase 4
  removed); `mica-boards:release.yml` building every discovered board
  rather than a typed list; `BOARD_RADIOS`/`BOARD_HAS_*` deleted from
  `board.env`; the tests under `tests/` re-keyed off board names and the
  board-name lint extended over them; the composition directory per
  product (`_out/products/<name>/compose`) rather than per board; the
  lifecycle suite's boot-driven stages behind `make lifecycle-uefi`.
- 2026-09-13 17:04: phases 6 and 7 landed in code; the registry migration
  is the runbook `20260913-1700-registry-migration` and waits on a token
  with the packages scopes (this workspace's has none; GHCR refused every
  push). Phase 6: `mica-build-env` (`775c90e`, `3b1c8d0`) -- `deb/oci.sh`,
  a curl/jq client of the Distribution API with its token challenge, and
  `registry.sh`, `fetch.sh`, `lock.sh`, `publish.sh`, the vendored
  `tools/deps.sh` over it: a repository's pool is
  `mica-pool/<repo>/<arch>:build-<commit12>` (one layer per archive), a
  source tree `mica-source/<repo>:build-<commit12>` (one tarball layer),
  every manifest annotated with the commit, its date and the repository,
  the newest artifact the one created last; a pin's sha256 is the blob's
  digest, so the pin format did not change and GitHub Releases are neither
  written nor read. `mica-boards` (`375cdb9`): `tools/publish-boards.sh`
  pushes each board's bundle as `mica-board/<board>:build-<commit12>`, one
  layer per bundle file (`firmware/` as one tar), annotated `mica.board`,
  `mica.arch`, `mica.verity-cert-sha256`, `mica.source-commit`; `make
  publish` runs it. `mica-build` (`9d830caa`): `deps/boards/<board>.json`
  pins the bundle's manifest digest, `tools/board-pool.sh --pin/--fetch`
  write and read it (the kernel-archive path stays until every board is
  re-pinned, marked TRANSITIONAL), `make board-add` is `--pin` plus the
  board's packages, `tools/product-release.sh` pushes a product's composed
  root as `mica-root/<product>:build-<commit12>` blob for blob. Proof:
  `build-env/tests/oci-test.sh` (22 checks: publish, lock, fetch, deps
  publish-source/bump/fetch and every refusal) and
  `tests/board-artifact-test.sh` (9) against a registry container, both in
  `check.yml`; `product-release.sh` pushed x64-minimal's root to a local
  registry and read the manifest back at its digest. Deviations from C6:
  no `oras` and no `deps/artifacts/` -- the client is curl (nothing to pin,
  no container for a fetch) and the three pin kinds keep their directories;
  the lifecycle binaries stay a layer of `mica-deploy`'s pool artifact
  rather than an artifact of their own; `deb-member.py` stays with them.
  Phase 7 (`mica-boards` `57f9cfb`, `mica-build` `e760ab3b`, `9d830caa`):
  one composition per product (`_out/products/<name>/build`; the smoke
  runner, the negative runner, the factory-root gate, the measurer, the
  QEMU engine and the writable-path audit take `--product`); `BOARD_RADIOS`
  and `BOARD_HAS_*` deleted, the board package reads `BOARD_FEATURES`;
  `make kernels` and `make firmware` over the discovered boards, which
  `release.yml` builds instead of a list; `tests/` and `.github/` in the
  board-name lint's scope, product names masked, thirteen files allowed by
  name with their reason (the labs of one board, the QEMU fixtures); the
  lifecycle scripts read the board's facts and hand the lab the
  architecture; `privileged.yml` builds, verifies, gates, smoke-breaks and
  repart-tests every product; `make lifecycle-uefi` runs assembly, runtime
  boot, updates and faults; the factory-root gate proves its device
  comparison on a root without device nodes (both compositions had failed
  it). Open after this: the migration runbook; the vendored `deps.sh` and
  the `build-env` pin of every consumer follow it.
- 2026-09-13 18:41 (user): every repository owns its CI and publishes to
  packages named for that repository. This supersedes, as the target, the
  four shared packages (`mica-source`, `mica-pool`, `mica-board`,
  `mica-root`) that replaced C6's per-kind paths in `mica-build-env`
  `ebe01e9`; the `mica-debian` publish run 34774732546 failed
  with HTTP 403 at its upload to the shared `mica-source`. Public visibility
  and CI-only publication stay; published artifacts are kept for pinned
  consumers. The new package names and tag grammar wait on the
  `mica-build-env` publisher contract; the migration steps are tracked in
  `20260913-1700-registry-migration`.
- 2026-09-13 19:05: the contract is settled. The package is the producer
  repository and the kind leads the tag: `<repository>:source.build-<commit12>`,
  `<repository>:pool.<arch>.build-<commit12>`,
  `mica-boards:board.<board>.build-<commit12>`,
  `mica-build:root.<product>.build-<commit12>`, planned
  `mica-debian:rootfs.build-<commit12>` (tag only; its contents are a draft).
  C6's table and the phase 6 annotation above record the earlier layouts.
  Milestones: mica-build-env `cb4080d` (helpers) and mica-build `565d5250`
  (board read, product root push). Neither is a completed migration: the
  first `mica-build-env` publication is not anonymously readable (package
  private), and mica-build CI still fails fetching its substrate from the
  private GitHub Releases. See the task's Notes.
- 2026-09-13 (user): a new repository, `mica-system-base`, merges
  `mica-debian` and `mica-system` into the board-independent base system
  (Bun and TypeScript build tooling; device-side scripts and payload exempt);
  both retire after the migration. Radio support and the SFTP server are
  board features, never mandatory base content: a board selects them and the
  product composes them. The scaffold exists
  (`c1b9441`); the merge, its acceptance and any publication are not done,
  and until the consumers move, the pins to the old repositories stay. The
  decision is recorded in `docs/decisions/2026-09-13-ghcr-artifact-registry.md`.
- 2026-09-14 (user): there are no image profile packages.
  `mica-profile-dev` and `mica-profile-prod` are gone from
  `mica-system-base` (`f0d555f`) and `micad` reads no `profile.conf`
  (`mica-core` `758ba0f`), so the `profile` row of the layer table above no
  longer selects a package. Development and production images are to differ
  through the signed kernel command line, a convention not designed yet
  (`docs/decisions/2026-09-14-no-image-profile-packages.md`).
- 2026-09-15: pre-reset history: the `mica-build-env` commits cited here
  (`386a2eb`, `3b1c8d0`, `6fd51c9`, `775c90e`, `a743f83`, `cb4080d`,
  `ebe01e9`, `f9e9c57`) are no longer on its `main`, which the user reset to
  one root commit (`5c05745`); the current `mica-build-env` facts (release
  `20260915-0138` at `f7b896b`) are in
  `docs/task/20260914-2042-release-lock-offline-build.md`.
- 2026-09-15: the `mica-system-base` commits cited here (`c1b9441`, `f0d555f`)
  are pre-reset history (its history is squashed into the root `4d63430`,
  user); the current Base is `20260915-0209` at `4d63430`, whose release
  carries only `mica-system-base.lock` and `SHA256SUMS`
  (`docs/task/20260914-2042-release-lock-offline-build.md`).
