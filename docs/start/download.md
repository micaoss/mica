# Getting a release: what is published and how to check it

Mica OS is published as GitHub releases of `micaoss/mica-build`. Everything is
anonymous: no token, no registry login. A release is one product:

| Release | Tag | Carries |
|---|---|---|
| A product release | `<board>.<variant>.<YYYYMMDD-HHMM>` | `mica-<board>.<variant>-<stamp>.img.gz`, its `.micaupd` archives, `mica-build.lock`, `SHA256SUMS` |

Each product releases on its own, so there is no index to start from: a
product's newest release is the newest tag that starts with
`<board>.<variant>.`. The version index of the earlier scheme (`mica.<stamp>`,
`mica-index.json`) is no longer cut, and the releases published under the
earlier product names were deleted on 2026-09-28.

**The same files are on the resource service.** The release run posts each
release there (`mica-build:README.md`): the files are at
`https://dl.res.micaos.dev/mica/<board>.<variant>/<stamp>/<asset>`, beside the
release's own `index.json`, which lists them with their sizes and digests, and
`https://res.micaos.dev/update/v2/manifest.json` names every product's current
release. That is what the website's download pages and a device read; a
release an administrator deleted there is gone from both.

> status: shipped — evidence: `docs/reference/release-lock.md`, `mica-build:README.md`, `mica-build:boards/products.md`

## 1. What exists to download

Every board is a release target, so nine products are released:
`<board>.basic`, the default, on `uefi-x64`, `uefi-arm64`, `cx3576`, `s905x5m`
and `mini-x64`, and `<board>.full`, which adds the container engine, on all but
`mini-x64`. **Two of them have a release so far, `cx3576.full` and
`mini-x64.basic`**; for the others there is nothing to download yet, and they
are built from source ([build guide](build.md)). A `dev` product is built
locally and never released; there are no minimal products
([decision](../decisions/2026-09-16-minimal-products-removed.md)).

**A published image is not a booted image.** Four of the nine products —
`cx3576.basic`, `cx3576.full`, `s905x5m.basic`, `s905x5m.full` — are started by
nothing automatic, because no suite boots a FIT image. (A hardware boot of
`cx3576` was reported by the user on 2026-09-20; it is a report, not a
qualification row — [support tiers](../hardware/support-tiers.md).) Every amd64
product (`uefi-x64.*`, `mini-x64.basic`) is booted in its release run, and the
`uefi-arm64` ones carry hand-run QEMU rows ([harness](https://github.com/micaoss/mica-build/blob/main/README.md)
section 4). Being a release target means the images are built and published;
it is not a claim about hardware
([support tiers](../hardware/support-tiers.md)).

A release carries:

- `mica-<board>.<variant>-<stamp>.img.gz` — the factory disk image,
  gzip-compressed. No raw `.img` is uploaded.
- `mica-<board>.<variant>-<stamp>.micaupd` — the full update archive, always.
- `.root.micaupd` and `.kernel.micaupd` — the partial archives, when the
  component they omit is unchanged since the product's previous release, and
  `.core.micaupd`, the core components alone
  ([update packages](../operate/update-packages.md)).
- `mica-build.lock` and `SHA256SUMS`, which lists the lock.

> status: shipped — evidence: `docs/decisions/2026-09-15-release-images-and-products.md`, `docs/decisions/2026-09-15-update-packages.md`, `docs/hardware/support-tiers.md`

## 2. Find a product's newest release

```sh
PRODUCT=uefi-x64.basic
TAG=$(curl -fsSL "https://api.github.com/repos/micaoss/mica-build/releases?per_page=100" \
  | jq -r --arg p "$PRODUCT." '[.[] | select(.draft == false and (.tag_name | startswith($p)))][0].tag_name')
echo "$TAG"                                   # uefi-x64.basic.<YYYYMMDD-HHMM>
```

The GitHub API lists releases newest first. `gh release list -R micaoss/mica-build`
shows the same list.

> status: shipped — evidence: `mica-build:README.md`

## 3. Download and verify

```sh
REL=https://github.com/micaoss/mica-build/releases/download/$TAG
STAMP=${TAG##*.}
curl -fsSLO "$REL/SHA256SUMS"
curl -fsSLO "$REL/mica-build.lock"
curl -fsSLO "$REL/mica-$PRODUCT-$STAMP.img.gz"
sha256sum -c SHA256SUMS                       # lists the lock
awk -F'\t' '$1 == "asset" && $5 == "mica-'"$PRODUCT-$STAMP"'.img.gz" {print $6 "  " $5}' mica-build.lock \
  | sha256sum -c -                            # the lock names the image's sha256
```

The chain is `SHA256SUMS` → the lock → the `asset` row's sha256 → the file
([release lock](../reference/release-lock.md) 1.2.2).

> status: shipped — evidence: `mica-build:src/release/scoped.ts`, `docs/reference/release-lock.md`

## 4. Which digest at which step

Three independent statements cover one image, and they are checked in
different places:

1. **`SHA256SUMS`** lists the lock alone; `sha256sum SHA256SUMS` is the
   release's trust hash, the value a lock that consumes this release quotes.
2. **The lock's `asset` row** names the digest of the compressed file:
   ```sh
   awk -F'\t' '$1 == "asset" && $2 == "'"$PRODUCT"'"' mica-build.lock
   ```
3. **The OCI layer** carries the same file and is readable anonymously: the
   layer digest equals the asset row's sha256, and its
   `mica.uncompressed-sha256` and `mica.uncompressed-size` annotations are what
   `gzip -dc` produces:
   ```sh
   REF=$(awk -F'\t' '$1 == "bundle" && $2 == "'"$PRODUCT"'" && $3 == "image" {print $4}' mica-build.lock)
   T=$(curl -fsS "https://ghcr.io/token?scope=repository:micaoss/mica-build:pull&service=ghcr.io" | jq -r .token)
   curl -fsSL -H "Authorization: Bearer $T" \
     -H 'Accept: application/vnd.oci.image.manifest.v1+json' \
     "https://ghcr.io/v2/micaoss/mica-build/manifests/${REF##*@}" | jq '.layers'
   gzip -dc "mica-$PRODUCT-$STAMP.img.gz" | sha256sum
   ```

> status: shipped — evidence: `mica-build:src/release/scoped.ts`, `docs/reference/release-lock.md`

## 5. What the lock says about the release

The lock is a `mica-lock v1` file naming the release's commit and every input
that went into it: the board's pool, packages and components, the input
releases of `mica-build-env`, `mica-system-base`, `mica-core` and
`mica-podman` with their trust hashes, and the product's signed deployment,
bundles and assets ([release lock](../reference/release-lock.md) 1.2.2).

A checksum next to a file proves only that the file arrived intact. What makes
an image trustworthy is the signature chain inside it
([release signing](../security/signing.md)) and the platform trusting
that signer; the hashes above are the integrity half, not the authenticity
half.

> status: shipped — evidence: `docs/reference/release-lock.md`, `docs/security/signing.md`

## 6. Next

- Write the image to a board: [flashing](flashing.md).
- Update a running device instead: [update packages](../operate/update-packages.md).
- Build the same artifacts yourself: [build guide](build.md).
- How a release is cut and what decides a rebuild: [releasing](../releases/how-releases-work.md).

> status: shipped — evidence: `docs/start/flashing.md`, `docs/operate/update-packages.md`, `docs/start/build.md`, `docs/releases/how-releases-work.md`
