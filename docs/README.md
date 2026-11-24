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
| Understand how releases are identified | [Release notes](releases/release-notes.md), [0.0.9 round](releases/notes-0-0-9.md), [releasing](releases/how-releases-work.md), [release lock](reference/release-lock.md) |

## Naming

The product is **Mica OS** (identifier `mica`). Package, binary, service, bus
and path names use the `mica` prefix — `micad`, `mica-deploy`, `com.mica.micad`,
`/mica/config` — and documents quote them verbatim.

## Where documentation lives

This repository holds **the product**: what Mica OS is and how its parts fit
together, the user and integrator documentation, the supported hardware and
its assurance, the design contracts of the product's behaviour on a device
and the website briefs behind micaos.dev. A module's design and documentation
live in the repository that produces it.

| Here | Elsewhere |
|---|---|
| what the product is, and how the parts fit together (`architecture.md`) | how a module is built, tested and released: that module's repository |
| how a device behaves: updates, storage, access, the API, applications | the code and its own design: `mica-core:docs/mica-core.md`, `mica-pkgs:docs/mica-pkgs.md`, `mica-podman:README.md`, `mica-docker:README.md`, `mica-system-base:docs/floor-and-options.md` |
| the boards a user can run, at what tier, and how to flash them | the board contract, porting and the image build: `mica-build:boards/README.md`, `mica-build:docs/design/` |
| how a user verifies a release | the release lock, its vectors, package versions and the build rules: `mica-build-tools:docs/spec/` |

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
  - `mica-app.md` — the Mica app for Android: Bluetooth setup and managing a device over the network
  - `faq.md` — the questions people ask first, each answered in a few lines with the page that holds the rest
- `operate/` — running a device: configuration, updates, recovery, storage, the API
  - `configuration.md` — the configuration model and every supported way to change settings
  - `network.md` — how-to: wired DHCP and static, a port off the internet, routes, two uplinks and failover, VLANs and bridges, Wi-Fi, DNS, WireGuard end to end
  - `time.md` — how-to: your own NTP servers, the time zone, checking synchronization on each init
  - `ssh.md` — how-to: keys, switching SSH on, the one-boot root password, Compute Engine logins and cloud administrators, locking down
  - `logs.md` — how-to: service logs and the previous boot, keeping and forwarding the log, `mica doctor`, the support summary, bug reports
  - `updates.md` — which update archive applies, online, offline and USB updates, maintenance windows, confirmation, rollback and every refusal
  - `recovery.md` — what to do when a device does not boot, the reset tiers and the factory reset, and what recovery costs
  - `storage.md` — partitions, what survives what, where data belongs, your own disks and external media
  - `mica.md` — the `mica` command: root's one command on the device, its verbs, output and exit codes
  - `troubleshooting.md` — diagnosis: access channels, evidence to read, refusals to interpret
  - `api.md` — the programmatic surface and its machine-readable contract
  - `without-micad.md` — a device without micad: getting in, switching services on with `mica-units`, and each service's file by hand
- `integrate/` — building a product on it: applications, containers, the bus, the console, provisioning, manufacturing
  - `applications.md` — delivering and running applications: native packages and containers
  - `bus.md` — management/application boundary, package-enrolled `com.mica.Item1` applications, D-Bus policy and MQTT grammar
  - `console.md` — the built-in console (`mica-apid-ui`): navigation, state and actions
  - `containers.md` — integrator's guide: the container engine, declaring Compose projects to micad, what the engine does with them, persistence
  - `display.md` — HDMI kiosk UI: cage and WPE rendering `apid` locally
  - `manufacturing.md` — putting Mica OS on units at volume: identity, first credential, factory record and quarantine
  - `native-applications.md` — integrator's guide to native `.deb` applications: units, accounts, writable state, the health gate, devices, ceilings and rollback limits
  - `services.md` — how-to: your own services with `mica unit` on systemd and OpenRC, service accounts, timers, mounts, what survives which reset
  - `drivers.md` — how-to: owner certificates and driver extensions, from the signing identity and the KDK to a kernel update
  - `mqtt.md` — how-to: the broker on and open to the network with passwords, a client, the topics, an application's values on MQTT
  - `discovery.md` — how-to: what mDNS and SSDP announce, finding a device from a computer, switching them, your own service records
  - `cloud.md` — how-to: Compute Engine from the release files or the test family to a claimed, updated instance
  - `provisioning.md` — configuration without a network: first-boot identity, provisioning documents and credentials
- `hardware/` — the supported boards: one page per board, the status table and support tiers, assurance and qualification
  - `README.md` — the board list, a dated state snapshot and the route into each board's page
  - `uefi-x64.md` — generic amd64 UEFI machines: the baseline, booted in every release run, and the Compute Engine image
  - `uefi-arm64.md` — generic arm64 UEFI machines: the carried driver set, and why carrying is not qualifying
  - `cx3576.md` — CX3576-Z / RK3576: features, the rockusb flashing path and what a reported bench boot does not establish
  - `s905x5m.md` — BM201 / S905X5M: features, and why a published image cannot install onto a blank board
  - `qemu-armhf.md` — QEMU's 32-bit Arm virt machine, U-Boot from NOR flash and the root on UBI
  - `mini-x64.md` — small amd64 UEFI machines with 128 MB of flash: one OpenRC product with the management plane, the console and SSH, USB and SD for external media
  - `assurance.md` — boot assurance ladder (I1–I4) and what each level requires
  - `qualification.md` — field-reliability qualification: the matrix and its binding rules
  - `board-template.md` — the board page template: the eleven validated sections
- `security/` — the security posture, the model, the lifecycle and the trust chain
  - `lifecycle.md` — trust material and its custody, owner roles, releases and security response
  - `model.md` — threat and physical-access boundaries, the I1–I4 boot-assurance ladder and honest limits
  - `overview.md` — the security posture: what is protected, by what, and the named gaps
  - `signing.md` — independent boot, content and metadata trust, rotation and firmware maintenance
- `reference/` — the contracts of the product's behaviour on a device
  - `access.md` — how an operator reaches a device: the API, SSH, the consoles, and being locked out
  - `api.md` — management API (apid): web modes, listeners and HTTPS identity, URL space, the local socket, the error envelope and status codes, claim/login/tokens with a worked example, factory reset, owner certs and driver extensions, WireGuard peers, media, UI hosting
  - `boot.md` — boot and the runkit: the chain per board, deployments and trials, `mica-runkit init` stage by stage, core components, the owner keyring, health confirmation, what can go wrong, and the cx3576 signed FIT path
  - `cli.md` — the `mica` command (core 0.0.8 and later): every verb and sub-verb, its channel, options, output, `--json`, exit codes, secret input and `mica internal`
  - `diagnostics.md` — system information, observed network state, board telemetry, the support summary, service logs and the bounded redacted support snapshot
  - `errors.md` — every API error code with its status and meaning, network rule codes, D-Bus error names, update refusals
  - `files.md` — the file map: where identity, boot state, configuration, rendered files, data and signed objects live, and what survives a reboot, update, rollback or reset
  - `glossary.md` — the words this documentation uses with a fixed meaning
  - `http-api.md` — every HTTP API route (103 paths, 134 operations) by area, generated from openapi.json
  - `kernel-features.md` — what each kernel feature enables and which board has it
  - `management.md` — management plane: micad's startup, the product file, reconcilers and what each writes, the bus interface, tasks, observation, lifecycle and factory-reset refusals, the OpenRC hand-off, the login prompt
  - `manufacturing.md` — factory inputs, per-device result records, quarantine, RMA without identity cloning, debug and fuse policy
  - `recovery.md` — reset tiers, the factory reset, interrupted retry, credential and presence gates, shared-store recovery limits
  - `products.md` — the released products: board, init, features, engine, SSH server, images, per-product settings, board facts
  - `release-lock.md` — a pointer to the release lock's specification in `mica-build-tools`
  - `remote.md` — what reaches the device today, the NAT requirement, the designed fleet protocol and update control flow
  - `ro-root.md` — read-only root: squashfs and dm-verity packing and boot wiring
  - `settings.md` — the settings tree: every subtree with keys, types, defaults and limits, the documents under `/mica/config/`, and how a write is checked and applied
  - `storage.md` — partitions per board, what SYSTEM and DATA hold, the write map, quotas, DATA namespaces: status surface, wear reporting, low-space policy, user mounts, external media and data-lifecycle decisions
  - `time.md` — RTC, saved clock floor, NTP synchronization and timezone management
  - `updates.md` — the update engine: how an update runs, state model, acquisition and delta transfer, installation, the policy document, reboot gate, core sets, driver extensions and fault evidence
  - `wifi.md` — Wi-Fi station and access point as two micad reconcilers driving wpa_supplicant and hostapd
- `releases/` — how releases are identified, made, distributed and supported
  - `how-releases-work.md` — how a release is cut in each repository, what it carries, and what decides a rebuild
  - `notes-0-0-9.md` — release notes of the core 0.0.9 round (2026-11-24): what was released, what is new, what is fixed
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
  - `res-product-catalogue.md` — the product catalogue the site reads from the resource service: the two documents, and what each part of the site does with them
  - `security.md` — page brief: the security posture, stated exactly as it is
  - `support.md` — page brief: what support exists and who owns what
- `contributing.md` — the contract behind this set: audience, page ownership, truth-status taxonomy, evidence rules
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
