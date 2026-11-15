# 设备总线与 MQTT 应用数据契约

本文描述 Mica OS 管理平面、应用服务与 MQTT 之间已发布的边界。这条边界是正向的、按软件包登记的：

- `com.mica.micad1` 是本地的系统管理 API。APID 是它面向网络的客户端；它获准的本地调用方是启动健康闸门和 root 的
  [`mica` 命令](../reference/cli.md#2-两个通道)，后者向它询问 micad 决定的事（更新、容器、服务、Web 模式、电源、出厂重置）。
- `com.mica.<class>[.<suffix>]` 是统一的服务名语法。因此 `micad` 也是一个应用名；名称本身不授予任何能力。
- `mica-mqttd` 只镜像由其软件包登记的确切服务名。它从不调用或订阅 `com.mica.micad`，即使一个格式错误的软件包
  试图登记这个名称。

`com.mica.micad` 不带任何 `com.mica.Item1` 投影：系统设置、运行时状态和操作都不属于应用数据面。

## 1. 管理与应用的边界

系统功能留在 `com.mica.micad1` 和 APID 上。特别是，MQTT 不发布也不控制：

- SSH 的开关、端口、登录策略、密码或授权密钥；
- 主机名、以太网、Wi-Fi 客户端/接入点、DNS 或其他网络配置；
- 配置（provisioning）和设备凭据；
- 控制台访问和 Web 管理凭据；
- 容器的开关或容器运行时管理；
- MQTT 代理/桥接的配置或凭据；
- 健康状态、调和器结果、服务状态或错误状态；
- 软件更新状态或更新操作；
- 重启、关机或其他任何系统操作。

APID 调用专门的管理成员，例如 `GetSettings`、`SetSettings`、`GetState`、`Reboot` 和 `PowerOff`。它从不经由
MQTT 或应用条目路由管理操作。

桥接不调用 micad。micad 在启动桥接之前，把已配置的主题身份渲染到 `/var/lib/mica/mqtt/mqttd-device.env`，
systemd 经 `--device-id` 传给它。这个文件是单一用途的输入，不是通用的设置导出。

micad 仍有 D-Bus 接口，是因为 micad 和 APID 是两个独立的本地进程：APID 需要一个有类型、受策略控制的 IPC 边界
来请求系统操作。这个本地管理接口不是 MQTT 的来源。把 IPC 和远程发布作为两个独立的决定，正是这条边界的意义。

这是一条失败即关闭的边界。只有当 `/usr/lib/mica/mqtt-applications.d` 中有一个普通文件、其文件名恰好是那个
有效的 D-Bus 服务名时，`mica-mqttd` 才构造应用身份。作为第二道防线，`com.mica.micad` 在加载后会在结构上被
拒绝。同级的服务、通配符或有效但未登记的 `com.mica.*` 名称都无法进入桥接状态或成为读写目标。

## 2. 应用服务契约

对 MQTT 可见的应用拥有一个符合以下语法的知名名称：

```text
com.mica.<class>[.<suffix>]
```

`<class>` 段成为 MQTT 的 class。可选的后缀用来区分多个 D-Bus 服务，本身不是 MQTT 地址。每个应用发布
`/DeviceInstance`；该数值与 class 组成应用地址。`/DeviceInstance` 缺失或无效时回落为 `0`，以便服务仍可诊断。

应用暴露 `com.mica.Item1`：

```xml
<interface name="com.mica.Item1">
  <method name="GetValue">
    <arg direction="out" type="v"/>
  </method>
  <method name="SetValue">
    <arg direction="in" type="v"/>
    <arg direction="out" type="i"/>
  </method>
  <method name="GetItems">
    <arg direction="out" type="a{sa{sv}}"/>
  </method>
  <signal name="ItemsChanged">
    <arg type="a{sa{sv}}"/>
  </signal>
</interface>
```

`GetItems` 和 `ItemsChanged` 在 `/` 上提供。`SetValue` 在所寻址条目的对象路径上调用。每个条目字典带有
`value`、`writable` 以及可选的 `min`/`max`。`SetValue` 接受时返回 `0`，否则返回应用自定义的非零拒绝码。

空数组值是 D-Bus 上表示无效/删除的哨兵值，在 MQTT 上变为 JSON `null`。这不同于零长度的保留 MQTT 载荷，后者会
删除保留记录。

应用拥有自己的 schema、访问规则和源端脱敏。它不得把凭据暴露为条目。桥接另外会屏蔽已知的形似秘密的键
`password_hash`、`passwordHash`、`psk` 和 `hash`，包括嵌套对象和数组中的值。这个屏蔽是纵深防御，不是允许应用
发布秘密。

## 3. 发现与 D-Bus 策略

启动时，桥接加载确切的登记集合，为 `com.mica` 命名空间安装一个总线侧的 `NameOwnerChanged` 匹配，然后执行
`ListNames`。宽泛的信号匹配只用于发现：在 mqttd 询问其所有者、创建代理、调用方法或订阅信号之前，每个名称都要
对照确切的登记集合检查。这个顺序覆盖了在初始扫描期间出现的应用。对每个准入的名称，它：

1. 读取初始的根 `GetItems` 快照；
2. 监听根上的 `ItemsChanged` 信号；
3. 把写入与那个确切的知名名称关联；
4. 所有者消失时删除其镜像和保留的发布。

监听器的代数防止来自旧所有者的迟到信号在服务消失或重启后重新填充它。

没有全局的 `own_prefix` 授权，也没有集中的 mqttd 策略。每个启用 MQTT 的应用软件包自己负责准入的两侧：

1. 一个以确切服务名命名的空登记文件，例如 `/usr/lib/mica/mqtt-applications.d/com.mica.sensor.example`；
2. 一份按确切名称的 D-Bus 策略，让应用拥有该名称，并让 `mica-mqttd` 只能访问其 `com.mica.Item1` 接口面。

策略授予桥接 `GetItems` 和 `ItemsChanged`，只有当远程写入属于该应用的契约时才授予 `SetValue`。它还授予 root
`GetItems`：micad 的注册表（第 7 节）用这个调用探测服务，而标准系统总线默认拒绝方法调用，对 root 也没有例外。
例如：

```xml
<policy user="mica-sensor">
  <allow own="com.mica.sensor.example"/>
</policy>
<policy user="mica-mqttd">
  <allow send_destination="com.mica.sensor.example"
         send_interface="com.mica.Item1"
         send_member="GetItems"/>
  <allow receive_sender="com.mica.sensor.example"
         receive_interface="com.mica.Item1"
         receive_member="ItemsChanged"/>
  <allow send_destination="com.mica.sensor.example"
         send_interface="com.mica.Item1"
         send_member="SetValue"/>
</policy>
<policy user="root">
  <allow send_destination="com.mica.sensor.example"
         send_interface="com.mica.Item1"
         send_member="GetItems"/>
</policy>
```

不要把确切的目标替换为通配符或只按接口的授权。那会让面向网络的桥接能够寻址无关的系统服务。缺少任何一半的应用
都会失败即关闭：未登记的策略目标从不被代理，而有登记但没有确切策略的应用会在初始读取时以 `AccessDenied` 失败，
什么都不发布。镜像校验要求登记、按用户的所有权授权、桥接的 `GetItems` 和 `ItemsChanged` 授权以及 root 的
`GetItems` 授权指向同一个确切的服务。`com.mica.micad` 在两侧都被禁止。

桥接对应用的每次调用都限时五秒。接受了 `GetItems` 或 `SetValue` 却永不应答的应用会被记录为不可达，桥接继续处理
其他应用。在仍拥有其名称时激活失败的应用（例如在注册 `/` 之前就占用名称的应用），会在五秒后的一次总线扫描中
重试，因此两侧都无需重启。

## 4. MQTT 语法

桥接使用一种 mica 原生语法：

```text
N/<deviceId>/<class>/<instance>/<path>  设备 -> 代理 通知
R/<deviceId>/<class>/<instance>/<path>  代理 -> 设备 读请求
W/<deviceId>/<class>/<instance>/<path>  代理 -> 设备 写请求
```

条目载荷是 JSON 对象：

```json
{"value": 42, "min": 0, "max": 100}
```

`min` 和 `max` 只在应用提供时出现。读请求会重新发布当前保留的 `N` 值；读取应用未发布的路径会被忽略而不是应答，
因此客户端无法以自己选择的名称生成保留主题。写请求必须带 `{"value": ...}`，并被转发到唯一寻址的应用的
`SetValue`。没有 MQTT 写入确认主题；成功的变更通过之后的 `ItemsChanged` 通知观察到。

默认的 `read-only` 模式既不订阅也不执行 `W` 请求。`full` 模式启用应用写入。这项设置不会削弱登记闸门：在两种
模式下系统服务都不可寻址。

设备级的协议主题没有 class 或 instance：

```text
R/<deviceId>/keepalive
N/<deviceId>/heartbeat
N/<deviceId>/full_publish_completed
```

一次 keepalive 打开一个 60 秒的发布窗口，并请求所有应用完整重新发布。窗口打开期间每 3 秒发出一次心跳。完整
重新发布每 5 秒最多一次；重复的 keepalive 会合并。一个桥接协调所有应用，所以每台设备只发出一个心跳和一个完成
标记，而不是每个应用一个。

条目通知是保留的。心跳和完成标记不是。当应用消失、更换 instance 或进入地址冲突时，桥接会为它此前拥有的主题
发送零长度的保留发布。

## 5. 地址冲突

`<class>/<instance>` 必须恰好标识一个存活的应用。如果两个服务声明同一个地址，桥接失败即关闭：

- 两个服务都不在该地址发布；
- 读取没有目标；
- 写入不到达任何一个服务；
- 设备处于实时发布窗口期间，该地址此前保留的记录会被删除。

当一方消失或移到另一个 instance 时，剩下的唯一应用在下一次完整发布时重新可以发布。

## 6. 代理与生命周期

`mica-mqtt-broker` 和 `mica-mqttd` 是 `mica-pkgs` 的软件包，位于带 `mqtt` 特性的产品中；它们与 micad 之间的契约是
`mica-pkgs:docs/mica-pkgs.md` 第 3 节，micad 一侧见 `mica-core:docs/mica-core.md` 第 5 节。

`mica-mqtt-broker` 是基于 `rumqttd` 的本地代理。`micad` 的 MQTT 调和器渲染代理配置，并按管理设置 `mqtt.enabled`
启动或停止两个 MQTT unit。这种生命周期关系并不让这项设置本身成为应用数据：桥接无法读写 `mqtt` 管理子树。

`mica-mqttd` 在不可变镜像中是停用的，以静态、无特权的 `mica-mqttd` 账户运行。代理连接设置来自可选的、存放在
DATA/state 上的 `/var/lib/mica/mqttd.env`；默认的桥接模式是 `read-only`。

要使用经认证的 MQTT，先在现有的 `/var/lib/mica/mqtt-broker-users.toml` 的 `[users]` 表中登记一个代理账户，然后在
`/var/lib/mica/mqttd-credentials.json` 中配置同样的用户名和密码：

```json
{"username":"bridge","password":"<登记的密码>"}
```

代理账户文件必须保持 `mica-mqtt-broker` 可读。把桥接的 JSON 文件的所有者设为 `mica-mqttd:mica-mqttd`、权限设为
`0600`，修改后重启桥接。桥接在启动时读取这个可选文件；文件不存在时使用匿名 MQTT，而格式错误、为符号链接或
公开可读的文件会让启动被拒绝。凭据从不作为进程参数传递，也从不作为应用条目发布。需要另一个私有文件时，命令行
接受 `--credentials-file`。

## 7. micad 的服务注册表

管理守护进程另外观察所有其他 `com.mica.*` 服务，用于运维诊断。这个注册表不是 MQTT 来源，也不授予服务 MQTT 资格。
它只记录服务名、class、连接状态、instance、冲突标志和一致性缺口；从不把服务的任意条目值复制到系统状态中。

一个符合规范的服务在 `/` 上暴露 `com.mica.Item1.GetItems`，并从占用名称的那一刻起包含以下七个路径：

```text
/Mgmt/ProcessName
/Mgmt/ProcessVersion
/Mgmt/Connection
/DeviceInstance
/ProductId
/ProductName
/Connected
```

扫描是尽力而为的。缺少 Item1 支持、必需路径、class 或可用的设备 instance 会在 `conformance` 下报告；这不会让
micad 删除注册表条目。探测是以 root 身份进行的方法调用，除非应用的策略允许，否则系统总线会拒绝它；第 3 节的
模板带有这项授权，缺少它的软件包会被报告为没有 `Item1`。断开的条目保持可见，直到运维者调用 `ForgetService`。
class/instance 冲突会在每个已连接的一方上标记。

注册表和 MQTT 桥接有意采用不同的准入规则。注册表描述每个 `com.mica.*` 服务。MQTT 只准入按确切名称、由软件包
登记的应用服务，并且独立地在冲突时失败即关闭。

## 8. Sparkplug B

`mica-mqttd` 没有实现 Sparkplug B。它的出生/死亡证书、序列号、指标别名和主机协调是另一种线路契约。未来的
Sparkplug 发布者应与这个桥接并列，复用同样的确切登记边界和对 micad 的结构性排除；它不得把系统管理树重新作为
遥测引入。

## 9. 完整示例

端到端跑通这份契约的示例在 MQTT 页：打开代理、连接客户端、应答 keepalive，
以及以 `com.mica.<class>` 登记一个应用（[MQTT](mqtt.md) 第 1、3、5 节）。本页是
那次运行所依据的契约，不再重复。
