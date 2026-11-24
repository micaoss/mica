# Troubleshooting

Diagnosis on Mica OS follows one order: get access, identify exactly what is
running, read the evidence the system already keeps, and only then act. This
page follows that order, and ends with the bounded, redacted snapshot that
carries that evidence into a support case.

## 1. Getting access

In order of preference:

1. **The API and built-in UI** — the console on port 8080 (HTTPS on 8443 once
   it is turned on). Its System → Help tab has guides for the common faults (a
   failed update check, a failed offline import, an unsynchronized clock, a
   WireGuard tunnel with a handshake and no traffic) and links this
   documentation. Live network
   observation (carrier, addresses, DNS, routes per interface) is part of the
   API surface, which makes "the device thinks its network is X" readable
   without a shell.
2. **SSH** — off by default (on from the first boot on the cloud products and
   `uefi-x64.base`); an authenticated administrator enables it and
   installs a key through the API (or, as root on the device, `mica ssh on`
   and `mica ssh keys add <file>`). Every authorized key is a root key. For an
   operator standing at a device with no key installed, the transient root
   password (set through the UI, valid until the next boot) is the intended
   one-session path.
3. **The serial console** — present on cx3576 (`ttyFIQ0`, 1500000 baud) and
   shows a login prompt, but no account accepts a credential until a transient
   root password has been set. It is primarily useful for *reading* the boot:
   firmware deployment decisions and kernel output appear there.

The full access model, including what each channel can and cannot do, is
[../reference/access.md](../reference/access.md).

> status: shipped — evidence: `docs/reference/access.md`, `mica-core:crates/mica-apid/openapi.json`

> status: board-dependent — evidence: `mica-build:boards/cx3576/board.env`

## 2. Identifying the device and release

`GET /api/v1/system/info` answers the device's identity in one authenticated
read: machine id, board model and the firmware source it was read from,
kernel release, the `os-release` fields, the system version carrying the
package pool's git stamp and the build date, the daemon's own version, the
installed package set, the running signed deployment with its component identities and boot
status, and uptime. Every member says whether it was available and, when it
was not, why — a package manifest whose Mica OS rows disagree reports the
disagreement and every stamp it found rather than picking one. Quote that read
in every support case.

`GET /api/v1/system/telemetry` adds the board's thermal zones, watchdog
devices and a reset reason classified from generic kernel evidence;
`GET /api/v1/network/status` adds what networkd, wpa_supplicant and resolved
observe right now, which is the answer to "the device thinks its network is
X". In a shell, `mica status` prints the same facts at a glance (board, running
system and core set, update state, uptime, addresses, time, DATA usage), and
each one that could not be read says why:

```sh
mica status          # one line per fact; --json for the five answers
mica update          # the running system, the update state and its refusal
mica network         # one line per interface: state and addresses
mica time            # synchronized or not, the server, the offset
mica web status      # where the API listens
```

`/usr/share/mica/manifest.tsv` is the same bill of materials
the API reads, and `hostnamectl` gives the hostname (which encodes the first
eight hex characters of the device id) and the machine id.

**The support summary** is the read to paste into a case first:
`GET /api/v1/system/support-info`, or the copy and download buttons on the
console's Information, Diagnostics and Help tabs. It carries the board, kernel,
product and component versions, the running deployment, uptime, the time zone
and synchronization, the integrity items, DATA's readiness and space and the
last update failure's code, and leaves out the machine id, host name, network
names and addresses, codes, credentials, logs and settings. **The integrity
card** (`GET /api/v1/system/integrity`) sums up, from
the same answers, whether the boot, the deployment and the storage are as they
should be.

**Hardware-dependent, and unvalidated.** What the thermal, watchdog and
reset-cause adapters report has been proven against fixture trees, not against
the cx3576 or uefi-x64 boards. An absent or implausible reading there is an
escalation carrying the board identity, never a green result.

> status: shipped — evidence: `docs/reference/diagnostics.md`, `mica-core:crates/mica-apid/openapi.json`, `mica-core:docs/mica-core.md`

## 3. Reading the evidence

- **Service logs:** the console's System → Diagnostics tab reads a service's
  log of this boot or of the previous one (`GET /api/v1/system/logs/{source}`,
  `?boot=previous`). The log is kept on DATA across boots by default; on the
  UBI boards (`qemu-armhf`, `ssd202d`) it is in RAM only, and the Logging
  section can change either, cap its size or forward it to a collector.
- **Service state:** on systemd, `systemctl status <unit>`,
  `systemctl is-system-running` and `journalctl -u <unit>`; on OpenRC,
  `rc-status`.
- **An expected kernel message.** `watchdog: watchdog0: watchdog did not stop!`
  appears at every boot, by design: the boot hands the running watchdog to
  the init without stopping it. It is not a fault. Which watchdog the root
  feeds is named in `/run/systemd/system.conf.d/50-mica-watchdog.conf`
  (systemd) or `/run/mica/watchdog.env` (OpenRC), and the console shows the
  runkit's `mica-init: watchdog<N> handed over with a <set>s timeout` line.
- **A trial boot that reboots on its own** about `confirmS` after power-on
  (600 to 1800 s by board) was not confirmed by its deadline. The deadline's
  lines are in `journalctl -b -1 -u mica-trial-deadline` on systemd and in the
  kernel log on OpenRC (`mica-trial-deadline: ...`, in `logread` once
  `mica-klogd` runs); the health gate's lines say what it was waiting for. On
  OpenRC a boot hung inside a runlevel is rebooted by the kernel 15 s after
  the deadline ([boot](../reference/boot.md#the-trial-deadline)).
- **Boot health:** the health gate logs its required set, each member's
  verdict, and every failed unit it saw (`journalctl -u mica-health`). A deployment
  that keeps falling back after an update failed one of the required members —
  the boot transaction settling, micad answering, or apid listening — and the
  log names which. A failed unit on its own does **not** cause a fallback; it
  is reported at live-state `health.units` and read with `GET
  /api/v1/state/health` or out of a diagnostic snapshot. What the gate requires
  is `/etc/mica/health.conf`, inside the read-only root.
- **Update state:** `mica update` (or `GET /api/v1/update`) is the
  management view: the lifecycle state, what is available, a pending reboot
  and the last refusal. `mica-deploy status` reports the deployments under it:
  current/candidate/fallback, attempt state, component verification and failed
  deployments. Capture both.

- **Containers:** `mica container list` shows every project's containers and
  their phase and health, and `mica container logs <project>/<service>` a log; a
  project the check refused is refused by the write that carried it, with
  every problem named, and storage running full shows in `podman system df`
  or `docker system df` ([../integrate/containers.md](../integrate/containers.md)).
  `mica container list` and `logs` work on either engine.
- **Configuration writes:** a settings write returns a task; its outcome
  (applied, unchanged, failed and why) is observable through the API rather
  than guessed from behaviour.

> status: shipped — evidence: `mica-system-base:payload/usr/lib/mica/mica-health`, `docs/integrate/containers.md`, `mica-core:crates/mica-apid/openapi.json`, `mica-core:docs/mica-core.md`

## 4. When a normal command is missing or broken

The image carries one emergency binary, `/usr/bin/busybox`, and it changes
nothing else: there are no applet links anywhere in the image, no PATH entry was
added, and every GNU command resolves exactly where it did before. Reach an
applet by naming it —

```sh
busybox sh
busybox ls -l /mica
busybox mount
busybox --list          # every applet this build offers
```

— and that is the whole interface. If a repair genuinely needs the applets to
look like ordinary commands (a script that calls `ls` when coreutils is the
thing that is broken), create the links **transiently** and put only that
directory on that one shell's PATH:

```sh
mkdir -p /run/mica-toolbox
busybox --install -s /run/mica-toolbox
PATH=/run/mica-toolbox:$PATH busybox sh
```

`/run` is tmpfs, so the links are gone at the next boot and nothing outside that
shell ever sees them.

**Never build a persistent link farm.** The root is a read-only dm-verity
squashfs, so writing one into `/usr/bin` fails anyway; it is refused where it
would succeed because an applet name in PATH silently re-decides what `ls`,
`tar`, `mount` and `sh` mean for every script on the device, and BusyBox applets
take fewer options and differ in behaviour from their GNU counterparts.

**Diagnostic only, and not a rescue environment.** These applets are not a
supported command API: no unit, script or automation on the device may depend on
them, and the image verification asserts that none does. The binary is
dynamically linked against the same libc as everything else, so a system damaged
badly enough to lose `/lib` has lost this too — at that point the answer is
[recovery.md](recovery.md), not a shell.

> status: shipped — evidence: `mica-system-base:debs/mica-busybox`, `mica-build:src/verify/checks-busybox.ts`, `docs/reference/recovery.md`

## 5. Reading build and verify refusals

A field operator meets the build system in two places: producing a bench image
and verifying a flashed one. Mica OS tooling refuses loudly and by name instead of
degrading, so the refusal text is the diagnosis:

- A missing or stale package pool, a missing BSP artifact, or a pool built
  from a different commit each name the exact `make` target to run; the
  build-failure table in [`mica-build:docs/design/image.md`](https://github.com/micaoss/mica-build/blob/main/docs/design/image.md) maps the
  common messages to actions.
- `make os-verify` (and the uefi-x64 equivalent) checks an assembled image
  against the image contract check by check; a red check names what it read
  and what it expected. An image built on a generated trust root verifies like
  any other; the keyring check states which grade of material it read, and that
  sentence is what to quote when the grade is not the one expected.

The rule of thumb: a Mica OS refusal is designed to be quoted verbatim to support
or into an issue; do not work around it, because the checks exist to stop
artifacts that pass everything and fail on hardware.

> status: shipped — evidence: `mica-build:docs/design/image.md`, `mica-build:make os-verify`

## 6. The support snapshot

`POST /api/v1/diagnostics/snapshots` collects one bounded, redacted JSON
document — release and system information, boot and update state, this boot's
warning-and-worse journal excerpt, failed units and tasks, storage and time
status, telemetry and the observed network — and `GET
/api/v1/diagnostics/snapshots/{id}` downloads it as an attachment. The
built-in UI's diagnostics panel does the same two steps, and `mica doctor`, as
root on the device, collects one into the same store and prints its path.

What to know before attaching one to a case:

- **It is bounded, and it says where it was cut.** Collection stops at 20
  seconds and each source at 6; a source that did not answer is present as an
  absent object carrying its reason. Read the collection result first: an
  unavailable section is evidence, not a check that passed.
- **Redaction is a tested boundary.** Credentials, tokens, private keys, Wi-Fi
  secrets, SSIDs, MAC and BSS addresses and the hostname in journal lines are
  dropped or replaced by a sentinel, and nothing under `/srv` or `/home` is
  read at all. IP addresses, routes, DNS servers and the machine id are kept
  deliberately — they are the evidence the snapshot exists to carry — so an
  exported file still identifies the device and its network. Handle it
  accordingly.
- **The device never uploads it.** Export is a download by an authenticated
  client, and collection needs no upstream connectivity. The store keeps at
  most 8 snapshots and 16 MiB, dropping the oldest first, and has no
  time-based expiry: delete one when its case closes.
- **A second collection while one is running is refused**, not queued.

The design record carries the decision trees this page's order implies — no
network, wrong time, DATA full, a failed update or rollback, an unexpected
reboot — each branching on the snapshot member that decides it.

> status: shipped — evidence: `docs/reference/diagnostics.md`, `mica-core:crates/mica-apid/openapi.json`

## 7. When to stop diagnosing

A device in a reboot loop with all deployments exhausted, or one whose credentials
are lost, is past troubleshooting: go to [recovery.md](recovery.md), and
capture what evidence you can first.

## 8. A worked example: an update check that fails

A claimed device whose console says the update check failed. SSH is on with
your key, and the workstation has a token:

```sh
DEV=http://mica-a4e2e69e.local:8080
AUTH="Authorization: Bearer mica_<id>_<secret>"
```

**Identify and read** (sections 2 and 3), on the device:

```sh
ssh root@mica-a4e2e69e.local
mica status                          # board, system, state, network, time, data at a glance
mica update check; echo "exit $?"
# mica update: <reason>
# exit 1
mica update                          # the same reason on its "refused" or "state ... failed" line
mica status --json | jq '.update.lifecycle | {state, code, last_refusal_code}'
# {"state":"succeeded","code":null,"last_refusal_code":"network-offline"}
mica network                         # is there a routable interface?
mica time                            # is the clock synchronized?
journalctl -u micad -b | tail -n 50  # on systemd; the console's Diagnostics tab elsewhere
```

A refusal before anything ran is `last_refusal_code`; a check that ran and
failed is `"state":"failed"` with its `code`. Either is one word from a
closed list, and it decides the next step: `network-offline` and
`network-metered` are the link ([network](network.md)),
`no-source-configured` is the update source ([updates](updates.md) section
3), and `"state":"update-unavailable"` with a `workspace.status` other than
`ready` is DATA ([storage](storage.md)). The full list is in the contract of
`GET /api/v1/update`.

**Collect the evidence** before changing anything (section 6):

```sh
mica doctor
# /mica/diagnostics/<snapshot file>
```

or from the workstation, which also downloads it:

```sh
curl -s -H "$AUTH" -X POST $DEV/api/v1/diagnostics/snapshots | jq '{id: .snapshot.id, sections}'
# {"id":"<id>","sections":{"<source>":"ok", ... }}
curl -s -OJ -H "$AUTH" $DEV/api/v1/diagnostics/snapshots/<id>
curl -s -H "$AUTH" $DEV/api/v1/system/support-info > support-info.json
```

### Check it worked

After the fix, run the check again and read the state:

```sh
mica update check                    # available: system <version>, or: up to date
mica update                          # no "failed" line; a "checked" line with the new time
```

A snapshot is complete when every `sections` value is `ok`; `unavailable` or
`timeout` is evidence about that source, not a pass. Attach the snapshot and
the support summary to the case ([support](../releases/support.md) section 4),
and delete the snapshot when the case closes.

> status: shipped — evidence: `mica-core:crates/micad/src/update_cli.rs`, `mica-core:crates/micad/src/update_lifecycle/snapshot.rs`, `mica-core:crates/mica-apid/src/diag_cli.rs`, `mica-core:crates/mica-apid/src/routes/snapshots.rs`
