# Storage policy and observation

A factory image on a disk has three GPT partitions: UEFI boards use
ESP/SYSTEM/DATA, U-Boot boards (cx3576, s905x5m) FIRMWARE/SYSTEM/DATA. The
raw-NAND boards (qemu-armhf, ssd202d) carry UBI volumes instead: `system` and
`data` (UBIFS), two record volumes and one static volume per signed component.
Sizes, identities and roles are declared in `boards/<board>/board.env` and
`layout.tsv`. DATA alone grows to the available medium. Firmware and SYSTEM
ranges remain fixed.

## Ownership

| Physical namespace | Exposed paths | Owner and purpose |
|---|---|---|
| SYSTEM | `/mnt/system` and verified root/support mappings | At most two signed deployments, descriptors and shared component objects |
| DATA/state | Selected service binds, `/etc/machine-id`, random seed, `/usr/local/etc`, `/usr/local/lib/systemd/system` | Device identity, credentials, persistent service state, and the user's own units and fstab |
| DATA/meta | `/mnt/data/meta` | Native transaction state, catalog checkpoints, firmware receipt and appliance lifecycle records |
| DATA/mica | `/mica`, `/home`, `/root` | Configuration, container volumes, update workspace and user homes |
| DATA/containers | `/mica/containers` | Container images, writable layers and network definitions |
| DATA/srv | `/srv` | The user's data; no reset tier opens it |
| DATA/var | `/var` | Persistent service state, caches, logs and temporary files under a shared project limit |
| DATA/cache, DATA/tmp | Internal disposable paths | Share the bounded variable-data project with DATA/var |
| Memory | `/run`, `/tmp`, the journal where logging is not persistent (by default on the UBI boards) | Per-boot runtime state |
| The user's disks | `/srv` and below, `/var/mnt/<name>`, `/home/<user>`, an engine root | Whatever the user mounts there (section *User mounts*) |

The root remains read-only. DATA/var is bound over all of `/var`; services can
create new state directories without a separate mount per service. On first
boot `mica-seed-var` copies the packaged var template after quota setup, preserving
ownership, modes and symlinks. Later boots retain its content. The protected
`/var/lib/mica` and Bluetooth credential binds remain outside the general var
quota. Unit sources are bound to their existing search paths, then reloaded
after DATA is ready. Container projects are micad's settings
(`/mica/config/container/`), and on podman also `mica-containerd`'s store on
STATE (`/var/lib/mica/containerd/`); a project's named volumes are under
`/mica/volumes/<project>/`. Netavark definitions use `/mica/containers/networks`.

The `/mica`, `/var` and `/mica/containers` binds use private mount propagation
and, like `/srv`, `/home` and `/root`, `nosuid,nodev`.
Protected state and container child mounts stay at their logical paths; they
must not appear inside the physical DATA tree traversed by reset.

State/meta are private physical directories. The bound Mica OS state root permits
traversal to networkd's group-readable WireGuard key directory; credential
subdirectories remain mode 0700 and documents 0600. Binding an approved leaf
avoids granting a service access to unrelated physical state namespaces.

## User mounts

A user mounts their own disks only where `/usr/lib/mica/mica-mountpoint`
allows: `/srv` and below, `/var/mnt/<name>` and below, `/home/<user>` and
below, and exactly `/mica/containers/storage` or `/mica/containers/docker`;
swap on a stable device name or a file at an allowed target. On systemd they
are `.mount`, `.automount` and `.swap` units installed with `mica-unit` and
put into the boot's first transaction by a generator, before
`local-fs.target` and any engine; on OpenRC they are lines of
`/usr/local/etc/fstab`, mounted by `mica-fstab` in `boot`. A refused unit is
masked and a refused fstab line refuses the file. A mount at `/srv` replaces
the default bind of DATA/srv, which comes back when the mount is removed. An
engine whose root is a user mount requires it (`RequiresMountsFor=` on
systemd, `mica-require-mount` on OpenRC), so a missing disk fails the engine
rather than filling DATA. The contract is
`mica-system-base:docs/floor-and-options.md`, *The user's own mounts*.

## External media

micad lists USB mass storage and SD cards (never soldered eMMC, never the
device's own disks), and mounts a clean volume of a supported file system
(vfat, exFAT, ext2/3/4 through the ext4 driver) read-only at
`/run/mica/media/<id>`, `ro,nosuid,nodev,noexec` (on systemd as a transient
mount unit of PID 1, on OpenRC by micad). A volume that needs repair is left
alone. Unmount and eject refuse while anything uses the volume or device;
nothing on a medium is written. A kernel with no USB or SD host reports
`supported: false`. The API is `/api/v1/storage/media` and
`/api/v1/update/media` (`mica-core:docs/mica-core.md`, section 4).

## Capacity

SYSTEM has a strict two-deployment budget. It contains `deployments`, `roots`
and `kernels`, including authenticated descriptors, hash text and signatures.
Download archives, partial downloads and acquisition state stay in DATA under
`/mica/updates`; logs, user data and application state also remain outside SYSTEM.
Short-lived object publication files are removed by interrupted-install cleanup.

Factory preflight budgets two full payloads with 128 MiB SYSTEM headroom (64 MiB
for UEFI ESP). After formatting SYSTEM, the builder subtracts measured ext4
metadata overhead, reserved blocks and the kernel's internal cluster reserve
before accepting that payload budget. Runtime installation checks actual `f_bavail`, inode
availability and reclaimable allocated blocks, then rechecks free space after
collection. Filesystem metadata and reserved blocks reduce usable capacity, so
partition size alone is not a payload limit. Content IDs share unchanged objects
between deployments. The cx3576 SYSTEM partition remains 1 GiB.

Bind mounts share one filesystem and do not create separate capacity totals.
Project 100 accounts for DATA/mica and DATA/srv; project 102 accounts for
DATA/containers independently. Both projects have zero soft/hard byte and inode
limits, meaning unlimited usage within DATA's available capacity. They retain
project inheritance and usage reporting, with no proportional capacity split.

Project 101 covers DATA/var, cache and tmp together. Its byte limit is one eighth
of DATA capacity, clamped to 32–256 MiB; its inode limit is one eighth of DATA
inodes, clamped to 2048–16384. This bounded variable-data limit is recomputed
after DATA growth. Images include ext4 quota/project features and matching
built-in kernel support. The API reports zero limits for unlimited projects.

Service bounding sets remove `CAP_SYS_RESOURCE`, so ordinary root services
cannot bypass the variable-data limit. The fixed growfs helper retains the
capability needed by ext4 resize. Unbounded system/user/container writers can
fill DATA; project quotas do not guarantee a free-space reserve for state/meta.

## Startup and failure

Authenticated early boot establishes DATA and machine identity before the init.
The board's `mica-grow-data` invocation verifies the SYSTEM partition and disk
UUID before passing the physical disk to `systemd-repart`. It uses packaged
partition definitions; only DATA has growth weight. Filesystem growth, namespace
initialization and quota setup precede consumers and bind mounts.

Missing, read-only or corrupt DATA is a shared-data failure. The system does not
create default credentials on the immutable root or blame a root deployment
repeatedly. SYSTEM failure similarly requires explicit recovery. Bounded journal
replay is distinct from a full offline filesystem repair, which boot does not
attempt automatically.

## API and reset

`GET /api/v1/storage/status` reads physical tiers, exposed binds, directory
accounting, device statistics and supported wear observations. Missing or
unobservable values are reported as such. Capacity is counted once for DATA,
not summed again for each bind. The explicit workspace probe creates and removes
one bounded test file under the system-owned update workspace.

Reset operates on allowlisted physical directories under a transaction lock.
It validates directory identity, rejects symlinks, leaves a directory that
something is mounted on in place with everything under it (no tier crosses
into a mount, and none opens `/srv`), bounds traversal depth/count/time, syncs
removals, and clears durable intent only after completion. The factory reset
is not a tier: it makes DATA again ([recovery](recovery.md) 2.3). Configuration and application/user data scopes follow the selected
reset tier; machine identity, credentials and deployment/lifecycle records are
preserved as required by the reset contract. Root rollback never promises to
reverse arbitrary writable application data.
