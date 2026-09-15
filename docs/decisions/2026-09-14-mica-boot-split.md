# mica-boot is split three ways and retired

- **date**: 2026-09-14
- **kind**: engineering decision
- **owner**: the mica-system-base, mica-boards and mica-build owners, each for its part
- **review sunset**: when mica-boot is retired (plan `20260914-0503-retire-mica-boot`)
- **status**: accepted (user, 2026-09-14); `mica-boot` is removed from the project (user, 2026-09-14); the systemd-boot package and the boards import (`mica-boards` `5b7fd98`) are implemented, the build import is not

## Decision

`mica-boot` is not merged whole into any repository. Its contents go to the
three repositories that use them, and the repository is then retired. A
whole-repository merge into `mica-system-base` was proposed and withdrawn.

**systemd-boot goes to `mica-system-base`**, the same way as BusyBox: the
package `debs/mica-systemd-boot` compiles the loader from the systemd 257.13
orig archive with the attempt-persistence patch, natively per architecture in
the build-env C image, with the version tag `257.13-mica1`. It ships the
unsigned `/usr/lib/mica/systemd-boot/systemd-boot<x64|aa64>.efi` in every Base
pool and is never installed into a root: the loader is the firmware component
on the ESP, and `mica-build` extracts and signs it.

**The packaging and signing tools go to `mica-build`**: `initramfs.sh` (with
the runkit contract), `kernel.sh` (the UKI, and firmware signing of the Base
loader), `fit.sh`, `compression.sh`, `elf-closure.py`, `Dockerfile`,
`Dockerfile.fit`, `build-tools.sh`, `regdb.sh`, `fit-regdb.env`,
`verity-tool.sh sign` with `verity-tool-inner.sh`, `init-keys.sh`,
`dev-keys.sh`, `meta.example/`, and their tests. `mica-build` drops
`deps/sources/mica-boot.json` and every `boot/` caller.

**`common/` goes to `mica-boards`**: `mica-required.fragment`,
`kernel-config-test.sh`, `mica-records.h`, `embed-fit-trust.sh`,
`export-regdb-certs.py`, `fstab.in`, `copyright`, and `verity-tool.sh stage`.
The boards drop the `boot/` source pin.

**Keys.** Private signing keys are generated only by `mica-build`. The boards
receive only the public certificates `VERITY_TRUST_CERT` and `FIT_TRUST_CERT`
and embed those; a board's local build never takes private key material.

**verity-tool.** It splits into `stage` (validate a public certificate bundle
and stage it into a trust context; `mica-boards`) and `sign` (the CMS signature
of a root hash; `mica-build`). Both keep the certificate-only validation: a
non-empty PEM certificate bundle, no private key material, parseable by
OpenSSL.

**Deleted, not moved**: `tools/deps.sh`, `deps/sources/`,
`tests/source-publish-test.sh`, `release.yml`, `Makefile`,
`gate/shell-lint.sh`, `README.md`, `VERSION`; each destination has its own.
Archiving or deleting the `mica-boot` repository is the user's action, and
the artifacts it already published are left as they are.

**Order**: (1) this record; (2) the `mica-system-base` systemd-boot package and
its release; (3) `mica-boards` imports `common/` and `stage`; (4) `mica-build`
imports the tools and switches to the Base loader and the board artifacts;
(5) `mica-boot` is retired. Steps 2 and 3 are independent; step 4 waits for
both, and `mica-build` stays paused until the `mica-core` and
`mica-system-base` releases pass.

## Rationale

Every part of `mica-boot` has one consumer side. The loader is compiled from
the systemd release the Base lock already pins (257.13), so it is built and
published with the Base packages; the signing tools and the private keys
belong to the assembly, the only place that signs; the kernel floor and the
U-Boot trust helpers are read only by board builds.

## Removal condition

None once implemented: this record then describes where these files live.
It is revisited only if a second consumer of the boot tools appears outside
`mica-build`.
