# 快速上手

到一个运行中的 Mica OS 系统，最短且诚实的路径是：在 QEMU 里跑一个已发布的
`uefi-x64-dev` 镜像。这也是今天唯一已验证的路径——还没有任何实体机器从发布镜像
启动过（[刷写](../../user/flashing.md)）。

## 1. 需要什么

跑已发布镜像：`curl`、`jq`、`sha256sum`、`gzip`，以及带 OVMF secure-boot 固件的
`qemu-system-x86_64`。改为自己构建：可用的 docker daemon，加上 bash、make、git
和 python3——每一个编译器、文件系统工具和签名工具都运行在固定版本的 build-env
镜像里。

> status: shipped — evidence: `mica-build:tests/lifecycle-uefi/boot.sh`, `mica-build:Makefile`, `docs/user/build.md`

## 2. 取一个已发布的镜像

```sh
REL=https://github.com/micaoss/mica-build/releases/download
curl -fsSLO "$REL/uefi-x64/<release>/SHA256SUMS"
curl -fsSLO "$REL/uefi-x64/<release>/mica-uefi-x64-dev-<release>.img.gz"
sha256sum -c SHA256SUMS
gzip -dc mica-uefi-x64-dev-<release>.img.gz > disk.img
```

选哪个发布、以及如何用版本索引校验解压后的镜像，见[获取发布版](download.md)。
镜像是一整块 GPT 磁盘——ESP、SYSTEM、DATA——并携带两条签名部署记录。

> status: shipped — evidence: `docs/user/download.md`, `mica-build:build/src/file-layout.ts`

## 3. 在 QEMU 里启动它

guest 必须信任该发布的启动证书：验收套件把它注册进一次性的 secure-boot 变量
（由 `OVMF_VARS.fd`、ARM64 上由 `AAVMF_VARS.fd` 生成的 `vars.fd`），再把镜像作为
virtio 磁盘启动。参考命令行见
[刷写](../../user/flashing.md#4-qemu-x64-and-uefi-arm64)。

在 `mica-build` 检出里，这一整套是一个 target：

```sh
make lifecycle-uefi PRODUCT=uefi-x64-dev
```

它启动产品并依次验证运行时、更新、故障、重置和关机。

> status: shipped — evidence: `mica-build:tests/lifecycle-uefi/boot.sh`, `mica-build:make lifecycle-uefi`

## 4. 或者先自己构建镜像

```sh
make locks-verify
make os-pool
make product PRODUCT=uefi-x64-dev
make product-verify PRODUCT=uefi-x64-dev
```

产物落在 `mica-build:_out/products/uefi-x64-dev/`。构建不会凭空造出密钥或输入：签名
材料是显式的（`make os-devkeys` 写出一套开发密钥），每一项输入都来自 `locks/`。
在线与离线的完整路径见[构建指南](../../user/build.md)。

> status: shipped — evidence: `mica-build:Makefile`, `mica-build:tools/product-build.sh`, `docs/user/build.md`

## 5. 首次访问

首次启动会在 DATA 上播下设备身份，并只由这个身份推出主机名
（`mica-<前 8 位十六进制>`，绝不取自 DHCP 或 MAC），把 DATA 扩展到介质大小，
然后拉起 micad 和 apid。无论镜像如何，SSH 都是关闭的；此时还没有任何凭据，
设备处于**未认领**状态。

用 `POST /api/v1/setup`（密码至少 8 字节）认领它。成功返回 `201`，并给出一个
刚铸出的 API token，之后无法再取回——当场保存，否则只能走改密码那条路；对已认领
的设备返回 `409 already_configured`。完全没有网络的设备改用
`mica-provisioning.toml` 文档认领，见[首次启动](first-run.md)和[配置](configuration.md)。

> status: shipped — evidence: `mica-core:crates/micad/src/provisioning.rs`, `mica-core:crates/mica-apid`, `docs/design/provisioning.md`

## 6. 继续

- [刷写](../../user/flashing.md)——按板卡把镜像写进设备。
- [更新与回滚](update-rollback.md)和[更新包](../../user/update-packages.md)——让
  运行中的设备前进。
- [应用](applications.md)——负载与持久数据。

> status: shipped — evidence: `docs/user/flashing.md`, `docs/user/update-packages.md`, `docs/user/applications.md`
