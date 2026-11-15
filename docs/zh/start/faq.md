# 最先被问到的问题

简短的回答，每条都指向完整说明它的页面。本页与那些页面不一致时，以那些页面为准。

## 入门

**该用哪个镜像？**你的产品 `<board>.<variant>` 的最新发布。产品、各自带什么以及当前的发布戳见
[下载](download.md)；变体名称说明产品的用途，所以请看表格而不是名称。

**没有硬件能试吗？**能：QEMU 下的 `uefi-x64` 是每次发布都会启动的基线（[快速上手](quickstart.md)）。

**怎么在网络上找到设备？**打开 `http://mica-xxxxxxxx.local:8080`：主机名是 `mica-` 加八个十六进制字符，设备通过
mDNS 通告它。否则从 DHCP 服务器获取它的地址。带 Wi-Fi 的产品还有出厂接入点，用标签上的密钥连上后打开
`http://192.168.4.1:8080`（[首次启动](first-run.md)第 2 节）。

**默认密码是什么？**没有。第一个访问控制台的人设置管理员密码，这就认领了设备，所以要在你控制的网络上尽快认领
新设备。`root` 和 `mica` 没有密码；shadow 文件在每次启动时把它们重新锁定（[首次启动](first-run.md)第 4 节、
[访问](../reference/access.md)）。

**怎么得到 shell？**在管理员于控制台访问页打开 SSH 并添加密钥之前，SSH 是关闭的；每个授权密钥都是 root 密钥。在
串口或显示器控制台上，用管理员设置的临时 root 密码以 root 登录，它在下次启动前有效。`uefi-x64.gcp` 从首次启动起
运行 SSH，登录来自实例的元数据（[首次启动](first-run.md)第 6 节）。

**成为 root 之后输入什么？**[`mica`](../operate/mica.md)：`mica status`、`mica update`、`mica set`、
`mica container`、`mica unit` 等（[参考](../reference/cli.md)）。2026-11-14 及更早发布的设备没有 `mica` 命令；先
更新它。

## 配置

**为什么我在 `/etc` 下的修改消失了？**根文件系统是只读且经过校验的。设置保存在 DATA 上 micad 的设置树中，通过
控制台、API 或 `mica set` 修改；没有建模的设置不受支持（[配置](../operate/configuration.md)第 4 节）。

**我自己的文件放哪里？**`/srv`（或挂载在那里的你自己的磁盘）、`/home` 和 `/root`，都在 DATA 上，都在更新后保留
（[存储](../operate/storage.md)）。

**能安装软件包吗？**设备上没有 `apt`。把你的软件作为容器运行，作为 DATA 上你自己的服务运行（`mica unit`），或作为
原生软件包构建进镜像（[应用](../integrate/applications.md)）。

**怎么设置静态地址、Wi-Fi 或 VPN？**在控制台的网络页面或通过 API：接口、路由、DNS、WireGuard 和 Wi-Fi 客户端。
`mica wifi` 在设备上添加网络（[配置](../operate/configuration.md)第 3 节）。

**为什么时钟是 UTC？**它始终是。时区只用于显示，从不改变 `/etc/localtime`
（[配置](../operate/configuration.md)第 5.1 节）。

## 更新

**怎么更新？**`mica update install --reboot`、控制台的系统页，或离线的 `.micaupd`：上传、从 U 盘导入，或用
`mica-deploy import`（[更新](../operate/updates.md)）。

**更新后起不来怎么办？**新系统有三次尝试，并且必须通过健康闸门；否则设备自己启动之前的系统。你也可以用
`mica update rollback` 手动回滚（[恢复](../operate/recovery.md)）。

**回滚会恢复我的数据吗？**不会。它改变的是启动哪个系统；DATA 上的配置和数据保持原样
（[更新](../operate/updates.md)第 6 节）。

**为什么更新被拒绝？**每种拒绝都有固定的消息和代码：其他产品、更旧的代数、待确认的候选、维护窗口之外等，列在
[更新](../operate/updates.md)第 7 节。

**core 集是什么？**管理守护进程和控制台，单独发布，无需新的系统镜像即可获取（[更新](../operate/updates.md)
第 10 节）。

## 恢复与安全

**我丢了管理员密码。**有授权 SSH 密钥时，以 root 登录并运行 `mica password set`。一个密钥都没有时，没有软件途径
能回去；整盘重刷，这会给设备一个新的身份（[恢复](../operate/recovery.md)）。

**怎么清除一台设备？**出厂重置：控制台的系统页加管理员密码，或以 root 运行 `mica factory-reset`。它保留运行中的
系统，清除所有配置过的东西（[恢复](../operate/recovery.md)第 6 步）。

**DATA 加密吗？**任何已发布的产品都不加密。只有一个 Compute Engine 的测试镜像加密它，而加密的 DATA 还没有出厂
重置（`data_encrypted`）（[安全模型](../security/model.md)）。

**标签上的密钥是秘密吗？**不是。它是首次接触用的凭据，任何持有镜像和标签的人都能算出它；在控制台的 Wi-Fi 页面
设置你自己的密钥（[首次启动](first-run.md)第 2 节）。

**它在我的板卡上运行过吗？**每个板卡页面写明验证过什么、怎么验证的。实体硬件上还没有完整更新周期的记录
（[板卡](../hardware/README.md)）。

**报告问题时发什么？**支持摘要（控制台的信息页），以及来自控制台或 `mica doctor` 的诊断快照
（[故障排查](../operate/troubleshooting.md)、[支持](../releases/support.md)）。
