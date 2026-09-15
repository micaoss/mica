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
