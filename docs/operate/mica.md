# The `mica` command

`mica` is the one command for root on the device: over SSH, or at a local
console where the product has one. It does what the console does, without a
browser and without the network: the setup, the administrator password,
SSH, tokens, settings, network, Wi-Fi, time, updates, containers, the user's
services, the web mode, LAN discovery, power, the factory reset and the
diagnostic snapshot. The contract is `mica-core:docs/mica-core.md`
section 3.15.

> A device on a release of 2026-11-14 or earlier has no `mica` command:
> update it first ([updates](updates.md)), or use that release's `micad`
> commands (`micad web`, `micad unit`, `micad factory-reset`, ...). The
> operating guides use `mica` throughout.

## 1. How it works

- `/usr/bin/mica` is a link to `micad`. `micad` itself runs only
  `micad daemon` and `micad apid`, as their services do; any other word exits
  2 and names the `mica` verb to use.
- Verbs are full words, with no short forms or aliases. `mica help` lists
  them; `mica help <verb>` or `mica <verb> help` gives one's usage.
- What micad decides (updates, containers, services, the web mode, power,
  the factory reset) is asked over the system bus, so it works in every web
  mode. What apid decides (credentials, and the settings the API writes) is
  asked on apid's local socket as an API call, checked and audited as
  `local uid 0`. With the web mode `off` those verbs exit 3 and say that
  `mica web local` serves the local socket alone.
- Root on the device is asked for no device code and no current
  administrator password; the factory reset asks for no password either.
- A password or a network key is never an argument: it is asked for on the
  terminal with the echo off (a new one twice), or read from the file a
  `--…-file` flag names (`-` is standard input), its one line the secret.

> status: shipped — evidence: `mica-core:docs/mica-core.md`, `mica-core:crates/micad/src/cli.rs`

## 2. The verbs

| Verb | Does |
|---|---|
| `setup [--hostname NAME] [--password-file FILE]` | claims the device: the administrator password, asked twice; no device code |
| `password set [--password-file FILE]` | a new administrator password, without the current one |
| `root-password [--password-file FILE]` | the transient root password, until the next boot |
| `ssh status`, `ssh on\|off`, `ssh keys list`, `ssh keys add <file\|->`, `ssh keys remove <fingerprint>` | SSH and its authorized keys |
| `tokens list`, `tokens create <name>`, `tokens revoke <id>` | API tokens; `create` prints the token once |
| `get <path>`, `set <path> <value>` | one setting, read (secrets redacted) or written and waited for. The value is typed by the setting: a string as given, a switch `true` or `false`, a number, or JSON for a list or an object |
| `hostname [NAME]` | the host name, read or written |
| `time`, `time zone [ZONE]`, `time zones`, `time servers [SERVER...]` | synchronization, the zone, the zones on offer, the NTP servers |
| `network`, `network show <interface>` | each interface's state and addresses, or one in full |
| `wifi`, `wifi scan`, `wifi on\|off`, `wifi add <ssid> [--password-file FILE] [--open] [--hidden]`, `wifi remove <ssid>` | the Wi-Fi client and its networks |
| `status` | board, running system and update state, uptime, interfaces, time and DATA's use in one screen |
| `update status\|check\|install\|rollback [--reboot]` | the console's update requests; `install` and `rollback` reboot only with `--reboot` ([updates](updates.md)) |
| `container ...` | containers ([containers](../integrate/containers.md)) |
| `unit ...` | the user's own services ([native applications](../integrate/native-applications.md) section 10); on OpenRC, `unit fstab check [<file>]` checks `/usr/local/etc/fstab` or the file ([storage](storage.md)) |
| `web status`, `web network\|local\|off` | where the API listens ([configuration](configuration.md)) |
| `mdns status\|list\|on\|off\|add\|remove`, `ssdp status\|on\|off` | LAN discovery |
| `reboot`, `poweroff` | power |
| `factory-reset [--yes]` | the factory reset ([recovery](recovery.md)): prints what is erased and what is kept, then waits for the hostname or `factory-reset` to be typed, or takes `--yes`; without either, or without a terminal, nothing is reset |
| `doctor` | collects the diagnostic snapshot into the device's store and prints its path ([troubleshooting](troubleshooting.md)) |
| `help [verb]` | the verbs, or one's usage |

`mica internal device-code`, `mica internal derive-ap-key` and
`mica internal board check` are the build's and the factory's tools; `mica help`
does not list them.

> status: shipped — evidence: `mica-core:docs/mica-core.md`

## 3. Output and exit codes

`--json` on a verb that reads (`status`, `update status`, `container list`,
`unit list`, `web status`, `get`, `network`, `wifi`, and the other reads)
prints its answer as JSON on standard output. On a failure standard output is
empty and standard error is one object, `{"error": {"code", "message"}}`.

| Exit | Means |
|---|---|
| 0 | done |
| 1 | refused or failed |
| 2 | misused: an unknown verb, a short form, a missing or extra argument |
| 3 | micad or apid not reached (no bus, apid off, the API's 503 or 504) |
| 4 | a wrong or missing password, or the backoff after one |

> status: shipped — evidence: `mica-core:docs/mica-core.md`

## 4. A worked example: a first session

A claimed `uefi-x64.full` device with SSH on and your key added
([SSH](ssh.md)):

```sh
ssh root@mica-a4e2e69e.local
mica status
# board      <board model>
# system     <version> (<id, 12 hex>)
# core       0.0.8 (channel general)
# state      succeeded: The boot health gate confirmed this deployment
# uptime     2h 14m
# network    eth0 routable 192.168.1.40/24
# time       synchronized
# data       1.2 GiB of 28.9 GiB used
mica help update                     # one verb's usage
mica tokens create laptop            # the token on standard output, once
# mica_<id>_<secret>
# token <id> (laptop): shown once, keep it now        (on standard error)
mica set time.timezone Europe/Athens
# time.timezone is "Europe/Athens"
mica status --json | jq -r .update.lifecycle.state
# succeeded
```

The token is for the workstation's scripts ([API](api.md) section 6); copy
it now, because nothing shows it again. `mica status --json` is one object
with the members `system`, `update`, `network`, `time` and `storage`, each
the answer micad gave, or an `error` object where it could not answer.

### Check it worked

```sh
mica tokens list                     # <id> laptop <created>
mica get time.timezone; echo "exit $?"
# Europe/Athens
# exit 0
mica set time.zone Europe/Athens; echo "exit $?"
# mica set: ...                      (the refusal, naming the path)
# exit 1
mica tim; echo "exit $?"
# exit 2                             (no short forms: the verbs are full words)
```

The exit codes are section 3's, so a script can tell a refusal (1) from a
mistake in the call (2), an unreachable micad or apid (3) and a wrong
password (4). On a device whose web mode is `off`, the verbs that go
through apid (`tokens`, `get`, `set` and the other settings) exit 3, and
`mica web local` brings the local socket back.

> status: shipped — evidence: `mica-core:crates/micad/src/cli.rs`, `mica-core:crates/micad/src/cli/status.rs`, `mica-core:crates/micad/src/cli/account.rs`, `mica-core:crates/micad/src/cli/settings.rs`
