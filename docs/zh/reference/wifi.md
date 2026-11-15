# 设计：Wi-Fi 客户端与接入点

> systemd/micad 底座上的 Wi-Fi 客户端（station）与接入点（AP）。与 micad、访问和配置页面配套阅读。

## 1. 提供什么

没有独立的连接管理守护进程。Wi-Fi 由以下部分承载：

- **两个 micad 调和器**，`wifi_client.rs` 和 `wifi_ap.rs`，由 micad 设置子树 `wifi.client` 和 `wifi.ap` 驱动；
- **systemd**，负责 unit 的生命周期：micad 从不把守护进程作为子进程监管，只经系统总线驱动 unit；
- **`wpasupplicant` 和 `hostapd`**，来自底座 rootfs 的软件包白名单，而不是独立的系统扩展；
- **systemd-networkd 内置的 `DHCPServer=yes`**，与 hostapd 并列，所以 AP 不需要 dnsmasq，也不需要独立的
  DHCP 守护进程；
- **micad 的实时状态树**，经 D-Bus 提供给 apid，是唯一的状态面。

这些部分实现的模型是：一份带优先级的已知网络声明式列表，一个有 `off` / `provisioning` / `always` 模式的 AP，
单无线电问题只有一个归属者，以及**不得存在全集群共用的凭据**这条规则。唯一的例外是按设计公开的：设备标签上的
出厂接入点密钥，由其设备码和产品秘密派生（`mica-core:docs/factory-ap-key.md`）。

**本页只讲 Wi-Fi。**CAN 接口是类型为 `can` 的网络条目，蓝牙是 `bluetooth` 子树，两者都属于 micad
（`mica-core:docs/mica-core.md` 第 3.3 节）；无线模块的上电（`hwinit-bt`）仍由板卡软件包负责。

## 2. 设置模型

两个子树都在 micad 设置树中（`mica-core:docs/mica-core.md` 第 3 节），持久化在 DATA 上的
`/mica/config/wifi.json`，使用该文档自己的 schema 版本（`mica-core:docs/mica-core.md` 第 3.3 节）。两个 Wi-Fi
调和器共用这一份文档，因为 `wifiAp` 声明了整个 `wifi` 子树。文档权限为 `0600`，位于 `0700` 目录中：它包含
站点的 WPA2 预共享密钥，而这个命名空间的定位就是凭据材料。

```toml
[wifi.client]
enabled = false
interface = "wlan0"
networks = []          # 每项：{ ssid, psk?, hidden, priority }

[wifi.ap]
mode = "off"           # off | provisioning | always
security = "wpa2-psk"  # wpa2-psk | wpa2-wpa3 | open
interface = "wlan0"
channel = 6            # 0 = 自动选择信道
countryCode = "US"
address = "192.168.4.1/24"
holdDownSeconds = 120
graceSeconds = 60
# ssid 和 psk 可选，默认不存在
```

有三个模型决定是关键的：

- **任何秘密都没有非 `None` 的默认值。**`wifi.ap.ssid`、`wifi.ap.psk` 和每个网络的 `psk` 都是 `Option`，以
  `skip_serializing_if = "Option::is_none"` 序列化。rootfs 在整个集群中逐字节相同并受 FIT 签名覆盖，所以这里
  的任何默认值都会成为随镜像发出的全集群共享秘密。不存在表示"在渲染时从设备标识和每台设备的凭据派生"。一个
  单元测试断言序列化后的默认文档中任何地方都不含 `psk` 或 `passwordHash`，所以未来某个"贴心的默认值"会让构建
  失败。
- **`wifi.client.networks` 是整体数组写入。**micad 的点路径 API 只寻址映射的段；没有
  `wifi.client.networks.0.psk`。调用方把整个数组作为一个 JSON 值读写。这是有意保留的：索引段会让同一数组的两个
  写入方之间出现读-改-写竞争，还要让界面多学一种寻址语法，而这个列表本来就是作为整体编辑的。
- **AP 子网是 `192.168.4.0/24`，而不是 `10.42.0.0/24`。**192.168.4.0/24 是嵌入式 AP 的惯用网段，与运维者的
  管理网络冲突的可能远小于 10.42.0.0/24（systemd-networkd 已把后者用于自己的地址范围）。它是一项设置，需要
  另一网段的部署可以改它。

## 3. 客户端调和器（`wifi.client`）

三个系统效果，按此顺序应用：

1. 从 `wifi.client` 渲染 `/etc/wpa_supplicant/wpa_supplicant-<interface>.conf`，权限 0600。这个确切路径是
   **与 unit 的契约**：Debian 的 `wpa_supplicant@.service` 在其 `ExecStart` 中写死了
   `-c/etc/wpa_supplicant/wpa_supplicant-%I.conf`。改变任一侧都会破坏另一侧。
2. 为该接口生成一个带 `DHCP=yes` 的 networkd `.network` unit。关联了却没有地址的链路会报告有载波却不传输任何
   流量，所以地址配置是这个调和器的一部分，而不是留到硬件上才被发现。
3. 把 `wpa_supplicant@<interface>.service` 置于 `wifi.client.enabled` 要求的状态。

先配置后 unit，是有意的：对着过时或缺失的文件启动的 supplicant 会关联到上一个网络，或者不关联任何网络。

渲染规则：网络按 `priority` 从高到低排序，**并且**每个块都写明自己的 `priority=`（只靠顺序会让 wpa_supplicant
按它自己的默认值 0 选择；只靠指令会让文件读起来的顺序与它的行为不一致）。没有 `psk` 表示开放网络，输出
`key_mgmt=NONE` 且没有 `psk=` 行；只有 `hidden` 会输出 `scan_ssid=1`；`update_config=0` 是写明的而不是取默认，
所以 `wpa_cli save_config` 无法改写 micad 的渲染结果。

**SSID 和密钥的编码是注入边界。**SSID 是运维者提供的文本，落在 `network={…}` 块中，其中的换行会闭合这个块，
让余下部分被当作指令读取。不含 `"` 和 `\` 的可打印 ASCII SSID 以带引号的形式输出；**其他任何 SSID 都以
wpa_supplicant 不带引号的十六进制形式输出**，其字母表是 `0-9a-f`：在那里注入不只是被转义，而是根本无法表达。
64 个字符的十六进制密钥是原始 PMK，不带引号输出；给它加引号会让 wpa_supplicant 把它读成 64 个字符的口令，
超出 63 个字符的上限，从而拒绝**整个文件**，连带其他所有网络一起失效。

### `enabled: true` 但没有网络：是决定，不是偶然

界面一次点击就能产生这个状态，所以它是有定义的：配置仍会渲染（只有文件头），supplicant **保持停止**，实时状态
报告 `station: "idle"`，有意区别于 `"disabled"`。

原因是一个真实的冲突，而不是为了整洁：运行中的 wpa_supplicant **占用无线电**，它把接口置于 managed 模式并
持有它。被一个永远无法关联的客户端角色占用的无线电，接入点角色就无法使用，而一台没有配置网络的设备正需要 AP
来让人给它配置网络。

## 4. 接入点调和器（`wifi.ap`）

同样的三个效果，同样的顺序：

1. `/etc/hostapd/<interface>.conf`，权限 0600：同样是 Debian 的 `hostapd@.service` 模板读取的路径
   （`… /etc/hostapd/%i.conf`）。
2. 一个 networkd `.network` unit，带 AP 侧地址和 `DHCPServer=yes`，其 `PoolOffset` / `PoolSize` **从
   `wifi.ap.address` 派生**，而不是在它旁边另行配置。单一事实来源：networkd 会毫无怨言地接受子网之外的地址池，
   然后分配出没有客户端能用的地址，看上去就是 AP 正常而客户端坏了。
3. `hostapd@<interface>.service`。

**用 systemd-networkd 的 DHCP 服务器，而不是 dnsmasq。**签名的 rootfs 中不需要额外的软件包，服务器的生命周期
就是地址本来就需要的那次 networkd 重载。两个镜像校验器都断言 dnsmasq 不存在。

AP 的安全方式是 `wifi.ap.security`：`wpa2-psk`（默认，`wpa=2` + `wpa_key_mgmt=WPA-PSK` +
`rsn_pairwise=CCMP`）、`wpa2-wpa3`（WPA2 与 SAE 并存）或 `open`（不需要密钥）。开放的 AP 是允许的，控制台会
对此发出警告，因为这个 AP 承载着通往设备配置的路径。`ieee80211d=1` 让 `country_code` 不只是一句注释；没有它，
hostapd 带着这个代码却从不广播监管域。

**hostapd 的转义规则不同于 wpa_supplicant，这一点是核实过的，而不是假设的。**hostapd 的 `ssid=` 把 `=` 之后
直到行尾的字节按字面接收：没有可以转义进去的引号，`"` 是普通字符，换行就是开始下一条指令。沿用客户端的带引号
形式会把一对字面引号作为 SSID 的一部分输出：AP 能用，但名字错了，任何"SSID 是否在文件中"的检查都发现不了。
hostapd 提供的替代是 `ssid2=`，它接受十六进制转储。所以规则与客户端相同，只是按 hostapd 的写法：能原样表示时
原样输出，否则用 `ssid2=<hex>`；密钥随编码一起变化，因为两者不是同一指令的可互换写法。

**SSID 和密钥从哪里来。**设置了 `wifi.ap.ssid` 时用它；否则，在有设备码的设备上，用 `mica-` 加上从设备码派生的
四个字符，与标签上印的一致；再否则从 `provisioning.deviceId` 派生为 `mica-<前 8 个十六进制字符>`。密钥依次为：
设置了 `wifi.ap.psk` 时用它；在有设备码的设备上，不论是否已认领，用从设备码和 `/usr/share/mica/ap-secret`
派生的密钥；`/var/lib/mica/secrets/ap-psk`，即首次启动时生成的每台设备的秘密。认领不会设置 `wifi.ap.psk`，所以
标签上的密钥一直有效，直到管理员在控制台的 Wi-Fi 页设置一个。出厂重置会清除 `wifi.ap.psk`，让标签上的密钥
恢复有效。这里有意**没有常量后备**：任何地方都没有密钥的设备拒绝开启 AP 并说明原因。见第 7 节和
`mica-core:docs/factory-ap-key.md`。

与客户端调和器不同，`mode: off` 不渲染任何配置。`off` 是设置的默认值；在带 WiFi 的产品上，首次启动配置会设置
`always` 并关闭客户端，除非配置树声明了一个网络。

## 5. 单无线电冲突：照实报告，不做仲裁

客户端和 AP 不能同时占用一个无线电。两个调和器各自在同一个接口上启停 unit，会无休止地来回切换，每个周期都
撤销对方的操作，设备两者都不是。

> **当 `wifi.ap.mode != off`、`wifi.client.enabled` 为真且两者指定同一接口时，实时状态报告
> `accessPoint: "conflict"`，AP 调和器什么都不做**：不调用 unit，不写配置，不生成 networkd unit。它在任何 I/O
> 之前就返回。

特别是它**不会**停止 supplicant。那个 unit 属于客户端调和器，它会在下一轮再次启动它。

冲突只根据 `wifi.client.enabled` 判定，而不看客户端是否有可加入的网络：就配置而言，运维者打开的客户端占有
无线电，报告这一点正是目的所在。

**自动仲裁是后续阶段，明确不在这里。**`wifi.ap.holdDownSeconds` 和 `wifi.ap.graceSeconds` 在 schema 中，但
**没有任何东西使用它们**：这是有意的，不是疏忽。在载波丢失并经过保持时间后开启 AP、在上行恢复后经过宽限期
关闭 AP，需要一个载波监视器和一个比单次 `apply` 存活更久的状态机。在它落地之前，**`mode: provisioning` 的
行为与 `always` 完全相同**；模式记录在实时状态中，让界面能区分两者，并有一个测试固定这就是决定的行为。

所以在这个状态机中，第 4 步（`always` / `off`）已发布，第 1–3 步（自动触发和退出）没有。

## 6. networkd 命名约束：编写新的调和器之前先读这一节

`mica-core:crates/micad/src/reconciler/network.rs` **会删除所有不是它自己渲染的 `*-mica-*.network` 文件。**
因此名为 `50-mica-wlan0.network` 的 WiFi unit 会在网络调和器的下一轮被清除：组件在，每个单元测试都通过，而
WiFi 在设备上没有地址。未来的调和器作者不应再重新发现这一点。

因此调和器渲染的 networkd unit 使用该模式**之外**的前缀：

| 渲染者 | 前缀 | 原因 |
|---|---|---|
| `network.rs`（以太网，运维者配置） | `50-mica-` | 负责清除 |
| `wifi_client.rs` | `90-wifi-client-` | 不含 `-mica-`，清除不会匹配到它 |
| `wifi_ap.rs` | `90-wifi-ap-` | 同上 |
| 镜像的后备 | `80-dhcp.network` | 构建时内置 |

两个独立的性质，缺一不可：

- 前缀**不**含 `-mica-`，所以 `network.rs` 不会匹配它；
- `90-` 排在 `50-mica-…` 和 `80-dhcp.network` 之后，而 networkd 按字典序应用第一个匹配的 unit，所以运维者在
  `network.<iface>` 下明确配置的接口，不论叫什么名字，总是优先于调和器的隐式默认。

每个 WiFi 调和器清除**自己的**命名空间（`90-wifi-client-*`、`90-wifi-ap-*`），这样接口改名会收敛，而不会让
networkd 在 micad 不再管理的链路上继续运行 DHCP。

这是被断言的，而不是写进文档然后寄希望于它。测试渲染 unit，然后在同一目录上运行**真实的**
`NetworkReconciler`，断言文件完好保留；两个镜像校验器都枚举镜像带的每个 `.network` 文件，断言其中没有一个
落在调和器拥有的命名空间中。

## 7. 凭据

AP 的 PSK 是首次启动时在设备上生成的两个每设备秘密之一。完整的凭据模型（为什么秘密在设备上生成、为什么是两个
而不是一个、为什么有两种哈希格式）只在 **`docs/integrate/provisioning.md` 第 2 节**说明一次，这里不再重复。

对 Wi-Fi 而言重要的是：

- PSK 只到达一个地方，即 0600 的配置文件。它不在实时状态树中（该树经 D-Bus 提供给 apid），不在任何日志行中
  （两个调和器模块中根本没有日志语句，这是机械检查过的），也不在任何错误信息中，包括密钥无法渲染时产生的那条。
- 实时状态发布 `secured: true`，意思是*存在一个密钥*，从不说明它是什么。
- 没有设备秘密进入镜像。渲染文件中的每个密钥都来自 DATA/state 上的设置树、`/var/lib/mica/secrets/ap-psk`
  （两者都在运行时产生），或者对于标签上的密钥，来自镜像携带的产品秘密：它随镜像一起公开，因此这个密钥只是
  首次接触的凭据，仅此而已。

## 8. 镜像集成：Debian 的打包会主动与调和器作对

这一节是代价高的部分。下面的打包交互在评审中看上去什么都不是，在硬件上却要花掉一天。

`wpasupplicant` 和 `hostapd` 在两条流水线的底座 rootfs 白名单中。两个软件包都带有**已启用的非模板 unit**，
与 micad 启动的实例竞争：

| Unit | 软件包的做法 | 为什么是问题 |
|---|---|---|
| `wpa_supplicant.service` | 以**已启用**状态发出，**没有任何条件约束** | 它*确实*会启动。更糟的是它带有 `RuntimeDirectory=wpa_supplicant`，所以 systemd **在它停止时删除 `/run/wpa_supplicant`**，连带删掉 micad 启动的模板实例的控制套接字 |
| `hostapd.service` | 以**已启用**状态发出 | *今天*不起作用只是因为它的 `ConditionFileNotEmpty=/etc/hostapd/hostapd.conf` 不满足。运维者一次 `cp` 就会让同一无线电上出现第二个 hostapd，而 micad 的实例仍报告健康 |
| `dbus-fi.w1.wpa_supplicant1.service` | 软件包的 `Alias=` 链接 | 同一 unit 的第二个名字 |

**三者都被屏蔽（mask），而不是停用（disable）。**区别正是要点：`wpasupplicant` 带有
`/usr/share/dbus-1/system-services/fi.w1.wpa_supplicant1.service`，一个 D-Bus 激活文件。单纯的
`systemctl disable` 会留下这条激活路径，任何访问该总线名的东西仍能启动这个 unit。屏蔽才能关闭它。

micad *确实*驱动的模板（`wpa_supplicant@.service`、`hostapd@.service`）**不得**在镜像中静态启用：micad 拥有
这些生命周期，会与镜像自己的实例竞争。两个校验器都双向断言这一点：屏蔽存在，软件包的 `*.wants` 符号链接已
移除，两个模板都没有被静态启用。

镜像契约的其余部分：

| 要求 | 值 |
|---|---|
| 可执行文件 | `/usr/sbin/wpa_supplicant`、`/usr/sbin/hostapd` |
| Unit 模板 | `wpa_supplicant@.service`、`hostapd@.service`：Debian 自己的，ExecStart 中的配置路径与调和器常量交叉核对 |
| 配置目录 | `/etc/wpa_supplicant` 和 `/etc/hostapd`，经 `etc-wpa_supplicant.mount` / `etc-hostapd.mount` 绑定到 DATA/state，权限 0700 |
| 控制套接字 | `/run/wpa_supplicant`，在 tmpfs 上，由 wpa_supplicant 自己创建 |
| networkd 目录 | `/run/systemd/network` |
| dnsmasq | **不存在，并断言其不存在** |
| 固件 | 板卡的 WiFi 固件必须在镜像的固件目录中，且驱动必须支持 AP 模式，否则接口永远不会以 AP 出现 |

校验器从**拥有它的 micad 源码中**读取每个路径、前缀和 unit 名称，而不是重新写一遍。在两处重复写的常量会漂移，
而且这种漂移从代码一侧看不见，因为 micad 的测试都是对着 mock 通过的。每次提取都检查是否为空，所以 micad 中的
改名会让校验器明确失败，而不是把断言变成与 `""` 的比较。

## 9. 已知的局限，延续下来而不是丢掉

- **WPA3-SAE 无法表达**，两侧都是。模型能要求的是 `key_mgmt=WPA-PSK` / `wpa_key_mgmt=WPA-PSK`；SAE 需要
  `key_mgmt=SAE` 和 `ieee80211w`，而 `WifiNetwork` 没有对应字段。这是 schema 的改动，不是渲染器的改动。
- **客户端侧不校验口令长度。**wpa_supplicant 要求 8–63 个字符，较短的口令会让它拒绝*整个文件*，让所有网络失效。
  校验应与其余 schema 一起放在 `micad-settings` 中。（AP 侧*确实*校验 8..=63，因为 hostapd 在那里的失败同样是
  全面的。）
- **5 GHz 无法表达。**`hw_mode=g` 是固定的，信道校验为 1..=14，因为 `wifi.ap.channel` 文档说明为 2.4 GHz 信道，
  且模型没有频段字段。
- **不输出 `ieee80211n`/`ac` 和 HT 能力**，所以 AP 以 802.11g 速率运行。对于少数客户端上的设置界面已经够用；
  提高它需要按驱动了解能力，而本仓库无法验证这些。
- **`EmitDNS` / `EmitRouter` 保持 networkd 的默认值**（都开启），所以没有上行的配置 AP 会宣称自己是它做不到的
  路由器和解析器。这对强制门户流程是帮助还是妨碍，由 apid 设置界面的任务决定。
- **没有设置 `ConfigureWithoutCarrier`。**如果驱动在 AP 模式下不报告载波，networkd 不会配置地址，DHCP 服务器
  也不会启动。这取决于驱动，只有硬件能定论；修复只需一行。
- **接口改名时，过时的 `<旧接口>.conf` 及其 unit 不会被清除。**networkd 一侧*会*清除；守护进程一侧不会，因为
  停止 micad 从未被告知的接口的 unit，是比这些子树所授予的更宽的归属声明。影响范围有界：unit 的启用是运行时
  范围的，过时的文件在没有东西启动该实例时不起作用，而 micad 只启动配置的那个，所以重启就会清除它。
- **`write_atomically` 重复了三次**：`sshd.rs`、`wifi_client.rs`、`wifi_ap.rs`。值得把它提取为共享的辅助函数。
- **监管合规无法在本仓库中验证。**`country_code` 只校验*形状*（恰好两个 ASCII 字母，这也阻止了它把换行带进
  文件）然后原样传递。生成的信道和发射功率在设备部署地是否合法，取决于镜像中的监管数据库、驱动，以及运维者
  设置了正确的代码。

  三者中有两个值得确切说明，因为第一个很容易被误认为是全部答案。**数据库现在在镜像中**：`mica-wifi` 和
  `mica-wifi-ap` 依赖 `wireless-regdb`，镜像契约断言 `/lib/firmware/regulatory.db` 及其 `.p7s` 位于固件加载器
  搜索的路径。**仅此一项本来什么都换不来。**cfg80211 内置在这里每块板卡的内核中，而这些板卡没有 initramfs，所以
  它自己在启动时的请求在根挂载之前运行（在 cx3576 上测得为 7.668 秒，根挂载在 7.681 秒），而
  `net/wireless/reg.c` 把这次失败记在一个文件作用域的指针中，之后的请求都不再查看；注册 wiphy 也不会重新读取。
  唯一能清除它的路径是 nl80211 的 `RELOAD_REGDB`，所以 `mica-wifi` 还带有 `mica-regdb-reload.service`，一个在
  `network-pre.target` 之前运行 `iw reg reload` 的一次性服务，契约断言这个 unit、它的启用状态以及它运行的程序
  存在。

  **驱动是第三个要素，仍未解决。**在 AIC8800D80 型号上，厂商驱动默认 `custregd` 为真，在 `phy0` 上设置
  `REGULATORY_WIPHY_SELF_MANAGED` 并安装自己的表：启动日志中的
  `CAUTION: USING PERMISSIVE CUSTOM REGULATORY RULES` 横幅就是该调用的成功分支。自管理的 wiphy 不采用核心
  监管域，所以在这个型号上 `iw reg get` 和 `iw phy phy0 reg get` 可能不一致，渲染出的 `country_code` 到达
  其中哪一个是硬件问题。cx3576 台架笔记中的 `regdb-loaded` 探测记录了两者。

## 10. 不声称的内容

两个调和器都没有对着真实无线电测试过。两个调和器中的每个测试都运行在 mock 的 `UnitControl`、mock 的
`NetworkReload` 和临时目录上；每个镜像断言读取的是打包的制品或源文件。

以下属于**用户的硬件验收**，本仓库中任何地方都不声称：

- 客户端确实能关联并获得 DHCP 租约；
- AP 确实发出信标，客户端能与之关联，且 networkd 的 DHCP 服务器分配出可用的地址；
- AP6275S 厂商驱动到底是否支持 AP 模式：一项已记录的风险把它列为已知的硬件风险，只有无线电能定论；
- 被屏蔽的 unit 在真实启动中保持屏蔽，模板实例正常启动。
