# 20260920-0610-producer-data-assets Where a producer publishes data about its own output

- **status**: proposed
- **createdAt**: 2026-09-20 06:10
- **approvedAt**: (pending — the user decides; this changes a rule the
  workspace instructions state)
- **relatedTask**: 20260920-0610-producer-data-assets

## Context

The defect and the measurement are in the task. What matters here is the
shape of the gap, not its instance: a producer computed something true about
its own output — which paths its packages do not own, and who writes them —
and there is no place in a release for it. The alternatives available today
are a CI artifact, which expires and cannot be pinned, or nothing.

Two things in the spec bear on it, and they are precedents rather than
obstacles:

- **The digest chain already carries extra files.** `mica-build`'s scoped
  releases publish images and update archives that `SHA256SUMS` does not
  list; each is an `asset` row in the lock with its sha256, so the chain is
  `SHA256SUMS` → lock → asset (1.2.2). Proven in every product release since
  2026-09-15.
- **`SHA256SUMS` already lists two files in one case.** An index release
  lists `mica-build.lock` and `mica-index.json` (1, 1.2.3). So "exactly one
  file" is already the rule with one stated exception, not an invariant.

Any answer should reuse one of these two mechanisms rather than invent a
third.

## Proposal

**A. A producer-data row and asset, reusing the `asset` mechanism**
(recommended).

A release of any repository may carry additional assets, each named by a row
in its own lock with its sha256. `SHA256SUMS` continues to list exactly one
file, the lock. The chain a consumer follows is unchanged: verify
`SHA256SUMS`, read the lock, take the row's sha256, fetch the asset, compare.

One correction to the form the coordinator recommended, and it is the reason
this is a proposal rather than an edit: **the existing `asset` row cannot be
widened literally.** Its columns are
`asset <product> image|update <kind> <file> <sha256>` — product-shaped, tied
to a `bundle` row by `asset-without-bundle`, and meaningless outside
`mica-build`. Widening it would give one kind two column layouts, which
`column-count` exists to prevent. So the mechanism is reused and the row is
new:

```text
data <name> <file> <sha256>
```

- `<name>`: the producer's own identifier for the datum, `[a-z0-9][a-z0-9.-]*`
  (`mica-system-base` would use `unowned.amd64`, `unowned.arm64`);
- `<file>`: the release asset's file name, same character class plus `.`;
- `<sha256>`: 64 hex, the asset's digest.

Refusals, in the vocabulary of 1.5: `column-count`, `field-value` for the
three fields, `duplicate-key` on `<name>`, and a new `data-file` for two rows
naming one file. `data` rows sort after `asset` in 1.4. Every `<file>` is an
asset of the release and every extra asset has a `data` row — an asset with no
row is `asset-unlisted`, the rule that keeps the old three-asset shape from
returning by the back door, which is exactly what `mica-system-base`'s
publisher enforces today.

**What it does not permit.** No packages (`.deb` stays out; packages live in
the pools). No image, archive or anything a device installs — those are
`mica-build`'s `asset` rows and are governed by 1.2.2. No build input: a
build reads pools and lock rows, never a `data` asset, so a repository may not
make its own build depend on another's `data` file. Nothing mutable: the asset
is fixed at the release like every other, and correcting it means the next
release.

**What `SHA256SUMS` still means.** Exactly one file, the lock — unchanged,
including the index-release exception, which stays as it is. A `data` asset is
covered by the lock, never by `SHA256SUMS`.

**What a consumer may assume about a `data` row it does not understand.** That
the file it names exists in that release and hashes to that value; that it is
**not** needed to build, verify or install anything, so skipping it is always
safe; and that its meaning is the producer's, not the format's. What a
consumer may *not* do is treat an unknown `data` name as an error — but it
must still refuse an unknown *kind*, so `kind-unknown` is unchanged and every
reader in the workspace learns `data` in the same round. There is no
transition: readers and writers move together, as they did for the format
itself.

**B. The rows go in the lock, and no asset exists** (the alternative I would
pick if A is rejected).

`unowned <arch> <path> <writer>` rows in `mica-system-base.lock`. 186 rows
today for two architectures. It keeps "a release carries exactly two assets"
literally true, needs no asset rules at all, and reuses the sort, duplicate
and refusal machinery unchanged. Its cost is what the lock becomes: today it
states *identities* — what went in, what came out, and their digests — and a
reader can hold all of it. Folding in a dataset makes the lock a data carrier
whose size follows Debian rather than the release, and every reader parses
rows it will never use.

**The criterion that should decide between A and B**, since both work: is the
datum *identity-shaped and bounded* — belonging to the description of the
release — or is it *a dataset that grows with the output*? The first belongs
in the lock, the second behind an `asset`-style row. The unowned list is the
second: it tracks Debian, not Mica OS.

**C. A separate OCI artifact beside the pools** (considered, rejected). It
needs a lock row anyway, so it buys nothing the chain does not already give;
it puts a text file where nobody looks for it; and it splits the trust path
for a release-scoped datum between the registry and the release assets, so a
consumer verifying one release would follow two chains instead of one.

## Verification

- The vectors under `docs/design/release-lock/vectors/` gain cases for the
  `data` row: a valid lock with two `data` rows, and one vector per refusal
  (`column-count`, `field-value`, `duplicate-key`, `data-file`,
  `asset-unlisted`, `sort-order`), with `expected.tsv` extended; `make
  docs-verify` proves the checker against them, as it does the 156 today.
- `mica-system-base` publishes its two files in the release after the one
  where this lands, and a consumer reads them from the pinned release without
  a token.
- No other repository's lock changes; every existing vector still passes
  unchanged, which is the check that this is a widening and not a new format.

## Risks

- **Scope creep by precedent.** Once any repository may attach a file,
  "published because it was easy to publish" becomes available. The "not a
  build input, not a device artifact" clause is what holds it, and it is worth
  stating in the spec rather than in this plan alone.
- **Every reader learns a kind at once.** `kind-unknown` makes the change
  atomic across repositories; a lock written with `data` rows is refused by
  any reader that has not moved. The migration order of 2026-09-14 is the
  precedent for doing that deliberately.

## Scope

In: `docs/design/release-lock.md` 1, 1.4, 1.5 and the vectors. Out: any
repository's implementation, which follows its owner's dispatch; the unowned
list's content, which is `mica-system-base`'s; and the composer rule that
caused the defect, which is `mica-build`'s.

## Alternatives

A, B and C above. The one not proposed: leaving it a CI artifact. It fails the
requirement that raised the question — a consumer must read the data at the
release it already pins, and an artifact is neither content-addressed nor
durable.
