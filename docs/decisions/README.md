# Decisions

One file per decision, named `<YYYY-MM-DD>-<slug>.md`. Each record states its
`kind`, owner, status and review sunset, then the decision, rationale and
removal condition. Records describe the decision as it stands; history is in
`docs/changelog.md`.

Kinds:

- **skill divergence** — a deliberate deviation from a `/pma` or stack-skill
  rule. The workspace `AGENTS.md` links here and does not restate the rationale.
- **engineering decision** — a cross-cutting technical choice that no single
  design record owns.

| Record | Kind | Sunset |
|---|---|---|
| [Bounded lifecycle ioctl boundary](2026-09-10-bounded-lifecycle-ioctl.md) | stack-skill divergence | 2026-12-10 |
| [GHCR is the artifact registry](2026-09-13-ghcr-artifact-registry.md) | engineering decision | 2027-03-13 |
| [mica-boot is split three ways and retired](2026-09-14-mica-boot-split.md) | engineering decision | when mica-boot is retired |
| [There are no image profile packages](2026-09-14-no-image-profile-packages.md) | engineering decision | 2027-03-14 |
| [mica-system-base pins the shared upstream Debian packages](2026-09-14-base-pins-upstream-packages.md) | engineering decision | 2027-03-14 |
| [One release lock format and an offline build](2026-09-14-release-lock-and-offline-build.md) | engineering decision | 2027-03-14 |
| [OCI tags follow the release version](2026-09-15-oci-tags-follow-release-version.md) | engineering decision | 2027-03-15 |
| [mica-build releases are scoped and carry image files](2026-09-15-mica-build-scoped-releases.md) | engineering decision | 2027-03-15 |
| [mica-boards releases per board](2026-09-15-mica-boards-per-board-releases.md) | engineering decision | 2027-03-15 |
| [Board image kinds: the board delivers the pieces, the assembly packs the image](2026-09-15-board-image-kinds.md) | engineering decision | 2027-03-15 |
| [Board flashing formats: mica-boards declares and packs, mica-build executes](2026-09-15-board-image-packers.md) | engineering decision | 2027-03-15 |
| [Update packages: one signed deployment, full, root and kernel archives](2026-09-15-update-packages.md) | engineering decision | 2027-03-15 |
| [Packages are reused by inputs across releases, first in mica-boards](2026-09-15-package-reuse-by-inputs.md) | engineering decision | 2027-03-15 |
| [Packages are locked by their own version; a release never changes it](2026-09-15-package-versions.md) | engineering decision | 2027-03-15 |
| [Stable root and kernel component identities](2026-09-15-stable-component-ids.md) | engineering decision | 2027-03-15 |
| [Board kernel builds: incremental prod, pinned toolchains, then reuse](2026-09-15-board-kernel-builds.md) | engineering decision | 2027-03-15 |
| [Release images, prod products and release targets](2026-09-15-release-images-and-products.md) | engineering decision | 2027-03-15 |
| [There are no minimal products](2026-09-15-no-minimal-products.md) (superseded) | engineering decision | 2027-03-15 |
| [Minimal products are built locally and in CI, never released](2026-09-15-minimal-products-not-released.md) (superseded) | engineering decision | 2027-03-15 |
| [The Mica version index release](2026-09-15-mica-version-index.md) | engineering decision | 2027-03-15 |
| [Scoped release tags separate the scope with a dot](2026-09-16-scoped-tags-use-a-dot.md) | engineering decision | 2027-03-16 |
| [The generic systems are named by their firmware class](2026-09-16-generic-systems-named-by-firmware.md) | engineering decision | 2027-03-16 |
| [The minimal products are removed](2026-09-16-minimal-products-removed.md) | engineering decision | 2027-03-16 |
| [Naming: what is a board, what is a product, what is an image kind](2026-09-16-board-and-product-naming.md) | engineering decision | 2027-03-16 |
| [Toolchains live in the build-env images; a consumer build reaches no archive](2026-09-16-toolchains-live-in-build-env.md) | engineering decision | 2027-03-16 |
| [`mica-podman` pins its own build snapshot, not the Base apt row's](2026-09-16-podman-pins-its-own-snapshot.md) | deliberate deviation | 2027-03-16 |
| [The consolidated-round pause, and when it ended](2026-09-16-consolidated-round-pause.md) | coordination decision | 2026-12-20 |
| [A hardware capture carrying a SoC serial is not committed to a public repository](2026-09-20-device-captures-are-not-committed.md) | working practice | 2027-03-20 |
| [A coordinator's working state is a record nobody else can read](2026-09-20-coordination-state-is-a-record.md) | working practice | 2027-03-20 |
| [Development-phase release deletion](2026-09-20-development-phase-release-deletion.md) | user decision | the development phase |
| [mica-boards is merged into mica-build: a board owns its build and its image](2026-09-21-mica-boards-merged-into-mica-build.md) | engineering decision | 2027-03-21 |
| [mica-build: one language on the build host, shell only where Bun is not the toolchain](2026-09-22-mica-build-one-language.md) | engineering decision | 2027-03-22 |
| [Development builds leave the release; the released variants are full and basic](2026-09-26-release-variants-full-and-basic.md) | engineering decision (not implemented) | 2027-03-26 |
