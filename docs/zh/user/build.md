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
| `mica-build-env` | 五个构建镜像，含 `bsp` | `bash from.sh --check`、`bash tests/gates/publish-test.sh` |
| `mica-system-base` | 四个策略包和基础根 | `bun run check`、`bun src/container.ts debs`、`bun src/container.ts rootfs --arch amd64\|arm64` |
| `mica-core` | 七个软件包 | `make check` |
| `mica-podman` | `mica-podman` | `make check` |
| `mica-build` | 按板卡：内核、U-Boot、固件、板卡元数据、软件包（`make <board>-<target>`、`make board-pool`）；以及产品：根、签名组件、镜像和更新归档 | `make board-check` 和 `make os-*` 套件 |
| `mica-build` | 产品：根、签名组件、镜像和更新归档 | `make os-*` 系列 |

每个仓库只从 `locks/` 读取输入：某个生产方的 lock 和它的 pin。每个仓库都有
`make offline`，它从那些 lock 出发构建自己的产出。

> status: shipped — evidence: `mica-build:Makefile`, `mica-podman:Makefile`, `mica-core:Makefile`, `mica-system-base:package.json`, `mica-build-env:from.sh`

## 3. 在线：构建一个产品镜像

在 `mica-build` 里：

```sh
make locks-verify                 # 每个 lock 和 pin，以及它们指向的东西
make kernels firmware             # 每块板的内核与加载器（数小时）；单块板：make <board>-kernel
make board-pool                   # 板卡包和无线电包，两种架构
make board-fetch-all              # 每块板的 bundle：源码树、本地构建（否则取最近一次 release 的组件）
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

- 软件包：在它自己的仓库里构建，跑那个仓库的门（`mica-core` 和 `mica-podman`
  里是 `make check`，`mica-system-base` 里是 `bun src/container.ts debs`，
  板卡包和无线电包在 `mica-build` 里是 `make board-pool` 加
  `make board-package-gate`）。只有声明版本被提升时软件包才会重建
  （[软件包版本](../../decisions/2026-09-15-package-versions.md)）。
- 单块板的组件：`mica-build` 里的 `make <board>-<target>` 委托给该板自己的
  `Makefile`；`make board-check` 按契约约束该板。
- 装配用 `make board-fetch BOARD=<board>` 组装板卡的 bundle——源码树、本地的
  内核与加载器构建，或最近一次发布中输入相同的组件——并对照该板的 `outputs.tsv`
  检查。

> status: shipped — evidence: `mica-build:Makefile`, `mica-build:tools/boards.sh`, `mica-build:tools/board-pool.sh`

## 5. 离线：并排的检出

每个仓库都有 `make offline`，它从自己的 `locks/` 出发把发布产物构建到 `_out/offline/`
里，源码缓存是由 `tools/repos.sh` 管理、被 git 忽略的 `repos/`。工作区驱动把它们串起来：

```sh
make offline-chain                       # 在 mica-build 里；MICA_WORKSPACE 默认为 ..
make offline-chain PRODUCTS=uefi-x64-dev
```

它按依赖顺序在每个检出的一次性克隆里构建各个仓库，并从这些构建结果组合出产品。
过程很长，并且需要 docker。

在 amd64 工作站上，arm64 产物能否与已发布版本逐字节一致，取决于那个仓库是怎么构建它
的——而不取决于模拟：在这里的所有测量中，模拟从未改变过一个字节，Rust 也不例外。
如果构建容器运行在目标平台上，本地构建就是同一个构建、只是跑在模拟里，它能复现：
基础软件包和容器引擎都如此，因此对它们来说本地构建确实能回答 arm64 那一半。如果它
运行在宿主平台上用交叉工具链，而 CI 在该架构的 runner 上原生构建，那就是两个不同的
构建，本地那个是有效的归档、但不是已发布的那一个；今天属于这种情况的是 `mica-core`。
无论哪种情况，离线构建得到的都是一个**可用的**系统。

> status: shipped — evidence: `mica-build:Makefile`, `mica-build:tools/offline-chain.sh`, `docs/design/release-lock.md`

`mica-build:tools/local-pins.sh` 让开发期间用并排检出自己的池顶替它的 release。

> status: shipped — evidence: `mica-build:tools/local-pins.sh`

## 6. 校验你构建出来的东西

- `make product-verify PRODUCT=<name>` 对照契约校验该产品的镜像；`make os-verify`
  校验一个已组装的镜像。
- `make os-smoke-test`、`os-smoke-negative-test` 和 `os-factory-root-gate` 在真正发布的
  根里执行真正发布的二进制，并证明反例确实会触发。
- `make lifecycle-uefi PRODUCT=<name>` 对一个 UEFI 产品跑 QEMU 生命周期套件（启动、
  运行时、更新、故障、重置、关机）。**整套是手工运行的**；自 2026-09-19 起，其中一个
  运行时阶段（不跑故障阶段）会对每个 amd64 产品自动运行——`ci.yml` 在每次推送 `main`
  和每个 pull request 上跑，`release.yml` 在发布时再跑一次。`arm64` 与 `cx3576` 没有
  任何自动启动，所以对它们而言，“某个产品能启动”带的仍是**上一次有人手工跑它的日期**
  （[构建门](../../design/build-harness.md)）。
- `make os-repart-test` 证明首次启动的扩容，`make os-layout-lint` 证明分区契约。

> status: shipped — evidence: `mica-build:Makefile`, `mica-build:make product-verify`, `mica-build:make lifecycle-uefi`

## 7. 构建不做的事

它不会凭空造出密钥或 release：签名输入是显式的（`make os-devkeys` 生成开发用输入），
其它输入来自 `locks/`。它也不发布：只有 release 才发布
（[发布](../../user/releasing.md)）。

> status: shipped — evidence: `mica-build:Makefile`, `docs/design/release-signing.md`
