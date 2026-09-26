# Release identification and release notes

Identify a running system by its authenticated deployment ID, generation, board,
kernel component ID and root component ID. `mica-deploy status` and the update API
expose this association. Filenames and timestamps alone do not identify content.

## 1. Artifact identity

The signed deployment envelope binds the exact kernel/root association and
artifact sizes/digests. Root and support hashes have detached kernel-verifiable
signatures. The kernel package carries its matching modules and boot policy.
Firmware has an independent signed identity and maintenance receipt.

The image also carries `/usr/share/mica/manifest.tsv` and immutable build identity.
A dirty development source stamp remains visible; it is not evidence that a
clean source commit reproduces those bytes.

> status: shipped — evidence: `mica-build:src/image/components.ts`, `mica-deploy:src/deployments.rs`, `mica-build:stages/compose/90-pack.Dockerfile`

## 2. Release-note facts

Record the exact target, profile, deployment IDs, component changes, source
identity and package delta from the artifacts. Name trust-anchor, boot-policy,
access-default and persistence-policy changes explicitly. Keep validation
results and limitations attached to the exact image tested.

A root-only release must identify the unchanged kernel/support component; a
kernel-only release must identify the unchanged root. Retained fallback uses the
same DATA filesystem. It does not revert application data. The current contract
accepts `dataPolicy: unchanged` and has no destructive migration path.

> status: shipped — evidence: `docs/user/doc-contract.md`, `mica-build:src/image/components.ts`, `docs/design/updates.md`

## 3. Publication status

A scoped release of `mica-build` publishes the signed archives and images as
release assets, and the Mica version index names the newest release of every
product. Distribution to devices, the channels and their withdrawal, is the
fleet service's and is not asserted by this page. An installed authenticated
deployment boots offline whatever the catalogue's expiry. A published release
is not a substitute for board qualification or a product support commitment.

> status: shipped — evidence: `mica-build:src/release/scoped.ts`, `docs/design/mica-index.md`, `mica-core:crates/mica-deploy/src/acquisition.rs`

No public release history, support window or end-of-life commitment is asserted
by this page. See [obtaining an image](download.md) for the current source-build
route and [release artifacts](../design/release-artifacts.md) for delivery records.

> status: unsupported
