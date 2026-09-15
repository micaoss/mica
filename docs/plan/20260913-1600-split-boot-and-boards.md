# 20260913-1600-split-boot-and-boards Split the boot tooling and every board out of the assembly

- **status**: completed
- **createdAt**: 2026-09-13 16:00
- **approvedAt**: 2026-09-13 16:00 (explicit user request, continuing the standing instruction to finish the split without asking)
- **completedAt**: 2026-09-13 05:20
- **relatedTask**: 20260913-1600-split-boot-and-boards

## Context

After `20260911-2006-split-package-repositories` the assembly still holds
`pkgs/mica-boot/` (17 files: `Dockerfile`, `Dockerfile.fit`, `initramfs.sh`,
`kernel.sh`, `fit.sh`, `verity-tool.sh`, `dev-keys.sh`, `init-keys.sh`,
`build-tools.sh`, `elf-closure.py`, `compression.sh`, `regdb.sh`,
`versions.env`, the systemd-boot patch) and `boards/{x64,virt-arm64,cx3576,
s905x5m}/` (15, 15, 153 and 219 files: `board.env`, `bsp/` with the kernel
and U-Boot builds, `deb/` producers, `overlay/`, `hwinit/`, `evidence.json`,
`components/`) plus `boards/common/` (the shared `fstab.in`, `copyright`,
`mica-required.fragment`, `mica-records.h`, `embed-fit-trust.sh`,
`export-regdb-certs.py`).

What the assembly reads out of them: `boards/<b>/board.env` (47 readers:
`build/`, `verify/`, `rootfs/build.sh`, the API harness, the file-ab and
p1 tests), `boards/<b>/evidence.json` (5), the built kernel directory
`_out/boards/<b>/kernel` (`bzImage`/`Image`, dtb, `config`,
`kernel.release`, `modules.tar`, `regdb-certs.pem`) handed to the kernel
component, `boards/<b>/bsp/rootfs/firmware/*` and `bsp/component-copyright`
for the FIT boards' support image, the U-Boot outputs for the cx3576 and
s905x5m images, and the boot tooling from `pkgs/mica-boot` (the
boot-tools image, `verity-tool.sh`, the key generators). Each board's
`bsp/Makefile` reaches `../../../pkgs/mica-boot/verity-tool.sh` and the
kernel Dockerfiles take `boards/common` as a named context.

## Proposal

1. **`mica-boot` is a source pin**, consumed at `boot/` by the assembly and
   by every board repository (`deps/sources/mica-boot.json`, fetched by
   `make deps` like the substrate). Content: `pkgs/mica-boot/*` at the root
   and `boards/common/*` as `common/`. The tests of that tooling move with
   it (`trust-domain-hygiene`, `boot-startup-package`,
   `boot-startup-pack-fixture`, `boot-compression`); the kernel-config
   check that reads `mica-required.fragment` becomes
   `common/kernel-config-test.sh <board tree>` so each board runs it over
   its own configuration. The assembly's `os-boot-tools`, `os-keys-init`
   and `os-devkeys` route to `boot/`; `build/` signs with
   `boot/verity-tool.sh`; `tests/file-ab-fit` includes
   `boot/common/mica-records.h`.
2. **One repository for the boards, `mica-boards`** (revised 2026-09-13
   19:20 on the user's instruction: not one repository per board), each
   board `boards/<b>/` of the assembly as `<b>/` with its history, standing
   on the `mica-build-env`, `mica-boot` and `mica-debian` pins. Its producers are
   the board packages it already declared plus a new **`mica-kernel-<b>`**
   producer whose PREPARE hook builds (or reuses, stamped) the BSP outputs
   and packs them under `/usr/lib/mica/board/<b>/`: the kernel directory
   (`kernel/`), the firmware files and component copyright the support
   image takes (`firmware/`, `component-copyright`), the U-Boot outputs
   where the board has them (`uboot/`), and the board's own `board.env`
   and `evidence.json`. Never installed into a root: the assembly reads it.
   The boards' hwinit and flash tests move with them; `make pool` and `make
   publish` release every board's packages together as `build-<commit12>`.
3. **The assembly imports the boards.** `deps/packages/mica-board-<b>.json`
   and `mica-kernel-<b>.json` from the `mica-boards` release; `boards/<b>/board.env`
   and `evidence.json` stay as committed derived copies that
   `tools/board-pool.sh --check` (in `os-pool`) holds equal to the
   archive's, so the 47 readers and the board discovery keep working;
   `tools/board-pool.sh --kernel <b>` extracts the kernel, firmware and
   U-Boot outputs into `_out/boards/<b>/` for the kernel component, the
   image and the labs. `boards/<b>/bsp`, `deb`, `overlay`, `hwinit` and
   `pkgs/` are deleted; the `<b>-%` delegation, `BOARDS`, and the moved
   tests leave the Makefile and the workflows.
4. **Not renamed here**: `micad`. Asked whether it should be `mica-core`:
   the daemon, its unit, its bus name (`com.mica.micad`) and its package
   are `micad` in seven repositories and the docs; renaming the
   *repository* to `mica-core` (it holds four packages: micad, mica-apid,
   mica-mqttd, mica-mqtt-broker) is cheap and reads better than renaming
   the daemon. Recommendation: repository `mica-core`, daemon `micad`.
   Awaits the user's decision.

## Verification

- `make deps` fetches `boot/` in the assembly and in each board repository;
  each board repository's `make pool` and `make package-gate` are green and
  its release exists.
- The assembly composes the x64 image from the imported archives, with the
  kernel out of `mica-kernel-x64`, and passes `os-verify` and the release
  gate; the package gate reports only the two known `/etc/fstab` findings.
- `bash tools/board-pool.sh --check` is green for every pinned board;
  `make help` lists no target under `pkgs/` or a board `bsp/`.

## Annotations

- 2026-09-13 16:00: created from the user's message of the same hour; the
  s905x5m board is included by the rule "every board", stated as an
  assumption.
- 2026-09-13 17:40: `mica-boot` published as `build-e7022164ed50` (also
  carrying the `mica-debian` pin at `debian/`, because the boot-tools
  image installs from the pinned snapshot and reads `sources.env` from
  `rootfs/debian/` in the assembly or `debian/` elsewhere). Two facts met
  on the way: (a) the board kernels embed the verity trust certificate of
  the deployment (`CONFIG_SYSTEM_TRUSTED_KEYS`), so a board repository
  builds against the assembly's `meta/verity/signer.cert.pem` (a symlink
  `meta` in each local checkout) and the `mica-kernel-<b>` archive ships
  the certificate for `tools/board-pool.sh --kernel` to refuse a mismatch;
  a CI build of a board kernel therefore needs the deployment's
  certificate as an input. (b) `tests/boot-startup-package-test.sh`,
  `boot-startup-pack-fixture.sh` and `boot-compression-test.sh` were
  container-side scripts no harness in the assembly drove; they moved to
  `mica-boot` unwired, as they were.
- 2026-09-13 19:20 (user): the boards are one repository, `mica-boards`,
  not `mica-x64`, `mica-virt-arm64` and `mica-cx3576` each; `s905x5m` is
  included by the same rule. The four repositories created earlier that
  day are folded into it (each board's directory keeps its history) and
  deleted once the assembly pins `mica-boards`.
- 2026-09-13 05:20: landed. `mica-boards` (`ec968ea153f7`, release
  `build-ec968ea153f7`, 12 archives: four board packages, four kernel
  packages, the s905x5m radio packages and the front panel) holds
  `x64/`, `virt-arm64/`, `cx3576/` and `s905x5m/` with each board's
  history subtree-merged; the four board packages declare mutual
  unversioned `Conflicts`, and `mica-build-env` (`417aaa8c47a2`,
  `66c40a3d6f30`, `8860b00cd2b6`) exempts a shared path for any mutually
  conflicting set, passes a producer-less tree through the pre-flight and
  skips the reproducibility rebuild of a pool imported entirely. The
  assembly (`mica-build` `4725877b`) has no `pkgs/`, no `boards/common/`
  and no board `bsp/`; `boards/<board>/` keeps `board.env` and
  `evidence.json` derived from the pinned archives; `boot/` is the
  `mica-boot` pin; 27 package pins under `deps/packages/`. Proof at
  `4725877b`: x64 compose with the 12-check smoke, package gate 342/342,
  install closure 99/99, `os-verify` 104, release gate 15 artifacts,
  manifest test 51/51 (the kernel archives and `mica-lifecycle` are
  listed as unreachable by design), verify suite 904/904, netavark 87/87.
  The factory-root gate still fails its fifth negative case
  (`20260912-2236-phase1-findings`). Two facts met on the way: (a) the
  host has no arm64 binfmt handler, so the s905x5m Bluetooth bridge
  builds only from the `mica-arm64` builder's cache; (b) `.gitignore`'s
  `/meta/` matched the directory and not a symlink named `meta`, so a
  link committed by mistake replaced the assembly's development signing
  material at the merge; it was restored from the monorepo's identical
  set (the pinned kernels embed that certificate) and the rule is `/meta`.
  The four per-board repositories are folded in and are to be deleted
  (GitHub and Gitea) together with their local checkouts; the workflows
  of every repository need the `MICA_DEPS_TOKEN` secret, which no
  repository carries yet.
- 2026-09-13 06:10 (user): the repository is renamed `mica-core`, the
  daemon stays `micad` (release `build-c05bec48fa8e`, pinned by the
  assembly); the `MICA_DEPS_TOKEN` secret is left unset for now; the
  per-board repositories are deleted on Gitea, and on GitHub once a token
  with `delete_repo` is used.
- 2026-09-15: pre-reset history: the `mica-build-env` commits cited here
  (`417aaa8c47a2`, `66c40a3d6f30`, `8860b00cd2b6`) are no longer on its
  `main`, which the user reset to one root commit (`5c05745`); the current
  `mica-build-env` facts (release `20260915-0138` at `f7b896b`) are in
  `docs/task/20260914-2042-release-lock-offline-build.md`.
