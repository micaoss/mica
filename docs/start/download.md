# Getting a release: what is published and how to check it

Mica OS is published as GitHub releases of `micaoss/mica-build`. Everything is
anonymous: no token, no registry login. A release is one product:

| Release | Tag | Carries |
|---|---|---|
| A product release | `<board>.<variant>.<YYYYMMDD-HHMM>` | `mica-<board>.<variant>-<stamp>.img.gz`, its `.micaupd` archives, `mica-build.lock`, `SHA256SUMS` |

Each product releases on its own, so there is no index to start from: a
product's newest release is the newest tag that starts with
`<board>.<variant>.`.

**The same files are on the resource service.** The release run posts each
release there (`mica-build:README.md`): the files are at
`https://dl.res.micaos.dev/mica/<board>.<variant>/<stamp>/<asset>`, beside the
release's own `index.json`, which lists them with their sizes and digests, and
the manifest under the update root `https://res.micaos.dev/update/` names every
product's current release. That is what the website's download pages and a device read; a
release an administrator deleted there is gone from both.

> status: shipped — evidence: `docs/reference/release-lock.md`, `mica-build:README.md`, `mica-build:boards/products.md`

## 1. What exists to download

Each product is `<board>.<variant>`, and the variant names what that
product is for. Each board names its own: no variant is a default, and no
variant name means the same thing on every board, so what a product carries is
in the table below and on its [board page](../hardware/README.md), not in its
name. A product with `PROFILE=dev` (`<board>.dev`, `s905x5m.emmc-dev`) is built
locally and never released. **Which products have a release is on the
[download page](https://micaos.dev/download/)**; a product without one has
nothing to download and is built from source ([build guide](build.md)).

The current releases, and the core each image was built with:

| Product | Stamp | Core in the image | What it carries |
|---|---|---|---|
| `cx3576.full` | `20261114-1206` | 0.0.7 | systemd, Docker, OpenSSH, WiFi and Bluetooth: factory access point, BLE provisioning |
| `s905x5m.sd-full` | `20261114-1207` | 0.0.7 | systemd, Podman, Dropbear, WiFi and Bluetooth, on an SD card |
| `s905x5m.emmc-full` | `20261114-1344` | 0.0.7 | the same, on the eMMC |
| `uefi-x64.full` | `20261114-1207` | 0.0.7 | systemd, Podman, Dropbear, no radio |
| `uefi-x64.docker` | `20261114-1344` | 0.0.7 | systemd, Docker, Dropbear, no radio |
| `mini-x64.basic` | `20261114-1206` | 0.0.7 | OpenRC, the management plane and the console, Dropbear, no container engine |
| `qemu-armhf.basic` | `20261114-1207` | 0.0.7 | OpenRC, the management plane and the console, Dropbear, no container engine |

The current core set is `core.general.20261114-1119`, core 0.0.7, and every
image above was built with it. `uefi-x64.gcp` has a public test image on
Google Compute Engine and no release yet ([uefi-x64](../hardware/uefi-x64.md)).

> status: shipped — evidence: `mica-build:boards/products.md`, `mica-core:docs/mica-core.md`

**A published image is not a booted image.** The `cx3576`, `s905x5m` and
`qemu-armhf` products are started by nothing automatic, because no suite boots
a product's FIT image; the boards are started on hardware by hand
([board status](../hardware/README.md#current-boards)). Every amd64
product (`uefi-x64.*`, `mini-x64.basic`) is booted in its release run
([harness](https://github.com/micaoss/mica-build/blob/main/README.md#build-and-verify)).
Being a release target means the images are built and published;
it is not a claim about hardware
([support tiers](../hardware/README.md)).

A release carries:

- `mica-<board>.<variant>-<stamp>.img.gz` — the factory disk image,
  gzip-compressed. No raw `.img` is uploaded.
- `mica-<board>.<variant>-<stamp>.micaupd` — the full update archive, always.
- `.root.micaupd` and `.kernel.micaupd` — the partial archives, when the
  component they omit is unchanged since the product's previous release
  ([update packages](../operate/updates.md)).
- `mica-build.lock` and `SHA256SUMS`, which lists the lock.

> status: shipped — evidence: `mica-build:boards/products.md`, `docs/operate/updates.md`, `docs/hardware/README.md`

## 2. Find a product's newest release

```sh
PRODUCT=uefi-x64.full
TAG=$(curl -fsSL "https://api.github.com/repos/micaoss/mica-build/releases?per_page=100" \
  | jq -r --arg p "$PRODUCT." '[.[] | select(.draft == false and (.tag_name | startswith($p)))][0].tag_name')
echo "$TAG"                                   # uefi-x64.full.<YYYYMMDD-HHMM>
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
releases of `mica-build-env`, `mica-system-base`, `mica-core`, `mica-pkgs`,
`mica-podman` and `mica-docker` with their trust hashes, and the product's signed deployment,
bundles and assets ([release lock](../reference/release-lock.md) 1.2.2).

A checksum next to a file proves only that the file arrived intact. What makes
an image trustworthy is the signature chain inside it
([release signing](../security/signing.md)) and the platform trusting
that signer; the hashes above are the integrity half, not the authenticity
half.

> status: shipped — evidence: `docs/reference/release-lock.md`, `docs/security/signing.md`

## 6. Next

- Write the image to a board: [flashing](flashing.md).
- Update a running device instead: [update packages](../operate/updates.md).
- Build the same artifacts yourself: [build guide](build.md).
- How a release is cut and what decides a rebuild: [releasing](../releases/how-releases-work.md).

> status: shipped — evidence: `docs/start/flashing.md`, `docs/operate/updates.md`, `docs/start/build.md`, `docs/releases/how-releases-work.md`
