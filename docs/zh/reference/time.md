# 设计：时间：NTP、时区与可信时钟底线

> systemd/micad 底座上始终运行的网络对时、存放在 DATA/state 上的最近已知良好时钟底线，以及只用于展示的
> 时区。与 micad、API 和只读根页面配套阅读。

## 1. 提供什么

- **`systemd-timesyncd`**，由 `mica-system` 安装并静态启用（`sysinit.target.wants`），始终运行。**任何地方
  都没有启用或暂停的开关**：设置树里没有，API 里没有，界面里也没有。
- **固定的底座策略**，在 `/etc/systemd/timesyncd.conf.d/50-mica.conf` 中：自适应轮询 32–2048 秒，30 秒连接
  重试，60 秒保存时钟间隔。这些是决定而不是设置；`verify` 的 `packed-timesyncd-policy` 检查要求镜像遵守它们。
- **只有两项设置**：`time.ntp.servers`（有界、经校验的服务器名称/地址列表；为空表示使用镜像的后备服务器池）
  和 `time.timezone`（经校验的 IANA 名称，只用于展示）。
- **一个 micad 调和器**（`reconciler/time.rs`），把两者渲染为运行时配置；以及**一个只读的状态观察器**
  （`time_status.rs`），在总线上以 `GetTimeStatus`、经 HTTPS 以 `GET /api/v1/time/status` 提供。
- **存放在 DATA 上的保存时钟**：timesyncd 拥有持久化整个 var 绑定之下的 `/var/lib/systemd/timesync`。
- **在 OpenRC 根上**，同样的两项设置改为驱动 Base 的 `mica-ntpd`（`/var/lib/mica/time/ntpd.conf` 中的
  `ntp_servers`，变化时重启），状态报告它是否在运行以及内核的已同步标志位（`mica-core:docs/mica-core.md`
  第 3.4 和 3.8 节）。下面的 timesyncd 策略属于 systemd 根。
- **时区列表**：`GET /api/v1/time/zones` 列出设备的 tzdata 提供的时区（先是 `UTC`，然后是 `zone1970.tab` 中
  已安装的时区，附 tzdata 版本），以及已保存的 `time.timezone` 是否已安装；控制台的选择器按城市、地区、IANA
  名称或当前偏移搜索它，写入设置的仍是时区名称。

## 2. 处处 UTC；时区只用于展示

机器、RTC、API 和日志的时间始终是 UTC。镜像不内置时区：`/etc/localtime` 不存在或是指向 UTC 的符号链接，
`verify` 的 `packed-localtime-utc` 检查拒绝其他任何情况。

因此 `time.timezone` **从不应用到 `/etc/localtime`**，这是经过衡量的决定，而不是偷工减料。`/etc/hostname`
的模式（经 `fswrite` 写入、存放在 DATA/state 上的文件绑定）在这里不适用：`/etc/localtime` 是一个*指向
zoneinfo 的符号链接*，所以绑定到它上面会落到 `/usr/share/zoneinfo/…/UTC` 本身，把运维者的本地时区交给每个
读 UTC 的程序，journald 的时间戳也不例外，而这正是 UTC 契约所禁止的破坏。

改为由 micad 负责持久化（设置树）和应用：

- 调和器把时区名称渲染到 **`/run/mica/timezone`**（一行），这是设备上任何需要"运维者时区"的程序读取的运行时
  产物，预期的未来使用者是明确按本地时间运行的计划任务；
- API 提供它（`GET /api/v1/settings/time.timezone`），界面用它格式化展示的时间；
- 在每个写入面上，校验都是**语法上的、确定性的**（`micad_settings::validate_timezone_name`，tzdata 的名称
  语法；单元测试不依赖主机的 tzdata）；时区文件是否真的存在于 `/usr/share/zoneinfo` 下在调和时检查，并在实时
  状态中发布为 `time.timezone.available`，只是警告，从不是失败。

## 3. 启动顺序：RTC → 保存的底线 → 网络对时 → TLS

可信时钟底线是 `max(RTC, 保存的时钟)`，在任何校验证书有效期的程序运行之前就位：

1. **RTC。**在板卡有 RTC 的地方，内核（以及 systemd 内置的纪元下限）从 RTC 设置初始时钟。cx3576 声明了
   AT8563/HYM8563 RTC；驱动和后备电源的验证依赖硬件，尚未在实机上做过。
2. **保存的底线。**timesyncd 在 `var.mount` 之后启动，并在 `/var/lib/systemd/timesync` 创建它拥有的状态目录。
   它每 60 秒（`SaveIntervalSec`，固定）触碰一次 `…/clock`，并在启动时**把落后于该文件 mtime 的时钟往前拨**。
   DATA/var 在重启和组件更新后保留，所以没有 RTC 或 RTC 电池耗尽的设备，启动时间也不会早于它最后一次已知
   在运行的那一分钟。
3. **网络对时。**timesyncd（在 `sysinit.target` 中）按固定的自适应策略轮询受管或后备服务器，并校准时钟。
4. **TLS 使用者。**所有校验证书有效期的程序都在 `sysinit.target` 之后启动，也就是在底线就位之后；网络对时
   之后只会把时钟从一个本已合理的底线往前或稍微调整。更新的真实性不依赖时钟：更新文档不带过期时间
   （[更新](updates.md)）。

挂载上的 `Before=systemd-timesyncd.service` 顺序是关键的：timesyncd 只在启动时读一次时钟文件，晚到的绑定
会悄悄遮住保存的时钟。

## 4. 调和

`time.ntp.servers` 渲染到 DATA 上的 `/var/lib/mica/time/timesyncd.conf`（`[Time]` 下的 `NTP=`），镜像把它
链接为 `/etc/systemd/timesyncd.conf.d/60-mica-servers.conf`（用 `60-` 是为了排在固定的 `50-mica.conf` 之后，
不遮住任何东西）。放在 DATA 上，是为了让 timesyncd 在启动后第一次轮询时就使用运维者的服务器，早于 micad，
或在没有 micad 时也一样；在 micad 第一次写入之前，这个链接悬空，timesyncd 会跳过它。在 OpenRC 上，同一个
列表是 `/var/lib/mica/time/ntpd.conf` 中的 `ntp_servers`，`mica-ntpd` 每次启动时读取。
空列表渲染为**没有 `NTP=` 行**：空的 `NTP=` 会清掉编译进去的后备服务器池，让设备无服务器可轮询。

服务器列表的语法（`micad_settings::validate_ntp_servers`：主机名/IP 字符集，253 字节上限，最多 8 个，不得
重复）只在 micad-settings 中定义一次，并通过 `Settings::set` 本身强制执行，所以任何写入面都不能存下渲染器
无法承载的内容。

渲染结果变化时重启 timesyncd（没有 `ExecReload`；重启的代价是一个轮询周期）。时区变化不重启任何东西，
timesyncd 不读它。调和器从不启用或停用这个 unit；启用由镜像负责。

## 5. 同步状态

`GET /api/v1/time/status`（只读，需认证）提供 micad 基于实时证据的分类，证据来自
`org.freedesktop.timesync1`（ServerName、ServerAddress、NTPMessage）和 `org.freedesktop.timedate1`
（NTPSynchronized）：

| 状态 | 含义 |
| --- | --- |
| `synchronized` | timedate1 报告时钟误差有界（见下文） |
| `polling` | 已选定服务器并在交换报文，但没有报告上述误差界 |
| `offline-degraded` | 没有可用的服务器；底线保持，按固定的 30 秒策略继续重试 |
| `invalid-source` | 服务器有应答，但其应答不可用（闰秒标志 3、层级 0 或 ≥ 16） |
| `unknown` | 状态所依赖的某个信号无法读取（见下文） |

**`synchronized` 究竟断言什么。**它就是 timedate1 的 `NTPSynchronized`，别无其他，而这个属性*不是*"收到了
NTP 应答"：timedated 把它计算为 `adjtimex().maxerror < 16 s`，即内核自己对时钟可能偏差多少的上界。响应把这个
标志位作为 `synchronized` 放在状态旁边，读者无需推断用的是哪个信号。

**为什么另一个状态叫 `polling` 而不是 `synchronizing`。**上面两个断言确实不同，设备可以持有可用的样本，却在
原因持续期间一直不满足第二个：timesyncd 只有通过它为*接受的*样本所做的 `clock_adjtime` 调用才会把
`maxerror` 写回较低值，所以被当作尖峰拒绝的应答会让误差界按内核的容差持续增长，而应答仍在不断到达。
`synchronizing` 读起来像"进行中、快好了"，会发布一个设备无法做出的预测。`polling` 说的是观察到的事实：已选定
服务器并有应答，不承诺它会走向哪里。运维者看到 `polling` 加上健康的 `sample`，得到的是真相：时钟*不*确知在
内核的误差界之内，而两方面的证据都在同一个响应里。

**`unknown` 涵盖什么。**它是信号无法*读取*时的状态，而不是某个守护进程停止时的状态。两个服务为分类提供输入，
任一次读取都可能缺失：`timesync1` 可能根本不在总线上，或者 `timedate1` 可能不应答 `NTPSynchronized`。其他
四个状态中有三个依赖第二个标志位：`synchronized` 断言它，`polling` 和 `offline-degraded` 只有在排除它之后才会
得出，所以没有应答的读取不能得出其中任何一个。无人能查询的设备不等于查询后发现未同步的设备，把前者报告为后者
会让运维者去追查一个可能完全正常的时钟。`invalid-source` 是例外，在标志位未读到时仍然成立：它只依赖样本，
本就优先于标志位，并且只说明来源的应答不可用，而这是*读到了*的。

不推断任何东西来填补空缺：不把样本、层级或较早的读数提升为一个状态。读到的证据仍会报告（`server` 和
`sample` 按观察到的样子出现），`synchronized` 成员保持**缺省**，而 `unknown` 旁边这个缺省正是区分"没读到"
和"读到且为假"的依据。`detail` 指出缺失的是哪次读取，因为两者属于不同的服务，只有其中一个值得去查。

状态路径中没有任何东西能停止重试：它只观察，从不行动。分类（`time_status::classify`）是纯函数，带有确定性的
离线/在线测试。

**跳变与漂移**：在最近一次 NTP 样本可用时，响应带有 `sample.offsetSeconds` 和 `sample.correction`：超过
timesyncd 自己的 0.4 秒跳变边界为 `"step"`，在其内为 `"slew"`，让状态读者和审计记录能区分时钟校正与普通漂移。
缺失的证据保持缺失；不会编造成员。

## 6. 不在范围内

PTP、NTS、用户可配置的轮询周期以及任何 NTP 暂停开关。各板卡 RTC 后备电源的验证属于硬件验收工作，记录在
各板卡的页面中。
