# Development-phase release deletion

- **date**: 2026-09-20
- **kind**: user decision, with a narrowing proposed by coordination and flagged to the user
- **owner**: every agent that cuts or deletes a release
- **review sunset**: the development phase — revisit when a consumer outside this workspace exists
- **status**: accepted (user, 2026-09-20)

## The decision, in the user's words

*"可以删除，现在还是开发阶段"* — deletion is allowed; this is still the
development phase. It supersedes, for the two cases below, the workspace rule
that deleting or re-cutting a published release happens only on explicit
instruction.

## Allowed without asking, on a `micaoss` GitHub release

- **a.** a release whose assets are absent or incomplete because its workflow
  failed;
- **b.** a release **superseded** by a later release of the same scope.

## Not allowed without asking

These two are **coordination's narrowing of a broad yes**, flagged to the user
rather than granted by them, and each has a reason that is not a preference:

- **c.** a release that a **published index references**. Deleting it leaves
  the index naming bytes that do not exist, and `--full` verification of every
  index that references it fails forever
  ([mica-index](../design/mica-index.md)). This is the case where two rules
  disagree — *tidy up a superseded release* and *a release an index references
  is not deleted, even when it is defective* — and **the index rule wins**.
- **d.** **`ghcr` package versions.** A different blast radius: `ghcr` holds
  the **only** copy of every pool and every board component
  ([release-lock](../design/release-lock.md) 2.1), so deletion there is
  unrecoverable, and a consumer pinning that digest breaks at once, as
  `20260915-0030` and `20260914-1129` did. The mirror's own guard refuses it
  mechanically, on the strength of the user's scope decision of 2026-09-16
  rather than on coordination's judgement.

## Why (c) is not arbitrary: deletion cannot withdraw a recommendation

**There is no way to withdraw a recommendation except by superseding it.** The
GitHub `latest` marker recommends an index to anything that resolves a release
without naming one, and it moves only when a newer index exists
([mica-index](../design/mica-index.md)). So deleting a defective release
neither un-recommends it nor corrects what it said: a successor does both, and
the deletion would only remove the evidence. **Deletion is about tidiness and
never about correcting what a release recommends** — which is what makes
"delete the defective one" the wrong move in every case, and leaves (a) and
(b) as the whole of the allowance.

## What an agent does with this

Cases (a) and (b): delete without asking. Anything else, including any `ghcr`
package version and any release an index names: ask. When in doubt about
whether an index names it, the index is enumerable — check rather than
assume.
