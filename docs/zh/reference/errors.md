# 错误代码

`/api/` 下的每个失败都是同一个 JSON 封套：

```json
{ "error": { "code": "…", "message": "…", "source": "apid", "path": null, "params": null } }
```

`code` 是稳定的，程序应据此分支；`message` 是给人看的句子，可能变化；`source` 说明是谁拒绝的（`apid`
是 API 服务器，`micad` 是其后的守护进程）；有相关设置或字段时 `path` 指明它；`params` 携带消息中提到的值。
被拒绝的网络写入在 `details` 中列出每条违反的规则，被拒绝的 Compose 文件在 `problems` 中列出每个问题。本页
列出这些代码，来源是 core 0.0.9（`20261124-0755`）的 `mica-core:crates/mica-apid/src` 和
`mica-core:docs/mica-core.md`。相关行为见 [API 页](api.md)。

## apid 返回的代码

| 代码 | 状态 | 来源 | 含义与处理 |
|---|---|---|---|
| `request_invalid` | 400 | apid | 请求体不是该路由接受的 JSON；修正请求 |
| `archive_invalid` | 400 | apid | 上传的更新归档不是 `MICAUPD1` 归档 |
| `invalid_credentials` | 401 | apid | 登录密码错误 |
| `not_authenticated` | 401 | apid | 没有会话或令牌，或已过期；重新登录 |
| `csrf_invalid` | 403 | apid | 浏览器写操作没有带会话的 `X-CSRF-Token` |
| `device_code_incorrect` | 403 | apid | 认领时设备码不匹配；计入登录退避 |
| `wrong_password` | 403 | apid | 修改密码时当前密码错误；计入退避 |
| `not_allowed` | 403 | apid | 本地套接字上的非 root 调用方 |
| `authenticated_session` | 403 | apid | 带着会话或令牌调用凭据恢复；凭据恢复只凭物理在场授权，请改用修改密码 |
| `presence_required` | 403 | apid | 凭据恢复没有物理在场的证明（[恢复](recovery.md#4-物理在场)） |
| `not_found`、`settings_not_found`、`task_not_found`、`snapshot_not_found` | 404 | apid、micad | 没有该路由、设置路径、任务或诊断快照；产品不具备的特性的所有路由也是如此 |
| `media_not_found`、`media_device_not_found` | 404 | apid | 当前没有该 id 的卷或设备（设备重新插入后 id 会变） |
| `method_not_allowed` | 405 | apid | 路径存在，方法不存在 |
| `already_configured` | 409 | apid | 在已有管理员的设备上执行设置 |
| `setup_required` | 409 | apid | 首次设置之前登录 |
| `rotation_required` | 409 | apid | 设备是用引导凭据认领的；在任何其他写操作之前先修改密码 |
| `not_claimed` | 409 | apid | 在未认领的设备上出厂重置或变更驱动 |
| `version_conflict` | 409 | apid | 网络或对端列表在写入所指的版本之后发生了变化；重新加载后重试 |
| `busy` | 409 | apid | 网络变更仍在应用中；完成后重试 |
| `settings_read_only` | 409 | apid、micad | 该路径不通过这个路由写入 |
| `key_exists`、`key_limit_reached` | 409 | apid | 该 SSH 密钥已授权，或列表已满 |
| `token_limit_reached` | 409 | apid | 已有 32 个 API 令牌；先吊销一个 |
| `peer_exists` | 409 | apid | 已有该公钥的 WireGuard 对端；请改为编辑它 |
| `record_duplicate`、`record_limit` | 409 | apid | DNS 静态记录的 id 或名称重复，或已有 100 条 |
| `ssid_exists` | 409 | apid | 已知网络中已有该 SSID |
| `media_busy` | 409 | apid | 卷上有打开的文件；关闭后重试 |
| `media_device_busy` | 409 | apid | 设备无法弹出；`params.items` 给出每个卷的 `reason` |
| `diagnostics_busy` | 409 | apid | 正在生成诊断快照 |
| `custom_ui_unavailable` | 409 | apid | 没有保留的自定义控制台通过安全和 API 检查 |
| `target_changed` | 409 | apid | 回滚目标已不是调用方确认过的 `expectedTarget` |
| `policy_refused` | 409 | micad | 更新策略此刻拒绝该请求（在所有窗口之外、按流量计费的链路等）；消息说明原因 |
| `power_refused` | 409 | micad | 重启或关机被拒绝，附原因 |
| `validation_failed` | 422 | apid、micad | 值违反规则；`path` 指明字段 |
| `settings_rejected` | 422 | micad | 设置树拒绝了写入；消息引用规则（WireGuard 规则把代码放在开头） |
| `compose_invalid` | 422 | apid | 该 Compose 文件不是 mica-containerd 能运行的；见 `problems` |
| `dns_server_invalid` | 422 | apid | DNS 服务器不是可用的地址 |
| `channel_not_allowed` | 422 | apid | 该国家不允许这个接入点频道；见 `params.channel` |
| `wifi_country_unconfirmed` | 422 | apid | 变更会改变射频的国家；带 `countryConfirmed: true` 重新发送 |
| `not_supported` | 422 | apid | 射频或适配器做不到（WPA3 接入点、固定蓝牙 PIN） |
| `invalid_duration` | 422 | apid | BLE 配置窗口只能是 300、600 或 1800 秒 |
| `wifi_locked` | 423 | micad | BLE 配置占用射频；等它的窗口关闭 |
| `login_throttled` | 429 | apid | 秘密错误后的持久退避，最多 300 秒；请等待 |
| `settings_invalid`、`encoding_failed`、`hash_failed`、`hashing_failed`、`mint_failed`、`identity_unreadable`、`identity_write_failed`、`diagnostics_io`、`publish_failed`、`ui_activation_failed`、`ui_deactivation_failed`、`ui_status_failed`、`configuration_unavailable`、`baked_configuration_unavailable`、`settings_io`、`micad_failed` | 500 | apid、micad | 内部故障；除非消息另有说明，没有任何改动。请采集诊断快照（[排障](../operate/troubleshooting.md)） |
| `micad_unreachable` | 503 | apid | micad 不在总线上；检查它是否在运行（[micad](management.md#检查-micad)） |
| `device_code_unavailable` | 503 | apid | 设备声明了读不到的 `random` 设备码；无法认领 |
| `tzdata_unavailable` | 503 | apid | 设备没有可列出的时区数据 |
| `micad_timeout` | 504 | apid | micad 没有及时回答；请求可能仍会完成 |

## 来自 micad 回答和规则检查的代码

这些代码由 micad 的回答或规则检查带出，而不是写在某个路由里，所以上表没有列出。

| 代码 | 状态 | 何时 |
|---|---|---|
| `password_required` | — | 非 uid 0 的调用方给了空的管理员密码，micad 拒绝；通过 API 时空密码已经是 422 `validation_failed` |
| `password_incorrect` | 403 | 出厂重置或驱动变更时管理员密码错误 |
| `factory_reset_unsupported`、`data_encrypted`、`update_in_progress`、`trial_pending` | 409 | 出厂重置的拒绝（[micad](management.md#出厂重置的拒绝)） |
| `media_candidate_changed` | 409 | 介质上的更新归档已不是列出时的那个文件 |
| `media_removed` | 404 | 介质已拔出，或复制过程中读取失败 |
| `archive_too_large` | — | 列出的归档超过上传上限（`importable: false`） |
| 带 `details` 的 `validation_failed` | 422 | 被拒绝的网络映射；每条违反的规则是一个 `details` 项 `{interface, field, code, params}`，带自己的代码（见下） |
| `wireguard_default_route_unsupported`、`wireguard_prefix_invalid`、`wireguard_address_missing`、`wireguard_peer_prefix_conflict`、`wireguard_route_conflict`、`wireguard_endpoint_route_loop` | 422（`settings_rejected`） | WireGuard 对端路由规则，代码在消息开头（[API](api.md#34-wireguard-对端)） |

### `details` 中的网络规则代码

| 代码 | 规则 |
|---|---|
| `name_invalid` | 键不是接口名 |
| `address_overlap` | 两个子网重叠 |
| `gateway_out_of_subnet` | 网关不在其子网内 |
| `gateway_not_allowed` | 在 `internet: false` 的接口上设置静态网关或 `0.0.0.0/0` 路由 |
| `metric_duplicate` | 两条默认路由度量相同 |
| `route_metric_reserved` | 默认路由的度量小于 20，这一段留给设备自己的路由（0.0.9） |
| `probe_not_allowed` | 在不承载默认路由的条目、隧道或 CAN 控制器上配置可达性检查（0.0.9） |
| `probe_targets` | 目标超过四个，或有重复（0.0.9） |
| `probe_address`、`probe_method`、`probe_port` | 目标不是 IPv4 单播地址或 `gateway`，方法不是 `icmp` 或 `tcp`，或端口不在 1 到 65535 内或用于 `icmp`（0.0.9） |
| `probe_interval`、`probe_timeout`、`probe_threshold` | 间隔不在 2 到 300 秒内，超时不在 200 到 10 000 毫秒内或不小于间隔，阈值超出范围（0.0.9） |
| `vlan_duplicate` | 同一父接口上同一 VLAN id 出现两次 |
| `vlan_parent_invalid` | VLAN 父接口未声明或是 CAN |
| `vlan_parent_unsupported` | 未声明的 VLAN 父接口，其镜像配置无法被采纳 |
| `bridge_port_invalid`、`bridge_port_addressed`、`bridge_port_taken` | 网桥端口未声明或是 CAN、带有寻址、或被占用两次 |
| `port_in_use` | 隧道的监听端口已被另一条隧道声明或被设备上的服务占用；从 0.0.9 起每次网络写入都会检查，不只是 WireGuard 路由 |
| `in_use` | 另一个条目依赖这个条目 |
| `validation_failed` | 字段本身的语法 |

## D-Bus 错误

总线上 `com.mica.micad1` 的调用方会看到这些错误名：

| 错误 | 何时 |
|---|---|
| `org.freedesktop.DBus.Error.InvalidArgs` | 设置树拒绝了该值 |
| `com.mica.micad1.Error.AlreadyClaimed` | 第二次认领 |
| `com.mica.micad1.Error.WifiLocked` | BLE 配置占用射频时对 `wifi` 的写入 |
| `com.mica.micad1.Error.FactoryResetRefused` | 出厂重置被拒绝；描述为 `{code, message}` |
| `com.mica.micad1.Error.DriversRefused` | owner 证书或驱动扩展变更被拒绝；描述为 `{code, message}` |

## 更新的拒绝

更新安装、回滚或导入的拒绝在更新状态中报告，由部署客户端命名；回滚的原因有 `candidate_pending`、
`running_not_confirmed` 和 `no_usable_fallback`，系统更新也可能在等待驱动构建（`waitsForExtension`）。见
[更新引擎](updates.md)，以及运维者会遇到的每种拒绝：[更新指南](../operate/updates.md#7-拒绝)。
