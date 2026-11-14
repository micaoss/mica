# 一页读懂 Mica OS

Mica OS 是面向工业设备的嵌入式 Linux 系统：一个签名的只读 dm-verity 根、一个独立
签名的内核与 support 镜像、两份基于文件的 A/B 部署，以及一套带控制台的本地管理 API。
一台设备运行一个*产品*：板卡加变体，变体决定该产品的 init 与所选特性。本页说明各个
部件、一个发布如何由它们构成，以及文件都在哪里。

系统地图是 [../../architecture.md](../../architecture.md)。从源码构建系统见
[构建指南](../start/build.md)，镜像进入板卡见[刷写](flashing.md)，选更新见
[更新包](../operate/updates.md)，维护者切发布见[发布](../releases/how-releases-work.md)，
新板卡的引入见[移植](https://github.com/micaoss/mica-build/blob/main/boards/README.md)。

## 1. 仓库

| 仓库 | 产出 |
|---|---|
| `mica-build-tools` | release lock 与构建规则的唯一实现，即其它每个仓库里的 `bin/mica-tools` |
| `mica-build-env` | 构建镜像 `base`、`c`、`go`、`rust`、`bsp`，以及每个仓库都遵守的构建规则 |
| `mica-system-base` | 与板卡无关的基础系统：固定版本的 Debian 包、Base 自己的包（系统策略、busybox、两种 init `mica-systemd` 与 `mica-openrc`、SSH、Wi-Fi、蓝牙、时区）以及不带 init 的基础根 |
| `mica-core` | core 组件 `micad`（含 `mica-apid`）与控制台 `mica-apid-ui`——启动时叠加在 root 上的 verity 镜像，不换 root 就能更新——以及软件包 `mica-deploy` 与 `mica-lifecycle` |
| `mica-pkgs` | 产品可选的功能包：MQTT broker 与桥（各自为两种 init 带上自己的服务）、SFTP 服务器，以及云产品的 Compute Engine 代理 |
| `mica-podman` | 容器引擎包 `mica-podman` 及其监管进程 `mica-containerd`，两种 init 都支持 |
| `mica-docker` | Docker 引擎包 `mica-docker`，产品可带的另一种容器引擎 |
| `mica-linux`、`mica-uboot` | 各板卡构建所用的内核与 U-Boot 源码树：上游镜像加每块板一个分支，按提交固定 |
| `mica-build` | 板卡（按板卡：内核、U-Boot、固件、板卡元数据以及板卡包）与组装：组合每个产品的根、给组件签名，并发布镜像、更新归档和 core 集合 |
| `mica-res` | 资源服务 `res.micaos.dev`：每个发布的文件、设备更新目录以及传输索引 |
| `mica` | 本仓库：指南、契约与官网 |

> status: shipped — evidence: `docs/architecture.md`, `docs/reference/release-lock.md`, `mica-build:boards`, `mica-system-base:docs/floor-and-options.md`

## 2. 发布链

每个仓库都发布 release，每个消费方把自己所构建于的 release 固定为一份 lock 加一条
pin 记录，而不是一个分支（[发布锁](../../reference/release-lock.md)）。每个 pin 都是
产出方的最新发布：`bin/mica-tools locks update` 一次移动全部 pin，加 `--check` 只报告
哪些落后了。

```text
mica-build-env ─▶ mica-system-base ─▶ mica-podman ─┐
               │                  ├─▶ mica-docker ─┤
               │                  └─▶ mica-pkgs ───┤
               └─▶ mica-core ─────────────────────┴─▶ mica-build ─▶ <board>.<variant>.<stamp>
                                                                  └▶ core.<channel>.<stamp>
```

- `mica-build-env` 是构建的地基：其它每个仓库都在它的镜像里构建。它每月移动自己的
  pin，通过后发布。
- `mica-system-base` 发布基础根以及产品要安装的软件包池，并且每月自动更新（Debian
  快照、上游源码、信任锚），通过后发布。
- `mica-core`、`mica-pkgs`、`mica-podman` 和 `mica-docker` 把各自的软件包发布进各自
  的池；`mica-podman` 与 `mica-docker` 每周跟进上游最新发布，通过后发布。
- `mica-build` **一次发布一个产品**，`<board>.<variant>.<YYYYMMDD-HHMM>`，经由它的
  `release.yml`：产品所在板卡的组件与池，以及产品本身，一份压缩磁盘镜像和更新归档。
  没有发布索引；一个产品的最新 release 就是要取的那个。`dev` 产品从不发布。*core 发布*
  （`core.<channel>.<YYYYMMDD-HHMM>`，经由 `release-core.yml`）把 core 组件单独发布为一份
  core 集合，所以 `mica-core` 的发布不换 root 就能到达设备。
- 发布流程随后把这个发布推送到资源服务（`mica-build:README.md`）：文件由
  `https://dl.res.micaos.dev/mica/<board>.<variant>/<stamp>/` 提供，每个对象带有
  自己的传输索引，`https://res.micaos.dev/update/` 是设备配置的更新根地址，官网下载页读的也是它。
  `mica-build` 的 GitHub release 里有同样的文件。
- 每个仓库的历史与发布都保持精简：仓库可能被压缩成一个提交、被取代的发布会被删除，
  所以文档只在某个发布是当前发布时才点名它。

> status: shipped — evidence: `docs/reference/release-lock.md`, `mica-build:README.md`, `mica-build-tools:README.md`

## 3. 产品与板卡

板卡分两类：**通用系统**按固件类与架构命名（`uefi-x64`、`uefi-arm64`、`mini-x64`），
一个镜像服务于该类的每一台机器；**硬件板**按硬件命名（`cx3576`、`s905x5m`、`ssd202d`）。`qemu-armhf` 是 QEMU 的 32 位 Arm 机器，
背后没有硬件。一个新
变体到底是新板卡、新产品，还是仅仅另一种镜像类型，按下表判断。板卡名从不含点；产品名、
标签与文件名按点解析。

内核、加载器与分区布局属于板卡；根里装了什么属于产品；用户下载的文件是该产品的一种镜像
类型（板卡的 `images.tsv`）。

| 变体改变的是 | 它是 |
|---|---|
| 内核、加载器或磁盘布局 | 新板卡 |
| 只有根里装的东西 | 现有板卡上的一个产品 |
| 只有下载文件的格式 | 一种镜像类型，按产品选择 |

产品是 `<board>.<variant>`（`mica-build:boards/products.md`）。变体名说明产品用来
做什么，每块板自己命名：没有哪个变体是默认的，也没有哪个变体被定义为另一个加上
某项功能。现有的产品，以及哪些已经发布：

| 产品 | 带什么 | 已发布 |
|---|---|---|
| `cx3576.full` | systemd、管理面与控制台、OpenSSH、工具、MQTT、WiFi 与蓝牙、Docker | 是 |
| `s905x5m.emmc-full`、`s905x5m.sd-full` | systemd、管理面与控制台、Dropbear、工具、MQTT、WiFi 与蓝牙、Podman；分别装在 eMMC 或 SD 卡上 | 是 |
| `uefi-x64.full` | systemd、管理面与控制台、Dropbear、工具与 MQTT、Podman | 是 |
| `uefi-x64.docker` | 同上，换成 Docker | 是 |
| `mini-x64.basic` | OpenRC、管理面与控制台、Dropbear；面向 128 MB 闪存 | 是 |
| `qemu-armhf.basic` | OpenRC、管理面与控制台、Dropbear | 是 |
| `uefi-x64.gcp` | 用于 Google Compute Engine：systemd、管理面与控制台、首次启动即开启的 OpenSSH（登录账号来自实例元数据）、Docker，不做局域网发现 | 是 |
| `uefi-x64.gcp-tpm2` | `uefi-x64.gcp` 加上用实例 TPM 加密的 DATA | 否；测试产品 |
| `uefi-x64.basic`、`uefi-arm64.basic`、`cx3576.basic`、`s905x5m.basic` | 对应产品去掉容器引擎 | 否 |
| `uefi-arm64.full` | 与 `uefi-x64.full` 相同，跑在 arm64 上 | 否 |
| `uefi-x64.openrc-full` | `uefi-x64.full` 的内容，跑在 OpenRC 上 | 否 |
| `uefi-x64.base` | 只有 Base 加 Podman：没有 micad 和控制台，SSH 从首次启动起开启，更新走 `auto` 策略 | 否 |
| `ssd202d.basic` | OpenRC、管理面与控制台、Dropbear，装在 SPI NAND 上 | 否：`ssd202d` 不是发布目标 |
| `<board>.dev`、`s905x5m.emmc-dev` | 开发构建（`PROFILE=dev`） | 从不；只在本地构建 |

没有 minimal 产品。目前除 `uefi-x64.gcp` 外，每个已发布的产品认领时都不要求
设备码（`CLAIM_DEVICE_CODE=off`）；云产品要求设备码。

除 `ssd202d` 外，每一块板都是发布目标。**这意味着它的产品会被发布；它不是“这块板能在实机上启动”的
断言**——`uefi-arm64` 的合格范围仍只有 QEMU，`s905x5m` 仍停在 bring-up 层级、实机行
未测（[支持层级](../hardware/README.md#当前板卡)）。它甚至不是“这个镜像
被启动过”的断言：没有任何套件会启动产品的 FIT 镜像，所以 `cx3576` 与 `s905x5m` 的产品在这棵
树里没有任何东西会启动它们。

> status: board-dependent — evidence: `docs/hardware/README.md`, `mica-build:boards/products.md`, `mica-build:boards/boards.tsv`

## 4. 文件都在哪里

所有发布物都是对应仓库的 GitHub Release，外加 `ghcr.io/micaoss/<repository>` 里的
OCI 产物；两者都是公开的，不需要 token 就能读。

| 我要什么 | 在哪里 |
|---|---|
| 某个产品的最新发布 | `micaoss/mica-build` 中标签以 `<board>.<variant>.` 开头的最新 release |
| 某个产品的镜像 | 那个 release：`mica-<board>.<variant>-<stamp>.img.gz` |
| 更新归档 | 同一个 release：`mica-<board>.<variant>-<stamp>.micaupd`，以及该 release 发布了的 `.root.micaupd` 或 `.kernel.micaupd` |
| 一个 release 由什么构成 | release 里的 `mica-build.lock`，以及它旁边的 `SHA256SUMS` |
| 同样字节的 OCI 形态 | `ghcr.io/micaoss/mica-build:image.<board>.<variant>.<stamp>` 和 `update.<board>.<variant>.<stamp>` |

镜像以 gzip 压缩发布，不上传裸镜像；每个镜像层都记录解压后的 sha256 和大小，所以
下载在解压前后都能校验。

> status: shipped — evidence: `docs/reference/release-lock.md`, `mica-build:boards/products.md`

## 5. 还没有的东西

- 唯一的板卡专用刷写格式是 `s905x5m` 的 Amlogic USB 烧录包；其他板卡都只发布裸磁盘
  镜像。
- 没有套件启动 FIT 镜像：`lifecycle-uboot-fit` 读取组装好的介质（加载器、启动记录及其
  签名）而不启动它，U-Boot 板卡由人在实机上启动
  （[构建门](https://github.com/micaoss/mica-build/blob/main/README.md#build-and-verify)）。
- 没有发布的产品，下载页和更新根都不提供；它从源码构建。

> status: unsupported
