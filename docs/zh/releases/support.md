# 支持与生命周期

Mica OS 是产品构建于其上的操作系统，因此支持是共担的责任：Mica OS 拥有操作系统
契约、参考板卡和更新信任链；产品集成商拥有他们选定的板卡、他们交付的
应用，以及产品自身与最终客户的支持关系。本页陈述谁拥有什么、硬件支持
如何分层、以及一个可被处理的支持工单需要包含什么。

## 1. 硬件支持层级

层级词汇，与板卡资格认证计划对齐：

- **mica-qualified**——由 Mica OS 项目自身认证的板卡修订版，附带一份带日期的
  硬件在环板卡页（启动、A/B 更新、断电、存储扩展、恢复、以及适用的外设），
  其中每一行都是 pass、fail、N/A 或 not-tested——绝不隐式为绿。
- **integrator-qualified / bring-up**——集成商按已发布契约移植并认证的
  板卡；Mica OS 支持契约，集成商拥有板卡证据。
- **unsupported**——其余一切，包括内核低于支持底线的板卡。

层级定义、认证矩阵与准入评估标准已随 BSP 文档发布：层级在
[../../hardware/support-tiers.md](../hardware/README.md)，矩阵及其行语法在
[../../hardware/qualification.md](../../hardware/qualification.md)，厂商准入评估标准在
[`intake.md`](https://github.com/micaoss/mica/blob/9dd6302/docs/boards/intake.md)。词汇存在不等于某块板卡挣得了
层级：今天没有任何板卡是 mica-qualified，因为在案的每一份板卡页里，每一行
认证结果都是 `not tested`——今天的板卡凭本仓库中的证据持有其地位，而不是
凭一份完成的板卡页。

> status: shipped — evidence: `docs/hardware/README.md`, `docs/hardware/qualification.md`
> status: board-dependent — evidence: `docs/hardware/cx3576.md`

## 2. 当前硬件地位

每块板卡都处于 bring-up；各自背后的证据见
[当前板卡](../hardware/README.md#当前板卡)。

| 板卡 | 已发布产品 | 地位 |
|---|---|---|
| uefi-x64（通用 UEFI amd64） | `full`、`docker`、`gcp` | bring-up：QEMU 基线，每次发布运行都启动 |
| mini-x64（小型 UEFI amd64） | `basic` | bring-up：QEMU，每次发布运行都启动 |
| qemu-armhf（QEMU 32 位 Arm） | `basic` | bring-up：QEMU |
| cx3576（CX3576-Z，RK3576） | `full` | bring-up：静态验证，加一次硬件观察 |
| s905x5m（BM201，S905X5M） | `sd-full`、`emmc-full` | bring-up：静态验证与 fixture |
| uefi-arm64（通用 UEFI arm64） | 无 | bring-up：QEMU 参考，不发布 |

自带硬件的集成商从 [`mica-build:boards/README.md`](https://github.com/micaoss/mica-build/blob/main/boards/README.md) 开始；
板卡契约本身（产物边界、内核断言集、布局 schema）已发布并由构建强制。

> status: board-dependent — evidence: `docs/hardware/README.md`, `docs/start/download.md`, `mica-build:boards/README.md`

## 3. 生命周期归属

- **Mica OS** 拥有：操作系统镜像契约及其验证、A/B 更新机制与签名链、管理
  API 契约、BSP 契约，以及带真实状态纪律的文档集。
- **集成商**拥有：参考板卡之外的板卡选择与认证证据、应用交付与更新
  （容器明确不由 Mica OS 更新）、产品的配置 profile，以及最终客户支持。
- **安全生命周期**为每一项程序指派了一个负责角色——发布负责人、安全负责人、
  支持负责人、制造负责人——并写明每项程序的真实成熟度：密钥仪式与保管、凭据
  生命周期、漏洞接收、带分诊与修复目标的严重级别、公告发布、事件响应，以及
  支持窗口与生命周期终止。代表 Mica OS 承诺任何事之前先读它
  （[../../security/lifecycle.md](../../security/lifecycle.md)）。

> status: shipped — evidence: `docs/security/lifecycle.md`

**写下来的政策不等于一条在运行的渠道，这里的区别很要紧。**没有任何工具强制
支持窗口；没有任何机制把生命周期终止日期绑到某个发布版上；没有公开的安全
联系方式、没有公告源、也没有渠道晋级。在这些东西存在之前，**不得代表 Mica OS 向
最终客户承诺任何支持期限、修复目标或公告覆盖**——一个背后没有接收渠道的严重
级别目标，只是一个数字，不是承诺。

> status: unsupported

## 4. 支持工单需要什么

一份可被处理的报告按此顺序引用：

1. **发布版身份**——产品、deployment id 与 generation，以及 core 集合
   （[release-notes.md](release-notes.md)）。支持摘要
   （`GET /api/v1/system/support-info`，或控制台的帮助页）带着这些，
   且不含设备的名称、地址或凭据。
2. **板卡与修订版**——非参考板卡还需集成商的认证地位。
3. **设备身份**——主机名 / 设备 id（[../start/first-run.md](../start/first-run.md)）。
4. **恢复之前捕获的证据**——一份诊断快照（控制台，或设备上的 `micad diag`：
   本次与上一次启动的警告、失败的服务、更新状态），以及逐字引用的拒绝文本（[../operate/troubleshooting.md](../operate/troubleshooting.md)）；重刷
   会销毁证据，所以先捕获。

> status: shipped — evidence: `docs/reference/diagnostics.md`, `docs/operate/troubleshooting.md`

## 5. 去哪里问

支持渠道与面向产品的支持简报属于官方站点内容集
[../../website/support.md](../../website/support.md)；源码层面的问题，
本仓库的文档（[../../README.md](../../README.md)）是入口。
