# 20260914-0503-retire-mica-boot Split mica-boot into Base, boards and build, then retire it

- **status**: implementing
- **createdAt**: 2026-09-14 05:03
- **approvedAt**: 2026-09-14 (user decisions in issue vwul1y5i, including the answers to O1 and O2)
- **relatedTask**: 20260914-0503-retire-mica-boot

## Context

`mica-boot` came out of the assembly in `20260913-1600-split-boot-and-boards`
and is consumed as the `boot/` source pin by `mica-build` and by
`mica-boards`. The user decided on 2026-09-14 to split it three ways and
retire it; the decision, the file lists and the key rules are in
`docs/decisions/2026-09-14-mica-boot-split.md`. At that point `mica-boot` was
local `302d9cc`, one commit ahead of its origin `2a111e4`, and no code had
moved.

Current callers of `boot/` in `mica-build`: `tools/product-build.sh`
(`boot/build-tools.sh`); `build/src/component-build.ts`,
`build/src/component-cli.ts`, `build/src/verity-signing.test.ts` and
`tests/lifecycle-uefi/trust-rotation.ts` (`boot/verity-tool.sh sign`);
`tests/rootfs-reproducibility-test.sh` (`boot/initramfs.sh`);
`build/src/kernel-package.ts` (the tool images). In `mica-boards`: the
Makefile dependencies and the families' `Makefile.inc` trust staging
(`verity-tool.sh stage`).

## Proposal

1. **Record** (`mica`): the decision record, this plan and its task.
2. **Base loader** (`mica-system-base`): `debs/mica-systemd-boot`, the BusyBox
   pattern -- the systemd 257.13 orig archive by URL and sha256 with the
   persistence patch, built natively per architecture in the build-env C
   image, version tag `257.13-mica1`, shipping the unsigned
   `/usr/lib/mica/systemd-boot/systemd-boot<x64|aa64>.efi` in every Base pool
   and never installed into a root; then a release.
3. **Boards** (`mica-boards`): import `common/` (`mica-required.fragment`,
   `kernel-config-test.sh`, `mica-records.h`, `embed-fit-trust.sh`,
   `export-regdb-certs.py`, `fstab.in`, `copyright`) and `verity-tool.sh stage`
   with the certificate-only validation; drop the `boot/` source pin; take
   `VERITY_TRUST_CERT` and `FIT_TRUST_CERT` as public inputs only.
4. **Assembly** (`mica-build`): import the packaging, signing and key tools and
   their tests; `kernel.sh` signs the loader extracted from the Base pool;
   drop `deps/sources/mica-boot.json` and every `boot/` caller; read the board
   artifacts. The tools image's Debian snapshot follows the Base snapshot, and
   its OpenSSL image is `IMAGE_MICA_BUILD_BASE` from the build-env lock.
5. **Retire** `mica-boot`: the user archives or deletes the repository.

Steps 2 and 3 are independent. Step 4 waits for both, and `mica-build` stays
paused until the `mica-core` and `mica-system-base` releases pass.

## Verification

- Step 2: both architectures build the loader in CI, the pool carries it, and
  the release reads back anonymously.
- Step 3: `mica-boards` `make check` (including `kernel-config-test` over every
  board) passes without `boot/`, and no board build reads a private key.
- Step 4: no `boot/` path or `mica-boot` pin remains in `mica-build`; a product
  builds with the Base loader signed by `kernel.sh`; the moved tests pass.
- Step 5: no repository names `mica-boot` as a dependency.

## Risks

- The loader's persistence patch is load-bearing for A/B attempt counting; a
  build that drops it boots without the counters the update model relies on.
- Step 4 is gated on two other repositories and on the pause of `mica-build`,
  so `mica-boot` stays the live source for both consumers until then.

## Scope

Records in `mica`; code in `mica-system-base`, `mica-boards` and `mica-build`,
each by its owner.

## Alternatives

- **Merge `mica-boot` whole into `mica-system-base`**: proposed and withdrawn;
  the Base repository would carry signing tools and board inputs it does not
  use.

## Annotations

- 2026-09-14 (user): split three ways (systemd-boot to Base like BusyBox, the
  packaging and signing tools to build, `common` to boards); O1 -- the boards
  keep no key generator and take public certificates only; O2 -- verity-tool
  splits into `stage` and `sign`.
- 2026-09-14: step 2's package is implemented in `mica-system-base`
  (`db2f33e`); its release is in progress.
- 2026-09-14 (user): `mica-boot` is removed from the project and does not
  move to `micaoss`. Steps 3 and 4 still remain in code: `mica-boards` and
  `mica-build` pin `deps/sources/mica-boot.json` at that point.
- 2026-09-14: step 3 landed in `mica-boards` (`micaoss/mica-boards` `5b7fd98`):
  `common/{kernel,uboot,trust,package,scripts}` with `trust/stage.sh`
  replacing `verity-tool.sh stage`, no `boot/` pin, and the families merged
  into per-board builds under `boards/<board>/`. Its releases will publish
  `pool.<arch>.<YYYYMMDD-HHMM>` and `board.<board>.<YYYYMMDD-HHMM>`; none is
  cut yet (CI needs the certificate secrets).
- 2026-09-15: the `mica-system-base` commit `db2f33e` cited here is pre-reset
  history (its history is squashed into the root `4d63430`, user);
  `debs/mica-systemd-boot` is part of that root, and the current Base is
  `20260915-1102` at `3ae160d`, whose release carries only
  `mica-system-base.lock` and `SHA256SUMS`
  (`docs/task/20260914-2042-release-lock-offline-build.md`).
