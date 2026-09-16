# Release images, prod products and release targets

- **date**: 2026-09-15
- **kind**: engineering decision
- **owner**: the mica-build owner; the mica-boards owner for release targets
- **review sunset**: 2027-03-15
- **status**: accepted (user, 2026-09-15; the image compression corrected the same day from zstd to gzip: "git不要发布img 发布gzip压缩版"; `mica-build`'s form B accepted, `docs/design/release-lock.md` 1.2.2 and section 2); the form of the OCI image layer confirmed by the user ("a": the layer is the `.gz` asset); released: the compressed `.img.gz` images and the prod products `x64-prod` and `cx3576-prod` in `mica-build` `x64/20260915-2042` and `cx3576/20260915-2042` (`a1f13280`)

## Decision

**s905x5m is not a release target** for now: `BOARD_RELEASE_TARGET=0` stays
in `mica-boards`. The release-target boards are `uefi-x64` and `cx3576`
(named `x64` until 2026-09-16,
`docs/decisions/2026-09-16-generic-systems-named-by-firmware.md`).

**Compressed images** (user correction, 2026-09-15: "git不要发布img
发布gzip压缩版"; gzip replaces the zstd first decided; `mica-build`'s form B
accepted). A `mica-build` GitHub Release never carries a raw image: every
image kind is published compressed as
`mica-<product>-<YYYYMMDD-HHMM>.<suffix>.gz`, one uniform rule with no size
threshold.

- The compressor is `gzip -n -9` in the pinned `mica-build-env:base` image.
  Each image is compressed twice and the two outputs must be identical.
- Before any upload, the `.gz` is decompressed and must match the raw signed
  image's sha256 and size.
- The 2 GiB asset limit applies to the `.gz`.
- The OCI image bundle's layer is the same `.gz` file (user, 2026-09-15,
  "a": form A, confirmed after the layer form was reconsidered), annotated
  `mica.compression=gzip`, `mica.uncompressed-sha256` and
  `mica.uncompressed-size`; the lock rows are unchanged, and the `asset` row
  names the `.gz` with its sha256, the layer digest
  (`docs/design/release-lock.md` 1.2.2 and section 2).
- Update kinds stay uncompressed (`.micaupd`, `.root.micaupd`,
  `.kernel.micaupd`).
- The raw signed image is still built, gated and verified.

**Prod products.** `uefi-x64-prod` and `cx3576-prod` are added, so releases carry
`<board>-dev` and `<board>-prod`; the `<board>-minimal` products, kept for
local builds and CI when this was written, were removed on 2026-09-16
(`docs/decisions/2026-09-16-minimal-products-removed.md`). The prod
products are the dev features with `PROFILE=prod`, still signed with the development keys and published on
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
