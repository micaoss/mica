# 为这套文档做贡献

本页是本仓库文档背后的契约：它为谁而写、每棵树拥有什么、关于产品的声明如何标注并给出
证据，以及英文树与中文树的关系。做不到的页面是页面的缺陷，不是放松契约的许可。

## 1. 读者

Mica OS 是嵌入式一体机操作系统。文档服务三类读者，按此顺序：

1. **设备操作员**：站在已部署设备前的人，安装、配置、更新、恢复，以及决定告诉支持什么。
2. **产品集成商**：基于 Mica OS 构建产品的团队，组合镜像、交付应用、选择并认证板卡。
3. **支持工程师**：故障报告到达的人，需要设备的身份，以及已发布与未发布之间诚实的边界。

## 2. 什么放在哪里

本仓库记录的是**产品**。一个模块如何构建、测试与发布，以及每一种线上格式和 schema
版本，都记录在拥有它的仓库里；这里的页面陈述行为，并以 `<repository>:<path>` 引用其
所有者，而不是重述它。

| 树 | 拥有 |
|---|---|
| `start/` | Mica OS 是什么、获取镜像、启动设备 |
| `operate/` | 运维一台设备：配置、更新、恢复、存储、故障排查、API |
| `integrate/` | 在它上面做产品：应用、容器、总线、控制台、配置下发、制造 |
| `hardware/` | 每块板一页、板卡状态表、支持层级、保证等级与认证 |
| `security/` | 安全姿态、模型、生命周期与信任链 |
| `reference/` | 指南所依赖的设备行为契约 |
| `releases/` | 发布如何标识、制作、分发与支持 |
| `website/` | micaos.dev 的内容简报 |
| `decisions/` | 带日期的产品决策 |

每个事实由一页拥有，其他页面都链接过去。`docs/README.md` 是目录，`make docs-verify`
保证它与文件树一致。

## 3. 真实状态分类法——规范性

本文档集中的每个能力声明都携带一个状态。这是契约的核心：文档本身可以
弥合易用性缺口，但绝不能声称尚不存在的机制已经发布。

四个状态：

- **shipped**——该能力存在，并在拥有它的仓库里被构建或其检查所验证。声明它需要确实
  存在的证据。
- **board-dependent**——该能力至少在一块板卡上发布，其有无或形态是板卡
  事实（在 `boards/<board>/` 中或由板卡的 BSP 声明）。
- **proposed**——该能力已由一个未关闭的计划或任务记录跟踪，且未发布。描述一个提案中的契约是允许的；把它呈现为当前行为则不允许。
- **unsupported**——该能力不存在且当前无计划，或明确在产品契约之外。

### 语法

状态行是恰好如下形状的 Markdown 引用块——状态如上，分隔符是带空格的
em dash，每个证据引用放在反引号里，多个引用以 `, ` 分隔：

```
> status: shipped — evidence: `mica-core:crates/mica-apid/openapi.json`
> status: board-dependent — evidence: `mica-build:boards/cx3576/board.env`
> status: proposed — evidence: `docs/integrate/managed-applications.md`
> status: unsupported
```

### 证据规则

- `shipped` 与 `board-dependent` 必须引用确实存在的东西：本仓库里的路径、以
  `<repository>:<path>` 写出的其他仓库里的路径，或一个 `make <target>`。
- `proposed` 必须引用描述这项工作的东西：把它标为未实现的设计文档，或将要实现它的
  那个仓库里的记录（`<repository>:docs/...`）。本仓库不保存任务与计划记录。工作落地后，
  该页重新标注。
- `unsupported` 不携带证据；缺席本身就是声明。
- 证据在被引用之前先验证其存在。死掉的证据引用是坏掉的声明，不是外观
  缺陷。
- 本集内任何地方都不使用 `path:line` 引用。与行号耦合的文档会被那些
  并未改变其含义的编辑证伪。需要精确契约时，改为点名承载它的产物——
  例如，HTTP 接口面就是 `mica-core:crates/mica-apid/openapi.json`。

### 提案内容

当一页描述仍在构建的能力时，它陈述计划中的契约，并以未关闭的记录为证据
标注 `proposed`。上面的证据规则会在记录完成或关闭时强制重新标注，因此不再
使用单独的 TODO 标记。

## 4. 英文与中文

英文是权威。中文文档集位于 `docs/zh/` 之下，结构相同，覆盖 `start/`、`operate/`、
`integrate/`、`hardware/`、`security/` 与 `releases/`。`docs/zh/README.md` 带有一张覆盖
表，为受门禁约束的树里的每一个英文页面记录：翻译所依据的源版本，以及取值为 `current`、
`lagging` 或 `not-translated` 之一的状态。任何冲突以英文页面为准。

`tools/docs/verify-coverage.sh` 由 `make docs-verify` 运行：它在两个方向上对照两棵树核对
这张表，并要求 `current` 的页面携带与其英文源页面相同、且顺序相同的 status 行。

> status: shipped — evidence: `docs/zh/README.md`, `tools/docs/verify-coverage.sh`

## 5. 风格规则

- 每页以一个 H1 开头。内部链接使用相对路径。
- 克制的行文；没有营销腔。局限性写在原本会夸大其词的那个句子里，而不是脚注里。
- **只写现状。** 页面说的是现在为真的事。不写时间线，不写“此前”，不叙述决策是怎么
  得出的；仍然有约束力的决策是 `decisions/` 下的一条记录，历史在 `git log` 里。
- **一个事实，一个位置。** 链接到拥有该事实的页面，而不是重述它。属于其他仓库的事实
  用引用，不复制。
- **不重述会变动的东西。** schema 版本、发布时间戳、提交哈希、产品或测试的数量、上游
  版本号都属于它们的所有者。点名承载它们的产物即可。
- 展示的命令是真实的命令，对照它们所指的东西核对过。
- 给数字标出单位。
- 对旁边那份清单计数的句子，清单一变就过时。优先采用不计数的说法：“每一块板”，并
  列出它们。
- 没有在实机上跑过的能力，在描述它的地方就写明。
- 解释一个集合里的部分成员时，说明这个集合是否封闭。

## 6. 检查

| 命令 | 检查 |
|---|---|
| `make docs-verify` | 目录与文件树、链接、status 行及其证据、中文覆盖表、板卡页与模板 |
| `make docs-verify-test` | 上述每项检查在其事实为假的夹具上确实会失败；并对脚本做 lint |
| `make docs-verify-world` | 关于其他仓库的声明，以及每一条 `<repository>:<path>` 引用，对照那些仓库核对 |

> status: shipped — evidence: `tools/docs/verify-index.sh`, `tools/docs/verify-status.sh`, `tools/docs/verify-citations.sh`
