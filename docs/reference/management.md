# Management plane

One daemon, `micad`, owns a device's configuration and turns it into running
services; one API server, `mica-apid`, exposes it to operators and serves the
web console. Both ship as a core component of the product's deployment, so a
new management plane reaches a device without a new root. This page states
what the rest of this documentation relies on; the design, the settings tree,
the bus interface and every path are `mica-core:docs/mica-core.md`.

## What is fixed

- **One owner of configuration.** Every read and change goes through micad.
  The API holds no configuration of its own, and no other service writes
  system configuration.
- **Settings are one typed tree**, addressed by dot-paths such as
  `network.eth0.dhcp`. A write is validated against the whole tree, journalled
  and applied as a task; an unknown key or schema version is refused, never
  converted.
- **What an integrator sets lives on DATA** as one JSON document per concern
  under `/mica/config/` ([configuration](../operate/configuration.md)). What the
  device mints about itself (identity, credentials, provisioning state) lives
  in its own state store. A configuration reset clears the first and keeps the
  second ([recovery](recovery.md)).
- **A reconciler per concern** converges the system to its subtree and reports
  the applied state: hostname, network, SSH, Wi-Fi client and access point,
  containers, MQTT, time, the web listener, Bluetooth.
- **The product decides what exists.** `/usr/lib/mica/product.conf` in the
  signed root names the product, its features and its init. A feature the
  product does not carry has no reconciler, no bus member and no API route; its
  routes answer 404.
- **Either init.** A product runs systemd or OpenRC, chosen when its root is
  composed; micad drives the same services through each. On OpenRC the network
  reconciler supports DHCP and static addressing only.
- **Fail closed on the medium.** micad refuses to start when the DATA medium
  holding `/mica/config` is absent: a device that cannot read its
  configuration must not render another.

> status: shipped — evidence: `mica-core:docs/mica-core.md`, `mica-core:crates/micad-settings/src/configuration.rs`, `mica-build:boards/products.md`

## Where the edges are

| Edge | Contract |
|---|---|
| Operators and automation | the HTTP API and the console: [API](api.md), [console](../integrate/console.md) |
| Shell access | [access](access.md) |
| Updates | micad drives the deployment client and adds the operator's policy: [updates](updates.md) |
| Applications | containers declared in the settings tree, and native packages: [containers](../integrate/containers.md), [native applications](../integrate/native-applications.md) |
| Application data | the local bus and MQTT carry application data only, never configuration or credentials: [bus](../integrate/bus.md) |
| First boot | identity and credentials are minted on the device: [provisioning](../integrate/provisioning.md) |

> status: shipped — evidence: `mica-core:docs/mica-core.md`
