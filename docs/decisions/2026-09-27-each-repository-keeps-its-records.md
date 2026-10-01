# Each repository keeps its own development records; mica holds the product documentation

- **date**: 2026-09-27, amended 2026-10-01
- **kind**: working practice
- **owner**: every repository; `mica` records it
- **review sunset**: 2027-03-27
- **status**: accepted (user, 2026-09-27: "不需要每个项目开发文档都在mica 每个项目保留自己的 mica是全局约定和公开文档"; amended 2026-10-01: "mica仓库不负责管理全局的项目规划和任务了，只负责产品层面的东西")

## Decision

- **A repository's development documentation lives in that repository**: its task, plan and
  changelog records, its module design and its decisions, under its own `docs/`. A code change
  lands together with its record in the same repository. Work that spans repositories is
  tracked in each repository it changes.
- **`mica` holds the product, and nothing else**: what Mica OS is and how its parts fit
  together, the user and integrator documentation, the supported hardware and its assurance,
  the design contracts of the product's behaviour on a device, the product decisions, and the
  website briefs. It keeps no task, plan or changelog records.
- **The engineering rules live with their implementation**: the release lock, its vectors, the
  package versions and the build rules in `mica-build-tools`; the board contract, porting and
  the image build in `mica-build`.

## What this supersedes

- `mica`'s `docs/task/`, `docs/plan/` and `docs/changelog.md`, the build-engineering designs
  (`build.md`, `build-harness.md`, `release-artifacts.md`, `key-delivery.md`), the board
  engineering pages (contract, porting, intake, `board.env`, the board template, the cx3576
  bench and BSP-sync notes), the research notes, and the engineering decisions owned by other
  repositories. They are in this repository's history before the change that removed them.

## Removal condition

Revisit if a repository's records cannot be followed without the coordination they used to get
from being in one place.
