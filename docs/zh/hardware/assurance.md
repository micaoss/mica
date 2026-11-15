# 启动保证与验收

[安全模型](../security/model.md)中的 I1–I4 阶梯区分了内容完整性、经认证的更新、经认证的启动可执行文件和
硬件信任根启动。板卡页面记录实际的证据及其限度。软件机制与经过验收的物理设备是两件不同的事实。

## I1——经校验的内容读取

根和内核 support 是 dm-verity 下只读的 SquashFS 镜像。内核用内置的内容锚点检查分离的根哈希签名，然后按需
检查块。损坏但未读取的内容在访问时被发现；启动不会扫描完整的根镜像。原生 init 在建立映射之前认证所选的
部署和几何参数。

> status: shipped — evidence: `mica-core:crates/mica-deploy/src/bin/mica-runkit/init.rs`, `mica-build:tests/suites/signed-boot-lab/init-matrix.sh`

## I2——经认证的正常更新

原生安装在发布不可变文件和启动可见的候选之前，认证发布元数据和组件字节。获取过程校验签名的描述符、板卡
和产品以及代数，下载和导入都是有界的。暂存和垃圾回收期间，current 和保留的回退对象始终受到保护。普通的
系统更新操作不会安装加载器固件。

> status: shipped — evidence: `mica-core:crates/mica-deploy/src/deployments.rs`, `mica-core:crates/mica-deploy/src/acquisition.rs`, `mica-core:scripts/gate/file-ab-faults/run.sh`

## I3——经认证的启动可执行文件与策略

UEFI 在已登记的锚点下校验签名的启动管理器和 UKI。cx3576 的 Mica OS U-Boot 要求覆盖内核、设备树和 initramfs
的签名 FIT 配置。签名策略固定元数据密钥、内容身份和存储选择。命令行替换和未签名的重试路径会被拒绝。启动、
内容和元数据是三个独立的签名域。

UEFI 的强制执行用一次性的 OVMF/AAVMF 登记来测试。cx3576 的 FIT 签名和原生策略测试针对其构建出的固件运行。
这些软件结果并不能证明在未经测试的物理板卡上的强制执行。

> status: board-dependent — evidence: `mica-build:tests/suites/lifecycle-uboot-fit/signatures.sh`, `mica-build:tests/suites/signed-boot-lab/uefi-uki.sh`, `docs/security/signing.md`

## I4——硬件信任根与调试策略

不声明 OTP/熔丝编程或硬件信任根的验收。在提出这一声明之前，必须针对某块具名的物理板卡识别并验收厂商
加载器各阶段、平台固件、JTAG 和恢复通道。

> status: unsupported

## 记录一项声明

板卡页面写明板卡版本、确切的固件/内核/根身份、受信任的公钥集合和证据。开发密钥和一次性登记始终如实标注。
cx3576 的物理结果需要其实际存储、串口记录、看门狗/复位原因和断电观测。沙箱运行和杀进程测试不能被重新标注
为 eMMC 断电结果。

请使用[板卡模板](../../hardware/board-template.md)、[验收矩阵](qualification.md)和
[当前板卡状态](README.md#当前板卡)。

> status: shipped — evidence: `docs/hardware/board-template.md`, `tools/docs/verify-board.sh`
