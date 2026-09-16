# Scoped release tags separate the scope with a dot

- **date**: 2026-09-16
- **kind**: engineering decision
- **owner**: `mica-boards` and `mica-build`; the form is `docs/design/release-lock.md` 1.0
- **review sunset**: 2027-03-16
- **status**: accepted (user, 2026-09-16); specified here and in `docs/design/release-lock.md` 1.0, 1.2, 1.2.2, 1.2.3 and 1.5, with the reference checker and the vectors; `mica-boards` and `mica-build` implement against that spec

## Decision

A scoped release tag is `<scope>.<YYYYMMDD-HHMM>`, not `<scope>/<YYYYMMDD-HHMM>`:

- `mica-boards` per board: `x64.20260915-1926`;
- `mica-build` per scope: `x64.20260915-2230`, `x64-dev.20260915-2230`;
- the Mica version index: `mica.20260915-2242`;
- an offline lock of a scoped repository: `<scope>.offline`.

There is no compatibility form. A release row carrying a slash is refused as
`field-value` (`docs/design/release-lock/vectors/lock/refused/release-slash.lock`),
and nothing reads the old form after the change.

Unaffected: consumer pins, where `RELEASE` and `SCOPE` are separate fields and
keep their values; OCI tags, which already separate with dots; and the
`mica/index/v1` input id `<built name>/<release>`, which names an input rather
than a git tag and keeps its slash (`docs/design/mica-index.md` 3.1).

## Rationale

- Git accepts the dot form: `git check-ref-format` passes `x64.`, `virt-arm64.`,
  `x64-dev.` and `mica.` prefixed tag names.
- A board or product name is `^[a-z0-9][a-z0-9-]*$` in both repositories, so it
  never contains a dot: "everything before the first dot is the scope" is
  unambiguous, and the release stamp carries no dot either.
- It matches the OCI tag style already in use (`pool.x64.amd64.<release>`,
  `image.x64-dev.<release>`), so one repository does not spell the same pair
  two ways.
- It removes a git limitation: refs are directories, so a tag named exactly
  `x64` could never exist beside `x64/20260915-1926`. With dots both can.

## What this supersedes

The slash form of `docs/decisions/2026-09-15-mica-boards-per-board-releases.md`
and `docs/decisions/2026-09-15-mica-build-scoped-releases.md`, and the index tag
of `docs/decisions/2026-09-15-mica-version-index.md`. Releases published before
this change carry the old form in their own tags; they are history and are not
rewritten.

## Removal condition

Revisited if a scope name ever needs a dot, or if scoped releases stop being
used.
