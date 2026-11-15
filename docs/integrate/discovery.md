# Finding devices on the LAN: mDNS and SSDP

What a device announces on its local network, how to find it from a computer,
how to switch each announcement off, and how to announce a service of your
own. The contract is `mica-core:docs/mica-core.md` sections 3.12 and 3.13;
the rules are in [access](../reference/access.md) section 4.1.

## Before you start

- **Both are on by default** on every released product except `uefi-x64.gcp`,
  which announces nothing. micad answers both itself, on either init.
- **They answer on the local network only:** every interface with an address,
  the access point's included, but never the loopback, container links,
  WireGuard or CAN, and only to a query from a subnet of the interface it
  arrived on. Nothing is relayed from one interface to another.
- Root on the device for `mica mdns` and `mica ssdp`, or the API with a token.

> status: shipped — evidence: `mica-core:docs/mica-core.md`, `mica-build:boards/uefi-x64/products/gcp/product.env`

## 1. What is announced

**mDNS** (Bonjour, Avahi):

| Record | What |
|---|---|
| `<hostname>.local` | the device's addresses on the interface asked (A and AAAA) |
| `_mica._tcp`, instance `<hostname>` | the console's port; TXT `txtvers=1`, `product=<product>`, `hostname=<hostname>` |
| `_http._tcp` or `_https._tcp`, instance `<hostname>` | the console, while it serves the network; TXT `path=/` |

**SSDP** (UPnP, the network view of Windows and many NAS and media tools): one
root device of type `urn:micaos:device:mica:1`, with a description at
`http://<address>:8080/ssdp/device.xml` naming the host name as its friendly
name and the product as its model, and the console as its presentation page.

Never announced: SSH, the software version, whether the device is claimed,
the device code, any key. The serial number and UDN in the SSDP description
are derived values, neither the machine id nor the device code.

> status: shipped — evidence: `mica-core:docs/mica-core.md`

## 2. Find a device from a computer

The default host name is `mica-` and eight hex digits, for example
`mica-a4e2e69e`.

```sh
# Linux (Avahi)
avahi-browse -rt _mica._tcp
# macOS, or Windows with Bonjour
dns-sd -B _mica._tcp
# any system that resolves .local
ping mica-a4e2e69e.local
```

`avahi-browse` prints each device with its address, port and the TXT record,
`product=` naming the product. Then open `http://mica-a4e2e69e.local:8080`.

On Windows, the device also shows in File Explorer's Network view (SSDP);
opening it opens the console.

On a phone, the Android app lists the devices that announce `_mica._tcp`
([the Mica app](../start/mica-app.md) section 3).

**Check it worked** from a Linux workstation on the same network:

```sh
avahi-resolve -n mica-a4e2e69e.local
curl -s http://mica-a4e2e69e.local:8080/ssdp/device.xml | grep -E 'friendlyName|modelName'
```

> status: shipped — evidence: `mica-core:docs/mica-core.md`, `mica-app:lib/console/discovery.dart`

## 3. See and switch the announcements

```sh
mica mdns status
# enabled: true (product)
# hostname: ...
# published: <n> of <n>
mica mdns list
# mica-a4e2e69e._mica._tcp port 8080 built-in published
# ...
mica ssdp status
# enabled: true (product)
# active: true
# ...
```

`(product)` means the product's default decides; after you switch it, it reads
`(setting)`.

| To | Do |
|---|---|
| Stop mDNS | `mica mdns off` (no socket at all; your services are kept, not published) |
| Stop SSDP | `mica ssdp off` |
| Back on | `mica mdns on`, `mica ssdp on` |

The same switches are `access.mdns.enabled` and `access.ssdp.enabled`
(`PUT /api/v1/settings/<path>`), shown on the console's Overview. SSDP also
stops while the API does not serve the network (`mica web local` or `off`).
`GET /api/v1/mdns` and `GET /api/v1/ssdp` answer what is announced.

> status: shipped — evidence: `mica-core:crates/micad/src/mdns_cli.rs`, `mica-core:crates/micad/src/ssdp_cli.rs`

## 4. Announce a service of your own

A Grafana on port 3000, say, until the next reboot:

```sh
mica mdns add grafana --type _http._tcp --port 3000 --instance Grafana --txt path=/dashboards
# /run/mica/mdns.d/grafana.json is published until reboot
mica mdns list
# Grafana._http._tcp port 3000 runtime:grafana published
avahi-browse -rt _http._tcp          # from the workstation
mica mdns remove grafana
# /run/mica/mdns.d/grafana.json is removed
```

`mica mdns add` writes `/run/mica/mdns.d/<name>.json`, which micad applies
within a second. Files in `/run` go at reboot, so to announce a service at
every boot, have your service or container write the same file when it
starts:

```json
{"version": 1, "services": [
  {"instance": "Grafana", "type": "_http._tcp", "port": 3000, "txt": {"path": "/dashboards"}}
]}
```

It must be root's regular file, writable by root alone. A product image can
carry the same files in `/usr/share/mica/mdns.d/`.

Rules: the file name is 1 to 32 of `a-z`, `0-9`, `-`; at most 8 services a
file and 64 published in all; `type` is `_<name>._tcp` or `_<name>._udp`,
never `_mica._tcp`; `instance` (the host name when absent) at most 63 bytes
with no dot; `port` 1 to 65535; `txt` at most 16 keys. A file that breaks a
rule is refused whole and named by `mica mdns list` as `refused`; the others
stay.

> status: shipped — evidence: `mica-core:docs/mica-core.md`, `mica-core:crates/micad/src/mdns_cli.rs`

## 5. What can go wrong

| You see | Why | Fix |
|---|---|---|
| `.local` does not resolve | mDNS off, the computer on another subnet or VLAN, or a client without mDNS | `mica mdns status`; be on the same network; on Windows use the address or install Bonjour |
| Not in the Windows Network view | SSDP off, or the API not on the network | `mica ssdp status` shows `reason` |
| `refused runtime:<name>: ...` in `mica mdns list` | the file broke a rule, or its service name is taken | read the reason; fix the file |
| Your service shows `not-published` | mDNS is off, or the 64-service limit is reached | `mica mdns on`; drop a service |
| A device behind a router is not found | mDNS and SSDP never cross a router, by design | use its address |
| Nothing at all on `uefi-x64.gcp` | the product announces nothing | its address from Compute Engine ([cloud](cloud.md)) |

> status: shipped — evidence: `mica-core:docs/mica-core.md`
