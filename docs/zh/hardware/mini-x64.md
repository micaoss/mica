# mini-x64：带 128 MB 闪存的小型 amd64 UEFI 机器

`mini-x64` 和 [`uefi-x64`](uefi-x64.md) 一样是一个**通用系统**——一份镜像服务于固件是
UEFI 的 amd64 机器——但为了跑在 128 MB 闪存上做了裁剪：自己的基于 `tinyconfig` 的
内核、xz 压缩的根，以及唯一的产品 `mini-x64.basic`，它运行 OpenRC，带管理面、SSH 与容器。

现状快照记于 2026-10-01。状态以英文的
[支持层级表](../../hardware/support-tiers.md#current-boards)为准。

**它没有板卡档案。**以下内容读自 `mica-build:boards/mini-x64/board.env`、它的
`layout.tsv`、`evidence.json` 与内核配置，以及[刷写](../start/flashing.md)页。

## 一览

| | |
|---|---|
| 架构 | `amd64` |
| 启动链 | UEFI 固件 → 签名的 `EFI/BOOT/BOOTX64.EFI`（systemd-boot）→ 计次启动项 → 签名 UKI → 经认证的原生 init → SYSTEM → 签名 verity root/support → OpenRC |
| 固件形态 | `efi`——引导器在 ESP 里 |
| 分区 | ESP / SYSTEM / DATA |
| 体积预算 | 130 MB（`BOARD_SIZE_BUDGET_MB`）；根是 xz squashfs |
| 发布目标 | 是 |
| 支持层级 | bring-up（QEMU） |
| 启动保证等级 | I1 |

## 硬件与功能状态

| 功能 | 状态 | 说明 |
|---|---|---|
| 容器（Podman） | 随镜像发布 | `BOARD_FEATURES="containers"`；`mini-x64.basic` 在 OpenRC 下带引擎与 `mica-containerd` |
| virtio-blk | QEMU 下已验证 | 自动启动用的就是这条路径 |
| SATA（AHCI）、NVMe | 内核内建驱动，未在实机验证 | — |
| SD / eMMC（PCI 或 ACPI 上的 SDHCI） | 内核内建驱动，未在实机验证 | 这块板所面向的小容量闪存 |
| USB | **不支持** | `CONFIG_USB_SUPPORT` 关闭 |
| 网络 | virtio-net、Intel e1000 与 e1000e | — |
| 显示、Wi-Fi、蓝牙、状态灯、CAN、USB gadget | 无 | 无头设备 |
| 实体恢复动作 | 无 | 这块板上凭据恢复与全出厂重置会被拒绝 |

> status: board-dependent — evidence: `mica-build:boards/mini-x64/board.env`, `mica-build:boards/mini-x64/kernel/config/mini-x64.fragment`, `mica-build:boards/mini-x64/evidence.json`

## 分区布局

| 分区 | 角色 | 起点 | 大小 |
|---|---|---|---|
| `esp` | FAT | 1 MiB | 16 MiB |
| `system` | ext4 | 17 MiB | 98 MiB |
| `data` | ext4 | 115 MiB | 12 MiB，首次启动时扩到整个介质 |

权威的几何参数是 `mica-build:boards/mini-x64/layout.tsv`。

## 控制台

串口，`console=ttyS0,115200n8`；`net.ifnames=0`，网卡名是 `eth0`。

## 获取镜像

产品是 `mini-x64.basic`，发布为 `mini-x64.basic.<YYYYMMDD-HHMM>`，镜像文件名
`mica-mini-x64.basic-<YYYYMMDD-HHMM>.img.gz`。校验方法见[获取发布版](../start/download.md)。

## 刷机

**在 QEMU 里**——与 `uefi-x64` 相同：用 `virt-fw-vars` 把发布的启动证书写进 OVMF
变量库，再用 `qemu-system-x86_64 -machine q35` 启动解压后的镜像。命令行见
[刷写](../start/flashing.md)第 4 节。

**写进实体机器（未验证）**：写整个设备，不要只写一个分区，然后 `sync` 并回读比对
（[刷写](../start/flashing.md)第 3 节）。

> status: unsupported

## 更新与恢复

与 [`uefi-x64`](uefi-x64.md) 相同：`full`、`root`、`kernel` 三种更新归档，带健康确认与
回滚的 A/B 切换，恢复的兜底是整盘重刷。在 OpenRC 下，micad 驱动的是各个包为这种 init
提供的服务（`mica-core:docs/mica-core.md` 第 3.8 节）。

## 已知限制

- 所有证据都是模拟器证据，不是现场证据。
- 完全没有 USB：需要从 USB 介质启动或安装的机器用不了这份镜像。
- 没有 Web 控制台，也没有 MQTT：`mini-x64.basic` 只带管理面、SSH 与容器。

## 验证记录

| 项目 | 结果 | 说明 |
|---|---|---|
| QEMU 运行、组件更新、试运行回退、故障恢复 | 通过 | `evidence.json` |
| 每次发布时自动启动 | 是 | amd64 产品跑一轮 UEFI lifecycle 的运行阶段 |
| 实机冷启动、写盘、恢复 | 未测试 | 没有硬件 |

> status: board-dependent — evidence: `docs/hardware/support-tiers.md`, `mica-build:boards/mini-x64/evidence.json`, `mica-build:tests/suites/lifecycle-uefi/boot.sh`
