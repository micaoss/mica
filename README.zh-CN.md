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

Mica OS 处于活跃开发中。它的板卡都处于 bring-up 层级：通用系统 `uefi-x64`、
`uefi-arm64`、`mini-x64`，以及硬件板 `cx3576`、`s905x5m`。每块板的产品各自构建、签名、
发布，名为 `<board>.<variant>`——这并不意味着它能在实机上启动：**尚无板卡完成认证**，没有
任何板卡页带有带日期的实机认证行。

- [板卡状态表](docs/zh/hardware/README.md#当前板卡)是记录板卡状态的唯一位置，并说明每个
  层级的含义。
- [下载页](https://micaos.dev/download/)列出有发布的产品。没有发布的产品从源码构建
  （[构建指南](docs/zh/start/build.md)）。

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

一份镜像由 Debian 包和 core 组件组合而成。`mica-build` 按产出方的最新发布固定版本，从产出
它的仓库取用每一个，板卡包则由它自己构建。每个仓库产出什么、消费方如何取用一次发布，写在
该仓库的 README 里；lock 与 pin 的规则是 `mica-build-tools:docs/spec/release-lock.md`。

## 项目怎么运转

- 本仓库只放产品：Mica OS 是什么、怎么用、支持哪些硬件，以及产品决策，记在
  [`docs/decisions/`](docs/decisions/README.md)。
- 工作在它所改动的仓库里规划与跟踪，和代码放在一起；每个仓库保留自己的历史
  （[决策](docs/decisions/2026-09-27-each-repository-keeps-its-records.md)）。
  release lock 与构建的规则归 `mica-build-tools` 管。

文档检查用 `make docs-verify`，检查自身的测试用 `make docs-verify-test`。

## 许可

Mica OS 以 [Apache License, Version 2.0](LICENSE) 授权。
