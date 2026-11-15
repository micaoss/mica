# Glossary

The words this documentation uses with a fixed meaning, in alphabetical order.
Each points to the page that explains it.

| Term | Meaning |
|---|---|
| **apid** | `mica-apid`, the HTTP API server and web console host; micad's executable under another name, in the same core component ([API](api.md)) |
| **Base** | `mica-system-base`, the pinned package floor every root is composed from, including the init (`mica-systemd` or `mica-openrc`) and the scripts micad's files feed |
| **board** | a hardware target with its kernel, loader, partition layout and packers, such as `cx3576` or `uefi-x64` ([hardware](../hardware/README.md)) |
| **candidate** | an installed deployment that has been activated and waits for confirmation ([updates](updates.md)) |
| **channel** | the line of core sets a device follows, `general` unless set otherwise (`channels.core`) |
| **claim** | giving an unclaimed device its first administrator password, through the console, a provisioning document or BLE ([API](api.md#31-claiming-and-logging-in)) |
| **confirmation** | the health gate marking the booted deployment good; it becomes `current` ([boot](boot.md)) |
| **core component** | a verity image of one core package (`micad`, the console) composed over the root's `/usr` and `/etc` at boot |
| **core set** | a signed set of core components for one channel and architecture; every device has one ([updates](updates.md#core-sets)) |
| **DATA** | the writable partition (or UBI volume) holding state, configuration, containers, logs and user data ([storage](storage.md)) |
| **deployment** | a signed pairing of a kernel/support component and a root; a device keeps at most two |
| **descriptor** | the signed JSON document that defines a deployment, its objects, product and generation |
| **device code** | the code printed on a device's label, derived from the hardware (or drawn at random on GCP), used to claim it and to derive the factory access-point key |
| **driver extension** | out-of-tree modules and firmware for exactly one kernel, in a signed verity image, enabled through the owner keyring |
| **fallback** | the retained usable deployment the loader boots when a candidate fails |
| **factory reset** | erasing DATA and returning to the running deployment, unclaimed ([recovery](../operate/recovery.md)) |
| **feature** | a word in `FEATURES` of `product.conf` that decides which services, routes and core components a product has ([products](products.md)) |
| **generation** | a release's monotonic number; a device never installs one at or below what it runs |
| **health gate** | the boot-time check that confirms a deployment after required services pass |
| **kernel feature** | a kernel configuration fragment a board's kernel merges ([kernel features](kernel-features.md)) |
| **micad** | the management daemon that owns configuration ([micad](management.md)) |
| **mica-deploy** | the native deployment client that installs, confirms, rolls back and collects garbage |
| **MICAUPD1** | the offline update archive format, `.micaupd` |
| **owner certificate** | a certificate the device's owner enrols so the kernel accepts the owner's signed driver extensions |
| **pair** | a deployment and a core set installed and tried together |
| **product** | a released image recipe, `<board>.<variant>` ([products](products.md)) |
| **reconciler** | the part of micad that turns one settings subtree into system configuration |
| **reset tier** | `configuration` or `application-data`: which part of DATA a reset clears |
| **root** | the read-only SquashFS userspace under dm-verity ([read-only root](ro-root.md)) |
| **runkit** | `mica-runkit`, the signed initramfs's PID 1 that authenticates and mounts everything before the init ([boot](boot.md)) |
| **settings tree** | the typed configuration micad holds, addressed by dot-paths ([settings](settings.md)) |
| **STATE** | the protected part of DATA where the device keeps what it mints (identity, credentials, the claim) |
| **support image** | `support.img`, the kernel's modules and firmware, paired with the kernel |
| **SYSTEM** | the partition (or UBI volumes) holding the signed deployments, roots, kernels and core sets |
| **task** | the record of one applied write, followed at `/api/v1/tasks/{id}` |
| **transfer index** | `<object>.index` (`MICAIDX1`), which lets a device assemble an object from chunks it holds |
| **trial** | the three boots a candidate gets to be confirmed |
| **update root** | the URL a device checks for releases, `https://res.micaos.dev/update/` by default |
| **user mount** | a disk the operator mounts at an allowed place, such as `/srv` or the engine root ([storage](storage.md#user-mounts)) |
| **web mode** | `access.web.mode`: who reaches the API, `network`, `local` or `off` |
| **write map** | the list of paths a running device can write ([storage](storage.md#the-write-map)) |
