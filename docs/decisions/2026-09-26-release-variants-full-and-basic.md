# Development builds leave the release; the released variants are full and basic

- **date**: 2026-09-26
- **kind**: engineering decision
- **owner**: the `mica-build` owner (the product set, the release plan, CI's release rehearsal); `mica` records it
- **review sunset**: 2027-03-26
- **status**: accepted as the direction, **not implemented** (user, 2026-09-26: "我们删除所有的dev发布，dev后续修改为本地构建，不进入发布通道，后续的发布通道修改为full 和basic，默认的full包含所有功能，basic可以不包含类似podman之类的，当前先不做更改"; recorded on the user's instruction "写进去"). Nothing changes until the user asks for it. It will supersede the product half of `docs/decisions/2026-09-15-release-images-and-products.md` then.

## Decision

- **No development build is released.** The `dev` profile stays, and it is built locally and in CI.
  No scoped release carries a `<board>-dev` product, and no Mica version index names one. The
  published `*-dev` assets are deleted. Deleting published releases in this phase is allowed by
  `docs/decisions/2026-09-20-development-phase-release-deletion.md`.
- **What a board releases is two variants.**
  - **full** is the default and carries every feature the board supports.
  - **basic** leaves out the heavy optional features, the container engine (podman) first among
    them.

## What stands until it is implemented

- Today a release-target board publishes `<board>-dev` and `<board>-prod`
  (`docs/decisions/2026-09-15-release-images-and-products.md`).
- CI's release rehearsal builds the prod products.
- The next scoped release, waiting on `mica-core`'s boot-policy release (`db3500b`), would publish
  under that scheme. It is cut under that scheme only if the user does not first ask for this change.

## Open when it is implemented

1. **The names.** `<board>-full` and `<board>-basic` are the obvious products. Is `full` the
   renamed `<board>-prod`, or a new product beside it?
2. **Profile against variant.** Are full and basic both `prod`-profile builds? The dev/prod profile
   and the full/basic feature set are two separate axes; the decision fixes only that `dev` is not
   released.
3. **"Channel".** The word is also the update channel the release gate enforces (development,
   candidate, stable, `docs/decisions/2026-09-15-release-images-and-products.md`). This record reads
   the user's 发布通道 as *what is released*, the variants. It does not touch the update channels.
4. **Basic's exact feature set.** "Things like podman" is the rule. The feature list per board, and
   whether basic also takes the small-flash packing, are open. The small-flash packing is the declared
   reserves, the FAT16 ESP and the xz root that `mica-build`'s `mini-boards` branch added for
   `docs/plan/20260926-0930-mini-images-on-128-mb.md`.
5. **The published dev assets.** Are they deleted from past releases, or only left out from the
   next release on?

## Rationale

A release is what a device runs. A development build carries development-grade material and exists
to be built and inspected, and publishing it beside the production image doubled every board's
release for a variant nobody installs. The container engine is 35% of a full root (62 of 177 MiB
composed, measured 2026-09-26), so a variant without it is the one real choice a device owner makes
between feature and footprint.

## Removal condition

Revisited if a development build is ever needed by a consumer outside this workspace, or if a third
variant is asked for.
