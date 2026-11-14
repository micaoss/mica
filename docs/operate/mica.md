# The `mica` command

`mica` is the one command for root on the device: over SSH, or at a local
console where the product has one. It does what the console does, without a
browser and without the network: the setup, the administrator password,
SSH, tokens, settings, network, Wi-Fi, time, updates, containers, the user's
services, the web mode, LAN discovery, power, the factory reset and the
diagnostic snapshot. The contract is `mica-core:docs/mica-core.md`
section 3.15.

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
