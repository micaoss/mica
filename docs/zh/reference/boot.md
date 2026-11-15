# 启动与 runkit

Mica OS 设备从上电到一个已确认、正在运行的系统要经过这些环节：选出部署并计数试运行次数的加载器、
签名的内核、在任何代码运行之前用签名镜像拼出系统的 runkit、确认系统的健康门，以及最后释放
一切的关机流程。契约见 `mica-core:docs/mica-core.md` 第 6.4 至 6.6 节和
`mica-system-base:docs/floor-and-options.md`；各板卡的事实来自 `mica-build` 中每块板的
`board.env` 与 `layout.tsv`。

## 1. 整条链一览

```
UEFI 板卡：   固件 ─▶ systemd-boot（启动计数）─▶ 签名 UKI ─┐
U-Boot 板卡： ROM ─▶ U-Boot micaboot（记录、试运行计数）─▶ FIT ─┤
                                                               ▼
  mica-runkit init（initramfs 的 PID 1，无网络，无 shell）
    verity 根 + support ─▶ core 集合 ─▶ DATA ─▶ 出厂重置（若已暂存）
    ─▶ 封存 owner 密钥环 ─▶ 驱动扩展 ─▶ 机器标识
                                                               ▼
  根文件系统的 init（systemd 或 OpenRC）─▶ 服务 ─▶ mica-health ─▶ 确认
```

| 板卡 | 加载器 | 内核镜像 | 启动记录 | 启动信任 | 加载器是否启用看门狗 |
|---|---|---|---|---|---|
| `uefi-x64`、`uefi-arm64`、`mini-x64` | systemd-boot（`mica-systemd-boot`） | UKI，已登记 Secure Boot 时由 UEFI 校验 | ESP 上的加载器条目 | Secure Boot | --（由 runkit 启用内核的看门狗） |
| `cx3576` | U-Boot `micaboot` | 必须带签名的 FIT | FIRMWARE 分区里的两份 64 KiB 副本 | `fit`（签名） | 是（`DW_WATCHDOG`） |
| `s905x5m` | U-Boot `micaboot` | 必须带签名的 FIT | FIRMWARE 分区里的两份 64 KiB 副本 | `fit`（签名） | 是（`AMLOGIC_MESON_GXBB_WATCHDOG`） |
| `qemu-armhf` | NOR 闪存上的 U-Boot `micaboot` | 只校验哈希的 FIT | UBI 卷 `records-a` 和 `records-b` | `none` | 是（`I6300ESB_WDT`） |

runkit 不按名字认识任何板卡：板卡就是签名启动策略里的 `board` 段，在 initramfs 中是
`/etc/mica/boot.json`，系统运行后是 `/run/mica/boot-policy.json`。它写明启动后端
（`uefi` 或 `uboot-fit`）、内核格式（`uki` 或 `fit`）、启动分区、SYSTEM 与 DATA 的 GPT 编号、
固件目标、FIT 板卡的记录几何，以及可选的看门狗、保留空间 `reserves`（SYSTEM、ESP、DATA 各
1 MiB 至 1 GiB）、`dataQuotas`、`bootTrust`、`storage`（默认 `gpt`，或 `ubi`），以及 `gpt` 板卡上
出厂重置重建 DATA 所用的格式 `dataFormat`。策略在使用前先校验，写入任何东西之前先核对磁盘符合其
几何（`mica-core:docs/mica-core.md` 6.4）。

## 2. 部署、记录与试运行

一个**部署**是一份签名描述符，指明一个内核组件（内核、带 runkit 的 initramfs，以及包含模块和
固件的 support 镜像）和一个根组件。SYSTEM 最多保存两个。启动记录指明它们，并为处于试运行的
部署计数剩余次数：

- **新部署从三次尝试开始。**加载器在启动任何东西*之前*先减一次并持久化；这次写入失败就什么都
  不启动。尝试次数用完的条目永远不会被选中。
- **两份记录副本。**每次写入都改不活跃的那份，所以中断的写入留下的要么是完整的旧副本，要么是
  完整的新副本。CRC 不对、或者 UBI 卷读不完整的副本视为无效，另一份生效。
- **回退。**试运行中的部署用完尝试次数后，加载器启动保留的已确认部署。没有可用部署时，启动停下
  等待明确的恢复操作：计数器从不重新填充，也从不尝试未签名的内容。

| 板卡类别 | 记录在哪 | 格式 |
|---|---|---|
| UEFI | ESP 上的 systemd-boot Type #1 条目，使用 systemd-boot 自己的启动计数；固定版本的加载器在无法持久化减一时拒绝启动 | 每个部署一个条目，每个内核一个共享的签名 UKI |
| U-Boot，磁盘 | 原始 FIRMWARE 分区里的两份 64 KiB 副本（cx3576：磁盘起始处 16 MiB 和 17 MiB；s905x5m：FIRMWARE 分区内 120 MiB 和 124 MiB） | 字节 0–3 为第 5 字节起的 CRC-32，字节 4 为标志，随后是 `mica_entries=v1|...` 和零；按 U-Boot 冗余环境的规则选活跃副本 |
| U-Boot，UBI | `records-a`、`records-b` 两个卷的前 65 536 字节 | 同样的格式；以原子 LEB 替换写入，从不用整卷更新 |

## 3. 加载器与内核的信任

- **UEFI。**登记了 Secure Boot 的固件校验签名 UKI，UKI 里包含内核、initramfs 和固定的命令行。
  systemd-boot 选择条目并计数这次尝试。
- **签名 FIT（`bootTrust: fit`，默认）。**`micaboot` 是编译进 U-Boot 的命令：读记录、减一，然后
  加载一个 FIT，U-Boot 用嵌在自身控制设备树里的公钥校验其配置签名。它不导入启动脚本、不导入
  环境变量、也没有可编辑的命令行；它为内核设置 `/chosen/mica,deployment-id`。
- **只校验哈希的 FIT（`bootTrust: none`，qemu-armhf）。**QEMU 把控制设备树交给 U-Boot，因此无法
  在其中嵌入密钥；U-Boot 只校验 FIT 的哈希。设备报告启动未经验证（`bootVerified` 为 false）。
  加载器之后的一切照常成立：内核要求签名的 dm-verity 根哈希，每个部署、集合和固件记录都用策略里
  的密钥认证。失去的是来自加载器的那一环：能写闪存的人可以把内核、initramfs 以及其中的密钥一起
  换掉。

内核以 `dm_verity.require_signatures=1` 运行：根、support 镜像、core 组件或驱动扩展，没有它接受的
根哈希签名就不会被映射。密钥在内核里，从来不在设置里（[签名](../../security/signing.md)）。

## 4. `mica-runkit init` 的各个阶段

`mica-runkit` 是一个静态可执行文件；以 `init` 运行时它是签名 initramfs 的 PID 1。这一阶段没有网络、
没有 shell。依次：

1. **要求签名强制并启用看门狗。**看门狗以 close-on-exec 持有并要求 NOWAYOUT，所以 exec 进入根的
   init 时它保持未停止地关闭。内核的 `watchdog: watchdog0: watchdog did not stop!`（KERN_CRIT，
   见 `dmesg` 与 `journalctl -b -p err`）是设计使然，每次启动都会出现；计时器一直运行，直到根去
   喂它（systemd 的 `RuntimeWatchdogSec`，或 OpenRC 上的 `mica-watchdog` 服务）。
2. **读取签名启动策略并认证所选部署**：用策略密钥校验描述符的 Ed25519 签名、其板卡、架构和产品，
   以及启动它的内核。
3. **映射 support 镜像和根**为签名的 dm-verity 设备：磁盘板卡上是 loop 设备，UBI 板卡上是静态卷的
   `ubiblock`。数据块在读取时校验。
4. **组合 core 组件**（第 5 节）。
5. **打开 DATA**（第 7 节）：有 LUKS2 头就按头处理，空的加密 DATA 会被格式化，否则 DATA 是普通 ext4
   （UBI 板卡上是 UBIFS）。已暂存的出厂重置在这里、挂载之前执行。DATA 挂载到 `/mnt/data`，除非
   板卡关闭了配额，否则带项目配额，并设置好项目目录。
6. **封存 owner 密钥环并映射驱动扩展**（第 6 节）。
7. **生成持久的机器标识**，保存在 DATA（`state/machine-id`，只生成一次），并以只读方式绑定到
   `/etc/machine-id`。
8. **交给**根的 init：systemd，或 `openrc-init`。

runkit 留给运行中系统的文件：

| 文件 | 内容 |
|---|---|
| `/run/mica/boot.json` | 启动回执：`deploymentId`、`entry`、`kernelId`、`rootfsId`、`contentVerified`、`secureBoot`、`backend` 和 `bootVerified`（UEFI Secure Boot 下，或 FIT 板卡信任为 `fit` 时为 true） |
| `/run/mica/boot-policy.json` | 签名启动策略 |
| `/run/mica/core.json` | 本次组合的 core 集合（`coreSetId`）；试运行中为 `pending`，与部署一起试运行时为 `paired` |
| `/run/mica/trust.json` | `ownerKeyring`（`sealed` 或 `absent`）以及每张 owner 证书的 `state`（`loaded`、`unconfirmed`、`rejected`） |
| `/run/mica/extensions.json` | 每个驱动扩展的 `state`（`mapped`、`unused`、`refused`），以及这些构建是否是试运行中的变更 |
| `/run/mica/runkit.json` | runkit 能执行什么：`factoryReset`、`factoryResetVersion`、`dataEncrypted` |
| `/run/mica/factory-reset.json` | 出厂重置之后：`requested`、`formatted`、`unremoved` |

## 5. core 组件

micad（连同 apid 和 `mica` 命令）以及 Web 控制台不在根里：它们是 **core 组件**，各自是带
dm-verity 树的 `/usr` 与 `/etc` 的 squashfs，与产品分开、以签名的 **core 集合**发布
（[更新引擎](updates.md#core-集合)）。启动时 runkit 这样选集合：

- 与正在启动的部署配对的集合，在该部署启动时使用；
- 否则用该部署绑定的集合；
- 否则为单独待定的集合花一次启动去试，或者组合当前集合。

无法认证、无法选出组件或不完整的待定集合会被跳过。必须组合却组合不了的集合，或者根本没有集合，
会让启动停止。它选出特性与产品 `FEATURES`（`micad`、`ui`）相符的组件，把每个映射为
`mica-core-<package>` 并挂到 `/run/mica-core/<package>`，拒绝任何会遮盖根或其他组件文件的组合，
然后把 `/usr` 和 `/etc` 挂成组件树叠在根之上的只读 overlay，没有可写层。文件出现在软件包本该
使用的路径（`/usr/bin/micad`、`/etc/init.d/apid`、各个 unit 及其链接）。

组件还声明它能运行的根接口级别以及它需要的根软件包；选择结果在根上不成立的集合永远不会被组合
上去（`mica-core:docs/mica-core.md` 6.2 与 6.5）。

## 6. owner 密钥环与驱动扩展

内核用其次级密钥环校验每个根哈希签名：内置密钥，以及在带 owner 密钥环的内核上（`uefi-x64`、
`mini-x64`、`qemu-armhf`）的 `.mica_owner`，它在 runkit 封存之前是空且开放的。顺序就是保证：

1. support 镜像、根和每个 core 组件在只信任内置密钥时映射；
2. 加入 SYSTEM 上登记的证书（`owner-certs/`）；产品启动策略要求实体确认时，每张之前没确认过的证书
   会在设备控制台上显示（SHA-256 和主题），30 秒内按 Enter 才加入；
3. 密钥环被封存（`KEYCTL_RESTRICT_KEYRING`），无论有没有加入证书；无法封存的密钥环会让启动停止；
4. 之后才映射驱动扩展：每个映射为 `mica-ext-<name>` 并挂到 `/run/mica-ext/<name>`，按其描述符以及
   当前内核的 id、版本和架构核对。它们的模块在 `/run/mica-modules` 中叠在 support 镜像的模块之上，
   由根的 `depmod` 建索引，`/usr/lib/modules` 与 `/usr/lib/firmware` 成为只读 overlay。

映射失败的扩展为 `refused`，映射了但不符合的为 `unused`；两种情况启动都会继续。出厂重置的那次
启动不加载 owner 证书，也不映射扩展（[驱动与 owner 证书](../security/overview.md)）。

## 7. 启动时的 DATA

- **明文。**磁盘板卡上是 ext4（UBI 板卡上是 UBIFS），以 `rw,nosuid,nodev,noatime` 挂载，开启配额时
  带 `prjquota`。
- **加密**（签名启动策略中的 `dataEncryption`，所有已发布产品都关闭）：LUKS2 头由第一个能解锁的
  密钥提供者（`tpm2`）打开，映射为 `mica-data`。加密开启且 DATA 是全新的时，runkit 登记提供者和
  一个恢复口令，然后在映射内格式化。没有提供者能解锁的头会拒绝启动（`DATA is locked`），且永远
  不会再被格式化。控制台上有一行 `MICA_DATA stage=on|off|locked ...`。
- **增长。**磁盘上，DATA 在首次启动后增长到磁盘末尾；被中断的增长会在正式挂载前用一次挂载与卸载
  重放。设置了 `ubi.storeReserve` 的 UBI 板卡上，空的 `data` 卷在首次挂载前调整一次大小，给存储
  留出保留空间。
- **已暂存的出厂重置**（针对正在启动的部署）在挂载前执行：用根自带的 `mke2fs` 重建 DATA（UBI 上
  清空 `data` 卷），恢复 `meta/` 的快照，根在首次启动时在 SYSTEM 上完成重置
  （[恢复](../operate/recovery.md)）。

## 8. 确认：健康门

试运行在 `mica-health`（属于 mica-system）确认时结束。它检查 `/etc/mica/health.conf` 的要求：
默认是 init 已起来且不处于 `maintenance` 或 `stopping`，以及镜像带 micad 时 micad 在总线上应答
（`if-installed=micad`）。它不等待网络。然后它运行 `mica-deploy confirm`，把这次启动尝试的东西变为
当前：部署、core 集合或驱动扩展变更。失败的 unit 会被报告，但从不致命。systemd 上它是
`mica-health.service`，失败时有 `mica-boot-failure`；OpenRC 上它在 default 运行级别最后、前台运行，
所以它的输出会到控制台。

从不确认的试运行会用完尝试次数，加载器启动回退部署；在根运行之前的失败，如果当时只有 core 集合
或扩展变更在单独试运行，就记在这个变更上，部署保留。

## 9. 关机

- **x86-64 与 aarch64 上的 systemd**：systemd 把 runkit 的 `shutdown` 作为只在内存中的退出 ramdisk
  exec。它按依赖顺序释放 loop 和 device-mapper 映射，只有在没有任何挂载、映射或 loop、且没有脏页
  时才释放存储。每一步在控制台上一行 `MICA_SHUTDOWN stage=...`。`quiesced` 之后释放失败的关机会在
  一次有界的 `sync` 后强制执行（`stage=forced-action`）；其他失败以 `stage=failed` 结束，等看门狗
  复位。
- **OpenRC**（以及所有 32 位板卡）：没有退出 ramdisk；关机运行级别把 DATA 变成只读后，`openrc-init`
  自行重启。
- **UBI 板卡**：无论哪种 init 都没有退出 ramdisk；根在重启前把 UBIFS 变成只读。

## 10. 可能出什么问题

| 你看到的 | 含义 | 怎么办 |
|---|---|---|
| 每次启动都有 `watchdog: watchdog0: watchdog did not stop!` | 预期行为：runkit 把已启用的看门狗交给根 | 无需处理 |
| 更新后设备启动的是之前的版本 | 新部署在三次尝试内没有确认 | 见[更新](../operate/updates.md)：读更新状态的 `lastRollback` 和上一次启动的日志 |
| 启动在进入根之前因策略、签名或几何错误停下 | 镜像或磁盘与签名策略不符 | 重刷镜像（[恢复](../operate/recovery.md)） |
| `DATA is locked` | 没有密钥提供者能解锁的加密 DATA | 用恢复口令打开，或重刷 |
| 启动时拒绝了某个 core 集合（启动继续用当前集合） | 待定集合在这个根上选不出组件或不完整 | 它会等系统更新；无需处理 |
| `/run/mica/extensions.json` 里某个驱动扩展为 `refused` 或 `unused` | 其签名不受信任，或是为别的内核构建的 | 为这个内核上传构建（[驱动](../security/overview.md)） |
| `MICA_SHUTDOWN stage=failed` | 存储无法干净释放 | 看门狗会复位板卡；读上一次启动的日志 |

## 11. 检查一次启动

```sh
cat /run/mica/boot.json          # 启动的部署、bootVerified
cat /run/mica/core.json          # 本次组合的 core 集合
cat /run/mica/trust.json         # owner 密钥环与证书
mica-deploy status               # 部署、试运行、集合、扩展（JSON）
```

`mica-deploy status` 把部署及其试运行、`sets.core` 下的 core 集合和驱动扩展打印成一个 JSON 对象。
runkit 自己的控制台输出以 `mica-init:` 开头（例如
`mica-init: persistent DATA identity ready before system init`）。

## 12. cx3576：签名 FIT 路径详解

cx3576 的正常启动路径是 `mica-build:boards/cx3576/loader/mica-file-boot.c` 中编译进去的 C 策略。
它读取三分区几何和有界的部署记录，在发现存储之前启用看门狗，持久化一次试运行减一，然后加载必须
带签名的 FIT。它不导入命令、启动脚本、环境变量，也没有可编辑的根命令行。

### 开发控制台策略

系统开发期间保留标准的 U-Boot 串口交互：`Hit any key to stop autoboot: 1` 等一秒，任意键进入原生
命令提示符，超时则执行 `bootcmd=micaboot`。在提示符下，`boot`、`run bootcmd` 或 `micaboot` 都会
回到同一套签名部署策略。关闭这个入口需要用户明确要求；签名启动或启动清理相关的改动不得悄悄移除它。

该策略是在未修改的原生主循环里注册的命令，所以倒计时和命令行都是 U-Boot 自己的。

倒计时和命令行在选择部署之前，所以进入控制台不消耗试运行次数。`micaboot` 一旦开始，就禁用
Control-C、要求 FIT 校验、检查恢复键、启用看门狗，并执行有界的部署事务。倒计时期间按住恢复键
进入 RockUSB。原生控制台等待输入时会服务循环看门狗调度器。持久环境命令保持禁用；交互命令是本地
开发入口，不是锁定的生产控制台。

强制的 RK3576 看门狗使用已开启的 PCLK_WDT0 与 TCLK_WDT0 时钟门。探测或启动失败会报告错误，并在
访问介质或消耗尝试次数之前进入恢复。RockUSB 恢复在等待 USB 时运行循环调度器，使已启用的看门狗
持续被喂。固件构建会测试固定版本的看门狗驱动和恢复循环，并核对控制 FDT 节点。物理复位和交接给
Linux 仍是台架验收项。

### 磁盘契约

以 `mica-build:boards/cx3576/layout.tsv` 为准。

| 分区 | 范围 | 内容 |
|---|---|---|
| FIRMWARE | LBA 64 至 36863 | 加载器和两份试运行记录副本 |
| SYSTEM | 18 MiB 至 1042 MiB | 1 GiB 的不可变内核/support/根对象和签名部署信封 |
| DATA | 从 1042 MiB 起，出厂镜像中 256 MiB | 持久状态、元数据、用户数据和有界的可丢弃命名空间 |

加载器从字节 32768 开始，上限 16744448 字节。两份 64 KiB 记录副本从磁盘绝对偏移 16 MiB 和 17 MiB
开始。这些偏移相对于整个磁盘；通过分区 1 的原生访问要减去它 32768 字节的起点。整个保留区是一个
GPT 分区，所以 DATA 扩展不会覆盖加载器或记录字节。

装配器写入两个各自独立认证的出厂部署。当前记录是严格的，最多两个条目。每个条目绑定部署 ID、
内核 ID、generation 以及已确认/试运行状态。CRC 和冗余副本序号处理选出一份完整副本；格式错误的
字段、重复的标识和无效计数器都会被拒绝。两份记录都不可用时，不会用默认值重建计数器。

### 选择与确认

试运行从三次尝试开始。固件在加载候选部署之前减一并持久化。持久化或回读失败会阻止启动。尝试
用尽的记录不会被选中。健康的用户空间只通过 `mica-deploy` 确认自己这个经认证的运行部署；没有
任何早期 systemd 服务会悄悄认可它。

有界次数的失败试运行后，选用保留的可用部署。一个都没有时，启动停下等待明确恢复。SYSTEM/DATA
共享存储的故障报告为存储恢复失败，不会通过重置计数器或尝试未签名内容来"修复"。确认和垃圾回收
在删除任何受保护的东西之前，会认证所有保留的描述符。

FIT 校验使用随 U-Boot 控制 FDT 一起发布的公钥。签名流程从实际产出的加载器中提取该 FDT，并检查
对内核、DTB 和 initramfs 的必需配置签名。密钥集支持明确的新旧重叠和旧密钥移除。生产策略没有
持久环境命令导入途径。

机器标识在 systemd 之前、在经认证的物理 DATA 上只生成一次，并只读绑定到 `/etc/machine-id`。
试运行记录不是标识数据库。

### 构建与恢复

用 `make cx3576-uboot-mica` 加上明确的公开启动签名输入构建该板的签名策略加载器；内核内容信任单独
提供。`bin/bun.sh src/cli.ts components` 用明确的输入打包签名 FIT、固件、根、部署和完整的出厂磁盘。

整镜像刷写前检查当前 GPT 和加载器位置，然后才进行 USB 写入。复位前回读比对整个刷写的镜像。
独立的固件维护是明确的离线操作，见[发布签名](../../security/signing.md)；它不进入普通部署目录，
也不执行不可逆的登记。

### 验收

当前的加载器、FIT 签名、严格记录解析器、原生事务故障、整镜像校验器和真实 DATA 增长测试都有软件
证据。脏的 SYSTEM 快照已由固定版本的 U-Boot sandbox 读取；缺失的未提交候选需要有界回退。这些结果
不能证明物理 eMMC 的持久性。

在本地台架上，要记录健康启动、三次失败试运行、尝试次数持久化失败、用户空间之前的挂起/看门狗
复位、共享存储恢复，以及在目标写入、sync、激活、减一和确认各点断电时的确切镜像/组件 ID 和串口
输出。在这些观察存在之前，cx3576 的物理验收仍未完成。
