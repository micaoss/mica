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

## Dependencies

- **blocked by**: nothing; the harness is the work
- **blocks**: nothing — the vectors are usable today and the property is a
  quality of the set rather than a defect in it
