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
separate decision and will be recorded as one.
