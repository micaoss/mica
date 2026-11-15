# 存储：分区与 DATA 布局

Mica OS 设备把什么放在哪里：每块板的分区或 UBI 卷、SYSTEM 和 DATA 各存什么、运行中的系统能写的
每一条路径、配额、用户自己的磁盘与外接介质，以及容量和故障如何处理。契约见
`mica-core:docs/mica-core.md` 6.1 与 6.6 和 `mica-system-base:docs/floor-and-options.md`；尺寸取自
`mica-build` 中每块板的 `layout.tsv`（或 `flash.tsv`）。运维视角见[存储](../operate/storage.md)。

## 各板卡的分区

每块磁盘板卡有三个 GPT 分区。只有 DATA 会增长：首次启动后它扩展到介质末尾（`mica-grow-data`
配合 `systemd-repart`，或 OpenRC 上的对应工具），下表是镜像出厂时的大小。

```text
一块磁盘（GPT）
+------------------------+--------------------+---------------------------------------->
| 1：ESP 或 FIRMWARE     | 2：SYSTEM          | 3：DATA（首次启动时扩展到末尾）
|  加载器、启动记录      |  只读挂载于        |  /mnt/data
|  （FIRMWARE：裸分区）  |  /mnt/system       |
+------------------------+--------------------+---------------------------------------->
                          deployments/         state/       -> /var/lib/mica、/etc/hostname、
                          kernels/  roots/                     /etc/machine-id（只读）、/usr/local/...
                          sets/core/           meta/        -> 更新事务、回执
                          extensions/          mica/        -> /mica（config、updates、volumes、
                          owner-certs/                          compose、diagnostics、ui）、
                          factory-reset/                        /root、/home
                                               containers/  -> /mica/containers
                                               srv/         -> /srv（任何重置层级都不打开它）
                                               var/         -> /var
                                               cache/、tmp/ -> 内部使用
```

`qemu-armhf` 把同样的 SYSTEM 和 DATA 作为 NOR 闪存上的 UBIFS 卷保存，每个签名对象另有一个静态卷（见下）。

| 板卡 | 分区 1 | 分区 2：SYSTEM | 分区 3：DATA（出厂大小） |
|---|---|---|---|
| `uefi-x64`、`uefi-arm64` | ESP，512 MiB | 1 GiB | 256 MiB |
| `mini-x64` | ESP，16 MiB | 98 MiB | 12 MiB |
| `cx3576` | FIRMWARE（原始），自扇区 64 起约 18 MiB：加载器，记录副本位于磁盘 16 MiB 和 17 MiB 处 | 1 GiB，自 18 MiB 起 | 256 MiB，自 1042 MiB 起 |
| `s905x5m` | FIRMWARE（原始），自扇区 64 起约 128 MiB：记录副本位于其中 120 MiB 和 124 MiB 处 | 1 GiB | 256 MiB |

`qemu-armhf` 把一切放在 UBI 管理的 NOR 闪存上：两个 64 MiB 的 CFI bank（擦除块 256 KiB），U-Boot
在第一个 bank 的前 1 MiB，第二个 bank 整个作为 `ubi` MTD 分区。它的卷：

| 卷 | 类型 | 内容 |
|---|---|---|
| `system` | 动态，UBIFS（镜像中 24 个 LEB） | SYSTEM 的小文件：描述符、根哈希签名、集合、扩展、owner 证书 |
| `data` | 动态，UBIFS（镜像中 24 个 LEB） | DATA；镜像中为空，首次挂载时格式化，板卡设置了 `ubi.storeReserve` 时在此之前增长一次 |
| `records-a`、`records-b` | 动态，各一个 LEB | 两份启动记录副本 |
| `k-<kernelId>`、`s-<kernelId>`、`r-<rootId>`、`c-<componentId>`、`x-<extId>` | 静态 | 内核的 `boot.itb`、其 support 镜像、根、core 组件、驱动扩展：大小正好是其签名长度 |
| `p.<name>` | 静态 | 正在写入的对象；回读校验后改名 |

UBIFS 没有项目配额，因此 UBI 板卡挂载 DATA 时不带配额，日志默认留在内存中。

## SYSTEM 存什么

SYSTEM 以只读方式挂载在 `/mnt/system`，只在 `mica-deploy` 操作内部、持有事务锁时才变为可写。

```
/mnt/system/
  deployments/<id>.json           签名的部署描述符（最多两个）
  kernels/<kernelId>/             启动镜像、support.img、根哈希签名
  roots/<rootId>/                 rootfs.img、rootfs.roothash、rootfs.roothash.p7s
  sets/core/<id>.json             签名的 core 集合（最多三个）
  sets/core/state.json            current、pending、pair、bound
  sets/core/objects/<componentId>/  core.img、core.roothash、core.roothash.p7s
  extensions/state.json           驱动扩展：已确认的构建、试运行中的变更
  extensions/objects/<extId>/     ext.json、ext.roothash.p7s、ext.img（每个内核最多 16 个）
  owner-certs/<sha256>.der        已登记的 owner 证书（最多 16 张）、audit.json
  factory-reset/                  request.json 和 snapshot/，仅在重置已暂存期间存在
```

对象按内容寻址，所以两个部署共享的内核或根只存一份。UEFI 板卡上启动记录是 ESP 上的加载器条目；
U-Boot 板卡上在 FIRMWARE 分区或记录卷中。

## DATA 存什么，出现在哪里

DATA 挂载在 `/mnt/data`。其顶层目录被绑定到程序使用的路径；除了系统本身，没有程序按名字写
`/mnt/data`。

| DATA 目录 | 出现在 | 内容 |
|---|---|---|
| `state/` | `/var/lib/mica`（来自 `state/mica`）、`/etc/hostname`、`/etc/machine-id`（只读）、`/usr/local/lib/systemd/system`、`/usr/local/etc`、网络守护进程的 `/etc` 目录 | 设备自己生成的东西和各服务渲染出的配置：`settings.toml`、标识与凭据、apid 的状态（`/var/lib/mica/apid`）、用户的 unit 与 fstab |
| `meta/` | `/mnt/data/meta` | 更新事务、目录检查点、固件回执、上次出厂重置的记录、在控制台确认过的 owner 证书、core 集合或扩展变更的试运行（`set-trial.json`） |
| `mica/` | `/mica`（以及来自 `mica/root` 和 `mica/home` 的 `/root`、`/home`） | `/mica/config`（每个关注点一份 JSON 文档，`0700`/`0600`）、`/mica/updates`（下载与暂存）、`/mica/volumes/<project>`、`/mica/compose`、`/mica/diagnostics`、`/mica/ui` |
| `containers/` | `/mica/containers` | 引擎的根目录（Podman 为 `storage`，Docker 为 `docker`）、其网络和 `tmp` |
| `srv/` | `/srv` | 用户数据；任何重置层级都不会打开它 |
| `var/` | `/var` | 持久的服务状态、缓存和日志（持久日志在这里） |
| `cache/`、`tmp/` | 内部 | 可丢弃，与 `var/` 共用同一限额 |

## 归属

| 物理命名空间 | 暴露的路径 | 归属与用途 |
|---|---|---|
| SYSTEM | `/mnt/system` 以及经校验的根/support 映射 | 最多两个签名部署、描述符和共享组件对象 |
| DATA/state | 选定的服务绑定、`/etc/machine-id`、随机种子、`/usr/local/etc`、`/usr/local/lib/systemd/system` | 设备标识、凭据、持久服务状态，以及用户自己的 unit 和 fstab |
| DATA/meta | `/mnt/data/meta` | 原生事务状态、目录检查点、固件回执和设备生命周期记录 |
| DATA/mica | `/mica`、`/home`、`/root` | 配置、容器卷、更新工作区和用户主目录 |
| DATA/containers | `/mica/containers` | 容器镜像、可写层和网络定义 |
| DATA/srv | `/srv` | 用户数据；任何重置层级都不打开它 |
| DATA/var | `/var` | 持久服务状态、缓存、日志和临时文件，共用一个项目限额 |
| DATA/cache、DATA/tmp | 内部可丢弃路径 | 与 DATA/var 共用有界的可变数据项目 |
| 内存 | `/run`、`/tmp`，以及日志不持久时的 journal（UBI 板卡默认如此） | 每次启动的运行时状态 |
| 用户的磁盘 | `/srv` 及其下、`/var/mnt/<name>`、`/home/<user>`、引擎根目录 | 用户挂在那里的任何东西（见*用户挂载*一节） |

根始终只读。DATA/var 绑定覆盖整个 `/var`；服务无需各自挂载就能创建新的状态目录。首次启动时
`mica-seed-var` 在设置配额之后复制打包好的 var 模板，保留属主、权限和符号链接。之后的启动保留其
内容。受保护的 `/var/lib/mica` 和蓝牙凭据绑定不计入通用 var 配额。unit 来源目录绑定到其原有搜索
路径，DATA 就绪后重新加载。容器项目是 micad 的设置（`/mica/config/container/`），在 podman 上还有
`mica-containerd` 在 STATE 上的存储（`/var/lib/mica/containerd/`）；项目的命名卷在
`/mica/volumes/<project>/` 下。Netavark 定义使用 `/mica/containers/networks`。

`/mica`、`/var` 和 `/mica/containers` 的绑定使用 private 挂载传播，并与 `/srv`、`/home`、`/root` 一样
带 `nosuid,nodev`。受保护的状态和容器子挂载留在其逻辑路径上；它们不得出现在重置会遍历的物理
DATA 树里。

state/meta 是私有的物理目录。绑定出来的 Mica OS 状态根允许进入 networkd 组可读的 WireGuard 密钥
目录；凭据子目录仍为 0700，文档为 0600。只绑定获准的叶子目录，可以避免让某个服务访问无关的物理
状态命名空间。

## 可写路径一览

运行中的根能写什么、以什么选项（runkit 的挂载和 Base 的绑定；OpenRC 上由 `mica-mounts` 重复）：

| 路径 | 后端 | 是否写入 | 选项 |
|---|---|---|---|
| `/`、`/usr`、`/etc`、`/run/mica-core/<pkg>` | 根和 core 组件在 dm-verity 上的 squashfs（`/usr` 与 `/etc` 是它们的 overlay） | 从不 | `ro,nodev` |
| `/mnt/data` | DATA | 是 | `rw,nosuid,nodev,noatime`，开启配额时带 `prjquota` |
| `/mica`、`/mica/containers`、`/srv`、`/var` | DATA 的 `mica/`、`containers/`、`srv/`、`var/` 的绑定 | 是，分别计入项目 100、102、100、101 | `nosuid,nodev`，private |
| `/var/lib/mica`、`/root`、`/home` | DATA 的 `state/mica`、`/mica/root`、`/mica/home` 的绑定 | 是 | `nosuid,nodev` |
| `/etc/hostname`、`/usr/local/lib/systemd/system`、`/usr/local/etc`、网络守护进程的 `/etc` 目录 | DATA 的 `state/` 的绑定 | 是 | bind |
| `/run`、`/dev/shm` | tmpfs | 是，在内存中 | `nosuid,nodev` |
| `/dev` | devtmpfs | 内核 | `nosuid` |
| `/proc`、`/sys` | proc、sysfs | 内核 | `nosuid,nodev,noexec` |

程序写的其他任何东西都落在上面某处；用户自己的磁盘在此之外再添加。写到其他地方会以只读文件系统
错误失败。

## 配额

| 项目 | 覆盖 | 限额 |
|---|---|---|
| 100 | `mica/`、`srv/` | 无；报告用量 |
| 101 | `var/`、`cache/`、`tmp/` | DATA 的八分之一，32 至 256 MiB，以及 2048 至 16384 个 inode；DATA 增长后重新计算 |
| 102 | `containers/` | 无；报告用量。迁到磁盘上的容器根以该磁盘为限 |

所有 `gpt` 板卡都开启配额，UBI 上关闭。

## 用户挂载

用户只能在 `/usr/lib/mica/mica-mountpoint` 允许的地方挂载自己的磁盘：`/srv` 及其下、
`/var/mnt/<name>` 及其下、`/home/<user>` 及其下，以及正好在 `/mica/containers/storage` 或
`/mica/containers/docker`；swap 用稳定的设备名，或允许位置下的文件。systemd 上它们是用 `mica-unit`
安装的 `.mount`、`.automount` 和 `.swap` unit，由一个 generator 放进启动的第一个事务，排在
`local-fs.target` 和任何引擎之前；OpenRC 上它们是 `/usr/local/etc/fstab` 的行，由 `boot` 运行级别中的
`mica-fstab` 挂载。被拒绝的 unit 会被屏蔽，被拒绝的 fstab 行会让整个文件被拒绝。挂在 `/srv` 的挂载
取代默认的 DATA/srv 绑定，移除挂载后默认绑定会回来。根目录是用户挂载的引擎会依赖它（systemd 上
`RequiresMountsFor=`，OpenRC 上 `mica-require-mount`），所以磁盘缺失时引擎失败，而不是写满 DATA。
契约见 `mica-system-base:docs/floor-and-options.md` 的 *The user's own mounts*。

### 把容器存储迁到磁盘

引擎的根目录整体迁移；其网络和 `tmp` 留在 DATA（`mica-core:docs/mica-core.md` 6.1）：

1. 关闭容器（`container.enabled` 设为 false），等引擎停下。
2. 把新磁盘挂到用户可用的位置，比如 `/var/mnt/new`，带属主、权限和扩展属性复制根目录：
   `cp -a --preserve=xattr /mica/containers/storage/. /var/mnt/new/`（Docker 上是
   `/mica/containers/docker/.`）。然后卸载。
3. 清空 DATA 上的旧根目录（否则挂载会把它遮住，而它仍占用 DATA 的空间），并在引擎根目录声明这块
   磁盘的挂载。
4. 打开容器。此后引擎依赖这个挂载，没有它就不启动。

## 外接介质

micad 列出 USB 大容量存储和 SD 卡（从不包括板载 eMMC，也从不包括设备自己的磁盘），并把干净的、
文件系统受支持的卷（vfat、exFAT、通过 ext4 驱动的 ext2/3/4）以只读方式挂到
`/run/mica/media/<id>`，选项 `ro,nosuid,nodev,noexec`（systemd 上是 PID 1 的临时挂载 unit，OpenRC 上
由 micad 挂载）。需要修复的卷不去碰。卷或设备被使用时，卸载和弹出都会拒绝；介质上的东西从不被
写入。没有 USB 或 SD 主机控制器的内核报告 `supported: false`。API 是 `/api/v1/storage/media` 和
`/api/v1/update/media`（`mica-core:docs/mica-core.md` 第 4 节）。

| 卷状态 | 含义 |
|---|---|
| `mounted_readonly` | 已挂到 `/run/mica/media/<id>`，带 `availableBytes` |
| `unmounted` | 按请求卸载；插着期间保持卸载 |
| `detected`（`busy`、`mounted_outside_mica`） | 被别的东西挂载了 |
| `unsupported`（`filesystem_unsupported`、`filesystem_not_in_kernel`） | 不是 vfat、exFAT 或 ext2/3/4，或内核缺少驱动 |
| `failed`（`needs_repair`、`mount_failed`、`unreadable`） | 文件系统脏了或损坏，不去碰 |
| `removed` | 自上次读取后已拔出，只列出一次 |

当某个卷挂在 `/run/mica/media` 之外、挂在另一个命名空间中、被映射占用、作为设备节点被打开或有打开
的文件时，弹出会拒绝（409 `media_device_busy`）；否则它卸载并把每个卷报告为 `ejected`。设备不会被
断电。

## 容量

SYSTEM 严格按两个部署做预算。它包含 `deployments`、`roots` 和 `kernels`，包括经认证的描述符、哈希
文本和签名。下载的归档、未完成的下载和获取状态留在 DATA 的 `/mica/updates` 下；日志、用户数据和
应用状态也都在 SYSTEM 之外。短暂的对象发布文件由中断安装的清理流程删除。

出厂预检按两份完整载荷加 128 MiB SYSTEM 余量（UEFI ESP 为 64 MiB）做预算。格式化 SYSTEM 之后，
构建器先扣除实测的 ext4 元数据开销、保留块和内核内部的簇保留，再接受该载荷预算。运行时安装检查
实际的 `f_bavail`、inode 余量和可回收的已分配块，回收后再检查一次空闲空间。文件系统元数据和保留块
会减少可用容量，所以分区大小本身不是载荷上限。内容 ID 让未改变的对象在部署之间共享。cx3576 的
SYSTEM 分区保持 1 GiB。

绑定挂载共享同一个文件系统，不产生各自独立的容量总数。项目 100 统计 DATA/mica 和 DATA/srv；项目
102 单独统计 DATA/containers。这两个项目的字节和 inode 软/硬限额都是零，即在 DATA 可用容量内不限。
它们保留项目继承和用量报告，不做按比例的容量划分。

项目 101 一起覆盖 DATA/var、cache 和 tmp。其字节上限为 DATA 容量的八分之一，限制在 32–256 MiB；
inode 上限为 DATA inode 数的八分之一，限制在 2048–16384。这个有界的可变数据限额在 DATA 增长后重新
计算。镜像包含 ext4 的 quota/project 特性和对应的内置内核支持。对不限额的项目，API 报告的限额为零。

服务的能力边界集去掉了 `CAP_SYS_RESOURCE`，所以普通 root 服务无法绕过可变数据限额。固定的 growfs
辅助程序保留 ext4 扩容所需的能力。不受限的系统/用户/容器写入者可以写满 DATA；项目配额并不保证为
state/meta 预留空闲空间。

## 启动与故障

经认证的早期启动在 init 之前建立 DATA 和机器标识。板卡的 `mica-grow-data` 调用先核对 SYSTEM 分区
和磁盘 UUID，再把物理磁盘交给 `systemd-repart`。它使用打包好的分区定义；只有 DATA 有增长权重。
文件系统增长、命名空间初始化和配额设置都在使用者和绑定挂载之前完成。

DATA 缺失、只读或损坏属于共享数据故障。系统不会在不可变的根上创建默认凭据，也不会反复归咎于某个
根部署。SYSTEM 故障同样需要明确的恢复。有界的 journal 重放不同于完整的离线文件系统修复，启动时
不会自动尝试后者。

## API 与重置

`GET /api/v1/storage/status` 读取物理层级、暴露的绑定、目录用量、设备统计和受支持的磨损观测。缺失或
无法观测的值会如实报告。DATA 的容量只计一次，不会按每个绑定再相加。显式的工作区探测在系统所属的
更新工作区下创建并删除一个有界的测试文件。

重置在事务锁下作用于白名单中的物理目录。它核对目录身份、拒绝符号链接、把有东西挂在上面的目录
连同其下的一切原样保留（任何层级都不跨进挂载，也都不打开 `/srv`）、限制遍历的深度/数量/时间、同步
删除，并且只在完成后才清除持久的意图。出厂重置不是一个层级：它重建 DATA（[恢复](../operate/recovery.md)）。
配置和应用/用户数据的范围按所选的重置层级处理；机器标识、凭据和部署/生命周期记录按重置契约的要求
保留。根回滚从不承诺撤销任意的可写应用数据。
