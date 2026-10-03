# Mica OS

> English | [中文](README.zh-CN.md)

**Build the product, not the OS.**

An embedded Linux operating system for devices that ship to the field. You
choose the board and own the application; the operating system underneath is
reproducible, updatable in the field, and recoverable when an update goes
wrong.

This repository is the front door of the project. Start here; every other
repository of the [`micaoss`](https://github.com/micaoss) organisation holds
one part of the code and its own development records, and points back here
for the conventions every repository follows and the public documentation.

## What it is

- **A read-only, integrity-verified root.** Each system image is a squashfs
  sealed by dm-verity; every block read at runtime is checked against a root
  hash fixed at build time, so there is nothing on the root to drift.
- **Signed A/B updates.** Kernel, support, root and core components are
  installed as authenticated deployments, and the management plane can be
  updated on its own, without a new root. A new deployment must pass a health check
  after boot; a failed one falls back to the deployment that last worked, and
  your data on the DATA partition is kept.
- **One management plane.** `micad` owns the device's settings and drives
  the init to match them (network, Wi-Fi, SSH, containers, MQTT); `mica-apid`
  serves the authenticated API and a built-in web console, on plain HTTP port
  8080 by default and on HTTPS (8443) once it is turned on.
- **Your choice of init.** The base root carries none: each product runs
  systemd or OpenRC, and every package ships its services for both.
- **Applications on top, not inside.** Native applications enter the image as
  Debian packages and update with the system; independently released ones run
  as pinned OCI containers under Podman, declared to micad and supervised by
  `mica-containerd` on either init.
- **Offline first.** A device is set up and configured without a network or
  a cloud service, and SSH is off by default.

What it is not: a general-purpose distribution (there is no `apt` on the
device), a cloud or server OS, or a fleet management service.

## Project status

Mica OS is under active development. Every board below is a release target:
each of its products (`<board>.<variant>`: `basic`, the default, and `full`,
which adds the container engine) is built, signed and published as a release
of its own — which says nothing about whether the board boots on hardware.

| Board | Hardware | Status (2026-10-01) | Released products |
|---|---|---|---|
| `uefi-x64` | generic amd64, UEFI | bring-up, QEMU baseline; booted in a release run | none yet |
| `uefi-arm64` | generic arm64, UEFI | bring-up, QEMU reference; built and verified, not booted automatically | none yet |
| `cx3576` | Rockchip RK3576 | bring-up; started by nothing automatic — no suite boots a FIT image | `cx3576.full` |
| `s905x5m` | Amlogic S7D (BM201) | bring-up; started by nothing automatic, and no supported way to install onto a blank board | none yet |
| `mini-x64` | generic amd64, UEFI, 128 MB of flash | bring-up, QEMU; one product, `mini-x64.basic`, on OpenRC | `mini-x64.basic` |

A product with no release yet has no image to download; build it from source
([build guide](docs/start/build.md)).

No board is qualified: no board page carries a dated physical qualification row,
and no physical boot has an evidence row — a `cx3576` bench boot was reported
on 2026-09-20 with no artefact, which moves nothing. The
[support tiers](docs/hardware/README.md) page is the authoritative,
up-to-date table and explains what each tier means; the Chinese
[hardware list](docs/zh/hardware/README.md) covers the same ground per board.

## Get started

| I want to… | Read |
|---|---|
| Understand how the system fits together | [Architecture](docs/architecture.md) |
| Build an image and boot it | [Quickstart](docs/start/quickstart.md), [build guide](docs/start/build.md), [installation](docs/start/install.md) |
| Configure and operate a device | [First run](docs/start/first-run.md), [configuration](docs/operate/configuration.md), [updates and rollback](docs/operate/updates.md) |
| Run my application on it | [Applications](docs/integrate/applications.md), [containers](docs/integrate/containers.md) |
| Bring up a new board | [`mica-build:boards/`](https://github.com/micaoss/mica-build/blob/main/boards/README.md), where each board carries its whole build |
| Review the security posture | [Security](docs/security/overview.md), [security model](docs/security/model.md) |
| Browse everything | [Documentation catalog](docs/README.md) · [中文用户指南](docs/zh/README.md) |

## Repositories

| Repository | What it holds |
|---|---|
| **`mica`** (this one) | the product documentation: architecture, user and integrator guides, supported hardware, the product's design contracts and product decisions |
| `mica-build` | the boards (BSPs, kernels, board packages) and the image assembly: composes, signs, verifies and tests a product image |
| `mica-core` | the management plane (`micad`, `mica-apid`, the dashboard) and the on-device deployment client |
| `mica-system-base` | the board-independent base system: the pinned Debian packages, the system policy, the floor root and the two inits |
| `mica-podman` | the container engine package |
| `mica-build-env` | the build environment images every repository builds in |
| `mica-build-tools` | the one implementation of the release-lock and build rules every repository runs |

Product documentation lives here; each module's documentation lives in the repository
that produces it. Documents here cite code in the other repositories as
`<repository>:<path>`.

## Packages

An image is composed from Debian packages. `mica-build` imports each one,
pinned, from the repository that produces it, except the board packages, which
it builds from its own `boards/` and `common/`. Every pin is its producer's
latest release (`bin/mica-tools locks update`).

| Repository | Packages |
|---|---|
| `mica-system-base` | `mica-system` (the system policy), `mica-busybox` (the floor's command set), `mica-ca-trust`, the inits `mica-systemd` and `mica-openrc` with `mica-mdev`, `mica-ssh`, `mica-tzdata`, the Wi-Fi packages `mica-wifi` and `mica-wifi-ap`, `mica-bluetooth`, `mica-systemd-boot` (the unsigned boot loader, signed by `mica-build`; never installed into a root) |
| `mica-core` | the core components `micad` (with `mica-apid`) and `mica-apid-ui`, verity images composed over the root at boot; the packages `mica-mqttd`, `mica-mqtt-broker`, `mica-sftp-server`, `mica-deploy` and `mica-lifecycle` (the early-boot and shutdown executable; never installed into a root) |
| `mica-build` | `mica-board-<board>` for each board, and s905x5m's component packages; kernels, U-Boot and firmware are published as separate board component artifacts, not packages |
| `mica-podman` | `mica-podman` (the Podman container engine and `mica-containerd`, its supervisor) |

Debian packages come from `mica-system-base` releases, which carry one
`mica-system-base.lock` and its `SHA256SUMS`: the floor root and the pools by
digest, the Base's own packages, the upstream Debian packages boards and
products install on top (the init a product picks, Podman, the radios, one
board) with the roots they are pinned for, and the one Debian archive any other package is
resolved from. Consumers commit the lock unchanged as
`locks/mica-system-base.lock` with its pin `locks/pins/mica-system-base.pin`
([release lock](docs/reference/release-lock.md)) and follow the rules in the
mica-system-base README, *Consuming a release*.
There are no image profile packages: development and production images
differ by the signed kernel command line parameter `mica.profile=dev|prod`
([decision](docs/decisions/2026-09-14-no-image-profile-packages.md)).

## How the project works

- This repository holds the product: what Mica OS is, how it is used, the
  hardware it supports and the product decisions, recorded in
  [`docs/decisions/`](docs/decisions/README.md).
- Work is planned and tracked in the repository it changes, beside its code,
  and each repository keeps its own history
  ([decision](docs/decisions/2026-09-27-each-repository-keeps-its-records.md)).
  The rules of the release lock and the build are `mica-build-tools`'s.

Documentation checks run with `make docs-verify`, and the checks' own tests
with `make docs-verify-test`.

## License

Mica OS is licensed under the [Apache License, Version 2.0](LICENSE).
