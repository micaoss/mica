# Minimal products are built locally and in CI, never released

- **date**: 2026-09-15
- **kind**: engineering decision
- **owner**: the mica-build owner
- **review sunset**: 2027-03-15
- **status**: accepted (user, 2026-09-15: "按推荐处理，minimal只是本地编译和ci用，不发布"); not implemented; `mica-build` implements it in the prod products round, after K1 and K2; supersedes `docs/decisions/2026-09-15-no-minimal-products.md`

## Decision

The `<board>-minimal` products stay, and they are never published (user
correction, 2026-09-15, replacing their removal):

- `mica-build:products/<board>-minimal` stay for all four boards. Local
  builds and CI keep building them, with their gates, negatives and the
  featureless floor they cover.
- A scoped release builds and publishes only the `<board>-dev` and
  `<board>-prod` products of its scope. The minimal products are excluded by
  a declared product property, for example `product.env` `RELEASE=0`
  (default `1`); `release.sh plan` and the release product matrix honour it,
  a release scope that would contain only unpublished products is refused,
  and a test covers both.
- CI's release-products job, the rehearsal of the release path, publishes
  nothing and may keep using the minimal products; if the release exclusion
  makes that path differ, it rehearses on the prod products instead, and
  `mica-build` says which.
- The published releases `x64/20260915-1458` and `cx3576/20260915-1515`
  stay as they are, with their minimal assets. The next scoped releases
  carry `<board>-dev` and `<board>-prod` only (`x64-dev`, `x64-prod`,
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
