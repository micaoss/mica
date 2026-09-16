# 发布 Mica OS

面向维护者。release 是产物离开仓库的唯一途径：每个消费方固定的都是 release，不是
分支。本页说明一个 release 如何切出、它携带什么，以及什么决定一个软件包是否重建。

## 1. 切一个 release

release 在 GitHub 上切，绝不用本地 tag：

```sh
gh release create <tag> --target <commit of main>
```

`release.yml` 由 `release: published` 触发，从那个 tag 构建并附加资产。`ci.yml`
什么都不发布。

| 仓库 | 标签 |
|---|---|
| `mica-build-env`、`mica-system-base`、`mica-core`、`mica-podman` | `<YYYYMMDD-HHMM>` |
| `mica-boards` | `<board>.<YYYYMMDD-HHMM>`，一次 release 一块板 |
| `mica-build` | `<scope>.<YYYYMMDD-HHMM>`，一块板或一个产品，用 `--latest=false` 切 |
| `mica-build` 版本索引 | `mica.<YYYYMMDD-HHMM>`，由索引 job 切，绝不手工切 |

标签形式跟随板卡名与产品名，而这些名字连同 OCI 标签和资产名一起由
[命名规则](../../decisions/2026-09-16-board-and-product-naming.md)固定。
时间戳是这次发布的 UTC 时间，没有 `v` 前缀、没有 semver、没有提交后缀。自 2026-09-16
起，作用域标签用**点号**分隔作用域；在那之前切的 release 仍是旧的 `<scope>/<stamp>`
形式，不做改写。删除或重切一个已发布的 release，只在用户明确指示时进行。

> status: shipped — evidence: `docs/design/release-lock.md`, `docs/decisions/2026-09-15-mica-boards-per-board-releases.md`, `docs/decisions/2026-09-15-mica-build-scoped-releases.md`, `docs/decisions/2026-09-15-oci-tags-follow-release-version.md`

## 2. 一个 release 携带什么

| release | 资产 | OCI |
|---|---|---|
| 生产方（`mica-build-env`、`mica-system-base`、`mica-core`、`mica-podman`、`mica-boards`） | `<repository>.lock` 和只列出它的 `SHA256SUMS` | 镜像、池、板卡组件和基础根，标签为 `<kind>[.<name>]*.<release>` |
| `mica-build` 作用域 release | `mica-build.lock`、每种镜像类型一个 `mica-<product>-<stamp>.<suffix>.gz`、更新归档，以及覆盖全部这些文件的 `SHA256SUMS` | `image.<product>.<release>` 和 `update.<product>.<release>` |
| `mica-build` 索引 | `mica-build.lock`、`mica-index.json`，以及同时列出两者的 `SHA256SUMS` | 无 |

lock 用摘要指名每一个产物，所以校验了 `SHA256SUMS` 和 lock 的消费方就绑定了确切的
字节（[发布锁](../../design/release-lock.md)、[索引](../../design/mica-index.md)）。

> status: shipped — evidence: `docs/design/release-lock.md`, `docs/design/mica-index.md`

## 3. 什么会重建，什么被复用

软件包由它自己的声明版本锁定
（[决策](../../decisions/2026-09-15-package-versions.md)）：

- 每个软件包在包或生产者旁边声明自己的版本和 `SOURCE_DATE_EPOCH`；提交、日期或
  release 都不会进入版本、control 字段或二进制；
- 一次 release 从不改变版本：只有版本提升才会重建并重新发布一个软件包；
- 名称、架构和版本与同一作用域上一个 release 相同的软件包，按摘要从它复用，并且仍必须
  能逐字节重建出相同结果；
- 池层注解 `mica.inputs` 是守卫：输入变了却没提升版本会被拒绝，CI 和发布时都拒绝；
  低于上一个 release 的版本也被拒绝；
- 当没有软件包变化时，池 manifest 逐字节相同，新的 release 标签指向同一个摘要。

`mica-boards` 复用输入与该板最新 release 相同的 `kernel` 或 `uboot` 组件，CI 和发布时
都如此；`mica-build` 只有在另一个组件标识未变时才发布 `root` 或 `kernel` 更新归档
（[更新包](update-packages.md)）。

> status: shipped — evidence: `docs/decisions/2026-09-15-package-versions.md`, `docs/decisions/2026-09-15-board-kernel-builds.md`, `docs/decisions/2026-09-15-update-packages.md`

## 4. 版本索引

每次完全成功的 `mica-build` 作用域发布之后，索引 job 切出 `mica.<YYYYMMDD-HHMM>`：
它取每个已发布产品最新的作用域 release，对照来源校验进入索引的条目，然后发布索引
lock 和 `mica-index.json`。它相对上一个索引是增量的，没有条目进出时会被跳过，并且是
GitHub 的 latest release。手工切的 `mica.*` release 会被拒绝。

> status: shipped — evidence: `docs/decisions/2026-09-15-mica-version-index.md`, `docs/design/mica-index.md`

## 5. 切之前

- 被发布的提交上 CI 是绿的，并且凡是发布依赖的门，在本地也通过。
- 输入就是这个仓库打算发布于其上的那些 release：它的 `locks/` 文件指名它们，移动一个
  输入只替换那一份 lock 和它的 pin。
- release 不带任何署名行，记录里也没有开发残留；`mica-build` 和 `mica-build-env` 的
  发布记录落在 `mica`，其它仓库落在各自的 `docs/`。

> status: shipped — evidence: `docs/design/release-lock.md`, `docs/changelog.md`
