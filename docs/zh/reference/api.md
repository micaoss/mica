# 管理 API 与 UI 托管

`apid` 负责监听（默认明文 HTTP 8080；`access.web` 打开后在 8443 提供 HTTPS，使用每台设备自己的或上传的
证书；`local` Web 模式下只有 root 所属的套接字 `/run/mica/apid.sock`）、认证、JSON 管理 API 和静态 UI
托管。它是 micad 的可执行文件换了个名字，位于 micad 的 core 组件中。`micad` 通过 D-Bus 负责设置、调和和
系统操作。生成的 OpenAPI 文档（`mica-core:crates/mica-apid/openapi.json`）是操作和模式的契约。本页解释
归属与行为，不重复路由清单。

## 1. 运行时边界

设备上分别运行 `micad` 和 `apid` 两个服务，systemd 或 OpenRC 均可。API 处理程序通过有类型的设置/总线
客户端完成管理操作。MQTT 只承载由软件包登记的应用条目树，不能通过总线调用这个管理 API。见
[管理平面](management.md)和[总线](../../integrate/bus.md)。

`/api` 负责管理操作、发现、认证和 API 错误。`/healthz` 只检查监听器，不是设备健康的结论。`/_ui/` 始终
提供内置控制台。`/` 提供有效的已选自定义 UI，否则重定向到内置控制台。

### 1.1 谁能访问：Web 模式

由 `access.web.mode` 决定，`GET /api/v1/meta` 以 `webMode` 报告：

| 模式 | apid | 提供 |
|---|---|---|
| `network`（默认） | 运行 | 下面的监听器和本地套接字 |
| `local` | 运行 | 仅本地套接字：设备上的 root |
| `off` | 不运行 | 什么都没有 |

不在 `network` 模式时，没有控制台、没有 HTTP API、接入点上没有设置页，也不使用 bearer 令牌；micad 及其
驱动的东西（健康闸门、更新、SSH、MQTT、BLE 配置、用户服务）不受影响。回到 `network` 的途径是设备上的
root（SSH 开启时可经 SSH）、配置文档或重置。

### 1.2 监听器与 HTTPS 身份

在 `network` 模式下，apid 按 `access.web` 监听（`GET`/`PUT /api/v1/web`），启动时从 `/run/mica/apid.json`
读取：默认只有明文 HTTP 8080、没有 HTTPS，所以不会占用其他服务需要的 80 和 443。开启 `httpsEnabled` 后，
它在 `httpsPort`（默认 8443）上提供 HTTPS，HTTP 端口只做重定向；恰在此时会话 cookie 带 `Secure`。被另一个
已启用的监听器（SSH、MQTT）占用的端口会被拒绝。变更会让 apid 在新的监听器上重启，或停止。

HTTPS 身份是 apid 状态目录中的 `identity.pem`，证书链和私钥在同一个 `0600` 文件中，在第一次提供 HTTPS 时
自签名生成（`mica`、`localhost`、`127.0.0.1`）。`/api/v1/web/certificate` 描述它（从不包括私钥），并可用
上传的证书链和私钥替换，两者必须匹配且在有效期内；`/api/v1/web/certificate/generate` 按给定的名称和
天数生成新的自签名证书。两者都从下一个连接起生效，无需重启。配置重置会删除它。

| 变量 | 默认值 | 含义 |
|---|---|---|
| `APID_LISTENERS_FILE` | `/run/mica/apid.json` | 渲染好的 `access.web` |
| `APID_HTTPS_ADDR`、`APID_HTTP_ADDR` | 未设置 | 覆盖该文件 |
| `APID_STATE_DIR` | `/var/lib/mica/apid` | TLS 身份、会话密钥、登录退避、审计环 |
| `APID_BUS` | `system` | micad 所在的总线 |
| `APID_UI_DIR` | `/usr/share/mica-apid/ui` | 在 `/_ui/` 提供的内置控制台 |
| `APID_LOCAL_SOCKET` | `/run/mica/apid.sock` | 供设备上 root 使用的 API |

`mica-apid --version`、`--openapi`（提交的模式）和 `--healthcheck`（供启动健康闸门使用；在本地套接字上
询问 `/healthz`，模式为 `off` 时不询问直接通过）不启动守护进程即可回答。

### 1.3 URL 空间

| 路径 | 内容 |
|---|---|
| `/api/v1/...` | API；`/api/versions` 列出提供的版本 |
| `/healthz` | 监听器存活，无需认证 |
| `/api/v1/health` | 一次实时总线调用得到的 micad 状态；需要认证，始终返回 200，结论在响应体中 |
| `/ssdp/device.xml` | UPnP 描述 |
| `/_ui/` | 内置控制台（没有 `mica-apid-ui` 包时为 404） |
| `/` | 当前的自定义控制台包，或重定向到 `/_ui/` |

### 1.4 本地套接字

apid 运行时也在 `/run/mica/apid.sock` 上提供 API。这里的调用方不带凭据：内核的对端凭据给出其 uid，只有
root 能调用（其他 uid 为 403 `not_allowed`），套接字为 `0600`。root 不需要设备码，修改密码时也不需要当前
密码；请求以来源 `local uid 0` 记入审计。

## 2. 资源与操作

### 2.1 设置、观测与任务

配置描述的是请求的状态。观测描述的是设备当前报告的状态。网络观测把已配置的接口与 `systemd-networkd`
的状态结合起来；观测失败时会明确报告，同时保留可读的配置。接口的顶层字段经过规范化；嵌套的地址、DNS
和路由数组保留 networkd 的用词。

被接受的设置修改返回一个应用任务。客户端应观察其 ID 和最终结果，而不是把 HTTP 接受当作应用成功。有界
的应用队列可以把相关写入合并进一个更大的任务；返回的 ID、结果和任务元数据描述的是这次接纳。任务历史
有界，被中断的任务不会被悄悄报告为成功。

电源、更新、重置和凭据操作有各自的有类型路由和策略检查。原生部署状态和回滚拒绝见[更新](updates.md)。
固件维护是单独的操作，见[发布签名](../security/signing.md)。

电源操作只在 micad 接纳请求后才返回 202。策略或权限拒绝返回 409 `power_refused` 及原因；分发失败、
micad 不可用和超时分别返回 500、503 和 504。接受并不证明重启已经完成。控制台关闭确认框以显示这个结果，
并且不会自动重试电源操作。

### 2.2 错误与遮蔽

API 错误使用公布的 JSON 封套，包括未匹配的 API 路径和不支持的方法：

```json
{
  "error": {
    "code": "version_conflict",
    "message": "…",
    "source": "…",
    "path": null,
    "params": { }
  }
}
```

`code` 是稳定的，供程序使用；`message` 给人看；`params` 携带消息中提到的值。被拒绝的网络写入还会在
`details` 中列出它违反的每条规则（按接口和字段），被拒绝的 Compose 文件在 `problems` 中列出每个问题。

| 状态码 | 含义 |
|---|---|
| 202 | 已接受；设置写入返回 `{"taskId": "…"}`，在 `GET /api/v1/tasks/{id}` 跟进 |
| 400 | 请求格式错误 |
| 401 | 没有会话或令牌，或已过期 |
| 403 | 秘密错误（`device_code_incorrect`、`wrong_password`、`password_incorrect`）或不被允许（`not_allowed`） |
| 404 | 没有该资源，或产品不具备该特性 |
| 409 | 状态上的拒绝：`version_conflict`、`power_refused`、`media_busy`、`media_device_busy`、micad 的出厂重置和驱动拒绝等 |
| 422 | 值违反规则，指明字段 |
| 423 | `wifi_locked`：BLE 配置占用射频 |
| 429 | `login_throttled`：秘密错误后的持久退避，最多 300 秒 |
| 500、503、504 | 分发失败、micad 不可用、micad 超时 |

数据缺失、总线观测失败和不支持的能力是不同的结果。来源不可用时，响应不会编造健康的默认值。

设置读取和诊断在管理边界上遮蔽秘密。密码、密码哈希、私钥和令牌材料不会通过一般的设置或诊断响应返回。
专用的写操作在转发修改之前校验所支持的路径和形状。

## 3. 认证

`GET /api/v1/session` 报告会话/设置状态。密码登录创建签名的会话 cookie；浏览器的修改请求还需要每个会话
的 `X-CSRF-Token`。存储的 bearer 令牌用于自动化，不使用 CSRF。凭据和令牌操作遵循生成的模式和
[访问策略](access.md)。

内置 SPA 使用相对根的 `/api/...` 请求，不在浏览器存储中保存会话或 bearer 凭据。持久的登录退避和有界的
审计记录在服务重启后仍然保留。恢复流程在[在场闸门](recovery.md#4-物理在场)下轮换
凭据，从不泄露凭据。安全相关的操作记入 apid 状态目录中的审计环。

TLS 证书和私钥作为一个私有的 `identity.pem` 一起发布。在报告发布成功之前，文件和目录同步已经完成。cookie
签名密钥也持久保存。首次启动被中断不得留下与缺失或写了一半的私钥配对的证书。

### 3.1 认领与登录

在管理员密码存在之前，由 `POST /api/v1/setup`（`{password, hostname?, network?, deviceCode?}`）设置。在有
设备码的设备上，网络调用方在请求体中以 `deviceCode` 携带设备码（忽略短横线、空格和大小写）；设备码在
标签上、设备自己的控制台和登录提示中。缺少设备码为 422（`deviceCode`），错误为 403
`device_code_incorrect` 并计入登录退避（429 `login_throttled`）。声明了 `random` 设备码却读不到它的设备
不能被认领：503 `device_code_unavailable`。产品为 `CLAIM_DEVICE_CODE=off` 时不需要设备码即可认领。处于
设置状态时，`GET /api/v1/session` 携带 `deviceCode`，值为 `required` 或 `off`。认领不设置接入点密钥。

浏览器用密码换取 HMAC 签名、HttpOnly 的会话 cookie（`POST /api/v1/session` `{password}`，201），并在每次
修改时以 `X-CSRF-Token` 发送会话的 CSRF 令牌（`GET /api/v1/session` 返回的 `csrfToken`）。自动化使用
bearer 令牌：`POST /api/v1/tokens` `{name}` 返回 `{id, name, token}`，完整令牌 `mica_<id>_<secret>` 只出现
这一次；只存储其 SHA-256 摘要，最多 32 个，`DELETE /api/v1/tokens/{id}` 吊销。密码使用 argon2id。

`POST /api/v1/actions/change-password` `{currentPassword, newPassword}` 要求当前密码：缺少为 422，错误为
403 `wrong_password` 并计入同一个退避。

使用令牌的完整示例（设备在 `192.168.1.50`）：

```sh
# 先用会话创建令牌
curl -s -c jar -H 'Content-Type: application/json' \
  -d '{"password":"…"}' http://192.168.1.50:8080/api/v1/session
csrf=$(curl -s -b jar http://192.168.1.50:8080/api/v1/session | jq -r .csrfToken)
curl -s -b jar -H "X-CSRF-Token: $csrf" -H 'Content-Type: application/json' \
  -d '{"name":"fleet"}' http://192.168.1.50:8080/api/v1/tokens
# {"id":"…","name":"fleet","token":"mica_…_…"}

# 然后自动化使用令牌：设置时区并跟进任务
T=mica_…_…
curl -s -X PUT -H "Authorization: Bearer $T" -H 'Content-Type: application/json' \
  -d '"Europe/Athens"' http://192.168.1.50:8080/api/v1/settings/time.timezone
# {"taskId":"…"}
curl -s -H "Authorization: Bearer $T" http://192.168.1.50:8080/api/v1/tasks/<taskId>
# … "phase":"applied" …
```

### 3.2 出厂重置

`POST /api/v1/system/factory-reset` `{password}` 不论凭据如何都要求管理员密码，micad 暂存后返回 202
`{"applies": "reboot"}`。空密码为 422；错误为 403 `password_incorrect`（退避中为 429 `login_throttled`）；
micad 的拒绝为 409 及其代码（`not_claimed`、`update_in_progress`、`trial_pending`、`data_encrypted`、
`factory_reset_unsupported`；见 [micad](management.md#出厂重置的拒绝)）。`GET` 返回 `supported`、当前的
`refusal` 和上次完成的重置 `last`。对 `/api/v1/reset` 请求 `full-factory` 层级会返回 422 并指向这个路由。

### 3.3 owner 证书与驱动扩展

`GET /api/v1/system/owner-certs` 和 `GET /api/v1/system/extensions` 列出它们。每次变更都要求管理员密码
（403 `password_incorrect`、429 `login_throttled`、409 `not_claimed`），并返回 202 和 `drivers.apply` 任务
id；下次启动生效。

| 路由 | 请求体 |
|---|---|
| `POST /api/v1/system/owner-certs` | `{password, certificate}`：base64 编码的 PEM 或 DER，最多 64 KiB |
| `DELETE /api/v1/system/owner-certs/{sha256}` | `{password}` |
| `POST /api/v1/system/extensions` | multipart：`password`，加上 `archive`（`MICAUPD1`）或 `descriptor`、`image`、`signature` 之一；最多 256 MiB |
| `DELETE /api/v1/system/extensions/{name}` | `{password}` |
| `POST /api/v1/system/extensions/{name}/drop` | `{password, kernel}` |

### 3.4 WireGuard 对端

`/api/v1/network/{iface}/peers` 列出、添加、原地编辑（`PUT …/peers/{publicKey}`）和删除隧道的对端，每次
写入在返回前应用。列表的 `ETag` 是网络版本：添加或编辑时以 `baseVersion` 给出，删除时以 `If-Match` 给出；
此后有变化的映射会被拒绝，409 `version_conflict`。每个列出的对端还带有内核的视图：`latestHandshake`、
`rxBytes`、`txBytes`、`operationalState`（`ready`、`pending_endpoint_resolution`、`endpoint_route_loop`）、
`routesReady` 和 `unroutedIps`。`GET /api/v1/network/wireguard/defaults` 建议第一个空闲的 `wg<N>`、
`10.<N>.0.1/24` 以及从 51821 起的监听端口。

对端变更被拒绝时为 `settings_rejected`，规则代码放在消息开头：

| 代码 | 规则 |
|---|---|
| `wireguard_default_route_unsupported` | `/0` 的 allowed IP |
| `wireguard_prefix_invalid` | 回环、组播、链路本地、未指定或广播 |
| `wireguard_address_missing` | 隧道没有该前缀所属地址族的地址 |
| `wireguard_peer_prefix_conflict` | 同一前缀在该隧道的另一个对端上 |
| `wireguard_route_conflict` | 与另一条隧道的前缀、另一个条目的子网或路由重叠 |
| `wireguard_endpoint_route_loop` | 数字端点会被隧道前缀承载 |
| `port_in_use` | 监听端口属于另一条隧道，或被设备上的某个 UDP 套接字占用 |

### 3.5 外接介质与更新归档

| 路由 | 返回 |
|---|---|
| `GET /api/v1/storage/media` | `supported`，以及每个 USB 或 SD 设备的每个卷一项（[存储](storage.md#外接介质)） |
| `POST /api/v1/storage/media/{id}/unmount` | 卸载一个卷；409 `media_busy`，404 `media_not_found` |
| `POST /api/v1/storage/media/devices/{deviceId}/eject` | 为拔出设备做准备；409 `media_device_busy` 附每个卷的 `reason`，404 `media_device_not_found` |
| `GET /api/v1/update/media` | 卷根目录和 `mica-updates/` 中的 `*.micaupd` 文件，每卷最多 100 个；超过上传上限的 `importable` 为 false（`archive_too_large`） |
| `POST /api/v1/update/media/import` | `{mediaId, candidateId}`；202，结果在更新状态中；409 `media_candidate_changed`，404 `media_removed` |

## 4. 静态托管

API、内置和自定义资源根相互隔离。一个根中找不到不会落到另一个根。逻辑路径只解码一次并在查找前校验；
路径穿越、编码的分隔符、控制字符和保留根的别名都会被拒绝。SPA 回退留在所选的资源根内。

`apid/build.rs` 嵌入软件包生产者提供的完整前端构建。`index.html` 是稳定的入口；带内容哈希的路由、语言
和第三方分块各自可寻址、可缓存。前端构建及其依赖锁在 `mica-core:crates/mica-apid/ui/` 下。

## 5. 自定义 UI 的生命周期

经认证的上传把有界的原始 ZIP 流式写入 `/mica/ui`，校验其清单和路径，并原子地安装为一个保留的代。安装
不会激活它。激活会再次检查并选中所请求的那一代；删除选择会回到内置 UI。只有未激活的代可以删除。保留
需要显式操作。

安装自定义 UI 不会替换根文件系统，也不会登记系统信任密钥。UI 归档与签名的系统 `.micaupd` 归档是两回事。
打包说明见[应用指南](../integrate/applications.md)。

## 6. 内置恢复与验证

即使自定义 UI 缺失、无效或损坏，`/_ui/` 也始终可达。自定义内容不能遮住这个前缀或 API。内置控制台的
资源位于其经 verity 签名的 core 组件（`mica-apid-ui`）中，与 DATA 上的 UI 选择无关。

Rust 路由和总线测试验证认证、路径隔离、校验和任务行为。OpenAPI 生成闸门对照二进制检查提交的模式。API
测试套件（`mica-build:tests/suites/apid-api/README.md`）在全新的当前 QEMU 镜像上测试完整的服务栈，结果写入
`_out/<board>/apid-api/result.json`。
