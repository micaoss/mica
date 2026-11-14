# Mica OS 系统架构

Mica OS 发布版的总图：设备上运行什么、如何启动和更新、每一部分由哪个仓库产出。
每一节都注明它概括的原始记录；两者不一致时以原始记录为准。

---

## 1. Mica OS 是什么

面向嵌入式与工业设备的设备操作系统：只读的 Debian 根文件系统，按产品选择运行在
systemd 或 OpenRC 上，从签名镜像启动，通过签名的事务式部署更新，失败时自动回退。
根文件系统自己就能启动、运行和更新。产品带上它时，一个小型 Rust 管理面负责设备的
设置，写出根文件系统启动各服务所读的文件，并提供 API 和 Web 控制台。

**命名。**产品名是 Mica OS（标识符 `mica`）。软件包、可执行文件、服务、D-Bus 和
路径名都用 `mica` 前缀（`micad`、`mica-deploy`、`com.mica.micad`、`/mica/config`）。

| 层 | 是什么 | 记录 |
|---|---|---|
| 根文件系统 | Debian trixie 底座，以 BusyBox 为命令集，加一个 init（`mica-systemd`，或 `mica-openrc` 加 `mica-mdev`）和产品选择的选项，打包为带签名 dm-verity 树的 squashfs | `mica-system-base:docs/floor-and-options.md` |
| 内核 | 每块板一份：签名 UKI（UEFI 板）或签名 FIT（U-Boot 板），内含 initramfs，其 PID 1 是 `mica-runkit` | `mica-build:boards/README.md`、`mica-core:docs/mica-core.md` 6.5 |
| 核心组件 | `micad`（带 `mica-apid` 和设备命令行）与 `mica-apid-ui`（控制台），各是一个 verity 镜像，开机时从设备的**核心集**叠加到根上，因此无需新的根就能更新 | `mica-core:docs/mica-core.md` 2、6.2 |
| 部署客户端 | 根里的 `mica-deploy`：检查、获取、导入、安装、确认、回滚、恢复出厂 | `mica-core:docs/mica-core.md` 6.3 |
| 功能包 | MQTT 代理与桥接、SFTP 服务、Compute Engine 代理；容器引擎 Podman（带监管进程 `mica-containerd`）或 Docker | `mica-pkgs:docs/mica-pkgs.md`、`mica-podman:README.md`、`mica-docker:README.md` |
| 板卡 | 内核、设备树、引导加载器、固件与板卡包（硬件事实） | `mica-build:boards/README.md` |
| 资源服务 | `res.micaos.dev`：发布文件、设备更新目录与传输索引 | `mica-res:docs/spec/release-publishing.md` |

## 2. 仓库

每个仓库只产出一样东西，并且只按钉住的发布版使用其他仓库，从不伸手进别人的构建树。

| 仓库 | 产出 | 使用 |
|---|---|---|
| `mica` | 公开文档与网站（`micaos.dev`，配网页 `init.micaos.dev`） | 无 |
| `mica-build-tools` | 发布锁、打包与构建规则的唯一实现 `bin/mica-tools`，被其他每个仓库按提交钉住 | 无 |
| `mica-build-env` | 五个构建镜像（`base`、`c`、`go`、`rust`、`bsp`）；armhf 在 amd64 镜像里交叉构建 | `mica-build-tools` |
| `mica-system-base` | Base：钉住的 Debian 软件包（`upstream` 行）、底座根、两种 init 和选项包（SSH、Wi-Fi、蓝牙、时区、sudo） | `mica-build-env`、`mica-build-tools` |
| `mica-core` | 核心组件 `micad` 与 `mica-apid-ui`，以及软件包 `mica-deploy` 和 `mica-lifecycle`（runkit） | `mica-build-env`、`mica-build-tools`、`mica-system-base` |
| `mica-pkgs` | `mica-mqtt-broker`、`mica-mqttd`、`mica-sftp-server`、`mica-gce-agent` | 同上 |
| `mica-podman` | `mica-podman`：Podman、crun、conmon、netavark 和监管进程 `mica-containerd` | 同上 |
| `mica-docker` | `mica-docker`：dockerd、带 `docker compose` 的 `docker` 命令、containerd 和 runc | 同上 |
| `mica-linux` | 内核源码树：上游镜像、每块板一个分支、带日期的快照 | 上游内核树 |
| `mica-uboot` | U-Boot 源码树：上游镜像与每个板卡引导加载器一个分支（`mica/<board>-<medium>`） | 上游 U-Boot 树 |
| `mica-build` | 每块板的内核、引导加载器、固件和板卡包；每个产品的组合根、签名组件、出厂镜像与更新归档；核心集（`core.<channel>`） | 以上全部，各按其钉住版本，内核和 U-Boot 按提交 |
| `mica-res` | `res.micaos.dev` 与 `dl.res.micaos.dev` 背后的资源服务 | 推送给它的发布版 |
| `mica-app` | 用于 BLE 配网的 Android 应用，使用 micad 的 BLE 协议 | `mica-core:docs/ble-provisioning.md` |
| `mica-fleet` | 设备群服务；设备上目前还没有它的客户端 | -- |

```
mica-build-tools ─▶ 每个仓库（bin/mica-tools，按提交钉住）
mica-build-env ──▶ mica-system-base ─▶ mica-core ─┐
                         │       ├──▶ mica-pkgs ──┤
                         │       ├──▶ mica-podman ┤
                         │       └──▶ mica-docker ┤
mica-linux, mica-uboot ──┴───────────────────────▶ mica-build ─▶ GitHub 发布 ─▶ mica-res ─▶ 设备
```

## 3. 钉住与发布锁

- **每个输入都被钉住。**使用方保存 `locks/<repository>.lock`（生产方发布的发布锁，
  原样）和 `locks/pins/<repository>.pin`（发布版名与其 `SHA256SUMS` 的 sha256）。
  发布锁按摘要列出该发布的 pool 镜像，按版本和 sha256 列出每个软件包（以及每个
  核心组件的镜像和记录，作为 `item` 行）。
- **每个钉住都指向生产方的最新发布**，用 `bin/mica-tools locks update` 移动；
  `--check` 只报告。
- **Base 的 `upstream` 行是 Debian 软件包的唯一来源。**后续阶段从这些行安装
  Debian 包，自己从不另钉，所以同一 Base 发布的每个使用方运行的是同一批归档。
- **内核与 U-Boot** 在 `mica-build:locks/upstream.lock` 里按提交钉住，分别是
  `mica-linux` 的带日期快照分支（`mica/<board>-<YYYYMMDD>`）或 `mica-uboot` 的板卡分支。
- **发布版以 UTC 分钟命名**，`YYYYMMDD-HHMM`；产品发布为
  `<board>.<variant>.<YYYYMMDD-HHMM>`，核心集为 `core.<channel>.<YYYYMMDD-HHMM>`。

锁格式、测试向量与版本规则见 `mica-build-tools:docs/spec/release-lock.md` 和
`mica-build-tools:docs/spec/package-versions.md`
（[发布锁](../reference/release-lock.md)）。

## 4. 产品、镜像与核心集

**产品**是其板卡的一个变体，`<board>.<variant>`，声明在
`mica-build:boards/<board>/products/<variant>/product.env`：配置档、init、功能、
容器引擎和 SSH 服务器、如何认领、发布哪些镜像。变体名说明产品用来做什么；没有
默认变体。`PROFILE=dev` 的产品只在本地构建，从不发布。产品自身的事实写进设备上的
`/usr/lib/mica/product.conf`（`PRODUCT`、`FEATURES`、`INIT`、`CONTAINER_ENGINE`、
`SSH_SERVER`、`CLAIM_DEVICE_CODE`、`MDNS`、`SSDP`、`CLOUD_ADMINS`、`DOCS_URL`、
`DOCS_URL_EN`）。

设备运行两样分别发布的东西：

| | 系统：一个**部署** | 核心：一个**核心集** |
|---|---|---|
| 是什么 | 产品的内核（带 runkit）与根，`mica/deployment/v1` | 某通道某架构的全部核心组件，`mica/set/v1` |
| 发布为 | 一个产品，`<board>.<variant>.<stamp>` | 一个通道，`core.<channel>.<stamp>`，覆盖每种架构 |
| 谁取用 | 该产品的设备 | 该通道上该架构的每台设备 |
| 顺序 | 它的 `generation` | 它在通道和架构内的 `generation` |
| 保存在 SYSTEM 上 | 至多两个：正在运行的和它的回退 | 至多三个：当前的、试运行中的、与保留部署绑定的 |

- **每个镜像都带一个种子集**，即构建时最新的 `general` 集，其部署会指明它
  （`coreSet`）。没有核心集的设备无法启动。
- **选择。**开机时 runkit 组合核心集中功能与产品 `FEATURES` 相符的组件（`micad`
  对应守护进程，`ui` 对应控制台）。组件声明它能运行的根接口级别和它要求的根软件包；
  在某个根上选不出来的集不会叠加到这个根上，部署也不会和这样的集一起安装。
- **单独的核心更新**在设备所在通道的最新集能在当前根上选出时提供；选不出来的会等待
  系统更新（`waitsForSystem`）。
- **`general` 通道上的系统更新**会为新根带上通道最新的集，二者作为一个**配对**
  一起试运行；系统更新从不降级核心，也从不把设备移出它的通道。

规则见 `mica-core:docs/mica-core.md` 6.2；构建如何发布二者见 `mica-build:README.md`
（*Releases*）和[发布如何运作](releases/how-releases-work.md)。

## 5. 启动

```
UEFI 板：   固件 ─▶ systemd-boot（启动计数）─▶ 签名 UKI ─┐
U-Boot 板： ROM ─▶ U-Boot `micaboot`（记录、试运行计数）─▶ FIT ─┤
                                                               ▼
   mica-runkit（initramfs 的 PID 1）：verity 根与支持镜像、核心集、
   DATA、已暂存的恢复出厂、所有者密钥环、驱动扩展、机器身份
                                                               ▼
   根的 init（systemd 或 OpenRC）─▶ 服务 ─▶ 健康门 ─▶ 确认
```

- **引导加载器选择部署。**两份启动记录最多指明两个部署；试运行中的部署有三次尝试，
  引导加载器在启动任何东西之前先把尝试次数减一并写回。UEFI 板把记录放在 ESP 上
  （带持久启动尝试的 systemd-boot，即 `mica-system-base` 的 `mica-systemd-boot`）；
  U-Boot 板把记录放在 FIRMWARE 分区的两份 64 KiB 副本里，或两个 UBI 卷里，由
  `micaboot` 命令读取（[cx3576 启动](../reference/boot.md)）。
- **内核是签名的。**开启 Secure Boot 的固件校验 UKI；U-Boot 用其控制设备树中的
  密钥校验 FIT 的签名。`qemu-armhf` 与 `ssd202d` 是 `bootTrust: none`：它们的引导
  加载器只校验 FIT 的哈希，因此没有验证启动，下面其余的检查照样成立。
- **`mica-runkit init`**（initramfs 的 PID 1，没有网络也没有 shell）要求 dm-verity
  签名强制并启用看门狗；读取签名的启动策略；认证所选部署；把支持镜像和根映射为签名
  dm-verity 设备；把核心集中选出的组件以只读 overlay 叠加到 `/usr` 和 `/etc`；
  打开并挂载 DATA（第 6 节），先执行已暂存的恢复出厂；封存所有者密钥环；映射驱动
  扩展并组合模块与固件；生成机器身份；然后交给根的 init。
- **健康门负责确认。**`mica-health`（`/etc/mica/health.conf`）要求 init 已起来且
  不处于 `maintenance` 或 `stopping`，镜像带 micad 时还要求 micad 应答。随后它运行
  `mica-deploy confirm`，使本次启动的部署、核心集或扩展变更成为当前版本。一直未确认
  的试运行会用完尝试次数，引导加载器随即启动回退部署。
- **关机。**在 systemd 上，runkit 的 `shutdown` 是退出 ramdisk：它按顺序释放 verity、
  loop 和 DATA 映射，只在没有任何待写数据时才关机或重启。OpenRC 根和 UBI 板没有退出
  ramdisk：由 init 把 DATA 置为只读后重启。

runkit 的契约见 `mica-core:docs/mica-core.md` 6.4 与 6.5。

## 6. 存储

### 6.1 分区

| 板卡存储 | 分区或卷 |
|---|---|
| GPT 磁盘，UEFI（`uefi-x64`、`uefi-arm64`、`mini-x64`） | ESP（systemd-boot、UKI、启动记录）、SYSTEM、DATA |
| GPT 磁盘，U-Boot（`cx3576`、`s905x5m`） | FIRMWARE（引导加载器和两份记录）、SYSTEM、DATA |
| UBI 下的裸 NAND（`qemu-armhf`、`ssd202d`） | UBI 卷：`system` 与 `data`（UBIFS）、`records-a`/`records-b`，以及每个内核、支持镜像、根、核心组件和驱动扩展各一个静态卷 |

- **SYSTEM** 存放签名元数据所指的内容：至多两个部署（描述符、签名和按内容寻址的
  对象）、核心集、驱动扩展、所有者证书和已暂存的恢复出厂。它以只读挂载，只在
  `mica-deploy` 事务内部才可写。
- **DATA** 存放设备写入的一切，也是唯一会增长的分区：出厂镜像里的 DATA 很小（多数板
  为 256 MiB），在磁盘上会于首次启动时扩展到磁盘末尾。在 ext4 上它带项目配额：`mica`
  和 `srv`（项目 100），可丢弃的 `cache`、`tmp` 和 `var`（项目 101，DATA 的八分之一，
  32 到 256 MiB），以及 `containers`（项目 102）。

### 6.2 写入图

根从不被写入。运行中的设备能写的地方：

| 路径 | 后端 | 选项 |
|---|---|---|
| `/`、`/usr`、`/etc` | 根和核心组件的 squashfs，位于 dm-verity 之上 | `ro,nodev` |
| `/mnt/data` | DATA | `rw,noatime`，开启时带项目配额 |
| `/mica`、`/mica/containers`、`/srv`、`/var` | DATA 中 `mica/`、`containers/`、`srv/`、`var/` 的绑定挂载 | `nosuid,nodev`，private |
| `/var/lib/mica`、`/root`、`/home` | DATA 中 `state/mica`、`/mica/root`、`/mica/home` 的绑定挂载 | `nosuid,nodev` |
| `/etc/hostname`、`/usr/local/lib/systemd/system`、`/usr/local/etc`、网络守护进程的 `/etc` 目录 | DATA 中 `state/` 的绑定挂载 | bind |
| `/run`、`/dev/shm` | tmpfs | `nosuid,nodev` |

配置位于 `/mica/config`（每个方面一个 JSON 文档，由 micad 写入）和 STATE
（`/var/lib/mica`，设备生成的东西：身份、凭据、设置文件、各服务渲染出的配置）。

### 6.3 用户自己的磁盘与外部介质

- **用户可以挂载自己的磁盘**，位置限于属于用户的地方：`/srv` 及其下、
  `/var/mnt/<name>`、`/home/<user>`，以及容器引擎根目录本身（Podman 为
  `/mica/containers/storage`，Docker 为 `/mica/containers/docker`）。在 systemd 上用
  `.mount`、`.automount` 或 `.swap` 单元声明，在 OpenRC 上用 `/usr/local/etc/fstab`
  的一行声明；Base 拒绝其他任何目标。引擎根目录声明在磁盘上时，引擎没有这块盘就不会
  启动，因此缺盘会让引擎启动失败，而不是写满 DATA。任何重置都不会进入挂载点。
- **外部介质**（USB 大容量存储、SD 卡）由 micad 列出；干净且文件系统受支持（vfat、
  exFAT、ext2/3/4）时以只读方式（`ro,nosuid,nodev,noexec`）挂载到
  `/run/mica/media/<id>`，可在控制台卸载和弹出。U 盘上的更新归档从那里导入。内核没有
  相应主机控制器的设备（`ssd202d`）报告不支持外部介质。

运维视角见[存储](operate/storage.md)；契约见 `mica-core:docs/mica-core.md` 6.1 和
`mica-system-base:docs/floor-and-options.md`（*The user's own mounts*）。

## 7. Base 与管理面

设备分两层运行，第二层可选。

- **Base** 就是签名的根：init、挂载、账户、主机名、网络与 DNS、时间、SSH、日志、
  产品选择的功能服务（Wi-Fi、热点、蓝牙、MQTT、容器引擎）、健康门和 `mica-deploy`。
  每个服务从 DATA 上它自己的文件读取配置，开机时据此启动。只有 Base 的设备能启动、
  接入网络、接受密钥方式的 SSH 登录、确认自己的启动、手动或从归档或按每日定时器更新，
  并恢复出厂。
- **micad** 是管理附加层（产品功能 `micad`），带 apid 和控制台。它增加设置树及其
  API、控制台、更新策略（检查周期、维护窗口、重启闸门）、配网与认领、Wi-Fi 与热点、
  容器项目与用户服务、局域网发现以及临时 root 密码。

二者之间的契约是 DATA 上的文件。micad 写好某个服务的文件，再重启或停止该服务；Base
从不读取设置树，移除 micad 后每个服务保持 micad 最后配置的样子。micad 打开的功能
服务记录在 `/var/lib/mica/units/enabled`，开机时由 Base 的 `mica-units` 启动，因为
在只读根上的启用只持续到下次启动。没有 micad 时，运维人员自己写同样的文件并使用
`mica-units`（[没有 micad 时](../operate/without-micad.md)）。

| 服务 | 它在 DATA 上的文件 | 开机时由谁启动 |
|---|---|---|
| 网络（systemd） | `/var/lib/mica/network/networkd`，由 `/run/systemd/network` 链接 | init |
| 网络（OpenRC） | `/var/lib/mica/network/interfaces`，供 BusyBox ifupdown 使用 | init |
| DNS | `/var/lib/mica/dns/`（resolved 的 drop-in、静态 hosts 记录、OpenRC 上的全局服务器） | init |
| 时间 | `/var/lib/mica/time/`（timesyncd，OpenRC 上为 BusyBox `ntpd`） | init |
| 日志 | `/var/lib/mica/log/log.env`（持久化、大小、远程收集器） | init |
| SSH | `/var/lib/mica/ssh/sshd.env` | init，按最后的配置，否则按产品的 `SSH=` |
| Wi-Fi 客户端与热点 | `/var/lib/mica/wifi/`，`/etc/wpa_supplicant` 与 `/etc/hostapd` 的 STATE 绑定 | `mica-units` |
| MQTT 代理与桥接 | `/var/lib/mica/mqtt/` | `mica-units` |
| 容器引擎 | 引擎在 `/mica/containers` 下的状态 | `mica-units` |
| 用户的服务 | `/usr/local/lib/systemd/system` 或 `/usr/local/etc`（DATA state） | init |
| 没有 micad 时的更新 | `/mica/config/updates.json` | `mica-update.timer`（systemd）或 `mica-update`（OpenRC），每日，仅 `policy: auto` |

### 7.1 systemd 产品与 OpenRC 产品

每个产品只安装一种 init；每个软件包都为两种 init 提供它自己服务的启动文件。

| | systemd | OpenRC |
|---|---|---|
| 设备节点 | udev | BusyBox `mdev` |
| 网络 | networkd 与 resolved | BusyBox ifupdown 与 `udhcpc`（`mica-udhcpc`） |
| 时间 | timesyncd | BusyBox `ntpd` |
| 日志 | journald，转发用 `systemd-netlogd` | BusyBox `syslogd`、`logread` |
| 用户挂载 | `.mount`/`.automount`/`.swap` 单元 | `/usr/local/etc/fstab`、`mica-fstab` |
| 关机 | runkit 的退出 ramdisk | `openrc-init`；没有退出 ramdisk |
| 现有产品 | 其余所有产品 | `mini-x64.basic`、`qemu-armhf.basic`、`ssd202d.basic`、`uefi-x64.openrc-full` |

32 位板卡运行 OpenRC 根：退出 ramdisk 只在 x86-64 和 aarch64 上提供。

### 7.2 micad、apid 与控制台

```
   浏览器 / 自动化 ─HTTP(S)─▶ apid ◀─ /run/mica/apid.sock ─ 设备上的 root
                                │
                    com.mica.micad1（系统总线，仅 root）
                                ▼
   micad：设置树（/mica/config、STATE）、reconciler、观察器、
          配网、更新（经 mica-deploy）、重置、局域网发现
                                │ 写文件，启动/停止服务
                                ▼
   Base 的服务：网络、DNS、时间、日志、SSH、Wi-Fi、热点、蓝牙、
   MQTT、容器引擎、用户的单元
```

- **micad**（`micad daemon`，单实例，不监听网络）加载设置，执行已暂存的重置，导入
  配网文档，生成首次启动的身份与凭据，每个子树运行一个 reconciler，维护实时状态与
  观察器，并在系统总线上提供 `com.mica.micad`。它自己应答 mDNS（`<hostname>.local`、
  `_mica._tcp`、控制台）和 SSDP，二者都可开关，且从不通告 SSH。
- **apid**（`mica-apid`，同一个可执行文件）按 `access.web.mode` 提供 API 和控制台：
  `network`（默认：HTTP 8080，启用后为 HTTPS 8443，另加本地 socket）、`local`（仅本地
  socket）或 `off`。所有读写都经过 micad。浏览器用 argon2id 密码和会话 cookie，
  自动化用 bearer token；登录失败会持久退避，安全相关操作记入审计环。
- **控制台**（`mica-apid-ui`）是 API 的一个客户端，位于 `/_ui/`；运维人员可以上传并
  激活自己的控制台包。
- **在设备上**，root 通过总线运行 `micad` 子命令：`micad update`（也可用
  `mica-update`）、`micad ctr`（也可用 `mica-ctr`）、`micad unit`、`micad web`、
  `micad mdns`、`micad ssdp`、`micad factory-reset`、`micad diag` 和 `micad device-code`。

设置、reconciler 与总线见 `mica-core:docs/mica-core.md` 第 3 节；API 见第 4 节和
[API](operate/api.md)。

### 7.3 工作负载

设备有两种方式运行用户的软件，二者都保存在 DATA 上，经过每次更新都保留：

- **用户自己的服务**：一个 systemd 单元或 OpenRC 脚本，可执行文件放在 DATA 上（例如
  `/srv`），用 Base 的 `mica-unit` 安装或在 micad 的 `services.units` 中声明，需要时以
  自己的服务账户运行。
- **容器**，在带 `containers` 功能的产品中。Podman 上，Compose 项目向 micad 声明，由
  `mica-containerd` 运行；Docker 上，在设备上用 `docker` 和 `docker compose` 创建容器，
  micad 只负责开关 dockerd。二者默认关闭，需手动打开
  （[容器](../integrate/containers.md)）。

应用数据只能经 `mica-mqttd` 到达 MQTT，且只来自在总线上按确切名称登记的服务；配置、
凭据和更新从不成为 MQTT 条目（[总线](../integrate/bus.md)）。

## 8. 更新、回滚与重置

- **更新目录**不签名，从更新根读取，默认 `https://res.micaos.dev/update/`：
  `v1/manifest.json` 列出每个产品的当前发布和每个通道的当前核心集；发布文档列出其
  签名描述符和对象。信任来自签名的描述符和核心集：设备只取自己的板卡、架构和产品，
  只取比当前更高的 generation，并校验每个字节。
- **micad 的策略**决定何时更新：检查周期与时刻、维护窗口（UTC，按星期）、计量或离线
  链路、获取预算以及重启闸门。没有 micad 时，`mica-deploy update` 由人手动运行，每日
  定时器在 `policy: auto` 下运行它，且从不重启。
- **离线**时，`MICAUPD1` 归档（系统、核心集或驱动扩展）通过控制台上传，或从 U 盘导入。
- **安装是持久的文件事务**，由一套在每次 IO 处中断它的故障测试证明。新的部署、核心集
  或配对以试运行方式启动，由健康门确认；试运行失败会自动回退。
- **回滚**到保留的部署是运维操作；API 把它绑定到调用者确认过的目标，下次启动会报告
  启动的部署是否就是该目标（`lastRollback`）。
- **增量传输**：`fetch` 先用设备已有的分块，按对象的传输索引拼出缺失的对象，只获取
  缺少的分块；这条路径上的任何东西都不被信任，任何失败都会退回获取整个对象。
- **驱动扩展**是只针对某一个内核的树外模块和固件，在所有者密钥环封存之后才会映射；
  内核更新会等待每个已安装扩展的对应构建，或等所有者放弃它。

| 重置 | 删除 | 保留 |
|---|---|---|
| `configuration` | `/mica/config`（设置，包括 SSH 密钥，回到产品默认值）和控制台的 HTTPS 身份 | 身份、认领、管理员密码与 API token、`/srv`、数据 |
| `application-data` | `/mica/volumes`、容器项目和 DATA 上的引擎存储、用户的服务与服务账户 | 设置、身份、凭据、`/srv` |
| 恢复出厂 | DATA 上的一切：设置、认领、token、密钥、SSH 主机密钥、machine-id、容器、`/srv`、`/mica`、日志；DATA 会被重新格式化 | 已安装的软件（正在运行的部署及其核心集）、设备码 |

任何重置层级都不会打开 `/srv` 或进入挂载点。恢复出厂需要管理员密码，在未认领的设备、
更新或试运行期间以及加密的 DATA 上会被拒绝，完成后设备回到未认领状态，开启出厂热点。
凭据恢复以物理在场动作为前提，目前没有任何板卡声明这样的动作。运维指南见
[更新](operate/updates.md)和[恢复](operate/recovery.md)。

## 9. 信任

| 对象 | 签名密钥 | 谁校验 |
|---|---|---|
| UKI 或 FIT | 启动密钥 | 开启 Secure Boot 的固件，或用控制设备树中密钥的 U-Boot（`bootTrust: none` 的板卡除外） |
| 根、支持镜像、核心组件 | 内容密钥，以 PKCS#7 签在各自的 dm-verity 根哈希上 | 内核映射镜像时，用其内置密钥环校验 |
| 部署、核心集和固件元数据 | 发布密钥（Ed25519，规范 JSON） | `mica-deploy` 和 runkit，用签名内核中的公钥 |
| 驱动扩展 | 厂商或所有者的密钥，链到内置密钥环或已登记的所有者证书 | 内核，在 runkit 封存所有者密钥环之后 |

- **镜像中没有任何秘密**：身份、凭据和 SSH 主机密钥都在首次启动时于设备上生成。
- **所有者密钥环**（`.mica_owner`）保存所有者登记的证书；runkit 在只信任内置密钥时
  映射系统镜像，然后加入所有者证书并封存密钥环，因此所有者密钥可以签驱动扩展，却永远
  签不了根或核心组件。
- **DATA 加密**是已具备的基础能力，在每个产品上都关闭：产品可以让 runkit 以 LUKS2
  打开 DATA，由封存到 PCR 7 和 15 的 TPM2 密钥解锁，并带恢复口令。目前没有发布的产品
  打开它。

细节与证据边界见[发布签名](../security/signing.md)和[安全模型](../security/model.md)。

## 10. 资源服务

`mica-build` 的发布流程把每个产品发布和核心发布推送给 `mica-res`，后者把字节存放在
`https://dl.res.micaos.dev/<namespace>/...`（`mica` 命名空间不可变；测试镜像放在
`test` 命名空间），并生成设备更新目录 `https://res.micaos.dev/update/v1/manifest.json`。
生产方在每个对象旁发布它的**传输索引**（`objects/<sha256>.index`，`MICAIDX1`）；res 把
`chunks/<digest>` 作为包含该分块的对象中经校验的一段来应答，因此分块不会重复存储。
网站的下载页读取同一服务（`mica-res:docs/spec/release-publishing.md`）。

## 11. 板卡

| 板卡 | 架构 | 启动 | 存储 | 内核树（`mica-linux`） |
|---|---|---|---|---|
| `uefi-x64` | amd64 | systemd-boot，签名 UKI | GPT | `mica/general`，stable 6.12 |
| `uefi-arm64` | arm64 | systemd-boot，签名 UKI | GPT | `mica/general` |
| `mini-x64` | amd64 | systemd-boot，签名 UKI | GPT，128 MB 闪存 | `mica/general` |
| `cx3576` | arm64 | U-Boot，签名 FIT | eMMC 上的 GPT | `mica/cx3576`，Rockchip 6.1 并合入 stable |
| `s905x5m` | arm64 | U-Boot，签名 FIT | eMMC 或 SD 上的 GPT | `mica/s905x5m`，Hardkernel 6.12 并合入 stable |
| `qemu-armhf` | armhf | U-Boot，FIT，`bootTrust: none` | NAND 上的 UBI | `mica/qemu-armhf` |
| `ssd202d` | armhf | U-Boot，FIT，`bootTrust: none` | SPI NAND 上的 UBI | `mica/ssd202d`；不是发布目标 |

板卡产出制品，产品构建使用制品；双方都不伸手进对方的构建。内核配置满足共同底线和板卡
声明的内核功能（`mica-build:boards/README.md`）。每块板的构建、验收和支持层级集中在
一张表里：[支持层级](hardware/README.md#当前板卡)。

## 12. 接下来读什么

| 问题 | 文档 |
|---|---|
| 有哪些产品，各带什么？ | [概览](start/overview.md)、[获取发布版](start/download.md) |
| 没有 micad 时运行什么，读哪个文件？ | 第 7 节、[没有 micad 时](../operate/without-micad.md) |
| 设置树里有什么？ | [配置](operate/configuration.md)、`mica-core:docs/mica-core.md` 3.3 |
| API 提供什么？ | [API](operate/api.md)、[API 参考](../reference/api.md) |
| 写入去了哪里，我能把磁盘挂在哪里？ | [存储](operate/storage.md)、[只读根](../reference/ro-root.md) |
| 更新如何安装、确认或回滚？ | [更新](operate/updates.md)、[更新参考](../reference/updates.md) |
| 发布由谁、如何签名？ | [发布签名](../security/signing.md) |
| 设备如何获得最初的凭据？ | [首次启动](start/first-run.md)、[配网](../integrate/provisioning.md) |
| 如何运行我自己的软件？ | [应用](integrate/applications.md)、[容器](../integrate/containers.md) |
