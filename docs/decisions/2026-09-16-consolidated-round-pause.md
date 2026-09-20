# The consolidated-round pause, and when it ended

- **date**: 2026-09-16 (paused); 2026-09-19 (lifted)
- **kind**: coordination decision, recorded 2026-09-20 because it governed seven repositories and lived in no tree
- **owner**: the user (both ends); coordination through BKD `uj991oa2`
- **review sunset**: 2026-12-20 — by then either the surviving clause below has ended or it has a record of its own
- **status**: ended

## What it was

On 2026-09-16 the user paused everything except the cache and mirror design of
`mica-res`, so that the rest would land in one consolidated round rather than
in a stream of partial ones. Every repository stopped starting work and cut no
release; `mica-core` specifically stopped at `5d87a66` with its build-env pin
unmoved. Two further holds were placed at the same time: no Actions run is
deleted and no `ghcr` package version is pruned anywhere.

## When and how it ended

The user lifted it on 2026-09-19, with an order of resumption rather than a
general release, and work resumed that evening: the re-pin round, the board
rename, the boot gate and the `s905x5m` opening all belong to the period after
it.

## Why this record exists

It ended the way a constraint should not: **work resumed and nobody said the
word.** Nothing marked the transition, so the only way to know whether the
pause was still in force was to ask the person holding it. That is the same
decay as the 2026-09-14 format freeze, caught one step earlier — a rule that
stops being enforced without anyone recording that it stopped. The test this
record exists to satisfy is the one now used for every such rule: *could
someone check this without asking the holder?*

## What survives it

**The retention hold does.** Nothing is pruned in any `ghcr` package and no
workflow run is deleted in any repository until the collector's snapshots are
in the bucket and a retention policy is agreed. It was placed with the pause
but does not end with it, and it is the clause most likely to be assumed
spent by someone who hears only that the pause is over. Its own end is a
separate decision and will be recorded here, in this file, rather than in a
new one.

**The end condition as written above measures one instrument and the hold
covers two artefacts** *(`mica-res`, 2026-09-20)*. The collector snapshots
Actions runs and jobs; **it does not snapshot `ghcr` package versions**, so
its output protects workflow-run history and nothing of image history
([release-lock](../design/release-lock.md) 2.1, where what does protect an
image version — the mirror holding its bytes under a content-addressed key
with the index naming it — is already stated). A retention discussion that
reads *the snapshots are in the bucket* as cover for pruning `ghcr` packages
would be ending the hold on **half an argument**, with the wrong instrument
for the half it did not measure.

So the hold does not end on the snapshots alone. The corrected condition is
**still not written here**, and the measurement that arrived on 2026-09-20
gives a second reason beyond the first: it is not two artefacts with two
instruments either. It is seven kinds, **two of them covered by nothing** —
workflow logs and artifacts, and the OCI pools that carry every Debian package
this workspace publishes ([release-lock](../design/release-lock.md) 2.1, with
the trap that makes the wrong version of this easy to write). A condition
restated as *the mirror holds the packages* would repeat tonight's error one
level down, because it would be satisfied by an instrument covering one `ghcr`
package out of many. **The condition that is true of the world is per
artefact.**

The fork is the user's, and it is a **scope** question rather than a
repository's to take: the accepted scope of 2026-09-16 put the pools, the
board components and the locks *out of scope and not to be re-added*
([release-lock](../design/release-lock.md) 2.1). So either the policy says the
pools are never pruned while nothing mirrors them, or that scope is changed
and the condition waits on the mirroring.

**Mirroring the locks was approved by the user on 2026-09-20** ("按你推荐处理,
可以加"), which reverses the 2026-09-16 scope **for locks only** — the pools,
the board components and the device update service stay out. It does not
unblock the hold's condition: locks become mirrored and **pools do not**, so
the per-artefact condition still cannot collapse into one row
([release-lock](../design/release-lock.md) 2.1).

**The price, and it was a scope reversal rather than a recommendation anyone
could act on**: under 5 MB against the 1.8 GB already
held, and 150 to 250 lines with tests inside the existing `sync.yml` — no new
workflow, no new credential, since the enumerator already downloads every
producer lock it reads, and the `mica-pin v1` digest makes publishing a
**verification** rather than a copy. **Its limit travels attached to it or not
at all:** the chain from the mirror would end at the lock, whose `package`
rows point into pools nothing mirrors. It makes the **binding** survivable,
not the packages — and a reader who skips that sentence draws exactly the
wrong conclusion.

**The early-warning number is in, and the bound first asked for was the wrong
one.** It is not GitHub's run retention: the collector reads one page of 100
runs per repository with no pagination, and backfill reads its own artifacts
rather than the API, so **a run that falls past position 100 before any pass
sees it is unreachable by both paths**. The margin, printed by `history`:
`mica` 48.3 h, `mica-res` 58.3 h, the other six about 102 h, where page one
still reaches their whole history. Against a collector that fires every two to
five hours ([mica-index](../design/mica-index.md)) that is a tenfold cushion,
and a negative margin prints `UNREACHABLE`. The property is worth stating on
its own: **a number that goes negative before anything is lost is worth more
than an alarm that fires after.**

This paragraph exists so that nothing ends the hold in the meantime.
