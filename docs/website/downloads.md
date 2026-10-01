# Page brief: Downloads

The downloads page selects an exact board, profile and signed deployment, then
shows the complete factory image and its independent component/update artifacts.
The current targets are uefi-x64, uefi-arm64 and cx3576. No public download list is
published by this repository; source builds remain the documented route.

## Artifact facts

Each entry must come from actual artifact metadata: board, profile, release
version/generation, deployment/kernel/root IDs, byte lengths and digests. A full
`disk.img` initializes the current three-partition system. A `.micaupd` archive is
a signed component deployment update. Firmware has its own maintenance artifact,
recovery and readback workflow.

> status: shipped — evidence: `mica-build:src/image/component-cli.ts`, `mica-build:src/image/components.ts`, `mica-build:docs/design/image.md`

## Verification

Link the exact trusted public-key source and the current image verification
command. Explain that boot, content and metadata have separate anchors; a checksum
served beside an untrusted artifact is insufficient authentication. All current
development acceptance flashes complete latest images. No old-layout migration
or historical update compatibility is offered.

> status: shipped — evidence: `mica-build:bin/bun.sh src/cli.ts`, `docs/design/release-signing.md`, `docs/user/download.md`

## Publication

A product release (`<board>.<variant>.<YYYYMMDD-HHMM>`) publishes the signed
archives and images as release assets, and a product's newest release is the
one to take; there is no index. The channel catalogues devices poll are an
update server's, not this repository's. A release is not a physical-board
qualification. Generate any download list from each product's newest release
and its `mica-build.lock`; do not hand-write release identities or claim
absent evidence.

> status: shipped — evidence: `mica-build:src/release/scoped.ts`, `docs/user/download.md`

Public hosting, release support windows and a public downloadable release history
remain unprovided. Link [build instructions](https://github.com/micaoss/mica-build/blob/main/docs/design/image.md),
[user downloads](../user/download.md) and [installation](../user/install.md).

> status: unsupported
