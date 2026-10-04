# 支持的硬件

每块板一页，每次都按同样的顺序回答四个问题：**这块板能不能跑 Mica OS、证明到了哪一步、
镜像怎么写进去、出了问题怎么回来。** 本页给出板卡状态表，以及状态表使用的支持层级。
英文页 [`docs/hardware/README.md`](../hardware/README.md) 是权威。

## 当前板卡

这张表是板卡状态的唯一来源；其他文档链接到这里，而不是重述它。

| 板卡 | 硬件 | 架构 | 启动 | 磁盘布局 | 在案证据 | 层级 |
|---|---|---|---|---|---|---|
| [`uefi-x64`](uefi-x64.md) | 通用 amd64 机器（UEFI + ACPI） | amd64 | systemd-boot，签名 UKI | ESP / SYSTEM / DATA | QEMU 生命周期：API、电源动作、运行时、更新、故障与重置 | bring-up（QEMU 基线） |
| [`uefi-arm64`](uefi-arm64.md) | 通用 arm64 机器（UEFI + ACPI） | arm64 | systemd-boot，签名 UKI | ESP / SYSTEM / DATA | QEMU `virt`：API、更新、故障与重启各行 | bring-up（QEMU 参考） |
| [`mini-x64`](mini-x64.md) | 带 128 MB 闪存的小型 amd64 机器（UEFI） | amd64 | systemd-boot，签名 UKI | ESP / SYSTEM / DATA | `mini-x64.basic` 上的 QEMU 生命周期 | bring-up（QEMU） |
| [`cx3576`](cx3576.md) | CX3576-Z / Rockchip RK3576 | arm64 | U-Boot，签名 FIT | FIRMWARE / SYSTEM / DATA | 静态验证；一次实机观察，没有认证行 | bring-up |
| [`s905x5m`](s905x5m.md) | BM201 / Amlogic S905X5M（S7D） | arm64 | U-Boot，签名 FIT | FIRMWARE / SYSTEM / DATA，在 SD 或 eMMC 上 | 静态验证与夹具；没有实机行 | bring-up |

没有任何板卡是 `mica-qualified`：没有哪一页带有带日期的实机认证行。

`uefi-x64`、`uefi-arm64` 和 `mini-x64` 是**通用系统**，按启动它们的固件类命名；`cx3576`
和 `s905x5m` 是**硬件板**，按产品命名
（[决策](../../decisions/2026-09-16-generic-systems-named-by-firmware.md)，英文）。

> status: board-dependent — evidence: `mica-build:boards/boards.tsv`, `mica-build:boards/uefi-x64/evidence.json`, `mica-build:boards/uefi-arm64/evidence.json`, `mica-build:boards/mini-x64/evidence.json`, `mica-build:boards/cx3576/evidence.json`, `mica-build:boards/s905x5m/evidence.json`

## 这张表声明了什么，没有声明什么

**每块板都是发布目标**（其 `board.env` 里的 `BOARD_RELEASE_TARGET`）：它的产品都会被
构建，并且可以各自独立发布，名为 `<board>.<variant>`。`basic` 是每块板的默认产品，
`full` 在 `uefi-x64`、`uefi-arm64` 与 `cx3576` 上加入容器引擎；`mini-x64` 只有 `basic`，它
已经带了容器引擎。`s905x5m` 按存储命名产品：eMMC 上的 `basic` 与 `emmc-full`，SD 卡上的
`sd-full`。`dev` 产品只在本地构建，从不发布。哪些
产品有可下载的发布见[下载页](https://micaos.dev/download/)；没有发布的产品从源码构建
（[构建](../start/build.md)）。

**是发布目标不等于对硬件的声明。** 真正启动过镜像的情况分三种：

| 启动到什么程度 | 板卡 | 含义 |
|---|---|---|
| 每次发布运行都启动 | `uefi-x64`、`mini-x64` | 每个 amd64 产品在 QEMU 下启动 UEFI 生命周期的一个运行时阶段 |
| 构建并静态验证；QEMU 按需运行 | `uefi-arm64` | 发布运行的启动步骤只针对 amd64 |
| 这些仓库里没有任何东西启动它 | `cx3576`、`s905x5m` | 没有套件启动 FIT 镜像；FIT 套件在主机上运行，不用 QEMU |

已发布的镜像不等于已启动的镜像，模拟器证据也不是现场证据。板卡页上的每一个实机步骤，
在出现带日期的行之前都标为未验证。

> status: shipped — evidence: `mica-build:boards/products.md`, `mica-build:README.md`, `mica-build:.github/workflows/release-product.yml`

## 支持层级

层级是关于证据与归属的声明，而不是关于镜像能否启动。通常由 Mica OS 提供契约与指导，
由集成客户选择并集成板卡，所以用层级避免三种不同的情形被混成一个词“支持”。

| | `mica-qualified` | `integrator-qualified` / bring-up | `unsupported` |
|---|---|---|---|
| 含义 | Mica OS 拥有该移植及其证据 | 移植存在且满足契约；现场证据属于集成商，或仍在积累 | 其他一切 |
| 证据 | 完整的板卡页，以及由 Mica OS 在指名的版本上跑过的[认证矩阵](../../hardware/qualification.md)，冷/热启动、更新、更新中断电、恢复各行为带日期的 `pass` | 同样的页面与矩阵，各行由集成商填写，或如实写 `not tested` | 不要求 |
| 生命周期归属 | Mica OS：BSP 同步、CVE 响应、变更后重新认证 | 集成商，Mica OS 提供契约与模板；板卡页写明谁负责什么 | 无人 |
| 允许的说法 | 在指名的版本上“支持”，并给出有证据的[保证等级](../../hardware/assurance.md)，不得更高 | “能构建并通过仓库的门禁”；不指明是谁的认证就不得说“支持”或“已认证” | 无；只能作为不支持提及 |

“能启动”不会让一块板离开 `unsupported`：现场可靠性、恢复、更新与生命周期归属，正是一份
能启动的镜像没有证明的东西。

层级按板卡**与版本组合**指定。向上移动需要证据而不是意图：集成商的各行有了日期，
bring-up 才成为 integrator-qualified；只有 Mica OS 自己运行并拥有矩阵，才成为
mica-qualified。向下移动是自动的：重新认证的触发条件
（[认证](../../hardware/qualification.md)第 5 节）让各行对新的组合回到 `not tested`，
层级的说法随之失效。

> status: shipped — evidence: `docs/hardware/qualification.md`, `docs/hardware/board-template.md`, `docs/hardware/assurance.md`

## 选哪块板

- **想看这个系统是什么**：QEMU 下的 [`uefi-x64`](uefi-x64.md)，有自动启动证据的基线。
- **要放进 128 MB 闪存**：[`mini-x64`](mini-x64.md)。OpenRC、管理面、SSH 与容器；没有 USB。
- **想试一台通用 arm64 机器**：[`uefi-arm64`](uefi-arm64.md)。它带有通用硬件驱动（AHCI、
  NVMe、USB 存储、常见网卡），但携带驱动不等于有证据证明某台机器能启动，而且它没有
  MMC 支持。
- **要做 RK3576 产品**：[`cx3576`](cx3576.md)，仓库里的移植参考板。
- **要用 BM201 / S905X5M**：[`s905x5m`](s905x5m.md)。
- **要引入一块新板**：板卡契约与移植指南 `mica-build:boards/README.md`，以及
  [板卡页模板](../../hardware/board-template.md)（英文）。

## 同样的内容，按主题

| 想了解 | 读 |
|---|---|
| 一次发布包含什么、怎么校验 | [下载](../start/download.md) |
| 完整的刷写流程，包括 QEMU 命令行 | [刷写](../start/flashing.md) |
| 该用哪个更新归档、设备怎么接收 | [更新与回滚](../operate/updates.md) |
| 恢复阶梯 | [恢复](../operate/recovery.md) |
| 分区与数据该放在哪里 | [存储](../operate/storage.md) |
| 整个系统如何拼在一起 | [总览](../start/overview.md)、[架构](../../architecture.md)（英文） |

每个板卡页从该板的角度概述刷写、更新与恢复；细节归主题页。板卡的工程内容（内核、
加载器、软件包及其来源）在 `mica-build:boards/<board>/`。
