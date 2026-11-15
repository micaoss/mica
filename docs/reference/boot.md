# Boot and the runkit

How a Mica OS device gets from power-on to a confirmed, running system: the
loader that picks a deployment and counts its trials, the signed kernel, the
runkit that builds the system out of signed images before any of it runs, the
health gate that confirms it, and the shutdown that releases it. The contracts
are `mica-core:docs/mica-core.md` sections 6.4 to 6.6 and
`mica-system-base:docs/floor-and-options.md`; the board facts come from each
board's `board.env` and `layout.tsv` in `mica-build`.

## 1. The chain at a glance

```
UEFI boards:   firmware ─▶ systemd-boot (boot counting) ─▶ signed UKI ─┐
U-Boot boards: ROM ─▶ U-Boot micaboot (records, trial count) ─▶ FIT ───┤
                                                                       ▼
  mica-runkit init (PID 1 of the initramfs, no network, no shell)
    verity root + support ─▶ core set ─▶ DATA ─▶ factory reset (if staged)
    ─▶ owner keyring sealed ─▶ driver extensions ─▶ machine identity
                                                                       ▼
  the root's init (systemd or OpenRC) ─▶ services ─▶ mica-health ─▶ confirm
```

| Board | Loader | Kernel image | Boot records | Boot trust | Watchdog armed by the loader |
|---|---|---|---|---|---|
| `uefi-x64`, `uefi-arm64`, `mini-x64` | systemd-boot (`mica-systemd-boot`) | UKI, verified by UEFI Secure Boot where it is enrolled | the loader entries on the ESP | Secure Boot | -- (the runkit arms the kernel's) |
| `cx3576` | U-Boot `micaboot` | FIT with a required signature | two 64 KiB copies in the FIRMWARE partition | `fit` (signed) | yes (`DW_WATCHDOG`) |
| `s905x5m` | U-Boot `micaboot` | FIT with a required signature | two 64 KiB copies in the FIRMWARE partition | `fit` (signed) | yes (`AMLOGIC_MESON_GXBB_WATCHDOG`) |
| `qemu-armhf` | U-Boot `micaboot` from NOR flash | FIT, hashes only | the UBI volumes `records-a` and `records-b` | `none` | yes (`I6300ESB_WDT`) |

Nothing in the runkit knows a board by name: the board is the `board` section
of the signed boot policy, `/etc/mica/boot.json` inside the initramfs and
`/run/mica/boot-policy.json` once the system runs. It names the boot backend
(`uefi` or `uboot-fit`), the kernel format (`uki` or `fit`), the GPT numbers
of the boot partition, SYSTEM and DATA, the firmware target, the record
geometry of a FIT board, and optionally the watchdog, the space `reserves`
kept free (1 MiB to 1 GiB each on SYSTEM, the ESP and DATA), `dataQuotas`,
`bootTrust`, `storage` (`gpt`, the default, or `ubi`) and, on a `gpt` board,
`dataFormat`, the format a factory reset makes DATA with. The policy is
validated before use and the disk is held to its geometry before anything is
written (`mica-core:docs/mica-core.md` 6.4).

## 2. Deployments, records and trials

A **deployment** is one signed descriptor naming a kernel component (the
kernel, its initramfs with the runkit, and its support image of modules and
firmware) and a root component. SYSTEM holds at most two. The boot records
name them and count the attempts left to a deployment on trial:

- **A new deployment starts with three attempts.** The loader decrements and
  persists an attempt *before* it launches anything; if that write fails it
  launches nothing. An entry with no attempts left is never selected.
- **Two record copies.** Every writer changes the inactive copy, so an
  interrupted write leaves either the old copy or the new one whole. A copy
  whose CRC fails, or whose UBI volume cannot be read whole, is invalid and the
  other one holds.
- **The fallback.** When the deployment on trial runs out of attempts, the
  loader boots the retained confirmed deployment. When none is usable, boot
  stops for explicit recovery: counters are never refilled and unsigned
  content is never tried.

| Board family | Where the records live | Format |
|---|---|---|
| UEFI | systemd-boot Type #1 entries on the ESP, with systemd-boot's own boot counting; the pinned loader refuses to launch when it cannot persist the decrement | one entry per deployment, a shared signed UKI per kernel |
| U-Boot, disk | two 64 KiB copies in the raw FIRMWARE partition (cx3576: at 16 MiB and 17 MiB from the start of the disk; s905x5m: at 120 MiB and 124 MiB into the FIRMWARE partition) | CRC-32 of bytes 5 onward in bytes 0–3, a flag in byte 4, then `mica_entries=v1|...` and zeros; U-Boot's redundant-environment rule picks the active copy |
| U-Boot, UBI | the first 65 536 bytes of the volumes `records-a` and `records-b` | the same format; written with an atomic LEB change, never a volume update |

## 3. The loader and the kernel's trust

- **UEFI.** Firmware with Secure Boot enrolled verifies the signed UKI, which
  carries the kernel, the initramfs and the fixed command line. systemd-boot
  selects the entry and counts the attempt.
- **Signed FIT (`bootTrust: fit`, the default).** `micaboot` is a command
  compiled into U-Boot: it reads the records, decrements, then loads a FIT
  whose configuration signature U-Boot checks against the public key embedded
  in its own control device tree. It imports no boot script, no environment
  variables and no editable command line; it sets `/chosen/mica,deployment-id`
  for the kernel.
- **Hash-only FIT (`bootTrust: none`, qemu-armhf).** QEMU hands U-Boot its
  control device tree, so no key can be embedded in it; U-Boot checks the FIT's
  hashes only. The device reports the boot as unverified (`bootVerified`
  false). Everything after the loader still holds: the kernel requires signed
  dm-verity root hashes, and every deployment, set and firmware record is
  authenticated against the policy's keys. What is given up is the chain from
  the loader: someone who can write the flash can replace the kernel, its
  initramfs and the keys in it together.

The kernel runs with `dm_verity.require_signatures=1`: no root, support image,
core component or driver extension is mapped without a root-hash signature it
accepts. The keys are in the kernel, never in a setting
([signing](../security/signing.md)).

## 4. `mica-runkit init`, stage by stage

`mica-runkit` is one static executable; run as `init` it is PID 1 of the
signed initramfs. There is no network and no shell at this stage. In order:

1. **Requires signature enforcement and arms the watchdog.** The watchdog is
   held close-on-exec with NOWAYOUT required, so the exec into the root's init
   closes it unstopped. The kernel's `watchdog: watchdog0: watchdog did not
   stop!` (KERN_CRIT, in `dmesg` and `journalctl -b -p err`) is printed by
   design at every boot; the timer runs until the root feeds it (systemd's
   `RuntimeWatchdogSec`, or the `mica-watchdog` service on OpenRC).
2. **Reads the signed boot policy and authenticates the selected
   deployment**: the descriptor's Ed25519 signature against the policy's keys,
   its board, architecture and product, and the kernel it was booted with.
3. **Maps the support image and the root** as signed dm-verity devices: a
   loop device on a disk board, a `ubiblock` of the static volume on a UBI
   board. Blocks are verified when they are read.
4. **Composes the core components** (section 5).
5. **Opens DATA** (section 7): a LUKS2 header is honoured, an empty encrypted
   DATA is formatted, otherwise DATA is plain ext4 (UBIFS on a UBI board). A
   staged factory reset is carried out here, before the mount. DATA is mounted
   at `/mnt/data` with project quotas unless the board turns them off, and the
   project directories are set.
6. **Seals the owner keyring and maps the driver extensions** (section 6).
7. **Seeds the persistent machine identity** on DATA (`state/machine-id`, made
   once) and binds it read-only at `/etc/machine-id`.
8. **Hands over** to the root's init: systemd, or `openrc-init`.

What the runkit leaves for the running system:

| File | Says |
|---|---|
| `/run/mica/boot.json` | the boot receipt: `deploymentId`, `entry`, `kernelId`, `rootfsId`, `contentVerified`, `secureBoot`, `backend` and `bootVerified` (true with UEFI Secure Boot, or on a FIT board whose trust is `fit`) |
| `/run/mica/boot-policy.json` | the signed boot policy |
| `/run/mica/core.json` | the core set composed (`coreSetId`), `pending` while it is on trial, `paired` when it is on trial with the deployment |
| `/run/mica/trust.json` | `ownerKeyring` (`sealed` or `absent`) and each owner certificate's `state` (`loaded`, `unconfirmed`, `rejected`) |
| `/run/mica/extensions.json` | each driver extension's `state` (`mapped`, `unused`, `refused`) and whether the builds are a change on trial |
| `/run/mica/runkit.json` | what the runkit carries out: `factoryReset`, `factoryResetVersion`, `dataEncrypted` |
| `/run/mica/factory-reset.json` | after a factory reset: `requested`, `formatted`, `unremoved` |

## 5. Core components

micad (with apid and the `mica` command) and the web console are not in the
root: they are **core components**, each a squashfs of its `/usr` and `/etc`
with a dm-verity tree, released in a signed **core set** apart from any
product ([updates](updates.md#core-sets)). At boot the runkit picks the set:

- a set paired with the deployment booting, when that deployment boots;
- else the set the deployment is bound to;
- else it spends one boot on a pending set alone, or composes the current set.

It passes over a pending set it cannot authenticate, select from or find whole.
A set it must compose and cannot, or none at all, stops the boot. It selects
the components whose features meet the product's `FEATURES` (`micad`, `ui`),
maps each as `mica-core-<package>` at `/run/mica-core/<package>`, refuses a
composition that would shadow a file of the root or of another component, and
mounts `/usr` and `/etc` as read-only overlays of the components' trees over
the root's, with no upper layer. The files appear at the paths a package would
have used (`/usr/bin/micad`, `/etc/init.d/apid`, the units and their links).

A component also declares the root interface levels it runs on and the root
packages it needs; a set whose selection does not hold on the root is never
composed over it (`mica-core:docs/mica-core.md` 6.2 and 6.5).

## 6. The owner keyring and driver extensions

The kernel checks every root-hash signature against its secondary keyring: its
builtin keys and, on kernels with the owner keyring (`uefi-x64`, `mini-x64`,
`qemu-armhf`), `.mica_owner`, empty and open until the runkit seals it. The
order is the guarantee:

1. the support image, the root and every core component are mapped while only
   the builtin keys are trusted;
2. the certificates enrolled on SYSTEM (`owner-certs/`) are added; where the
   product's boot policy requires physical confirmation, each one not
   confirmed before is shown on the device's console (SHA-256 and subject) and
   added only if Enter is pressed within 30 s;
3. the keyring is sealed (`KEYCTL_RESTRICT_KEYRING`), whether or not one was
   added; a keyring that cannot be sealed stops the boot;
4. only then are driver extensions mapped: each as `mica-ext-<name>` at
   `/run/mica-ext/<name>`, held to its descriptor and to the running kernel's
   id, release and architecture. Their modules are composed over the support
   image's in `/run/mica-modules`, indexed by the root's `depmod`, and
   `/usr/lib/modules` and `/usr/lib/firmware` become read-only overlays.

An extension that does not map is `refused`, one that maps and does not hold
is `unused`; the boot goes on either way. A factory reset boot loads no owner
certificate and maps no extension ([drivers and owner
certificates](../security/overview.md)).

## 7. DATA at boot

- **Plain.** ext4 on a disk board (UBIFS on a UBI board), mounted
  `rw,nosuid,nodev,noatime` with `prjquota` where quotas are on.
- **Encrypted** (`dataEncryption` in the signed boot policy, off on every
  released product): a LUKS2 header is opened with the first key provider
  that unlocks it (`tpm2`), as the `mica-data` mapping. With encryption on and
  a fresh DATA, the runkit enrols the providers and a recovery passphrase, then
  formats inside the mapping. A header that no provider unlocks refuses the
  boot (`DATA is locked`) and is never formatted again. The console gets one
  `MICA_DATA stage=on|off|locked ...` line.
- **Growth.** On a disk, DATA grows to the end of the disk after the first
  boot; an interrupted grow is replayed by one mount and unmount before the
  real mount. On a UBI board with `ubi.storeReserve`, the empty `data` volume
  is resized once, before its first mount, leaving the store its reserve.
- **A staged factory reset** for the deployment booting is carried out before
  the mount: DATA is made again with the root's own `mke2fs` (on UBI, the
  `data` volume is emptied), the snapshot of `meta/` is restored, and the root
  finishes the reset on SYSTEM at its first start
  ([recovery](recovery.md)).

## 8. Confirmation: the health gate

A trial ends when `mica-health` (in mica-system) confirms. It checks what
`/etc/mica/health.conf` requires: by default the init up and not in
`maintenance` or `stopping`, and micad answering on the bus where the image
carries it (`if-installed=micad`). It does not wait for the network. Then it
runs `mica-deploy confirm`, which makes current whatever this boot was trying:
the deployment, a core set, or a driver extension change. Failed units are
reported, never fatal. On systemd it is `mica-health.service`, with
`mica-boot-failure` on failure; on OpenRC it runs last in the default runlevel,
in the foreground, so its lines reach the console.

A trial that never confirms runs out of attempts and the loader boots the
fallback; a failure before the root runs, with a core set or extension change
alone on trial, is charged to that change, and the deployment is kept.

## 9. Shutdown

- **systemd on x86-64 and aarch64**: systemd execs the runkit's `shutdown` as
  a memory-only exit ramdisk. It releases loops and device-mapper mappings in
  dependency order, and releases storage only once nothing is mounted, mapped
  or looped and no dirty page is left. Each step is one
  `MICA_SHUTDOWN stage=...` console line. A poweroff whose release fails after
  `quiesced` is forced after one bounded `sync`
  (`stage=forced-action`); any other failure ends with `stage=failed` and
  waits for the watchdog's reset.
- **OpenRC** (and every 32-bit board): no exit ramdisk; `openrc-init` reboots
  once the shutdown runlevel has left DATA read-only.
- **UBI boards**: no exit ramdisk whatever the init; the root leaves UBIFS
  read-only before it reboots.

## 10. What can go wrong

| What you see | What it means | What to do |
|---|---|---|
| `watchdog: watchdog0: watchdog did not stop!` at every boot | expected: the runkit hands the armed watchdog to the root | nothing |
| The device boots the previous version after an update | the new deployment did not confirm in three attempts | [updates](../operate/updates.md): read the update state's `lastRollback` and the previous boot's log |
| Boot stops before the root with a policy, signature or geometry error | the image or the disk does not match the signed policy | reflash the image ([recovery](../operate/recovery.md)) |
| `DATA is locked` | an encrypted DATA no key provider unlocks | open it with the recovery passphrase, or reflash |
| A core set refused at boot (the boot goes on with the current set) | the pending set does not select on this root or is incomplete | it waits for a system update; nothing to do |
| A driver extension `refused` or `unused` in `/run/mica/extensions.json` | its signature is not trusted, or it was built for another kernel | upload a build for this kernel ([drivers](../security/overview.md)) |
| `MICA_SHUTDOWN stage=failed` | storage could not be released cleanly | the watchdog resets the board; read the previous boot's log |

## 11. Checking a boot

```sh
cat /run/mica/boot.json          # the booted deployment, bootVerified
cat /run/mica/core.json          # the core set composed this boot
cat /run/mica/trust.json         # owner keyring and certificates
mica-deploy status               # deployments, trials, sets, extensions (JSON)
```

`mica-deploy status` prints the deployments with their trials, the core sets
under `sets.core` and the driver extensions as one JSON object. The runkit's
own console lines start with `mica-init:` (for example `mica-init: persistent
DATA identity ready before system init`).

## 12. cx3576: the signed FIT path in detail

The normal cx3576 boot path is compiled C policy in
`mica-build:boards/cx3576/loader/mica-file-boot.c`. It reads the
three-partition geometry and bounded deployment records, arms the watchdog
before storage discovery, persists a trial decrement, and loads a
required-signature FIT. It imports no commands, boot scripts, environment
variables or editable root command line.

### Development console policy

During system development, preserve the standard U-Boot serial interaction:
`Hit any key to stop autoboot: 1` waits one second, any key enters the native
command prompt, and timeout executes `bootcmd=micaboot`. At the prompt, `boot`,
`run bootcmd`, or `micaboot` resumes the same signed deployment policy. Disabling
this entry requires an explicit user request; a signed-boot or startup cleanup
change must not silently remove it.

The policy is a registered command in the unmodified native main loop, so the
countdown and the CLI are U-Boot's own.

The countdown and CLI precede deployment selection, so entering the console
does not consume a trial. Once `micaboot` starts, it disables Control-C, requires
FIT verification, checks the recovery key, arms the watchdog, and performs the
bounded deployment transaction. Hold the recovery key through the countdown to
enter RockUSB. Native console input waits service the cyclic watchdog scheduler.
Persistent environment commands remain disabled; interactive commands are local
development access and are not a locked production console.

The mandatory RK3576 watchdog uses enabled PCLK_WDT0 and TCLK_WDT0 gates.
A probe or start failure reports its error and enters recovery before media
access or attempt consumption. RockUSB recovery runs the cyclic scheduler while
waiting for USB so an armed watchdog remains serviced. The firmware build tests
the pinned watchdog driver and recovery loop and verifies the control-FDT node.
Physical reset and Linux handoff remain bench acceptance requirements.

### Disk contract

`mica-build:boards/cx3576/layout.tsv` is authoritative.

| Partition | Range | Contents |
|---|---|---|
| FIRMWARE | LBA 64 through 36863 | Loader and both trial-record copies |
| SYSTEM | 18 MiB through 1042 MiB | 1 GiB of immutable kernel/support/root objects and signed deployment envelopes |
| DATA | From 1042 MiB, 256 MiB in the factory image | Persistent state, metadata, user data and bounded disposable namespaces |

The loader starts at byte 32768 and is bounded to 16744448 bytes. Two 64 KiB
record copies start at absolute disk offsets 16 MiB and 17 MiB. Those offsets
are relative to the whole disk; native accesses through partition 1 subtract
its 32768-byte start. The complete reserved region is a GPT partition so DATA
expansion cannot discard loader or record bytes.

The assembler writes two independently authenticated factory deployments.
Current records are strict and bounded to two entries. Each binds deployment
ID, kernel ID, generation and confirmed/trial state. CRC and redundant-copy
sequence handling select a complete copy; malformed fields, duplicate identities
and invalid counters are rejected. Counters are not reconstructed from defaults
when both records are unusable.

### Selection and confirmation

A trial begins with three attempts. The firmware decrements and persists an
attempt before loading the candidate. A persistence/readback failure prevents
launch. Exhausted records are not selected. Healthy userspace confirms only its
authenticated running deployment through `mica-deploy`; no early systemd service
silently blesses it.

After bounded failed trials, the retained usable deployment is selected. When
none remains, boot stops for explicit recovery. Shared SYSTEM/DATA failures are
reported as storage recovery failures, not repaired by resetting counters or
trying unsigned content. Confirmation and garbage collection authenticate all
retained descriptors before removing anything they protect.

FIT verification uses the public keys embedded in the shipped U-Boot control
FDT. The signing workflow extracts that FDT from the actual produced loader and
checks required configuration signatures over kernel, DTB and initramfs. The
key set supports explicit overlap and old-key removal. Production policy has no
persistent environment command-import route.

Machine identity is generated once on authenticated physical DATA before
systemd and bound read-only at `/etc/machine-id`. Trial records are not an
identity database.

### Build and recovery

Build the board's signed-policy loader with `make cx3576-uboot-mica`
and explicit public boot signing inputs; kernel content trust is supplied
separately. `bin/bun.sh src/cli.ts components` packages the signed FIT, firmware,
root, deployments and complete factory disk with explicit inputs.

Full-image flash preflight checks the current GPT and loader placement before
any USB write. Readback compares the complete flashed image before reset.
Independent firmware maintenance is an explicit offline operation described in
[release signing](../security/signing.md); it does not enter the ordinary deployment
catalog and does not perform irreversible enrollment.

### Acceptance

The current loader, FIT signatures, strict record parser, native transaction
faults, full-image verifier and real DATA growth test have software evidence.
Dirty SYSTEM snapshots were read by the pinned U-Boot sandbox; a missing
uncommitted candidate requires bounded fallback. These results do not establish
physical eMMC durability.

On the local bench, record exact image/component IDs and serial output across
healthy boot, three failed trials, attempt persistence failure, pre-userspace
hang/watchdog reset, shared storage recovery and power cuts at destination
writes, sync, activation, decrement and confirmation. cx3576 physical acceptance
remains open until those observations exist.
