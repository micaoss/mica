# MQTT

How to switch on the device's MQTT broker, reach it from another machine with
a user name and password, see what the bridge publishes, and get your own
application's values onto MQTT. The wire grammar is
[bus](bus.md) section 4; the packages are `mica-pkgs:docs/mica-pkgs.md`
section 3.

## Before you start

- **A product with MQTT:** `cx3576.full`, `s905x5m.sd-full`,
  `s905x5m.emmc-full`, `uefi-x64.full` and `uefi-x64.docker`. `uefi-x64.gcp`,
  `mini-x64.basic` and `qemu-armhf.basic` carry none.
- **What is on MQTT, and what is not.** MQTT carries application data only.
  micad publishes nothing there: no configuration, state, credentials or
  updates, and nothing on MQTT can change them. What appears is the values of
  applications enrolled with the bridge (section 5); a device with none
  publishes only the bridge's own protocol topics.
- **Two services.** `mica-mqtt-broker`, a local MQTT 3.1.1 broker with one TCP
  listener and no TLS, and `mica-mqttd`, the bridge from enrolled applications
  on the system bus to that broker. micad starts both when MQTT is on.
- Root on the device, or the API with a token
  (`DEV`, `AUTH` as on [network](../operate/network.md)), and an MQTT client
  on your workstation, here `mosquitto_sub` and `mosquitto_pub`.

> status: shipped — evidence: `mica-core:docs/mica-core.md`, `mica-pkgs:docs/mica-pkgs.md`, `mica-build:boards/cx3576/products/full/product.env`

## 1. Switch it on (local only)

```sh
mica set mqtt.enabled true
```

or the console's Services, MQTT page, or the API. The broker listens on
`127.0.0.1:1883` with no authentication: only programs on the device reach
it.

**Check it worked:**

```sh
curl -s -H "$AUTH" $DEV/api/v1/mqtt
# {"configured":{"enabled":true,"listen":{"address":"127.0.0.1","port":1883},"auth":{"enabled":false}},
#  "observed":{"available":true,"state":{...}}}
```

`observed.state` is the reconciler's record: the configuration it wrote, the
listener and the state of both services.

> status: shipped — evidence: `mica-core:crates/mica-apid/src/routes/mqtt.rs`, `mica-core:crates/micad/src/reconciler/mqtt.rs`

## 2. Open it to the network, with passwords

Make the broker's accounts first, on the device as root. The file is read
once, when the broker starts:

```sh
cat > /var/lib/mica/mqtt-broker-users.toml <<'EOF'
[users]
scada = "a-long-random-password"
bridge = "another-long-random-password"
EOF
chown root:mica-mqtt-broker /var/lib/mica/mqtt-broker-users.toml
chmod 0640 /var/lib/mica/mqtt-broker-users.toml
```

The bridge is a client too, so give it its account:

```sh
cat > /var/lib/mica/mqttd-credentials.json <<'EOF'
{"username":"bridge","password":"another-long-random-password"}
EOF
chown mica-mqttd:mica-mqttd /var/lib/mica/mqttd-credentials.json
chmod 0600 /var/lib/mica/mqttd-credentials.json
```

Then move the listener and turn authentication on. A `PUT` replaces the whole
`mqtt` document:

```sh
curl -s -H "$AUTH" -X PUT $DEV/api/v1/mqtt \
  -H 'content-type: application/json' \
  -d '{"enabled": true, "listen": {"address": "0.0.0.0", "port": 1883}, "auth": {"enabled": true}}'
# {"taskId":"<id>"}
```

micad rewrites `/var/lib/mica/mqtt/broker.toml` and restarts the broker. The
address is an IPv4 or IPv6 literal; `0.0.0.0` is every IPv4 address, or name
one interface's address. Listening beyond loopback without authentication is
allowed and logged as a warning; do not. Traffic is plain MQTT: keep it on a
network you trust, or carry it over WireGuard
([network](../operate/network.md) section 9).

After changing either account file later, restart the service that reads it:
`systemctl restart mica-mqtt-broker` or `mica-mqttd` (on OpenRC,
`rc-service ... restart`).

> status: shipped — evidence: `mica-pkgs:docs/mica-pkgs.md`, `mica-core:crates/mica-apid/src/routes/mqtt.rs`

## 3. Connect a client and check it worked

The bridge's topics carry the device id, the second level of every topic.
Read it on the device:

```sh
cat /var/lib/mica/mqtt/mqttd-device.env
# MICA_MQTT_DEVICE_ID=00112233445566778899aabbccddeeff
```

From the workstation, subscribe to everything the device publishes, then ask
for a full publication with a keepalive:

```sh
mosquitto_sub -h mica-a4e2e69e.local -u scada -P 'a-long-random-password' -t 'N/#' -v &
mosquitto_pub -h mica-a4e2e69e.local -u scada -P 'a-long-random-password' \
  -t R/00112233445566778899aabbccddeeff/keepalive -n
```

You see `N/<deviceId>/heartbeat` every 3 seconds for 60 seconds, the retained
values of every enrolled application, and `N/<deviceId>/full_publish_completed`
when they are all out. That is the check: heartbeats mean the broker, the
bridge and your credentials work. Send the keepalive again within the minute
to keep the window open.

> status: shipped — evidence: `docs/integrate/bus.md`, `mica-pkgs:docs/mica-pkgs.md`

## 4. The topics

```text
N/<deviceId>/<class>/<instance>/<path>   device -> you: a value, retained
R/<deviceId>/<class>/<instance>/<path>   you -> device: publish this value again
W/<deviceId>/<class>/<instance>/<path>   you -> device: write it (full mode only)
R/<deviceId>/keepalive                   you -> device: open a 60 s window, republish all
N/<deviceId>/heartbeat                   device -> you: every 3 s while the window is open
N/<deviceId>/full_publish_completed      device -> you: the republish is done
```

A value's payload is JSON, `{"value": 42}`, with `min` and `max` when the
application gives them. A write carries `{"value": ...}`; there is no
acknowledgement topic, the new `N` value is the answer. The bridge is
`read-only` by default and takes no writes; to allow them, set
`MICA_MQTT_MODE=full` in `/var/lib/mica/mqttd.env` and restart `mica-mqttd`.
That file also names another broker (`MICA_MQTT_BROKER_HOST`,
`MICA_MQTT_BROKER_PORT`) or client id (`MICA_MQTT_CLIENT_ID`).

> status: shipped — evidence: `docs/integrate/bus.md`, `mica-pkgs:docs/mica-pkgs.md`

## 5. Your application's values on MQTT

An application gets onto MQTT by being a bus service the bridge is allowed to
read, from its own package:

1. It owns a D-Bus name `com.mica.<class>[.<suffix>]`, for example
   `com.mica.tank`, and serves `com.mica.Item1` (`GetItems`, `SetValue`,
   `ItemsChanged`) at `/` ([bus](bus.md) section 2).
2. Its package installs an empty file named exactly that, in
   `/usr/lib/mica/mqtt-applications.d/com.mica.tank`, and the D-Bus policy
   that lets `mica-mqttd` call `com.mica.Item1` on that one name
   ([bus](bus.md) section 3).
3. After the bridge restarts, its items appear as
   `N/<deviceId>/tank/<instance>/<path>`.

`com.mica.micad` can never be enrolled, and a name outside the rule stops the
bridge from starting. Two applications claiming the same
`<class>/<instance>` are both withheld until one goes ([bus](bus.md)
section 5). A container that wants MQTT talks to the broker directly, as any
client does.

> status: shipped — evidence: `mica-pkgs:docs/mica-pkgs.md`, `docs/integrate/bus.md`

## 6. What can go wrong

| You see | Why | Fix |
|---|---|---|
| `Connection refused` from the workstation | the broker listens on loopback, or MQTT is off | section 2 |
| `not authorised` / bad user name or password | not in `mqtt-broker-users.toml`, or the broker has not reread it | fix the file, restart `mica-mqtt-broker` |
| Every connection refused after turning auth on | the users file is missing, unreadable by `mica-mqtt-broker`, or has no `[users]` table | section 2 |
| No heartbeat after a keepalive | the bridge is not running or cannot log in to the broker | `curl $DEV/api/v1/system/logs/mqttd` and `.../mqtt-broker`; check `mqttd-credentials.json` is `0600`, owned by `mica-mqttd` |
| The bridge does not start | a malformed or publicly readable credentials file, or a bad name in `mqtt-applications.d` | read the `mqttd` log |
| Heartbeats but no application topics | nothing is enrolled, or two applications collide | section 5 |
| A `W` does nothing | the bridge is `read-only` | `MICA_MQTT_MODE=full` |
| 404 on `/api/v1/mqtt` | the product has no MQTT | a product from the list above |

> status: shipped — evidence: `mica-pkgs:docs/mica-pkgs.md`, `mica-core:crates/micad/src/logs.rs`
