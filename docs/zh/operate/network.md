# 网络

如何让设备接入你现有的网络：有线 DHCP 或静态地址、不作为互联网出口的端口、额外路由、两条上行（连通性检查与故障切换）、VLAN 和网桥、
作为客户端或接入点的 Wi-Fi、DNS，以及到对端的 WireGuard 隧道。每次修改都经过 micad 的设置，由它的网络协调器
应用；每个字段的参考见[设置](../reference/settings.md)，每个路由见 [HTTP API](../reference/http-api.md)。

## 开始之前

- **一台已认领的设备**以及访问它的途径：`http://<device>:8080` 上的控制台（网络页面），或带令牌的 API。令牌只需
  创建一次，在设备上以 root 创建，或在控制台的访问页创建：

  ```sh
  mica tokens create laptop          # 打印 mica_<id>_<secret>，只显示一次
  ```

  下面的 API 示例在工作站上运行，使用这两个变量：

  ```sh
  DEV=http://mica-a4e2e69e.local:8080
  AUTH="Authorization: Bearer mica_<id>_<secret>"
  ```

- **产品运行哪种 init。**systemd 产品渲染 networkd unit；OpenRC 产品（`mini-x64.basic`、`qemu-armhf.basic`）渲染
  busybox ifupdown 的 `/etc/network/interfaces`。两者接受同样的设置，只是 VLAN 和网桥需要 systemd（第 6 节）。
- **留一条回来的路。**拿走你正在连接的地址的修改会结束你的会话。在你无法走到跟前的设备上，一次只改一个端口，
  并让控制台在另一个端口上保持可达。

> status: shipped — evidence: `mica-core:docs/mica-core.md`, `mica-core:crates/micad/src/reconciler/network/render.rs`, `mica-core:crates/micad/src/reconciler/network/ifupdown.rs`

## 1. 修改如何应用

网络写入先保存条目，然后协调器渲染并应用它，作为一个**任务**。写入以 `202` 和任务 id 应答；跟踪任务直到其
`phase` 为 `applied`，然后读取它的 `outcome`：

```sh
curl -s -H "$AUTH" -X PUT $DEV/api/v1/network/eth0 \
  -H 'content-type: application/json' -d '{"dhcp": true}'
# {"taskId":"<id>"}
curl -s -H "$AUTH" $DEV/api/v1/tasks/<id>
# ... "phase":"applied", "outcome":"succeeded", "interfaces":["eth0"] ...
```

`PUT /api/v1/network/{iface}` 声明或替换一个接口，并对照整个映射校验；`DELETE` 删除一个；`PUT /api/v1/network`
一次替换整个映射（把 `GET /api/v1/network` 中的 `version` 作为 `baseVersion` 传入，这样并发的修改会被拒绝而不是
被覆盖）。同一时间只运行一个网络任务：应用期间的写入以 409 `busy` 拒绝；等它结束后重试。

**检查是否生效**，在控制台的网络概览中，或：

```sh
mica network                       # 在设备上：每个接口一行
mica network show eth0             # 地址、网关、DNS
curl -s -H "$AUTH" $DEV/api/v1/network/status
```

被拒绝的写入什么也不改变。它以 `422` 应答，并在 `details` 中列出结果映射违反的每条规则，各带接口、字段和代码；
代码见第 10 节。

> status: shipped — evidence: `mica-core:crates/mica-apid/openapi.json`, `mica-core:crates/micad-settings/src/network_write.rs`

## 2. 有线：DHCP 或静态地址

没人声明的有线端口按镜像使用 DHCP。要改变这一点就声明它。

**DHCP**，可选地用你自己的 DNS 服务器代替租约给的：

```json
{"dhcp": true, "dns": ["192.168.1.1"]}
```

**静态**，带网关和 DNS 服务器：

```json
{"dhcp": false,
 "static": {"address": "192.168.1.40/24", "gateway": "192.168.1.1",
            "dns": ["192.168.1.1", "9.9.9.9"]}}
```

```sh
curl -s -H "$AUTH" -X PUT $DEV/api/v1/network/eth0 \
  -H 'content-type: application/json' \
  -d '{"dhcp":false,"static":{"address":"192.168.1.40/24","gateway":"192.168.1.1","dns":["192.168.1.1"]}}'
```

在控制台中：网络 → 接口 → 该端口 → 地址。

**检查是否生效：**`mica network show eth0` 打印 `address: 192.168.1.40/24` 和 `gateway: 192.168.1.1`。如果你改了
正在连接的地址，用新地址重新连接。

**可能出的问题：**

| 代码 | 含义 | 处理 |
|---|---|---|
| `gateway_out_of_subnet` | 网关不在地址的子网内 | 修正前缀或网关 |
| `address_overlap` | 子网与另一个接口的重叠 | 给每个接口各自的子网 |
| `validation_failed` | 字段本身的语法，例如地址没有前缀 | 写成 `address/prefix` |

> status: shipped — evidence: `mica-core:crates/micad-settings/src/model/network.rs`, `mica-core:crates/micad/src/reconciler/network/render.rs`

## 3. 不作为互联网出口的端口

接到机器网络、传感器或摄像头的端口应该只承载它的子网，从不承载默认路由。`internet: false` 表达这一点；它用于
物理、网桥和 VLAN 条目，并且是板卡声明为内部端口的默认值。

- **没有网关的静态地址**本身就足够了：没有网关，就没有默认路由。

  ```json
  {"dhcp": false, "static": {"address": "10.10.0.1/24"}, "internet": false}
  ```

- **DHCP 需要 `internet: false`**：端口获取租约的地址和子网，但不获取它的网关。

  ```json
  {"dhcp": true, "internet": false}
  ```

在 `internet: false` 的接口上写静态网关或 `0.0.0.0/0` 路由，会以 `gateway_not_allowed` 拒绝：去掉网关，或去掉
`internet: false`。

**检查是否生效：**`mica network show eth1` 打印地址，没有 `gateway:` 行。

> status: shipped — evidence: `mica-core:crates/micad-settings/src/network_write.rs`, `mica-core:crates/micad/src/reconciler/network/render.rs`

## 4. 额外路由

`routes` 给接口添加静态路由，在静态网关写入的默认路由之外。没有网关的路由是直连路由。

```json
{"dhcp": false,
 "static": {"address": "10.10.0.1/24"},
 "internet": false,
 "routes": [{"destination": "10.20.0.0/16", "gateway": "10.10.0.254"},
            {"destination": "10.30.0.0/16", "gateway": "10.10.0.254", "metric": 50}]}
```

在 `static.gateway` 旁边再写 `0.0.0.0/0` 路由会被拒绝：网关已经是默认路由。在 OpenRC 上，DHCP 端口上的路由在租约
绑定后应用，租约丢失时移除。

**检查是否生效：**`mica network --json` 列出每个接口的路由，或在设备上运行 `ip route`。

> status: shipped — evidence: `mica-core:crates/micad-settings/src/model/network.rs`, `mica-core:docs/mica-core.md`

## 5. 两条上行与故障切换

当多个接口都能承载默认路由时，由路由 metric 决定，最低者胜出。

| 默认路由来自 | Metric |
|---|---|
| 静态网关，按名称顺序第一个带网关的条目 | 20 |
| 之后的每个静态网关 | 21、22…… |
| 按名称顺序的第一个 DHCP 端口 | 100 |
| 之后的每个 DHCP 端口 | 110、120…… |
| Wi-Fi 客户端 | 600 |

所以静态网关优先于任何租约，有线优先于 Wi-Fi。声明的默认路由 metric 低于 20 会被拒绝（`route_metric_reserved`）：
这一段留给 micad 下文的故障切换路由。两条 metric 相同的默认路由会被拒绝（`metric_duplicate`）。

**不开检查时，故障切换只针对链路和租约丢失。**端口失去载波或租约时，它的默认路由消失，由下一条承载流量；
它恢复时再次接管。链路正常却无法访问互联网（网线正常、后面的调制解调器没有信号）时，它的路由保留。

### 连通性检查

每条上行都可以带一个**连通性检查**（`probe`）：设备每隔一个间隔，只从该接口去连接几个目标。检查判定某条上行
`down` 而另一条有应答时，micad 经有应答的那条加一条自己的默认路由，metric 10，因此压过其他路由；前一条恢复
应答后，micad 删除这条路由，流量切回。

**默认关闭。**开启时如果没有填自己的目标，会存入两个：`1.1.1.1`（Cloudflare）和 `8.8.8.8`（Google），都是
公共 DNS 解析服务器，以 TCP 连接 53 端口探测。此后只要检查开着，设备就会每个间隔从该接口联系它们。可以换成
你想用的地址，或添加 `gateway`（该上行自己的路由器）。

| 字段 | 默认值 | 范围 |
|---|---|---|
| `targets` | `1.1.1.1` 和 `8.8.8.8`，`tcp` 53 端口 | 1 到 4 个；IPv4 地址或 `gateway`；`icmp`（一次回显）或 `tcp`（一次连接；`port` 仅用于 `tcp`，默认 443） |
| `intervalS` | 10 秒 | 2 到 300 |
| `timeoutMs` | 2 秒（2000） | 200 到 10 000，且小于间隔 |
| `failuresToDown` | 3 轮 | 1 到 20 |
| `successesToUp` | 5 轮 | 1 到 50 |

任一目标应答即算本轮成功。按默认值，上游停止应答约 30 秒（3 × 10 秒）后切走，恢复应答约 50 秒（5 × 10 秒）
后切回。用 53 端口而不是 443，是因为强制门户或透明代理会应答任何 443 连接，让一条什么都连不上的上行看起来正常。

**流量开销。**按默认值，每个目标每天约 1.5 MB。在按流量计费的上行（例如按流量计费的 LTE 路由器）上要算进去；
间隔越长，开销越小，发现故障也越晚。

**在控制台：**网络 → 接口 → 该端口 → 连通性检查（“检查能否访问互联网”）。它会填入两个目标，显示切走和切回所需
时间以及每天的开销；开启后显示判定结果、该端口是否承载流量以及上一轮的应答。Wi-Fi 客户端的同一编辑器在 Wi-Fi
标签页，位于无线状态旁边。

### 完整示例：有线调制解调器，后备 LTE 路由器

`eth0` 接现场的有线调制解调器，`eth1` 接作为后备的 LTE 路由器；两者都用 DHCP，所以 `eth0` 的 metric 是 100，
`eth1` 是 110。两条都开启检查：`eth0` 上开，是为了发现调制解调器失效；`eth1` 上开，是为了不把流量切到同样
连不上互联网的后备上。

```sh
curl -s -H "$AUTH" -X PUT $DEV/api/v1/network/eth0 \
  -H 'content-type: application/json' -d '{"dhcp": true, "probe": {"enabled": true}}'
# {"taskId":"<id>"}
curl -s -H "$AUTH" -X PUT $DEV/api/v1/network/eth1 \
  -H 'content-type: application/json' -d '{"dhcp": true, "probe": {"enabled": true}}'
curl -s -H "$AUTH" $DEV/api/v1/network | jq .configured.eth0.probe
# {"enabled":true,"targets":[{"address":"1.1.1.1","method":"tcp","port":53},
#  {"address":"8.8.8.8","method":"tcp","port":53}], ...}
```

`PUT` 替换整个条目，所以要连同地址配置一起写上检查。存下的条目写明了设备现在联系的目标。

**检查是否生效。**在设备上，等几轮之后（第一次判定之前 INTERNET 列显示 `checking`）：

```sh
mica network
# NAME     STATE     INTERNET  ADDRESSES
# eth0*    routable  up        192.168.1.40/24 ...
# eth1     routable  up        192.168.8.100/24 ...
mica network show eth0
# internet: up (carries the traffic)
# metric: 100
# check: on, every 10 s, 2000 ms timeout, down after 3, up after 5: 1.1.1.1 tcp/53, 8.8.8.8 tcp/53
# ...
```

`*` 标出承载流量的上行。现在保留网线，断掉调制解调器的外线（拔掉同轴或 DSL 线）。约 30 秒后：

```sh
mica network
# eth0     routable  down      192.168.1.40/24 ...
# eth1*    routable  up        192.168.8.100/24 ...
ip route | grep default
# default via 192.168.8.1 dev eth1 proto 109 metric 10
# default via 192.168.1.1 dev eth0 proto dhcp src 192.168.1.40 metric 100
# default via 192.168.8.1 dev eth1 proto dhcp src 192.168.8.100 metric 110
journalctl -u micad -b | grep MICA_UPLINK      # OpenRC：logread | grep MICA_UPLINK
# ... MICA_UPLINK active=eth1 previous=eth0 reason=probe
```

metric 10 的路由是 micad 的（路由协议 109；OpenRC 上 BusyBox 的 `ip route` 不打印协议，所以那里显示为
`metric 10` 的默认路由）。每条上行保留自己的路由。把外线接回：应答约 50 秒后 `eth0` 重新是 `up` 并带 `*`，
metric 10 的路由消失，日志写 `reason=recovered`。`GET /api/v1/network/status` 的 `uplinks` 里也有同样内容：
`active`、`natural`（只看 metric 会选的上行）、`override`（micad 的路由是否在引导流量）、`lastChange`，以及每条
上行的状态、计数和上一轮结果（[诊断](../reference/diagnostics.md#3-观测到的网络状态)）。

**DNS 跟随活动上行**，两种 init 都一样：另一条上行活动时，处于 `down` 的上行不再被用来解析名字。systemd 上
micad 让 resolved 不再把该链路的服务器用于普通查询；OpenRC 上它写 `/run/mica/resolv.order`，重建
`resolv.conf`，活动上行的服务器在前，down 的在后。开启全局 DNS 服务器时（第 8 节），无论哪条上行活动，
所有查询都发给它们。

### 限制

- **只支持 IPv4。**目标是 IPv4 地址，也只切换 IPv4 默认路由。
- **只能写地址**，不能写主机名：主机名得通过正被检查的那条上行去解析。
- **已建立的连接不会迁移。**切换只影响新连接；已打开的连接保留旧上行的源地址，停住直到应用重连。容器和接入点
  的客户端在新连接上使用新上行。
- **强制门户。**如果门户连 53 端口的 TCP 也应答，上行会看起来正常。选门户无法代答的目标，例如对外部地址用
  `icmp`。
- **所有目标在每条上行上都不通。**如果从每条上行都连不上目标，所有上行都是 `down`，micad 删除自己的路由，设备
  按 metric 路由，和没开检查一样。请用分属不同网络的两个目标。
- **严格反向路径过滤**（`rp_filter` 为 1）会丢弃非活动上行上的应答；该上行显示 `blocked`，不会被使用。Mica 镜像
  保持内核默认值 0。
- 不适用于 `internet: false`、WireGuard 或 CAN 条目（`probe_not_allowed`）。

**可能出现的问题：**

| 代码或状态 | 含义 | 处理 |
|---|---|---|
| `probe_not_allowed` | 该条目不能承载默认路由 | 去掉 `internet: false`，或检查另一个端口 |
| `probe_targets` | 没有目标、超过 4 个，或有重复 | 1 到 4 个互不相同的目标 |
| `probe_address`、`probe_method`、`probe_port` | 不是 IPv4 地址或 `gateway`；不是 `icmp`/`tcp`；`icmp` 带了端口或端口不在 1-65535 | 修正该目标 |
| `probe_interval`、`probe_timeout`、`probe_threshold` | 数值超出范围，或超时不小于间隔 | 见上表 |
| `route_metric_reserved` | 声明的默认路由 metric 低于 20 | 用 20 或更大 |
| INTERNET 为 `no route` | 该端口没有载波、租约或默认路由 | 检查网线，或该网络的 DHCP |
| INTERNET 为 `blocked` | 严格反向路径过滤（端口或 `all` 的 `rp_filter` 为 1） | 改回 0 或 2 |

> status: shipped — evidence: `mica-core:docs/mica-core.md`, `mica-core:docs/plan/uplink-failover.md`, `mica-core:crates/micad/src/cli/network.rs`, `mica-core:crates/mica-apid/ui/src/i18n/resources.ts`

## 6. VLAN 和网桥（systemd 产品）

VLAN 位于一个已声明的父接口之上；网桥收纳已声明的端口，这些端口随后不再有自己的地址。

```json
{"eth0":   {"dhcp": true},
 "vlan20": {"kind": "vlan", "vlan": {"parent": "eth0", "id": 20},
             "static": {"address": "10.20.0.5/24"}, "internet": false},
 "br0":    {"kind": "bridge", "bridge": {"ports": ["eth1", "eth2"]}, "dhcp": true},
 "eth1":   {}, "eth2": {}}
```

用 `PUT /api/v1/network`（带 `baseVersion`）整体发送这样的映射，或在控制台的接口页面逐个添加条目。

| 代码 | 含义 |
|---|---|
| `vlan_duplicate` | 同一父接口上有两个相同的 VLAN id |
| `vlan_parent_invalid` | 父接口未声明，或是 CAN 条目 |
| `bridge_port_invalid` | 端口未声明，或是 CAN |
| `bridge_port_addressed` | 网桥端口带有地址；把地址移到网桥上 |
| `bridge_port_taken` | 一个端口在两个网桥中 |

在 OpenRC 产品上，VLAN 或网桥条目会按名称被拒绝：`network.<iface>: vlan needs systemd-networkd, which this
OpenRC device does not run`。

> status: shipped — evidence: `mica-core:crates/micad/src/reconciler/network/ifupdown.rs`, `mica-core:crates/micad-settings/src/network_write.rs`

## 7. Wi-Fi

适用于带无线电的产品（`cx3576.full`、`s905x5m.sd-full`、`s905x5m.emmc-full`）。一个无线电同时只能运行客户端或接入点
之一（[Wi-Fi](../reference/wifi.md#5-单无线电冲突照实报告不做仲裁)）。

### 作为客户端

```sh
mica wifi scan                     # 无线电看到的网络，信号最强的在前
mica wifi add Marina-Guest         # 询问两次密钥
mica wifi on
mica wifi                          # enabled、interface、connected: <ssid>、已知网络
```

客户端以路由 metric 600 使用 DHCP，所以有线仍是默认路由。`mica wifi add <ssid> --open` 添加没有密钥的网络，
`--hidden` 添加不广播名称的网络，`mica wifi remove <ssid>` 忘记它。在控制台中：网络 → Wi-Fi → 客户端。已知的网络
再次添加会以 `ssid_exists` 拒绝；改为编辑它。

### 作为接入点

接入点在控制台（网络 → Wi-Fi → 接入点）或用 `PUT /api/v1/wifi/ap` 配置：

```json
{"mode": "always", "interface": "wlan0", "channel": 6, "countryCode": "GR",
 "address": "192.168.4.1/24", "holdDownSeconds": 30, "graceSeconds": 60,
 "security": "wpa2-psk", "psk": "a long passphrase"}
```

`mode` 为 `off`、`provisioning`（只在没有可用上行时开启，在 `holdDownSeconds` 之后，上行恢复 `graceSeconds` 之后关闭）
或 `always`。`security` 为 `wpa2-psk`、`wpa2-wpa3` 或 `open`。不带 `psk` 时设备保留已有的密钥，新设备上就是标签上的
那个；设置你自己的密钥，因为标签上的密钥不是秘密（[首次启动](../start/first-run.md)第 2 节）。改变国家代码会以
`wifi_country_unconfirmed` 拒绝，直到带 `countryConfirmed: true` 重新发送；蓝牙配置占用无线电期间的写入以
`wifi_locked` 拒绝，直到其窗口关闭。

**检查是否生效：**手机能看到这个网络；`GET /api/v1/wifi` 说明哪个角色占用无线电。

> status: board-dependent — evidence: `mica-core:crates/micad/src/reconciler/wifi_client.rs`, `mica-core:crates/mica-apid/openapi.json`, `docs/reference/wifi.md`

## 8. DNS

默认情况下，设备询问其接口获得的服务器。**没有后备 DNS**：路由器不下发 DNS 服务器的站点，在你设置之前什么也
解析不了。

- **全局服务器**在开启时替换每个接口自己的服务器：一到三个 IPv4 服务器。

  ```sh
  curl -s -H "$AUTH" -X PUT $DEV/api/v1/dns/global \
    -H 'content-type: application/json' -d '{"enabled": true, "servers": ["9.9.9.9", "1.1.1.1"]}'
  ```

  回环地址或设备自己的地址会以 `dns_server_invalid` 拒绝。
- **静态记录**让一个名称在设备上可解析，最多 100 条：

  ```sh
  curl -s -H "$AUTH" -X POST $DEV/api/v1/dns/static-records \
    -H 'content-type: application/json' -d '{"hostname": "plc.local.lan", "address": "10.10.0.20"}'
  ```

  已记录的名称是 `record_duplicate`，第 101 条是 `record_limit`。

**检查是否生效：**`GET /api/v1/dns` 显示设备用什么解析；`POST /api/v1/dns/test` 直接向每个服务器查询一条 `A`
记录。在控制台中：网络 → DNS。

> status: shipped — evidence: `mica-core:docs/mica-core.md`, `mica-core:crates/mica-apid/openapi.json`

## 9. WireGuard，端到端

从设备到一个对端（服务器或你的笔记本）的隧道，在 systemd 和 OpenRC 上都一样。设备的私钥在设备上生成，从不离开
设备，也不进入设置。

1. **选取空闲的值。**`GET /api/v1/network/wireguard/defaults` 给出第一个空闲的名称（`wg0`）、子网（从
   `10.2.0.1/24` 起）和监听端口（从 51821 起），以及服务占用的 UDP 端口。
2. **声明隧道**，带静态地址（隧道不使用 DHCP），如果对端会连接到设备，再带上监听端口：

   ```sh
   curl -s -H "$AUTH" -X PUT $DEV/api/v1/network/wg0 -H 'content-type: application/json' \
     -d '{"kind":"wireguard","static":{"address":"10.2.0.1/24"},"wireguard":{"listenPort":51821,"peers":[]}}'
   ```

3. **任务应用后读取设备的公钥：**

   ```sh
   curl -s -H "$AUTH" $DEV/api/v1/state/network
   # {"wg0": {"publicKey": "<device public key>"}, ...}
   ```

   控制台的 WireGuard 页显示它，并给出一段可粘贴到对端配置中的 `[Peer]` 块。
4. **添加对端**：它的公钥、路由到它的前缀，以及由设备发起连接时它的端点（NAT 后面的对端还需要保活）：

   ```sh
   curl -s -H "$AUTH" -X POST $DEV/api/v1/network/wg0/peers -H 'content-type: application/json' \
     -d '{"name":"office","publicKey":"<peer public key>","allowedIps":["10.2.0.2/32","192.168.50.0/24"],
          "endpoint":"vpn.example.net:51820","persistentKeepalive":25}'
   ```

   每个允许的前缀都成为一条经过隧道的路由。应答（201）是列表中读到的该对端。同一公钥的第二个对端是
   `peer_exists`。
5. **配置对端**：设备的公钥，如果对端发起连接则加上设备的端点（`<device address>:51821`），以及
   `AllowedIPs = 10.2.0.1/32` 再加上设备后面的网络。
6. **检查握手：**

   ```sh
   curl -s -H "$AUTH" $DEV/api/v1/network/wg0/peers
   # [{"publicKey": "...", "latestHandshake": 1763200000, "rxBytes": 1240, "txBytes": 980,
   #   "routesReady": true, "unroutedIps": [], "operationalState": "ready", ...}]
   ```

   `latestHandshake`（Unix 秒）较新且 `rxBytes` 在增长，说明隧道在承载流量；从设备上 `ping 10.2.0.2` 可以证明。

**编辑和删除。**`PUT /api/v1/network/wg0/peers/<public key>` 就地编辑一个对端，`DELETE` 删除它（含 `/` 的公钥在
路径中要百分号编码）；带上列表的版本（其 `ETag`），这样期间被修改的对端会以 409 `version_conflict` 拒绝而不是被
覆盖。`POST /api/v1/actions/wireguard/wg0/rotate-key` 生成新的私钥并返回新的公钥：每个对端都必须拿到它才能再次
连接。预共享密钥读回时是 `<redacted>`。

**可能出的问题：**

| 现象或代码 | 含义 | 处理 |
|---|---|---|
| `latestHandshake` 为 null | 还没有握手 | 检查双方公钥、端点，以及 UDP 能否到达监听的一方 |
| `operationalState` 为 `pending_endpoint_resolution` | 端点的名称还解析不了 | 修好 DNS（第 8 节）；micad 在 5、15、30 和 60 秒时重试，之后每 60 秒一次 |
| `endpoint_route_loop` | 端点位于路由进隧道的前缀内 | 缩小 `allowedIps` |
| `unroutedIps` 不为空 | 某个允许的前缀没有经过隧道发送 | 有另一条路由覆盖了它；见 `wireguard_*` 代码 |
| `port_in_use` | 监听端口属于另一个隧道或某个服务 | 用 `defaults` 建议的端口 |
| `wireguard_default_route_unsupported`、`wireguard_prefix_invalid`、`wireguard_peer_prefix_conflict`、`wireguard_route_conflict` | 对端路由规则（422 `settings_rejected`，代码在消息开头） | [错误](../reference/errors.md) |

> status: shipped — evidence: `mica-core:docs/mica-core.md`, `mica-core:crates/mica-apid/openapi.json`, `mica-core:crates/mica-apid/ui/src/features/network/wireguard-tab.tsx`

## 10. 错误一览

| 代码 | HTTP | 含义 |
|---|---|---|
| `busy` | 409 | 有网络任务还在应用 |
| `version_conflict` | 409 | 映射或对端列表在你指定的版本之后改变了 |
| `name_invalid` | 422 | 不是接口名称 |
| `address_overlap`、`gateway_out_of_subnet`、`gateway_not_allowed`、`metric_duplicate`、`route_metric_reserved` | 422 | 地址和路由规则（第 2–5 节） |
| `probe_not_allowed`、`probe_*` | 422 | 连通性检查（第 5 节） |
| `vlan_*`、`bridge_port_*` | 422 | 第 6 节 |
| `port_in_use`、`peer_exists`、`wireguard_*` | 409 / 422 | 第 9 节 |
| `settings_rejected` | 422 | micad 拒绝了写入；消息引用了规则 |

完整列表见[错误](../reference/errors.md)；设置见[设置](../reference/settings.md)；CAN 接口见板卡页面
（[cx3576](../hardware/cx3576.md)）。
