# Mica OS - Plan Index

> Updated: 2026-09-12

## Usage

Each plan is a single line linking to its detail file. All detailed information lives in `docs/plan/<timestamp>-<feature-slug>.md`.

### Format

A row looks like this. It is a specimen, not a plan: fenced for the same
reason as the one in `docs/task/index.md`, so that a mechanical read of this
file cannot take it for an open row.

```text
- [ ] [**20260907-1440-add-endpoint Add endpoint**](20260907-1440-add-endpoint.md) `YYYY-MM-DD`
```

### Status Markers

| Marker | Meaning |
|--------|---------|
| `[ ]`  | Draft / Pending review |
| `[-]`  | Approved / Implementing |
| `[x]`  | Completed |
| `[~]`  | Rejected / Abandoned |
| `[d]`  | Deleted detail file; index entry retained |

### Rules

- Only update the checkbox marker; never delete the line or change its other content. If the detail file is deleted, mark the entry `[d]`.
- Record change history and deletion reasons in `docs/changelog.md`; update affected task and plan references.
- New plans append to the end.
- See each `<timestamp>-<feature-slug>.md` for full details, except `[d]` entries whose files have been deleted; consult `docs/changelog.md` for their history.

---

## Plans

- [d] [**PLAN-037 Coordinate the embedded delivery roadmap**](PLAN-037.md) `2026-08-31`
- [d] [**PLAN-054 Design conditional fleet management**](PLAN-054.md) `2026-09-01`
- [d] [**PLAN-069 Design managed and untrusted application controls**](PLAN-069.md) `2026-09-03`
- [d] [**PLAN-070 Design the meta/ seam and the /mica/config/ system-configuration namespace**](PLAN-070.md) `2026-09-03`
- [d] [**PLAN-071 Design the update module: off/check/auto with automatic install in a window**](PLAN-071.md) `2026-09-03`
- [d] [**PLAN-072 Design cloud registration: outbound-only, off by default**](PLAN-072.md) `2026-09-03`
- [d] [**PLAN-076 Design device state reporting to the fleet plane**](PLAN-076.md) `2026-09-03`
- [d] [**PLAN-077 Gate A: trust is real -- the anchor, the grade and the rotation decision**](PLAN-077.md) `2026-09-04`
- [d] [**PLAN-086 Compose a minimal Mica OS runtime from explicit payloads**](PLAN-086.md) `2026-09-06`
- [ ] [**PLAN-912 Validate s905x5m Bluetooth peer interaction**](PLAN-912.md) `2026-08-31`
- [ ] [**20260910-0029-cx3576-boot-log-cleanup Repair cx3576 boot configuration and qualify the current image**](20260910-0029-cx3576-boot-log-cleanup.md) `2026-09-10`
- [-] [**20260910-1206-b3-bounded-exitrd-teardown B3 bounded exitrd teardown**](20260910-1206-b3-bounded-exitrd-teardown.md) `2026-09-10`
- [x] [**20260910-1910-fleet-device-plane-protocol Fleet device-to-plane protocol**](20260910-1910-fleet-device-plane-protocol.md) `2026-09-10`
- [-] [**20260911-1927-boot-artifact-size Shrink the signed boot artifact: compression and early-userspace closure**](20260911-1927-boot-artifact-size.md) `2026-09-11`
- [x] [**20260911-2006-split-package-repositories Split the tree into an assembly repository and independently released package repositories**](20260911-2006-split-package-repositories.md) `2026-09-11`
- [x] [**20260912-1329-arm64-board-builds ARM64, CX3576 and S905X5M builds**](20260912-1329-arm64-board-builds.md) `2026-09-12`
- [ ] [**20260912-1347-root-closure-reduction Reduce the read-only root closure**](20260912-1347-root-closure-reduction.md) `2026-09-12`
- [ ] [**20260912-2043-unify-board-behavior Unify board build, compression and acceptance behavior**](20260912-2043-unify-board-behavior.md) `2026-09-12`
- [ ] [**20260912-2236-phase1-findings Fix the defects the lock proof build surfaced**](20260912-2236-phase1-findings.md) `2026-09-12`
- [x] [**20260912-2049-docs-restructure Restructure the documentation system**](20260912-2049-docs-restructure.md) `2026-09-12`
- [ ] [**20260912-2253-rockchip-update-image Produce a Rockchip update.img for CX3576**](20260912-2253-rockchip-update-image.md) `2026-09-12`
- [x] [**20260913-1600-split-boot-and-boards Split the boot tooling and every board out of the assembly**](20260913-1600-split-boot-and-boards.md) `2026-09-13`
- [-] [**20260913-0409-bun-from-build-base Run bun from mica-build-base instead of IMAGE_BUN_1**](20260913-0409-bun-from-build-base.md) `2026-09-13`
- [-] [**20260913-0416-board-product-build-architecture Define the board/profile/product build architecture for the assembly**](20260913-0416-board-product-build-architecture.md) `2026-09-13`
- [-] [**20260913-1730-board-repository-layout A board is a data directory: the layout of mica-boards**](20260913-1730-board-repository-layout.md) `2026-09-13`
- [x] [**20260914-0021-workspace-agents-file Keep agent instructions only in the workspace AGENTS.md**](20260914-0021-workspace-agents-file.md) `2026-09-14`
- [-] [**20260914-0503-retire-mica-boot Split mica-boot into Base, boards and build, then retire it**](20260914-0503-retire-mica-boot.md) `2026-09-14`
- [-] [**20260914-0558-mica-build-released-inputs mica-build: adopt the released inputs and the workspace rules**](20260914-0558-mica-build-released-inputs.md) `2026-09-14`
- [-] [**20260914-2042-release-lock-offline-build Move every repository to the release lock format and build the chain offline**](20260914-2042-release-lock-offline-build.md) `2026-09-14`
- [-] [**20260915-0318-docs-multi-repo-ownership Restate the documentation system for seven repositories**](20260915-0318-docs-multi-repo-ownership.md) `2026-09-15`
- [x] [**20260917-1033-zh-hardware-list Chinese hardware list and current-state guide per board**](20260917-1033-zh-hardware-list.md) `2026-09-17`
- [x] [**20260920-0610-producer-data-assets Where a producer publishes data about its own output**](20260920-0610-producer-data-assets.md) `2026-09-20`
- [x] [**20260920-0700-hardware-pages-in-english Publish the hardware list: English pages and an allowlist that can name them**](20260920-0700-hardware-pages-in-english.md) `2026-09-20`
- [ ] [**20260922-0817-one-language-one-layout One language and one layout for the mica-build engine**](20260922-0817-one-language-one-layout.md) `2026-09-22`
- [-] [**20260921-1142-merge-boards-into-build Merge mica-boards into mica-build so a board owns its image**](20260921-1142-merge-boards-into-build.md) `2026-09-21`
- [x] [**20260921-1217-remove-update-server Remove the update server from mica-build**](20260921-1217-remove-update-server.md) `2026-09-21`
- [ ] [**20260914-0514-workspace-rules-and-build-env Bring mica-boards to the workspace rules and the released build-env**](20260914-0514-workspace-rules-and-build-env.md) `2026-09-21`
- [ ] [**20260920-0627-kernel-capabilities-beside-each-board The floor, made legible to another repository**](20260920-0627-kernel-capabilities-beside-each-board.md) `2026-09-21`
- [ ] [**20260920-0730-the-boot-logo-on-every-board-that-can-draw Adding the boot logo, and what it costs per board**](20260920-0730-the-boot-logo-on-every-board-that-can-draw.md) `2026-09-21`
