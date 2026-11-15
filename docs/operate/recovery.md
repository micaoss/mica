# Recovery

Recovery on Mica OS is **data-preserving first**: the steps below are ordered so
that each one costs more than the one above it, and an operator who reaches
step *n* has established that steps 1..*n*-1 were not enough. Working down the
order is the procedure. Skipping to the bottom because it is the step everyone
remembers is how devices lose data they did not have to lose.

The page is also blunt about the gap in the middle of that order: one of the
steps is built, tested, and **cannot be performed on any board that exists
today**. Section 7 says which, and why, and what an operator does instead.

## 1. Automatic trial fallback

A newly activated deployment has three attempts. Firmware persists the attempt
before launching the candidate. The health gate confirms a healthy deployment;
failed trial boots exhaust the candidate and select the retained deployment.
Root, kernel and support references switch together. DATA is shared and is not
rolled back. A hang also needs a functioning watchdog; physical cx3576 watchdog
coverage remains a board qualification requirement.

> status: shipped — evidence: `mica-core:crates/mica-deploy/src/boot.rs`, `mica-system-base:payload/usr/lib/mica/mica-health`, `mica-build:tests/suites/lifecycle-uefi/updates.sh`

## 2. Exhaustion and shared storage failure

When no deployment remains usable, firmware stops in a defined recovery outcome.
It never refills exhausted counters. cx3576 exposes its local rockusb recovery
transport; the UEFI policy stops with an explicit recovery message. SYSTEM or
DATA mount damage is reported as a shared-storage failure before services start,
not blamed repeatedly on different root images.

Capture the complete serial trace, native status if available, and the exact
image/component IDs. Use a full latest-image reflash when shared storage or every
bootable deployment is unusable. Do not edit counters or import boot commands.

> status: board-dependent — evidence: `mica-build:boards/cx3576/loader/mica-file-boot.c`, `mica-system-base:debs/mica-systemd-boot/persistence.patch`, `mica-build:tests/suites/lifecycle-uefi/faults.sh`

## 3. The decision tree

| # | Step | Available today? | Reversible? | What it costs |
|---|---|---|---|---|
| 1 | read-only diagnosis | yes | yes | nothing |
| 2 | guarded manual rollback | yes | yes | one reboot; the condemned deployment stops being a rollback target |
| 3 | configuration reset | yes | **no** | every modelled setting the tier reaches |
| 4 | application-data reset | yes | **no** | every container with its images and volumes, the user's services and the service accounts; not `/srv`, nothing on a disk mounted in |
| 5 | credential recovery | **no** — unsupported in the field | **no** | the previous credential and every API token |
| 6 | factory reset | yes: the administrator password, or root on the device | **no** | everything on DATA: settings, the claim, keys, containers, `/srv`; and the fallback deployment |
| 7 | whole-disk reflash | yes, with physical access | **no** | every partition, **and the device's identity** |
| 8 | secure wipe | **no** — unsupported, and not planned | **terminal** | the device, as a configured unit |

**Six of the eight are steps you can take.** Step 5 is gated on a physical
presence assertion that **no shipped board can produce**, so it is refused on
every fielded device; step 6 needs the administrator password or root on the
device; step 8 has no
implementation at all. Section 7 states
each absence and what to do instead. An operator who has lost the administrator
password but still has an authorized SSH key logs in as root and sets a new
one with `mica password set`; one who has lost the credential and every key
is recovered by step 7 and by nothing else.

**The line is between steps 2 and 3.** Everything above it can be undone by
rebooting. Everything below it destroys something that was on the device, and
nothing on this page restores it: there is no backup-and-restore contract in
this product, so an unrecoverable step is unrecoverable in the strongest sense
Mica OS currently offers.

> status: shipped — evidence: `docs/reference/recovery.md`

## 4. The reversible steps

### Step 1 — Read-only diagnosis

- **Fixes:** nothing. It decides which step below is the right one, and most
  cases stop here.
- **Costs:** nothing.
- **Does not recover:** a device that does not boot far enough to answer —
  that case is section 2's, not this one.
- **What to read:** `GET /api/v1/update` for the update lifecycle, both deployments,
  the running deployment and whether a rollback is permitted; `GET
  /api/v1/storage/status` for tier readiness and media health; the diagnostics
  snapshot and the audit trail. As root on the device, `mica status`,
  `mica update` and `mica doctor` read the same. [troubleshooting.md](troubleshooting.md) is
  the diagnosis page proper.

### Step 2 — Guarded manual rollback

Use authenticated `POST /api/v1/update/rollback` with the required CSRF token.
The native backend validates the running receipt and retained authenticated
fallback. It marks the running deployment failed, changes boot selection, and
returns the running/target identities and explicit reboot next step. A repeat
request or unavailable/invalid fallback is refused with a reason. As root on
the device, `mica update rollback` makes the same request and names the
target; `--reboot` reboots into it.

The action preserves DATA, including configuration, credentials and application
data. It cannot recover a lost credential or undo persistent writes. Reboot is a
separate action. QEMU covers the real action and subsequent fallback; physical
cx3576 execution remains separately qualified.

> status: shipped — evidence: `mica-core:crates/mica-deploy/src/deployments.rs`, `mica-core:crates/mica-apid/openapi.json`, `mica-build:tests/suites/apid-api/src/phases/07-update-rollback.ts`

## 5. The destructive steps: resets and credential recovery

Every step in this section is **irreversible**. Each is requested by name —
there is no parameterless reset — and each is audited. A reset **stages** an
intent and micad carries it out on the next boot, so the operator's step is two
actions, the request and a reboot, and the device is fully pre-reset until
that boot. An interrupted reset is replayable: the next boot finishes it.

### Step 3 — Configuration reset — IRREVERSIBLE

- **Fixes:** a device made unreachable or unusable by its own network, access
  or policy settings, and any settings state too tangled to unpick.
- **Costs irreversibly:** every modelled setting — network, access, time,
  update policy, all at once — and the HTTPS identity the console was served
  with. There is no per-subtree reset.
- **Keeps:** the claim, the administrator credential and the API tokens — on
  purpose: a settings action that dropped them would be a lockout wearing a
  friendlier name.
- **Does not recover:** a lost credential, application data, a broken
  deployment.
- **How:** `POST /api/v1/reset` with `{"tier": "configuration"}`,
  authenticated, no physical presence needed.

**Read this before you run it: the update settings go back too.** A
configuration reset returns the **update server address** and the update
policy to the values your device's image was built with, discarding any
change an operator made. Which is a recovery route or a surprise depending on
what those built-in values are, and there are only two cases:

- **The image names a server.** The device goes back to that server. If somebody re-pointed the device at a server that turned out to
  be wrong, this is how you undo it without a reflash and without physical
  access.
- **The image names no server** — which is the case for a build whose
  integrator left the address to be set later. The reset does not move the
  device to a *different* server; it moves it to **no server**. The device
  stops checking for updates, silently, and the only routes left are the
  offline import and a reflash. **Check `GET /api/v1/provisioning/status`
  before the reset**: it reports the built-in address, the operator's
  override and the effective value separately, so you can see which case you
  are in.

The same applies to Step 6 (factory reset), which erases every setting, so
the device comes back with the values its image was built with. **Step 4 does not touch these settings** — an
application-data reset leaves the update configuration alone.

**If it is only the address you want back, you do not need this tier.**
`POST /api/v1/update/config` with `{"source": {"url": null}}` returns that one
key to the built-in default and leaves everything else configured — a reset
spends every setting to recover one. See
[updates.md](updates.md).

### Step 4 — Application-data reset — IRREVERSIBLE

- **Fixes:** an application whose own state wedges it or the device, an
  application layer to be handed over clean.
- **Costs irreversibly:** every container with its images, the container
  engine's storage and the volumes under `/mica/volumes`; the user's own
  services (systemd units and OpenRC scripts the operator added); and the
  service accounts, which are built again. There is no backup contract to
  fall back on.
- **Keeps:** `/srv`, which is the user's, and everything on a disk the user
  mounted in, wherever it is mounted (also over container storage): the reset
  clears what is on DATA and never crosses into a mount.
- **Does not recover:** platform settings, credentials, deployments.
- **How:** the same route with `{"tier": "application-data"}`, on the same
  terms. On a Docker product it is refused while `dockerd` runs, since it
  would clear the engine's storage under it: stop the engine first.

### Step 5 — Credential recovery — IRREVERSIBLE, and not reachable today

- **Fixes:** the lockout of an operator who has lost the administrator
  credential and every authorized key — **without losing a byte of operator
  data.** That is why it is ordered here, above the factory reset: it is the
  only step that cures a lockout while preserving everything.
- **Costs irreversibly:** the previous credential stops working at the moment
  the new one is minted, and every API token goes with it. Any automation
  holding one must be re-enrolled.
- **Does not recover:** the previous secret. The flow **mints and never
  reveals** — nothing on this device will hand a stored password back.
- **How, on paper:** `POST /api/v1/recovery/credential`, authorised by
  physical presence and by nothing else. An authenticated caller is refused
  and told to use `POST /api/v1/actions/change-password` instead.
- **Why you cannot do it:** section 7. The flow is implemented and tested, and
  **no shipped board declares a physical recovery action**, so on a fielded
  device it is refused, every time. Treat it as absent when you plan: an
  operator who has lost the administrator credential and every authorized key
  reflashes the whole disk (step 7) and receives a new device identity.

> status: unsupported

### Step 6 — Factory reset — IRREVERSIBLE

- **Fixes:** nothing specific. It is the decision that the device's whole
  configured state is to be abandoned — a device handed to a new owner inside
  your organisation, or a fault that survived steps 3 and 4.
- **Costs irreversibly:** everything on DATA, which is made again (formatted,
  or on a UBI board emptied): the settings, the claim and the administrator
  credential, the API tokens, the keys, the SSH host keys and the machine-id,
  the containers, the user's services, `/srv`, `/mica` and the logs kept on
  DATA. On SYSTEM it removes every other deployment and core set, so there is
  no fallback until the next update, and every driver extension and owner
  certificate.
- **Keeps:** the running deployment and its core set, at their version; the
  update records that describe SYSTEM, which it saves before and restores
  after; the user's own disks, which are not DATA; and the device code, which
  is derived from the hardware. The device comes back **unclaimed**, on its
  factory access point with the label's key, and its next first boot draws a
  new device id, hostname, machine-id and SSH host key (and a new code where
  the product's code is random).
- **Also goes back:** the update server address and policy, to the values the
  image was built with — Step 3's warning applies here unchanged, including
  the case where the built-in address is *none* and the device is left with
  no update server at all.
- **Does not recover:** a lost administrator password where nobody can be
  root on the device, since the console and the API ask for that password;
  a device that cannot boot; a corrupted deployment. Root on the device is
  asked for none, and is better served by `mica password set` than by a
  reset.
- **How:** the console's System page, `POST /api/v1/system/factory-reset` with
  `{"password": "..."}`, or `mica factory-reset` as root on the device. The
  console and the API ask for the administrator password, even from a
  signed-in session, and a wrong one counts in the sign-in backoff.
  `mica factory-reset` asks for no password: it prints what is erased and
  what is kept, then waits for the hostname or `factory-reset` to be typed,
  or takes `--yes`. It is refused on an unclaimed
  device (`not_claimed`), while an update installs (`update_in_progress`),
  while a deployment or core set is on trial (`trial_pending`), and on an
  encrypted DATA (`data_encrypted`). The device reboots after 3 s
  and the reset runs at that boot; an interruption anywhere runs it again at
  the next one. Without micad, `mica-deploy factory-reset --reboot` as root
  stages the same reset ([without micad](without-micad.md) section 7).

> status: shipped — evidence: `mica-core:crates/micad/src/factory_reset.rs`, `mica-core:crates/mica-apid/src/routes/reset.rs`, `mica-core:docs/mica-core.md`, `docs/reference/recovery.md`

### A factory reset does not make a device anonymous

This is the sentence a reader most often supplies for themselves, wrongly, and
getting it wrong ends with a linkable device in somebody else's hands.

**The device code survives a factory reset, and so does the data's trace on
the medium.** The reset draws a new device id, hostname, machine-id and SSH
host key, but the device code is derived from the hardware: it is the same
code on the label, the login prompt and the setup page, and it still derives
the access point's label key. Whoever recorded it before the reset recognises
the device after it. And making DATA again writes a new filesystem over the
old one, it does not erase the blocks: the first boot after it discards DATA's
free space where the filesystem and the medium allow it, which is not a
certified wipe, and on UBIFS or a card without TRIM it does not happen at
all.

So a factory reset is **not** a disposal operation. **A device leaving the
operator's control — resale, return, RMA, disposal — needs the medium
destroyed.** A reflash does not do it either: it writes just the image's own
extent, so blocks DATA grew into beyond it survive on the medium,
unreferenced by the new filesystem but present on it. `docs/reference/access.md`
section 9.2 is the precise statement of what a reflash does and does not
reach, and `docs/reference/manufacturing.md` section 5 is the RMA rule this
follows: a returned device's credentials are treated as exposed from the
moment it is received, because DATA is not encrypted and whoever shipped it
could read it.

If the device is going to another party and its data must not go with it,
destroy the medium. Nothing softer is honest today, and section 6 says why.

> status: shipped — evidence: `mica-core:crates/micad/src/factory_reset.rs`, `mica-core:docs/factory-ap-key.md`, `docs/reference/manufacturing.md`

## 6. Below the OS: reflash and disposal

### Step 7 — Whole-disk reflash — IRREVERSIBLE, and it changes the device's identity

The last resort sits below the OS and is reachable when nothing else is: on
cx3576 the Rockchip loader path (recovery button at power-on, the automatic
fallthrough when boot fails, or maskrom when the loader area itself is gone),
followed by writing the full disk image over USB; on uefi-x64, boot another medium
and rewrite the disk. [../start/install.md](../start/install.md) is the procedure.

- **Fixes:** everything software can be wrong with the device, both deployments
  included. It needs nothing on the device to work.
- **Costs irreversibly:** every partition — ESP/FIRMWARE, SYSTEM and DATA — **and the
  device's identity**: the next first boot mints a new `deviceId` and new
  secrets, and fleet-side records naming the old one must be re-linked by
  hand.
- **Does not recover:** nothing software-wise. But note what it does **not**
  do: it does not erase. See the paragraph above and step 8.

> status: board-dependent — evidence: `mica-build:boards/cx3576/Makefile`, `docs/reference/access.md`

### Step 8 — Secure wipe — TERMINAL, and not implemented

There is no secure wipe on mica. The device cannot express the request: the
reset route has two tiers, the factory reset makes a new filesystem, and
none of them is `secure-wipe`. That absence is the position rather than an
oversight — a wipe promises something about the *medium*, which needs a
device-level erase primitive (eMMC sanitize, NVMe format-NVM) whose real
behaviour on these boards nobody has verified.

**The instruction, until a board has that evidence on file, is to destroy the
medium.** Not reflash it, not fill it with zeros, not run a userspace shredder
over a flash translation layer that was free to write somewhere else.

> status: unsupported

## 7. What an operator cannot do today

Stated rather than omitted, because a reader who assumes these work will plan
a recovery that does not exist.

- **Step 5 is refused on every fielded device.** It is gated on a
  physical-presence assertion. The gate ships and is tested, and so does the
  system side that produces an assertion: a board declares the physical
  recovery actions it has — a bootloader menu entry, a button pattern, a USB
  event — and the device maps the one the operator took into an assertion and,
  where the action says so, a reset tier. **No shipped board declares one** —
  not cx3576, not uefi-x64, not uefi-arm64 — because none has an implemented
  physical action, so the gate
  refuses every request a fielded device can make of it — `403`, with
  `presence_required`, audited, nothing staged, and the refusal says the board
  declares none rather than that nobody is standing at the device. What closes
  this is board support work on a named board, not a change to the flows.
- **The cx3576 recovery button is not a presence assertion.** It drops the
  board into rockusb loader mode and no software recovery flow reads it. There
  is no button-driven recovery in this product.
- **So an operator locked out today has one answer, and it is step 7.** Losing
  the administrator credential and every authorized key still leaves no
  software path back into the appliance: apid is the only thing that can
  enable SSH, add a key or set a password, and it needs the credential or root
  on the device (`mica`, over its local socket), and nobody is root: SSH is
  off or keyless, the transient root password is set only through apid; the serial console shows a login prompt with no account that
  accepts one. That is the position `docs/reference/access.md` section 9.1
  records, and it is still the shipped truth on every board. The way back is
  the whole-disk reflash, paying the device's identity for a forgotten
  password.
- **Secure wipe does not exist**, per step 8.
- **There is no repair tier at all, offline or otherwise.** Mica OS has no
  dedicated non-destructive repair operation: no repair route, no repair flow,
  no rescue boot entry and no recovery environment. What exists on a device that
  still boots is the boot-time layout convergence and filesystem check that run
  by themselves, and ordinary verified updates — which can also reinstall a
  unreferenced damaged component. A device that cannot be restored that way needs a
  service host with its filesystems unmounted, or step 7; **Mica OS does not promise
  that damaged data survives either route.**

> status: unsupported

## 8. Before you recover: collect the evidence

If the device still boots into a retained deployment, capture what
[troubleshooting.md](troubleshooting.md) lists — the journal, the update
state, the storage status, and the device identity from
`/usr/share/mica/manifest.tsv` — **before** you reset or reflash. Every step
from 3 down destroys the fault along with the state, and a support case opened
after a reflash has nothing in it. [../releases/support.md](../releases/support.md) section 4 lists
what a report needs.

## 9. A worked example: a rollback, then a configuration reset

A claimed `uefi-x64.full` device that took an update yesterday
([updates](updates.md) section 11), SSH on with your key, and an API token:

```sh
DEV=http://mica-a4e2e69e.local:8080
AUTH="Authorization: Bearer mica_<id>_<secret>"
```

### Step 1, then step 2: read, and go back one release

```sh
ssh root@mica-a4e2e69e.local
mica update
# system     <new version> (<new id>)
# state      succeeded: The boot health gate confirmed this deployment
mica update rollback --reboot
# rolled back to <previous id, 12 hex>; rebooting
```

Without `--reboot` it says `rolled back to <id>; reboot to run it (or run
again with --reboot)`, and `mica reboot` finishes it. A device that cannot
roll back says why and changes nothing: `rollback is not possible:
candidate_pending`, `running_not_confirmed` or `no_usable_fallback`.

Over the API the same step names its target, so it is refused if the target
changed in between:

```sh
T=$(curl -s -H "$AUTH" $DEV/api/v1/update | jq -r .rollback.target)
curl -s -H "$AUTH" -X POST $DEV/api/v1/update/rollback \
  -H 'content-type: application/json' -d "{\"expectedTarget\":\"$T\"}"
# {"deploymentId":"<running>","target":"<T>","nextStep":"POST /api/v1/actions/reboot"}
curl -s -H "$AUTH" -X POST $DEV/api/v1/actions/reboot
```

**The release you leave is condemned.** It is marked failed, so it is never
installed again; to move forward, wait for the next release
([updates](updates.md) section 6).

#### Check it worked

```sh
curl -s -H "$AUTH" $DEV/api/v1/update | jq .lastRollback
# {"target":"<T>","targetGeneration":<n>,"targetVersion":"<previous version>","outcome":"rolled_back"}
ssh root@mica-a4e2e69e.local mica update
# state      rolled-back: The system is running a retained deployment after a failed update
```

`lastRollback` is reported once, in the first boot after the rollback.
`"outcome":"did_not_take"` names the deployment that booted instead and a
`reason` (`target_failed`, `target_exhausted` or `target_missing`): the
fallback did not come up, and the device is on whatever booted. Read section 2
before going further.

### Step 3: a configuration reset

Here a time zone stands in for settings that went wrong. Read the update
source first, because the reset puts it back to the image's
(section 5, step 3):

```sh
ssh root@mica-a4e2e69e.local mica time zone Europe/Athens
# time.timezone is Europe/Athens
curl -s -H "$AUTH" $DEV/api/v1/provisioning/status | jq .
curl -s -H "$AUTH" -X POST $DEV/api/v1/reset \
  -H 'content-type: application/json' -d '{"tier":"configuration"}'
# {"tier":"configuration","applies":"next-boot"}                     (202)
curl -s -H "$AUTH" -X POST $DEV/api/v1/actions/reboot
```

Nothing changes until that reboot, and a second request before it replaces
the first. `{"tier":"application-data"}` stages step 4 the same way.

#### Check it worked

The reset returns SSH to off and drops its keys with the other access
settings, so check over the API, with the token, which the reset keeps:

```sh
curl -s -H "$AUTH" $DEV/api/v1/settings/time.timezone        # "UTC"
curl -s -H "$AUTH" $DEV/api/v1/settings/access.ssh.enabled   # false
curl -s -H "$AUTH" $DEV/api/v1/claim | jq .state             # "claimed"
```

The device is still claimed and the token still works; everything else is at
its default, and the hostname is the one drawn from the device id again. Put
back what you need (SSH: [SSH](ssh.md) section 1).

No worked example is given for steps 5 to 8: step 5 cannot run on any board
(section 7), step 6 is worked through in the console or with
`mica factory-reset` (section 5) and step 7 is [install](../start/install.md).

> status: shipped — evidence: `mica-core:crates/micad/src/update_cli.rs`, `mica-core:crates/mica-apid/src/update_api/deployment.rs`, `mica-core:crates/micad/src/rollback_outcome.rs`, `mica-core:crates/mica-apid/src/routes/reset.rs`, `mica-core:crates/micad/src/deployment.rs`
