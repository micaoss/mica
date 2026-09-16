# The Mica version index release

- **date**: 2026-09-15
- **kind**: engineering decision
- **owner**: the mica-build owner
- **review sunset**: 2027-03-15
- **status**: accepted (user, 2026-09-15: "同意"; amended the same day for scale); implemented on `mica-build` `main` (index job `da1d36a1`, incremental cuts, full re-verification and the shared input table `9c2f399e`, `release-test` 43/43); released: the first index `mica/20260915-2240`, built in full, and the first incremental index `mica/20260915-2242`, both verified anonymously; specified in `docs/design/release-lock.md` 1.2.3 and `docs/design/mica-index.md`

## Decision

**Purpose.** A Mica version is one immutable, versioned `mica-build`
release, `mica.<YYYYMMDD-HHMM>` (a dot since 2026-09-16,
`docs/decisions/2026-09-16-scoped-tags-use-a-dot.md`; `mica/20260915-2240` and
`mica/20260915-2242` were cut before that date), naming the scoped product
releases that form
it. It has no image or update archive of its own. An external reader
reconstructs the complete state from it alone: the boards, the products,
their artifacts and their board and base inputs. Applications find the
newest version as the greatest `mica/*` tag: index releases are marked the
GitHub latest release, and scoped releases are cut with `--latest=false`.

**Automatic only.** After every fully successful scoped release, the
`release.yml` index job cuts `mica.<stamp>` with `gh release create` using the
workflow token: a draft, its assets, the checks, publication, and an
anonymous read-back. It targets the tip of `main`, is serialized
(`concurrency: mica-index`), and selects at run time the newest scoped
release for every product with `PUBLISH=1`. A manual `mica/*` release is
refused. The cut refuses a product generation lower than in the previous
index, a copied row that differs from its source, and a trust hash that does
not match; the stamp must be later than every referenced release and the
previous index. There is no override file for now.

**Lock.** `release mica-build mica.<stamp> <commit>`; an
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

**Amended for scale** (user, 2026-09-15, for hundreds of products; the shape
as `mica-build` emits it at `9c2f399e`, `docs/design/mica-index.md`):

- Generation is incremental: the previous index is the newest `mica/*` tag,
  and a later index reads only its three files (`SHA256SUMS` listing exactly
  the lock and the JSON, a lock that passes the checker, and JSON whose
  lock-derived parts equal a render of the lock) plus the scoped release just
  published. Carried entries are copied unread; entering entries are fully
  checked, refusing a generation that goes down, conflicting trust for one
  input, two releases of one scope, or a stamp that is not later. The first
  index is built in full. `PUBLISH=0` products are dropped and shown in the
  catalogue with `publish` and `indexed` false. No index is cut when nothing
  enters or drops.
- `tools/release.sh verify-index <tag>` re-derives an index incrementally and
  byte-identically; `verify-index <tag> --full` rebuilds every entry and
  publishes nothing; `ci.yml`'s `release-index` job runs `--full` against the
  newest `mica/*` index (and `index --dry-run` before the first exists).
- `mica-index.json` names the index it was cut from as `previous` and
  de-duplicates the inputs into one top-level `inputs` table, one entry per
  distinct `built` row with `id` = `<built name>/<release>`, which
  `releases[].inputs` reference; the lock keeps the `built` rows verbatim.
- Per-board sharding is reserved and not emitted: the proposed optional
  `catalogue.boards[].shard` (`mica-index.<board>.json` with its sha256) and
  the proposed threshold of 1 MiB are recorded as reserved proposals.
- The catalogue's `releaseTarget`, `publish` and `indexed` are booleans, and
  `features` an array of strings.

## Rationale

Scoped releases publish one board at a time, so no single release says which
products form "Mica" at a moment. An index release that only references
immutable scoped releases gives applications and people one tag to follow,
without rebuilding or republishing anything, and copying the rows verbatim
lets a reader verify the index against its sources.

## Removal condition

Revisited when products are no longer released by scope, or when a version
needs content that is not already in a scoped release.
