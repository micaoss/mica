# 产品

产品是一份镜像配方，名为 `<board>.<variant>`，单独发布为 `<board>.<variant>.<YYYYMMDD-HHMM>`。产品包含
什么由 `mica-build:boards/<board>/products/<variant>/product.env` 声明；每个键的规则见
`mica-build:boards/products.md`。本页按 `mica-build` `main` 列出已发布的产品及各自包含的内容。选哪块板
见[硬件](../hardware/README.md)；发布如何切出与命名见[发布说明](../releases/release-notes.md)。

## 已发布的产品

| 产品 | 板卡 | 架构 | init | 特性 | 容器 | SSH 服务器 | 镜像 |
|---|---|---|---|---|---|---|---|
| `uefi-x64.full` | uefi-x64 | amd64 | systemd | micad、ui、ssh、tools、mqtt、containers、iproute2 | Podman | dropbear | `disk` |
| `uefi-x64.docker` | uefi-x64 | amd64 | systemd | micad、ui、ssh、tools、mqtt、containers、iproute2 | Docker | dropbear | `disk` |
| `uefi-x64.gcp` | uefi-x64 | amd64 | systemd | micad、ui、ssh、tools、containers、iproute2；组件 `gce` | Docker | OpenSSH | `disk`、`gce` |
| `mini-x64.basic` | mini-x64 | amd64 | OpenRC | micad、ui、ssh | — | dropbear | `disk` |
| `cx3576.full` | cx3576 | arm64 | systemd | micad、ui、ssh、tools、mqtt、containers、iproute2、wifi、bluetooth | Docker | OpenSSH | `disk` |
| `s905x5m.sd-full` | s905x5m | arm64 | systemd | micad、ui、ssh、tools、mqtt、containers、iproute2、wifi、bluetooth | Podman | dropbear | `disk`、`sd-boot` |
| `s905x5m.emmc-full` | s905x5m | arm64 | systemd | micad、ui、ssh、tools、mqtt、containers、iproute2、wifi、bluetooth | Podman | dropbear | `usb-burn` |
| `qemu-armhf.basic` | qemu-armhf | armhf | OpenRC | micad、ui、ssh | — | dropbear | `disk` |

所有已发布的产品都是 `PROFILE=prod`。各特性的含义：

| 特性 | 根中包含 |
|---|---|
| `micad` | 管理守护进程及其 HTTP API，作为 core 组件（[micad](management.md)） |
| `ui` | 位于 `/_ui/` 的内置 Web 控制台；没有它设备只有 API |
| `ssh` | 一个 SSH 服务器，由 micad 以 `mica-sshd` 驱动 |
| `tools` | busybox 之外的运维工具：GNU coreutils、findutils、grep、sed、diffutils、gzip、bash、进程与模块工具、device-mapper 工具、nftables 命令 |
| `mqtt` | MQTT 代理和桥接（`mica-mqtt-broker`、`mica-mqttd`） |
| `containers` | 容器引擎，Podman（经 `mica-containerd` 驱动）或 Docker（[容器](../integrate/containers.md)） |
| `iproute2` | `ip`、`ss`、`bridge`、`tc`，用于诊断链路和路由 |
| `wifi`、`bluetooth` | 板卡具备时的无线电 |

## 各产品的设置

| 产品 | 设备码来源 | 认领是否要求设备码 | mDNS / SSDP | 云管理员 | 首次启动 SSH | 看门狗 | DATA 加密 |
|---|---|---|---|---|---|---|---|
| `uefi-x64.full`、`uefi-x64.docker` | `dmi-serial` | 关 | 开 | 关 | 关 | `watchdog0` | 关 |
| `uefi-x64.gcp` | `random` | 要求 | 关 | 开 | 开 | `Software Watchdog`（softdog） | 关 |
| `mini-x64.basic` | `dmi-serial` | 关 | 开 | 关 | 关 | `watchdog0` | 关 |
| `cx3576.full` | `emmc-cid` | 关 | 开 | 关 | 关 | `watchdog0` | 关 |
| `s905x5m.sd-full`、`s905x5m.emmc-full` | `emmc-cid` | 关 | 开 | 关 | 关 | `watchdog0` | 关 |
| `qemu-armhf.basic` | `mac` | 关 | 开 | 关 | 关 | `watchdog0` | 关 |

`product.env` 中没有对应键的列，取键规则给出的默认值。除 GCP 产品外，所有产品的 `CLAIM_DEVICE_CODE`
都是 `off`，因为它们的序列号是标签上不会印的占位值，或者设备码只在串口控制台上显示。每个已发布的产品都
内置更新策略：每 1440 分钟对 `https://res.micaos.dev/update/` 执行 `check`
（[更新引擎](updates.md#策略文档)）。

## 各板卡的事实

| 板卡 | 启动 | 存储 | 大小预算 | 板卡特性 | 发布目标 |
|---|---|---|---|---|---|
| uefi-x64 | systemd-boot（UKI） | GPT | 520 MB | containers | 是 |
| uefi-arm64 | systemd-boot（UKI） | GPT | 520 MB | containers | 是（尚未发布产品） |
| mini-x64 | systemd-boot（UKI） | GPT | 130 MB | containers | 是 |
| cx3576 | U-Boot，签名 FIT | GPT | 400 MB | wifi、bluetooth、display、status-led、can、usb-gadget、containers | 是 |
| s905x5m | U-Boot，签名 FIT | GPT | 400 MB | wifi、bluetooth、display、audio、containers | 是 |
| qemu-armhf | U-Boot，只校验 FIT 哈希（`BOOT_TRUST=none`） | NOR 上的 UBI | 44 MB | — | 是 |

板卡的内核特性见[内核特性](kernel-features.md)；分区大小见[存储](storage.md#各板卡的分区)。

## 不发布的产品

代码树中还有只为开发或测试构建、从不发布的产品：所有 `dev` 和 `emmc-dev` 变体（`PROFILE=dev`）、
`uefi-x64.base`（没有 micad）、`uefi-x64.basic`、`uefi-arm64.basic`、`uefi-arm64.full`、`cx3576.basic`、
`s905x5m.basic`、`ssd202d.basic`，以及 `uefi-x64.gcp-tpm2`（`RELEASE=never`：开启 DATA 加密和 `tpm2`
密钥提供者的测试镜像）。

## 查看设备运行的是哪个产品

| 检查 | 预期 |
|---|---|
| 在设备上 `cat /usr/lib/mica/product.conf` | `PRODUCT=`、`FEATURES=`、`INIT=` 及上面的其他行 |
| `GET /api/v1/meta` | `features` 和文档根地址 |
| `GET /api/v1/system/info` | 板卡、产品和运行中的部署 |
