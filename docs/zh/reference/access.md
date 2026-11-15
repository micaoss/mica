# 访问

运维者如何访问设备：API 和控制台、SSH、本地控制台，以及丢失全部凭据时会发生什么。机制属于 `mica-core`
（`mica-core:docs/mica-core.md` 第 3 和第 4 节）；本页陈述产品所依赖的规则。

## 1. 原则

- **访问通道是设置树之下的服务**，从不是绕过它的后门：一项设置、一个调和器、一个服务。没有任何东西是通过
  编辑设备上的文件来配置的。
- **镜像里没有秘密。**签名的根在每台设备上逐字节相同，所以放在里面的密码或密钥就是整个机队共用的一个秘密。
  凭据在设备上生成，或由其所有者提供。
- **持久访问靠密钥。密码是例外，而且是临时的。**
- **新设备是关闭的**：在每个产品上都没有授权密钥，也没有接受密码的账户；除非产品打开 SSH（`SSH=on`，此时
  只接受密钥），否则 SSH 关闭。

> status: shipped — evidence: `mica-core:docs/mica-core.md`, `mica-system-base:payload/usr/lib/mica/mica-shadow-reconcile`

## 2. 通道

| 通道 | 授予 | 认证方式 | 状态 |
|---|---|---|---|
| 管理 API 和 Web 控制台 | 管理平面能做的一切 | 管理员密码（浏览器会话）或 API 令牌 | 每个产品都有；控制台只在产品带有它时才有 |
| 本地 API 套接字 `/run/mica/apid.sock` | API 能做的一切 | 调用方的 uid，必须是 root（套接字为 `0600`） | apid 运行期间（`network` 和 `local` 模式），认领之前也可用 |
| SSH（Dropbear 或 OpenSSH，作为 `mica-sshd`） | root | 授权公钥，或临时 root 密码 | 关闭，除非产品设置 `SSH=on` 或管理员开启 |
| 来自云平台元数据的 SSH 登录 | 云管理员开启时经 `sudo` 获得 root | 实例 `ssh-keys` 元数据中的密钥 | 云产品（`uefi-x64.gcp`） |
| 显示器上的本地控制台（`tty2`） | root | 临时 root 密码 | 带显示器的板卡；第一个 VT 保留启动画面 |
| 串口控制台 | 登录提示 | 临时 root 密码 | 板卡有串口时存在；默认没有可用来登录的东西 |
| 整盘重刷（板卡的加载器模式或外部启动介质） | 一台新设备 | 物理接触 | 每块板卡；见[板卡页面](../hardware/README.md) |

没有网络设置向导，没有会生效的受管控制台 shell 设置，也没有救援启动项。

> status: shipped — evidence: `mica-core:crates/micad/src/reconciler/sshd.rs`, `mica-core:crates/micad/src/transient.rs`, `docs/integrate/display.md`

## 3. 认领

在管理员密码存在之前，设备处于**未认领**状态，能创建第一个密码的恰好只有两样东西：

- `POST /api/v1/setup`，即控制台的首次运行页，或
- 启动时应用的配置文档（[配置](../integrate/provisioning.md)）。

其他每个路由都需要未认领设备尚不具备的凭据，设备被认领后配置文档会被拒绝。设备记录是哪个通道、在何时认领
了它。

在 `CLAIM_DEVICE_CODE=required` 的产品上，设置还会要求设备码：它印在标签上，并显示在设备自己的登录提示中
（串口或显示器），所以认领设备的人手里有它；云产品的设备码是随机的，登录后读取。错误的设备码只会推迟下一次
尝试。除 `uefi-x64.gcp` 外，目前每个已发布的产品都设置了 `CLAIM_DEVICE_CODE=off`，只凭密码认领，所以第一个
访问设置页的人就认领了设备。蓝牙配置不认领任何东西：它设置网络，认领由控制台完成
（[首次运行](../start/first-run.md) 第 5 节）。通过配置文档到达的凭据是引导秘密，控制台会要求轮换它。

> status: shipped — evidence: `mica-core:docs/mica-core.md`, `mica-core:crates/micad/src/provisioning_doc.rs`

## 4. API 与控制台

- 浏览器用管理员密码换取 HMAC 签名、HttpOnly 的会话 cookie，并在每次修改时发送会话的 CSRF 令牌。自动化使用
  bearer 令牌，设备上只存其摘要。
- 密码用 argon2id 哈希。
- **登录失败会退避，退避在重启后仍然有效。**延迟从一秒开始加倍，上限五分钟；从不永久锁定。
- 安全相关的操作写入一个小型本地审计环。它是这些事件的记录，不是谁在设备上做过什么的完整历史，也不会被
  上传。
- **API 在哪里监听**由 `access.web.mode` 决定：`network`（默认）、`local`（仅本地套接字：设备上 root 的命令，
  没有控制台和 HTTP API）或 `off`（apid 停止）。设备上的 root 用 `micad web status|network|local|off` 设置它，
  处于 `off` 的设备就是这样恢复的。
- API 默认在明文 HTTP 8080 端口监听。开启 HTTPS 后在 8443 上使用自签名身份提供服务，管理员可以替换该身份，
  HTTP 端口只做重定向；恰在此时会话 cookie 带 `Secure`。
- 设置和状态在离开设备之前经过遮蔽器，所以密码哈希之类的秘密从不对外提供。

> status: shipped — evidence: `mica-core:crates/mica-apid/src/auth.rs`, `mica-core:crates/mica-apid/src/audit.rs`, `mica-core:docs/mica-core.md`

### 4.1 在网络上找到设备：mDNS 和 SSDP

micad 用自己的两个应答器在本地网络上通告设备，作用于除回环、容器引擎的链路、WireGuard 和 CAN 之外每个有地址
的接口。每个应答器只回答来自其到达子网的查询，并对回答限速。

- **mDNS** 回答 `<hostname>.local`，并发布 `_mica._tcp`，只带产品和主机名，不带其他任何东西（没有版本、认领
  状态或设备码）。控制台在网络上（`access.web.mode` 为 `network`）时，它还以 `_http._tcp` 或 `_https._tcp`
  发布控制台。
- **SSDP** 回答 UPnP 发现，所以设备会出现在电脑的网络视图中。其描述
  `http://<地址>:<HTTP 端口>/ssdp/device.xml` 写明主机名、产品和一个不透明的序列号，并链接到控制台。它只在
  控制台位于网络上时运行。
- **SSH 从不被通告**，两者都不会。
- **开关**是 `access.mdns.enabled` 和 `access.ssdp.enabled`，都在控制台的概览页（局域网发现）上，也可用
  `micad mdns on|off` 和 `micad ssdp on|off` 设置。未设置时由产品的 `MDNS=` 和 `SSDP=` 行决定，产品不说时
  两者都开。关闭意味着根本没有套接字。`micad mdns status`、`micad ssdp status`、`GET /api/v1/mdns` 和
  `GET /api/v1/ssdp` 显示正在运行和正在通告的内容。
- **通过 mDNS 发布更多服务**：在 `/usr/share/mica/mdns.d/`（镜像自带）或 `/run/mica/mdns.d/`（重启后消失）
  放 JSON 片段，或用 `micad mdns add` 和 `micad mdns remove`：

  ```json
  {"version": 1, "services": [
    {"instance": "Grafana", "type": "_http._tcp", "port": 3000, "txt": {"path": "/dashboards"}}
  ]}
  ```

  名称、端口和 TXT 记录的规则见 `mica-core:docs/mica-core.md` 3.13 节。

没有 micad 时两个应答器都不运行（[没有 micad](../../operate/without-micad.md) 第 8 节）。

> status: shipped — evidence: `mica-core:crates/micad/src/reconciler/mdns.rs`, `mica-core:crates/micad/src/reconciler/ssdp.rs`, `mica-core:crates/mica-apid/src/routes/mdns.rs`, `mica-core:crates/mica-apid/src/routes/ssdp.rs`

## 5. SSH 与账户

根有两个账户，`root` 和运维账户 `mica`，两者都没有密码：shadow 文件在每次启动时重建，任何未锁定的东西都会被
重新锁定。

- **SSH 在开启之前是关闭的**，通过 API（`access.ssh`）开启，同时设置端口和监听地址，除非产品设置了
  `SSH=on`，此时从首次启动起就运行。空的地址列表表示所有地址。
- **每个授权密钥都是 root 密钥。**两个账户使用同一份密钥列表。`mica` 是一个持久的工作目录和非 root 的默认
  shell，而不是更低的权限级别。
- **临时 root 密码**覆盖密钥无法覆盖的情况：运维者站在一台没有安装密钥的设备前。它通过 API 设置（8 到 72
  字节），可用于 SSH 和本地控制台，不保存在任何设置中，并在下次启动时消失。只有在它有效期间，SSH 才提供密码
  认证。
- SSH 服务器是 Dropbear，或者在产品设置 `SSH_SERVER=openssh` 时是 OpenSSH，micad 在 DATA 上写入它唯一读取
  的配置。init 在启动时按该配置启动服务器，所以 SSH 不等待 micad，没有 micad 也能工作。没有 micad 时，
  `mica-add-keys` 会添加配置介质上 `mica-authorized-keys` 中的密钥。
- **云管理员。**在云产品上，Compute Engine 代理为实例元数据中列出的每个 SSH 用户创建账户，并把它加入
  `mica-admins` 组。授权是 micad 在 `access.cloudAdmins.enabled` 开启时渲染的一条 sudo 规则（这是该产品的
  默认值，也是控制台访问页上的一个开关）；关闭时，组成员身份不授予任何权限。
- 容器以 root 运行，所以任何能运行容器引擎的人都已经是 root。设备上没有非特权用户的方案。

> status: shipped — evidence: `mica-core:crates/micad/src/reconciler/sshd.rs`, `mica-core:crates/micad/src/transient.rs`, `mica-system-base:payload/usr/lib/mica/mica-shadow-reconcile`

## 6. 什么会持久保留

配置**通过设置树**持久保留。没有可写的 `/etc` overlay：根是经校验的只读镜像，所以设置树没有建模的设置就是
设备不支持的设置。

| 内容 | 重启与更新 | 重置 |
|---|---|---|
| 设置和配置文档 | 保留，在 DATA 上 | 配置重置重新播种它们，标识保留；出厂重置连同标识一起清除 |
| `/home`、`/root`、`/srv` | 保留，在 DATA 上 | 没有重置层级清除它们；出厂重置清除 DATA 上的这三者，但从不清除用户挂在那里的磁盘 |
| 授权密钥、SSH 主机密钥 | 保留 | 随配置一起清除；出厂重置生成新的主机密钥 |
| 写到 `/etc` 下 | 被只读根拒绝 | — |
| `/run`，以及不保存在 DATA 上的日志 | 重启后丢失 | — |
| 临时 root 密码 | 下次启动时清除 | — |

重置层级和出厂重置见[恢复](recovery.md)。

> status: shipped — evidence: `mica-core:crates/micad/src/reset.rs`, `docs/reference/recovery.md`, `docs/reference/storage.md`

## 7. 被锁在外面

丢失管理员密码、全部 API 令牌和全部授权密钥的运维者**没有任何软件途径能回去**：API 需要凭据，SSH 需要不存在
的密钥，控制台没有接受密码的账户。

凭据恢复在代码中存在——它在物理在场声明下生成新的管理员凭据，从不泄露旧凭据——但目前没有板卡声明物理恢复
动作，所以今天在每块板卡上都会被拒绝（[恢复](recovery.md)）。剩下的只有整盘重刷，代价是每个
分区和设备标识。

> status: board-dependent — evidence: `mica-core:crates/mica-apid/src/routes/reset.rs`, `docs/reference/recovery.md`, `docs/hardware/README.md`

## 8. 不存在的东西

- 不可逆的 shell 锁定。SSH 是可逆地禁用的，由管理员可以重新打开的设置控制。
- 永久登录锁定、shell 或会话审计、审计上传。
- `dev` 和已发布产品之间的访问差异：两者都关闭 SSH、锁定 root。

> status: unsupported
