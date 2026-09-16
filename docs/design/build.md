# Building signed component images

## 0. The rule

A build host needs Docker, git, Bash, Make and ordinary shell utilities.
Compilers, signing tools, filesystem makers and target executors run in pinned
containers from `mica-build-env:images.env`. The Bun build/verify drivers support the
pinned container route when the host has no Bun. No globally installed target
toolchain is required.

### 0.1 Classifying tools

A producer changes bytes that ship: compilers, linkers, package builders,
SquashFS/ext4/GPT makers, signing tools and archive assembly belong to the pinned
build environment. Orchestration selects inputs and commands. A judge reads an
artifact to report a result; image judges also use their declared pinned tools.
Do not substitute host filesystem/signing tools merely because they are present.
`tests/host-toolchain-lint.sh` and its negative suite enforce these boundaries.

The Docker daemon may be a sibling-container host. Bind the narrow project or
artifact path using its actual host path. Paths under `/srv` are identical in
the development environment; `/work` and `/root` aliases require translation.
Agent-created test containers carry the project cleanup label. Build output and
private key directories are never added to source control.

## 1. Independent products

| Product | Inputs | Output |
|---|---|---|
| Root | Resolved userspace packages and public factory defaults | `rootfs-verity.img`, exact geometry, manifest/debug/license evidence |
| Kernel/support | BSP kernel/modules/firmware, native init, public policy and explicit signing inputs | Signed UKI/FIT plus signed support image and component metadata |
| Firmware | Patched systemd-boot or cx3576 loader and metadata signer | Independent signed firmware package |
| Deployment | Exact kernel/root descriptors, the product and the metadata signer | Signed `mica/deployment/v2` envelope with the product (written since `mica-build` `0094a097`, read by `mica-core` since `20260915-0728`) |
| Factory disk | Two deployments, all referenced components and authenticated firmware | Current three-partition full image |
| Offline update | Signed deployment and its exact objects | `.micaupd` archive |

Root owns userspace. It must contain empty modules/firmware mountpoints and no
kernel or loader payload. Kernel-only packaging leaves root bytes unchanged;
root-only packaging leaves kernel/support/firmware unchanged. Neither
component carries release identity (decided 2026-09-15,
`docs/decisions/2026-09-15-stable-component-ids.md`, implemented in
`mica-core` `20260915-1135` and `mica-build` `fe3ad07` and `7d18da6`): the
root has no `/usr/share/mica/release-identity.env` and its `mica/rootfs/v2`
descriptor no `version`; the kernel `buildId` names its packager by the tools
image label `mica.boot.inputs`, the sha256 of the image's pinned inputs (base
image digest, apt snapshot row, EFI target, the `mica-systemd-boot` archive,
the Dockerfile and copied files; the FIT tools image adds its FIT and regdb
scripts, the board's U-Boot tool binaries and the regdb source), and
`build/src/kernel-package.ts` refuses an image without it; `ukify` and
`sbsign` run under `faketime` frozen at `SOURCE_DATE_EPOCH`, so two signings
are byte-identical (`tests/boot-signing-test.sh`); and `release.sh collect`
refuses a kernel that has the previous scoped release's `buildId` but
another identity. A release
that changes only a board or only the release metadata keeps both
identities. A new signed
deployment binds the chosen association.

### 1.1 Root composition

An image is a **product**: `mica-build:products/<name>/` declares the board,
the profile, the opt-in features and components, the image kinds and the
public factory manifest (`product.env`, `meta/`), and `MICA_PRODUCT=<name>`
is the composer's one input; `tools/product.sh` reads and validates the
directory against the fetched board bundle. The resolver selects the engine's
manifests for the profile and the features and the board's own out of its
bundle (`board.pkgs`, `radio-<r>.pkgs`, `component-<c>.pkgs`);
`FEATURES=""` is the minimal image, and every board has a `<board>-minimal`
product (built locally and in CI, never released: `PUBLISH=0` in its
`product.env`) and a `<board>-dev`
product; the release-target boards `uefi-x64` and `cx3576` also have a
`<board>-prod` product, and a scoped release carries only the dev and prod
products (`docs/decisions/2026-09-15-minimal-products-not-released.md`). The root carries what it is: `/usr/lib/mica/product.conf`, five lines
`PRODUCT=`, `BOARD=`, `PROFILE=`, and the quoted `FEATURES=` and
`COMPONENTS=`; the device reads its product from the single unquoted
`PRODUCT=` line (`docs/design/updates.md`; there is no
`profile.conf`, `docs/decisions/2026-09-14-no-image-profile-packages.md`),
and the verifier and the smoke runner scope their registers to it -- a
check for a feature the product did not select is not run, and says so.
Local `.deb` pools are indexed under `_out/debs/<arch>/`; Debian inputs are
snapshot/length/digest pinned. Composition installs the closure in one APT
transaction and the finalizer validates and packs it. The exact packed OCI root
is used for shipped-binary smoke checks.

The pool holds two classes of archive and refuses anything else. **Built here**:
a package a producer of this repository emits, at this tree's
`+git<commit>-1` stamp. **Imported**: a package a pin under `deps/packages/`
names -- one JSON file per package in the shape of the Debian pins, with the
source repository, its commit and a target per pool (version, architecture,
sha256, asset) -- fetched by digest out of the OCI artifact
`ghcr.io/micaoss/<repository>:pool.<arch>.build-<commit12>` the
repository that built it published (the pin's sha256 is the blob's digest;
`docs/decisions/2026-09-13-ghcr-artifact-registry.md`). Every archive carries
`Mica-Source-Repo` and `Mica-Source-Commit` control fields written by the
packer, so provenance travels inside the archive. `make os-pool` fetches the
imports, builds the rest and indexes both pools; `make os-lock-bump
COMPONENT=<repository>` is the pins' only writer and its diff is the
reviewable import. The lineage record the composer writes carries the pins
as rows and any `MICA_POOL_UNLOCKED` development waiver; the release gate
re-checks the rows against the tree's pins and refuses a waived image outside
the development channel. `mica-build-env:deb/README.md` documents the scripts.

Three parts of this tree are source dependencies, pinned like the Debian
base is: `deps/sources/mica-build-env.json` puts `mica-build-env`
(the builder images and the packaging contract, shared by every Mica OS
repository) at `build-env/`, `deps/sources/mica-debian.json` puts
`mica-debian` (the pinned Debian base) at `rootfs/debian/`, and
`deps/sources/mica-boot.json` puts `mica-boot` (the boot tooling) at
`boot/`. That last pin is temporary: `mica-boot` is split and retired
(`docs/decisions/2026-09-14-mica-boot-split.md`), its packaging, signing and
key tools move into this repository, and the loader comes from the Base pool
as `mica-systemd-boot`. Each pin names a commit, the tarball `<repository>-<commit12>.tar.gz`
that is the one layer of `ghcr.io/micaoss/<repository>:source.build-<commit12>`,
and its sha256, the layer's digest; `make deps` (`tools/deps.sh fetch`)
reads each blob by digest, unpacks it into the gitignored directory and
records the pin in `<path>/.deps-pin`. The Makefile refuses by name when a
directory is empty, the lineage record requires each directory at its pin,
and `make deps-bump DEP=<repository>` is the reviewable import, like a
package pin.

A board is an input like any other (`mica-build` `0094a097`): one
`locks/mica-boards.<board>.lock` with `locks/pins/mica-boards.<board>.pin`
(`SCOPE=<board>`) per board, pinning the per-board releases (the current ones
are `<board>/20260915-1926`); the former `deps/boards/` pins are removed. `make
board-fetch BOARD=<board>` (`tools/board-pool.sh`) reads the board's component
artifacts by the digests of its `board` rows into `_out/boards/<board>/`,
checks them against the board's `outputs.tsv`, and refuses a component whose
`mica.source-repo` is not `mica-boards` or whose verity trust certificate is
not the assembly's (`docs/boards/contract.md` section 3); `make
board-fetch-all` does the same for every board row, and `os-pool` runs it.
Products are published by the scoped releases of
`docs/decisions/2026-09-15-mica-build-scoped-releases.md`.

A package is the repository that publishes it, and the artifact kind leads
the tag. Every OCI tag names its release, `<kind>[.<name>]*.<YYYYMMDD-HHMM>`,
never a commit or a hash
(`docs/decisions/2026-09-15-oci-tags-follow-release-version.md`).
`mica-build` publishes only its product bundles, `image.<product>.<release>`
and `update.<product>.<release>`, in its scoped releases
(`docs/decisions/2026-09-15-mica-build-scoped-releases.md`; the first is
`x64/20260915-1458`); it publishes no root on its own. `mica-boards` names its artifacts by
per-board release: `pool.<board>.<arch>.<YYYYMMDD-HHMM>` and one
`<component>.<board>.<YYYYMMDD-HHMM>` per board component (`board`, `kernel`,
`uboot`, `firmware`, `packer`; `docs/boards/contract.md` section 3).
`mica-system-base` does the same:
`pool.<arch>.<YYYYMMDD-HHMM>` and the multi-architecture root
`ghcr.io/micaoss/mica-system-base:rootfs.<YYYYMMDD-HHMM>`, and a Base
release (the current one `20260915-1102`) carries `mica-system-base.lock` with those
references by digest and its `SHA256SUMS`: a consumer verifies the lock and
commits it unchanged as `locks/mica-system-base.lock` with its pin
`locks/pins/mica-system-base.pin` (`docs/design/release-lock.md` sections 3
and 4). The upstream Debian packages boards and products install beyond the
Base root (the radio packages and their libraries, `mica-podman`'s libraries,
s905x5m's `alsa-utils`) are pinned in the same lock as `upstream` rows, each
naming the `upstream.pkgs` roots it belongs to so a consumer installs the
closure of the roots it selects; any other Debian package is resolved from
the lock's `apt` row and recorded here. The consumption rules are `mica-system-base:README.md`,
section *Consuming a release*
(`docs/decisions/2026-09-14-base-pins-upstream-packages.md`). Each
repository's own CI token owns its packages, so no workflow needs write
access to a package another repository created. Every package is public and
reads need no token. Publishing is CI's, and every publisher pulls what it
pushed anonymously and fails when it cannot (`mica-build-env:deb/oci.sh`,
`oci_require_public`); an upload that worked is not a publication until
that read succeeds.

The move to these names is in progress
(`docs/task/20260913-1700-registry-migration.md`): pins recorded before it
may still name tags in the former shared packages `mica-source`, `mica-pool`,
`mica-board` and `mica-root`, which stay published, unchanged, for them.

The product's `meta/` holds its current public factory defaults
(`updates/manifest.json`). The root composer copies its explicit public
allowlist and rejects private or unclaimed material. A product may also
carry `defaults.toml`, non-secret settings defaults validated for shape at
compose time (a secret-bearing key is refused), and `provisioning.toml`, a
factory seed for the boot medium that marks the build `factory-seeded`. It does not manufacture keys or migrate an existing
configuration. Metadata anchors are embedded in authenticated kernel policy,
not accepted from the user-space update defaults.

## 2. Setup and explicit trust

Build the pinned environments and required package pools through `make help`.
`make os-deb-preflight` reports missing sources and version inputs before a long
build. Generate isolated development inputs only when needed:

```sh
bash boot/dev-keys.sh --out /path/to/new-signing-inputs
```

The output must be new. Boot, content and metadata keys are independent. For a
distributed builder, provide public content certificates and public defaults;
private signing material remains on the corresponding signing host. See
[key delivery](key-delivery.md).

BSP kernel compilation requires explicit public content trust through
`VERITY_TRUST_CERT`. Kernel/support packaging separately requires content signing
key/certificate, boot signing key/certificate and metadata public keys. Missing
inputs fail. cx3576 U-Boot must embed the matching public boot key set.

## 3. Component CLI

`make product PRODUCT=<name>` (`mica-build:tools/product-build.sh`) is the
one command from a recipe to a signed image, under `_out/products/<name>/`:
it fetches the board bundle and the pool of the board's architecture,
composes the root, signs the root, kernel and firmware components, two
factory deployment records, the image of every `IMAGE_KIND` the product
names and the update archive, and records a receipt of every input it read
(the product directory, the pins, the board's facts and kernel release,
the public certificates, the tree's commit); a product whose receipt is
unchanged is not rebuilt. `make product-verify PRODUCT=<name>` verifies the
image, and `make products` builds every product on a release-target board; a
new board enters through its `locks/mica-boards.<board>.lock` pin and its
`<board>-minimal` and `<board>-dev` products. The signing inputs are the workspace `MICA_SIGNING_OUTPUT`
(default `meta/`): verity and boot key pairs, the update signer and its
public key.

`bash build/run.sh --components --help` lists the component commands the
driver runs, for a build that needs one step alone. Their order is:

1. `root`, out of the composition (`rootfs-verity.img` and its parameters).
2. `kernel`, out of the board bundle and the pinned lifecycle binaries.
3. `firmware`: built and signed on a UEFI board, the bundle's loader on a FIT board.
4. `deployment`, twice, with distinct generations.
5. `image`, from those records, their directories and the firmware
   (`--provisioning FILE` places a factory seed on the ESP).
6. `archive`, the signed update of the newer deployment.

The records input to `image` is an array of exactly two objects with
`envelope`, `kernelDirectory` and `rootDirectory`. Each envelope is the original
signed JSON text. The assembler checks trust, board association, component bytes,
verity geometry, destination capacity, GPT and clean filesystem state. It
accounts for seeded DATA quota usage before publishing the image. The CLI names
the complete image `mica-BOARD-YYYYMMDD-HHmmss.img` using UTC completion time,
writes `SHA256SUMS` beside it, and prints the full image path. Use that actual
filename in verification and release commands; the timestamps below are examples.

```sh
bash build/run.sh --components image --board uefi-x64 \
  --records /path/to/factory-records.json \
  --public-key BASE64_ED25519_PUBLIC_KEY \
  --firmware /path/to/firmware-package --out /path/to/new-image

bash verify/run.sh --verify --board uefi-x64 \
  --image /path/to/new-image/mica-x64-20260909-164233.img --public-key /path/to/public.key
```

The component CLI takes base64 key values; the verifier takes public-key file
paths. Multiple explicit public keys express an overlap set. A factory image
always uses the current layout; there is no update-from-old-layout path.

## 4. Architectures

uefi-x64 and uefi-arm64 share the UEFI component contract. Their architecture changes
the BSP kernel, native executable, UKI stub and firmware binary. cx3576 uses the
same root/deployment contracts with a signed FIT and a protected raw firmware
partition. Its BSP firmware blobs and regulatory database belong to support.

Cross-compilation and execution are different capabilities. An amd64 compiler
can emit ARM64 binaries without executing them. Root package scripts and binary
smokes may require BuildKit's user-mode emulator. QEMU system emulation boots a
complete ARM64 machine independently of binfmt registration. A crun `fexecve`
limitation in user-mode emulation is explicitly executor-limited, not a version
check pass; real guest execution is separate evidence.

s905x5m follows the same signed-FIT component contract as cx3576 and builds a
complete SD image; it is not a release target (`BOARD_RELEASE_TARGET=0`).
Current board status is in [support tiers](../boards/support-tiers.md#current-boards).

## 5. Verification

Use `make os-build-test`, `make os-verify-test`, `make os-layout-lint`, the Rust,
service/frontend and applicable shell gates. `make os-install-closure-gate`
installs both architecture pools into clean roots and checks dependencies,
accounts, unit targets, ELF resolution and versions, including reduced feature
and independent radio roots.

`os-verify` requires explicit image and metadata key files. It authenticates two
factory deployments, component bytes/verity trees, trial entries, firmware
receipt, exact GPT geometry and current root policy. Its result does not prove
UEFI/FIT key enforcement; boot tests establish that separately.

QEMU API acceptance requires a full factory image and the public boot signer:

```sh
MICA_PRODUCT=uefi-x64-dev bash mica-build:tests/apid-api/run.sh
```

The product names the board, the image (`_out/products/<name>/image/`) and
the boot signer (`meta/boot/signer.cert.pem`); `MICA_QEMU_IMAGE` and
`MICA_QEMU_BOOT_CERT` override the last two for an acceptance run over a
copied release image. The harness copies the image, enlarges the virtual medium, seeds DATA service
units, enrolls disposable Secure Boot variables and boots through firmware.
It does not edit the signed kernel command line. `tests/lifecycle-uefi/` covers
runtime/update/fault/shutdown and large-root measurements for current images.
`tests/lifecycle-uboot-fit/` covers parser, signer and dirty-filesystem behavior.

The DATA growth test uses the actual packed root policy and a disposable loop
disk. Pass board, complete image and matching root image to
`tests/repart-loader-test.sh`; it checks identities and every protected firmware,
counter and SYSTEM byte around growth.

Record exact image and component identities with the acceptance run that used
them. Physical
cx3576 power-cut/watchdog/USB tests cannot be replaced by sandbox or VM evidence.
