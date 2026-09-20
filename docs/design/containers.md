# Containers on Mica OS

**Mica OS does not orchestrate containers.** It ships a container engine, turns
`.container` files into systemd units, and gives you one switch to turn the
whole capability off. What runs, in what order, how containers reach each
other and what survives an update are yours to describe — in systemd's terms,
not in a mica-specific format.

This document is the integrator's guide to doing that. Every example below is
extracted by `tests/quadlet-doc-test.sh` and fed to the Quadlet generator this
image actually ships, so an example that stopped working fails the test suite
rather than sitting here looking correct.

---

## 1. What is on the device

| Binary | Path | What it is |
|---|---|---|
| `podman` | `/usr/bin/podman` | the engine. Daemonless — `podman run` forks `conmon`, which execs `crun` |
| `crun` | `/usr/bin/crun` | the OCI runtime |
| `conmon` | `/usr/libexec/podman/conmon` | per-container monitor |
| `quadlet` | `/usr/libexec/podman/quadlet` | the systemd generator |
| `netavark` | `/usr/libexec/podman/netavark` | networking |
| `aardvark-dns` | `/usr/libexec/podman/aardvark-dns` | container-to-container name resolution |
| `catatonit` | `/usr/libexec/podman/catatonit` | container init, for `--init` |
| `docker` | `/usr/bin/docker` | a symlink to `podman`, so the docker command line works |

Versions are pinned as the `git` rows of `mica-podman:locks/upstream.lock`
(the package ships a copy as `/usr/share/mica-podman/upstream.lock`) and built
from upstream source, not taken from Debian. `podman --version` on the device is the authority.

The `docker` name is a symlink and nothing else. `docker run ...` is
`podman run ...` with the same flags, the same output and the same behaviour;
podman reads `argv[0]` only to name itself, so `docker --version` answers
`docker version 5.8.6` and the usage text says `docker`, and no mode is selected
by the name.

What the name does **not** bring is anything Docker keeps behind its socket:
there is no daemon, no `/run/docker.sock` and no REST API here, so a client that
dials the socket rather than running the binary is no better off. `docker
compose` fails the way `podman compose` does — `Error: looking up compose
provider failed`, because podman shells out to a compose provider and neither
`docker-compose` nor `podman-compose` is on the device. Compose files are not
this image's way of describing a set of containers; section 3 is.

There is **no `podman.socket` and no `podman.service`**. The REST API is not
built into this image, so there is no engine socket to secure — and nothing to
connect to if you were expecting one.

## 2. The switch

`container.enabled` in the management settings tree, `false` by default. It is
read and written through APID, which calls micad's validated `GetSettings` and
`SetSettings` methods. micad exports no system Item1 projection, and
`mica-mqttd` admits only application packages enrolled by exact direct
`com.mica.<class>[.<suffix>]` name, with `com.mica.micad` structurally forbidden,
so container enablement has no MQTT read or write path. `mqtt.enabled` is kept
on the same management side for the same reason: a system lifecycle switch is
not application data.

Turn it on from the Services page in the built-in SPA at `/_ui/`, or through the
same API route. Automation uses a bearer token; a signed-in browser session is
also accepted and its mutations carry the session's CSRF header:

```
curl -X PUT -H 'Authorization: Bearer <token>' -H 'Content-Type: application/json' \
  --data 'true' https://<device>/api/v1/settings/container.enabled
```

False means **nothing runs**: `/etc/containers/systemd` is not mounted, so it
is the empty directory inside the read-only root, the generator finds no files,
and no container unit exists.

> **Containers on this device run as root.** Rootless mode is not built, so a
> container is not confined to an unprivileged user. Anything that can write a
> `.container` file into the Quadlet directory can run code with root's
> capabilities on this appliance. That is what the switch gates, and why it is
> off by default.

## 3. Where files go

`/etc/containers/systemd` — a bind of `/mnt/data/state/quadlet` in protected DATA
state, so what you put there survives a reboot **and an A/B update**.

That path is not a choice; it is where Quadlet looks. Its search list, printed
by `quadlet --dryrun` itself:

```
/run/containers/systemd  /etc/containers/systemd  /usr/share/containers/systemd
```

After adding or changing a file:

```
systemctl daemon-reload      # re-runs the generator
systemctl start web.service  # or reboot
```

Generators run at boot and at every `daemon-reload`, and **only then**. A file
copied into place changes nothing until one of those happens — the file is
there, the unit does not exist, and nothing reports a problem.

## 4. One container

<!-- quadlet: web.container -->
```ini
[Unit]
Description=Web frontend

[Container]
Image=docker.io/library/nginx:1.27
PublishPort=8080:80

[Service]
Restart=always

[Install]
WantedBy=multi-user.target
```

`web.container` becomes `web.service`. The `[Install]` section is what makes it
start at boot; without it the unit is generated and simply never runs.

**Use a tag, or better a digest.** `nginx` alone resolves through
`unqualified-search-registries` in `/etc/containers/registries.conf` and
`nginx:latest` means a different image next month. On a device that boots
unattended, a fully-qualified reference with a digest is the only form that
means the same thing at every boot:

```
Image=docker.io/library/nginx@sha256:...
```

## 5. Two containers that talk to each other

Put them on a network. Quadlet turns a `.network` file into a unit the same way.

<!-- quadlet: app.network -->
```ini
[Network]
NetworkName=app
Subnet=10.89.0.0/24
```

<!-- quadlet: db.container -->
```ini
[Unit]
Description=Database

[Container]
Image=docker.io/library/postgres:17
Network=app.network
NetworkAlias=db
Environment=POSTGRES_PASSWORD_FILE=/run/secrets/pg
Volume=pgdata.volume:/var/lib/postgresql/data

[Install]
WantedBy=multi-user.target
```

<!-- quadlet: api.container -->
```ini
[Unit]
Description=API
Requires=db.service
After=db.service

[Container]
Image=docker.io/library/alpine:3.21
Network=app.network
Exec=sh -c "until nc -z db 5432; do sleep 1; done; exec /app/server"

[Install]
WantedBy=multi-user.target
```

**`api` reaches `db` by the name `db`.** That is `aardvark-dns`, which serves
names only to containers on the same network — a container on the default
network cannot resolve `db`, and neither can the host.

### `After=` is not "wait until it is ready"

`Requires=db.service` and `After=db.service` order the *units*: systemd starts
`db.service`, waits for it to report started, and then starts `api.service`.
For a container, "started" means the container process was created. Postgres
inside it has not finished initialising.

This is the single most common way a two-container setup fails, and it fails
intermittently — fast enough on a warm boot, too slow after a power cut. The
`until nc -z` loop above is in the example for that reason: **the readiness
check belongs to the client**, because only the client knows what ready means.
`Notify=healthy` plus a `HealthCmd` is the other way, and it moves the same
knowledge into the server's unit rather than removing the need for it.

## 6. Persistence

<!-- quadlet: pgdata.volume -->
```ini
[Volume]
VolumeName=pgdata
```

A named volume lives under the graph root, which on this device is
`/mica/containers/storage`. The `/mica/containers` mount binds DATA/containers,
with independent project 102 accounting and no byte/inode limit. Images, writable
layers, named volumes and Netavark definitions stay inside this namespace;
`/mica/containers/tmp` holds image download temporary files in the same namespace;
`/run/containers/storage` holds volatile engine state. Container storage does
not consume the `/var` budget. The Quadlet source mount requires container
storage before exposing application units, preventing startup on an unmounted
container backing directory. [Storage policy](storage.md#capacity) defines the
shared capacity and the bounded variable-data project.

**The graph root's `nosuid` and `nodev` are a default, not a boundary**
*(user ruling, 2026-09-20)*. They look like hardening and are not: the engine
is rootful, so anyone who can run `podman` is already root and can run
`--privileged` or mount the graph root elsewhere without them
([access](access.md) section 2). The options **stay exactly as they are**, in
`mica-system-base`'s `mica-containers.mount` and `mica-podman`'s
`storage.conf`, and the note is what the record is for:

- **nobody removes them as useless** — removing them changes what containers
  can do, which is a behavioural change made for no reason;
- **nobody tightens them believing they are a boundary** — the next reader of
  `nosuid,nodev` on a container graph root will assume a threat model that
  does not exist here, and will either add `noexec` for consistency or strip
  the lot as theatre. Both are wrong for the same reason.

**The mount checks stand, and their reason is uniformity rather than
confinement.** If `noexec` were ever set on DATA on one board, containers
there could not execute anything out of the graph root and the bind could not
remove it — a container behaving differently on one board with an identical
kernel configuration. That is the functional half of the user's other rule,
*uniform behaviour unless the kernel cannot support it*. And the check belongs
on the **booted guest** rather than on the `fstab`: a bind cannot weaken the
underlying mount, so the effective set is DATA's options composed with the
bind's, and only the guest has both
([harness](build-harness.md) section 4).

Two consequences worth stating plainly:

- **Container, system and user data are unlimited.** They share DATA capacity
  with independent project accounting; filling DATA can affect other writers.
- **`/var` has its own bounded budget.** Container storage stays in
  `/mica/containers` and does not consume that quota. See [storage](storage.md).

For a bind mount of a host path, use one under `/srv`:

<!-- quadlet: logger.container -->
```ini
[Unit]
Description=Log collector

[Container]
Image=docker.io/library/busybox:1.37
Volume=/srv/appdata/logs:/logs:Z
Exec=tail -F /logs/app.log

[Install]
WantedBy=multi-user.target
```

## 7. Logs and health

`log_driver = "journald"` is set in `/etc/containers/containers.conf`, so
container output goes to the journal:

```
journalctl -u web.service -f
```

The journal is volatile under `/run/log/journal`. Export diagnostics needed
across reboot; container stdout is not a permanent audit store.

Writing `LogDriver=journald` in the unit says the same thing where the reader
of the unit can see it, and pins it against a later edit to `containers.conf`.

Section 5 ended on the readiness problem and named the other answer to it: a
health check the *server* carries, so that its clients do not each have to
implement one. This is that answer.

<!-- quadlet: gateway.container -->
```ini
[Unit]
Description=Field gateway

[Container]
Image=docker.io/library/caddy:2.10
LogDriver=journald
Notify=healthy
HealthCmd=/usr/local/bin/healthcheck
HealthInterval=30s
HealthTimeout=5s
HealthStartPeriod=20s
HealthRetries=3
HealthOnFailure=kill

[Service]
Restart=always

[Install]
WantedBy=multi-user.target
```

`Notify=healthy` is the key that changes what "started" means. The generated
unit is `Type=notify` and podman is run with `--sdnotify=healthy`, so systemd
does not consider `gateway.service` started until the check has passed once. A
unit declaring `After=gateway.service` then genuinely waits for the
application, which is exactly what section 5 said `After=` on its own does not
give you.

The other keys are the check's shape, and each of them decides something on an
appliance nobody is watching: `HealthStartPeriod=` is how long a slow first
start is forgiven before failures count, `HealthInterval=` and `HealthRetries=`
together are how long a wedged application takes to be noticed, and
`HealthTimeout=` bounds a check that hangs instead of failing. A check with no
timeout, on a device with a stuck disk, is a check that never reports.

`HealthOnFailure=kill` is the one that connects the check to the restart:
without it, an unhealthy container is *marked* unhealthy and goes on running,
because `Restart=always` restarts a unit whose container exited and an
unhealthy container has not exited. With it, podman kills the container, the
unit fails, and `Restart=always` starts it again.

## 8. A dedicated user, a named device, and ceilings

What a field workload needs beyond an image is unit keys, and there is no
mica-specific layer over any of them.

<!-- quadlet: sensor.container -->
```ini
[Unit]
Description=Serial sensor reader
ConditionPathExists=/dev/ttyS3

[Container]
Image=docker.io/library/python:3.13-slim
User=10001
Group=10001
AddDevice=/dev/ttyS3:/dev/ttyS3:rw
NoNewPrivileges=true
DropCapability=ALL
ReadOnly=true
Volume=/srv/sensor:/var/lib/sensor:Z

[Service]
Restart=always
CPUQuota=40%
MemoryHigh=192M
MemoryMax=256M
TasksMax=128
IOReadBandwidthMax=/dev/mmcblk0 8M
IOWriteBandwidthMax=/dev/mmcblk0 4M

[Install]
WantedBy=multi-user.target
```

### The user

`User=` and `Group=` become podman's `--user 10001:10001`. One value each:
Quadlet concatenates the two keys, so `User=10001:10001` written together with
`Group=10001` generates `--user 10001:10001:10001` and reports nothing.

That uid is inside the container and, because this engine is rootful and this
unit asks for no user namespace, the same uid on the host. It reduces what the
*application* can reach. It does not turn the container into a boundary:
podman still runs as root, and section 2's warning is unchanged — whoever
wrote this file chose the uid, and could as easily have omitted it.

`NoNewPrivileges=true` and `DropCapability=ALL` are what make the reduction
stick past an `exec`, and `ReadOnly=true` leaves the image's own filesystem
immutable so the single writable path is the one mounted at `/var/lib/sensor`.

### The device

`AddDevice=` names one node and becomes `--device /dev/ttyS3:/dev/ttyS3:rw`.
It is a name, not a class: there is no pattern form, and no way to say "every
serial port". A node that is absent when the container starts is a start
failure rather than an empty grant — which is what `ConditionPathExists=` in
`[Unit]` is for. On a board where the device is optional, the condition skips
the unit instead of failing it, and `systemctl status` says which of the two
happened.

Device names are board facts, and `/dev/ttyS3` here is an example. Take the
node from the board's own dossier — [../boards/cx3576.md](../boards/cx3576.md)
is the worked one — and
prefer a stable udev name over a numbered one wherever the board provides one.

### The ceilings

`[Service]` keys reach the generated unit untouched, and the generated `podman
run` carries `--cgroups=split`, which puts the container's cgroup inside the
unit's own. These are therefore kernel controllers over the container, not
advice to it:

| Key | What the kernel does with it |
|---|---|
| `CPUQuota=40%` | `cpu.max` — 40% of one core, throttled |
| `MemoryHigh=192M` | `memory.high` — reclaim pressure, the warning shot |
| `MemoryMax=256M` | `memory.max` — the OOM killer, not a warning |
| `TasksMax=128` | `pids.max` — the bound on a fork bomb |
| `IOReadBandwidthMax=`, `IOWriteBandwidthMax=` | `io.max`, per block device |

`MemoryHigh=` below `MemoryMax=` is the pair worth setting together on a
device whose job is to keep running: the first throttles an application that
is growing, the second is what happens when throttling did not help.

The two `IO*` keys take a **device path**, and a path that does not exist on
the board is a line systemd logs and then skips — the unit starts, unlimited,
and the only evidence is in the journal. `/dev/mmcblk0` is the eMMC on the
cx3576; check the board before copying it.

**A ceiling is only a kernel controller if the controller is compiled in, and
a controller that is not compiled in is not a weaker limit — it is a file that
does not exist.** `podman run --memory=512m` against a kernel without
`CONFIG_MEMCG` does not round the limit off: there is no `memory.max` to
write, and the run fails at the write. So this section is true only of an
image whose kernel carries the controller, and the rest of it says which
images those are.

**A capability measured from a build output is a statement about a pin, not
about a board.** The table below was read from
`mica-build:_out/boards/<board>/kernel/config` — the kernel inside the
products that repository builds, which comes from the board releases
`mica-build:locks/` names — and every cell was then re-read here from the
config **committed at each pinned release** (`97aca03d` for both UEFI boards,
`48d995b1` for `cx3576`, `a15dbf8c` for `s905x5m`). A symbol in `mica-boards`'
tree at `main` and a symbol in a running kernel are different claims and
neither settles the other: the second follows the first only after a board
release **and** a re-pin. The release is therefore part of the measurement and
is written beside it, because a reader given two such measurements without
their subjects concludes that one of them is wrong.

**To bound — not uniform today, and the asymmetry is inherited rather than
chosen.** Measured in the products built from the board releases pinned on
2026-09-20 (`uefi-x64` and `uefi-arm64` at `20260916-0857`, `cx3576` at
`20260917-1007`, `s905x5m` at `20260919-2259`):

| Controller | File | `uefi-x64` | `uefi-arm64` | `cx3576` | `s905x5m` |
|---|---|---|---|---|---|
| `CGROUP_PIDS` | `pids.max` | yes | yes | yes | yes |
| `CFS_BANDWIDTH` | `cpu.max` | **no** | **no** | yes | yes |
| `MEMCG` | `memory.max` | **no** | yes | yes | yes |
| `BLK_DEV_THROTTLING` | `io.max` | **no** | **no** | **no** | **no** |

Of the five ceiling keys this section promises, one was real on every board
and one was real on none.

**That table is history since 16:28, and the dates on it are why both it and
what follows can be true.** The pinned releases are now `20260920-1536` on all
four boards, and those kernels carry `MEMCG`, `CFS_BANDWIDTH`,
`BLK_DEV_THROTTLING` and `PSI` **on every board** — read by `mica-build` from
`_out/boards/<board>/kernel/config` after deleting that directory and
re-fetching. Verified here for the two UEFI boards, whose recorded configs
carry all four at `main`; the two FIT boards commit a vendor input, so that
half rests on the re-fetched measurement rather than on anything in the tree.
The table above describes what shipped **until** the re-pin. The `MEMCG` column is not a decision anybody made about
`uefi-x64`: `mica-boards`' own floor records the cause — arm64's `defconfig`
carries `MEMCG` and `x86_64_defconfig` does not, and nothing ever compared
that floor against what the products declare. Two upstream defconfigs
disagreeing, inherited.

`mica-boards` put `MEMCG` and `CFS_BANDWIDTH` into the shared container floor
at `04e0fae` and `BLK_DEV_THROTTLING` at `3970753b` (both 2026-09-20), so
`common/kernel/mica-required.fragment` — the board-independent baseline every
board merges and asserts against its final `.config` — now requires all three
of every board. **That reaches a device only through a board release and a
re-pin, and at the time of writing neither has happened**: the newest release
of every board is exactly what `locks/` names, so there is nothing to re-pin
to, and the chain is *four board releases, then a re-pin, then a product that
carries `memory.max`*.

**So the same symbol has a different answer at every rung of the ladder
between the requirement and the running kernel**, and there are four rungs,
not two:

| Rung | What it is | `BLK_DEV_THROTTLING` today |
|---|---|---|
| `common/kernel/mica-required.fragment` | the **requirement**: merged into every board's config at build time, and every `=y` line asserted against the resolved config afterwards | set, for all four boards |
| `boards/uefi-x64,uefi-arm64/kernel/config/…` | a **recorded resolved output** — those two boards have a `make kernel-config` target that re-records the file from the build, so a divergence is a defect their gate catches | set, re-recorded with the floor |
| `boards/cx3576,s905x5m/kernel/config/…` | a **vendor input** — no such target exists; the file is a starting point the floor is merged into, and there is nothing to re-record | not set, and it is not expected to be |
| `_out/boards/<board>/kernel/`, then the `/boot/config-*` the image ships | the **build tree and the shipped artefact** | absent from every board release pinned today |

**The two middle rungs are not comparable objects, and a reader who compares
them cell by cell gets a defensible wrong answer** — which is the exact
failure this table exists to prevent. The proof is in the file: `cx3576`'s
committed config says `# CONFIG_SECURITY is not set` while the kernel it ships
has it on. For a **vendor input** that is normal, because the floor and the
board's own configure step run after it; for a **recorded output** the same
line would be the defect the `uefi` gate exists to catch.

**And the last rung has a staleness hazard the third one hides**, measured in
`mica-boards` and written into `common/kernel/kernel-config-test.sh`:
`_out/boards/<board>/kernel/` is an *input* to image assembly, so a tree that
already holds one is not rebuilt, neither the config test nor the
post-`olddefconfig` loops run, and both stay green over a kernel compiled
before the fragment they are checking — *an `Image` from 2026-08-31 rode every
image built for the following week while the fragment gained dm-crypt, the
eBPF, firewall and bridge floor and two `NF_*` symbols*. Where that bites was
then measured rather than reasoned: not in `mica-boards`' CI, where a run with
a warm cache still ran the config stage and refused, but wherever such a tree
**persists across a fragment change and is consumed rather than rebuilt** —
image assembly, and a developer's working tree. The table above was measured
at that third rung, which is the right one for *what does the product being
built contain* and the wrong one for *what does the requirement promise*.

None of the four is stale and none contradicts another, so **every wrong
answer a reader takes from them is defensible** — worse than a stale number,
because a stale number can be caught by a date and a defensible wrong answer
can be caught by nothing except naming the artefact. The question *does this
board have `io.max`* is not well posed without naming the rung.

**Which instrument reads which rung** is the other half, since an instrument
reading rung one says nothing about rung four: `docs/world-claims.tsv` reads
rungs one and two and `mica-build`'s pins; `mica-build`'s own table was read
from the build tree; the session probe reads a running system, which is
downstream of the shipped artefact — though for the three limit files it was
reading the root cgroup and therefore nothing (below). **The top rung is unguarded for the symbols this section is about — and it
was guarded until 2026-09-09.** None of the **61** files under
`mica-build:verify/src/` mentions `/boot/`, checked here by reading every one
of them rather than by grepping for a name, and the two places that do read a
kernel configuration are `build/src/kernel-package.ts`, over the kernel
**component**, and `rootfs/compose/compose-install.sh`, over
`/boot/config-<release>` in the composed root. Both assert the boot and verity
floor: `DM_INIT`, `BLK_DEV_DM`, `DM_VERITY`, `SQUASHFS`, the trusted keyring,
the watchdog. **Neither names a container-limit or netavark symbol, and
nothing in either repository asserts anything from `mica-required.fragment`
against a shipped artefact.** So for `MEMCG`, `CFS_BANDWIDTH`,
`BLK_DEV_THROTTLING` and their neighbours the **committed inputs are the only
end** — which is also why the stale-build-tree hazard above escapes
everything: nothing downstream of the build would notice.

**It is a regression from a cleanup rather than a rung nobody built**, and
that reads differently: somebody built it, so the mechanism is known to be
possible and its cost is known. `mica-build` reports that
`verify/src/checks-kernel.ts` was 748 lines, read `/boot/config-*` out of the
packed root and asserted the floor — `VETH`, `NFT_FIB_INET`/`IPV4`/`IPV6` with
the netavark reasons, `BPF`, `BPF_SYSCALL`, `BPF_JIT` and `CGROUP_BPF` with
the crun citation, `NF_TABLES` and the firewall family — and that it was
deleted on 2026-09-09 in `1875d133`, the same commit as `checks-display.ts`.
**So the `mica-boards` comment citing it was accurate when it was written.**

*(That citation cannot be checked from here, and saying so is part of
recording it: `1875d133` answers 422 at `origin`, because `mica-build`'s
history is rooted at `a5f1e36` — a parentless commit of 2026-09-14 — and the
deletion predates the root. It is read from that repository's local clone and
taken on its authority. **A line number and a commit is checkable only if the
commit is fetchable**, so a citation into pre-root history has to carry its
own unreachability or the next reader gets a 422 and concludes the claim is
false.)*

**What closes it is one source rather than a restoration.** The deleted file
carried **its own copy** of the symbol list, with a comment saying it was the
same set the shared fragment pins, so restoring it verbatim would rebuild the
private copy — the thing two of these records already call a defect. The
approved shape instead: `mica-boards` publishes the fragment as a **file row
of the board bundle**, and `mica-build` asserts `/boot/config-<release>`
against the fragment **from the pinned board release**. One source, fetched at
the pin, no copy — and the assertion then moves with the pin, which is the
same distinction the rest of this section is about.

That is worth reading beside the warning above it, which is careful and true
and one level too high: a missing **device path** is logged and skipped, but
the reason IO is unlimited on every Mica board is that the **controller is
absent**, which produces no journal line at all. A correct warning about the
near cause is exactly what stops the next reader from looking for the far one.

**To run — uniform, and measured.** Overlayfs, the user, pid and net
namespaces, seccomp filtering, veth, the bridge, the pids controller, the
device cgroup and `CGROUP_BPF` are set on all four boards. This half is no
longer an assumption: on 2026-09-20 a session probe booted a product image and
ran a container **with no flag at all**, from inside the running system, for
the first time in this project's history. So the section now says which of its
claims are measured — *a container runs* is measured, while *a ceiling is a
kernel controller* was an assumption until the same week, and one fifth of it
was wrong. A document that says which of its claims are measured is worth more
than one that is uniformly confident.

**To firewall — the one category anybody had decided about, because it had
already broken.** `cx3576` once shipped without `NFT_FIB_*` and every bridged
container failed;
`mica-build:tests/netavark-kernel-config-test.sh` now asserts the symbols
netavark programs rules against, on every board config, and requires each
board's post-`olddefconfig` loop to name the same symbols so that a silently
dropped symbol fails the kernel build. The other categories have no gate and
no failure yet, and that is the only difference between them.

**To measure — a scatter that has since been decided, and the test that
decided it is the transferable part.** In the pinned releases it is scattered:
`PSI` on `s905x5m` alone, `TASKSTATS` and `CGROUP_PERF` off on `cx3576` alone,
`BLK_CGROUP_IOCOST` on two of four. Nobody chose `y` on one board and `n` on
another — the defconfigs differed. At `main` it is no longer a scatter but a
decision, taken by asking of each symbol **whether a unit key a product can
set, or a podman flag, reaches the file it creates**: `ManagedOOMSwap=` and
`ManagedOOMMemoryPressure=` reach `/proc/pressure`, so `PSI` is on for all
four; `IOWeight=` reaches `io.weight`, which `blk-iocost` registers, and
`IODeviceLatencyTargetSec=` reaches `io.latency`, so `BLK_CGROUP_IOCOST` and
`BLK_CGROUP_IOLATENCY` are on for all four; nothing a product can set reaches
`io.prio`, `hugetlb.*`, `rdma.max`, `misc.max`, `net_prio.ifpriomap`,
`net_cls.classid`, delay accounting or a `perf_event` cgroup, so the floor
**asks** for those to be off rather than leaving them `y` on two boards by
accident. An arbitrary per-board split is the one answer that is wrong
whichever way the symbol goes, because nobody chose it.

**And *asks* is the word, because a fragment's `# CONFIG_X is not set` is a
request and not a fact.** kconfig turns a symbol back on the moment something
enabled `select`s it, and the floor's **positive** lines are asserted against
the resolved config while its **negative** lines were never asserted against
anything, on any board. Measured here at 16:00 on 2026-09-20, across the two
boards whose resolved output is recorded: of the nine symbols the floor asked
to be off, **eight were off on both and one was not** — `uefi-x64` carried
`CONFIG_CGROUP_NET_CLASSID=y`, because `CONFIG_NET_CLS_CGROUP=y` in the x86_64
defconfig selects it and the arm64 defconfig does not have it, while nothing
in the floor mentioned `NET_CLS_CGROUP` at all. **Two boards, one floor line,
and the answer differed because of a file neither repository wrote.**

**And the result is the eight rather than the one.** A floor that never
asserted its negative lines was **right eight times out of nine by luck**, and
nothing in the output distinguishes the eight from the one: they are not
eight decisions that held, they are eight coincidences that happened to match
a decision. The same argument as a branch that always passes being a
measurement — the file cannot say which of its lines were granted, and neither
can anybody reading it.

So **every *off* in this section is a different kind of claim from every
*on***, and the page had been presenting them as the same kind: `y` was
asserted against the resolved config, `is not set` was a line in an input that
nothing checked. That is the input-versus-output distinction this section
draws twice already, arriving a third time **inside a single file**.

*(The exposure was the claim rather than the behaviour: `CGROUP_NET_CLASSID`
is cgroup v1 `net_cls`, which a v2-only system cannot reach — compiled in and
unreachable.)*

**Repaired at `mica-boards` `8e6c3ba` (2026-09-20 16:04Z), four minutes after
this was written, and the repair is the mechanism rather than the symbol**:
the floor now names the **selector** off — `# CONFIG_NET_CLS_CGROUP is not
set` — because a selected symbol cannot be switched off directly, and
`uefi-x64`'s recorded config carries both off. The missing loop landed with
it: for every `# CONFIG_X is not set` line in either fragment, the board's
kernel build refuses if the resolved config holds any `CONFIG_X=` line, **and
refuses again if it read zero off-lines**, so a loop that asserts nothing
cannot pass. Its own precision is worth copying: it asserts *no line turns it
on* rather than requiring the literal `is not set`, because a symbol whose
dependencies are unmet does not appear in a resolved config at all — **absence
and an explicit off are both off, and only one of them is a line.**

**A line that reads as a decision and is not granted cannot be wrong in a way
anybody notices**, which is the same shape as a citation nobody can resolve
and an assurance nobody can test, now in kconfig. `uefi-arm64`'s board
fragment held nineteen more of them — the display-trim helpers `DRM_PANEL`,
`DRM_BRIDGE`, `EXTCON`, `NVMEM`, the PHYs — left behind after that board
learned the mechanism the expensive way: **a helper cannot be switched off,
you have to name off the drivers that select it**. Deleted rather than
restated in the same commit, because a request a file cannot grant is not a
record of a decision.

**And deleting them was re-recorded rather than reasoned about, which is the
only reason a silent regression was caught**: one of the nineteen was **not
inert**. `CONFIG_MDIO_BCM_UNIMAC` went `m` to `y` when its request was
removed, because **a modular selector leaves kconfig free to answer `m`** —
the request had been refused as *off* and honoured as *not built in*, and
nothing said which. **A fragment edit is not an outcome**, and the difference
between an approved deletion and a measured one is a symbol that changed
state.

**And `m` is only the second of four answers a request cannot tell apart.** A
symbol the floor asks to be off can come back `=y`, come back `=m`, be
explicitly off, or **not be mentioned at all** — `CGROUP_HUGETLB` appears
nowhere in `s905x5m`'s 8382-line vendor input, neither granted nor denied,
decided at `olddefconfig`. The request has one form and the outcome has four,
so **`is not set` has been doing duty for several different states all
along**, and which one it meant was never readable from the file. That is the
*a value that cannot express **not measured*** rule in a new place: the line
cannot say *unmentioned*, cannot say *modular*, and cannot say *absent because
its dependencies were unmet* — and a reader cannot tell those from *decided
off*.

*(The same distinction bounds what the two FIT boards' numbers mean.
`s905x5m`'s **vendor input** carries six of the nine requested-off symbols
`=y` — `BLK_CGROUP_IOPRIO`, `CGROUP_RDMA`, `CGROUP_MISC`, `CGROUP_NET_PRIO`,
`CGROUP_PERF` and `TASKSTATS`, measured at `mica-boards` `8e6c3ba`;
`cx3576`'s carries none, and a seventh — `CGROUP_HUGETLB` — is not in that
file at all. That is a statement about an input the floor is merged into
afterwards, **not** about either board's kernel: their resolved configs are
not in the tree, so what the new loop finds there is the first reading anybody
has of it. *A claim about a kernel from a measurement of an input* is the same
trap this section is about, one artefact further down.)*

**And the floor states the distinction this section needs everywhere:
`PSI` on is the capability; running `systemd-oomd` and setting those keys is a
policy the kernel does not decide and does not enable.** A capability makes a
bound *possible*; something else has to make one *exist*.

**Container storage is bounded, and the chain crosses three repositories** —
no single one of them can state it:

- `mica-core` mounts DATA `rw,noatime,prjquota` as PID 1, before systemd
  exists, from a literal on the single code path that mounts it — reading
  nothing from the product, profile, board, kernel command line or signed
  policy, and constrained by an allowlist of five permitted data mount options.
- `mica-system-base` then assigns project IDs and sets limits on the mounted
  filesystem (`chattr -p +P`, `setquota -P`), after growfs.
- `mica-build`'s session probe observes the result from inside a booted guest:
  `findmnt /mica/containers` reports
  `ext4 rw,nosuid,nodev,noatime,prjquota,mb_optimize_scan=0`. The container
  store is a bind of DATA and binds share a superblock, so the option is
  DATA's seen through the bind — which is why no product declaration mentions
  `prjquota`, and why reading the container mount's own declaration would
  never have found it.

Read those three with the capability-and-policy split, because the word
*bounded* spans it: `prjquota` makes a quota **possible** and is what the
first and third bullets measure; the project-id assignment in the second is
what makes a bound **exist**. `mica-core` declined to write the conclusion
from its own tree for exactly that reason, and it was right to.

**This one is uniform for a stronger reason than agreement: nothing varies.**
One literal, one code path, no input from the product. A measurement of one
product would normally be a measurement of one product; here the other three
cannot differ.

**Four hours is how long the dated sentence lasted, and it did not go stale
quietly.** The six claims this section was given in `docs/world-claims.tsv`
that morning were written *expecting* to flip, and two of them flipped the
same afternoon: the `world` job went red on the commit that happened to be
pushed after `3970753b`, naming both boards and the exact line. **The gap
between a document being wrong and somebody noticing was one CI run**, against
four days for the last defect this corpus found by hand — and the neighbouring
`board-pin.*` rows stayed green throughout, correctly, because nothing about
what ships had changed. A claim written to fail is worth more than a claim
written to hold.

**Two instruments now watch this section and neither can answer the other's
question.** The `world` job reads another repository's `main`: the
`io-throttling.*` and `memcg.*` rows say what the **next** board release will
carry, the `board-pin.*` rows what the products being built carry **today**,
and no row of it can reach a build output.
`mica-build:tests/session-probe/probe.sh` reads the
machine, which is the right **shape** for the second question — and until
2026-09-20 it was not answering it. **The product side of this section is
currently unanswered, and the instrument that looked like the answer was
reading the root cgroup.** It tested `/sys/fs/cgroup/cpu.max` and
`/sys/fs/cgroup/memory.max`; in cgroup v2 the **root** never carries
`cpu.max`, `memory.max` or `io.max` — those files exist in a cgroup whose
parent has enabled the controller in `cgroup.subtree_control` — so *absent* is
true on every Linux system ever built, with or without `MEMCG`. A reader who
finds one instrument and assumes it covers the other gets the wrong answer in
both directions, and here the second instrument was not covering its own
question either.

**And the product column has an answer: three of the five ceilings are
enforced, measured inside a running product.** From a booted `uefi-x64-prod`
guest built on `20260920-1536`, `podman run --memory=64m --cpus=0.5
--pids-limit=42` returns `memory.max=67108864`, `cpu.max=50000 100000` and
`pids.max=42` — 64 MiB exactly, half a CPU exactly, 42 — answers only a kernel
with `MEMCG` and `CFS_BANDWIDTH` can give. That is the far end of a chain that
began at 08:35 the same day: the fragment, four board releases at
`20260920-1536`, a re-pin, an artefact, a running product, with the release
configs read from `_out/boards/<board>/kernel/config` **after deleting the
directory and re-fetching** — which is what makes them a measurement of the
released artefact rather than of a build tree that was already there.

**`io.max` stays a kernel-config claim, and the reason is this section's own
warning.** No IO limit was passed, because an `IO*` key needs a **device
path** — the thing logged and skipped when it does not resolve. A row left
half-open is worth more than a row filled with a third thing that looks like
evidence.

**The check that produced those numbers had a third defect, found by the
experiment designed to falsify it rather than by an accident.** Run against a
product built from the **old** pins — `uefi-x64` at board release
`20260916-0857`, whose fetched config carries `# CONFIG_MEMCG is not set` —
podman failed outright, `crun` reporting *open `memory.max` for writing: no
such file or directory*; the variable then held that error text, and the CPU
case ran over the string and printed a **pass**. **A verdict about a string
that was never a cgroup file.** The repair is the empty-parse rule in the one
place it had not arrived: not a gate that extracted nothing, but **a verdict
pronounced on a value never obtained — a run that did not happen has no
ceilings to report.**

**And the near-miss is worth more than the defect.** The suite was red only
because the **memory** branch happened to fail first; had that kernel carried
`MEMCG` and lacked only `CFS_BANDWIDTH`, the same run would have been **green
with a false pass — on the exact experiment designed to prove the check could
tell two worlds apart.** **A correct verdict reached by an accident of
ordering is indistinguishable from a correct verdict**, which is the
eight-of-nine shape again: nothing in the output separates the luck from the
judgement. *(The corrected file — `mica-build` `81005ea6`, *one verdict per ceiling, and
none of them read if the run failed* — was then run against both worlds. On
the **old** pins, `uefi-x64` at board release `20260916-0857` with
`# CONFIG_MEMCG is not set` confirmed in the fetched config before the build,
it **fails**: 10 pass, 1 fail, `crun` naming the cause. On the **new** pins it
**passes**, 12 claims, with the numbers above. **The same file, no injected
defect, two products this workspace built and published pins for.**)*

**And the line added to make a wrong answer legible paid for itself as
evidence**: the probe prints the root cgroup's `available:` list beside its
verdict, and `memory` is **absent** there on the old kernel and present on the
new. An unplanned second reading of the same fact, from a format rather than
from a reader.

**What let version 3 answer what two versions could not is that it stopped
testing a path.** *Does `/sys/fs/cgroup/cpu.max` exist* was never a question
anybody had; *does `--cpus=0.5` reach the container* is the sentence this
section writes and the thing an integrator does. **Neither earlier mistake was
reachable from a check written against the document's own promise** — a proxy
has a gap the promise does not have, and both wrong versions lived in it.

*(The subject of that measurement had a location before it had a value, and
the location moved while this paragraph was being written. At 16:24 the re-pin
`49c7aed6` answered **422** at `origin` and `locks/pins/` still named the old
four, so the reading was true of the machine that took it and not reproducible
from `origin`; by 16:28 the push had landed and all four pins read
`20260920-1536`. Both sentences were right when written, four minutes apart —
which is the third resolution of one question in a single evening: **working
tree versus commit, commit versus `origin`, local branch versus `origin`.**
The rule is not *check whether it is pushed*; it is that **a claim's subject
has a location, and the location is part of the claim.**)*

**What the earlier mistake does not touch is what the table rests on.** The
kernel-config measurements were read from
`mica-build:_out/boards/<board>/kernel/config` and were never the probe's:
`uefi-x64` genuinely had no `MEMCG` and genuinely has it at `main` now. The
config measured it; the probe only looked as though it did. The table, the pin
rows, the release rows and the re-pin chain stand, and **every sentence saying
a booted guest confirmed one of the three files is gone from this page.**

**A repair landed and a measurement did not move, which is how it survived.**
Two instruments agreed all evening **for different reasons** — one because the
kernel lacked the controller, the other because the file is never there — and
the agreement read as corroboration to everybody who saw it. The general form
belongs beside the replica rule: **agreement between two instruments is not
corroboration unless they could have disagreed, and one of these two was
constant.** That is the same statement as *a branch that always passes is a
measurement and not an assertion* — which the probe's author wrote, the same
evening, about the **other** branch of the same test, without connecting it to
the branch that was always taken. Those report-both branches are retired now
that the floor is uniform, by the author who wrote the condition: **the absent
branch was a measurement while the floor was incomplete and is a defect
today**, which is a sentence executing itself on the day its condition came
true.

**And the comment above it armoured the mistake.** The probe warned that `cpu`
appears in `cgroup.controllers` on a kernel without `CFS_BANDWIDTH`, *"which
is the identifier that lies"* — true, careful, about the wrong cheap
identifier, and sitting directly above a read of a file that cannot exist
where it was looking. **A reader who sees somebody thinking carefully about
one trap has no reason to check for another**, which is a cost of a good
comment that these records had not priced.

**The repair took three versions in one evening, and the third is different in
kind.** Version 1 read `/sys/fs/cgroup/cpu.max` — a file that can **never**
exist. Version 2 moved into `system.slice`, where systemd delegates what it
manages, and read a file that exists **only if somebody already asked**:
`cgroup.controllers` said `cpuset cpu io memory pids` while
`subtree_control` said `memory pids`, so a kernel with `CFS_BANDWIDTH` looks
identical to one without it at that path, and it would have reported
`cpu.max absent` a second time. **Both versions checked a proxy for the
promise. Version 3 checks the promise**: it runs `podman run --memory=64m
--cpus=0.5 --pids-limit=42` and asks the container what it got —
`memory.max=67108864`, `cpu.max=50000 100000`, answers only a kernel with
`MEMCG` and `CFS_BANDWIDTH` can give, with podman arranging whatever
delegation it needs on the way. **A proxy can be wrong in ways the promise
cannot, and both wrong versions were wrong in exactly that gap.**

**And what caught version 2 was the output rather than a reader**: it printed
`cgroup.controllers` and `subtree_control` **beside** the verdict, so *the
controller is available* and *the file exists* were two visible facts instead
of one collapsed one, and the contradiction was legible inside the round that
introduced it. An instrument that prints what its verdict depends on does not
need the next reader to be more careful. Its author's rule for the pair is the
durable part: **a repair landing while a measurement stays still is a finding
about the measurement.**

**And each instrument says in advance which way it will go red**, which is
what lets a red be read without an investigation:

| What moves next | `io-throttling*`, `memcg*` | `board-release.*` | `board-pin.*` | the session probe |
|---|---|---|---|---|
| a board's committed config changes | the row for that board goes red | green | green | says nothing |
| the four board releases are cut | green | **red** | green | says nothing |
| `mica-build` re-pins the boards | green | green | **red** | says nothing |
| a product built from those pins is booted | green | green | green | answers, once it asks in a delegated cgroup |

The middle row is there because it was missing: the release is a step of the
chain that **no instrument saw**, so a page could have said *the repair has
shipped* on the day the tags were cut and been wrong by a re-pin. The
`board-release.*` rows name the newest tag per board and go red when a board
is released. And if two of these columns ever go red on the same run,
something moved that no row of this table predicts, which is an investigation
rather than an edit.

**The last row fired too, at 16:28 on the same day**: the four `board-pin.*`
rows went red at `20260920-1536` while the `board-release.*` rows stayed green
— **at the re-pin and not at the release**, which is the distinction the two
groups were written to draw. Every row of this table has now been exercised by
the event it predicts, and none of them needed an investigation to read.

**The middle row fired twenty minutes after it was written**, which is the
only test a prediction has: the four boards were released at
`20260920-1536`, those rows went red naming the new tags, and the
`board-pin.*` rows stayed green — at this step and not at the next one,
exactly as the table says. The value is not that the rows noticed; it is that
**the red needed no investigation**, because the table had already said which
event produces this pattern and what it means. **A prediction table
whose rows have all fired is no longer a design; it is a measurement of the
chain it was written about.** A gate that says beforehand
which way it will fail converts an alarm into a reading.

**Nothing requires any of this.** A `.container` file with no `[Service]`
section at all is accepted, generates a unit with no ceilings, and Mica OS adds
none. There is no admission step between a file appearing in the Quadlet
directory and a unit that can take the device down. Ceilings here are the
integrator's discipline, not a platform guarantee, and this document is the
only thing asking for them.

## 9. Images: digests, credentials, rollback and data

**Mica OS does not update your containers.** There is no `podman-auto-update.timer`
in this image; that unit is not built. Pulling a new image, restarting the unit,
and deciding when that is safe are the integrator's, and the reason is the same
one that makes Mica OS's own updates A/B and signed: an update that can happen
without a decision is an update that can happen at the wrong moment.

`/etc/containers/policy.json` ships as:

```json
{ "default": [{ "type": "insecureAcceptAnything" }] }
```

**Read that literally: image signatures are not verified.** What protects a
pull is TLS to the registry and, if you use one, a digest reference. This is
upstream's default and Debian's, and Mica OS keeps it because Mica OS has no way to
distribute your signing keys — but it is a decision, not an oversight.

Tightening it is a **build-time** act rather than a device edit. `policy.json`
and `registries.conf` are inside the verity-sealed root, so a `signedBy` policy
(`containers-policy.json(5)`) and the key it names arrive in a new image —
through a `.deb` producer or the rootfs overlay — and reach the fleet in a
signed A/B update. Only `/etc/containers/systemd` is writable on a running
device, and it holds unit files, not policy.

### Pin by digest, and start from what you verified

<!-- quadlet: private.container -->
```ini
[Unit]
Description=Vendor application

[Container]
Image=registry.example.com/acme/app@sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
Pull=never

[Service]
Environment=REGISTRY_AUTH_FILE=/var/lib/mica/containers-auth.json

[Install]
WantedBy=multi-user.target
```

Two keys, each closing a different hole.

`Image=...@sha256:...` is content rather than a name. A tag is a pointer
somebody else can move, so `nginx:latest` and even `nginx:1.27` are promises
about a label; a pull by digest is the only form where what arrives is checked
against what was asked for. The digest above is a placeholder — take yours from
`podman image inspect --format '{{.Digest}}'` or `podman images --digests`,
against the image you actually qualified.

`Pull=never` becomes `--pull never`: the unit runs the image already on the
device, or it does not start. On an unattended appliance that converts "the
registry was unreachable at 03:00" and "somebody moved the tag" from a silent
change in what runs into a unit that failed and said why. Load the image
first, deliberately:

```
podman pull registry.example.com/acme/app@sha256:<digest>
podman images --digests
```

An image moved as a file — `podman save` here, `podman load` on the device —
arrives with no signature, and whether it keeps its registry digest depends on
the transport. `podman images --digests` is how you find out, and `Pull=never`
makes a reference that does not match a refusal to start rather than a pull
nobody asked for.

### Registry credentials

`podman login` writes a credentials file. Say where, because the default for
root is under `/run` — a tmpfs, gone at the next boot:

```
podman login --authfile /var/lib/mica/containers-auth.json registry.example.com
```

`/var/lib/mica` is a bind of DATA/state, so the file survives a reboot and an A/B
update. The unit points at it with `Environment=` in `[Service]`, which is the
environment of the `podman` process and not of the container:
`REGISTRY_AUTH_FILE` is read by podman itself. `[Container]`'s own
`Environment=` would put the variable inside the container, where nothing
reads it — the two keys have the same name and different meanings.

**This is not a secret store.** The file holds the registry username and
password base64-encoded — encoded, not encrypted — readable by root, which is
what everything on this path already runs as. Mica OS does not create it, rotate
it, back it up, or know that it exists, and nothing removes it when the unit
that used it goes away. If a credential must not sit at rest on the device,
the answer is a short-lived one installed with each update, not a different
file mode.

### Rolling an application back

There is no rollback command, because there is no update command. The
mechanism is the digest:

1. Record the digest running today. The device will not remember it for you.
2. `podman pull` the new digest, and edit `Image=` to it.
3. `systemctl daemon-reload && systemctl restart app.service`.
4. To go back: edit `Image=` to the previous digest and repeat step 3.

Step 4 works **only while the previous image is still on the device.** The
generated `ExecStart` carries `--rm`, which removes the container and not the
image — but `podman image prune` and `podman system prune` remove the
now-untagged previous image, and after that a rollback needs the registry
again. On a device that may be offline when it goes wrong, keeping the
previous image *is* the rollback plan.

### Data does not roll back with the image

Rolling `Image=` back to the previous digest restores the code. It does not
restore the volume. If the new version migrated its schema on first start —
and most do, silently, because that is what an application does when it finds
an old database — then the previous version is now pointed at data it does not
understand, and the failure arrives after the rollback appeared to work.

That contract is the integrator's to make and to test, and Mica OS holds no
opinion about it. What Mica OS gives you is the two halves being separable: the
image is content-addressed and replaceable, and the volume is on DATA under
`/mica/containers/storage`, where `podman volume export` before an update is a
backup you can restore afterwards. The system update path has a health gate
and an automatic A/B rollback ([../user/update-rollback.md](../user/update-rollback.md));
the container path has neither, and nothing on this device watches an
application to decide whether its last update went well.

## 10. What to check when something does not start

| Symptom | Where to look |
|---|---|
| the unit does not exist | `systemctl daemon-reload`; then `/usr/libexec/podman/quadlet --dryrun` prints parse errors |
| unit exists, never started | no `[Install]` section, so nothing wants it |
| `unable to execute nft` | should not happen — `nftables` is in the image; report it |
| container starts, then exits 0 | the `Exec=` finished. A container is not a service because it is in a unit |
| name does not resolve | the two containers are not on the same `.network` |
| storage full | `podman system df`; check `/srv` against the UI bundles sharing it |

## 11. What Mica OS will not do for you

Restated because it is the whole shape of this document: no compose file, no
dependency resolution beyond systemd's, no health-based restart orchestration,
no image update policy, no secret store. If you need those, they are ordinary
systemd and podman features and this document has shown where each attaches.

The reason is not minimalism. An orchestrator is a second thing that decides
when your application runs, and Mica OS already has one — systemd — that the rest
of the device is built on. Two would have to agree.
