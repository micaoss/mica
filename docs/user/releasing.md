# Releasing Mica OS

For maintainers. A release is the only way an artifact leaves a repository:
every consumer pins releases, never a branch. This page says how a release is
cut, what it carries, and what decides whether a package is rebuilt.

## 1. Cutting a release

A release is cut on GitHub, never with a local tag. A producer's release is
created at a commit of `main`, and its `release.yml` runs on
`release: published`, builds from that tag and attaches the assets:

```sh
gh release create <YYYYMMDD-HHMM> --target <commit of main>
```

A `mica-build` release is one product, started as a workflow run that stamps
the tag itself:

```sh
gh workflow run release.yml -R micaoss/mica-build -f product=<board>.<variant>
gh workflow run release.yml -R micaoss/mica-build -f product=<board>.<variant> -f core=true
```

The second is a **core release**: the product with the kernel and root of its
previous release and this commit's core components, published with a `full`
and a `core` update package, so a device takes the new management plane
alone. When the previous root's interface level is outside a component's
range, the product is built whole instead.

After the GitHub release is attached, the same run posts the release to the
resource service (`mica-build:README.md`): its files under
`mica/<board>.<variant>/<stamp>/` on `dl.res.micaos.dev`, and its record, after
which `https://res.micaos.dev/update/` offers it to the website and to
devices. `publish-res.yml` posts a release that is already published.

`ci.yml` publishes nothing anywhere.

| Repository | Tag |
|---|---|
| `mica-build-tools`, `mica-build-env`, `mica-system-base`, `mica-core`, `mica-podman` | `<YYYYMMDD-HHMM>` |
| `mica-build` | `<board>.<variant>.<YYYYMMDD-HHMM>`, one product; the product's board is built and published in the same release, and a `dev` product is never released |

Some releases cut themselves: `mica-system-base` and `mica-build-env` move
their inputs on the first of each month and release when the build is green,
and `mica-podman` does the same weekly for the upstream engine.

The tag forms follow the board and product names, which
[the naming rules](../decisions/2026-09-16-board-and-product-naming.md) fix
along with the OCI tags and the asset names. The stamp is the UTC time of the
release, with no `v` prefix, no semver and no commit suffix. A product tag
is parsed at its last dot. Deleting or re-cutting a published release happens
only on the user's explicit instruction.

> status: shipped — evidence: `docs/design/release-lock.md`, `mica-build:boards/README.md`, `mica-build:README.md`, `mica-build-tools:docs/spec/release-lock.md`

## 2. What a release carries

| Release | Assets | OCI |
|---|---|---|
| producer (`mica-build-env`, `mica-system-base`, `mica-core`, `mica-podman`) | `<repository>.lock` and `SHA256SUMS` listing only it | the images, pools and the base root, tagged `<kind>[.<name>]*.<release>` |
| `mica-build` product | `mica-build.lock`, one `mica-<board>.<variant>-<stamp>.<suffix>.gz` per image kind, the update archives, and `SHA256SUMS` listing only the lock | the board's `pool.<board>.<arch>.<stamp>` and `<component>.<board>.<stamp>`, `image.<board>.<variant>.<stamp>` and `update.<board>.<variant>.<stamp>` |
| `mica-build-tools` | none: a consumer pins its commit (`locks/mica-build-tools.pin`) | none |

The lock names every artifact by digest, so a consumer that verifies
`SHA256SUMS` and the lock has bound the exact bytes
([release lock](../design/release-lock.md)).

> status: shipped — evidence: `docs/design/release-lock.md`, `mica-build:README.md`

## 3. What is rebuilt, and what is reused

Packages are locked by their own declared version
([decision](https://github.com/micaoss/mica-build-tools/blob/main/docs/spec/package-versions.md)):

- every package declares its version and its `SOURCE_DATE_EPOCH` beside the
  package or producer; no commit, date or release reaches a version, a
  control field or a binary;
- a release never changes a version: only a version bump rebuilds and
  republishes a package;
- a package whose name, architecture and version match the previous release
  is reused from it by digest, and must still rebuild byte-identically;
- the pool layer annotation `mica.inputs` is the guard: inputs that changed
  without a bump are refused, in CI and at release, and a lower version than
  the previous release is refused;
- when no package changed, the pool manifest is byte-identical and the new
  release tag points at the same digest.

`mica-build` reuses a `kernel` or `uboot` component whose inputs equal the
latest release that published it, in CI and at release, and publishes a
`root` or `kernel` update archive only when the other component's identity is
unchanged ([update packages](update-packages.md)).

> status: shipped — evidence: `mica-build-tools:docs/spec/package-versions.md`, `mica-build:docs/design/image.md`, `docs/decisions/2026-09-15-update-packages.md`

## 4. Every pin at its latest

Every input a repository pins in `locks/` is its producer's latest release,
and `locks/mica-build-tools.pin` the latest release of `mica-build-tools`:

```sh
bin/mica-tools locks update --check      # which inputs are behind; changes nothing
bin/mica-tools locks update              # move every pin (and bin/mica-tools) to the latest
```

There is no index of `mica-build` releases: each product releases on its own,
and a reader takes a product's newest release ([download](download.md)).

> status: shipped — evidence: `mica-build-tools:README.md`, `docs/design/release-lock.md`

## 5. Before cutting

- CI is green on the commit being released, and the repository's own gates
  pass locally where the release depends on them.
- The inputs are the latest releases: `bin/mica-tools locks update --check`
  reports none behind, and moving one input replaces exactly that lock and
  its pin.
- A release carries no attribution lines and no development leftovers in its
  records; the record of the release lands in the repository's own `docs/`
  ([decision](../decisions/2026-09-27-each-repository-keeps-its-records.md)).

> status: shipped — evidence: `docs/design/release-lock.md`, `docs/decisions/2026-09-27-each-repository-keeps-its-records.md`
