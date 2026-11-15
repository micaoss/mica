# 在局域网中查找设备：mDNS 与 SSDP

设备在本地网络上通告什么，如何从电脑上找到它，如何关闭各项通告，以及如何通告你自己的服务。契约见
`mica-core:docs/mica-core.md` 第 3.12 和 3.13 节；规则见[访问](../reference/access.md)第 4.1 节。

## 开始之前

- **两者默认都打开**，除 `uefi-x64.gcp` 外的每个发布产品都是如此，`uefi-x64.gcp` 什么也不通告。两者都由 micad 自己
  应答，两种 init 都一样。
- **只在本地网络上应答：**每个有地址的接口，包括接入点的接口，但从不包括回环、容器链路、WireGuard 或 CAN，而且只应答
  来自查询到达接口所在子网的查询。不会把一个接口上的内容转发到另一个接口。
- `mica mdns` 和 `mica ssdp` 需要设备上的 root，或带令牌的 API。

> status: shipped — evidence: `mica-core:docs/mica-core.md`, `mica-build:boards/uefi-x64/products/gcp/product.env`

## 1. 通告的内容

**mDNS**（Bonjour、Avahi）：

| 记录 | 内容 |
|---|---|
| `<hostname>.local` | 设备在被查询接口上的地址（A 和 AAAA） |
| `_mica._tcp`，实例名 `<hostname>` | 控制台的端口；TXT `txtvers=1`、`product=<product>`、`hostname=<hostname>` |
| `_http._tcp` 或 `_https._tcp`，实例名 `<hostname>` | 控制台，在它面向网络服务时；TXT `path=/` |

**SSDP**（UPnP，Windows 的网络视图以及许多 NAS 和媒体工具使用）：一个类型为 `urn:micaos:device:mica:1` 的根设备，其
描述在 `http://<address>:8080/ssdp/device.xml`，以主机名为 friendly name、以产品为 model，以控制台为展示页面。

从不通告：SSH、软件版本、设备是否已认领、设备码、任何密钥。SSDP 描述中的序列号和 UDN 是派生值，既不是 machine id
也不是设备码。

> status: shipped — evidence: `mica-core:docs/mica-core.md`

## 2. 从电脑上找到设备

默认主机名是 `mica-` 加八位十六进制数字，例如 `mica-a4e2e69e`。

```sh
# Linux（Avahi）
avahi-browse -rt _mica._tcp
# macOS，或装有 Bonjour 的 Windows
dns-sd -B _mica._tcp
# 任何能解析 .local 的系统
ping mica-a4e2e69e.local
```

`avahi-browse` 列出每台设备的地址、端口和 TXT 记录，其中 `product=` 指出产品。然后打开
`http://mica-a4e2e69e.local:8080`。

在 Windows 上，设备还会出现在文件资源管理器的“网络”视图中（SSDP）；打开它就打开控制台。

在手机上，Android 应用列出通告 `_mica._tcp` 的设备（[Mica 应用](../start/mica-app.md)第 3 节）。

**检查是否生效**，在同一网络的 Linux 工作站上：

```sh
avahi-resolve -n mica-a4e2e69e.local
curl -s http://mica-a4e2e69e.local:8080/ssdp/device.xml | grep -E 'friendlyName|modelName'
```

> status: shipped — evidence: `mica-core:docs/mica-core.md`, `mica-app:lib/console/discovery.dart`

## 3. 查看和开关通告

```sh
mica mdns status
# enabled: true (product)
# hostname: ...
# published: <n> of <n>
mica mdns list
# mica-a4e2e69e._mica._tcp port 8080 built-in published
# ...
mica ssdp status
# enabled: true (product)
# active: true
# ...
```

`(product)` 表示由产品的默认值决定；你改过开关之后显示 `(setting)`。

| 目的 | 做法 |
|---|---|
| 停止 mDNS | `mica mdns off`（完全没有套接字；你的服务会保留，但不发布） |
| 停止 SSDP | `mica ssdp off` |
| 重新打开 | `mica mdns on`、`mica ssdp on` |

对应的开关是 `access.mdns.enabled` 和 `access.ssdp.enabled`（`PUT /api/v1/settings/<path>`），显示在控制台的概览页。
API 不面向网络服务时（`mica web local` 或 `off`），SSDP 也会停止。`GET /api/v1/mdns` 和 `GET /api/v1/ssdp` 回答当前
通告的内容。

> status: shipped — evidence: `mica-core:crates/micad/src/mdns_cli.rs`, `mica-core:crates/micad/src/ssdp_cli.rs`

## 4. 通告你自己的服务

例如 3000 端口上的 Grafana，直到下次重启：

```sh
mica mdns add grafana --type _http._tcp --port 3000 --instance Grafana --txt path=/dashboards
# /run/mica/mdns.d/grafana.json is published until reboot
mica mdns list
# Grafana._http._tcp port 3000 runtime:grafana published
avahi-browse -rt _http._tcp          # 在工作站上
mica mdns remove grafana
# /run/mica/mdns.d/grafana.json is removed
```

`mica mdns add` 写出 `/run/mica/mdns.d/<name>.json`，micad 在一秒内应用它。`/run` 中的文件在重启后消失，所以要在每次
启动时通告，让你的服务或容器在启动时写出同样的文件：

```json
{"version": 1, "services": [
  {"instance": "Grafana", "type": "_http._tcp", "port": 3000, "txt": {"path": "/dashboards"}}
]}
```

它必须是 root 的普通文件，且只有 root 可写。产品镜像可以在 `/usr/share/mica/mdns.d/` 中带同样的文件。

规则：文件名为 1 到 32 个 `a-z`、`0-9`、`-`；每个文件最多 8 个服务，总共最多发布 64 个；`type` 是 `_<name>._tcp` 或
`_<name>._udp`，不能是 `_mica._tcp`；`instance`（缺省为主机名）最多 63 字节且不含点；`port` 为 1 到 65535；`txt` 最多
16 个键。违反规则的文件整体被拒绝，并在 `mica mdns list` 中以 `refused` 列出；其他文件不受影响。

> status: shipped — evidence: `mica-core:docs/mica-core.md`, `mica-core:crates/micad/src/mdns_cli.rs`

## 5. 可能出现的问题

| 你看到 | 原因 | 解决 |
|---|---|---|
| `.local` 无法解析 | mDNS 已关闭、电脑在另一个子网或 VLAN 上，或客户端不支持 mDNS | `mica mdns status`；处于同一网络；Windows 上用地址或安装 Bonjour |
| 不在 Windows 的“网络”视图中 | SSDP 已关闭，或 API 不面向网络 | `mica ssdp status` 显示 `reason` |
| `mica mdns list` 中出现 `refused runtime:<name>: ...` | 文件违反了规则，或其服务名已被占用 | 读原因，修正文件 |
| 你的服务显示 `not-published` | mDNS 已关闭，或已达 64 个服务上限 | `mica mdns on`；去掉一个服务 |
| 路由器后面的设备找不到 | mDNS 和 SSDP 按设计从不跨越路由器 | 使用它的地址 |
| `uefi-x64.gcp` 上什么都没有 | 该产品不通告任何东西 | 用 Compute Engine 中的地址（[云](cloud.md)） |

> status: shipped — evidence: `mica-core:docs/mica-core.md`
