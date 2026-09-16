# Minimal products are built locally and in CI, never released

- **date**: 2026-09-15
- **kind**: engineering decision
- **owner**: the mica-build owner
- **review sunset**: 2027-03-15
- **status**: accepted (user, 2026-09-15: "按推荐处理，minimal只是本地编译和ci用，不发布"); implemented in `mica-build` `669b607` (the property is `PUBLISH=0`; CI rehearses the release path on `x64-prod` and `cx3576-prod`); supersedes `docs/decisions/2026-09-15-no-minimal-products.md`

## Decision

The `<board>-minimal` products stay, and they are never published (user
correction, 2026-09-15, replacing their removal):

- `mica-build:products/<board>-minimal` stay for all four boards. Local
  builds and CI keep building them, with their gates, negatives and the
  featureless floor they cover.
- A scoped release builds and publishes only the `<board>-dev` and
  `<board>-prod` products of its scope. The minimal products are excluded by
  a declared product property, `product.env` `PUBLISH=0` (`0` or `1`,
  default `1`; not `RELEASE`, which would overwrite the release name in
  `tools/product-build.sh`), which every `<board>-minimal` declares;
  `release.sh plan` and the release product matrix skip such products, a
  release scope holding only them is refused, and a test covers both.
- CI's release-products job, the rehearsal of the release path, publishes
  nothing; it rehearses on the prod products `uefi-x64-prod` and `cx3576-prod`.
- The published releases `x64/20260915-1458` and `cx3576/20260915-1515`
  stay as they are, with their minimal assets. The next scoped releases
  carry `<board>-dev` and `<board>-prod` only (`uefi-x64-dev`, `uefi-x64-prod`,
  `cx3576-dev`, `cx3576-prod`), and the new prod products start at
  generation 2.

## Rationale

A featureless image is the cheapest proof that the base does not depend on
an optional feature and keeps local and CI builds fast, but nobody installs
it, so publishing it only doubles release assets. A declared property keeps
the release plan explicit instead of matching on product names.

## Removal condition

Revisited if a featureless image becomes a product someone ships, or if the
minimal products stop giving coverage the dev products lack.
