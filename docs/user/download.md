# Getting a release: what is published and how to check it

Mica OS is published as GitHub releases of `micaoss/mica-build`. Everything is
anonymous: no token, no registry login. Two kinds of release matter to a
reader here.

| Release | Tag | Carries |
|---|---|---|
| The version index | `mica/<YYYYMMDD-HHMM>` | `mica-index.json`, `mica-build.lock`, `SHA256SUMS` |
| A scoped product release | `<scope>/<YYYYMMDD-HHMM>` | `mica-build.lock`, each product's `mica-<product>-<release>.img.gz`, its `.micaupd` archives, `SHA256SUMS` |

The index release is the one GitHub marks *latest*, and it is cut
automatically after a scoped release; a scope is a board (all of its published
products) or a single product. The index is the entry point: it names every
current product, its files, their sizes and their hashes, so a reader does not
have to walk the release list.

> status: shipped — evidence: `docs/design/mica-index.md`, `docs/design/release-lock.md`, `docs/decisions/2026-09-15-mica-version-index.md`

## 1. What exists to download

Images and update archives exist only for products whose board is a release
target — today `x64` and `cx3576`. `virt-arm64` is an acceptance target and
`s905x5m` is not qualified, so neither publishes; the `-minimal` products are
local and CI only and are never released
([no released minimal products](../decisions/2026-09-15-minimal-products-not-released.md)).

Per product a release carries:

- `mica-<product>-<release>.img.gz` — the factory disk image, gzip-compressed.
  No raw `.img` is uploaded.
- `mica-<product>-<release>.micaupd` — the full update archive, always.
- `.root.micaupd` and `.kernel.micaupd` — the partial archives, when the
  component they omit is unchanged since the previous release
  ([update packages](update-packages.md)).

> status: shipped — evidence: `docs/decisions/2026-09-15-release-images-and-products.md`, `docs/decisions/2026-09-15-update-packages.md`, `docs/boards/support-tiers.md`

## 2. Pick the file from the index

```sh
REL=https://github.com/micaoss/mica-build/releases/download
curl -fsSL "$REL/mica/<index release>/mica-index.json" -o mica-index.json

jq -r '.products[] | select(.product=="x64-dev")
       | .images[], .updates[] | [.kind, .url, .sha256, .size] | @tsv' mica-index.json
```

One file answers the whole question: every indexed product with its board,
profile, generation, deployment, kernel and rootfs identity, its release, its
OCI bundles, its image and update files with URL, sha256 and size, and the
catalogue of every board and product. `previous` names the index before it.

> status: shipped — evidence: `docs/design/mica-index.md`

## 3. Download and verify

```sh
curl -fsSLO "$REL/x64/<release>/SHA256SUMS"
curl -fsSLO "$REL/x64/<release>/mica-build.lock"
curl -fsSLO "$REL/x64/<release>/mica-x64-dev-<release>.img.gz"
sha256sum -c SHA256SUMS                       # lists the lock and every asset
```

`SHA256SUMS` lists the lock and every image and update archive of that
release; `sha256sum SHA256SUMS` is the release's trust hash, and it is what a
consumer records in its pin.

The compressed image also carries its uncompressed identity, so the raw image
can be checked before anything is written:

```sh
gzip -dc mica-x64-dev-<release>.img.gz | sha256sum
```

Compare that with `uncompressedSha256` for the file in `mica-index.json`. The
image's OCI layer carries the same values as `mica.uncompressed-sha256` and
`mica.uncompressed-size`.

> status: shipped — evidence: `mica-build:tools/release.sh`, `docs/design/release-lock.md`, `docs/design/mica-index.md`

## 4. Prove the release against its sources

The lock is a `mica-lock v1` file naming the release's commit and every input
that went into it — pools, packages, boards, upstream images and, for a
scoped release, the images and archives themselves. From a clean checkout of
`mica-build` at the index's commit, the index can be rebuilt from the
published releases and compared byte for byte:

```sh
bash tools/release.sh verify-index mica/<index release>
bash tools/release.sh verify-index mica/<index release> --full
```

A checksum next to a file proves only that the file arrived intact. What makes
an image trustworthy is the signature chain inside it
([release signing](../design/release-signing.md)) and the platform trusting
that signer; the hashes above are the integrity half, not the authenticity
half.

> status: shipped — evidence: `mica-build:tools/release.sh`, `docs/design/release-lock.md`, `docs/design/release-signing.md`

## 5. Next

- Write the image to a board: [flashing](flashing.md).
- Update a running device instead: [update packages](update-packages.md).
- Build the same artifacts yourself: [build guide](build.md).
- How a release is cut and what decides a rebuild: [releasing](releasing.md).

> status: shipped — evidence: `docs/user/flashing.md`, `docs/user/update-packages.md`, `docs/user/build.md`, `docs/user/releasing.md`
