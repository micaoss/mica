# `mica` 命令

`mica` 是设备上 root 唯一的命令：通过 SSH，或在产品带本地控制台时在控制台上使用。
它能做控制台能做的事，不需要浏览器，也不需要网络：初始设置、管理员密码、SSH、令牌、
设置、网络、Wi-Fi、时间、更新、容器、用户服务、Web 模式、局域网发现、电源、出厂重置
和诊断快照。契约见 `mica-core:docs/mica-core.md` 第 3.15 节。

> 2026-11-14 及更早发布的设备没有 `mica` 命令：先更新它（[更新](updates.md)），或使用该发布的
> `micad` 命令（`micad web`、`micad unit`、`micad factory-reset` 等）。运维指南全部使用 `mica`。

## 1. 它怎么工作

- `/usr/bin/mica` 是指向 `micad` 的链接。`micad` 本身只运行 `micad daemon` 和
  `micad apid`（由各自的服务启动）；其他任何词都以 2 退出，并告诉你该用哪个 `mica` 动词。
- 动词都是完整单词，没有缩写或别名。`mica help` 列出全部动词；`mica help <verb>` 或
  `mica <verb> help` 给出单个动词的用法。
- micad 决定的事（更新、容器、服务、Web 模式、电源、出厂重置）经系统总线去问，所以在
  任何 Web 模式下都可用。apid 决定的事（凭据，以及经 API 写入的设置）以 API 调用的形式
  经 apid 的本地 socket 去问，按 `local uid 0` 检查并审计。Web 模式为 `off` 时这些动词
  以 3 退出，并提示 `mica web local` 只开本地 socket。
- 设备上的 root 不需要设备码，也不需要当前管理员密码；出厂重置同样不要密码。
- 密码或网络密钥从不作为参数：在终端上关闭回显输入（新密码输两次），或从 `--…-file`
  指定的文件读取（`-` 表示标准输入），文件的那一行就是秘密。

> status: shipped — evidence: `mica-core:docs/mica-core.md`, `mica-core:crates/micad/src/cli.rs`

## 2. 动词

| 动词 | 作用 |
|---|---|
| `setup [--hostname NAME] [--password-file FILE]` | 认领设备：管理员密码输两次；不需要设备码 |
| `password set [--password-file FILE]` | 设置新的管理员密码，不需要当前密码 |
| `root-password [--password-file FILE]` | 临时 root 密码，下次启动前有效 |
| `ssh status`、`ssh on\|off`、`ssh keys list`、`ssh keys add <file\|->`、`ssh keys remove <fingerprint>` | SSH 与其授权密钥 |
| `tokens list`、`tokens create <name>`、`tokens revoke <id>` | API 令牌；`create` 只打印一次令牌 |
| `get <path>`、`set <path> <value>` | 读一项设置（秘密已遮蔽），或写入并等待生效。值按设置的类型解释：字符串原样、开关为 `true` 或 `false`、数字，列表或对象用 JSON |
| `hostname [NAME]` | 读或写主机名 |
| `time`、`time zone [ZONE]`、`time zones`、`time servers [SERVER...]` | 同步状态、时区、可选时区、NTP 服务器 |
| `network`、`network show <interface>` | 每个接口的状态与地址，或单个接口的完整信息 |
| `wifi`、`wifi scan`、`wifi on\|off`、`wifi add <ssid> [--password-file FILE] [--open] [--hidden]`、`wifi remove <ssid>` | Wi-Fi 客户端与其网络 |
| `status` | 一屏看板卡、运行中的系统与更新状态、运行时长、接口、时间和 DATA 用量 |
| `update status\|check\|install\|rollback [--reboot]` | 控制台的那些更新请求；`install` 与 `rollback` 只有加 `--reboot` 才重启（[更新](updates.md)） |
| `container ...` | 容器 |
| `unit ...` | 用户自己的服务；在 OpenRC 上，`unit fstab check [<file>]` 检查 `/usr/local/etc/fstab` 或指定文件（[存储](storage.md)） |
| `web status`、`web network\|local\|off` | API 在哪里监听（[配置](configuration.md)） |
| `mdns status\|list\|on\|off\|add\|remove`、`ssdp status\|on\|off` | 局域网发现 |
| `reboot`、`poweroff` | 电源 |
| `factory-reset [--yes]` | 出厂重置（[恢复](recovery.md)）：先列出会清除什么、保留什么，再等你输入主机名或 `factory-reset`，或直接带 `--yes`；两者都没有、或没有终端时，什么也不重置 |
| `doctor` | 采集诊断快照放进设备上的存储，并打印其路径（[排障](troubleshooting.md)） |
| `help [verb]` | 全部动词，或单个动词的用法 |

`mica internal device-code`、`mica internal derive-ap-key` 和 `mica internal board check`
是构建与工厂用的工具，`mica help` 不列出它们。

> status: shipped — evidence: `mica-core:docs/mica-core.md`

## 3. 输出与退出码

读取类动词（`status`、`update status`、`container list`、`unit list`、`web status`、
`get`、`network`、`wifi` 等）加 `--json` 时把结果以 JSON 打到标准输出。失败时标准输出为空，
标准错误是一个对象 `{"error": {"code", "message"}}`。

| 退出码 | 含义 |
|---|---|
| 0 | 完成 |
| 1 | 被拒绝或失败 |
| 2 | 用法错误：未知动词、缩写、缺少或多余的参数 |
| 3 | 连不上 micad 或 apid（没有总线、apid 关闭、API 返回 503 或 504） |
| 4 | 密码错误或缺失，或输错之后的退避 |

> status: shipped — evidence: `mica-core:docs/mica-core.md`
