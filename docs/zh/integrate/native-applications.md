# Mica OS 上的原生应用

Mica OS 上的原生应用是**在镜像里**的代码。它在构建时打成 Debian 软件包，和其他一切一起组装进经 verity 封存的
根，由 systemd 作为普通 unit 启动，只能由签名的 A/B 系统更新替换。设备上没有 `apt`，以后也无法安装；这是产品
的性质，不是等待填补的空缺。

本文是集成方走这条路径的指南。[containers.md](containers.md) 是另一条路径的指南，两者之间如何选择见
[applications.md](applications.md)。

这里引用的一切都链接到源码树，而不是从中转抄，因为 `tools/docs/verify-links.sh` 会解析这些链接，其中任何一个
不再存在时 `make docs-verify` 就会失败。文件本身是示例；本文是地图。

---

## 1. 唯一的问题

**这段代码必须随系统更新一起移动，还是按自己的节奏移动？**原生意味着前者。由此有三个后果，每一个都可以检查，
而不是品味问题：

- **一次发布，一个制品。**应用的版本就是镜像的版本。没有单独的应用版本可报告，不发布镜像就无法发布修复，
  现场也不会出现没有一起构建和测试过的应用与系统版本组合。
- **回滚属于部署。**A/B 回滚把应用和系统一起带回，一步原子操作，因为它们是同一个文件系统。
- **失败属于启动。**更新后失败的原生 unit 会让健康闸门失败，没有到达 `mark-good` 的启动会被 U-Boot 的尝试
  计数器回滚。见第 6 节。

如果这三条中任何一条读起来像代价而不是保证，这个应用就应该放进容器。

## 2. 软件包是一个生产者

根文件系统在一次 APT 事务中由本地 Debian 软件池组装到固定版本的基础之上。添加原生应用意味着向这个池添加一个
**生产者**，而不是修改某个构建阶段。

生产者是一个包含 `producer.env` 和 `Dockerfile` 的目录，可以位于树中任何位置；第一方的生产者在生产该软件包
的仓库中（`mica-core:pkgs/`、`mica-system-base:debs/`、`mica-build:docs/design/packages.md`），板卡专属的在
`mica-build:boards/<board>/` 下。`producer.env` 声明生产者产出什么、为哪些架构产出，以及每个软件包的归档应
带多少个 `multi-user.target.wants` 符号链接。完整的契约，包括 control 模板、版本戳、`PREPARE` 钩子和预检，
在各生产仓库自己的打包代码中（`mica-core:scripts/deb/`、`mica-build:docs/design/packages.md`），这里不再
重复。

写一个生产者之前值得知道的：

- **`make os-deb-<producer>` 不需要注册。**目标是通过 `mica-core:scripts/deb/producers.sh` 解析的模式规则；
  创建目录就是"添加一个组件"的全部。
- **编译不是打包。**打包镜像带 `dpkg-dev`，不带编译器。构建二进制在 `PREPARE` 钩子中、在主机上、构建之前
  完成，这也是为什么交叉编译的 `arm64` 负载必须在 `arm64` 容器中打包，以便 `dpkg-shlibdeps` 针对正确的库
  解析。
- **闸门读的是归档，不是清单。**`mica-core:scripts/deb/package-gate.sh` 断言整个池中文件归属唯一、版本戳唯一、
  每个软件包有 `copyright` 文件，以及每个软件包声明的启用符号链接数量。对另一个本地软件包的依赖必须固定到
  池中的确切版本。
- **`dpkg-shlibdeps` 看不到的东西要手写出来。**按名称 `exec` 的程序、用 `dlopen` 打开的库、维护脚本中的
  `useradd`：ELF 元数据不携带这些，所以由 control 模板写明。

## 3. unit，以及启动它的东西

软件包带上二进制、它的 unit，以及（如果要在启动时运行）它自己的启用符号链接。`producer.env` 中的 `ENABLEMENT`
声明数量，不带链接的软件包写 `0` 而不是省略，这样遗漏和决定不会看起来一样。

有两个顺序上的事实是 Mica 特有的，而且都很关键：

- **`RequiresMountsFor=`** 是 unit 声明"在我写入的分区挂载之前不得启动"的方式。DATA/state 和其他 DATA 命名空间
  是启动期间建立的绑定挂载，在它们之前启动的守护进程会写到只读根或一个代替存储的 tmpfs 上：这能工作，然后在
  下一次断电时丢失一切。`mica-core:crates/mica-apid/dist/apid.service` 带有实际示例，并在原处说明原因。
- **unit 不能在设备上编辑。**根是不可变的 dm-verity squashfs，`systemctl edit` 无处可写。每台设备不同的东西
  （代理地址、站点标识）在运行时从 DATA/state 上的文件读取，unit 只带回退值。
  `mica-pkgs:crates/mica-mqttd/dist/mica-mqttd.service` 是范式：可选的 DATA/state 文件用
  `EnvironmentFile=-`，默认值写在 `Environment=` 行中，二进制自己的参数解析里再写一遍同样的默认值，这样被
  清空的环境不会悄悄改变守护进程运行的模式。

## 4. 专用用户

应用以自己的静态系统账户运行，由软件包的 `postinst` 用 `useradd`/`groupadd` 创建，并在 control 模板中写出对
`passwd` 的依赖。实际示例是 mqtt 生产者（`mica-pkgs:crates/mica-mqttd`）。

**用静态账户，不用 `DynamicUser=yes`**，其原因不止适用于迫使这样做的那个情形。D-Bus 策略文件在 `dbus-daemon`
启动读取它时解析 `<policy user="...">`，那时该 unit 的动态用户还不存在，所以指向动态用户的规则能解析、能加载，
却匹配不到任何东西。一条无法匹配的授权比缺失的授权更糟，因为在 diff 和评审中它读起来和有效的一模一样。同样的
论证适用于任何需要提前写出身份的东西：授权设备节点的 udev 规则、维护脚本中的 `chown`、DATA/state 目录上的 ACL。

`DynamicUser=` 还隐含 `RemoveIPC=`、`PrivateTmp=` 和一个 `UMask=`；不用它的 unit 应该明确写出这些，而不是
悄悄失去它们。

## 5. 状态与数据

[存储策略](../reference/storage.md)定义物理承载和配额预算。`StateDirectory=` 可以在可写的 `/var` 绑定下创建
持久的服务状态。大的应用数据属于批量命名空间。

| 位置 | 用途 | 生命周期 |
|---|---|---|
| 经批准、由 DATA/state 承载的服务叶子目录 | 小的持久服务状态 | 重启和系统更新后保留；重置范围是明确的 |
| `/srv` | 集成方的数据和卷 | 不限量使用 DATA，或挂载在那里的用户自己的磁盘；没有重置层级会清除它，出厂重置清除 DATA 上的 `/srv` |
| `/run`，以及不保存在 DATA 上时的日志 | 运行时文件和日志 | 每次启动重建 |
| `/var`，包括 `StateDirectory=` | 有界的持久服务数据 | 重启和系统更新后保留；与缓存和临时文件共享项目 101 |

服务自有的状态使用 `StateDirectory=` 和明确的私有权限。systemd 会添加所需的挂载依赖。使用其他早期 `/var` 路径
的服务同样必须等待 `var.mount`。不需要新增按目录的绑定。避免授予应用访问其他服务状态的权限。

## 6. 健康与日志

日志进入 `/run/log/journal` 下有界的易失日志。重启之前导出所需的诊断证据。

健康是原生路径与容器路径差别最大的地方，值得准确说明它承诺什么、不承诺什么：**它刻意承诺得很少**。
`mica-system-base:payload/usr/lib/mica/mica-health` 每次启动运行一次，等待 systemd 稳定，在一个**必需集合**
通过时确认经认证的已启动部署：启动事务完成，micad 在 `com.mica.micad1` 上应答，apid 在 `/healthz` 上应答。
这个集合由 `/etc/mica/health.conf`（`mica-system-base:payload/etc/mica/health.conf`）中的 `require=` 行指定。
闸门观察到的其他一切，**包括处于失败状态的 unit**，都只报告，从不致命。未确认的部署会在回退之前耗尽原生
UEFI/FIT 的尝试预算。

判据是"这个部署能否恢复"，而不是"这台设备上的一切是否正常"：在任何失败 unit 上都失败的闸门，会为一个在该
SKU 上什么也不管的 oneshot 在每次启动时消耗一次尝试。

所以原生应用 unit **不在**更新健康闸门之内。由此有以下几点：

- **更新后的崩溃循环不会让设备回滚。**它留下一台运行中、可达、可更新、但应用损坏的设备，这是两种失败中较好的
  一种，因为另一种是设备被回滚进一个可能同样无法运行的部署。用健康报告和诊断发现它，用更新修复它。
- **应用仍然能让必需成员失败。**让网络中断、卡住 micad，或抢走 apid 端口（8080，开启 HTTPS 时 8443）的
  unit 会让闸门失败，不是因为它是应用，而是因为它拿走了进入设备的途径。带真实就绪信号的 `Type=notify`，以及
  带保活的 `WatchdogSec=`，仍然是 unit 向 systemd 如实报告自己的方式；它们现在影响报告，而不是裁决。
- **必需集合是构建时的决定。**`/etc/mica/health.conf` 在只读根内，所以闸门要求什么是一次经过评审的镜像修改，
  而不是事后在设备上设置的东西。没有 `require=` 行的配置会被**拒绝**，而不是被理解为"确认任何东西"：空的
  必需集合意味着总是 mark-good。
- **失败的 unit 仍然可见。**闸门把数量和名称报告给 micad 的 live-state `health.units`，每个 unit 一行日志，
  这一项也随诊断快照的 `failures.health` 带出。

## 7. 指定的硬件

设备访问归 systemd，上面没有任何 Mica 特有的东西：

- `DeviceAllow=` 指定节点和访问模式，并且（在该 unit 关闭 `PrivateDevices=` 时）是让一个其他方面受沙箱限制的
  unit 能访问设备的方式。
- `SupplementaryGroups=` 是专用用户访问 `dialout` 等组所有的节点的方式，无需改变节点的归属。
- **随软件包提供的 udev 规则**是让节点首先获得稳定名称和正确组的方式。它运行时需要第 4 节的静态账户已经存在。
- `ConditionPathExists=` 区分"这块板卡没有那个设备"和"这个 unit 坏了"。前者应跳过 unit；只有后者应让它失败，
  也只有后者应让第 6 节的健康闸门失败。

设备名称是板卡事实。从 [cx3576](../hardware/cx3576.md) 下的板卡页面获取，而不是从另一块板卡的 unit 中获取；
`mica-build:boards/cx3576/package/hwinit/`（`mica-build:boards/cx3576/package/hwinit`）是已发布的板卡专属 unit
所在的位置。

## 8. 上限

`CPUQuota=`、`MemoryHigh=`、`MemoryMax=` 和 `TasksMax=` 与容器的 CPU、内存和 pids 限制是同一组内核控制器
（[containers.md](containers.md) 第 3 节），而 `IOReadBandwidthMax=`/`IOWriteBandwidthMax=` 这一对在容器中没有
对应项：原生 unit 在自己的 unit 文件中设置它们。

设置它们的原因不是应用自身的失败，而是 DATA 和 `/var` 是共享的：一个无限制地泄漏内存或写日志的原生守护进程会
把 micad、apid 和更新路径一起拖垮，第一个症状就是设备无法被远程管理来修复。

**没有任何东西要求它们。**没有上限的 unit 会像其他 unit 一样被组装进镜像并启动。没有准入步骤，本文是唯一在
提要求的东西。

## 9. 更新，以及不随它回滚的东西

原生应用随镜像更新：新部署安装在当前部署旁边，启动记录选中它，二进制、unit 和系统一起移动，要么全部移动，要么
都不移动。回滚是同一条边的反向，在启动未通过健康闸门时自动发生（[../operate/updates.md](../operate/updates.md)）。

**代码会回滚。数据不会。**DATA/state 和其他 DATA 命名空间按设计位于部署之外，这正是它们能在更新后保留的原因，
所以一个在更新后首次启动时迁移了自己 schema 的应用，回滚之后就是旧的二进制指向新的数据。A/B 机制看不到这一点，
也不会发出警告。

这与容器的风险相同，归属也相同：集成方编写上一版本仍能读取的迁移，或保留一份可以恢复的副本，或接受回滚恢复的
是服务而不是状态。Mica OS 对此不持立场，也不提供任何一种按应用的回滚。

## 10. 用户服务，以及为什么它们不是这条路径

根是只读的，所以 `systemctl enable` 和 OpenRC 的运行级别无法保存运行中设备上添加的服务。`mica unit` 在两种
init 上都把服务保存在 DATA/state 上（通过 Base 的 `/usr/lib/mica/mica-unit`，它不在 `PATH` 中）：
`mica unit install <file>`、`enable`（会启动它）、`disable`（会停止它）、`remove` 和 `list`。在 systemd 上，
unit 放进 `/usr/local/lib/systemd/system`，即 DATA/state 的一个绑定；在 OpenRC 上，脚本放进 `/usr/local/etc`，
即 DATA/state 的一个绑定，由 `mica-local` 在启动时启动已启用的脚本。根自带的名称会被拒绝，所以用户服务永远
不能替换或屏蔽 Mica OS 的服务；它在 micad 之后启动，并且从不需要 micad。它在重启和 A/B 更新后保留，应用数据
重置会清除它（`mica-system-base:docs/floor-and-options.md`）。

管理守护进程也把这类服务作为配置保存：`/mica/config/services.json` 中的 `services.units.<name>` 保存 unit 的
类型（`systemd` 或 `openrc`）、文本、可选的 conf 文件以及是否启用，micad 通过 `mica-unit` 协调它们。最多 32 个
服务，文本最多 64 KiB，conf 最多 16 KiB，总计 256 KiB。有三种途径访问它们：

- 在设备上：`mica unit install <file|-> [--name N] [--conf FILE] [--enable]`、`enable`、`disable`、`remove`、
  `start`、`stop`、`restart`、`list` 和 `logs [--tail N]`；
- API：`GET /api/v1/units`，`PUT` 和 `DELETE /api/v1/units/{name}`，
  `POST /api/v1/units/{name}/start|stop|restart` 以及 `GET /api/v1/units/{name}/logs`；
- 控制台的服务页面，每个 unit 一个面板。

> status: shipped — evidence: `mica-core:docs/mica-core.md`, `mica-core:crates/mica-apid/openapi.json`

它存在、能工作，并且刻意**不是**交付原生应用的受支持方式。

原因是把第 9 节反过来读。用户服务在 A/B 对之外，所以系统回滚时它不回滚：回滚之后它仍在运行、仍然启用，并且
现在搭配的是一个它从未针对其构建过的系统发布。失败不是一次拒绝，而是一个能启动、行为却有微妙差异的应用，
出现在一台已经出过一次问题的设备上。

把它用在它擅长的地方：运维者明知而安装的代理、启动调试期间的临时服务、用完即移除的调试工具。

## 11. 没有强制的东西

直白地说明，因为上面的一切都是文档和经过测试的惯例，而不是会拒绝的机制：

- **没有东西为单独安装的 unit 签名。**镜像内容由经认证的部署元数据和必需的签名 dm-verity 覆盖；在运行中的
  设备上写进 `mica-unit` 的文件或容器声明，两者都不覆盖。
- **没有强制的上限。**第 8 节和 containers.md 第 3 节描述了该设置什么；没有东西检查是否设置了。
- **没有秘密存储。**原生应用的凭据是软件包或运维者放在 DATA/state 上的文件，归 root 或应用的账户所有，
  Mica OS 不创建、轮换、托管或审计它们。
- **没有按应用的回滚。**原生代码继承整个部署的 A/B 回滚，这不是同一个承诺：它移动设备上的每个应用，而不移动
  它们的任何数据。

能改变这些答案的控制手段，即签名的独立软件包、能拒绝 unit 的准入、不可绕过的上限、受保护的秘密存储、按应用的
健康闸门回滚，都不是 Mica OS 的一部分。

## 12. 完整示例

本页刻意不给自己的完整示例。原生应用是对构建树的改动：一个生产者，其契约见
`mica-build:docs/design/packages.md`，构建进镜像并作为发布版发出，所以在这里
给示例等于重述那份契约，并随它过时。设备上的路径——用 `mica unit` 安装你自己
的服务并逐步检查——在[服务](services.md)中有完整示例；在打包之前，也可以用
这条路径在设备上试运行应用。
