# Release locks, pins and the offline build

This is the one format every Mica OS release is described in and every
consumer records its inputs with, and the contract for building the chain
without reading a published release. The decision is
`docs/decisions/2026-09-14-release-lock-and-offline-build.md`; the migration
is `docs/plan/20260914-2042-release-lock-offline-build.md`. `mica-build-env`
implements the release lock and `locks/upstream.lock` (current release
`20260916-0735`, which adds the `bsp` image and the Ubuntu snapshot rows;
`20260915-0138` stays in the package until every consumer has moved,
`docs/decisions/2026-09-16-toolchains-live-in-build-env.md`),
`mica-system-base` (current release `20260915-1102`),
`mica-podman` (`20260915-1057`), `mica-core` (`20260915-1135`) and
`mica-boards` (per board, `<board>.20260915-1926`); `mica-build` adopts it
last, with its own scripts, and every repository proves them with the test
vectors of section 9.

Where the decision left a detail open, this specification fixes it; those
choices are marked *(fixed here)*.

## 1. The release lock: `mica-lock v1`

A release of `<repository>` (tag `<YYYYMMDD-HHMM>`) carries exactly two GitHub
Release assets: `<repository>.lock` and `SHA256SUMS`. `SHA256SUMS` lists
exactly one file, `<repository>.lock`, in `sha256sum` format. There are no
`.deb` or other assets; packages live only in the OCI pools (section 2).
This holds from a repository's first release in this format on: there is no
transition period and no release carries old assets beside the lock (user,
2026-09-14). The exceptions are `mica-build`'s scoped releases, which carry
image files (1.0), and its index releases `mica.<YYYYMMDD-HHMM>`, which carry
exactly `mica-build.lock`, `mica-index.json` and a `SHA256SUMS` listing both
(1.2.3, `docs/design/mica-index.md`).

### 1.0 Scoped releases

Two repositories release by scope instead of all at once (user, 2026-09-15);
every other repository's release is unscoped:

- `mica-boards` releases per board: the tag and GitHub Release are
  `<board>.<YYYYMMDD-HHMM>`, a release builds and publishes only that board,
  and it carries exactly `mica-boards.lock` and `SHA256SUMS`
  (`docs/decisions/2026-09-15-mica-boards-per-board-releases.md`);
- `mica-build`, which nothing consumes, releases per board (all its products)
  or per product: the tag is `<scope>.<YYYYMMDD-HHMM>`, and it also carries
  image files beside `mica-build.lock` and `SHA256SUMS`
  (`docs/decisions/2026-09-15-mica-build-scoped-releases.md`); its lock rows
  are those of 1.2.2.

`<scope>` is `[a-z0-9][a-z0-9-]*` (a board or product name, named by
`docs/boards/contract.md` 1.1 and
`docs/decisions/2026-09-16-board-and-product-naming.md`), so it never contains
a dot and everything before the first dot of a scoped tag is the scope. The separator is a dot, not a slash (user, 2026-09-16,
`docs/decisions/2026-09-16-scoped-tags-use-a-dot.md`): a slash in a release
row is refused as `field-value`, with no compatibility form. A scoped
`mica-boards` lock holds only its board: every `board` row names the scope's
board with a reference tag `<component>.<scope>.<release>`, and every `pool`
tag is `pool.<scope>.<arch>.<release>` (`scope-content`). A `mica-boards` lock
has a `board` row for the `board` component and one for `kernel`, and one
for `uboot`, `firmware` and `packer` where the board publishes them, so two
to five (`board-components`). The lock's release
row carries the scoped tag (1.2), OCI tags carry the scope before the release
(1.3), and a consumer keeps each scope as its own input (section 4).

### 1.1 File rules

- UTF-8, LF line ends, a final LF, no CR.
- Line 1 is exactly `# mica-lock v1`.
- Later lines starting with `#` are comments. An empty line, a line starting
  with a space and a trailing tab are refused *(fixed here: empty lines are
  refused so the bytes are reproducible)*.
- Every other line is a row: tab-separated columns, typed by the first column,
  with an exact column count.

### 1.2 Rows

| Kind | Columns | Key | Meaning |
|---|---|---|---|
| `release` | `release <repository> <release> <commit>` | -- | exactly once, the first row; `<release>` is `<YYYYMMDD-HHMM>`, or `<scope>.<YYYYMMDD-HHMM>` for `mica-boards` and `mica-build` only (1.0), for example `release mica-boards uefi-x64.20260915-0300 <commit>`; `<commit>` is 40 lowercase hex; an offline lock (section 6) has `offline` in place of `<YYYYMMDD-HHMM>` (`<scope>.offline` for a scoped repository, *fixed here*) |
| `image` | `image <source> <name> <platform> <reference>` | source, name, platform | `<source>` is the producing repository or `upstream` (1.2.1); `<platform>` is `index`, `amd64`, `arm64` or `386` |
| `pool` | `pool <arch> <reference>` | arch | the package pool of one architecture |
| `package` | `package <name> <arch> <version> <sha256>` | name, arch | an archive this repository built: the layer of `pool <arch>` with that digest; an `Architecture: all` archive appears once per architecture with the same sha256; its arch must have a `pool` row |
| `board` | `board <board> <component> <arch> <reference>` | board, component | one component artifact of a board (`mica-boards`); `<component>` is `board`, `kernel`, `uboot`, `firmware` or `packer` (section 2) |
| `upstream` | `upstream <name> <arch> <version> <sha256> <url> <roots>` | name, arch | a third-party archive pinned for later stages; `<url>` is https; `<roots>` is the comma-separated, sorted, duplicate-free list of `upstream.pkgs` roots it is pinned for (*fixed here*, as Base publishes today); `mica-system-base` only |
| `apt` | `apt <uri> <suite> <components> <signed-by>` | at most one | the one apt source; `<components>` space-separated, `<signed-by>` an absolute keyring path; `mica-system-base` only |
| `input` | `input <repository>[.<scope>] <release> <sha256>` | input | one release `mica-build` composed from (1.2.2); `mica-build` only |
| `product` | `product <product> <board> <profile> <generation> <deployment id> <kernel id> <rootfs id>` | product | one product of the release and its signed deployment (1.2.2); `mica-build` only |
| `bundle` | `bundle <product> image\|update <reference>` | product, type | the product's OCI image or update bundle (1.2.2); `mica-build` only |
| `asset` | `asset <product> image\|update <kind> <file> <sha256>` | product, type, kind | one GitHub Release asset and its bundle layer (1.2.2); `mica-build` only |
| `origin` | `origin mica-build.<scope> <commit>` | input | the commit of an indexed scoped release (1.2.3); index locks only |
| `built` | `built mica-build.<scope> <repository>[.<scope>] <release> <sha256>` | input, name | one input row of an indexed scoped release's lock, verbatim (1.2.3); index locks only |
| `index` | `index <product> mica-build.<scope>` | product | the scoped release an indexed product comes from (1.2.3); index locks only |

Values *(fixed here)*: `<arch>` is `amd64` or `arm64`; names are
`[a-z0-9][a-z0-9.+-]*`, except an `upstream` image name (1.2.1); versions
are `[A-Za-z0-9.+~:-]+`; sha256 values and digests are 64 lowercase hex.

#### 1.2.1 Image sources

The `image` row says where an image comes from (user, 2026-09-15), and its
name and reference are the original ones, used as they are, with no rewriting:

- a repository name (`[a-z0-9][a-z0-9-]*`): an image that Mica OS repository
  builds and publishes on `ghcr.io/micaoss/<source>`, and the reference must
  be there (1.3). In a producer's own release lock the source equals the
  release row's repository. `<name>` is the producer's own key, lowercased and
  a name as above: `mica-build-env` names `base`, `c`, `go`, `rust`;
  `mica-system-base` names `rootfs`. A built image names the index and each
  platform manifest:
  `image mica-build-env base amd64 ghcr.io/micaoss/mica-build-env@sha256:<digest>`,
  `image mica-system-base rootfs index ghcr.io/micaoss/mica-system-base:rootfs.<release>@sha256:<digest>`.
- `upstream`: a third-party image. `<name>` is the image exactly as upstream
  spells it, `<path>[:<tag>]` (`debian:trixie-slim`,
  `docker/dockerfile:1-labs`, `registry:3.1.1`). `<reference>` is the original
  reference with its registry host spelled out *(fixed here)*,
  `<registry>/<path>[:<tag>]@sha256:<digest>`
  (`image upstream debian:trixie-slim 386 docker.io/library/debian:trixie-slim@sha256:<digest>`).
  Every row names the index digest, identical on each platform row, since
  `FROM` and `# syntax=` resolve the platform themselves; the platform column
  states which platforms the release guarantees, one row per platform (user,
  2026-09-14, option a). Upstream images are never republished: an
  `upstream` reference in `ghcr.io/micaoss` or `local` is refused, and an
  offline lock keeps the original reference *(fixed here)*.

`mica-build-env`'s lock lists the approved third-party images as its
`upstream` rows, taken unchanged from its `locks/upstream.lock` (4.1). Every
other repository takes a third-party image only from those rows of
`locks/mica-build-env.lock` and references it by its original name and
digest, reading it from the upstream registry; an image that is not listed
there is proposed to `mica-build-env` *(fixed here, as for Base packages)*.
The user unified the versions (2026-09-14): `registry:3.1.1`,
`alpine:3.24.1` and `debian:trixie-slim` are listed, and `registry:2`,
`alpine:3.21` and `debian:bookworm-slim` are not.

#### 1.2.2 The `mica-build` rows

A `mica-build` release lock (user, 2026-09-15,
`docs/decisions/2026-09-15-update-packages.md`) is
`release mica-build <scope>.<YYYYMMDD-HHMM> <commit>` followed by:

- `input <repository>[.<scope>] <release> <sha256>`: each input release, named
  as its consumer files are (`mica-boards.uefi-x64`, `mica-system-base`), with the
  input's `<YYYYMMDD-HHMM>` and the sha256 of its `SHA256SUMS`; a scope is
  present exactly for `mica-boards` and `mica-build` (`release-scope`);
- `product <product> <board> <profile> <generation> <deployment id> <kernel id>
  <rootfs id>`: `<profile>` is `dev` or `prod`, `<generation>` a positive
  decimal, and the three identities are the 64-hex identities of the signed
  deployment, its kernel and its rootfs;
- `bundle <product> image|update <reference>`: the OCI manifests
  `mica-build:image.<product>.<release>` (a layer per image kind, annotated
  `mica.image-kind`) and `mica-build:update.<product>.<release>` (a layer per
  update kind, annotated `mica.update-kind`, `mica.deployment-id` and
  `mica.generation`);
- `asset <product> image|update <kind> <file> <sha256>`: one release asset,
  whose sha256 equals the digest of its layer in that bundle. An image
  kind's asset is `<file>` = `mica-<product>-<YYYYMMDD-HHMM>.<suffix>.gz`,
  the image compressed with `gzip -n -9` by a pinned build-env image, whose
  layer is annotated `mica.compression=gzip`, `mica.uncompressed-sha256` and
  `mica.uncompressed-size`; image kinds are those of the board's
  `images.tsv`. Update kinds are published uncompressed with the suffix fixed
  by the kind: `full` (`micaupd`), `root` (`root.micaupd`) and `kernel`
  (`kernel.micaupd`), `<file>` = `mica-<product>-<YYYYMMDD-HHMM>.<suffix>`
  (`docs/decisions/2026-09-15-release-images-and-products.md`).

A reader checks an asset's `<file>` only for the
`mica-<product>-<YYYYMMDD-HHMM>.` prefix, not for the `.gz` suffix *(fixed
here)*: `mica-build` reads the earlier scoped release locks
`x64/20260915-1458` and `cx3576/20260915-1515` — published under the slash form
and the old board name, and kept as they are — whose image assets are raw
`.img`, to compute generations and the `root` and `kernel` conditions.

Every `bundle` and `asset` names a product with a `product` row
(`bundle-without-product`), every `asset` a `bundle` of its type
(`asset-without-bundle`), and every update bundle has a `full` asset
(`update-full`).

#### 1.2.3 The index lock

The Mica version index release `mica.<YYYYMMDD-HHMM>` of `mica-build` (user,
2026-09-15, `docs/decisions/2026-09-15-mica-version-index.md`) has a lock
`release mica-build mica.<YYYYMMDD-HHMM> <commit>`, the scope `mica`, with:

- `input mica-build.<scope> <release> <sha256>` for each scoped release it
  references, with that release's `SHA256SUMS` sha256;
- `origin mica-build.<scope> <commit>`: that release's commit;
- `built mica-build.<scope> <repository>[.<scope>] <release> <sha256>`: the
  referenced lock's `input` rows, verbatim;
- `index <product> mica-build.<scope>`: the scoped release each indexed
  product comes from;
- the `product`, `bundle` and `asset` rows of exactly the indexed products,
  copied byte for byte from their scoped release locks; the asset file names
  and bundle tags therefore carry the release of the product's `index` input,
  not the index stamp.

`mica` is refused as any other scope, product or board name. A `mica` lock
holds only these rows (`index-scope`, `index-only-inputs`); every `index` row
names an `input`, every `input` has exactly one `origin` and at least one
`built`, and every `origin` and `built` names an `input` (`index-input`); the
`product`, `bundle` and `asset` rows exist for exactly the indexed products,
and their file prefixes and tags use the release of the product's `input`
(`index-product-source`); a `built` row's name and release obey the `input`
rules (`index-built-form`). The checks across releases (a copied row equal to
its source, a trust hash equal to the referenced `SHA256SUMS`, no generation
lower than in the previous index, a stamp later than every referenced release
and the previous index) are done when the index is cut and by the verifier,
not by a file reader. `mica-index.json` is specified in
`docs/design/mica-index.md`.

### 1.3 References

A reference of a `pool`, a `board` or a repository's image is
`ghcr.io/micaoss/<repository>[:<tag>]@sha256:<digest>`, with `<repository>`
the image row's source; `upstream` image references are those of 1.2.1. The
digest is what a reader uses; the tag is informational for a reader and may
be absent, as it is for platform manifests *(fixed here)*. `<repository>` must
equal the release row's. A reference without `@sha256:` is refused. In an
offline lock the registry is `local` instead of `ghcr.io/micaoss`, and only
there.

Tags follow the release version (user, 2026-09-15,
`docs/decisions/2026-09-15-oci-tags-follow-release-version.md`): every OCI
tag in `ghcr.io/micaoss/<repository>` is `<kind>[.<name>]*.<YYYYMMDD-HHMM>`,
its last part exactly the release tag that published it (for a scoped release
its `<YYYYMMDD-HHMM>` part, with the scope named before it), and no tag
carries a commit (`build-<commit12>`) or a hash (`inputs-<16>`):

- `mica-build-env:base.<release>` (an image index) and
  `mica-build-env:<image>.<arch>.<release>` (a per-architecture build push);
- `<repository>:pool.<arch>.<release>`, and for `mica-boards`
  `mica-boards:pool.<board>.<arch>.<release>`;
- `mica-boards:<component>.<board>.<release>` (`board`, `kernel`, `uboot`,
  `firmware`, `packer`);
- `mica-system-base:rootfs.<release>`;
- `mica-build:image.<product>.<release>` and
  `mica-build:update.<product>.<release>` (the product bundles of 1.2.2;
  `mica-build` publishes no root on its own);
- `<repository>:source.<release>`.

In an offline OCI layout the last part is `offline` (section 6).

A pool manifest carries only release-independent annotations (section 2), so
a pool whose packages did not change is byte-identical across releases: its
new `pool.<...>.<release>` tag is a new tag on the same digest (user,
2026-09-15, `docs/decisions/2026-09-15-package-versions.md`).

### 1.4 Order

Rows are sorted by kind in the table's order (`release`, `image`, `pool`,
`package`, `board`, `upstream`, `apt`, `input`, `origin`, `built`, `index`,
`product`, `bundle`, `asset`), then by key, compared as bytes. The
same inputs therefore give the same bytes.

### 1.5 Refusal rules

A reader refuses the whole lock at the first rule it breaks. The rule names are
the ones the vectors use:

| Rule | Refused when |
|---|---|
| `header` | line 1 is not `# mica-lock v1` |
| `encoding` | not UTF-8, CR, missing final LF, empty line, leading space, trailing tab |
| `kind-unknown` | the first column is not one of the fourteen kinds |
| `image-source` | an `image` row whose source is neither `upstream` nor a repository name, or a repository other than the release row's |
| `column-count` | a row has the wrong number of columns for its kind |
| `release-row` | no release row, more than one, or not the first row |
| `release-scope` | a scoped release (`<scope>.<release>`) in a lock of any repository but `mica-boards` and `mica-build`, or an unscoped one in theirs |
| `scope-content` | in a scoped `mica-boards` lock, a `board` row naming another board than the scope or whose reference tag is not `<component>.<scope>.<...>` for its row's component, or a `pool` reference whose tag is not `pool.<scope>.<arch>.<...>` for its row's arch (an untagged reference included) |
| `field-value` | a value outside its form (release tag, scope, commit, arch, platform, name, component, version, sha256, url, roots, apt, profile, generation, identity, bundle type, update kind, asset file name) |
| `reference-digest` | a reference without `@sha256:<digest>` |
| `reference-registry` | a `pool`, `board` or repository image reference outside `ghcr.io/micaoss/` and `local/`, `local/` in a published lock, or `ghcr.io/micaoss/` in an offline lock |
| `reference-repository` | a `pool` or `board` reference to another repository than the release row's, or a repository image reference to another repository than its source |
| `reference-upstream` | an `upstream` image reference in `ghcr.io/micaoss/` or `local/` |
| `duplicate-key` | two rows of one kind with the same key (a second `apt` row included) |
| `base-only-kind` | an `upstream` or `apt` row in a lock of any repository but `mica-system-base` |
| `package-without-pool` | a `package` row whose arch has no `pool` row |
| `build-only-kind` | an `input`, `origin`, `built`, `index`, `product`, `bundle` or `asset` row in a lock of any repository but `mica-build` |
| `index-scope` | an `origin`, `built` or `index` row outside a `mica-build` `mica.<release>` lock, a `mica` lock without an `index` row, or `mica` as another repository's scope, an input's scope, a product or a board |
| `index-only-inputs` | in an index lock, an `input` of another repository than `mica-build`, or an `image`, `pool`, `package`, `board`, `upstream` or `apt` row |
| `index-input` | in an index lock, an `index`, `origin` or `built` row naming no `input`, or an `input` without exactly one `origin` or without a `built` row |
| `index-product-source` | in an index lock, `product` rows not exactly for the indexed products, a `bundle` or `asset` of a product not indexed, or a bundle tag or asset file not carrying the release of the product's `index` input |
| `index-built-form` | a `built` row whose name or release breaks the `input` row's form (scope exactly for `mica-boards` and `mica-build`) |
| `bundle-without-product` | a `bundle` or `asset` row whose product has no `product` row |
| `asset-without-bundle` | an `asset` row without a `bundle` row of its product and type |
| `update-full` | an update `bundle` without the product's `full` update asset |
| `board-components` | a `mica-boards` lock without a `board` row for the `board` component or one for `kernel` |
| `sort-order` | rows out of the order of 1.4 |

Registry checks come on top, when a lock is published or consumed: every
reference, `upstream` rows included, reads back anonymously at its digest,
and every `package` sha256 is a layer of that architecture's pool.

## 2. OCI layout

Pools, boards and images live in `ghcr.io/micaoss/<repository>`, in the
package of the repository that publishes them.

- **Pool** `pool.<arch>.<release>` (`pool.<board>.<arch>.<release>` in
  `mica-boards`): one OCI image manifest per architecture,
  `artifactType` `application/vnd.mica.pool`, an empty config, one layer per
  archive with `mediaType` `application/vnd.mica.deb` and
  `org.opencontainers.image.title` the archive's file name with its real `+`,
  and `mica.inputs=<sha256>`, the inputs hash of the producer and architecture
  that built the archive, the guard against inputs that changed without a
  version bump (`docs/decisions/2026-09-15-package-versions.md` R4). An `all`
  archive is a layer of both pools. The manifest carries only
  release-independent annotations: `mica.source-repo` and `mica.arch`. There
  is no `org.opencontainers.image.version`, `.revision`, `.created` or
  `mica.source-commit` on a pool manifest, so a pool whose packages did not
  change keeps its digest and a release only adds a tag to it. The `package`
  rows are unchanged, and `mica.inputs` is not in the lock (user, 2026-09-15).
  Board component manifests keep their own annotations (below).
- **Board components** `<component>.<board>.<release>` (`mica-boards`): a
  board is published as separate component artifacts (2026-09-15, agreed by
  `mica-boards` and `mica-build`), each an OCI image manifest with an empty
  config and one layer per file:
  - `kernel`, `artifactType` `application/vnd.mica.board.kernel`: a UEFI
    board's `kernel/`, or a FIT board's `kernel/dev/` and `kernel/prod/`
    with the DTB;
  - `uboot` (FIT boards), `application/vnd.mica.board.uboot`: the U-Boot
    binaries, the control dtb, the config and the FIT host tools, kept x86-64
    (`uboot-package/` on s905x5m);
  - `packer` (boards with a non-builtin image kind): the packer tools and the
    board-level pieces they need (`docs/boards/contract.md` section 3.1,
    `docs/decisions/2026-09-15-board-image-packers.md`);
  - `firmware`, `application/vnd.mica.board.firmware`: `firmware.tar` and
    `component-copyright`;
  - `board`, `application/vnd.mica.board`: `board.env`, `manifests/`,
    `outputs.tsv`, `images.tsv`, the trust certificate and `evidence.json`.

  Annotations: `mica.board`, `mica.arch`, `mica.component`,
  `mica.inputs=<sha256>` (the component's input key), the source annotations,
  and `mica.verity-cert-sha256`, required on `board` and `kernel` and matching
  where a `uboot` or `firmware` component carries it
  (`docs/boards/contract.md` section 3). A board
  release reuses an unchanged component by digest: the same manifest bytes
  under the new release's tag, never a re-pointed tag. The `mica-kernel-<board>`
  packages are retired; the assembly takes the kernel files from the `kernel`
  artifact.
- **Images** (build-env images, the Base rootfs): an OCI index and its
  platform manifests; the lock names both (`image` rows with the repository as
  source, `index`, `amd64`, `arm64`). Third-party images are not published here (1.2.1).
- **Product bundles** (`mica-build`): `image.<product>.<release>`, one OCI
  manifest with one layer per image kind, the `.gz` file of 1.2.2 (title the
  file name, annotations `mica.image-kind`, `mica.compression=gzip`,
  `mica.uncompressed-sha256` and `mica.uncompressed-size`), and `update.<product>.<release>`, one layer per update
  kind (annotations `mica.update-kind`, `mica.deployment-id`,
  `mica.generation`); each layer is also a release asset (1.2.2).

Publishing: a tag that already holds another digest is refused, never
re-pointed. An artifact unchanged since an earlier release is reused by
digest: the new release's tag points at the existing digest, and a rebuild
key is metadata, never part of a tag (`mica-build-env` records its key as the
label `com.mica.build-env.inputs` on every platform image config). Everything is
read back anonymously before the lock is written; the lock and `SHA256SUMS`
are uploaded last.

## 3. The Base lock: `mica-system-base.lock`

One lock replaces `system-base.lock`, `system-base-packages.lock` and
`system-base.sources`:

- `image mica-system-base rootfs index|amd64|arm64`;
- `pool amd64|arm64`;
- `package` rows for the Base's own packages, per architecture;
- `upstream` rows for the pinned later-stage packages, with their roots;
- one `apt` row, the Debian snapshot source; a consumer that runs apt renders
  the deb822 source from it.

The policy stays `docs/decisions/2026-09-14-base-pins-upstream-packages.md`.

## 4. The consumer: `locks/` and `mica-pin v1`

A consumer keeps its inputs at its root, one lock and one pin per producing
repository it reads (user, 2026-09-14), and per scope for a scoped repository
(1.0; user, 2026-09-15):

- `locks/<repository>.lock`: that producer's lock asset, unchanged;
- `locks/pins/<repository>.pin`: that input's own record. `locks/pins` is a
  directory, so moving one input never edits a shared file and cannot
  corrupt another input's record. The `.pin` suffix is `mica-build`'s reading
  of the user's words; the directory and the one-record-per-repository rule
  are the user's;
- for a scoped input, `locks/<repository>.<scope>.lock` and
  `locks/pins/<repository>.<scope>.pin`, one pair per board or product the
  consumer reads (`locks/mica-boards.uefi-x64.lock`,
  `locks/pins/mica-boards.uefi-x64.pin`).

A pin file is, in this order and nothing else:

```text
# mica-pin v1
REPOSITORY=<repository>
RELEASE=<YYYYMMDD-HHMM>
SHA256SUMS=<sha256 of that release's SHA256SUMS>
```

A scoped pin has one more line after `REPOSITORY`, `SCOPE=<scope>`, and its
`RELEASE` is the `<YYYYMMDD-HHMM>` part of the scoped tag:

```text
# mica-pin v1
REPOSITORY=mica-boards
SCOPE=uefi-x64
RELEASE=20260915-0300
SHA256SUMS=<sha256 of that release's SHA256SUMS>
```

An offline pin has `RELEASE=offline`, `SHA256SUMS` the sha256 of the
checkout's `_out/offline/SHA256SUMS`, and one more line,
`CHECKOUT=<absolute checkout path>`; `CHECKOUT` appears only on an offline
pin.

Rules:

- the file rules of 1.1 apply (UTF-8, LF, final LF); no comment lines after
  the header *(fixed here)*;
- `REPOSITORY` equals the file name's repository and the lock's release row;
- `SCOPE` is present exactly for `mica-boards` and `mica-build`, and equals the
  file name's scope and the scope of the lock's release row;
- `RELEASE` equals the lock's release row without its scope (`offline` for an
  offline lock), and the lock itself passes section 1;
- every `locks/<repository>[.<scope>].lock` of a producer has exactly one pin
  of the same name, and no pin exists without its lock; `locks/upstream.lock`
  (4.1) has no pin;
- an offline pin is refused under CI (`CI` or `GITHUB_ACTIONS` set) and in
  every release build.

Moving one input replaces `locks/<repository>.lock` and
`locks/pins/<repository>.pin` together and touches no other file; moving one
board or product replaces exactly its `locks/<repository>.<scope>.lock` and
`locks/pins/<repository>.<scope>.pin`.

| Rule | Refused when |
|---|---|
| `header`, `encoding` | line 1 is not `# mica-pin v1`, or as in 1.5 |
| `pin-format` | a key missing, extra, repeated or out of order, `CHECKOUT` on a pin whose release is not `offline`, or no `CHECKOUT` on one that is |
| `field-value` | repository, scope, release or sha256 out of form, or a `CHECKOUT` path that is not absolute |
| `name-mismatch` | `REPOSITORY` differs from the file name's repository |
| `scope-mismatch` | `SCOPE` (or its absence) differs from the file name's scope, or the lock's release row names another scope |
| `release-scope` | a `SCOPE` on a pin of a repository without scoped releases, or none on a pin of `mica-boards` or `mica-build` |
| `pin-without-lock` | a pin without its lock of the same name |
| `lock-without-pin` | a lock without its pin of the same name |
| `lock-invalid` | a lock that fails section 1, or whose release row names another repository |
| `release-mismatch` | `RELEASE` differs from the lock's release row without its scope |
| `checkout-in-ci` | an offline pin (`CHECKOUT`) under CI or in a release build |

### 4.1 Third-party inputs: `locks/upstream.lock`

Every repository pins its third-party inputs in one consumer file,
`locks/upstream.lock` (user, 2026-09-14). It replaces each repository's own
pin forms: `mica-build-env`'s upstream images and toolchain archives in
`images.env`, `mica-podman`'s `versions.env`, `mica-boards`'
`base-images.env` and `sources.env`, `mica-system-base`'s `sources.json` and
`packages/*.json`, and `mica-build`'s `base-images.env`. Build parameters that
are not pins, such as `mica-build-env`'s `*_FLOOR_*_MIN` minimum versions,
stay in the repository's own configuration.

It is not a release asset: it has no release row and no pin. It follows the
file rules of 1.1 and the order of 1.4 (kinds in the order below, then key),
with three kinds only:

| Kind | Columns | Key | Meaning |
|---|---|---|---|
| `image` | `image upstream <name> <platform> <reference>` | source, name, platform | a third-party image, the row of 1.2.1; the source is always `upstream` |
| `source` | `source <name> <arch> <version> <sha256> <url>` | name, arch | a downloaded archive (a toolchain, an upstream source tarball, a vendor blob); `<arch>` is `amd64`, `arm64` or `all`; `<url>` is https |
| `git` | `git <name> <url> <ref> <commit>` | name | a git tree pinned by commit (a kernel, U-Boot, an upstream tag); `<ref>` is the tag or branch name, informational; `<commit>` is 40 lowercase hex |

Only `mica-build-env` keeps `image` rows here: they are the list of approved
third-party images its lock carries unchanged (1.2.1); every other repository
takes those images from `locks/mica-build-env.lock`.

`tools/repos.sh check` verifies every `source` and `git` row of
`locks/upstream.lock`, and the `upstream` rows a repository takes from a
producer lock, against `repos/`; `repos.sh get` and `repos.sh git` take their
arguments from these rows.

| Rule | Refused when |
|---|---|
| `header`, `encoding`, `column-count`, `field-value`, `duplicate-key`, `sort-order` | as in 1.5 |
| `upstream-release-row` | the file has a `release` row |
| `kind-unknown` | a kind other than `image`, `source` or `git` |
| `image-source` | an `image` row whose source is not `upstream` (a repository name included) |
| `reference-digest` | an image reference without `@sha256:<digest>` |
| `reference-upstream` | an image reference in `ghcr.io/micaoss/` or `local/` |

## 5. The source cache: `repos/` and `tools/repos.sh`

Every repository has `repos/` at its root, git-ignored:

- `repos/sha256/<hex>`: content-addressed archives (toolchains, Debian
  snapshot archives, podman, netavark and crun tarballs, vendor blobs);
- `repos/git/<name>.git`: bare mirrors where a pin is a commit or tree hash
  (kernel, U-Boot).

`tools/repos.sh` has the same name and behaviour in every repository, each
keeping its own copy:

- `repos.sh get <sha256> <url> <out>`: take the archive from
  `repos/sha256/<sha256>`, or download it, verify its sha256, store it, then
  copy it to `<out>`. A cached file that does not hash to its name is refused
  (`cache-corrupt`), never silently re-downloaded.
- `repos.sh git <url> <commit|tree> <dir>`: check the pinned commit or tree out
  of `repos/git/<name>.git`, fetching into the mirror first when it is
  missing, and verify the checked-out commit or tree hash.
- `repos.sh check`: every `source` and `git` row of `locks/upstream.lock`
  (4.1), and every `upstream` row the repository takes from a producer lock,
  is present in `repos/` and hashes right.
- With `MICA_OFFLINE=1`, a miss is a refusal naming the pin (`offline-miss`)
  and nothing is fetched.

The cache never adds an input: only a pinned sha256, commit or tree enters a
build, and an offline build's output is byte-identical to the online one.
The exception is an artefact whose **local build is not the same build as its
CI build**. Ask that question per artefact, not per repository — `mica-boards`
answers it three different ways inside one tree
(`docs/design/build-harness.md` section 4): does this build run on the target
platform, or on the host with a cross toolchain?

- On the target platform, local and CI differ only by emulation, and emulation
  reproduces — `mica-system-base` rebuilt all eight archives of
  `20260915-1102` byte-identically on both architectures with arm64 under
  QEMU, and `mica-podman` has measured it three times on three trees,
  including its Rust stage: `netavark` and `aardvark-dns`, built with
  `cargo build --release` in a container run on the target platform, come out
  of an emulated arm64 build byte-identical to the natively built archive of
  release `20260916-0846`.
- On the host with a cross toolchain, while CI builds natively on a runner of
  that architecture, the two halves come out of **different toolchains**.
  `mica-core` is this shape: its arm64 packages are cross-built locally and
  native in CI, and all six differ — in stamps and linker layout, not in
  machine code (`docs/task/20260916-0900-emulated-arm64-bytes.md`). A local arm64
  archive from an amd64 station there is a valid archive and is not the
  published one. The gap is pinnable in principle: running that container on
  the target platform would close it, and the reason it has not been done is
  price, not design.

**Nothing measured here says emulation changes bytes** — not for C, make,
meson, ninja or data packaging, and not for Rust. What changes bytes is a
local build that is not the same build as the CI one, which for `mica-core`
means cross-compiled against native (`docs/task/20260916-0900-emulated-arm64-bytes.md`).

CI is the authority for an architecture's half wherever the two builds differ,
and a local rebuild is evidence only after the control of
`docs/design/build-harness.md` section 4 has been run. Where they are the same
build, a local rebuild is authoritative: `mica-podman` verified that shape from
its own scripts — every compiling stage runs on the target platform, and its
one host-platform stage clones and verifies pinned upstream trees and compiles
nothing — so its `make offline` on an amd64 station produces the published
arm64 bytes. Today the caveat binds `mica-core`; `mica-boards` is answering the
same question from its build scripts.
Language dependencies keep their own hashes (`Cargo.lock`, `bun.lock`,
`go.sum`) and are vendored into `repos/`. Base images by digest stay in the
local image store; offline, a missing one is refused.

## 6. `make offline`

Each repository's `make offline` builds its release outputs from `locks/`
into `_out/offline/`:

- `<repository>.lock`: a lock whose release row has `offline` (or
  `<scope>.offline`, one lock per scope built) and the checked-out commit; a
  dirty tree is refused;
- `oci/`: an OCI image layout holding every pool, board and image the lock
  names, by digest;
- `SHA256SUMS` over the lock.

References use the registry name `local`
(`local/<repository>:pool.amd64.offline@sha256:<digest>`) and resolve only
inside that checkout's `_out/offline/oci/`.

## 7. `tools/local-lock.sh`

`tools/local-lock.sh <repository>[.<scope>] <checkout>` verifies
`<checkout>/_out/offline/SHA256SUMS` and every digest the lock names in the
checkout's OCI layout, writes `locks/<repository>[.<scope>].lock` unchanged
and the offline pin `locks/pins/<repository>[.<scope>].pin`. It is refused under GitHub Actions and in every
release build. Its result is committed on a local branch that is never pushed,
so a composer still binds to a clean commit. It replaces `local-pins.sh` in
`mica-build`.

## 8. The workspace driver: `mica-build:tools/offline-chain.sh`

The driver builds `mica-build-env`, then `mica-system-base`, then
`mica-core`, `mica-podman` and `mica-boards` in parallel, then `mica-build`,
over throw-away `git clone --shared` clones of each checkout's `HEAD` under
`<workspace>/.mica-offline/<stamp>/<repository>`. For every input it runs
`local-lock.sh` and commits the locks on `offline/<stamp>` in the clone;
every clone's `repos/` reads through to its checkout's `repos/`. It outputs
the product images, a summary of every lock and digest, and every checkout
commit.

It lives in `mica-build:tools/offline-chain.sh` (user, 2026-09-14).

## 9. Test vectors

The vectors are files every repository copies into its own tests:
`docs/design/release-lock/vectors/`.

- `expected.tsv`: one row per vector, tab-separated: path (relative to
  `vectors/`), `valid` or `refused`, the rule of 1.5, section 4 or 4.1 (or `-`),
  and the mode (`ci`, `local`, `offline`, or `-`).
- `lock/valid/`: one valid lock per producer shape, covering every row kind:
  `mica-build-env.lock` (`image`: `mica-build-env` rows for the built images,
  `upstream` rows with the original names and index-digest references and a
  `386` row), `mica-core.lock`
  (`pool`, `package`),
  `mica-boards.uefi-x64.lock` (a scoped release row, `pool.<board>.<arch>` tags,
  `board` rows for the `board`, `firmware` and `kernel` components, an `all`
  package),
  `mica-system-base.lock` (`image`, `pool`, `package`, `upstream`, `apt`, a
  comment), `offline-mica-core.lock` (an offline lock with `local/`
  references), `mica-build.uefi-x64.lock` (a scoped `mica-build` lock: `input`,
  `product`, `bundle`, `asset` rows, a `root` update beside `full`),
  `mica-build.mica.lock` (an index lock over two scoped releases).
- `lock/refused/`: one lock per refusal rule of 1.5, each a minimal edit of a
  valid lock; the image refusals are `image-source.lock` (a repository source
  other than the release row's), `image-source-reference.lock`
  (`reference-repository`, a reference outside the source's repository),
  `image-registry.lock` (`reference-registry`),
  `upstream-image-republished.lock` (`reference-upstream`) and
  `upstream-image-without-digest.lock` (`reference-digest`); the scope
  refusals are `scoped-release-not-allowed.lock` and `unscoped-release.lock`
  (`release-scope`), `release-slash.lock` (`field-value`, the retired
  `<scope>/<release>` form), `scope-content-board.lock`, `scope-content-pool.lock`
  and `scope-content-tag.lock` (`scope-content`); the component refusals are
  `board-component.lock` (`field-value`), `board-duplicate-component.lock`
  (`duplicate-key`) and `board-components.lock` (`board-components`, no
  `kernel` row); the `mica-build` refusals are `build-only-kind.lock`,
  `bundle-without-product.lock`, `asset-without-bundle.lock`, `update-full.lock`
  and `update-kind.lock` (`field-value`, a `firmware` update); the index
  refusals are `index-row-outside-index.lock` and
  `index-without-index-rows.lock` (`index-scope`), `index-only-inputs.lock`,
  `index-input.lock`, `index-product-source.lock` and
  `index-asset-release.lock` (`index-product-source`), and
  `index-built-form.lock`.
- `pins/valid/` and `pins/refused/`: directories holding a `locks/` content
  (the `.lock` files and `pins/<repository>[.<scope>].pin`); `release` and
  `scoped` (two `mica-boards` boards, one with all four components, beside
  `mica-build-env`, both checked in
  `ci` mode) and `offline-checkout` (in `local` mode) are valid; one directory per
  rule of section 4: `name-mismatch`, `release-mismatch`, `pin-without-lock`,
  `lock-without-pin`, `checkout-in-ci`, plus `header`, `key-order` and
  `checkout-without-offline` (`pin-format`), `checkout-relative`
  (`field-value`), `lock-invalid`, and for scopes `scope-file-name` and
  `scope-release-row` (`scope-mismatch`) and `scope-not-allowed`
  (`release-scope`).
- `upstream/valid/upstream.lock` (`image`, `source` including an `all` row,
  `git`) and `upstream/refused/`: `release-row.lock`
  (`upstream-release-row`), `other-kind.lock` (`kind-unknown`),
  `repository-source.lock` (`image-source`), `image-republished.lock`
  (`reference-upstream`), `image-without-digest.lock` (`reference-digest`),
  `source-without-sha256.lock` (`column-count`), `git-short-commit.lock`
  (`field-value`), `unsorted.lock` (`sort-order`). The valid pins case
  `pins/valid/release` also holds a `locks/upstream.lock` without a pin.
- `repos/`: the offline side of `repos.sh get`: each directory holds a
  `repos/sha256/` cache and a `request` (sha256, url); `cache-hit` is valid,
  `cache-corrupt` and `offline-miss` are refused, all under `MICA_OFFLINE=1`.

Registry checks (section 1.5, last paragraph) and `repos.sh git` have no file
vectors.

`tools/docs/release-lock-check.py` is a reference checker of the file rules;
`make docs-verify` runs it over every vector (`tools/docs/verify-release-lock.sh`)
and fails when a result or rule differs from `expected.tsv` or a vector is not
listed. It proves the vectors; it is not a tool the other repositories use.
