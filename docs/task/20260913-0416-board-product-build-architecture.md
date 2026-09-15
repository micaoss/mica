# 20260913-0416-board-product-build-architecture Define the board/profile/product build architecture for the assembly

- **status**: in_progress
- **priority**: P1
- **owner**: worker/arch-20260913-0416
- **createdAt**: 2026-09-13 04:16

## Description

Requested 2026-09-13: the assembly still composes and builds every board as
one mixed tree rather than assembling independent parts, and it will not
scale to the 10-20 boards planned. Define a build architecture, compared
against the industry OS frameworks (Yocto, Buildroot, mkosi/debos, Ubuntu
Core, Android), under which a board is a self-contained input, an image is a
declared recipe, and the assembly builds only the closure of the product it
is asked for -- including a minimal image per board. The plan is
`20260913-0416-board-product-build-architecture`.

Acceptance: a new board is added to the assembly by one pin and one product
recipe with no code edit; `make product-<name>` fetches, composes, signs and
verifies that product alone; a lint refuses a board name literal in the
assembly's build, verify and rootfs code; every board has a minimal product.

## ActiveForm

Proposing the board/profile/product build architecture.

## Dependencies

- **blocked by**: 20260913-1600-split-boot-and-boards (the boards must be imported archives before their manifests can travel with them); 20260913-0440-micad-product-defaults (work package 2.2's composition of `defaults.toml` only)
- **blocks**: (none)

## Notes

2026-09-13 08:30: phase 1 (work packages 1.1-1.4) landed; see the plan's
annotations.

2026-09-13 10:30: phase 2 (products, 2.1-2.4) landed.

2026-09-13 11:40: phase 3 (board facts, the board-name lint) landed.

2026-09-13 13:30: phase 4 (`make product`, the scoped fetch, the CI matrix,
the product-scoped verifier) landed; phase 5 (tests, the board template,
the onboarding dry run) is in progress.

2026-09-13 09:48: phase 5 (the suites keyed by product, `new-board.sh`,
board discovery, the virtual `mica-board`, the `mica-board-*` consumer
family, the onboarding dry run) landed; see the plan's annotations. Phase 6
(OCI on GHCR) is next.

2026-09-13 17:04: phases 6 (the OCI registry backend, the board bundle and
product root artifacts) and 7 (the coupling phase 5 left) landed in code,
proven against a local registry; the push to GHCR and every consumer's
bump wait on `20260913-1700-registry-migration` (a token with the packages
scopes). See the plan's annotations.

2026-09-13 04:35: the plan is approved on the condition that implementation
starts when the split lands; contracts C1-C6 and the work packages are the
implementation order.

Investigation base: `mica-build` at `b97a20bf` (the worktree that imports
`mica-boards`), `mica-boards` at `047c5a6`, `mica-boot` at `e702216`.
