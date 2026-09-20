# Mica OS - Task List

> Updated: 2026-09-12

## Usage

Each task is a single line linking to its detail file. All detailed information lives in `docs/task/<timestamp>-<feature-slug>.md`.

### Format

A row looks like this. It is a specimen, not a task: it is fenced so that it
cannot be read — by a person or by a tool — as an open P1 at the top of the
index, which is how it was read in the workspace audit of 2026-09-19.

```text
- [ ] [**20260907-1428-add-endpoint Add endpoint**](20260907-1428-add-endpoint.md) `P1`
```

### Status Markers

| Marker | Meaning |
|--------|---------|
| `[ ]`  | Pending |
| `[-]`  | In progress |
| `[x]`  | Completed |
| `[~]`  | Closed / Won't do |
| `[d]`  | Deleted detail file; index entry retained |

### Priority: P0 (blocking) > P1 (high) > P2 (medium) > P3 (low)

### Rules

- Only update the checkbox marker; never delete the line or change its other content. If the detail file is deleted, mark the entry `[d]`.
- Record change history and deletion reasons in `docs/changelog.md`; update affected dependency and plan references.
- New tasks append to the end.
- See each `<timestamp>-<feature-slug>.md` for full details, except `[d]` entries whose files have been deleted; consult `docs/changelog.md` for their history.

---

## Tasks

- [d] [**RFCT-290 Design conditional fleet management**](RFCT-290.md) `P2`
- [d] [**RFCT-305 Gate A mechanisms: the trust grade, the device surface and the publication refusal**](RFCT-305.md) `P1`
- [d] [**RFCT-310 The host toolchain lint and the container-only build policy**](RFCT-310.md) `P1`
- [d] [**RFCT-315 PLAN-070 F7/F8/F9: the client reads the baked anchor**](RFCT-315.md) `P1`
- [d] [**UI-011 Stabilize Bun V8 coverage aggregation**](UI-011.md) `P1`
- [d] [**RFCT-336 Compose a minimal Mica OS runtime from explicit payloads**](RFCT-336.md) `P1`
- [ ] [**RFCT-922 Exercise s905x5m Bluetooth pairing and a profile with a controlled peer**](RFCT-922.md) `P1`
- [d] [**RFCT-941 The installer reinstalls on every boot because its receipt never persists**](RFCT-941.md) `P1`
- [ ] [**20260908-2011-state-units-never-load STATE-seeded systemd units never load on first boot**](20260908-2011-state-units-never-load.md) `P2`
- [ ] [**20260908-2011-ssh-generator-vs-image-policy systemd-ssh-generator overrides the image's SSH policy and port**](20260908-2011-ssh-generator-vs-image-policy.md) `P2`
- [ ] [**20260908-2011-wtmp-unbounded-append Login accounting appends to /var/log/wtmp without a bound**](20260908-2011-wtmp-unbounded-append.md) `P2`
- [-] [**20260910-0025-cx3576-boot-log-cleanup Resolve cx3576 boot configuration mismatches and verify runtime handoff**](20260910-0025-cx3576-boot-log-cleanup.md) `P1`
- [ ] [**20260910-0117-cx3576-late-hdmi-logo Restore the CX3576 boot logo after late HDMI attachment**](20260910-0117-cx3576-late-hdmi-logo.md) `P2`
- [-] [**20260910-1206-b3-bounded-exitrd-teardown B3 bounded exitrd teardown**](20260910-1206-b3-bounded-exitrd-teardown.md) `P1`
- [-] [**20260911-1925-boot-artifact-size Shrink the signed boot artifact: compression and early-userspace closure**](20260911-1925-boot-artifact-size.md) `P1`
- [x] [**20260911-2003-split-package-repositories Split the tree into an assembly repository and independently released package repositories**](20260911-2003-split-package-repositories.md) `P1`
- [x] [**20260912-1329-arm64-board-builds ARM64, CX3576 and S905X5M builds**](20260912-1329-arm64-board-builds.md) `P1`
- [x] [**20260912-1341-prune-settled-records Prune the settled plan and task records**](20260912-1341-prune-settled-records.md) `P2`
- [-] [**20260912-1347-root-closure-reduction Reduce the read-only root closure**](20260912-1347-root-closure-reduction.md) `P2`
- [-] [**20260912-2043-unify-board-behavior Unify board build, compression and acceptance behavior**](20260912-2043-unify-board-behavior.md) `P1`
- [ ] [**20260912-2236-phase1-findings Fix the defects the lock proof build surfaced**](20260912-2236-phase1-findings.md) `P2`
- [x] [**20260912-2049-docs-restructure Restructure the documentation system**](20260912-2049-docs-restructure.md) `P1`
- [ ] [**20260912-2058-fleet-runtime Implement the fleet registration and reporting runtime**](20260912-2058-fleet-runtime.md) `P2`
- [ ] [**20260912-2058-production-key-custody Establish production signing key custody**](20260912-2058-production-key-custody.md) `P2`
- [ ] [**20260912-2058-auto-update-acceptance Accept automatic update scheduling scenarios**](20260912-2058-auto-update-acceptance.md) `P3`
- [ ] [**20260912-2058-fit-sandbox-job-limit Remove the fixed make job count from the FIT sandbox build**](20260912-2058-fit-sandbox-job-limit.md) `P3`
- [ ] [**20260912-2058-wifi-no-radio-reconcile Wi-Fi reconcilers fail on images without a radio**](20260912-2058-wifi-no-radio-reconcile.md) `P2`
- [ ] [**20260912-2058-managed-applications Implement managed applications**](20260912-2058-managed-applications.md) `P3`
- [ ] [**20260912-2125-source-record-citations Replace deleted record citations in source comments**](20260912-2125-source-record-citations.md) `P3`
- [ ] [**20260912-2125-api-slot-vocabulary Remove slot-era vocabulary from the update API contract**](20260912-2125-api-slot-vocabulary.md) `P3`
- [ ] [**20260912-2251-rockchip-update-image Produce a Rockchip update.img for CX3576**](20260912-2251-rockchip-update-image.md) `P1`
- [x] [**20260913-1600-split-boot-and-boards Split the boot tooling and every board out of the assembly**](20260913-1600-split-boot-and-boards.md) `P1`
- [-] [**20260913-0409-bun-from-build-base Run bun from mica-build-base instead of IMAGE_BUN_1**](20260913-0409-bun-from-build-base.md) `P2`
- [-] [**20260913-0416-board-product-build-architecture Define the board/profile/product build architecture for the assembly**](20260913-0416-board-product-build-architecture.md) `P1`
- [ ] [**20260913-0440-micad-product-defaults Product defaults layer, validator CLI and a bluetooth section in micad**](20260913-0440-micad-product-defaults.md) `P2`
- [ ] [**20260913-0755-s905x5m-build-determinism The s905x5m kernel Image and U-Boot are not byte-reproducible**](20260913-0755-s905x5m-build-determinism.md) `P3`
- [x] [**20260913-1700-registry-migration Move the pinned artifacts to GHCR and bump every consumer**](20260913-1700-registry-migration.md) `P1`
- [x] [**20260913-1730-board-repository-layout A board is a data directory: the layout of mica-boards**](20260913-1730-board-repository-layout.md) `P1`
- [ ] [**20260913-1735-lifecycle-uefi-micad-config-mount micad refuses to start on the lifecycle suite's acceptance disk: /mica is not mounted**](20260913-1735-lifecycle-uefi-micad-config-mount.md) `P2`
- [x] [**20260914-0021-workspace-agents-file Keep agent instructions only in the workspace AGENTS.md**](20260914-0021-workspace-agents-file.md) `P2`
- [-] [**20260914-0503-retire-mica-boot Split mica-boot into Base, boards and build, then retire it**](20260914-0503-retire-mica-boot.md) `P1`
- [-] [**20260914-0558-mica-build-released-inputs mica-build: adopt the released inputs and the workspace rules**](20260914-0558-mica-build-released-inputs.md) `P1`
- [-] [**20260914-2042-release-lock-offline-build Move every repository to the release lock format and build the chain offline**](20260914-2042-release-lock-offline-build.md) `P1`
- [-] [**20260915-0316-docs-multi-repo-ownership Restate the documentation system for seven repositories**](20260915-0316-docs-multi-repo-ownership.md) `P1`
- [-] [**20260915-2327-product-guides Complete the product documentation: overview, build, porting, flashing, updates and releasing**](20260915-2327-product-guides.md) `P1`
- [-] [**20260916-0040-uefi-board-names Rename the generic systems to uefi-x64 and uefi-arm64**](20260916-0040-uefi-board-names.md) `P1`
- [x] [**20260916-0900-emulated-arm64-bytes Identify what differs inside an emulated arm64 archive**](20260916-0900-emulated-arm64-bytes.md) `P3`
- [x] [**20260916-1653-root-only-archive The root-only update archive, first exercised on real releases**](20260916-1653-root-only-archive.md) `P1`
- [-] [**20260917-1033-zh-hardware-list Chinese hardware list and current-state guide per board**](20260917-1033-zh-hardware-list.md) `P2`
