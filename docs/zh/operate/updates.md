# 更新与回滚

设备怎样接收一个新发布、留下什么作为回退，以及操作者一路上会遇到的每一种拒绝。
本页背后的契约是[更新设计](../../reference/updates.md)（英文）；格式属于 `mica-core`
（`mica-core:docs/mica-core.md` 第 6 节）。

**其中多少真正跑过。** 生产侧在每次发布时都会执行；设备侧在 QEMU 里由生命周期套件、
以及 `mica-core` 的契约与故障测试执行。core 集合的试运行在该套件里对 UEFI 产品执行
（`mica-build:tests/suites/lifecycle-uefi/core-sets.sh`）：在 OpenRC 产品上跑完全程，在
systemd 产品上还没有，因为测试框架在那里读不到失败启动的裁决。实体硬件上还没有完整一轮（导入、安装、重启、
自动确认、回滚）的记录，见[支持层级](../hardware/README.md#current-boards)。

> status: unsupported

## 1. 更新是什么

一个产品的一次发布就是一个签名的**部署**：内核及其 support 镜像，以及根文件系统。
设备在当前部署运行时暂存新的部署，下次重启时启动它，并且只有在它证明自己健康之后才
确认。设备最多保留两个部署，因此始终留有一个回退。

core 组件（管理守护进程连同 API，和 Web 控制台）不在任何部署里。它们来自设备的
**core 集合**，后者单独发布，单独或随系统更新一起到达设备（第 10 节）。

更新从不触碰引导加载器、平台密钥和 DATA 上的数据。固件单独、离线维护
（[恢复](recovery.md)）。

> status: shipped — evidence: `mica-core:docs/mica-core.md`, `docs/reference/updates.md`

## 2. 该用哪个归档

一次发布把它的部署发布为最多三个离线归档，放在镜像旁边。它们携带同一份签名描述符，
区别只在于带了哪些对象；归档没带的东西必须已经在设备上。

| 种类 | 文件 | 携带 | 何时发布 |
|---|---|---|---|
| `full` | `mica-<product>-<stamp>.micaupd` | 全部 | 总是 |
| `root` | `...<stamp>.root.micaupd` | 根文件系统 | 内核相对该产品上一次发布没有变化 |
| `kernel` | `...<stamp>.kernel.micaupd` | 内核及其 support 镜像 | 根没有变化 |

产品的第一次发布，以及内核和根都变了的发布，只发布 `full`。`full` 总是适用；其余的
只适用于设备已经在运行它们没带的那部分的情况：用设备上的 `mica-deploy status` 或
`GET /api/v1/system/info` 对照发布的内核与根身份。

每一种归档都受三条规则约束：

- 归档的产品必须是设备自己的产品（`/usr/lib/mica/product.conf` 里的 `PRODUCT=`，属于
  签名的根）；
- 它的 generation 必须高于设备见过的所有 generation，而不只是高于正在运行的那个；
- 它的签名必须能用设备签名内核里的密钥验证。

应当取产品的最新发布；怎么找到它并校验摘要见[下载](../start/download.md)。core 集合
有自己的归档，每种架构一个（第 10 节）。

> status: shipped — evidence: `mica-build:README.md`, `mica-core:crates/mica-deploy/src/acquisition.rs`, `docs/reference/updates.md`

## 3. 在线更新

设备配置一个**更新根**，即一个以 `/` 结尾的 URL。项目自己的是
`https://res.micaos.dev/update/`。设备在它下面先读清单（给出本产品的当前发布），再读
该发布的文档，再读签名描述符，每一份都只在需要时才读，并且只下载自己还没有的对象。

信任来自签名描述符，而不是地址：设备只接受自己的板卡、架构与产品，只接受更新的
generation，并按描述符逐字节校验。产品没有通道（core 集合有，见第 10 节），也没有任何
东西会过期，所以服务器扣住一个发布，在设备看来就是“没有更新的”。

镜像里带有默认值；DATA 上的 `/mica/config/updates.json` 或 System 页面可以设置更新源、
策略（`off`、`check`、`auto`）、检查间隔与维护窗口。任何设置都不能增加签名密钥。

自建服务器的集成商从另一个根提供同样的文档，并把更新源指向它
（`mica-core:docs/mica-core.md` 第 6.2 节）。

> status: shipped — evidence: `mica-core:crates/mica-deploy/src/catalog.rs`, `mica-core:crates/micad-settings/src/configuration.rs`, `mica-build:README.md`

## 4. 离线更新

把 `.micaupd` 送到设备有两种方式：

- **上传。** 用 System 页面，或 `POST /api/v1/update/import`，请求体就是归档本身。
  应答是 202；结果用 `GET /api/v1/update` 轮询。更新策略不约束上传：策略为 `off` 的
  设备照样接收操作者亲手带来的文件。
- **复制后经 SSH 导入。** `mica-deploy import <archive>`。文件可以放在任何可读的位置，
  但不能放在获取工作区 `/mica/updates/` 之下，否则它会占用自己这次导入的预算。

两种方式下，归档都经过与在线下载相同的检查，最后成为一个等待安装的已验证部署。core
集合的归档也用这两种方式送达，导入结果会说明收到的是哪一种。

> status: shipped — evidence: `mica-core:crates/mica-apid/src/update_api.rs`, `mica-core:crates/mica-deploy/src/bin/mica-deploy.rs`

## 5. 安装、重启与确认

1. **安装**把新对象写入 SYSTEM，最后才写入让该部署成为候选的启动项。它从不重启。
   它需要新对象的空间，外加板卡在 SYSTEM 和启动分区上的保留量。
2. **重启**是单独的动作；策略为 `auto` 时受重启门与维护窗口约束。
3. 加载器给候选**三次尝试**。始终起不来的候选在次数用完后被跳过，改为启动保留的
   部署。
4. **确认是自动的。** 启动后，健康门检查启动已完成、管理守护进程有应答、API 有应答，
   然后确认该部署。健康门失败则重启进入保留的部署。

命令行上对应的步骤是 `mica-deploy install`、`confirm`、`status` 和 `booted`；每条命令
输出一个 JSON 对象。

> status: shipped — evidence: `mica-core:crates/mica-deploy/src/deployments/install.rs`, `mica-system-base:payload/usr/lib/mica/mica-health`, `mica-system-base:payload/etc/mica/health.conf`

## 6. 回滚

手动回滚（`POST /api/v1/update/rollback`、`mica-deploy rollback` 或 System 页面）在
运行中的部署已确认、没有待处理候选且保留有回退时可用。它淘汰运行中的部署，使回退在
下次启动；重启由操作者执行。

回滚是启动选择，不是数据恢复：DATA 上的配置、数据库与应用数据保持原样。

失败或被拒绝的部署会被记住，generation 下限只升不降，所以已知有问题的发布不会被
再次安装。修正后的发布是一个 generation 更高的新发布。

> status: shipped — evidence: `mica-core:crates/mica-apid/src/update_api.rs`, `mica-core:crates/micad/src/deployment.rs`

## 7. 拒绝

获取与安装分别检查，两者都生效。消息为原文。

| 原因 | 消息 |
|---|---|
| 产品不对 | `deployment targets another product` |
| 板卡或架构不对 | `deployment targets another device` |
| 启动格式与本设备不符 | `deployment boot format differs from this device` |
| generation 不高于已见过的最高值 | `deployment generation is not newer` |
| 已有候选在等待首次启动 | `another deployment is pending` |
| 运行中的部署尚未确认 | `confirm the running deployment before installation` |
| 已安装，或此前被拒绝 | `deployment is installed or rejected` |
| 部分归档，而其余对象不在设备上 | `deployment objects are incomplete` |
| 归档带有描述符未列出的对象 | `archive carries more objects than the deployment names` |
| 对象未列出、重复或长度不对 | `unlisted, duplicate or wrong-sized archive object` |
| 对象字节与摘要不符 | `archive object digest mismatch` |
| 最后一个对象之后还有字节 | `trailing archive bytes` |
| 不是更新归档 | `invalid component archive` |
| 未知的签名密钥 | `untrusted metadata key` |
| 签名无效 | `metadata signature rejected` |
| 获取工作区没有空间 | `workspace budget exhausted`、`DATA reserve unavailable` |
| 安装时没有空间 | `insufficient destination space`、`insufficient destination inodes` |
| 工作区里挂载了东西 | `unexpected mount in update workspace` |
| 更新源不是更新根 | `invalid catalog source URL` |
| 服务器退回到了更旧的清单 | `catalog revision rollback` |
| core 集合属于另一种架构 | `set targets another architecture` |
| core 集合的 generation 不高于已持有的 | `set generation is not newer` |
| 部署尚待确认时送来 core 集合 | `a deployment is on trial; confirm it before a set update` |
| 已有另一份 core 集合在等待试运行 | `another set is pending` |
| core 集合归档的对象不全 | `set objects are incomplete` |
| core 集合无法在这个根上运行 | `a selected core component does not run on this root's interface level`、`a selected core component's root requirement does not hold`、`a selected core component's need is not selected` |

经 API 时，策略拒绝是 **409** `policy_refused`，请求格式错误是 **422**
`validation_failed`，后端拒绝是 **500** `micad_failed`。`GET /api/v1/update` 用一个
封闭的词表报告失败，其中包括 `no-newer-release`、`install-refused`、`outside-window`
和 `reboot-gate-closed`。

> status: shipped — evidence: `mica-core:crates/mica-deploy/src/acquisition.rs`, `mica-core:crates/mica-deploy/src/acquisition/sets.rs`, `mica-core:crates/mica-deploy/src/deployments/install.rs`, `mica-core:crates/micad/src/update_codes.rs`

## 8. 陷阱

- 不要把归档放在 `/mica/updates/` 之下，也不要在那里挂载任何东西。
- 不要在运行中的更新确认之前、或候选还在等待首次启动时安装第二个更新。
- 不要用更低的 generation 重建“同一个”发布：设备会拒绝它。
- 不要手工编辑 `/usr/lib/mica/product.conf`、部署描述符或启动项；它们是作为已认证
  状态读取的。
- 不要手工删除 `/mnt/system/` 下的对象；`mica-deploy gc` 恰好删除没有任何保留部署
  引用的那些。
- 不要把回滚当作数据恢复。

> status: shipped — evidence: `mica-core:crates/mica-deploy/src/acquisition.rs`, `mica-core:docs/mica-core.md`

## 9. 限制

- 任何更新归档都不携带引导加载器。固件只经由各板卡的离线维护途径变动
  （[恢复](recovery.md)、[签名](../../security/signing.md)（英文））。
- 轮换 verity 密钥会重新签名根，所以那次发布只发布 `full`。
- `dev` 产品从不发布，所以没有更新归档。

> status: unsupported

## 10. core 集合与通道

同一架构的每个产品上，core 组件是相同的字节，而且变化比内核和根频繁，所以它们单独发布，
不换根就能到达设备。

- **core 集合**是某个通道、某种架构的 core 组件的签名清单。它以 `core.<channel>.<stamp>`
  为每种架构发布一次，该通道上该架构的每台设备都取用它。
- **每台设备都有一份。** 出厂镜像带着一份种子集合，即产品构建时 `general` 通道上最新的
  那份，镜像的部署也指名这份集合，所以新设备不需要网络就能启动。
- **集合能否在一个根上运行**，取决于两边的声明：组件可以声明它能运行的根接口级别，以及
  它要求的根软件包及版本范围；根声明自己的接口级别和它提供的软件包。双方都没声明的就是
  兼容的。设备按自己产品的特性选出组件，选出的组件无法在它的根上运行的集合会被拒绝。
- **通道**默认是 `general`，除非镜像或操作者的更新设置（`channels.core`）指定了别的。
  切换通道是操作者的动作。在同一个通道内，generation 只升不降。
- **单独的 core 更新。** 检查先读 core 这条线，提供能在当前根上运行的更新集合。不能运行的
  会报告为等待系统更新，读不了的 core 线也会报告；两种情况下检查都会继续看系统更新。
  单独的集合试三次启动：健康起来的那份取代设备原来运行的集合，没有健康起来的被丢弃。
- **系统更新与它的 core 集合。** 在 `general` 上，系统更新会取能在新根上运行、且不比镜像
  自带的更旧的最新 `general` 集合，与部署作为一对一起安装：两者一起试运行，只计部署的
  试运行；确认后两者都成为当前，试运行失败则以上一个部署和它当时运行的集合启动。设备在
  别的通道上，或已经持有更新的集合时，保留自己的集合；该集合不能在新根上运行时，更新被拒绝。
- **一次只做一个更新**，集合或部署。策略（`off`、`check`、`auto`）、维护窗口与重启门对
  两者相同。
- **已确认的集合不能回滚。** 修正后的集合是一个 generation 更高的新集合；保留的部署仍然
  以它被确认时的集合启动。
- **离线**时，core 集合是 `mica-core.<channel>-<stamp>.<arch>.micaupd`，像任何归档一样
  上传或导入（第 4 节）。

`GET /api/v1/update` 报告设备持有的集合，以及试运行中的集合还剩几次启动；
`mica-deploy status` 在 `sets.core` 下报告它们。契约见
[部署生命周期](../../reference/updates.md#core-sets)（英文）。

> status: shipped — evidence: `mica-core:docs/mica-core.md`, `mica-core:crates/mica-deploy/src/core_set.rs`, `mica-build:src/release/core.ts`
