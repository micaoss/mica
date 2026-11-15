# 时间

如何让设备使用你的 NTP 服务器、设置它显示的时区，以及检查它的时钟是否已同步。无论你设置什么，设备的时钟都保持
UTC；设计见[时间](../reference/time.md)，两个设置见[设置](../reference/settings.md)。

## 开始之前

- **一台已认领的设备**，以 root 使用 `mica`（SSH 会话或本地控制台），或在工作站上使用带令牌的 API：

  ```sh
  DEV=http://mica-a4e2e69e.local:8080
  AUTH="Authorization: Bearer mica_<id>_<secret>"   # 来自：mica tokens create laptop
  ```

- **无需开启。**网络时间始终运行；没有任何设置、API 调用或控制台开关能停止或暂停它。出厂时设备轮询镜像的后备
  服务器池，只有想用自己的服务器时才需要操作。
- **设备需要有到服务器的路由**（UDP 123）。所在网络没有出口的设备需要该网络上的服务器。

> status: shipped — evidence: `mica-core:docs/mica-core.md`, `mica-core:crates/micad/src/reconciler/time.rs`

## 1. 各 init 上运行的是什么

| | systemd 产品 | OpenRC 产品（`mini-x64.basic`、`qemu-armhf.basic`） |
|---|---|---|
| 客户端 | `systemd-timesyncd` | `mica-ntpd`（busybox `ntpd`） |
| 你的服务器写入 | `/var/lib/mica/time/timesyncd.conf`，链接为 `/etc/systemd/timesyncd.conf.d/60-mica-servers.conf` | `/var/lib/mica/time/ntpd.conf` 中的 `ntp_servers` |
| 未设置服务器时 | 镜像的后备服务器池 | `0.debian.pool.ntp.org` 到 `3.debian.pool.ntp.org` |
| 修改之后 | 重启 timesyncd | 重启 `mica-ntpd` |

两个文件都在 DATA 上，所以服务器从启动时的第一次轮询起就生效，早于 micad 启动。timesyncd 一次轮询一台服务器，
失败时换下一台。

> status: shipped — evidence: `mica-core:docs/mica-core.md`, `mica-system-base:debs/mica-openrc/payload/etc/init.d/mica-ntpd`

## 2. 使用自己的 NTP 服务器

在设备上：

```sh
mica time servers ntp1.example.net ntp2.example.net 192.0.2.123
# time.ntp.servers is ntp1.example.net ntp2.example.net 192.0.2.123
mica time servers
# ntp1.example.net
# ntp2.example.net
# 192.0.2.123
```

通过 API 也一样（请求体是整个列表）：

```sh
curl -s -H "$AUTH" -X PUT $DEV/api/v1/settings/time.ntp.servers \
  -H 'content-type: application/json' \
  -d '["ntp1.example.net","ntp2.example.net"]'
# {"taskId":"<id>"}
```

列表的规则：最多 8 项，每项是主机名或 IP 地址（ASCII 字母、数字、`.`、`-`、`:`），不超过 253 个字符，不能为空，
不能重复。

**恢复默认服务器池**：设为空列表。

```sh
mica set time.ntp.servers '[]'
```

> status: shipped — evidence: `mica-core:crates/micad/src/cli/settings.rs`, `mica-core:crates/micad-settings/src/model/time.rs`, `mica-core:crates/mica-apid/src/routes/settings.rs`

## 3. 设置时区

时区只改变时间的*显示*方式（控制台用它格式化时间，它被写入 `/run/mica/timezone`）；时钟、日志和 API 仍是 UTC。
不重启任何服务。

```sh
mica time zones | grep Europe/      # 本设备认识的时区
mica time zone Europe/Athens
# time.timezone is Europe/Athens
mica time zone
```

通过 API：

```sh
curl -s -H "$AUTH" $DEV/api/v1/time/zones          # {"zones":[{"id":"UTC",...},...]}
curl -s -H "$AUTH" -X PUT $DEV/api/v1/settings/time.timezone \
  -H 'content-type: application/json' -d '"Europe/Athens"'
```

控制台的选择器按城市、地区、时区名或当前偏移搜索同一个列表。时区名是 IANA 名称，例如 `UTC` 或 `Europe/Berlin`；
格式正确但设备没有对应时区文件的名称会被保存并报告为不可用，而不会被拒绝。

> status: shipped — evidence: `mica-core:crates/micad/src/cli/settings.rs`, `mica-core:crates/mica-apid/src/routes/time_zones.rs`

## 4. 检查是否生效

```sh
mica time
# status: synchronized
# synchronized: true
# server: ntp1.example.net
# offset: 0.0012 s
```

`mica time --json` 和 `GET /api/v1/time/status` 以 JSON 给出同样的内容（`status`、`synchronized`、`server`、带
`offsetSeconds` 和 `correction`（`step` 或 `slew`）的 `sample`，以及有话要说时的 `detail`）。`mica status` 在它的
`time` 行显示该状态。

| `status` | 含义 | 怎么做 |
|---|---|---|
| `synchronized` | 内核把时钟误差限定在 16 秒以内 | 无需操作 |
| `polling` | 已选定服务器且它在应答，但尚未达到该界限 | 等几个轮询周期；一直如此就读日志（第 5 节） |
| `offline-degraded` | 没有可用的服务器 | 检查到服务器的路由和 DNS，以及沿途的 UDP 123 |
| `invalid-source` | 服务器的应答不可用（leap 3、stratum 0 或 16 及以上） | 更换该服务器 |
| `unknown` | 某个信号无法读取 | `detail` 指出是哪一个：timesyncd 不在总线上，或 timedated 没有应答 |

在 OpenRC 上，状态取决于 `mica-ntpd` 是否在运行以及内核的同步标志：`synchronized`、`offline-degraded`（在运行，
尚未同步）或 `unknown`（`mica-ntpd` 未运行）。那里没有服务器和样本；`mica time` 只显示前两行。

> status: shipped — evidence: `mica-core:crates/micad/src/time_status.rs`, `mica-core:crates/micad/src/openrc/time_status.rs`

## 5. 可能出现的问题

| 你看到 | 原因 | 解决 |
|---|---|---|
| `at most 8 NTP servers are supported; ...`（422 `settings_rejected`） | 超过 8 项 | 保留 8 项或更少 |
| `NTP server "..." contains a character a host name or IP address cannot have; ...` | 某项中有 URL、端口或空格 | 只写名称或地址 |
| `NTP server "..." is listed twice` | 重复 | 删掉重复项 |
| `a timezone is an IANA zone name such as "UTC" or "Europe/Berlin": ...` | 不是时区名（`UTC+2`、`Athens`） | 从 `mica time zones` 中选 |
| 启动后数分钟一直是 `offline-degraded` | 设备还没有到服务器的路由，或 DNS 失败 | 见[网络](network.md)，然后再运行 `mica time` |
| 断电后时钟落后很多 | 没有可用的 RTC；收到第一次服务器应答后追上（第 6 节） | 让它能访问服务器 |

要看客户端自己的消息，读 `time` 日志（控制台的日志页，或 API）：在 systemd 上是 timesyncd 的 journal，在 OpenRC
上是标记为 `ntpd` 的行：

```sh
curl -s -H "$AUTH" $DEV/api/v1/system/logs/time
journalctl -u systemd-timesyncd      # 在 systemd 设备上，以 root
```

完整的错误格式见[错误](../reference/errors.md)。

> status: shipped — evidence: `mica-core:crates/micad-settings/src/model/time.rs`, `mica-core:docs/mica-core.md`

## 6. 启动时的时钟

启动时，板卡有可用的 RTC 时设备从 RTC 设置时钟；在 systemd 产品上，timesyncd 还保证它不早于最后一次保存到 DATA
的那一分钟（运行时每 60 秒保存一次）。之后由网络设置。证书检查在这个下限就位之后才开始。更新不依赖时钟：更新
文档不带过期时间。各板卡的 RTC 状态见其[硬件](../hardware/README.md)页面。

> status: shipped — evidence: `mica-core:docs/mica-core.md`
