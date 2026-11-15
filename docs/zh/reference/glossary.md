# 术语表

本文档中含义固定的词，按英文字母顺序排列（保留英文原词，便于对照代码和日志）。每项都指向解释它的页面。

| 术语 | 含义 |
|---|---|
| **apid** | `mica-apid`，HTTP API 服务器和 Web 控制台的宿主；是 micad 的可执行文件换了个名字，在同一个 core 组件中（[API](api.md)） |
| **Base** | `mica-system-base`，每个根组合时所用的固定版本软件包底线，包括 init（`mica-systemd` 或 `mica-openrc`）以及读取 micad 文件的脚本 |
| **board（板卡）** | 一个硬件目标，带有自己的内核、加载器、分区布局和打包器，例如 `cx3576` 或 `uefi-x64`（[硬件](../hardware/README.md)） |
| **candidate（候选）** | 已安装并激活、等待确认的部署（[更新](updates.md)） |
| **channel（通道）** | 设备跟随的 core 集合线，除非另行设置（`channels.core`）否则为 `general` |
| **claim（认领）** | 给未认领的设备设置第一个管理员密码，可经控制台、配置文档或 BLE（[API](api.md#31-认领与登录)） |
| **confirmation（确认）** | 健康闸门把已启动的部署标记为良好；它成为 `current`（[启动](boot.md)） |
| **core component（core 组件）** | 一个 core 软件包（`micad`、控制台）的 verity 镜像，启动时叠加在根的 `/usr` 和 `/etc` 上 |
| **core set（core 集合）** | 针对一个通道和架构的一组签名 core 组件；每台设备都有一个（[更新](updates.md#core-集合)） |
| **DATA** | 可写分区（或 UBI 卷），存放状态、配置、容器、日志和用户数据（[存储](storage.md)） |
| **deployment（部署）** | 内核/support 组件与根的签名组合；设备最多保留两个 |
| **descriptor（描述符）** | 定义部署、其对象、产品和代数的签名 JSON 文档 |
| **device code（设备码）** | 印在设备标签上的代码，由硬件派生（GCP 上随机生成），用于认领设备和派生出厂接入点密钥 |
| **driver extension（驱动扩展）** | 只属于某一个内核的树外模块和固件，放在签名的 verity 镜像中，经 owner 密钥环启用 |
| **fallback（回退）** | 候选失败时加载器启动的、保留的可用部署 |
| **factory reset（出厂重置）** | 清除 DATA 并回到运行中的部署，设备变为未认领（[恢复](../operate/recovery.md)） |
| **feature（特性）** | `product.conf` 的 `FEATURES` 中的一个词，决定产品有哪些服务、路由和 core 组件（[产品](products.md)） |
| **generation（代数）** | 发布的单调递增编号；设备从不安装不高于当前运行代数的发布 |
| **health gate（健康闸门）** | 启动时在必需服务通过后确认部署的检查 |
| **kernel feature（内核特性）** | 板卡内核合并的一个内核配置片段（[内核特性](kernel-features.md)） |
| **micad** | 拥有配置的管理守护进程（[micad](management.md)） |
| **mica-deploy** | 原生部署客户端，负责安装、确认、回滚和垃圾回收 |
| **MICAUPD1** | 离线更新归档格式，`.micaupd` |
| **owner certificate（owner 证书）** | 设备所有者登记的证书，使内核接受所有者签名的驱动扩展 |
| **pair（配对）** | 一起安装、一起试运行的一个部署和一个 core 集合 |
| **product（产品）** | 一份发布的镜像配方，`<board>.<variant>`（[产品](products.md)） |
| **reconciler（调和器）** | micad 中把一棵设置子树变成系统配置的部分 |
| **reset tier（重置层级）** | `configuration` 或 `application-data`：重置清除 DATA 的哪一部分 |
| **root（根）** | dm-verity 下只读的 SquashFS 用户空间（[只读根](ro-root.md)） |
| **runkit** | `mica-runkit`，签名 initramfs 的 PID 1，在 init 之前认证并挂载一切（[启动](boot.md)） |
| **settings tree（设置树）** | micad 持有的有类型配置，用点路径寻址（[设置](settings.md)） |
| **STATE** | DATA 中受保护的部分，设备在这里保存它生成的东西（标识、凭据、认领） |
| **support image** | `support.img`，内核的模块和固件，与内核配对 |
| **SYSTEM** | 存放签名部署、根、内核和 core 集合的分区（或 UBI 卷） |
| **task（任务）** | 一次已应用写入的记录，在 `/api/v1/tasks/{id}` 跟进 |
| **transfer index（传输索引）** | `<object>.index`（`MICAIDX1`），让设备用已持有的分块拼装对象 |
| **trial（试运行）** | 候选为获得确认而拥有的三次启动 |
| **update root（更新根）** | 设备检查发布的 URL，默认为 `https://res.micaos.dev/update/` |
| **user mount（用户挂载）** | 运维者挂在允许位置上的磁盘，例如 `/srv` 或引擎根目录（[存储](storage.md#用户挂载)） |
| **web mode（Web 模式）** | `access.web.mode`：谁能访问 API，`network`、`local` 或 `off` |
| **write map（可写路径）** | 运行中设备能写的路径列表（[存储](storage.md#可写路径一览)） |
