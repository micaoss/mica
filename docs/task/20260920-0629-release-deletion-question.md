# 20260920-0629-release-deletion-question Open question: may an agent delete an empty or superseded release without asking

- **status**: answered 2026-09-20 — the decision is
  `docs/decisions/2026-09-20-development-phase-release-deletion.md`; this file
  is kept for the question's shape, and **still authorises nothing**
- **priority**: P1
- **owner**: `mica` (the record); the answer is the user's
- **createdAt**: 2026-09-20 06:29

## Answered

The user allowed it on 2026-09-20 — *"可以删除，现在还是开发阶段"* — for two
cases: a release whose assets failed to publish, and a release superseded by a
later one of the same scope. Two exclusions were **proposed as a narrowing of
a broad yes** and flagged as such: a release a published index references, and
any `ghcr` package version. The scope, the authority and the reasons are in
`docs/decisions/2026-09-20-development-phase-release-deletion.md`.

**The five scope questions below are why the answer is usable.** A yes that
did not distinguish them would have covered `ghcr` package versions, where the
bytes have no second copy, in the same breath as an empty failed release.

## The rule that held until it was answered

The workspace instructions say: *deleting or re-cutting a published release
happens only on the user's explicit instruction*, and a release is cut only
with `gh release create`. **That is the rule an agent follows now.** This file
records a question, not a permission, and an agent reading it has been granted
nothing.

## The question

A development-phase practice has been in use in coordination: that an agent
may delete an **empty failed release** or a **superseded** one without asking
each time. It is recorded here because it exists — it was enforced without
being written — and because an unrecorded practice that contradicts a written
rule is the dangerous shape: an agent who reads the tree gets one answer, an
agent who asks gets another, and the difference is a deleted release.

## What the answer has to say, not just yes or no

These are the scope questions the answer needs to settle, because each is a
different blast radius:

- what **empty** means: no assets, or assets that were never referenced?
- what **superseded** means, and by what — a later release of the same scope,
  or a later index that no longer references it?
- whether it covers the **index releases**, which are the entry point a
  consumer reads and whose deletion breaks `--full` verification of everything
  that references them (`docs/design/mica-index.md`);
- whether it covers **`ghcr` package versions**, which is a different blast
  radius again: a deleted image breaks every pinned consumer at once, as
  `20260915-0030` and `20260914-1129` did;
- how it interacts with the rule that a release an index references is not
  deleted even when defective, whose only exception is withdrawal for safety
  (`docs/design/release-lock.md` 2.1, `docs/design/mica-index.md`).

## Either answer produces a record

If the user confirms it, the record is a decision with the granted scope, the
authority line naming them and the date, and a sunset. If they do not, the
record is the opposite one and is worth writing just as much: **the
authorisation was assumed and is withdrawn.** An assumption retired in the
open is worth more than one that quietly stops being acted on.

## Dependencies

- **blocked by**: the user
- **blocks**: nothing; the recorded rule covers the meantime
