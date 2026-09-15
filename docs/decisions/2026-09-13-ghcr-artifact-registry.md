# GHCR is the artifact registry

- **date**: 2026-09-13
- **kind**: engineering decision
- **owner**: `mica-build-env` maintainers
- **review sunset**: 2027-03-13
- **status**: accepted; implemented (plan `20260913-0416-board-product-build-architecture`, phase 6: `mica-build-env:deb/oci.sh` and the scripts over it, `mica-boards:tools/publish-boards.sh`, `mica-build:tools/board-pool.sh`, `tools/product-release.sh`); the migration of the pinned artifacts to GHCR is the runbook `docs/task/20260913-1700-registry-migration.md`; the four-package layout under *Visibility* is superseded as the target (see *Per-repository packages*); the `build-<commit12>` tag forms are superseded by `docs/decisions/2026-09-15-oci-tags-follow-release-version.md`

## Decision

Every artifact a Mica OS repository publishes -- the userspace package
pools, the board bundles, the lifecycle binaries, the product roots and the
source pins -- is published to GHCR under `ghcr.io/micaoss/` in an
OCI-compatible form, and every consumer pins it by digest. Nothing depends
on the packages feature of `git.ds.cc`; GitHub Releases stop being written
once the OCI backend lands.

The transport does not change the package format: userspace packages remain
Debian packages composed by apt, carried inside an OCI artifact per
repository and architecture. Artifacts that are never installed into a root
(board bundles, lifecycle binaries) are OCI artifacts with one layer per
file, and the composed product root is an OCI image.

## Visibility (2026-09-13, user)

(Superseded as the target by *Per-repository packages* below; kept as
recorded because published artifacts under these four packages remain pinned.)

Every package is **public**; a read needs no token. GHCR creates packages
private and has no API to change a package's visibility, so the set of
packages is fixed at four -- `mica-source`, `mica-pool`, `mica-board`,
`mica-root` -- each made public once by hand, and an artifact is a tag in
its kind's package: `mica-pool:<repository>.<arch>.build-<commit12>`,
`mica-source:<repository>.build-<commit12>`, `mica-board:<board>.build-<commit12>`,
`mica-root:<product>.build-<commit12>`. A new repository, board or product
is a new tag in a public package. Publishing is CI's (each repository's
workflow, its own token); every publisher pulls what it pushed anonymously
and fails, naming the package's settings page, when it cannot.

## Per-repository packages (2026-09-13 18:41, user)

Every repository owns its CI and publishes to packages named for that
repository. This supersedes the four shared packages above as the target:
a shared package made one repository's workflow depend on write access to a
package another repository created, and the `mica-debian` publish run 34774732546 was refused
with HTTP 403 at its upload to `mica-source`. The remedy is per-repository
publication, not cross-repository grants. Public visibility and publication
by CI only stay. Artifacts already published under the four packages are
kept for the consumers that pin them; none is deleted.

The package is the producer repository and the artifact kind leads the tag
(dot-joined):

| Artifact | Reference |
|---|---|
| Source pin | `ghcr.io/micaoss/<repository>:source.build-<commit12>` |
| Package pool | `ghcr.io/micaoss/<repository>:pool.<arch>.build-<commit12>` |
| Board bundle | `ghcr.io/micaoss/mica-boards:board.<board>.<YYYYMMDD-HHMM>` |
| Board package pool | `ghcr.io/micaoss/mica-boards:pool.<arch>.<YYYYMMDD-HHMM>` |
| Product root | `ghcr.io/micaoss/mica-build:root.<product>.build-<commit12>` |
| Debian rootfs (superseded proposal) | `mica-debian:rootfs.build-<commit12>` (never published) |
| Base system pool | `ghcr.io/micaoss/mica-system-base:pool.<arch>.<YYYYMMDD-HHMM>` |
| Base system rootfs | `ghcr.io/micaoss/mica-system-base:rootfs.<YYYYMMDD-HHMM>`, a multi-architecture index |

The common helpers follow it: `oci_repo` takes the producer repository name
and `oci_tag` keeps dot joining, with the prefixes `source`, `pool.<arch>`,
`board.<board>` and `root.<product>`. A pin keeps its repository identity
and blob sha256 verification. The first publication to a new package counts
only when an anonymous read of it succeeds, not when the upload does.
`mica-system-base` names its artifacts by release instead of by commit, as
the workspace rule for release versions requires: a release
`<YYYYMMDD-HHMM>` publishes `pool.<arch>.<YYYYMMDD-HHMM>` and
`rootfs.<YYYYMMDD-HHMM>`, and no source artifact (`mica-system-base:src/publish.ts`;
first release `20260914-0455`). `mica-boards` does the same, after its move
to `micaoss` (root commit `5b7fd98`): a release publishes
`pool.<arch>.<YYYYMMDD-HHMM>` and one `board.<board>.<YYYYMMDD-HHMM>` per
board; the first release was `20260914-1603` (`c6ecd7bce901`, `SHA256SUMS`
trust hash `fe61758865cd49ca461757a880cf9c2ac718c029aeba2b880bea7818555a785b`),
deleted on 2026-09-15 when `mica-boards` moved to per-board releases
(`<board>/20260915-0824`, `docs/decisions/2026-09-15-mica-boards-per-board-releases.md`). The `mica-debian` row records the
proposal the Base rows replaced.

A Base release carries a lock, the same model as the build-env
`build-env-image.lock`: from `20260914-0654` (target `2a4cd19ea07e`) its only
assets are `system-base.lock`, the digest-pinned references of its rootfs
index, both per-architecture roots and both pools, and `SHA256SUMS` (trust
hash `9f1300fbdbd595f5c13d1ea5a7cd7db0d2b905b94e74a34f0648db8c7081292d`). A
consumer verifies the lock against that `SHA256SUMS` and commits
`system-base.lock` unchanged; moving to another Base release replaces the file
whole. `20260914-0455` has no lock. From `20260914-0742` (target
`de9526964079`, trust hash
`fc2b0dbe441b30883cc5a390fb149d142f59c5465cbbde2f34883b1629e46d96`) a Base
release also carries `system-base-packages.lock`, the upstream Debian
packages boards and products install
(`docs/decisions/2026-09-14-base-pins-upstream-packages.md`), and from
`20260914-0829` (trust hash
`595daa91b5e2bba310dfa5447b2d65769640da77ab2cb2be2cf037a4512f624e`)
`system-base.sources`, the Debian archive other packages are resolved from.
The last Base in that form was `20260914-1148` (trust hash
`574485b25f6ccb1e852b875ff08b811e9c708a8329bf29654d090f2eb9896258`), whose
package lock names for each package the roots it is pinned for. On
2026-09-15 the user deleted every Base release named here (with
`20260914-1931` and `20260914-2206`) and reset `mica-system-base` to one root
commit (now `4d63430`), so its commits cited in this record are pre-reset
history; since `20260915-0059` (deleted; the Base to pin is `20260915-0209`)
a Base release carries only
`mica-system-base.lock` and `SHA256SUMS` (`docs/design/release-lock.md`
section 3).
How a consumer takes a release is `mica-system-base:README.md`, section
*Consuming a release*: the three lock and source files at the consumer's
root, with a record of the tag and the sha256 of `SHA256SUMS`, which is not
itself committed.

Legacy read, during the pin transition only: a reader may fall back from
the per-repository reference to the documented immutable historical
namespace (the four shared packages) only when the registry answers 404, and
only with the same full identity and digest checks. A 401 or 403, wrong
metadata, corrupt content or a digest mismatch is a refusal, never a
fallback, and nothing is ever written to the historical namespace. The
negative cases belong in the canonical registry tests.

## Source artifacts are byte-stable (2026-09-13)

A source artifact's layer is the archive of one committed tree, and its
bytes must not depend on the publishing host. Git 2.38 and later compress
`tar.gz` archives internally, which changes the bytes of the same tree, so
every publisher pins the compressor:

```sh
git -c tar.tar.gz.command='gzip -cn' archive --format=tar.gz \
  --prefix=<repository>-<commit12>/ <full-commit>
```

The layer keeps the top-level prefix and title `<repository>-<commit12>`,
the commit-derived revision and created annotations, and the kind and
repository identity. A consumer's expected sha256 is never changed to accept
a difference the transport introduced.

Historical publication (transporting a revision a consumer already pins):

- the job names an existing full 40-hex commit of the intended repository;
  a branch or tag name is resolved to such a commit and checked against the
  approved revision before anything is published, so a workflow never selects
  moving content;
- only that committed tree is archived, with its own metadata; no
  uncommitted content and no newer publisher helper enters the archive;
- the expected layer sha256 is a required input, and a missing or wrong
  digest or an invalid revision is refused before registry authentication or
  any write.

Known fixtures, pinned by `mica-build`:

| Repository | Revision | Source layer sha256 |
|---|---|---|
| mica-debian | `01aa3763896dae911cdae832eb2cd020ebd530d7` | `473667c3fc50974058963f3d30cb4d5570f24330e0f65adc8d1174edcb11fb91` |
| mica-boot | `e7022164ed50b3bdefe0c368e7d9c47d2c264db8` | `5ae0c45263cf228343272312571a3ad880a9d9be463d884da60829e5d14ec966` |

One canonical shell publisher lives in `mica-build-env` and is vendored
verbatim into the shell-based repositories; `mica-boot`'s prepared
implementation is reconciled into it rather than kept as a divergent copy.
`mica-debian` implements the same artifact semantics in TypeScript, without
shell scripts; its `--revision` spelling may stay.

## One base system repository (2026-09-13, user)

The user requested a new repository, `mica-system-base`, owned by the
mica-system owner, which merges `mica-debian` and `mica-system`; both old
repositories retire once the migration and the consumers' transition are
done. Its build tooling is Bun and TypeScript; scripts and payload that run
on the device are exempt. Radio support and the SFTP server are not
mandatory base content (the radio packages are built by `mica-boards`; the
SFTP server is `mica-core`'s package, installed by the product stage). This is a settled direction, not a
choice between proposals: the base-only, layered and alternative rootfs
proposals below and in `mica-debian:docs/plan/20260913-1842-publish-system-rootfs.md`
are superseded and no longer awaiting a vote.

The user's later instruction is to merge one latest base, including the Bun
tooling and the SSH server replacement. `mica-system-base` imports the
history of `mica-debian` at `fbefe43` and `mica-system` at `13c1299` with
their exact trees and records its publication and ownership contracts
(`c1b9441`, `95376c8`). Its artifacts are named by release, as the table
above records, and its first release is `20260914-0455`. An artifact exists
only once its own CI publishes it and it reads back anonymously. The old
repositories' pins and every artifact they published stay until their
consumers have moved; nothing is deleted.

The radio producers (`mica-wifi`, `mica-wifi-ap`, `mica-bluetooth`) move to
`mica-boards`: its local commit `03f85ca` receives them from `mica-system`
`13c1299` with identical payload. Its full pool gate has not passed, and
nothing is published from the new location.

## Debian base rootfs (2026-09-13 18:51, user) -- superseded

Superseded by *One base system repository* above; kept as recorded.

`mica-debian` keeps only the base: 68 packages per architecture (the
minbase required set at lock `4d2f37c`), published with a builder image that
carries mmdebstrap, and each downstream stage installs its own additions on
top of the previous stage's root. This supersedes the earlier 123-package
system-rootfs draft. The mechanism is still a disposable feasibility spike
and neither its implementation nor its layer and preset design is accepted;
the non-base pins and the identifiers in `ids.json` stay where they are until
their destination repositories acknowledge a complete handoff. Publishing
`mica-debian`'s current committed source from its own CI is a separate,
requested step and does not approve the rootfs work.

## Rationale

One registry, one token (`GH_TOKEN` already reads the release assets), one
digest per pin, immutable content addressing and a garbage-collected store,
matching how the builder images are already pinned in
`mica-build-env:images.env`. Armbian's artifact framework and the bootc
image-mode pattern are the precedents. OCI layers are not a package
manager: they carry no dependency model and a later layer overwrites
silently, which is why dpkg keeps the composition.

## Removal condition

A registry that GHCR cannot serve (air-gapped builds without a mirror) or a
change of forge; either replaces the backend behind
`build-env/deb/registry.sh` and this record.
