# 发布锁、固定版本与离线构建

发布锁、使用方的 `locks/`、源码缓存和离线构建都在
[`mica-build-tools`](https://github.com/micaoss/mica-build-tools) 中规定，与它们唯一的实现放在一起：

| 内容 | 位置 |
|---|---|
| 规范 | `mica-build-tools:docs/spec/release-lock.md` |
| 测试向量 | `mica-build-tools:docs/spec/release-lock/vectors/` |
| 软件包版本规则 | `mica-build-tools:docs/spec/package-versions.md` |
| 读取、检查或写入锁的每个命令 | `mica-build-tools:docs/manual.md` |

本仓库不陈述锁的任何规则。它对每个仓库只有一个要求：在 `locks/mica-build-tools.pin` 中按提交固定
`mica-build-tools`，以 `bin/mica-tools` 运行它，不自带读取器、向量或规则的副本。`bin/mica-tools locks update`
把这个固定版本以及其他所有固定的输入移到最新的发布。

规则在 `mica-build-tools` 中修改：文本、断言它的向量和代码在那里是同一个提交，随后每个仓库移动自己的固定版本。
这里引用本文件某一节的文档（例如 `release-lock.md` 1.2.5）引用的是规范的那一节。
