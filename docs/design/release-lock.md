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

**Any repository may also carry producer data, each file named by a `data` row
of its own lock** *(user, 2026-09-20)*. `SHA256SUMS` still lists exactly one
file, the lock, and the exception list above is unchanged: the chain a
consumer follows is `SHA256SUMS` → lock → the row's sha256 → the file, which
is the chain `mica-build`'s images already use (1.2.2). What a `data` asset
may be is bounded in 1.2.4, and what it may not be is the point of the
bound.

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
| `data` | `data <name> <file> <sha256>` | name | one producer-data release asset, published by any repository (1.2.4) |

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

#### 1.2.4 Producer data: the `data` row

A producer that computes something about its **own output** which a consumer
must be able to read reproducibly from a pinned release publishes it as a
release asset named by a `data` row *(user, 2026-09-20)*:

```text
data <name> <file> <sha256>
```

`<name>` is the producer's own identifier for the datum and is the row's key;
`<file>` is the asset's file name; `<sha256>` is its digest. Both are
`[a-z0-9][a-z0-9.+-]*`. The instance it was approved for is
`mica-system-base`'s list of the paths in its root that no package owns, each
with its writer named — data a consumer needs and cannot derive.

**Why a new kind rather than a wider `asset` row.** `asset` is
product-shaped — `asset <product> image|update <kind> <file> <sha256>`, tied
to a `bundle` row by `asset-without-bundle` — and widening it would give one
kind two column layouts, which `column-count` exists to prevent. The
mechanism is reused; the row is new.

**What a `data` asset may not be.** Not a package: packages live only in the
pools (section 2). Not an image, archive or anything a device installs: those
are 1.2.2's rows. **Not a build input** — a build reads pools and lock rows,
never another repository's `data` file — so no repository's build may come to
depend on one. And not mutable: like every other asset it is fixed at its
release, and a correction is the next release.

**The first release carrying these rows is refused by readers that have not
implemented them, and that is correct** *(2026-09-20)*. `mica-system-base`
publishes `data` rows in its next release; `mica-build`'s reader does not know
the kind and refuses the lock with `kind-unknown`. The release still goes —
**holding a correct release for a stale consumer is backwards**, and the
failure is loud rather than silent, which is the property `kind-unknown` was
kept for. Each consumer implements the row before its next re-pin, not before
the release, because nothing breaks until something re-pins. And the sentence
this cost is the argument for 9.1 in one line: **the artefact a repository
asked for cannot reach it through a lock until it implements a row it did not
know had been specified.**

**The first release carrying them exists and the chain checks end to end**
*(verified here from the artefacts, 2026-09-20)*: `mica-system-base`
`20260920-0832` publishes four assets — the lock, `SHA256SUMS` **listing only
the lock**, and two `mica-system-base-unowned.<arch>.tsv` files named by `data`
rows whose sha256 match the files as downloaded. Line 51 of the amd64 file is
`/etc/systemd/system/getty.target.wants/getty@tty1.service` with writer
`systemd.postrm` — **the row that settled the console question is now a
published artefact rather than a claim in a report.**

**What a consumer may assume about a `data` row it does not understand**: that
the file exists in that release and hashes to that value, that it is needed
for nothing, and that skipping it is always safe. Its meaning belongs to the
producer, not to the format. `kind-unknown` is unchanged, so a reader that
does not know the kind still refuses the lock: readers and writers move
together, as they did for the format itself.

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

Tags cut before the board rename of 2026-09-16 keep the old board and product
names and are not rewritten — 22 of them today, 18 in `mica-boards` and 4 in
`mica-build` — for the same reason the slash-form release tags keep theirs:
they are named by the locks of releases that still exist, and a tag that a
published lock names is not rewritten or deleted (2.1).

**So anything that enumerates releases or tags here matches both separators**
— `mica[./]`, not the `mica.` prefix — **or says in the query why it excludes
one** *(2026-09-19)*. Both forms are published and neither is going away, so a
filter that encodes the current convention returns a population that stops at
the cut-over, and silence from a filter looks exactly like absence in the
registry. It has happened in both directions: `mica-res`'s mirror reader
followed the spec's slash form and silently ignored every dot-form release,
mirroring nothing while releases existed; and the index count in
[mica-index](mica-index.md) was first taken with a `mica.` prefix test, which
could not match `mica/20260915-2242` and returned nine of ten. The character
class is four characters longer than the prefix test and was the difference
between nine and ten. The general rule this is the tag-form instance of — **a
negative claim inherits the aperture of the query that produced it** — is
stated once, in [build-harness](build-harness.md) section 4, with its other
instances.

### 1.4 Order

Rows are sorted by kind in the table's order (`release`, `image`, `pool`,
`package`, `board`, `upstream`, `apt`, `input`, `origin`, `built`, `index`,
`product`, `bundle`, `asset`, `data`), then by key, compared as bytes. The
same inputs therefore give the same bytes.

### 1.5 Refusal rules

A reader refuses the whole lock at the first rule it breaks. The rule names are
the ones the vectors use:

| Rule | Refused when |
|---|---|
| `header` | line 1 is not `# mica-lock v1` |
| `encoding` | not UTF-8, CR, missing final LF, empty line, leading space, trailing tab |
| `kind-unknown` | the first column is not one of the fifteen kinds |
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
| `data-file` | two `data` rows naming the same `<file>` |
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

### 2.1 Deletion and what is owed to a published lock

*(fixed here, 2026-09-16, from `mica-build-env`'s practice.)*

**A release and the images its lock names are one unit.** Images may be
deleted when the releases naming them are deleted in the same operation, so
nothing is ever left pointing at missing bytes; `mica-build-env` has done that
on user instruction, and the ordering is what made it safe. The failure it
prevents is the one nobody notices for months: a published lock that resolves
to nothing looks like a working release until someone tries to reproduce it.

**Protection is owed to any release whose images are still named by a
published lock — not to the release that is merely recent.** The two questions
are different and decide different things:

| Question | What it decides |
|---|---|
| does anything still **build** against it? | whether a **pin** may be dropped |
| does any published lock still **name its images**? | whether those **images** may be deleted |

Asking the first and acting on the second is the mistake available here, and
it is available precisely because the first question usually has a clean
answer. `mica-build-env` asked it, got one, and then accepted that it had
answered a different question than the one it was about to act on.

The protected set is **computable, not a judgement** — but computing it takes
one hop, and the hop is part of the rule, not a footnote to it *(fixed here,
2026-09-16, from `mica-res` implementing the query)*:

> For each published release, take the **commit its lock names**, read
> `locks/mica-build-env.lock` **at that commit**, and collect the image
> references there. `mica-build-env`'s own release lock is the exception: it
> carries `image` rows directly.

**A consumer release lock carries no `image` rows at all** — only its
products. Someone implementing "walk the published locks and collect image
references" literally would find none, derive an **empty** protected set, and
conclude that everything is prunable: a silent wrong answer in the one
direction that destroys data. That is why the hop is written into the rule.

With the hop, a retention policy can be stated objectively when it is written
— *an image release is prunable only if no published lock names it and it is
mirrored* — and the derivation is re-run on every sync rather than kept as a
list, so the protected set moves when a lock moves.

Today it is exactly `mica-build-env` `20260915-0138`, named by 17 published
locks (`mica-boards` ten, `mica-build` three pre-rename, `mica-build-env`'s
own, `mica-core` `20260915-1135`, `mica-podman` `20260915-1057`,
`mica-system-base` `20260915-1102`), and `20260916-0735`, named by 19. Both
fail the first clause, so neither is prunable. Nothing builds against `0138`
any more, every consumer having moved — which is the other question.

**The collector does not protect images.** It snapshots Actions runs and jobs,
not `ghcr` package versions. A pruning pause lifted on the strength of the
collector alone would delete images that nothing had captured. What protects
image history is the mirror, and only for what the mirror holds — today
`20260916-0735` and not `20260915-0138`.

**Nor is it two instruments covering two artefacts.** Eight kinds, measured by
`mica-res`'s read-only `coverage` command and transcribed from its record
(`mica-res:docs/task/20260917-0852-public-resource-framework.md`, 2026-09-20)
**verbatim, because every count in it is a query result and a re-worded query
result is a sentence**:

```text
artefact                                        instrument that protects it
----------------------------------------------  ---------------------------------------------
workflow run and job metadata                   the collector's snapshots: 427 over
                                                2026-09-15T01:55Z..2026-09-20T01:06Z, holes 0,
                                                page-one recovery margin 48 h or better
workflow logs and artifacts                     NOTHING -- a snapshot is the record of a run,
                                                never an archive of it
build-env image bytes                           the mirror, 115 objects; the ONLY ghcr package
                                                whose bytes the mirror holds
mica-build product images and update archives    the mirror, 12 + 18 objects (`asset` rows)
third-party debs, source archives, git trees    the mirror, 324 + 23 + 43 objects
our published Debian packages (the OCI pools)   NOTHING -- ghcr holds the only copy
mica-boards board components                    NOTHING -- ghcr holds the only copy
release locks and SHA256SUMS                    NOT IN THE BUCKET -- the release-to-digest
                                                binding survives only in the producer's GitHub
                                                release and in consumers' committed `locks/`
                                                and `locks/pins/`
```

**The three `NOTHING` rows are a decision's consequence, not a defect in the
mirror.** The accepted scope of 2026-09-16 lists our package pools,
`mica-boards` board components, release locks and `SHA256SUMS` — with the
upstream `docker.io` images and the device update service — as *"out of scope
and not to be re-added"*. Nothing failed and nothing regressed. The eighth row
is there because `mica-res` added it unasked: seven rows would have left the
board components out **by accident, which is how the pools stayed unnoticed**.

**What was actually missing was the consequence, not the mirror.** The scope
said what would not be mirrored; nobody wrote down that this means `ghcr`
holds the **only** copy of every Debian package this workspace publishes and
of every kernel, U-Boot and board package. That implication is now a query
(`bun packages/mica-sync/src/cli.ts coverage`) rather than something a reader
has to derive, which is the difference between a decision and its blast
radius being knowable.

**So the retention policy has a constraint, and it cuts both ways:** those
three rows may not be treated as *protected*, and they may not be quietly
reversed either. Both moves are the user's — treating them as protected
misreads a decision, and mirroring them anyway overturns one.

**The trap, because the shape of the data invites it:** those 324 `deb`
objects read exactly like package coverage and are not. Every one is upstream
Debian from `snapshot.debian.org`. Counting them as *our packages are
mirrored* is the same substitution as counting run snapshots as image history,
one level down — a number that looks like the answer, sitting where the answer
would be. The question to ask of any such number is which **artefact** it
counts, not which repository produced it.

*(Where to look, since this is a coverage statement about the mirror and not
about the version index: the published `mica.20260920-0636` index carries no
`mirrors` member at all. The numbers above come from the mirror's catalogue.)*

*(And as of 2026-09-20 the mirror's own published index pointer is four days
stale, pending an `index` namespace being declared or its token granted that
write, so a count read off the site is not the count the bucket holds. The
`coverage` command says so before every count it prints, which is the right
behaviour for an instrument that knows its own reading is behind — and the
reason the numbers here are cited from that command rather than from the
site.)*

**Scope amended for locks only** *(user, 2026-09-20: "按你推荐处理，可以加")*.
The accepted scope of 2026-09-16 put release locks and `SHA256SUMS` *out of
scope and not to be re-added*; that part is reversed and they move into the
mirror. **What did not move: the pools, the board components and the device
update service.** So the table above changes in exactly one row when the work
lands, and the two `NOTHING` rows that matter for retention stay as they are.

The price, with its limit in the same paragraph because the price is what
makes someone want to say yes quickly: under **5 MB** against the 1.8 GB
already held, and 150 to 250 lines with tests inside the existing `sync.yml`,
no new workflow and no new credential — and **the chain from the mirror ends
at the lock, whose `package` rows point into pools nothing mirrors. It makes
the binding survivable, not the packages.**

So the current state, with its condition stated rather than left open-ended:
`20260915-0138` stays and nothing is pruned; its images become prunable once
they are mirrored **and** a consumer has been shown to read them from the
mirror at the same digests.

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
- `lock/refused/`: one lock per refusal rule of 1.5, each written against a
  valid lock and **declaring which one** in `derived-from.tsv` (9.3); the image refusals are `image-source.lock` (a repository source
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

### 9.1 Who carries a copy, and how much of one

Every repository that reads a lock carries a **private implementation of rules
this document owns**, and the vectors are the only thing that makes those
copies agree. They are copied, so each copy is a **snapshot** — and **a
conformance test that ships its own fixtures tests conformance to itself**:
*78 of 78* is a true statement about a set six vectors short, green on every
push, with the test name and the pass line both looking complete.

Measured 2026-09-20 by reading each tree, **with the unit stated, because two
correct counts of one file differed by one until someone said which**: a
`lines` count includes the header comment, a `rows` count is the vectors.

| Repository | Copy | Lines | Vector rows | `data` vectors |
|---|---|---|---|---|
| `mica` (owner) | `docs/design/release-lock/vectors/` | 85 | 84 | 6 |
| `mica-system-base` | `tests/vectors/` | 85 | 84 | 6 — byte-identical to the canonical file |
| `mica-build` | `tests/release-lock/vectors/` | 79 | 78 | 0 — exactly the six short |
| `mica-boards` | `tests/vectors/` | 65 | 64 | 0 |
| `mica-core` | `tests/vectors/` | 52 | 51 | 0 |
| `mica-podman` | `tests/vectors/` | 49 | 48 | 0 |
| `mica-res` | none | — | — | — |

**A reader must pass every vector for the forms it can encounter**, and what
it can encounter is decided by what it pins: a repository that pins only
unscoped producers never sees a `<scope>.<release>` row, and requiring it to
conform to scoped rules is requiring conformance nobody needs. That is the
honest reason a subset is legitimate, and it is written here rather than left
as the reason nobody wired the rest up — `mica-system-base`'s reader was on
the retired `<scope>/<release>` separator for four days and it cost nothing,
because it pins no scoped producer.

**But a subset and a stale copy are indistinguishable by size**, which is the
resolution problem one level up ([harness](build-harness.md) section 4): 64
rows may be a deliberate subset or last month's copy, and nothing in the file
says which. Naming the `mica` commit a copy was taken from would answer that —
and the adopted answer goes further and removes the copy:

> **The vectors are not copied. A consumer reads them out of `mica` at a
> pinned commit and refuses a difference** — the mechanism
> `mica-build:tools/deploy-pool.sh --check` already uses to read `mica-core`'s
> contract fixtures at the commit of its release, and the one that caught the
> board vocabulary on 2026-09-20.

The sentence behind it generalises past vectors: **being on a list that is
checked beats being on a list that is surveyed.** A survey answers today; a
pinned read answers whenever someone adds a seventh reader, and it answers
*conforming* rather than *running*, which are not the same question — running
a stale copy looks identical from outside.

**The required subset is derivable, not arguable.** What a reader can
encounter follows from `locks/pins/`: a fact about a directory rather than a
claim about a repository's habits. That also relocates the difficulty of ever
gating this — the hard part is **not** deciding what each reader owes, it is
**finding each reader's copy**, and those are very different problems.

**The derivation gives a FLOOR, not a ceiling** *(`mica-system-base`,
2026-09-20)*. It pins one unscoped producer and could skip every scoped,
index, product, bundle and asset vector; it runs them anyway, because **a
producer that conforms only to what it consumes can emit a row nobody
downstream accepts.** So the rule reads: **what you pin, plus what you
produce, plus the vectors that say what your own forms may not be** — and that
is the minimum. A floor stated as a ceiling is how a correct rule produces a
worse tree.

### 9.3 `derived-from.tsv`: which valid vector a refused one is written against

Every refused lock vector declares its sibling, because the intent existed
only in whoever wrote the fixture — the same category as a provenance line,
and the same argument for writing it down. Rows are
`<refused vector>\t<relation>\t<valid vector>`:

- **`edit-of`** — a small edit of that vector: **at most two changed lines**,
  and not identical. 50 of the 56 refused vectors are these.
- **`reorder-of`** — exactly that vector's rows in another order, so **order
  is the only rule it can break**. The relation *is* the argument, and the
  gate checks it by sorting both files: three vectors are these
  (`lock/refused/unsorted`, `lock/refused/release-not-first`,
  `upstream/refused/unsorted`).
- **`minimal-of`** — an independently written minimal lock of the same shape,
  so no line bound applies and the sibling names the **shape** rather than the
  source text. Three are these: `column-count`, `image-platform` and
  `package-without-pool`, which was worth measuring because this section used
  to say *each a minimal edit of a valid lock* and they were never that.

**Minimality is measured rather than assumed, in one set.**
`mica-system-base` ran the procedure over all 56 of its `refused/` fixtures
and proved that **each is one hunk from a valid file** — *not* that each tests
the rule it names, since reverting a single hunk returns the valid file and
re-parsing it cannot fail. What it does establish is the precondition this
section exists to record: **no vector in that set carries incidental
differences beyond its defect**, so a declaration here records something true
rather than aspirational.

**And where the row multiset is identical, order is the only rule a vector can
break** — an argument about what *cannot* differ rather than about what a
re-parse returns, and the only form that reaches the ambiguity question
without a report-every-rule mode. Measured here: `lock/refused/unsorted.lock`
and `lock/refused/release-not-first.lock` hold exactly their sibling's rows in
a different order, so each is **provably single-rule**. Applying it to the `upstream/refused/`
set found the opposite in **half of it**: five of the eight were missing the
same **comment line** their sibling carries — an incidental difference,
breaking no rule and breaking the argument, and present since those fixtures
were written. All five are repaired, each still refuses the rule it names, and
`upstream/refused/unsorted.lock` can now only be refused for order.

**Two assertions keep it that way**, and both were proven against mutated
copies before being trusted: a `reorder-of` whose rows differ from its sibling
is refused, and **a vector naming `sort-order` whose rows differ from its
sibling is refused** — which is exactly the defect that had been sitting in
the set.

**The pairing is declared rather than derived**, because deriving it by
smallest diff matched `image-platform.lock`, a `mica-build-env` shape, against
`offline-mica-core.lock`. `make docs-verify` asserts every refused vector has
a row, every sibling exists and is itself a listed vector, no vector is
identical to its sibling, and the `edit-of` line bound.

### 9.2 `vectors.pin`: the pin a gate reads

A consumer records the vectors it conforms to in a file named **`vectors.pin`
in a directory of its own choosing**:

```text
# mica-vectors-pin v1
REPOSITORY=mica
COMMIT=<40 lowercase hex>
```

Exactly those two keys, in that order. **Comment lines (`#`) may follow the
header** and carry nothing the gate acts on — the first real pin used one to
record that its commit carries a known inert defect, and forbidding it would
have pushed that into nowhere. **A comment naming a defect is removed in the
commit that moves the pin past it**: the file that argued for this allowance
deleted its own comment within the hour, when the defect was repaired
upstream, with the reason worth keeping — **a comment that outlives its defect
is the next stale comment.** Anything else is refused. `COMMIT` is the full
commit, never a short one: **the file is read by a gate rather than by a
person**, which fetches the vectors at that commit and refuses a difference.
Refusals, in the vocabulary of 1.5: `header`, `encoding` (no final newline, a
CR, not UTF-8), `pin-format` (any other key set or order) and `field-value`
(a repository name or commit outside its form). Six vectors under
`vectors-pin/` prove them.

**Do not pin a known defect *silently*** *(`mica-system-base`, 2026-09-20,
correcting *do not pin a commit that contains one*)*. Removing the pin does
not remove the artefact — the copy carries those bytes either way, and
unpinned it carries them **unverifiably** — and moving a pin is a one-line
change, which is the same argument the uniform basename rests on. So a
repository that must pin a commit carrying a known defect **names the defect
in the pin file, above the keys**, with the mechanism a later reader needs:
**a pin is a statement about one commit and never about the newest one, so the
gate will not notice the repair on its own.** **A named defect under a gate
beats an unnamed one under nothing.**

**The basename is uniform and the directory is not**, which is the whole point
of fixing it: finding each reader's copy was named as the hard part of ever
gating this, and a uniform basename makes that **one command per repository**
instead of a maintained list of paths. A naming convention that costs nothing
today removes the obstacle that made the gate not worth building.

**A vocabulary rename is a change to words this project owns, and a fixture
contains words it does not** *(2026-09-20)*. The board sweep of 2026-09-16
(`91fce7c8`, *rename the generic systems in the design pages, the website
briefs and the vectors*) turned `x64` into `uefi-x64` inside a third-party
download URL: ten vector files carried
`bun-linux-uefi-x64.zip`, **an asset that does not exist** — Bun publishes
`bun-linux-x64.zip`, which is what `mica-build-env`'s real
`locks/upstream.lock` names. Fixed on 2026-09-20 — **before any pin was correct, and not before pinning
began**: `mica-system-base` and `mica-podman` pinned the pre-fix commit
`735ebaa` two and four minutes after the repair landed, while the messages
crossed. Both had byte-compared against `735ebaa` while it was `HEAD`, and
pinning the commit you have just verified is the natural move; the timing was
four minutes, not carelessness.

**The mechanism's first observed success and first observed failure fell in
the same hour, and both are worth keeping.** Four days of drift went unnoticed
because nothing named a commit; two minutes of drift was visible immediately
because something did — read out of two files, a check that was impossible
that morning. `mica-system-base` went further and wrote the defect into its
pin's own comment, so its pin records *why* it is at that commit rather than
only which.

**Why one row of the pair was hit and the other was not, which is invisible
until stated**: the `arm64` row beside it is `bun-linux-aarch64.zip` and is
**correct**, because *aarch64* contains no *x64* substring. One sweep, one
line caught, one missed, for a reason nobody could see by reading the result.

It survived four days for a structural reason rather than a careless one: **a
vector's URL is inert by design.** Nothing downloads it, so no gate can
notice, which is exactly why it lasted in the file every repository is now
told to trust — and why a pin would have made it *permanent and uniform*
rather than merely present. Whoever writes the next sweeping rename should
know that one already crossed this line, in the one kind of file where nothing
would complain.

**And a refused vector that could be refused by two rules tests neither**
*(`mica-core`, 2026-09-20)*. Its copy of `upstream/refused/other-kind.lock`
carried `pool.amd64.x` where this one carries `pool.amd64.20260914-2042`: the
vector exists to prove an upstream lock is refused **for carrying a `pool`
row**, and the edited copy would also have been refused for an invalid release
value — so it could pass for the wrong reason. That is a property of every
negative fixture here, checkable by inspection and by no gate: **each refused
vector must break exactly the rule it names.**

**Name the rule from a measurement, and the second finding is the one that
matters** *(`mica-core`, 2026-09-20)*. Running each negative case and
recording **what actually fired** produces two kinds of finding: *ambiguity*,
where a fixture could be refused by two rules and tests neither, and
**mislabelling**, where exactly one rule fires and it is **not** the one
anybody thought. `mica-core`'s instance: a `float` generation is refused by
*unknown, missing or invalid fields* because `serde` rejects it before the
integer bound is ever consulted, **so the integer bound has no test** — and a
relabelling done from the source would have written *integer bound* beside it
with complete confidence, leaving the bound untested and a fixture apparently
covering it. **The real product of naming the rule is not better labels, it is
the list of rules nothing tests.**

**And one category makes *every rule has a vector* the wrong rule to gate**
*(`mica-core`, 2026-09-20)*: **a refusal no input can reach.** Of the 35 its
component reader can produce, two cannot be triggered at all —
`serde_json::to_value` of a struct with string keys and finite numbers cannot
fail, and the strict base64 engine refuses a noncanonical encoding outright,
so the re-encode comparison after it can never disagree. Both are kept,
because **deleting either widens the check above it**. That is the inverse of
dead code: **a refusal no input can reach is not a gap and not waste — it is
the floor under the check above it**, and a coverage rule that treats it as
either would push somebody to delete a guard to make a number go green. The
subtraction below reports; it does not refuse.

That list is a subtraction: **the refusal rules the reader can produce, minus
the rules the fixtures name** — set equality in both directions applied to
*rules* rather than to files. Run here on 2026-09-20, the moment it was
proposed: `tools/docs/release-lock-check.py` can produce **40** rules, the
vectors named **39**, and the one nothing tested was **`fetch-required`**, the
cache miss outside offline mode. A vector now names it, so the sets agree in
both directions.

**And the aperture family reaches fixtures too.** `mica-core`'s `wrong-board`
sets the board and leaves architecture, the kernel's board and the boot format
alone, so three rules would refuse it and the architecture one wins: **a
fixture named for a rule it does not exercise**, beside a suite named for a
thing it does not do and a test named for a chain it does not run. **The name
keeps doing the work a measurement should have done**, and every instance was
found by *running* the thing rather than by reading it.

**The shape the second half will take, decided here because it is one spec
decision rather than five local ones** *(proposed by `mica-system-base`,
2026-09-20)*: **an optional collect mode in this repository's reference reader,
plus a second column in `expected.tsv`.** The short-circuit stays the default,
because `expected.tsv` names **one** rule per vector and a reader returning a
set would stop answering the question the table asks — **the first-rule
behaviour is the table's contract, not an implementation detail.** No
repository builds a second, non-short-circuiting reader of its own: that is a
private copy of somebody else's truth, which is the thing this section exists
to remove.

**And the constraint that keeps it from manufacturing its own findings**,
which is why it is specified before it is written: suppressing a rule to see
what fires next is only safe where the continuation is safe. A **structural**
refusal — encoding, header, column count, unknown kind — makes the rest of the
file unreadable, so a mode that suppressed one would run the semantic checks
over malformed rows and report pairs that are artefacts of its own ordering.
So the mode reports **either a structural refusal alone, or the set of
semantic refusals**, and never mixes them. A partially built version is the
one thing that must not be shipped here: a gate whose noise is
indistinguishable from its findings is worse than no gate.

**The two-rule property is mechanically checkable, and the harness does not
exist** *(`mica-build`, 2026-09-20)*: **for each refused vector, repair the
named defect and require the result to become valid; anything that stays
refused was testing two rules at once.** That is a definition rather than an
inspection, and the distinction matters — *no gate can check this* is a
permanent limit, *no harness exists yet* is a piece of work, and **only one of
those ever gets built.** The audit belongs here, once, at the source: forty-odd
refused vectors in one pass rather than five repositories doing it five times,
since `mica-build`'s copy is byte-identical to canonical after one rename, so
a finding would be a finding about the vectors themselves
([task](../task/20260920-0851-negative-vector-audit.md)).

**Two facts about the one known instance, kept visible because they bound what
it proves.** It was found **by accident** — `mica-core` comparing blobs, not
anyone hunting double faults — so nobody knows whether it is a one-off or a
pattern in a set written over months by people thinking about the positive
case. And it is **local rather than inherited**: the same file is
byte-identical to canonical in `mica-build`'s pre-rename copy, the oldest in
the workspace, so the edit happened downstream of the oldest ancestor in one
tree.

*(That oldest copy is also the only one the `bun` artefact could not reach,
because the sweep that introduced it came after the copy — an accident rather
than a virtue, and the reason "everyone is behind" was never the right frame:
**being behind and being wrong are different axes**, and tonight they pointed
in opposite directions at least once.)*

**And a provenance comment nobody checks is not provenance** *(the rule's
first live test, 2026-09-20)*. `mica-system-base`'s 133 vector blobs were
byte-identical to this repository at `735ebaa`, compared blob sha by blob sha
— while its provenance comment named `19fbdce`, at which the vector list had
69 rows. **Current files, a stale line, and the line is the only thing anyone
reads.** The rule had acquired the defect it was written to cure, in the
opposite direction. What makes the line load-bearing instead of decorative is
that a gate reads it: **a hand-maintained provenance comment is a claim; a pin
a gate reads is an input.** A repository adopting the pin deletes its comment
in the same commit — a provenance line surviving beside a pin is a second
source of truth, and the two will disagree within a month.

**And the table above has the same defect it describes**: nothing compares
those copies to this one, so it will go stale the way its own numbers did.
The commit-naming rule is what keeps it alive — **if every copy names its
source, the table can be regenerated rather than maintained, and a regenerated
table cannot be stale in the way a maintained one is.** That is the difference
between a record that needs an owner and one that needs a command.

`mica-res` reads pins and now locks and carries no copy; that is the one row
of the table with nothing behind it.
