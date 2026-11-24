# `mica` 命令

> 2026-11-14 及更早发布的设备没有 `mica` 命令：先更新它（[更新](../operate/updates.md)），或使用该发布的
> `micad` 命令（`micad web`、`micad unit`、`micad factory-reset` 等）。

`mica` 是运维者在设备上唯一的命令。本页列出每个动词、选项、输出、退出码和 `--json` 形式，依据 `mica-core`
发布 `20261124-0755`（core 0.0.9，`mica-core:crates/micad/src/cli.rs` 及其调用的模块）。

## 1. 在哪里运行，谁能运行

`/usr/bin/mica` 是指向 `micad` 可执行文件的链接，位于 micad 的 core 组件中，在每个带 `micad` 特性的产品上都
有，systemd 和 OpenRC 都一样。在设备上以 **root** 运行：串口控制台上，或开启 SSH 之后经 SSH。它的两个通道都只
属于 root：

- **系统总线**：micad 的总线策略（`com.mica.micad.conf`）只允许 root 向 `com.mica.micad` 发送或从它接收；
- **apid 的本地套接字** `/run/mica/apid.sock`：权限 `0600`，apid 从内核取得调用方的 uid，拒绝 root 以外的任何
  调用方。

`micad` 本身只接受 `micad daemon`、`micad apid` 和 `micad --version`，即其 unit 启动它的方式。其他任何词都以
退出码 2 退出，并提示 `micad: use mica <word> (mica help)`。

`mica --version` 打印 `mica <软件包版本>`，例如 `mica 0.0.9-1`。

## 2. 两个通道

动词去往其规则所在的地方，所以 `mica` 不新增任何规则，也不复制任何规则：

```text
                       设备上的 root
                              |
                            mica
              +---------------+----------------+
              |                                |
     系统总线（D-Bus）                /run/mica/apid.sock（HTTP）
     com.mica.micad1                  apid 的 /api，凭据 = uid 0
              |                                |
            micad  <------- 总线 ------------- apid
   status、update、container、       setup、password、root-password、
   unit、web、mdns、ssdp、           ssh、tokens、get、set、hostname、
   factory-reset、reboot、           time、network、wifi
   poweroff、doctor
```

- **总线动词**直接询问 micad。不论 `access.web.mode` 是什么都能用，包括 `off`，`mica web local` 或
  `mica web network` 正是靠这一点把 apid 重新打开。
- **套接字动词**就是 API 调用：apid 校验它们、写审计行（来源 `local`），并像对浏览器一样把错误密码计入登录
  退避。apid 不应答时以退出码 3 退出；原因是 `access.web.mode` 为 `off` 时，消息会如此说明：
  `apid is off (access.web.mode off); mica web local serves the local socket only`。
- `mica doctor` 经总线读取 micad，并自己写快照存储；`mica mdns add|remove` 写 `/run/mica/mdns.d` 下的文件；
  `mica internal` 读本地文件。

## 3. 约定

### 帮助

`mica`、`mica help` 和 `mica --help` 打印动词列表（单独的 `mica` 还会以 2 退出）。`mica help <动词>`、
`mica <动词> help` 和 `mica <动词> --help` 打印该动词的用法并以 0 退出。有子动词的动词（`ssh`、`tokens`、
`container`、`unit`、`web`、`mdns`、`ssdp`）在没有给出子动词时打印用法。`mica help` 不列出 `internal`
（第 6 节）。

### `--json`

`--json` 可以出现在命令行的任何位置。它只适用于读取的命令；用在写入的命令上时，`mica` 以 2 退出并提示
`--json applies to commands that read`。使用 `--json` 时：

- 成功时，stdout 输出 API 或 micad 给出的 JSON 原样，不再包装；
- 失败时，stdout 为空，stderr 输出一行 `{"error":{"code":"<code>","message":"<message>"}}`。

`code` 是 API 的错误代码（`validation_failed`、`login_throttled` 等，见[错误](errors.md)）、D-Bus 错误名的
最后一段，或 `mica` 自己的代码之一：`unreachable`、`failed`、`apply_failed`、`not_found`、
`already_configured`、`not_confirmed`、`refused`。

### 退出码

| 退出码 | 含义 |
|---|---|
| 0 | 完成 |
| 1 | 被拒绝或失败：校验、冲突、任务失败、其他任何错误 |
| 2 | 用法错误：未知动词、缺少或多余的参数、在写入命令上用 `--json` |
| 3 | 无法到达：没有系统总线，micad 不在总线上（`ServiceUnknown`、`NameHasNoOwner`、`NoReply`、`Timeout`、`TimedOut`、`Disconnected`、`NoServer`），apid 的套接字不应答或 apid 已关闭，或 API 应答 503/504 |
| 4 | 凭据：错误的密码或设备码（`password_incorrect`、`invalid_credentials`、`device_code_incorrect`、`wrong_password`、`password_required`），或其后的退避（`login_throttled`、任何 429） |

不带 `--json` 时，错误在 stderr 上打印为 `mica <动词>: <消息>`；被拒绝的设置会指出其路径
（`hostname: <消息>`）。

### 等待写入完成

micad 应用的写入会返回一个任务。`mica` 等待它，并按任务的结果退出：成功为 0，失败为 1 并提示
`stored, but applying it failed: <原因>`。套接字动词每秒读取一次 `GET /api/v1/tasks/{id}`，最多 120 秒；总线
动词每 0.5 秒询问一次 micad 的 `GetTask`，最多 300 秒。到时仍在运行的任务以 1 退出并提示
`stored; micad is still applying it (task <id>)`：设置已保存，micad 会继续应用它。

### 秘密

密码和 Wi-Fi 密钥从不从命令行参数获取。它们来自以下之一：

- **终端**，关闭回显；新的秘密要输入两次，不一致时以 `the two entries differ` 拒绝；
- **`--password-file FILE`**，其第一行（不含行尾 `\n` 或 `\r\n`）就是秘密；`-` 读标准输入。文件最多 4096
  字节，必须是 UTF-8；第一行为空时拒绝（`no ... given`）。

不带 `--password-file` 时，标准输入必须是终端：`standard input is not a terminal; give the ... in a file`。

### root 不需要设备所守护的凭据

设备上的 root 本来就持有网络侧检查要证明的一切，所以本地套接字和总线不要求这些：

| 动词 | 在网络上 | 由 root 运行 `mica` |
|---|---|---|
| `mica setup` | 在 `CLAIM_DEVICE_CODE=required` 的产品上需要设备码 | 在任何产品上都不需要设备码 |
| `mica password set` | 需要当前密码，计入退避 | 不需要当前密码 |
| `mica factory-reset` | 需要管理员密码，计入退避 | 不需要密码；一次确认（输入主机名或 `factory-reset`，或 `--yes`） |

每项都连同其来源记入审计（套接字上为 `local uid 0`，总线上为 `uid 0`）。

## 4. 动词列表

| 动词 | 作用 | 通道 | `--json` |
|---|---|---|---|
| [`status`](#status) | 设备一览：系统、更新、网络、时间、存储 | 总线 | 是 |
| [`setup`](#setup) | 首次设置：管理员密码 | 套接字 | 否 |
| [`password`](#password) | 更改管理员密码 | 套接字 | 否 |
| [`root-password`](#root-password) | 设置临时 root 密码，有效到下次启动 | 套接字 | 否 |
| [`ssh`](#ssh) | SSH 开关及其授权密钥 | 套接字 | `status`、`keys list` |
| [`tokens`](#tokens) | API 令牌：列出、创建、撤销 | 套接字 | `list`、`create` |
| [`get`](#get) | 读取一项设置 | 套接字 | 是 |
| [`set`](#set) | 写入一项设置 | 套接字 | 否 |
| [`hostname`](#hostname) | 显示或设置主机名 | 套接字 | 显示时 |
| [`time`](#time) | 时间同步、时区和 NTP 服务器 | 套接字 | 读取时 |
| [`network`](#network) | 接口及其地址 | 套接字 | 是 |
| [`wifi`](#wifi) | Wi-Fi 客户端及其已知网络 | 套接字 | 状态、`scan` |
| [`update`](#update) | 查找、安装或回滚发布 | 总线 | `status` |
| [`container`](#container) | Compose 项目及其容器 | 总线 | `list`、`status` |
| [`unit`](#unit) | 设备自己的服务 | 总线 | `list` |
| [`web`](#web) | 谁能访问 API，它在哪里监听 | 总线 | `status` |
| [`mdns`](#mdns) | 设备经 mDNS 宣告什么 | 总线、文件 | `status`、`list` |
| [`ssdp`](#ssdp) | 设备是否应答 UPnP 发现 | 总线 | `status` |
| [`reboot`](#reboot-and-poweroff) | 重启设备 | 总线 | 否 |
| [`poweroff`](#reboot-and-poweroff) | 关闭设备 | 总线 | 否 |
| [`factory-reset`](#factory-reset) | 清除所有配置过的东西 | 总线 | 否 |
| [`doctor`](#doctor) | 采集诊断快照 | 总线、文件 | 否 |
| `help` | 列表，或某个命令的用法 | — | 否 |

## 5. 各动词

### status

```text
mica status [--json]
```

读取 micad 的 `GetSystemInfo`、`GetUpdateState`、`GetNetworkState`、`GetTimeStatus` 和 `GetStorageStatus`，
每个事实打印一行。读取失败的成员打印 `unavailable: <原因>`，其他成员照常打印；只有 `GetSystemInfo` 失败才会让
命令失败。

```text
$ mica status
board      <板卡型号>
system     <版本> (<部署 id 的前 12 个字符>)
core       0.0.9 (channel general)
state      <生命周期状态>
checked    <最近一次检查的时间>
uptime     2h 14m
network    enp0s2 routable 192.168.1.40/24 fe80::5054:ff:fe12:3456/64
time       synchronized
data       1.2 GiB of 3.4 GiB used
```

尖括号中的值来自设备；其余展示格式。

`system` 行是运行中部署的版本及其 id 的前 12 个字符；更新状态中有相应内容时会出现 `available`、`reboot`、
`checked` 和 `refused` 行（见 [update](#update)）。`uptime` 为 `<天>d <时>h <分>m`，不足一天时为 `<时>h <分>m`。
不列出 `lo`。

`--json` 打印一个对象，五个回答作为成员：`system`、`update`、`network`、`time`、`storage`；失败的成员为
`{"error":{"code":...,"message":...}}`。

### setup

```text
mica setup [--hostname NAME] [--password-file FILE]
```

在未认领的设备上做首次设置：设置管理员密码，给出 `--hostname` 时还设置主机名（`POST /api/v1/setup`）。不要求
设备码。除非 `--password-file` 指定文件，否则在终端上输入两次密码。

```text
$ mica setup --hostname boat-01
Administrator password:
Administrator password again:
the device is set up
```

在已有管理员的设备上，以 1 退出，代码 `already_configured`：`the device already has an administrator
password; mica password set replaces it`。apid 的密码规则照常适用（拒绝时退出码 1，`validation_failed`）。

### password

```text
mica password set [--password-file FILE]
```

不需要当前密码就设置新的管理员密码（`POST /api/v1/actions/change-password`，只带 `newPassword`，apid 在本地
套接字上接受来自 root 的这种请求）。打印 `the administrator password is set`。审计行为 `password changed`，
来源 `local uid 0`。单独的 `mica password` 以 2 退出（`name the command: set`）。

### root-password

```text
mica root-password [--password-file FILE]
```

设置临时 root 密码，有效到下次启动（`POST /api/v1/actions/transient-root-password`），并等待 micad 应用它。
打印 `the transient root password is set until the next boot`。用它在本次启动期间登录串口控制台；重启后它不留
任何痕迹（见[访问](access.md)）。

### ssh

```text
mica ssh status [--json]
mica ssh on|off
mica ssh keys list [--json]
mica ssh keys add <file|->
mica ssh keys remove <fingerprint>
```

| 子动词 | 作用 | 输出 |
|---|---|---|
| `status` | 读取 `access.ssh.enabled` | `enabled: true`；`--json` 为 `{"enabled":true}` |
| `on`、`off` | 写入 `access.ssh.enabled` 并等待任务 | `access.ssh.enabled is true` |
| `keys list` | `GET /api/v1/ssh/authorized-keys` | 每个密钥一行：`<指纹> <类型> <注释>`（apid 无法计算指纹的密钥显示 `(undecodable)`），或 `no authorized keys`；`--json` 为 API 的文档 |
| `keys add` | 添加文件中的那一行密钥（`-` 为标准输入）；跳过空行和 `#` 注释，没有密钥或多于一个密钥的文件被拒绝 | `added SHA256:...` |
| `keys remove` | 删除该指纹的密钥 | `removed SHA256:...` |

```text
$ mica ssh keys add /tmp/ops.pub
added SHA256:Qm9vdGluZyBpcyBhIGZpbmUgdGhpbmc
$ mica ssh on
access.ssh.enabled is true
$ mica ssh keys list
SHA256:Qm9vdGluZyBpcyBhIGZpbmUgdGhpbmc ssh-ed25519 ops@laptop
```

### tokens

```text
mica tokens list [--json]
mica tokens create <name> [--json]
mica tokens revoke <id>
```

| 子动词 | 作用 | 输出 |
|---|---|---|
| `list` | `GET /api/v1/tokens` | 每个令牌一行 `<id> <name> <created>`，`created` 为设备时钟下自 Unix 纪元起的秒数；或 `no tokens` |
| `create` | 生成名为 `<name>` 的令牌 | stdout 上只有令牌本身（`mica_<id>_<secret>`），stderr 上为 `token <id> (<name>): shown once, keep it now`；`--json` 为带 `id` 和 `token` 的 API 应答 |
| `revoke` | 撤销 `<id>` | `revoked <id>` |

只保存令牌的 SHA-256 摘要：秘密只由 `create` 显示一次。在 API 上以 `Authorization: Bearer mica_<id>_<secret>`
使用令牌（[API](api.md)）。

### get

```text
mica get <path> [--json]
```

按点路径读取一项设置，与 `GET /api/v1/settings/<path>` 读取的相同：秘密已脱敏。字符串原样打印；其他值打印为
缩进的 JSON；`--json` 打印紧凑的 JSON。路径见[设置](settings.md)。

```text
$ mica get hostname
boat-01
$ mica get access.ssh
{
  "enabled": true,
  ...
}
```

### set

```text
mica set <path> <value>
```

用 `PUT /api/v1/settings/<path>` 写入一项设置并等待任务。打印 `<path> is <值的 JSON>`。值**按设置的类型**
解释，而不是看它长什么样：

| 设置 | 类型 | `<value>` |
|---|---|---|
| `hostname`、`wifi.ap.mode`、`time.timezone` | 字符串 | 原样接收：`mica set hostname 1234` 写入字符串 `"1234"` |
| `access.ssh.enabled`、`access.mdns.enabled`、`access.ssdp.enabled`、`access.cloudAdmins.enabled`、`container.enabled`、`mqtt.enabled`、`wifi.client.enabled` | 开关 | 只能是 `true` 或 `false` |
| `logging.persistent` | 开关或 `null` | `true`、`false` 或 `null` |
| `logging.maxSizeKiB` | 数字或 `null` | JSON 数字或 `null` |
| `time.ntp.servers` | 列表 | JSON 数组，例如 `'["ntp1.example.net","ntp2.example.net"]'` |
| `logging.remote` | 对象或 `null` | JSON 对象或 `null` |

不在此表中的路径取其当前值的类型（字符串、开关、数字，列表或对象为 JSON）；没有值的路径被拒绝：
`<path> is not a setting mica set writes`。类型不对的值在发送之前就被拒绝（退出码 1，`validation_failed`），
apid 会拒绝它不写的路径并指出该路径。通用的 `PUT` 只接受上表的 14 个路径（[设置](settings.md)）。

```text
$ mica set time.timezone Europe/Athens
time.timezone is "Europe/Athens"
$ mica set access.mdns.enabled yes
mica set: access.mdns.enabled takes true or false, not "yes"
```

### hostname

```text
mica hostname [--json]
mica hostname <name>
```

显示主机名，或设置它并等待任务（`hostname is <name>`）。名称规则由 API 决定。

### time

```text
mica time [--json]
mica time zone [--json]
mica time zone <zone>
mica time zones [--json]
mica time servers [--json]
mica time servers <server>...
```

| 形式 | 作用 | 输出 |
|---|---|---|
| `time` | `GET /api/v1/time/status` | `status: <状态>`，存在时还有 `synchronized: <bool>`、`server: <名称或地址>`、`offset: <秒> s`（[时间](time.md#5-同步状态)） |
| `time zone` | 读取 `time.timezone` | 时区名称 |
| `time zone <zone>` | 写入 `time.timezone` | `time.timezone is <zone>` |
| `time zones` | `GET /api/v1/time/zones` | 每行一个时区 id（`UTC` 在前）；`--json` 还带 tzdata 版本以及已保存的时区是否已安装 |
| `time servers` | 读取 `time.ntp.servers` | 每行一个服务器；列表为空（使用镜像的后备服务器池）时什么都不打印 |
| `time servers <server>...` | 写入 `time.ntp.servers` | `time.ntp.servers is <servers>` |

```text
$ mica time
status: synchronized
synchronized: true
server: 0.debian.pool.ntp.org
offset: -0.000412 s
$ mica time servers ntp1.example.net ntp2.example.net
time.ntp.servers is ntp1.example.net ntp2.example.net
```

最多 8 个服务器，每个是主机名或地址；空列表用 `mica set time.ntp.servers '[]'` 写入。

### network

```text
mica network [--json]
mica network show <interface> [--json]
```

`mica network` 读取观测到的状态（`GET /api/v1/network/status`），把除 `lo` 外的每个接口列成一张表：
名称、运行状态、按最近一次可达性检查判断是否能上互联网，以及地址。`*` 标出承载流量的上行。`show`
打印一个接口，有检查时连同检查和最近一轮的结果：

```text
$ mica network
NAME     STATE     INTERNET  ADDRESSES
eth0*    routable  up        192.168.1.40/24 fe80::5054:ff:fe12:3456/64
wlan0    routable  up        10.0.0.23/24
$ mica network show eth0
name: eth0
state: routable
hardware address: 52:54:00:12:34:56
address: 192.168.1.40/24
address: fe80::5054:ff:fe12:3456/64
gateway: 192.168.1.1
dns: 192.168.1.1
internet: up (carries the traffic)
metric: 20
check: on, every 10 s, 2000 ms timeout, down after 3, up after 5: 1.1.1.1 tcp/53, 8.8.8.8 tcp/53
since: 2026-11-24T10:02:11Z (0 failed, 41 good in a row)
last round: 2026-11-24T10:09:01Z ok
  1.1.1.1 tcp/53 ok 12 ms
  8.8.8.8 tcp/53 ok 15 ms
```

INTERNET 取值为 `up`、`down`、`checking`（尚无结论）、`no route`、`blocked`（严格反向路径过滤丢弃了
应答），没有检查的接口为 `-`。已关联的无线接口显示 `wifi: <ssid>`。未知名称以 1 退出并提示
`no interface named <name>`（代码 `not_found`）。`--json` 打印整个文档，`show` 时打印该接口的对象
（[诊断](diagnostics.md#3-观测到的网络状态)）。修改网络由控制台或 `mica set` 负责，不由本动词负责
（[网络](../operate/network.md)）。core 0.0.8 上 `mica network` 打印的是空列表，0.0.9 已修复。

### wifi

```text
mica wifi [--json]
mica wifi scan [--json]
mica wifi on|off
mica wifi add <ssid> [--password-file FILE] [--open] [--hidden]
mica wifi remove <ssid>
```

| 形式 | 作用 | 输出 |
|---|---|---|
| `wifi` | `GET /api/v1/wifi/client` 和 `/wifi/client/networks` | `enabled: <bool>`、`interface: <名称>`，已关联时 `connected: <ssid>`，然后每个网络一行 `known: <ssid> (priority <n>[, open][, hidden])`；`--json` 为 `{"client":...,"networks":...}` |
| `wifi scan` | `POST /api/v1/wifi/client/scan` | 每个网络一行 `<ssid 或 (hidden)> <信号> dBm <信道> <安全方式>`，最强的在前；或 `no scan: <原因>` |
| `wifi on`、`off` | 写入 `wifi.client.enabled` | `wifi.client.enabled is true` |
| `wifi add` | 记住一个网络；除非 `--password-file` 指定文件，或 `--open` 表示没有密钥，否则密钥输入两次（`--open` 与文件同用为退出码 2） | `remembered <ssid>` |
| `wifi remove` | 忘记一个网络 | `forgot <ssid>` |

```text
$ mica wifi add Marina-Guest
Network key:
Network key again:
remembered Marina-Guest
$ mica wifi on
wifi.client.enabled is true
```

在同一个无线电上，客户端和接入点不能同时运行；见
[Wi-Fi](wifi.md#5-单无线电冲突照实报告不做仲裁)。

### update

```text
mica update [status] [--json]
mica update check
mica update install [--reboot]
mica update rollback [--reboot]
```

| 形式 | 作用 |
|---|---|
| `update`、`update status` | 打印运行中的系统和更新状态；`--json` 打印 micad 的更新状态文档 |
| `update check` | 让 micad 检查更新来源，跟随状态，打印 `available: <system 或 core> <版本>` 或 `up to date` |
| `update install` | 让 micad 检查、下载并安装最新的发布，每个步骤打印一次（`checking...`、`downloading...`、`installing...`），然后打印 `installed; reboot to run it (or run again with --reboot)`、`installed`（无需重启）或 `up to date` |
| `update rollback` | 在 micad 允许时回到保留的上一个系统：`rolled back to <id>; reboot to run it ...`；否则以 1 退出，`rollback is not possible: <原因>` |

`--reboot` 在变更需要时经 micad 重启，打印 `<内容>; rebooting`。`check` 或 `install` 过程中的拒绝或失败以 1
退出并给出 micad 的原因；状态停止变化 10 秒后，`install` 以 1 退出并提示
`stopped at <状态>; see mica update status`。

```text
$ mica update
system     <版本> (<部署 id 简写>)
core       0.0.9 (channel general)
state      <生命周期状态>
available  system <版本>
checked    <最近一次检查的时间>
```

各行依次为：`system`（版本和简写 id）、`core`（core 集合及其通道）、`state`（及 `: <原因>`）、`available`、
`reboot`（`needed to run what is installed`）、`checked`、`refused`。状态和拒绝见[更新](updates.md)；离线归档
路径仍由控制台和 API 负责（[运维：更新](../operate/updates.md)）。

### container

```text
mica container up [--project <project>] [--file <file|->] [--project-dir <dir>]
mica container down [--project <project>]
mica container list [--json]
mica container check [--project <project>] [--file <file|->] [--project-dir <dir>]
mica container start|stop|restart <project>[/<service>]
mica container logs <project>/<service> [--tail N]
mica container status [--json]
mica container on|off
```

| 子动词 | 作用 |
|---|---|
| `up` | 检查 Compose 文件，将其连同目录保存为项目，打开容器并等待：`<project> declared, in <dir>` |
| `down` | 从 `container.projects` 中删除项目：`<project> removed; its files and volumes stay` |
| `list` | 每个项目的容器：表格 `PROJECT SERVICE CONTAINER PHASE HEALTH`（已声明但没有运行的项目显示 `not running`）；容器关闭或引擎不应答时，表格上方有一行说明 |
| `check` | 检查 Compose 文件但不保存；以 JSON 打印它会创建的容器 |
| `start`、`stop`、`restart` | 项目的所有容器，或某个服务的容器 |
| `logs` | 某个服务日志的最后若干行，默认 100，`--tail` 为 1 到 1000 |
| `status` | `enabled: <bool>`（`container.enabled`） |
| `on`、`off` | 写入 `container.enabled`；项目保持声明 |

文件、目录和名称的查找方式与 `docker compose` 相同：除非 `--file` 指定（`-` 为标准输入），文件是工作目录中
`compose.yaml`、`compose.yml`、`docker-compose.yaml`、`docker-compose.yml` 里第一个存在的；除非
`--project-dir` 指定，项目目录（相对的主机路径在这里解析）是文件所在目录（标准输入时为工作目录）；项目名是
`--project`，否则是文件的 `name:` 键，否则是项目目录名转为小写后只保留 `a-z`、`0-9`、`_` 和 `-`。项目名为 1 到
40 个这些字符，以字母或数字开头；文件最多 64 KiB 的 UTF-8。

被拒绝的文件以 1 退出，并在 stderr 上列出每个问题：

```text
mica container: project web is refused
  app.privileged: <原因>
```

在 Docker 产品上（`uefi-x64.docker`、`uefi-x64.gcp`、`cx3576.full`），`up`、`down` 和 `check` 以 1 退出并提示
`this is a docker product: containers are made with docker and docker compose, not declared to micad; use
docker compose`；`list`、`status`、`on`、`off`、`start`、`stop`、`restart` 和 `logs` 仍然可用。见
[容器](../integrate/containers.md)。

### unit

```text
mica unit install <file|-> [--name <name>] [--conf <file>] [--enable]
mica unit enable|disable <name>
mica unit remove <name>
mica unit start|stop|restart <name>
mica unit list [--json]
mica unit logs <name> [--tail N]
mica unit fstab check [<file>]
```

设备自己的服务，声明在 `services.units` 中，由 Base 的 `mica-unit`（`/usr/lib/mica/mica-unit`）维护。systemd 下
是 unit 文件；OpenRC 下是 `openrc-run` 脚本。systemd 下没有 unit 类型的名称视为 `.service`。

| 子动词 | 作用 | 输出 |
|---|---|---|
| `install` | 把文件（最多 64 KiB）保存为本设备的一个服务；名称取文件名，除非 `--name` 指定（`-` 读标准输入，此时必须有 `--name`）；`--conf` 为 OpenRC 脚本提供 `conf.d` 设置（最多 16 KiB）；`--enable` 启用它，已启用的服务保持启用 | `<name> installed[, enabled]` |
| `enable` | 立即启动，并在每次启动时启动 | `<name> enabled` |
| `disable` | 立即停止，启动时不再启动 | `<name> disabled` |
| `remove` | 停止并删除 | `<name> removed` |
| `start`、`stop`、`restart` | 立即操作该服务；可以是这里声明的，也可以是用 `mica-unit` 放置的 | — |
| `list` | 每个服务，不论是这里声明的还是手工放置的 | 表格 `NAME ENABLED ACTIVE MANAGED`，`MANAGED` 为 `micad`、`by hand` 或 `refused: <原因>` |
| `logs` | 最新的若干行，默认 200，`--tail` 为 1 到 200 | 日志行 |
| `fstab check` | 仅 OpenRC：按 Base 在启动时应用的方式检查用户的挂载，`/usr/local/etc/fstab` 或 `<file>` | 接受为 0，拒绝为 1（逐条指出），用法错误为 2 |

`enable`、`disable` 和 `remove` 拒绝不是在这里声明的服务：`no service named <name> is declared here`。在
systemd 下 `fstab check` 以 2 退出：用户的挂载是 `.mount`、`.automount` 和 `.swap` unit，用 `mica unit install`
安装（[存储](storage.md#用户挂载)）。

```text
$ mica unit install /root/logger.service --enable
logger.service installed, enabled
$ mica unit list
NAME            ENABLED  ACTIVE  MANAGED
logger.service  yes      active  micad
```

### web

```text
mica web status [--json]
mica web network|local|off
```

| 形式 | 作用 | 输出 |
|---|---|---|
| `status` | 读取 `access.web` | `mode: <模式>`，`network` 模式下还有 `http: <端口>`，开启 HTTPS 时还有 `https: <端口>`；`--json` 打印 `access.web` |
| `network` | 控制台和 API 在网络上，外加本地套接字 | `access.web.mode is network` |
| `local` | 只在 apid 的本地套接字上提供 API，供本设备上的 root 使用 | `access.web.mode is local` |
| `off` | 没有 API：apid 停止 | `access.web.mode is off` |

```text
$ mica web status
mode: network
http: 8080
https: 8443
```

在 `off` 模式下，所有套接字动词都以 3 退出，直到 `mica web local` 或 `mica web network` 让 apid 回来
（[访问](access.md)）。

### mdns

```text
mica mdns status|list [--json]
mica mdns on|off
mica mdns add NAME --type _x._tcp --port N [--instance S] [--txt KEY=VALUE]...
mica mdns remove NAME
```

| 形式 | 作用 | 输出 |
|---|---|---|
| `status` | micad 的 `mdns` 状态 | `enabled: <bool> (<来源>)`、`hostname: <名称>`、`published: <n> of <m>`，有错误时还有 `error: ...` |
| `list` | 每个服务 | 每个服务一行 `<instance>.<type> port <n> <来源> published`（或 `not-published`），然后每个被拒绝的投放文件一行 `refused <来源>: <错误>` |
| `on`、`off` | 写入 `access.mdns.enabled`；`off` 保留投放文件 | `access.mdns.enabled is true` |
| `add` | 发布一个服务直到重启，写入 `/run/mica/mdns.d/NAME.json`（`{"version":1,"services":[...]}`，权限 0644） | `/run/mica/mdns.d/NAME.json is published until reboot` |
| `remove` | 删除该文件 | `/run/mica/mdns.d/NAME.json is removed`；文件不存在时退出码为 1 |

`NAME` 为 1 到 32 个 `a-z`、`0-9` 和 `-`，以字母或数字开头；`--type` 和 `--port` 必填，`--txt` 可重复。

```text
$ mica mdns add nmea --type _nmea-0183._tcp --port 10110 --txt board=cx3576
/run/mica/mdns.d/nmea.json is published until reboot
```

### ssdp

```text
mica ssdp status [--json]
mica ssdp on|off
```

`status` 打印 `enabled: <bool> (<来源>)`、`active: <bool>`，存在时还有 `reason`、`error`、`udn`、
`friendly name` 和 `model` 行。`on` 和 `off` 写入 `access.ssdp.enabled`；`off` 表示没有应答器、没有套接字。

### reboot and poweroff

```text
mica reboot
mica poweroff
```

micad 让 init 重启或关闭设备，与控制台的按钮相同，`mica` 打印 `rebooting` 或 `powering off`。它们走总线，所以
apid 关闭时也能用。

### factory-reset

```text
mica factory-reset [--yes]
```

打印会清除和保留的内容，然后要求一次确认：输入主机名或 `factory-reset`。`--yes` 不询问直接确认，供脚本使用；
不带 `--yes` 时标准输入必须是终端（否则退出码 2）。不要求密码：micad 为 root 暂存重置（总线 `FactoryReset`，
来源 `uid 0`）。

```text
$ mica factory-reset
  Erases everything configured on this device: the administrator and the
  claim, settings, networks, keys, containers and all data on DATA.
  Keeps the software at its current version. The device reboots and erases
  before anything else runs; it then starts as it did on its first boot.
  It is not a certified wipe.

Type the hostname (boat-01) or factory-reset to confirm: factory-reset
The factory reset is staged. The device reboots in a few seconds, erases everything configured and starts as on its first boot.
```

输入其他任何内容以 1 退出：`not confirmed; nothing was reset`。micad 的拒绝仍然适用，以 1 退出并带其代码：
`data_encrypted`（DATA 已加密，启动程序不重置加密的 DATA）、`factory_reset_unsupported`（启动的 runkit
不执行重置）、`update_in_progress`、`trial_pending`、
`not_claimed`。清除和保留的内容见[恢复](recovery.md#23-出厂重置)。

### doctor

```text
mica doctor
```

采集一份与 API 相同方式脱敏的诊断快照到 `/mica/diagnostics`，并打印其路径，例如 `/mica/diagnostics/3.json`。
不论 Web 模式如何都能用。快照、其上限和脱敏见[诊断](diagnostics.md)。

## 6. `mica internal`：工厂和构建使用

这些工具用于镜像构建和工厂，不用于运维设备，`mica help` 不列出它们。`--json` 不适用。

| 命令 | 作用 | 输出 |
|---|---|---|
| `mica internal device-code` | 打印本设备的设备码及其来源（`emmc-cid`、`dt-serial`、`dmi-serial`、`dmi-uuid`、`mac`、`random`） | `<code> (<来源>)`；没有时以 1 退出，`this device has no code: <原因>` |
| `mica internal derive-ap-key --secret FILE CODE` | 用 `FILE` 中的产品秘密为某个设备码派生出厂接入点的 SSID 和密钥 | `ssid=mica-....` 和 `psk=...` |
| `mica internal board check FILE` | 用本次构建检查板卡接口声明（`/usr/share/mica/board/interfaces.json` 格式） | `<file>: discover` 或 `<file>: <n> interfaces` |

AP 秘密和密钥派生见 `mica-core:docs/factory-ap-key.md`；不要让产品秘密进入 shell 历史和日志
（[量产](manufacturing.md)）。
