# Products

A product is one image recipe, named `<board>.<variant>`, and is released on its
own as `<board>.<variant>.<YYYYMMDD-HHMM>`. What a product contains is declared
in `mica-build:boards/<board>/products/<variant>/product.env`; the rules for
every key are `mica-build:boards/products.md`. This page lists the released
products and what each one carries, from `mica-build` `main`. Which board to
pick is [hardware](../hardware/README.md); how releases are cut and named is
[release notes](../releases/release-notes.md).

## The released products

| Product | Board | Arch | Init | Features | Containers | SSH server | Images |
|---|---|---|---|---|---|---|---|
| `uefi-x64.full` | uefi-x64 | amd64 | systemd | micad, ui, ssh, tools, mqtt, containers, iproute2 | Podman | dropbear | `disk` |
| `uefi-x64.docker` | uefi-x64 | amd64 | systemd | micad, ui, ssh, tools, mqtt, containers, iproute2 | Docker | dropbear | `disk` |
| `uefi-x64.gcp` | uefi-x64 | amd64 | systemd | micad, ui, ssh, tools, containers, iproute2; component `gce` | Docker | OpenSSH | `disk`, `gce` |
| `mini-x64.basic` | mini-x64 | amd64 | OpenRC | micad, ui, ssh | — | dropbear | `disk` |
| `cx3576.full` | cx3576 | arm64 | systemd | micad, ui, ssh, tools, mqtt, containers, iproute2, wifi, bluetooth | Docker | OpenSSH | `disk` |
| `s905x5m.sd-full` | s905x5m | arm64 | systemd | micad, ui, ssh, tools, mqtt, containers, iproute2, wifi, bluetooth | Podman | dropbear | `disk`, `sd-boot` |
| `s905x5m.emmc-full` | s905x5m | arm64 | systemd | micad, ui, ssh, tools, mqtt, containers, iproute2, wifi, bluetooth | Podman | dropbear | `usb-burn` |
| `qemu-armhf.basic` | qemu-armhf | armhf | OpenRC | micad, ui, ssh | — | dropbear | `disk` |

Every released product is `PROFILE=prod`. The features mean:

| Feature | What the root carries |
|---|---|
| `micad` | the management daemon and its HTTP API, as a core component ([micad](management.md)) |
| `ui` | the built-in web console at `/_ui/`; without it the device is API-only |
| `ssh` | an SSH server, driven by micad as `mica-sshd` |
| `tools` | the operator tools beyond busybox: GNU coreutils, findutils, grep, sed, diffutils, gzip, bash, process and module tools, device-mapper tools, the nftables command |
| `mqtt` | the MQTT broker and the bridge (`mica-mqtt-broker`, `mica-mqttd`) |
| `containers` | a container engine, Podman (driven through `mica-containerd`) or Docker ([containers](../integrate/containers.md)) |
| `iproute2` | `ip`, `ss`, `bridge`, `tc` for diagnosing links and routes |
| `wifi`, `bluetooth` | the radios, where the board has them |

## Per-product settings

| Product | Device code source | Claim asks for the code | mDNS / SSDP | Cloud admins | First-boot SSH | Watchdog | Handover, trial deadline | DATA encryption |
|---|---|---|---|---|---|---|---|---|
| `uefi-x64.full`, `uefi-x64.docker` | `dmi-serial` | off | on | off | off | `watchdog0` | 120 s, 600 s | off |
| `uefi-x64.gcp` | `random` | required | off | on | on | `Software Watchdog` (softdog) | 120 s, 600 s | off |
| `mini-x64.basic` | `dmi-serial` | off | on | off | off | `watchdog0` | 120 s, 600 s | off |
| `cx3576.full` | `emmc-cid` | off | on | off | off | `watchdog0` | 120 s, 900 s (provisional) | off |
| `s905x5m.sd-full`, `s905x5m.emmc-full` | `emmc-cid` | off | on | off | off | `watchdog0` | 120 s, 1200 s on `sd-full`, 900 s on `emmc-full` (provisional) | off |
| `qemu-armhf.basic` | `mac` | off | on | off | off | `watchdog0` | 120 s, 1800 s (provisional) | off |

"off" in a column with no key in `product.env` is the default the key rules
give. The watchdog column is the one the runkit arms; the next is its timeout
at the handover to the init (`handoverS`) and how long a trial boot has to be
confirmed (`confirmS`); the ARM values are provisional until measured on
hardware ([boot](boot.md#the-trial-deadline)). `CLAIM_DEVICE_CODE` is `off` on every product but the GCP one because
their serials are placeholders no label carries, or the code is shown only on
the serial console. Every released product bakes the update policy `check`
every 1440 minutes against `https://res.micaos.dev/update/`
([the update engine](updates.md#the-policy-document)).

## Per-board facts

| Board | Boot | Storage | Size budget | Board features | Release target |
|---|---|---|---|---|---|
| uefi-x64 | systemd-boot (UKI) | GPT | 520 MB | containers | yes |
| uefi-arm64 | systemd-boot (UKI) | GPT | 520 MB | containers | yes (no product released yet) |
| mini-x64 | systemd-boot (UKI) | GPT | 130 MB | containers | yes |
| cx3576 | U-Boot, signed FIT | GPT | 400 MB | wifi, bluetooth, display, status-led, can, usb-gadget, containers | yes |
| s905x5m | U-Boot, signed FIT | GPT | 400 MB | wifi, bluetooth, display, audio, containers | yes |
| qemu-armhf | U-Boot, FIT hashes only (`BOOT_TRUST=none`) | UBI on NOR | 44 MB | — | yes |

The board's kernel features are [kernel features](kernel-features.md); its
partition sizes are [storage](storage.md#partitions-per-board).

## Products that are not released

The tree also holds products that are built for development or tests and never
released: every `dev` and `emmc-dev` variant (`PROFILE=dev`), `uefi-x64.base`
(no micad), `uefi-x64.basic`, `uefi-arm64.basic`, `uefi-arm64.full`,
`cx3576.basic`, `s905x5m.basic`, `ssd202d.basic`, and `uefi-x64.gcp-tpm2`
(`RELEASE=never`: the test image with DATA encryption and the `tpm2` key
provider).

## Checking which product a device runs

| Check | Expect |
|---|---|
| `cat /usr/lib/mica/product.conf` on the device | `PRODUCT=`, `FEATURES=`, `INIT=` and the other lines above |
| `GET /api/v1/meta` | `features` and the documentation roots |
| `GET /api/v1/system/info` | board, product and the running deployment |
