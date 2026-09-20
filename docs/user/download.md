# Getting a release: what is published and how to check it

Mica OS is published as GitHub releases of `micaoss/mica-build`. Everything is
anonymous: no token, no registry login. Two kinds of release matter to a
reader here.

| Release | Tag | Carries |
|---|---|---|
| The version index | `mica.<YYYYMMDD-HHMM>` | `mica-index.json`, `mica-build.lock`, `SHA256SUMS` |
| A scoped product release | `<scope>.<YYYYMMDD-HHMM>` | `mica-build.lock`, each product's `mica-<product>-<release>.img.gz`, its `.micaupd` archives, `SHA256SUMS` |

A scoped tag separates its scope from the stamp with a dot since 2026-09-16
([decision](../decisions/2026-09-16-scoped-tags-use-a-dot.md)); releases
published before that date carry the older `<scope>/<stamp>` form in their own
URLs. The index release is the one GitHub marks *latest*, and it is cut
automatically after a scoped release; a scope is a board (all of its published
products) or a single product. The index is the entry point: it names every
current product, its files, their sizes and their hashes, so a reader does not
have to walk the release list.

> status: shipped — evidence: `docs/design/mica-index.md`, `docs/design/release-lock.md`, `docs/decisions/2026-09-15-mica-version-index.md`

## 1. What exists to download

Images and update archives exist only for products whose board is a release
target, which since `s905x5m.20260920-0033` is all four: `uefi-x64`,
`uefi-arm64`, `cx3576` and `s905x5m`, eight products in the index
`mica.20260920-0046`. Every published product is a `dev` or `prod` product; the minimal products were removed on 2026-09-16
([decision](../decisions/2026-09-16-minimal-products-removed.md)), and the
releases cut before that date keep their minimal assets.

**Three `uefi` rounds do not boot; the newest releases supersede them.** The
`uefi-x64` and `uefi-arm64` images of `20260916-0845`, `20260916-1653` and
`20260919-2103` refuse the board name in their own signed identity at PID 1
and power the machine down at 1.7 seconds: the boards were renamed while the
pinned client that reads that name was not. `cx3576` was never affected — its
name did not change. Those releases stay published and are not deleted
([release-lock](../design/release-lock.md) 2.1); the fix is the superseding
release, not a deletion.

**The corrected round is `20260919-2356`** — `uefi-x64.20260919-2356`, `uefi-arm64.20260919-2356` and `cx3576.20260919-2356`,
with the index `mica.20260920-0008`, all built from `f46b64a6`. The client it
ships accepts the current names: the `mica-core` release it pins,
`20260919-2226`, matches `uefi-x64` and `uefi-arm64` in the board arm whose
absence produced the refusal. Both `uefi-x64` products of that round were
**booted in their release run** and reached the guest's own pass marker. The
boot step is amd64-only, so the `uefi-arm64` and `cx3576` products of the same
round were built and statically verified but not started.

**A published image is not a booted image**, and the catalogue is split on
that: the UEFI images are booted automatically, while the `cx3576` and
`s905x5m` images have never been started by anything, the only suite that
boots a guest being the UEFI one ([harness](../design/build-harness.md)
section 4). Being a release target means the images are built, published and
indexed; it is not a claim about hardware
([support tiers](../boards/support-tiers.md)).

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
curl -fsSL "$REL/mica.<index release>/mica-index.json" -o mica-index.json

jq -r '.products[] | select(.product=="uefi-x64-dev")
       | .images[], .updates[] | [.kind, .url, .sha256, .size] | @tsv' mica-index.json
```

One file answers the whole question: every indexed product with its board,
profile, generation, deployment, kernel and rootfs identity, its release, its
OCI bundles, its image and update files with URL, sha256 and size, and the
catalogue of every board and product. `previous` names the index before it.

> status: shipped — evidence: `docs/design/mica-index.md`

## 3. Download and verify

```sh
curl -fsSLO "$REL/uefi-x64.<release>/SHA256SUMS"
curl -fsSLO "$REL/uefi-x64.<release>/mica-build.lock"
curl -fsSLO "$REL/uefi-x64.<release>/mica-uefi-x64-dev-<release>.img.gz"
sha256sum -c SHA256SUMS                       # lists the lock and every asset
```

That is the one check that needs no other input. Everything else — the lock,
the index and the OCI layer — states the same digests again from a different
direction, which is section 4.

> status: shipped — evidence: `mica-build:tools/release.sh`, `docs/design/release-lock.md`, `docs/design/mica-index.md`

## 4. Which digest at which step

Four independent statements cover one image, and they are checked in
different places:

1. **The release list.** `SHA256SUMS` covers the lock and every image and
   update asset of that release — the compressed file, not the image inside
   it. `sha256sum SHA256SUMS` is the release's trust hash, the value locks and
   index entries quote.
2. **The lock's `asset` row** names the same digest, so a reader who trusts
   the lock does not have to trust the list:
   ```sh
   awk -F'\t' '$1 == "asset" && $2 == "uefi-x64-dev"' mica-build.lock
   ```
3. **The index** describes both forms: `sha256` and `size` are the `.gz`,
   `uncompressedSha256` and `uncompressedSize` are what `gzip -dc` produces.
   ```sh
   gzip -dc mica-uefi-x64-dev-<release>.img.gz | sha256sum
   jq -r '.products[]|select(.product=="uefi-x64-dev")|.images[]
          |[.file,.sha256,.size,.uncompressedSha256,.uncompressedSize]|@tsv' mica-index.json
   ```
4. **The OCI layer** carries the same facts and is readable anonymously; the
   layer digest equals the asset row's sha256, and its `mica.uncompressed-*`
   annotations equal the index's fields:
   ```sh
   REF=$(jq -r '.products[]|select(.product=="uefi-x64-dev")|.bundles.image' mica-index.json)
   T=$(curl -fsS "https://ghcr.io/token?scope=repository:micaoss/mica-build:pull&service=ghcr.io" | jq -r .token)
   curl -fsSL -H "Authorization: Bearer $T" \
     -H 'Accept: application/vnd.oci.image.manifest.v1+json' \
     "https://ghcr.io/v2/micaoss/mica-build/manifests/${REF##*@}" | jq '.layers'
   ```

Inside an index release the same idea applies to the index itself:
`sha256sum -c SHA256SUMS`, `jq -r .lock.sha256` against
`sha256sum mica-build.lock`, and `jq -r .previous.trust` against the previous
index's trust hash.

> status: shipped — evidence: `mica-build:tools/release.sh`, `docs/design/release-lock.md`, `docs/design/mica-index.md`

## 5. Prove the release against its sources

The lock is a `mica-lock v1` file naming the release's commit and every input
that went into it — pools, packages, boards, upstream images and, for a
scoped release, the images and archives themselves. From a clean checkout of
`mica-build` at the index's commit, the index can be rebuilt from the
published releases and compared byte for byte:

```sh
bash tools/release.sh verify-index mica.<index release>
bash tools/release.sh verify-index mica.<index release> --full
```

A checksum next to a file proves only that the file arrived intact. What makes
an image trustworthy is the signature chain inside it
([release signing](../design/release-signing.md)) and the platform trusting
that signer; the hashes above are the integrity half, not the authenticity
half.

> status: shipped — evidence: `mica-build:tools/release.sh`, `docs/design/release-lock.md`, `docs/design/release-signing.md`

## 6. Next

- Write the image to a board: [flashing](flashing.md).
- Update a running device instead: [update packages](update-packages.md).
- Build the same artifacts yourself: [build guide](build.md).
- How a release is cut and what decides a rebuild: [releasing](releasing.md).

> status: shipped — evidence: `docs/user/flashing.md`, `docs/user/update-packages.md`, `docs/user/build.md`, `docs/user/releasing.md`
