# Mica OS documentation

> English | [中文用户指南](zh/README.md)

Mica OS is an embedded Linux operating system for industrial devices: a signed
dm-verity root, independently signed kernel, support and core components,
file-based A/B deployments managed by `mica-deploy`, and a local management API
and console. The [architecture](architecture.md) maps the components; current
board status is in [support tiers](hardware/README.md#current-boards).

## Start with a task

| I need to… | Read |
|---|---|
| Understand the whole system quickly | [Overview](start/overview.md) |
| Get an image and boot a device | [Quickstart](start/quickstart.md), [download](start/download.md), [flashing](start/flashing.md), [installation](start/install.md) |
| Build a product from source | [Build guide](start/build.md) |
| Understand upgrade and rollback | [Updates and rollback](operate/updates.md), [deployment lifecycle](reference/updates.md), [trust](security/signing.md) |
| Understand disk layout and recovery | [Storage](reference/storage.md), [immutable root](reference/ro-root.md), [reset/recovery](reference/recovery.md) |
| Develop against the API or the console | [API contract](reference/api.md), [console](integrate/console.md), OpenAPI (`mica-core:crates/mica-apid/openapi.json`) |
| Integrate an application | [Native applications](integrate/native-applications.md), [containers](integrate/containers.md), [bus](integrate/bus.md) |
| See what a board does today, and how to flash it | [Supported hardware](hardware/README.md), [support tiers](hardware/README.md) |
| Understand how releases are identified | [Release notes](releases/release-notes.md), [releasing](releases/how-releases-work.md), [release lock](reference/release-lock.md) |
| Find a product decision | [Decisions](decisions/README.md) |

## Naming

The product is **Mica OS** (identifier `mica`). Package, binary, service, bus
and path names use the `mica` prefix — `micad`, `mica-deploy`, `com.mica.micad`,
`/mica/config` — and documents quote them verbatim.

## Where documentation lives

This repository holds **the product**: what Mica OS is and how its parts fit
together, the user and integrator documentation, the supported hardware and
its assurance, the design contracts of the product's behaviour on a device,
the product decisions and the website briefs behind micaos.dev. It keeps no
task, plan or changelog records: work is tracked, and history kept, in the
repository it changes (`decisions/2026-09-27-each-repository-keeps-its-records.md`).

| Here | Elsewhere |
|---|---|
| what the product is, and how the parts fit together (`architecture.md`) | how a module is built, tested and released: that module's repository |
| how a device behaves: updates, storage, access, the API, applications | the code and its own design: `mica-core:docs/mica-core.md`, `mica-podman:README.md`, `mica-system-base:docs/floor-and-options.md` |
| the boards a user can run, at what tier, and how to flash them | the board contract, porting and the image build: `mica-build:boards/README.md`, `mica-build:docs/design/` |
| how a user verifies a release | the release lock, its vectors, package versions and the build rules: `mica-build-tools:docs/spec/` |
| product decisions | engineering decisions: in the repository they bind |

A reference to another repository is written `<repository>:<path>` — for example
`mica-core:crates/micad`.

## Ownership

Within this repository, each fact has one owner; other documents link to it instead of
restating it.

| Directory | Owns | Does not hold |
|---|---|---|
| `architecture.md` | the system map and repository layout | subsystem detail |
| `start/`, `operate/`, `integrate/` | operator and integrator instructions, in the order a reader meets them, with truth-status lines | engineering rationale |
| `security/` | the security posture, the threat model, the lifecycle and the trust chain | the formats, which are `mica-core`'s |
| `reference/` | the contracts of the product's behaviour on a device; unimplemented parts are labelled | build engineering, chronology, test transcripts, wire formats |
| `releases/` | how a release is identified, made, distributed and supported | each repository's own release procedure |
| `hardware/` | the per-board reader's view (feature and verification state, flashing, update and recovery route), the support tiers, the boot-assurance ladder, the qualification matrix and the board page template | the board contract and porting, which are `mica-build`'s |
| `website/` | publication copy for micaos.dev and its claim limits | anything not yet evidenced |
| `decisions/` | dated product decisions with a sunset | design detail, engineering decisions of a module |
| `zh/` | Chinese user guides, the Chinese hardware list under `zh/hardware/`, and explicitly requested Chinese briefs | engineering translations |

The generated OpenAPI file owns route and schema detail. Documents describe the
current product only; history is in Git.

## Complete catalog

- `architecture.md` — top-level system architecture and component map (start here)
- `start/` — the way in: what Mica OS is, getting an image and booting a device
  - `overview.md` — Mica OS in one page: the repositories, the release chain, the products and where the files are
  - `quickstart.md` — the shortest honest path to a running Mica OS system
  - `download.md` — release selection and obtaining an image
  - `flashing.md` — writing a release image to a board, per board, and what is not a verified procedure
  - `install.md` — the order of operations for an installation, from choosing an image to first boot
  - `first-run.md` — first boot, the offline provisioning document, and claiming the device
  - `build.md` — building a product image from source, online from the pinned releases or offline from the checkouts
- `operate/` — running a device: configuration, updates, recovery, storage, the API
  - `configuration.md` — the configuration model and every supported way to change settings
  - `updates.md` — which update archive applies, online and offline updates, confirmation, rollback and every refusal
  - `recovery.md` — what to do when a device does not boot, and what recovery costs
  - `storage.md` — partitions, what survives what, and where data belongs
  - `troubleshooting.md` — diagnosis: access channels, evidence to read, refusals to interpret
  - `api.md` — the programmatic surface and its machine-readable contract
- `integrate/` — building a product on it: applications, containers, the bus, the console, provisioning, manufacturing
  - `applications.md` — delivering and running applications: native packages and containers
  - `bus.md` — management/application boundary, package-enrolled `com.mica.Item1` applications, D-Bus policy and MQTT grammar
  - `console.md` — the built-in console (`mica-apid-ui`): navigation, state and actions
  - `containers.md` — integrator's guide: declaring containers to micad, mica-containerd's supervision, interconnection, ordering, persistence
  - `display.md` — HDMI kiosk UI: cage and WPE rendering `apid` locally
  - `managed-applications.md` — planned managed applications: curated OCI-first catalog, signed manifest, lifecycle, trust and API boundary
  - `manufacturing.md` — putting Mica OS on units at volume: identity, first credential, factory record and quarantine
  - `native-applications.md` — integrator's guide to native `.deb` applications: units, accounts, writable state, the health gate, devices, ceilings and rollback limits
  - `provisioning.md` — configuration without a network: first-boot identity, provisioning documents and credentials
- `hardware/` — the supported boards: one page per board, the status table and support tiers, assurance and qualification
  - `README.md` — the board list, a dated state snapshot and the route into each board's page
  - `uefi-x64.md` — generic amd64 UEFI machines: the baseline, booted in every release run
  - `uefi-arm64.md` — generic arm64 UEFI machines: the carried driver set, and why carrying is not qualifying
  - `cx3576.md` — CX3576-Z / RK3576: features, the rockusb flashing path and what a reported bench boot does not establish
  - `s905x5m.md` — BM201 / S905X5M: features, and why a published image cannot install onto a blank board
  - `mini-x64.md` — small amd64 UEFI machines with 128 MB of flash: one OpenRC product with containers, no USB
  - `assurance.md` — boot assurance ladder (I1–I4) and what each level requires
  - `qualification.md` — field-reliability qualification: the matrix and its binding rules
  - `board-template.md` — the board page template: the eleven validated sections
- `security/` — the security posture, the model, the lifecycle and the trust chain
  - `lifecycle.md` — key and credential lifecycles, owner roles, release channels, support windows and security response
  - `model.md` — threat and physical-access boundaries, the I1–I4 boot-assurance ladder and honest limits
  - `overview.md` — the security posture: what is protected, by what, and the named gaps
  - `signing.md` — independent boot, content and metadata trust, rotation and firmware maintenance
- `reference/` — the contracts of the product's behaviour on a device
  - `access.md` — debug and maintenance access: channels, authentication, lockdown layers
  - `api.md` — management API: ownership, authentication, tasks and isolated UI hosting
  - `boot.md` — U-Boot signed FIT selection, redundant native records and health confirmation
  - `diagnostics.md` — system information, observed network state, board telemetry and the bounded redacted support snapshot
  - `management.md` — management plane: what is fixed about micad and the API, and where each edge is specified
  - `manufacturing.md` — factory inputs, per-device result records, quarantine, RMA without identity cloning, debug and fuse policy
  - `recovery.md` — reset tiers, interrupted retry, credential and presence gates, shared-store recovery limits
  - `release-lock.md` — a pointer to the release lock's specification in `mica-build-tools`
  - `remote.md` — what reaches the device today, the NAT requirement, the designed fleet protocol and update control flow
  - `ro-root.md` — read-only root: squashfs and dm-verity packing and boot wiring
  - `storage.md` — partitions and DATA namespaces: status surface, wear reporting, low-space policy and data-lifecycle decisions
  - `time.md` — RTC, saved clock floor, NTP synchronization and timezone management
  - `updates.md` — deployment lifecycle: state model, acquisition, installation, policy, reboot gate and fault evidence
  - `wifi.md` — Wi-Fi station and access point as two micad reconcilers driving wpa_supplicant and hostapd
- `releases/` — how releases are identified, made, distributed and supported
  - `how-releases-work.md` — how a release is cut in each repository, what it carries, and what decides a rebuild
  - `release-notes.md` — how releases are identified and where release facts come from
  - `support.md` — support tiers, lifecycle ownership, and what a support case needs
- `website/` — micaos.dev content briefs, one per page
  - `contract.md` — the website content contract: page set, tone, claims policy
  - `documentation.md` — page brief: the portal into the user documentation set
  - `downloads.md` — page brief: selecting a release and the image for a board
  - `embedded.md` — page brief: why Mica OS is not a generic server/cloud OS
  - `hardware.md` — page brief: whether a visitor's board runs Mica OS, at what tier
  - `licensing.md` — page brief: the license facts the site must carry
  - `product.md` — page brief: what Mica OS is, in one honest screen
  - `security.md` — page brief: the security posture, stated exactly as it is
  - `support.md` — page brief: what support exists and who owns what
- `contributing.md` — the contract behind this set: audience, page ownership, truth-status taxonomy, evidence rules
- `decisions/` — dated product decisions with review sunsets
- `zh/` — the Chinese guides, in the same layout: `start/`, `operate/`, `integrate/`, `hardware/`,
  `security/`, `releases/`. English is authoritative; `zh/README.md` carries the coverage table.

`make docs-verify` checks catalog membership in both directions, internal
links, truth-status evidence, board pages and Chinese coverage;
`make docs-verify-world` checks the claims these documents make about other
repositories, and that every `<repository>:<path>` citation resolves. A
records change runs as one gated sequence,
`bash tools/docs/record.sh --edit <script> --message <file> -- <path>...`:
it applies the edit, refuses a named path that did not change, runs the gate,
stages only the named paths, commits and pushes, so a commit can neither
skip the gate nor claim an edit that did not land. Add or remove a catalog row
in the same change as its document.
