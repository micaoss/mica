# Compute Engine

如何在 Google Compute Engine 上运行 Mica OS，从发布文件到一台像其他设备一样更新的已认领实例：用 `gce-import.sh` 把
镜像导入你自己的项目（或从公开的测试镜像系列开始），创建 Shielded VM，用元数据中的密钥登录，认领它，并更新它。产品
是 `uefi-x64.gcp`（[uefi-x64](../hardware/uefi-x64.md)）。

## 开始之前

- **一个 Google Cloud 项目**，已启用 Compute Engine，项目中有一个 Cloud Storage 存储桶，`gcloud` 已登录并设置为该项目。
- **这个产品是什么：**Docker，OpenSSH 从第一次启动起打开且只接受密钥，用于元数据登录的 Compute Engine 代理，没有
  MQTT，没有 mDNS 或 SSDP。DATA 每次启动时扩展到启动磁盘的大小。它需要带 gVNIC 的 Shielded VM。
- **认领需要设备码**，这个产品的设备码是随机的，在实例上读取（第 4 节）。

> status: board-dependent — evidence: `mica-build:boards/uefi-x64/products/gcp/product.env`, `mica-build:boards/uefi-x64/README.md`

## 1. 获取镜像

**从发布获取（你自己的项目）。**[mica-build](https://github.com/micaoss/mica-build/releases) 的每个
`uefi-x64.gcp.<stamp>` 发布，除了磁盘镜像和更新归档外，还带有：

| 文件 | 内容 |
|---|---|
| `mica-uefi-x64.gcp-<stamp>.gce.tar.gz` | 为导入打包的磁盘 |
| `mica-uefi-x64.gcp-<stamp>.db.der` | Mica 的启动加载器和内核签名所用的证书 |

用发布的 `SHA256SUMS` 核对两者（[下载](../start/download.md)），然后用同一 mica-build 标签中的 `gce-import.sh`：

```sh
GCE_LOCATION=europe-west4 \
  bash boards/uefi-x64/gce/gce-import.sh \
  mica-uefi-x64.gcp-20261115-1652.gce.tar.gz \
  mica-uefi-x64.gcp-20261115-1652.db.der \
  my-bucket/mica
# image mica-uefi-x64-gcp-20261115-1652 created from gs://my-bucket/mica/...
```

它上传归档并创建镜像，带 UEFI、gVNIC 和多队列 SCSI，并以 `db.der` 作为 Secure Boot 的平台密钥、密钥交换密钥和签名
数据库：没有 Microsoft 的密钥，所以固件只启动 Mica 签名的二进制文件。镜像名默认取自归档名，转为小写并用连字符；
`--family F` 把它放进你自己的镜像系列，`--labels K=V` 添加标签。

**公开的测试镜像系列。**项目 `micaos` 以 `mica-uefi-x64-gcp-test` 系列发布测试构建。它们是测试镜像，不是发布版：用来
试用这个产品，不要用于需要长期保留的东西。

> status: board-dependent — evidence: `mica-build:boards/uefi-x64/gce/gce-import.sh`, `mica-build:boards/uefi-x64/gce/publish.sh`

## 2. 创建 Shielded VM

```sh
gcloud compute instances create mica-1 \
  --zone europe-west4-a --machine-type e2-small \
  --image mica-uefi-x64-gcp-20261115-1652 \
  --shielded-secure-boot --shielded-vtpm --shielded-integrity-monitoring
```

或者从测试系列创建：

```sh
gcloud compute instances create mica-test-1 \
  --zone europe-west4-a --machine-type e2-small \
  --image-family mica-uefi-x64-gcp-test --image-project micaos \
  --shielded-secure-boot --shielded-vtpm --shielded-integrity-monitoring
```

Secure Boot 让 `db.der` 起作用：固件拒绝不是用它签名的启动加载器。更大的启动磁盘（`--boot-disk-size`）在第一次启动时
成为 DATA 的空间；之后扩大磁盘，DATA 在下次启动时扩展。

**检查是否生效：**串口控制台显示启动过程
（`gcloud compute instances get-serial-port-output mica-1 --zone europe-west4-a`），实例在一两分钟内响应 SSH。

> status: board-dependent — evidence: `mica-build:boards/uefi-x64/gce/gce-import.sh`, `mica-build:boards/uefi-x64/README.md`

## 3. 登录

```sh
gcloud compute ssh mica-1 --zone europe-west4-a
```

`gcloud` 把你的密钥放进实例（或项目）的 `ssh-keys` 元数据；镜像中的代理用该密钥为你创建账户，并把你加入
`mica-admins`，即云管理员，在 `access.cloudAdmins.enabled` 打开时（产品的默认值）可以通过 `sudo` 成为 root。元数据中
列出的每个用户都一样。只想保留你自己添加的密钥，见 [SSH](../operate/ssh.md) 第 5 节。

```sh
sudo mica status
```

> status: shipped — evidence: `mica-pkgs:docs/mica-pkgs.md`, `mica-core:crates/micad/src/reconciler/admins.rs`

## 4. 认领

认领之前，实例没有管理员密码。二选一：

**在 shell 中**（不需要设备码，因为你已经是 root）：

```sh
sudo mica setup
# Administrator password:（输入两次）
# the device is set up
```

**或在控制台中**，经 SSH 隧道，使用设备码：

```sh
gcloud compute ssh mica-1 --zone europe-west4-a -- -L 8080:localhost:8080
sudo mica internal device-code        # 在该会话中：首页要求输入的设备码
```

然后在工作站上打开 `http://localhost:8080` 并设置密码。除非你为它开放防火墙规则，控制台从不出现在实例的公网地址上；
隧道就是入口。

**检查是否生效：**经隧道访问时，控制台显示登录页而不是首次设置页，并接受该密码。

> status: shipped — evidence: `mica-core:crates/micad/src/cli/account.rs`, `mica-core:crates/micad/src/device_code.rs`, `docs/start/first-run.md`

## 5. 更新实例

实例像任何设备一样就地更新，A/B 方式，可回滚；不需要为此导入新镜像：

```sh
sudo mica update check
# available: system <version>
sudo mica update install --reboot
# checking...
# downloading...
# installing...
# installed; rebooting
```

重启后 `sudo mica update` 先显示 `validating`，然后是 `succeeded`。自动更新和维护窗口在控制台“系统”下的更新页
（[更新](../operate/updates.md)）。`gce-import.sh` 生成的新镜像用于新实例。

> status: shipped — evidence: `docs/operate/updates.md`

## 6. 可能出现的问题

| 你看到 | 原因 | 解决 |
|---|---|---|
| `error: ... is not a gce image kind (*.gce.tar.gz)` | 给的是 `.img.gz` | 用 `.gce.tar.gz` |
| `error: gcloud is not installed` | 机器上没有 gcloud | 安装 Google Cloud CLI |
| 实例无法启动 | 打开了 Secure Boot，但导入时没有用 `db.der`，或用了别的证书 | 用发布中的 `db.der` 重新导入 |
| `gcloud compute ssh` 被拒绝 | 元数据中的密钥尚未生效，或项目强制使用 OS Login | 等一分钟；为实例关闭 OS Login（元数据 `enable-oslogin=FALSE`） |
| `sudo` 要求密码 | 云管理员已关闭 | [SSH](../operate/ssh.md) 第 5 节 |
| 控制台要求你没有的设备码 | 改在 shell 中认领 | `sudo mica setup`，或 `sudo mica internal device-code` |
| 没有 `mica-*.local` 名称 | 该产品有意不通告 | 用实例在 Compute Engine 中的地址或名称 |

> status: board-dependent — evidence: `mica-build:boards/uefi-x64/gce/gce-import.sh`, `mica-pkgs:docs/mica-pkgs.md`
