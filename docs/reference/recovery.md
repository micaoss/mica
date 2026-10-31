# Recovery and reset

Recovery starts with diagnosis and the retained signed deployment. Reset
changes writable namespaces; it does not repair SYSTEM, replace a kernel or
undo arbitrary application-data changes. All development acceptance starts
from a complete current image.

## 1. Failure boundary

Native UEFI/FIT boot records bound candidate attempts and retain a usable
confirmed fallback. Exhausted or failed deployments are not silently retried
with replenished counters. Shared SYSTEM or DATA failure requires explicit
recovery; switching roots cannot repair a shared filesystem.

See [updates](updates.md), [storage](storage.md) and the
[boot contract](boot.md). Firmware replacement is an independent
[maintenance operation](../security/signing.md).

## 2. Reset tiers

### 2.1 Scope and survivors

The API and `micad_settings::ResetTier` expose exactly two tiers. The executor
is `mica-core:crates/micad/src/reset.rs`. The factory reset is not a tier: it
has a route of its own (2.3).

| Tier | Removed or reseeded | Preserved |
|---|---|---|
| `configuration` | `/mica/config`; modeled settings return through first-boot provisioning | Device identity and secrets, management credential/claim/API tokens, applications and operator data |
| `application-data` | `/mica/apps`, `/mica/volumes`, the independent DATA/containers backing directory, `/srv`, the container projects, DATA/state local-unit enrollments | Settings, identity, credentials, custom UI, update workspace and other system namespaces |

Every tier preserves SYSTEM, boot records and DATA/meta lifecycle/deployment
state. Calibration outside the removal allowlist remains untouched. TLS identity,
machine ID and other preserved service files are not recreated as new identities.

Configuration reset clears the whole public configuration directory, including
documents not represented as modeled settings. Application reset removes unit
enrollments together with their payloads. Configuration reset marks
provisioning pending so the normal initializer reestablishes defaults from
the preserved device identity; there is no image profile to read
(`docs/reference/access.md` section 8).

### 2.2 Intent, execution and interruption

`apid` authorizes the requested tier and stages one durable reset intent in the
settings tree. The next `micad` startup applies that tier before normal
reconciliation. The executor validates the physical DATA/state paths, rejects
symlinked roots and nested mounts, and takes the same transaction lock used by
installation. Traversal is bounded in depth, entries and elapsed time.

Deletion uses the tier's allowlist and synchronizes changed directories. The
settings save that clears the intent occurs last. A failed or interrupted apply
retains its intent and retries the same scope; it never escalates to a broader
tier. Successful repeated boots are idempotent.

Configuration and application-data reset require authenticated management
authority.

### 2.3 Factory reset

The factory reset erases everything configured and keeps the software. A
request for the former `full-factory` tier of `/api/v1/reset` is 422 and names
this route.

- **Who asks.** `POST /api/v1/system/factory-reset` `{password}`, the console's
  System page, and `micad factory-reset` as root on the device, which prompts
  for the password or reads `--password-file`. Each asks for the administrator
  password whatever the caller's credential, and a wrong one counts in the
  login backoff. micad refuses with a code (409): `factory_reset_unsupported`
  when the booted runkit does not carry the erase out, `not_claimed` on an
  unclaimed device, `update_in_progress`, `trial_pending`.
- **What goes.** The request is staged in DATA's `meta/factory-reset.json` and
  the device reboots after 3 s. The initramfs removes everything on DATA but
  `meta/`: STATE with the settings, the claim, the API tokens, the keys, the
  SSH host keys and the machine-id, the containers, the apps, `/srv`, `/mica`
  and the logs kept there. It then recreates the factory layout. An
  interrupted erase starts again at the next boot.
- **What stays.** SYSTEM, the boot records and the core set, so the software
  keeps its version, and the device code, which is derived from the hardware.
  The device comes back unclaimed, on its factory access point with the
  label's key, and its first boot draws a new device id, hostname, machine-id
  and SSH host key.
- **Afterwards.** That boot records the reset (`GET
  /api/v1/system/factory-reset`, `last`) and discards DATA's free space where
  the filesystem and the medium allow it (not on UBIFS, not on a card without
  TRIM). It is not a certified wipe (section 7).
- **Which images.** The erase is carried out by the runkit of the product
  image's kernel component. Images built with core 0.0.4 carry it
  (`cx3576.full.20261031-0512`). A device on an image of 2026-10-21 refuses
  with `factory_reset_unsupported`, also after it installs core 0.0.4 from the
  core set, until it runs a newer product image.
- **Without micad.** `mica-deploy factory-reset [--reboot]`, as root, stages
  the same erase ([without micad](../operate/without-micad.md) section 7).

> status: board-dependent — evidence: `mica-core:crates/micad/src/factory_reset.rs`, `mica-core:crates/mica-apid/src/routes/reset.rs`, `mica-core:crates/mica-deploy/src/factory_reset.rs`, `mica-core:docs/mica-core.md`

## 3. Operator sequence

1. Capture console logs and authenticated deployment state. If the API runs,
   collect its bounded diagnostic snapshot and storage observations.
2. Allow native trial exhaustion to select a usable fallback, or request an
   eligible rollback through the API and reboot separately.
3. Correct configuration or install a newly signed higher-generation deployment
   when the running system and storage support the operation.
4. Use a reset only when its documented data scope addresses the fault. Preserve
   needed operator data before an authorized destructive operation.
5. For an unbootable shared store or exhausted deployments, diagnose on an
   external service host or flash the complete current image. A complete reflash
   replaces media contents and is not a data-preserving repair.

## 4. Physical presence

The board declaration `BOARD_RECOVERY_ACTIONS` describes available mechanisms.
The runtime presence gate requires a supported, bounded assertion and consumes
it for the authorized operation. It is separate from ordinary authentication
and never inferred from an API caller's claim to be standing near the device.

Current boards declare no qualified OS recovery action. Presence-gated
credential recovery therefore refuses through the normal field API. An available firmware console or RockUSB loader transport does not
by itself create an OS presence assertion. Board qualification must establish
the physical action, handoff, expiry and single-use behavior before advertising
that capability.

## 5. Credential recovery

Recovery replaces a credential under the presence gate; it never reads back a
password or a private key. Credential rotation and reset are distinct actions.
Audit records capture the outcome without exposing secret material. Ordinary
login failures cannot clear persistent brute-force counters by rebooting.
The recovery-specific counter behavior is tested with the credential route.

See [access](access.md) and [provisioning](../integrate/provisioning.md) for authentication,
claiming and first-device identity ownership.

## 6. Unbootable systems

### 6.1 Exhausted deployments

UEFI and cx3576 stop when no usable authenticated boot record remains. Capture
the native entries or redundant FIT records together with the console log.
There is no unsigned escape path or counter refill to conceal the failure.

### 6.2 Shared-store repair

Bounded journal replay during startup is not a general filesystem repair
service. Mica OS ships no separate rescue OS or automatic data-preserving repair
operation. External diagnosis and a complete current reflash remain explicit
service operations; neither inherits a data-preservation guarantee from A/B.

### 6.3 Emergency shell utility

The emergency BusyBox executable is inside the same authenticated root. It is
a diagnostic utility when that root can be mounted, not an independent recovery
environment for a damaged root or unavailable SYSTEM.

## 7. Sanitization

There is no secure-wipe reset tier, and the factory reset is not one. File
deletion does not establish removal
from flash remapping, spare blocks or external backups. No board-level erase
qualification is implied by reset or by complete-image flashing.

## 8. Acceptance evidence

uefi-x64 and uefi-arm64 QEMU cover signed startup, health confirmation, exhausted
trials, panic/watchdog fallback and complete shutdown. Interrupted-reset tests
kill the real reset applier after a successful deletion, then verify retry,
scope preservation and a further idempotent boot for each tier.

cx3576 has offline image/FIT verification and firmware-policy tests. Its
physical startup, watchdog handoff, recovery and power-cut behavior require the
[bench runbook](https://github.com/micaoss/mica/blob/9dd6302/docs/boards/cx3576-bench.md). Boot assurance and recovery capability
are separate claims. Pending per-board checks are in
[support tiers](../hardware/README.md#current-boards).
