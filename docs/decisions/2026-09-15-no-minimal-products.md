# There are no minimal products

- **date**: 2026-09-15
- **kind**: engineering decision
- **owner**: the mica-build owner
- **review sunset**: 2027-03-15
- **status**: superseded the same day, before implementation, by `docs/decisions/2026-09-15-minimal-products-not-released.md` (user correction: the minimal products stay for local builds and CI and are never released); this record keeps the replaced removal

## Decision

The minimal products are removed entirely, with no compatibility (user,
2026-09-15):

- `mica-build:products/x64-minimal`, `virt-arm64-minimal`, `cx3576-minimal`
  and `s905x5m-minimal` are deleted, with every rule, test, CI matrix entry
  and document that requires a `<board>-minimal` product (the "every board
  has a `<board>-minimal` product" rule of `products/README.md`, the product
  contract tests, the smoke, negative and factory-root fixtures keyed to
  minimal, the Makefile and CI lists).
- The products are `<board>-dev` for all four boards, plus `x64-prod` and
  `cx3576-prod` (`docs/decisions/2026-09-15-release-images-and-products.md`).
- CI's release-product jobs run the release product path for the prod
  product of every release-target board (`x64-prod`, `cx3576-prod`) instead
  of the minimal ones.
- The coverage only minimal gave, a floor without features (the base layer
  must not depend on an optional feature), is kept where it is cheap without
  a product, for example a composition test that resolves `common.pkgs` and
  the board package alone. No hidden minimal product is kept.
- The published releases `x64/20260915-1458` and `cx3576/20260915-1515`
  stay as they are, with their minimal assets as history. The next scoped
  releases carry dev and prod products only, and the new prod products start
  at generation 2.

## Rationale

A minimal product doubled the builds and release assets of every board
without being a product anyone installs. Its one useful property, proving
that the base does not depend on an optional feature, needs a composition
test, not a signed image.

## Removal condition

Revisited if a featureless image becomes a product someone ships.
