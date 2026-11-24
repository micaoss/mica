# 发布说明：core 0.0.9 这一轮（2026-11-24）

这一轮在 2026-11-24 发布了什么、core 0.0.9 有哪些新内容、修复了什么。发布事实以各个发布版公布的内容为准
（[发布说明](release-notes.md)）；本页做摘要并链接到相关指南。

## 1. 发布了什么

| 部分 | 发布版 |
|---|---|
| core 0.0.9 | mica-core `20261124-0755`：`mica-deploy` 和 `mica-lifecycle` `0.0.9-1`，`micad` 和 `mica-apid-ui` `0.0.9` |
| core 集合 | `core.general.20261124-1328`，第 7 代 |
| mica-system-base | `20261124-0653` |
| mica-podman、mica-docker | `20261123-1821`（Podman 6.2.0） |
| 内核 | `uefi-x64`、`mini-x64`、`qemu-armhf` 为 `6.12.119`；`cx3576`（`6.1.192`）和 `s905x5m` 未变（[内核特性](../reference/kernel-features.md#内核版本)） |

| 产品 | 发布版 |
|---|---|
| `cx3576.full` | `20261124-1332` |
| `mini-x64.basic`、`uefi-x64.full`、`s905x5m.sd-full`、`qemu-armhf.basic` | `20261124-1351` |
| `s905x5m.emmc-full` | `20261124-1411` |
| `uefi-x64.docker` | `20261124-1505` |
| `uefi-x64.gcp` | `20261124-1535` |

这一轮没有发布：`uefi-arm64`、`ssd202d`、`gcp-tpm2` 和 `openrc-full`。GCP 产品是需要导入的镜像文件；
发布版没有公开的 Compute Engine 镜像系列。下载见[下载](../start/download.md)。

> status: shipped — evidence: `docs/start/download.md`, `tools/docs/reference-core.pin`

## 2. core 0.0.9 的新内容

- **上行连通性检查与故障切换。**可以从某条上行的接口发出探测来检查它，默认每 10 秒、2 秒超时，以 TCP 连接
  `1.1.1.1` 和 `8.8.8.8` 的 53 端口。连续 3 轮失败后流量切到下一条有应答的上行，连续 5 轮成功后切回。DNS 在
  systemd 和 OpenRC 上都跟随活动上行。检查默认关闭；开启后设备每个间隔都会联系这些目标。静态网关现在使用
  20 及以上的 metric，声明 metric 低于 20 的默认路由会被拒绝（`route_metric_reserved`）。网络状态、
  `mica network`（INTERNET 列，活动上行带 `*`）以及控制台的接口页和 Wi-Fi 标签页可以查看和设置检查
  （[网络](../operate/network.md#5-两条上行与故障切换)）。
- **所有写入方遵守同一套网络规则。**控制台与 API、BLE 配网、经总线的设置路径以及 `mica` 遵守相同的规则、
  返回相同的代码，包括已被某个服务占用的 WireGuard 监听端口（`port_in_use`）（[错误](../reference/errors.md)）。
- **启动看门狗按名称交接。**runkit 把它启用的看门狗告诉根的 init，由后者喂这一个，并设置板卡的交接超时
  （默认 120 秒）（[启动](../reference/boot.md#4-mica-runkit-init-的各个阶段)）。
- **试运行期限。**在板卡的 `confirmS` 内（`uefi-x64` 和 `mini-x64` 为 600 秒，`qemu-armhf` 最长 1800 秒；
  ARM 的取值是暂定的）没有确认的试运行启动会被判失败并重启，尝试用完后回退。已确认的启动不会因为慢而被判
  失败。OpenRC 上期限在 sysinit 启动，输出写到内核日志，挂在某个运行级别里的启动由内核重启
  （[试运行期限](../reference/boot.md#试运行期限)）。
- **配置重置保留用户的应用**：已声明的服务、容器项目和已配对的蓝牙设备都会保留（[恢复](../operate/recovery.md)）。
- **开启 HTTPS 后，HTTP 端口应答 `308 Permanent Redirect`**，保留主机、路径和查询（[HTTP API](../reference/http-api.md)）。
- **apid 只在其 Web 设置与启动时不同才重启**；OpenRC 启动时不再无谓地重启它。
- **依赖：**zip 9.0.5（RUSTSEC-2026-0548）、url 2.5.9（RUSTSEC-2026-0592）、cookie 0.18.3
  （RUSTSEC-2026-0594，仅测试使用）。RUSTSEC-2026-0543（chrono，无人维护，没有修复版本）是已确认的公告。

> status: shipped — evidence: `mica-core:docs/mica-core.md`, `mica-core:docs/plan/uplink-failover.md`

## 3. 修复了 0.0.8 及更早版本的问题

| 现象 | 版本 | 现在 |
|---|---|---|
| `mica network` 打印空列表 | 0.0.8 | 重新列出观测到的接口及其互联网检查（[命令行](../reference/cli.md#network)） |
| OpenRC 上 `mica-deploy ... --reboot` 执行了动作却没有重启 | 0.0.8 及更早 | mica-deploy 经由根的 init 重启和关机：OpenRC 上用 `openrc-shutdown`，systemd 上用 `systemctl` |
| 配置重置会清掉已声明的用户服务、容器项目和已配对的蓝牙设备，随后 micad 删除它安装的服务单元和已声明的容器 | 0.0.8 及更早 | 配置重置保留它们；容器开关回到默认值（[恢复](../operate/recovery.md)） |

> status: shipped — evidence: `mica-core:docs/mica-core.md`, `mica-core:crates/micad/src/cli/network.rs`

## 4. 把设备升级到这一轮

运行较早发布版的设备把这一轮当作普通更新安装，在线或离线均可（[更新](../operate/updates.md)）。新发布版
以试运行方式启动并照常确认；从这一轮起，试运行启动还受板卡期限约束。DATA 上的内容不做迁移，回退到之前的
部署时使用同一份 DATA。

> status: shipped — evidence: `docs/operate/updates.md`, `docs/reference/boot.md`
