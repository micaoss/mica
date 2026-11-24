# 内置管理控制台

控制台是嵌入在 `apid` 中、在 `/_ui/` 提供的 React/Vite SPA。它是[管理 API](../reference/api.md) 的客户端，没有私有的
管理协议。源码在 `mica-core:crates/mica-apid/ui/`；生成的 OpenAPI 文档定义后端契约。

## 导航与归属

| 区域 | 用途 |
|---|---|
| 概览 | 设备身份、健康状态、局域网发现（mDNS/SSDP）以及有界的运行时摘要 |
| 网络 | 概览、接口（以太网、Wi-Fi、CAN）、Wi-Fi（客户端和接入点）、DNS、路由、带每个对端状态的 WireGuard，以及带配对窗口和 BLE 配置的蓝牙；Wi-Fi 和蓝牙只在具备它们的产品上显示 |
| 服务 | MQTT、容器，以及用户自己的服务（`services.units`）及其日志 |
| 访问 | 运维者凭据、SSH、API 在哪里监听（`network`、`local`、`off`）及其 HTTPS 证书，云产品上的云管理员 |
| 系统 | 带完整性卡片和支持摘要的信息页；更新（自动更新和维护窗口、从上传或 U 盘手动导入、回滚及其结果）；存储（DATA、外接介质、用户的挂载）；驱动（owner 证书和驱动扩展）；时间和时区；日志和服务日志；诊断；帮助（排障指南和本文档的链接）；重置、出厂重置和电源 |
| 系统 / UI 版本 | 上传、保留、激活和删除自定义 UI 的各代版本 |

文件路由在 `src/app/routes/` 下。TanStack Query 持有获取到的服务器状态；表单区分已编辑的值、已接受的写入和
已完成的应用任务。能力和不可用响应决定运维者能用什么。UI 不得把提议中的后端功能呈现为可执行的操作。

## 状态与交互

页面区分初次加载、空数据、保留数据的刷新和观测失败。上一次的快照不能证明当前健康。轮询是有界的；操作会让
相关查询失效，而不是假定成功的写入已在设备上收敛。

更新页面显示经认证的部署/组件身份、获取进度、剩余尝试次数、确认状态以及后端的回滚资格。它们不从版本标签
推断启动状态。固件有独立的签名维护流程以及明确的回读/恢复要求。见[更新](../reference/updates.md)和
[发布签名](../security/signing.md)。

会话中的修改操作会发送 API 的 CSRF 令牌。认证秘密不保存在浏览器存储中。拒绝和任务失败保持可见；重启中或
断开连接的设备不会仅因安装被接受就被报告为更新完成。

## 自定义

运维者在 `/` 选择自定义 UI 时，内置 UI 仍在 `/_ui/` 可用。UI 归档的安装和激活是两个独立的操作，不活动的版本
可以明确删除。见 [API 托管](../reference/api.md#5-自定义-ui-的生命周期)。

[产品设计简报](../reference/built-in-ui-design.md)以成熟度标记记录了更广泛的交互设想。它不定义已发布的能力。

## 开发与验收

UI 使用仓库固定版本的 Bun 构建、React、TanStack Router/Query、Tailwind 和 shadcn 组件。面向用户的文案由语言
资源负责。前端闸门是在 `mica-core` 中运行 `bash crates/mica-apid/ui/build.sh --check`。构建输出交给 Rust/软件包
生产者；它不提交到源码中。

组件测试覆盖状态和操作行为。浏览器验收检查渲染出的流程，完整镜像的 API 验收检查真实的服务契约。硬件行为与
浏览器和 mock 证据分开。

## 完整示例：通过 HTTPS 访问控制台

一台在局域网上已认领的设备和一个 API token（或者用控制台的访问页，它发出的是同样
的请求）：

```sh
DEV=http://mica-a4e2e69e.local:8080
AUTH="Authorization: Bearer mica_<id>_<secret>"
curl -s -H "$AUTH" $DEV/api/v1/web
# {"mode":"network","httpPort":8080,"httpsEnabled":false,"httpsPort":8443}
curl -s -H "$AUTH" -X PUT $DEV/api/v1/web -H 'content-type: application/json' \
  -d '{"mode":"network","httpPort":8080,"httpsEnabled":true,"httpsPort":8443}'
# {"taskId":"<id>"}
```

`PUT` 会替换整个 `access.web` 子树，所以每个字段都要发。apid 会在新的监听上重启，
当前连接随之断开；之后控制台在 `https://mica-a4e2e69e.local:8443/_ui/`，使用设备
自己生成的证书，浏览器首次访问时会警告。

### 检查是否生效

```sh
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' $DEV/_ui/
# 308 https://mica-a4e2e69e.local:8443/_ui/
curl -sk -H "$AUTH" https://mica-a4e2e69e.local:8443/api/v1/web/certificate \
  | jq '{serving, selfSigned: .certificate.selfSigned, sha256: .certificate.sha256}'
# {"serving":true,"selfSigned":true,"sha256":"<摘要>"}
```

在接受警告之前，把这个摘要和浏览器显示的证书摘要对比：一致说明是设备自己的证书，
而不是路上的某个证书。`PUT /api/v1/web/certificate` 可以换成你自己的证书和密钥
（[HTTP API](../reference/http-api.md)）。

要改回来，发同样的 `PUT`，把 `"httpsEnabled"` 设为 `false`，发往
`https://...:8443`。设备无法监听的端口会让任务失败，而不会让设备出问题：读任务，或在
设备上执行 `mica web status`。

> status: shipped — evidence: `mica-core:crates/mica-apid/src/routes/web.rs`, `mica-core:crates/mica-apid/src/tls.rs`
