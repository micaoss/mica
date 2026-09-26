# 把 Mica OS 镜像写入板卡

一个发布为每个产品发布一份压缩镜像 `mica-<product>-<release>.img.gz`。这个文件
是一整块 GPT 磁盘镜像：分区表、启动部件、签名根，以及一个空的 DATA。本页讲它
如何逐块板地进入设备，以及哪些步骤目前还不是已验证的流程。

- 选发布、核对摘要：[获取发布版](download.md)。
- 镜像里有什么、每个分区多大：[存储](../../design/storage.md)。
- 板子起来之后：[首次启动](first-run.md)。
- 不整盘重写、而是替换运行中的系统：[更新包](../../user/update-packages.md)。

**已合格到什么程度，这里只说一次。** 这里记录在案的每一次启动都是 QEMU：没有任何
把 Mica OS 镜像写进 U 盘、SATA 硬盘、NVMe 或 eMMC 的记录，也没有任何实机启动拥有
证据行。用户于 2026-09-20 报告一块 `cx3576` 在实机上启动成功；那条报告没有附带
产物，因此不是证据行，本页也不当它是
（[支持层级](../../boards/support-tiers.md)）。
下面的 QEMU 小节是实际跑过的；硬件小节是从仓库里读出来的，未验证之处都有标注。
日期很重要：板卡改名之后到 2026-09-19 之间发布的三轮 `uefi`（`20260916-0845`、
`20260916-1653`、`20260919-2103`）不会启动，而是在 PID 1 把机器关掉。请取
`20260920-0622` 或更新的镜像——它之前的那一轮仍然没有控制台登录
（[获取发布版](download.md) 第 1 节）；而自 `20260919-2356` 起，每个 amd64 产品都会被自动启动——每次推送
时一次，发布运行里再一次——而 `uefi-arm64` 镜像只被构建和校验、没有自动流程启动它，
`cx3576` 与 `s905x5m` 的镜像则没有任何自动流程会启动：没有任何套件会启动 FIT 镜像——
FIT 那套跑在宿主机上，里面没有 QEMU（[获取发布版](download.md) 第 1 节）。

> status: board-dependent — evidence: `mica-build:boards/uefi-x64/evidence.json`, `mica-build:tests/suites/lifecycle-uefi/boot.sh`, `docs/boards/support-tiers.md`

## 1. 写入之前

先校验文件，再解压：

```sh
sha256sum -c SHA256SUMS                              # 发布自带的清单，覆盖 .gz
gzip -dc mica-uefi-x64-dev-<release>.img.gz > disk.img
sha256sum disk.img                                   # 与 uncompressedSha256 比较
```

完整的摘要链——发布清单、lock 的 `asset` 行、索引的 `uncompressedSha256`、OCI 层
注解——见[获取发布版](download.md#4-哪一步该核对哪个摘要)。以
`mica-x64-dev-20260915-2230.img.gz` 为例——它发布于 2026-09-16 板卡改名之前，
所以带的是旧产品名——解压后的镜像是 1 881 145 344 字节，sha256 为
`e27709a9e54f6ffe92f4737cac18f3c00023547e406f7c670bfedb0d3849c6ef`，索引和 OCI 层
都是这么写的。

然后记住关于这次写入的三件事：

- **它替换整个介质。** 镜像是一整块磁盘：写入会销毁目标上落在镜像范围内的每一个
  分区。要在写之前认准设备，而不是写完之后。
- **镜像是签名的，板卡必须信任签名者。** 发布用 Mica 开发启动证书签名。只信任
  Microsoft 密钥的 UEFI 机器会拒绝这个 loader，转向下一个启动项或报 Secure Boot
  违规；不存在退回到无签名的路径。FIT 板卡的 U-Boot 只接受用编译进它的证书签名的
  内核。
- **DATA 小是故意的。** 出厂 256 MiB，首次启动时扩展到介质大小；SYSTEM 恰好 1 GiB，
  同时容纳两个部署。

> status: shipped — evidence: `mica-build:src/image/file-layout.ts`, `docs/design/release-signing.md`, `docs/user/download.md`

## 2. 各板卡的镜像里有什么

每块板只声明一种镜像类型 `disk`，由内建打包器产生——没有实现任何厂商 packer。
区别在于引导器放在哪里。

| 板卡 | 固件形态 | 裸镜像能启动一块空板吗？ | 状态 |
|---|---|---|---|
| `uefi-x64` | `efi`（systemd-boot 在 ESP 里） | 能，只要 UEFI 启动 `EFI/BOOT/BOOTX64.EFI` | 仅在 QEMU 下合格 |
| `uefi-arm64` | `efi`（systemd-boot 在 ESP 里） | 能，只要带 ACPI 的 UEFI 启动 `EFI/BOOT/BOOTAA64.EFI` | 自 2026-09-16 起是发布目标；仅在 QEMU 下合格 |
| `cx3576` | `rockchip-loader` | 能——U-Boot 就写在镜像的第 64 扇区 | 未在实机上验证 |
| `s905x5m` | `amlogic-boot0` | **不能**——U-Boot 从 eMMC boot0 运行，在镜像之外 | 没有受支持的路径 |

`uefi-x64`、`uefi-arm64`、`cx3576` 自 `20260916-1653` 起都有已发布的镜像；
`s905x5m` 于 2026-09-19 被开放为发布目标，自其首个发布起开始发布——这改变的
是“有什么可下载”，不是“能写入什么”：它的镜像仍然不会装上任何引导器，理由见第 6 节。
没有可选的 A/B 分区对，也没有从旧布局的转换：写入就是整盘写入。

> status: board-dependent — evidence: `mica-build:boards/uefi-x64/board.env`, `mica-build:boards/cx3576/board.env`, `mica-build:boards/s905x5m/board.env`, `mica-build:boards/cx3576/images.tsv`

## 3. uefi-x64

### 镜像本身

已发布的 uefi-x64 镜像是一块 GPT 磁盘，磁盘 GUID
`5AC35760-0064-4000-8000-000000000000`，三个分区，以下数据读自
`mica-x64-dev-20260915-2230.img`（旧 `x64` 名下发布的最后一个镜像；布局属于板卡，
并未随改名变化）：

| 分区 | 类型 | 起始扇区 | 大小 |
|---|---|---|---|
| `esp` | `C12A7328-F81F-11D2-BA4B-00A0C93EC93B` | 2048 | 512 MiB |
| `system` | `0FC63DAF-8483-4772-8E79-3D69D8477DE4` | 1050624 | 1024 MiB |
| `data` | `0FC63DAF-8483-4772-8E79-3D69D8477DE4` | 3147776 | 256 MiB |

ESP 是 FAT，卷标 `MICAESP`，携带 `EFI/BOOT/BOOTX64.EFI` 和 `loader/loader.conf`。
只要 UEFI 固件启动 `BOOTX64.EFI` 它就能起来，所以整个镜像写到目标介质上。

> status: shipped — evidence: `mica-build:boards/uefi-x64/board.env`, `mica-build:src/image/file-layout.ts`

### 内核能驱动哪些介质

固定版本的 uefi-x64 内核内建了：USB 主机 XHCI 与 EHCI 加 `USB_STORAGE`，经 AHCI 和
`ATA_PIIX` 的 SATA，NVMe，以及给虚拟机用的 virtio-blk 和 virtio-scsi。
`CONFIG_USB_UAS` 没有开，所以只支持 UAS 的硬盘盒会退回 bulk-only 传输或者干脆不被
驱动；`CONFIG_MMC` 完全没开：挂在 MMC 控制器上的读卡器不被驱动，而 USB 读卡器属于
普通 USB 大容量存储，是被驱动的。

所以从驱动角度的答案是：U 盘和 USB 硬盘、SATA、NVMe。这些介质中哪些被组装侧判为
合格仍然是开放问题——没有做过任何实机测试。

> status: board-dependent — evidence: `mica-build:boards/uefi-x64/kernel/config/uefi-x64.config`, `mica-build:make kernel-config-test`

### 写入（未验证）

这里没有人做过、也没有人见证过一次实体 uefi-x64 写入。下面的命令只是组装侧会采用的
形式；不要把这一段里的任何东西当作已合格的流程发布出去，并且要预料到认错目标设备
才是真正危险的地方：

> ```sh
> # NOT VERIFIED: never run against physical hardware by this project
> lsblk -o NAME,SIZE,TYPE,TRAN,MODEL,MOUNTPOINTS      # 插入设备前后各看一次
> udevadm info --query=property --name=/dev/sdX | grep -E 'ID_BUS|ID_MODEL|ID_SERIAL'
> gzip -dc mica-uefi-x64-dev-<release>.img.gz | sudo dd of=/dev/sdX bs=4M status=progress conv=fsync
> sync
> sudo cmp -n 1881145344 /dev/sdX disk.img            # 或者回读后比较 sha256
> sudo sfdisk -d /dev/sdX                             # 应为 2048、1050624、3147776
> ```
>
> 写整个设备（`/dev/sdX`），绝不要写某个分区；先卸载桌面自动挂载的一切。`bs=4M`
> 是吞吐量选择，`conv=fsync` 加 `sync` 才是让写入在拔出介质之前落盘的那一步。

> status: unsupported

### 实体机上的 Secure Boot（未验证）

要启动一个发布镜像，操作者必须把该发布的启动证书注册进固件的 `db`——通常经由固件的
Setup Mode，各厂商各不相同——或者关闭 Secure Boot。关闭它不会削弱根：签名的内核
命令行里仍然带着 `dm_verity.require_signatures=1`，根依然受 verity 保护。Secure Boot
管的是谁可以加载内核，不是根是否被校验。

> status: unsupported

## 4. QEMU：uefi-x64 与 uefi-arm64

这是真正跑起来的那条路；对 `uefi-arm64` 而言，它也是唯一有证据支撑的路径。自
2026-09-16 起该板卡是发布目标，其内核携带通用硬件驱动——AHCI、NVMe、经 xHCI 与 EHCI
的 USB 存储，以及作为模块的常见网卡——但**携带驱动不等于有证据证明某台机器能启动**：
它的合格范围仍只有 QEMU `virt`，与 `uefi-x64` 相同
（[板卡档案](../../boards/uefi-arm64.md)）。

验收实验室使用的固件文件：

| Guest | 代码 | 变量 | 机型 |
|---|---|---|---|
| amd64 | `/usr/share/OVMF/OVMF_CODE_4M.secboot.fd` | `/usr/share/OVMF/OVMF_VARS_4M.fd` | `qemu-system-x86_64 -machine q35` |
| arm64 | `/usr/share/AAVMF/AAVMF_CODE.secboot.fd` | `/usr/share/AAVMF/AAVMF_VARS.fd` | `qemu-system-aarch64 -machine virt` |

变量存储做一次就够，注册该发布的启动证书——正是这一步让 guest 信任镜像：

```sh
cp /usr/share/AAVMF/AAVMF_VARS.fd vars.template.fd          # uefi-x64 用 OVMF_VARS_4M.fd
virt-fw-vars --input vars.template.fd --output vars.fd \
  --set-pk 6b62601e-3448-4418-8923-7c9fa22ab09b db.cert.pem \
  --add-kek 6b62601e-3448-4418-8923-7c9fa22ab09b db.cert.pem \
  --add-db 6b62601e-3448-4418-8923-7c9fa22ab09b db.cert.pem --no-microsoft --sb
```

然后启动镜像：

```sh
qemu-system-aarch64 -machine virt -cpu max -m 1024 -smp 2 \
  -nographic -no-reboot -device i6300esb -watchdog-action reset \
  -netdev user,id=net0 -device virtio-net-pci,netdev=net0 \
  -drive if=pflash,format=raw,unit=0,readonly=on,file=/usr/share/AAVMF/AAVMF_CODE.secboot.fd \
  -drive if=pflash,format=raw,unit=1,file=vars.fd \
  -drive if=none,id=disk0,format=raw,file=disk.img \
  -device virtio-blk-pci,drive=disk0,bootindex=0
```

uefi-x64 是同一条命令行，换成 `qemu-system-x86_64 -machine q35` 和 OVMF 文件。在
`-drive if=none,id=disk0,…` 的值后面加 `,readonly=on` 可以只读启动镜像。guest 会
写 `disk.img`，所以先复制一份。

`uefi-arm64` 的 guest 必须提供什么：控制台是 PL011（`console=ttyAMA0,115200n8`）
且没有第二个，看门狗是内建的 i6300esb，RTC 是 PL031 或 EFI，ACPI button 是开的，
所以宿主请求的优雅关机能传到 guest。套件用的是 `virtio-blk-pci` 和 `virtio-net-pci`；
自 2026-09-16 起内核还驱动 AHCI、NVMe、USB 存储和常见网卡，所以原则上换别的磁盘或
网卡型号也能起来——未经测试，和这里每一条非 virtio 路径一样。完全没有 MMC 驱动，
这是有意的：从平台 MMC 控制器启动的机器属于另一块硬件板，而不是这个镜像。

离线更新介质通过 9p 递进去：

```sh
  -fsdev local,id=import,path=/path/to/offline,security_model=none,readonly=on \
  -device virtio-9p-pci,fsdev=import,mount_tag=mica-update
```

设备侧由验收套件挂载并导入：

```sh
mount -t 9p -o trans=virtio,version=9p2000.L,ro mica-update /run/mica/import
mica-deploy import /run/mica/import/update.micaupd
```

整套验收——启动、运行时、更新、故障、重置、关机——在 `mica-build` 里是一个 target：

```sh
make lifecycle-uefi PRODUCT=uefi-arm64-dev
```

> status: shipped — evidence: `mica-build:tests/suites/lifecycle-uefi/boot.sh`, `mica-build:make lifecycle-uefi`, `mica-build:boards/uefi-arm64/kernel/config`, `docs/boards/uefi-arm64.md`

普通的发布镜像启动到登录提示符并拉起它的服务。验收控制台上打印的 `FILE_AB_*`
标记来自套件自己塞进镜像的脚本，不是出厂镜像的行为；在设备上不要指望看到它们。

> status: shipped — evidence: `mica-build:tests/suites/lifecycle-uefi/boot.sh`

## 5. cx3576

cx3576 上镜像就是整个介质，并且自带引导器：GPT 里有 `FIRMWARE`（LBA 64–36863）、
`SYSTEM`（36864–2134015，ext4 + verity）和 `DATA`（2134016–2658303）。我们的 U-Boot
（`u-boot-rockchip.bin`，idbloader + FIT）位于第 64 扇区，在受保护区间内——字节偏移
32768 处的四个字节 `RKNS` 是它的魔数——两份 64 KiB、带 CRC 的启动记录在 16 MiB 和
17 MiB。因此写镜像同时也写了引导器：没有单独的 idblock 步骤，这块板也不产出厂商
`update.img`。

写入路径是操作者在 USB 上运行的 `rkdeveloptool`；构建树不再带刷机工具（用户决定，
2026-09-22）。**必须是解压后的 `.img`**，恰好 1 299 MiB = 1 362 100 224 字节。

| 步骤 | Loader/RockUSB 模式 | Maskrom 模式 |
|---|---|---|
| 1 | -- | `sha256sum -c boards/cx3576/loader/MiniLoaderAll.bin.sha256` |
| 2 | -- | `rkdeveloptool db boards/cx3576/loader/MiniLoaderAll.bin` |
| 3 | `rkdeveloptool wl 0 <image>` | 同左 |
| 4 | `rkdeveloptool rl 0 36864 boot.bin`，与镜像前 36 864 扇区比较；再 `rkdeveloptool rl 36864 2623488 rest.bin`，与其余部分比较 | 同左 |
| 5 | `rkdeveloptool rd`——复位，只有两次比较都通过才执行 | 同左 |

先单独回读引导器区间：这一段的部分写入或损坏是唯一会让板卡跳过恢复键变砖的失败。
仓库里提交的厂商 loader `boards/cx3576/loader/MiniLoaderAll.bin`（786 937 字节）由
`rkdeveloptool db` 下载进内存；它从不嵌入镜像，也不是 U-Boot 的构建输入。**在 `db` 和
`rd` 之间不要断电、拔线或复位板卡。**

回读不一致时不执行 `rd`——设备停在 Loader 模式，可以立刻重刷。已经起不来的板卡，恢复
路径就是 Maskrom（SoC 的 USB 恢复模式）加上表中的 Maskrom 列。

操作者的前置条件：`PATH` 上有 `rkdeveloptool`，以及对设备的 USB 访问权限。macOS 上按
[`docs/boards/cx3576/rkdeveloptool/`](../../boards/cx3576/rkdeveloptool/README.md) 在固定的
上游提交上用两个补丁原生构建。

> status: board-dependent — evidence: `mica-build:boards/cx3576/loader/MiniLoaderAll.bin.sha256`, `docs/boards/cx3576/rkdeveloptool/README.md`, `docs/boards/cx3576.md`

> status: unsupported

## 6. s905x5m

今天没有任何受支持的办法把 Mica OS 装进一块空的 s905x5m。这块板已于 2026-09-19 被
开放为发布目标，因此它的镜像会像其它板一样被发布——而这在这里什么也不改变：**被发布
不等于可安装**，它的实机合格认证仍未完成，下面几段就是原因。

原因在于固件放在哪里。Mica OS 的 U-Boot（`u-boot.bin.signed`）从 eMMC boot0 区域
执行，前面是目标端生成的 512 字节 Amlogic 头；当来源不是 boot0 时，loader 拒绝自动
启动。磁盘镜像只覆盖 SD 介质——第 64 扇区的 `FIRMWARE`、`SYSTEM`、`DATA`——所以把它
写到卡上不会装上任何引导器，只有 boot0 里已经带着配套 Mica OS U-Boot 的板卡才能从
它启动。

朝着未来流程已有的东西：`make -C boards/s905x5m uboot` 构建签名的 U-Boot 及其 DDR
固件，`make -C boards/s905x5m uboot-package` 构建一个 Amlogic v2 `update.img`
（固定版本的 `aml_image_v2_packer`，通过再次解包来校验），其中以
`bootloader.PARTITION` 携带签名的 U-Boot，并有意省略 `gpt.bin` 和 `bootloader_a`，
使烧录流程只框住硬件启动区域、碰不到用户区 GPT。哪个主机工具消费这个镜像、boot0
如何写入与回读、变砖的板卡如何恢复，全都既没写下来也没测试过——属于
`mica-boards` 与 `mica-build` 共同拥有的台架工作。

> status: unsupported

## 7. 首次启动

- **DATA 扩容。** `systemd-repart` 把 DATA 分区扩展到设备大小，
  `systemd-growfs@mnt-data` 扩展它的文件系统；两个 unit 都必须是 active，验收套件
  会让不满足的启动失败。`make os-repart-test`（特权 docker）证明这次扩容不会抹掉
  loader；这个 target 存在，但 CI 不跑它。
- **一开始就有两个部署。** 工厂镜像携带两条签名部署记录，代次 g-1 和 g——对
  `x64-dev` `20260915-2230` 来说是第 3 代和第 4 代。在设备上就是
  `/mnt/system/deployments/` 里恰好两个描述符和恰好两个启动项；更新因此永远不会让
  设备失去可启动的回退。
- **loader 如何选择。** 工厂 ESP 上的 `loader/loader.conf` 写着 `timeout 0`、
  `editor no` 和 `auto-entries no`，每个部署一个启动项，名为
  `loader/entries/mica-<deployment id>+3.conf`——systemd-boot 的启动计数，三次尝试，
  bless 成功后改名。内核位于 `EFI/mica/kernels/<kernel id>.efi`。FIT 板卡把同样的
  记录（`tries = 3`）放在固件区域内冗余的 U-Boot 环境里。
- **今天没有出厂配置种子。** 产品可以携带 `provisioning.toml`，构建会把它作为
  `mica-provisioning.toml` 放到 ESP 上（仅 UEFI 板卡）；树里今天没有任何产品带着它，
  所以已发布的镜像里没有。设备拿到它之后做什么见[首次启动](first-run.md)。
- **正在运行的是哪个版本。** `mica-deploy status` 和 `mica-deploy booted` 报告运行中
  的 deployment id；用索引映射回去：
  `jq -r '.products[]|[.product,.release,.generation,.deployment]|@tsv' mica-index.json`。

> status: shipped — evidence: `mica-build:src/image/file-image.ts`, `mica-build:make os-repart-test`, `mica-core:crates/mica-deploy`, `docs/design/storage.md`

完整的设备周期——写入、首次启动、更新、确认、回滚——没有在硬件上跑过。本节的设备侧
一半是从 `mica-core` 读出来的，并且是在 QEMU 里而不是在板子上被执行过。

> status: unsupported

## 8. 刷写不负责的事

- **没有厂商镜像类型。** 每块板都声明 `image disk builtin`；`rockchip-update`
  这个 packer 在工具里被点名并被拒绝。一个发布携带裸磁盘镜像和更新归档，没有别的。
- **没有分区级 A/B。** 两个部署都是 SYSTEM 上的文件，所以不存在“另一个槽”可刷
  （[更新](../../design/updates.md)）。
- **不能靠重刷来升级。** 写镜像会抹掉 DATA。要把运行中的设备带到新发布，用更新归档
  （[更新包](../../user/update-packages.md)）。

> status: shipped — evidence: `mica-build:boards/uefi-x64/images.tsv`, `docs/design/updates.md`, `docs/user/update-packages.md`
