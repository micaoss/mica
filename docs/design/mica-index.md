# The Mica version index: `mica-index.json` (`mica/index/v1`)

A Mica version is one immutable `mica-build` release, `mica.<YYYYMMDD-HHMM>`,
that names the scoped product releases forming it
(`docs/decisions/2026-09-15-mica-version-index.md`). It carries no image or
update archive of its own. Its lock is the index lock of
`docs/design/release-lock.md` 1.2.3; this document specifies its second
asset, `mica-index.json`, from which an external reader reconstructs the
complete state (the boards, the products, their artifacts and their board and
base inputs) without reading anything else first.

**Which index a bare stamp means** *(2026-09-19)*. Two artefacts in this
workspace are called an index and both are stamped `YYYYMMDD-HHMM`, so a bare
stamp names neither of them:

| | This document | `mica-res`' bucket catalog |
|---|---|---|
| What it is | a published `mica-build` release naming scoped releases | a snapshot of what a bucket holds |
| Written as | `mica.<YYYYMMDD-HHMM>`, the release tag | `mica-res`' own form |
| Verified by | byte-identical rebuild from the releases it names | an audit against the bucket |
| Answerable by | `mica-build` | `mica-res` |

They can disagree, and the failure that matters is not a confusing sentence:
it is verifying the wrong artefact and reporting it healthy. So **the version
index is written with its tag, `mica.<stamp>`, never as a bare stamp** —
the coordinator conflated the two within minutes of reading both reports on
2026-09-16, which is how cheap the mistake is.

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
  `<prefix>/<scope>/<stamp>/<file>`, with the scope and stamp of the release
  the asset belongs to and the file name unchanged *(fixed here, 2026-09-19)*.
  The **whole prefix** is the committed value, so this document names no path
  shape of another service: when a host or a layout moves, one line moves in
  one repository and this rule does not change. Today that line is
  `https://dl.res.micaos.dev/mica`, which is an example of the prefix and not
  the rule.
- The prefixes are a **committed file in `mica-build`**, `mirrors.list`: one
  absolute `https` prefix per line, **in preference order**. Each prefix
  derives one entry, and the entries appear **in the file's order** — the
  array's order is the file's order, and an emitter that sorts either is wrong
  (the sort-order paragraph below says why). A committed file read at the
  index's own commit, never an environment variable and never a lookup
  *(fixed here)*: an index that had to ask a mirror what it holds, or whose
  member depended on a runner's configuration, would stop rebuilding
  identically from a clean checkout, and that property is not negotiable. No
  file, or an empty one, and the member is omitted.
- What `mica-res` serves is a fact a reader needs, and is not part of the
  derivation above: three hosts — `dl.res.micaos.dev` for the files,
  `res.micaos.dev` for directory listings, `/blob/<aa>/<sha256>`, the `/v2`
  registry and the console, and `s3.res.micaos.dev` for the S3 read API. The
  2026-09-18 move was one sentence — the new key is the old readable name with
  the `/d/` prefix dropped — with `/blob/` and `/v2` unchanged, `/blob/`
  answering by redirect to the download host, and the v1 `/index/` documents
  frozen.
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
- **It has now been paid out twice in three days**, and the second time is the
  larger one: the mirror held *nothing at all* for about a day and a half
  (2026-09-18 to 2026-09-19), and no repository noticed in its results. Every
  consumer treated the non-answering mirror as the next URL and fell back
  upstream, every run stayed green, and the only effect was slower fetches. A
  resource service can be empty without any of this breaking, which is the
  property being load-bearing rather than merely stated.
- **Settled, by two dated runs rather than a probe:** the old `/d/` paths
  stopped answering on or before 2026-09-19 16:19, with no consumer having
  landed. `mica-boards`' CI prints whether each fetch was mirrored, and it ran
  the same command twice from GitHub runners, which do reach the zone: run
  `35207062715` (2026-09-17 09:47) had all eleven fetches mirrored, run
  `35454561921` (2026-09-19 16:19) had none — all eleven fell back — with
  `MICA_MIRROR` unchanged since 2026-09-16. So the side that was right is the
  failing sync, and `mica-res`' migration notice, which said the old paths
  survive until 2026-10-02, describes a plan that was not followed. Nothing
  broke: the fallback is the designed behaviour.
- **Settled, and nothing is disputed here any more:** `/blob/<aa>/<sha256>`
  did not stop answering because of a path change or a redirect the client
  does not follow — **there was nothing behind it to answer**. Measured by
  `mica-res` from a runner on 2026-09-19, with redirects not followed: the
  legacy `/d/upstream/git/…` and `/d/mica/…` paths, the current
  `/upstream/git/…` and `/mica/…` keys, the same keys on
  `dl.res.micaos.dev`, and the digest lookup `/blob/<aa>/<sha256>` all
  answered `404`; only `/index/current.json` answered at all, with a `302`.
  The v1 import never ran after the 2026-09-18 cutover, so the service has
  held none of the 486 objects and 8.2 GB since then: the mirror was empty for
  about a day and a half. Confirmed from a second vantage by a second method
  on 2026-09-19 — and by better evidence than a `404`: `/upstream/` and
  `/mica/` answer `200` and **render their namespace listings with the table
  body empty**. A `404` is consistent with a moved path, a wrong key or a
  route that was never wired; a listing page that renders its title, its
  description and its headers with no rows says something narrower and final —
  **the service is up, its structure is correct, its routes work, and it holds
  nothing**. The lesson for the next reader who meets `404`s from a mirror:
  look at the listing before concluding the path is wrong. A full re-publish from the producers' locks is
  ran — from the **pins**, not the v1 import, which would reconstruct from a
  snapshot of the service being retired; where the two disagree the locks win.
- **The mirror serves again, and the two facts about that are kept apart**
  *(2026-09-19 evening)*. `/upstream/` and `/mica/` render directory rows
  instead of empty tables — `upstream/debian/`, `upstream/git/`,
  `upstream/source/`, `mica/cx3576/`, `mica/uefi-x64/` — with namespace counts
  `upstream` 390, `oci` 115, `mica` 30, `status` 315. **And a party outside
  the service checked one object against a lock that neither the mirror nor
  its own audit produced**: `alsa-utils` `amd64` `1.2.14-1`, sha256
  `1e2b5f31fc826e1af25e2a12e37cd8d361ff25feaf224c6bbef3cc5d6cd2596b` in the
  `mica-system-base` `20260919-1959` lock, fetched from
  `/blob/1e/1e2b5f31…2596b` — `200` after one redirect, 1 140 648 bytes in
  0.48 s, and the received bytes hash to that digest. So the digest route
  resolves, the redirect contract works as specified, and the mirror serves
  the bytes a producer lock pins. That same digest answered `404` in the
  evening's earlier probe.
- **What that check did not establish, and what the audit then did.** The
  digest check above was one object, not the whole set: a spot check. The
  audit that answers the set ran the same evening, in **both directions**
  against the final catalogue — 508 keys in the catalogue and in the locks
  (492 before the 21:03 releases), **0** in the locks and missing, **0** in
  the catalogue named by no lock, **0** with the same key and a different
  digest; 896 public objects audited with digests verified, 0 problems; 31
  declared pack chunks, 0 problems; 16 index URLs verified by digest, 0
  problems. Forward: everything the locks name is present. Reverse:
  everything held is named by a lock or derived from a commit a lock pins,
  and nothing else. The reverse column reads 0 because the arithmetic closes
  exactly, not because nothing was checked.
- **Two numbers, two units, and the reason to carry both.** The contract
  requires **44 keys** — 13 manifests plus 31 chunk names — while the bucket
  stores **43 byte strings**, because one 64 MiB chunk coincides between the
  two `uefi` packs. So 492 + 44 = 536 answers *what must resolve* and
  492 + 43 = 535 answers *how many distinct objects exist*; a bare number is
  wrong for whichever question its reader is not asking. State the unit with
  the number.
- **The gap was a defect, not a rounding difference.** `uefi-x64-kernel` pack
  chunk 00 existed as an object under the `arm64` name only, so a consumer
  following the contract failed on the first chunk of the largest tree
  `mica-boards` pulls — **while the audit and the reconciliation both read
  clean**, because both are about the object *set* and neither was about the
  *contract over names*. It is repaired and independently verified (both names
  answer, both serve bytes hashing to the declared digest), and the check that
  can see the class now exists: every chunk a manifest declares must resolve
  under that manifest's own name, 31 walked, exactly one such case ever
  existed.
- **Reachability is measured per environment, and the scope of a measurement
  is part of it.** The `res.micaos.dev` zone serves CI and the developer
  machine normally. What was measured unreachable on 2026-09-16 is **the agent
  containers on one host**: from inside a container `188.114.96.5`,
  `188.114.97.5` and `172.67.0.1` time out while `104.16.123.96` and
  `1.1.1.1` open instantly, with no proxy variables and a plain docker bridge
  route — container egress, almost certainly host-side routing that does not
  cover the bridge. It is neither a property of the mirror nor of the
  development network. `url` is unaffected regardless, which is the point of
  `mirrors` being advice.
- **A second measurement, with its own scope** (2026-09-19, from an agent
  container on this host): `dl.res.micaos.dev` resolves to `188.114.97.5`,
  `s3.res.micaos.dev` to `188.114.96.5` and `res.micaos.dev` to
  `188.114.97.5`, and all three time out on 443 from that container while
  `www.cloudflare.com` answers in 0.14 s from the same place. The new download
  host is in the same unreachable range as the old one, from that vantage.
  This does not update the measurement above; it sits beside it, and it says
  nothing about runners or the user's machine, where the zone is reachable —
  `mica-boards`' mirrored fetches of 2026-09-17 are that side's evidence.
- **A third measurement, also with its own scope** (2026-09-19 20:0x UTC, the
  agent container on this host, reaching the zone through a container-local
  address mapping the user supplied, `104.19.151.13 res.micaos.dev`; the host
  then answers in 0.09 s). It is a fact about that container, not about the
  zone or about DNS, and it replaces neither measurement above. What it adds
  is the evidence quoted in the settled bullet: `/` and `/v2/` answer `200`,
  `/upstream/` and `/mica/` render empty listings, `/index/current.json`
  answers `302`, and `/blob/<aa>/<sha256>` for an object the locks pin,
  `/upstream/debian/`, the legacy `/d/upstream/debian/` and
  `/status/current.json` all answer `404`.
- **Settled the same evening:** the `status` namespace had gone with
  everything else and is back. The collector published with its new token —
  `status` went from 0 to 315 objects, `/status/current.json` and
  `/status/health.json` both answer `200`, and `health.json` at
  `generatedAt` `2026-09-19T20:37:56Z` reports `green` for all eight
  repositories with `runsSince` 0. It is the same verdict a person reached by
  hand an hour earlier, now computed and republished every thirty minutes by
  something that does not depend on anyone looking, which is the difference
  between a status page and a status check.
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

The second instance is larger and tests the rule properly *(2026-09-19)*.
Six releases — `uefi-x64` and `uefi-arm64` at `20260916-0845`,
`20260916-1653` and `20260919-2103` — carry images that do not boot: PID 1
refuses the board name in the image's own signed identity and the guest powers
down at 1.7 seconds ([harness](build-harness.md) section 4). The recommended
remedy is the rule's: **supersede, do not delete.** A non-booting image is
non-functional, not unsafe; it sits on a disk doing nothing and a reflash
recovers the unit, so it does not reach the withdrawal exception below, which
is about bytes that must not remain fetchable.

The cost of deleting instead is a boundary rather than a count *(read on
2026-09-19)*: **every index cut since the rename references at least one of
the six, and the one cut before it references none.** Ten index releases
exist — nine `mica.<stamp>` from `mica.20260916-0852` to `mica.20260919-2115`,
and the slash-form `mica/20260915-2242` that predates the cut-over. The tenth
is clean for the reason that confirms the diagnosis: it names
`cx3576/20260915-2230` and `x64/20260915-2230`, the board names the client of
that era matched. So deleting the six would take all nine post-rename indexes
with it as `--full` casualties and leave that single pre-rename index the only
verifiable one in the repository — and the index history becomes evidence for
the diagnosis instead of a casualty of it. That is exactly the trade this rule
refuses. What to do with the published releases is a user decision and is with
them; nothing is deleted and no published release is edited while it is.

Two corrections stand behind that sentence, and the second is the instructive
one. The figure first circulating was **three**, taken from one release round
and written as though it were the population. The correction to nine was read
index by index here, and two of those nine were later re-read elsewhere and
matched — a spot check confirming the reading, not a second audit. But nine
was itself short by one: the query tested for the `mica.` prefix and therefore
could not match the slash-form index at all, so it returned nine of ten while
reporting a population. Enumerating releases here matches both separators
([release-lock](release-lock.md) section 1.3). What is worth keeping is not
any of the numbers: it is that each was one query away, and that a boundary
sentence would have been checkable in a way none of the counts were.

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
