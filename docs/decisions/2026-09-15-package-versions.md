# Packages are locked by their own version; a release never changes it

- **date**: 2026-09-15
- **kind**: engineering decision
- **owner**: every repository that publishes Debian packages (`mica-boards`, `mica-system-base`, `mica-podman`, `mica-core`); `mica-build` as the consumer that stops depending on commit-carrying versions
- **review sunset**: 2027-03-15
- **status**: accepted (user, 2026-09-15); rules R1-R8 resolved (user: "全部按建议处理"); adopted by all four package-publishing repositories (`mica-boards`, `mica-system-base`, `mica-podman`, `mica-core`), implementation in progress; supersedes `docs/decisions/2026-09-15-package-reuse-by-inputs.md`

## Decision

A package is locked by its own declared version (user, 2026-09-15: "用包的版本来锁定
发release不影响包的版本，除非包的版本修改了 他的版本号增加 然后下次更新release就重建，这样仓库元数据更新和release不影响包").

- **A release never changes a package version.** Neither the version nor any
  control field carries a commit, a date or a release stamp, and
  `SOURCE_DATE_EPOCH` is declared with the version (R2).
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

**Scope.** Adopted by every repository that publishes Debian packages:
`mica-boards`, `mica-system-base`, `mica-podman` and `mica-core`, with no
compatibility with the old forms. Implementation is in progress.

## Resolved rules

The user accepted these rules on 2026-09-15 ("全部按建议处理"):

- **R1 Version.** Declared literally next to the package or producer:
  `mica-system-base:debs/<package>/control`, `mica-podman:deb/mica-podman.control`,
  `mica-core:pkgs/<producer>/producer.env` (one version per producer, its
  upstream part the crate version of the binary it ships), and per producer
  in `mica-boards` (its own design). No commit, date, release or `.dirty`
  stamp. A packaging-only change bumps the Debian revision; an upstream or
  source change bumps the upstream part and resets the revision. Initial
  versions: Base `mica-busybox` `1.38.0-mica1`, `mica-systemd-boot`
  `257.13-mica1`, `mica-ca-trust` `20250419-mica1`, `mica-system` `1.0.0-1`;
  `mica-podman` `5.8.6-1`; `mica-core` `0.1.0-1` per producer; `mica-boards`
  proposes its own. A version lower than the previous release's for the same
  package is refused.
- **R2 `SOURCE_DATE_EPOCH`.** Declared explicitly in the same file as the
  version and bumped with it; never derived from git history or the release
  commit (`mica-podman` declares it rather than computing it from the
  upstream commit).
- **R3 No release- or commit-dependent content.** The `Mica-Source-Commit`
  control field is dropped (`Mica-Source-Repo` stays); no commit is compiled
  into binaries (`mica-core` removes `MICA_BUILD_COMMIT`; `--version` and
  `system_info` show the package version, compiled in from the declared
  version); copyright texts cite file sha256 values instead of commits. The
  commit of a release is only in its lock's release row.
- **R4 Inputs hash, a guard and not a key.** Per producer and architecture,
  the sha256 over a sorted `(path, sha256)` manifest of everything in the
  repository that determines the bytes: sources, packaging files, the used
  upstream lock rows, tooling, the declared version and epoch, and the
  architecture. Build-env image digests are excluded; a toolchain move that
  changes bytes is caught by the byte-identical comparison of R5. It is
  recorded only as the pool layer annotation `mica.inputs=<sha256>`, not in
  the lock.
- **R5 Reuse**, in `ci.yml` (read-only) and at release: read the latest
  release lock of the same scope anonymously, and its pool manifests.
  - Same name, architecture and version: `mica.inputs` must equal the current
    hash, else refuse "inputs of <package> changed without a version bump";
    the from-source build must be byte-identical to the published sha256,
    else refuse (a bump is required); the release then reuses the published
    layer by digest, adding no new bytes.
  - A higher version: build and publish.
  - No previous release: build everything.
  - Missing or corrupt previous artifacts are refused, never silently
    rebuilt. CI and the package gates still build from source; a cache never
    decides reuse.
- **R6 Pool manifests** carry only release-independent annotations
  (`mica.source-repo`, `mica.arch`, and per layer
  `org.opencontainers.image.title` and `mica.inputs`);
  `org.opencontainers.image.version`, `.revision`, `.created` and
  `mica.source-commit` are removed. When no package of a pool changed, the
  manifest is byte-identical and the release's `pool.<...>.<release>` tag is
  a new tag on the same digest (`docs/design/release-lock.md` 1.3 and
  section 2). `mica-boards`' component manifests keep their own annotations.
- **R7 `mica-core` only.** The exact `micad (= <version>)` dependencies of
  `mica-apid`, `mica-mqttd` and `mica-mqtt-broker` stay; a `micad` bump bumps
  their revisions.
- **R8 `make offline`** builds with the declared versions; with no release
  to compare against, it only warns about the inputs guard.

## Clarifications

Confirmed by the coordinator on 2026-09-15 for all four repositories:

- **D1 First release under the rules.** The previous-release comparison of
  R5 (reuse, the inputs guard, the lower-version refusal) applies only to a
  previous release made under these rules, whose pool layers carry
  `mica.inputs`. The first release under the rules has none, so it builds
  and publishes everything, even though the new declared versions sort below
  the old `+git` or date-stamped ones. No Debian epoch (`1:`) is added:
  devices never upgrade these packages in place with apt, and roots are
  composed and pinned by sha256.
- **R3 and upstream commits.** Copyright texts may cite upstream commits
  pinned in `locks/upstream.lock`, which are release-independent; R3 forbids
  only the publishing repository's own commit.

## Order

This record and the release-lock change (R6) land first. The four
repositories then implement in parallel, after their in-flight work.
`mica-build` stops depending on `Mica-Source-Commit` and on `+git` versions
before it pins any release built under these rules. Each repository then cuts
one release, a full rebuild that records `mica.inputs`; later releases
reuse.

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
