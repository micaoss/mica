# API 参考

Mica OS 管理 API 由一份机器可读契约规定：**`mica-core:crates/mica-apid/openapi.json`**。
它从服务这些路由的同一份代码生成，CI 保证它与随附二进制报告的内容一致——
因此它不会像手写端点清单那样偏离设备。本页刻意不复制端点清单；它告诉你
契约在哪里，并陈述 schema 本身表达不了的事实。

> status: shipped — evidence: `mica-core:crates/mica-apid/openapi.json`

## 1. 一段话说清这个面

apid 默认在 8080 端口提供明文 HTTP，开启后（`PUT /api/v1/web`）在 8443 端口提供 HTTPS，
HTTP 随之只做重定向；`/api` 是完整的管理协议：
带版本的设置与状态读取、类型化写入、排队的任务记录、初始设置与会话生命
周期、UI 选择、实时网络观察、更新状态和系统动作。错误是 JSON 信封。
`/healthz` 是 `/api` 之外唯一的运维例外，它只证明 apid 进程在监听——
不证明 micad 或其他任何东西健康。`/_ui/` 上的内置浏览器 UI 是同一 API 的
普通客户端，没有特权旁路。

> status: shipped — evidence: `mica-core:crates/mica-apid/openapi.json`, `docs/reference/remote.md`

## 2. 认证

两种凭据形态，都定义在契约里：

- **浏览器会话**——在会话路由用密码登录，得到一个签名的
  `HttpOnly; Secure` cookie 加每会话 CSRF token；基于会话的变更操作必须
  在 `X-CSRF-Token` 里携带该 token。
- **Bearer token**——面向自动化；存储的 token 认证 API 调用，无需 CSRF。
  初始设置不生成 token：它返回一个浏览器会话及其 CSRF 令牌，token 之后再生成
  （`POST /api/v1/tokens`、控制台的访问页，或在设备上以 root 执行
  `mica tokens create`）。

设置状态发现与会话状态（`GET /api/v1/session`）是仅有的免认证操作；读取
或改变设备状态的一切都需要上述凭据之一。登录尝试有持久退避的限速并被
审计（[../security/overview.md](../security/overview.md)）。

> status: shipped — evidence: `mica-core:crates/mica-apid/openapi.json`, `docs/reference/access.md`

## 3. 版本化

API 当前使用 `/api/v1/...`。系统开发阶段默认不保证不同构建之间的兼容性，除非明确
要求。请使用目标镜像对应的 OpenAPI 契约；CI 校验仓库中的契约与二进制输出一致。
当前策略不要求为破坏性变更添加第二套版本路由或兼容适配器
（[../contributing.md](../contributing.md)）。

> status: shipped — evidence: `mica-core:crates/mica-apid/openapi.json`, `docs/reference/api.md`

## 4. 什么不是公开 API

- **D-Bus 接口 `com.mica.micad1`** 是 apid 与 micad（以及启动健康门）之间的
  本地 IPC 边界。它在设备上按策略仅 root 可用，不是受支持的集成面；请
  通过 HTTPS 集成。
- **MQTT** 是应用数据面，不是管理通道：只有由软件包登记的应用服务被
  桥接，管理状态与动作在结构上被排除。语法与登记契约见
  [../../integrate/bus.md](../integrate/bus.md)。
- **`/_ui` 与自定义 UI 资源**是静态内容，不是契约；自定义 bundle 无法
  遮蔽 `/api` 路由。

> status: shipped — evidence: `docs/integrate/bus.md`, `mica-core:crates/micad/dist/`

## 5. 试一试

API 验收套件在 QEMU 里启动 uefi-x64 镜像，通过真实套接字驱动契约的每个阶段——
它也是这个面端到端行为（包括 TLS、重定向与认证门控）的参考：

```sh
bash tests/suites/apid-api/run.sh      # 在 mica-build 检出目录中
```

> status: shipped — evidence: `mica-build:tests/suites/apid-api/run.sh`

## 6. 完整示例：用脚本调用 API

一台在局域网上已认领的设备，以及给脚本生成的 token（[首次启动](../start/first-run.md)
第 7 节，或在设备上以 root 执行 `mica tokens create laptop`）：

```sh
DEV=http://mica-a4e2e69e.local:8080
AUTH="Authorization: Bearer mica_<id>_<secret>"

curl -s $DEV/healthz                                  # 只说明 apid 在监听
curl -s $DEV/api/v1/system/info | jq .error           # 不带 token
# {"code":"not_authenticated","message":"...","source":"apid"}
curl -s -H "$AUTH" $DEV/api/v1/system/info | jq '{board, uptime}'
curl -s -H "$AUTH" -X PUT $DEV/api/v1/settings/time.timezone \
  -H 'content-type: application/json' -d '"Europe/Athens"'
# {"taskId":"<id>"}
curl -s -H "$AUTH" $DEV/api/v1/tasks/<id>
# ... "phase":"applied", "outcome":"succeeded" ...
```

`/api` 下的每个失败都是这一种信封：`error.code` 是脚本据以分支的稳定词，
`error.message` 给人看，`error.source` 说明是 apid 还是 micad 拒绝的，有对应
设置时 `error.path` 会写明。用 token 的写操作不需要 CSRF 头；用浏览器 cookie
做同样的写操作需要 `X-CSRF-Token`。

### 检查是否生效

```sh
curl -s -o /dev/null -w '%{http_code}\n' -H "$AUTH" $DEV/api/v1/settings/time.timezone   # 200
curl -s -H "$AUTH" $DEV/api/v1/settings/time.timezone                                     # "Europe/Athens"
curl -s -H "$AUTH" $DEV/api/v1/tokens | jq -r '.[].name'                                  # laptop 以及其他
```

| 你看到的 | 原因与处理 |
|---|---|
| `401` `not_authenticated` | 没带 token、token 打错或已被吊销：重新生成一个 |
| `403` `csrf_invalid` | cookie 会话没带 `X-CSRF-Token`；改用 token |
| `409` `rotation_required` | 设备是用配置文档认领的：先改密码（[首次启动](../start/first-run.md) 第 4 节） |
| `422` `validation_failed` | 值被拒绝；`error.path` 写明是哪个设置 |
| `503` `micad_unreachable`、`504` `micad_timeout` | apid 在运行而 micad 没有应答；按 `Retry-After` 重试 |
| 8080 连接被拒绝 | Web 模式是 `local` 或 `off`：在设备上执行 `mica web status`；开启 HTTPS 后 8080 只会重定向到 8443（`curl -L`，或 `https://...:8443`） |

路由与请求体以契约为准，而不是本页：`mica-core:crates/mica-apid/openapi.json`，
[HTTP API](../reference/http-api.md) 列出了它们。

> status: shipped — evidence: `mica-core:crates/mica-apid/src/routes/error.rs`, `mica-core:crates/mica-apid/src/routes/credential.rs`, `mica-core:crates/mica-apid/src/routes/tokens.rs`, `mica-core:crates/mica-apid/openapi.json`
