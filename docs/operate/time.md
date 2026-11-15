# Time

How to point a device at your NTP servers, set the time zone it shows, and
check that its clock is synchronized. The device keeps its clock in UTC
whatever you set; the design is in [time](../reference/time.md), the two
settings in [settings](../reference/settings.md).

## Before you start

- **A claimed device**, reached as root with `mica` (an SSH session or the
  local console), or the API with a token from a workstation:

  ```sh
  DEV=http://mica-a4e2e69e.local:8080
  AUTH="Authorization: Bearer mica_<id>_<secret>"   # from: mica tokens create laptop
  ```

- **Nothing to switch on.** Network time always runs; there is no setting,
  API call or console switch that stops or pauses it. Out of the box a device
  polls the image's fallback pool, so you only act to use your own servers.
- **The device needs a route to the servers** (UDP 123). A device on a
  network with no way out needs a server on that network.

> status: shipped — evidence: `mica-core:docs/mica-core.md`, `mica-core:crates/micad/src/reconciler/time.rs`

## 1. What runs on each init

| | systemd products | OpenRC products (`mini-x64.basic`, `qemu-armhf.basic`) |
|---|---|---|
| Client | `systemd-timesyncd` | `mica-ntpd` (busybox `ntpd`) |
| Your servers go to | `/var/lib/mica/time/timesyncd.conf`, linked as `/etc/systemd/timesyncd.conf.d/60-mica-servers.conf` | `ntp_servers` in `/var/lib/mica/time/ntpd.conf` |
| With no servers set | the image's fallback pool | `0.debian.pool.ntp.org` to `3.debian.pool.ntp.org` |
| After a change | timesyncd restarted | `mica-ntpd` restarted |

Both files live on DATA, so the servers apply from the first poll at boot,
before micad starts. timesyncd polls one server at a time and moves to the
next on failure.

> status: shipped — evidence: `mica-core:docs/mica-core.md`, `mica-system-base:debs/mica-openrc/payload/etc/init.d/mica-ntpd`

## 2. Use your own NTP servers

On the device:

```sh
mica time servers ntp1.example.net ntp2.example.net 192.0.2.123
# time.ntp.servers is ntp1.example.net ntp2.example.net 192.0.2.123
mica time servers
# ntp1.example.net
# ntp2.example.net
# 192.0.2.123
```

The same through the API (the body is the whole list):

```sh
curl -s -H "$AUTH" -X PUT $DEV/api/v1/settings/time.ntp.servers \
  -H 'content-type: application/json' \
  -d '["ntp1.example.net","ntp2.example.net"]'
# {"taskId":"<id>"}
```

In the console it is System, Time.

Rules for the list: at most 8 entries, each a host name or an IP address
(ASCII letters, digits, `.`, `-`, `:`), at most 253 characters, none empty and
none listed twice.

**Back to the default pool**: an empty list.

```sh
mica set time.ntp.servers '[]'
```

> status: shipped — evidence: `mica-core:crates/micad/src/cli/settings.rs`, `mica-core:crates/micad-settings/src/model/time.rs`, `mica-core:crates/mica-apid/src/routes/settings.rs`

## 3. Set the time zone

The zone changes how times are *shown* (the console formats times in it, and
it is written to `/run/mica/timezone`); the clock, the logs and the API stay
in UTC. Nothing restarts.

```sh
mica time zones | grep Europe/      # the zones this device knows
mica time zone Europe/Athens
# time.timezone is Europe/Athens
mica time zone
```

Through the API:

```sh
curl -s -H "$AUTH" $DEV/api/v1/time/zones          # {"zones":[{"id":"UTC",...},...]}
curl -s -H "$AUTH" -X PUT $DEV/api/v1/settings/time.timezone \
  -H 'content-type: application/json' -d '"Europe/Athens"'
```

The console's picker searches the same list by city, region, zone name or
current offset. A zone name is an IANA name such as `UTC` or `Europe/Berlin`;
a well-formed name the device has no zone file for is stored and reported as
not available, not refused.

> status: shipped — evidence: `mica-core:crates/micad/src/cli/settings.rs`, `mica-core:crates/mica-apid/src/routes/time_zones.rs`

## 4. Check it worked

```sh
mica time
# status: synchronized
# synchronized: true
# server: ntp1.example.net
# offset: 0.0012 s
```

`mica time --json` and `GET /api/v1/time/status` answer the same as JSON
(`status`, `synchronized`, `server`, `sample` with `offsetSeconds` and
`correction` `step` or `slew`, and `detail` when there is something to say).
`mica status` shows the state on its `time` line.

| `status` | Means | What to do |
|---|---|---|
| `synchronized` | the kernel bounds the clock's error under 16 s | nothing |
| `polling` | a server is selected and answering, the bound is not reached yet | wait a few polls; if it stays, read the log (section 5) |
| `offline-degraded` | no usable server | check the route and DNS to the servers, UDP 123 on the way |
| `invalid-source` | a server answers with unusable replies (leap 3, stratum 0 or 16 and up) | replace that server |
| `unknown` | a signal could not be read | `detail` names which: timesyncd off the bus, or timedated not answering |

On OpenRC the state rests on whether `mica-ntpd` runs and on the kernel's
synchronized bit: `synchronized`, `offline-degraded` (running, not yet in
sync), or `unknown` (`mica-ntpd` not running). There is no server or sample
there; `mica time` shows only the first two lines.

> status: shipped — evidence: `mica-core:crates/micad/src/time_status.rs`, `mica-core:crates/micad/src/openrc/time_status.rs`

## 5. What can go wrong

| You see | Why | Fix |
|---|---|---|
| `at most 8 NTP servers are supported; ...` (422 `settings_rejected`) | more than 8 entries | keep 8 or fewer |
| `NTP server "..." contains a character a host name or IP address cannot have; ...` | a URL, a port or a space in an entry | the bare name or address |
| `NTP server "..." is listed twice` | a duplicate | drop it |
| `a timezone is an IANA zone name such as "UTC" or "Europe/Berlin": ...` | not a zone name (`UTC+2`, `Athens`) | pick one from `mica time zones` |
| `offline-degraded` for minutes after boot | the device has no route to the servers yet, or DNS fails | [network](network.md), then `mica time` again |
| The clock is far behind after a power cut | no working RTC; it catches up on the first server reply (section 6) | let it reach a server |

To see the client's own messages, read the `time` log (the console's Logs
page, or the API), which is timesyncd's journal on systemd and the lines
tagged `ntpd` on OpenRC:

```sh
curl -s -H "$AUTH" $DEV/api/v1/system/logs/time
journalctl -u systemd-timesyncd      # on a systemd device, as root
```

The full error format is in [errors](../reference/errors.md).

> status: shipped — evidence: `mica-core:crates/micad-settings/src/model/time.rs`, `mica-core:docs/mica-core.md`

## 6. The clock at boot

A device sets its clock at boot from its RTC where the board has a working
one; on systemd products timesyncd also keeps it no earlier than the last
minute it saved to DATA (every 60 s while running). Then the network sets
it. Certificate checks start after that floor is in place. Updates do not depend on the clock: the update documents carry no
expiry. A board's RTC status is on its [hardware](../hardware/README.md)
page.

> status: shipped — evidence: `mica-core:docs/mica-core.md`
