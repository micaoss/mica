# 存储

Mica OS 把软件和可写状态分开。UEFI 板为 ESP/SYSTEM/DATA；U-Boot 板（cx3576、s905x5m）为
FIRMWARE/SYSTEM/DATA；裸 NAND 板（qemu-armhf、ssd202d）是 UBI 卷 `system`、`data`，以及每个
签名组件各一个卷。只有 DATA 随介质扩容。SYSTEM 存放不可变的签名部署文件；固件独立于普通
系统更新。除此之外，用户自己的磁盘和外部介质属于用户（第 3、4 节）。

> status: shipped — evidence: `mica-build:boards/uefi-x64/board.env`, `mica-build:boards/cx3576/board.env`, `mica-build:boards/qemu-armhf/board.env`

## 1. 文件放在哪里

根只读，从不写入。设备写入的东西都在 DATA 上：

| 路径 | 用途 |
|---|---|
| `/mica/config` | 通过 API 管理的设备配置 |
| `/mica/containers`、`/mica/volumes` | 容器引擎的存储与各项目的卷 |
| `/srv` | 用户的文件；任何重置都不打开它 |
| `/home`、`/root` | 由 `/mica` 支撑的持久用户目录 |
| `/var/mnt/<name>` | 除 `/srv` 与 `/home` 外，用户挂载自己磁盘的位置 |
| `/usr/local/etc`、`/usr/local/lib/systemd/system` | 用户自己的 fstab 与单元，位于 DATA 的 state |
| 明确列出的 `/var/lib` 叶目录 | DATA 上的持久服务状态 |
| `/var/tmp` | 有配额的磁盘临时数据 |
| `/run`、`/tmp` | 本次启动的易失数据 |

`/mica`、`/srv`、`/var`、`/home` 与 `/root` 以 `nosuid,nodev` 挂载。身份、凭据和服务状态
位于物理 DATA/state，更新和生命周期记录位于 DATA/meta。这些命名空间由系统管理；配置请
通过 API 完成，不要编辑它们的内部文件。

`/var` 父目录树只读，只有明确支持的叶目录可写；任意新建的 `/var` 目录会以 EROFS 失败。
系统日志默认跨启动保存在 DATA 上，UBI 板卡上则只在内存里；控制台的 Logging 一节可以修改。

> status: shipped — evidence: `docs/reference/storage.md`, `docs/architecture.md`, `mica-system-base:debs/mica-systemd/payload/etc/systemd/system`

## 2. 容量与清理

所有 DATA 绑定共享一个文件系统。存储 API 与控制台的 Storage 页面只报告一次容量，并同时
给出目录/项目统计和绑定就绪状态。在 ext4 上，`/mica` 与 `/srv`、可丢弃的缓存、`/tmp` 与
`/var`（DATA 的八分之一，32 到 256 MiB），以及容器存储分属不同的配额项目，所以大量写入或
可丢弃的写入方占不走关键状态需要的空间。普通服务不能借 `CAP_SYS_RESOURCE` 绕过这些限制。

重置层级只删除它在 DATA 上的白名单范围，从不跨进挂载点（[恢复](recovery.md)）。系统回滚
不会撤销可写的应用数据。整盘重刷替换当前镜像内容，但不是对镜像以外每个物理扇区的安全擦除。

> status: shipped — evidence: `mica-core:crates/micad/src/storage_status.rs`, `mica-core:crates/micad/src/reset.rs`, `mica-system-base:payload/usr/lib/mica/mica-data-layout`

## 3. 你自己的磁盘

你接上的磁盘（第二块 SATA 或 NVMe 盘、USB 硬盘）由你挂载，挂在属于用户的位置：

- `/srv` 本身或其下任何位置。挂在 `/srv` 上会替换 DATA 的 `/srv`，后者保持原样，移除你的
  挂载后会回来；
- `/var/mnt/<name>` 及其下；
- `/home/<user>` 及其下；
- 恰好在容器引擎的根上，Podman 是 `/mica/containers/storage`，Docker 是
  `/mica/containers/docker`，让镜像和容器不占 DATA；
- swap：用 UUID、标签或 ID 指定的磁盘，或上述位置（`/srv` 与引擎根除外）上的一个文件。

其他位置一律拒绝（`mica-unit: refused mountpoint <path>`），裸的 `/dev/sdX`、`/dev/mmcblkN`
或 `/dev/nvme*` 也被拒绝，因为它们不能长期指认同一块磁盘。挂载选项由你决定；请用
`nosuid,nodev`。

**在 systemd 上**，写一个按路径命名的 `.mount`、`.automount` 或 `.swap` 单元，用
`mica-unit` 安装并启用，然后重启：

```ini
# srv.mount
[Unit]
Description=/srv on my data disk
[Mount]
What=/dev/disk/by-uuid/1b2c...
Where=/srv
Type=ext4
Options=nosuid,nodev,noatime
[Install]
WantedBy=local-fs.target
```

```sh
mica-unit install srv.mount && mica-unit enable srv.mount
```

**在 OpenRC 上**，在 `/usr/local/etc/fstab` 里加一行（设备用 `UUID=` 或 `LABEL=` 指定；
没有 `/dev/disk/by-*`），用 `mica-unit fstab check` 检查，然后重启。`mica-fstab` 在启动时按
顺序挂载各行；某一行失败是致命的，除非它写了 `nofail`：

```
UUID=1b2c... /srv ext4 nosuid,nodev,noatime 0 2
```

**把容器存储移到磁盘上。**在引擎关闭时把磁盘恰好挂在引擎根上（如上）；此后引擎依赖这个
挂载，没有它就不启动，所以磁盘缺失时是引擎启动失败，而不是写满 DATA。DATA 上原有引擎根
里的镜像和容器不会被搬过去。

任何重置都不打开 `/srv`，也不跨进这些挂载；恢复出厂重新建立 DATA，也不碰它们。

> status: shipped — evidence: `mica-system-base:docs/floor-and-options.md`, `mica-podman:README.md`, `mica-docker:README.md`

## 4. 外部介质

U 盘和 SD 卡列在控制台的 Storage 页面上，也可用 `GET /api/v1/storage/media` 读取。内核支持
其文件系统的干净卷（vfat、ext2/3/4，以及除 `uefi-arm64` 外每块板上的 exFAT）以只读方式
`ro,nosuid,nodev,noexec` 挂载在 `/run/mica/media/<id>` 下；需要修复的卷不动。Storage 页面
可以卸载某个卷，或在拔出前弹出整个设备；只要还有东西在用它，弹出就会被拒绝并说明原因。
介质上什么都不写，其中的更新归档从手动更新一节导入（[更新](updates.md) 第 4 节）。没有
USB 或 SD 主机的板卡（`ssd202d`）会报告不支持介质。

> status: board-dependent — evidence: `mica-core:docs/mica-core.md`, `mica-build:boards/uefi-x64/kernel/config/uefi-x64.config`, `mica-build:boards/uefi-arm64/kernel/config/uefi-arm64.config`

## 5. 故障

DATA/SYSTEM 缺失、只读或损坏时，受影响的启动路径会停下来等待明确的恢复。系统不会在
不可变根上创建默认凭据，不会重置用尽的计数器，也不会悄悄挂载一个替代的状态目录。报告故障
时请保存串口输出和镜像/组件身份。

实体 eMMC 的耐久性和板卡恢复需要 cx3576 台架测试；QEMU 和离线检查只证明它们所声明的软件
行为。

> status: board-dependent — evidence: `docs/reference/boot.md`
