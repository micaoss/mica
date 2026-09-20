# 获取发布版：发布了什么，以及如何校验

Mica OS 通过 `micaoss/mica-build` 的 GitHub Release 发布。全部可匿名获取：
不需要 token，也不需要登录镜像仓库。对读者有意义的发布有两类。

| 发布 | 标签 | 携带 |
|---|---|---|
| 版本索引 | `mica.<YYYYMMDD-HHMM>` | `mica-index.json`、`mica-build.lock`、`SHA256SUMS` |
| 作用域产品发布 | `<scope>.<YYYYMMDD-HHMM>` | `mica-build.lock`、各产品的 `mica-<product>-<release>.img.gz`、其 `.micaupd` 归档、`SHA256SUMS` |

自 2026-09-16 起，作用域标签用点号把作用域与时间戳分开
（[决策](../../decisions/2026-09-16-scoped-tags-use-a-dot.md)）；在那之前发布的
release，其 URL 里仍是旧的 `<scope>/<stamp>` 形式。被 GitHub 标记为 *latest* 的是
索引发布，它在一次作用域发布之后由自动化切出；
作用域是一块板（它全部已发布的产品）或单个产品。索引是入口：它列出当前每个
产品、它的文件、大小和哈希，读者不必自己遍历发布列表。

> status: shipped — evidence: `docs/design/mica-index.md`, `docs/design/release-lock.md`, `docs/decisions/2026-09-15-mica-version-index.md`

## 1. 有哪些东西可下载

只有发布目标板的产品才有镜像和更新归档——今天是 `uefi-x64` 和 `cx3576`。
`uefi-arm64` 自 2026-09-16 起也是发布目标，它的首批产品镜像在
`uefi-arm64.20260916-1653` 里；`s905x5m` 于 2026-09-19 被开放为发布目标，自它的首个
发布起开始发布。发布的产品都是 `dev` 或
`prod` 产品；minimal 产品已于 2026-09-16 删除
（[决策](../../decisions/2026-09-16-minimal-products-removed.md)），在那之前切的
release 仍保留它们的 minimal 资产。

**有三轮 `uefi` 发布无法启动，新的发布已取代它们。** `20260916-0845`、
`20260916-1653` 和 `20260919-2103` 里的 `uefi-x64` 与 `uefi-arm64` 镜像，会在 PID 1
拒绝镜像自己签名身份里的板卡名，并在 1.7 秒时把机器关掉：板卡改了名，而读这个名字的
被 pin 住的客户端没有改。`cx3576` 从未受影响——它的名字没变。这些发布继续保留、不
删除（[release-lock](../../design/release-lock.md) 2.1）；修复靠取代，不靠删除。

**修正后的一轮是 `20260919-2356`**——`uefi-x64.20260919-2356`、
`uefi-arm64.20260919-2356` 和 `cx3576.20260919-2356`，索引为 `mica.20260920-0008`，
全部构建自 `f46b64a6`。它携带的客户端认得当前的名字：它 pin 的 `mica-core` 发布
`20260919-2226` 在那个曾经缺失、从而导致拒绝的板卡分支里匹配 `uefi-x64` 与
`uefi-arm64`。这是关于那个分支的源码事实；*某个产品能启动*是另一条断言，它带着某次
运行的日期（[构建门](../../design/build-harness.md) 第 4 节）。

每个产品的发布携带：

- `mica-<product>-<release>.img.gz` —— gzip 压缩的工厂磁盘镜像。不上传裸 `.img`。
- `mica-<product>-<release>.micaupd` —— 完整更新归档，始终存在。
- `.root.micaupd` 和 `.kernel.micaupd` —— 部分归档，仅当它不携带的那个组件相对
  上一个发布未变化时才发布（[更新包](../../user/update-packages.md)）。

> status: shipped — evidence: `docs/decisions/2026-09-15-release-images-and-products.md`, `docs/decisions/2026-09-15-update-packages.md`, `docs/boards/support-tiers.md`

## 2. 从索引里挑文件

```sh
REL=https://github.com/micaoss/mica-build/releases/download
curl -fsSL "$REL/mica.<index release>/mica-index.json" -o mica-index.json

jq -r '.products[] | select(.product=="uefi-x64-dev")
       | .images[], .updates[] | [.kind, .url, .sha256, .size] | @tsv' mica-index.json
```

一个文件回答全部问题：每个被索引的产品及其板卡、profile、代次、deployment、
kernel 和 rootfs 标识，它的发布、它的 OCI bundle，它的镜像与更新文件的 URL、
sha256 和大小，以及每块板和每个产品的目录。`previous` 指向上一个索引。

> status: shipped — evidence: `docs/design/mica-index.md`

## 3. 下载并校验

```sh
curl -fsSLO "$REL/uefi-x64.<release>/SHA256SUMS"
curl -fsSLO "$REL/uefi-x64.<release>/mica-build.lock"
curl -fsSLO "$REL/uefi-x64.<release>/mica-uefi-x64-dev-<release>.img.gz"
sha256sum -c SHA256SUMS                       # 列出 lock 和每个资产
```

这是唯一不需要其它输入的校验。其余的——lock、索引、OCI 层——是从不同方向重复
陈述同一批摘要，见第 4 节。

> status: shipped — evidence: `mica-build:tools/release.sh`, `docs/design/release-lock.md`, `docs/design/mica-index.md`

## 4. 哪一步该核对哪个摘要

同一个镜像有四条互相独立的陈述，它们在不同地方被核对：

1. **发布清单。** `SHA256SUMS` 覆盖该发布的 lock 和每一个镜像、更新资产——覆盖的是
   压缩文件，不是里面的镜像。`sha256sum SHA256SUMS` 是这个发布的信任哈希，也是
   lock 和索引条目引用的值。
2. **lock 的 `asset` 行**记录同一个摘要，于是信任 lock 的读者不必再信任清单：
   ```sh
   awk -F'\t' '$1 == "asset" && $2 == "uefi-x64-dev"' mica-build.lock
   ```
3. **索引**同时描述两种形态：`sha256` 和 `size` 属于 `.gz`，
   `uncompressedSha256` 和 `uncompressedSize` 属于 `gzip -dc` 的输出。
   ```sh
   gzip -dc mica-uefi-x64-dev-<release>.img.gz | sha256sum
   jq -r '.products[]|select(.product=="uefi-x64-dev")|.images[]
          |[.file,.sha256,.size,.uncompressedSha256,.uncompressedSize]|@tsv' mica-index.json
   ```
4. **OCI 层**携带同样的事实，且可匿名读取；层摘要等于 asset 行的 sha256，它的
   `mica.uncompressed-*` 注解等于索引里的字段：
   ```sh
   REF=$(jq -r '.products[]|select(.product=="uefi-x64-dev")|.bundles.image' mica-index.json)
   T=$(curl -fsS "https://ghcr.io/token?scope=repository:micaoss/mica-build:pull&service=ghcr.io" | jq -r .token)
   curl -fsSL -H "Authorization: Bearer $T" \
     -H 'Accept: application/vnd.oci.image.manifest.v1+json' \
     "https://ghcr.io/v2/micaoss/mica-build/manifests/${REF##*@}" | jq '.layers'
   ```

在索引发布内部也是同一套做法：`sha256sum -c SHA256SUMS`、用 `jq -r .lock.sha256`
对照 `sha256sum mica-build.lock`、用 `jq -r .previous.trust` 对照上一个索引的信任
哈希。

> status: shipped — evidence: `mica-build:tools/release.sh`, `docs/design/release-lock.md`, `docs/design/mica-index.md`

## 5. 用源头证明一个发布

lock 是 `mica-lock v1` 文件，记录发布的提交以及进入它的每一项输入——包、池、
板卡、上游镜像，作用域发布还包括镜像和归档本身。在索引所指提交上的干净
`mica-build` 检出中，可以从已发布的 release 重建索引并逐字节比较：

```sh
bash tools/release.sh verify-index mica.<index release>
bash tools/release.sh verify-index mica.<index release> --full
```

文件旁边的校验和只能证明文件完整到达。让镜像值得信任的是它内部的签名链
（[发布签名](../../design/release-signing.md)）以及平台信任那个签名者；上面的
哈希是完整性的一半，不是真实性的一半。

> status: shipped — evidence: `mica-build:tools/release.sh`, `docs/design/release-lock.md`, `docs/design/release-signing.md`

## 6. 下一步

- 把镜像写入板卡：[刷写](../../user/flashing.md)。
- 改为升级在运行的设备：[更新包](../../user/update-packages.md)。
- 自己构建同样的产物：[构建指南](../../user/build.md)。
- 一个发布如何切出、什么决定重建：[发布](../../user/releasing.md)。

> status: shipped — evidence: `docs/user/flashing.md`, `docs/user/update-packages.md`, `docs/user/build.md`, `docs/user/releasing.md`
