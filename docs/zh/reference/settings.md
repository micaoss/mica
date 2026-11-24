# 设置树

运维者在 Mica OS 设备上配置的一切，都是 [micad](management.md) 持有的一棵有类型的树。API、控制台和设备
命令行都用点路径读写它，例如 `network.eth0.dhcp` 或 `access.ssh.enabled`。本页列出每棵子树的键、类型、
默认值和限制，说明由哪个文件存放，以及一次写入如何被检查和应用。来源是
`mica-core:crates/micad-settings/src/model.rs` 及其旁边的文件；契约是 `mica-core:docs/mica-core.md` 3.3 节。

## 存放位置

集成方设置的内容放在 DATA 上，每个关注点一份 JSON 文档，位于 `/mica/config/`（目录 `0700`，文档
`0600`）。设备为自己生成的东西（标识、凭据、认领、配置状态、已暂存的重置）是 STATE 上的
`/var/lib/mica/settings.toml`。更新策略是单独的文档 `/mica/config/updates.json`
（[更新引擎](updates.md#策略文档)）。

| 文档 | 承载的子树 |
|---|---|
| `system.json` | `hostname`、`access.console`、`access.web`、`access.mdns`、`access.ssdp`、`access.cloudAdmins` |
| `network.json` | `network` |
| `dns.json` | `dns` |
| `wifi.json` | `wifi` |
| `ssh.json` | `access.ssh` |
| `mqtt.json` | `mqtt` |
| `time.json` | `time` |
| `container.json` | `container`（每个项目的 Compose 文本是单独的文件 `container/<project>.yaml`） |
| `bluetooth.json` | `bluetooth` |
| `services.json` | `services` |
| `logging.json` | `logging` |

每份文档都有自己的 `schema_version`（目前全是 1）。未知的键或版本会被拒绝，从不转换。解析失败的文档
只停用它承载的子树；设备其余部分照常工作。缺失的键取默认值，很多默认值不会写出来，所以新文档很短。

`configuration` 重置清空 `/mica/config/`，保留 STATE（[恢复](../operate/recovery.md)）。

## 一次写入如何进行

1. 调用方给出路径和 JSON 值：总线上的 `SetSettings`（设备上的 root），或 API。路径上缺失的映射条目会
   被创建（写 `network.eth1.dhcp` 会创建 `eth1`）。通过 API，通用的 `PUT /api/v1/settings/<path>` 只接受
   十四个路径：`hostname`、`access.ssh.enabled`、`access.mdns.enabled`、`access.ssdp.enabled`、
   `access.cloudAdmins.enabled`、`container.enabled`、`mqtt.enabled`、`wifi.client.enabled`、`wifi.ap.mode`、
   `time.ntp.servers`、`time.timezone`、`logging.persistent`、`logging.maxSizeKiB` 和 `logging.remote`；
   `PATCH /api/v1/settings` 一次写入其中多个。其他子树各有自己的路由，检查的不只是类型：`/api/v1/network/{iface}` 及其 peers、`/api/v1/dns/…`、
   `/api/v1/wifi/…`、`/api/v1/ssh/authorized-keys`、`/api/v1/web`、`/api/v1/container-projects/{project}`、
   `/api/v1/units/{name}`、`/api/v1/bluetooth/…`、`/api/v1/mqtt`（[API](api.md)）。
2. 带着新值对整棵树做校验：类型、限制和交叉检查（VLAN 的父接口必须已声明，静态网关必须在其子网内）。
   被拒绝时树保持不变，并引用所违反的规则。
3. 变更经过 fsync 的撤销日志，受影响的文档被保存。
4. 一个任务负责应用。涉及网络时其 `kind` 为 `network.apply`，否则为 `settings.apply`；其 `phase` 依次为
   `saved`、`applying`、`applied`。用 `GET /api/v1/tasks/<id>` 读取。
5. 30 秒内未收敛的网络应用会回滚到上次应用的映射，任务失败并指明接口。

产品不具备其特性的子树（`wifi`、`bluetooth`、`ssh`、`containers`、`mqtt`）会以
`feature not in this product` 被拒绝。

## `hostname`

| 键 | 类型 | 默认值 |
|---|---|---|
| `hostname` | 字符串 | `mica` |

主机名同时也是蓝牙适配器的名称、mDNS 名（`<hostname>.local`），以及 `127.0.1.1` 解析到的名字。

## `network.<iface>`

从接口名（最多 15 个字符，内核允许的名字）到其条目的映射。

| 键 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `kind` | `physical`、`vlan`、`bridge`、`wireguard`、`can` | `physical` | physical 不写出 |
| `dhcp` | 布尔 | `false` | |
| `static.address` | IPv4 CIDR | — | `dhcp` 为 false 时使用，例如 `192.168.1.10/24` |
| `static.gateway` | IPv4 | 无 | 必须在地址的子网内 |
| `static.dns` | 地址列表 | `[]` | |
| `dns` | 地址列表 | `[]` | 仅与 `dhcp` 一起：代替租约给出的服务器 |
| `routes` | `{destination, gateway?, metric?}` 列表 | `[]` | `destination` 为 CIDR；与 `static.gateway` 并存的 `0.0.0.0/0` 会被拒绝；默认路由的 `metric` 须不小于 20（`route_metric_reserved`），缺省时取该条目的值 |
| `internet` | 布尔 | `true`（板卡声明为内部的端口上为 `false`） | `false` 采用租约的地址和子网路由，但从不采用默认路由；此时静态网关会被拒绝（`gateway_not_allowed`） |
| `probe.enabled` | 布尔 | —（没有 `probe`：关闭） | 上行可达性检查；`false` 保留目标。只用于可能承载默认路由的物理、网桥和 VLAN 条目（`probe_not_allowed`） |
| `probe.targets` | `{address, method, port?}` 列表 | `1.1.1.1` 和 `8.8.8.8`，`tcp` 到 53 端口，在不带目标启用检查时写入 | 1 到 4 个，不得重复（`probe_targets`）；`address` 为 IPv4 单播地址或 `gateway`（`probe_address`）；`method` 为 `icmp` 或 `tcp`（`probe_method`）；`port` 仅用于 `tcp`，1 到 65535，缺省 443（`probe_port`） |
| `probe.intervalS` | 整数，2 到 300 | 10 | 两轮之间的秒数（`probe_interval`） |
| `probe.timeoutMs` | 整数，200 到 10 000 | 2000 | 必须小于间隔（`probe_timeout`） |
| `probe.failuresToDown` | 整数，1 到 20 | 3 | 连续失败多少轮判定上行断开（`probe_threshold`） |
| `probe.successesToUp` | 整数，1 到 50 | 5 | 连续成功多少轮判定恢复（`probe_threshold`） |
| `vlan.parent`、`vlan.id` | 字符串、整数 | — | 父接口必须是已声明的非 CAN 条目；仅 systemd |
| `bridge.ports` | 条目名列表 | `[]` | 每个都必须已声明且不是 CAN；仅 systemd |
| `wireguard.listenPort` | 整数 | 由内核选 | |
| `wireguard.peers` | 列表 | `[]` | 见下文 |
| `can.bitrate` | 整数，1 到 1 000 000 | 必填 | bit/s |
| `can.restartMs` | 整数，0 到 60 000 | 不重启 | bus-off 后的延迟 |
| `can.fd` | 布尔 | `false` | |
| `can.dataBitrate` | 整数，1 到 8 000 000 | — | `fd: true` 时必填，否则拒绝 |

静态默认路由按条目名称顺序取 metric 20、21……；20 以下留给设备自己（micad 的故障切换路由
是 metric 10）。启用检查后，设备会每个间隔从该接口联系一次它的目标（[网络](../operate/network.md)）。

WireGuard 对端是 `{publicKey, allowedIps, endpoint?, persistentKeepalive?, name?, presharedKey?}`：密钥为
base64 的 32 字节，`allowedIps` 是地址或 CIDR，`endpoint` 是 `host:port`，`name` 是最多 64 个字符的标签。
经对端的默认路由会被拒绝：请写出其后面的网段。隧道私钥在设备上生成，从不出现在树中。CAN 条目不带
任何寻址。

映射没有声明的有线端口仍会通过 DHCP 获取地址。父接口未声明的 VLAN 会以镜像给它的配置声明该父接口
（试运行中显示为 `adopted`）。板卡可以一次性添加默认条目（[micad](management.md#生命周期)）。

```json
{
  "schema_version": 1,
  "network": {
    "eth0": { "dhcp": true },
    "eth1": {
      "static": { "address": "10.20.0.5/24", "gateway": "10.20.0.1", "dns": ["10.20.0.1"] },
      "routes": [ { "destination": "10.30.0.0/16", "gateway": "10.20.0.254" } ]
    },
    "eth0.100": { "kind": "vlan", "vlan": { "parent": "eth0", "id": 100 }, "dhcp": true },
    "can0": { "kind": "can", "can": { "bitrate": 250000, "restartMs": 100, "fd": false } }
  }
}
```

## `dns`

| 键 | 类型 | 默认值 | 限制 |
|---|---|---|---|
| `global.enabled` | 布尔 | `false` | 开启时至少一个服务器 |
| `global.servers` | IPv4 列表 | `[]` | 最多 3 个；不能是回环、未指定地址、设备自己的地址或重复；关闭时保留 |
| `staticRecords` | `{id, hostname, address, comment?}` 列表 | `[]` | 最多 100 条；`id` 为 1–32 个 `[A-Za-z0-9_-]`，唯一；`hostname` 是主机名，不能是 `localhost` 或设备自己的名字；`address` 为 IPv4；`comment` 最多 64 个字符 |

全局服务器替换每个接口的服务器；静态记录写进 hosts 文件。

## `access`

| 键 | 类型 | 默认值 | 所在文档 |
|---|---|---|---|
| `ssh.enabled` | 布尔 | `false`（首次启动按产品的 `SSH=` 行） | `ssh.json` |
| `ssh.port` | 整数 | 22 | |
| `ssh.permitRootLogin` | 布尔 | `true` | |
| `ssh.passwordAuthentication` | 布尔 | `true` | 仅在临时 root 密码有效时提供 |
| `ssh.listenAddresses` | 地址列表 | `[]`（所有地址） | 最多 10 个 |
| `ssh.authorizedKeys` | `{key, comment?}` 列表 | `[]` | `key` 为 `<type> <base64>`；重复的被拒绝 |
| `console.shellEnabled` | 布尔 | `false` | tty3 上的 root shell；只有 `debug` 配置的镜像带这个 shell |
| `web.mode` | `network`、`local`、`off` | `network` | 谁能访问 API：网络、仅设备本身、或无人 |
| `web.httpPort` | 整数 | 8080 | |
| `web.httpsEnabled` | 布尔 | `false` | 开启 HTTPS 后 HTTP 只做重定向 |
| `web.httpsPort` | 整数 | 8443 | |
| `mdns.enabled` | 布尔或缺省 | 产品的 `MDNS=`（开） | `system.json` |
| `ssdp.enabled` | 布尔或缺省 | 产品的 `SSDP=`（开） | |
| `cloudAdmins.enabled` | 布尔或缺省 | 产品的 `CLOUD_ADMINS=`（关） | |

管理员密码哈希、认领、设备凭据和 API 令牌（最多 32 个，只存哈希）也在 `access` 中，存放在 STATE 上。
它们由各自的 API 路由写入（setup、change-password、tokens），从不通过设置写入，读取时会被遮蔽。

## `wifi`

| 键 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `client.enabled` | 布尔 | `true` | 没有网络的 supplicant 不会加入任何网络 |
| `client.interface` | 字符串 | `wlan0` | |
| `client.networks` | 列表 | `[]` | 整体写入 |
| `client.networks[].ssid` | 字符串 | — | |
| `client.networks[].psk` | 字符串 | 无（开放网络） | 8–63 个字符，或 64 个十六进制数字 |
| `client.networks[].hidden` | 布尔 | `false` | |
| `client.networks[].priority` | 整数 | 0 | 大者优先 |
| `client.networks[].autoConnect` | 布尔 | `true` | `false` 保留该网络但不加入 |
| `ap.mode` | `off`、`provisioning`、`always` | `off` | `provisioning`：仅在没有可用上行链路时 |
| `ap.interface` | 字符串 | `wlan0` | |
| `ap.ssid` | 字符串 | 由设备标识派生 | |
| `ap.psk` | 字符串 | 由设备凭据派生 | 从不是全机队共用的常量 |
| `ap.channel` | 整数 | 6 | `0` 自动选择；FCC 频道规划的国家为 1–11，其他为 1–13 |
| `ap.countryCode` | 字符串 | `US` | 监管域 |
| `ap.address` | IPv4 CIDR | `192.168.4.1/24` | |
| `ap.holdDownSeconds` | 整数 | 120 | 没有上行链路多久后启动接入点 |
| `ap.graceSeconds` | 整数 | 60 | 上行链路恢复后接入点再保持多久 |
| `ap.security` | `wpa2-psk`、`wpa2-wpa3`、`open` | `wpa2-psk` | |
| `ap.pool` | `{offset, size}` | 接入点地址之后的所有地址 | 不能碰到子网地址或广播地址，也不能包含接入点自己的地址 |
| `ap.leaseSeconds` | 整数 ≥ 60 | DHCP 服务器自己的 | |

在带 Wi-Fi 的产品上，首次启动配置会打开接入点（`always`，使用标签上的 SSID 和密钥）并关闭站点，除非
树中已经指定了要加入的网络。BLE 配置占用射频期间，对 `wifi` 的写入会被拒绝（423 `wifi_locked`）。

## `container`

| 键 | 类型 | 默认值 | 限制 |
|---|---|---|---|
| `enabled` | 布尔 | `false` | 启动 `mica-containerd` 和各项目 |
| `projects` | 名称 → Compose 文本 | `{}` | 最多 32 个；名称为 1–40 个 `[a-z0-9_-]`，以字母或数字开头；每份文本 ≤ 64 KiB，合计 ≤ 256 KiB |
| 项目目录 | 绝对路径 | `/mica/volumes/<project>/` | 相对主机路径的解析位置 |

见[容器](../integrate/containers.md)。

## `services`

`units` 把 unit 文件名（systemd：`.service`、`.socket`、`.timer`、`.path`、`.target`、`.mount`、
`.automount`、`.swap`；最多到模板）或 openrc-run 脚本名映射到 `{kind, text, conf?, enabled}`。`kind` 是
文本所针对的 init；只应用产品自己的那种。限制：32 个 unit，每份文本 64 KiB，每份 `conf` 16 KiB（仅
OpenRC），合计 256 KiB。启用模板会被拒绝。见[原生应用](../integrate/native-applications.md)。

| 键 | 类型 | 默认值 | 限制 |
|---|---|---|---|
| `units` | 名称 → unit 的映射 | `{}` | 最多 32 个；所有文本和 conf 合计 ≤ 256 KiB |
| `units.<name>.kind` | `systemd`、`openrc` | 必填 | 只应用产品自己的 init |
| `units.<name>.text` | 字符串 | 必填 | unit 文件或 openrc-run 脚本，≤ 64 KiB |
| `units.<name>.conf` | 字符串或缺省 | 缺省 | 脚本的 `conf.d` 文件，仅 OpenRC，≤ 16 KiB |
| `units.<name>.enabled` | 布尔值 | `false` | 立即启动并在每次启动时启动；模板不允许启用 |

## `mqtt`

| 键 | 类型 | 默认值 |
|---|---|---|
| `enabled` | 布尔 | `false` |
| `listen.address` | 字符串 | `127.0.0.1` |
| `listen.port` | 整数 | 1883 |
| `auth.enabled` | 布尔 | `false` |

代理默认只监听回环地址；放宽它是一次有意的修改。

## `time`

| 键 | 类型 | 默认值 | 限制 |
|---|---|---|---|
| `ntp.servers` | 名称或地址列表 | `[]`（镜像的服务器池） | 最多 8 个，每个 ≤ 253 个字符 |
| `timezone` | IANA 时区名 | `UTC` | 例如 `Europe/Athens`；只用于显示，时钟保持 UTC |

见[时间](time.md)。

## `logging`

| 键 | 类型 | 默认值 | 限制 |
|---|---|---|---|
| `persistent` | 布尔或缺省 | 由镜像和板卡决定（开；裸 NAND 上为关） | |
| `maxSizeKiB` | 整数或缺省 | DATA/var 限额的四分之一，最多 32 MiB | 1024 到 131 072，并由 Base 限制在设备自身的上限内 |
| `remote.enabled` | 布尔 | `false` | |
| `remote.address` | IPv4 或 IPv6 | — | 只能是地址，不能是主机名 |
| `remote.port` | 整数 | 514 | |
| `remote.protocol` | `udp`、`tcp` | `udp` | `tcp` 仅限 systemd |

远程收集器在关闭时保留。转发是明文 syslog，从不加密。

## `bluetooth`

| 键 | 类型 | 默认值 |
|---|---|---|
| `enabled` | 布尔 | `true` |
| `devices` | 地址 → `{name, trusted, blocked}` | `{}` |
| `provisioning.autoWhenOffline` | 布尔 | `true` |

地址是六个十六进制字节，`AA:BB:CC:DD:EE:FF`。没有人声明的已配对设备会被移除。适配器只在 180 秒的
配对窗口内可被发现和配对。

## `provisioning` 与 `reset`

对运维者只读：配置状态（已应用文档的摘要和结果）以及已暂存的重置层级。它们通过配置流程和重置 API
改变，而不是通过设置写入。

## 读取与检查

| 操作 | 预期 |
|---|---|
| `GET /api/v1/settings/`（空路径） | 整棵树，秘密被遮蔽 |
| `GET /api/v1/settings/network.eth0` | 一个条目；路径不指向任何东西时 404，不是合法点路径时 422 |
| `PUT /api/v1/settings/time.timezone`，值为 `"Europe/Athens"` | `202` 和任务 id；任务到达 `applied` |
| `PUT /api/v1/settings/network.eth0` | 被拒绝：网络通过 `/api/v1/network/eth0` 写入 |
| `GET /api/v1/state/<path>` | 调和器报告的实时状态，在应用过程中或失败时可能与设置不同 |
| 在设备上 `ls -l /mica/config/` | `0600` 的文档，每个已写过的关注点一份 |

被拒绝的写入会给出它违反的规则，什么也不保存。设置已保存但未生效时，比较同一路径的 `settings` 和
`state`，并阅读任务的消息。
