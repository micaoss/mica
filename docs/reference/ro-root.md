# Authenticated immutable root

The root filesystem is a SquashFS image followed by an explicitly described
no-superblock dm-verity tree. Root and support each have an independent root-hash
signature and complete geometry bound by the deployment envelope.

## Boot

UEFI authenticates a UKI through systemd-boot; U-Boot authenticates a FIT
where the board's boot trust requires it (`qemu-armhf` and `ssd202d` say
`bootTrust: none` and check the FIT's hashes only). The signed initramfs
contains `mica-runkit` and the signed boot policy. Running as its PID 1, it
authenticates the selected descriptor, locates SYSTEM (a partition, or UBI
volumes), creates signature-required verity mappings, mounts root/support
read-only, composes the core set's components over `/usr` and `/etc` as
read-only overlays, opens DATA, seals the owner keyring, maps the driver
extensions and binds matching modules and firmware before the root's init
(systemd or OpenRC) starts.

The kernel's built-in content anchors authenticate PKCS#7 root-hash signatures.
No unsigned retry, editable root geometry, alternate early-init or old-layout
reader is part of the normal boot path. Metadata keys also come from the signed
kernel policy. Full artifact hashes are checked during installation and offline
verification; normal boot does not scan all image bytes before mounting.

Modified content is rejected when its block is read. Boot confirmation requires
all health checks, but does not claim that every unused block has been read.
Failure of a shared SYSTEM or DATA filesystem requires explicit recovery; it is
not cured by cycling all deployment attempts.

## Root ownership

Root owns userspace. Kernel modules, DTBs, boot binaries and firmware are packaged
by independent producers. Root contains empty support mountpoints so the selected
support image can be bound before udev. An updated root does not implicitly
replace its kernel or loader, and an updated kernel reuses a compatible signed
root through a newly signed deployment association.

## Writable paths

See [storage](storage.md) for physical ownership, service binds, quotas and reset
semantics. DATA/var is bound over the whole `/var` tree and accepts new service
directories under a byte/inode project limit. `/var/tmp` shares that budget.
The remaining root stays on read-only SquashFS; `/run` and `/tmp` are volatile.

Machine identity is durably established under DATA/state before the init and
bound read-only at `/etc/machine-id`; D-Bus resolves the same identity. Invalid
or symbolic identity files are refused rather than silently regenerated. The
random seed uses a fixed symlink to DATA/state/random-seed, outside the general
var quota. Seeding and unit dependencies ensure var and the protected target
exist before random-seed IO.

## Shutdown

On systemd, the runkit's `shutdown` is the exit ramdisk: systemd pivots there
to stop userspace, and it releases the verity, loop and DATA mappings and the
backing SYSTEM in dependency order before it powers off or reboots. The UEFI
products have full-runtime shutdown evidence, and the gate rejects incomplete
loop/DM teardown rather than treating the final poweroff line alone as
success. An OpenRC root and a UBI board have no exit ramdisk: the init leaves
DATA read-only and reboots.

## Checking it

| Check on the device | Expect |
|---|---|
| `cat /run/mica/boot.json` | `contentVerified: true`, the running `deploymentId`, `rootfsId` and `kernelId` ([boot](boot.md#11-checking-a-boot)) |
| `grep ' / ' /proc/mounts` | a `squashfs` mount with `ro` |
| `touch /usr/x` | `Read-only file system`: write under the [writable paths](storage.md#the-write-map) instead |
| `cat /etc/machine-id` | the same id across reboots; changed only by a factory reset |

A root whose verity check fails at a read returns an I/O error to the reader.
When that keeps the health gate from passing, the deployment is not confirmed,
and after its three attempts the loader boots the fallback
([updates](updates.md#confirmation-failure-and-rollback)).
