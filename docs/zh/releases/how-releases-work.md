# 发布如何运作

release 是产物离开仓库的唯一途径：每个消费方固定的都是 release，不是分支。本页说明一个
release 如何切出、它携带什么、怎样到达下载页和设备，以及什么决定一个软件包是否重建。
各仓库自己的流程在各自的仓库里。

## 1. 切一个 release

release 在 GitHub 上切，绝不用本地 tag。生产方的 release 在 `main` 的某个提交上创建，
它的 `release.yml` 由 `release: published` 触发，从那个 tag 构建并附加资产：

```sh
gh release create <YYYYMMDD-HHMM> --target <commit of main>
```

`mica-build` 的一次 release 就是一个产品，以一次 workflow 运行启动，由它自己打标签：

```sh
gh workflow run release.yml -R micaoss/mica-build -f product=<board>.<variant>
gh workflow run release.yml -R micaoss/mica-build -f product=<board>.<variant> -f core=true
```

第二条是 **core 发布**：沿用产品上一个发布的 kernel 与 root，换上本次提交的 core 组件，
发布 `full` 与 `core` 两个更新包，设备因此可以单独换上新的管理面。上一个 root 的接口等级
超出某个组件的支持范围时，改为整体构建该产品。

GitHub release 挂好之后，同一次运行会把发布推送到资源服务（`mica-build:README.md`）：
文件放到 `dl.res.micaos.dev` 的 `mica/<board>.<variant>/<stamp>/` 下，再提交发布记录，之后
`https://res.micaos.dev/update/` 向官网和设备提供它。已经发布过的版本用 `publish-res.yml`
补推。

任何仓库的 `ci.yml` 都什么都不发布。

| 仓库 | 标签 |
|---|---|
| `mica-build-tools`、`mica-build-env`、`mica-system-base`、`mica-core`、`mica-podman` | `<YYYYMMDD-HHMM>` |
| `mica-build` | `<board>.<variant>.<YYYYMMDD-HHMM>`，一个产品；产品所在的板卡在同一个 release 里构建并发布，`dev` 产品从不发布 |

有些 release 会自己切出：`mica-system-base` 与 `mica-build-env` 每月一号移动自己的
输入，构建通过后发布；`mica-podman` 每周对上游引擎做同样的事。

标签形式跟随板卡名与产品名，而这些名字连同 OCI 标签和资产名一起由
[命名规则](../../decisions/2026-09-16-board-and-product-naming.md)固定。
时间戳是这次发布的 UTC 时间，没有 `v` 前缀、没有 semver、没有提交后缀。产品标签从
最后一个点号切开。删除或重切一个已发布的 release，只在用户明确指示时进行。

> status: shipped — evidence: `docs/reference/release-lock.md`, `mica-build:boards/README.md`, `mica-build:README.md`, `mica-build-tools:docs/spec/release-lock.md`

## 2. 一个 release 携带什么

| release | 资产 | OCI |
|---|---|---|
| 生产方（`mica-build-env`、`mica-system-base`、`mica-core`、`mica-podman`） | `<repository>.lock` 和只列出它的 `SHA256SUMS` | 镜像、池、板卡组件和基础根，标签为 `<kind>[.<name>]*.<release>` |
| `mica-build` 产品 | `mica-build.lock`、每种镜像类型一个 `mica-<board>.<variant>-<stamp>.<suffix>.gz`、更新归档，以及只列出 lock 的 `SHA256SUMS` | 板卡的 `pool.<board>.<arch>.<stamp>` 与 `<component>.<board>.<stamp>`，`image.<board>.<variant>.<stamp>` 与 `update.<board>.<variant>.<stamp>` |
| `mica-build-tools` | 无：消费方固定的是它的提交（`locks/mica-build-tools.pin`） | 无 |

lock 用摘要指名每一个产物，所以校验了 `SHA256SUMS` 和 lock 的消费方就绑定了确切的
字节（[发布锁](../../reference/release-lock.md)）。

> status: shipped — evidence: `docs/reference/release-lock.md`, `mica-build:README.md`

## 3. 什么会重建，什么被复用

软件包由它自己的声明版本锁定
（[决策](https://github.com/micaoss/mica-build-tools/blob/main/docs/spec/package-versions.md)）：

- 每个软件包在包或生产者旁边声明自己的版本和 `SOURCE_DATE_EPOCH`；提交、日期或
  release 都不会进入版本、control 字段或二进制；
- 一次 release 从不改变版本：只有版本提升才会重建并重新发布一个软件包；
- 名称、架构和版本与上一个 release 相同的软件包，按摘要从它复用，并且仍必须能逐字节
  重建出相同结果；
- 池层注解 `mica.inputs` 是守卫：输入变了却没提升版本会被拒绝，CI 和发布时都拒绝；
  低于上一个 release 的版本也被拒绝；
- 当没有软件包变化时，池 manifest 逐字节相同，新的 release 标签指向同一个摘要。

`mica-build` 复用输入与最近一次发布它的 release 相同的 `kernel` 或 `uboot` 组件，CI 和发布时
都如此；`mica-build` 只有在另一个组件标识未变时才发布 `root` 或 `kernel` 更新归档
（[更新包](../operate/updates.md)）。

> status: shipped — evidence: `mica-build-tools:docs/spec/package-versions.md`, `mica-build:docs/design/image.md`, `docs/decisions/2026-09-15-update-packages.md`

## 4. 每个 pin 都是最新

一个仓库在 `locks/` 里固定的每一项输入，都是产出方的最新发布，
`locks/mica-build-tools.pin` 则是 `mica-build-tools` 的最新发布：

```sh
bin/mica-tools locks update --check      # 哪些输入落后了；什么都不改
bin/mica-tools locks update              # 把每个 pin（以及 bin/mica-tools）移到最新
```

`mica-build` 的发布没有索引：每个产品各自发布，读者取一个产品的最新发布
（[获取发布版](../start/download.md)）。

> status: shipped — evidence: `mica-build-tools:README.md`, `docs/reference/release-lock.md`

## 5. 切之前

- 被发布的提交上 CI 是绿的，并且凡是发布依赖的门，在本地也通过。
- 输入都是最新发布：`bin/mica-tools locks update --check` 报告没有落后的输入，移动一个
  输入只替换那一份 lock 和它的 pin。
- release 不带任何署名行，记录里也没有开发残留；发布记录落在仓库自己的 `docs/`
  （[决策](../../decisions/2026-09-27-each-repository-keeps-its-records.md)）。

> status: shipped — evidence: `docs/reference/release-lock.md`, `docs/decisions/2026-09-27-each-repository-keeps-its-records.md`
