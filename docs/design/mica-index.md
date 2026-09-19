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
      images: [ { kind, file, url, mirrors?, sha256, size,
                  compression, uncompressedSha256, uncompressedSize } ],
      updates: [ { kind, file, url, mirrors?, sha256, size,
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
- `mirrors` is an optional array of absolute `https` URLs, emitted immediately
  after `url` and **omitted entirely when absent** *(fixed here, 2026-09-16,
  on `mica-res`' proposal)*. A reader may try its entries in order and fall
  back to `url`; a mirror URL that does not answer is not an error, it is the
  next URL. **A mirror is a source, never a trust anchor**: `sha256` and
  `size` beside `url` stay the only proof, and a reader that takes bytes from
  a mirror verifies them exactly as it would from `url`. `url` keeps its form
  and meaning — the release's own URL — so a pruned or unreachable mirror
  costs a reader nothing that the release still has.
- Each entry is **derived, never looked up**:
  `<base>/mica/<scope>/<stamp>/<file>`, with the scope and stamp of the
  release the asset belongs to and the file name unchanged. Since 2026-09-18
  the base is the download host and the key has no `/d/` prefix, so a mirror
  URL reads
  `https://dl.res.micaos.dev/mica/<scope>/<stamp>/<file>` *(fixed here)*.
  `mica-res` now serves three hosts — `dl.res.micaos.dev` for the files,
  `res.micaos.dev` for directory listings, `/blob/<aa>/<sha256>`, the `/v2`
  registry and the console, and `s3.res.micaos.dev` for the S3 read API — and
  the rule for the move is one sentence: the new key is the old readable name
  with the `/d/` prefix dropped. `/blob/` and `/v2` are unchanged, `/blob/`
  now answering by redirect to the download host, and the v1 `/index/`
  documents are frozen.
- The bases are a **committed file in `mica-build`**, `mirrors.list`: one
  absolute `https` base per line, **in preference order**, today one line,
  `https://dl.res.micaos.dev`. Each base derives one entry, and the entries
  appear **in the file's order** — the array's order is the file's order, and
  an emitter that sorts either is wrong (the sort-order paragraph below says
  why). A committed file rather than an environment variable *(fixed here)*:
  an index that had to ask a mirror what it holds, or whose member depended on
  a runner's configuration, would stop rebuilding identically from a clean
  checkout, and that property is not negotiable. No file, or an empty one, and
  the member is omitted.
- Refused: an entry that is not an absolute `https` URL; an empty `mirrors`
  array, which is omitted instead; a duplicate entry within one array; an
  entry equal to `url`, which is not a mirror but the source the reader
  already has; and an entry that `verify-index` cannot re-derive from the
  base, scope, stamp and file name.
- **Already-published indexes are not broken by a mirror move, and are never
  republished for one** *(2026-09-18, the first time this property carried
  weight)*. They carry the old URLs, those URLs may stop answering, and that
  is the designed behaviour rather than damage: a mirror that does not answer
  is the next URL, and the last URL is `url`, the release's own. A reader
  falls back to GitHub and gets the same bytes, proven by the same `sha256`.
  The host moved and nothing had to be reissued — that is what "a mirror is a
  source, never a trust anchor" buys, and it is the strongest argument this
  design has produced so far.
- **Disputed, and recorded as disputed:** whether the old `/d/` URLs still
  answer today. `mica-res`' migration notice says the old paths are removed
  only once all four consumers have landed and not before 2026-10-02, while
  its own sync has been failing since 2026-09-19 08:46 because its git pack
  lookups at `/d/…` find nothing. `mica-res` is settling it with a probe from
  a runner, since neither it nor the coordinator can reach the zone from a
  container on this host. Neither version is written here as fact until that
  probe reports: a claim about what a host serves is not established until
  someone who can reach the host says so.
- **Reachability is measured per environment, and the scope of a measurement
  is part of it.** The `res.micaos.dev` zone serves CI and the developer
  machine normally. What was measured unreachable on 2026-09-16 is **the agent
  containers on one host**: from inside a container `188.114.96.5`,
  `188.114.97.5` and `172.67.0.1` time out while `104.16.123.96` and
  `1.1.1.1` open instantly, with no proxy variables and a plain docker bridge
  route — container egress, almost certainly host-side routing that does not
  cover the bridge. It is neither a property of the mirror nor of the
  development network. Nobody has yet measured a fetch through the mirror
  hook, so no page claims one either way; `url` is unaffected regardless,
  which is the point of `mirrors` being advice.
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

**`mirrors` is the one list that is not sorted**, and a reader must not sort
it: it is a preference list, its order is the emitter's and the order is the
content. Every other list in this document is sorted, so this exception is
stated here rather than left to be discovered by the next person who sees a
sortable-looking array.

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
- **If the committed mirror base changed since the previous index, the cut is
  a full rebuild** *(fixed here, 2026-09-16)*. `mirrors` is derived at the
  index's commit, so carrying an entry would keep a member derived from the
  old base beside entering entries derived from the new one: the file would
  disagree with itself, and `verify-index --full`, which re-derives every
  entry from the base at that commit, would not reproduce the incremental
  cut. Rebuilding in full keeps one rule — every `mirrors` member in an index
  is derived from the base committed at that index's own commit — and costs a
  rebuild on the rare cut where the list moves. The same holds for the first
  index that emits the member at all, which is a full rebuild by the same
  reasoning.
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
- `verify-index` re-derives every `mirrors` entry from the committed base and
  the asset's own scope, stamp and file name, and refuses one it cannot
  re-derive. Without that check a `mirrors` member would be the one part of
  the index that an emitter could put anything into and still verify.

**A release an index references is not deleted, even when it is defective**
*(fixed here, 2026-09-16)*. `--full` rebuilds the index from the releases it
names, so deleting one leaves a published index that can never verify again —
the defect would be traded for a permanently unverifiable record. Withdraw a
bad release by superseding it: cut the corrected one, let the index move on,
and leave the old release and the index that referenced it in place as
history. The instance: `cx3576.20260916-0847` published a wrong product
generation and stays published, with `mica.20260916-0858` which references it;
`cx3576.20260916-1653` supersedes it at the corrected generations, and the
generation counter makes devices refuse the bad rows without anyone having to
remember which release was bad.

**The one exception, named so that it is not taken silently: withdrawal for
safety.** The rule above is about a defect in *content*, where a superseding
release is the whole remedy and the counter protects devices. It does not
cover a release whose artefacts are unsafe to have on a device at all —
compromised signing material, an artefact signed that should not have been,
bytes that must not remain fetchable. Removing those is a **user decision that
accepts a cost**, and the cost is stated when it is taken:

- every index that references the release becomes permanently unverifiable by
  `--full`, so the withdrawal covers those indexes too — they are removed with
  it, not left pointing at something that is gone;
- a record names which releases and which indexes were withdrawn and why,
  because after the fact nothing in the published set can explain its own
  absence.

A rule with a named exception is followed. A rule that reads "never delete"
against a compromised release is either broken quietly or obeyed wrongly, and
both are worse than a documented cost.
