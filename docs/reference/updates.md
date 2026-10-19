# File deployment lifecycle

Mica OS installs independently signed kernel/support and root components as
deployments, and its core components as core sets. The native backend is
`mica-deploy`; `micad` exposes its state and actions through
D-Bus, and `apid` exposes them behind the authenticated API/CSRF boundary.
Formats are strict: only the current deployment, set, catalog and settings
schemas are read.

## State and identity

`GET /api/v1/update` reports the authenticated `boot`, reconciled `state`,
`deployments`, `rollback`, `install`, `last_action` and acquisition `lifecycle`.

| Field | Meaning |
|---|---|
| `boot.deploymentId`, `kernelId`, `rootfsId` | Authenticated running deployment and components |
| `boot.contentVerified`, `boot.bootVerified`, `boot.secureBoot` | Separate observations of content and platform boot verification |
| `state.current` | Confirmed deployment |
| `state.fallback` | Retained usable deployment |
| `state.candidate` | Activated deployment awaiting confirmation |
| `state.failed` | Failed deployment IDs enforced by the native backend |
| `state.highestGeneration` | Monotonic installation floor |
| `deployments` | Authenticated version/generation/component identities and remaining trials |
| `rollback` | Atomic backend verdict: permitted, target and refusal reason |

Acquisition proceeds through checking, downloading, ready and installing, with
explicit unavailable/failure states. Boot observations distinguish validation,
confirmation, a pending reboot and fallback. The API does not infer installed
content from untrusted root metadata or an editable version label.

## Acquisition and installation

The source is an **update root**, a URL ending in `/` such as
`https://res.micaos.dev/update/`. Under it the client reads an unsigned
manifest, `v1/manifest.json`, naming each product's current release, then that release's document,
then its signed descriptor, each only when it needs it. Trust comes from the
descriptor: the client takes only its own board, architecture and product,
only a generation above the one it runs and only the objects the descriptor
names. The manifest's revision is checkpointed as a consistency check against
a confused mirror; a product has no channel and nothing expires, so a
withheld manifest reads as "nothing newer". The formats and their compatibility rule are
`mica-core:docs/mica-core.md` section 6.2.

Files live under `/mica/updates/{staging,downloads,verified}` on physical DATA.
The workspace probe checks mount identity, writability, free space and bounded
contents. HTTP ranges resume partial objects; complete bytes and lengths must
match authenticated metadata. `MICAUPD1` offline imports carry the same signed
deployment and any subset of its objects, with no archive paths or links.
An import may carry from 0 to the descriptor's object count: one signed
deployment is published as `full`, `root` and `kernel` archives
([which archive applies](../operate/updates.md#2-which-archive-applies)).
Every missing object must already be in the store. A deployment names no core
component; those come from the device's [core set](#core-sets). The descriptor's required signed
`product` field must equal the device's product: the unquoted `PRODUCT=<name>`
line of `/usr/lib/mica/product.conf`. A catalogue server is keyed by product.
There is no minimum running release rule.

Installation requires the authenticated running deployment A to be confirmed
healthy. It verifies every new or reused object and checks destination capacity,
including the allocated blocks that retiring the inactive deployment B will free.
A rejected descriptor, corrupt input or failed capacity preflight leaves both
installed deployments intact.

The installer durably removes B's boot record before reclaiming its exclusive
objects and descriptor. On FIT, both redundant environment copies must forget B
before any collection. Components shared with A or the incoming deployment remain
in place. The new B is copied from DATA using temporary files, exact digest checks,
file sync and directory sync; its boot entry becomes visible only after all its
objects and descriptor are durable. There are at most two deployment records.
The three-attempt trial counter does not imply a third deployment.

An interruption before activation leaves A bootable. Native entries are the
commit record: DATA state reconciliation drops a retired fallback and discovers
an activated candidate even when the corresponding state write did not finish.
Until new B is complete, A is the sole bootable deployment; its own corruption
would require recovery. Once B is activated, A is its fallback. Confirmation of B
makes B current and A the retained fallback for the next replacement.

Root-only updates reuse kernel/support objects. Kernel-only updates reuse the
root object. Combined updates publish both. Normal OS installation never writes
firmware loader ranges or enrolls keys.

## Confirmation, failure and rollback

UEFI uses signed shared UKIs and systemd-boot Type #1 entries with native trial
counts. The pinned loader patch refuses launch when decrement persistence fails
and excludes exhausted entries. cx3576 uses signed FITs and the redundant strict
record policy described in [the boot contract](boot.md).

Each candidate has three attempts. The boot health service confirms only the
authenticated running deployment after required services and policy checks pass.
Known confirmed metadata/health failures retire that record when a usable
fallback exists. Shared SYSTEM/DATA failures stop for explicit recovery. No path
refills exhausted counters or falls back to unsigned content.

`POST /api/v1/update/install` accepts a verified `deploymentId`.
`/confirm` and `/reject` also take a deployment ID. `/rollback` atomically checks
that running content is confirmed, no candidate is pending and a usable fallback
exists. It reports the target and the separate reboot action. Reasons are
`candidate_pending`, `running_not_confirmed` and `no_usable_fallback`.

Failed IDs and the generation floor enforce suppression across rollback and
source changes. A corrected release needs a newly signed higher generation;
there is no UI action that clears those installation constraints.

## Policy and reboot

Public `/mica/config/updates.json` settings (`mica/update-config/v1`) overlay
the factory defaults (`mica/meta/v1`) for source, mode, allowed network,
schedule, reboot policy and the channel followed for each kind of set. They cannot inject
metadata keys. Automatic checks/fetches use the same native acquisition path.
The reboot gate retains maintenance-window, health, active-install and override
checks; an override does not interrupt an installation.

Storage reports one DATA capacity and the state/meta/bulk/disposable accounting.
Garbage collection authenticates every retained descriptor before deleting
unreferenced objects or interrupted staging. Directory reset shares the native
transaction lock and preserves deployment records and identity.

## Core sets

The core components (one per package: `micad` with the API, and the console)
are released on their own, apart from any product. The formats, the commands
and the on-device state are `mica-core:docs/mica-core.md` section 6.2.

- **One signed core set per channel and architecture**, released once for
  every architecture and taken by every device of that architecture on that
  channel (`mica-build:src/release/core.ts`). No product is held to it when
  it is released: a set is checked where a system meets it, by the device's
  selection and by a product build against its seed.
- **Every device has one.** A factory image carries a seed set with its
  components, and its deployment names that set (`coreSet`); a device with no
  set does not boot, because nothing else names core components.
- **Declarations.** A component declares the features that take it, the
  other components it needs, and optionally the root interface levels it runs
  on (`root`) and up to 16 root packages with version bounds (`requires`). A
  root declares its `interfaceLevel` and optionally the packages it
  `provides`. A `requires` entry holds when the root does not provide the
  package or provides it within the bounds.
- **Selection is the device's.** It composes the components of its set that
  carry at least one of the `FEATURES` of its root's `product.conf`. The
  selection is refused, naming the component and the constraint, when a
  selected component's `root` or `requires` does not hold, or it needs a
  package that is not selected or is selected outside its range. Each
  selected component is a verity image composed over the root's `/usr` and
  `/etc` at boot.
- **A set alone** is checked against the running root before it is fetched;
  one that does not select waits for a system update. It is not installed
  while a deployment is on trial, and has three boots of its own: one that
  reaches healthy becomes current, one that does not is dropped.
- **A pair.** A system update on `general` takes the newest `general` set
  that selects on its new root, never older than its image's, and installs it
  with the deployment as one pair. The pair is on trial together and only the
  deployment's trial is counted; confirmation makes both current, a failed
  trial boots the previous deployment with the set it ran. A system update
  never downgrades core or moves a device off its channel: otherwise the
  device keeps its set, and the update is refused when that set does not
  select on the new root.
- **Sets held**: the current set, the set on trial, and the sets bound to the
  other retained deployments, at most three. Each retained deployment boots
  the set it was confirmed with; a set nothing names is released with its
  objects. Early boot passes over a pending set it cannot authenticate or
  compose; a set it must compose and cannot stops the boot.
- **The channel is a setting.** The device follows the operator's
  `channels.core`, else the image's, else `general`. Generations are monotonic
  within a channel and architecture.
- **One policy for both lines.** A check names a newer core set before it
  reads the product line, and goes on to the product line when the set waits
  for a system update or the core line cannot be read. Fetch, install, the
  maintenance window and the reboot gate are the same for a set and a
  deployment; `update.lifecycle` says which of the two is on offer and staged,
  and `update.sets.core` the sets held and the boots a set on trial has left.
- **A set archive** is `MICAUPD1` with the signed set as its envelope and the
  set's objects; a system update archive whose descriptor names a `coreSet`
  carries that set and its objects beside the deployment's. `import` takes
  either archive and names which it took.

## Acceptance

QEMU full systems exercise root-only, kernel-only and combined updates,
three failed health trials, retained fallback, acquisition, native services,
identity and complete shutdown. Deterministic native fault injection covers
install, confirmation and GC on both boot backends. Firmware signing and
maintenance have separate [trust evidence](../security/signing.md).

Per-board results and unresolved gates, including physical cx3576
watchdog/power-cut tests, are in [support tiers](../hardware/README.md#current-boards). Process interruption and
VM shutdown cannot establish physical eMMC power-loss durability.
