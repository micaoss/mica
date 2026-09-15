# The Mica version index release

- **date**: 2026-09-15
- **kind**: engineering decision
- **owner**: the mica-build owner
- **review sunset**: 2027-03-15
- **status**: accepted (user, 2026-09-15: "同意"; amended the same day for scale); implemented on `mica-build` `main` `da1d36a1` (index job live, CI dry run green), no `mica/*` release cut yet; specified in `docs/design/release-lock.md` 1.2.3 and `docs/design/mica-index.md`

## Decision

**Purpose.** A Mica version is one immutable, versioned `mica-build`
release, `mica/<YYYYMMDD-HHMM>`, naming the scoped product releases that form
it. It has no image or update archive of its own. An external reader
reconstructs the complete state from it alone: the boards, the products,
their artifacts and their board and base inputs. Applications find the
newest version as the greatest `mica/*` tag: index releases are marked the
GitHub latest release, and scoped releases are cut with `--latest=false`.

**Automatic only.** After every fully successful scoped release, the
`release.yml` index job cuts `mica/<stamp>` with `gh release create` using the
workflow token: a draft, its assets, the checks, publication, and an
anonymous read-back. It targets the tip of `main`, is serialized
(`concurrency: mica-index`), and selects at run time the newest scoped
release for every product with `PUBLISH=1`. A manual `mica/*` release is
refused. The cut refuses a product generation lower than in the previous
index, a copied row that differs from its source, and a trust hash that does
not match; the stamp must be later than every referenced release and the
previous index. There is no override file for now.

**Lock.** `release mica-build mica/<stamp> <commit>`; an
`input mica-build.<scope> <release> <sha256>` per referenced scoped release;
the new rows `origin mica-build.<scope> <commit>` (key input),
`built mica-build.<scope> <repository>[.<scope>] <release> <sha256>` (key
input and name; the referenced lock's `input` rows verbatim) and
`index <product> mica-build.<scope>` (key product); and the `product`,
`bundle` and `asset` rows copied byte for byte for exactly the indexed
products. The rules `index-scope`, `index-only-inputs`, `index-input`,
`index-product-source` and `index-built-form` check the file; the checks
across releases are done at the cut and by the verifier, not by the checker.

**Assets.** Exactly `mica-build.lock`, `mica-index.json` and a `SHA256SUMS`
listing both, an exception to the lock-only release shape.

**`mica-index.json`** (`mica/index/v1`, canonical JSON): the version, commit
and lock; the referenced releases with their trust, commit and inputs; each
indexed product with its identities, release, bundles, images (with the
compression and uncompressed identity from the OCI layers) and updates (with
what they require); and a catalogue of boards and products taken from the
index commit's tree, never from the lock (`docs/design/mica-index.md`).

**Amended for scale** (user, 2026-09-15, for hundreds of products):

- Generation is incremental: a new index is the previous `mica/*` index,
  re-read and checked against its `SHA256SUMS`, plus the scoped release just
  published. Only entering or replacing entries get the full cross-release
  checks, with the same refusals; the first index is built in full; products
  no longer `PUBLISH=1` are dropped from `products` and shown in the
  catalogue.
- A read-only full re-verification, `tools/release.sh verify-index <tag>
  --full`, runs in `mica-build`'s `ci.yml` on pushes to `main` against the
  newest `mica/*` index.
- `mica-index.json` de-duplicates the inputs into one shared top-level table
  that `releases[]` reference by id; the lock keeps the `built` rows
  verbatim.
- Per-board sharding is reserved in the JSON shape but not enabled.
- The catalogue's `publish` and `releaseTarget` are booleans.

## Rationale

Scoped releases publish one board at a time, so no single release says which
products form "Mica" at a moment. An index release that only references
immutable scoped releases gives applications and people one tag to follow,
without rebuilding or republishing anything, and copying the rows verbatim
lets a reader verify the index against its sources.

## Removal condition

Revisited when products are no longer released by scope, or when a version
needs content that is not already in a scoped release.
