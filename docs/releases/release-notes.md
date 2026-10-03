# Release identification and release notes

How to say which release a device runs, where the facts about a release come
from, and what a release does not promise.

## 1. Identifying what runs

A running system is identified by its authenticated **deployment id**, its
**generation**, its product and board, and the identities of its kernel and
root. `mica-deploy status` and `GET /api/v1/system/info` report them. A file
name or a timestamp does not identify content; no commit hash and no build
date is a device-visible fact.

The signed deployment descriptor binds the exact kernel, root and core
components by digest and length, so the deployment id stands for those bytes
and nothing else. The root also carries the inventory of packages it was
composed from, `/usr/share/mica/manifest.tsv`. Firmware has an identity of its
own and is in no deployment.

Map a deployment id back to a release with the `product` row of that release's
`mica-build.lock` ([release lock](../reference/release-lock.md)).

> status: shipped — evidence: `mica-build:src/image/components.ts`, `mica-core:crates/micad/src/system_info.rs`, `mica-build:src/product/build.ts`

## 2. Where release facts come from

A release of a product is `<board>.<variant>.<YYYYMMDD-HHMM>`. Its facts are in
what it publishes, not in prose written afterwards:

- `mica-build.lock` names the product's generation and deployment id, each
  image and update archive with its sha256, and the input releases the build
  took ([how releases work](how-releases-work.md));
- the release's document on the resource service lists the same files with
  their sizes and digests, and is what the [download page](https://micaos.dev/download/)
  and devices read;
- which update archives exist says what changed: a `root` archive means the
  kernel is the previous release's, a `kernel` archive that the root is, and a
  `core` archive that only the core components moved
  ([updates](../operate/updates.md)).

A change to a trust anchor, the boot policy, an access default or what
persists is stated in the release's notes by name. A fallback deployment
shares DATA with the one it replaces: no release reverts application data, and
there is no data migration path.

> status: shipped — evidence: `mica-build:README.md`, `mica-build:src/release/scoped.ts`, `docs/reference/updates.md`

## 3. What a release is not

A published release is not a board qualification and not a support
commitment: what has been proven about a board is on its
[board page](../hardware/README.md), and what support means is
[support](support.md). An installed deployment keeps booting offline whatever
the update server later offers or withholds.

> status: shipped — evidence: `docs/hardware/README.md`, `docs/releases/support.md`, `mica-core:crates/mica-deploy/src/acquisition.rs`

No release cadence, support window or end-of-life date is promised.

> status: unsupported
