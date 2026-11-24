# 设计：诊断：系统信息、观测到的网络状态与支持快照

> 设备不经 SSH 能告诉运维者关于自己的什么：一次读取回答"这是什么设备"，网络栈实际看到的网络状态，板卡的温度/
> 看门狗/复位证据，以及一份有界、经脱敏、离线的支持快照，可以经 API 导出。与 API、micad、存储和时间页面配套
> 阅读。API、控制台的系统页和 `mica doctor` 都已提供；第 10 节是操作流程。

## 1. 提供什么，以及有意不提供什么

`com.mica.micad1` 上有四个只读观测，每个都在一个 trait 之后，带有"不可用"的默认实现，因此 dry-run 守护进程或
测试从不检查其所在主机；每个都由 apid 经 HTTPS 在认证后提供：

| 观测 | micad 模块 | 总线成员 | 路由 |
|---|---|---|---|
| 系统信息 | `system_info.rs` | `GetSystemInfo` | `GET /api/v1/system/info` |
| 板卡遥测 | `telemetry.rs` | `GetTelemetry` | `GET /api/v1/system/telemetry` |
| 观测到的网络状态 | `network_state.rs` | `GetObservedNetwork` | `GET /api/v1/network/status` |
| 故障证据 | `diagnostics.rs` | `GetFailureEvidence` | 只在快照中 |

还有一份快照，由 apid（`apid/src/diagnostics.rs`）用上述四项加上已有的存储和时间状态面组装，按白名单 schema
脱敏，保存在 `/mica/diagnostics` 下的有界存储中：

| 路由 | 方法 | 回答 |
|---|---|---|
| `/api/v1/diagnostics/snapshots` | `GET` | 已保存的快照和保留上限 |
| `/api/v1/diagnostics/snapshots` | `POST` | 采集、脱敏并发布一份（201） |
| `/api/v1/diagnostics/snapshots/{id}` | `GET` | 以附件形式导出一份 |
| `/api/v1/diagnostics/snapshots/{id}` | `DELETE` | 删除一份（204） |

在设备上，root 运行的 `mica doctor` 把同样的快照采集到同一个存储中并打印其路径，不论 Web 模式如何。

快照之外还有三个较小的读取（`mica-core:docs/mica-core.md` 第 4 节）：

| 路由 | 回答 |
|---|---|
| `GET /api/v1/system/support-info` | 支持摘要：板卡、内核、产品和组件版本、运行中的部署、运行时长、时区和同步、完整性项、DATA 的就绪状态和空间、最近一次更新失败的代码；按名称挑选，所以没有 machine id、主机名、地址、代码、凭据、日志或设置。以 `mica-support-<UTC 时间>.json` 提供；控制台复制或下载它，设备不把它发往任何地方 |
| `GET /api/v1/system/integrity` | 完整性卡片：从系统信息、更新状态和存储状态派生的检查，每次请求重新读取 |
| `GET /api/v1/system/logs/{source}` | 一个白名单服务最新的 200 行；`?boot=previous` 在日志保留时读取上一次启动 |

**有意不提供的。**不上传到集群：这里没有任何东西把快照发往别处；导出是经认证客户端的下载。没有远程 shell，
没有抓包：API 不带这两者的任何路由，apid 测试中的 `the_openapi_document_covers_the_diagnostics_routes` 把诊断面
固定在这个范围。不支持蜂窝调制解调器：观测到的网络状态明确报告 `cellular.supported: false`，并在旁边列出内核
显示的任何 `wwan` 接口，因为需要调制解调器的型号是另一种产品选择。

下面每个成员都遵循两条规则，与存储页为其自身状态面所述相同，因为靠猜的诊断比什么都不说更糟：

1. **缺失也是数据。**不存在的文件、不应答的守护进程、没有传感器的板卡，都报告为带 `available: false` 和说明
   原因的 `detail` 的对象，从不是空字符串、零，或读起来像健康的缺失键。
2. **不重复陈述。**每个事实都从已经承载它的接口读取（随附的清单、`/etc/machine-id`、内核自己的文件、原生部署
   后端、networkd、wpa_supplicant、resolved、sysfs、日志），不在任何地方写第二份副本。

## 2. 系统信息面

`GET /api/v1/system/info` 一次读取回答设备标识。每个成员都是带 `available` 的对象；当前的结构是：

| 成员 | 存在时的成员 | 来源 |
|---|---|---|
| `machineId` | `id` | `/etc/machine-id`，校验为 32 位小写十六进制 |
| `board` | `model`、`source`（`devicetree` 或 `dmi`） | `/sys/firmware/devicetree/base/model`，否则为 DMI 产品名和主板厂商 |
| `kernel` | `release`、`version` | `/proc/sys/kernel/osrelease`、`/proc/sys/kernel/version`（`uname -r` / `uname -v` 打印的内容） |
| `release` | `name`、`id`、`version`、`versionId`、`prettyName`、`buildId`、`imageId`、`imageVersion`（各自只在文件包含时出现） | `/etc/os-release` |
| `system` | `version`、`package`、`fileEpoch` | `mica-system` 的清单行，否则为 `micad` 的；清单文件的 mtime |
| `daemon` | `name`、`version`（软件包版本，例如 `0.1.0-1`） | `micad --version` 打印的内容，来自编译进去的声明软件包版本 |
| `packages` | `count`、`micaCount`、`malformedRows`、`truncated`、`entries[]`（`name`、`version`、`architecture`、`mica`） | `/usr/share/mica/manifest.tsv` |
| `deployment` | `id`、`version`、`generation`、`kernelId`、`kernelRelease`、`rootfsId`、`confirmed`、`contentVerified`、`secureBoot`、`backend`、`bootVerified` | 经认证的原生启动回执和部署状态 |
| `trust` | `grade`（`development`/`production`），开发镜像上还有 `developmentDomains` 和 `marker` | `/usr/share/mica/meta/`：内置的更新配置及其旁边的 `GENERATED` 标记 |
| `uptime` | `seconds` | `/proc/uptime` |

`trust` 报告内置在 `/usr/share/mica/meta` 中的公开默认值和开发标记。它是出处，而不是主动的固件证明。当前的
标记域是 `boot`、`verity` 和 `updates`；格式错误、重复或未知的域声明不会让标记的存在变成生产等级。公开默认值
清单不存在时，该观测不可用。公开默认值不包含签名锚点：元数据/内容策略来自经认证的内核软件包，启动锚点来自
其固件信任域。

没有 `system.gitStamp`，也没有 `system.commitDate`：软件包版本不带提交
（`mica-build-tools:docs/spec/package-versions.md`），根中也没有 `/usr/share/mica/release-identity.env`，所以
根中什么都没变的发布保持其 rootfs 标识。运行中镜像的发布标识是 `deployment` 成员（`version`、`generation`），
从经认证的启动回执读取。

`daemon` 也没有 `commit`：`daemon.version` 和 `micad --version` 显示声明的版本
（`mica-build-tools:docs/spec/package-versions.md`），可执行文件中没有编译进任何提交。

`system.fileEpoch` 是清单文件的 mtime：`stages/compose/scripts/pack-squashfs.sh` 把根中每个文件时间固定到的
`SOURCE_DATE_EPOCH`。它**不是**构建日期，也有意不以构建日期命名。`stages/compose/scripts/pack-squashfs.sh` 把
这个纪元固定为常量，使同一棵树的两次构建逐字节相同，因此在本仓库产出过的每个镜像中它都是同一时刻：2020-01-01。
报告它是因为这是文件系统实际所说的，它回答"这个镜像的文件带什么时间"，而不是"这个镜像何时制作"。读取它让
这个状态面保持为现有接口的读者而不是第二个写入者；把它命名为 `buildDate` 会让它回答一个它无法回答的问题。

**`release` 是 `/etc/os-release`，它代表产品作答。**组合步骤写入 `/usr/lib/os-release`，带有
`NAME="Mica OS"`、`ID=mica`、`PRETTY_NAME`、`VERSION_ID`、`IMAGE_ID=<产品>` 和 `IMAGE_VERSION=<版本>`，而
`/etc/os-release` 是 `base-files` 指向它的符号链接，所以这个成员读到的是产品而不是发行版。版本来自**签名组件
取其版本的同一个表达式**，所以控制台横幅、`os-release` 和被签名的内容不会不一致；在发布构建上它就是发布字符串。

## 3. 观测到的网络状态

`GET /api/v1/network/status` 是观测到的状态：networkd、wpa_supplicant 和 resolved 此刻报告的内容。它与
`GET /api/v1/network` 是不同路由上的不同类型，后者在 `configured` 下带有期望的映射以及一份精简的观测；设置树中
的任何内容都不会以任何名称出现在这里，配置了却没有载波的接口读出来就是如此。

| 成员 | 内容 |
|---|---|
| `interfaces` | `count` 和 `entries[]`：每个接口的 `name`、`index`、`kind`、`type`、`driver`、`mtu`；`link`（`administrativeState`、`operationalState`、`carrierState`、`carrier`、`onlineState`、`addressState`）；`hardwareAddress`；`addresses[]`（`family`、`address`、`prefixLength`、`scope` + `scopeId`、`configSource`）；`dhcp`；`dns[]`；无线接口上的 `wifi` |
| `interfaces[].dhcp` | networkd 的 DHCPv4 客户端 `state` 及其 `lease`（`address`、`prefixLength`、`server`、`router`、`lifetimeSeconds`）；networkd 不报告客户端对象但有 `configSource` 为 `DHCPv4` 的地址时，租约从该地址推断并标明 `inferred: true`；否则缺失并说明原因 |
| `defaultRoutes` | `count` 和 `entries[]`（`family`、`gateway`、`interface`、`interfaceIndex`、`metric`、`protocol` + `protocolId`、`table` + `tableId`、`configSource`）；计数为零是证据（"没有默认路由"），不是缺失 |
| `dns` | `linkServers[]`（networkd 在每条链路上持有的）、`resolverServers[]`（resolved 持有的），以及 `probe`：`name`、`reachable`、`result`（`resolved`、`failed`、`timeout`）、`detail` |
| `wifi` | `associations[]`：每个无线接口的 `state`、`associated`、`ssid`、`bssid`、`frequencyMhz`、`keyManagement`、`rssiDbm`、`linkSpeedMbps`；或缺失并说明原因（没有无线接口；wpa_supplicant 的控制目录不存在；套接字无人应答） |
| `uplinks` | `active`（承载流量的上行）、`natural`（只看 metric 会选的上行）、`override`（micad 的故障切换路由，协议 109、metric 10，是否在引导流量）、`lastChange`（`at`、`from`、`to`、`reason`：`probe`、`link`、`recovered` 或 `none-up`；第一次切换之前为 `null`），以及 `uplinks[]`：每条上行的 `name`、`state`（`off`、`unknown`、`up`、`down`、`noRoute`、`blocked`）、`metric`、`probe`、`since`、`failures`、`successes` 和 `lastRound`（`at`、`ok`，以及 `targets[]`：`address`、`method`、`port`、`ok`、`latencyMs`、`detail`） |
| `capabilities` | `wifi`（`supported`、`interfaces[]`）、`bluetooth`（`supported`、`adapters[]`，只报告适配器是否存在）、`cellular`（`supported: false`、`interfaces[]`） |

这个状态面上的每个 rtnetlink 枚举都报告为**名称加上它所解析自的 id**（`protocol`/`protocolId`、
`table`/`tableId`、`scope`/`scopeId`），没有名称的 id 读作 `unknown`，而不是再重复一次数字。名称不能用
networkd 自己的 `ProtocolString`：它的 JSON 写入器对照一张只有三项的表解析 id，然后格式化十进制 id，所以一条
普通的 DHCP 路由会把自己描述为 `"16"`。两种映射都不完整：协议 id 在运行时分配给路由守护进程，路由表由配置命名，
所以这一对值让读者能区分"这个 id 没有名称"和"这个字段坏了"。

地址从 networkd 的 `Describe` 读取并按地址族格式化；`hardwareAddress` 是接口自己的。Wi-Fi 关联经 wpa_supplicant
的控制套接字读取（`/run/wpa_supplicant` 下的 `STATUS` 和 `SIGNAL_POLL`，各一次有界交换，最多四个接口），信号
强度以 `/proc/net/wireless` 为后备。这里没有任何东西读取凭据：`psk=` 行从不出现在 `STATUS` 应答中，应答中接口
自己的 MAC 不被携带（携带的是 networkd 的）。

**DNS 可达性是本文中唯一会访问网络的东西。**探测是经 resolved 对 `0.debian.pool.ntp.org` 执行一次
`ResolveHostname`（timesyncd 的后备服务器池，镜像本来就依赖这个名称，所以探测不新增向外依赖），上限 3 秒。
`reachable: false` 加 `result: failed` 给出 resolved 的错误；`result: timeout` 表示在上限内没有应答。在测试夹具
根下，观察器根本不运行探测。`uplinks` 只做报告：其背后的连通性检查只在某条上行开启检查时由 micad 运行，
不会因读取这个路由而触发（[网络](../operate/network.md)）。

**一个路由形状的代价，在此说明。**`/v1/network/status` 是与 `/v1/network/{iface}` 并列声明的静态段，路由器先
匹配静态路由：名字恰好叫 `status` 的接口无法经每接口路由寻址。没有真实接口叫这个名字，而让三个状态面写法一致
（`/time/status`、`/storage/status`、`/network/status`）被认为是值得的。

## 4. 板卡遥测

`GET /api/v1/system/telemetry` 回答三个成员，每个都带 `available`：

| 成员 | 内容 | 来源 |
|---|---|---|
| `thermal` | `zones[]` 和 `hwmon[]`（`sensor`、`label`、`milliCelsius`） | `/sys/class/thermal/thermal_zone*/{type,temp}`、`/sys/class/hwmon/hwmon*/{name,temp*_input,temp*_label}` |
| `watchdog` | `devices[]`（`device`、`identity`、`state`、`timeoutSeconds`、`timeLeftSeconds`、`bootstatus`（`raw`、`flags[]`）、`nowayout`） | `/sys/class/watchdog/watchdog*/` |
| `reset` | `reason`、`detail`、`evidence`（`watchdogBootstatus[]`、`pstore`） | 看门狗的 `WDIOF_*` 启动状态位；`/sys/fs/pstore` 下的记录 |

`reset.reason` 只根据通用的内核证据分类：看门狗报告 `WDIOF_CARDRESET` 时为 `watchdog`；存在 `dmesg-*` pstore
记录时为 `kernel-crash`（只有 `console-*` 记录不算，它是上一次启动的控制台，每次 ramoops 重启都会留下一份）；
否则为 `unknown`。`unknown` 加 `available: true` 表示来源存在且什么都没标记：正常重启、断电再上电和外部复位在
那里无法区分；`unknown` 加 `available: false` 表示板卡根本没有导出任何来源。没有任何东西读取厂商的复位寄存器，
因为这份代码无法对其测试的寄存器，是一个无人验证过的声明。

每个列表最多 32 项。负的 `bootstatus`（驱动错误）不是位掩码，报告为缺失。

**未完成的验证项。**这些适配器在 cx3576 和 uefi-x64 板卡上报告什么，这一子任务没有在硬件上验证过；夹具测试
证明的是解析和缺失规则，不是板卡。该验证的记录属于第 10 节。

## 5. 快照 schema

快照是一份 JSON 文档。`schemaVersion` 指明其结构（当前值是 `mica-core:crates/mica-apid/src/diagnostics.rs`
中的 `SCHEMA_VERSION`），成员变化时递增；读者遇到不认识的版本时，应把它认识的成员视为参考。

| 成员 | 内容 |
|---|---|
| `schemaVersion` | `SCHEMA_VERSION` |
| `collectedAt` | 按本设备时钟的 RFC 3339 UTC 时间；`time` 说明该时钟是否已校准，`boot.uptime` 是单调参考 |
| `release` | `board`、`release`、`kernel`，按第 2 节定义 |
| `system` | 第 2 节的整个状态面 |
| `boot` | `deployment`、`uptime`（第 2 节）、`reset`（第 4 节）、`update`（micad 记录的实时状态 `update` 条目：`boot` 标识和校验、带 `current`、`fallback`、`candidate` 和 `failed` 的 `state`、带剩余试运行次数的 `deployments[]`、`rollback`、`install`、`last_action` 以及 `lifecycle` 中不含凭据的部分） |
| `journal` | 有界的摘录：`scope`（`current boot`）、`priority`（`warning`）、`lineCount`、`sourceLines`、`sourceBytes`、`truncated`、`bounds`、`lines[]` |
| `previousBoot` | 上一次启动的同样摘录（`scope` 为 `previous boot`），日志没有保留时缺失并说明原因 |
| `failures` | `units`（systemd 的失败 unit：`count`、`truncated`、`entries[]`（`name`、`description`、`loadState`、`activeState`、`subState`））、`tasks[]`（结果不是成功的应用任务）、`health`（实时状态的健康映射） |
| `storage` | `GET /api/v1/storage/status` 文档，原样（存储页第 2 节） |
| `time` | `GET /api/v1/time/status` 文档，原样（[时间](time.md)第 5 节） |
| `telemetry` | `thermal`、`watchdog`（第 4 节） |
| `network` | 第 3 节的状态面，应用第 6 节的脱敏 |
| `collection` | `deadlineSeconds`、`sectionTimeoutSeconds`、`elapsedMillis`、`sections`（每个来源：`ok`、`unavailable`、`timeout`）、`redaction`（`schemaVersion`、`droppedFields`、`redactedFields`） |

来源没有应答的部分以带原因的缺失对象出现，`collection.sections` 说明它是以哪种方式失败的；从缺失部分中挑出的
成员（例如 `system` 超时时的 `boot.deployment`）也缺失，并说明 `not collected: <该部分的原因>`。

摘录是本次和上一次启动的、警告及以上级别的日志，被上限截断时保留最新的，在 systemd 上来自 `journalctl`，在
OpenRC 上来自 Base 的 `logread -b 0` / `-b -1`。日志默认跨启动保存在 DATA 上；在日志留在内存中的板卡（UBI 板卡）
上，或 `logging.persistent` 关闭时，没有上一次启动，`previousBoot` 会如此说明。每一行都去掉了主机名列。

## 6. 脱敏 schema

脱敏是经过测试的安全边界，并且失败时关闭。它是 `docs/security/model.md` 第 6 节列入确实存在的机密性中的那项
管理 API 脱敏。

它的版本（同一文件中的 `REDACTION_SCHEMA_VERSION`）是独立的计数器，不是第 5 节的那个：白名单变化时递增，每份
快照在 `collection.redaction.schemaVersion` 中记录产生它的版本。两个数字预期是不同的。

三遍处理，按顺序，在 `apid/src/diagnostics.rs` 中：

1. **实时黑名单。**每个读取路由本来就应用的字段名黑名单（`psk`、`passwordHash`、`password_hash`、`hash`、
   `privateKey`）在任何深度把这些值替换为 `<redacted>`，所以即使下面的 schema 出错，发出的也是占位符而不是值。
2. **白名单。**组装好的文档按一个 schema 遍历，该 schema 指明第 5 节的每个成员直到叶子。schema 没有指明的字段
   被丢弃；形状不对的值（指明为标量的地方出现对象）被丢弃；动态键（unit 名称、健康组件、部署 id）只有在可打印、
   最多 128 个字符且不是秘密字段名时才保留。名为 `token(s)`、`secret(s)`、`password`、`passwd`、`passphrase`、
   `credential(s)`、`authorization`、`cookie`、`apiTokens`、`key(s)` 的字段无论出现在哪里都被替换为占位符。
   schema 标为可识别身份的字段（`hardwareAddress`、`ssid`、`bssid`）以占位符的形式保留，让读者能区分"已脱敏"
   和"设备没有这个"。
3. **字符串清洗。**留下的每个字符串都被清洗：带有秘密标记（`password`、`passwd`、`passphrase`、`psk`、`secret`、
   `token`、`private key`、`authorization:`、`bearer `、`-----begin`、`api key`，不区分大小写）的字符串整个变为
   `<redacted line>`；字符串中形如硬件地址的片段（`aa:bb:cc:dd:ee:ff`）变为 `<mac>`；字符串在字符边界上截断到
   1024 字节。日志行是字符串，三遍都要经过。

按决定保留的：IP 地址、前缀长度、网关、路由、DNS 服务器地址和 machine id。它们是快照存在的意义所要承载的排障
证据，machine id 是支持人员区分设备的依据，而导出快照的运维者是在选择交出它们。排除的：凭据、令牌、私钥、
Wi-Fi 秘密、镜像仓库认证、用户内容（`/srv` 或 `/home` 下的任何东西都根本不读），以及可识别个人的网络字段：
MAC 和 BSS 地址、SSID、日志行中的主机名。

测试是这条边界的证据，两个方向都有：`every_planted_secret_is_absent_from_the_produced_snapshot` 在秘密可能落入
的每个名称和每个深度埋入秘密（包括未分类的字段、以秘密命名的动态键和一条日志行），断言产出的字节中一个都没有；
`every_benign_member_survives_the_pass` 断言文档化的无害证据全部仍在，所以白名单不能靠丢弃一切来通过；路由测试
经 API 导出一份快照，检查客户端收到的字节。

## 7. 采集上限、原子性与保留

有界意味着强制执行，每个上限都有驱动它的测试：

| 上限 | 值 | 由谁强制 |
|---|---|---|
| 整次采集的截止时间 | 20 秒 | apid 的采集器；轮次在截止之后的来源不再询问，记录为 `timeout` |
| 单个来源的超时 | 6 秒（从不超过剩余的截止时间） | apid 的采集器，按部分 |
| 同一时刻只有一次采集 | — | 一次采集进行中时的第二个 `POST` 返回 409 `diagnostics_busy`，不排队 |
| 日志摘录 | 400 行、128 KiB、每行 1 KiB、警告及以上，每次启动（本次和上一次） | micad 的 `diagnostics.rs`，保留最新的行；`journalctl` 在 5 秒时被杀掉 |
| 失败的 unit | 列出 64 个，总是报告计数；3 秒 | micad 的 `diagnostics.rs` |
| 失败的任务 | 32 | apid 的采集器 |
| 清单行 | 4096 | micad 的 `system_info.rs` |
| 遥测列表 | 各 32 | micad 的 `telemetry.rs` |
| 询问的无线接口 | 4 个，各两次有界交换（`STATUS`、`SIGNAL_POLL`；各 1 秒） | micad 的 `network_state.rs` |
| 单份快照 | 2 MiB；更大的整个拒绝，什么都不写 | 存储 |
| 存储 | 8 份快照，共 16 MiB | 存储，先删除最旧的 |

**原子性。**快照被编码、对照大小上限检查、一次性写入 `<root>/.staging-<id>.json`、fsync、重命名为
`<root>/<id>.json`，然后对目录 fsync。重命名之前，列表不显示任何新内容；任何地方的失败最多留下一个暂存文件，
下一次发布会清除它，列表也从不显示它。每份快照不会改写磁盘上的其他任何东西（没有索引文件），所以一次采集只
花一次文件写入，这正是存储页要求的闪存磨损态势。

**保留。**存储位于 `/mica/diagnostics`，在系统拥有的 DATA 命名空间中（存储页第 1 节），所以快照在重启和 rootfs
更新后保留；`/var` 是可丢弃的，会丢失它。id 是一个序列（`1`、`2`……），最新的 id 比现有最大值大一。发布之前，
删除最旧的快照，直到把新快照计入后数量和总量都低于上限。`DELETE` 是明确的删除操作。`mica-data-layout` 在启动时
以 `0700` 权限创建存储目录。随附的 `apid.service` 在 `ProtectSystem=strict` 下为它授予一个专门的 `ReadWritePaths`
例外；无关的 DATA 路径仍是只读的。在该 unit 之外运行时，发布者也会在目录不存在时创建它。

**离线。**采集只读取本地总线和本地文件系统。网络部分中的 DNS 探测是唯一的网络访问，它失败只是 `failed`/`timeout`
结果，不是采集失败。

## 8. API 路由

HTTP 契约是 `mica-core:crates/mica-apid/openapi.json`，CI 保证它与随附的可执行文件打印的内容相同；下表是摘要。

| 路由 | 认证 | 回答 |
|---|---|---|
| `GET /api/v1/system/info` | bearer 或会话 | 200 第 2 节的状态面；401；与每个 micad 读取一样的 500/503/504；405 |
| `GET /api/v1/system/telemetry` | bearer 或会话 | 200 第 4 节的状态面；同样的失败 |
| `GET /api/v1/network/status` | bearer 或会话 | 200 第 3 节的状态面；同样的失败 |
| `GET /api/v1/diagnostics/snapshots` | bearer 或会话 | 200 `{snapshots[], retention}`；500 `diagnostics_io` |
| `POST /api/v1/diagnostics/snapshots` | bearer，或带 CSRF 的会话 | 201 `{snapshot, elapsedMillis, sections, droppedFields, redactedFields}`；409 `diagnostics_busy`；500 `diagnostics_io`（存储不可写或超过大小上限；什么都不写） |
| `GET /api/v1/diagnostics/snapshots/{id}` | bearer 或会话 | 200 文档，`Content-Disposition: attachment; filename="mica-diagnostics-<machine id 前缀>-<id>.json"`、`Cache-Control: no-store`；404 `snapshot_not_found` |
| `DELETE /api/v1/diagnostics/snapshots/{id}` | bearer，或带 CSRF 的会话 | 204；404 `snapshot_not_found` |

除了写入存储的两个路由，每个路由对设备都是只读的，而这两个也只写 `/mica/diagnostics` 下。三个状态读取与其他
所有读取一样，把 micad 的回答经过实时黑名单；快照导出提供的是采集时已脱敏的已存字节。

## 9. 总线面

`com.mica.micad1` 在 micad 页面的表格之外增加四个只读成员：`GetSystemInfo`、`GetTelemetry`、
`GetObservedNetwork`、`GetFailureEvidence`。每个都返回一个 JSON 字符串，都在调用时观测；在 dry-run 下都是
`Failed`，因为观察器只在真实设备上由 `main.rs` 挂接；都没有对应的写入。故障证据读取是 micad 为回答读取而运行
程序的唯一地方（`journalctl`，参数固定，超时即杀）；原因是结构性的：工作区中没有 journald 文件的纯 Rust 读取器。
它按第 7 节所述受限。

## 10. 操作流程与排障树

### 10.1 采集流程

1. 以经认证的设备运维者身份登录内置控制台。打开**系统信息**，记录 machine id、板卡、镜像版本、源码提交日期
   和启动的部署。这是一次 `GET /api/v1/system/info` 读取；不要根据设置或机壳上的标签拼凑标识。
2. 在安全的前提下保持故障状态。打开**诊断**，选择**生成快照**，等待采集完成。采集最多需要 20 秒。409 响应表示
   另一次采集正在进行：等它结束，刷新列表，不要并发重试。
3. 即使某个来源不可用，产出的快照也是有用的。先读 `collection.sections`，记录每个 `unavailable` 或 `timeout`
   条目；缺失是证据，不是检查通过。
4. 从控制台下载快照。等价的认证 API 序列是 `POST /api/v1/diagnostics/snapshots`，然后
   `GET /api/v1/diagnostics/snapshots/{id}`。`time.status` 不是 `synchronized` 时，另行记录 id 和运维者实际的
   UTC 采集时间。
5. 把导出的文件存放在设备保证等级所批准的工单位置，等级按[安全模型](../security/model.md)定义。设备从不上传它。
   没有上游连接时采集仍然可用；只有有界的 DNS 探测可能访问网络，它的失败不会让快照失败。

如果控制台不可用但经认证的 HTTPS API 可达，就从本地连接的维护工作站使用同样的 API 序列。不要为绕过控制台而
开启 SSH、执行不受限的日志导出或添加抓包。

### 10.2 隐私与保留

快照包含 machine id、镜像和软件包版本、部署/更新状态、本次和上一次启动中警告及以上级别的日志行、失败的服务/
任务、存储和时间状态、IP 地址/路由/DNS、遥测和采集结果。IP 地址、网关、DNS 服务器和 machine id 被保留，因为
支持人员需要它们来关联设备和诊断连接。按[安全模型](../security/model.md)中设备保证等级的处理和披露规则对待
导出的文件；本设计不重述也不改变这些等级。

带版本的脱敏边界移除凭据、令牌、私钥、Wi-Fi 和镜像仓库的秘密、用户内容、SSID、MAC 地址、BSSID 以及日志行中的
主机名。脱敏减少暴露；它不会让剩下的设备标识和网络拓扑变成公开信息。传送快照之前，核实接收方和工单，只传送
生成的文件，绝不附加密码、令牌、原始私钥、不受限的日志或 `/srv`、`/home` 中的文件。

设备上的存储最多保留 8 份快照，共 16 MiB，每份 2 MiB。发布时删除最旧的条目，直到满足两个存储上限。快照位于
系统拥有的 DATA 命名空间中，所以在重启和 rootfs 更新后保留。它们没有基于时间的过期：工单关闭或证据不再需要时，
运维者必须在诊断页或用 `DELETE /api/v1/diagnostics/snapshots/{id}` 删除快照。删除导出的副本遵循工单系统的保留
策略，而不是设备的数量/大小策略。

### 10.3 升级处理

升级处理必须包括：

- 下载的快照及其 id；
- 来自 `system` 和 `boot.deployment` 的 machine id、板卡、系统版本/源码提交日期和启动的部署；
- 症状、首次观察到的时间、复现步骤，以及因 `time.status` 未同步而是否另行核实了时间；
- `collection.sections` 中每个非 `ok` 的条目，以及已采取的操作和症状出现前刚做的任何配置变更。

不要把缺失的部分解读为健康，也不要用未脱敏的证据替代它。如果采集本身失败，报告 HTTP 错误、列表显示的保留值和
系统信息读取；保留故障设备的状态，等待支持人员指示下一步。

复位原因、温度和看门狗数据依赖硬件。夹具测试验证解析和缺失语义，但 cx3576 和 uefi-x64 实体板卡尚未验证。因此
不可用或不合理的 `boot.reset`、`telemetry.thermal` 或 `telemetry.watchdog` 结果必须连同板卡标识和快照一起升级；
不得标记为健康，也不得当作已完成的板卡验证。

### 10.4 排障树

每棵树都从观测到的证据开始。只有在观测分支确定了缺失的事实之后，才去查看期望的设置。

#### 没有网络

- **症状：**设备没有可用的网络路径。
  - **证据：**`network.interfaces.available` 为 false。
    - **处置：**保留其 `detail`，检查 networkd 是否应答，观察器持续不可用时升级处理；不要从期望的设置推断状态。
  - **证据：**`network.interfaces.entries[]` 为空，或受影响的接口 `link.carrier: false`。
    - **处置：**核实物理端口、网线、交换机端口和对端是否正确。出现载波后重新采集。
  - **证据：**有载波但 `addresses[]` 为空，或 `dhcp.available` 为 false / `dhcp.state` 不是 `bound`。
    - **处置：**把接口与网络页上的期望配置对比，修正 DHCP/静态声明或 DHCP 服务器，然后确认观测到了地址和租约。
      只有配置不算成功。
  - **证据：**有地址但 `network.defaultRoutes.count` 为零。
    - **处置：**修正 DHCP 路由器或静态网关，核实目标接口上出现了默认路由。
  - **证据：**有默认路由但 `network.dns.probe.reachable` 为 false（`failed` 或 `timeout`）。
    - **处置：**核实 `network.dns.linkServers` 和 `resolverServers`、解析器的可达性和上游路由。如果只是探测名称被
      策略拦截，记录该策略，并通过批准的解析路径验证应用所用的名称。

#### 时间错误

- **症状：**显示的时间、证书或计划任务使用了错误的时间。
  - **证据：**`time.status` 为 `offline-degraded`，且网络树显示没有路由或 DNS 失败。
    - **处置：**先恢复路由/DNS；时间服务会继续重试，无需运维者重启。
  - **证据：**`time.status` 为 `invalid-source`。
    - **处置：**核实配置的 NTP 来源和上游服务器；替换应答不可用样本的来源。
  - **证据：**`time.status` 为 `polling`，且 `time.sample.correction` 为 `step`。
    - **处置：**等初始的大幅校正完成，然后重新采集并要求 `synchronized`。在此之前，用 `boot.uptime` 而不是
      `collectedAt` 关联事件。
  - **证据：**`time.status` 为 `unknown`，或该部分不可用。`unknown` 表示状态所依赖的某个信号无法读取，对时钟本身
    什么也没说：此时 `time.synchronized` 是缺失而不是 false。
    - **处置：**保留 `time.detail` 和 `collection.sections.time`，核实 `time.detail` 指出的服务（timesyncd 或
      timedated）可被观测，持续缺失时升级处理。

#### DATA 已满

- **症状：**因 DATA 已满，写入或更新暂存失败。
  - **证据：**`storage.tiers[]` 中 `data` 条目的 `space.usedPercent` 达到警告/严重策略，且 `pressure` 与之对应。
    - **处置：**通过各自支持的接口删除不再需要的诊断快照和运维者拥有的数据。不要删除 `/mica` 中的未知文件；
      释放空间后确认压力解除。
  - **证据：**`storage.tiers[data].updateWorkspace.available` 为 false。
    - **处置：**释放足够的 DATA 空间以恢复预留的更新工作区，然后再重试更新。
  - **证据：**DATA 层只读/未挂载，或尽管空闲空间足够，`storage.namespaces.binds[]` 中的 `/mica` 绑定降级/不可用。
    - **处置：**停止写入，保留其检查/就绪证据，升级处理以走文档化的离线修复路径；清理容量无法修复文件系统或
      绑定故障。

#### 更新失败或回退

- **症状：**更新失败，新部署未被确认，或设备启动了上一个部署。
  - **证据：**`boot.update.install.status` 为 `failed` 且带 `error_code`，或候选列在 `boot.update.state.failed`
    中，且 `failures.tasks[]` 带有应用失败。
    - **处置：**保持启动中的已知良好部署运行，修正记录的校验或存储原因，重新采集，然后通过支持的更新流程重试。
  - **证据：**`boot.update.state.candidate` 已设置，且 `boot.update.boot.deploymentId` 就是该候选。
    - **处置：**在仍有健康故障时不要强制确认。解决 `failures.units`、`failures.health`、存储和网络证据，然后让
      正常的健康确认路径确认部署。
  - **证据：**`boot.update.boot.deploymentId` 是 `state.fallback` 而不是尝试的候选，或复位证据紧跟在尝试的启动
    之后。
    - **处置：**按回退处理，保留更新和复位两方面的证据；如果原因不是明确的校验或空间错误，在再次尝试之前升级
      处理。
  - **证据：**`storage.tiers[data].updateWorkspace.available` 为 false。
    - **处置：**重试前先按"DATA 已满"树处理；反复下载无法绕过预留。

#### 意外重启

- **症状：**运行时长被重置，而没有人有意重启。
  - **证据：**`boot.uptime.seconds` 确认最近启动过，且 `boot.reset.reason` 为 `watchdog`。
    - **处置：**检查 `telemetry.watchdog.devices[]`、失败的 unit、健康状态和最后的有界日志行。连同实体板卡一起
      升级处理，因为看门狗证据依赖硬件。
  - **证据：**`boot.reset.reason` 为 `kernel-crash`，且 `boot.reset.evidence.pstore` 指出一条崩溃记录。
    - **处置：**保留快照，并升级处理 pstore/日志、内核版本、镜像构建和复现步骤；除非支持人员要求，不要仅为
      复现而再次重启。
  - **证据：**故障前后 `telemetry.thermal` 中的温度读数偏高，或在预期会导出温度的板卡上该部分不可用。
    - **处置：**核实散热、机壳气流和环境温度限制，然后升级处理这个依赖硬件的读数或缺失。
  - **证据：**`boot.reset.reason` 为 `unknown`，不论是否可用。
    - **处置：**根据工单/现场记录区分运维者重启、断电和外部复位。连同板卡标识升级处理反复出现的无法解释的复位；
      通用证据无法对它们分类。
