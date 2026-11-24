# Release notes: core 0.0.9 round (2026-11-24)

What the round released on 2026-11-24, what is new in core 0.0.9, and what it
fixes. Release facts come from what each release publishes
([release notes](release-notes.md)); this page summarizes them and links to the
guides.

## 1. What was released

| Part | Release |
|---|---|
| core 0.0.9 | mica-core `20261124-0755`: `mica-deploy` and `mica-lifecycle` `0.0.9-1`, `micad` and `mica-apid-ui` `0.0.9` |
| core set | `core.general.20261124-1328`, generation 7 |
| mica-system-base | `20261124-0653` |
| mica-podman, mica-docker | `20261123-1821` (Podman 6.2.0) |
| kernels | `6.12.119` on `uefi-x64`, `mini-x64` and `qemu-armhf`; `cx3576` (`6.1.192`) and `s905x5m` unchanged ([kernel features](../reference/kernel-features.md#kernel-releases)) |

| Product | Release |
|---|---|
| `cx3576.full` | `20261124-1332` |
| `mini-x64.basic`, `uefi-x64.full`, `s905x5m.sd-full`, `qemu-armhf.basic` | `20261124-1351` |
| `s905x5m.emmc-full` | `20261124-1411` |
| `uefi-x64.docker` | `20261124-1505` |
| `uefi-x64.gcp` | `20261124-1535` |

Not released in this round: `uefi-arm64`, `ssd202d`, `gcp-tpm2` and
`openrc-full`. The GCP product is an image file to import; there is no public
Compute Engine image family for releases. Downloads are on
[download](../start/download.md).

> status: shipped — evidence: `docs/start/download.md`, `tools/docs/reference-core.pin`

## 2. New in core 0.0.9

- **Uplink reachability check and failover.** An uplink can be checked by
  probes out of that interface, by default to `1.1.1.1` and `8.8.8.8` over
  TCP port 53 every 10 s with a 2 s timeout. After 3 failed rounds in a row
  the traffic moves to the next uplink that answers, and it comes back after
  5 good rounds. DNS follows the active uplink on systemd and OpenRC. The
  check is off by default; switched on, the device contacts its targets every
  interval. Static gateways now take metric 20 and up, and a declared default
  route below 20 is refused (`route_metric_reserved`). The network status,
  `mica network` (an INTERNET column, `*` on the active uplink) and the
  console's interface pages and Wi-Fi tab show and set the check
  ([network](../operate/network.md#5-two-uplinks-and-failover)).
- **One set of network rules for every writer.** The console and API, BLE
  provisioning, a settings path over the bus and `mica` meet the same rules
  with the same codes, including a WireGuard listen port a service already
  holds (`port_in_use`) ([errors](../reference/errors.md)).
- **The boot watchdog is handed over by name.** The runkit names the watchdog
  it armed to the root's init, which feeds that one, and sets the board's
  handover timeout (default 120 s) ([boot](../reference/boot.md#4-mica-runkit-init-stage-by-stage)).
- **A trial deadline.** A trial boot not confirmed within the board's
  `confirmS` (600 s on `uefi-x64` and `mini-x64`, up to 1800 s on
  `qemu-armhf`; the ARM values are provisional) is failed and rebooted, and
  falls back after its tries. A confirmed boot is never failed for being
  slow. On OpenRC the deadline starts in sysinit, logs to the kernel log, and
  a boot hung inside a runlevel is rebooted by the kernel
  ([the trial deadline](../reference/boot.md#the-trial-deadline)).
- **The configuration reset keeps the user's applications**: declared
  services, container projects and paired Bluetooth devices stay
  ([recovery](../operate/recovery.md)).
- **With HTTPS on, the HTTP port answers `308 Permanent Redirect`**, keeping
  the host, path and query ([HTTP API](../reference/http-api.md)).
- **apid restarts only when its web settings changed** from what it started
  with; an OpenRC boot no longer restarts it needlessly.
- **Dependencies:** zip 9.0.5 (RUSTSEC-2026-0548), url 2.5.9
  (RUSTSEC-2026-0592), cookie 0.18.3 (RUSTSEC-2026-0594, test-only).
  RUSTSEC-2026-0543 (chrono, unmaintained, no fixed version) is an
  acknowledged advisory.

> status: shipped — evidence: `mica-core:docs/mica-core.md`, `mica-core:docs/plan/uplink-failover.md`

## 3. Fixed from 0.0.8 and earlier

| What happened | Releases | Now |
|---|---|---|
| `mica network` printed an empty list | 0.0.8 | it lists the observed interfaces again, with their internet check ([cli](../reference/cli.md#network)) |
| `mica-deploy ... --reboot` on OpenRC did the action but did not reboot | 0.0.8 and earlier | mica-deploy reboots and powers off through the root's init: `openrc-shutdown` on OpenRC, `systemctl` on systemd |
| a configuration reset dropped the declared user services, container projects and paired Bluetooth devices, and micad then removed the units it had installed and the declared containers | 0.0.8 and earlier | the configuration reset keeps them; the container switch goes back to its default ([recovery](../operate/recovery.md)) |

> status: shipped — evidence: `mica-core:docs/mica-core.md`, `mica-core:crates/micad/src/cli/network.rs`

## 4. Moving a device to this round

A device on an earlier release takes this round as an ordinary update, online
or offline ([updates](../operate/updates.md)). The new release boots on trial
and confirms as before; from this round on, a trial boot also has the
board's deadline. Nothing on DATA is migrated, and a fallback to the previous
deployment keeps the same DATA.

> status: shipped — evidence: `docs/operate/updates.md`, `docs/reference/boot.md`
