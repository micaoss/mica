# 快速上手

到一个运行中的 Mica OS 系统，最短且诚实的路径是：在 QEMU 里跑一个已发布的 amd64 UEFI
镜像，大约一分钟，不需要硬件。这也是唯一跑过的路径——还没有任何实体机器从发布镜像
启动过（[刷写](../start/flashing.md)）。

## 1. 需要什么

跑已发布镜像：`curl`、`jq`、`sha256sum`、`gzip`，以及带 OVMF 固件的
`qemu-system-x86_64`（Debian 或 Ubuntu 上 `apt-get install qemu-system-x86 ovmf`）。
改为自己构建：可用的 docker daemon，加上 bash、make、git 和 python3——每一个编译器、
文件系统工具和签名工具都运行在固定版本的 build-env 镜像里。

> status: shipped — evidence: `mica-build:tests/suites/lifecycle-uefi/boot.sh`, `mica-build:Makefile`, `docs/start/build.md`

## 2. 取一个已发布的镜像

```sh
PRODUCT=mini-x64.basic        # 任何一个有发布的 uefi-x64 或 mini-x64 产品
curl -fsS https://res.micaos.dev/update/products/v1.json -o products.json
BASE=$(jq -r .baseUrl products.json)
jq -r --arg p "$PRODUCT" '.products[] | select(.product == $p) | .latest.files[]
      | select(.kind == "image" and .form == "disk") | "\(.path) \(.sha256)"' products.json |
while read -r path sha256; do
  curl -fsSLO "$BASE$path"
  echo "$sha256  ${path##*/}" | sha256sum -c -
  gzip -dc "${path##*/}" > disk.img
done
truncate -s 4G disk.img                       # 给 DATA 留出扩展空间
```

哪些产品有发布见[下载页](https://micaos.dev/download/)；一个发布还能校验什么见
[获取发布版](download.md)。镜像是一整块 GPT 磁盘——ESP、SYSTEM、DATA——并携带两份签名
部署。

> status: shipped — evidence: `docs/start/download.md`, `mica-build:src/image/file-layout.ts`

## 3. 在 QEMU 里启动它

```sh
cp /usr/share/OVMF/OVMF_VARS_4M.fd vars.fd
qemu-system-x86_64 -machine q35 -cpu max -m 1024 -smp 2 -nographic -no-reboot \
  -device i6300esb -watchdog-action reset \
  -netdev user,id=net0,hostfwd=tcp:127.0.0.1:8080-:8080 -device virtio-net-pci,netdev=net0 \
  -drive if=pflash,format=raw,unit=0,readonly=on,file=/usr/share/OVMF/OVMF_CODE_4M.secboot.fd \
  -drive if=pflash,format=raw,unit=1,file=vars.fd \
  -drive if=none,id=disk0,format=raw,file=disk.img \
  -device virtio-blk-pci,drive=disk0,bootindex=0
```

串口控制台在终端上（`Ctrl-a x` 退出 QEMU），guest 的管理 API 在
`http://127.0.0.1:8080`。控制台打印出下面这行时，启动就完成了：

```
mica-health: booted slot <id> marked good (PENDING_CONFIRM -> CONFIRMED)
```

看门狗设备和带 `secboot` 的固件都是必需的；原样复制的变量存储让 Secure Boot 保持关闭，
用来看看这个系统已经足够。开启 Secure Boot、arm64 的命令行，以及起不来时怎么办，见
[刷写](../start/flashing.md)第 4 节。

> status: shipped — evidence: `mica-build:tests/suites/lifecycle-uefi/boot.sh`, `mica-build:make lifecycle-uefi`

## 4. 或者先自己构建镜像

```sh
make locks-verify
make os-pool
make product PRODUCT=uefi-x64.dev
make product-verify PRODUCT=uefi-x64.dev
```

产物落在 `mica-build` 检出目录下的 `_out/products/uefi-x64.dev/`。`uefi-x64.dev` 是开发变体，只在本地
构建、从不发布；`uefi-x64.basic` 用同样的方式构建。构建不会凭空造出密钥或输入：签名
材料是显式的（`make os-devkeys` 写出一套开发密钥），每一项输入都来自 `locks/`。
在线与离线的完整路径见[构建指南](../start/build.md)。

> status: shipped — evidence: `mica-build:Makefile`, `mica-build:src/product/build.ts`, `docs/start/build.md`

## 5. 首次访问

首次启动会在 DATA 上播下设备身份，并只由这个身份推出主机名
（`mica-<前 8 位十六进制>`，绝不取自 DHCP 或 MAC），把 DATA 扩展到介质大小，
然后拉起 micad 和 apid。无论镜像如何，SSH 都是关闭的；此时还没有任何凭据，
设备处于**未认领**状态。

在 Web 控制台的第一个页面（`http://127.0.0.1:8080/`）认领它；产品不带控制台时
（`mini-x64.basic`）通过 API 认领：

```sh
curl http://127.0.0.1:8080/api/v1/session        # {"state":"setup"}
curl -X POST -H 'content-type: application/json' \
  -d '{"password":"at-least-eight-bytes"}' http://127.0.0.1:8080/api/v1/setup
```

成功返回 `201` 并建立浏览器会话；对已认领的设备返回 `409 already_configured`。完全没有网络的设备改用
`mica-provisioning.toml` 文档认领，见[首次启动](first-run.md)和[配置](../operate/configuration.md)。

> status: shipped — evidence: `mica-core:crates/micad/src/provisioning.rs`, `mica-core:crates/mica-apid`, `docs/integrate/provisioning.md`

## 6. 继续

- [刷写](../start/flashing.md)——按板卡把镜像写进设备。
- [更新与回滚](../operate/updates.md)和[更新包](../operate/updates.md)——让
  运行中的设备前进。
- [应用](../integrate/applications.md)——负载与持久数据。

> status: shipped — evidence: `docs/start/flashing.md`, `docs/operate/updates.md`, `docs/integrate/applications.md`
