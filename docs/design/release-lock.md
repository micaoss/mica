# Release locks, pins and the offline build

This is the one format every Mica OS release is described in and every
consumer records its inputs with, and the contract for building the chain
without reading a published release. The decision is
`docs/decisions/2026-09-14-release-lock-and-offline-build.md`; the migration
is `docs/plan/20260914-2042-release-lock-offline-build.md`. `mica-build-env`
implements the release lock and `locks/upstream.lock` (release to pin
`20260915-0138`), `mica-system-base` (release to pin `20260915-0209`), `mica-podman`
(`20260915-0245`) and `mica-core` (`20260915-0235`); the other repositories adopt it in the plan's order, with their own scripts, and prove
them with the test vectors of section 9.

Where the decision left a detail open, this specification fixes it; those
choices are marked *(fixed here)*.

## 1. The release lock: `mica-lock v1`

A release of `<repository>` (tag `<YYYYMMDD-HHMM>`) carries exactly two GitHub
Release assets: `<repository>.lock` and `SHA256SUMS`. `SHA256SUMS` lists
exactly one file, `<repository>.lock`, in `sha256sum` format. There are no
`.deb` or other assets; packages live only in the OCI pools (section 2).
This holds from a repository's first release in this format on: there is no
transition period and no release carries old assets beside the lock (user,
2026-09-14).

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
| `release` | `release <repository> <YYYYMMDD-HHMM> <commit>` | -- | exactly once, the first row; `<commit>` is 40 lowercase hex; an offline lock (section 6) has `offline` as release |
| `image` | `image <source> <name> <platform> <reference>` | source, name, platform | `<source>` is the producing repository or `upstream` (1.2.1); `<platform>` is `index`, `amd64`, `arm64` or `386` |
| `pool` | `pool <arch> <reference>` | arch | the package pool of one architecture |
| `package` | `package <name> <arch> <version> <sha256>` | name, arch | an archive this repository built: the layer of `pool <arch>` with that digest; an `Architecture: all` archive appears once per architecture with the same sha256; its arch must have a `pool` row |
| `board` | `board <board> <arch> <reference>` | board | a board bundle (`mica-boards`) |
| `upstream` | `upstream <name> <arch> <version> <sha256> <url> <roots>` | name, arch | a third-party archive pinned for later stages; `<url>` is https; `<roots>` is the comma-separated, sorted, duplicate-free list of `upstream.pkgs` roots it is pinned for (*fixed here*, as Base publishes today); `mica-system-base` only |
| `apt` | `apt <uri> <suite> <components> <signed-by>` | at most one | the one apt source; `<components>` space-separated, `<signed-by>` an absolute keyring path; `mica-system-base` only |

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
its last part exactly the release tag that published it, and no tag carries
a commit (`build-<commit12>`) or a hash (`inputs-<16>`):

- `mica-build-env:base.<release>` (an image index) and
  `mica-build-env:<image>.<arch>.<release>` (a per-architecture build push);
- `<repository>:pool.<arch>.<release>`;
- `mica-boards:board.<board>.<release>`;
- `mica-system-base:rootfs.<release>`;
- `mica-build:root.<product>.<release>`;
- `<repository>:source.<release>`.

In an offline OCI layout the last part is `offline` (section 6).

### 1.4 Order

Rows are sorted by kind in the table's order (`release`, `image`, `pool`,
`package`, `board`, `upstream`, `apt`), then by key, compared as bytes. The
same inputs therefore give the same bytes.

### 1.5 Refusal rules

A reader refuses the whole lock at the first rule it breaks. The rule names are
the ones the vectors use:

| Rule | Refused when |
|---|---|
| `header` | line 1 is not `# mica-lock v1` |
| `encoding` | not UTF-8, CR, missing final LF, empty line, leading space, trailing tab |
| `kind-unknown` | the first column is not one of the seven kinds |
| `image-source` | an `image` row whose source is neither `upstream` nor a repository name, or a repository other than the release row's |
| `column-count` | a row has the wrong number of columns for its kind |
| `release-row` | no release row, more than one, or not the first row |
| `field-value` | a value outside its form (release tag, commit, arch, platform, name, version, sha256, url, roots, apt) |
| `reference-digest` | a reference without `@sha256:<digest>` |
| `reference-registry` | a `pool`, `board` or repository image reference outside `ghcr.io/micaoss/` and `local/`, `local/` in a published lock, or `ghcr.io/micaoss/` in an offline lock |
| `reference-repository` | a `pool` or `board` reference to another repository than the release row's, or a repository image reference to another repository than its source |
| `reference-upstream` | an `upstream` image reference in `ghcr.io/micaoss/` or `local/` |
| `duplicate-key` | two rows of one kind with the same key (a second `apt` row included) |
| `base-only-kind` | an `upstream` or `apt` row in a lock of any repository but `mica-system-base` |
| `package-without-pool` | a `package` row whose arch has no `pool` row |
| `sort-order` | rows out of the order of 1.4 |

Registry checks come on top, when a lock is published or consumed: every
reference, `upstream` rows included, reads back anonymously at its digest,
and every `package` sha256 is a layer of that architecture's pool.

## 2. OCI layout

Pools, boards and images live in `ghcr.io/micaoss/<repository>`, in the
package of the repository that publishes them.

- **Pool** `pool.<arch>.<release>`: one OCI image manifest per architecture,
  `artifactType` `application/vnd.mica.pool`, an empty config, one layer per
  archive with `mediaType` `application/vnd.mica.deb` and
  `org.opencontainers.image.title` the archive's file name with its real `+`.
  An `all` archive is a layer of both pools. Manifest annotations:
  `org.opencontainers.image.revision`, `.created` (the commit time), `.source`,
  `.version`, `mica.source-repo`, `mica.source-commit`, `mica.arch`.
- **Board** `board.<board>.<release>` (`mica-boards`): as today,
  `application/vnd.mica.board`, one layer per bundle path (`firmware/` as one
  tar), annotations `mica.board`, `mica.arch`, `mica.verity-cert-sha256` and
  the source annotations (`docs/boards/contract.md` §3).
- **Images** (build-env images, the Base rootfs): an OCI index and its
  platform manifests; the lock names both (`image` rows with the repository as
  source, `index`, `amd64`, `arm64`). Third-party images are not published here (1.2.1).

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
repository it reads (user, 2026-09-14):

- `locks/<repository>.lock`: that producer's lock asset, unchanged;
- `locks/pins/<repository>.pin`: that input's own record. `locks/pins` is a
  directory, so moving one input never edits a shared file and cannot
  corrupt another input's record. The `.pin` suffix is `mica-build`'s reading
  of the user's words; the directory and the one-record-per-repository rule
  are the user's.

A pin file is, in this order and nothing else:

```text
# mica-pin v1
REPOSITORY=<repository>
RELEASE=<YYYYMMDD-HHMM>
SHA256SUMS=<sha256 of that release's SHA256SUMS>
```

An offline pin has `RELEASE=offline`, `SHA256SUMS` the sha256 of the
checkout's `_out/offline/SHA256SUMS`, and one more line,
`CHECKOUT=<absolute checkout path>`; `CHECKOUT` appears only on an offline
pin.

Rules:

- the file rules of 1.1 apply (UTF-8, LF, final LF); no comment lines after
  the header *(fixed here)*;
- `REPOSITORY` equals the file name and the lock's release row;
- `RELEASE` equals the lock's release row (`offline` for an offline lock),
  and the lock itself passes section 1;
- every `locks/<repository>.lock` of a producer has exactly one pin, and no
  pin exists without its lock; `locks/upstream.lock` (4.1) has no pin;
- an offline pin is refused under CI (`CI` or `GITHUB_ACTIONS` set) and in
  every release build.

Moving one input replaces `locks/<repository>.lock` and
`locks/pins/<repository>.pin` together and touches no other file.

| Rule | Refused when |
|---|---|
| `header`, `encoding` | line 1 is not `# mica-pin v1`, or as in 1.5 |
| `pin-format` | a key missing, extra, repeated or out of order, `CHECKOUT` on a pin whose release is not `offline`, or no `CHECKOUT` on one that is |
| `field-value` | repository, release or sha256 out of form, or a `CHECKOUT` path that is not absolute |
| `name-mismatch` | `REPOSITORY` differs from the file name |
| `pin-without-lock` | a pin without `locks/<repository>.lock` |
| `lock-without-pin` | a lock without `locks/pins/<repository>.pin` |
| `lock-invalid` | a lock that fails section 1, or whose release row names another repository |
| `release-mismatch` | `RELEASE` differs from the lock's release row |
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
Language dependencies keep their own hashes (`Cargo.lock`, `bun.lock`,
`go.sum`) and are vendored into `repos/`. Base images by digest stay in the
local image store; offline, a missing one is refused.

## 6. `make offline`

Each repository's `make offline` builds its release outputs from `locks/`
into `_out/offline/`:

- `<repository>.lock`: a lock whose release row has `offline` and the
  checked-out commit; a dirty tree is refused;
- `oci/`: an OCI image layout holding every pool, board and image the lock
  names, by digest;
- `SHA256SUMS` over the lock.

References use the registry name `local`
(`local/<repository>:pool.amd64.offline@sha256:<digest>`) and resolve only
inside that checkout's `_out/offline/oci/`.

## 7. `tools/local-lock.sh`

`tools/local-lock.sh <repository> <checkout>` verifies
`<checkout>/_out/offline/SHA256SUMS` and every digest the lock names in the
checkout's OCI layout, writes `locks/<repository>.lock` unchanged and the
offline pin `locks/pins/<repository>.pin`. It is refused under GitHub Actions and in every
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
  `mica-boards.lock` (`board`, an `all` package on both architectures),
  `mica-system-base.lock` (`image`, `pool`, `package`, `upstream`, `apt`, a
  comment), `offline-mica-core.lock` (an offline lock with `local/`
  references).
- `lock/refused/`: one lock per refusal rule of 1.5, each a minimal edit of a
  valid lock; the image refusals are `image-source.lock` (a repository source
  other than the release row's), `image-source-reference.lock`
  (`reference-repository`, a reference outside the source's repository),
  `image-registry.lock` (`reference-registry`),
  `upstream-image-republished.lock` (`reference-upstream`) and
  `upstream-image-without-digest.lock` (`reference-digest`).
- `pins/valid/` and `pins/refused/`: directories holding a `locks/` content
  (the `.lock` files and `pins/<repository>.pin`); `release` (checked in `ci`
  mode) and `offline-checkout` (in `local` mode) are valid; one directory per
  rule of section 4: `name-mismatch`, `release-mismatch`, `pin-without-lock`,
  `lock-without-pin`, `checkout-in-ci`, plus `header`, `key-order` and
  `checkout-without-offline` (`pin-format`), `checkout-relative`
  (`field-value`) and `lock-invalid`.
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
