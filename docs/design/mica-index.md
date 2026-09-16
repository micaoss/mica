# The Mica version index: `mica-index.json` (`mica/index/v1`)

A Mica version is one immutable `mica-build` release, `mica.<YYYYMMDD-HHMM>`,
that names the scoped product releases forming it
(`docs/decisions/2026-09-15-mica-version-index.md`). It carries no image or
update archive of its own. Its lock is the index lock of
`docs/design/release-lock.md` 1.2.3; this document specifies its second
asset, `mica-index.json`, from which an external reader reconstructs the
complete state (the boards, the products, their artifacts and their board and
base inputs) without reading anything else first.

This is the shape `mica-build` emits at `main` `9c2f399e` (`release-test`
43/43).

## 1. Release assets

An index release carries exactly three assets: `mica-build.lock`,
`mica-index.json`, and `SHA256SUMS` listing both. It is the one exception to
"a release carries only its lock and `SHA256SUMS`"
(`docs/design/release-lock.md` section 1). The reserved shard files of 3.2
would join these assets and `SHA256SUMS`; none is emitted today.

## 2. Encoding

`mica-index.json` is canonical JSON: UTF-8, object keys in the order of 3, no
insignificant whitespace, and a final LF. Members marked `?` are omitted when
absent, never null. `releaseTarget`, `publish` and `indexed` are booleans,
`features` is an array of strings, sizes and generations are integers, and
digests are lowercase hex.

## 3. Shape

```text
{
  schema: "mica/index/v1",
  version: "<YYYYMMDD-HHMM>",
  commit: "<40 hex>",
  lock: { file: "mica-build.lock", sha256 },
  previous?: { release: "mica.<YYYYMMDD-HHMM>", trust },
  inputs: [ { id, repository, scope?, release, trust } ],
  releases: [ { release, trust, commit, inputs: [ id ] } ],
  products: [
    { product, board, profile, generation, deployment, kernel, rootfs,
      release,
      bundles: { image, update },
      images: [ { kind, file, url, sha256, size,
                  compression, uncompressedSha256, uncompressedSize } ],
      updates: [ { kind, file, url, sha256, size,
                   requires: { generationBelow, kernel?, rootfs? } } ] } ],
  catalogue: {
    boards: [ { board, arch, releaseTarget,
                pinnedBoardsRelease: { release, trust } } ],
    products: [ { product, board, profile, features, publish, indexed } ] }
}
```

### 3.1 Members

- `version` is the index release's stamp and `commit` its lock's release
  commit; `lock` names the lock asset and its sha256.
- `previous` is the index this one was cut from, with `trust` the sha256 of
  its `SHA256SUMS`; it is omitted only on the first index.
- `inputs` has one entry per distinct `built` row of the lock, with
  `id` = `<built name>/<release>` (for example `mica-boards.uefi-x64/<release>`
  or `mica-core/<release>`), the repository, the scope where the name has
  one, the release and its `trust`. **The id keeps its slash** *(fixed here,
  2026-09-16)*: it joins a built name to a release rather than naming a git
  tag, and the name already separates repository from scope with a dot, so
  `mica-boards.uefi-x64/<release>` stays readable while the release tag it
  refers to is `uefi-x64.<release>`. One `id` with two trust hashes is
  refused. The lock itself keeps every `built` row verbatim per release.
- `releases` has one entry per `input` row: the scoped release, its `trust`,
  its `commit` (the `origin` row) and its inputs as `id`s.
- `products` has one entry per `index` row, with the identities of the copied
  `product` row, the scoped `release` it comes from, the `bundles`
  references, and its `images` and `updates` from the copied `asset` rows.
  `url` is
  `https://github.com/micaoss/mica-build/releases/download/<scope>.<stamp>/<file>`,
  the scoped release tag of `docs/design/release-lock.md` 1.0.
  `size`, and for images `compression`, `uncompressedSha256` and
  `uncompressedSize`, come from the referenced OCI layers.
  `requires.generationBelow` is the archive's generation; a `root` archive
  also requires `kernel` and a `kernel` archive `rootfs`, the identity of the
  component the archive does not carry.
- `catalogue` is read from the index commit's tree and is never part of the
  lock: every board with its architecture, whether it is a release target
  and the boards release it is pinned to, and every product with its board,
  profile, features, whether it is published and whether this index includes
  it. A catalogue product's `publish` is **true when its board is a release
  target** (`BOARD_RELEASE_TARGET=1`) *(fixed here, 2026-09-16)*: the
  `PUBLISH` product key is gone with the minimal products
  (`docs/decisions/2026-09-16-minimal-products-removed.md`), and one mechanism
  decides both. A product whose board is not a release target is absent from
  `products` and listed here with `publish` and `indexed` false, which is
  `s905x5m-dev` today.

Sort orders: `inputs` by `id` bytes; `releases` by `release`, each with its
`inputs` sorted; `products` by `product`; `images` and `updates` by `kind`;
`catalogue.boards` by `board` and `catalogue.products` by `product`.

### 3.2 Reserved: per-board shards

Sharding is reserved and not emitted. The proposed form is an optional
`catalogue.boards[].shard: { file: "mica-index.<board>.json", sha256 }`: when
present, that board's `products` entries move into that file, in the same
form, and the file joins the release assets and `SHA256SUMS`. The proposed
threshold is an unsharded document over 1 MiB, about 500 products at the
measured 1.9 KB per product. Both the member and the threshold are proposals.

## 4. Generation

- The previous index is the newest `mica.*` tag; the first index is built in
  full.
- A later index is incremental. It reads only the previous index's three
  files and the scoped release just published. `SHA256SUMS` must list exactly
  the lock and the JSON, the lock must pass the checker of
  `docs/design/release-lock.md`, and the lock-derived parts of the JSON must
  equal a render of that lock.
- Carried entries are copied without being read again; entering entries are
  fully checked.
- A cut is refused for a generation that goes down, conflicting trust for
  one input, two releases of one scope, or a stamp that is not later.
- Products whose board is not a release target are dropped from `products`
  and shown in the catalogue with `publish` and `indexed` false.
- No index is cut when nothing enters or drops.

## 5. Checks

The checker of `docs/design/release-lock.md` proves the index lock's file
rules; the checks across releases are done at the cut and by the verifier:

- `mica-build:tools/release.sh verify-index <tag>` re-derives an index
  incrementally and requires byte-identical files.
- `verify-index <tag> --full` rebuilds every entry from its sources and
  publishes nothing.
- `mica-build`'s `ci.yml` job `release-index` runs `--full` against the
  newest `mica.*` index on pushes to `main`, and `index --dry-run` before the
  first index exists.
