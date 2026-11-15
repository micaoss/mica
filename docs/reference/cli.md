# The `mica` command

> A device on a release of 2026-11-14 or earlier has no `mica` command:
> update it first ([updates](../operate/updates.md)), or use that release's
> `micad` commands (`micad web`, `micad unit`, `micad factory-reset`, ...).

`mica` is the operator's one command on the device. Every verb, its options,
its output, its exit code and its `--json` form are on this page, from
`mica-core` at release `20261115-0958` (core 0.0.8,
`mica-core:crates/micad/src/cli.rs` and the modules it calls).

## 1. Where it runs, and who may run it

`/usr/bin/mica` is a link to the `micad` executable, in micad's core
component, on every product that has the `micad` feature, under systemd and
OpenRC alike. Run it as **root** on the device: on the serial console, or
over SSH once SSH is on. Both of its channels are root's alone:

- **the system bus**: micad's bus policy (`com.mica.micad.conf`) lets only
  root send to `com.mica.micad` or receive from it;
- **apid's local socket** `/run/mica/apid.sock`: mode `0600`, and apid takes
  the caller's uid from the kernel and refuses any caller but root.

`micad` itself takes only `micad daemon`, `micad apid` and `micad --version`,
as its units start it. Any other word exits 2 with `micad: use mica <word>
(mica help)`.

`mica --version` prints `mica <package version>`, for example
`mica 0.0.8-1`.

## 2. Two channels

A verb goes where its rules live, so `mica` adds no rule and copies none:

```text
                      root on the device
                              |
                            mica
              +---------------+----------------+
              |                                |
     system bus (D-Bus)               /run/mica/apid.sock (HTTP)
     com.mica.micad1                  apid's /api, credential = uid 0
              |                                |
            micad  <------- bus -------------- apid
   status, update, container,       setup, password, root-password,
   unit, web, mdns, ssdp,           ssh, tokens, get, set, hostname,
   factory-reset, reboot,           time, network, wifi
   poweroff, doctor
```

- **Bus verbs** ask micad directly. They work whatever `access.web.mode` is,
  including `off`, which is how `mica web local` or `mica web network` turns
  apid back on.
- **Socket verbs** are API calls: apid validates them, writes their audit
  lines (source `local`) and counts a wrong password in its login backoff,
  exactly as for a browser. When apid is not answering they exit 3; when the
  reason is `access.web.mode` `off`, the message says so:
  `apid is off (access.web.mode off); mica web local serves the local socket only`.
- `mica doctor` reads micad over the bus and writes the snapshot store
  itself; `mica mdns add|remove` write files under `/run/mica/mdns.d`;
  `mica internal` reads local files.

## 3. Conventions

### Help

`mica`, `mica help` and `mica --help` print the verb list (a bare `mica`
also exits 2). `mica help <verb>`, `mica <verb> help` and
`mica <verb> --help` print that verb's usage and exit 0. Verbs with
sub-verbs (`ssh`, `tokens`, `container`, `unit`, `web`, `mdns`, `ssdp`)
print their usage when given no sub-verb. `mica help` does not list
`internal` (section 6).

### `--json`

`--json` may stand anywhere on the line. It applies only to a command that
reads; on a command that writes, `mica` exits 2 with
`--json applies to commands that read`. With `--json`:

- on success, stdout carries the answer's JSON as the API or micad gave it,
  without rewrapping;
- on failure, stdout is empty and stderr carries one line,
  `{"error":{"code":"<code>","message":"<message>"}}`.

`code` is the API's error code (`validation_failed`, `login_throttled`, ...,
see [errors](errors.md)), the last part of a D-Bus error name, or one of
`mica`'s own: `unreachable`, `failed`, `apply_failed`, `not_found`,
`already_configured`, `not_confirmed`, `refused`.

### Exit codes

| Code | Meaning |
|---|---|
| 0 | done |
| 1 | refused or failed: a validation, a conflict, a failed task, any other error |
| 2 | misused: an unknown verb, a missing or extra argument, `--json` on a write |
| 3 | not reached: no system bus, micad not on it (`ServiceUnknown`, `NameHasNoOwner`, `NoReply`, `Timeout`, `TimedOut`, `Disconnected`, `NoServer`), apid's socket not answering or apid off, or an API answer of 503/504 |
| 4 | a credential: a wrong password or device code (`password_incorrect`, `invalid_credentials`, `device_code_incorrect`, `wrong_password`, `password_required`), or the backoff after them (`login_throttled`, any 429) |

Without `--json`, an error prints `mica <verb>: <message>` on stderr; a
refused setting names its path (`hostname: <message>`).

### Waiting for a write

A write that micad applies answers with a task. `mica` waits for it and
exits by the task's outcome: 0 when it succeeded, 1 with
`stored, but applying it failed: <reason>` when it did not. Socket verbs
read `GET /api/v1/tasks/{id}` every second for up to 120 s; bus verbs ask
micad's `GetTask` every 0.5 s for up to 300 s. A task still running at the
end exits 1 with `stored; micad is still applying it (task <id>)`: the
setting is stored and micad keeps applying it.

### Secrets

No password or Wi-Fi key is ever taken from the command line. Each comes
from one of:

- **the terminal**, with its echo off; a new secret is asked twice and
  `the two entries differ` refuses a mismatch;
- **`--password-file FILE`**, whose first line is the secret without its
  line end (`\n` or `\r\n`); `-` reads standard input. The file is at most
  4096 bytes and UTF-8; an empty first line is refused (`no ... given`).

Without `--password-file`, standard input must be a terminal:
`standard input is not a terminal; give the ... in a file`.

### Root needs no credential the device guards

Root on the device already holds everything the network checks are there
to prove, so the local socket and the bus ask for none of it:

| Verb | On the network | From `mica` as root |
|---|---|---|
| `mica setup` | the device code, on products with `CLAIM_DEVICE_CODE=required` | no device code, on every product |
| `mica password set` | the current password, counted in the backoff | no current password |
| `mica factory-reset` | the administrator password, counted in the backoff | no password; one confirmation (the hostname or `factory-reset` typed, or `--yes`) |

Each is audited with its source (`local uid 0` on the socket, `uid 0` on the
bus).

## 4. Verb list

| Verb | Does | Channel | `--json` |
|---|---|---|---|
| [`status`](#status) | the device at a glance: system, update, network, time, storage | bus | yes |
| [`setup`](#setup) | first-run setup: the administrator password | socket | no |
| [`password`](#password) | change the administrator password | socket | no |
| [`root-password`](#root-password) | set the transient root password, until the next boot | socket | no |
| [`ssh`](#ssh) | SSH on or off, and its authorized keys | socket | `status`, `keys list` |
| [`tokens`](#tokens) | API tokens: list, create, revoke | socket | `list`, `create` |
| [`get`](#get) | read one setting | socket | yes |
| [`set`](#set) | write one setting | socket | no |
| [`hostname`](#hostname) | show or set the hostname | socket | when showing |
| [`time`](#time) | time synchronization, the time zone and the NTP servers | socket | when reading |
| [`network`](#network) | the interfaces and their addresses | socket | yes |
| [`wifi`](#wifi) | the Wi-Fi station and its known networks | socket | status, `scan` |
| [`update`](#update) | look for, install or roll back a release | bus | `status` |
| [`container`](#container) | Compose projects and their containers | bus | `list`, `status` |
| [`unit`](#unit) | this device's own services | bus | `list` |
| [`web`](#web) | who reaches the API, and where it listens | bus | `status` |
| [`mdns`](#mdns) | what the device announces over mDNS | bus, files | `status`, `list` |
| [`ssdp`](#ssdp) | whether the device answers UPnP discovery | bus | `status` |
| [`reboot`](#reboot-and-poweroff) | restart the device | bus | no |
| [`poweroff`](#reboot-and-poweroff) | turn the device off | bus | no |
| [`factory-reset`](#factory-reset) | erase everything configured | bus | no |
| [`doctor`](#doctor) | collect a diagnostic snapshot | bus, files | no |
| `help` | the list, or one command's usage | — | no |

## 5. The verbs

### status

```text
mica status [--json]
```

Reads micad's `GetSystemInfo`, `GetUpdateState`, `GetNetworkState`,
`GetTimeStatus` and `GetStorageStatus` and prints one line per fact. A
member whose read failed prints `unavailable: <reason>` and the others still
print; only a failed `GetSystemInfo` fails the command.

```text
$ mica status
board      <board model>
system     <version> (<first 12 characters of the deployment id>)
core       0.0.8 (channel general)
state      <lifecycle state>
checked    <time of the last check>
uptime     2h 14m
network    enp0s2 routable 192.168.1.40/24 fe80::5054:ff:fe12:3456/64
time       synchronized
data       1.2 GiB of 3.4 GiB used
```

Values in angle brackets come from the device; the others show the format.

The `system` line is the running deployment's version and the first 12
characters of its id; `available`, `reboot`, `checked` and `refused` lines
appear when the update state has them (see [update](#update)). `uptime` is
`<d>d <h>h <m>m`, or `<h>h <m>m` under a day. `lo` is left out.

`--json` prints one object with the five answers as members: `system`,
`update`, `network`, `time`, `storage`; a member that failed is
`{"error":{"code":...,"message":...}}`.

### setup

```text
mica setup [--hostname NAME] [--password-file FILE]
```

First-run setup on an unclaimed device: sets the administrator password
and, given `--hostname`, the hostname (`POST /api/v1/setup`). No device code
is asked. The password is asked twice on the terminal unless
`--password-file` names a file.

```text
$ mica setup --hostname boat-01
Administrator password:
Administrator password again:
the device is set up
```

On a device that already has an administrator, it exits 1 with code
`already_configured`: `the device already has an administrator password;
mica password set replaces it`. apid's password rules apply (a refusal is
exit 1, `validation_failed`).

### password

```text
mica password set [--password-file FILE]
```

Sets a new administrator password without the current one
(`POST /api/v1/actions/change-password` with `newPassword` only, which apid
accepts from root on the local socket). Prints
`the administrator password is set`. The audit line is
`password changed`, source `local uid 0`. `mica password` alone exits 2
(`name the command: set`).

### root-password

```text
mica root-password [--password-file FILE]
```

Sets the transient root password, which holds until the next boot
(`POST /api/v1/actions/transient-root-password`), and waits for micad to
apply it. Prints
`the transient root password is set until the next boot`. Use it to log in
on the serial console for one boot; nothing about it survives a reboot (see
[access](access.md)).

### ssh

```text
mica ssh status [--json]
mica ssh on|off
mica ssh keys list [--json]
mica ssh keys add <file|->
mica ssh keys remove <fingerprint>
```

| Sub-verb | Does | Output |
|---|---|---|
| `status` | reads `access.ssh.enabled` | `enabled: true`; `--json` `{"enabled":true}` |
| `on`, `off` | writes `access.ssh.enabled` and waits for the task | `access.ssh.enabled is true` |
| `keys list` | `GET /api/v1/ssh/authorized-keys` | one line per key: `<fingerprint> <type> <comment>` (`(undecodable)` for a key apid cannot fingerprint), or `no authorized keys`; `--json` is the API's document |
| `keys add` | adds the one key line in the file (`-` is stdin); blank lines and `#` comments are skipped, and a file with no key or more than one is refused | `added SHA256:...` |
| `keys remove` | removes the key with that fingerprint | `removed SHA256:...` |

```text
$ mica ssh keys add /tmp/ops.pub
added SHA256:Qm9vdGluZyBpcyBhIGZpbmUgdGhpbmc
$ mica ssh on
access.ssh.enabled is true
$ mica ssh keys list
SHA256:Qm9vdGluZyBpcyBhIGZpbmUgdGhpbmc ssh-ed25519 ops@laptop
```

### tokens

```text
mica tokens list [--json]
mica tokens create <name> [--json]
mica tokens revoke <id>
```

| Sub-verb | Does | Output |
|---|---|---|
| `list` | `GET /api/v1/tokens` | `<id> <name> <created>` per token, `created` in seconds since the Unix epoch by the device clock; or `no tokens` |
| `create` | mints a token named `<name>` | the token alone on stdout (`mica_<id>_<secret>`), and on stderr `token <id> (<name>): shown once, keep it now`; `--json` is the API's answer with `id` and `token` |
| `revoke` | revokes `<id>` | `revoked <id>` |

Only the token's SHA-256 digest is stored: the secret is shown once, by
`create`. Use the token as `Authorization: Bearer mica_<id>_<secret>` on the
API ([API](api.md)).

### get

```text
mica get <path> [--json]
```

One setting by its dot path, as `GET /api/v1/settings/<path>` reads it:
secrets redacted. A string prints as is; anything else prints as indented
JSON; `--json` prints compact JSON. The paths are in
[settings](settings.md).

```text
$ mica get hostname
boat-01
$ mica get access.ssh
{
  "enabled": true,
  ...
}
```

### set

```text
mica set <path> <value>
```

Writes one setting with `PUT /api/v1/settings/<path>` and waits for the
task. Prints `<path> is <value as JSON>`. The value is **typed by the
setting**, not by how it looks:

| Setting | Type | `<value>` |
|---|---|---|
| `hostname`, `wifi.ap.mode`, `time.timezone` | string | taken as it is: `mica set hostname 1234` writes the string `"1234"` |
| `access.ssh.enabled`, `access.mdns.enabled`, `access.ssdp.enabled`, `access.cloudAdmins.enabled`, `container.enabled`, `mqtt.enabled`, `wifi.client.enabled` | switch | `true` or `false`, nothing else |
| `logging.persistent` | switch, or `null` | `true`, `false` or `null` |
| `logging.maxSizeKiB` | number, or `null` | a JSON number or `null` |
| `time.ntp.servers` | list | a JSON array, such as `'["ntp1.example.net","ntp2.example.net"]'` |
| `logging.remote` | object, or `null` | a JSON object or `null` |

A path not in this table takes the type of its current value (string,
switch, number, or JSON for a list or object); a path with no value is
refused, `<path> is not a setting mica set writes`. A value of the wrong
type is refused before anything is sent (exit 1, `validation_failed`), and
apid refuses a path it does not write, naming it. The generic `PUT` takes
the 14 paths above ([settings](settings.md)).

```text
$ mica set time.timezone Europe/Athens
time.timezone is "Europe/Athens"
$ mica set access.mdns.enabled yes
mica set: access.mdns.enabled takes true or false, not "yes"
```

### hostname

```text
mica hostname [--json]
mica hostname <name>
```

Shows the hostname, or sets it and waits for the task
(`hostname is <name>`). The name's rules are the API's.

### time

```text
mica time [--json]
mica time zone [--json]
mica time zone <zone>
mica time zones [--json]
mica time servers [--json]
mica time servers <server>...
```

| Form | Does | Output |
|---|---|---|
| `time` | `GET /api/v1/time/status` | `status: <state>`, then `synchronized: <bool>`, `server: <name or address>`, `offset: <seconds> s` when present ([time](time.md#5-synchronization-status)) |
| `time zone` | reads `time.timezone` | the zone name |
| `time zone <zone>` | writes `time.timezone` | `time.timezone is <zone>` |
| `time zones` | `GET /api/v1/time/zones` | one zone id per line (`UTC` first); `--json` adds the tzdata release and whether the stored zone is installed |
| `time servers` | reads `time.ntp.servers` | one server per line; nothing when the list is empty (the image's fallback pool) |
| `time servers <server>...` | writes `time.ntp.servers` | `time.ntp.servers is <servers>` |

```text
$ mica time
status: synchronized
synchronized: true
server: 0.debian.pool.ntp.org
offset: -0.000412 s
$ mica time servers ntp1.example.net ntp2.example.net
time.ntp.servers is ntp1.example.net ntp2.example.net
```

At most 8 servers, each a host name or address; an empty list is written
with `mica set time.ntp.servers '[]'`.

### network

```text
mica network [--json]
mica network show <interface> [--json]
```

`mica network` reads the observed state (`GET /api/v1/network/status`) and
prints one line per interface but `lo`: name, operational state, addresses.
`show` prints one interface:

```text
$ mica network
enp0s2 routable 192.168.1.40/24 fe80::5054:ff:fe12:3456/64
wlan0 no-carrier
$ mica network show enp0s2
name: enp0s2
state: routable
hardware address: 52:54:00:12:34:56
address: 192.168.1.40/24
address: fe80::5054:ff:fe12:3456/64
dns: 192.168.1.1
```

`gateway:` lines appear for default routes and `wifi: <ssid>` for an
associated wireless interface. An unknown name exits 1 with
`no interface named <name>` (code `not_found`). `--json` prints the whole
document, or the one interface's object with `show`
([diagnostics](diagnostics.md#3-the-observed-network-state)). Changing the
network is the console's or `mica set`'s, not this verb's.

### wifi

```text
mica wifi [--json]
mica wifi scan [--json]
mica wifi on|off
mica wifi add <ssid> [--password-file FILE] [--open] [--hidden]
mica wifi remove <ssid>
```

| Form | Does | Output |
|---|---|---|
| `wifi` | `GET /api/v1/wifi/client` and `/wifi/client/networks` | `enabled: <bool>`, `interface: <name>`, `connected: <ssid>` when associated, then `known: <ssid> (priority <n>[, open][, hidden])` per network; `--json` is `{"client":...,"networks":...}` |
| `wifi scan` | `POST /api/v1/wifi/client/scan` | `<ssid or (hidden)> <signal> dBm <channel> <security>` per network, strongest first; or `no scan: <reason>` |
| `wifi on`, `off` | writes `wifi.client.enabled` | `wifi.client.enabled is true` |
| `wifi add` | remembers a network; its key is asked twice unless `--password-file` names a file, or `--open` says it has none (`--open` with a file is exit 2) | `remembered <ssid>` |
| `wifi remove` | forgets a network | `forgot <ssid>` |

```text
$ mica wifi add Marina-Guest
Network key:
Network key again:
remembered Marina-Guest
$ mica wifi on
wifi.client.enabled is true
```

On one radio the station and the access point cannot both run; see
[Wi-Fi](wifi.md#5-the-single-radio-conflict--reported-as-shipped-not-arbitrated).

### update

```text
mica update [status] [--json]
mica update check
mica update install [--reboot]
mica update rollback [--reboot]
```

| Form | Does |
|---|---|
| `update`, `update status` | prints the running system and the update state; `--json` prints micad's update state document |
| `update check` | asks micad to check the update source, follows the state and prints `available: <system or core> <version>` or `up to date` |
| `update install` | asks micad to check, download and install the newest release, printing each step once (`checking...`, `downloading...`, `installing...`), then `installed; reboot to run it (or run again with --reboot)`, `installed` (nothing to reboot), or `up to date` |
| `update rollback` | returns to the retained previous system when micad permits it: `rolled back to <id>; reboot to run it ...`; otherwise exit 1, `rollback is not possible: <reason>` |

`--reboot` reboots through micad once the change needs it, printing
`<what>; rebooting`. A refusal or failure during `check` or `install` exits
1 with micad's reason; if the state stops moving for 10 s, `install` exits 1
with `stopped at <state>; see mica update status`.

```text
$ mica update
system     <version> (<short deployment id>)
core       0.0.8 (channel general)
state      <lifecycle state>
available  system <version>
checked    <time of the last check>
```

Lines, in order: `system` (version and short id), `core` (the core set and
its channel), `state` (and `: <reason>`), `available`, `reboot` (`needed to
run what is installed`), `checked`, `refused`. The states and refusals are
in [updates](updates.md); the offline archive path stays with the console
and the API ([operate: updates](../operate/updates.md)).

### container

```text
mica container up [--project <project>] [--file <file|->] [--project-dir <dir>]
mica container down [--project <project>]
mica container list [--json]
mica container check [--project <project>] [--file <file|->] [--project-dir <dir>]
mica container start|stop|restart <project>[/<service>]
mica container logs <project>/<service> [--tail N]
mica container status [--json]
mica container on|off
```

| Sub-verb | Does |
|---|---|
| `up` | checks a Compose file, stores it as the project with its directory, turns containers on and waits: `<project> declared, in <dir>` |
| `down` | removes the project from `container.projects`: `<project> removed; its files and volumes stay` |
| `list` | every project's containers: a table `PROJECT SERVICE CONTAINER PHASE HEALTH` (a declared project with nothing running shows `not running`); a line above it says when containers are off or the engine is not answering |
| `check` | checks a Compose file without storing it; prints the containers it would make as JSON |
| `start`, `stop`, `restart` | the project's every container, or one service's |
| `logs` | the last lines of one service's log, 100 unless `--tail` (1 to 1000) |
| `status` | `enabled: <bool>` (`container.enabled`) |
| `on`, `off` | writes `container.enabled`; the projects stay declared |

The file, the directory and the name are found as `docker compose` finds
them: the file is the first of `compose.yaml`, `compose.yml`,
`docker-compose.yaml`, `docker-compose.yml` in the working directory unless
`--file` names one (`-` is stdin); the project directory, where relative
host paths resolve, is the file's directory (the working directory for
stdin) unless `--project-dir` names one; the project is `--project`, else
the file's `name:` key, else the project directory's name in lower case
with only `a-z`, `0-9`, `_` and `-` kept. A project name is 1 to 40 of those
characters, starting with a letter or digit; a file is at most 64 KiB of
UTF-8.

A refused file exits 1 and lists each problem on stderr:

```text
mica container: project web is refused
  app.privileged: <reason>
```

On a Docker product (`uefi-x64.docker`, `uefi-x64.gcp`, `cx3576.full`),
`up`, `down` and `check` exit 1 with `this is a docker product: containers
are made with docker and docker compose, not declared to micad; use docker
compose`; `list`, `status`, `on`, `off`, `start`, `stop`, `restart` and
`logs` still work. See [containers](../integrate/containers.md).

### unit

```text
mica unit install <file|-> [--name <name>] [--conf <file>] [--enable]
mica unit enable|disable <name>
mica unit remove <name>
mica unit start|stop|restart <name>
mica unit list [--json]
mica unit logs <name> [--tail N]
mica unit fstab check [<file>]
```

The device's own services, declared in `services.units` and kept by Base's
`mica-unit` (`/usr/lib/mica/mica-unit`). Under systemd a unit file; under
OpenRC an `openrc-run` script. Under systemd a name without a unit type is a
`.service`.

| Sub-verb | Does | Output |
|---|---|---|
| `install` | stores the file (at most 64 KiB) as one of this device's services; its name is the file's unless `--name` gives one (`-` reads stdin and needs `--name`); `--conf` gives an OpenRC script its `conf.d` settings (at most 16 KiB); `--enable` enables it, and a service already enabled stays so | `<name> installed[, enabled]` |
| `enable` | starts it now and at every boot | `<name> enabled` |
| `disable` | stops it now and no longer at boot | `<name> disabled` |
| `remove` | stops and deletes it | `<name> removed` |
| `start`, `stop`, `restart` | the service, now; one declared here or put there with `mica-unit` | — |
| `list` | every service, declared here or put there by hand | table `NAME ENABLED ACTIVE MANAGED`, `MANAGED` being `micad`, `by hand` or `refused: <reason>` |
| `logs` | its newest lines, 200 unless `--tail` (1 to 200) | the lines |
| `fstab check` | OpenRC only: checks the user's mounts, `/usr/local/etc/fstab` or `<file>`, as Base applies them at boot | exit 0 accepted, 1 refused (each refusal named), 2 misused |

`enable`, `disable` and `remove` refuse a service not declared here:
`no service named <name> is declared here`. Under systemd, `fstab check`
exits 2: the user's mounts are `.mount`, `.automount` and `.swap` units,
installed with `mica unit install` ([storage](storage.md#user-mounts)).

```text
$ mica unit install /root/logger.service --enable
logger.service installed, enabled
$ mica unit list
NAME            ENABLED  ACTIVE  MANAGED
logger.service  yes      active  micad
```

### web

```text
mica web status [--json]
mica web network|local|off
```

| Form | Does | Output |
|---|---|---|
| `status` | reads `access.web` | `mode: <mode>`, and in `network` mode `http: <port>` and, with HTTPS on, `https: <port>`; `--json` prints `access.web` |
| `network` | the console and the API on the network, and the local socket | `access.web.mode is network` |
| `local` | the API on apid's local socket alone, for root on this device | `access.web.mode is local` |
| `off` | no API: apid stops | `access.web.mode is off` |

```text
$ mica web status
mode: network
http: 8080
https: 8443
```

In `off`, every socket verb exits 3 until `mica web local` or
`mica web network` brings apid back ([access](access.md)).

### mdns

```text
mica mdns status|list [--json]
mica mdns on|off
mica mdns add NAME --type _x._tcp --port N [--instance S] [--txt KEY=VALUE]...
mica mdns remove NAME
```

| Form | Does | Output |
|---|---|---|
| `status` | micad's `mdns` state | `enabled: <bool> (<source>)`, `hostname: <name>`, `published: <n> of <m>`, and `error: ...` when there is one |
| `list` | every service | `<instance>.<type> port <n> <source> published` (or `not-published`) per service, then `refused <source>: <error>` per refused drop-in |
| `on`, `off` | writes `access.mdns.enabled`; `off` keeps drop-ins | `access.mdns.enabled is true` |
| `add` | publishes one service until reboot, writing `/run/mica/mdns.d/NAME.json` (`{"version":1,"services":[...]}`, mode 0644) | `/run/mica/mdns.d/NAME.json is published until reboot` |
| `remove` | removes that file | `/run/mica/mdns.d/NAME.json is removed`; a missing file is exit 1 |

`NAME` is 1 to 32 of `a-z`, `0-9` and `-`, a letter or digit first; `--type`
and `--port` are required, `--txt` repeats.

```text
$ mica mdns add nmea --type _nmea-0183._tcp --port 10110 --txt board=cx3576
/run/mica/mdns.d/nmea.json is published until reboot
```

### ssdp

```text
mica ssdp status [--json]
mica ssdp on|off
```

`status` prints `enabled: <bool> (<source>)`, `active: <bool>`, then
`reason`, `error`, `udn`, `friendly name` and `model` lines when present.
`on` and `off` write `access.ssdp.enabled`; `off` means no responder and no
socket.

### reboot and poweroff

```text
mica reboot
mica poweroff
```

micad asks the init to restart or turn off the device, as the console's
buttons do, and `mica` prints `rebooting` or `powering off`. They use the
bus, so they work with apid off.

### factory-reset

```text
mica factory-reset [--yes]
```

Prints what it erases and keeps, then asks for one confirmation: type the
hostname or `factory-reset`. `--yes` confirms without asking, for a script;
without `--yes` standard input must be a terminal (else exit 2). No password
is asked: micad stages the reset for root (bus `FactoryReset`, source
`uid 0`).

```text
$ mica factory-reset
  Erases everything configured on this device: the administrator and the
  claim, settings, networks, keys, containers and all data on DATA.
  Keeps the software at its current version. The device reboots and erases
  before anything else runs; it then starts as it did on its first boot.
  It is not a certified wipe.

Type the hostname (boat-01) or factory-reset to confirm: factory-reset
The factory reset is staged. The device reboots in a few seconds, erases everything configured and starts as on its first boot.
```

Anything else typed exits 1, `not confirmed; nothing was reset`. micad's
refusals still apply and exit 1 with their code: `data_encrypted` (DATA is
encrypted, and the boot does not reset an encrypted DATA),
`factory_reset_unsupported` (the booted runkit does not carry a reset out),
`update_in_progress`, `trial_pending`, `not_claimed`. What is erased and
kept is in [recovery](recovery.md#23-factory-reset).

### doctor

```text
mica doctor
```

Collects a diagnostic snapshot, redacted as the API's, into
`/mica/diagnostics` and prints its path, for example
`/mica/diagnostics/3.json`. It works whatever the web mode is. The snapshot,
its bounds and its redaction are in [diagnostics](diagnostics.md).

## 6. `mica internal`: factory and build use

These tools are for the image build and the factory, not for operating a
device, and `mica help` does not list them. `--json` does not apply.

| Command | Does | Output |
|---|---|---|
| `mica internal device-code` | prints this device's code and where it comes from (`emmc-cid`, `dt-serial`, `dmi-serial`, `dmi-uuid`, `mac`, `random`) | `<code> (<source>)`; exit 1 with `this device has no code: <reason>` |
| `mica internal derive-ap-key --secret FILE CODE` | derives the factory access point's SSID and key for a device code under the product secret in `FILE` | `ssid=mica-....` and `psk=...` |
| `mica internal board check FILE` | checks a board interface declaration (`/usr/share/mica/board/interfaces.json` format) against this build | `<file>: discover` or `<file>: <n> interfaces` |

The AP secret and the key derivation are described in
`mica-core:docs/factory-ap-key.md`; keep product secrets out of shell
history and logs ([manufacturing](manufacturing.md)).
