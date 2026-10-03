# Mica OS

> [English](README.md) | 中文

**做产品，别做系统。**

面向出厂设备的嵌入式 Linux 操作系统。板卡由你选，应用由你掌握；底下这套系统需要
可复现、能在现场更新、更新出错时能恢复。

本仓库是项目的正门。从这里开始——[`micaoss`](https://github.com/micaoss) 组织下的其他
仓库各自持有一部分代码和自己的开发记录，全局约定与公开文档都指回这里。

## 它是什么

- **只读且逐块校验的 root。** 每份系统镜像是一份由 dm-verity 哈希树封印的 squashfs，
  运行时读取的每个块都对照构建期固定的根哈希，root 上没有会漂移的东西。
- **签名的 A/B 更新。** kernel、support、root 与 core 组件以认证部署的形式安装，
  管理面可以单独更新，不必换新的 root。新部署启动后
  必须通过健康检查；失败就退回上一份可用部署，DATA 分区上的数据保留。
- **统一的管理面。** `micad` 掌管设备设置并驱动 init 与之对齐（网络、Wi-Fi、SSH、
  容器、MQTT）；`mica-apid` 提供带认证的 API 与内置 Web 控制台，默认走明文 HTTP 的
  8080 端口，开启后走 HTTPS（8443）。
- **init 由你选。** 基础 root 不带 init：每个产品选 systemd 或 OpenRC，每个包都为两种
  init 带上自己的服务。
- **应用在系统之上，不在系统里面。** 原生应用以 Debian 包进入镜像、随系统一起更新；
  独立发布的应用以固定版本的 OCI 容器跑在 Podman 下，向 micad 声明，由
  `mica-containerd` 监管，两种 init 都支持。
- **离线优先。** 装机与配置不依赖网络或云服务，SSH 默认关闭。

它不是：通用 Linux 发行版（设备上没有 `apt`）、云或服务器操作系统、车队管理服务。

## 项目状态

Mica OS 处于活跃开发中。下面每块板都是发布目标：它的每个产品（`<board>.<variant>`：
默认的 `basic`，以及加上容器引擎的 `full`）各自构建、签名、发布——这并不意味着它能在实机上启动。

| 板卡 | 硬件 | 状态（2026-10-01） | 已发布的产品 |
|---|---|---|---|
| `uefi-x64` | 通用 amd64，UEFI | bring-up，QEMU 基线；在发布流程里被启动 | 暂无 |
| `uefi-arm64` | 通用 arm64，UEFI | bring-up，QEMU 参考；只构建与校验，没有自动启动 | 暂无 |
| `cx3576` | Rockchip RK3576 | bring-up；没有自动流程启动它——没有套件会启动 FIT 镜像 | `cx3576.full` |
| `s905x5m` | Amlogic S7D（BM201） | bring-up；没有自动流程启动它，且没有受支持的办法装进空板 | 暂无 |
| `mini-x64` | 通用 amd64，UEFI，128 MB 闪存 | bring-up，QEMU；只有一个产品 `mini-x64.basic`，运行 OpenRC | `mini-x64.basic` |

还没有发布的产品没有镜像可下载，请从源码构建（[构建指南](docs/start/build.md)）。

尚无板卡完成认证：没有任何板卡档案里有注明日期的实机合格行，也没有任何实机启动拥有
证据行（2026-09-20 有一条 `cx3576` 的实机启动报告，未附产物，不移动任何一行）。[支持等级表](docs/hardware/README.md)是权威且最新的表，并说明每个等级的
含义；中文的[支持硬件列表](docs/zh/hardware/README.md)按板卡讲同一件事。

## 从这里开始

| 我想…… | 读 |
|---|---|
| 了解系统如何拼在一起 | [架构](docs/architecture.md) |
| 构建一份镜像并启动它 | [快速上手](docs/zh/start/quickstart.md)、[构建指南](docs/start/build.md)、[安装](docs/zh/start/install.md) |
| 配置与运维一台设备 | [首次配置](docs/zh/start/first-run.md)、[配置](docs/zh/operate/configuration.md)、[更新与回滚](docs/zh/operate/updates.md) |
| 把我的应用跑上去 | [应用](docs/zh/integrate/applications.md)、[容器](docs/integrate/containers.md) |
| 看某块板卡的现状与刷机步骤 | [支持硬件列表](docs/zh/hardware/README.md) |
| 上一块新板子 | [`mica-build:boards/`](https://github.com/micaoss/mica-build/blob/main/boards/README.md)，每块板卡在那里带着自己的完整构建 |
| 审视安全态势 | [安全](docs/zh/security/overview.md)、[安全模型](docs/security/model.md) |
| 浏览全部 | [中文用户指南](docs/zh/README.md) · [English documentation](docs/README.md) |

## 仓库

| 仓库 | 持有什么 |
|---|---|
| **`mica`**（本仓库） | 产品文档：架构、用户与集成方指南、支持的硬件、产品的设计契约与产品决策 |
| `mica-build` | 板卡（BSP、内核、板卡包）与镜像组装：组合、签名、校验并测试一份产品镜像 |
| `mica-core` | 管理面（`micad`、`mica-apid`、控制台）与设备上的部署客户端 |
| `mica-system-base` | 与板卡无关的基础系统：固定版本的 Debian 包、系统策略、基础 root 与两种 init |
| `mica-podman` | 容器引擎包 |
| `mica-build-env` | 每个仓库据以构建的构建环境镜像 |
| `mica-build-tools` | 每个仓库运行的 release lock 与构建规则的唯一实现 |

产品文档在本仓库，模块文档在产出该模块的仓库。本仓库的文档以
`<仓库>:<路径>` 的形式引用其他仓库的代码。

## 包

一份镜像由 Debian 包组合而成。`mica-build` 按固定版本从产出该包的仓库导入每个包，
只有板卡包由它自己从 `boards/` 与 `common/` 构建。每个 pin 都是产出方的最新发布
（`bin/mica-tools locks update`）。

| 仓库 | 包 |
|---|---|
| `mica-system-base` | `mica-system`（系统策略）、`mica-busybox`（基础 root 的命令集）、`mica-ca-trust`、init 包 `mica-systemd` 与 `mica-openrc`（配 `mica-mdev`）、`mica-ssh`、`mica-tzdata`、Wi-Fi 包 `mica-wifi` 与 `mica-wifi-ap`、`mica-bluetooth`、`mica-systemd-boot`（未签名的引导器，由 `mica-build` 签名；从不装进 root） |
| `mica-core` | core 组件 `micad`（含 `mica-apid`）与 `mica-apid-ui`，是启动时叠加在 root 上的 verity 镜像；以及软件包 `mica-mqttd`、`mica-mqtt-broker`、`mica-sftp-server`、`mica-deploy`、`mica-lifecycle`（早期启动与关机的可执行文件；从不装进 root） |
| `mica-build` | 每块板卡的 `mica-board-<board>`，以及 s905x5m 的组件包；内核、U-Boot 与固件作为独立的板卡组件制品发布，不是包 |
| `mica-podman` | `mica-podman`（Podman 容器引擎及其监管进程 `mica-containerd`） |

Debian 包来自 `mica-system-base` 的发布，每份发布带一个 `mica-system-base.lock` 及其
`SHA256SUMS`。消费方原样提交这份 lock 为 `locks/mica-system-base.lock`，连同它的 pin
`locks/pins/mica-system-base.pin`（[release lock](docs/reference/release-lock.md)），并遵循
mica-system-base README 中 *Consuming a release* 的规则。

开发镜像与生产镜像之间没有 image profile 包，二者的区别是签名内核命令行参数
`mica.profile=dev|prod`（[决策](docs/decisions/2026-09-14-no-image-profile-packages.md)）。

## 项目怎么运转

- 本仓库只放产品：Mica OS 是什么、怎么用、支持哪些硬件，以及产品决策，记在
  [`docs/decisions/`](docs/decisions/README.md)。
- 工作在它所改动的仓库里规划与跟踪，和代码放在一起；每个仓库保留自己的历史
  （[决策](docs/decisions/2026-09-27-each-repository-keeps-its-records.md)）。
  release lock 与构建的规则归 `mica-build-tools` 管。

文档检查用 `make docs-verify`，检查自身的测试用 `make docs-verify-test`。

## 许可

Mica OS 以 [Apache License, Version 2.0](LICENSE) 授权。
