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

So the hold does not end on the snapshots alone, and the corrected condition
must name both artefacts with their own instruments. It is **not written here
yet**: the division is being confirmed by the repository that measured it
rather than restated from an account of it, and this paragraph exists so that
nothing ends the hold in the meantime.
