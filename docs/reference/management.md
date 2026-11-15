# Management plane: micad

One daemon, `micad`, owns a device's configuration and turns it into running
services; one API server, `mica-apid`, exposes it to operators and serves the
web console. Both ship as a core component in the device's core set, so a
new management plane reaches a device without a new root. This page explains
what micad does, in what order and with which files; the settings it holds are
[the settings tree](settings.md), and the API in front of it is [API](api.md).
The design, the bus interface and every path are
`mica-core:docs/mica-core.md` section 3.

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
  the applied state: hostname, network, WireGuard, SSH, Wi-Fi client and
  access point, containers, the user's services, MQTT, time, logging, the web
  listener, LAN discovery (mDNS, SSDP), cloud administrators, Bluetooth.
- **The product decides what exists.** `/usr/lib/mica/product.conf` in the
  signed root names the product, its features and its init. A feature the
  product does not carry has no reconciler, no bus member and no API route; its
  routes answer 404.
- **Either init.** A product runs systemd or OpenRC, chosen when its root is
  composed; micad drives the same services through each. On OpenRC the network
  reconciler refuses VLAN and bridge interfaces.
- **Fail closed on the medium.** micad refuses to start when the DATA medium
  holding `/mica/config` is absent: a device that cannot read its
  configuration must not render another.
- **Optional.** A product without the feature `micad` composes no daemon; its
  root still boots, runs and updates. So every service micad drives is Base's
  to start: it reads a file on DATA at boot, which micad writes, and micad
  restarts or stops it, never enabling or disabling it.

> status: shipped — evidence: `mica-core:docs/mica-core.md`, `mica-core:crates/micad-settings/src/configuration.rs`, `mica-build:boards/products.md`

## Startup, step by step

The daemon runs as `micad daemon` (both inits' units run it); a bare `micad`
prints the usage and exits 2. In order:

1. `--version` is answered before anything is read.
2. micad connects to the system bus and owns `com.mica.micad` without queueing
   or replacement. A second micad prints `micad is already running` and exits 1,
   having read and written nothing.
3. The settings are loaded. micad stops here when the DATA medium holding
   `/mica/config` is not there.
4. A staged reset and a boot recovery intent are applied; a staged provisioning
   document is imported; first-boot provisioning mints identity and
   credentials.
5. The product file is read and the reconcilers are built.
6. The reconcilers that only render files and make bus calls (hostname,
   network, web) are applied once.
7. The bus interface is served and micad reports ready (`READY=1`).
8. The reconcilers that start or restart another service (sshd, Wi-Fi client
   and access point, containers, MQTT, time, Bluetooth) and the mDNS and SSDP
   responders are applied, and again every 10 s while one fails, for up to five
   minutes.

So micad's readiness waits on no other service. The container reconciler waits
for `mica-containerd`; on OpenRC `rc-service start` waits for the service and
what it needs.

| Variable | Default | Meaning |
|---|---|---|
| `MICAD_SETTINGS_PATH` | `/var/lib/mica/settings.toml` | the STATE document (identity, credentials, claim) |
| `MICAD_CONFIG_DIR` | `/mica/config` | the configuration documents on DATA |
| `MICAD_BUS` | `system` | `system` or `session` |
| `MICAD_SHADOW_PATH` | `/etc/shadow` | where a transient root password goes |
| `MICAD_META_MANIFEST_PATH` | `/usr/share/mica/meta/updates/manifest.json` | the baked update configuration |
| `MICAD_UPDATE_POLICY_PATH` | `/mica/config/updates.json` | the operator's [update policy](updates.md#the-policy-document) |
| `MICAD_PROVISIONING_ROOT` | `/run/mica/provisioning` | where offline provisioning media are staged |
| `MICAD_DEFAULTS_DIR` | `/usr/share/mica/defaults` | the board's default settings |
| `MICAD_DRY_RUN` | unset | `1`: no provisioning, no reconcilers, no host access (tests) |

## The product file

`/usr/lib/mica/product.conf` is written when the root is composed and is
authenticated with it. micad reads these lines:

| Line | Values | Effect |
|---|---|---|
| `PRODUCT` | the product's name | a deployment must be built for it |
| `FEATURES` | words | `wifi`, `bluetooth`, `ssh`, `containers`, `mqtt` decide which reconcilers, bus members and API routes exist; a write to the subtree of a missing one is refused `feature not in this product`, its routes answer 404. No file or no line serves every feature. The same words select the core components at boot (`micad`, `ui`) |
| `INIT` | `systemd` (default), `openrc` | which backend drives services; any other value stops micad |
| `CONTAINER_ENGINE` | `podman` (default), `docker` | the container backend; any other value stops micad |
| `DOCS_URL`, `DOCS_URL_EN` | `https://…/`, at most 512 characters | the console's Help links (`operate/troubleshooting/`, `operate/recovery/`, `operate/updates/` under them); reported as `docsUrl`, `docsUrlEn` by `GET /api/v1/meta` |
| `CLAIM_DEVICE_CODE` | `required`, `off` | whether the console's claim asks for the device code; only `off` turns it off |
| `MDNS`, `SSDP` | `on` (default), `off` | announce on the LAN while `access.mdns.enabled` / `access.ssdp.enabled` are unset |
| `CLOUD_ADMINS` | `on`, `off` (default) | whether the cloud's SSH users are administrators while `access.cloudAdmins.enabled` is unset |
| `SSH_SERVER` | `dropbear` (default), `openssh` | Base's choice; micad does not read it |
| `SSH` | `on`, `off` | whether SSH starts on at first boot; off when absent |

## Reconcilers

Each reconciler owns one subtree, converges the system to it and returns the
applied state into the live-state tree under its name. What each writes:

| Reconciler | systemd | OpenRC |
|---|---|---|
| `hostname` | `/etc/hostname`, hostnamed | `/etc/hostname`, `sethostname(2)` |
| `network` | networkd `50-mica-*` `.network`/`.netdev` under `/run/systemd/network` (linked to `/var/lib/mica/network/networkd` on DATA) | `/var/lib/mica/network/interfaces` for busybox ifupdown; WireGuard over netlink; VLAN and bridge refused |
| `dns` | `/run/mica/hosts` (`/etc/hosts` links there), `/run/systemd/resolved.conf.d/60-mica-dns.conf` | the same hosts file; `/var/lib/mica/dns/resolv.global` |
| `sshd` | `/var/lib/mica/ssh/sshd.env`, authorized keys of `root` and `mica`, `mica-sshd.service` | the same, `mica-sshd` |
| `wifi_client` | `/etc/wpa_supplicant`, `wpa_supplicant@<if>`, networkd DHCP | `/var/lib/mica/wpa_supplicant`, `/var/lib/mica/wifi/client.env`, `mica-wifi-client` |
| `wifi_ap` | `/etc/hostapd`, `hostapd@<if>`, networkd address and DHCP server | `/var/lib/mica/hostapd`, `/var/lib/mica/wifi/ap.env`, busybox udhcpd, `mica-wifi-ap` |
| `container` | starts `mica-containerd.service` and hands it the projects as one set | the same, `mica-containerd` |
| `mqtt` | `/var/lib/mica/mqtt/broker.toml`, `mqttd-device.env`, `mica-mqtt-broker.service`, `mica-mqttd.service` | the same files and services |
| `time` | `/var/lib/mica/time/timesyncd.conf`, `/run/mica/timezone` | `/var/lib/mica/time/ntpd.conf`, `mica-ntpd` |
| `logging` | `/var/lib/mica/log/log.env`, checked with Base's `mica-log-env`, `mica-log-settings.service` | the same, `mica-syslogd` |
| `web` | `/run/mica/apid.json`; `apid.service` started for `network`/`local`, stopped for `off` | the same, `apid` |
| `mdns`, `ssdp` | micad's own responders | the same |
| `services` | the user's units through `mica-unit` in `/usr/local/lib/systemd/system` | scripts in `/usr/local/etc` |
| `bluetooth` | `bluetooth.service`, the adapter's power and name, each declared device's trust | the same through `mica-bluetoothd` |

The services the Wi-Fi, container and MQTT reconcilers enable are also listed
in `/var/lib/mica/units/enabled` on DATA, one per line; Base's `mica-units`
starts every listed unit at boot, with or without micad, so they come back as
last configured even though the root is read-only.

**Network apply.** A network write replaces the `50-mica-*` units whole and
reloads networkd. It then waits up to 30 s for each interface whose units
changed (configured, or `routable`, `degraded` or `enslaved`; a link without
carrier is not waited for). When one fails or times out, the previous units go
back, the task fails naming the interface, and the stored network map returns
to the last one applied. So a wrong address cannot strand a device. Every DHCP
link micad renders also gets a link-local fallback (`169.254.0.0/16`), a route
metric (100 for the first in name order, then 110, 120 …; the Wi-Fi client's
lease 600) and the lease's MTU. A wired `eth*` port the map does not declare
gets DHCP from `60-mica-auto-<iface>.network`.

**Wi-Fi roles.** The station and the access point share one radio and take
turns. The station is on by default with no network, so a scan works before
one is chosen. An access point on the station's interface reports `conflict`
and does not start.

## The bus interface

Bus name `com.mica.micad`, object `/com/mica/micad`, interface
`com.mica.micad1`; values are JSON strings. The bus policy makes it root-only in
both directions, because `SettingsChanged` carries setting values. A value the
tree refuses is `org.freedesktop.DBus.Error.InvalidArgs`.

| Group | Members |
|---|---|
| Settings and state | `GetSettings`, `SetSettings`, `SetSettingsMany`, `GetTask`, `GetState`, `ReportHealth`, `ForgetService`; signals `SettingsChanged`, `TaskChanged` |
| Observation | `GetNetworkState`, `GetObservedNetwork`, `GetTimeStatus`, `GetStorageStatus`, `GetStorageMedia`, `GetSystemInfo`, `GetDeviceCode`, `GetTelemetry`, `GetFailureEvidence`, `GetLog`, `GetLogOfBoot`, `GetContainers`, `GetContainerLog`, `ScanWifi`, `TestDnsServers`, `GetDnsProbe`, `ProbeDns`, `GetBluetooth` |
| Actions | `Reboot`, `PowerOff`, `SetTransientRootPassword`, `RotateWireguardKey`, `UnmountMedia`, `EjectMedia`, `FactoryReset`, `GetFactoryReset` |
| Claim and BLE provisioning | `Claim`, `AdminPasswordSet`, `AdminLoggedIn`, `GetBleProvisioning`, `OpenBleProvisioning`, `CloseBleProvisioning` |
| Updates | `GetUpdateState`, `CheckUpdate`, `FetchUpdate`, `ImportUpdate`, `InstallUpdate`, `InstallLatestUpdate`, `ConfirmDeployment`, `RejectDeployment`, `RollbackDeployment`, `SetRebootOverride`, `SetUpdateConfig` |
| The user's services | `GetUnits`, `StartUnit`, `StopUnit`, `RestartUnit`, `GetUnitLog` |
| Owner certificates and driver extensions | `GetOwnerCerts`, `AddOwnerCert`, `RemoveOwnerCert`, `GetExtensions`, `InstallExtension`, `InstallExtensionFiles`, `RemoveExtension`, `DropExtension` |
| Containers and Bluetooth | `CheckContainerProject`, `CheckContainerProjectIn`, `StartContainer`, `StopContainer`, `RestartContainer`, `SetBluetoothDiscovery`, `OpenBluetoothPairWindow`, `CloseBluetoothPairWindow`, `PairBluetoothDevice`, `ConfirmBluetoothPairing`, `SetBluetoothDeviceFlag`, `RemoveBluetoothDevice` |

Named errors: `com.mica.micad1.Error.AlreadyClaimed` (a second claim),
`WifiLocked` (a write reaching `wifi` while BLE provisioning holds the radio;
apid answers 423 `wifi_locked`), `FactoryResetRefused` and `DriversRefused`
(each with a JSON `{code, message}` description).

An application reports its health with `ReportHealth(component, status, why)`;
a `blocking` status closes the update reboot gate until it is cleared
([updates](updates.md#the-policy-document)). Other `com.mica.*` services are
recorded as they appear and vanish on the bus.

## Writes are tasks

`SetSettings` validates the write against the whole tree, records it in a
fsynced undo journal, saves the documents and returns a task id; `TaskChanged`
reports the task's progress. A task's `kind` is `network.apply` when it reaches
the network and `settings.apply` otherwise; its `phase` goes `saved`,
`applying`, `applied`. A finished network apply names the `interfaces` it added,
changed or removed. A failed apply names its reason, and the network map is
rolled back as above.

## Observation

Every observer reports absence with a reason rather than a healthy-looking
value:

| Reading | Source |
|---|---|
| Network | networkd `Describe`, wpa_supplicant and hostapd sockets, resolved; on OpenRC sysfs, busybox `ip`, `/run/mica/resolv.d`. Each IPv4 default route is marked `effective` when it is the one `ip route get 1.1.1.1` would take |
| Name resolution | `0.debian.pool.ntp.org` looked up every 60 s and on demand within 3 s, uncached: `{ok, name, latencyMs, checkedAt, detail?}` |
| Time | timesyncd; on OpenRC whether `mica-ntpd` runs and the kernel's synchronized bit |
| Storage | tiers from the signed boot policy, binds, use, DATA's project quotas, media health, user mounts and swaps ([storage](storage.md)) |
| System and telemetry | identity, board, kernel, image, packages, the running deployment; thermal zones, watchdogs, the reset reason |
| Failure evidence | failed services and warnings of this boot and the previous one |
| Logs | the newest 200 lines of `micad`, `apid`, `time`, `ssh`, `wifi-client`, `wifi-ap`, `bluetooth`, `mqtt-broker` or `mqttd`, of this boot or the previous; a log kept only in RAM answers `available: false` with the reason |

No password, pre-shared key, WireGuard key, token, pairing code or device code
is ever logged; a refused document's quoted values are replaced by `"…"`.

## Lifecycle

- **Provisioning.** First boot generates identity and per-device credentials on
  the device; nothing secret is baked into an image. A provisioning document on
  the boot medium or removable media is validated whole, applied atomically and
  recorded, so applying it twice is a no-op
  ([manufacturing](manufacturing.md)).
- **Board defaults.** A board may ship `/usr/share/mica/defaults/network.json`.
  Each entry not yet recorded in STATE's `seeded-defaults.json` is added once
  (cx3576 ships `can0` at 250 000 bit/s, `restartMs` 100, `fd` false); an entry
  the operator deletes stays deleted, and a `configuration` reset brings the
  defaults back.
- **Updates.** micad runs `mica-deploy` with bounded time and output, one
  update at a time, and adds the operator's policy ([updates](updates.md)).
- **Power.** Reboot and power-off are recorded with their caller before they
  run.
- **Resets.** A staged reset applies one tier, `configuration` or
  `application-data`, and never opens `/srv` or crosses into a mount; the
  factory reset remakes DATA ([recovery](recovery.md)).
- **Owner certificates and driver extensions.** Each change asks for the
  administrator password again, runs as a task of kind `drivers.apply` and
  takes effect from the next boot ([security overview](../security/overview.md)).

### Factory reset refusals

| Code | When |
|---|---|
| `factory_reset_unsupported` | the booted runkit does not carry the reset out |
| `data_encrypted` | DATA is encrypted |
| `not_claimed` | the device has no administrator |
| `update_in_progress` | an update installs, holds the transaction lock or waits for its reboot |
| `trial_pending` | a deployment or set is on trial |
| `password_required` | an empty password from a caller that is not uid 0 |
| `password_incorrect` | a wrong password |
| `login_throttled` | after 3 wrong passwords each one doubles a wait from 5 s to 300 s (one counter with driver changes) |

## On OpenRC: the files micad hands to Base

| Service | Shipped by | micad writes |
|---|---|---|
| `mica-sshd` | mica-ssh (dropbear) or mica-openssh | `/var/lib/mica/ssh/sshd.env` |
| `mica-wifi-client` | mica-wifi | `/var/lib/mica/wifi/client.env` (`interface`, `config`, `metric`) |
| `mica-wifi-ap` | mica-wifi-ap | `/var/lib/mica/wifi/ap.env`, `/var/lib/mica/wifi/ap-udhcpd.conf` |
| `mica-ntpd` | mica-openrc | `/var/lib/mica/time/ntpd.conf` (`ntp_servers`) |
| `mica-network` | mica-openrc | `/var/lib/mica/network/interfaces` |
| `mica-syslogd` | mica-openrc | `/var/lib/mica/log/log.env` |
| `mica-bluetoothd`, `docker` | mica-bluetooth, mica-docker | nothing |

The SSH environment is the same on both inits, four shell-sourceable lines:

```
SSH_ENABLED=yes
SSH_LISTEN="22"
SSH_PASSWORD=no
SSH_ROOT_LOGIN=yes
```

`SSH_ENABLED` is read by the init at boot, so SSH starts as last configured
without waiting for micad. `SSH_LISTEN` is a bare port (every address) or one
`addr:port` per listen address, IPv6 in brackets. `SSH_PASSWORD` is `yes` only
while password logins are on and a transient root password is active.

## The login prompt

micad writes `/run/mica/device-code.issue`, which Base links into
`/etc/issue.d/`, so the serial console and every local login prompt show it:

```
Device code: XXXX-XXXX-XXX
Console: http://192.168.1.50:8080/
Console: http://mica.local:8080/
```

One `Console:` line per IPv4 address (a link-local one included) and one for
`<hostname>.local`, as `access.web` serves the console. The addresses are read
again every 5 s, so a new lease reaches the prompt within that. A `random`
device code is not shown; the line says how to read it after login.

## Checking micad

| Check | Expect |
|---|---|
| `systemctl status micad` (OpenRC: `rc-service micad status`) | active; a failed start names the reason in the log |
| `micad --version` | the core component's version |
| `GET /api/v1/health` from the API | micad reachable |
| `cat /run/mica/apid.json` | the web listener micad rendered from `access.web` |
| `ls /mica/config/` | the documents written so far (`system.json`, `network.json`, …, `updates.json`) |

When micad does not start, read its log first: a missing DATA medium, an
unknown `INIT` or `CONTAINER_ENGINE` in the product file, or a second instance
each stop it with a named reason ([troubleshooting](../operate/troubleshooting.md)).

## Where the edges are

| Edge | Contract |
|---|---|
| Operators and automation | the HTTP API and the console: [API](api.md), [console](../integrate/console.md) |
| Shell access | [access](access.md) |
| Settings | [the settings tree](settings.md) |
| Updates | micad drives the deployment client and adds the operator's policy: [updates](updates.md) |
| Applications | containers declared in the settings tree, the user's services, and native packages: [containers](../integrate/containers.md), [native applications](../integrate/native-applications.md) |
| Application data | the local bus and MQTT carry application data only, never configuration or credentials: [bus](../integrate/bus.md) |
| First boot | identity and credentials are minted on the device: [provisioning](../integrate/provisioning.md) |

> status: shipped — evidence: `mica-core:docs/mica-core.md`
