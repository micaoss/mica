# `mica-podman` pins its own build snapshot, not the Base apt row's

- **date**: 2026-09-16
- **kind**: deliberate deviation from a coordinator decision, recorded here because the workspace rule is that a deviation carries a record and a sunset date
- **owner**: `mica-podman` (the deviation); `mica` (this record)
- **review sunset**: 2027-03-16
- **status**: accepted (coordinator, 2026-09-16); recorded here 2026-09-20

## Decision

`mica-podman:pins/snapshot` is **deliberately not** the snapshot of the `apt`
row in `locks/mica-system-base.lock`. The two files differ on purpose and a
reader who finds them unequal has found the intent, not a drift.

## Why

The `mica-build-env` images the engine stages build in carry packages newer
than the Base snapshot, so `apt` refuses to resolve against them without
downgrades. Pinning the engine's build closure to the Base snapshot would
therefore not produce a build at all.

## Where the intent is kept instead

In the runtime contract rather than in the build closure: `mica-podman`
declares its Debian dependencies with version floors in
`deb/mica-podman.control`, and `make base-check` verifies every declared floor
against the versions `mica-system-base` pins for our roots, on both
architectures. That is the property the rule was protecting — a package that
cannot be satisfied on the root it ships into — and it is checked on every
run, which the snapshot equality never was. `dpkg-shlibdeps` is gone for the
same reason: a floor read from whatever archive the base image pointed at that
day was an unpinned input hiding inside a declared version.

## The measurement at the time

Not assumed: when the deviation landed, all seven engine binaries on amd64
were **byte-identical** to the ones built before, from the live archive on the
previous build-env images, and the package gate's no-cache rebuild was
identical too. Pinning the closure and moving to `mica-build-env`
`20260916-0735` removed a risk rather than changing an output. The evidence is
the `mica-podman` `20260916-0846` release notes, which state the closure (40
`source` rows per architecture, resolved against each stage image's own dpkg
status), `pins/resolved-for` and the refusal in `tools/dev-pins.sh check`.

## What would end it

A build-env image whose packages are not newer than the Base snapshot, or a
Base snapshot moved forward past them: then the two files could agree and this
record's reason disappears. Until then, `make base-check` is the check that
must stay green, and the sunset above is when someone should ask whether the
condition still holds.

## Why this record exists at all

The deviation was accepted on 2026-09-16 and explained in that release's
notes, which is a note about one release. The workspace rule asks for a
decision record with a sunset date, because a later reader looking for *why
these two files disagree* reads `docs/decisions/`, not a release body.
