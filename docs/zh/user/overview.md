# 一页读懂 Mica OS

Mica OS 是面向工业设备的嵌入式 Linux 系统：一个签名的只读 dm-verity 根、一个独立
签名的内核与 support 镜像、两份基于文件的 A/B 部署，以及一套带控制台的本地管理 API。
一台设备运行一个*产品*：板卡加变体，变体决定该产品的 init 与所选特性。本页说明各个
部件、一个发布如何由它们构成，以及文件都在哪里。

系统地图是 [architecture.md](../../architecture.md)。从源码构建系统见
[构建指南](../../user/build.md)，镜像进入板卡见[刷写](flashing.md)，选更新见
[更新包](update-packages.md)，维护者切发布见[发布](../../user/releasing.md)，
新板卡的引入见[移植](https://github.com/micaoss/mica-build/blob/main/boards/README.md)。

## 1. 仓库

| 仓库 | 产出 |
|---|---|
| `mica-build-tools` | release lock 与构建规则的唯一实现，即其它每个仓库里的 `bin/mica-tools` |
| `mica-build-env` | 构建镜像 `base`、`c`、`go`、`rust`、`bsp`，以及每个仓库都遵守的构建规则 |
| `mica-system-base` | 与板卡无关的基础系统：固定版本的 Debian 包、Base 自己的包（系统策略、busybox、两种 init `mica-systemd` 与 `mica-openrc`、SSH、Wi-Fi、蓝牙、时区）以及不带 init 的基础根 |
| `mica-core` | core 组件 `micad`（含 `mica-apid`）与控制台 `mica-apid-ui`——启动时叠加在 root 上的 verity 镜像，不换 root 就能更新——以及 MQTT、SFTP、`mica-deploy` 与 lifecycle 二进制的软件包，每个都为两种 init 带上自己的服务 |
| `mica-podman` | 容器引擎包 `mica-podman` 及其监管进程 `mica-containerd`，两种 init 都支持 |
| `mica-res` | `res.micaos.dev` 背后的资源服务：下载站、发布目录与设备更新平面 |
| `mica-build` | 板卡（按板卡：内核、U-Boot、固件、板卡元数据以及板卡包）与组装：组合每个产品的根、给组件签名，并发布镜像和更新归档 |
| `mica` | 本仓库：设计契约、决策和指南 |

> status: shipped — evidence: `docs/architecture.md`, `docs/design/release-lock.md`, `mica-build:boards`, `mica-system-base:docs/floor-and-options.md`

## 2. 发布链

每个仓库都发布 release，每个消费方把自己所构建于的 release 固定为一份 lock 加一条
pin 记录，而不是一个分支（[发布锁](../../design/release-lock.md)）。每个 pin 都是
产出方的最新发布：`bin/mica-tools locks update` 一次移动全部 pin，加 `--check` 只报告
哪些落后了。

```text
mica-build-env ─▶ mica-system-base ─▶ mica-podman ─┐
               └─▶ mica-core ─────────────────────┴─▶ mica-build ─▶ <board>.<variant>.<stamp>
```

- `mica-build-env` 是构建的地基：其它每个仓库都在它的镜像里构建。它每月移动自己的
  pin，通过后发布。
- `mica-system-base` 发布基础根以及产品要安装的软件包池，并且每月自动更新（Debian
  快照、上游源码、信任锚），通过后发布。
- `mica-core` 和 `mica-podman` 把各自的软件包发布进各自的池；`mica-podman` 每周跟进
  上游最新发布，通过后发布。
- `mica-build` **一次发布一个产品**，`<board>.<variant>.<YYYYMMDD-HHMM>`，经由它的
  `release.yml`：产品所在板卡的组件与池，以及产品本身，一份压缩磁盘镜像和更新归档。
  没有发布索引；一个产品的最新 release 就是要取的那个。`dev` 产品从不发布。*core 发布*
  沿用上一个发布的 kernel 与 root、换上新的 core 组件，所以 `mica-core` 的发布不换 root
  就能到达设备。
- 每个发布都应推送到 `mica-res`：它保存完整历史，从 `dl.res.micaos.dev` 提供文件，生成
  官网读取的目录，并在 `res.micaos.dev/v1` 提供设备更新平面
  （`mica-res:docs/spec/release-publishing.md`）。`mica-build` 还没有推送它的发布；在那之前，
  文件仍在 `mica-build` 的 GitHub release 里。
- 每个仓库的历史与发布都保持精简：仓库可能被压缩成一个提交、被取代的发布会被删除，
  所以文档只在某个发布是当前发布时才点名它。

> status: shipped — evidence: `docs/design/release-lock.md`, `mica-build:README.md`, `mica-build-tools:README.md`, `mica-res:docs/spec/release-publishing.md`

## 3. 产品与板卡

板卡分两类：**通用系统**按固件类与架构命名（`uefi-x64`、`uefi-arm64`、`mini-x64`），
一个镜像服务于该类的每一台机器；**硬件板**按硬件命名（`cx3576`、`s905x5m`）。一个新
变体到底是新板卡、新产品，还是仅仅另一种镜像类型，见
[命名规则](../../decisions/2026-09-16-board-and-product-naming.md)。

产品是 `<board>.<variant>`（`mica-build:boards/products.md`）：

| 变体 | 是什么 | 发布 |
|---|---|---|
| `basic` | 默认：管理面、控制台、SSH、工具与 MQTT，以及板卡的无线 | 是 |
| `full` | `basic` 加上容器引擎 | 是 |
| `dev` | 开发构建（`PROFILE=dev`） | 从不；只在本地构建 |

每块板都有 `basic`；`uefi-x64`、`uefi-arm64`、`cx3576` 与 `s905x5m` 另有 `full` 与
`dev`。`mini-x64` 面向 128 MB 闪存，只有 `mini-x64.basic`，它运行 OpenRC，带管理面、
SSH 与容器；其它每个产品运行 systemd。没有 minimal 产品
（[决策](../../decisions/2026-09-16-minimal-products-removed.md)）。

每一块板都是发布目标。**这意味着它的产品会被发布；它不是“这块板能在实机上启动”的
断言**——`uefi-arm64` 的合格范围仍只有 QEMU，`s905x5m` 仍停在 bring-up 层级、实机行
未测（[支持层级](../../boards/support-tiers.md#current-boards)）。它甚至不是“这个镜像
被启动过”的断言：没有任何套件会启动 FIT 镜像，所以 `cx3576` 与 `s905x5m` 的产品在这棵
树里没有任何东西会启动它们。

> status: board-dependent — evidence: `docs/boards/support-tiers.md`, `mica-build:boards/products.md`, `mica-build:boards/boards.tsv`

## 4. 文件都在哪里

所有发布物都是对应仓库的 GitHub Release，外加 `ghcr.io/micaoss/<repository>` 里的
OCI 产物；两者都是公开的，不需要 token 就能读。

| 我要什么 | 在哪里 |
|---|---|
| 某个产品的最新发布 | `micaoss/mica-build` 中标签以 `<board>.<variant>.` 开头的最新 release |
| 某个产品的镜像 | 那个 release：`mica-<board>.<variant>-<stamp>.img.gz` |
| 更新归档 | 同一个 release：`mica-<board>.<variant>-<stamp>.micaupd`，以及该 release 发布了的 `.root.micaupd`、`.kernel.micaupd` 或 `.core.micaupd` |
| 一个 release 由什么构成 | release 里的 `mica-build.lock`，以及它旁边的 `SHA256SUMS` |
| 同样字节的 OCI 形态 | `ghcr.io/micaoss/mica-build:image.<board>.<variant>.<stamp>` 和 `update.<board>.<variant>.<stamp>` |

镜像以 gzip 压缩发布，不上传裸镜像；每个镜像层都记录解压后的 sha256 和大小，所以
下载在解压前后都能校验。

> status: shipped — evidence: `docs/design/release-lock.md`, `docs/decisions/2026-09-15-release-images-and-products.md`

## 5. 还没有的东西

- 板卡专用的刷写格式（Rockchip 的 `update.img`、Amlogic 的烧录镜像）有设计但未实现：
  今天每块板只声明 `disk` 一种镜像类型。
- 没有任何东西会启动 FIT 镜像：不存在能启动它的套件，所以 `cx3576` 与 `s905x5m` 的
  产品被发布、却从未被启动（[构建门](https://github.com/micaoss/mica-build/blob/main/README.md) 第 4 节）。FIT 启动
  套件将是一套**新**套件；它没有被估过工，是一个用户决定。
- 发布还没有推送到 `mica-res`，所以它的下载站和设备更新平面今天都还不提供 Mica OS 的发布。

> status: unsupported
