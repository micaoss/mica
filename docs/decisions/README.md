# Decisions

One file per decision, named `<YYYY-MM-DD>-<slug>.md`. Each record states its
`kind`, owner, status and review sunset, then the decision, rationale and
removal condition. Records describe the decision as it stands; history is in
`docs/changelog.md`.

Kinds:

- **skill divergence** — a deliberate deviation from a `/pma` or stack-skill
  rule.
- **engineering decision** — a cross-cutting technical choice that no single
  design record owns.

| Record | Kind | Sunset |
|---|---|---|
| [There are no image profile packages](2026-09-14-no-image-profile-packages.md) | engineering decision | 2027-03-14 |
| [Update packages: one signed deployment, full, root and kernel archives](2026-09-15-update-packages.md) | engineering decision | 2027-03-15 |
| [Stable root and kernel component identities](2026-09-15-stable-component-ids.md) | engineering decision | 2027-03-15 |
| [Release images, prod products and release targets](2026-09-15-release-images-and-products.md) | engineering decision | 2027-03-15 |
| [The generic systems are named by their firmware class](2026-09-16-generic-systems-named-by-firmware.md) | engineering decision | 2027-03-16 |
| [The minimal products are removed](2026-09-16-minimal-products-removed.md) | engineering decision | 2027-03-16 |
| [Naming: what is a board, what is a product, what is an image kind](2026-09-16-board-and-product-naming.md) | engineering decision | 2027-03-16 |
| [Development builds leave the release; the released variants are basic (the default) and full](2026-09-26-release-variants-full-and-basic.md) | engineering decision | 2027-03-26 |
| [Each repository keeps its own development records; mica holds the conventions and the public documentation](2026-09-27-each-repository-keeps-its-records.md) | working practice | 2027-03-27 |
