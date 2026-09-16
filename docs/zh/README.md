# Mica OS 中文文档

> [English](../README.md) | 中文

Mica OS（云母）是面向工业设备的嵌入式 Linux 操作系统。本目录维护中文用户指南；
工程契约只有英文版，见 [英文文档目录](../README.md)。包名、二进制名、服务名、
总线名和路径使用 `mica` 前缀（例如 `micad`、`mica-deploy`、`/mica/config`），文中按原样引用。

- [`architecture.md`](../architecture.md) — 系统架构总览与组件地图（从这里开始）
- [板卡状态表](../boards/support-tiers.md#current-boards) — 各板卡的构建、验收与支持层级
- `user/` — 用户文档（覆盖全部 21 篇，含文档契约本身）
  - [`overview.md`](user/overview.md) — 一页读懂：七个仓库、发布链、产品与文件位置
  - [`quickstart.md`](user/quickstart.md) — 快速上手：QEMU 里的 x64 基线
  - [`download.md`](user/download.md) — 发布版组成与镜像获取
  - [`install.md`](user/install.md) — 安装的操作顺序：从选镜像到首次启动
  - [`build.md`](user/build.md) — 从源码构建：在线按固定 release，离线按并排检出
  - [`flashing.md`](user/flashing.md) — 按板卡把发布镜像写进设备，以及哪些步骤尚未验证
  - [`first-run.md`](user/first-run.md) — 首次启动、离线配置文档、认领设备
  - [`manufacturing.md`](user/manufacturing.md) — 批量装机：谁生成身份与首个凭据、工厂记录、失败与重复配置的隔离
  - [`configuration.md`](user/configuration.md) — 配置模型与所有受支持的修改方式
  - [`applications.md`](user/applications.md) — 原生软件包与容器两条交付路径
  - [`update-rollback.md`](user/update-rollback.md) — A/B 更新、健康门与回滚
  - [`update-packages.md`](user/update-packages.md) — 该用哪个更新归档、设备如何接收它、以及每一种拒绝
  - [`recovery.md`](user/recovery.md) — 从自动回退到整盘重刷的恢复阶梯
  - [`storage.md`](user/storage.md) — 分区、DATA 命名空间与数据归属规则
  - [`troubleshooting.md`](user/troubleshooting.md) — 诊断顺序：访问、识别、证据
  - [`security.md`](user/security.md) — 安全姿态与点名的缺口
  - [`release-notes.md`](user/release-notes.md) — 发布版标识与发布说明政策
  - [`api.md`](user/api.md) — 管理 API：一份机器可读契约
  - [`support.md`](user/support.md) — 支持层级与生命周期归属
  - [`releasing.md`](user/releasing.md) — 面向维护者：release 如何切、携带什么、什么决定重建
  - [`doc-contract.md`](user/doc-contract.md) — 用户文档契约（读者、真实状态分类法、中英规则）
- `design/` — 应要求以中文维护的设计简报
  - [`built-in-ui-design.md`](design/built-in-ui-design.md) — 面向产品/UI 设计师的内置 UI 功能、页面、流程、状态与原型指南

## 与英文文档的关系

英文文档是**权威**。两边冲突时以英文为准，中文这边按缺陷处理。

## 覆盖表

按 [`user/doc-contract.md`](user/doc-contract.md) 第 5 节的规则，下表为
`docs/user/`、`docs/website/` 和 `docs/boards/` 下的每一个英文页面各记录一行：
源页面（相对本目录的路径）、翻译所依据的源版本（git 短提交号）、以及覆盖
状态（`current` | `lagging` | `not-translated`）。`tools/docs/verify-coverage.sh`
（挂在 `make docs-verify` 上）保证这张表与两边的文件树一致。

`docs/website/` 与 `docs/boards/` 整树标记 `not-translated`，这是政策而非
欠账：两者面向集成商与工程读者，英文是其工作语言。

| 源页面 | 源版本 | 覆盖状态 |
|---|---|---|
| `../user/build.md` | 7c16661c | current |
| `../user/flashing.md` | 97fbfcbc | current |
| `../user/update-packages.md` | e707e9e3 | current |
| `../user/releasing.md` | a64cc853 | current |
| `../user/overview.md` | 586e013c | current |
| `../user/api.md` | db66fc02 | current |
| `../user/applications.md` | 965de492 | current |
| `../user/configuration.md` | 88db4ae9 | current |
| `../user/doc-contract.md` | 00a5147d | current |
| `../user/download.md` | 1906d17d | current |
| `../user/first-run.md` | bb4864ef | current |
| `../user/install.md` | 534f170e | current |
| `../user/manufacturing.md` | 00a5147d | current |
| `../user/quickstart.md` | 6cc6e739 | current |
| `../user/recovery.md` | 88db4ae9 | current |
| `../user/release-notes.md` | 00a5147d | current |
| `../user/security.md` | d4ca7946 | current |
| `../user/storage.md` | 00a5147d | current |
| `../user/support.md` | 00a5147d | current |
| `../user/troubleshooting.md` | 50b85a5e | current |
| `../user/update-rollback.md` | 88db4ae9 | current |
| `../website/contract.md` | db66fc02 | not-translated |
| `../website/documentation.md` | db66fc02 | not-translated |
| `../website/downloads.md` | db66fc02 | not-translated |
| `../website/embedded.md` | db66fc02 | not-translated |
| `../website/hardware.md` | db66fc02 | not-translated |
| `../website/licensing.md` | db66fc02 | not-translated |
| `../website/product.md` | db66fc02 | not-translated |
| `../website/security.md` | db66fc02 | not-translated |
| `../website/support.md` | db66fc02 | not-translated |
| `../boards/assurance.md` | db66fc02 | not-translated |
| `../boards/board-env.md` | db66fc02 | not-translated |
| `../boards/board-template.md` | db66fc02 | not-translated |
| `../boards/contract.md` | e630c76f | not-translated |
| `../boards/cx3576-bench.md` | 452289a3 | not-translated |
| `../boards/cx3576-bsp-sync.md` | e630c76f | not-translated |
| `../boards/cx3576.md` | db66fc02 | not-translated |
| `../boards/intake.md` | db66fc02 | not-translated |
| `../boards/porting.md` | db66fc02 | not-translated |
| `../boards/qualification.md` | db66fc02 | not-translated |
| `../boards/s905x5m.md` | 1d2a5e49 | not-translated |
| `../boards/support-tiers.md` | db66fc02 | not-translated |
| `../boards/uefi-arm64.md` | 2b443f42 | not-translated |

## 文档不解释代码

这些文档描述**设计与行为**，不引用代码行号，也不逐句注解实现——被行号绑住的文档，
会被那些并未改变设计的编辑证伪。需要精确契约时，直接指向承载它的产物：HTTP 接口面
由 `mica-core:apid/openapi.json` 规定，CI 保证它与实际运行的二进制一致。
