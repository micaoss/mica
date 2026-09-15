# Stable root and kernel component identities

- **date**: 2026-09-15
- **kind**: engineering decision
- **owner**: the mica-core owner (`mica/rootfs/v2`, `system_info`); the mica-build owner (the root content, kernel `buildId`, signing)
- **review sunset**: 2027-03-15
- **status**: accepted (user, 2026-09-15: "接受"); `mica-core` part (R1 reader and `system_info`, R2 `mica/rootfs/v2`) implemented in its release `20260915-1135` (`610782c`); `mica-build` R1 and R2 land in its next pin round, K1 and K2 may follow its first scoped releases; order: `mica-core` with its package-version release, then `mica-build` after its step 3 and its package-version adaptation

## Findings

Measured by `mica-build`: `x64-minimal` roots are reproducible across
checkouts, but an empty `mica-build` commit changes the rootfs identity, and
the kernel identity changes even at the same commit.

- **R1** `/usr/share/mica/release-identity.env` in the root carries
  `VERSION=0.1.0+git<commit12>-1` and `COMMIT_DATE`.
- **R2** The `version` field of the `mica/rootfs/v1` descriptor enters the
  rootfs identity.
- **K1** The kernel `buildId` hashes the local tool image identity
  (`ai-agent/mica-boot-tools-<arch>`, retagged by concurrent builds).
- **K2** `sbsign` writes a PKCS#7 `signingTime`: 258 bytes differ per signing.
  FIT `mkimage` already honours `SOURCE_DATE_EPOCH`.

## Decision

The release identity lives only in the signed deployment
(`mica/deployment/v2` `version`, `generation`, `product`;
`docs/decisions/2026-09-15-update-packages.md`), never in a component.

- **R1** `release-identity.env` is removed from the root. `micad`'s
  `system_info` drops `system.commitDate` and the package-version
  `system.gitStamp` (`docs/design/diagnostics.md`).
- **R2** `mica/rootfs/v2` replaces v1 and has no `version` field (a
  `mica-core` contract change).
- **K1** The kernel `buildId` hashes the pinned inputs of the tool image, not
  a local image identity.
- **K2** `sbsign` runs under a clock pinned to `SOURCE_DATE_EPOCH`, so a
  signing is byte-identical; a release guard refuses a changed kernel
  identity when its `buildId` is unchanged.

**Goal.** A board-only or release-only change keeps both identities, so
`root`-only and `kernel`-only update packages can be published.

## Rationale

`root` and `kernel` update archives are published only when the other
component's identity is unchanged. Any release-varying byte inside a
component, or a nondeterministic signature, makes every release look like a
change to both and leaves only `full` packages. Keeping release identity in
the deployment, which is signed per release anyway, lets the components stay
byte-stable, together with packages that keep their versions
(`docs/decisions/2026-09-15-package-versions.md`).

## Removal condition

Revisited when a component must carry release-specific content, or when the
signing tools can no longer be made deterministic.
