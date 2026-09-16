# Update packages: one signed deployment, full, root and kernel archives

- **date**: 2026-09-15
- **kind**: engineering decision
- **owner**: the mica-build owner (archives, lock rows, update-server); the mica-core owner (partial import, the signed `product` field); the mica-boards owner (`update` rows in `images.tsv`)
- **review sunset**: 2027-03-15
- **status**: accepted (user, 2026-09-15: "接受", on `mica-build`'s proposal); `mica-core` part implemented in its release `20260915-0728` (`2a4c98d`); `mica-build` part (the `mica/deployment/v2` writer with the product, the `full`, `root` and `kernel` archives, the update-server with catalog v2 and import) released in `x64/20260915-1458` (`full` only, the first release of the scope); the first `kernel` archives published in `x64/20260915-2042` and `cx3576/20260915-2042` for `x64-dev` and `cx3576-dev`, whose rootfs identities were unchanged; the first `root` archives published in `x64/20260915-2230` and `cx3576/20260915-2230`, where every product carries `full`, `root` and `kernel` because both identities were unchanged from `2042`; the `mica-boards` update rows pending; order: `mica-core`, then `mica-build` with the update-server, then the `mica-boards` update rows

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
`uefi-x64-dev`); the device's product is the single unquoted `PRODUCT=<name>` line
of the five-line `/usr/lib/mica/product.conf`; `mica/catalog/v2` carries
channel heads `{board, product, channel, releaseId, generation}`; the
`MICAUPD1` layout is unchanged, with an object count from 0 to the
descriptor's; `mica/kernel/v1` is unchanged, and `mica/rootfs/v1` is later
replaced by `mica/rootfs/v2` without `version`
(`docs/decisions/2026-09-15-stable-component-ids.md`).

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

**Unchanged roots.** A `root` or `kernel` archive needs the other part's
identity to stay unchanged across releases; packages whose inputs did not
change keep their version and published bytes across releases, and a release
never changes a package version
(`docs/decisions/2026-09-15-package-versions.md`); the root and kernel
components carry no release identity and are signed deterministically
(`docs/decisions/2026-09-15-stable-component-ids.md`).

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
