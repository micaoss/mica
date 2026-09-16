# 从源码构建 Mica OS

两种构建方式：**在线**，每个仓库对着自己固定的 release 构建；**离线**，并排放置的
检出互相构建。两者产出同一个产品镜像；发布走的是在线那条路。

构建背后的契约是[构建设计](../../design/build.md)，固定规则是
[发布锁](../../design/release-lock.md)；本页是操作者穿过它们的路径。

## 1. 前置条件

带 buildx 的 Docker、bash、make 和 git。每一个编译器、文件系统工具和签名工具都在固定
版本的 build-env 镜像里运行，并且有一条 lint 拒绝在宿主机上调用工具链。构建也不会从任何
软件包归档安装东西：工具链烤进镜像，按摘要拉取
（[决策](../../decisions/2026-09-16-toolchains-live-in-build-env.md)）。

有些 target 需要特权（repart 测试）或网络（拉取池和 lock）；`make help` 会逐条说明。

> status: shipped — evidence: `mica-build:Makefile`, `mica-build:make os-host-toolchain-lint`, `docs/design/build.md`

## 2. 每个仓库构建什么

| 仓库 | 构建 | 门 |
|---|---|---|
| `mica-build-env` | 五个构建镜像，含 `bsp` | `bash from.sh --check`、`bash tests/publish-test.sh` |
| `mica-system-base` | 四个策略包和基础根 | `bun run check`、`bun src/container.ts debs`、`bun src/container.ts rootfs --arch amd64\|arm64` |
| `mica-core` | 七个软件包 | `make check` |
| `mica-podman` | `mica-podman` | `make check` |
| `mica-boards` | 按板卡：内核、U-Boot、固件、板卡元数据、软件包 | `make check`；单块板用 `make <board>-<target>` |
| `mica-build` | 产品：根、签名组件、镜像和更新归档 | `make os-*` 系列 |

每个仓库只从 `locks/` 读取输入：某个生产方的 lock 和它的 pin。每个仓库都有
`make offline`，它从那些 lock 出发构建自己的产出。

> status: shipped — evidence: `mica-boards:Makefile`, `mica-podman:Makefile`, `mica-core:Makefile`, `mica-system-base:package.json`, `mica-build-env:from.sh`

## 3. 在线：构建一个产品镜像

在 `mica-build` 里：

```sh
make locks-verify                 # 每个 lock 和 pin，以及它们指向的东西
make board-fetch-all              # locks/ 里每个 board 行对应的板卡组件
make os-pool                      # 拉取并校验每个固定的归档，索引两个池
make product PRODUCT=uefi-x64-dev      # 该产品的全部闭包：组合、签名、镜像、更新归档
make product-verify PRODUCT=uefi-x64-dev
```

- `make products` 构建每个板卡是发布目标的产品。
- `make os-rootfs PRODUCT=<name>` 只组合根，
  `make os-components MICA_COMPONENT_ARGS='root|kernel|firmware|deployment|image|archive ...'`
  一次构建一个组件。
- 产物落在 `mica-build:_out/products/<name>/`（拉取到的板卡目录树在
  `_out/boards/<board>/`）。receipt 未变的产品不会重建。
- 把构建出的镜像写进板卡见[刷写](flashing.md)。

> status: shipped — evidence: `mica-build:Makefile`, `mica-build:tools/product-build.sh`

## 4. 只构建一个软件包或一个板卡组件

- 软件包：在它自己的仓库里构建，跑那个仓库的门（`mica-core`、`mica-podman` 和
  `mica-boards` 里是 `make check`，`mica-system-base` 里是
  `bun src/container.ts debs`）。只有声明版本被提升时软件包才会重建
  （[软件包版本](../../decisions/2026-09-15-package-versions.md)）。
- 单块板的组件：`mica-boards` 里的 `make <board>-<target>` 委托给该板自己的
  `Makefile`；`make check` 把板卡按契约约束住。
- 组装侧用 `make board-fetch BOARD=<board>` 从板卡的 release 读取它，并对照该板的
  `outputs.tsv` 校验。

> status: shipped — evidence: `mica-boards:Makefile`, `mica-build:Makefile`, `mica-boards:tools/boards.sh`

## 5. 离线：并排的检出

每个仓库都有 `make offline`，它从自己的 `locks/` 出发把发布产物构建到 `_out/offline/`
里，源码缓存是由 `tools/repos.sh` 管理、被 git 忽略的 `repos/`。工作区驱动把它们串起来：

```sh
make offline-chain                       # 在 mica-build 里；MICA_WORKSPACE 默认为 ..
make offline-chain PRODUCTS=uefi-x64-dev
```

它按依赖顺序在每个检出的一次性克隆里构建各个仓库，并从这些构建结果组合出产品。
过程很长，并且需要 docker。

在 amd64 工作站上，arm64 那一半是在模拟下构建的，所以离线构建得到的是一个**可用的**
arm64 根，而不是与已发布版本相同的字节；amd64 那一半则能逐字节复现发布。只有按架构
原生构建的 CI，才能回答某个 arm64 产物是否仍与它的发布一致。

> status: shipped — evidence: `mica-build:Makefile`, `mica-build:tools/offline-chain.sh`, `docs/design/release-lock.md`

`mica-build:tools/local-pins.sh` 让开发期间用并排检出自己的池顶替它的 release。

> status: shipped — evidence: `mica-build:tools/local-pins.sh`

## 6. 校验你构建出来的东西

- `make product-verify PRODUCT=<name>` 对照契约校验该产品的镜像；`make os-verify`
  校验一个已组装的镜像。
- `make os-smoke-test`、`os-smoke-negative-test` 和 `os-factory-root-gate` 在真正发布的
  根里执行真正发布的二进制，并证明反例确实会触发。
- `make lifecycle-uefi PRODUCT=<name>` 对一个 UEFI 产品跑 QEMU 生命周期套件（启动、
  运行时、更新、故障、重置、关机）。
- `make os-repart-test` 证明首次启动的扩容，`make os-layout-lint` 证明分区契约。

> status: shipped — evidence: `mica-build:Makefile`, `mica-build:make product-verify`, `mica-build:make lifecycle-uefi`

## 7. 构建不做的事

它不会凭空造出密钥或 release：签名输入是显式的（`make os-devkeys` 生成开发用输入），
其它输入来自 `locks/`。它也不发布：只有 release 才发布
（[发布](../../user/releasing.md)）。

> status: shipped — evidence: `mica-build:Makefile`, `docs/design/release-signing.md`
