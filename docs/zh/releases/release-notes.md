# 发布标识与发布说明

怎样说清一台设备运行的是哪个发布、关于一次发布的事实从哪里来，以及一次发布不承诺什么。

## 1. 识别正在运行的系统

运行中的系统由它已认证的**部署 ID**、**generation**、产品与板卡，以及内核和根的身份来
识别。`mica-deploy status` 与 `GET /api/v1/system/info` 会报告这些。文件名或时间戳不能
标识内容；设备上看不到任何提交哈希或构建日期。

签名的部署描述符按摘要和长度绑定确切的内核、根与 core 组件，所以部署 ID 代表的就是这些
字节，别无其他。根里还带有组成它的软件包清单 `/usr/share/mica/manifest.tsv`。固件有自己
的身份，不在任何部署里。

用该发布 `mica-build.lock` 的 `product` 行，可以把部署 ID 对应回一次发布
（[release lock](../../reference/release-lock.md)，英文）。

> status: shipped — evidence: `mica-build:src/image/components.ts`, `mica-core:crates/micad/src/system_info.rs`, `mica-build:src/product/build.ts`

## 2. 发布事实从哪里来

一个产品的一次发布名为 `<board>.<variant>.<YYYYMMDD-HHMM>`。它的事实在它发布出来的
东西里，而不在事后写的文字里：

- `mica-build.lock` 给出产品的 generation 与部署 ID、每个镜像和更新归档及其 sha256，以及
  这次构建所取的输入发布（[发布如何运作](how-releases-work.md)）；
- 资源服务上该发布的文档列出同样的文件及其大小与摘要，
  [下载页](https://micaos.dev/download/)和设备读的就是它；
- 有哪些更新归档说明了变了什么：有 `root` 归档表示内核是上一次发布的，有 `kernel` 归档
  表示根是上一次的，有 `core` 归档表示只有 core 组件变了
  （[更新](../operate/updates.md)）。

信任锚、启动策略、访问默认值或持久化内容的变化，会在发布说明里点名写出。回退部署与它
替换的部署共享 DATA：任何发布都不会回退应用数据，也没有数据迁移路径。

> status: shipped — evidence: `mica-build:README.md`, `mica-build:src/release/scoped.ts`, `docs/reference/updates.md`

## 3. 一次发布不是什么

已发布的版本既不是板卡认证，也不是支持承诺：一块板证明到了什么程度写在它的
[板卡页](../hardware/README.md)上，支持意味着什么见[支持](support.md)。已安装的部署会
一直能离线启动，不管更新服务器之后提供还是扣住什么。

> status: shipped — evidence: `docs/hardware/README.md`, `docs/releases/support.md`, `mica-core:crates/mica-deploy/src/acquisition.rs`

不承诺发布节奏、支持期限或停服日期。

> status: unsupported
