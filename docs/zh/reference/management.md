# 管理平面：micad

一个守护进程 `micad` 拥有设备的配置并把它变成运行中的服务；一个 API 服务器 `mica-apid` 把它暴露给
运维者并提供 Web 控制台。两者都作为 core 组件放在设备的 core 集合里，所以新的管理平面无需新的根就能
到达设备。本页说明 micad 做什么、按什么顺序、用哪些文件；它持有的设置见[设置树](settings.md)，它前面的
API 见 [API](api.md)。设计、总线接口和每一条路径见 `mica-core:docs/mica-core.md` 第 3 节。

## 固定不变的部分

- **配置只有一个所有者。** 每次读取和修改都经过 micad。API 自己不持有配置，其他服务也不写系统配置。
- **设置是一棵有类型的树**，用点路径寻址，例如 `network.eth0.dhcp`。一次写入对照整棵树校验、记入
  日志并作为任务应用；未知的键或模式版本会被拒绝，从不转换。
- **集成方设置的内容放在 DATA 上**，每个关注点一份 JSON 文档，位于 `/mica/config/`
  （[配置](../operate/configuration.md)）。设备为自己生成的东西（标识、凭据、配置状态）放在它自己的状态
  存储中。配置重置清除前者、保留后者（[恢复](../operate/recovery.md)）。
- **每个关注点一个调和器**，把系统收敛到其子树并报告实际应用的状态：主机名、网络、WireGuard、SSH、
  Wi-Fi 客户端和接入点、容器、用户服务、MQTT、时间、日志、Web 监听、局域网发现（mDNS、SSDP）、
  云管理员、蓝牙。
- **产品决定有什么。** 签名根中的 `/usr/lib/mica/product.conf` 指明产品、其特性和 init。产品不带的特性
  没有调和器、没有总线成员、没有 API 路由；其路由返回 404。
- **两种 init 都支持。** 产品运行 systemd 或 OpenRC，在组合根时选定；micad 通过各自的方式驱动同样的
  服务。在 OpenRC 上，网络调和器拒绝 VLAN 和网桥接口。
- **介质缺失时失败关闭。** 存放 `/mica/config` 的 DATA 介质不在时 micad 拒绝启动：读不到自己配置的
  设备不得渲染出另一份配置。
- **可选。** 不带 `micad` 特性的产品不组合守护进程；其根照样启动、运行和更新。所以 micad 驱动的每个
  服务都由 Base 负责启动：它在启动时读取 DATA 上的一个文件，该文件由 micad 写入，micad 重启或停止
  服务，但从不启用或禁用它。

## 启动，一步一步

守护进程以 `micad daemon` 运行（两种 init 的 unit 都这样运行它）；单独的 `micad` 打印用法并以 2 退出。
依次：

1. `--version` 在读取任何东西之前回答。
2. micad 连接系统总线并独占 `com.mica.micad`，不排队、不允许替换。第二个 micad 打印
   `micad is already running` 并以 1 退出，什么也没读、什么也没写。
3. 加载设置。存放 `/mica/config` 的 DATA 介质不在时 micad 停在这里。
4. 应用已暂存的重置和启动恢复意图；导入已暂存的配置文档；首次启动配置生成标识和凭据。
5. 读取产品文件，构建调和器。
6. 只渲染文件和发起总线调用的调和器（主机名、网络、web）应用一次。
7. 提供总线接口，micad 报告就绪（`READY=1`）。
8. 启动或重启其他服务的调和器（sshd、Wi-Fi 客户端和接入点、容器、MQTT、时间、蓝牙）以及 mDNS 和
   SSDP 应答器被应用；有失败的，每 10 秒重试一次，最多五分钟。

所以 micad 的就绪不等待任何其他服务。容器调和器等待 `mica-containerd`；在 OpenRC 上
`rc-service start` 等待服务及其依赖。

| 变量 | 默认值 | 含义 |
|---|---|---|
| `MICAD_SETTINGS_PATH` | `/var/lib/mica/settings.toml` | STATE 文档（标识、凭据、认领） |
| `MICAD_CONFIG_DIR` | `/mica/config` | DATA 上的配置文档 |
| `MICAD_BUS` | `system` | `system` 或 `session` |
| `MICAD_SHADOW_PATH` | `/etc/shadow` | 临时 root 密码写到哪里 |
| `MICAD_META_MANIFEST_PATH` | `/usr/share/mica/meta/updates/manifest.json` | 内置的更新配置 |
| `MICAD_UPDATE_POLICY_PATH` | `/mica/config/updates.json` | 运维者的[更新策略](updates.md#策略文档) |
| `MICAD_PROVISIONING_ROOT` | `/run/mica/provisioning` | 离线配置介质暂存在哪里 |
| `MICAD_DEFAULTS_DIR` | `/usr/share/mica/defaults` | 板卡的默认设置 |
| `MICAD_DRY_RUN` | 未设置 | `1`：不做配置、不运行调和器、不访问主机（测试用） |

## 产品文件

`/usr/lib/mica/product.conf` 在组合根时写入，并随根一起被认证。micad 读取这些行：

| 行 | 取值 | 作用 |
|---|---|---|
| `PRODUCT` | 产品名 | 部署必须是为它构建的 |
| `FEATURES` | 若干词 | `wifi`、`bluetooth`、`ssh`、`containers`、`mqtt` 决定存在哪些调和器、总线成员和 API 路由；对缺失特性的子树写入会被拒绝（`feature not in this product`），其路由返回 404。没有文件或没有这一行则提供全部特性。同样的词在启动时选择 core 组件（`micad`、`ui`） |
| `INIT` | `systemd`（默认）、`openrc` | 用哪个后端驱动服务；其他值让 micad 停止 |
| `CONTAINER_ENGINE` | `podman`（默认）、`docker` | 容器后端；其他值让 micad 停止 |
| `DOCS_URL`、`DOCS_URL_EN` | `https://…/`，最多 512 个字符 | 控制台帮助页的链接（其下的 `operate/troubleshooting/`、`operate/recovery/`、`operate/updates/`）；`GET /api/v1/meta` 以 `docsUrl`、`docsUrlEn` 报告 |
| `CLAIM_DEVICE_CODE` | `required`、`off` | 控制台认领时是否要求设备码；只有 `off` 会关闭 |
| `MDNS`、`SSDP` | `on`（默认）、`off` | `access.mdns.enabled` / `access.ssdp.enabled` 未设置时是否在局域网上通告 |
| `CLOUD_ADMINS` | `on`、`off`（默认） | `access.cloudAdmins.enabled` 未设置时，云平台的 SSH 用户是否为管理员 |
| `SSH_SERVER` | `dropbear`（默认）、`openssh` | Base 的选择；micad 不读它 |
| `SSH` | `on`、`off` | 首次启动时 SSH 是否开启；缺省为关 |

## 调和器

每个调和器拥有一棵子树，把系统收敛到它，并把实际应用的状态以自己的名字放回实时状态树。各自写什么：

| 调和器 | systemd | OpenRC |
|---|---|---|
| `hostname` | `/etc/hostname`、hostnamed | `/etc/hostname`、`sethostname(2)` |
| `network` | `/run/systemd/network` 下的 networkd `50-mica-*` `.network`/`.netdev`（链接到 DATA 上的 `/var/lib/mica/network/networkd`） | 供 busybox ifupdown 用的 `/var/lib/mica/network/interfaces`；WireGuard 经 netlink；拒绝 VLAN 和网桥 |
| `dns` | `/run/mica/hosts`（`/etc/hosts` 链接到这里）、`/run/systemd/resolved.conf.d/60-mica-dns.conf` | 同样的 hosts 文件；`/var/lib/mica/dns/resolv.global` |
| `sshd` | `/var/lib/mica/ssh/sshd.env`、`root` 和 `mica` 的 authorized keys、`mica-sshd.service` | 相同，`mica-sshd` |
| `wifi_client` | `/etc/wpa_supplicant`、`wpa_supplicant@<if>`、networkd DHCP | `/var/lib/mica/wpa_supplicant`、`/var/lib/mica/wifi/client.env`、`mica-wifi-client` |
| `wifi_ap` | `/etc/hostapd`、`hostapd@<if>`、networkd 地址与 DHCP 服务器 | `/var/lib/mica/hostapd`、`/var/lib/mica/wifi/ap.env`、busybox udhcpd、`mica-wifi-ap` |
| `container` | 启动 `mica-containerd.service`，把项目作为一个集合交给它 | 相同，`mica-containerd` |
| `mqtt` | `/var/lib/mica/mqtt/broker.toml`、`mqttd-device.env`、`mica-mqtt-broker.service`、`mica-mqttd.service` | 同样的文件和服务 |
| `time` | `/var/lib/mica/time/timesyncd.conf`、`/run/mica/timezone` | `/var/lib/mica/time/ntpd.conf`、`mica-ntpd` |
| `logging` | `/var/lib/mica/log/log.env`，经 Base 的 `mica-log-env` 检查，`mica-log-settings.service` | 相同，`mica-syslogd` |
| `web` | `/run/mica/apid.json`；`network`/`local` 时启动 `apid.service`，`off` 时停止 | 相同，`apid` |
| `mdns`、`ssdp` | micad 自己的应答器 | 相同 |
| `services` | 经 `mica-unit` 把用户的 unit 放进 `/usr/local/lib/systemd/system` | 脚本放在 `/usr/local/etc` |
| `bluetooth` | `bluetooth.service`、适配器的电源和名称、每个已声明设备的信任 | 经 `mica-bluetoothd` 做同样的事 |

Wi-Fi、容器和 MQTT 调和器启用的服务还会记在 DATA 上的 `/var/lib/mica/units/enabled` 中，每行一个；
Base 的 `mica-units` 在启动时启动其中列出的每个 unit，不论有没有 micad，所以即使根是只读的，它们也会
按上次的配置回来。

**网络应用。** 一次网络写入整体替换 `50-mica-*` unit 并重新加载 networkd。然后对每个 unit 有变化的
接口最多等待 30 秒（已配置，或 `routable`、`degraded`、`enslaved`；没有载波的链路不等）。有接口失败或
超时时，之前的 unit 放回去，任务失败并指明接口，存储的网络映射回到上次应用的那份。所以一个错误的地址
不会让设备失联。micad 渲染的每条 DHCP 链路还会有链路本地回退地址（`169.254.0.0/16`）、路由度量
（按名称顺序第一条 100，之后 110、120……；Wi-Fi 客户端的租约 600）以及租约给的 MTU。映射里没有声明的
有线 `eth*` 端口通过 `60-mica-auto-<iface>.network` 获得 DHCP。

**Wi-Fi 角色。** 站点和接入点共用一个射频，轮流使用。站点默认开启且没有网络，所以选网络之前就能扫描。
接入点若在站点的接口上，会报告 `conflict` 并且不启动。

## 总线接口

总线名 `com.mica.micad`，对象 `/com/mica/micad`，接口 `com.mica.micad1`；值是 JSON 字符串。总线策略
使它在两个方向上都只对 root 开放，因为 `SettingsChanged` 携带设置值。被设置树拒绝的值是
`org.freedesktop.DBus.Error.InvalidArgs`。

| 分组 | 成员 |
|---|---|
| 设置与状态 | `GetSettings`、`SetSettings`、`SetSettingsMany`、`GetTask`、`GetState`、`ReportHealth`、`ForgetService`；信号 `SettingsChanged`、`TaskChanged` |
| 观测 | `GetNetworkState`、`GetObservedNetwork`、`GetTimeStatus`、`GetStorageStatus`、`GetStorageMedia`、`GetSystemInfo`、`GetDeviceCode`、`GetTelemetry`、`GetFailureEvidence`、`GetLog`、`GetLogOfBoot`、`GetContainers`、`GetContainerLog`、`ScanWifi`、`TestDnsServers`、`GetDnsProbe`、`ProbeDns`、`GetBluetooth` |
| 操作 | `Reboot`、`PowerOff`、`SetTransientRootPassword`、`RotateWireguardKey`、`UnmountMedia`、`EjectMedia`、`FactoryReset`、`GetFactoryReset` |
| 认领与 BLE 配置 | `Claim`、`AdminPasswordSet`、`AdminLoggedIn`、`GetBleProvisioning`、`OpenBleProvisioning`、`CloseBleProvisioning` |
| 更新 | `GetUpdateState`、`CheckUpdate`、`FetchUpdate`、`ImportUpdate`、`InstallUpdate`、`InstallLatestUpdate`、`ConfirmDeployment`、`RejectDeployment`、`RollbackDeployment`、`SetRebootOverride`、`SetUpdateConfig` |
| 用户服务 | `GetUnits`、`StartUnit`、`StopUnit`、`RestartUnit`、`GetUnitLog` |
| owner 证书与驱动扩展 | `GetOwnerCerts`、`AddOwnerCert`、`RemoveOwnerCert`、`GetExtensions`、`InstallExtension`、`InstallExtensionFiles`、`RemoveExtension`、`DropExtension` |
| 容器与蓝牙 | `CheckContainerProject`、`CheckContainerProjectIn`、`StartContainer`、`StopContainer`、`RestartContainer`、`SetBluetoothDiscovery`、`OpenBluetoothPairWindow`、`CloseBluetoothPairWindow`、`PairBluetoothDevice`、`ConfirmBluetoothPairing`、`SetBluetoothDeviceFlag`、`RemoveBluetoothDevice` |

具名错误：`com.mica.micad1.Error.AlreadyClaimed`（第二次认领）、`WifiLocked`（BLE 配置占用射频时对
`wifi` 的写入；apid 返回 423 `wifi_locked`）、`FactoryResetRefused` 和 `DriversRefused`（描述均为 JSON
`{code, message}`）。

应用用 `ReportHealth(component, status, why)` 报告健康状态；`blocking` 状态会关闭更新的重启闸门，直到
它被清除（[更新](updates.md#策略文档)）。其他 `com.mica.*` 服务在总线上出现和消失时被记录。

## 写入就是任务

`SetSettings` 对照整棵树校验写入，记入经 fsync 的撤销日志，保存文档并返回任务 id；`TaskChanged` 报告
任务进度。任务的 `kind` 在涉及网络时为 `network.apply`，否则为 `settings.apply`；其 `phase` 依次为
`saved`、`applying`、`applied`。完成的网络应用会列出它添加、修改或删除的 `interfaces`。失败的应用会写明
原因，网络映射按上文回滚。

## 观测

每个观测器在拿不到数据时都报告缺失及原因，而不是给出看似健康的值：

| 读数 | 来源 |
|---|---|
| 网络 | networkd `Describe`、wpa_supplicant 和 hostapd 套接字、resolved；OpenRC 上为 sysfs、busybox `ip`、`/run/mica/resolv.d`。`ip route get 1.1.1.1` 会走的那条 IPv4 默认路由被标为 `effective` |
| 域名解析 | 每 60 秒以及按需在 3 秒内不经缓存查询 `0.debian.pool.ntp.org`：`{ok, name, latencyMs, checkedAt, detail?}` |
| 时间 | timesyncd；OpenRC 上为 `mica-ntpd` 是否运行和内核的已同步位 |
| 存储 | 来自签名启动策略的层级、绑定、用量、DATA 的项目配额、介质健康、用户挂载和 swap（[存储](storage.md)） |
| 系统与遥测 | 标识、板卡、内核、镜像、软件包、运行中的部署；温区、看门狗、复位原因 |
| 故障证据 | 本次和上次启动的失败服务与警告 |
| 日志 | `micad`、`apid`、`time`、`ssh`、`wifi-client`、`wifi-ap`、`bluetooth`、`mqtt-broker` 或 `mqttd` 本次或上次启动最新的 200 行；日志只在内存中时返回 `available: false` 及原因 |

密码、预共享密钥、WireGuard 密钥、令牌、配对码和设备码从不写入日志；被拒文档中引用的值替换为 `"…"`。

## 生命周期

- **配置。** 首次启动在设备上生成标识和每台设备自己的凭据；镜像里不烘入任何秘密。启动介质或可移动
  介质上的配置文档被整体校验、原子应用并记录，所以应用两次不会有额外效果（[量产](../../reference/manufacturing.md)）。
- **板卡默认值。** 板卡可以提供 `/usr/share/mica/defaults/network.json`。STATE 的 `seeded-defaults.json`
  中尚未记录的条目会被添加一次（cx3576 提供 `can0`：250 000 bit/s、`restartMs` 100、`fd` false）；运维者
  删除的条目保持删除，`configuration` 重置会让默认值回来。
- **更新。** micad 以有界的时间和输出运行 `mica-deploy`，一次一个更新，并加上运维者的策略
  （[更新](updates.md)）。
- **电源。** 重启和关机在执行前连同调用方一起记录。
- **重置。** 已暂存的重置只应用一个层级，`configuration` 或 `application-data`，从不打开 `/srv`，也不
  跨进挂载；出厂重置会重建 DATA（[恢复](../operate/recovery.md)）。
- **owner 证书与驱动扩展。** 每次变更都再次要求管理员密码，作为 `drivers.apply` 类任务运行，下次启动
  生效（[安全概览](../security/overview.md)）。

### 出厂重置的拒绝

| 代码 | 何时 |
|---|---|
| `factory_reset_unsupported` | 启动的 runkit 不执行重置 |
| `data_encrypted` | DATA 已加密 |
| `not_claimed` | 设备还没有管理员 |
| `update_in_progress` | 更新正在安装、持有事务锁或在等待重启 |
| `trial_pending` | 有部署或集合在试运行 |
| `password_required` | 非 uid 0 的调用方给了空密码 |
| `password_incorrect` | 密码错误 |
| `login_throttled` | 连错 3 次后，每次错误把等待时间从 5 秒加倍到最多 300 秒（与驱动变更共用一个计数器） |

## 在 OpenRC 上：micad 交给 Base 的文件

| 服务 | 由谁提供 | micad 写入 |
|---|---|---|
| `mica-sshd` | mica-ssh（dropbear）或 mica-openssh | `/var/lib/mica/ssh/sshd.env` |
| `mica-wifi-client` | mica-wifi | `/var/lib/mica/wifi/client.env`（`interface`、`config`、`metric`） |
| `mica-wifi-ap` | mica-wifi-ap | `/var/lib/mica/wifi/ap.env`、`/var/lib/mica/wifi/ap-udhcpd.conf` |
| `mica-ntpd` | mica-openrc | `/var/lib/mica/time/ntpd.conf`（`ntp_servers`） |
| `mica-network` | mica-openrc | `/var/lib/mica/network/interfaces` |
| `mica-syslogd` | mica-openrc | `/var/lib/mica/log/log.env` |
| `mica-bluetoothd`、`docker` | mica-bluetooth、mica-docker | 无 |

SSH 环境文件在两种 init 上相同，是四行可被 shell 读取的内容：

```
SSH_ENABLED=yes
SSH_LISTEN="22"
SSH_PASSWORD=no
SSH_ROOT_LOGIN=yes
```

`SSH_ENABLED` 在启动时由 init 读取，所以 SSH 不等 micad 就按上次的配置启动。`SSH_LISTEN` 是一个端口
（监听所有地址），或每个监听地址一个 `addr:port`，IPv6 加方括号。只有在开启密码登录且临时 root 密码
有效时，`SSH_PASSWORD` 才是 `yes`。

## 登录提示

micad 写 `/run/mica/device-code.issue`，Base 把它链接进 `/etc/issue.d/`，所以串口控制台和每个本地登录
提示都会显示：

```
Device code: XXXX-XXXX-XXX
Console: http://192.168.1.50:8080/
Console: http://mica.local:8080/
```

每个 IPv4 地址（包括链路本地地址）一行 `Console:`，再加一行 `<hostname>.local`，按 `access.web` 提供
控制台的方式。地址每 5 秒重读一次，所以新租约在此时间内出现在提示里。`random` 设备码不显示；那一行
会说明登录后如何读取。

## 检查 micad

| 检查 | 预期 |
|---|---|
| `systemctl status micad`（OpenRC：`rc-service micad status`） | 运行中；启动失败时日志中写明原因 |
| `micad --version` | core 组件的版本 |
| 通过 API `GET /api/v1/health` | micad 可达 |
| `cat /run/mica/apid.json` | micad 依 `access.web` 渲染的 Web 监听 |
| `ls /mica/config/` | 已写入的文档（`system.json`、`network.json`、……、`updates.json`） |

micad 不启动时先读它的日志：DATA 介质缺失、产品文件中未知的 `INIT` 或 `CONTAINER_ENGINE`、或第二个
实例，都会让它以具名原因停止（[排障](../operate/troubleshooting.md)）。

## 边界在哪里

| 边界 | 契约 |
|---|---|
| 运维者与自动化 | HTTP API 和控制台：[API](api.md)、[控制台](../../integrate/console.md) |
| Shell 访问 | [访问](../../reference/access.md) |
| 设置 | [设置树](settings.md) |
| 更新 | micad 驱动部署客户端并加上运维者的策略：[更新](updates.md) |
| 应用 | 设置树中声明的容器、用户服务和原生软件包：[容器](../../integrate/containers.md)、[原生应用](../../integrate/native-applications.md) |
| 应用数据 | 本地总线和 MQTT 只承载应用数据，从不承载配置或凭据：[总线](../../integrate/bus.md) |
| 首次启动 | 标识和凭据在设备上生成：[配置](../../integrate/provisioning.md) |
