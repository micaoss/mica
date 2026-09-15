# Mica OS

> [English](README.md) | 中文

**做产品，别做系统。**

面向出厂设备的嵌入式 Linux 操作系统。板卡由你选，应用由你掌握；底下这套系统需要
可复现、能在现场更新、更新出错时能恢复。

本仓库是项目的正门。从这里开始——[`micaoss`](https://github.com/micaoss) 组织下的其他
仓库各自持有一部分代码，设计、决策与文档都指回这里。

## 它是什么

- **只读且逐块校验的 root。** 每份系统镜像是一份由 dm-verity 哈希树封印的 squashfs，
  运行时读取的每个块都对照构建期固定的根哈希，root 上没有会漂移的东西。
- **签名的 A/B 更新。** kernel、support 与 root 组件以认证部署的形式安装。新部署启动后
  必须通过健康检查；失败就退回上一份可用部署，DATA 分区上的数据保留。
- **统一的管理面。** `micad` 掌管设备设置并驱动 systemd 与之对齐（网络、Wi-Fi、SSH、
  容器、MQTT）；`mica-apid` 提供带认证的 HTTPS API 与内置 Web 控制台。
- **应用在系统之上，不在系统里面。** 原生应用以 Debian 包进入镜像、随系统一起更新；
  独立发布的应用以固定版本的 OCI 容器跑在 Podman 下。
- **离线优先。** 装机与配置不依赖网络或云服务，SSH 默认关闭。

它不是：通用 Linux 发行版（设备上没有 `apt`）、云或服务器操作系统、车队管理服务。

## 项目状态

Mica OS 处于活跃开发中，尚无公开发布。

| 板卡 | 硬件 | 状态 |
|---|---|---|
| `x64` | 通用 x86_64，UEFI | bring-up，已在 QEMU 验证 |
| `virt-arm64` | QEMU ARM64，UEFI | bring-up，QEMU 参考 |
| `cx3576` | Rockchip RK3576 | bring-up，镜像可构建，实机测试待做 |
| `s905x5m` | Amlogic S7D（BM201） | bring-up，镜像可构建，实机测试待做 |

尚无板卡完成认证。[支持等级表](docs/boards/support-tiers.md)是权威且最新的表，并说明
每个等级的含义。

## 从这里开始

| 我想…… | 读 |
|---|---|
| 了解系统如何拼在一起 | [架构](docs/architecture.md) |
| 构建一份镜像并启动它 | [快速上手](docs/zh/user/quickstart.md)、[构建指南](docs/design/build.md)、[安装](docs/zh/user/install.md) |
| 配置与运维一台设备 | [首次配置](docs/zh/user/first-run.md)、[配置](docs/zh/user/configuration.md)、[更新与回滚](docs/zh/user/update-rollback.md) |
| 把我的应用跑上去 | [应用](docs/zh/user/applications.md)、[容器](docs/design/containers.md) |
| 上一块新板子 | [板卡合约](docs/boards/contract.md)、[移植指南](docs/boards/porting.md) |
| 审视安全态势 | [安全](docs/zh/user/security.md)、[安全模型](docs/design/security-model.md) |
| 浏览全部 | [中文用户指南](docs/zh/README.md) · [English documentation](docs/README.md) |

## 仓库

| 仓库 | 持有什么 |
|---|---|
| **`mica`**（本仓库） | 产品文档：架构、用户文档、决策，以及项目的任务与计划记录 |
| `mica-build` | 镜像组装：组合、签名、校验并测试一份产品镜像 |
| `mica-core` | 管理面（`micad`、`mica-apid`、控制台）与设备上的部署客户端 |
| `mica-system-base` | 与板卡无关的基础系统：固定版本的 Debian 包与系统策略 |
| `mica-boards` | 板卡：BSP、内核、板卡包与射频包 |
| `mica-podman` | 容器引擎包 |
| `mica-build-env` | 每个仓库据以构建的构建环境镜像 |

产品文档在本仓库，模块文档在产出该模块的仓库。本仓库的文档以
`<仓库>:<路径>` 的形式引用其他仓库的代码。

## 包

一份镜像由 Debian 包组合而成。`mica-build` 一个都不自己构建：它按固定版本从产出该包的
仓库导入。

| 仓库 | 包 |
|---|---|
| `mica-system-base` | `mica-system`（系统策略）、`mica-busybox`（应急二进制）、`mica-ca-trust`、`mica-systemd-boot`（未签名的引导器，由 `mica-build` 签名；从不装进 root） |
| `mica-core` | `micad`、`mica-apid`、`mica-mqttd`、`mica-mqtt-broker`、`mica-sftp-server`、`mica-deploy`、`mica-lifecycle`（早期启动与关机的可执行文件；从不装进 root） |
| `mica-boards` | 每块板卡的 `mica-board-<board>`，射频包 `mica-wifi`、`mica-wifi-ap`、`mica-bluetooth`，以及 `mica-kernel-<board>`（板卡的内核包；从不装进 root） |
| `mica-podman` | `mica-podman`（Podman 容器引擎） |

Debian 包来自 `mica-system-base` 的发布，每份发布带一个 `mica-system-base.lock` 及其
`SHA256SUMS`。消费方原样提交这份 lock 为 `locks/mica-system-base.lock`，连同它的 pin
`locks/pins/mica-system-base.pin`（[release lock](docs/design/release-lock.md)），并遵循
mica-system-base README 中 *Consuming a release* 的规则。

开发镜像与生产镜像之间没有 image profile 包，二者的区别是签名内核命令行参数
`mica.profile=dev|prod`（[决策](docs/decisions/2026-09-14-no-image-profile-packages.md)）。

## 项目怎么运转

- **决策**记在 [`docs/decisions/`](docs/decisions/README.md)，每条带理由与复核日期。
- **进行中的工作**以[任务](docs/task/index.md)与[计划](docs/plan/index.md)追踪；每项改动
  先调查、先提案，再实现。
- **历史**在[变更日志](docs/changelog.md)。
- 任何仓库的代码改动，都连同它在这里的记录一起落地。

文档检查用 `make docs-verify`，检查自身的测试用 `make docs-verify-test`。

## 许可

Mica OS 以 [Apache License, Version 2.0](LICENSE) 授权。
