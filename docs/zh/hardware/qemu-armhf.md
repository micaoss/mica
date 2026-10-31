# qemu-armhf：带 NOR 闪存的 QEMU 32 位 Arm virt 机器

`qemu-armhf` 是 Mica OS 的 32 位 Arm 与 UBI 参考：QEMU 的 `virt` 机器，Cortex-A15，
由 U-Boot 从 NOR 闪存启动，根在 UBI 上。它背后没有硬件。唯一的产品
`qemu-armhf.basic` 运行 OpenRC，带管理面与 SSH。状态以[状态表](README.md#当前板卡)为准。

## 概况

| | |
|---|---|
| 架构 | `armhf` |
| 启动链 | 第一块 NOR 上的 U-Boot → 从 UBI 读出的 FIT（校验哈希，不校验签名）→ 内核与 initramfs → 经认证的原生 init → SYSTEM → 签名 verity root/support → OpenRC |
| 固件形态 | `mtd-loader`——U-Boot 是闪存的第一个区域 |
| 分区 | MTD 区域 `u-boot`、`boot-rest`、`ubi`；UBI 卷 records、SYSTEM 与 DATA |
| 体积预算 | 44 MB（`BOARD_SIZE_BUDGET_MB`）；根是 xz squashfs |
| 支持层级 | bring-up（QEMU） |
| 启动保证等级 | I1 |

启动信任为 none：QEMU 把它自己的控制设备树交给 U-Boot，无法在里面嵌入密钥，所以
U-Boot 只校验 FIT 的哈希、不校验签名。内核要求签名的 verity 根。启动链里没有厂商
二进制。

## 硬件与功能状态

| 功能 | 状态 | 说明 |
|---|---|---|
| NOR 闪存（CFI，两块 64 MiB）上的 UBI | QEMU 下已验证 | 启动测试会挂上 UBI 区域 |
| 看门狗（i6300esb） | QEMU 下已验证 | 由内核启用；引导器没有看门狗 |
| 网络 | virtio-net | — |
| 显示、Wi-Fi、蓝牙、状态灯、CAN、USB gadget、容器 | 无 | `BOARD_FEATURES=""` |
| 实体恢复动作 | 无 | 这块板上凭据恢复与全出厂重置会被拒绝 |

> status: board-dependent — evidence: `mica-build:boards/qemu-armhf/board.env`, `mica-build:boards/qemu-armhf/evidence.json`

## 分区布局

| 区域 | 角色 | 偏移 | 大小 |
|---|---|---|---|
| `u-boot` | 引导器 | 0 | 1 MiB |
| `boot-rest` | 第一块闪存的其余部分，已擦除 | 1 MiB | 63 MiB |
| `ubi` | UBI：records 卷、SYSTEM 与 DATA | 64 MiB | 64 MiB |

擦除块为 256 KiB。权威的几何定义是 `mica-build:boards/qemu-armhf/flash.tsv`。

## 控制台

QEMU 的 PL011，`console=ttyAMA0`，用 `-nographic` 时就在运行 QEMU 的终端里。

## 获取镜像

产品是 `qemu-armhf.basic`，发布名为 `qemu-armhf.basic.<YYYYMMDD-HHMM>`，闪存镜像为
`mica-qemu-armhf.basic-<YYYYMMDD-HHMM>.img.gz`。校验见[下载](../start/download.md)。

## 刷机

**在 QEMU 下（产品镜像未验证）。** 闪存镜像包含两块闪存，共 128 MiB；把它拆成两个
`pflash` 驱动器再启动：

```sh
gunzip -k mica-qemu-armhf.basic-<YYYYMMDD-HHMM>.img.gz
dd if=mica-qemu-armhf.basic-<YYYYMMDD-HHMM>.img of=pflash0.img bs=1M count=64
dd if=mica-qemu-armhf.basic-<YYYYMMDD-HHMM>.img of=pflash1.img bs=1M skip=64
qemu-system-arm -M virt,highmem=off -cpu cortex-a15 -m 128M -nographic -no-reboot \
  -drive if=pflash,format=raw,file=pflash0.img \
  -drive if=pflash,format=raw,file=pflash1.img \
  -device i6300esb
```

机器参数和闪存拆分来自板卡的启动测试，它用测试 initramfs 启动 U-Boot 和内核；还没有
套件这样启动过产品镜像。

> status: unsupported

## 首次启动

和其他板卡一样：早期 init 校验部署，健康闸确认启动的部署。DATA 是固定大小的 UBI 卷，
不会扩展。根的 init 是 OpenRC，micad 驱动每个包为这种 init 带上的服务
（`mica-core:docs/mica-core.md` 第 3.8 节）。

`qemu-armhf.basic` 不带 Web 控制台；API 在 8080 端口。

## 更新

板卡声明的更新包种类见 `mica-build:boards/qemu-armhf/images.tsv`，A/B 切换、健康确认
与回滚和每块板一样；两个部署及其记录都是 UBI 卷。见[更新与回滚](../operate/updates.md)。

## 恢复

只读诊断、手动回滚、配置重置与应用数据重置可用；恢复出厂需要管理员密码，并且要用
core 0.0.4 构建的镜像（2026-10-21 的 `qemu-armhf.basic` 镜像会拒绝它）；凭据恢复被
拒绝，因为这块板没有声明物理恢复动作。兜底是在主机上重写闪存镜像，代价是所有卷和设备身份。
见[恢复](../operate/recovery.md)。

## 已知限制

- 所有证据都是模拟器证据；没有可认证的硬件。
- FIT 不签名：能写闪存的人就能替换内核。verity 根仍然必须签名。
- 没有 Web 控制台、MQTT 和容器引擎：`qemu-armhf.basic` 只带管理面与 SSH。

## 认证结果

**绑定**：QEMU `virt`（`highmem=off`、Cortex-A15、128 MiB），两块 CFI 闪存；没有实体
机器。

**归属**：Mica OS 项目拥有该移植及其认证。没有厂商，也没有在案的集成商。

模拟器的行是关于被模拟平台的证据，从不算作实机通过。

| 行 | 结果 | 日期 | 证据 / 原因 |
|---|---|---|---|
| 引导器与内核从 UBI 启动、试验计次、两份记录 | pass | 2026-10-17 | 板卡的启动测试，`mica-build:boards/qemu-armhf/tests/boot/run.sh` |
| 安装与首次启动 | not tested | — | 没有套件启动产品镜像 |
| 冷启动与热启动 | not tested | — | 没有实体机器 |
| A/B 切换与更新 | not tested | — | 没有套件启动产品镜像 |
| 更新中断电 | not tested | — | 没有实体机器 |
| 存储扩展 / 健康 | N/A | — | DATA 是固定大小的 UBI 卷 |
| 恢复 | not tested | — | 没有实体机器 |
| 射频与现场总线 | N/A | — | 这块板没有声明 |

> status: board-dependent — evidence: `mica-build:boards/qemu-armhf/evidence.json`, `mica-build:boards/qemu-armhf/tests/boot/run.sh`
