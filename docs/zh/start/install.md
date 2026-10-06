# 在设备上安装 Mica OS

安装是一次整盘写入：完整的工厂镜像替换目标介质。不存在从旧分区布局转换或升级的
路径，写入范围内的任何内容都不会保留。已经在运行 Mica OS 的设备用更新归档前进，
而不是重刷（[更新包](../operate/updates.md)）。

本页给出操作顺序。按板卡的写入过程——以及哪些板卡有过程可循——见
[刷写](../start/flashing.md)。

> status: shipped — evidence: `mica-build:src/image/file-layout.ts`, `docs/start/flashing.md`, `docs/reference/storage.md`

## 1. 选择并校验镜像

产品的发布带有安装它所需的文件：磁盘镜像 `mica-<board>.<variant>-<stamp>.img.gz`，
`s905x5m` 的 eMMC 产品则是 USB 烧录包。它绑定一块板卡和一种架构；profile（`dev` 或
`prod`）固化在该产品签名后的内核命令行里。从发布里取文件，按发布给出的值校验它的
sha256 以及解压后镜像的 sha256：[获取发布版](download.md)。自己构建的镜像，对应的门是
`make product-verify PRODUCT=<name>`。

校验和只能证明文件完整到达，它不说明谁签的名：发布的启动证书指纹要从发布方经其他
渠道取得，而不是从下载文件旁边取（[安全生命周期](../../security/lifecycle.md)，英文）。

> status: shipped — evidence: `docs/start/download.md`, `mica-build:make product-verify`

## 2. 让板卡信任签名者

镜像的 kernel 与 support 组件都带签名，而安装时的校验不注册任何密钥。UEFI 板卡的
平台密钥里必须已经有该发布的启动证书——或者关闭 Secure Boot 运行，而 Mica OS 不把
这种安装视作可信，并且固件仍须具备 Secure Boot 功能——FIT 板卡的 U-Boot 只接受用编译进它的证书签名的内核。开发版本用
开发证书签名，不构成生产信任。

> status: shipped — evidence: `docs/security/signing.md`, `mica-build:src/boot/trust-stage.ts`, `docs/hardware/assurance.md`

## 3. 写入镜像

| 板卡 | 方式 | 状态 |
|---|---|---|
| `uefi-x64` | 整个镜像写入 U 盘、SATA 硬盘或 NVMe，经 UEFI 启动 | 仅在 QEMU 下运行过 |
| `uefi-arm64` | 整个镜像写入介质，经带 ACPI 的 UEFI 启动 | 仅在 QEMU 下运行过 |
| `mini-x64` | 整个镜像写入 SATA、NVMe、SD 或 eMMC 介质，不能用 USB；经 UEFI 启动 | 仅在 QEMU 下运行过 |
| `cx3576` | 经 USB 的 `rkdeveloptool`，带回读 | 未在实机上验证 |
| `s905x5m` | eMMC 产品用 USB 烧录包；`sd-full` 先用 USB 烧录引导加载器包，再把磁盘镜像写入 SD 卡 | 未在实机上验证 |

每种情况的命令、拒绝条件以及哪些还没有验证，都在
[刷写](../start/flashing.md)。UEFI 产品还可以用同一个镜像在 QEMU 里启动，完全不需要
设备（[刷写](../start/flashing.md)第 4 节）。

> status: board-dependent — evidence: `docs/start/flashing.md`, `mica-build:boards/cx3576/images.tsv`, `mica-build:boards/s905x5m/images.tsv`

## 4. 首次启动

正常的首次启动会认证选中的部署，挂载匹配的签名 root 与 support，在 DATA 上建立
设备身份，把 DATA 扩展到介质大小，并启动管理服务。健康确认保留另一个部署作为
回退。接下来会发生什么见[首次启动](first-run.md)。

共享存储缺失或损坏、启动记录耗尽时必须显式恢复：不会无签名重试，不会回落到旧
布局，不会重建凭据，也不会悄悄补充尝试次数。见[恢复](../operate/recovery.md)和
[存储](../operate/storage.md)。

> status: shipped — evidence: `mica-core:crates/mica-deploy`, `mica-system-base:debs/mica-system`, `docs/reference/recovery.md`
