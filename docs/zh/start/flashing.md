# 把 Mica OS 镜像写入板卡

一个发布带有安装该产品所需的文件。对大多数产品来说，那是一份压缩的磁盘镜像
`mica-<board>.<variant>-<stamp>.img.gz`：一整块 GPT 磁盘，含分区表、启动部件、签名根，
以及一个空的 DATA。本页讲每个产品如何进入设备、UEFI 产品如何在 QEMU 里启动，以及哪些
步骤目前还不是已验证的流程。

- 选发布、核对摘要：[获取发布版](download.md)。
- 镜像里有什么、每个分区多大：[存储](../../reference/storage.md)。
- 板子起来之后：[首次启动](first-run.md)。
- 不整盘重写、而是替换运行中的系统：[更新](../operate/updates.md)。

**已合格到什么程度，这里只说一次。** 这里记录在案的每一次启动都是 QEMU：没有任何
把 Mica OS 镜像写进 U 盘、SATA 硬盘、NVMe 或 eMMC 的记录，也没有任何实机启动拥有
认证行；在案的唯一一次实机观察（一块 `cx3576`）不算
（[板卡状态](../hardware/README.md#当前板卡)）。
下面的 QEMU 小节是实际跑过的，其中 amd64 的步骤是对一个已发布镜像跑的；硬件小节是从仓库里读出来的，未验证之处都有标注。
每个 amd64 产品都会在它的发布流程里被自动启动，而 `uefi-arm64` 镜像只被构建和校验、
没有自动流程启动它，
`cx3576` 与 `s905x5m` 的镜像则没有任何自动流程会启动：没有任何套件会启动 FIT 镜像——
FIT 那套跑在宿主机上，里面没有 QEMU（[获取发布版](download.md) 第 1 节）。

> status: board-dependent — evidence: `mica-build:boards/uefi-x64/evidence.json`, `mica-build:tests/suites/lifecycle-uefi/boot.sh`, `docs/hardware/README.md`

## 1. 写入之前

先校验文件，再解压：

```sh
sha256sum -c SHA256SUMS                              # 发布自带的清单：lock
gzip -dc mica-uefi-x64.basic-<stamp>.img.gz > disk.img
sha256sum disk.img                                   # 与层注解 mica.uncompressed-sha256 比较
```

完整的摘要链——`SHA256SUMS`、lock 的 `asset` 行、OCI 层及其 `mica.uncompressed-*`
注解——见[获取发布版](download.md#4-哪一步该核对哪个摘要)。

然后记住关于这次写入的三件事：

- **它替换整个介质。** 镜像是一整块磁盘：写入会销毁目标上落在镜像范围内的每一个
  分区。要在写之前认准设备，而不是写完之后。
- **镜像是签名的，板卡必须信任签名者。** 发布用 Mica 开发启动证书签名。只信任
  Microsoft 密钥的 UEFI 机器会拒绝这个 loader，转向下一个启动项或报 Secure Boot
  违规；不存在退回到无签名的路径。FIT 板卡的 U-Boot 只接受用编译进它的证书签名的
  内核。
- **DATA 小是故意的。** 出厂 256 MiB，首次启动时扩展到介质大小；SYSTEM 恰好 1 GiB，
  同时容纳两个部署。

> status: shipped — evidence: `mica-build:src/image/file-layout.ts`, `docs/security/signing.md`, `docs/start/download.md`

## 2. 每个产品：发布里有什么，怎么进入设备

| 产品 | 发布里带什么 | 怎么进入设备 | 然后 |
|---|---|---|---|
| `uefi-x64.basic`、`uefi-x64.full` | 磁盘镜像 `.img.gz` | 把整个镜像写入 U 盘、SATA 硬盘或 NVMe（第 3 节），或在 QEMU 里启动（第 4 节） | 机器的固件启动 `EFI/BOOT/BOOTX64.EFI` |
| `uefi-arm64.basic`、`uefi-arm64.full` | 磁盘镜像 `.img.gz` | 同 `uefi-x64`；QEMU 见第 4.6 节 | 带 ACPI 的 UEFI 启动 `EFI/BOOT/BOOTAA64.EFI` |
| `mini-x64.basic` | 磁盘镜像 `.img.gz` | 把整个镜像写入 SATA、NVMe、SD 或 eMMC 介质（第 3 节），或在 QEMU 里启动（第 4 节）；**不能从 USB 启动**，内核没有 USB 驱动 | 同 `uefi-x64` |
| `cx3576.basic`、`cx3576.full` | 磁盘镜像 `.img.gz`，引导加载器在镜像里 | 经 USB 用 `rkdeveloptool` 写入并回读（第 5 节） | 板子从它的 eMMC 启动 |
| `s905x5m.basic`、`s905x5m.emmc-full` | USB 烧录包 `.burn.img.gz` | 板子进入 USB 烧录模式，用厂商的 USB Burning Tool（第 6 节） | 板子从它的 eMMC 启动 |
| `s905x5m.sd-full` | 磁盘镜像 `.img.gz`，以及引导加载器包 `.sd-boot.img.gz` | 引导加载器包用 USB 烧录一次；然后把磁盘镜像写入 SD 卡（第 6 节） | 板子从卡启动 |

每个发布还带有它的更新归档；那是给已经在运行 Mica OS 的设备用的
（[更新](../operate/updates.md)）。`dev` 产品只在本地构建，写入方式和同一块板的其他产品
一样。

无论镜像是怎么进去的，第一次接触都一样：设备在有线网口上通过 DHCP 取得地址，在 8080
端口提供管理 API，处于未认领状态，直到有人设置管理员密码（[首次启动](first-run.md)）。

各板卡之间的区别在于引导加载器放在哪里：

| 板卡 | 引导加载器 | 磁盘镜像能启动一块空设备吗？ | 状态 |
|---|---|---|---|
| `uefi-x64` | systemd-boot，在镜像的 ESP 里 | 能，只要 UEFI 启动 `EFI/BOOT/BOOTX64.EFI` | 仅在 QEMU 下运行过 |
| `uefi-arm64` | systemd-boot，在镜像的 ESP 里 | 能，只要带 ACPI 的 UEFI 启动 `EFI/BOOT/BOOTAA64.EFI` | 仅在 QEMU 下运行过 |
| `mini-x64` | systemd-boot，在镜像的 ESP 里 | 能，只要 UEFI 启动 `EFI/BOOT/BOOTX64.EFI` | 仅在 QEMU 下运行过 |
| `cx3576` | U-Boot，在镜像内第 64 扇区 | 能 | 未在实机上验证 |
| `s905x5m` | U-Boot，在 eMMC boot0 里，磁盘镜像之外 | **不能**；eMMC 产品的 USB 烧录包带着它，`sd-full` 把它作为单独的一个包发布 | 未在实机上验证 |

没有可选的 A/B 分区对，也没有从旧布局的转换：写入就是整盘写入。

> status: board-dependent — evidence: `mica-build:boards/uefi-x64/board.env`, `mica-build:boards/cx3576/board.env`, `mica-build:boards/s905x5m/board.env`, `mica-build:boards/mini-x64/board.env`, `mica-build:boards/s905x5m/images.tsv`

## 3. 实体机器上的 uefi-x64、uefi-arm64 与 mini-x64

### 镜像本身

uefi-x64 镜像是一块 GPT 磁盘，磁盘 GUID
`5AC35760-0064-4000-8000-000000000000`，三个分区：

| 分区 | 类型 | 起始扇区 | 大小 |
|---|---|---|---|
| `esp` | `C12A7328-F81F-11D2-BA4B-00A0C93EC93B` | 2048 | 512 MiB |
| `system` | `0FC63DAF-8483-4772-8E79-3D69D8477DE4` | 1050624 | 1024 MiB |
| `data` | `0FC63DAF-8483-4772-8E79-3D69D8477DE4` | 3147776 | 256 MiB |

ESP 是 FAT，卷标 `MICAESP`，携带 `EFI/BOOT/BOOTX64.EFI` 和 `loader/loader.conf`。
只要 UEFI 固件启动 `BOOTX64.EFI` 它就能起来，所以整个镜像写到目标介质上。
`uefi-arm64` 的三个分区在同样的扇区上，加载器是 `BOOTAA64.EFI`；`mini-x64` 为 128 MB
闪存准备，ESP 16 MiB、SYSTEM 98 MiB、DATA 12 MiB。

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
> gzip -dc mica-uefi-x64.basic-<stamp>.img.gz | sudo dd of=/dev/sdX bs=4M status=progress conv=fsync
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

但固件必须*具备* Secure Boot 功能，只是把它关掉：早期 init 会读固件的 `SecureBoot`
变量，没有这个变量就拒绝启动。在 QEMU 下，这就是两种固件构建之间的区别（第 4.1 节）；
固件从未实现 Secure Boot 的机器启动不了这些镜像。怎样从镜像里读出证书见第 4.5 节。

> status: unsupported

## 4. QEMU：uefi-x64、mini-x64 与 uefi-arm64

UEFI 产品的磁盘镜像可以原样在 QEMU 里启动：不用转换，也不需要别的文件。这是真正跑过
的路径。下面 amd64 的步骤是对已发布的 `mini-x64.basic` 镜像（发布 `20261003-1916`，
QEMU 10.0，纯软件模拟）从头到尾跑过的；arm64 的命令行是验收套件运行的那一条。

### 4.1 需要什么

在 Debian 或 Ubuntu 上：

```sh
sudo apt-get install qemu-system-x86 ovmf curl jq             # amd64 guest
sudo apt-get install qemu-system-arm qemu-efi-aarch64         # arm64 guest
sudo apt-get install python3-virt-firmware sbsigntool mtools  # 仅在开启 Secure Boot 时需要（4.5）
```

| Guest | QEMU | 固件代码 | 变量存储模板 |
|---|---|---|---|
| amd64（`uefi-x64`、`mini-x64`） | `qemu-system-x86_64 -machine q35` | `/usr/share/OVMF/OVMF_CODE_4M.secboot.fd` | `/usr/share/OVMF/OVMF_VARS_4M.fd` |
| arm64（`uefi-arm64`） | `qemu-system-aarch64 -machine virt` | `/usr/share/AAVMF/AAVMF_CODE.secboot.fd` | `/usr/share/AAVMF/AAVMF_VARS.fd` |

**即使不开 Secure Boot，也要用带 `secboot` 的固件。** 早期 init 会读固件的 `SecureBoot`
变量，而不支持 Secure Boot 的固件根本没有这个变量：启动会被拒绝
（`boot selection could not be established`）。

### 4.2 取镜像

```sh
PRODUCT=mini-x64.basic        # 或 uefi-x64.basic、uefi-x64.full、uefi-arm64.basic……
curl -fsS https://res.micaos.dev/update/products/v1.json -o products.json
BASE=$(jq -r .baseUrl products.json)
jq -r --arg p "$PRODUCT" '.products[] | select(.product == $p) | .latest.files[]
      | select(.kind == "image" and .form == "disk") | "\(.path) \(.sha256) \(.uncompressedSha256)"' products.json |
while read -r path sha256 raw; do
  curl -fsSLO "$BASE$path"
  echo "$sha256  ${path##*/}" | sha256sum -c -
  gzip -dc "${path##*/}" > disk.img
  echo "$raw  disk.img" | sha256sum -c -
done
```

没有发布的产品在这里什么也不会输出；它要从源码构建（[构建](build.md)），镜像在
`mica-build` 检出目录的 `_out/products/<product>/image/` 下。一个发布还能校验什么，见
[下载](download.md)。

guest 会写 `disk.img`。保留下载的原件，在副本上工作，并给 DATA 留出空间：它出厂很小，
首次启动时扩展到磁盘末尾。

```sh
truncate -s 4G disk.img
```

### 4.3 启动，amd64

```sh
cp /usr/share/OVMF/OVMF_VARS_4M.fd vars.fd
qemu-system-x86_64 -machine q35 -cpu max -m 1024 -smp 2 \
  -nographic -no-reboot \
  -device i6300esb -watchdog-action reset \
  -netdev user,id=net0,hostfwd=tcp:127.0.0.1:8080-:8080,hostfwd=tcp:127.0.0.1:2222-:22 \
  -device virtio-net-pci,netdev=net0 \
  -drive if=pflash,format=raw,unit=0,readonly=on,file=/usr/share/OVMF/OVMF_CODE_4M.secboot.fd \
  -drive if=pflash,format=raw,unit=1,file=vars.fd \
  -drive if=none,id=disk0,format=raw,file=disk.img \
  -device virtio-blk-pci,drive=disk0,bootindex=0
```

每一部分都有用处：

- `-device i6300esb` 是**必需的**。早期 init 在做任何事之前先启动看门狗，没有看门狗
  就拒绝启动（`boot refused: required watchdog unavailable`）。
- `vars.fd` 是模板的一份新副本：没有注册任何密钥，所以 Secure Boot 是关闭的，guest
  不需要证书就能启动。根照样被验证：不管固件怎样，内核对每一个 verity 映射都要求有效
  签名。
- `hostfwd` 把 guest 8080 端口上的管理 API 转到宿主机的 `127.0.0.1:8080`，把 SSH 转到
  2222 端口（SSH 启用之后才有用）。
- `-nographic` 把串口控制台接到终端。用 `Ctrl-a x` 退出 QEMU。
- 宿主机与 guest 架构相同时加上 `-enable-kvm`；不加则是模拟执行，照样在十五秒左右
  起来。

### 4.4 正常启动是什么样子

控制台上依次是：早期 init（`mica-init: boot watchdog armed`、
`selected deployment <id>`、`verified deployment <id>`），根的 init 启动各项服务，DATA
扩展到磁盘末尾，最后是健康门的这一行：

```
mica-health: booted slot <id> marked good (PENDING_CONFIRM -> CONFIRMED)
```

然后在宿主机上：

```sh
curl http://127.0.0.1:8080/healthz
curl http://127.0.0.1:8080/api/v1/session        # {"state":"setup"}：设备尚未认领
```

带 Web 控制台的产品（`uefi-x64.*`、`uefi-arm64.*`）在 `http://127.0.0.1:8080/` 提供它，
第一个页面就是设置管理员密码。不带控制台的产品（`mini-x64.basic`）通过 API 认领：

```sh
curl -X POST -H 'content-type: application/json' \
  -d '{"password":"at-least-eight-bytes"}' http://127.0.0.1:8080/api/v1/setup   # 201
```

认领意味着什么、之后做什么，见[首次启动](first-run.md)。从 API 或控制台关机，或用
`Ctrl-a x` 退出 QEMU；设备的状态在 `disk.img` 和 `vars.fd` 里，下次启动会接着它继续。

### 4.5 开启 Secure Boot

开启 Secure Boot 意味着固件拒绝任何它没有对应证书的加载器。把发布所用的签名证书注册
进变量存储，代替 4.3 里那份原样副本：

```sh
# 证书从镜像自己的引导加载器里读出来。每块 UEFI 板的 ESP 都从 2048 扇区开始；
# arm64 上加载器是 BOOTAA64.EFI。
mcopy -i disk.img@@$((2048*512)) ::EFI/BOOT/BOOTX64.EFI loader.efi
sbattach --detach loader.sig loader.efi
openssl pkcs7 -inform DER -in loader.sig -print_certs -out db.cert.pem
openssl x509 -in db.cert.pem -noout -subject -fingerprint -sha256

virt-fw-vars --input /usr/share/OVMF/OVMF_VARS_4M.fd --output vars.fd \
  --set-pk 6b62601e-3448-4418-8923-7c9fa22ab09b db.cert.pem \
  --add-kek 6b62601e-3448-4418-8923-7c9fa22ab09b db.cert.pem \
  --add-db 6b62601e-3448-4418-8923-7c9fa22ab09b db.cert.pem --no-microsoft --sb
```

然后完全按 4.3 启动 QEMU，只是不再执行 `cp`。控制台会显示
`UEFI Secure Boot is enabled`。

从镜像里读出的证书只能证明加载器是用它签名的。要知道是谁签的，请把它的指纹和发布方
通过其他渠道给出的指纹对比。到目前为止的发布都用开发证书
`CN=MICA-development-boot` 签名，它不建立任何生产信任
（[安全生命周期](../../security/lifecycle.md)，英文）。

### 4.6 arm64

`uefi-arm64` 是同样的流程，换一套固件和机型；镜像的控制台是 PL011，且只有这一个：

```sh
cp /usr/share/AAVMF/AAVMF_VARS.fd vars.fd
qemu-system-aarch64 -machine virt -cpu max -m 1024 -smp 2 \
  -nographic -no-reboot \
  -device i6300esb -watchdog-action reset \
  -netdev user,id=net0,hostfwd=tcp:127.0.0.1:8080-:8080,hostfwd=tcp:127.0.0.1:2222-:22 \
  -device virtio-net-pci,netdev=net0 \
  -drive if=pflash,format=raw,unit=0,readonly=on,file=/usr/share/AAVMF/AAVMF_CODE.secboot.fd \
  -drive if=pflash,format=raw,unit=1,file=vars.fd \
  -drive if=none,id=disk0,format=raw,file=disk.img \
  -device virtio-blk-pci,drive=disk0,bootindex=0
```

在 amd64 宿主机上每条指令都是模拟执行的，所以 amd64 guest 几秒能完成的事，这里要按
分钟计。开启 Secure Boot 时照 4.5 做，换成 `AAVMF_VARS.fd` 和 `BOOTAA64.EFI`。

验收套件是在注册了证书的情况下运行这条命令的，这也是这块板现有的证据。像上面这样用
原样的变量存储启动，走的是 amd64 那次运行验证过的同一段代码，但在这里没有跑过：
`uefi-arm64` 还没有任何产品发布。

套件用的是 `virtio-blk-pci` 和 `virtio-net-pci`。内核还驱动 AHCI、NVMe、USB 存储和常见
网卡，所以原则上换别的磁盘或网卡型号也能起来，但未经测试，和这里每一条非 virtio 路径
一样。完全没有 MMC 驱动，这是有意的。

### 4.7 起不来的时候

| 控制台上 | 原因 | 处理 |
|---|---|---|
| `boot refused: required watchdog unavailable` | 没有看门狗设备 | 加上 `-device i6300esb -watchdog-action reset` |
| 紧接着 `signature policy ready` 出现 `boot selection could not be established` | 固件没有 `SecureBoot` 变量 | 用 4.1 里带 `secboot` 的固件 |
| 停在固件自己的 shell 或启动菜单，没有内核输出 | 开了 Secure Boot 但没有注册证书，或者磁盘不是启动设备 | 重新生成 `vars.fd`（4.3 或 4.5）；保留 `bootindex=0` |
| `127.0.0.1:8080` 没有应答 | 缺少 `hostfwd` 规则，或宿主机上该端口被占用 | 换一个宿主机端口 |
| guest 自己重启 | 启动卡住，看门狗触发了 | 看重启之前的控制台输出 |

### 4.8 离线更新与验收套件

离线更新介质通过 9p 交给 guest：

```sh
  -fsdev local,id=import,path=/path/to/offline,security_model=none,readonly=on \
  -device virtio-9p-pci,fsdev=import,mount_tag=mica-update
```

在设备上导入：

```sh
mount -t 9p -o trans=virtio,version=9p2000.L,ro mica-update /run/mica/import
mica-deploy import /run/mica/import/update.micaupd
```

整套验收——启动、运行时、更新、故障、重置、关机——是 `mica-build` 检出里的一个
target，针对在那里构建出来的产品：

```sh
make lifecycle-uefi PRODUCT=uefi-x64.dev
```

> status: shipped — evidence: `mica-build:tests/suites/lifecycle-uefi/boot.sh`, `mica-build:make lifecycle-uefi`, `mica-core:crates/mica-deploy/src/bin/mica-runkit/init/boot.rs`, `mica-build:boards/uefi-arm64/kernel/config`

原样的发布镜像会启动到它的各项服务。验收控制台上打印的 `FILE_AB_*` 标记来自套件自己
放进镜像的脚本，不属于发布镜像；不要指望在设备上看到它们。

> status: shipped — evidence: `mica-build:tests/suites/lifecycle-uefi/boot.sh`

## 5. cx3576

cx3576 上镜像就是整个介质，并且自带引导器：GPT 里有 `FIRMWARE`（LBA 64–36863）、
`SYSTEM`（36864–2134015，ext4 + verity）和 `DATA`（2134016–2658303）。我们的 U-Boot
（`u-boot-rockchip.bin`，idbloader + FIT）位于第 64 扇区，在受保护区间内——字节偏移
32768 处的四个字节 `RKNS` 是它的魔数——两份 64 KiB、带 CRC 的启动记录在 16 MiB 和
17 MiB。因此写镜像同时也写了引导器：没有单独的 idblock 步骤，这块板也不产出厂商
`update.img`。

写入路径是操作者在 USB 上运行的 `rkdeveloptool`；构建树不带刷机工具。**必须是解压后的 `.img`**，恰好 1 299 MiB = 1 362 100 224 字节。

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
[`docs/hardware/cx3576/rkdeveloptool`](../../hardware/cx3576/rkdeveloptool/README.md) 在固定的
上游提交上用两个补丁原生构建。

> status: board-dependent — evidence: `mica-build:boards/cx3576/loader/MiniLoaderAll.bin.sha256`, `docs/hardware/cx3576/rkdeveloptool/README.md`, `docs/hardware/cx3576.md`

> status: unsupported

## 6. s905x5m

这块板从 eMMC boot0 区域启动 Mica OS 的 U-Boot，从不从磁盘镜像启动，所以每条途径都从
Amlogic USB 烧录开始。下面两条途径都没有被本项目在实机上跑过；构建会解包自己生成的
每一个包，并证明每个载荷都与其来源一致。

**进入 USB 烧录模式。** 板子的 USB 口接到主机，按住恢复键再上电。板子会等待厂商的
USB Burning Tool，而不是启动；上电前松开恢复键则正常启动。

### 6.1 eMMC 产品：`s905x5m.basic` 与 `s905x5m.emmc-full`

一个发布只有一个要写入的文件：USB 烧录包
`mica-s905x5m.<variant>-<stamp>.burn.img.gz`，没有磁盘镜像。

1. 下载并校验它的 sha256（[下载](download.md)），然后解压：
   `gzip -dk mica-s905x5m.<variant>-<stamp>.burn.img.gz`。
2. 让板子进入 USB 烧录模式。
3. 在厂商的 USB Burning Tool 里加载 `.burn.img` 并烧录。它写入分区表、两个 bootloader
   目标、厂商设备树和 Mica OS 的三个分区，不动厂商的其他分区。
4. 断开连接，给板子上电。它从 eMMC 启动。

烧录会替换 eMMC 上的系统和数据：这是安装，不是更新。

### 6.2 SD 产品：`s905x5m.sd-full`

一个发布有两个文件：磁盘镜像 `mica-s905x5m.sd-full-<stamp>.img.gz` 和引导加载器包
`mica-s905x5m.sd-full-<stamp>.sd-boot.img.gz`。磁盘镜像只覆盖 SD 介质——第 64 扇区的
`FIRMWARE`、`SYSTEM`、`DATA`——所以把它写到卡上不会装上任何引导加载器；而加载器自己
若不是从 boot0 启动的，就拒绝自动启动。

1. **每块板一次：引导加载器。** 解压 `.sd-boot.img.gz`，让板子进入 USB 烧录模式，用
   厂商的 USB Burning Tool 烧录 `.sd-boot.img`。它把 Mica OS 的 U-Boot 装进 eMMC boot0，
   不碰别的东西。之后的发布只有在加载器变了的时候才需要再做一次。
2. **系统，写到卡上。** 解压 `.img.gz`，像第 3 节那样把它写到整张 SD 卡上，不要写到
   某个分区：

   ```sh
   gzip -dc mica-s905x5m.sd-full-<stamp>.img.gz | sudo dd of=/dev/sdX bs=4M status=progress conv=fsync
   ```

3. 插卡，给板子上电。它启动卡上的系统。

两个文件要取自同一个发布：加载器只接受用编译进它的证书签名的内核。

> status: unsupported

## 7. 首次启动

- **DATA 扩容。** 在 systemd 产品上，`systemd-repart` 把 DATA 分区扩展到设备大小，
  `systemd-growfs@mnt-data` 扩展它的文件系统；两个 unit 都必须是 active，验收套件
  会让不满足的启动失败。OpenRC 产品由 `mica-data-layout` 扩容。`make os-repart-test`（特权 docker）证明这次扩容不会抹掉
  loader；这个 target 存在，但 CI 不跑它。
- **一开始就有两个部署。** 工厂镜像携带两条签名部署记录，代次 g-1 和 g。在设备上就是
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
  的 deployment id；一个发布的 `mica-build.lock` 里的 `product` 行写明它发布的
  deployment id：`awk -F'\t' '$1 == "product"' mica-build.lock`。

> status: shipped — evidence: `mica-build:src/image/file-image.ts`, `mica-build:make os-repart-test`, `mica-core:crates/mica-deploy`, `docs/reference/storage.md`

完整的设备周期——写入、首次启动、更新、确认、回滚——没有在硬件上跑过。本节的设备侧
一半是从 `mica-core` 读出来的，并且是在 QEMU 里而不是在板子上被执行过。

> status: unsupported

## 8. 刷写不负责的事

- **只有一种厂商格式。** 一个发布携带它的镜像和更新归档；唯一的厂商格式是 Amlogic USB
  烧录包，`s905x5m` 用它发布 eMMC 产品和引导加载器。
- **没有分区级 A/B。** 两个部署都是 SYSTEM 上的文件，所以不存在“另一个槽”可刷
  （[更新](../../reference/updates.md)）。
- **不能靠重刷来升级。** 写镜像会抹掉 DATA。要把运行中的设备带到新发布，用更新归档
  （[更新](../operate/updates.md)）。

> status: shipped — evidence: `mica-build:boards/uefi-x64/images.tsv`, `docs/reference/updates.md`, `docs/operate/updates.md`
