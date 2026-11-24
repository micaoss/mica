# 驱动：所有者证书与驱动扩展

如何给设备加上你自己的内核模块：生成签名身份，在设备上登记它的证书，用内核开发包（KDK）针对设备的确切内核构建并
签名模块，把它作为驱动扩展安装，并在内核更新时保留它。契约见 `mica-core:docs/mica-core.md` 第 6.2 和 6.3 节；保证
其安全的启动顺序见[启动](../reference/boot.md)第 6 节。

## 开始之前

- **内核带有所有者密钥环的板卡：**`uefi-x64`、`uefi-arm64`、`mini-x64` 和 `qemu-armhf`。在 `cx3576` 和 `s905x5m`
  上，所有驱动都编译进了板卡内核，没有扩展（[内核特性](../reference/kernel-features.md)）。在 `uefi-x64` 和
  `uefi-arm64` 上，先看看通用内核自带的驱动模块是否已覆盖你的硬件。
- **一台已认领的设备**及其管理员密码：每次修改都要再输一次。控制台“系统”页有“驱动”标签；API 路由在
  `/api/v1/system/` 下（[HTTP API](../reference/http-api.md)）。示例在工作站上使用这些变量：

  ```sh
  DEV=http://mica-a4e2e69e.local:8080
  AUTH="Authorization: Bearer mica_<id>_<secret>"   # 来自：mica tokens create laptop
  read -rs ADMIN_PASSWORD                           # 管理员密码
  ```

- **一台工作站**，装有 Docker、git 和 bun，以及检出到设备所运行发布标签（例如 `uefi-x64.full.20261124-1351`）的
  [mica-build](https://github.com/micaoss/mica-build)。它的 `driver-key` 和 `driver-ext` 工具不需要 Mica OS 的其他
  任何东西。

> status: board-dependent — evidence: `mica-core:docs/mica-core.md`, `docs/reference/kernel-features.md`, `mica-build:src/drivers/driver-ext.ts`

## 1. 生成签名身份（一次）

```sh
cd mica-build
bun src/cli.ts driver-key init --out ~/mica-owner --name "Example Ltd drivers"
ls ~/mica-owner
# owner-ca.cert.pem  owner-ca.key.pem  signer.cert.pem  signer.key.pem
```

| 文件 | 是什么 |
|---|---|
| `owner-ca.cert.pem` | 在设备上登记的证书（公开） |
| `owner-ca.key.pem` | CA 密钥：离线保管，用它签发更多签名密钥 |
| `signer.key.pem`、`signer.cert.pem` | 构建使用的签名密钥及其证书 |

默认是 RSA-3072；`--type ecdsa` 生成 P-256 密钥。密钥在容器中离线生成；Mica OS 不签发也不持有它们。

> status: shipped — evidence: `mica-build:src/drivers/driver-key.ts`

## 2. 在设备上登记证书

**在控制台中：**“系统”下的“驱动”，添加所有者证书，上传 `owner-ca.cert.pem`，输入管理员密码。

**用 API：**

```sh
curl -s -H "$AUTH" -X POST $DEV/api/v1/system/owner-certs \
  -H 'content-type: application/json' \
  -d "{\"password\": \"$ADMIN_PASSWORD\", \"certificate\": \"$(base64 -w0 ~/mica-owner/owner-ca.cert.pem)\"}"
# 202 {"taskId":"<id>"}
```

它从下次启动起生效。重启（`mica reboot`）。如果产品的签名启动策略要求，设备自己的控制台会在那次启动时显示新证书
（SHA-256 和 subject），只有有人在 30 秒内按下 Enter 它才被信任。

**检查是否生效：**

```sh
curl -s -H "$AUTH" $DEV/api/v1/system/owner-certs
# 每个证书及其 sha256、"state": "loaded"、subject、issuer 和有效期
```

`pending-next-boot` 表示等待重启，`pending-confirmation` 表示等待控制台确认，`rejected` 附带 `reason`。证书必须是
一个 X.509 v3 证书，RSA 密钥不少于 2048 位，或 P-256、P-384 上的 ECDSA 密钥；一台设备最多 16 个。设备时钟已同步时，
证书必须在有效期内。

> status: shipped — evidence: `mica-core:docs/mica-core.md`, `mica-core:crates/mica-deploy/src/owner_certs.rs`

## 3. 获取 KDK 和内核 id

KDK 是某个发布所运行的确切内核的构建树。在检出到设备发布标签的 mica-build 中：

```sh
make board-fetch BOARD=uefi-x64
ls _out/boards/uefi-x64/kernel/
# ... kdk.tar  kernel.release ...
cat _out/boards/uefi-x64/kernel/kernel.release
```

fetch 取的是该发布所发布的内核组件。它的 `kernel.release` 必须与设备上 `uname -r` 的输出相同。

**内核 id** 是设备正在运行的内核组件，64 位十六进制：

```sh
curl -s -H "$AUTH" $DEV/api/v1/system/extensions | jq -r .kernel
```

> status: shipped — evidence: `mica-build:boards/uefi-x64/kernel/Dockerfile`, `mica-build:src/boards/board-pool.ts`, `mica-core:crates/micad/src/drivers.rs`

## 4. 构建并签名扩展

一个模块源码目录，用内核自己的工具链镜像构建：

```sh
mkdir -p ~/hello-mod
cat > ~/hello-mod/hello.c <<'EOF'
#include <linux/module.h>
static int __init hello_init(void) { pr_info("hello: loaded\n"); return 0; }
static void __exit hello_exit(void) { pr_info("hello: unloaded\n"); }
module_init(hello_init);
module_exit(hello_exit);
MODULE_LICENSE("GPL");
EOF
echo 'obj-m := hello.o' > ~/hello-mod/Makefile
```

```sh
bun src/cli.ts driver-ext build \
  --kdk _out/boards/uefi-x64/kernel/kdk.tar \
  --src ~/hello-mod --load hello \
  --name hello --version 1.0.0 \
  --kernel-id <64 位内核 id> \
  --key ~/mica-owner/signer.key.pem --cert ~/mica-owner/signer.cert.pem \
  --out ~/hello-ext --archive
# driver-ext: hello 1.0.0 for kernel <id> (<release>): 1 module(s), .../ext.img
```

输出目录包含 `ext.img`（带 dm-verity 的 squashfs）、`ext.roothash`、`ext.roothash.p7s`（内核检查的签名）、
`ext.json`（描述符），以及加上 `--archive` 时的 `ext.micaupd`——设备接受的那一个文件。

- `--modules DIR` 代替 `--src`，接受在别处构建的模块；它们的 vermagic 必须与内核一致。
- `--firmware DIR` 加入固件文件；`--option hello=debug=1` 加一行 modprobe 选项；`--load` 指定启动时加载的模块。
- 名称为 1 到 32 个小写字母、数字和连字符；最多 64 个模块、256 个固件文件。

> status: shipped — evidence: `mica-build:src/drivers/driver-ext.ts`

## 5. 安装

**在控制台中：**“系统”下的“驱动”，上传 `ext.micaupd`，输入密码。

**用 API：**

```sh
curl -s -H "$AUTH" -X POST $DEV/api/v1/system/extensions \
  -F password="$ADMIN_PASSWORD" -F archive=@$HOME/hello-ext/ext.micaupd
# 202 {"taskId":"<id>"}
```

它**从下次启动起以试用方式**安装。重启。那次启动时 runkit 先封存所有者密钥环，再映射扩展；内核检查其签名。启动达到
健康状态，修改就被保留；否则试用会重试，然后被丢弃，设备在没有它的情况下启动。

**检查是否生效：**

```sh
curl -s -H "$AUTH" $DEV/api/v1/system/extensions | jq '{installed, pending, boot}'
```

在设备上以 root：

```sh
cat /run/mica/extensions.json       # hello: "mapped"
grep hello /proc/modules
dmesg | grep 'hello: loaded'
```

> status: shipped — evidence: `mica-core:docs/mica-core.md`, `mica-core:crates/mica-apid/openapi.json`

## 6. 内核更新会等待你的扩展

内核与正在运行的内核不同的系统更新，需要每个已安装扩展针对新内核的构建。在拿到之前：

- `GET /api/v1/system/extensions` 在 `waitsForExtension`（`[{name, kernel}]`）中列出它，控制台的“驱动”标签也会显示；
- 自动更新被推迟（`waits-for-extension`）；手动安装被拒绝，错误以 `waitsForExtension:` 开头。

然后要么针对新内核重新构建扩展（第 3、4 节，使用新发布的 KDK 和 `waitsForExtension` 中的 `kernel` id），并按第 5
节上传，它会为那次更新暂存；要么让更新在没有它的情况下进行：

```sh
curl -s -H "$AUTH" -X POST $DEV/api/v1/system/extensions/hello/drop \
  -H 'content-type: application/json' \
  -d "{\"password\": \"$ADMIN_PASSWORD\", \"kernel\": \"<新内核 id>\"}"
```

正在运行的内核的构建会保留，以备回滚。

> status: shipped — evidence: `mica-core:docs/mica-core.md`

## 7. 删除

```sh
curl -s -H "$AUTH" -X DELETE $DEV/api/v1/system/extensions/hello \
  -H 'content-type: application/json' -d "{\"password\": \"$ADMIN_PASSWORD\"}"
curl -s -H "$AUTH" -X DELETE $DEV/api/v1/system/owner-certs/<sha256> \
  -H 'content-type: application/json' -d "{\"password\": \"$ADMIN_PASSWORD\"}"
```

两者都从下次启动起生效；本次启动的密钥环仍保留该证书。出厂重置会删除所有所有者证书和扩展，出厂重置后的那次启动
不加载任何证书。每次登记和删除都记录在设备上（最近 64 条）以及审计环中。

> status: shipped — evidence: `mica-core:docs/mica-core.md`

## 8. 可能出现的问题

| 你看到 | 原因 | 解决 |
|---|---|---|
| 403 `password_incorrect` | 管理员密码错误 | 重试；失败会退避（429 `login_throttled`） |
| 409 `not_claimed` | 设备未认领 | 先认领 |
| 证书 `rejected` 并附 `reason` | 不是 v3 证书、密钥太弱，或不在有效期内 | 使用 `driver-key init` 生成的证书 |
| 证书一直是 `pending-confirmation` | 没有人及时在设备控制台上按 Enter | 重启并在控制台确认 |
| `/run/mica/extensions.json` 中扩展为 `refused` | 签名不能链到已登记的证书，或证书未加载 | 登记 CA（第 2 节），检查其状态，重启 |
| 扩展为 `unused` | 为另一个内核构建（id、release 或架构不同） | 用正在运行内核的 KDK 和 id 重新构建 |
| `driver-ext: the kernel id is the kernel component's 64-digit hex id` | `--kernel-id` 有误 | 用 `GET /api/v1/system/extensions` 中的 `kernel` |
| `driver-ext: <module> is not a module of this extension (...)` | `--load` 或 `--option` 指定了构建没有生成的模块 | 模块文件名去掉 `.ko`，`-` 写作 `_` |
| 更新一直被推迟 | `waits-for-extension` | 见第 6 节 |

> status: shipped — evidence: `mica-core:docs/mica-core.md`, `mica-build:src/drivers/driver-ext.ts`
