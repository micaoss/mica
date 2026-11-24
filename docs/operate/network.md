# Network

How to put a device on the network you have: wired DHCP or a static address,
a port kept off the internet, extra routes, two uplinks with a reachability
check and failover, VLANs and bridges, Wi-Fi as a client or an access point,
DNS, and a WireGuard tunnel to a peer.
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

## 5. Two uplinks and failover

When more than one interface can carry the default route, the route metrics
choose; the lowest wins.

| Default route from | Metric |
|---|---|
| a static gateway, first entry with one in name order | 20 |
| each next static gateway | 21, 22, ... |
| the first DHCP port, in name order | 100 |
| each next DHCP port | 110, 120, ... |
| the Wi-Fi station | 600 |

So a static gateway is preferred to any lease, and a cable to Wi-Fi. A
declared default route below metric 20 is refused (`route_metric_reserved`):
that range is micad's, for the failover route below. Two default routes with
one metric are refused (`metric_duplicate`).

**Without a check, failover is on link and lease loss only.** When a port
loses its carrier or its lease, its default route goes and the next one
carries the traffic; when it comes back, it takes over again. A link that is
up but cannot reach the internet (a modem with no signal behind a working
cable) keeps its route.

### The reachability check

Each uplink can carry a **reachability check** (`probe`): every interval the
device tries to reach a few targets out of that interface alone. When the
check says an uplink is `down` and another one answers, micad adds one default
route of its own via the one that answers, at metric 10, so it wins over the
others; when the first answers again, micad removes it and the traffic goes
back.

**It is off by default.** Switching it on with no targets of your own stores
two: `1.1.1.1` (Cloudflare) and `8.8.8.8` (Google), public DNS resolvers,
reached by a TCP connect to port 53. From then on the device contacts them
from that interface every interval, for as long as the check is on. Replace
them with addresses you prefer, or add `gateway`, the uplink's own router.

| Field | Default | Range |
|---|---|---|
| `targets` | `1.1.1.1` and `8.8.8.8`, `tcp` port 53 | 1 to 4; an IPv4 address or `gateway`; `icmp` (one echo) or `tcp` (a connect; `port` for `tcp` only, default 443) |
| `intervalS` | 10 s | 2 to 300 |
| `timeoutMs` | 2 s (2000) | 200 to 10 000, below the interval |
| `failuresToDown` | 3 rounds | 1 to 20 |
| `successesToUp` | 5 rounds | 1 to 50 |

A round succeeds when any target answers. At the defaults a dead upstream is
left after about 30 s (3 × 10 s), and taken back about 50 s (5 × 10 s) after
it answers again. Port 53 and not 443, because a captive portal or a
transparent proxy answers a connect to any port 443 and would make an uplink
that reaches nothing look up.

**Cost.** Each target costs about 1.5 MB a day at the defaults. That counts on
a metered uplink, such as an LTE router billed by volume; a longer interval
costs less and notices later.

**In the console:** Network → Interfaces → the port → Reachability check
("Check internet reachability"). It fills in the two targets, shows the time
to switch over and back and the cost a day, and, once on, the verdict, whether
the port carries the traffic and the last round's answers. For the Wi-Fi
station, the same editor is on the Wi-Fi tab, beside the radio's state.

### Worked example: a cable modem with an LTE router behind it

`eth0` goes to the site's cable modem, `eth1` to an LTE router kept as a
backup; both take DHCP, so `eth0` has metric 100 and `eth1` 110. Switch the
check on for both: on `eth0` so a dead modem is noticed, and on `eth1` so the
traffic is never moved to a backup that cannot reach the internet either.

```sh
curl -s -H "$AUTH" -X PUT $DEV/api/v1/network/eth0 \
  -H 'content-type: application/json' -d '{"dhcp": true, "probe": {"enabled": true}}'
# {"taskId":"<id>"}
curl -s -H "$AUTH" -X PUT $DEV/api/v1/network/eth1 \
  -H 'content-type: application/json' -d '{"dhcp": true, "probe": {"enabled": true}}'
curl -s -H "$AUTH" $DEV/api/v1/network | jq .configured.eth0.probe
# {"enabled":true,"targets":[{"address":"1.1.1.1","method":"tcp","port":53},
#  {"address":"8.8.8.8","method":"tcp","port":53}], ...}
```

`PUT` replaces the whole entry, so name its addressing with the check. The
stored entry names the targets the device now contacts.

**Check it worked.** On the device, after a few rounds (the INTERNET column
is `checking` until the first verdict):

```sh
mica network
# NAME     STATE     INTERNET  ADDRESSES
# eth0*    routable  up        192.168.1.40/24 ...
# eth1     routable  up        192.168.8.100/24 ...
mica network show eth0
# internet: up (carries the traffic)
# metric: 100
# check: on, every 10 s, 2000 ms timeout, down after 3, up after 5: 1.1.1.1 tcp/53, 8.8.8.8 tcp/53
# ...
```

`*` marks the uplink that carries the traffic. Now take the modem's line away
and leave the cable in (unplug the modem's coaxial or DSL line). After about
30 s:

```sh
mica network
# eth0     routable  down      192.168.1.40/24 ...
# eth1*    routable  up        192.168.8.100/24 ...
ip route | grep default
# default via 192.168.8.1 dev eth1 proto 109 metric 10
# default via 192.168.1.1 dev eth0 proto dhcp src 192.168.1.40 metric 100
# default via 192.168.8.1 dev eth1 proto dhcp src 192.168.8.100 metric 110
journalctl -u micad -b | grep MICA_UPLINK      # OpenRC: logread | grep MICA_UPLINK
# ... MICA_UPLINK active=eth1 previous=eth0 reason=probe
```

The metric-10 route is micad's (route protocol 109; BusyBox `ip route` on
OpenRC does not print the protocol, so there it shows as the default route
with `metric 10`). Each uplink keeps its own route. Put the line back: after
about 50 s of answers `eth0` is `up` and `*` again, the metric-10 route is
gone, and the log says `reason=recovered`. The same is in
`GET /api/v1/network/status` under `uplinks`: `active`, `natural` (the uplink
the metrics alone would pick), `override` (whether micad's route steers the traffic),
`lastChange` and each uplink's state, counters and last round
([diagnostics](../reference/diagnostics.md#3-the-observed-network-state)).

**DNS follows the active uplink**, on both inits: an uplink that is `down`
while another is active is not asked for names. On systemd micad tells
resolved to stop using that link's servers for ordinary lookups; on OpenRC
it writes `/run/mica/resolv.order` and `resolv.conf` is rebuilt with the
active uplink's servers first and the down ones last. With global DNS servers
on (section 8), every lookup goes to them whichever uplink is active.

### Limits

- **IPv4 only.** Targets are IPv4 addresses, and only IPv4 default routes are
  switched.
- **Addresses only**, no host names: a name would have to be resolved through
  the very uplink being checked.
- **Open connections do not move.** A switch moves new connections only; one
  already open keeps the old uplink's source address and stalls until the
  application reconnects. Containers and access-point clients get the new
  uplink on new connections.
- **Captive portals.** A portal that answers TCP on port 53 too makes an
  uplink look up. Choose targets the portal cannot answer for, such as `icmp`
  to an outside address.
- **Every target down everywhere.** If the targets are unreachable from every
  uplink, all are `down`, micad removes its route, and the device routes by
  metric as it would with no check. Use two targets on different networks.
- **Strict reverse-path filtering** (`rp_filter` 1) drops the answers on an
  uplink that is not active; the uplink then reads `blocked` and is not used.
  Mica images keep the kernel's 0.
- Not for `internet: false`, WireGuard or CAN entries (`probe_not_allowed`).

**What can go wrong:**

| Code or state | Meaning | Fix |
|---|---|---|
| `probe_not_allowed` | the entry cannot carry the default route | drop `internet: false`, or check another port |
| `probe_targets` | no target, more than 4, or one twice | 1 to 4 distinct targets |
| `probe_address`, `probe_method`, `probe_port` | not an IPv4 address or `gateway`; not `icmp`/`tcp`; a port on `icmp` or out of 1-65535 | fix the target |
| `probe_interval`, `probe_timeout`, `probe_threshold` | a number out of its range, or a timeout not below the interval | the table above |
| `route_metric_reserved` | a declared default route below metric 20 | use 20 or more |
| `no route` in INTERNET | no carrier, no lease or no default route on that port | the cable, or DHCP on that network |
| `blocked` in INTERNET | strict reverse-path filtering (`rp_filter` 1 on the port or `all`) | set it back to 0 or 2 |

> status: shipped — evidence: `mica-core:docs/mica-core.md`, `mica-core:docs/plan/uplink-failover.md`, `mica-core:crates/micad/src/cli/network.rs`, `mica-core:crates/mica-apid/ui/src/i18n/resources.ts`

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
| `address_overlap`, `gateway_out_of_subnet`, `gateway_not_allowed`, `metric_duplicate`, `route_metric_reserved` | 422 | addressing and routing rules (sections 2-5) |
| `probe_not_allowed`, `probe_*` | 422 | the reachability check (section 5) |
| `vlan_*`, `bridge_port_*` | 422 | section 6 |
| `port_in_use`, `peer_exists`, `wireguard_*` | 409 / 422 | section 9 |
| `settings_rejected` | 422 | micad refused the write; the message quotes the rule |

The whole list is [errors](../reference/errors.md); the settings are
[settings](../reference/settings.md); CAN interfaces are on the board pages
([cx3576](../hardware/cx3576.md)).
