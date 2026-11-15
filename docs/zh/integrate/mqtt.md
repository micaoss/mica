# MQTT

如何打开设备的 MQTT broker，用用户名和密码从另一台机器访问它，查看桥接发布的内容，以及把你自己应用的值放到 MQTT
上。线上语法见[总线](bus.md)第 4 节；软件包见 `mica-pkgs:docs/mica-pkgs.md` 第 3 节。

## 开始之前

- **带 MQTT 的产品：**`cx3576.full`、`s905x5m.sd-full`、`s905x5m.emmc-full`、`uefi-x64.full` 和 `uefi-x64.docker`。
  `uefi-x64.gcp`、`mini-x64.basic` 和 `qemu-armhf.basic` 没有。
- **MQTT 上有什么、没有什么。**MQTT 只承载应用数据。micad 不在上面发布任何东西：没有配置、状态、凭据或更新，MQTT
  上的任何东西也改变不了它们。出现的是向桥接登记的应用的值（第 5 节）；没有登记应用的设备只发布桥接自己的协议主题。
- **两个服务。**`mica-mqtt-broker`，本地的 MQTT 3.1.1 broker，一个 TCP 监听、没有 TLS；`mica-mqttd`，从系统总线上
  已登记的应用到该 broker 的桥接。MQTT 打开时 micad 启动这两个服务。
- 设备上的 root，或带令牌的 API（`DEV`、`AUTH` 同[网络](../operate/network.md)），以及工作站上的 MQTT 客户端，这里用
  `mosquitto_sub` 和 `mosquitto_pub`。

> status: shipped — evidence: `mica-core:docs/mica-core.md`, `mica-pkgs:docs/mica-pkgs.md`, `mica-build:boards/cx3576/products/full/product.env`

## 1. 打开（仅本机）

```sh
mica set mqtt.enabled true
```

或控制台“服务”下的 MQTT 页，或 API。broker 监听 `127.0.0.1:1883`，不认证：只有设备上的程序能访问它。

**检查是否生效：**

```sh
curl -s -H "$AUTH" $DEV/api/v1/mqtt
# {"configured":{"enabled":true,"listen":{"address":"127.0.0.1","port":1883},"auth":{"enabled":false}},
#  "observed":{"available":true,"state":{...}}}
```

`observed.state` 是协调器的记录：它写出的配置、监听，以及两个服务的状态。

> status: shipped — evidence: `mica-core:crates/mica-apid/src/routes/mqtt.rs`, `mica-core:crates/micad/src/reconciler/mqtt.rs`

## 2. 对网络开放，并使用密码

先在设备上以 root 创建 broker 的账户。该文件只在 broker 启动时读取一次：

```sh
cat > /var/lib/mica/mqtt-broker-users.toml <<'EOF'
[users]
scada = "a-long-random-password"
bridge = "another-long-random-password"
EOF
chown root:mica-mqtt-broker /var/lib/mica/mqtt-broker-users.toml
chmod 0640 /var/lib/mica/mqtt-broker-users.toml
```

桥接也是一个客户端，所以给它一个账户：

```sh
cat > /var/lib/mica/mqttd-credentials.json <<'EOF'
{"username":"bridge","password":"another-long-random-password"}
EOF
chown mica-mqttd:mica-mqttd /var/lib/mica/mqttd-credentials.json
chmod 0600 /var/lib/mica/mqttd-credentials.json
```

然后移动监听并打开认证。`PUT` 会替换整个 `mqtt` 文档：

```sh
curl -s -H "$AUTH" -X PUT $DEV/api/v1/mqtt \
  -H 'content-type: application/json' \
  -d '{"enabled": true, "listen": {"address": "0.0.0.0", "port": 1883}, "auth": {"enabled": true}}'
# {"taskId":"<id>"}
```

micad 重写 `/var/lib/mica/mqtt/broker.toml` 并重启 broker。地址是 IPv4 或 IPv6 字面量；`0.0.0.0` 表示所有 IPv4 地址，
也可以写某个接口的地址。在回环以外不认证地监听是允许的，会记录一条警告；不要这样做。流量是普通 MQTT：让它留在你信任
的网络上，或经 WireGuard 传输（[网络](../operate/network.md)第 9 节）。

之后再修改任一账户文件时，重启读取它的服务：`systemctl restart mica-mqtt-broker` 或 `mica-mqttd`（OpenRC 上是
`rc-service ... restart`）。

> status: shipped — evidence: `mica-pkgs:docs/mica-pkgs.md`, `mica-core:crates/mica-apid/src/routes/mqtt.rs`

## 3. 连接客户端并检查是否生效

桥接的主题带有设备 id，即每个主题的第二级。在设备上读取：

```sh
cat /var/lib/mica/mqtt/mqttd-device.env
# MICA_MQTT_DEVICE_ID=00112233445566778899aabbccddeeff
```

在工作站上订阅设备发布的一切，然后用 keepalive 请求一次完整发布：

```sh
mosquitto_sub -h mica-a4e2e69e.local -u scada -P 'a-long-random-password' -t 'N/#' -v &
mosquitto_pub -h mica-a4e2e69e.local -u scada -P 'a-long-random-password' \
  -t R/00112233445566778899aabbccddeeff/keepalive -n
```

你会在 60 秒内每 3 秒看到一次 `N/<deviceId>/heartbeat`，每个已登记应用的保留值，以及全部发出后的
`N/<deviceId>/full_publish_completed`。这就是检查：有心跳就说明 broker、桥接和你的凭据都正常。要保持窗口打开，在一分钟
内再发一次 keepalive。

> status: shipped — evidence: `docs/integrate/bus.md`, `mica-pkgs:docs/mica-pkgs.md`

## 4. 主题

```text
N/<deviceId>/<class>/<instance>/<path>   设备 -> 你：一个值，保留
R/<deviceId>/<class>/<instance>/<path>   你 -> 设备：重新发布这个值
W/<deviceId>/<class>/<instance>/<path>   你 -> 设备：写入它（仅 full 模式）
R/<deviceId>/keepalive                   你 -> 设备：打开 60 秒窗口，全部重新发布
N/<deviceId>/heartbeat                   设备 -> 你：窗口打开期间每 3 秒一次
N/<deviceId>/full_publish_completed      设备 -> 你：重新发布完成
```

值的载荷是 JSON，`{"value": 42}`，应用给出时还带 `min` 和 `max`。写入带 `{"value": ...}`；没有确认主题，新的 `N` 值
就是回答。桥接默认是 `read-only`，不接受写入；要允许写入，在 `/var/lib/mica/mqttd.env` 中设置 `MICA_MQTT_MODE=full`
并重启 `mica-mqttd`。该文件还可以指定另一个 broker（`MICA_MQTT_BROKER_HOST`、`MICA_MQTT_BROKER_PORT`）或客户端 id
（`MICA_MQTT_CLIENT_ID`）。

> status: shipped — evidence: `docs/integrate/bus.md`, `mica-pkgs:docs/mica-pkgs.md`

## 5. 让你的应用的值上 MQTT

应用要上 MQTT，需要成为桥接被允许读取的总线服务，由它自己的软件包完成：

1. 它拥有 D-Bus 名称 `com.mica.<class>[.<suffix>]`，例如 `com.mica.tank`，并在 `/` 提供 `com.mica.Item1`
   （`GetItems`、`SetValue`、`ItemsChanged`）（[总线](bus.md)第 2 节）。
2. 它的软件包安装一个以该名称命名的空文件 `/usr/lib/mica/mqtt-applications.d/com.mica.tank`，以及允许 `mica-mqttd`
   对这一个名称调用 `com.mica.Item1` 的 D-Bus 策略（[总线](bus.md)第 3 节）。
3. 桥接重启后，它的条目以 `N/<deviceId>/tank/<instance>/<path>` 出现。

`com.mica.micad` 永远不能登记，不符合规则的名称会让桥接无法启动。两个应用声明同一个 `<class>/<instance>` 时，两者都被
扣下，直到其中一个离开（[总线](bus.md)第 5 节）。想用 MQTT 的容器像任何客户端一样直接连接 broker。

> status: shipped — evidence: `mica-pkgs:docs/mica-pkgs.md`, `docs/integrate/bus.md`

## 6. 可能出现的问题

| 你看到 | 原因 | 解决 |
|---|---|---|
| 工作站上 `Connection refused` | broker 只监听回环，或 MQTT 未打开 | 第 2 节 |
| `not authorised` / 用户名或密码错误 | 不在 `mqtt-broker-users.toml` 中，或 broker 尚未重新读取 | 修正文件，重启 `mica-mqtt-broker` |
| 打开认证后所有连接都被拒绝 | 用户文件缺失、`mica-mqtt-broker` 无法读取，或没有 `[users]` 表 | 第 2 节 |
| keepalive 后没有心跳 | 桥接没有运行，或无法登录 broker | `curl $DEV/api/v1/system/logs/mqttd` 和 `.../mqtt-broker`；确认 `mqttd-credentials.json` 为 `0600`、属主 `mica-mqttd` |
| 桥接无法启动 | 凭据文件格式错误或可被他人读取，或 `mqtt-applications.d` 中有不合规的名称 | 读 `mqttd` 日志 |
| 有心跳但没有应用主题 | 没有登记任何应用，或两个应用冲突 | 第 5 节 |
| `W` 没有效果 | 桥接是 `read-only` | `MICA_MQTT_MODE=full` |
| `/api/v1/mqtt` 返回 404 | 产品没有 MQTT | 上面列出的产品 |

> status: shipped — evidence: `mica-pkgs:docs/mica-pkgs.md`, `mica-core:crates/micad/src/logs.rs`
