# The Mica version index: `mica-index.json` (`mica/index/v1`)

A Mica version is one immutable `mica-build` release, `mica/<YYYYMMDD-HHMM>`,
that names the scoped product releases forming it
(`docs/decisions/2026-09-15-mica-version-index.md`). It carries no image or
update archive of its own. Its lock is the index lock of
`docs/design/release-lock.md` 1.2.3; this document specifies its second
asset, `mica-index.json`, from which an external reader reconstructs the
complete state (the boards, the products, their artifacts and their board and
base inputs) without reading anything else first.

## 1. Release assets

An index release carries exactly three assets: `mica-build.lock`,
`mica-index.json`, and `SHA256SUMS` listing both. It is the one exception to
"a release carries only its lock and `SHA256SUMS`"
(`docs/design/release-lock.md` section 1).

Implemented on `mica-build` `main` `da1d36a1` (the index job is live; the CI
dry run is green; the JSON key order follows this document). The schema text
below is aligned precisely to the shape `mica-build` emits once it has sent
that shape.

## 2. Encoding

`mica-index.json` is canonical JSON: UTF-8, object keys in the order given
below, no insignificant whitespace, integers for sizes and generations,
lowercase hex for digests, and a final LF *(fixed here)*. Optional members
(marked `?`) are omitted, never null.

## 3. Shape

```text
{
  schema: "mica/index/v1",
  version: "<YYYYMMDD-HHMM>",                    the index release's stamp
  commit: "<40 hex>",                            the index lock's release commit
  lock: { file: "mica-build.lock", sha256: "<64 hex>" },
  inputs: [                                      every distinct built row once, shared
    { id, repository, scope?, release, trust } ],
  releases: [                                    one per input row, sorted by release
    { release: "<scope>/<YYYYMMDD-HHMM>",
      trust: "<sha256 of that release's SHA256SUMS>",
      commit: "<40 hex>",                        its origin row
      inputs: [ <id>, ... ] } ],                 its built rows, by id into inputs
  products: [                                    one per index row, sorted by product
    { product, board, profile, generation,
      deployment, kernel, rootfs,                the product row's identities
      release: "<scope>/<YYYYMMDD-HHMM>",        the scoped release it comes from
      bundles: { image: "<reference>", update: "<reference>" },
      images: [
        { kind, file, url, sha256, size,
          compression, uncompressedSha256, uncompressedSize } ],
      updates: [
        { kind, file, url, sha256, size,
          requires: { generationBelow, kernel?, rootfs? } } ] } ],
  catalogue: {
    boards: [ { board, arch, releaseTarget: <boolean>,
                pinnedBoardsRelease: { release, trust } } ],
    products: [ { product, board, profile, features,
                  publish: <boolean>, indexed } ] }
}
```

- `releases`, `products` and every `bundles`, `images` and `updates` entry
  are derived from the index lock: the `input`, `origin` and `built` rows,
  and the copied `product`, `bundle` and `asset` rows.
- `inputs` de-duplicates the board and base inputs (user, 2026-09-15): each
  distinct `built` row appears once with an `id`, and every release lists its
  inputs by `id`. The lock itself keeps every `built` row verbatim per
  release.
- A per-board sharding of the document is reserved in the shape but not
  enabled; an index is one document.
- In the catalogue, `publish` (the product's `PUBLISH`) and `releaseTarget`
  are booleans; a product no longer published (`PUBLISH=0`) is absent from
  `products` and appears in the catalogue with `indexed` false.
- `url` is the GitHub Release download URL of the asset in its scoped
  release; `size` and, for images, `compression`, `uncompressedSha256` and
  `uncompressedSize` are read from the referenced OCI layers
  (`mica.compression`, `mica.uncompressed-sha256`,
  `mica.uncompressed-size`).
- `requires` states what a device must run for an update archive to apply:
  `generationBelow` (the archive's generation), and for a `root` or `kernel`
  archive the identity of the component it does not carry (`kernel` for a
  `root` archive, `rootfs` for a `kernel` archive).
- `catalogue` is read from the index commit's tree (`products/`, the boards
  list and the board pins) and is never part of the lock: every board with
  its architecture, whether it is a release target and the boards release it
  is pinned to, and every product with its board, profile, features,
  `PUBLISH` value and whether this index includes it.

## 4. Generation

An index is generated incrementally (user, 2026-09-15, for hundreds of
products):

- The new index is the previous `mica/*` index, re-read and checked against
  its `SHA256SUMS`, plus the scoped release just published.
- Only entering or replacing entries get the full cross-release checks; the
  refusals for them are unchanged. The first index is built in full.
- A product that is no longer `PUBLISH=1` is dropped from `products` and
  shown in the catalogue.

## 5. Checks

The checker of `docs/design/release-lock.md` proves the index lock's file
rules. The cross-release checks are done when the index is cut and by the
verifier, not by that checker: each copied row equals its source lock's row,
each `trust` equals the referenced release's `SHA256SUMS` sha256, no product's
generation is lower than in the previous index, and the stamp is later than
every referenced release and the previous index. A read-only full
re-verification of the newest `mica/*` index,
`mica-build:tools/release.sh verify-index <tag> --full`, runs in
`mica-build`'s `ci.yml` on pushes to `main`, so every entry is re-checked even
though a cut checks only the entering ones.
