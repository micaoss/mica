# 更新包：该用哪个归档，设备又如何接收它

Mica OS 的发布在镜像旁边同时发布更新归档。本页说明哪个归档适用于某台设备、它如何
到达设备、设备拿到它之后做什么，以及一路上用户可能遇到的每一种拒绝。安装背后的
状态机，面向操作者的是[更新与回滚](update-rollback.md)，作为契约的是
[更新](../../design/updates.md)。

**这些内容被实际跑过多少。** 生产侧——发布哪个归档、它的描述符声明了什么——由发布
工具链执行；设备侧由生命周期套件在 QEMU 中执行，并由 `mica-core` 的契约测试覆盖。
完整周期（import、install、重启、自动确认、回滚）没有在实体硬件上跑过，下面的命令行
是从 `mica-core` 读出来的，而不是从某次设备会话里抄下来的。它们描述的行为是代码的
行为；凡是没人亲眼见过的控制台输出，这里都不引用。

> status: unsupported

## 1. 一个部署，三种归档

每个产品发布有一个签名部署，最多发布成三个携带同一份描述符的 `MICAUPD1` 归档：

| 类型 | 文件 | 何时发布 |
|---|---|---|
| `full` | `mica-<product>-<stamp>.micaupd` | 始终 |
| `root` | `mica-<product>-<stamp>.root.micaupd` | 相对该产品上一个发布，kernel 标识未变 |
| `kernel` | `mica-<product>-<stamp>.kernel.micaupd` | rootfs 标识未变 |

两者都变时只发布 `full`。`root` 这条路径在 2026-09-16 第一次跑在真实发布上，一次覆盖
全部六个产品，并且面对的是真实存在的设备
（[记录](../../task/20260916-1653-root-only-archive.md)）。`root` 归档携带 rootfs 对象，`kernel` 归档携带启动产物以及
带模块和固件的 support 镜像；它们略去的对象必须已经在设备上，所以每个归档都声明自己
要求什么。更新归档不压缩。后缀是生产侧的命名约定——客户端读的是 `MICAUPD1` 头部，
不是文件名。

**已回答：归档类型只按 root 与 kernel 标识计算，而引导器根本不在任何一种归档里。**
一个归档打包一份签名描述符加上恰好两个对象族——kernel（`boot.efi` 或 `boot.itb`、
`support.img`、`support.roothash.p7s`）与 root（`rootfs.img`、
`rootfs.roothash.p7s`）。`full` 是两者，`root` 略去 kernel 对象，`kernel` 略去 root
对象，不存在第三个族。固件不是部署描述符的成员，它只进入**工厂镜像**；所以 U-Boot 变动
不会改变归档的任何一个字节，既不可能迫使发 `full`，也不可能压掉 `root` 或 `kernel`。

这也了结了关于 `s905x5m` 的担心：它与另外三块板一样，从第二个发布起照常发部分更新，
厂商签名不确定也不影响。那里的复用由**输入决定，不由字节决定**——`mica-boards` 把组件
的 `mica.inputs` 与该板最新发布比较——而永久成立的陈述只剩这一条：loader 输入变了的
发布会重建它，且那次重建永不逐字节一致。现在有两个测量，它们数的是不同的东西：
**16.13 MiB** 是 loader 重建时不同的**组件**字节（十二个文件里的四个，仅限 loader 输入
变动的那些发布）；**3.17 MiB** 是 `u-boot.bin.signed` 在**每一个**已发布工厂镜像内、随
镜像一起压缩的体积——每次发布都在，在 `.img.gz` 里，从不在 `.micaupd` 里。

> status: shipped — evidence: `docs/decisions/2026-09-15-update-packages.md`, `docs/design/release-signing.md`, `mica-core:crates/mica-deploy`

## 2. 哪个归档适用

先读运行中的状态：`mica-deploy status`，或者 `GET /api/v1/update` 和
`GET /api/v1/system/info`，它们报告已认证的部署、它的代次，以及 kernel 和 rootfs
标识。

- 设备的产品必须等于描述符里签名的 `product` 字段。设备的身份是它自己签名根中
  `/usr/lib/mica/product.conf` 的 `PRODUCT=` 行，设备上没有任何东西能改它。
- 代次必须高于设备见过的一切，而不只是高于正在运行的那个。
- `root` 归档只适用于已经在运行它所指 kernel 的设备；`kernel` 归档只适用于已经在
  运行它所指 rootfs 的设备；`full` 总是适用。

> status: shipped — evidence: `docs/design/updates.md`, `mica-core:crates/mica-deploy/src/acquisition.rs`, `docs/decisions/2026-09-15-update-packages.md`

## 3. 把归档送上设备

**没有上传端点。** apid 不接收任何更新文件；只有*安装*那一步有 API 路由。因此离线
路径是：

1. 用 SSH/SFTP 把 `.micaupd` 复制到设备（内置服务器是 `mica-sftp-server`，由 dropbear
   以登录用户的身份 exec——每一个 authorized key 同时是 `root` 和 `mica` 的密钥），
   或者挂载任何携带它的介质；
2. 通过 SSH 执行 `mica-deploy import <archive>`；
3. 安装：在命令行上执行，或用 `POST /api/v1/update/install` 加上 `import` 打印出来的
   64 位十六进制 `deploymentId`。

归档可以是任何可读的普通文件——它是被流式读取的，不会被复制——但**不能放在
`/mica/updates/` 里面**：该目录树下的一切都计入获取工作区预算（默认 512 MiB），停在
那里的归档可能让它自己的导入以 `workspace budget exhausted` 失败。那棵树下也不允许
挂载任何东西：`unexpected mount in update workspace`。

> status: shipped — evidence: `mica-core:crates/mica-deploy/src/bin/mica-deploy.rs`, `mica-core:crates/mica-sftp-server`, `mica-core:crates/mica-apid/src/update_api.rs`

## 4. 在设备上接收更新

`mica-deploy` 是唯一的设备侧更新客户端；micad 在 D-Bus 上驱动同一个二进制，apid 再
坐在它后面。每次调用都先读已认证的启动回执和签名启动策略，若挂载与它们不符就拒绝；
不存在用户态的信任覆盖。

```sh
mica-deploy probe                                   # 工作区就绪情况与可用空间
mica-deploy import /path/to/mica-<product>-<stamp>.micaupd
mica-deploy check  --source <origin> --channel stable|beta|dev
mica-deploy fetch  --source <origin> --channel stable|beta|dev
mica-deploy install /mica/updates/verified/<id>.json --objects /mica/updates/verified/objects
mica-deploy status | mica-deploy booted             # 正在运行什么
mica-deploy confirm | mica-deploy rollback | mica-deploy reject <id>
mica-deploy gc | mica-deploy discard
```

- 每个命令在 stdout 上打印一个 JSON 对象。
- `import` 和 `fetch` 是离线与在线两条获取路径，结局相同：缺失的对象落到
  `/mica/updates/verified/objects/`，已校验的描述符落到
  `/mica/updates/verified/<deploymentId>.json`。那个目录是 micad 唯一接受安装来源的
  地方。
- 获取需要还缺的对象所占空间，加上 DATA 上 128 MiB 的保留量和 2080 个空闲 inode。
- `install` 是独立的一步，并且从不重启。`--max-bytes` 调整工作区预算（默认 512 MiB，
  最大 8 GiB）。

> status: shipped — evidence: `mica-core:crates/mica-deploy/src/bin/mica-deploy.rs`, `mica-core:crates/micad/src/update_lifecycle.rs`

## 5. 一次安装写了什么，以及它在哪一刻生效

1. 对象在暴露出去之前先按摘要和长度校验；设备上已有的对象被复用，不再复制。
2. 先**退役**此前非运行中的条目，于是在旧的回退被持久地变为不可启动之前，不会写入
   任何新对象。
3. 对象被发布到 `/mnt/system/roots/<rootfsId>/`、`/mnt/system/kernels/<kernelId>/`
   和启动文件，根哈希放在它们旁边。
4. 签名描述符写入 `/mnt/system/deployments/<deploymentId>.json`。
5. **启动项最后写：那就是生效提交点。** UEFI 上是
   `/boot/loader/entries/mica-<id>+3.conf`，systemd-boot 启动计数的三次尝试；
   FIT 板卡上是插到冗余 U-Boot 环境 `mica_entries=` 最前面的一条记录，
   `triesLeft = 3`。
6. DATA 记下新的 `candidate` 和新的最高代次。

最多保留两个部署，所以设备始终留着一个回退。安装需要新字节所占空间，加上 SYSTEM 上
128 MiB、ESP 上 64 MiB 的保留量，并先把垃圾回收能腾出的空间算进去。

> status: shipped — evidence: `mica-core:crates/mica-deploy/src/deployments.rs`, `mica-build:build/src/file-image.ts`, `docs/design/updates.md`

## 6. 重启、确认与回滚

- loader 启动仍有剩余尝试次数中代次最高的那个条目，每次尝试都把计数减一；计数为零的
  条目再也不会被选中，所以一个始终起不来的部署会自行回退。
- **确认是自动的、由健康检查把关的，不是手动的。** `mica-health.service` 在
  `multi-user.target` 之后运行，检查 `/etc/mica/health.conf` 中列出的成员
  （`boot-settled`、`micad`、`apid`），成功则执行 `mica-deploy confirm`。失败时
  `mica-boot-failure.service` 执行 `mica-deploy fail-boot` 并重启到剩下的那个条目；
  如果连 DATA 都不可用，它改为关机。
- `confirm` 删除运行中条目的尝试计数——这就是那条持久的确认事实——并记录 `current`、
  `fallback` 和 `candidate`。
- **手动回滚**是 `mica-deploy rollback`：它退役运行中的、已确认的部署，于是下次启动
  保留的回退。`reject <id>` 按 id 退役某一个。两者都不重启；由操作者重启。
- 回滚是一次启动选择，不是数据恢复。DATA 策略是 `unchanged`：只有启动的根和内核
  退回去。

> status: shipped — evidence: `mica-core:crates/mica-deploy/src/deployments.rs`, `mica-system-base:debs/mica-system`, `docs/design/updates.md`

## 7. 各种拒绝

获取（`import`、`fetch`）与安装是分别检查的，两者都生效：获取尽早拒绝，于是什么都
不会被写；`install` 在那一刻再对着当前状态拒绝一次。消息按原文给出。

| 原因 | 消息 |
|---|---|
| 产品不对 | `deployment targets another product` |
| 板卡或架构不对 | `deployment targets another device` |
| 启动格式与本设备不符（UKI 对 FIT） | `deployment boot format differs from this device` |
| 代次不高于见过的最高代次 | `deployment generation is not newer` |
| 已有候选在等它的首次启动 | `another deployment is pending` |
| 运行中的部署还没被确认 | `confirm the running deployment before installation` |
| 已经安装过，或此前被拒绝过 | `deployment is installed or rejected` |
| 部分归档，而它缺的那个组件不在设备上 | `deployment objects are incomplete` |
| 归档携带了描述符没有列出的对象 | `archive carries more objects than the deployment names` |
| 某个对象未被列出、重复或长度不对 | `unlisted, duplicate or wrong-sized archive object` |
| 对象字节与其摘要不符 | `archive object digest mismatch` |
| 最后一个对象之后还有字节 | `trailing archive bytes` |
| 不是 `MICAUPD1` 归档 | `invalid component archive` |
| 签名密钥未知 | `Invalid component contract: untrusted metadata key` |
| 签名无效 | `Invalid component contract: metadata signature rejected` |
| 获取工作区放不下 | `workspace budget exhausted`、`DATA reserve unavailable` |
| 安装时目标放不下 | `insufficient destination space: <path>`、`insufficient destination inodes` |
| 目录过期、被重放或被改写 | `catalog expired or clock is unsuitable`、`catalog revision rollback`、`catalog revision changed its signed contents` |
| 目录 URL 形状不对 | `invalid catalog source URL` |
| 对象 URL 不在目录的 origin 下 | `object URL differs from the catalog origin or digest` |

同样的拒绝经 API 表现为状态码：策略性拒绝是 **409** `policy_refused`，畸形的
deployment id 或获取路径是 **422** `validation_failed`，后端拒绝是 **500**
`micad_failed`。`GET /api/v1/update` 带有一套封闭的失败码词表，包括
`no-newer-release`、`install-refused`、`outside-window` 和 `reboot-gate-closed`。

> status: shipped — evidence: `mica-core:crates/mica-deploy/src/acquisition.rs`, `mica-core:crates/mica-deploy/src/components.rs`, `mica-core:crates/mica-apid/src/update_api.rs`

## 8. 查看正在运行什么

- `mica-deploy booted` 打印运行中的 deployment id；`mica-deploy status` 打印启动回执、
  有效状态（`current`、`fallback`、`candidate`、`failed`、`highestGeneration`）以及
  每个保留的部署及其代次、剩余尝试次数、kernel 和 rootfs 标识。
- `GET /api/v1/system/info` 报告部署标识、板卡、内核、发布，以及信任是 `production`
  还是 `development`。
- `micad --version` 和 `mica-apid --version` 打印软件包版本。

提交哈希和构建日期都不再是设备可见的事实：`gitStamp`、`commitDate`、`daemon.commit`
和 `release-identity.env` 都已移除，软件包版本里也不带它们
（[稳定组件标识](../../decisions/2026-09-15-stable-component-ids.md)）。

用索引把 deployment id 映射回一个发布：

```sh
jq -r '.products[]|[.product,.release,.generation,.deployment]|@tsv' mica-index.json
```

> status: shipped — evidence: `mica-core:crates/micad/src/system_info.rs`, `docs/design/mica-index.md`, `docs/decisions/2026-09-15-stable-component-ids.md`

## 9. 从索引里挑文件

`micaoss/mica-build` 的版本索引 `mica.<YYYYMMDD-HHMM>` 是唯一一处列出每个已发布产品
最新产物的地方。在 `mica-index.json` 里，每个产品携带：

- `generation`、`deployment`、`kernel` 和 `rootfs`：用来与设备比较的标识；
- `updates[]`：每个归档一条，含 `kind`、`file`、`url`、`sha256`、`size` 和
  `requires`，其中 `requires.generationBelow` 是该归档的代次，
  `requires.kernel` 或 `requires.rootfs` 指出该归档不携带的那个组件；
- `images[]`：磁盘镜像的同类信息，外加压缩方式和解压后的身份。

所以：找到产品，把 `requires` 与设备正在运行的东西比对，下载 `url`，核对 `sha256`，
然后导入。结构见 [mica-index](../../design/mica-index.md)；校验方式见
[获取发布版](download.md#4-哪一步该核对哪个摘要)。

> status: shipped — evidence: `docs/design/mica-index.md`, `docs/decisions/2026-09-15-mica-version-index.md`

## 10. 在线更新：设备对服务器的要求

`check` 和 `fetch` 拿到的是一个 origin，不是一个路径，设备会强制整份契约：

- 来源解析后恰好是 `http(s)://<host>/v1/manifest.json`，没有 query、fragment 或
  凭据；
- 该文档是包在 `mica/catalog/v2` 载荷外的签名信封，规范 JSON，最大 1 MiB，带单调
  递增的 `revision`（同一 revision 再次出现必须逐字节相同），`issuedAt` 与
  `expiresAt` 相距最多 30 天，最多 128 个 release、12 个 channel；
- `channels` 是按**板卡 + 产品 + 通道**为键的头表，每条指出最高代次及其 release；
  不是该键最高 release 的头会被拒绝；
- 每个对象的 `url` 必须等于 `<origin>/v1/objects/<sha256>`；传输支持按 range 续传，
  速率低于 1 KiB/s 时放弃。

设备去拨哪个地址由操作者决定，它会接受什么则不由操作者决定。镜像里烧进去的
`mica/meta/v1` 清单携带 `update.source`、`channel`、`policy`（`off`、`check`、
`auto`）和 `checkIntervalMinutes`，DATA 上的 `/mica/config/updates.json` **只能**覆盖
这四个键。声明信任锚的文档会被拒绝：信任锚在签名镜像内部。

> status: shipped — evidence: `mica-core:crates/mica-deploy/src/catalog.rs`, `mica-core:crates/micad-settings/src/configuration.rs`, `docs/design/remote-management.md`

## 11. 运行一台更新服务器

服务器是 `mica-build:update-server/`：Bun、Hono 和 SQLite 在同一个进程里，带一个管理
界面和一个面向设备的接口面。

- 用 `bun run init` 初始化，它写出带随机管理 token 的 `.env`，并拒绝覆盖已有文件；
  用 `bun run start` 启动（或用 `bun run build` 产出的单一二进制）。
- 发布一个 release 分两步：`bun scripts/import.ts --channel stable
  --archive <file>.micaupd`（或 `--oci <bundle>@sha256:<digest>`，它匿名读取该
  bundle，并要求恰好有一层带注解 `mica.update-kind=full`）创建一个**草稿**，
  发布是另外一个动作。若某个 release 的部署信封已无法用受信任密钥验证，发布会被拒绝：
  `409 invalid_deployment`。
- 设备看到的是 `GET /v1/manifest.json` 和 `GET /v1/objects/<sha256>`，两者都不需要
  认证，支持 range 和条件请求。限额是 128 个已发布 release 和 1 MiB 的目录，超出都
  回 `409 catalog_full`。
- 所有状态都在 `DATA_DIR` 下——SQLite 数据库和对象——所以那个目录就是备份对象。进程
  默认在 `127.0.0.1` 上讲明文 HTTP，因此需要一个 TLS 反向代理，并把 `PUBLIC_URL`
  设成对外的 origin：这个字符串会被烧进签名过的对象 URL 里，不一致就会给设备一批它们
  取不到的 URL。只有一个共享的管理 token，没有用户账户。
- 服务器给目录签名，并在发布前用受信任密钥校验每个 release 的部署信封，但对载荷而言
  它不是受信任方：设备自己会校验同样的签名。

该服务自己的测试套件通过；这里没有人部署或运维过它，所以端口、代理配置、服务单元和
备份流程都未经验证。

> status: unsupported

## 12. 陷阱

- 不要把归档停在 `/mica/updates/` 里，也不要在那里挂载任何东西。
- 不要指望有上传端点：文件走 SSH/SFTP，只有安装那一步有 API。
- 运行中的部署确认之前不要装第二个更新，有候选在等首次启动时也不要装——两者都会被
  拒绝。
- 不要用更低的代次重建“同一个”发布：设备会拒绝它，经目录分发时它干脆不会显示为更新。
- 不要手改 `/usr/lib/mica/product.conf`、部署描述符、启动项或 FIT 的 `mica_entries=`
  记录；它们被当作已认证状态读取。
- 不要手删 `/mnt/system/roots/` 或 `/mnt/system/kernels/` 下的对象——`mica-deploy gc`
  只删除没有任何保留部署引用的东西。
- 不要把回滚当作数据恢复。
- 不要假定 SSH 是开的：新设备上它是关的，而且每一个 authorized key 同时属于两个受管
  账户。

> status: shipped — evidence: `mica-core:crates/mica-deploy/src/acquisition.rs`, `mica-core:crates/micad/src/reconciler/sshd.rs`, `docs/user/security.md`

## 13. 限制

- **任何板卡上的任何设备，都不会通过更新归档收到新的引导器。** 这个格式携带的是
  root 与 kernel；固件只离线移动——guest 停机，或者用 RockUSB 接管板卡——依据固件维护
  契约。这从格式存在之日起就是如此，`uefi-x64`、`uefi-arm64`、`cx3576` 与 `s905x5m`
  一样；它之所以现在才可见，只是因为有人问了“某块板上 loader 变动要付多少代价”。这里
  把它写成**一个开放的产品问题**，而不是缺陷：引导器在现有任何机制下都无法在现场更新，
  而改变这一点意味着改变这个格式。怎么处理由用户决定。
- 没有只含固件的归档：固件维护是独立的，`firmware` 这种更新类型会被拒绝。
- 跨越 verity 信任证书变更时不发布 kernel 包；这样的发布只出 `full`。
- 只有发布所涵盖的产品才有更新归档，今天就是发布目标板的 `dev` 与 `prod` 产品。

> status: unsupported
