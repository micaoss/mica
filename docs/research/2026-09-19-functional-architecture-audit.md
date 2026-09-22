# Functional and architecture audit — 2026-09-19

## Repository Audit Summary

This audit covers all eight repositories in the Mica OS workspace. It follows
the functional paths from product composition to device configuration,
application operation, update delivery and recovery. CI configuration, test
counts and coverage percentages are outside the assessment criteria.

The core decomposition is established: separate toolchain, base-system, board,
container-engine, management, assembly and resource-service responsibilities.
The largest gaps are the recovery path after losing management access, the
unfinished application lifecycle and product configuration, and consistency
across independently persisted state. These gaps matter before relying on the
system for unattended field operation.

The findings distinguish reproduced defects, architecture risks and explicitly
planned capabilities. An unimplemented approved design is a capability gap,
not evidence that its current placeholder is pretending to be functional.
Backward compatibility is not a requirement: recommendations may replace
current contracts directly without aliases, transition layers or migrations.

This is an audit snapshot and a set of recommendations, not a new normative
design or approval to implement the proposed changes. Existing designs and
decisions remain authoritative until deliberately revised.

### Source snapshot and repository coverage

The following local commits were recorded when preparing the report. Relevant
findings were rechecked after concurrent changes to the documentation, board
declarations and device-side board naming. Paths below use the workspace's
`repository:path` convention and refer to this snapshot.

| Repository | Commit | Responsibility and assessment |
|---|---|---|
| `mica` | `00dcc0a6c9935d58e92cdd090af1b9f32276d28a` | System contracts and documentation; applications, physical recovery and fleet operation must remain clearly separated into delivered and planned capabilities. |
| `mica-build-env` | `cd3f239e4b7cbae5ad4a1f4669c71aec93eab61f` | Centralized pinned toolchains; no independent functional defect confirmed in the inspected scope. |
| `mica-system-base` | `b1d2ca4625d2a5f92ad7d0ad99ed5230beff57da` | Base root and runtime policy; health confirmation and shared DATA capacity do not guarantee management recoverability (FA-01, FA-02). |
| `mica-boards` | `f36211f318be79c52836711d0f51ad20e722b4a9` | Hardware, boot and radio components; physical recovery is undeclared on every board, and Bluetooth policy is not integrated into management (FA-04, FA-06). |
| `mica-core` | `dc1c870cea4282e059f258df3781fc15879f1402` | Device control, API, dashboard and deployment lifecycle; owns most remaining device-side functional gaps (FA-01, FA-04, FA-05, FA-06, FA-08). |
| `mica-podman` | `ad9deb0936115fb086685ca94b155070f561ee66` | Container engine and package; the boundary is appropriate, while managed application lifecycle belongs above it (FA-05). |
| `mica-build` | `ed6bf0b7af4bba622fc21368bb7692d44690e983` | Product composition and update-server tooling; product defaults and release-to-device update delivery need completion (FA-06, FA-07). |
| `mica-res` | `cb14d2d09e84ffeb7fb69ac1ea5edf1f9f17c4ec` | Resource storage and distribution; concurrent immutable publishing can leave stored bytes inconsistent with database metadata (FA-03). |

Absence of a confirmed finding for a repository is limited to the inspected
paths; it is not a claim that every implementation path is defect-free.

### Findings at a glance

| ID | Priority | Classification | Gap |
|---|---|---|---|
| FA-01 | P1 | Architecture risk | Network changes lack a bounded apply-confirm-revert transaction. |
| FA-02 | P2 | Architecture trade-off | Application and container growth can exhaust the control plane's shared DATA filesystem. |
| FA-03 | P1 | Reproduced defect | Concurrent first publishes can replace immutable bytes before a database conflict is detected. |
| FA-04 | P2 | Capability gap | Recovery execution exists, but no board declares a usable physical recovery entry. |
| FA-05 | P2 | Capability gap | The application dashboard is a simulation without a managed application backend. |
| FA-06 | P2 | Integration gap | Product defaults do not reach settings composition; Bluetooth has no managed policy section. |
| FA-07 | P1 | Lifecycle defect and integration gap | Update metadata expires without built-in renewal; product update-source handoff remains incomplete. |
| FA-08 | P2 | Capability gap | Device-initiated fleet enrollment and reporting have no shipped runtime. |

## P0

No P0 issue was confirmed in the examined paths. This is not a comprehensive
security assessment or hardware qualification result.

## P1

### FA-01 — Network changes can permanently remove the management route

**Observation.** `set_settings` persists the candidate before enqueueing its
reconcile. The network reconciler writes units, removes obsolete units,
recreates affected virtual interfaces and reloads networkd. There is no trial
configuration with a confirmation deadline and automatic restoration of the
last confirmed network configuration.

**Functional consequence.** A valid but unreachable IP, VLAN or bridge setting
can disconnect the administrator. Rebooting reloads the persisted setting.
Switching the signed root deployment does not undo configuration on DATA.
The boot health gate's loopback API check can succeed while the external
management route remains unusable.

**Evidence.**

- `mica-core:crates/micad/src/bus.rs`, `persist_setting` and `set_settings`.
- `mica-core:crates/micad/src/reconciler/network.rs`, `NetworkReconciler::apply`.
- `mica-system-base:payload/usr/lib/mica/mica-health`, the required `apid`
  member checks `https://127.0.0.1/healthz` before deployment confirmation.

**Recommended closure.** Make management-network changes a durable trial
transaction with explicit confirmation, a bounded deadline and restoration
after timeout or interrupted application. Define reachability against the
product's declared management path; general Internet connectivity must not
become a requirement for intentionally offline devices. Separate listener
liveness from the product's management-readiness policy.

**Closure evidence.** A change that disconnects the active management path
expires back to a usable configuration, including across a restart; a
confirmed change remains active. This failure was traced in source, not
induced on a physical device during the audit.

### FA-03 — Immutable resource publication races across storage and metadata

**Observation.** `publishObject` reads the current database row, checks the
immutable policy, copies staged bytes to the final object key, and only then
inserts the database row. The unique live-key constraint rejects a duplicate
row after the competing request has already written the final object.

**Reproduced sequence.**

1. Stage two different payloads for the same previously unpublished path in
   the immutable `mica` namespace.
2. Start both `publishObject` calls and pause their object copies until both
   requests have observed the absent database row.
3. Allow both copies and database inserts to proceed.
4. One request succeeds and the other fails, but the database digest and the
   digest recorded with the final bucket object differ.

The isolated reproduction used the real service and SQLite with the existing
in-memory storage adapter. The observed outcomes were `fulfilled` and
`rejected`, with `consistent: false`. It did not access a deployed R2 bucket.

**Functional consequence.** An immutable URL can serve bytes different from
its published metadata. Consumers enforcing pinned digests reject the content,
causing failed acquisition; this is not evidence of bypassing signature or
digest verification.

**Evidence.**

- `mica-res:apps/api/src/modules/resource/resource.service.ts`,
  `publishObject`, especially the final-key copy before the insert.
- `mica-res:apps/api/src/modules/resource/schema.ts`,
  `idx_res_objects_key_live`.
- `mica-res:apps/api/src/modules/resource/storage/memory-store.ts`, the
  storage adapter used to reproduce the interleaving.

**Recommended closure.** Give each destination key exclusive publication
ownership before mutating final bytes. Use a staged, recoverable state machine
for storage and database completion; a database uniqueness check alone cannot
make the object-store mutation atomic. Serialize publication of any derived
catalog pointer with the committed object state.

**Closure evidence.** Different concurrent first publishes have one winner,
and a refused request cannot change the winner's bytes. Interrupted copies or
metadata writes leave a recoverable state whose metadata and bytes agree.

### FA-07 — Online update delivery lacks unattended metadata renewal

**Observation.** The update server defaults signed catalog validity to 168
hours. Publishing, withdrawing or an authenticated metadata-refresh request
renews it. Startup refreshes only when the catalog is absent or its signing
key changes; it does not renew an expired same-key catalog. The server entry
point contains no scheduled renewal. The device correctly refuses expired
catalogs.

**Functional consequence.** With default settings and no external refresh,
an otherwise idle update service stops supplying acceptable metadata after
seven days. Restarting with the same signing key does not repair it. This
blocks online operations requiring a current catalog; it does not invalidate
an installed deployment's independent offline boot policy.

**Related integration gap.** Every checked-in product update manifest has
`source: null`. Release assets, the Mica version index and resource mirrors
exist, and the update server can import and publish releases, but there is no
complete shipped handoff that selects a promoted release, publishes its
device catalog and configures the corresponding product update source.
An unconfigured source is an explicit default, not a broken manual-import
path. The missing piece is a defined end-to-end delivery responsibility.

**Evidence.**

- `mica-build:update-server/src/config.ts`, `METADATA_TTL_HOURS`.
- `mica-build:update-server/src/modules/releases.ts`, `refreshCatalog`.
- `mica-build:update-server/src/app.ts`, startup and `/api/metadata/refresh`.
- `mica-build:update-server/src/index.ts`, service lifetime.
- `mica-core:crates/mica-deploy/src/catalog.rs`, catalog expiry validation.
- `mica-build:products/*/meta/updates/manifest.json`, `update.source`.
- `mica-build:tools/release-index.py` and
  `mica-res:packages/mica-sync/src/index-doc.ts`, distribution indexes.

**Recommended closure.** Assign catalog renewal an explicit runtime or
operator-owned scheduler, with expiry visibility and failure reporting.
Define the promotion/import step and product source configuration as one
operational path. Preserve the different roles of `mica/index/v1`, resource
indexes and signed `mica/catalog/v2`; a download index is not a device trust
decision. Promotion can remain an explicit operator action.

**Closure evidence.** A service with no new release continues serving current
signed metadata beyond its initial validity period, including after restart.
A selected release can be followed from promotion to a configured device's
catalog check and artifact acquisition. Expiry behavior was established from
control flow; no week-long deployed-service observation was performed.

## P2

### FA-02 — Shared DATA capacity can disable control-plane persistence

**Observation.** Project 100 covers system/user data and project 102 covers
containers; both have unlimited byte and inode quotas. Project 101 bounds
variable data only. State, metadata and application/container growth therefore
share a filesystem without a guaranteed control-plane reserve. The storage
design explicitly acknowledges this trade-off.

**Functional consequence.** Workload growth can prevent configuration,
deployment or reset records from being persisted. Atomic replacement still
requires space for a new file and transaction metadata. A/B root rollback
does not reclaim DATA or isolate its capacity failures.

**Evidence.** `mica-system-base:payload/usr/lib/mica/mica-data-layout`, the
three `setquota` calls; `mica-core:crates/micad-settings/src/store.rs`, settings
persistence; [storage design](../design/storage.md), DATA accounting and
startup/failure behavior.

**Recommended closure.** Define which control-plane writes must remain
possible under byte and inode exhaustion. Provide a capacity guarantee or a
recovery operation that can free space without first requiring another normal
state write. Do not introduce arbitrary workload quotas as a substitute for
that explicit policy.

**Closure evidence.** Under both full-block and full-inode conditions, an
operator can diagnose the problem and recover writable control state without
reflashing. Actual exhaustion behavior remains a runtime verification item.

### FA-04 — Physical recovery has no usable board entry

**Observation.** All four board definitions declare
`BOARD_RECOVERY_ACTIONS=""`. The recovery executor can consume a bounded,
single-use boot intent, but it refuses intents that do not map to a declared
board action. The documented presence-gated credential recovery and full
factory reset consequently have no qualified normal field entry.

**Functional consequence.** Once credentials and all other authorized access
paths are lost, a device cannot use the planned local recovery lifecycle.
An unbootable shared store also has no separate rescue OS. The emergency
BusyBox executable depends on the same authenticated root being mountable;
full reflashing is not data-preserving repair.

**Evidence.** `mica-boards:boards/uefi-x64/board.env`,
`mica-boards:boards/uefi-arm64/board.env`,
`mica-boards:boards/cx3576/board.env`,
`mica-boards:boards/s905x5m/board.env`;
`mica-core:crates/micad/src/recovery.rs`, `apply_boot_intent`;
[recovery design](../design/recovery.md), physical presence and unbootable
systems.

**Recommended closure.** Complete one board's physical gesture or firmware
menu, authenticated handoff, expiry and single-use consumption. Define
data-preserving service recovery separately from destructive factory reflash.
Retain the physical-presence authorization boundary.

**Closure evidence.** A local operator can recover access on the selected
board, while a remote caller cannot synthesize or replay the presence token.
State exactly which data and identity survive each recovery operation.

### FA-05 — Managed applications stop at a simulated dashboard

**Observation.** The Applications page reads `simulation.apps`; install,
update, removal and state changes operate on the simulation provider. The page
explicitly displays planned/simulation notices. The OpenAPI does not expose
the planned application or application-catalog routes, and `mica-appd` has no
implementation.

**Functional consequence.** The shipped engine and global container switch
allow integrator-managed Podman/Quadlet workloads, but do not provide the
product's application inventory, admission, installation transaction,
per-application lifecycle, health or data-retention behavior.

**Evidence.**
`mica-core:crates/mica-apid/ui/src/features/applications/applications-page.tsx`,
`ApplicationsPage` and `confirmInstall`;
[managed applications design](../design/applications.md), current status and
the OCI-first scope.

**Recommended closure.** Implement the smallest complete signed OCI
application path: catalog and digest admission, staging, activation through
systemd, durable inventory, observed state and explicit retained-data handling.
Keep engine compilation in `mica-podman` and application policy in the
management layer. Managed native applications and a public marketplace need
not precede this first usable path.

**Closure evidence.** Dashboard operations act on real durable application
records and runtime state, including interrupted installation and device
restart. Planned features remain visibly distinguished until that path ships.

### FA-06 — Product defaults and managed Bluetooth remain disconnected

**Observation.** `product.sh` recognizes an optional `defaults.toml`, checks
its TOML/version and secret-bearing keys, and emits its path. Product
documentation explicitly defers composition until micad reads the file.
The settings loader composes device documents and state without a product
defaults layer or its shared typed validator.

The settings model and reconciler registry also have no Bluetooth section.
The board radio package provides hardware initialization and persistent BlueZ
state, which does not implement managed enablement, discoverability or pairing
policy.

**Functional consequence.** A product author cannot rely on the declared
defaults mechanism to shape runtime settings. Bluetooth hardware support
cannot be configured through the same management lifecycle as Wi-Fi and other
managed services.

**Evidence.** `mica-build:tools/product.sh`, `DEFAULTS` handling;
`mica-build:products/README.md`, `defaults.toml`;
`mica-core:crates/micad-settings/src/store.rs`, `read_store`;
`mica-core:crates/micad-settings/src/model.rs`, `Settings`;
`mica-core:crates/micad/src/reconciler/mod.rs`;
`mica-boards:producers/radio-bluetooth/Dockerfile`;
the pending [product-defaults task](../task/20260913-0440-micad-product-defaults.md).

**Recommended closure.** Share the typed defaults validator between assembly
and runtime, implement `code < product < device` precedence, and define how
reset restores product defaults. Connect the supported Bluetooth policy to
BlueZ. Keep passwords and pairing secrets device-specific rather than baking
them into product defaults.

**Closure evidence.** A composed product changes the intended initial setting,
a device override wins, and reset returns to the specified product policy.
Bluetooth policy changes reach the actual adapter and survive restart as
documented.

### FA-08 — Fleet management has a protocol proposal but no runtime

**Observation.** Local HTTPS management is inbound. There is no shipped
device-initiated enrollment, credential renewal/revocation, durable report
queue or fleet service. The remote-management design and the pending runtime
task explicitly identify this boundary. Generic WireGuard support and
configuration overlays do not supply the missing lifecycle.

**Functional consequence.** Remote support behind NAT and fleet-wide
operations require an integrator's external system. The current local device
management interface alone does not satisfy the stated outbound-only fleet
requirement.

**Evidence.** [Remote management](../design/remote-management.md), current
inbound surface and planned fleet protocol;
the pending [fleet runtime task](../task/20260912-2058-fleet-runtime.md).

**Recommended closure.** Start with off-by-default outbound enrollment,
credential lifecycle and bounded durable reporting. Route any later management
commands through existing device authorization and execution boundaries, and
keep fleet credentials separate from update-signing keys.

**Closure evidence.** A device behind NAT enrolls, reports after interrupted
connectivity, renews and is revoked without inbound port forwarding. With the
feature disabled, it initiates no fleet connection.

## Needs Runtime Verification

- Network loss, reconnect and restart behavior for FA-01 on an actual supported
  management interface.
- Byte and inode exhaustion and recovery for FA-02, including the ability to
  persist required deployment/reset records.
- FA-03 under the deployed object-store adapter and interruption boundaries;
  the isolated reproduction already demonstrates the service-level race.
- Board-specific physical-presence handoff and independent rescue feasibility
  for FA-04.
- Catalog renewal ownership and expiry behavior in a deployed update service
  for FA-07.

These items qualify the evidence; they are not a review of CI or a request to
expand test counts.

## Coverage Gaps

The audit traced selected critical paths across all repositories. It did not
qualify hardware drivers, exercise physical recovery gestures, interrupt real
power, fill a device disk, verify fuse/secure-boot state or operate a deployed
resource/fleet service. It does not establish a production-readiness verdict
for any individual board.

No real device management network was reconfigured. No application lifecycle
or fleet operation was represented as implemented merely because its design
or dashboard exists. Potential derived-catalog publication ordering issues
need separate runtime investigation and are not counted as another reproduced
defect in this report.

## Recommended Next Actions

1. Close FA-01 and FA-04 together as the management-access and local-recovery
   workstream; decide the FA-02 control-plane capacity guarantee alongside it.
2. Fix the reproduced FA-03 publication race before depending on immutable
   resource URLs for distribution, and make FA-07 renewal ownership explicit
   before unattended online update operation.
3. Complete FA-06 so product recipes determine runtime behavior through one
   typed configuration contract.
4. Deliver the first real OCI application lifecycle for FA-05, retaining the
   existing engine/manager responsibility boundary.
5. Schedule FA-08 as a separate fleet workstream after local management and
   recovery behavior are dependable.

Each closure should update the owning implementation and current-behavior
documentation. This dated report remains evidence of the audited snapshot;
completion belongs in the corresponding task and change records.
