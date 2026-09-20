# 20260920-0851-negative-vector-audit Audit the negative vectors for double faults

- **status**: open — the definition exists, the harness does not
- **priority**: P2
- **owner**: `mica` (the vectors are here, so the audit is one pass rather than
  five)
- **createdAt**: 2026-09-20 08:51

## The property

**A refused vector that could be refused by two rules tests neither**
(`mica-core`, 2026-09-20). A negative fixture must break **exactly** the rule
it names, or it passes for the wrong reason and keeps passing after the rule
it was written for is broken.

## The check, which is a definition rather than an inspection

`mica-build`'s form: **for each refused vector, repair the named defect and
require the result to become valid. Anything that stays refused was testing
two rules at once.** It needs a fixture-mutation harness, which exists
nowhere — and *no harness exists yet* is a piece of work while *no gate can
check this* is a permanent limit. It is recorded as the first.

## Why it is one pass here rather than five elsewhere

`mica-build`'s copy is byte-identical to the canonical set after one rename,
so whatever the check finds is a finding **about the vectors**, not about a
copy. Forty-odd refused vectors, one pass, at the source.

## What the one known instance does and does not prove

`upstream/refused/other-kind.lock` in `mica-core`'s tree carried
`pool.amd64.x` where canonical carries a valid release, so a vector meant to
prove *refused for carrying a `pool` row* could have been refused for the
release value instead. It was found **by accident**, comparing blobs rather
than hunting double faults, so it bounds nothing: nobody knows whether it is a
one-off or a pattern in a set written over months by people thinking about the
positive case. It is also **local rather than inherited** — the same file is
byte-identical to canonical in the workspace's oldest copy.

## Done already, because it was the cheap half

The subtraction — **rules the reader can produce minus rules the fixtures
name** — needs no harness, and it ran on 2026-09-20 the moment `mica-core`
proposed it: the reference checker can produce **40** refusal rules, the
vectors named **39**, and the untested one was **`fetch-required`** (a cache
miss outside offline mode). `repos/fetch-miss` now names it and the sets agree
both ways. What remains is the mutation harness for the ambiguity half.

## What the remaining half needs, measured rather than guessed

The obvious derivation does not work, and it is worth writing down so nobody
spends an afternoon rediscovering it. *Repair the named defect* cannot be
derived from a diff against a valid vector, **because the repair is the
diff**: revert it and you have the valid file back, which proves nothing. Of
the 48 refused lock vectors, 16 differ from a valid one by a single changed
line and 28 by two (a replaced row), so for most of the set the whole edit
*is* the defect.

**And the nearest valid vector is the wrong key.** Picking a sibling by
smallest line-diff matched `image-platform.lock` — a `mica-build-env` shape —
against `offline-mica-core.lock`, and made `column-count.lock` look like a
five-line edit when it is one row short of a column. Both were the heuristic,
not drift; the check needs the **declared** sibling, not the nearest one. That
is tonight's rule again, caught before it was reported: a comparison whose key
is wrong returns a tidy answer about nothing.

So the harness needs a fixture-format change rather than a script:

1. ~~each refused vector **declares the valid vector it was derived from**~~ —
   **done 2026-09-20** as `vectors/derived-from.tsv` (9.3) rather than a fifth
   column in `expected.tsv`, which five repositories parse and would have had
   to tolerate. The gate asserts the pairing, the sibling's existence and the
   `edit-of` line bound;
2. and for the two-rule property proper, either each vector **declares its
   repair**, or the reference checker gains a mode that reports **every** rule
   a file breaks rather than the first. The second is the honest one and the
   larger: the checker short-circuits by design, because later checks assume
   earlier ones passed, and a half-converted version would report rule pairs
   that are artefacts of its own ordering — the false-alarm shape.

**And a third technique reaches part of the question with no harness at all**:
argue about **what cannot differ**. Where a refused vector's row multiset
equals its sibling's, order is the only rule it can break, so it is provably
single-rule — true of `lock/refused/unsorted.lock` and
`lock/refused/release-not-first.lock`, and made true of
`upstream/refused/unsorted.lock` by restoring a comment line it was missing.
The same shape covers any rule whose inputs are a property of the row set.

**The signal the harness would automate is not *repair → valid*, it is *a
second rule surviving the repair*.** `mica-core`'s `other-kind.lock` is the
proof and it needs no re-parse: two repositories hold the same fixture, one
with `pool.amd64.x`, and **that one would still have been refused after the
same repair**. Same fixture, two trees, one of them testing nothing.

**Decided 2026-09-20**: the second option, in the shape `mica-system-base`
proposed — an optional **collect mode** in this repository's reader plus a
second column in `expected.tsv`, with the short-circuit as the default because
the table names one rule per vector and that is its contract. The
implementation constraint is specified with it: the mode reports **either a
structural refusal alone or the set of semantic refusals**, never a mixture,
because suppressing a structural rule runs the semantic checks over malformed
rows and manufactures the very pairs the mode exists to find.

Neither is an afternoon, and neither is blocked. What is done is the cheap
half, which found a real gap.

## Dependencies

- **blocked by**: nothing; the harness is the work
- **blocks**: nothing — the vectors are usable today and the property is a
  quality of the set rather than a defect in it
