# 经认证的不可变根

根文件系统是一个 SquashFS 镜像，后面紧跟一棵明确描述的、无超级块的 dm-verity 树。根和 support 各自有
独立的根哈希签名，其完整几何参数由部署封套绑定。

## 启动

UEFI 通过 systemd-boot 认证 UKI；U-Boot 在板卡的启动信任要求时认证 FIT（`qemu-armhf` 和 `ssd202d` 为
`bootTrust: none`，只检查 FIT 的哈希）。签名的 initramfs 包含 `mica-runkit` 和签名的启动策略。它作为
PID 1 运行，认证所选的描述符，定位 SYSTEM（一个分区，或若干 UBI 卷），建立要求签名的 verity 映射，只读
挂载根和 support，把 core 集合的组件以只读 overlay 的方式叠加到 `/usr` 和 `/etc` 上，打开 DATA，封存
owner 密钥环，映射驱动扩展并绑定匹配的模块和固件，然后才启动根的 init（systemd 或 OpenRC）。

内核内置的内容锚点认证 PKCS#7 根哈希签名。正常启动路径上没有未签名重试、可编辑的根几何参数、替代的
早期 init 或旧布局读取器。元数据密钥也来自签名的内核策略。完整的制品哈希在安装和离线校验时检查；正常
启动不会在挂载之前扫描镜像的全部字节。

被修改的内容在读到其所在块时被拒绝。启动确认要求所有健康检查通过，但并不声称每个未使用的块都被读过。
共享的 SYSTEM 或 DATA 文件系统故障需要明确的恢复，循环耗尽所有部署尝试并不能治好它。

## 根的归属

根拥有用户空间。内核模块、DTB、启动二进制和固件由独立的生产者打包。根包含空的 support 挂载点，以便在
udev 之前绑定所选的 support 镜像。更新后的根不会隐式替换其内核或加载器，更新后的内核通过新签名的部署
关联复用兼容的签名根。

## 可写路径

物理归属、服务绑定、配额和重置语义见[存储](storage.md)。DATA/var 绑定覆盖整个 `/var` 树，在字节/inode
项目限额之下接受新的服务目录。`/var/tmp` 共用这个预算。根的其余部分留在只读的 SquashFS 上；`/run` 和
`/tmp` 是易失的。

机器标识在 init 之前持久地建立在 DATA/state 下，并只读绑定到 `/etc/machine-id`；D-Bus 解析到同一个标识。
无效或为符号链接的标识文件会被拒绝，而不是悄悄重新生成。随机种子使用指向 DATA/state/random-seed 的固定
符号链接，不计入通用 var 配额。播种和 unit 依赖确保 var 和受保护的目标在随机种子读写之前存在。

## 关机

在 systemd 上，runkit 的 `shutdown` 是退出用的内存盘：systemd 切换到那里停止用户空间，它按依赖顺序释放
verity、loop 和 DATA 映射以及底层的 SYSTEM，然后关机或重启。UEFI 产品有完整运行时关机的证据，闸门会拒绝
未完成的 loop/DM 拆除，而不是只凭最后一行关机输出就判定成功。OpenRC 根和 UBI 板卡没有退出内存盘：init
把 DATA 置为只读后重启。

## 检查

| 在设备上检查 | 预期 |
|---|---|
| `cat /run/mica/boot.json` | `contentVerified: true`，以及运行中的 `deploymentId`、`rootfsId` 和 `kernelId`（[启动](boot.md#11-检查一次启动)） |
| `grep ' / ' /proc/mounts` | 一个带 `ro` 的 `squashfs` 挂载 |
| `touch /usr/x` | `Read-only file system`：请写到[可写路径](storage.md#可写路径一览)下 |
| `cat /etc/machine-id` | 重启前后不变；只有出厂重置会改变它 |

verity 校验失败的根在读取时向读取方返回 I/O 错误。若这让健康闸门无法通过，部署就不会被确认，三次尝试
用完后加载器启动回退部署（[更新](updates.md#确认失败与回滚)）。
