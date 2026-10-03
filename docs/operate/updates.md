# Updates and rollback

How a device takes a new release, what it keeps to fall back on, and every
refusal an operator can meet on the way. The contract behind this page is
[updates](../reference/updates.md); the formats are `mica-core`'s
(`mica-core:docs/mica-core.md` section 6).

**How much of this has been run.** The producing side is exercised by every
release, and the device side under QEMU by the lifecycle suite and by
`mica-core`'s contract and fault tests. No full cycle (import, install,
reboot, automatic confirmation, rollback) is on record for physical hardware;
see the [support tiers](../hardware/README.md#current-boards).

> status: unsupported

## 1. What an update is

A release of a product is one signed **deployment**: a kernel with its support
image, a root filesystem, and the core components (the management daemon with
the API, and the web console). The device stages a new deployment while the
current one runs, boots it on the next reboot, and confirms it only once it has
proved healthy. It keeps at most two deployments, so one fallback is always
retained.

An update never touches the bootloader, platform keys or the data on DATA.
Firmware is maintained separately and offline ([recovery](recovery.md)).

> status: shipped — evidence: `mica-core:docs/mica-core.md`, `docs/reference/updates.md`

## 2. Which archive applies

A release publishes its deployment as up to four offline archives beside the
image. All carry the same signed descriptor and differ in the objects they
bring; what an archive leaves out must already be on the device.

| Kind | File | Carries | Published when |
|---|---|---|---|
| `full` | `mica-<product>-<stamp>.micaupd` | everything | always |
| `root` | `...<stamp>.root.micaupd` | the root filesystem | the kernel is unchanged from the product's previous release |
| `kernel` | `...<stamp>.kernel.micaupd` | the kernel and its support image | the root is unchanged |
| `core` | `...<stamp>.core.micaupd` | the core components | a core release: the previous kernel and root with new core components |

A product's first release, and a release in which both the kernel and the root
moved, publish `full` only. `full` always applies. The others apply where the
device already runs what they leave out: compare the release's kernel and root
identities with `mica-deploy status` or `GET /api/v1/system/info` on the
device.

Three rules hold for every kind:

- the archive's product must be the device's own (`PRODUCT=` in
  `/usr/lib/mica/product.conf`, part of the signed root);
- its generation must be above every generation the device has seen, not only
  the running one;
- its signature must verify against the keys in the device's signed kernel.

The newest release of a product is the one to take; how to find it and check
its digests is [download](../start/download.md).

> status: shipped — evidence: `mica-build:README.md`, `mica-core:crates/mica-deploy/src/acquisition.rs`, `docs/decisions/2026-09-15-update-packages.md`

## 3. Online updates

A device is configured with an **update root**, a URL ending in `/`. The
project's is `https://res.micaos.dev/update/`. Under it the device reads the
manifest naming its product's current release, then that release's document,
then the signed descriptor, each only when it needs it, and downloads only the
objects it does not already hold.

Trust comes from the signed descriptor, never from the address: a device takes
only its own board, architecture and product, only a newer generation, and
checks every byte against what the descriptor names. There is no channel and
no expiry, so a server that withholds a release reads as "nothing newer".

The image carries the defaults; `/mica/config/updates.json` on DATA, or the
System page, may set the source, the policy (`off`, `check`, `auto`), the check
interval and the maintenance window. No setting can add a signing key.

An integrator who runs their own server serves the same documents from another
root and points the source at it (`mica-core:docs/mica-core.md` section 6.2).

> status: shipped — evidence: `mica-core:crates/mica-deploy/src/catalog.rs`, `mica-core:crates/micad-settings/src/configuration.rs`, `mica-build:README.md`

## 4. Offline updates

Bring the `.micaupd` to the device one of two ways:

- **Upload it.** The System page, or `POST /api/v1/update/import` with the
  archive as the request body. The answer is 202; poll `GET /api/v1/update`
  for the outcome. The update policy does not gate an upload: a device whose
  policy is `off` still takes a file an operator carried to it.
- **Copy it and import it over SSH.** `mica-deploy import <archive>`. The file
  may sit anywhere readable except under `/mica/updates/`, the acquisition
  workspace, where it would count against its own import's budget.

Either way the archive passes the same checks as an online download and ends
as a verified deployment waiting to be installed.

> status: shipped — evidence: `mica-core:crates/mica-apid/src/update_api.rs`, `mica-core:crates/mica-deploy/src/bin/mica-deploy.rs`

## 5. Install, reboot and confirmation

1. **Install** writes the new objects to SYSTEM and, last, the boot entry that
   makes the deployment a candidate. It never reboots. It needs the new bytes
   plus the board's reserve on SYSTEM and on the boot partition.
2. **Reboot** is a separate action, subject to the reboot gate and the
   maintenance window when the policy is `auto`.
3. The loader starts the candidate with **three attempts**. A candidate that
   never comes up is skipped once its attempts are spent, and the retained
   deployment boots instead.
4. **Confirmation is automatic.** After boot the health gate checks that the
   boot settled, that the management daemon answers and that the API answers,
   then confirms the deployment. A failed gate reboots into the retained
   deployment.

From the command line the same steps are `mica-deploy install`, `confirm`,
`status` and `booted`; every command prints one JSON object.

> status: shipped — evidence: `mica-core:crates/mica-deploy/src/deployments/install.rs`, `mica-system-base:payload/usr/lib/mica/mica-health`, `mica-system-base:payload/etc/mica/health.conf`

## 6. Rollback

Manual rollback (`POST /api/v1/update/rollback`, `mica-deploy rollback`, or the
System page) is available when the running deployment is confirmed, no
candidate is pending and a fallback is retained. It retires the running
deployment so the fallback boots next; the operator reboots.

Rollback is a boot selection, not a data restore: configuration, databases and
application data on DATA stay as they are.

A deployment that failed or was rejected is remembered, and the generation
floor only rises, so a known-bad release is never installed again. A corrected
release is a new one with a higher generation.

> status: shipped — evidence: `mica-core:crates/mica-apid/src/update_api.rs`, `mica-core:crates/micad/src/deployment.rs`

## 7. The refusals

Acquisition and installation check separately and both apply. The messages
are verbatim.

| Cause | Message |
|---|---|
| Wrong product | `deployment targets another product` |
| Wrong board or architecture | `deployment targets another device` |
| Boot format wrong for this device | `deployment boot format differs from this device` |
| Generation not above the highest seen | `deployment generation is not newer` |
| A candidate already waits for its first boot | `another deployment is pending` |
| The running deployment is not confirmed yet | `confirm the running deployment before installation` |
| Already installed, or previously rejected | `deployment is installed or rejected` |
| A partial archive whose other objects are absent | `deployment objects are incomplete` |
| The archive carries objects the descriptor does not name | `archive carries more objects than the deployment names` |
| An object is unlisted, duplicated or the wrong length | `unlisted, duplicate or wrong-sized archive object` |
| Object bytes do not match their digest | `archive object digest mismatch` |
| Bytes after the last object | `trailing archive bytes` |
| Not an update archive | `invalid component archive` |
| Unknown signing key | `untrusted metadata key` |
| Bad signature | `metadata signature rejected` |
| No room in the acquisition workspace | `workspace budget exhausted`, `DATA reserve unavailable` |
| No room at install time | `insufficient destination space`, `insufficient destination inodes` |
| Something is mounted in the workspace | `unexpected mount in update workspace` |
| The source is not an update root | `invalid catalog source URL` |
| The server went back to an older manifest | `catalog revision rollback` |

Over the API a policy refusal is **409** `policy_refused`, a malformed request
**422** `validation_failed` and a backend refusal **500** `micad_failed`.
`GET /api/v1/update` reports failures from a closed vocabulary that includes
`no-newer-release`, `install-refused`, `outside-window` and
`reboot-gate-closed`.

> status: shipped — evidence: `mica-core:crates/mica-deploy/src/acquisition.rs`, `mica-core:crates/mica-deploy/src/deployments/install.rs`, `mica-core:crates/micad/src/update_codes.rs`

## 8. Traps

- Do not keep an archive, or mount anything, under `/mica/updates/`.
- Do not install a second update before the running one is confirmed, or
  while a candidate waits for its first boot.
- Do not rebuild "the same" release with a lower generation: the device
  refuses it.
- Do not edit `/usr/lib/mica/product.conf`, the deployment descriptors or the
  boot entries by hand; they are read as authenticated state.
- Do not delete objects under `/mnt/system/` by hand; `mica-deploy gc` removes
  exactly what no retained deployment references.
- Do not treat rollback as a data restore.

> status: shipped — evidence: `mica-core:crates/mica-deploy/src/acquisition.rs`, `mica-core:docs/mica-core.md`

## 9. Limits

- No update archive carries a bootloader. Firmware moves only through the
  offline maintenance route of each board ([recovery](recovery.md),
  [signing](../security/signing.md)).
- A rotation of the verity key re-signs the root, so that release ships `full`
  only.
- A `dev` product is never released, so it has no update archives.

> status: unsupported
