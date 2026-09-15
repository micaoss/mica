# Update packages: one signed deployment, full, root and kernel archives

- **date**: 2026-09-15
- **kind**: engineering decision
- **owner**: the mica-build owner (archives, lock rows, update-server); the mica-core owner (partial import, the signed `product` field); the mica-boards owner (`update` rows in `images.tsv`)
- **review sunset**: 2027-03-15
- **status**: accepted (user, 2026-09-15: "接受", on `mica-build`'s proposal); not implemented; order: `mica-core`, then `mica-build` with the update-server, then the `mica-boards` update rows

## Decision

**One signed deployment, three archives.** Each product release has one
signed deployment. It is published as up to three `MICAUPD1` archives that
carry the same signed descriptor:

- `full`, `<name>.micaupd`: every object; always published;
- `root`, `<name>.root.micaupd`: the rootfs objects only; published only when
  the kernel identity is unchanged from the previous release of that product;
- `kernel`, `<name>.kernel.micaupd`: the kernel objects only (the boot
  artifact, the support image with its modules and firmware, and its
  signature); published only when the rootfs identity is unchanged.

When both changed, only `full` is published. Changes are decided by the
component identities against the product's previous `mica-build.lock`
(`product` rows, `docs/design/release-lock.md` 1.2.2).

**Modules** stay in the kernel component's support image, unchanged; the
runkit refuses a module release that does not match the kernel.

**No firmware-only package** until `mica-core` has an on-device firmware
install and recovery design: an update kind `firmware` is refused.

**mica-core.** A `MICAUPD1` import may carry a subset of the descriptor's
objects; every missing object must already be in the store. The deployment
descriptor gains a signed `product` field (a schema bump): a device refuses a
deployment for another product, and catalog heads and the update-server are
keyed by board, product and channel. There is no minimum running release
rule. Names, as `mica-core` implements them (`mica-core:docs/task/20260915-0657-update-packages.md`):
`mica/deployment/v2` replaces v1 with a required `product` (such as
`x64-dev`); the device's product is the single unquoted `PRODUCT=<name>` line
of the five-line `/usr/lib/mica/product.conf`; `mica/catalog/v2` carries
channel heads `{board, product, channel, releaseId, generation}`; the
`MICAUPD1` layout is unchanged, with an object count from 0 to the
descriptor's; `mica/kernel/v1` and `mica/rootfs/v1` are unchanged.

**Trust rotation.** A `kernel` package is refused at build when the
kernel-embedded verity trust certificate differs from the previous release's;
a trust rotation ships as `full` only.

**The update-server** is keyed by product and imports a release from the
`full` archive or from the OCI update layer. The `root` and `kernel` archives
are for offline delivery and release assets.

**No generic root** across products or boards: a root is composed and signed
per product.

**Declaration and publication.** A board's `images.tsv` declares its update
kinds as `update <kind> builtin - <suffix>` rows: `full` (mandatory,
`micaupd`), `root` (`root.micaupd`) and `kernel` (`kernel.micaupd`); `-` is
the runtime image of every builtin row, including `image disk builtin - img`
(`docs/boards/contract.md` 3.1). A product selects `UPDATE_KINDS` in its
`product.env` (default all, `full` always). Each archive is a release asset
`mica-<product>-<YYYYMMDD-HHMM>.<suffix>` and a layer of the OCI manifest
`update.<product>.<YYYYMMDD-HHMM>` (annotations `mica.update-kind`,
`mica.deployment-id`, `mica.generation`), recorded by `bundle` and `asset`
rows of `mica-build.lock` (`docs/design/release-lock.md` 1.2.2).

## Order

`mica-core` first (partial import, the signed `product` field), then
`mica-build` with the update-server, then the `mica-boards` `update` rows.

## Rationale

The kernel and the system are upgraded independently, so a small `root` or
`kernel` archive saves bandwidth and offline media when only one of them
changed, while one signed deployment keeps a single authority for what the
device ends up running. Deciding by component identities keeps the choice
mechanical, and restricting trust rotation to `full` keeps a device from
receiving a kernel whose trust anchor its installed root does not expect.

## Removal condition

Revisited when firmware gains an on-device install and recovery design, or
when a product needs an update path the three archives cannot express.
