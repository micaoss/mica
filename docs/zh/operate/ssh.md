# SSH

如何通过 SSH 获得设备上的 root shell：打开服务器、添加你的密钥、登录，没有密钥时使用只在本次启动有效的 root
密码，在 Compute Engine 实例上用元数据中的密钥登录，以及再把这一切关上。规则见[访问](../reference/access.md)，
设置见[设置](../reference/settings.md)。

## 开始之前

- **一台已认领的设备**，以及 `http://<device>:8080` 上的控制台，或设备上以 root 运行的 `mica`，或带令牌的 API：

  ```sh
  DEV=http://mica-a4e2e69e.local:8080
  AUTH="Authorization: Bearer mica_<id>_<secret>"   # 来自：mica tokens create laptop
  ```

- **工作站上的一对密钥。**没有就生成一对：

  ```sh
  ssh-keygen -t ed25519 -C me@laptop      # 写出 ~/.ssh/id_ed25519 和 id_ed25519.pub
  ```

- **产品的初始状态。**每个发布的产品出厂时都没有授权密钥，也没有接受密码的账户。SSH 在你打开之前是关闭的，
  `uefi-x64.gcp` 例外：它从第一次启动就运行，并接受实例元数据中的密钥（第 5 节）。

| 产品 | SSH 服务器 |
|---|---|
| `cx3576.full`、`uefi-x64.gcp` | OpenSSH |
| `uefi-x64.full`、`uefi-x64.docker`、`s905x5m.sd-full`、`s905x5m.emmc-full`、`mini-x64.basic`、`qemu-armhf.basic` | Dropbear |

两者都以 `mica-sshd` 服务运行，读取同样的设置，下文的行为完全相同。

> status: shipped — evidence: `mica-core:docs/mica-core.md`, `mica-build:boards/uefi-x64/products/gcp/product.env`, `mica-build:boards/cx3576/products/full/product.env`

## 1. 添加密钥并打开 SSH

**在控制台中**：“访问”页，添加公钥（`~/.ssh/id_ed25519.pub` 的那一行），然后打开 SSH。

**用 API**，在工作站上：

```sh
curl -s -H "$AUTH" -X POST $DEV/api/v1/ssh/authorized-keys \
  -H 'content-type: application/json' \
  -d "{\"key\": \"$(cat ~/.ssh/id_ed25519.pub)\"}"
# 201 {"key":{"key":"ssh-ed25519 AAAA...","comment":"me@laptop","fingerprint":"SHA256:..."},
#      "notice":"Every authorized key is a root key."}
curl -s -H "$AUTH" -X PUT $DEV/api/v1/settings/access.ssh.enabled \
  -H 'content-type: application/json' -d 'true'
# {"taskId":"<id>"}
```

**在设备上以 root**（例如在本地控制台上），把密钥文件复制过去，或从标准输入粘贴：

```sh
mica ssh keys add - <<'EOF'
ssh-ed25519 AAAA... me@laptop
EOF
# added SHA256:...
mica ssh on
# access.ssh.enabled is true
```

`mica ssh keys add` 每个文件只接受一把密钥；注释行和空行会被跳过。

> status: shipped — evidence: `mica-core:crates/mica-apid/src/routes/ssh.rs`, `mica-core:crates/micad/src/cli/account.rs`

## 2. 登录并检查是否生效

```sh
ssh root@mica-a4e2e69e.local
```

在设备上：

```sh
mica ssh status
# enabled: true
mica ssh keys list
# SHA256:... ssh-ed25519 me@laptop
```

**适用于哪些账户。**只有一份密钥列表，它同时写给两个账户：`root`，以及 `mica`——有自己主目录和非 root shell 的
运维账户。你添加的每把密钥都能登录这两个账户，所以**每把授权密钥都是 root 密钥**；没有权限更低的密钥。端口是 22。

> status: shipped — evidence: `mica-core:crates/micad/src/reconciler/sshd.rs`

## 3. 没有密钥？只在本次启动有效的 root 密码

给站在设备前、却没有装好密钥的人用：一个 root 密码，可用于 SSH 和本地控制台（串口控制台，显示器上的 `tty2`），
下次启动后失效。它不保存在任何设置中。

```sh
mica root-password            # 询问两次，不回显
# the transient root password is set until the next boot
```

或通过 API（8 到 72 字节）：

```sh
curl -s -H "$AUTH" -X POST $DEV/api/v1/actions/transient-root-password \
  -H 'content-type: application/json' -d '{"password": "..."}'
# {"taskId":"<id>"}
```

只有设置了这样的密码时，SSH 才提供密码登录。用这个会话添加你的密钥（第 1 节），然后重启以清除密码。

> status: shipped — evidence: `mica-core:crates/micad/src/transient.rs`, `mica-core:crates/micad/src/cli/account.rs`

## 4. 删除密钥

```sh
mica ssh keys list
mica ssh keys remove SHA256:...
# removed SHA256:...
```

通过 API 时指纹是路径段；它可能含有 `/`，所以要百分号编码：

```sh
curl -s -H "$AUTH" -X DELETE \
  "$DEV/api/v1/ssh/authorized-keys/$(python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1],safe=""))' 'SHA256:...')"
# 204
```

> status: shipped — evidence: `mica-core:crates/mica-apid/src/routes/ssh.rs`

## 5. Compute Engine：元数据登录与云管理员

在 `uefi-x64.gcp` 上，SSH 从第一次启动就打开且只接受密钥，登录方式与 Compute Engine 上其他系统一样：

```sh
gcloud compute ssh <vm>
```

镜像中的 Compute Engine 代理为实例 `ssh-keys` 元数据中列出的每个用户创建账户，并把它加入组 `mica-admins`。当
`access.cloudAdmins.enabled` 打开时（该产品的默认值），micad 写出 sudo 规则
`%mica-admins ALL=(ALL:ALL) NOPASSWD: ALL`，于是这些用户可以通过 `sudo` 成为 root：

```sh
sudo mica status
```

只想保留你自己添加的密钥时，**把它关掉**：

```sh
sudo mica set access.cloudAdmins.enabled false
```

或在控制台的“访问”页关闭。关闭会立即删除该规则：账户还在，但组成员身份不再授予任何权限；已经是 root 的 shell
在结束前仍是 root。`GET /api/v1/state/cloudAdmins` 返回 `{enabled, source, productDefault}`。认领实例见
[首次启动](../start/first-run.md)第 6 节。

> status: shipped — evidence: `mica-core:crates/micad/src/reconciler/admins.rs`, `mica-core:docs/mica-core.md`, `mica-build:boards/uefi-x64/products/gcp/product.env`

## 6. 收紧访问

| 目的 | 做法 |
|---|---|
| 停用 SSH | `mica ssh off`，或控制台“访问”页的开关；可以再打开 |
| 删掉不该有的密钥 | `mica ssh keys list`，然后 `mica ssh keys remove <fingerprint>` |
| 清除忘了的 root 密码 | 重启 |
| 停用云管理员（gcp） | `mica set access.cloudAdmins.enabled false` |
| 同时让 API 离开网络 | `mica web local`（[配置](configuration.md)） |

端口、监听地址（最多 10 个）、root 登录和密码登录是 `access.ssh` 的其他键。没有 API 路由写它们；它们在配置文档
`/mica/config/ssh.json` 中设置，在设备停机时准备（[设置](../reference/settings.md)）。`permitRootLogin` 为 false 时，
root 以任何方式登录都会被拒绝。

服务器的设置在 DATA 上，由 init 在启动时读取，所以 SSH 早于 micad 启动，没有 micad 也能工作。

> status: shipped — evidence: `mica-core:crates/micad/src/reconciler/sshd.rs`, `mica-core:crates/mica-apid/src/routes/settings.rs`

## 7. 可能出现的问题

| 你看到 | 原因 | 解决 |
|---|---|---|
| `Permission denied (publickey)` | 密钥不在设备上，或 SSH 用了另一把密钥 | 在设备上 `mica ssh keys list`；`ssh -i ~/.ssh/id_ed25519 root@...` |
| `Connection refused` | SSH 已关闭 | `mica ssh on`，或在控制台打开 |
| 409 `key_exists` | 这把公钥已经授权 | 无需操作 |
| 409 `key_limit_reached` | 设备的密钥数已达上限 | 先删一把 |
| 添加时 422 `validation_failed` | 这一行不是 `<type> <base64> [comment]`，例如私钥或两行 | 粘贴 `.pub` 那一行 |
| `mica ssh: <file> holds 2 keys; add one at a time` | 文件中不止一把密钥 | 每把密钥一个文件 |
| 删除时 404 `settings_not_found` | 没有密钥是这个指纹 | 从列表中复制 |
| 删除时 422 `validation_failed` | 根本不是指纹（`/` 未编码，或缺少 `SHA256:`） | 按第 4 节编码 |
| root 密码不能用了 | 设备重启过 | 再设置一次，或用密钥 |
| gcp 上 `sudo` 要求密码 | 云管理员已关闭 | 从另一个 root 会话打开，或用你自己添加的密钥 |

什么都丢了（密码、令牌、密钥）：见[访问](../reference/access.md)第 7 节和[恢复](recovery.md)。错误格式见
[错误](../reference/errors.md)。

> status: shipped — evidence: `mica-core:crates/mica-apid/src/routes/ssh.rs`, `mica-core:crates/micad/src/cli/account.rs`
