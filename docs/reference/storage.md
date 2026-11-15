# Storage: partitions and the DATA layout

Where a Mica OS device keeps what: the partitions or UBI volumes of each board,
what SYSTEM and DATA hold, every path a running system can write, the quotas,
the user's own disks and external media, and how capacity and failures are
handled. The contracts are `mica-core:docs/mica-core.md` 6.1 and 6.6 and
`mica-system-base:docs/floor-and-options.md`; the sizes are each board's
`layout.tsv` (or `flash.tsv`) in `mica-build`. [Storage](../operate/storage.md)
is the operator's guide.

## Partitions per board

Every disk board has three GPT partitions. Only DATA grows: after the first
boot it extends to the end of the medium (`mica-grow-data` with
`systemd-repart`, or its OpenRC twin), and the factory sizes below are what the
image carries.

```text
one disk (GPT)
+------------------------+--------------------+---------------------------------------->
| 1: ESP or FIRMWARE     | 2: SYSTEM          | 3: DATA  (grows to the end at first boot)
|  loader, boot records  |  read-only at      |  /mnt/data
|  (FIRMWARE: raw)       |  /mnt/system       |
+------------------------+--------------------+---------------------------------------->
                          deployments/         state/       -> /var/lib/mica, /etc/hostname,
                          kernels/  roots/                     /etc/machine-id (ro), /usr/local/...
                          sets/core/           meta/        -> update transactions, receipts
                          extensions/          mica/        -> /mica  (config, updates, volumes,
                          owner-certs/                          compose, diagnostics, ui),
                          factory-reset/                        /root, /home
                                               containers/  -> /mica/containers
                                               srv/         -> /srv  (no reset tier opens it)
                                               var/         -> /var
                                               cache/, tmp/ -> internal
```

`qemu-armhf` holds the same SYSTEM and DATA as UBIFS volumes on NOR flash,
beside one static volume per signed object (below).

| Board | Partition 1 | Partition 2: SYSTEM | Partition 3: DATA (factory size) |
|---|---|---|---|
| `uefi-x64`, `uefi-arm64` | ESP, 512 MiB | 1 GiB | 256 MiB |
| `mini-x64` | ESP, 16 MiB | 98 MiB | 12 MiB |
| `cx3576` | FIRMWARE (raw), about 18 MiB from sector 64: loader, record copies at 16 MiB and 17 MiB of the disk | 1 GiB, from 18 MiB | 256 MiB, from 1042 MiB |
| `s905x5m` | FIRMWARE (raw), about 128 MiB from sector 64: record copies at 120 MiB and 124 MiB into it | 1 GiB | 256 MiB |

`qemu-armhf` keeps everything on NOR flash under UBI: two 64 MiB CFI banks
(256 KiB erase blocks), U-Boot in the first MiB, and all of the second bank as
the `ubi` MTD partition. Its volumes:

| Volume | Kind | Holds |
|---|---|---|
| `system` | dynamic, UBIFS (24 LEBs in the image) | SYSTEM's small files: descriptors, root-hash signatures, sets, extensions, owner certificates |
| `data` | dynamic, UBIFS (24 LEBs in the image) | DATA; empty in the image, formatted at the first mount, grown once before it when the board sets `ubi.storeReserve` |
| `records-a`, `records-b` | dynamic, one LEB each | the two boot record copies |
| `k-<kernelId>`, `s-<kernelId>`, `r-<rootId>`, `c-<componentId>`, `x-<extId>` | static | a kernel's `boot.itb`, its support image, a root, a core component, a driver extension: exactly their signed length |
| `p.<name>` | static | an object while it is written; renamed when read back and checked |

UBIFS has no project quotas, so a UBI board mounts DATA without them, and its
logs stay in RAM by default.

## What SYSTEM holds

SYSTEM is mounted read-only at `/mnt/system` and made writable only inside a
`mica-deploy` operation, under the transaction lock.

```
/mnt/system/
  deployments/<id>.json           signed deployment descriptors (at most two)
  kernels/<kernelId>/             boot image, support.img, root-hash signatures
  roots/<rootId>/                 rootfs.img, rootfs.roothash, rootfs.roothash.p7s
  sets/core/<id>.json             signed core sets (at most three)
  sets/core/state.json            current, pending, pair, bound
  sets/core/objects/<componentId>/  core.img, core.roothash, core.roothash.p7s
  extensions/state.json           driver extensions: confirmed builds, a change on trial
  extensions/objects/<extId>/     ext.json, ext.roothash.p7s, ext.img (at most 16 per kernel)
  owner-certs/<sha256>.der        enrolled owner certificates (at most 16), audit.json
  factory-reset/                  request.json and snapshot/, only while a reset is staged
```

Objects are content-addressed, so a kernel or root shared by both deployments
is stored once. On a UEFI board the boot records are the loader entries on the
ESP; on a U-Boot board they are in FIRMWARE or the record volumes.

## What DATA holds, and where it appears

DATA is mounted at `/mnt/data`. Its top-level directories are bound to the
paths a program uses; nothing writes `/mnt/data` by name except the system.

| DATA directory | Appears at | Holds |
|---|---|---|
| `state/` | `/var/lib/mica` (from `state/mica`), `/etc/hostname`, `/etc/machine-id` (read-only), `/usr/local/lib/systemd/system`, `/usr/local/etc`, the network daemons' `/etc` directories | what the device mints and each service's rendered configuration: `settings.toml`, identity and credentials, apid's state (`/var/lib/mica/apid`), the user's units and fstab |
| `meta/` | `/mnt/data/meta` | update transactions, catalog checkpoints, the firmware receipt, the last factory reset's record, the owner certificates confirmed at the console, a core set's or extension change's trial (`set-trial.json`) |
| `mica/` | `/mica` (also `/root` and `/home` from `mica/root` and `mica/home`) | `/mica/config` (one JSON document per concern, `0700`/`0600`), `/mica/updates` (downloads and staging), `/mica/volumes/<project>`, `/mica/compose`, `/mica/diagnostics`, `/mica/ui` |
| `containers/` | `/mica/containers` | the engine's root (`storage` for Podman, `docker` for Docker), its networks and `tmp` |
| `srv/` | `/srv` | the user's data; no reset tier opens it |
| `var/` | `/var` | persistent service state, caches and logs (the persistent log is here) |
| `cache/`, `tmp/` | internal | disposable, under the same limit as `var/` |

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

## The write map

What a running root can write, and with which options (the runkit's mounts and
Base's binds; `mica-mounts` repeats them on OpenRC):

| Path | Backing | Written | Options |
|---|---|---|---|
| `/`, `/usr`, `/etc`, `/run/mica-core/<pkg>` | the root's and the core components' squashfs on dm-verity (`/usr` and `/etc` an overlay of them) | never | `ro,nodev` |
| `/mnt/data` | DATA | yes | `rw,nosuid,nodev,noatime`, `prjquota` where quotas are on |
| `/mica`, `/mica/containers`, `/srv`, `/var` | binds of DATA's `mica/`, `containers/`, `srv/`, `var/` | yes, under projects 100, 102, 100, 101 | `nosuid,nodev`, private |
| `/var/lib/mica`, `/root`, `/home` | binds of DATA's `state/mica`, `/mica/root`, `/mica/home` | yes | `nosuid,nodev` |
| `/etc/hostname`, `/usr/local/lib/systemd/system`, `/usr/local/etc`, the network daemons' `/etc` directories | binds of DATA's `state/` | yes | bind |
| `/run`, `/dev/shm` | tmpfs | yes, in RAM | `nosuid,nodev` |
| `/dev` | devtmpfs | kernel | `nosuid` |
| `/proc`, `/sys` | proc, sysfs | kernel | `nosuid,nodev,noexec` |

DATA itself is mounted `nosuid,nodev` from core 0.0.8 (the releases of
2026-11-15); earlier releases mount it `rw,noatime`.

Everything else a program writes lands in one of these; the user's own disks
add to it. A write anywhere else fails with a read-only file system error.

## Quotas

| Project | Covers | Limit |
|---|---|---|
| 100 | `mica/`, `srv/` | none; usage reported |
| 101 | `var/`, `cache/`, `tmp/` | one eighth of DATA, 32 to 256 MiB, and 2048 to 16384 inodes; recomputed after DATA grows |
| 102 | `containers/` | none; usage reported. A container root moved to a disk is limited by that disk |

Quotas are on every `gpt` board and off on UBI.

## User mounts

A user mounts their own disks only where `/usr/lib/mica/mica-mountpoint`
allows: `/srv` and below, `/var/mnt/<name>` and below, `/home/<user>` and
below, and exactly `/mica/containers/storage` or `/mica/containers/docker`;
swap on a stable device name or a file at an allowed target. On systemd they
are `.mount`, `.automount` and `.swap` units installed with `mica unit` and
put into the boot's first transaction by a generator, before
`local-fs.target` and any engine; on OpenRC they are lines of
`/usr/local/etc/fstab`, mounted by `mica-fstab` in `boot`. A refused unit is
masked and a refused fstab line refuses the file. A mount at `/srv` replaces
the default bind of DATA/srv, which comes back when the mount is removed. An
engine whose root is a user mount requires it (`RequiresMountsFor=` on
systemd, `mica-require-mount` on OpenRC), so a missing disk fails the engine
rather than filling DATA. The contract is
`mica-system-base:docs/floor-and-options.md`, *The user's own mounts*.

### Moving container storage to a disk

The engine's root moves whole; its networks and `tmp` stay on DATA
(`mica-core:docs/mica-core.md` 6.1):

1. Turn containers off (`container.enabled` false) and wait until the engine
   has stopped.
2. Mount the new disk in a place of the user's, `/var/mnt/new` say, and copy
   the root with owners, modes and extended attributes:
   `cp -a --preserve=xattr /mica/containers/storage/. /var/mnt/new/` (on Docker
   `/mica/containers/docker/.`). Unmount it.
3. Empty the old root on DATA (the mount would hide it while it still uses
   DATA's space), and declare the disk's mount at the engine's root.
4. Turn containers on. The engine now requires that mount and does not start
   without it.

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

| Volume state | Means |
|---|---|
| `mounted_readonly` | mounted at `/run/mica/media/<id>`, with `availableBytes` |
| `unmounted` | unmounted by request; stays so while it is plugged in |
| `detected` (`busy`, `mounted_outside_mica`) | something else mounted it |
| `unsupported` (`filesystem_unsupported`, `filesystem_not_in_kernel`) | not vfat, exFAT or ext2/3/4, or the kernel lacks the driver |
| `failed` (`needs_repair`, `mount_failed`, `unreadable`) | a dirty or damaged file system, left alone |
| `removed` | gone since the last read, listed once |

Eject refuses (409 `media_device_busy`) while a volume is mounted outside
`/run/mica/media`, mounted in another namespace, held by a mapping, open as a
device node or has an open file; otherwise it unmounts and reports every volume
`ejected`. The device is not powered off.

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
