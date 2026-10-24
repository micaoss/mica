# 配置

Mica OS 的配置是一棵单一的类型化设置树，由管理守护进程（`micad`）拥有，以 JSON
文档的形式存放在数据分区的 `/mica/config/` 下，并由驱动底层系统服务的协调器
（reconciler）应用。每一种
受支持的配置方式都使用类型化 schema：在线修改通过认证 API，离线文件在启动时校验。本页覆盖模型、通道、今天可配置什么，以及——在一个不可变
系统上同样重要的——什么不可配置。

## 1. 模型：三层

配置设计（其记录是 [../../integrate/provisioning.md](../../integrate/provisioning.md)）
把配置组织为三层：

1. **第 1 层——首次启动自我配置。**从空的 DATA/state 出发，设备离线、恰好一次地
   播种身份、主机名、密钥和默认值。已发布；见 [../start/first-run.md](../start/first-run.md)。
2. **第 2 层——本地配置通道。**认证 API 与内置 UI 支持在线修改；
   启动介质或可移动介质上的配置文档可离线配置尚未认领的设备。集成商也可在
   设备停止运行时准备规定的 `/mica/config/` 文件，启动时先校验再应用。
3. **第 3 层——构建时默认值。**镜像清单提供更新、机群配置的默认值和固定的
   信任材料。操作员文档可以覆盖受支持的配置键，但不能替换签名密钥。
   这不是一套通用的工厂凭据注入工具链。

> status: shipped — evidence: `docs/integrate/provisioning.md`, `mica-core:crates/micad`

## 2. 在线配置：API 与内置 UI

在线配置读写到达 apid——走 8080 上的 HTTP，开启后走 8443 上的 HTTPS——经由 `/_ui/` 的内置 UI，或 `/api/v1`
下的 JSON API（契约：`mica-core:crates/mica-apid/openapi.json`，见 [api.md](api.md)）。
apid 持有浏览器会话和 API 支持状态；设置修改通过本地系统总线转发给 micad，写入在那里对照类型化
schema 校验。被拒绝的写入不会触碰设置树，而一次设置写入会返回一个任务，
你可以观察它直到对应的协调器完成应用。

**设置存在哪里，以及这对复位意味着什么。**系统配置——hostname、网络、WiFi、
SSH、MQTT、时间、容器开关和更新设置——按子系统各写成一个 JSON 文档，放在数据
分区的 `/mica/config/` 下。设备关于*自身*铸出或观测到的东西留在 DATA/state 上：设备
身份、管理员凭据、API token。两者都能挺过重启和 A/B 更新，因为一次更新只写 SYSTEM
上的部署。

这个划分是复位边界，而不是一个存储细节：**一次配置重置会把 `/mica/config/` 下
的一切还原成镜像构建时的取值**，并保留管理员凭据——这正是那一层属于设置动作而
不是锁死的原因。动手之前请读 [recovery.md](recovery.md) 第 3 步：更新服务器地
址也会一起还原，而当镜像本身没有指定服务器时，这会让设备从此没有服务器。

> status: shipped — evidence: `mica-core:crates/mica-apid/openapi.json`, `docs/reference/management.md`

## 3. 今天可以配置什么

设置树目前按子树建模：

- **hostname**；
- **network**——按名字列出的接口，各自声明一种类型：物理、`vlan`、
  `bridge`、`wireguard` 或 `can`，渲染成 systemd-networkd 单元，OpenRC 上是
  ifupdown 配置段。`can` 条目是一个 CAN 控制器的位速率、bus-off 后的重启与 CAN FD
  模式，不带地址；板卡可以把它的 CAN 接口作为默认值随镜像提供。WireGuard 隧道的
  私钥在设备上生成，永不进入设置树；轮换是一个显式的 API 动作；
- **dns**——全局 DNS 服务器（开启时取代每个接口自己的服务器）与静态解析记录
  （设备从自己的 hosts 文件解析）。**没有后备 DNS**：全局服务器关闭时，设备只问
  接口拿到的服务器，所以路由器不下发 DNS 服务器的现场，什么都解析不了；
- **wifi.client** 与 **wifi.ap**——WiFi station 和接入点角色，驱动
  wpa_supplicant 和 hostapd。接入点的运行方式为 `off`、无上行时（`provisioning`）
  或 `always`，加密为 WPA2、WPA2 与 WPA3 并存，或不设密钥。带 WiFi 的产品首次
  启动时打开接入点、关闭 station，在设备被认领之前，其名称和密钥就是设备标签上
  印的那组（[首次启动](../start/first-run.md)第 2 节）；无线电是板卡事实；
- **bluetooth**——开关、信任列表与 `provisioning.autoWhenOffline`（已认领设备
  失去上行时开启蓝牙配网，[首次启动](../start/first-run.md)第 5 节）。适配器
  既不可被发现也不可配对：配对新设备要在控制台开启 180 秒的窗口，并在控制台
  确认数字比对；固定 PIN 会被拒绝；
- **access.ssh**——SSH 启用、端口、监听地址、授权密钥，以及围绕临时 root
  密码的策略（见 [../security/overview.md](../security/overview.md)）；
- **container**——控制容器引擎的开关与声明的 Compose 项目
  （[../integrate/applications.md](../integrate/applications.md)）；
- **mqtt**——本地 MQTT broker 与应用数据桥
  （[../integrate/applications.md](../integrate/applications.md)）；
- **time**——时间来源与同步策略（第 5.1 节）；
- **services.units**——用户自己的 systemd 单元或 OpenRC 脚本，保存在 DATA 上并在
  这里声明，也可在设备上用 `micad unit` 管理
  （[原生应用](../../integrate/native-applications.md)第 10 节）；
- **电源动作与更新动作**——不是设置，但通过同一认证面可达。

**更新设置不在这棵树里。**更新模式、服务器地址、维护窗口和网络模式住在
它们自己的文档 `/mica/config/updates.json` 里，与上面那些并列，而不在设置 schema
之内。它们有自己的路由——`POST /api/v1/update/config`，只收你要改的那些键——内置
UI 的自动更新面板就是驱动它的。
[updates.md](updates.md) 讲每一项各自做什么。

权威清单是 API 契约，不是这段散文：`mica-core:crates/mica-apid/openapi.json` 接受什么，
设备就支持什么。

> status: shipped — evidence: `mica-core:crates/mica-apid/openapi.json`, `mica-core:crates/micad-settings`, `mica-core:docs/mica-core.md`

WiFi 的有无取决于板卡：cx3576 与 s905x5m 的 `full` 产品带 WiFi 和蓝牙；uefi-x64、
mini-x64 与 qemu-armhf 没有无线电。

> status: board-dependent — evidence: `mica-build:boards/cx3576/board.env`, `mica-build:boards/s905x5m/board.env`

## 4. 未建模的设置就是不受支持的设置

根文件系统是受 verity 保护的只读 squashfs。没有 `/etc` overlay，将来也不会
有：对 `/etc` 的编辑要么直接失败，要么落在内存里并在重启时消失。任何必须
持久化的东西都必须在设置树中建模并由 API 暴露——如果 API 设置不了它，
这台设备就不支持持久化它。刻意的例外（绑定到 DATA/state 或 DATA 上的路径，例如
`/etc/ssh`）在设计记录中逐一列出；集成商的文件、脚本和
数据属于 DATA（[storage.md](storage.md)）。

> status: shipped — evidence: `docs/reference/access.md`, `docs/reference/ro-root.md`

## 5. 刻意的限制，以及还缺什么

### 5.1 时间

关于网络时间有两件事是刻意的限制，而不是遗漏。

`systemd-timesyncd` 已安装并静态启用，因此始终在跑：**没有任何启用、停用或
暂停控制**——设置树里没有，API 里没有，UI 里也没有。设置只有两个，且只有两个：
`time.ntp.servers`（一个经过校验的列表；留空表示使用镜像内置的备用池）和
`time.timezone`。`GET /api/v1/time/status` 报告内核是否已把时钟误差限定在界内
（`synchronized`），还是仅仅有服务器在应答（`polling`）；报告那是哪台服务器，
以及最近一次校正是阶跃还是缓变。

**机器的时间永远是 UTC，时区只用于呈现。**`time.timezone` 从不被写入
`/etc/localtime`——镜像不烘焙任何时区，构建也会拒绝一个——因为那个符号链接会
被每一个 UTC 消费者读到，journald 也在内。时区作为一个运行时值发布，供 UI
格式化使用，仅此而已。

网络时间之下还有一层时钟下界，因此一台没有 RTC 或 RTC 电池已耗尽的设备，
启动后的时间也不会早于它上一次被确知在运行的那一分钟：保存的时钟在 DATA/state 上，
跨重启与 A/B 更新都保留。PTP、NTS 和可配置的轮询周期不在范围内。

**未在硬件上验证：**cx3576 的设备树声明了一个 RTC，其驱动与备用电源都没有在
台架板卡上验证过。本页没有任何内容依赖 RTC 存在——那正是时钟下界的用途——但
"跨长时间断电仍保持时间"这件事没有被演示过。

> status: shipped — evidence: `docs/reference/time.md`, `mica-core:crates/micad/src/time_status.rs`

> status: board-dependent — evidence: `mica-linux@mica/cx3576:arch/arm64/boot/dts/rockchip/rk3576-cx3576z.dts`

### 5.2 离线配置通道与工厂注入

一份带版本、经过校验的配置文档如今已经存在，并在网络上还没有任何东西监听
之前就从介质上被应用：固定文件名的一个 TOML 文件、整份文档一起校验、应用一次
并记录下来，走两条离线传输（[../start/first-run.md](../start/first-run.md)）。它就是为一台从未
联过网的设备做配置的可重复路径。在带 WiFi 和蓝牙的产品上，手机还可以通过低功耗
蓝牙把 WiFi 网络发给设备，并在设备未认领时认领它（[首次启动](../start/first-run.md)
第 5 节）。

> status: shipped — evidence: `docs/integrate/provisioning.md`, `mica-core:crates/micad/src/provisioning_doc.rs`, `mica-core:docs/ble-provisioning.md`

**没有强制门户、没有屏幕上的设置向导、也没有串口向导**，而且每一条都是需要绕开的缺失，而不是
在做的工作：AP 强制门户只有传输、没有门户本身；HDMI 本地设置向导只有浏览器
客户端，没有能把它跑在设备自己屏幕上的 kiosk 与输入链路；串口控制台向导从未被
构建。已发布的可移动介质路径也既不验签名、也不在热插拔时导入——介质只在启动时
被读取一次。工厂注入同样没有——带版本的输入、注入时验证与每设备记录写在
[../integrate/manufacturing.md](../integrate/manufacturing.md) 里，没有任何工具支撑。离线准备规定的
`/mica/config/` 文件需要先停止设备；在线修改通过既有网络上的认证 API 完成。

> status: unsupported
