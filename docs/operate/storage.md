# Storage

Mica OS keeps its software and its writable state apart. UEFI boards have
ESP/SYSTEM/DATA; U-Boot boards (cx3576, s905x5m) have FIRMWARE/SYSTEM/DATA;
the raw-NAND boards (qemu-armhf, ssd202d) have UBI volumes `system`, `data` and
one per signed component. Only DATA grows to use the medium. SYSTEM contains
immutable signed deployment files, and firmware remains separate from normal
OS updates. Beyond that, the user's own disks and external media are theirs
(sections 3 and 4).

> status: shipped — evidence: `mica-build:boards/uefi-x64/board.env`, `mica-build:boards/cx3576/board.env`, `mica-build:boards/qemu-armhf/board.env`

## 1. Where files belong

The root is read-only and never written. What a device writes is on DATA:

| Path | Purpose |
|---|---|
| `/mica/config` | Appliance configuration managed through the API |
| `/mica/containers`, `/mica/volumes` | The container engine's storage and the projects' volumes |
| `/srv` | The user's files; no reset opens it |
| `/home`, `/root` | Persistent user homes backed by `/mica` |
| `/var/mnt/<name>` | Where the user mounts their own disks, besides `/srv` and `/home` |
| `/usr/local/etc`, `/usr/local/lib/systemd/system` | The user's own fstab and units, on DATA's state |
| Selected `/var/lib` leaves | Persistent service state on DATA |
| `/var/tmp` | Bounded disk-backed temporary data |
| `/run`, `/tmp` | Volatile per-boot data |

`/mica`, `/srv`, `/var`, `/home` and `/root` are mounted `nosuid,nodev`.
Identity, credentials and service state are stored under physical DATA/state;
update and lifecycle records use DATA/meta. Those namespaces are managed by the
system. Use the API for configuration rather than editing their internal files.

The `/var` parent tree is read-only. Only explicitly supported leaves are
writable; an arbitrary new `/var` directory fails with EROFS. The system log is
kept on DATA across boots, except on the UBI boards, where it is in RAM; the
console's Logging section changes it.

> status: shipped — evidence: `docs/reference/storage.md`, `docs/architecture.md`, `mica-system-base:debs/mica-systemd/payload/etc/systemd/system`

## 2. Capacity and cleanup

All DATA binds share one filesystem. The storage API and the console's Storage
page report its capacity once (`mica status` prints the used and total on its
`data` line), with directory/project accounting and bind
readiness alongside it. On ext4, `/mica` and `/srv`, the disposable cache,
`/tmp` and `/var` (an eighth of DATA, 32 to 256 MiB), and container storage are
separate quota projects, so a bulk or disposable writer cannot take the room
essential state needs. Ordinary services cannot bypass these limits with
`CAP_SYS_RESOURCE`.

A reset tier removes only its allowlisted scope on DATA and never crosses into
a mount ([recovery](recovery.md)). OS rollback does not undo writable
application data. Full reflash replaces the current image contents; it is not
a secure erase of every physical sector beyond the image.

> status: shipped — evidence: `mica-core:crates/micad/src/storage_status.rs`, `mica-core:crates/micad/src/reset.rs`, `mica-system-base:payload/usr/lib/mica/mica-data-layout`

## 3. Your own disks

A disk you attach (a second SATA or NVMe drive, a USB disk) is yours to mount,
at the places that are the user's:

- `/srv` itself, or anything under it. A mount at `/srv` replaces DATA's
  `/srv`, which is kept as it is and comes back when your mount is removed;
- `/var/mnt/<name>` and under;
- `/home/<user>` and under;
- exactly the container engine's root, `/mica/containers/storage` for Podman
  or `/mica/containers/docker` for Docker, to keep images and containers off
  DATA;
- swap, on a disk named by UUID, label or ID, or a file at one of the targets
  above (not `/srv` or the engine roots).

Everything else is refused (`mica-unit: refused mountpoint <path>`), and so is
a bare `/dev/sdX`, `/dev/mmcblkN` or `/dev/nvme*`, which names no disk for
good. The mount options are yours; use `nosuid,nodev`.

**On systemd**, write a `.mount`, `.automount` or `.swap` unit named after its
path, install and enable it with `mica unit`, and reboot:

```ini
# srv.mount
[Unit]
Description=/srv on my data disk
[Mount]
What=/dev/disk/by-uuid/1b2c...
Where=/srv
Type=ext4
Options=nosuid,nodev,noatime
[Install]
WantedBy=local-fs.target
```

```sh
mica unit install srv.mount --enable
```

**On OpenRC**, add a line to `/usr/local/etc/fstab` (devices by `UUID=` or
`LABEL=`; there is no `/dev/disk/by-*`), check it with `mica unit fstab check`,
and reboot. `mica-fstab` mounts the lines at boot, in order; a failing line is
fatal unless it says `nofail`:

```
UUID=1b2c... /srv ext4 nosuid,nodev,noatime 0 2
```

**Moving container storage to a disk.** Mount the disk exactly at the engine
root, as above, while the engine is off; the engine then requires that mount
and does not start without it, so a missing disk fails the engine instead of
filling DATA. Images and containers on DATA's own engine root are not moved.

No reset opens `/srv` or crosses into any of these mounts, and a factory reset
makes DATA again without touching them.

> status: shipped — evidence: `mica-system-base:docs/floor-and-options.md`, `mica-podman:README.md`, `mica-docker:README.md`

## 4. External media

USB sticks and SD cards are listed on the console's Storage page and by
`GET /api/v1/storage/media`. A clean volume of a file system the kernel
carries (vfat, ext2/3/4, and exFAT on every board but `uefi-arm64`) is mounted
read-only, `ro,nosuid,nodev,noexec`, under `/run/mica/media/<id>`; one that
needs repair is left alone. The Storage page unmounts a volume or ejects the
whole device before it is pulled; an eject is refused, naming why, while
anything still uses it. Nothing on a medium is written, and an update archive
on it is imported from the manual update section ([updates](updates.md)
section 4). A board with no USB or SD host (`ssd202d`) reports media as
unsupported.

> status: board-dependent — evidence: `mica-core:docs/mica-core.md`, `mica-build:boards/uefi-x64/kernel/config/uefi-x64.config`, `mica-build:boards/uefi-arm64/kernel/config/uefi-arm64.config`

## 5. Failure

Missing, read-only or damaged DATA/SYSTEM stops the affected boot path for
explicit recovery. The system does not create default credentials on the
immutable root, reset exhausted counters or silently mount a substitute state
directory. Save serial and image/component identities when reporting a failure.

Physical eMMC durability and board recovery require the cx3576 bench tests;
QEMU and offline checks establish only their stated software behavior.

> status: board-dependent — evidence: `docs/reference/boot.md`

## 6. A worked example: `/srv` on a second disk

A claimed `uefi-x64.full` device (systemd) with a second, empty SATA disk,
and SSH on with your key ([SSH](ssh.md)). **Making the filesystem erases the
disk**: check the name twice.

```sh
ssh root@mica-a4e2e69e.local
cat /proc/partitions                 # the new disk, e.g. sdb, with no partitions
mkfs.ext4 -L srvdisk /dev/sdb        # the whole disk, named by its label from now on
cat > /tmp/srv.mount <<'UNIT'
[Unit]
Description=/srv on the second disk
[Mount]
What=/dev/disk/by-label/srvdisk
Where=/srv
Type=ext4
Options=nosuid,nodev,noatime
[Install]
WantedBy=local-fs.target
UNIT
mica unit install /tmp/srv.mount --enable
# srv.mount installed, enabled
mica reboot
```

The unit is named after its path (`srv.mount` for `/srv`), names the disk by
label rather than `/dev/sdb`, and is kept in the device's settings, so it
survives updates and, from core 0.0.9, a configuration reset (0.0.8 and
earlier removed it; [recovery](recovery.md) step 3). Whatever DATA's own `/srv` held is hidden under the mount,
not lost: it is back when the unit is removed.

**On OpenRC** (`mini-x64.basic`) the same disk is one fstab line instead of a
unit:

```sh
echo 'LABEL=srvdisk /srv ext4 nosuid,nodev,noatime 0 2' >> /usr/local/etc/fstab
mica unit fstab check                # prints nothing and exits 0 when accepted
mica reboot
```

### Check it worked

After the reboot:

```sh
grep ' /srv ' /proc/mounts           # /dev/sdb /srv ext4 rw,nosuid,nodev,noatime ...
df -h /srv                           # the second disk's size, not DATA's
mica unit list                       # srv.mount among the services (systemd)
mica status                          # the data line is still DATA's own size
```

| What you see | Why, and what to do |
|---|---|
| `refused mountpoint <path>` at install | `Where=` is not one of the user's places (section 3) |
| `line 1: refused mountpoint <path>` from `fstab check` | the same rule on OpenRC; the line is not applied |
| `/srv` is still DATA's after the reboot | the label is wrong or the disk is absent: `ls /dev/disk/by-label/`, then `journalctl -u srv.mount` |
| OpenRC stops at the mount at boot | a failing fstab line is fatal unless it says `nofail`; add it for a disk that may be absent |

To undo it on systemd: `mica unit remove srv.mount`, then reboot.

> status: shipped — evidence: `mica-core:crates/micad/src/unit_cli.rs`, `mica-system-base:payload/usr/lib/mica/mica-mountpoint`, `mica-system-base:debs/mica-system/control`
