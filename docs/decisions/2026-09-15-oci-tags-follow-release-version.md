# OCI tags follow the release version

- **date**: 2026-09-15
- **kind**: engineering decision
- **owner**: every repository that publishes to `ghcr.io/micaoss`; the reference rules are `docs/design/release-lock.md` 1.3
- **review sunset**: 2027-03-15
- **status**: accepted (user, 2026-09-15); stated for `mica-build-env` in its `RULES.md` section 3 (`mica-build-env` `4a04b7e`) and implemented by its release `20260915-0138` (`f7b896b`); each other repository adopts it in its stage of `docs/plan/20260914-2042-release-lock-offline-build.md`

## Decision

An OCI tag names the release that published it, never a hash or a commit
(user, 2026-09-15: "不是用hash，用和版本号一致的发布";
"通知其他的oci都用这个格式，这样很容易识别是哪个版本发布的").

- Every OCI tag in `ghcr.io/micaoss/<repository>` is
  `<kind>[.<name>]*.<YYYYMMDD-HHMM>`, the last part being exactly the release
  tag that published it. No tag carries a commit (`build-<commit12>`) or a
  hash (`inputs-<16>`).
- Examples: `mica-build-env:base.20260915-0138` (an index),
  `mica-build-env:<image>.<arch>.<release>` (a per-architecture build push),
  `<repository>:pool.<arch>.<release>`,
  `mica-boards:<component>.<board>.<release>` (`board`, `kernel`, `uboot`,
  `firmware`),
  `mica-boards:pool.<board>.<arch>.<release>`,
  `mica-system-base:rootfs.<release>`, `mica-build:image.<product>.<release>`,
  `mica-build:update.<product>.<release>`,
  `<repository>:source.<release>`.
- For a scoped release (`<scope>/<YYYYMMDD-HHMM>`, `mica-boards` and
  `mica-build` only) the tag's last part is the `<YYYYMMDD-HHMM>` part, and
  the scope is named earlier in the tag.
- A tag that already holds another digest is refused, never re-pointed.
- An artifact unchanged across releases is reused by digest: the new
  release's tag points at the existing digest. A rebuild key is not a tag;
  `mica-build-env` records its key as the label `com.mica.build-env.inputs`
  on every platform image config (an index annotation does not survive a
  Docker manifest list, which failed release `20260915-0130`).
- For a reader the tag stays informational: a lock names every artifact by
  digest, and the digest is what is read.

## What this supersedes

- The `build-<commit12>` tags of
  `docs/decisions/2026-09-13-ghcr-artifact-registry.md` (`source`, `pool`,
  `root`) and `mica-build-env`'s `<image>.inputs-<16>` tags; artifacts
  already published under them are not renamed by this record.

## Rationale

A tag that ends in the release version tells anyone reading the registry
which release published an artifact, without looking up a commit or a key.
Pinning stays by digest, so an informational tag cannot change what a
consumer builds, and refusing to re-point a tag keeps it honest.

## Removal condition

Revisited when a publication is not tied to a release, or when the release
version form changes.
