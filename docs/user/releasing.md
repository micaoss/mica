# Releasing Mica OS

For maintainers. A release is the only way an artifact leaves a repository:
every consumer pins releases, never a branch. This page says how a release is
cut, what it carries, and what decides whether a package is rebuilt.

## 1. Cutting a release

A release is cut on GitHub, never with a local tag:

```sh
gh release create <tag> --target <commit of main>
```

`release.yml` runs on `release: published`, builds from that tag and attaches
the assets. `ci.yml` publishes nothing.

| Repository | Tag |
|---|---|
| `mica-build-env`, `mica-system-base`, `mica-core`, `mica-podman` | `<YYYYMMDD-HHMM>` |
| `mica-boards` | `<board>.<YYYYMMDD-HHMM>`, one board per release |
| `mica-build` | `<scope>.<YYYYMMDD-HHMM>`, a board or one product, cut with `--latest=false` |
| `mica-build` version index | `mica.<YYYYMMDD-HHMM>`, cut by the index job, never by hand |

The stamp is the UTC time of the release, with no `v` prefix, no semver and
no commit suffix. A scoped tag separates its scope with a **dot** since
2026-09-16; the releases cut before that date carry the older
`<scope>/<stamp>` form and are not rewritten. Deleting or re-cutting a
published release happens only on the user's explicit instruction.

> status: shipped — evidence: `docs/design/release-lock.md`, `docs/decisions/2026-09-15-mica-boards-per-board-releases.md`, `docs/decisions/2026-09-15-mica-build-scoped-releases.md`, `docs/decisions/2026-09-15-oci-tags-follow-release-version.md`

## 2. What a release carries

| Release | Assets | OCI |
|---|---|---|
| producer (`mica-build-env`, `mica-system-base`, `mica-core`, `mica-podman`, `mica-boards`) | `<repository>.lock` and `SHA256SUMS` listing only it | the images, pools, board components and the base root, tagged `<kind>[.<name>]*.<release>` |
| `mica-build` scoped | `mica-build.lock`, one `mica-<product>-<stamp>.<suffix>.gz` per image kind, the update archives, and `SHA256SUMS` over all of them | `image.<product>.<release>` and `update.<product>.<release>` |
| `mica-build` index | `mica-build.lock`, `mica-index.json` and `SHA256SUMS` listing both | none |

The lock names every artifact by digest, so a consumer that verifies
`SHA256SUMS` and the lock has bound the exact bytes
([release lock](../design/release-lock.md), [index](../design/mica-index.md)).

> status: shipped — evidence: `docs/design/release-lock.md`, `docs/design/mica-index.md`

## 3. What is rebuilt, and what is reused

Packages are locked by their own declared version
([decision](../decisions/2026-09-15-package-versions.md)):

- every package declares its version and its `SOURCE_DATE_EPOCH` beside the
  package or producer; no commit, date or release reaches a version, a
  control field or a binary;
- a release never changes a version: only a version bump rebuilds and
  republishes a package;
- a package whose name, architecture and version match the previous release
  of the same scope is reused from it by digest, and must still rebuild
  byte-identically;
- the pool layer annotation `mica.inputs` is the guard: inputs that changed
  without a bump are refused, in CI and at release, and a lower version than
  the previous release is refused;
- when no package changed, the pool manifest is byte-identical and the new
  release tag points at the same digest.

`mica-boards` reuses a `kernel` or `uboot` component whose inputs equal the
board's latest release, in CI and at release, and `mica-build` publishes a
`root` or `kernel` update archive only when the other component's identity is
unchanged ([update packages](update-packages.md)).

> status: shipped — evidence: `docs/decisions/2026-09-15-package-versions.md`, `docs/decisions/2026-09-15-board-kernel-builds.md`, `docs/decisions/2026-09-15-update-packages.md`

## 4. The version index

After every fully successful `mica-build` scoped release, the index job cuts
`mica.<YYYYMMDD-HHMM>`: it takes the newest scoped release of every published
product, checks the entering entries against their sources, and publishes the
index lock and `mica-index.json`. It is incremental over the previous index,
is skipped when nothing enters or drops, and is the GitHub latest release.
A manual `mica.*` release is refused.

> status: shipped — evidence: `docs/decisions/2026-09-15-mica-version-index.md`, `docs/design/mica-index.md`

## 5. Before cutting

- CI is green on the commit being released, and the repository's own gates
  pass locally where the release depends on them.
- The inputs are the releases the repository intends to ship on: its
  `locks/` files name them, and moving one input replaces exactly that lock
  and its pin.
- A release carries no attribution lines and no development leftovers in its
  records; the record of the release lands in `mica` for `mica-build` and
  `mica-build-env`, and in the repository's own `docs/` for the others.

> status: shipped — evidence: `docs/design/release-lock.md`, `docs/changelog.md`
