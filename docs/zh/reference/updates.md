# 更新引擎

Mica OS 把各自签名的内核/support 和根组件作为部署安装，把 core 组件作为 core 集合安装。原生后端是
`mica-deploy`；`micad` 通过 D-Bus 暴露其状态和操作，`apid` 在经认证的 API/CSRF 边界之后暴露它们。
格式是严格的：只读取当前版本的部署、集合、目录和设置模式。

## 一次更新如何进行

一次只进行一个更新，要么是一个 core 集合，要么是一个系统（一个部署）。micad 驱动 `mica-deploy`
并加上运维者的策略；控制台、API 和设备命令行发出的都是同样的请求。

1. **检查。** 先读设备通道的 core 线：在运行中的根上能选中的更新 core 集合会被提供；选不中的显示为
   `update.lifecycle.waitsForSystem`。然后是产品线：面向设备的板卡、架构和产品、代数更高的发布会被
   提供。读不到 core 线会被报告（`coreCheckFailed`），但从不阻挡系统更新。
2. **获取。** 对象下载到 DATA 上的 `/mica/updates`，从小到大，源站发布了传输索引时用本地分块拼装，
   每个都按签名的摘要和长度校验。`general` 上的系统更新会一起获取该通道里适合新根的最新 core 集合。
3. **安装。** 只能从已确认的运行中部署开始。先退役非活动部署，再把新部署复制进 SYSTEM，并做文件和
   目录同步，其启动条目最后才变为可见，带三次尝试。随之获取的 core 集合作为一个**配对**安装。
4. **重启。** 除非策略是 `auto` 且 `rebootPolicy: window`，否则从不自行重启；其他情况下
   `reboot-required` 等待运维者或重启闸门。
5. **试运行。** 加载器在每次启动前递减一次尝试。健康闸门确认已启动的部署（及其配对集合），它成为
   `current`，之前的成为 `fallback`。
6. **回退。** 三次启动都未确认，试运行耗尽，加载器启动回退部署及其当时运行的集合。失败的 id 被记住，
   同一发布不会再被提供；修复需要更新的代数。

实时状态中的 `update.lifecycle` 说明正在提供和已暂存的是什么（`kind` 为 `deployment` 或 `set`），失败的
生命周期会指明它终止于哪一步（`failedDuring`：`check`、`fetch` 或 `discard`）。

## 状态与身份

`GET /api/v1/update` 报告经认证的 `boot`、调和后的 `state`、`deployments`、`rollback`、`install`、
`last_action` 和获取的 `lifecycle`。

| 字段 | 含义 |
|---|---|
| `boot.deploymentId`、`kernelId`、`rootfsId` | 经认证的运行中部署及其组件 |
| `boot.contentVerified`、`boot.bootVerified`、`boot.secureBoot` | 对内容校验和平台启动校验的分别观测 |
| `state.current` | 已确认的部署 |
| `state.fallback` | 保留的可用部署 |
| `state.candidate` | 已激活、等待确认的部署 |
| `state.failed` | 原生后端强制执行的失败部署 ID |
| `state.highestGeneration` | 单调递增的安装下限 |
| `deployments` | 经认证的版本/代数/组件身份和剩余尝试次数 |
| `rollback` | 原子的后端裁决：是否允许、目标和拒绝原因 |

获取依次经过检查、下载、就绪和安装，并有明确的不可用/失败状态。启动观测区分校验、确认、待重启和
回退。API 不会从不受信任的根元数据或可编辑的版本标签推断已安装的内容。

`lifecycle.state` 是一个词，按优先级选出：`installing`，然后是正在运行的操作（`checking`、`downloading`、
`discarding`），然后是 `update-unavailable`（工作区未就绪），然后是 `failed`（这两种带 `code`），然后是
`ready`（已暂存经校验的描述符），然后是启动给出的阶段，最后是 `idle`
（`mica-core:crates/micad/src/update_lifecycle/snapshot.rs`、`crates/micad/src/deployment.rs`）：

```text
   idle / succeeded
        |  检查（策略计划、控制台、mica update check）
        v
    checking ---> idle（没有更新的，或在 lifecycle.available 中报告了更新的发布：
        |               策略为 check 时到此为止）
        |  安装请求（控制台、mica update install），
        |  或策略 auto 在维护窗口内
        v
   downloading --> ready（已暂存经校验的描述符）
                     |
                     v
                 installing
                     |
                     v
              reboot-required（候选已安装，等待重启）
                     |  重启：加载器启动候选，3 次尝试
                     v
                 validating（运行中的候选等待健康闸门）
                  |        \
     闸门通过     |         \  尝试用完（被拒绝的候选在重启前读作
                  |          \  reboot-required）
                  v          v
              succeeded    加载器启动保留的回退
                            --> rolled-back（更新失败后运行保留的部署）

   任何一步都可能以 failed（带 code）结束；工作区未就绪时为 update-unavailable；
   待定的 core 集合为该集合给出同样的 reboot-required / validating 阶段
```

## 获取与安装

来源是一个**更新根**，即以 `/` 结尾的 URL，例如 `https://res.micaos.dev/update/`。客户端在其下先读
未签名的清单 `v1/manifest.json`（列出每个产品的当前发布），再读该发布的文档，然后读它签名的描述符，
每样都只在需要时才读。信任来自描述符：客户端只接受自己的板卡、架构和产品，只接受高于当前运行代数
的发布，只接受描述符列出的对象。清单的修订号作为一致性检查被记录下来，防止镜像混乱；产品没有通道，
也没有过期一说，所以被扣下的清单读作"没有更新的"。格式及其兼容规则见
`mica-core:docs/mica-core.md` 6.2 节。

文件位于物理 DATA 上的 `/mica/updates/{staging,downloads,verified}`。工作区探测检查挂载身份、可写性、
空闲空间和有界的内容。HTTP 范围请求续传不完整的对象；完整的字节和长度必须与经认证的元数据一致。
`MICAUPD1` 离线导入携带同样的签名部署及其对象的任意子集，不含归档路径或链接。一次导入可以携带 0 到
描述符对象数之间任意多个对象：一个签名部署发布为 `full`、`root` 和 `kernel` 三种归档
（[该用哪个归档](../operate/updates.md#2-该用哪个归档)）。每个缺失的对象必须已经在存储中。U 盘或 SD 卡上的
归档（在介质根目录或 `mica-updates/` 中）由 `GET /api/v1/update/media` 列出，在内核支持外接介质的板卡上
由 `POST /api/v1/update/media/import` 导入。部署不列出 core 组件；它们来自设备的
[core 集合](#core-集合)。描述符中必填的签名字段 `product` 必须等于设备的产品：
`/usr/lib/mica/product.conf` 中不带引号的 `PRODUCT=<name>` 行。目录服务器按产品分键。没有最低运行版本的
规则。

**增量传输。** 下载缺失对象之前，客户端先用已持有的分块（其部署的对象、其 core 集合的组件和之前的
获取）拼装能拼出的部分，分块由双方共用的内容定义分块器切出，然后按对象的传输索引（`<path>.index`，
`MICAIDX1`）只从 `chunks/<digest>` 获取其余部分。这条路径上的东西都不被信任：拼好的对象像整份下载
一样校验，任何失败都退回到下载整个对象。不发布索引的源站同样合规。对象按从小到大获取，所以断电最
可能只损失最后、最大的那个。在 NAND 板卡上（`storage: ubi`，目前是 qemu-armhf），对象存放在静态 UBI 卷中
而不是 SYSTEM 上的文件，事务、记录、试运行和增量传输都相同（`mica-core:docs/mica-core.md` 6.6 节）。

安装要求经认证的运行中部署 A 已被确认健康。它校验每个新的或复用的对象，并检查目标容量，包括退役
非活动部署 B 将释放的已分配块。被拒绝的描述符、损坏的输入或容量预检失败都会让两个已安装部署保持
不变。

安装器先持久地删除 B 的启动记录，再回收其独占的对象和描述符。在 FIT 上，两份冗余环境副本都必须先
忘掉 B，才能进行任何回收。与 A 或新部署共享的组件保留原位。新的 B 从 DATA 复制，使用临时文件、精确的
摘要检查、文件同步和目录同步；只有在它的全部对象和描述符都持久化之后，其启动条目才变为可见。部署
记录最多两条。三次尝试的试运行计数并不意味着第三个部署。

激活前的中断让 A 保持可启动。原生条目就是提交记录：即使对应的状态写入没有完成，DATA 状态调和也会
丢弃已退役的回退部署并发现已激活的候选。在新 B 完成之前，A 是唯一可启动的部署；A 自身损坏将需要
恢复。B 一旦激活，A 就是它的回退。确认 B 后，B 成为当前部署，A 作为下次替换时保留的回退。

仅根更新复用内核/support 对象。仅内核更新复用根对象。组合更新两者都发布。正常的系统安装从不写入
固件加载器区域，也不登记密钥。

## 确认、失败与回滚

UEFI 使用签名的共享 UKI 和 systemd-boot Type #1 条目，带原生的试运行计数。固定版本的加载器补丁在递减
无法持久化时拒绝启动，并排除已耗尽的条目。cx3576 使用签名 FIT 和[启动契约](boot.md)中描述的冗余严格
记录策略。

每个候选有三次尝试。启动健康服务只在必需服务和策略检查通过后确认经认证的运行中部署。已知的已确认
元数据/健康失败会在存在可用回退时退役该记录。SYSTEM/DATA 共享故障会停下来等待明确的恢复。没有任何
路径会重新填满耗尽的计数器，或回退到未签名的内容。

`POST /api/v1/update/install` 接受一个已校验的 `deploymentId`。`/confirm` 和 `/reject` 也接受部署 ID。
`/rollback` 原子地检查运行中的内容已确认、没有待确认的候选且存在可用回退。它报告目标以及单独的重启
操作。原因有 `candidate_pending`、`running_not_confirmed` 和 `no_usable_fallback`。调用方给出它确认过的
`expectedTarget`，若目标此后发生变化，回滚会被拒绝。micad 记录该目标，下次启动后第一次读取更新状态时，
`lastRollback` 报告（仅限那次启动）设备是否启动了它。

失败 ID 和代数下限在回滚和来源变更之间持续生效。修正后的发布需要新签名的更高代数；没有任何 UI 操作
能清除这些安装约束。

## 策略与重启

公开的 `/mica/config/updates.json` 设置（`mica/update-config/v1`）覆盖出厂默认值（`mica/meta/v1`），涉及
来源、模式、允许的网络、计划、重启策略以及每种集合跟随的通道。它们不能注入元数据键。自动检查/获取
使用同一条原生获取路径。维护窗口使用 UTC：每个窗口列出其星期（`mon` 到 `sun`），窗口可以跨过午夜，
任意两个窗口不得重叠。重启闸门保留维护窗口、健康、安装进行中和覆盖检查；覆盖不会中断安装。"安装最新
发布"（控制台、`micad update install`）在所有窗口之外或按流量计费的链路上会立即被拒绝，否则经过同样的
闸门检查、获取和安装；除非命令行给出 `--reboot`，它从不重启。

### 策略文档

运维者的 `/mica/config/updates.json`（`mica/update-config/v1`）覆盖镜像内置的 `mica/meta/v1` 默认值。每个
已发布的产品都内置 `policy: check`、`checkIntervalMinutes: 1440` 和来源 `https://res.micaos.dev/update/`。

| 键 | 类型 | 默认值 | 含义 |
|---|---|---|---|
| `policy` | `off`、`check`、`auto` | 内置（`check`） | `off`：设备什么也不主动做，手动请求和导入仍然可用。`check`：按间隔检查元数据，从不下载。`auto`：在维护窗口内检查、获取并安装 |
| `checkIntervalMinutes` | 整数 | 内置（1440） | 两次自动检查之间的分钟数；`0` 关闭自动检查 |
| `checkAt` | `HH:MM` UTC 或 `null` | 无 | 把检查锚定到一天中的某个时间，而不是守护进程启动的时间 |
| `channels` | `{kind: channel}` | 内置，否则 `general` | 每种集合跟随的通道，例如 `{"core": "general"}` |
| `rebootPolicy` | `manual`、`window` | `manual` | 在 `auto` 下：停在 `reboot-required`，或在同一窗口内经重启闸门重启 |
| `source.url` | 以 `/` 结尾的更新根，或 `null` | 内置 | 设备检查的地址；`null` 回到内置地址 |
| `source.maxBytes` | 整数 | 500000000 | 单次获取的字节预算 |
| `network.mode` | `online`、`metered`、`offline` | `online` | `metered` 允许检查，但除非 `meteredAllowsFetch` 否则不下载；`offline` 只允许导入 |
| `network.meteredAllowsFetch` | 布尔 | `false` | 允许在按流量计费的链路上下载 |
| `maintenance.windows` | `{days, start, end}` 列表 | 无（任何时间） | 允许安装的时间，UTC；`days` 取 `mon` 到 `sun`，至少一个；`end` 早于或等于 `start` 时跨过午夜，两者相等即 24 小时；窗口可以相接但不能重叠 |
| `rebootGate.blockingStatuses` | 字符串列表 | `["blocking"]` | 会关闭"可安全重启"闸门的健康状态 |
| `rebootGate.overrideMaxSeconds` | 整数 | 3600 | 重启闸门覆盖的最长时间，不超过一小时 |

`auto` 至少需要一个维护窗口：没有窗口时会被拒绝，因为"任何时间"意味着发布一出来就安装。列出信任密钥
（签名锚点）的文档会被拒绝。下面是一台在周末夜间安装并在同一窗口内重启的设备的示例：

```json
{
  "schema": "mica/update-config/v1",
  "policy": "auto",
  "checkIntervalMinutes": 360,
  "rebootPolicy": "window",
  "maintenance": {
    "windows": [ { "days": ["sat", "sun"], "start": "01:00", "end": "04:00" } ]
  },
  "network": { "mode": "online" }
}
```

不能被打断的应用在总线上报告 `ReportHealth(component, "blocking", why)`，完成后清除；只要有任何组件报告
blocking 状态，重启闸门就保持关闭。`mica-health` 的磁盘压力 `degraded` 状态不会阻挡重启。

## 驱动扩展

驱动扩展是只属于某一个内核组件的树外内核模块和固件，放在一个 dm-verity 镜像中，其根哈希带有 PKCS#7
签名，由内核用内置密钥环或已登记的 owner 证书校验（[安全概览](../security/overview.md)）。安装或删除扩展
是一次带三次启动的试运行变更，与 core 集合相同；扩展试运行期间不安装其他任何东西。若系统更新的内核
与运行中的不同，而运行中内核使用的某个扩展没有面向新内核的构建，更新会被拒绝：拒绝信息和
`check`/`fetch` 结果以 `waitsForExtension` 列出它们。随后 owner 上传面向新内核的构建，或者决定新内核
不带它运行，两者都会与部署配对。运行中内核的构建保留，以便回滚。owner 密钥环存在于 mini-x64、
qemu-armhf 和 uefi-x64 的内核中，cx3576 和 s905x5m 没有（见各板卡 `board.env` 中的 `KERNEL_FEATURES`
`owner-keyring`，例如 `mica-build:boards/uefi-x64/board.env`）。

存储报告一个 DATA 容量以及 state/meta/bulk/可丢弃部分的统计。垃圾回收在删除未引用的对象或中断的暂存
之前，先认证每个保留的描述符。目录重置共用原生事务锁，并保留部署记录和身份。

## core 集合

core 组件（每个包一个：带 API 的 `micad`，以及控制台）独立于任何产品单独发布。格式、命令和设备上的
状态见 `mica-core:docs/mica-core.md` 6.2 节。

- **每个通道和架构一个签名 core 集合**，对每个架构发布一次，被该通道上该架构的每台设备采用
  （`mica-build:src/release/core.ts`）。发布时不要求任何产品与之匹配：集合在与系统相遇的地方被检查，
  即设备的选择和产品构建对其种子的检查。
- **每台设备都有一个。** 出厂镜像携带一个种子集合及其组件，其部署指明该集合（`coreSet`）；没有集合的
  设备无法启动，因为没有别的东西会指明 core 组件。
- **声明。** 组件声明选用它的特性、它需要的其他组件，以及可选的它所运行的根接口级别（`root`）和最多
  16 个带版本范围的根软件包（`requires`）。根声明其 `interfaceLevel`，以及可选的它 `provides` 的软件包。
  当根不提供该软件包，或提供的版本在范围内时，`requires` 条目成立。
- **选择由设备完成。** 设备把其集合中至少带有其根 `product.conf` 中某个 `FEATURES` 的组件组合起来。当某个
  被选组件的 `root` 或 `requires` 不成立，或它需要的软件包未被选中或被选中的版本不在范围内时，选择被
  拒绝，并指明组件和约束。每个被选组件是一个 verity 镜像，在启动时叠加在根的 `/usr` 和 `/etc` 之上。
- **单独的集合**在获取前对照运行中的根检查；选不中的集合等待系统更新。部署或驱动扩展变更在试运行
  期间不安装集合，集合有它自己的三次启动：达到健康的成为当前集合，未达到的被丢弃。
- **配对。** `general` 上的系统更新采用在新根上能选中的最新 `general` 集合（不早于其镜像自带的集合），
  并与部署作为一个配对安装。配对一起试运行，只计部署的试运行次数；确认使两者都成为当前，试运行失败
  则启动之前的部署及其当时运行的集合。系统更新从不降级 core，也不把设备移出其通道：否则设备保留其
  集合，当该集合在新根上选不中时更新被拒绝。
- **保留的集合**：当前集合、试运行中的集合，以及绑定到其他保留部署的集合，最多三个。每个保留的部署
  启动它被确认时所用的集合；没有被任何东西指明的集合连同其对象一起释放。早期启动会跳过无法认证或
  组合的待定集合；必须组合却无法组合的集合会让启动停止。
- **通道是一项设置。** 设备跟随运维者的 `channels.core`，否则跟随镜像的，否则跟随 `general`。代数在
  同一通道和架构内单调递增。
- **两条线一个策略。** 检查先列出更新的 core 集合，再读产品线；当集合需要等待系统更新或读不到 core
  线时继续读产品线。获取、安装、维护窗口和重启闸门对集合和部署都相同；`update.lifecycle` 说明正在
  提供和已暂存的是两者中哪一个，`update.sets.core` 说明保留的集合以及试运行中集合剩余的启动次数。
- **集合归档**是以签名集合为封套、带集合对象的 `MICAUPD1`；描述符指明 `coreSet` 的系统更新归档会在
  部署的对象旁边携带该集合及其对象。`import` 接受任一种归档，并说明它接受的是哪种。

## 验收

QEMU 完整系统测试覆盖仅根、仅内核和组合更新，三次失败的健康试运行，保留的回退，获取，原生服务，
身份和完整关机。确定性的原生故障注入在两种启动后端上覆盖安装、确认和垃圾回收。固件签名和维护有
单独的[信任证据](../security/signing.md)。

各板卡的结果和未解决的闸门，包括 cx3576 的物理看门狗/断电测试，见[支持层级](../hardware/README.md#当前板卡)。
进程中断和虚拟机关机不能证明物理 eMMC 的断电持久性。
