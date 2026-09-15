# 获取发布版：发布了什么，以及如何校验

Mica OS 通过 `micaoss/mica-build` 的 GitHub Release 发布。全部可匿名获取：
不需要 token，也不需要登录镜像仓库。对读者有意义的发布有两类。

| 发布 | 标签 | 携带 |
|---|---|---|
| 版本索引 | `mica/<YYYYMMDD-HHMM>` | `mica-index.json`、`mica-build.lock`、`SHA256SUMS` |
| 作用域产品发布 | `<scope>/<YYYYMMDD-HHMM>` | `mica-build.lock`、各产品的 `mica-<product>-<release>.img.gz`、其 `.micaupd` 归档、`SHA256SUMS` |

被 GitHub 标记为 *latest* 的是索引发布，它在一次作用域发布之后由自动化切出；
作用域是一块板（它全部已发布的产品）或单个产品。索引是入口：它列出当前每个
产品、它的文件、大小和哈希，读者不必自己遍历发布列表。

> status: shipped — evidence: `docs/design/mica-index.md`, `docs/design/release-lock.md`, `docs/decisions/2026-09-15-mica-version-index.md`

## 1. 有哪些东西可下载

只有发布目标板的产品才有镜像和更新归档——今天是 `x64` 和 `cx3576`。
`virt-arm64` 是验收目标，`s905x5m` 尚未合格，两者都不发布；`-minimal` 产品只用于
本地和 CI，从不发布（[不发布 minimal 产品](../../decisions/2026-09-15-minimal-products-not-released.md)）。

每个产品的发布携带：

- `mica-<product>-<release>.img.gz` —— gzip 压缩的工厂磁盘镜像。不上传裸 `.img`。
- `mica-<product>-<release>.micaupd` —— 完整更新归档，始终存在。
- `.root.micaupd` 和 `.kernel.micaupd` —— 部分归档，仅当它不携带的那个组件相对
  上一个发布未变化时才发布（[更新包](../../user/update-packages.md)）。

> status: shipped — evidence: `docs/decisions/2026-09-15-release-images-and-products.md`, `docs/decisions/2026-09-15-update-packages.md`, `docs/boards/support-tiers.md`

## 2. 从索引里挑文件

```sh
REL=https://github.com/micaoss/mica-build/releases/download
curl -fsSL "$REL/mica/<index release>/mica-index.json" -o mica-index.json

jq -r '.products[] | select(.product=="x64-dev")
       | .images[], .updates[] | [.kind, .url, .sha256, .size] | @tsv' mica-index.json
```

一个文件回答全部问题：每个被索引的产品及其板卡、profile、代次、deployment、
kernel 和 rootfs 标识，它的发布、它的 OCI bundle，它的镜像与更新文件的 URL、
sha256 和大小，以及每块板和每个产品的目录。`previous` 指向上一个索引。

> status: shipped — evidence: `docs/design/mica-index.md`

## 3. 下载并校验

```sh
curl -fsSLO "$REL/x64/<release>/SHA256SUMS"
curl -fsSLO "$REL/x64/<release>/mica-build.lock"
curl -fsSLO "$REL/x64/<release>/mica-x64-dev-<release>.img.gz"
sha256sum -c SHA256SUMS                       # 列出 lock 和每个资产
```

`SHA256SUMS` 列出该发布的 lock 以及全部镜像和更新归档；`sha256sum SHA256SUMS`
是这个发布的信任哈希，也是消费方记录在 pin 里的值。

压缩镜像同时携带它解压后的身份，因此在写入任何介质之前就能校验裸镜像：

```sh
gzip -dc mica-x64-dev-<release>.img.gz | sha256sum
```

把这个值与 `mica-index.json` 中该文件的 `uncompressedSha256` 比较。镜像的 OCI
层携带同样的值，记作 `mica.uncompressed-sha256` 和 `mica.uncompressed-size`。

> status: shipped — evidence: `mica-build:tools/release.sh`, `docs/design/release-lock.md`, `docs/design/mica-index.md`

## 4. 用源头证明一个发布

lock 是 `mica-lock v1` 文件，记录发布的提交以及进入它的每一项输入——包、池、
板卡、上游镜像，作用域发布还包括镜像和归档本身。在索引所指提交上的干净
`mica-build` 检出中，可以从已发布的 release 重建索引并逐字节比较：

```sh
bash tools/release.sh verify-index mica/<index release>
bash tools/release.sh verify-index mica/<index release> --full
```

文件旁边的校验和只能证明文件完整到达。让镜像值得信任的是它内部的签名链
（[发布签名](../../design/release-signing.md)）以及平台信任那个签名者；上面的
哈希是完整性的一半，不是真实性的一半。

> status: shipped — evidence: `mica-build:tools/release.sh`, `docs/design/release-lock.md`, `docs/design/release-signing.md`

## 5. 下一步

- 把镜像写入板卡：[刷写](../../user/flashing.md)。
- 改为升级在运行的设备：[更新包](../../user/update-packages.md)。
- 自己构建同样的产物：[构建指南](../../user/build.md)。
- 一个发布如何切出、什么决定重建：[发布](../../user/releasing.md)。

> status: shipped — evidence: `docs/user/flashing.md`, `docs/user/update-packages.md`, `docs/user/build.md`, `docs/user/releasing.md`
