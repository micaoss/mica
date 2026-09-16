# 在设备上安装 Mica OS

安装是一次整盘写入：完整的工厂镜像替换目标介质。不存在从旧分区布局转换或升级的
路径，写入范围内的任何内容都不会保留。已经在运行 Mica OS 的设备用更新归档前进，
而不是重刷（[更新包](../../user/update-packages.md)）。

本页给出操作顺序。按板卡的写入过程——以及哪些板卡有过程可循——见
[刷写](../../user/flashing.md)。

> status: shipped — evidence: `mica-build:build/src/file-layout.ts`, `docs/user/flashing.md`, `docs/design/storage.md`

## 1. 选择并校验镜像

镜像按产品发布为 `mica-<product>-<release>.img.gz`，绑定一块板卡和一种架构；
profile（`dev` 或 `prod`）固化在该产品签名后的内核命令行里。从发布里取文件，
用 `SHA256SUMS` 校验，再把解压后的镜像与版本索引里的 `uncompressedSha256`
比较：[获取发布版](download.md)。自己构建的镜像，对应的门是
`make product-verify PRODUCT=<name>`。

校验和只能证明文件完整到达，它不说明谁签的名：发布的启动公钥证书要通过它所属的
交付渠道取得（[密钥交付](../../design/key-delivery.md)），而不是从下载文件旁边取。

> status: shipped — evidence: `docs/user/download.md`, `mica-build:make product-verify`, `docs/design/key-delivery.md`

## 2. 让板卡信任签名者

镜像的 kernel 与 support 组件都带签名，而安装时的校验不注册任何密钥。UEFI 板卡的
平台密钥里必须已经有该发布的启动证书——或者关闭 Secure Boot 运行，而 Mica OS 不把
这种安装视作可信——FIT 板卡的 U-Boot 只接受用编译进它的证书签名的内核。开发版本用
开发证书签名，不构成生产信任。

> status: shipped — evidence: `docs/design/release-signing.md`, `mica-boards:common/trust/stage.sh`, `docs/boards/assurance.md`

## 3. 写入镜像

| 板卡 | 方式 | 状态 |
|---|---|---|
| `uefi-x64` | 整个镜像写入介质，经 UEFI 启动 | 仅在 QEMU 下合格 |
| `uefi-arm64` | 注册了 secure-boot 变量的 QEMU guest | 验收路径 |
| `cx3576` | `mica-boards` 里经 USB 的 `rkdeveloptool`，带回读 | 未在实机上验证 |
| `s905x5m` | 没有受支持的路径：loader 在 eMMC boot0 里 | 属于 bring-up 工作 |

每种情况的命令、拒绝条件以及哪些还没有验证，都在
[刷写](../../user/flashing.md)。

> status: board-dependent — evidence: `docs/user/flashing.md`, `mica-boards:boards/cx3576/Makefile`, `mica-boards:boards/s905x5m/board.env`

## 4. 首次启动

正常的首次启动会认证选中的部署，挂载匹配的签名 root 与 support，在 DATA 上建立
设备身份，把 DATA 扩展到介质大小，并启动管理服务。健康确认保留另一个部署作为
回退。接下来会发生什么见[首次启动](first-run.md)。

共享存储缺失或损坏、启动记录耗尽时必须显式恢复：不会无签名重试，不会回落到旧
布局，不会重建凭据，也不会悄悄补充尝试次数。见[恢复](recovery.md)和
[存储](storage.md)。

> status: shipped — evidence: `mica-core:crates/mica-deploy`, `mica-system-base:debs/mica-system`, `docs/design/recovery.md`
