# Packages are locked by their own version; a release never changes it

- **date**: 2026-09-15
- **kind**: engineering decision
- **owner**: every repository that publishes packages; `mica-boards` implements first
- **review sunset**: 2027-03-15
- **status**: accepted (user, 2026-09-15); not implemented; `mica-boards` implements first; `mica-core`, `mica-podman` and `mica-system-base` are assessing the impact (not yet decided per repository); supersedes `docs/decisions/2026-09-15-package-reuse-by-inputs.md`

## Decision

A package is locked by its own declared version (user, 2026-09-15: "用包的版本来锁定
发release不影响包的版本，除非包的版本修改了 他的版本号增加 然后下次更新release就重建，这样仓库元数据更新和release不影响包").

- **A release never changes a package version.** Neither the version nor any
  control field carries a commit, a date or a release stamp, and
  `SOURCE_DATE_EPOCH` is derived from the version identity.
- **A package is rebuilt only when its version is bumped**, and the next
  release builds it. The reuse key is name, architecture and version against
  the previous release of the same scope:
  - the same version: the published bytes are reused by digest;
  - a higher version: the package is built;
  - a lower version: refused.
- **The inputs hash stays as a guard.** The pool layer annotation
  `mica.inputs=<sha256>` (`docs/design/release-lock.md` section 2) records a
  package's inputs; inputs that changed without a version bump are refused
  in CI and at release.
- **Proof.** A reused package still rebuilds byte-identically at release; CI
  and the package gates are unchanged; a cache never decides reuse; a pool is
  reused by digest when no package was bumped.
- **Repository metadata changes and releases do not affect packages.**

**Scope.** Intended for every repository that publishes packages.
`mica-boards` implements it first; `mica-core`, `mica-podman` and
`mica-system-base` are assessing the impact, and each adopts it by its own
decision.

## What this supersedes

- `docs/decisions/2026-09-15-package-reuse-by-inputs.md`: versions carrying
  the release commit, with unchanged packages copied by their inputs hash.
  Its producer hashing (`mica-boards:tools/deb/package-inputs.sh`) remains
  the inputs guard.

## Rationale

When a release cannot change a version, a version names one set of bytes for
good: an unchanged package leaves every root built on it unchanged, so a
kernel-only change ships as a `kernel` update package
(`docs/decisions/2026-09-15-update-packages.md`), and repository
housekeeping never forces a rebuild or a new version. A version bump becomes
the one deliberate act that changes a package, and the inputs guard catches
a change that forgot it.

## Removal condition

Revisited when a package's bytes must change without its declared version
changing, or when the package format changes.
