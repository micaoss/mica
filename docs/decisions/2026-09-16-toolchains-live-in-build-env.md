# Toolchains live in the build-env images; a consumer build reaches no archive

- **date**: 2026-09-16
- **kind**: engineering decision
- **owner**: the `mica-build-env` owner (the images and the snapshot rows); every consumer repository drops its own archive access
- **review sunset**: 2027-03-16
- **status**: accepted (`mica-build-env` `20260916-0735` at `bf347e2` adds the `bsp` image and takes the Ubuntu snapshot rows; `mica-boards` drops `apt-install.sh`, `tools/apt-snapshot.sh` and its `ubuntu-<suite>` rows when it pins the new image; `mica-podman`'s pinned build closure is the other half)

## Decision

A build-time dependency belongs in a `mica-build-env` image, not in a
consumer's build. A consumer build installs nothing from a package archive: it
pulls an image by digest and runs.

- `mica-build-env` publishes five images: `base`, `c`, `go`, `rust` and
  **`bsp`** — Ubuntu 24.04 with gcc 13.3, the aarch64 cross toolchain on
  amd64, and the kernel, U-Boot and packer dependencies of `mica-boards` (the
  union of its lists, without `python3-pip`).
- The Ubuntu archive snapshot moves with it: the `ubuntu-<suite>` rows of
  `mica-build-env:locks/upstream.lock` are read **only while `bsp` is built**,
  and `bsp/apt-install.sh` checks each suite's signed `InRelease` against its
  pinned sha256. No consumer build reaches an archive at all.
- `mica-boards` therefore drops `common/scripts/apt-install.sh`,
  `tools/apt-snapshot.sh` and its own `ubuntu-<suite>` rows, and pins the
  image by digest.

## Rationale

An archive read at consumer-build time is an outage away from a failed build
and a mirror away from an unpinned input. The `snapshot.ubuntu.com` outage of
2026-09-16 broke `mica-boards` builds exactly this way. Moving the read into
the image that needs it makes the snapshot an input of one build, recorded in
one lock, and turns every consumer build into a digest pull.

With `mica-podman`'s pinned build closure, this removes the last
consumer-time `apt` from the workspace.

## Consequences for consumers

`20260916-0735` is a **breaking update for every consumer**: every image moved,
because the same release fixed 24 early-exiting pipe consumers under `pipefail`
in `lib/common.sh`, which is an input shared by `base`, `c`, `go` and `rust`.
Consumers move in sequence — `mica-boards` with its `uefi` rename round,
`mica-podman` before it resolves its pinned build closure, then `mica-core`,
`mica-system-base` and `mica-build`. Both `20260915-0138` and `20260916-0735`
stay in the package until every consumer has moved.

## Removal condition

Revisited if a consumer ever needs a dependency that cannot be baked into an
image — a licence that forbids redistribution, or a tool that must be resolved
per build.
