# Update packages: which archive, and how a device takes it

A Mica OS release publishes update archives beside the image. This page says
which archive applies to a device, how it reaches the device, and how to pick
the right file from a release or from the version index. The state machine
behind an installation is [update-rollback](update-rollback.md) for operators
and [updates](../design/updates.md) for the contract.

## 1. One deployment, three archives

Each product release has one signed deployment, published as up to three
`MICAUPD1` archives that carry the same descriptor:

| Kind | File | Published when |
|---|---|---|
| `full` | `mica-<product>-<stamp>.micaupd` | always |
| `root` | `mica-<product>-<stamp>.root.micaupd` | the kernel identity is unchanged from the product's previous release |
| `kernel` | `mica-<product>-<stamp>.kernel.micaupd` | the rootfs identity is unchanged |

When both changed, only `full` is published. A `root` archive carries the
rootfs objects, a `kernel` archive the boot artifact and the support image
with its modules and firmware; the objects they leave out must already be on
the device, which is why each states what it requires. Update archives are
not compressed.

> status: shipped — evidence: `docs/decisions/2026-09-15-update-packages.md`, `docs/design/release-signing.md`

## 2. Which archive applies

Read the running state first: `GET /api/v1/system/info` and
`GET /api/v1/update` report the authenticated deployment, its generation, and
the kernel and rootfs identities.

- The device's product must equal the descriptor's signed `product` field; a
  deployment for another product is refused.
- The archive's generation must be above the device's, and the generation
  floor never goes backwards.
- A `root` archive applies only where the device already runs the kernel it
  names; a `kernel` archive only where it already runs the rootfs. `full`
  always applies.

> status: shipped — evidence: `docs/design/updates.md`, `docs/design/release-signing.md`, `mica-core:crates/mica-deploy`

## 3. Taking one on the device

`mica-deploy` is the native backend; `micad` exposes it on D-Bus and `apid`
behind the API. Its actions include `status`, `probe`, `check`, `fetch`,
`import`, `install`, `confirm`, `reject`, `rollback`, `gc`, `booted` and
`fail-boot`:

```sh
mica-deploy import /path/to/mica-<product>-<stamp>.micaupd
mica-deploy check --source <manifest URL> --channel <channel>
mica-deploy fetch --source <manifest URL> --channel <channel>
```

`import` reads an archive from local storage (a USB stick, an SFTP upload);
`check` and `fetch` read a signed `mica/catalog/v2` manifest, whose channel
heads are keyed by board, product and channel, and the update server is keyed
by product. An installation is then confirmed or rolled back through the
lifecycle of [update-rollback](update-rollback.md).

> status: shipped — evidence: `mica-core:crates/mica-deploy/src/bin/mica-deploy.rs`, `docs/design/updates.md`, `docs/decisions/2026-09-15-update-packages.md`

The exact operator sequence on a device, including how an archive is placed
and who triggers the install, is the operator guide's; this page names the
files and the rules.

## 4. Picking a file from the index

The version index `mica/<YYYYMMDD-HHMM>` of `micaoss/mica-build` is the one
place that names every published product's newest artifacts. In
`mica-index.json`, each product carries:

- `generation`, `deployment`, `kernel` and `rootfs`: the identities to
  compare with the device;
- `updates[]`: one entry per archive with `kind`, `file`, `url`, `sha256`,
  `size` and `requires`, where `requires.generationBelow` is the archive's
  generation, and `requires.kernel` or `requires.rootfs` names the component
  the archive does not carry;
- `images[]`: the same for the disk images, with the compression and the
  uncompressed identity.

So: find the product, compare `requires` with what the device runs, download
`url`, check `sha256`, and import it. The shape is
[mica-index](../design/mica-index.md).

> status: shipped — evidence: `docs/design/mica-index.md`, `docs/decisions/2026-09-15-mica-version-index.md`

## 5. Limits

- There is no firmware-only archive: firmware maintenance is separate, and a
  `firmware` update kind is refused.
- A kernel package is not published across a change of the verity trust
  certificate; such a release ships `full` only.
- Update archives are published only for products a release publishes; the
  minimal products are never released.

> status: unsupported
