# 一页读懂 Mica OS

Mica OS 是面向工业设备的嵌入式 Linux 系统：一个签名的只读 dm-verity 根、一个独立
签名的内核与 support 镜像、两份基于文件的 A/B 部署，以及一套带控制台的本地管理 API。
一台设备运行一个*产品*：板卡加 profile 再加该产品选中的特性。本页说明各个部件、一个
发布如何由它们构成，以及文件都在哪里。

系统地图是 [architecture.md](../../architecture.md)。从源码构建系统见
[构建指南](../../user/build.md)，镜像进入板卡见[刷写](flashing.md)，选更新见
[更新包](update-packages.md)，维护者切发布见[发布](../../user/releasing.md)，
新板卡的引入见[移植](../../boards/porting.md)。

## 1. 七个仓库

| 仓库 | 产出 |
|---|---|
| `mica-build-env` | 构建镜像 `base`、`c`、`go`、`rust`、`bsp`，以及每个仓库都遵守的构建规则 |
| `mica-system-base` | 与板卡无关的基础系统：固定版本的 Debian 包、四个策略包和基础根镜像 |
| `mica-core` | `micad`、`mica-apid`、MQTT 服务、SFTP 服务器、`mica-deploy` 和 lifecycle 二进制 |
| `mica-podman` | 容器引擎包 `mica-podman` |
| `mica-boards` | 按板卡：内核、U-Boot、固件、板卡元数据以及该板的软件包 |
| `mica-build` | 组装：组合每个产品的根、给组件签名，并发布镜像、更新归档和版本索引 |
| `mica` | 本仓库：设计契约、决策、指南和工作区记录 |

> status: shipped — evidence: `docs/architecture.md`, `docs/design/release-lock.md`, `mica-build:products`, `mica-boards:boards`

## 2. 发布链

每个仓库都发布 release，每个消费方把自己所构建于的 release 固定为一份 lock 加一条
pin 记录，而不是一个分支（[发布锁](../../design/release-lock.md)）：

```text
mica-build-env ─▶ mica-system-base ─▶ mica-podman ─┐
               └─▶ mica-core ─────────────────────┤
               └─▶ mica-boards (per board) ───────┴─▶ mica-build ─▶ mica.<stamp>
```

- `mica-build-env` 是地基：其它每个仓库都在它的镜像里构建。
- `mica-system-base` 发布基础根以及产品要安装的软件包池。
- `mica-core` 和 `mica-podman` 把各自的软件包发布进各自的池。
- `mica-boards` **按板卡**发布，`<board>.<YYYYMMDD-HHMM>`，并发布该板的组件和池。
- `mica-build` **按作用域**发布，今天是 `<board>.<YYYYMMDD-HHMM>`，并发布该作用域下
  每个产品：一份压缩磁盘镜像和更新归档。
- 每次作用域发布成功之后，`mica-build` 切出**版本索引** `mica.<YYYYMMDD-HHMM>`，
  它列出每个已发布产品的最新 release。索引是 GitHub 的 latest release，所以最大的
  `mica.*` 标签就是最新的 Mica 版本。
- 自 2026-09-16 起，作用域标签用点号分隔作用域
  （[决策](../../decisions/2026-09-16-scoped-tags-use-a-dot.md)）；在那之前切的发布
  仍带斜杠，属于历史。

> status: shipped — evidence: `docs/design/release-lock.md`, `docs/design/mica-index.md`, `docs/decisions/2026-09-15-mica-version-index.md`

2026-09-16 的状态，其中有一句值得读两遍：**每一个已发布的产品都完全由已发布的
生产方构建，没有任何在途的 pin。** 六个 pin，每个在钉下时都经过匿名验证，没有一个
指向分支、本地构建或未发布的提交——`mica-boards` 的 `uefi-x64`、`uefi-arm64`、
`cx3576`、`s905x5m` 均为 `20260916-0857`，`mica-core` `20260916-0916`，
`mica-podman` `20260916-0846`，`mica-system-base` `20260915-1102`，
`mica-build-env` `20260916-0735`。

`mica-build` 基于这些 pin 发布了 `uefi-x64.20260916-1653`、
`uefi-arm64.20260916-1653` 和 `cx3576.20260916-1653`，索引 job 切出
`mica.20260916-1709`，它是 GitHub 的 latest release。索引在全新克隆里被逐字节重建过
两次：相对上一个索引的增量重建，以及基于它引用的全部三个发布的完整重建。

## 3. 产品与板卡

板卡分两类：**通用系统**按固件类与架构命名（`uefi-x64`、`uefi-arm64`），一个镜像
服务于该类的每一台机器；**硬件板**按硬件命名（`cx3576`、`s905x5m`）。一个新变体到底
是新板卡、新产品，还是仅仅另一种镜像类型，见
[命名规则](../../decisions/2026-09-16-board-and-product-naming.md)。

每一块板都是发布目标：`uefi-x64`、`uefi-arm64`、`cx3576` 和 `s905x5m`，最后这块自
2026-09-19 的用户决定起，首个发布是 `s905x5m.20260920-0033`。**是发布目标，意味着
这块板的镜像会被发布、它的产品会进入版本索引；它不是“这块板能在实机上启动”的断言**
——`uefi-arm64` 的合格范围仍只有 QEMU，`s905x5m` 仍停在 bring-up 层级、实机行未测
（[支持层级](../../boards/support-tiers.md#current-boards)）。它甚至不是“这个镜像被
启动过”的断言：没有任何套件会启动 FIT 镜像，所以 `cx3576` 与 `s905x5m` 这四个产品
在这棵树里没有任何东西会启动它们（[获取发布版](download.md)）。产品集合是四块板各一个 `dev`
与一个 `prod`，共八个。没有 minimal 产品
（[决策](../../decisions/2026-09-16-minimal-products-removed.md)）。

> status: board-dependent — evidence: `docs/boards/support-tiers.md`, `docs/decisions/2026-09-16-minimal-products-removed.md`, `docs/decisions/2026-09-15-release-images-and-products.md`

## 4. 文件都在哪里

所有发布物都是对应仓库的 GitHub Release，外加 `ghcr.io/micaoss/<repository>` 里的
OCI 产物；两者都是公开的，不需要 token 就能读。

| 我要什么 | 在哪里 |
|---|---|
| 最新的 Mica 版本 | `micaoss/mica-build` 中最大的 `mica.*` release（GitHub latest），它的 `mica-index.json` 列出每个产品的最新 release、资产 URL、大小和摘要 |
| 某个产品的镜像 | 作用域 release `<board>.<YYYYMMDD-HHMM>`：`mica-<product>-<stamp>.<suffix>.gz` |
| 更新归档 | 同一个 release：`mica-<product>-<stamp>.micaupd`，以及该 release 发布了的 `.root.micaupd` 或 `.kernel.micaupd` |
| 一个 release 由什么构成 | release 里的 `mica-build.lock`，以及它旁边的 `SHA256SUMS` |
| 同样字节的 OCI 形态 | `ghcr.io/micaoss/mica-build:image.<product>.<stamp>` 和 `update.<product>.<stamp>` |

镜像以 gzip 压缩发布，不上传裸镜像；每个镜像层都记录解压后的 sha256 和大小，所以
下载在解压前后都能校验。

> status: shipped — evidence: `docs/design/mica-index.md`, `docs/design/release-lock.md`, `docs/decisions/2026-09-15-release-images-and-products.md`

## 5. 还没有的东西

- 板卡专用的刷写格式（Rockchip 的 `update.img`、Amlogic 的烧录镜像）有设计但未实现：
  今天每块板只声明 `disk` 一种镜像类型。
- 没有任何东西会启动 FIT 镜像：不存在能启动它的套件，而两套会启动的套件都按名字
  拒绝 FIT 板，所以 `cx3576` 与 `s905x5m` 的产品被发布、却从未被启动
  （[构建门](../../design/build-harness.md) 第 4 节）。FIT 启动套件将是一套**新**
  套件；它没有被估过工，是一个用户决定。
- `s905x5m` 与 `uefi-arm64` 已从这份清单上移除：它们的产品镜像已经存在，自
  `s905x5m.20260920-0033` 与 `uefi-arm64.20260916-1653` 起。

> status: unsupported
