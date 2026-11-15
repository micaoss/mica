# 网络

如何让设备接入你现有的网络：有线 DHCP 或静态地址、不作为互联网出口的端口、额外路由、两条上行、VLAN 和网桥、
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

## 5. 两条上行

当多个接口都能承载默认路由时，由路由 metric 决定，最低者胜出。

| 默认路由来自 | Metric |
|---|---|
| 静态网关 | 0（不带 metric 的路由的内核默认值） |
| 按名称顺序的第一个 DHCP 端口 | 100 |
| 之后的每个 DHCP 端口 | 110、120…… |
| Wi-Fi 客户端 | 600 |

所以有线优先于 Wi-Fi，静态网关优先于任何租约。两条 metric 相同的默认路由会被拒绝（`metric_duplicate`）。

**目前的故障切换只针对链路和租约丢失。**端口失去载波或租约时，它的默认路由消失，由下一条承载流量；它恢复时
再次接管。链路正常却无法访问互联网（网线正常、后面的调制解调器没有信号）时，它的路由保留：还没有可达性探测。
把你信任的上行放在前面，或在需要之前让另一条保持关闭。

**检查是否生效：**`mica network show <port>` 为每个承载默认路由的端口打印 `gateway:` 行；设备上的 `ip route`
显示每条路由及其 `metric`。

> status: shipped — evidence: `mica-core:crates/micad/src/reconciler/network/render.rs`, `mica-core:crates/micad/src/reconciler/wifi_client.rs`

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
| `address_overlap`、`gateway_out_of_subnet`、`gateway_not_allowed`、`metric_duplicate` | 422 | 地址和路由规则（第 2–5 节） |
| `vlan_*`、`bridge_port_*` | 422 | 第 6 节 |
| `port_in_use`、`peer_exists`、`wireguard_*` | 409 / 422 | 第 9 节 |
| `settings_rejected` | 422 | micad 拒绝了写入；消息引用了规则 |

完整列表见[错误](../reference/errors.md)；设置见[设置](../reference/settings.md)；CAN 接口见板卡页面
（[cx3576](../hardware/cx3576.md)）。
