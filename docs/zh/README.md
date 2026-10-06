# Mica OS 中文文档

> [English](../README.md) | 中文

Mica OS（云母）是面向工业设备的嵌入式 Linux 操作系统。本目录维护中文指南，结构与英文一致；
工程契约只有英文版，见 [英文文档目录](../README.md)。包名、二进制名、服务名、
总线名和路径使用 `mica` 前缀（例如 `micad`、`mica-deploy`、`/mica/config`），文中按原样引用。

- [`architecture.md`](../architecture.md) — 系统架构总览与组件地图（从这里开始，英文）
- [板卡状态表](../hardware/README.md#current-boards) — 各板卡的构建、验收与支持层级（权威，英文）
- `start/` — 入门：它是什么、怎么拿到镜像、怎么启动
  - [`overview.md`](start/overview.md) — 一页读懂：仓库、发布链、产品与文件位置
  - [`quickstart.md`](start/quickstart.md) — 快速上手：QEMU 里的 uefi-x64 基线
  - [`download.md`](start/download.md) — 发布版组成与镜像获取
  - [`flashing.md`](start/flashing.md) — 按板卡把发布镜像写进设备，以及哪些步骤尚未验证
  - [`install.md`](start/install.md) — 安装的操作顺序：从选镜像到首次启动
  - [`first-run.md`](start/first-run.md) — 首次启动、离线配置文档、认领设备
  - [`build.md`](start/build.md) — 从源码构建：在线按固定 release，离线按并排检出
- `operate/` — 运维：配置、更新、恢复、存储、API
  - [`configuration.md`](operate/configuration.md) — 配置模型与所有受支持的修改方式
  - [operate/updates.md](operate/updates.md) — A/B 更新、健康门与回滚
  - [operate/updates.md](operate/updates.md) — 该用哪个更新归档、设备如何接收它、以及每一种拒绝
  - [`recovery.md`](operate/recovery.md) — 从自动回退到整盘重刷的恢复阶梯
  - [`storage.md`](operate/storage.md) — 分区、DATA 命名空间与数据归属规则
  - [`troubleshooting.md`](operate/troubleshooting.md) — 诊断顺序：访问、识别、证据
  - [`api.md`](operate/api.md) — 管理 API：一份机器可读契约
- `integrate/` — 集成：在它上面做产品
  - [`applications.md`](integrate/applications.md) — 原生软件包与容器两条交付路径
  - [`manufacturing.md`](integrate/manufacturing.md) — 批量装机：谁生成身份与首个凭据、工厂记录、失败与重复配置的隔离
- `hardware/` — 支持的硬件：按板卡讲清现状、刷机、更新与恢复
  - [`README.md`](hardware/README.md) — 板卡一览、现状快照与选板指引
  - [`uefi-x64.md`](hardware/uefi-x64.md) — 通用 amd64 UEFI 机器
  - [`uefi-arm64.md`](hardware/uefi-arm64.md) — 通用 arm64 UEFI 机器
  - [`cx3576.md`](hardware/cx3576.md) — CX3576-Z / Rockchip RK3576
  - [`s905x5m.md`](hardware/s905x5m.md) — BM201 / Amlogic S905X5M
  - [`mini-x64.md`](hardware/mini-x64.md) — 带 128 MB 闪存的小型 amd64 UEFI 机器
- `security/` — 安全
  - [`overview.md`](security/overview.md) — 安全姿态与点名的缺口
- `releases/` — 发布：如何标识、制作、分发与支持
  - [`release-notes.md`](releases/release-notes.md) — 发布版标识与发布说明政策
  - [`how-releases-work.md`](releases/how-releases-work.md) — release 如何切、携带什么、什么决定重建
  - [`support.md`](releases/support.md) — 支持层级与生命周期归属
- [`contributing.md`](contributing.md) — 文档契约（读者、真实状态分类法、中英规则）
- `reference/` — 应要求以中文维护的设计简报
  - [`built-in-ui-design.md`](reference/built-in-ui-design.md) — 面向产品/UI 设计师的内置 UI 功能、页面、流程、状态与原型指南

## 与英文文档的关系

英文文档是**权威**。两边冲突时以英文为准，中文这边按缺陷处理。

## 覆盖表

按 [`contributing.md`](contributing.md) 第 4 节的规则，下表为 `docs/start/`、`docs/operate/`、
`docs/integrate/`、`docs/hardware/`、`docs/security/`、`docs/releases/` 和 `docs/website/` 下的
每一个英文页面各记录一行：源页面（相对本目录的路径）、翻译所依据的源版本（git 短提交号）、
以及覆盖状态（`current` | `lagging` | `not-translated`）。`tools/docs/verify-coverage.sh`
（挂在 `make docs-verify` 上）保证这张表与两边的文件树一致。

`docs/website/`、板卡页模板与认证规则页标记 `not-translated`，这是政策而非欠账：
它们面向集成商与工程读者，英文是其工作语言。

| 源页面 | 源版本 | 覆盖状态 |
|---|---|---|
| `../start/build.md` | 0828217 | current |
| `../start/download.md` | 0828217 | current |
| `../start/first-run.md` | 0828217 | current |
| `../start/flashing.md` | 0828217 | current |
| `../start/install.md` | 0828217 | current |
| `../start/overview.md` | 0828217 | current |
| `../start/quickstart.md` | 0828217 | current |
| `../operate/api.md` | 0828217 | current |
| `../operate/configuration.md` | 0828217 | current |
| `../operate/recovery.md` | 0828217 | current |
| `../operate/storage.md` | 0828217 | current |
| `../operate/troubleshooting.md` | 0828217 | current |
| `../operate/updates.md` | 0828217 | current |
| `../integrate/applications.md` | 0828217 | current |
| `../integrate/bus.md` | e03fc20 | not-translated |
| `../integrate/console.md` | e03fc20 | not-translated |
| `../integrate/containers.md` | e03fc20 | not-translated |
| `../integrate/display.md` | e03fc20 | not-translated |
| `../integrate/managed-applications.md` | e03fc20 | not-translated |
| `../integrate/manufacturing.md` | 0828217 | current |
| `../integrate/native-applications.md` | e03fc20 | not-translated |
| `../integrate/provisioning.md` | e03fc20 | not-translated |
| `../hardware/README.md` | 0828217 | current |
| `../hardware/assurance.md` | e03fc20 | not-translated |
| `../hardware/cx3576.md` | 0828217 | current |
| `../hardware/board-template.md` | fab0106 | not-translated |
| `../hardware/mini-x64.md` | 0828217 | current |
| `../hardware/qualification.md` | e03fc20 | not-translated |
| `../hardware/s905x5m.md` | 0828217 | current |
| `../hardware/uefi-arm64.md` | 0828217 | current |
| `../hardware/uefi-x64.md` | 0828217 | current |
| `../security/lifecycle.md` | e03fc20 | not-translated |
| `../security/model.md` | e03fc20 | not-translated |
| `../security/overview.md` | 0828217 | current |
| `../security/signing.md` | e03fc20 | not-translated |
| `../releases/how-releases-work.md` | 0828217 | current |
| `../releases/release-notes.md` | 0828217 | current |
| `../releases/support.md` | 0828217 | current |
| `../website/contract.md` | e03fc20 | not-translated |
| `../website/documentation.md` | e03fc20 | not-translated |
| `../website/downloads.md` | e03fc20 | not-translated |
| `../website/embedded.md` | e03fc20 | not-translated |
| `../website/hardware.md` | e03fc20 | not-translated |
| `../website/licensing.md` | e03fc20 | not-translated |
| `../website/product.md` | e03fc20 | not-translated |
| `../website/security.md` | e03fc20 | not-translated |
| `../website/support.md` | e03fc20 | not-translated |

## 文档不解释代码

这些文档描述**设计与行为**，不引用代码行号，也不逐句注解实现——被行号绑住的文档，
会被那些并未改变设计的编辑证伪。需要精确契约时，直接指向承载它的产物：HTTP 接口面
由 `mica-core:crates/mica-apid/openapi.json` 规定，CI 保证它与实际运行的二进制一致。
