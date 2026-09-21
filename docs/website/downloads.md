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

> status: shipped — evidence: `mica-build:build/src/component-cli.ts`, `mica-build:build/src/components.ts`, `docs/design/build.md`

## Verification

Link the exact trusted public-key source and the current image verification
command. Explain that boot, content and metadata have separate anchors; a checksum
served beside an untrusted artifact is insufficient authentication. All current
development acceptance flashes complete latest images. No old-layout migration
or historical update compatibility is offered.

> status: shipped — evidence: `mica-build:verify/run.sh`, `docs/design/release-signing.md`, `docs/user/download.md`

## Publication

A scoped release publishes the signed archives and images as release assets,
and the Mica version index names the newest release of every product. The
channel catalogues devices poll are the fleet service's, not this repository's.
A release is not a physical-board qualification. Generate any download list
from the index and the delivered artifact records; do not hand-write release
identities or claim absent evidence.

> status: shipped — evidence: `mica-build:tools/release.sh`, `docs/design/mica-index.md`

Public hosting, release support windows and a public downloadable release history
remain unprovided. Link [build instructions](../design/build.md),
[user downloads](../user/download.md) and [installation](../user/install.md).

> status: unsupported
