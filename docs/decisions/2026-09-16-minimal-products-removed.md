# The minimal products are removed

- **date**: 2026-09-16
- **kind**: engineering decision
- **owner**: the `mica-build` owner (the product set, the rules and tests that named a minimal product); `mica` records it
- **review sunset**: 2027-03-16
- **status**: accepted (user, 2026-09-16: "不需要minimal这个，所有的都不发布这个"); supersedes `docs/decisions/2026-09-15-minimal-products-not-released.md`; implemented by `mica-build` in the rename round of `docs/task/20260916-0040-uefi-board-names.md`

## Decision

The `<board>-minimal` products are deleted, on every board. They are not kept
unpublished — that was the 2026-09-15 position — they do not exist.

- `mica-build:products/x64-minimal`, `virt-arm64-minimal`, `cx3576-minimal`
  and `s905x5m-minimal` are deleted, and no `uefi-x64-minimal` or
  `uefi-arm64-minimal` is created in the rename
  (`docs/decisions/2026-09-16-generic-systems-named-by-firmware.md`).
- The product set becomes: `uefi-x64-dev`, `uefi-x64-prod`, `uefi-arm64-dev`,
  `uefi-arm64-prod`, `cx3576-dev`, `cx3576-prod`, `s905x5m-dev`.
- Every rule, test, fixture and CI matrix entry that required a
  `<board>-minimal` product goes with them, including the "every board has a
  minimal product" rule.
- The `PUBLISH` machinery goes too if nothing else uses it. `s905x5m-dev` is
  unpublished through `BOARD_RELEASE_TARGET`, not through `PUBLISH`, so
  `PUBLISH=0` may have no user left; `mica-build` decides and reports.
- The coverage minimal gave — that the floor composes with no feature selected
  — stays as a cheap composition test, not as a product (agreed 2026-09-15).
- CI's release rehearsal runs the prod products and is unaffected.
- Releases published before today keep their minimal assets. They are history
  and are not rewritten.

## What this supersedes

`docs/decisions/2026-09-15-minimal-products-not-released.md`, which kept the
minimal products as unpublished build targets. That record in turn had
superseded `docs/decisions/2026-09-15-no-minimal-products.md`, which removed
them; this decision returns to removal, now with the composition test in place
of the product.

## Rationale

A minimal product doubled the build and the artifacts of every board while its
coverage — a root with no feature selected — is a composition question, not a
product a user installs. Keeping it unpublished kept the cost without the
benefit: it still had to build, verify and stay correct in every rule and test
that enumerated products.

## Removal condition

Revisited if a product with no features ever becomes something a user
installs, rather than a property of the composition.
