# The settings tree

Everything an operator configures on a Mica OS device is one typed tree held by
[micad](management.md). The API, the console and the device's command line all
read and write it by dot-path, such as `network.eth0.dhcp` or
`access.ssh.enabled`. This page lists every subtree with its keys, types,
defaults and limits, says which file holds it, and shows how a write is checked
and applied. The source is `mica-core:crates/micad-settings/src/model.rs` and
the files beside it; the contract is `mica-core:docs/mica-core.md` section 3.3.

## Where it is stored

What an integrator sets lives on DATA, one JSON document per concern in
`/mica/config/` (directory `0700`, documents `0600`). What the device mints
about itself (identity, credentials, the claim, provisioning state, a staged
reset) is `/var/lib/mica/settings.toml` on STATE. The update policy is a
separate document, `/mica/config/updates.json`
([the update engine](updates.md#the-policy-document)).

| Document | Subtrees it carries |
|---|---|
| `system.json` | `hostname`, `access.console`, `access.web`, `access.mdns`, `access.ssdp`, `access.cloudAdmins` |
| `network.json` | `network` |
| `dns.json` | `dns` |
| `wifi.json` | `wifi` |
| `ssh.json` | `access.ssh` |
| `mqtt.json` | `mqtt` |
| `time.json` | `time` |
| `container.json` | `container` (each project's Compose text is its own file, `container/<project>.yaml`) |
| `bluetooth.json` | `bluetooth` |
| `services.json` | `services` |
| `logging.json` | `logging` |

Every document has its own `schema_version` (1 for all of them today). An
unknown key or version is refused, never converted. A document that does not
parse disables only the subtrees it carries; the rest of the device keeps
working. A key that is absent takes its default, and many defaults are not
written out, so a fresh document is short.

A `configuration` reset clears `/mica/config/` and keeps STATE
([recovery](recovery.md)).

## How a write works

1. The caller names a path and a JSON value: `SetSettings` on the bus (root on
   the device), or the API. Missing map entries on the way are created (writing
   `network.eth1.dhcp` creates `eth1`). Over the API, the generic
   `PUT /api/v1/settings/<path>` accepts fourteen paths and no others:
   `hostname`, `access.ssh.enabled`, `access.mdns.enabled`,
   `access.ssdp.enabled`, `access.cloudAdmins.enabled`, `container.enabled`,
   `mqtt.enabled`, `wifi.client.enabled`, `wifi.ap.mode`, `time.ntp.servers`,
   `time.timezone`, `logging.persistent`, `logging.maxSizeKiB` and
   `logging.remote`; `PATCH /api/v1/settings` writes several of them at once.
   Every other subtree has its own route, which checks more
   than the type: `/api/v1/network/{iface}` and its peers, `/api/v1/dns/…`,
   `/api/v1/wifi/…`, `/api/v1/ssh/authorized-keys`, `/api/v1/web`,
   `/api/v1/container-projects/{project}`, `/api/v1/units/{name}`,
   `/api/v1/bluetooth/…`, `/api/v1/mqtt` ([API](api.md)).
2. The whole tree is validated with the new value in it: types, limits and
   cross-checks (a VLAN's parent must be declared, a static gateway must be in
   its subnet). A refusal leaves the tree unchanged and quotes the rule.
3. The change goes through a fsynced undo journal and the affected documents
   are saved.
4. A task applies it. Its `kind` is `network.apply` when it reaches the network,
   `settings.apply` otherwise; its `phase` goes `saved`, `applying`, `applied`.
   Read it with `GET /api/v1/tasks/<id>`.
5. A network apply that does not converge within 30 s is rolled back to the
   last applied map, and the task fails naming the interface.

A subtree whose feature the product lacks (`wifi`, `bluetooth`, `ssh`,
`containers`, `mqtt`) is refused with `feature not in this product`.

## `hostname`

| Key | Type | Default |
|---|---|---|
| `hostname` | string | `mica` |

The hostname is also the Bluetooth adapter's name, the mDNS name
(`<hostname>.local`) and the name `127.0.1.1` resolves to.

## `network.<iface>`

A map from interface name (at most 15 characters, a name the kernel could
have) to its entry.

| Key | Type | Default | Notes |
|---|---|---|---|
| `kind` | `physical`, `vlan`, `bridge`, `wireguard`, `can` | `physical` | not written for physical |
| `dhcp` | boolean | `false` | |
| `static.address` | IPv4 CIDR | — | used when `dhcp` is false, e.g. `192.168.1.10/24` |
| `static.gateway` | IPv4 | none | must be in the address's subnet |
| `static.dns` | list of addresses | `[]` | |
| `dns` | list of addresses | `[]` | with `dhcp` only: servers used instead of the lease's |
| `routes` | list of `{destination, gateway?, metric?}` | `[]` | `destination` in CIDR; `0.0.0.0/0` beside a `static.gateway` is refused; a default route's `metric` is 20 or more (`route_metric_reserved`), and absent it takes the entry's |
| `internet` | boolean | `true` (`false` on a port the board declares internal) | `false` takes the lease's address and subnet route but never a default route; a static gateway is then refused (`gateway_not_allowed`) |
| `probe.enabled` | boolean | — (no `probe`: off) | the uplink's reachability check; `false` keeps the targets. Physical, bridge and VLAN entries that may carry the default route only (`probe_not_allowed`) |
| `probe.targets` | list of `{address, method, port?}` | `1.1.1.1` and `8.8.8.8`, `tcp` to 53, stored when the check is enabled with none | 1 to 4, no duplicates (`probe_targets`); `address` an IPv4 unicast address or `gateway` (`probe_address`); `method` `icmp` or `tcp` (`probe_method`); `port` for `tcp` only, 1 to 65535, absent 443 (`probe_port`) |
| `probe.intervalS` | integer, 2 to 300 | 10 | seconds between rounds (`probe_interval`) |
| `probe.timeoutMs` | integer, 200 to 10 000 | 2000 | less than the interval (`probe_timeout`) |
| `probe.failuresToDown` | integer, 1 to 20 | 3 | failed rounds in a row that take the uplink down (`probe_threshold`) |
| `probe.successesToUp` | integer, 1 to 50 | 5 | good rounds in a row that bring it back (`probe_threshold`) |
| `vlan.parent`, `vlan.id` | string, integer | — | the parent must be a declared, non-CAN entry; systemd only |
| `bridge.ports` | list of entry names | `[]` | each declared and not CAN; systemd only |
| `wireguard.listenPort` | integer | kernel picks | |
| `wireguard.peers` | list | `[]` | see below |
| `can.bitrate` | integer, 1 to 1 000 000 | required | bit/s |
| `can.restartMs` | integer, 0 to 60 000 | never restart | delay after bus-off |
| `can.fd` | boolean | `false` | |
| `can.dataBitrate` | integer, 1 to 8 000 000 | — | required with `fd: true`, refused otherwise |

Static default routes take the metrics 20, 21, ... in entry-name order;
below 20 is the device's own (micad's failover route is metric 10). Enabling
a check makes the device contact its targets every interval out of that
interface ([network](../operate/network.md)).

A WireGuard peer is `{publicKey, allowedIps, endpoint?, persistentKeepalive?,
name?, presharedKey?}`: keys are 32 bytes in base64, `allowedIps` are
addresses or CIDRs, `endpoint` is `host:port`, `name` is a label of at most 64
characters. A default route through a peer is refused: name the networks
behind it. The tunnel's private key is generated on the device and never
appears in the tree. A CAN entry carries no addressing.

A wired port the map does not declare still gets DHCP. A VLAN on an undeclared
parent declares that parent with what the image gives it (`adopted` in a dry
run). A board may add default entries once ([micad](management.md#lifecycle)).

```json
{
  "schema_version": 1,
  "network": {
    "eth0": { "dhcp": true },
    "eth1": {
      "static": { "address": "10.20.0.5/24", "gateway": "10.20.0.1", "dns": ["10.20.0.1"] },
      "routes": [ { "destination": "10.30.0.0/16", "gateway": "10.20.0.254" } ]
    },
    "eth0.100": { "kind": "vlan", "vlan": { "parent": "eth0", "id": 100 }, "dhcp": true },
    "can0": { "kind": "can", "can": { "bitrate": 250000, "restartMs": 100, "fd": false } }
  }
}
```

## `dns`

| Key | Type | Default | Limits |
|---|---|---|---|
| `global.enabled` | boolean | `false` | at least one server while on |
| `global.servers` | list of IPv4 | `[]` | at most 3; not loopback, unspecified, the device's own or repeated; kept while switched off |
| `staticRecords` | list of `{id, hostname, address, comment?}` | `[]` | at most 100; `id` 1–32 of `[A-Za-z0-9_-]`, unique; `hostname` a host name, not `localhost` or the device's own; `address` IPv4; `comment` at most 64 characters |

Global servers replace every interface's servers; the static records go into
the hosts file.

## `access`

| Key | Type | Default | In |
|---|---|---|---|
| `ssh.enabled` | boolean | `false` (first boot follows the product's `SSH=` line) | `ssh.json` |
| `ssh.port` | integer | 22 | |
| `ssh.permitRootLogin` | boolean | `true` | |
| `ssh.passwordAuthentication` | boolean | `true` | offered only while a transient root password is active |
| `ssh.listenAddresses` | list of addresses | `[]` (every address) | at most 10 |
| `ssh.authorizedKeys` | list of `{key, comment?}` | `[]` | `key` is `<type> <base64>`; duplicates refused |
| `console.shellEnabled` | boolean | `false` | the tty3 root shell; only the `debug` profile ships it |
| `web.mode` | `network`, `local`, `off` | `network` | who reaches the API: the network, the device alone, or nobody |
| `web.httpPort` | integer | 8080 | |
| `web.httpsEnabled` | boolean | `false` | with HTTPS on, HTTP only redirects |
| `web.httpsPort` | integer | 8443 | |
| `mdns.enabled` | boolean or absent | the product's `MDNS=` (on) | `system.json` |
| `ssdp.enabled` | boolean or absent | the product's `SSDP=` (on) | |
| `cloudAdmins.enabled` | boolean or absent | the product's `CLOUD_ADMINS=` (off) | |

The administrator password hash, the claim, the device credential and API
tokens (at most 32, hashes only) are in `access` too, on STATE. They are
written by their own API routes (setup, change-password, tokens), never by a
settings write, and a read returns them redacted.

## `wifi`

| Key | Type | Default | Notes |
|---|---|---|---|
| `client.enabled` | boolean | `true` | a running supplicant with no network joins nothing |
| `client.interface` | string | `wlan0` | |
| `client.networks` | list | `[]` | written whole |
| `client.networks[].ssid` | string | — | |
| `client.networks[].psk` | string | none (open) | 8–63 characters, or 64 hex digits |
| `client.networks[].hidden` | boolean | `false` | |
| `client.networks[].priority` | integer | 0 | higher wins |
| `client.networks[].autoConnect` | boolean | `true` | `false` keeps the network without joining it |
| `ap.mode` | `off`, `provisioning`, `always` | `off` | `provisioning`: only while there is no usable uplink |
| `ap.interface` | string | `wlan0` | |
| `ap.ssid` | string | derived from the device identity | |
| `ap.psk` | string | derived from the device credential | never a fleet-wide constant |
| `ap.channel` | integer | 6 | `0` lets it choose; 1–11 in FCC-plan countries, 1–13 elsewhere |
| `ap.countryCode` | string | `US` | regulatory domain |
| `ap.address` | IPv4 CIDR | `192.168.4.1/24` | |
| `ap.holdDownSeconds` | integer | 120 | without an uplink before the AP starts |
| `ap.graceSeconds` | integer | 60 | the AP stays up after the uplink returns |
| `ap.security` | `wpa2-psk`, `wpa2-wpa3`, `open` | `wpa2-psk` | |
| `ap.pool` | `{offset, size}` | every address after the AP's | must not reach the subnet or broadcast address or hold the AP's own |
| `ap.leaseSeconds` | integer ≥ 60 | the DHCP server's | |

On a product with Wi-Fi, first-boot provisioning turns the access point on
(`always`) with the label's SSID and key, and the station off, unless the tree
already names a network to join. While BLE provisioning holds the radio, writes
reaching `wifi` are refused (423 `wifi_locked`).

## `container`

| Key | Type | Default | Limits |
|---|---|---|---|
| `enabled` | boolean | `false` | starts `mica-containerd` and the projects |
| `projects` | map name → Compose text | `{}` | at most 32; names 1–40 of `[a-z0-9_-]`, starting with a letter or digit; each text ≤ 64 KiB, all ≤ 256 KiB |
| project directory | absolute path | `/mica/volumes/<project>/` | where relative host paths resolve |

See [containers](../integrate/containers.md).

## `services`

`units` maps a unit file name (systemd: `.service`, `.socket`, `.timer`,
`.path`, `.target`, `.mount`, `.automount`, `.swap`; a template at most) or an
openrc-run script name to `{kind, text, conf?, enabled}`. `kind` is the init the
text is for; only the product's own is applied. Limits: 32 units, 64 KiB per
text, 16 KiB per `conf` (OpenRC only), 256 KiB in all. An enabled template is
refused. See [native applications](../integrate/native-applications.md).

| Key | Type | Default | Limits |
|---|---|---|---|
| `units` | map name → unit | `{}` | at most 32; all texts and confs together ≤ 256 KiB |
| `units.<name>.kind` | `systemd`, `openrc` | required | only the product's own init is applied |
| `units.<name>.text` | string | required | the unit file or openrc-run script, ≤ 64 KiB |
| `units.<name>.conf` | string or absent | absent | the script's `conf.d` file, OpenRC only, ≤ 16 KiB |
| `units.<name>.enabled` | boolean | `false` | started now and at every boot; refused for a template |

## `mqtt`

| Key | Type | Default |
|---|---|---|
| `enabled` | boolean | `false` |
| `listen.address` | string | `127.0.0.1` |
| `listen.port` | integer | 1883 |
| `auth.enabled` | boolean | `false` |

The broker listens on loopback by default; widening it is a deliberate edit.

## `time`

| Key | Type | Default | Limits |
|---|---|---|---|
| `ntp.servers` | list of names or addresses | `[]` (the image's pool) | at most 8, each ≤ 253 characters |
| `timezone` | IANA zone name | `UTC` | e.g. `Europe/Athens`; presentation only, the clock stays UTC |

See [time](time.md).

## `logging`

| Key | Type | Default | Limits |
|---|---|---|---|
| `persistent` | boolean or absent | the image and board (on; off on raw NAND) | |
| `maxSizeKiB` | integer or absent | a quarter of DATA/var's limit, at most 32 MiB | 1024 to 131 072, and Base holds it to the device's bound |
| `remote.enabled` | boolean | `false` | |
| `remote.address` | IPv4 or IPv6 | — | an address, never a host name |
| `remote.port` | integer | 514 | |
| `remote.protocol` | `udp`, `tcp` | `udp` | `tcp` on systemd only |

The remote collector is kept while switched off. Forwarding is plain syslog,
never encrypted.

## `bluetooth`

| Key | Type | Default |
|---|---|---|
| `enabled` | boolean | `true` |
| `devices` | map address → `{name, trusted, blocked}` | `{}` |
| `provisioning.autoWhenOffline` | boolean | `true` |

Addresses are six hex octets, `AA:BB:CC:DD:EE:FF`. A paired device nobody
declares is removed. The adapter is discoverable and pairable only during a
180 s pairing window.

## `provisioning` and `reset`

Read-only to operators: provisioning status (the applied document's digest and
outcome) and a staged reset tier. They change through provisioning and the
reset API, not through settings writes.

## Reading and checking

| Do | Expect |
|---|---|
| `GET /api/v1/settings/` (an empty path) | the whole tree, secrets redacted |
| `GET /api/v1/settings/network.eth0` | one entry; 404 when the path names nothing, 422 when it is not a dot-path |
| `PUT /api/v1/settings/time.timezone` with `"Europe/Athens"` | `202` with the task id; the task reaches `applied` |
| `PUT /api/v1/settings/network.eth0` | refused: the network is written through `/api/v1/network/eth0` |
| `GET /api/v1/state/<path>` | the live state the reconciler reports, which may differ from the setting while it applies or when it failed |
| `ls -l /mica/config/` on the device | `0600` documents, one per concern written so far |

A refused write answers with the rule it broke; nothing is saved. When a
setting is saved but not in effect, compare `settings` with `state` for the same
path and read the task's message.
