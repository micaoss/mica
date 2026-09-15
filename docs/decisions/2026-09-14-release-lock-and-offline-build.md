# One release lock format and an offline build

- **date**: 2026-09-14
- **kind**: engineering decision
- **owner**: every producing and consuming repository; the format is specified in `docs/design/release-lock.md`
- **review sunset**: 2027-03-14
- **status**: accepted (user, 2026-09-14; image rows amended 2026-09-15); not implemented; migration plan `20260914-2042-release-lock-offline-build`

## Decision

Every Mica OS release is described by one lock file in one format, every
consumer records its inputs the same way, and every artifact can be built
from the side-by-side checkouts without reading a published release.

**Producer side.** A release of `<repository>` carries exactly two GitHub
Release assets: `<repository>.lock`, in the `mica-lock v1` format, and
`SHA256SUMS`, which lists that one file. There are no `.deb` release assets:
packages live only in the repository's OCI pools on `ghcr.io/micaoss` (user,
2026-09-14). `mica-system-base` publishes a single `mica-system-base.lock`
that also carries the upstream packages and the apt source.

**Consumer side** (user, 2026-09-14, with the user's later correction). A
consumer keeps its inputs under `locks/` at its root: `locks/<repository>.lock`,
each producer's lock asset committed unchanged, and `locks/pins/`, a
directory with one record per producing repository,
`locks/pins/<repository>.pin` (`mica-pin v1`: the repository, the release and
the sha256 of that release's `SHA256SUMS`). Moving one input replaces its lock
and its pin together and touches no other file, so no input's record can
corrupt another's. The pins replace every per-repository release record. An
offline pin (`RELEASE=offline` with `CHECKOUT=<absolute checkout>`) names a
sibling checkout's offline output and is refused under CI and in every
release build. The `.pin` suffix is `mica-build`'s reading of the user's
words.

**Third-party inputs** (user, 2026-09-14). Every repository pins its
third-party inputs (upstream images, downloaded archives, git trees) in one
consumer file, `locks/upstream.lock`, in the same file format with only
`image`, `source` and `git` rows and no release row or pin. It replaces each
repository's own pin files; build parameters that are not pins stay in its
configuration. Each repository moves its pins in its own migration stage;
`mica-build-env` does it in stage 1.

**Offline build** (user, 2026-09-14). Every repository has a git-ignored
source cache `repos/` at its root, managed by one tool with the same name and
behaviour everywhere, `tools/repos.sh` (`get`, `git`, `check`;
`MICA_OFFLINE=1` turns any cache miss into a refusal). `make offline` writes a
repository's release outputs under `_out/offline/` in the same lock format,
with references into a local OCI layout, and `tools/local-lock.sh` records a
sibling's offline output in `locks/`.

The workspace driver that chains the offline builds is
`mica-build:tools/offline-chain.sh` (user, 2026-09-14, as proposed).

**Scoped releases** (user, 2026-09-15). `mica-boards` releases per board and
`mica-build` per board or product, tagged `<scope>/<YYYYMMDD-HHMM>`; their
release row carries that tag, and a consumer keeps each scope as
`locks/<repository>.<scope>.lock` with `locks/pins/<repository>.<scope>.pin`
(`SCOPE=<scope>`). No other repository has scoped releases
(`docs/decisions/2026-09-15-mica-boards-per-board-releases.md`,
`docs/decisions/2026-09-15-mica-build-scoped-releases.md`).

**Image rows** (user, 2026-09-15, replacing the ghcr mirrors of
2026-09-14). An `image` row is `image <source> <name> <platform> <reference>`:
the producing repository's name for an image it builds and publishes on
`ghcr.io/micaoss/<repository>` (its reference must be there, and in a
producer's own release lock the source is the release row's repository),
`upstream` for a third-party image (the user's refinement of the same day
replaced a fixed `mica` source with the repository name). The name and the
reference are the original ones, used unchanged: an `upstream` row names the
image as upstream spells it (`debian:trixie-slim`,
`docker/dockerfile:1-labs`) and its original reference with digest
(`docker.io/library/debian:trixie-slim@sha256:...`). `ghcr.io/micaoss` does
not republish upstream images, and an `upstream` reference there is refused.
Every `upstream` row names the index digest, and the platform column states
which platforms the release guarantees (user, 2026-09-14, option a).
`mica-build-env.lock` lists the approved third-party images as its
`upstream` rows, taken from its `locks/upstream.lock`; every other repository
takes a third-party image only from those rows and references it by its
original name and digest.

## What this supersedes

Removed without compatibility once the migration reaches each repository:

- `build-env-image.lock` and `build-env-release` (the build-env consumer rule);
- the Base consumer rule with three files: `system-base.lock`,
  `system-base-packages.lock`, `system-base.sources` and `system-base-release`
  (`docs/decisions/2026-09-14-base-pins-upstream-packages.md` keeps the policy
  that Base pins the shared upstream packages; only the file form changes);
- `mica-core`'s `core-pkgs.lock` and its `.deb` release assets;
- `mica-podman`'s `podman-pkgs.lock` and its `.deb` release assets;
- `mica-boards`' `SHA256SUMS` over layer titles and digests;
- `mica-build`'s `deps/packages/` and `deps/releases/`, and the build-env
  block of `environment.json`;
- every third-party image a repository pins on its own (`base-images.env`,
  `images.env`, `environment.json`, `# syntax=` lines and the CI setup
  actions): it takes the image from the `upstream` rows of
  `locks/mica-build-env.lock` instead, by the original name and digest;
- the ghcr mirrors of third-party images decided on 2026-09-14 ("用ghcr"):
  the `upstream.<path>.<tag>` image names, the
  `ghcr.io/micaoss/mica-build-env:upstream.<path>.<tag>.<digest12>` tags and
  the mirror job (user, 2026-09-15).

`mica-build-env` `20260914-2353` used the superseded image row shape
(`image <name> <platform> <reference>`) and the ghcr mirrors; it is deleted,
and `20260915-0030` was the first release in the row shape above; it is
deleted too, and `20260915-0138` is the release to pin.

There is no transition period (user, 2026-09-14): a repository's first
release in the new format carries only `<repository>.lock` and `SHA256SUMS`,
and each repository switches its readers and its writer in its own stage of
`docs/plan/20260914-2042-release-lock-offline-build.md`.

## Rationale

Five producers had five release shapes, and every consumer carried its own
reader and its own release record for each. One typed, digest-only,
reproducibly sorted lock gives one reader for all of them, one place per
repository that names its inputs, and a single check that a composition binds
exactly the released bytes. The same format, pointed at a local OCI layout,
makes a full offline chain possible without a second format.

## Removal condition

Revisited when a release needs an artifact kind the lock cannot express, or
when the registry or forge changes.
