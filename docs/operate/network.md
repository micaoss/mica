# Network

How to put a device on the network you have: wired DHCP or a static address,
a port kept off the internet, extra routes, two uplinks, VLANs and bridges,
Wi-Fi as a client or an access point, DNS, and a WireGuard tunnel to a peer.
Every change goes through micad's settings and is applied by its network
reconciler; the reference for each field is
[settings](../reference/settings.md), and for each route
[the HTTP API](../reference/http-api.md).

## Before you start

- **A claimed device** and a way to reach it: the console at
  `http://<device>:8080` (Network pages), or the API with a token. A token is
  made once, on the device as root or in the console's access page:

  ```sh
  mica tokens create laptop          # prints mica_<id>_<secret>, once
  ```

  The API examples below run on a workstation with these two variables:

  ```sh
  DEV=http://mica-a4e2e69e.local:8080
  AUTH="Authorization: Bearer mica_<id>_<secret>"
  ```

- **Which init the product runs.** systemd products render networkd units;
  OpenRC products (`mini-x64.basic`, `qemu-armhf.basic`) render busybox
  ifupdown's `/etc/network/interfaces`. Both take the same settings, except
  that VLANs and bridges need systemd (section 6).
- **Keep a way back in.** A change that takes away the address you are
  connected through ends your session. On a device you cannot walk to, change
  one port at a time, and keep the console reachable on another.

> status: shipped — evidence: `mica-core:docs/mica-core.md`, `mica-core:crates/micad/src/reconciler/network/render.rs`, `mica-core:crates/micad/src/reconciler/network/ifupdown.rs`

## 1. How a change is applied

A network write stores the entry, then the reconciler renders and applies it,
as a **task**. The write answers `202` with a task id; follow the task until
its `phase` is `applied` and read its `outcome`:

```sh
curl -s -H "$AUTH" -X PUT $DEV/api/v1/network/eth0 \
  -H 'content-type: application/json' -d '{"dhcp": true}'
# {"taskId":"<id>"}
curl -s -H "$AUTH" $DEV/api/v1/tasks/<id>
# ... "phase":"applied", "outcome":"succeeded", "interfaces":["eth0"] ...
```

`PUT /api/v1/network/{iface}` declares or replaces one interface, validated
against the whole map; `DELETE` removes one; `PUT /api/v1/network` replaces
the whole map at once (name the `version` from `GET /api/v1/network` as
`baseVersion` so a concurrent change is refused instead of overwritten). Only
one network task runs at a time: a write while one is applying is refused
with 409 `busy`; retry when it finishes.

**Check it worked**, in the console's Network overview, or:

```sh
mica network                       # on the device: one line per interface
mica network show eth0             # addresses, gateway, DNS
curl -s -H "$AUTH" $DEV/api/v1/network/status
```

A refused write changes nothing. It answers `422` and lists in `details`
every rule the resulting map breaks, each with its interface, field and code;
the codes are in section 10.

> status: shipped — evidence: `mica-core:crates/mica-apid/openapi.json`, `mica-core:crates/micad-settings/src/network_write.rs`

## 2. Wired: DHCP or a static address

A wired port nobody declared takes DHCP from the image. Declare it to change
that.

**DHCP**, optionally with your own DNS servers instead of the lease's:

```json
{"dhcp": true, "dns": ["192.168.1.1"]}
```

**Static**, with a gateway and DNS servers:

```json
{"dhcp": false,
 "static": {"address": "192.168.1.40/24", "gateway": "192.168.1.1",
            "dns": ["192.168.1.1", "9.9.9.9"]}}
```

```sh
curl -s -H "$AUTH" -X PUT $DEV/api/v1/network/eth0 \
  -H 'content-type: application/json' \
  -d '{"dhcp":false,"static":{"address":"192.168.1.40/24","gateway":"192.168.1.1","dns":["192.168.1.1"]}}'
```

In the console: Network → Interfaces → the port → Addressing.

**Check it worked:** `mica network show eth0` prints `address: 192.168.1.40/24`
and `gateway: 192.168.1.1`. If you changed the address you were connected to,
reconnect on the new one.

**What can go wrong:**

| Code | Meaning | Fix |
|---|---|---|
| `gateway_out_of_subnet` | the gateway is not in the address's subnet | fix the prefix or the gateway |
| `address_overlap` | the subnet overlaps another interface's | give each interface its own subnet |
| `validation_failed` | a field's own syntax, such as an address without its prefix | write `address/prefix` |

> status: shipped — evidence: `mica-core:crates/micad-settings/src/model/network.rs`, `mica-core:crates/micad/src/reconciler/network/render.rs`

## 3. A port that is not the way to the internet

A port wired to a machine network, a sensor or a camera should carry its
subnet and never the default route. `internet: false` says so; it is for
physical, bridge and VLAN entries, and is the default on a port the board
declares internal.

- **Static without a gateway** is already enough: no gateway, no default
  route.

  ```json
  {"dhcp": false, "static": {"address": "10.10.0.1/24"}, "internet": false}
  ```

- **DHCP needs `internet: false`**: the port takes the lease's address and
  subnet, but not its gateway.

  ```json
  {"dhcp": true, "internet": false}
  ```

A static gateway, or a `0.0.0.0/0` route, on an interface with
`internet: false` is refused with `gateway_not_allowed`: drop the gateway, or
drop `internet: false`.

**Check it worked:** `mica network show eth1` prints the address and no
`gateway:` line.

> status: shipped — evidence: `mica-core:crates/micad-settings/src/network_write.rs`, `mica-core:crates/micad/src/reconciler/network/render.rs`

## 4. Extra routes

`routes` adds static routes to an interface, beyond the default route a
static gateway writes. A route without a gateway is on-link.

```json
{"dhcp": false,
 "static": {"address": "10.10.0.1/24"},
 "internet": false,
 "routes": [{"destination": "10.20.0.0/16", "gateway": "10.10.0.254"},
            {"destination": "10.30.0.0/16", "gateway": "10.10.0.254", "metric": 50}]}
```

A `0.0.0.0/0` route beside a `static.gateway` is refused: the gateway is
already the default route. On OpenRC a route on a DHCP port is applied once
the lease is bound and removed when it is lost.

**Check it worked:** `mica network --json` lists the routes per interface, or
`ip route` on the device.

> status: shipped — evidence: `mica-core:crates/micad-settings/src/model/network.rs`, `mica-core:docs/mica-core.md`

## 5. Two uplinks

When more than one interface can carry the default route, the route metrics
choose; the lowest wins.

| Default route from | Metric |
|---|---|
| a static gateway | 0 (the kernel's default for a route with none) |
| the first DHCP port, in name order | 100 |
| each next DHCP port | 110, 120, ... |
| the Wi-Fi station | 600 |

So a cable is preferred to Wi-Fi, and a static gateway to any lease. Two
default routes with one metric are refused (`metric_duplicate`).

**Failover today is on link and lease loss only.** When a port loses its
carrier or its lease, its default route goes and the next one carries the
traffic; when it comes back, it takes over again. A link that is up but cannot
reach the internet (a modem with no signal behind a working cable) keeps its
route: there is no reachability probing yet. Put the uplink you trust first,
or keep the other one down until needed.

**Check it worked:** `mica network show <port>` prints a `gateway:` line for
each port carrying a default route; `ip route` on the device shows each with
its `metric`.

> status: shipped — evidence: `mica-core:crates/micad/src/reconciler/network/render.rs`, `mica-core:crates/micad/src/reconciler/wifi_client.rs`

## 6. VLANs and bridges (systemd products)

A VLAN sits on a declared parent; a bridge enslaves declared ports, which then
carry no addressing of their own.

```json
{"eth0":   {"dhcp": true},
 "vlan20": {"kind": "vlan", "vlan": {"parent": "eth0", "id": 20},
             "static": {"address": "10.20.0.5/24"}, "internet": false},
 "br0":    {"kind": "bridge", "bridge": {"ports": ["eth1", "eth2"]}, "dhcp": true},
 "eth1":   {}, "eth2": {}}
```

Send a map like this whole with `PUT /api/v1/network` (with `baseVersion`), or
add the entries one by one in the console's Interfaces page.

| Code | Meaning |
|---|---|
| `vlan_duplicate` | one VLAN id twice on a parent |
| `vlan_parent_invalid` | the parent is not declared, or is a CAN entry |
| `bridge_port_invalid` | a port that is not declared, or is CAN |
| `bridge_port_addressed` | a bridge port carries addressing; move it to the bridge |
| `bridge_port_taken` | a port in two bridges |

On an OpenRC product a VLAN or bridge entry is refused by name:
`network.<iface>: vlan needs systemd-networkd, which this OpenRC device does
not run`.

> status: shipped — evidence: `mica-core:crates/micad/src/reconciler/network/ifupdown.rs`, `mica-core:crates/micad-settings/src/network_write.rs`

## 7. Wi-Fi

On a product with a radio (`cx3576.full`, `s905x5m.sd-full`,
`s905x5m.emmc-full`). One radio runs the station or the access point, not
both at once ([Wi-Fi](../reference/wifi.md#5-the-single-radio-conflict--reported-as-shipped-not-arbitrated)).

### As a client

```sh
mica wifi scan                     # what the radio sees, strongest first
mica wifi add Marina-Guest         # asks for the key twice
mica wifi on
mica wifi                          # enabled, interface, connected: <ssid>, known networks
```

The station takes DHCP with route metric 600, so a cable stays the default
route. `mica wifi add <ssid> --open` adds a network without a key, `--hidden`
one that does not broadcast its name, and `mica wifi remove <ssid>` forgets
it. In the console: Network → Wi-Fi → Client. A network already known is
refused with `ssid_exists`; edit it instead.

### As an access point

The access point is configured in the console (Network → Wi-Fi → Access
point) or with `PUT /api/v1/wifi/ap`:

```json
{"mode": "always", "interface": "wlan0", "channel": 6, "countryCode": "GR",
 "address": "192.168.4.1/24", "holdDownSeconds": 30, "graceSeconds": 60,
 "security": "wpa2-psk", "psk": "a long passphrase"}
```

`mode` is `off`, `provisioning` (up only while no uplink works, after
`holdDownSeconds`, and down `graceSeconds` after one returns) or `always`.
`security` is `wpa2-psk`, `wpa2-wpa3` or `open`. Without `psk` the device keeps
the key it has, which on a new device is the one on its label; set your own,
since the label's key is not a secret ([first run](../start/first-run.md)
section 2). A change of country is refused with `wifi_country_unconfirmed`
until it is resent with `countryConfirmed: true`; a write while Bluetooth
setup holds the radio is refused with `wifi_locked` until its window closes.

**Check it worked:** a phone sees the network; `GET /api/v1/wifi` says which
role holds the radio.

> status: board-dependent — evidence: `mica-core:crates/micad/src/reconciler/wifi_client.rs`, `mica-core:crates/mica-apid/openapi.json`, `docs/reference/wifi.md`

## 8. DNS

By default the device asks the servers its interfaces were given. There is
**no fallback DNS**: a site whose router hands out none resolves nothing until
you set some.

- **Global servers** replace every interface's own while on: one to three
  IPv4 servers.

  ```sh
  curl -s -H "$AUTH" -X PUT $DEV/api/v1/dns/global \
    -H 'content-type: application/json' -d '{"enabled": true, "servers": ["9.9.9.9", "1.1.1.1"]}'
  ```

  A loopback server or one of the device's own addresses is refused with
  `dns_server_invalid`.
- **Static records** make a name resolve on the device, up to 100:

  ```sh
  curl -s -H "$AUTH" -X POST $DEV/api/v1/dns/static-records \
    -H 'content-type: application/json' -d '{"hostname": "plc.local.lan", "address": "10.10.0.20"}'
  ```

  A name already recorded is `record_duplicate`, a hundred-and-first
  `record_limit`.

**Check it worked:** `GET /api/v1/dns` shows what the device resolves with;
`POST /api/v1/dns/test` asks each server directly for one `A` record. In the
console: Network → DNS.

> status: shipped — evidence: `mica-core:docs/mica-core.md`, `mica-core:crates/mica-apid/openapi.json`

## 9. WireGuard, end to end

A tunnel from the device to a peer (a server, or your laptop), on systemd and
OpenRC alike. The device's private key is generated on the device and never
leaves it or enters the settings.

1. **Pick free values.** `GET /api/v1/network/wireguard/defaults` answers the
   first free name (`wg0`), subnet (`10.2.0.1/24` onwards) and listen port
   (51821 onwards), and the UDP ports services hold.
2. **Declare the tunnel** with a static address (a tunnel takes no DHCP) and,
   if the peer will connect to the device, a listen port:

   ```sh
   curl -s -H "$AUTH" -X PUT $DEV/api/v1/network/wg0 -H 'content-type: application/json' \
     -d '{"kind":"wireguard","static":{"address":"10.2.0.1/24"},"wireguard":{"listenPort":51821,"peers":[]}}'
   ```

3. **Read the device's public key** once the task has applied:

   ```sh
   curl -s -H "$AUTH" $DEV/api/v1/state/network
   # {"wg0": {"publicKey": "<device public key>"}, ...}
   ```

   The console's WireGuard tab shows it, and gives a `[Peer]` block to paste
   into the far end's configuration.
4. **Add the peer**: its public key, the prefixes routed to it, and, if the
   device initiates, its endpoint (a peer behind NAT also wants a keepalive):

   ```sh
   curl -s -H "$AUTH" -X POST $DEV/api/v1/network/wg0/peers -H 'content-type: application/json' \
     -d '{"name":"office","publicKey":"<peer public key>","allowedIps":["10.2.0.2/32","192.168.50.0/24"],
          "endpoint":"vpn.example.net:51820","persistentKeepalive":25}'
   ```

   Each allowed prefix becomes a route through the tunnel. The answer (201)
   is the peer as the listing reads it. A second peer with the same key is
   `peer_exists`.
5. **Configure the far end** with the device's public key, its endpoint
   (`<device address>:51821`) if it initiates, and `AllowedIPs = 10.2.0.1/32`
   plus any network behind the device.
6. **Check the handshake:**

   ```sh
   curl -s -H "$AUTH" $DEV/api/v1/network/wg0/peers
   # [{"publicKey": "...", "latestHandshake": 1763200000, "rxBytes": 1240, "txBytes": 980,
   #   "routesReady": true, "unroutedIps": [], "operationalState": "ready", ...}]
   ```

   `latestHandshake` (Unix seconds) recent and `rxBytes` growing mean the
   tunnel carries traffic; `ping 10.2.0.2` from the device proves it.

**Editing and removing.** `PUT /api/v1/network/wg0/peers/<public key>` edits
one peer in place and `DELETE` removes it (a key containing `/` is
percent-encoded in the path); name the listing's version (its `ETag`) so a
peer changed meanwhile is refused with 409 `version_conflict` instead of
overwritten. `POST /api/v1/actions/wireguard/wg0/rotate-key` draws a new
private key and answers the new public key: every peer must be given it
before it connects again. A pre-shared key is read back as `<redacted>`.

**What can go wrong:**

| Symptom or code | Meaning | Fix |
|---|---|---|
| `latestHandshake` null | no handshake yet | check both public keys, the endpoint and that UDP reaches the listening side |
| `operationalState` `pending_endpoint_resolution` | the endpoint's name does not resolve yet | fix DNS (section 8); micad retries at 5, 15, 30 and 60 s, then every 60 s |
| `endpoint_route_loop` | the endpoint lies inside a prefix routed into the tunnel | narrow `allowedIps` |
| `unroutedIps` not empty | an allowed prefix is not sent through the tunnel | another route covers it; see the `wireguard_*` codes |
| `port_in_use` | the listen port is another tunnel's or a service's | take the one `defaults` suggests |
| `wireguard_default_route_unsupported`, `wireguard_prefix_invalid`, `wireguard_peer_prefix_conflict`, `wireguard_route_conflict` | peer route rules (422 `settings_rejected`, the code first in the message) | [errors](../reference/errors.md) |

> status: shipped — evidence: `mica-core:docs/mica-core.md`, `mica-core:crates/mica-apid/openapi.json`, `mica-core:crates/mica-apid/ui/src/features/network/wireguard-tab.tsx`

## 10. Errors at a glance

| Code | HTTP | Meaning |
|---|---|---|
| `busy` | 409 | a network task is still applying |
| `version_conflict` | 409 | the map or peer list changed since the version you named |
| `name_invalid` | 422 | not an interface name |
| `address_overlap`, `gateway_out_of_subnet`, `gateway_not_allowed`, `metric_duplicate` | 422 | addressing and routing rules (sections 2-5) |
| `vlan_*`, `bridge_port_*` | 422 | section 6 |
| `port_in_use`, `peer_exists`, `wireguard_*` | 409 / 422 | section 9 |
| `settings_rejected` | 422 | micad refused the write; the message quotes the rule |

The whole list is [errors](../reference/errors.md); the settings are
[settings](../reference/settings.md); CAN interfaces are on the board pages
([cx3576](../hardware/cx3576.md)).
