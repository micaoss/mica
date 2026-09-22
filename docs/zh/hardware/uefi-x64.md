# uefi-x64：通用 amd64 UEFI 机器

`uefi-x64` 不是一块板，而是一个**通用系统**：一份镜像服务于固件是 UEFI 的
amd64 机器，按启动它的固件类命名，而不是按某台机器命名。它也是这个项目的基线——
唯一有自动启动证据的目标。

现状快照记于 2026-09-20。状态以英文的
[支持层级表](../../boards/support-tiers.md#current-boards)为准。

**它没有板卡档案。**`docs/boards/` 下有 `cx3576`、`s905x5m` 和 `uefi-arm64` 的
档案，没有这一块。本页的事实来自 `mica-boards:boards/uefi-x64/board.env`、
`evidence.json`、内核配置，以及中文[刷写](../user/flashing.md)页。

## 概况

| 项 | 值 |
|---|---|
| 架构 | `amd64` |
| 启动链 | UEFI 固件 → 签名的 `EFI/BOOT/BOOTX64.EFI`（systemd-boot）→ 计数启动项 → 签名 UKI → 认证的 native init → SYSTEM → 签名的 verity root/support → systemd |
| 固件形态 | `efi`（引导器在 ESP 内） |
| 分区 | ESP / SYSTEM / DATA |
| 发布目标 | 是 |
| 支持层级 | bring-up（QEMU 基线） |
| 启动保证等级 | I1 |

## 硬件与功能状态

| 功能 | 状态 | 说明 |
|---|---|---|
| 容器（Podman） | 随镜像发布 | `BOARD_FEATURES="containers"` |
| USB 存储 | 内核内建驱动，未在实机验证 | XHCI 与 EHCI 加 `USB_STORAGE`；`USB_UAS` 未开，只支持 UAS 的硬盘盒会退回 bulk-only 或不被驱动 |
| SATA | 内核内建驱动，未在实机验证 | AHCI 与 `ATA_PIIX` |
| NVMe | 内核内建驱动，未在实机验证 | — |
| virtio-blk / virtio-scsi | QEMU 下已验证 | 自动启动用的就是这条路径 |
| MMC / SD 读卡器 | **不支持** | `CONFIG_MMC` 完全没开；USB 读卡器算普通 USB 大容量存储，不在此列 |
| Wi-Fi / 蓝牙 | 无 | `BOARD_FEATURES` 不含射频，镜像里没有 bluez、wpasupplicant、hostapd |
| 状态灯、CAN、USB gadget | 无 | 通用机器不声明这些 |
| 物理恢复动作 | 无 | `BOARD_RECOVERY_ACTIONS=""`，凭据恢复与恢复出厂因此在这块板上一律被拒 |

为什么这些存储驱动必须内建：verity root 没有 initramfs，root 挂上之前什么都加载不了。

> status: board-dependent — evidence: `mica-boards:boards/uefi-x64/board.env`, `mica-boards:boards/uefi-x64/kernel/config`, `mica-boards:boards/uefi-x64/evidence.json`

## 分区布局

| 分区 | 角色 | 起点 | 大小 |
|---|---|---|---|
| `esp` | FAT，卷标 `MICAESP` | 1 MiB | 512 MiB |
| `system` | ext4 | 513 MiB | 1024 MiB |
| `data` | ext4 | 1537 MiB | 256 MiB（首次启动扩展到介质大小） |

SYSTEM 恰好 1 GiB，同时容纳两份部署。ESP 携带 `EFI/BOOT/BOOTX64.EFI` 与
`loader/loader.conf`。权威几何在 `mica-boards:boards/uefi-x64/board.env`。

## 控制台

串口 `console=ttyS0,115200n8`；`net.ifnames=0`，网口按 `eth0` 寻址。

## 获取镜像

产品是 `uefi-x64-dev` 与 `uefi-x64-prod`，文件名 `mica-uefi-x64-<profile>-<release>.img.gz`。

**避开 `20260916-0845`、`20260916-1653`、`20260919-2103` 三轮**：这些镜像会在 PID 1
关机。取 `20260919-2356` 或更新的。校验与索引用法见[获取发布版](../user/download.md)。

## 刷机

**在 QEMU 里跑**（这是唯一被实际执行过的路径）：先用 `virt-fw-vars` 把发布的启动
证书注册进 OVMF 变量存储，再以 `qemu-system-x86_64 -machine q35` 启动解压后的镜像。
完整命令行见[刷写](../user/flashing.md) 第 4 节。

**写到实体机器上（未验证）**：整盘 `dd` 写入，不要写某个分区；写完 `sync` 并回读
比较。没有人在这个项目里做过一次实体写入，具体命令与告诫见[刷写](../user/flashing.md)
第 3 节。

**Secure Boot（未验证）**：机器必须把该发布的启动证书注册进固件的 `db`，或者关掉
Secure Boot。关掉它不削弱 root——签名的内核命令行里仍带
`dm_verity.require_signatures=1`。

> status: unsupported

## 首次启动

DATA 扩展到介质大小；镜像出厂就带两份签名部署（代次 g-1 和 g），所以更新不会让设备
失去可启动的回退；loader 每份部署一个启动项，三次尝试，健康门通过后 bless。
详见[刷写](../user/flashing.md) 第 7 节与[首次启动](../user/first-run.md)。

## 更新

通过更新归档升级，不要靠重刷（重刷会抹掉 DATA）。这块板发布 `full`、`root`、
`kernel` 三种归档，选哪个见[更新包](../user/update-packages.md)；A/B 切换、健康确认
与回滚见[更新与回滚](../user/update-rollback.md)。QEMU 里跑过完整的更新、故障与
回退验收。

## 恢复

- 可用的步骤：只读诊断、受保护的手动回滚、配置重置、应用数据重置、整盘重刷。
- **不可用**：凭据恢复与恢复出厂——两者由物理在场断言把关，而这块板不声明任何物理
  恢复动作，请求一律被拒（`403`，`presence_required`）。
- 兜底是整盘重刷：启动另一份介质并重写磁盘。代价是全部分区**以及设备身份**。
- 安全擦除不存在。设备要离开你的控制，销毁介质。

阶梯全文与每一步的代价见[恢复](../user/recovery.md)。

## 已知限制

- 全部证据都是 QEMU 证据，不是现场证据。
- 没有任何实体 amd64 机器被验证过：USB、SATA、NVMe 这几条路都只是“内核带着驱动”。
- 没有板卡档案，因此也没有合格矩阵；这块板的结论都散在别处。
- 没有 MMC 驱动：从平台 MMC 控制器启动的机器属于另一块硬件板。

## 验证记录

| 项 | 结果 | 说明 |
|---|---|---|
| QEMU 生命周期（API、电源动作、重启、运行时、更新、重置） | 通过 | 支持层级表记录的验收列 |
| 每次推送与每次发布自动启动 | 通过（自 2026-09-19） | amd64 产品启动到 guest 自己的通过标记 |
| 实体机器冷启动 / 写入 / 恢复 | 未测试 | 没有实机 |

> status: board-dependent — evidence: `docs/boards/support-tiers.md`, `mica-build:tests/suites/lifecycle-uefi/boot.sh`, `docs/design/build-harness.md`
