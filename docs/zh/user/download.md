# 获取发布版：发布了什么，以及如何校验

Mica OS 通过 `micaoss/mica-build` 的 GitHub Release 发布。全部可匿名获取：
不需要 token，也不需要登录镜像仓库。一个发布就是一个产品：

| 发布 | 标签 | 携带 |
|---|---|---|
| 产品发布 | `<board>.<variant>.<YYYYMMDD-HHMM>` | `mica-<board>.<variant>-<stamp>.img.gz`、它的 `.micaupd` 归档、`mica-build.lock`、`SHA256SUMS` |

每个产品各自发布，所以没有可以作为入口的索引：一个产品的最新发布，就是以
`<board>.<variant>.` 开头的最新标签。旧方案里的版本索引（`mica.<stamp>`、
`mica-index.json`）已不再切出，旧产品名下的发布已于 2026-09-28 删除。

**同样的文件也在资源服务上。**发布流程会把每个发布推送过去（`mica-build:README.md`）：
文件在 `https://dl.res.micaos.dev/mica/<board>.<variant>/<stamp>/<asset>`，旁边是这个发布
自己的 `index.json`，列出每个文件的大小与摘要；
`https://res.micaos.dev/update/v2/manifest.json` 给出每个产品的当前发布。官网下载页和设备
读的就是这些；被管理员在那里删除的发布，两边都不再有。

> status: shipped — evidence: `docs/design/release-lock.md`, `mica-build:README.md`, `mica-build:boards/products.md`

## 1. 有哪些东西可下载

每块板都是发布目标，所以要发布的产品共九个：`uefi-x64`、`uefi-arm64`、`cx3576`、
`s905x5m` 与 `mini-x64` 上默认的 `<board>.basic`，以及除 `mini-x64` 外带容器引擎的
`<board>.full`。**目前只有两个有发布：`cx3576.full` 与 `mini-x64.basic`**；其余产品
还没有可下载的东西，需要从源码构建（[构建指南](../../user/build.md)）。`dev` 产品只在本地
构建、从不发布；没有 minimal 产品（[决策](../../decisions/2026-09-16-minimal-products-removed.md)）。

**发布了的镜像不等于被启动过的镜像。**九个产品中有四个——`cx3576.basic`、
`cx3576.full`、`s905x5m.basic`、`s905x5m.full`——没有任何自动流程会启动它们，因为
没有任何套件会启动 FIT 镜像。（用户于 2026-09-20 报告过一次 `cx3576` 的实机启动；
那是一条报告，不是合格行——[支持层级](../../boards/support-tiers.md)。）每个 amd64
产品（`uefi-x64.*`、`mini-x64.basic`）都会在它的发布流程里被启动，`uefi-arm64` 的
产品有手工跑的 QEMU 记录（[构建门](https://github.com/micaoss/mica-build/blob/main/README.md)第 4 节）。是发布
目标只意味着镜像被构建并发布，不是对硬件的断言
（[支持层级](../../boards/support-tiers.md)）。

一个发布携带：

- `mica-<board>.<variant>-<stamp>.img.gz`——出厂磁盘镜像，gzip 压缩。不上传裸 `.img`。
- `mica-<board>.<variant>-<stamp>.micaupd`——完整更新归档，总是有。
- `.root.micaupd` 与 `.kernel.micaupd`——部分更新归档，当它们省略的组件自该产品上一个
  发布以来没有变化时才有；以及只携带 core 组件的 `.core.micaupd`（[更新包](update-packages.md)）。
- `mica-build.lock` 与列出它的 `SHA256SUMS`。

> status: shipped — evidence: `docs/decisions/2026-09-15-release-images-and-products.md`, `docs/decisions/2026-09-15-update-packages.md`, `docs/boards/support-tiers.md`

## 2. 找到一个产品的最新发布

```sh
PRODUCT=uefi-x64.basic
TAG=$(curl -fsSL "https://api.github.com/repos/micaoss/mica-build/releases?per_page=100" \
  | jq -r --arg p "$PRODUCT." '[.[] | select(.draft == false and (.tag_name | startswith($p)))][0].tag_name')
echo "$TAG"                                   # uefi-x64.basic.<YYYYMMDD-HHMM>
```

GitHub API 按从新到旧列出发布。`gh release list -R micaoss/mica-build` 给出同一份列表。

> status: shipped — evidence: `mica-build:README.md`

## 3. 下载与校验

```sh
REL=https://github.com/micaoss/mica-build/releases/download/$TAG
STAMP=${TAG##*.}
curl -fsSLO "$REL/SHA256SUMS"
curl -fsSLO "$REL/mica-build.lock"
curl -fsSLO "$REL/mica-$PRODUCT-$STAMP.img.gz"
sha256sum -c SHA256SUMS                       # 列出的是 lock
awk -F'\t' '$1 == "asset" && $5 == "mica-'"$PRODUCT-$STAMP"'.img.gz" {print $6 "  " $5}' mica-build.lock \
  | sha256sum -c -                            # lock 写明了镜像的 sha256
```

校验链是 `SHA256SUMS` → lock → `asset` 行的 sha256 → 文件
（[发布锁](../../design/release-lock.md) 1.2.2）。

> status: shipped — evidence: `mica-build:src/release/scoped.ts`, `docs/design/release-lock.md`

## 4. 哪一步该核对哪个摘要

一份镜像有三处相互独立的陈述，在不同的地方核对：

1. **`SHA256SUMS`** 只列出 lock；`sha256sum SHA256SUMS` 是这个发布的信任哈希，
   消费这个发布的 lock 引用的就是它。
2. **lock 的 `asset` 行**写明压缩文件的摘要：
   ```sh
   awk -F'\t' '$1 == "asset" && $2 == "'"$PRODUCT"'"' mica-build.lock
   ```
3. **OCI 层**携带同一个文件，可匿名读取：层摘要等于 `asset` 行的 sha256，它的
   `mica.uncompressed-sha256` 与 `mica.uncompressed-size` 注解就是 `gzip -dc` 的产物：
   ```sh
   REF=$(awk -F'\t' '$1 == "bundle" && $2 == "'"$PRODUCT"'" && $3 == "image" {print $4}' mica-build.lock)
   T=$(curl -fsS "https://ghcr.io/token?scope=repository:micaoss/mica-build:pull&service=ghcr.io" | jq -r .token)
   curl -fsSL -H "Authorization: Bearer $T" \
     -H 'Accept: application/vnd.oci.image.manifest.v1+json' \
     "https://ghcr.io/v2/micaoss/mica-build/manifests/${REF##*@}" | jq '.layers'
   gzip -dc "mica-$PRODUCT-$STAMP.img.gz" | sha256sum
   ```

> status: shipped — evidence: `mica-build:src/release/scoped.ts`, `docs/design/release-lock.md`

## 5. lock 讲了这个发布的什么

lock 是一份 `mica-lock v1` 文件，写明发布的提交，以及进入它的每一项输入：板卡的池、
软件包与组件，`mica-build-env`、`mica-system-base`、`mica-core` 与 `mica-podman` 的
输入发布及其信任哈希，以及产品的签名部署、bundle 与资产
（[发布锁](../../design/release-lock.md) 1.2.2）。

文件旁边的校验和只证明文件完整到达。让一份镜像可信的，是它里面的签名链
（[发布签名](../../design/release-signing.md)）以及平台信任那个签名者；上面的哈希
是完整性的一半，不是真实性的一半。

> status: shipped — evidence: `docs/design/release-lock.md`, `docs/design/release-signing.md`

## 6. 下一步

- 把镜像写进板卡：[刷写](flashing.md)。
- 改为更新一台正在运行的设备：[更新包](update-packages.md)。
- 自己构建同样的产物：[构建指南](../../user/build.md)。
- 发布怎么切、什么决定重建：[发布](../../user/releasing.md)。

> status: shipped — evidence: `docs/user/flashing.md`, `docs/user/update-packages.md`, `docs/user/build.md`, `docs/user/releasing.md`
