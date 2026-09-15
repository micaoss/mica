# Mica OS

**An embedded Linux operating system for devices that ship to the field.**

Mica OS is for teams that build a product, not a distribution: you choose the
board and own the application, and the operating system underneath is
reproducible, updatable in the field, and recoverable when an update goes
wrong.

This repository is the front door of the project. Start here; every other
repository of the [`micaoss`](https://github.com/micaoss) organisation holds
one part of the code and points back here for the design, the decisions and
the documentation.

## What it is

- **A read-only, integrity-verified root.** Each system image is a squashfs
  sealed by dm-verity; every block read at runtime is checked against a root
  hash fixed at build time, so there is nothing on the root to drift.
- **Signed A/B updates.** Kernel, support and root components are installed
  as authenticated deployments. A new deployment must pass a health check
  after boot; a failed one falls back to the deployment that last worked, and
  your data on the DATA partition is kept.
- **One management plane.** `micad` owns the device's settings and drives
  systemd to match them (network, Wi-Fi, SSH, containers, MQTT); `mica-apid`
  serves the authenticated HTTPS API and a built-in web dashboard.
- **Applications on top, not inside.** Native applications enter the image as
  Debian packages and update with the system; independently released ones run
  as pinned OCI containers under Podman.
- **Offline first.** A device is set up and configured without a network or
  a cloud service, and SSH is off by default.

What it is not: a general-purpose distribution (there is no `apt` on the
device), a cloud or server OS, or a fleet management service.

## Project status

Mica OS is under active development and has no public release yet.

| Board | Hardware | Status |
|---|---|---|
| `x64` | generic x86_64, UEFI | bring-up, validated in QEMU |
| `virt-arm64` | QEMU ARM64, UEFI | bring-up, QEMU reference |
| `cx3576` | Rockchip RK3576 | bring-up, image builds, physical tests pending |
| `s905x5m` | Amlogic S7D (BM201) | bring-up, image builds, physical tests pending |

No board is qualified yet. The [support tiers](docs/boards/support-tiers.md)
page is the authoritative, up-to-date table and explains what each tier means.

## Get started

| I want to… | Read |
|---|---|
| Understand how the system fits together | [Architecture](docs/architecture.md) |
| Build an image and boot it | [Quickstart](docs/user/quickstart.md), [build guide](docs/design/build.md), [installation](docs/user/install.md) |
| Configure and operate a device | [First run](docs/user/first-run.md), [configuration](docs/user/configuration.md), [updates and rollback](docs/user/update-rollback.md) |
| Run my application on it | [Applications](docs/user/applications.md), [containers](docs/design/containers.md) |
| Bring up a new board | [Board contract](docs/boards/contract.md), [porting guide](docs/boards/porting.md) |
| Review the security posture | [Security](docs/user/security.md), [security model](docs/design/security-model.md) |
| Browse everything | [Documentation catalog](docs/README.md) · [中文用户指南](docs/zh/README.md) |

## Repositories

| Repository | What it holds |
|---|---|
| **`mica`** (this one) | documentation, design, decisions, and the project's task and plan records |
| `mica-build` | the image assembly: composes, signs, verifies and tests a product image |
| `mica-core` | the management plane (`micad`, `mica-apid`, the dashboard) and the on-device deployment client |
| `mica-system-base` | the board-independent base system: the pinned Debian packages and the system policy |
| `mica-boards` | the boards: BSPs, kernels, board and radio packages |
| `mica-podman` | the container engine package |
| `mica-build-env` | the build environment images every repository builds in |

Documents here cite code in the other repositories as `<repository>:<path>`.

## Packages

An image is composed from Debian packages. `mica-build` builds none of them:
it imports each one, pinned, from the repository that produces it.

| Repository | Packages |
|---|---|
| `mica-system-base` | `mica-system` (the system policy), `mica-busybox` (an emergency binary), `mica-ca-trust`, `mica-systemd-boot` (the unsigned boot loader, signed by `mica-build`; never installed into a root) |
| `mica-core` | `micad`, `mica-apid`, `mica-mqttd`, `mica-mqtt-broker`, `mica-sftp-server`, `mica-deploy`, `mica-lifecycle` (the early-boot and shutdown executable; never installed into a root) |
| `mica-boards` | `mica-board-<board>` for each board, the radio packages `mica-wifi`, `mica-wifi-ap` and `mica-bluetooth`, and `mica-kernel-<board>` (the board's kernel bundle; never installed into a root) |
| `mica-podman` | `mica-podman` (the Podman container engine) |

Debian packages come from `mica-system-base` releases, which carry one
`mica-system-base.lock` and its `SHA256SUMS`: the base root and the pools by
digest, the Base's own packages, the upstream Debian packages boards and
products commonly install on top (for Podman, the radios, one board) with the
roots they are pinned for, and the one Debian archive any other package is
resolved from. Consumers commit the lock unchanged as
`locks/mica-system-base.lock` with its pin `locks/pins/mica-system-base.pin`
([release lock](docs/design/release-lock.md)) and follow the rules in the
mica-system-base README, *Consuming a release*.
There are no image profile packages: development and production images
differ by the signed kernel command line parameter `mica.profile=dev|prod`
([decision](docs/decisions/2026-09-14-no-image-profile-packages.md)).

## How the project works

- **Decisions** are recorded in [`docs/decisions/`](docs/decisions/README.md),
  each with its reasoning and a review date.
- **Work in progress** is tracked as [tasks](docs/task/index.md) and
  [plans](docs/plan/index.md); every change is investigated and proposed
  before it is implemented.
- **History** is in the [changelog](docs/changelog.md).
- A code change in any repository lands together with its record here.

Documentation checks run with `make docs-verify`, and the checks' own tests
with `make docs-verify-test`.

## License

Mica OS is licensed under the [Apache License, Version 2.0](LICENSE).
