# 内核特性

每块板卡的内核由所有板卡共用的底线，加上其 `board.env` 中 `KERNEL_FEATURES` 列出的内核特性构建而成。每个
特性是 `mica-build:common/kernel/fragments/` 中的一个片段，在 `olddefconfig` 解析配置之前合并进去。本页按
`mica-build` `main` 说明每个特性打开了什么、哪块板卡有它。

## 每个特性是什么

| 特性 | 打开的内容 |
|---|---|
| `core`（所有板卡） | 经校验的根以及叠加其上的 overlay；全部内置，因为没有 initramfs 的 dm-verity 启动无法加载模块 |
| `storage-gpt` | GPT 存储模型：SYSTEM 和 DATA 是同一块盘上的 ext4 分区，根通过 loop 设备从 SYSTEM 上的文件映射，置于 dm-verity 之下 |
| `storage-ubi` | UBI 存储模型：SYSTEM 和 DATA 是 UBIFS 卷，每个大对象是一个静态 UBI 卷，经 ubiblock 在 dm-verity 下打开，MTD 分区来自命令行 |
| `init-systemd` | systemd 作为 PID 1 挂载的东西及其 unit 键用到的东西（hugetlbfs、tracefs 等）；OpenRC 产品都不需要 |
| `netdev` | networkd 配置的虚拟网络设备（VLAN、网桥、VRF）以及容器使用的网桥 |
| `firewall` | nftables 的内核部分，以 `iptables-nft` 为参照 |
| `containers` | 容器引擎在防火墙和网桥之上对内核的编程需求；同时把 BPF 加入 LSM 列表 |
| `wireguard` | 用于远程管理隧道的 WireGuard 网络设备 |
| `selinux` | SELinux 和审计；宽容模式（`SECURITY_SELINUX_DEVELOP=y`） |
| `dm-crypt` | crypt 目标和 LUKS2 需要的加密算法（DATA 加密） |
| `tpm2` | 内置的 TPM 2.0 驱动，用于封存的 DATA 密钥，以及 Shielded VM 的 vTPM 报告的度量启动 |
| `module-signing` | 每个模块都签名；prod 镜像只加载由内置密钥环中的密钥签名的模块，并以完整性模式锁定运行 |
| `owner-keyring` | owner 登记：由已登记的 owner CA 签名的根哈希可以打开；runkit 在映射驱动扩展之前封存密钥环（[启动](boot.md)） |
| `drivers-amd64`、`drivers-arm64` | 通用内核的常见驱动类别，作为模块放在 `support.img` 中：USB 串口（NMEA 0183、GNSS、控制台）、CAN（NMEA 2000、J1939）、USB 和蜂窝网络适配器、PCIe 以太网、Wi-Fi、USB 存储；取值沿用 Debian 的 6.12 内核 |

## 哪块板卡有哪些

| 特性 | uefi-x64 | uefi-arm64 | mini-x64 | cx3576 | s905x5m | qemu-armhf |
|---|---|---|---|---|---|---|
| `storage-gpt` | 有 | 有 | 有 | 有 | 有 | — |
| `storage-ubi` | — | — | — | — | — | 有 |
| `init-systemd` | 有 | 有 | 有 | 有 | 有 | — |
| `netdev` | 有 | 有 | 有 | 有 | 有 | 有 |
| `firewall` | 有 | 有 | 有 | 有 | 有 | 有 |
| `containers` | 有 | 有 | 有 | 有 | 有 | — |
| `wireguard` | 有 | 有 | 有 | 有 | 有 | 有 |
| `selinux` | 有 | 有 | 有 | 有 | 有 | — |
| `dm-crypt` | 有 | 有 | 有 | 有 | 有 | — |
| `tpm2` | 有 | 有 | 有 | — | — | — |
| `module-signing` | 有 | 有 | 有 | — | — | — |
| `owner-keyring` | 有 | 有 | 有 | — | — | 有 |
| `drivers-amd64` / `drivers-arm64` | amd64 | arm64 | — | — | — | — |

因此：

- **驱动扩展和 owner 证书**只在内核有 `owner-keyring` 的板卡上可用：uefi-x64、uefi-arm64、mini-x64 和
  qemu-armhf。cx3576 和 s905x5m 的每个驱动都内置在板卡内核中。
- **即插即用的 USB 和 PCIe 硬件**（串口适配器、CAN 适配器、蜂窝调制解调器、额外网卡、USB 存储）在
  uefi-x64 和 uefi-arm64 上由通用内核的 `drivers-*` 模块覆盖；mini-x64 和板卡内核只带自身硬件所需的驱动。
- **使用 TPM 的 DATA 加密**在同时具备 `tpm2` 和 `dm-crypt` 的地方可行；没有已发布的产品开启它。
- **容器**需要 `containers`、`netdev` 和 `firewall`；qemu-armhf 不支持容器。

## 内核版本

0.0.9 这一轮的产品（2026-11-24 发布）带以下内核；设备上 `uname -r` 打印的就是这个字符串。

| 板卡 | 内核版本（`uname -r`） |
|---|---|
| `uefi-x64`、`mini-x64`、`qemu-armhf` | `6.12.119` |
| `cx3576` | `6.1.192`（厂商内核树，本轮未变） |
| `s905x5m` | `6.12.116-m100-arm64`（厂商内核树，本轮未变） |

产品构建会拒绝内核版本与板卡声明（`KERNEL_EXPECT`，`mica-build:boards/README.md`）不符的内核。

## 读取内核的真实配置

在 UEFI 板卡上，`mica-build` 中提交的 `kernel/config/<board>.config` 就是解析后的配置，构建时会核对。在
FIT 板卡（cx3576、s905x5m）上，提交的文件是厂商的输入，解析后的结果在发布的内核组件中：
`kernel.<board>.<release>` 的 `kernel/dev/config` 和 `kernel/prod/config`，摘要以板卡发布锁所列为准
（`mica-build:boards/README.md`）。在运行中的设备上：

| 检查 | 预期 |
|---|---|
| `uname -r` | 运行中部署的内核版本 |
| `cat /run/mica/boot.json` | 运行中的 `kernelId` |
