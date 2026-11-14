# Mica OS 中文文档

> [English](../README.md) | 中文

Mica OS（云母）是面向工业设备的嵌入式 Linux 操作系统。本目录维护中文指南，结构与英文一致；
工程契约只有英文版，见 [英文文档目录](../README.md)。包名、二进制名、服务名、
总线名和路径使用 `mica` 前缀（例如 `micad`、`mica-deploy`、`/mica/config`），文中按原样引用。

- [`architecture.md`](architecture.md) — 系统架构总览与组件地图（从这里开始）
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
  - [`updates.md`](operate/updates.md) — 该用哪个更新归档、在线/离线/U 盘更新、维护窗口、确认、回滚以及每一种拒绝
  - [`recovery.md`](operate/recovery.md) — 从自动回退、重置层级、出厂重置到整盘重刷的恢复阶梯
  - [`storage.md`](operate/storage.md) — 分区、DATA 命名空间、数据归属规则、自己的磁盘与外接介质
  - [`mica.md`](operate/mica.md) — `mica` 命令：设备上 root 唯一的命令、动词、输出与退出码
  - [`troubleshooting.md`](operate/troubleshooting.md) — 诊断顺序：访问、识别、证据
  - [`api.md`](operate/api.md) — 管理 API：一份机器可读契约
- `integrate/` — 集成：在它上面做产品
  - [`applications.md`](integrate/applications.md) — 原生软件包与容器两条交付路径
  - [`provisioning.md`](integrate/provisioning.md) — 首次启动的自我配置、设备生成的秘密、没有网络时的四种配置方式、配置文档的规则
  - [`console.md`](integrate/console.md) — 内置管理控制台：导航与归属、状态与交互、自定义与开发验收
  - [`bus.md`](integrate/bus.md) — 设备总线与 MQTT 应用数据契约：管理与应用的边界、Item1 接口、发现与策略、MQTT 语法、注册表
  - [`manufacturing.md`](integrate/manufacturing.md) — 批量装机：谁生成身份与首个凭据、工厂记录、失败与重复配置的隔离
- `hardware/` — 支持的硬件：按板卡讲清现状、刷机、更新与恢复
  - [`README.md`](hardware/README.md) — 板卡一览、现状快照与选板指引
  - [`uefi-x64.md`](hardware/uefi-x64.md) — 通用 amd64 UEFI 机器，以及 Compute Engine 镜像
  - [`uefi-arm64.md`](hardware/uefi-arm64.md) — 通用 arm64 UEFI 机器
  - [`cx3576.md`](hardware/cx3576.md) — CX3576-Z / Rockchip RK3576
  - [`s905x5m.md`](hardware/s905x5m.md) — BM201 / Amlogic S905X5M
  - [`mini-x64.md`](hardware/mini-x64.md) — 带 128 MB 闪存的小型 amd64 UEFI 机器
  - [`qemu-armhf.md`](hardware/qemu-armhf.md) — 带 NOR 闪存的 QEMU 32 位 Arm virt 机器
  - [`assurance.md`](hardware/assurance.md) — I1–I4 启动保证在板卡上的证据与声明的记录方式
  - [`qualification.md`](hardware/qualification.md) — 现场可靠性验收：具名版本规则、行的写法、13 行矩阵与证据标准
- `security/` — 安全
  - [`overview.md`](security/overview.md) — 安全姿态与点名的缺口
  - [`model.md`](security/model.md) — 威胁与物理接触边界、I1–I4 启动保证阶梯与诚实的限度
  - [`signing.md`](security/signing.md) — 启动、内容与元数据三个独立的信任域、归档格式、轮换与固件维护
  - [`lifecycle.md`](security/lifecycle.md) — 信任材料及其保管、角色、发布与安全响应
- `releases/` — 发布：如何标识、制作、分发与支持
  - [`release-notes.md`](releases/release-notes.md) — 发布版标识与发布说明政策
  - [`how-releases-work.md`](releases/how-releases-work.md) — release 如何切、携带什么、什么决定重建
  - [`support.md`](releases/support.md) — 支持层级与生命周期归属
- [`contributing.md`](contributing.md) — 文档契约（读者、真实状态分类法、中英规则）
- `reference/` — 设备行为的契约（工作原理），以及应要求以中文维护的设计简报
  - [`boot.md`](reference/boot.md) — 启动与 runkit：各板卡的启动链、部署与试运行、`mica-runkit init` 各阶段、core 组件、owner 密钥环、健康确认、故障与 cx3576 签名 FIT 路径
  - [`storage.md`](reference/storage.md) — 各板卡分区、SYSTEM 与 DATA 的内容、可写路径、配额、用户挂载、外接介质、容量与故障
  - [`updates.md`](reference/updates.md) — 更新引擎：一次更新如何进行、状态、获取与增量传输、安装、策略文档、重启闸门、驱动扩展与 core 集合
  - [`ro-root.md`](reference/ro-root.md) — 经认证的不可变根：squashfs 与 dm-verity、启动接线、可写路径、关机与检查
  - [`management.md`](reference/management.md) — 管理平面 micad：启动顺序、产品文件、调和器及其写入的文件、总线接口、任务、观测、生命周期与出厂重置拒绝、OpenRC 交接、登录提示
  - [`settings.md`](reference/settings.md) — 设置树：每棵子树的键、类型、默认值与限制，`/mica/config/` 下的文档，以及一次写入如何被检查和应用
  - [`http-api.md`](reference/http-api.md) — 每个 HTTP API 路由（103 个路径、134 个操作），按领域分组，由 openapi.json 生成
  - [`errors.md`](reference/errors.md) — 每个 API 错误代码的状态与含义、网络规则代码、D-Bus 错误名、更新的拒绝
  - [`files.md`](reference/files.md) — 文件地图：标识、启动状态、配置、渲染文件、数据和签名对象在哪里，以及在重启、更新、回滚或重置后是否保留
  - [`products.md`](reference/products.md) — 已发布的产品：板卡、init、特性、容器引擎、SSH 服务器、镜像、各产品设置、板卡事实
  - [`kernel-features.md`](reference/kernel-features.md) — 每个内核特性打开了什么、哪块板卡有它
  - [`glossary.md`](reference/glossary.md) — 本文档中含义固定的词
  - [`cli.md`](reference/cli.md) — `mica` 命令（core 0.0.8 及以后）：每个动词和子动词的通道、选项、输出、`--json`、退出码、秘密输入与 `mica internal`
  - [`access.md`](reference/access.md) — 访问：Web 模式、认领与登录、令牌、SSH 与串口控制台、mDNS/SSDP 发现、首次启动配置
  - [`time.md`](reference/time.md) — 时间：NTP 服务器、时区只用于展示、可信时钟底线、启动顺序与同步状态
  - [`wifi.md`](reference/wifi.md) — Wi-Fi 客户端与接入点：设置模型、两个调和器、单无线电冲突、凭据、镜像集成与已知局限
  - [`diagnostics.md`](reference/diagnostics.md) — 诊断：系统信息、观测到的网络状态、板卡遥测、支持快照与脱敏、采集流程与排障树
  - [`recovery.md`](reference/recovery.md) — 恢复与重置：故障边界、重置层级、出厂重置、物理在场、无法启动的系统与数据清除
  - [`remote.md`](reference/remote.md) — 远程管理与 API 面：今天能访问设备的是什么、更新的控制流、安全态势
  - [`manufacturing.md`](reference/manufacturing.md) — 量产与设备标识的生命周期：输入、校验、每台设备的记录、隔离与返修、端口与不可逆操作
  - [`release-lock.md`](reference/release-lock.md) — 发布锁、固定版本与离线构建：规范在 mica-build-tools 中
  - [`api.md`](reference/api.md) — 管理 API（apid）：Web 模式、监听器与 HTTPS 身份、URL 空间、本地套接字、错误封套与状态码、认领/登录/令牌示例、出厂重置、owner 证书与驱动扩展、WireGuard 对端、介质、UI 托管
  - [`built-in-ui-design.md`](reference/built-in-ui-design.md) — 面向产品/UI 设计师的内置 UI 功能、页面、流程、状态与原型指南

## 与英文文档的关系

英文文档是**权威**。两边冲突时以英文为准，中文这边按缺陷处理。

## 覆盖表

按 [`contributing.md`](contributing.md) 第 4 节的规则，下表为 `docs/start/`、`docs/operate/`、
`docs/integrate/`、`docs/hardware/`、`docs/security/`、`docs/releases/` 和 `docs/website/` 下的
每一个英文页面各记录一行：源页面（相对本目录的路径）以及覆盖状态（`current` | `lagging` | `not-translated`）。`tools/docs/verify-coverage.sh`
（挂在 `make docs-verify` 上）保证这张表与两边的文件树一致。

`docs/website/`、板卡页模板与认证规则页标记 `not-translated`，这是政策而非欠账：
它们面向集成商与工程读者，英文是其工作语言。

| 源页面 | 覆盖状态 |
|---|---|
| `../start/build.md` | current |
| `../start/download.md` | current |
| `../start/first-run.md` | current |
| `../start/flashing.md` | current |
| `../start/install.md` | current |
| `../start/overview.md` | current |
| `../start/quickstart.md` | current |
| `../operate/api.md` | current |
| `../operate/configuration.md` | current |
| `../operate/recovery.md` | current |
| `../operate/storage.md` | current |
| `../operate/mica.md` | current |
| `../operate/troubleshooting.md` | current |
| `../operate/updates.md` | current |
| `../operate/without-micad.md` | not-translated |
| `../integrate/applications.md` | current |
| `../integrate/bus.md` | current |
| `../integrate/console.md` | current |
| `../integrate/containers.md` | not-translated |
| `../integrate/display.md` | not-translated |
| `../integrate/manufacturing.md` | current |
| `../integrate/native-applications.md` | not-translated |
| `../integrate/provisioning.md` | current |
| `../hardware/README.md` | current |
| `../hardware/assurance.md` | current |
| `../hardware/cx3576.md` | current |
| `../hardware/board-template.md` | not-translated |
| `../hardware/mini-x64.md` | current |
| `../hardware/qemu-armhf.md` | current |
| `../hardware/qualification.md` | current |
| `../hardware/s905x5m.md` | current |
| `../hardware/uefi-arm64.md` | current |
| `../hardware/uefi-x64.md` | current |
| `../security/lifecycle.md` | current |
| `../security/model.md` | current |
| `../security/overview.md` | current |
| `../security/signing.md` | current |
| `../releases/how-releases-work.md` | current |
| `../releases/release-notes.md` | current |
| `../releases/support.md` | current |
| `../website/contract.md` | not-translated |
| `../website/documentation.md` | not-translated |
| `../website/downloads.md` | not-translated |
| `../website/embedded.md` | not-translated |
| `../website/hardware.md` | not-translated |
| `../website/licensing.md` | not-translated |
| `../website/product.md` | not-translated |
| `../website/res-product-catalogue.md` | not-translated |
| `../website/security.md` | not-translated |
| `../website/support.md` | not-translated |

## 文档不解释代码

这些文档描述**设计与行为**，不引用代码行号，也不逐句注解实现——被行号绑住的文档，
会被那些并未改变设计的编辑证伪。需要精确契约时，直接指向承载它的产物：HTTP 接口面
由 `mica-core:crates/mica-apid/openapi.json` 规定，CI 保证它与实际运行的二进制一致。
