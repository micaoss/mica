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
| 4 | application-data reset | yes | **no** | all operator data in `/srv` and every application's data under `/mica` |
| 5 | credential recovery | **no** — unsupported in the field | **no** | the previous credential and every API token |
| 6 | factory reset | yes, on an image built with core 0.0.4 | **no** | everything configured: settings, the claim, keys, applications and operator data |
| 7 | whole-disk reflash | yes, with physical access | **no** | every partition, **and the device's identity** |
| 8 | secure wipe | **no** — unsupported, and not planned | **terminal** | the device, as a configured unit |

**Six of the eight are steps you can take.** Step 5 is gated on a physical
presence assertion that **no shipped board can produce**, so it is refused on
every fielded device; step 6 needs the administrator password and an image
built with core 0.0.4; step 8 has no implementation at all. Section 7 states
each absence and what to do instead. A device whose operator has lost the
credential and every key is recovered by step 7 and by nothing else.

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
  snapshot and the audit trail. [troubleshooting.md](troubleshooting.md) is
  the diagnosis page proper.

### Step 2 — Guarded manual rollback

Use authenticated `POST /api/v1/update/rollback` with the required CSRF token.
The native backend validates the running receipt and retained authenticated
fallback. It marks the running deployment failed, changes boot selection, and
returns the running/target identities and explicit reboot next step. A repeat
request or unavailable/invalid fallback is refused with a reason.

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
  update policy, application settings, all at once. There is no per-subtree
  reset.
- **Does not recover:** a lost credential (the administrator credential is
  kept on purpose — a settings action that dropped it would be a lockout
  wearing a friendlier name), application data, a broken deployment.
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

- **Fixes:** an application whose own state wedges it or the device, a full
  `/srv`, an application layer to be handed over clean.
- **Costs irreversibly:** **all operator data in `/srv`** and every
  application's data under `/mica`. There is no backup contract to fall back
  on.
- **Does not recover:** platform settings, credentials, deployments.
- **How:** the same route with `{"tier": "application-data"}`, on the same
  terms.

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
- **Costs irreversibly:** everything on DATA but its update records: the
  settings, the claim and the administrator credential, the API tokens, the
  keys, the SSH host keys and the machine-id, the containers, every
  application, `/srv`, `/mica` and the logs kept on DATA.
- **Keeps:** the installed software at its version (SYSTEM, both retained
  deployments, the core set) and the device code, which is derived from the
  hardware. The device comes back **unclaimed**, on its factory access point
  with the label's key, and its next first boot draws a new device id,
  hostname, machine-id and SSH host key.
- **Also goes back:** the update server address and policy, to the values the
  image was built with — Step 3's warning applies here unchanged, including
  the case where the built-in address is *none* and the device is left with
  no update server at all.
- **Does not recover:** a lost administrator password, since every way to ask
  for it needs that password; a device that cannot boot; a corrupted
  deployment.
- **How:** the console's System page, `POST /api/v1/system/factory-reset` with
  `{"password": "..."}`, or `micad factory-reset` as root on the device. Each
  asks for the administrator password, even from a signed-in session, and a
  wrong one counts in the sign-in backoff. It is refused on an unclaimed
  device, while an update installs and while a deployment is on trial. The
  device reboots after 3 s and the erase runs at that boot; an interrupted
  erase starts again at the next one. Without micad, `mica-deploy
  factory-reset --reboot` as root stages the same erase
  ([without micad](without-micad.md) section 7).
- **Which images:** an image built with core 0.0.4 (`cx3576.full` from
  `20261031-0512`). A device on an image of 2026-10-21 answers
  `factory_reset_unsupported`, also after it installs core 0.0.4 from the core
  set, until it runs a newer product image. The former
  `{"tier": "full-factory"}` of `POST /api/v1/reset` is refused with 422 and
  names the new route.

> status: board-dependent — evidence: `mica-core:crates/micad/src/factory_reset.rs`, `mica-core:crates/mica-apid/src/routes/reset.rs`, `docs/reference/recovery.md`

### A factory reset does not make a device anonymous

This is the sentence a reader most often supplies for themselves, wrongly, and
getting it wrong ends with a linkable device in somebody else's hands.

**The device code survives a factory reset, and so does the data's trace on
the medium.** The reset draws a new device id, hostname, machine-id and SSH
host key, but the device code is derived from the hardware: it is the same
code on the label, the login prompt and the setup page, and it still derives
the access point's label key. Whoever recorded it before the reset recognises
the device after it. And the erase deletes files: the first boot after it
discards DATA's free space where the filesystem and the medium allow it, which
is not a certified wipe, and on UBIFS or a card without TRIM it does not
happen at all.

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
reset route has two tiers, the factory reset erases files, and none of them
is `secure-wipe`. That absence is the position rather than an
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
  enable SSH, add a key or set a password, and it needs the credential; SSH is
  off or keyless; the serial console shows a login prompt with no account that
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
