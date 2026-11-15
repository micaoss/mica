# 文件地图

运行中的 Mica OS 设备上各样东西在哪里：每个路径存放什么、由谁写入、在重启、更新或重置后是否保留。路径
来自 `mica-core:docs/mica-core.md` 和 `mica-system-base:docs/floor-and-options.md`；其背后的存储布局见
[存储](storage.md)。

## 标识与产品

| 路径 | 内容 | 写入者 | 生命周期 |
|---|---|---|---|
| `/usr/lib/mica/product.conf` | `PRODUCT`、`FEATURES`、`INIT` 及其他产品行 | 构建，位于签名根中 | 随根变化 |
| `/usr/share/mica/device-code.conf` | 设备码的来源 | 构建 | 随根变化 |
| `/usr/share/mica/meta/updates/manifest.json` | 内置的更新策略 | 构建 | 随根变化 |
| `/usr/share/mica/defaults/network.json` | 板卡的默认网络条目（如有） | 板卡软件包 | 随根变化 |
| `/etc/machine-id` | 机器标识，从 DATA 只读绑定 | runkit，首次启动 | 直到出厂重置 |
| `/etc/hostname` | 主机名 | micad | DATA |

## 启动状态（在内存中，仅本次启动）

| 路径 | 内容 |
|---|---|
| `/run/mica/boot.json` | 运行中的部署、内核、根、校验情况、后端（[启动](boot.md)） |
| `/run/mica/runkit.json` | 启动的 runkit 支持什么（出厂重置、DATA 加密） |
| `/run/mica/device-code.issue` | 登录提示中的行：设备码和控制台地址 |
| `/run/mica/apid.json` | micad 依 `access.web` 渲染的 Web 监听 |
| `/run/mica/apid.sock` | 供 root 使用的 API 本地套接字 |
| `/run/mica/media/<id>` | micad 只读挂载的外接介质 |
| `/run/mica/hosts` | hosts 文件（`/etc/hosts` 链接到这里） |

## 配置（DATA）

| 路径 | 内容 |
|---|---|
| `/mica/config/*.json` | 运维者的设置，每个关注点一份文档（[设置](settings.md)） |
| `/mica/config/updates.json` | 运维者的更新策略 |
| `/mica/config/container/<project>.yaml` | 每个已声明的 Compose 项目 |
| `/var/lib/mica/settings.toml` | 设备生成的内容：标识、凭据、认领、配置状态 |
| `/var/lib/mica/apid/` | apid 的 HTTPS 身份、会话密钥、登录退避、审计环 |
| `/usr/local/lib/systemd/system/` | 用户的 systemd unit（`mica-unit`） |
| `/usr/local/etc/` | 用户的 OpenRC 脚本和 `fstab` |

## micad 为 Base 渲染的文件（DATA）

| 路径 | 读取者 |
|---|---|
| `/var/lib/mica/ssh/sshd.env` | `mica-sshd` |
| `/var/lib/mica/network/networkd/`、`/var/lib/mica/network/interfaces` | networkd，或 OpenRC 上的 busybox ifupdown |
| `/var/lib/mica/wifi/client.env`、`ap.env`、`ap-udhcpd.conf` | OpenRC 上的 Wi-Fi 服务 |
| `/var/lib/mica/time/timesyncd.conf`、`ntpd.conf` | timesyncd，或 `mica-ntpd` |
| `/var/lib/mica/log/log.env` | `mica-log-settings` 或 `mica-syslogd` |
| `/var/lib/mica/mqtt/broker.toml`、`mqttd-device.env` | MQTT 代理和桥接 |
| `/var/lib/mica/dns/hosts`、`resolv.global` | `mica-hosts`、`mica-resolv` |
| `/var/lib/mica/units/enabled` | `mica-units`，启动时启动其中列出的 unit |

## 数据与工作区（DATA）

| 路径 | 内容 |
|---|---|
| `/srv` | 用户数据；任何重置层级都不打开它 |
| `/mica/volumes/<project>/` | 容器项目的命名卷 |
| `/mica/containers/storage` 或 `/mica/containers/docker` | 容器引擎的根目录 |
| `/mica/updates/{staging,downloads,verified}` | 更新的下载与暂存 |
| `/mica/diagnostics` | 诊断快照 |
| `/mica/ui` | 上传的控制台包 |
| `/var/log`、`/var` | 持久的服务状态和日志（保存在 DATA 上时） |
| `/home`、`/root` | 主目录 |

## 签名对象（SYSTEM，只读）

| 路径 | 内容 |
|---|---|
| `/mnt/system/deployments/<id>.json` | 签名的部署描述符（最多两个） |
| `/mnt/system/kernels/`、`/mnt/system/roots/` | 内核和根对象 |
| `/mnt/system/sets/core/` | 签名的 core 集合及其组件 |
| `/mnt/system/extensions/` | 驱动扩展 |
| `/mnt/system/owner-certs/` | 已登记的 owner 证书 |

## 什么在什么之后保留

| 区域 | 重启 | 更新 | 回滚 | `configuration` 重置 | `application-data` 重置 | 出厂重置 |
|---|---|---|---|---|---|---|
| `/run` | 否 | 否 | 否 | — | — | 否 |
| `/mica/config` | 是 | 是 | 是 | 清除 | 保留 | 清除 |
| STATE（标识、凭据、认领） | 是 | 是 | 是 | 保留 | 保留 | 清除 |
| 容器、卷、用户的 unit、服务账户 | 是 | 是 | 是 | 保留 | 清除 | 清除 |
| `/srv` | 是 | 是 | 是 | 保留 | 保留 | 清除 |
| SYSTEM 部署 | 是 | 一次替换一个 | 切换 | 保留 | 保留 | 除运行中的外全部删除 |

`configuration` 重置还会删除 apid 的 HTTPS 身份。回滚从不承诺撤销此后写入的应用数据
（[重置层级](recovery.md#2-重置层级)）。
