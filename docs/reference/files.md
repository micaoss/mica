# File map

Where things are on a running Mica OS device: what each path holds, who writes
it, and whether it survives a reboot, an update or a reset. Paths come from
`mica-core:docs/mica-core.md` and `mica-system-base:docs/floor-and-options.md`;
the storage layout behind them is [storage](storage.md).

## Identity and the product

| Path | What | Written by | Lifetime |
|---|---|---|---|
| `/usr/lib/mica/product.conf` | `PRODUCT`, `FEATURES`, `INIT` and the other product lines | the build, in the signed root | changes with the root |
| `/usr/share/mica/device-code.conf` | where the device code comes from | the build | changes with the root |
| `/usr/share/mica/meta/updates/manifest.json` | the baked update policy | the build | changes with the root |
| `/usr/share/mica/defaults/network.json` | the board's default network entries, where it has some | the board package | changes with the root |
| `/etc/machine-id` | the machine identity, read-only bind from DATA | runkit, first boot | until a factory reset |
| `/etc/hostname` | the hostname | micad | DATA |

## Boot state (in memory, this boot only)

| Path | What |
|---|---|
| `/run/mica/boot.json` | the running deployment, kernel, root, verification, backend ([boot](boot.md)) |
| `/run/mica/runkit.json` | what the booted runkit supports (factory reset, DATA encryption) |
| `/run/mica/device-code.issue` | the login-prompt lines: device code and console addresses |
| `/run/mica/apid.json` | the web listeners micad rendered from `access.web` |
| `/run/mica/apid.sock` | the API's local socket for root |
| `/run/mica/media/<id>` | external media micad mounted read-only |
| `/run/mica/hosts` | the hosts file (`/etc/hosts` links here) |
| `/run/mica/watchdog.env` | OpenRC: `WATCHDOG_DEVICE=/dev/watchdog<N>`, the watchdog the runkit armed, which `mica-watchdog` feeds ([boot](boot.md#4-mica-runkit-init-stage-by-stage)); systemd gets `/run/systemd/system.conf.d/50-mica-watchdog.conf` instead |
| `/run/mica/resolv.order` | OpenRC: the order `mica-resolv` builds `resolv.conf` in while an uplink is down, the active uplink's `resolv.d` files first ([network](../operate/network.md)); absent when nothing is steered |

## Configuration (DATA)

| Path | What |
|---|---|
| `/mica/config/*.json` | the operator's settings, one document per concern ([settings](settings.md)) |
| `/mica/config/updates.json` | the operator's update policy |
| `/mica/config/container/<project>.yaml` | each declared Compose project |
| `/var/lib/mica/settings.toml` | what the device minted: identity, credentials, the claim, provisioning state |
| `/var/lib/mica/apid/` | apid's HTTPS identity, session key, login backoff, audit ring |
| `/usr/local/lib/systemd/system/` | the user's systemd units (`mica-unit`) |
| `/usr/local/etc/` | the user's OpenRC scripts and `fstab` |

## Files micad renders for Base (DATA)

| Path | Read by |
|---|---|
| `/var/lib/mica/ssh/sshd.env` | `mica-sshd` |
| `/var/lib/mica/network/networkd/`, `/var/lib/mica/network/interfaces` | networkd, or busybox ifupdown on OpenRC |
| `/var/lib/mica/wifi/client.env`, `ap.env`, `ap-udhcpd.conf` | the Wi-Fi services on OpenRC |
| `/var/lib/mica/time/timesyncd.conf`, `ntpd.conf` | timesyncd, or `mica-ntpd` |
| `/var/lib/mica/log/log.env` | `mica-log-settings` or `mica-syslogd` |
| `/var/lib/mica/mqtt/broker.toml`, `mqttd-device.env` | the MQTT broker and bridge |
| `/var/lib/mica/dns/hosts`, `resolv.global` | `mica-hosts`, `mica-resolv` |
| `/var/lib/mica/units/enabled` | `mica-units`, which starts the listed units at boot |

## Data and work areas (DATA)

| Path | What |
|---|---|
| `/srv` | the user's data; no reset tier opens it |
| `/mica/volumes/<project>/` | a container project's named volumes |
| `/mica/containers/storage` or `/mica/containers/docker` | the container engine's root |
| `/mica/updates/{staging,downloads,verified}` | update downloads and staging |
| `/mica/diagnostics` | diagnostic snapshots |
| `/mica/ui` | uploaded console bundles |
| `/var/log`, `/var` | persistent service state and the log (when kept on DATA) |
| `/home`, `/root` | home directories |

## Signed objects (SYSTEM, read-only)

| Path | What |
|---|---|
| `/mnt/system/deployments/<id>.json` | signed deployment descriptors (at most two) |
| `/mnt/system/kernels/`, `/mnt/system/roots/` | kernel and root objects |
| `/mnt/system/sets/core/` | signed core sets and their components |
| `/mnt/system/extensions/` | driver extensions |
| `/mnt/system/owner-certs/` | enrolled owner certificates |

## What survives what

| Area | Reboot | Update | Rollback | `configuration` reset | `application-data` reset | Factory reset |
|---|---|---|---|---|---|---|
| `/run` | no | no | no | — | — | no |
| `/mica/config` | yes | yes | yes | cleared | kept | cleared |
| STATE (identity, credentials, claim) | yes | yes | yes | kept | kept | cleared |
| containers, volumes, the user's units, service accounts | yes | yes | yes | kept | cleared | cleared |
| `/srv` | yes | yes | yes | kept | kept | cleared |
| SYSTEM deployments | yes | replaced one at a time | switched | kept | kept | all but the running one removed |

A `configuration` reset also removes apid's HTTPS identity. A rollback never
promises to undo application data written since ([reset tiers](recovery.md#2-reset-tiers)).
