# Logs and diagnostics

How to read a service's log, this boot's or the one before; how to keep the
log across reboots, cap it and forward it to a collector; how to collect the
diagnostic snapshot with `mica doctor` and the short support summary; and
what to put in a bug report. The design is in
[diagnostics](../reference/diagnostics.md), the settings in
[settings](../reference/settings.md).

## Before you start

- **A claimed device**, reached through the console (System: logging and
  service logs, diagnostics, information), the API with a token, or `mica`
  on the device as root:

  ```sh
  DEV=http://mica-a4e2e69e.local:8080
  AUTH="Authorization: Bearer mica_<id>_<secret>"   # from: mica tokens create laptop
  ```

- **Where the log lives.** systemd products keep systemd's journal; OpenRC
  products run `mica-syslogd`, read with `logread`. The log is kept on DATA
  across boots by default, except on the raw-NAND (UBI) boards such as
  `qemu-armhf`, where it is in RAM only.
- **Time in the log is UTC**, whatever time zone is set ([time](time.md)).

> status: shipped — evidence: `mica-core:docs/mica-core.md`, `mica-core:crates/micad/src/logs.rs`

## 1. Read a service's log

The console's System, Logs page, or the API: the newest 200 lines of one
service, scrubbed before they leave the device.

```sh
curl -s -H "$AUTH" $DEV/api/v1/system/logs/micad
# {"source":"micad","available":true,"lines":["2026-11-15T09:12:03+0000 micad[412]: ..."],"truncated":false}
curl -s -H "$AUTH" "$DEV/api/v1/system/logs/micad?boot=previous"
```

| Source | Service | Present |
|---|---|---|
| `micad` | the management daemon | always |
| `apid` | the API and console | always |
| `time` | `systemd-timesyncd`, or `ntpd` on OpenRC | always |
| `ssh` | `mica-sshd` | with SSH |
| `wifi-client`, `wifi-ap` | the Wi-Fi client and access point | with Wi-Fi |
| `bluetooth` | Bluetooth | with Bluetooth |
| `mqtt-broker`, `mqttd` | the MQTT broker and the bus bridge | with MQTT |

Your own services have their own log route, `GET /api/v1/units/{name}/logs`
([services](../integrate/native-applications.md)), and each container
project's services theirs ([containers](../integrate/containers.md)).

**On the device as root** the whole log is there, not just the allowlist:

```sh
journalctl -u micad -b              # systemd: this boot
journalctl -u micad -b -1           # the boot before, when it is kept
journalctl -p warning -b            # everything warning and worse
logread | grep micad                # OpenRC
```

A previous boot is there only when the log is kept on DATA; otherwise the
answer is `available: false` with `no previous boot is kept (persistent logs
are off, or none was kept yet)`.

> status: shipped — evidence: `mica-core:crates/micad/src/logs.rs`, `mica-core:crates/mica-apid/src/routes/logs.rs`

## 2. Keep, cap and forward the log

Three settings, in the console's System, Logging page, or with `mica set`, or
`PUT /api/v1/settings/<path>`:

| Setting | Values | Default |
|---|---|---|
| `logging.persistent` | `true`, `false`, or `null` for the default | on; off on raw NAND |
| `logging.maxSizeKiB` | 1024 to 131072, or `null` | a quarter of DATA/var's limit, at most 32 MiB |
| `logging.remote` | `{enabled, address, port, protocol}` | off; port 514, `udp` |

**Keep the log across reboots, capped at 16 MiB:**

```sh
mica set logging.persistent true
mica set logging.maxSizeKiB 16384
```

**Forward everything to a syslog collector** at 192.0.2.50:

```sh
mica set logging.remote '{"enabled": true, "address": "192.0.2.50", "port": 514, "protocol": "udp"}'
```

The same through the API:

```sh
curl -s -H "$AUTH" -X PUT $DEV/api/v1/settings/logging.remote \
  -H 'content-type: application/json' \
  -d '{"enabled": true, "address": "192.0.2.50", "port": 514, "protocol": "udp"}'
# {"taskId":"<id>"}
```

Forwarding is plain syslog, never encrypted: keep the collector on a network
you trust, or behind a WireGuard tunnel ([network](network.md) section 9).
The collector is an IP address, never a host name. `tcp` works on systemd
products only. Switched off, the collector is kept, so switching back on
restores it.

**Check it worked:**

```sh
mica get logging
curl -s -H "$AUTH" $DEV/api/v1/state/logging
# {"supported":true,"valid":true,"persistent":true,"persistentSource":"setting",
#  "maxSizeKiB":16384,"maxSizeKiBSource":"setting","maxSizeKiBLimit":...,
#  "remote":{"enabled":true,"address":"192.0.2.50","port":514,"protocol":"udp"},...}
```

The state shows the values in effect: `persistentSource` and
`maxSizeKiBSource` say whether your setting or the default decided.

> status: shipped — evidence: `mica-core:crates/micad-settings/src/model/logging.rs`, `mica-core:crates/micad/src/reconciler/logging.rs`

## 3. The diagnostic snapshot: `mica doctor`

One JSON file with what support needs: the device's identity and versions,
the deployment and update state, warning-and-worse lines from this boot and
the one before, failed services and tasks, storage and time status, the
network as observed, and telemetry. Credentials, tokens, keys, Wi-Fi secrets,
SSIDs, MAC addresses and user content are removed; IP addresses and the
machine id stay.

**On the device:**

```sh
mica doctor
# /mica/diagnostics/3.json
```

**In the console:** System, Diagnostics, Generate snapshot, then download it.

**With the API:**

```sh
curl -s -H "$AUTH" -X POST $DEV/api/v1/diagnostics/snapshots
# 201 {"snapshot":{...},"elapsedMillis":...,"sections":...,...}
curl -s -H "$AUTH" -OJ $DEV/api/v1/diagnostics/snapshots/3
# saves mica-diagnostics-<machine id prefix>-3.json
```

**Check it worked:** read `collection.sections` in the file. A section that
is `unavailable` or `timeout` is evidence too; report it, do not treat it as
healthy.

Collection takes at most 20 s, one at a time (a second one is 409
`diagnostics_busy`). The device keeps at most 8 snapshots, 16 MiB in total,
dropping the oldest, and sends them nowhere. Delete one when the case is
closed: `DELETE /api/v1/diagnostics/snapshots/3`.

> status: shipped — evidence: `mica-core:crates/mica-apid/src/diag_cli.rs`, `mica-core:docs/mica-core.md`

## 4. The support summary

A short JSON for a first reply: board, kernel, product and component
versions, the running deployment, uptime, the zone and synchronization, the
integrity items, DATA's readiness and space, and the last update failure's
code. It carries no machine id, host name, addresses, codes, credentials,
logs or settings, so it is safe to paste into an issue.

```sh
curl -s -H "$AUTH" $DEV/api/v1/system/support-info
```

In the console: System, Information, support summary (copy or download, as
`mica-support-<UTC time>.json`).

> status: shipped — evidence: `mica-core:crates/mica-apid/src/routes/support_info.rs`, `mica-core:docs/mica-core.md`

## 5. What a bug report carries

1. The support summary (section 4), or the snapshot (section 3) when support
   asks for it.
2. The product and release (`mica status`), and the board.
3. What you did, what you expected, what happened, and when it was first seen
   (in UTC; say so if `mica time` was not `synchronized`).
4. The exact error: the API's `{"error": {...}}` body or the `mica` line.
5. Any setting changed just before the problem.

Never attach passwords, tokens, private keys, or files from `/srv` or
`/home`. What is supported, and for how long, is [support](../releases/support.md).

> status: shipped — evidence: `docs/reference/diagnostics.md`

## 6. What can go wrong

| You see | Why | Fix |
|---|---|---|
| 422 `validation_failed` on a log read | a source this product does not carry, or `boot` other than `current`/`previous` | pick a source from section 1 |
| `available: false`, no previous boot kept | the log is in RAM, or this is its first kept boot | `mica set logging.persistent true` |
| `logging.maxSizeKiB is ...; a cap is 1024 to 131072 KiB, ...` | the cap is out of range or above half of DATA/var's limit | a smaller value, or `null` |
| `logging.remote.address "..." is not an IP address: ...` | a host name | the collector's address |
| `forwarding is on, but logging.remote.address names no collector` | `enabled` without an address | add `address` |
| `logging.remote.protocol tcp: an OpenRC device forwards its log over UDP only` | `tcp` on an OpenRC product | `udp` |
| 409 `diagnostics_busy` | a snapshot is being collected | wait, then list the snapshots |
| 500 `diagnostics_io` | the store is unwritable, or the snapshot is over 2 MiB | read `mica status` for DATA; delete old snapshots |
| Nothing at the collector | a firewall or route on the way, or the collector listens on TCP | `GET /api/v1/state/logging`, then the collector's side |

> status: shipped — evidence: `mica-core:crates/micad-settings/src/model/logging.rs`, `mica-core:crates/mica-apid/src/routes/logs.rs`
