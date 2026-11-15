# 配置（provisioning）

在无法假定有网络时，设备如何获得身份、首个凭据和首份配置。运维者的操作流程见[首次启动](../start/first-run.md)；
机制属于 `mica-core`（`mica-core:docs/mica-core.md` 第 3.7 节）。

## 1. 首次启动自我配置

DATA 中没有状态的设备，会在首次启动时、在任何配置之前、在没有网络的情况下生成自己的状态：

- 设备 id，16 个随机字节；
- 主机名 `mica-<设备 id 的前 8 个十六进制字符>`；
- 每台设备的秘密，取自系统的随机源；
- SSH 关闭，没有网络配置，Wi-Fi 为默认值。

它在同一次写入中记录配置已完成，所以设备从不会处于只播种了一半的状态，之后的启动也不再改变任何东西。

**镜像中没有任何秘密。**根在每台设备上逐字节相同，所以其中的凭据会成为整个集群共享的一个秘密；每台设备的
秘密都在设备上生成。没有任何东西从主机名、MAC 地址、machine id 或时钟派生。

> status: shipped — evidence: `mica-core:crates/micad/src/provisioning.rs`, `mica-core:crates/micad/src/identity.rs`, `mica-system-base:payload/usr/lib/mica/mica-seed-state`

## 2. 设备生成的秘密

| 秘密 | 认证什么 |
|---|---|
| 接入点密钥 | 在没有设置密钥且设备没有设备码时，加入设备自己接入点的 Wi-Fi 客户端；带 WiFi 的产品改用标签上的密钥，直到在控制台的 Wi-Fi 页设置了密钥（[Wi-Fi](../reference/wifi.md)） |
| 设备密码 | **目前不认证任何东西**：它被生成并保留，没有登录路径检查它 |

两者是独立抽取的：Wi-Fi 密钥可以从截获的握手中恢复，所以它绝不能同时是登录凭据。两者都不会在运行中的设备上
重新生成，除了让设备回到未配置状态的重置之外没有轮换路径，重置后的下一次启动会生成新的秘密。

管理员凭据不是生成的：它由认领设备的人设置（[访问](../reference/access.md)第 3 节）。

> status: shipped — evidence: `mica-core:crates/micad/src/identity.rs`, `docs/reference/access.md`

## 3. 设备还没有网络时的四种配置方式

| 方式 | 谁 | 何时读取 |
|---|---|---|
| **配置文档**，引导分区或可移动介质上的一个文件 | 站在设备旁的运维者，或工厂 | 启动时，在未认领的设备上 |
| **在设备运行之前写 DATA 上的 `/mica/config/`** | 持有存储介质的集成方 | 每次启动时 |
| **产品携带的种子** | 产品的构建者 | 首次启动时，作为配置文档 |
| **手机经蓝牙**，在同时带 WiFi 和蓝牙的产品上 | 未认领设备范围内的任何人，已认领设备的管理员；它只设置网络，不认领任何东西 | 配置窗口打开期间（[首次启动](../start/first-run.md)第 5 节） |

一旦有了网络，就用 API 和控制台（[配置](../operate/configuration.md)）；在带 WiFi 的产品上，出厂接入点开箱即是
那个网络。没有强制门户，也没有串口向导。

每种方式都落到同一个地方：有类型的设置树及其校验器。没有任何方式绕过管理守护进程去改文件。

> status: shipped — evidence: `mica-core:crates/micad/src/provisioning_doc.rs`, `mica-core:crates/micad-settings/src/configuration.rs`, `mica-build:boards/products.md`, `mica-core:docs/ble-provisioning.md`

## 4. 配置文档

一个文件 `mica-provisioning.toml`，位于介质文件系统的根目录。

```toml
version = 1

[identity]
deviceId = "0123456789abcdef0123456789abcdef"

[admin]
password = "the-first-administrator-password"
authorizedKeys = ["ssh-ed25519 AAAA... ops@factory"]

[network.eth0]
dhcp = true

[wifi]
enabled = true
interface = "wlan0"

[[wifi.networks]]
ssid = "site-ap"
psk = "the-site-key"
priority = 10

[time]
timezone = "Europe/Berlin"

[time.ntp]
servers = ["0.pool.ntp.org"]
```

除 `version` 外每个部分都是可选的。`identity`、`admin`、`network`、`wifi` 和 `time` 就是全部词汇：没有主机名、
没有证书、没有其他部分，未知的键会让整份文档被拒绝。

**在哪里查找。**在启动时、任何东西开始监听之前查找一次：先找引导分区（UEFI 板卡的 ESP），只有那里没有时，
再找连接的可移动设备。FIT 板卡没有 ESP，使用可移动介质。每次挂载都是只读的，文件必须是普通文件。

**规则。**

- **整体校验，整体应用。**一个字段有误就什么都不应用。拒绝会指出键和原因，从不显示值，并让设备保持未认领、
  可配置：一个坏文件不会让设备变砖。
- **只在未认领的设备上。**一旦存在管理员凭据，文档就以 `already-claimed` 被拒绝。这正是未签名文件安全的原因：
  插进已部署设备的 U 盘不会重新配置任何东西。
- **幂等。**同一份文档在之后的启动中为 `unchanged`，不论其注释或键的顺序如何。
- **不签名。**授权依据是对介质的物理持有，受上面那条规则约束。
- **只在启动时读取。**插入介质不会重新配置运行中的设备。
- **留在介质上，不做改动。**设备从不写运维者的介质。文档可能带有密码和 Wi-Fi 密钥，所以要把介质当作凭据材料。

`GET /api/v1/provisioning/status` 报告最近应用的文档的版本和摘要、最近一次尝试的结果（`applied`、`unchanged`、
带原因的 `rejected`）以及设备是否仍未认领。它不返回文档携带的任何值。

> status: shipped — evidence: `mica-core:crates/micad/src/provisioning_doc.rs`, `mica-system-base:payload/usr/lib/mica/mica-provisioning-import`, `mica-core:crates/mica-apid/src/provisioning_api.rs`

## 5. 直接写配置

系统配置以每个关注点一份 JSON 文档的形式存放在 DATA 的 `/mica/config/` 下（[配置](../operate/configuration.md)），
所以集成方可以写入镜像，在旁边写入配置，两者之间无需任何手续就得到一台能用的设备。

与配置文档不同，这种方式在已认领的设备上也有效。两者依据的权限不同：配置文档由站在设备旁的人放进设备，认领
规则挡住陌生人；写 DATA 的是持有一台未运行设备的存储的人，他同样可以改写设备的凭据。对介质的保管就是边界。

无法解析的文档只会停用它所携带的设置，设备的其余部分照常启动。

> status: shipped — evidence: `mica-core:crates/micad-settings/src/configuration.rs`, `mica-core:docs/mica-core.md`

## 6. 产品中的种子

产品可以携带自己的配置文档（`mica-build` 中的 `boards/<board>/products/<variant>/provisioning.toml`）。构建把它
放到镜像的引导介质上，由第 4 节读取，所以从该镜像写出的每台设备都会按种子自我配置。该构建被标记为工厂预置
种子。种子是产品唯一可以写明秘密的地方；产品的设置默认值不可以。

代码树中目前没有产品携带种子。

> status: shipped — evidence: `mica-build:boards/products.md`

## 7. 不变量

- 任何镜像中都没有全集群共享的凭据或密钥。
- 没有配置路径绕过校验。
- 重置到未配置状态会再次执行第 1 节并生成新的秘密；身份在声明保留它的重置层级中保留
  （[恢复](../reference/recovery.md)）。
- 配置介质是凭据材料。

批量配置，连同工厂记录和隔离，见[量产](manufacturing.md)。

> status: shipped — evidence: `mica-core:crates/micad/src/provisioning.rs`, `docs/reference/recovery.md`
