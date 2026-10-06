# mini-x64：带 128 MB 闪存的小型 amd64 UEFI 机器

`mini-x64` 和 [`uefi-x64`](uefi-x64.md) 一样是一个**通用系统**——一份镜像服务于固件是
UEFI 的 amd64 机器——但为了跑在 128 MB 闪存上做了裁剪：自己的基于 `tinyconfig` 的
内核、xz 压缩的根，以及唯一的产品 `mini-x64.basic`，它运行 OpenRC，带管理面、SSH 与容器。状态以[状态表](README.md#当前板卡)为准。

## 概况

| | |
|---|---|
| 架构 | `amd64` |
| 启动链 | UEFI 固件 → 签名的 `EFI/BOOT/BOOTX64.EFI`（systemd-boot）→ 计次启动项 → 签名 UKI → 经认证的原生 init → SYSTEM → 签名 verity root/support → OpenRC |
| 固件形态 | `efi`——引导器在 ESP 里 |
| 分区 | ESP / SYSTEM / DATA |
| 体积预算 | 130 MB（`BOARD_SIZE_BUDGET_MB`）；根是 xz squashfs |
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

**在 QEMU 里。** 把镜像解压为 `disk.img` 然后启动；[刷写](../start/flashing.md)第 4 节
记录的就是对已发布的 `mini-x64.basic` 的这次运行：

```sh
cp /usr/share/OVMF/OVMF_VARS_4M.fd vars.fd
qemu-system-x86_64 -machine q35 -cpu max -m 1024 -smp 2 -nographic -no-reboot \
  -device i6300esb -watchdog-action reset \
  -netdev user,id=net0,hostfwd=tcp:127.0.0.1:8080-:8080 -device virtio-net-pci,netdev=net0 \
  -drive if=pflash,format=raw,unit=0,readonly=on,file=/usr/share/OVMF/OVMF_CODE_4M.secboot.fd \
  -drive if=pflash,format=raw,unit=1,file=vars.fd \
  -drive if=none,id=disk0,format=raw,file=disk.img \
  -device virtio-blk-pci,drive=disk0,bootindex=0
```

镜像是 128 MiB；第一次启动前 `truncate -s 1G disk.img`，给 DATA 留出扩展空间。看门狗设备
和带 `secboot` 的固件都是必需的。

**写进实体机器（未验证）。** 把整个镜像写入机器的 SATA、NVMe、SD 或 eMMC 介质，不要只写
一个分区，然后 `sync` 并回读比对（[刷写](../start/flashing.md)第 3 节）。内核没有 USB
驱动，所以机器不能从 U 盘启动这个镜像：介质要在另一个系统上写好。

> status: unsupported

## 首次启动

与 [`uefi-x64`](uefi-x64.md) 相同：早期 init 验证部署，DATA 扩展到介质末尾，健康门确认
启动起来的那一份。根的 init 是 OpenRC，micad 驱动的是各个包为这种 init 提供的服务
（`mica-core:docs/mica-core.md` 第 3.8 节）。

`mini-x64.basic` 不带 Web 控制台。它在 8080 端口提供 API，并在那里认领：

```sh
curl http://127.0.0.1:8080/api/v1/session        # {"state":"setup"}
curl -X POST -H 'content-type: application/json' \
  -d '{"password":"at-least-eight-bytes"}' http://127.0.0.1:8080/api/v1/setup
```

## 更新

`full`、`root` 与 `kernel` 归档，core 发布时还有 `core`，带有每块板都有的 A/B 切换、健康
确认与回滚。见[更新与回滚](../operate/updates.md)。

## 恢复

与 [`uefi-x64`](uefi-x64.md) 相同：只读诊断、手动回滚、配置重置与应用数据重置可用；
凭据恢复与恢复出厂被拒绝，因为这块板没有声明物理恢复动作；兜底是整盘重刷，代价是所有
分区和设备身份。见[恢复](../operate/recovery.md)。

## 已知限制

- 所有证据都是模拟器证据，不是现场证据。
- 完全没有 USB：需要从 USB 介质启动或安装的机器用不了这份镜像。
- 没有 Web 控制台，也没有 MQTT：`mini-x64.basic` 只带管理面、SSH 与容器。

## 认证结果

**绑定**：QEMU `q35`，OVMF Secure Boot 固件与 virtio-blk，运行 `mini-x64.basic`；没有
实体机器。

**归属**：Mica OS 项目拥有该移植及其认证。没有厂商，也没有在案的集成商。

模拟器的行是关于被模拟平台的证据，从不算作实机通过。该产品的每次发布运行都会在 QEMU 下启动它一次。

| 行 | 结果 | 日期 | 证据 / 原因 |
|---|---|---|---|
| QEMU 运行时、组件更新、试验回退、故障恢复 | pass | 2026-09-30 | `mini-x64.basic` 上的 UEFI 生命周期套件，`mica-build:tests/suites/lifecycle-uefi` |
| 安装与首次启动 | not tested | — | 没有实体机器 |
| 冷启动与热启动 | not tested | — | 没有实体机器 |
| A/B 切换与更新 | not tested | — | 没有实体机器 |
| 更新中断电 | not tested | — | 没有实体机器 |
| 存储扩展 / 健康 | not tested | — | 没有实体机器；闪存寿命未认证 |
| 恢复 | not tested | — | 没有实体机器 |
| 射频与现场总线 | N/A | — | 这块板没有声明 |

> status: board-dependent — evidence: `mica-build:boards/mini-x64/evidence.json`, `mica-build:tests/suites/lifecycle-uefi/boot.sh`, `mica-build:README.md`
