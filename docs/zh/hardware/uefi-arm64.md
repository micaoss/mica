# uefi-arm64：通用 arm64 UEFI 机器

`uefi-arm64` 是 arm64 侧的**通用系统**：一份镜像服务于固件是 UEFI + ACPI 的 arm64
机器。它自 2026-09-16 起是发布目标，并携带了 virtio 之外的通用硬件驱动——但它的全部
证据仍然只有 QEMU aarch64 `virt`。**携带驱动不等于有证据证明某台机器能启动。**

现状快照记于 2026-09-20。事实来自英文板卡档案
[`docs/boards/uefi-arm64.md`](../../boards/uefi-arm64.md) 与
`mica-boards:boards/uefi-arm64/`；状态以[支持层级表](../../boards/support-tiers.md#current-boards)为准。

## 概况

| 项 | 值 |
|---|---|
| 架构 | `arm64` |
| 启动链 | UEFI 固件（注册了开发启动锚）→ 签名的 `EFI/BOOT/BOOTAA64.EFI` → 计数启动项 → 签名 UKI → 认证的 native init → SYSTEM → 签名的 verity root/support → systemd |
| 固件形态 | `efi`（引导器在 ESP 内） |
| 分区 | ESP / SYSTEM / DATA |
| 内核 | 主线 stable，与 `uefi-x64` 固定同一个 tag（当前 `v6.12.107`），故首次启动失败时不会分不清是移植问题还是内核版本问题 |
| 发布目标 | 是（自 2026-09-16） |
| 支持层级 | bring-up（QEMU 参考） |
| 启动保证等级 | I1 |

启动链里**没有厂商 blob**，因为没有厂商——这是这块板存在的理由之一。

## 硬件与功能状态

| 功能 | 状态 | 说明 |
|---|---|---|
| 容器（Podman） | 随镜像发布 | `BOARD_FEATURES="containers"` |
| virtio-blk / virtio-net | QEMU 下已验证 | 全部证据都出自这条路径 |
| SATA（AHCI） | 内核内建，**携带但未合格** | 从未在实体机器上跑过 |
| NVMe | 内核内建，**携带但未合格** | — |
| USB 存储（xHCI / EHCI） | 内核内建，**携带但未合格** | — |
| 常见网卡（e1000、igb、igc、ixgbe、r8169、tg3、mlx5、aqtion） | 以**模块**携带，未合格 | 网络不在挂载 root 的路径上，模块从签名的 support 镜像加载 |
| MMC / SD / eMMC | **刻意不支持** | 完全没有 MMC 驱动：从平台 MMC 控制器启动的机器是另一块硬件板，不是这份镜像 |
| RTC | 内核内建（PL031、EFI） | QEMU 下可用 |
| Wi-Fi / 蓝牙 | 无 | 镜像里没有 bluez、wpasupplicant、hostapd |
| 状态灯、CAN、USB gadget、硬件初始化 | 无 | `BOARD_HWINIT_CONFS=""`、`BOARD_FIRMWARE_FILES=""` |
| 物理恢复动作 | 无 | `BOARD_RECOVERY_ACTIONS=""`，凭据恢复与恢复出厂在这块板上一律被拒 |

驱动集是被强制的，不是碰运气：`kernel/config/uefi-arm64.required` 列了 122 个符号，
解析后的配置少一个就构建失败。代价也记着：内核模块从 71 个增加到 232 个，`Image`
24.5 MB，CI 内核任务从 330 秒变成 718 秒。

## 分区布局

| 分区 | 角色 | 起点 | 大小 |
|---|---|---|---|
| `esp` | FAT，卷标 `MICAESP` | 1 MiB | 512 MiB |
| `system` | ext4 | 513 MiB | 1024 MiB |
| `data` | ext4 | 1537 MiB | 256 MiB（首次启动扩展到介质大小） |

root/support 组件是 SYSTEM 上的不可变文件，UKI 在 ESP 上；只有 DATA 在首次启动时
增长。`/var` 及其骨架保持只读。

## 控制台

**只有一个控制台**：PL011 UART，`console=ttyAMA0,115200n8`。刻意没有 `tty0`——
aarch64 `virt` 没有 VGA 也没有 framebuffer，写 `console=tty0` 就是给一个没有设备的
控制台起名字。

## 获取镜像

产品是 `uefi-arm64-dev` 与 `uefi-arm64-prod`。

**避开 `20260916-0845`、`20260916-1653`、`20260919-2103` 三轮**：这些镜像会在 PID 1
关机（板卡改名，被 pin 住的客户端没跟上）。取 `20260919-2356` 或更新的。

## 刷机

**在 QEMU 里跑**（唯一有证据的路径）：用 `virt-fw-vars` 把发布的启动证书写进 AAVMF
变量存储，然后

```sh
qemu-system-aarch64 -machine virt -cpu max -m 1024 -smp 2 -nographic -no-reboot \
  -device i6300esb -watchdog-action reset \
  -drive if=pflash,format=raw,unit=0,readonly=on,file=/usr/share/AAVMF/AAVMF_CODE.secboot.fd \
  -drive if=pflash,format=raw,unit=1,file=vars.fd \
  -drive if=none,id=disk0,format=raw,file=disk.img \
  -device virtio-blk-pci,drive=disk0,bootindex=0
```

guest 必须提供：PL011 控制台且只有一个、i6300esb 看门狗、PL031 或 EFI 的 RTC、
打开的 ACPI button（否则宿主请求的优雅关机传不进去）。完整说明、9p 导入离线更新的
做法，以及 `make lifecycle-uefi PRODUCT=uefi-arm64-dev` 这一整套验收，见
[刷写](../user/flashing.md) 第 4 节。

**写到实体 arm64 机器上（未验证）**：与 `uefi-x64` 同理，整盘写入，机器需信任该发布
的启动证书。没有任何实体 arm64 机器被验证过。

## 首次启动

与 `uefi-x64` 相同：DATA 扩容、出厂两份部署、三次尝试的计数启动项、健康门确认。
见[刷写](../user/flashing.md) 第 7 节。

## 更新

发布 `full`、`root`、`kernel` 三种归档。QEMU 里跑过 root-only、kernel-only 与组合
更新，包括三次健康失败后退回保留部署、固件与身份不变。见
[更新包](../user/update-packages.md)、[更新与回滚](../user/update-rollback.md)。

## 恢复

- 可用：只读诊断、手动回滚、配置重置、应用数据重置、整盘重写镜像。
- **不可用**：凭据恢复、恢复出厂（无物理在场断言）。
- 这块板的“恢复”就是在宿主上重写磁盘镜像：能写这个镜像文件的宿主已经等于换了设备，
  所以没有带内恢复需要保护。

见[恢复](../user/recovery.md)。

## 已知限制

- arm64 guest 在当前 amd64 测试宿主上以 TCG 运行，时间数据描述的是这个执行器，不是
  实体 arm64 机器。
- 通用硬件驱动是**携带的，不是合格的**：上面列的 AHCI、NVMe、USB、网卡都没在实体
  机器上跑过。
- 自动启动步骤只跑 amd64，所以这块板**没有自动启动记录**；现有 QEMU 证据早于
  2026-09-16 的板卡改名。
- 开发用的 Secure Boot 注册只存在于一次性的 AAVMF 变量里，不为别的平台的固件或调试
  策略背书。

## 验证记录

来自英文档案的合格表（绑定条件：QEMU aarch64 `virt`、`-cpu max`、virtio-blk、
实验室固定的 AAVMF 固件、新装配的三分区镜像）：

| 项 | 结果 | 日期 |
|---|---|---|
| 出厂布局与 root 组成 | 通过 | 2026-09-09 |
| 签名启动、运行时与干净关机 | 通过 | 2026-09-09 |
| 完整 apid API 套件 | 通过 | 2026-09-09 |
| root-only / kernel-only / 组合更新 | 通过 | 2026-09-09 |
| 元数据拒绝与尝试耗尽 | 通过 | 2026-09-09 |
| 网络 API | 通过 | 2026-09-09 |
| 实体断电 | 不适用 | 模拟存储 |
| 射频与现场总线 | 不适用 | 这块板不声明 |
| 物理恢复动作 | 不适用 | 不存在物理在场断言 |
