# The minimal products are removed

- **date**: 2026-09-16
- **kind**: engineering decision
- **owner**: the `mica-build` owner (the product set, the rules and tests that named a minimal product); `mica` records it
- **review sunset**: 2027-03-16
- **status**: accepted (user, 2026-09-16: "不需要minimal这个，所有的都不发布这个"); supersedes `2026-09-15-minimal-products-not-released` (a record deleted 2026-09-26); implemented by `mica-build` in the rename round of `docs/task/20260916-0040-uefi-board-names.md`

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
- The `PUBLISH` machinery goes too, settled on 2026-09-16: `PUBLISH=0`
  appeared only on the four minimal products, nothing else set it, and
  `s905x5m-dev` is unpublished through its board's `BOARD_RELEASE_TARGET=0`.
  The key, its default in `tools/product.sh`, the release scope filter and
  their tests are removed. Its one consumer, the `publish` field of the index
  catalogue, is redefined as "the product's board is a release target", which
  reproduces today's output exactly (`docs/design/mica-index.md` 3.1). Keeping
  `PUBLISH` as a documented key no product sets was the alternative and was
  rejected.
- The coverage minimal gave — that the floor composes with no feature selected
  — stays as a cheap composition test, not as a product (agreed 2026-09-15).
- CI's release rehearsal runs the prod products and is unaffected.
- Releases published before today keep their minimal assets. They are history
  and are not rewritten.

## What this supersedes

`2026-09-15-minimal-products-not-released` (a record deleted 2026-09-26), which kept the
minimal products as unpublished build targets. That record in turn had
superseded `2026-09-15-no-minimal-products` (a record deleted 2026-09-26), which removed
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
