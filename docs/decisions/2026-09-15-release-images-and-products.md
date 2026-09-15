# Release images, prod products and release targets

- **date**: 2026-09-15
- **kind**: engineering decision
- **owner**: the mica-build owner; the mica-boards owner for release targets
- **review sunset**: 2027-03-15
- **status**: accepted (user, 2026-09-15; the image compression corrected the same day from zstd to gzip: "git不要发布img 发布gzip压缩版"); not implemented (`mica-build` after K1 and K2); the record of the raw image's sha256 and size is proposed by `mica-build` (a spec change is reported first if needed)

## Decision

**s905x5m is not a release target** for now: `BOARD_RELEASE_TARGET=0` stays
in `mica-boards`. The release-target boards are `x64` and `cx3576`.

**Compressed images** (user correction, 2026-09-15: "git不要发布img
发布gzip压缩版"; gzip replaces the zstd first decided). A `mica-build`
GitHub Release does not carry the raw `.img`; it carries each product's disk
image gzip-compressed as `mica-<product>-<YYYYMMDD-HHMM>.img.gz`.

- The OCI image bundle's layer is the same `.img.gz` file, so the `asset`
  row's sha256 still equals the layer digest.
- The gzip is deterministic: no name and no timestamp in the header (`gzip
  -n` or equivalent), a fixed level, and the compressor taken from a pinned
  build-env image; two compressions must be byte-identical.
- Before publishing, the file is decompressed and compared with the sha256
  of the raw signed `disk.img`.
- The raw signed image is still built, gated and verified. How its sha256
  and size are recorded is proposed by `mica-build`; if that needs a lock
  row or a change to `docs/design/release-lock.md`, the exact form is
  reported first.

**Prod products.** `x64-prod` and `cx3576-prod` are added: the dev features
with `PROFILE=prod`, still signed with the development keys and published on
the development channel
(`docs/decisions/2026-09-14-no-image-profile-packages.md`,
`docs/design/release-artifacts.md` channels).

## Rationale

A raw disk image is mostly empty space, and a deterministic compression keeps
the published bytes reproducible while cutting the download; verifying the
decompressed bytes against the signed image keeps the asset bound to what was
gated. Adding prod products now exercises the prod profile through the same
release path before any production keys exist.

## Removal condition

Revisited when `s905x5m` becomes a release target, when production keys or a
production channel exist, or when the image distribution changes.
