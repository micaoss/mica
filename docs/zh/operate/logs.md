# 日志与诊断

如何读取某个服务本次启动或上一次启动的日志；如何让日志跨重启保留、限制大小并转发到收集端；如何用 `mica doctor`
收集诊断快照和简短的支持摘要；以及错误报告里该放什么。设计见[诊断](../reference/diagnostics.md)，设置见
[设置](../reference/settings.md)。

## 开始之前

- **一台已认领的设备**，通过控制台（“系统”：日志与服务日志、诊断、信息）、带令牌的 API，或设备上以 root 运行的
  `mica` 访问：

  ```sh
  DEV=http://mica-a4e2e69e.local:8080
  AUTH="Authorization: Bearer mica_<id>_<secret>"   # 来自：mica tokens create laptop
  ```

- **日志在哪里。**systemd 产品使用 systemd 的 journal；OpenRC 产品运行 `mica-syslogd`，用 `logread` 读取。日志
  默认保存在 DATA 上、跨重启保留，raw NAND（UBI）板卡例外，例如 `qemu-armhf`，那里只在内存中。
- **日志中的时间是 UTC**，无论设置了什么时区（[时间](time.md)）。

> status: shipped — evidence: `mica-core:docs/mica-core.md`, `mica-core:crates/micad/src/logs.rs`

## 1. 读取某个服务的日志

控制台的“系统”下的日志页，或 API：某个服务最新的 200 行，离开设备前经过清洗。

```sh
curl -s -H "$AUTH" $DEV/api/v1/system/logs/micad
# {"source":"micad","available":true,"lines":["2026-11-15T09:12:03+0000 micad[412]: ..."],"truncated":false}
curl -s -H "$AUTH" "$DEV/api/v1/system/logs/micad?boot=previous"
```

| 来源 | 服务 | 存在于 |
|---|---|---|
| `micad` | 管理守护进程 | 总是 |
| `apid` | API 与控制台 | 总是 |
| `time` | `systemd-timesyncd`，OpenRC 上是 `ntpd` | 总是 |
| `ssh` | `mica-sshd` | 带 SSH 的产品 |
| `wifi-client`、`wifi-ap` | Wi-Fi 客户端和接入点 | 带 Wi-Fi 的产品 |
| `bluetooth` | 蓝牙 | 带蓝牙的产品 |
| `mqtt-broker`、`mqttd` | MQTT broker 和总线桥 | 带 MQTT 的产品 |

你自己的服务有自己的日志路由 `GET /api/v1/units/{name}/logs`（[服务](../integrate/native-applications.md)），每个
容器项目的服务也各有其路由（[容器](../integrate/containers.md)）。

**在设备上以 root** 可以读整个日志，而不只是白名单：

```sh
journalctl -u micad -b              # systemd：本次启动
journalctl -u micad -b -1           # 上一次启动，前提是保留了
journalctl -p warning -b            # 所有 warning 及更严重的
logread | grep micad                # OpenRC
```

只有日志保存在 DATA 上时才有上一次启动的日志；否则回答是 `available: false`，附带
`no previous boot is kept (persistent logs are off, or none was kept yet)`。

> status: shipped — evidence: `mica-core:crates/micad/src/logs.rs`, `mica-core:crates/mica-apid/src/routes/logs.rs`

## 2. 保留、限制和转发日志

几个设置，在控制台“系统”下的日志设置页，或用 `mica set`，或 `PUT /api/v1/settings/<path>`：

| 设置 | 取值 | 默认 |
|---|---|---|
| `logging.persistent` | `true`、`false`，或 `null` 表示默认 | 开；raw NAND 上关 |
| `logging.maxSizeKiB` | 1024 到 131072，或 `null` | DATA/var 上限的四分之一，最多 32 MiB |
| `logging.remote` | `{enabled, address, port, protocol}` | 关；端口 514，`udp` |

**让日志跨重启保留，上限 16 MiB：**

```sh
mica set logging.persistent true
mica set logging.maxSizeKiB 16384
```

**把所有日志转发到 192.0.2.50 上的 syslog 收集端：**

```sh
mica set logging.remote '{"enabled": true, "address": "192.0.2.50", "port": 514, "protocol": "udp"}'
```

通过 API 也一样：

```sh
curl -s -H "$AUTH" -X PUT $DEV/api/v1/settings/logging.remote \
  -H 'content-type: application/json' \
  -d '{"enabled": true, "address": "192.0.2.50", "port": 514, "protocol": "udp"}'
# {"taskId":"<id>"}
```

转发是普通 syslog，从不加密：让收集端位于你信任的网络上，或放在 WireGuard 隧道后面（[网络](network.md)第 9 节）。
收集端只能是 IP 地址，不能是主机名。`tcp` 只在 systemd 产品上可用。关闭转发时收集端会被保留，再打开即恢复。

**检查是否生效：**

```sh
mica get logging
curl -s -H "$AUTH" $DEV/api/v1/state/logging
# {"supported":true,"valid":true,"persistent":true,"persistentSource":"setting",
#  "maxSizeKiB":16384,"maxSizeKiBSource":"setting","maxSizeKiBLimit":...,
#  "remote":{"enabled":true,"address":"192.0.2.50","port":514,"protocol":"udp"},...}
```

状态显示实际生效的值：`persistentSource` 和 `maxSizeKiBSource` 说明是你的设置还是默认值起作用。

> status: shipped — evidence: `mica-core:crates/micad-settings/src/model/logging.rs`, `mica-core:crates/micad/src/reconciler/logging.rs`

## 3. 诊断快照：`mica doctor`

一个 JSON 文件，包含支持所需的内容：设备的身份和版本、部署和更新状态、本次与上一次启动中 warning 及更严重的行、
失败的服务和任务、存储和时间状态、观察到的网络以及遥测。凭据、令牌、密钥、Wi-Fi 密钥、SSID、MAC 地址和用户内容
会被移除；IP 地址和 machine id 保留。

**在设备上：**

```sh
mica doctor
# /mica/diagnostics/3.json
```

**在控制台中：**“系统”下的诊断页，生成快照，然后下载。

**用 API：**

```sh
curl -s -H "$AUTH" -X POST $DEV/api/v1/diagnostics/snapshots
# 201 {"snapshot":{...},"elapsedMillis":...,"sections":...,...}
curl -s -H "$AUTH" -OJ $DEV/api/v1/diagnostics/snapshots/3
# 保存为 mica-diagnostics-<machine id 前缀>-3.json
```

**检查是否生效：**读文件中的 `collection.sections`。为 `unavailable` 或 `timeout` 的部分同样是证据；报告它，
不要当作正常。

收集最多 20 秒，一次一个（第二个是 409 `diagnostics_busy`）。设备最多保留 8 个快照、合计 16 MiB，先丢弃最旧的，
并且不发送到任何地方。案例结束时删除：`DELETE /api/v1/diagnostics/snapshots/3`。

> status: shipped — evidence: `mica-core:crates/mica-apid/src/diag_cli.rs`, `mica-core:docs/mica-core.md`

## 4. 支持摘要

用于首次回复的简短 JSON：板卡、内核、产品和组件版本、运行中的部署、运行时长、时区和同步、完整性条目、DATA 的
就绪状态和空间，以及最近一次更新失败的代码。它不含 machine id、主机名、地址、各种码、凭据、日志或设置，因此
可以安全地贴到 issue 中。

```sh
curl -s -H "$AUTH" $DEV/api/v1/system/support-info
```

在控制台中：“系统”下的信息页，支持摘要（复制或下载为 `mica-support-<UTC time>.json`）。

> status: shipped — evidence: `mica-core:crates/mica-apid/src/routes/support_info.rs`, `mica-core:docs/mica-core.md`

## 5. 错误报告应包含什么

1. 支持摘要（第 4 节），支持方要求时再附快照（第 3 节）。
2. 产品和发布版本（`mica status`），以及板卡。
3. 你做了什么、预期是什么、实际发生了什么、首次发现的时间（UTC；如果 `mica time` 不是 `synchronized` 请注明）。
4. 准确的错误：API 的 `{"error": {...}}` 响应体或 `mica` 输出的那一行。
5. 问题出现前刚改过的设置。

不要附上密码、令牌、私钥，或 `/srv`、`/home` 中的文件。支持范围和期限见[支持](../releases/support.md)。

> status: shipped — evidence: `docs/reference/diagnostics.md`

## 6. 可能出现的问题

| 你看到 | 原因 | 解决 |
|---|---|---|
| 读日志时 422 `validation_failed` | 本产品没有的来源，或 `boot` 不是 `current`/`previous` | 从第 1 节选一个来源 |
| `available: false`，没有保留上一次启动 | 日志在内存中，或这是第一次保留的启动 | `mica set logging.persistent true` |
| `logging.maxSizeKiB is ...; a cap is 1024 to 131072 KiB, ...` | 上限超出范围，或超过 DATA/var 上限的一半 | 更小的值，或 `null` |
| `logging.remote.address "..." is not an IP address: ...` | 写了主机名 | 收集端的地址 |
| `forwarding is on, but logging.remote.address names no collector` | `enabled` 却没有地址 | 加上 `address` |
| `logging.remote.protocol tcp: an OpenRC device forwards its log over UDP only` | 在 OpenRC 产品上用了 `tcp` | `udp` |
| 409 `diagnostics_busy` | 正在收集快照 | 等待，然后列出快照 |
| 500 `diagnostics_io` | 存储不可写，或快照超过 2 MiB | 用 `mica status` 看 DATA；删除旧快照 |
| 收集端什么也没收到 | 途中的防火墙或路由，或收集端监听的是 TCP | `GET /api/v1/state/logging`，再查收集端 |

> status: shipped — evidence: `mica-core:crates/micad-settings/src/model/logging.rs`, `mica-core:crates/mica-apid/src/routes/logs.rs`
