# Release locks, pins and the offline build

**This document has moved.** The release lock, the consumer's `locks/`, the
source cache and the offline build are specified in
[`mica-build-tools`](https://github.com/micaoss/mica-build-tools), beside
the one implementation of them *(user, 2026-09-29: "把tools和mica解耦合，
后续所有的规范这边维护，mica只是让子仓库用tools即可")*:

| What | Where |
|---|---|
| the specification, with the section numbers this file had | `mica-build-tools:docs/spec/release-lock.md` |
| the test vectors | `mica-build-tools:docs/spec/release-lock/vectors/` |
| the rules of package versions | `mica-build-tools:docs/spec/package-versions.md` |
| every command that reads, checks or writes a lock | `mica-build-tools:docs/manual.md` |

This repository states no rule of the lock. What it asks of every repository
is one thing: pin `mica-build-tools` by commit in `locks/mica-build-tools.pin`,
run it as `bin/mica-tools`, and carry no reader, no vectors and no copy of the
rules of its own. `bin/mica-tools locks update` moves that pin, and every
other pinned input, to the latest release.

A rule changes in `mica-build-tools`: the text, the vectors that assert it and
the code are one commit there, and each repository then moves its pin. A
document here that cites a section of this file -- `release-lock.md` 1.2.5,
for example -- cites that section of the specification, whose numbers did not
change with the move.

The text this file held, and its history, are in this repository before the
commit that made it a pointer; the vectors and the reference checker
`tools/docs/release-lock-check.py`, which proved them until then, were removed
by the same commit. The build rules of `mica-build-env:RULES.md` stay with
`mica-build-env`.
