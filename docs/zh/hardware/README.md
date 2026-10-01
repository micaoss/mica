# 支持硬件列表

这里按板卡回答四个问题：**这块板能不能跑 Mica OS、跑到什么程度、镜像怎么进去、
出问题怎么回来。**每块板一页，章节顺序相同，可以直接对照着看。

本页是**给中文读者的现状快照，记于 2026-10-01**。板卡状态的权威表是英文的
[`docs/boards/support-tiers.md`](../../boards/support-tiers.md#current-boards)——
两边不一致时以英文为准，这里按缺陷处理。

## 板卡一览

| 板卡 | 硬件 | 架构 | 启动方式 | 发布目标 | 支持层级 | 实机验证 |
|---|---|---|---|---|---|---|
| [`uefi-x64`](uefi-x64.md) | 通用 amd64 机器（UEFI + ACPI） | amd64 | systemd-boot，签名 UKI | 是 | bring-up（QEMU 基线） | 无 |
| [`uefi-arm64`](uefi-arm64.md) | 通用 arm64 机器（UEFI + ACPI） | arm64 | systemd-boot，签名 UKI | 是 | bring-up（QEMU 参考） | 无 |
| [`cx3576`](cx3576.md) | CX3576-Z / Rockchip RK3576 | arm64 | U-Boot，签名 FIT | 是 | bring-up | 有一条用户报告，无证据行 |
| [`s905x5m`](s905x5m.md) | BM201 / Amlogic S905X5M（S7D） | arm64 | U-Boot，签名 FIT，从 SD 启动 | 是 | bring-up | 无 |
| [`mini-x64`](mini-x64.md) | 小型 amd64 机器（UEFI），128 MB 闪存 | amd64 | systemd-boot，签名 UKI | 是 | bring-up（QEMU） | 无 |

没有任何板卡达到 `mica-qualified`：没有任何板卡档案里有一条注明日期的实机合格行。
层级的定义见[支持层级](../../boards/support-tiers.md)，共三级：`mica-qualified`
（Mica OS 自己跑完并拥有合格矩阵）、`integrator-qualified / bring-up`（合约满足，
现场证据由集成商持有或仍在积累）、`unsupported`（没有档案，不做任何声明）。

> status: board-dependent — evidence: `docs/boards/support-tiers.md`, `mica-build:boards/uefi-x64/board.env`, `mica-build:boards/uefi-arm64/board.env`, `mica-build:boards/cx3576/board.env`, `mica-build:boards/s905x5m/board.env`, `mica-build:boards/mini-x64/board.env`

## 现在到底是什么状态（2026-10-01）

**每块板都是发布目标**，它的每个产品各自发布：每块板都有默认的 `<board>.basic`，除
`mini-x64` 外还有带容器引擎的 `<board>.full`。**九个产品里目前只有两个有发布**：
`cx3576.full` 与 `mini-x64.basic`。其余产品还没有发布，没有镜像可下载，需要从源码构建
（[构建指南](../../user/build.md)）。

**“是发布目标”不等于“能在实机上跑”。**它只说明镜像被发布了。今天的实际验证情况
分成三档：

| 验证档位 | 板卡 | 含义 |
|---|---|---|
| 每次发布时自动启动 | `uefi-x64`、`mini-x64` | 每个 amd64 产品在 QEMU 里跑一轮 UEFI lifecycle 的运行阶段 |
| 只构建与静态校验，有过手工 QEMU 记录 | `uefi-arm64` | 自动启动步骤只跑 amd64，所以它没有自动启动记录；已有的 QEMU 证据早于板卡改名 |
| 没有任何自动流程会启动 | `cx3576`、`s905x5m` | 没有任何套件会启动 FIT 镜像——FIT 那套跑在宿主机上、不带 QEMU，两套会启动 guest 的套件按名字拒绝 FIT 板卡 |

**没有任何实机启动拥有证据行。**也没有任何把 Mica OS 镜像写进 U 盘、SATA、NVMe 或
eMMC 的记录。用户于 2026-09-20 报告一块 `cx3576` 在实机上启动成功——那是一条报告，
没有附带产物，因此不是合格行，层级表里也没有任何一行因此移动
（[支持层级](../../boards/support-tiers.md)）。凡是本目录里写到实机步骤的地方，
都标了“未验证”。

> status: shipped — evidence: `mica-build:boards/products.md`, `mica-build:README.md`, `docs/user/download.md`

## 怎么选

- **只想先看看这套系统长什么样** → [`uefi-x64`](uefi-x64.md)，在 QEMU 里跑，
  这是有自动启动证据的基线。
- **要装进 128 MB 闪存** → [`mini-x64`](mini-x64.md)：OpenRC、管理面、SSH 与
  容器，没有 USB。
- **想在通用 arm64 机器上试** → [`uefi-arm64`](uefi-arm64.md)。它携带了通用硬件
  驱动（AHCI、NVMe、USB 存储、常见网卡），但**携带驱动不等于有证据证明某台机器
  能启动**，并且完全没有 MMC 驱动。
- **做 RK3576 产品** → [`cx3576`](cx3576.md)。它是仓库里的移植参考板，刷写流程
  （`rkdeveloptool`，带回读校验）已经实现并在打桩测试下验证过控制流程，但从未面对
  过真实硬件。
- **手上是 BM201 / S905X5M** → [`s905x5m`](s905x5m.md)。**今天没有任何受支持的办法
  把 Mica OS 装进一块空板**：它的 U-Boot 从 eMMC boot0 执行，而发布的磁盘镜像只覆盖
  SD 介质，不装引导器。
- **要上一块全新的板** → 英文的[板卡合约](https://github.com/micaoss/mica-build/blob/main/boards/README.md)与[移植指南](https://github.com/micaoss/mica-build/blob/main/boards/README.md)。

## 不按板卡分、按主题看的页面

| 想知道 | 读 |
|---|---|
| 一个发布由什么构成、怎么校验 | [获取发布版](../user/download.md) |
| 刷写的完整说明（含 QEMU 命令行） | [刷写](../user/flashing.md) |
| 更新归档怎么选、设备怎么接收 | [更新包](../user/update-packages.md)、[更新与回滚](../user/update-rollback.md) |
| 恢复阶梯：哪些步骤今天真能走 | [恢复](../user/recovery.md) |
| 分区、数据归属 | [存储](../user/storage.md) |
| 整个系统怎么拼起来 | [一页读懂](../user/overview.md)、[架构](../../architecture.md) |

各板页面里的“刷机 / 更新 / 恢复”是这些主题页的板卡视角摘要，细节以主题页为准。

## 这些页面的来源

每页的事实来自三处：英文板卡档案（`docs/boards/<board>.md`）、
`mica-build:boards/<board>/` 里该板的 `board.env` 与 `evidence.json`、以及中文用户文档。
`uefi-x64` 与 `mini-x64` 没有板卡档案，它们那页会逐条注明来源。

> status: board-dependent — evidence: `docs/boards/cx3576.md`, `docs/boards/s905x5m.md`, `docs/boards/uefi-arm64.md`, `mica-build:boards`
