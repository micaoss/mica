# 20260914-0558-mica-build-released-inputs mica-build: adopt the released inputs and the workspace rules

- **status**: in_progress
- **priority**: P1
- **owner**: bkd:lppm7hfw
- **createdAt**: 2026-09-14 05:58

## Description

`mica-build` was unpaused on 2026-09-14 after the `mica-core` `20260914-0529`
and `mica-system-base` `20260914-0455` releases. It moves onto released inputs
and the workspace rules:

- replace the `build-env`, `mica-debian` and `mica-boot` source pins with the
  `build-env-image.lock` of `mica-build-env` `20260914-0128` and
  `mica-build`'s own scripts;
- import `mica-core` `20260914-0529`, `mica-system-base` `20260914-0654`
  (pools and rootfs, through its `system-base.lock`) and `mica-podman`
  `20260914-0158` by pin;
- compose on the Base rootfs with dpkg;
- take the packaging, signing and key tools from `mica-boot` `302d9cc` and
  sign the Base systemd-boot loader;
- split CI into `ci.yml` and `release.yml`, with native arm64;
- drop the profile packages.

Plan: `docs/plan/20260914-0558-mica-build-released-inputs.md`.

## ActiveForm

Moving mica-build onto the released inputs

## Dependencies

- **blocked by**: CI, product builds and the first release: the Base release that fixes the shadow lock
- **blocks**: (none)

## Notes

- Open with the user: Q1, the carrier of the dev/prod difference; Q2,
  upstream Debian pins beyond the Base lock; Q3, the shape of the release
  artifacts.
- Open elsewhere: the `mica-boards` release.
- 2026-09-14 (user): Q1 answered. The carrier is `mica.profile=dev|prod`,
  written by `mica-build` from `product.env` `PROFILE` into signed boot
  configuration only (`docs/decisions/2026-09-14-no-image-profile-packages.md`).
  `mica-build` sends the list of allowed dev effects before `mica-core`
  implements any.
- 2026-09-14 (user): Q3 answered. A `mica-build` release publishes the images
  as GitHub Release assets: per-product image files and component artifacts
  named with the UTC release, plus `SHA256SUMS`; `privileged.yml` stops
  publishing. Only Q2 stays open: upstream Debian pins beyond the Base lock
  (the Base assessment is back; the choice is with the user).
- 2026-09-14 (user): Q2 answered. Upstream Debian packages beyond the Base
  lock are not merged into `mica-system-base`; `mica-build` keeps a consumer
  lock for the ones it composes (`mica-podman`'s four libraries, the radio
  packages and their libraries, s905x5m's `alsa-utils`), pinned from the Base
  snapshot `20260905T000000Z` or verified against the Base root's dpkg status.
  No user question remains open; the task is still blocked by the
  `mica-boards` release. Base releases from `20260914-0654` carry
  `system-base.lock` and `SHA256SUMS`, committed unchanged by a consumer
  (`docs/decisions/2026-09-13-ghcr-artifact-registry.md`).
- 2026-09-14: implemented on `mica-build` branch `released-inputs` at
  `edafed96` (13 commits), not merged or pushed.
  - Composition is on `system-base.lock` (Base `20260914-0654`). The upstream
    Debian packages beyond the Base root are locked in `deps/debian` (option
    a): 24 packages at snapshot `20260905T000000Z`, the groups `netdev` (950)
    and `bluetooth` (951) seeded, presets for bluetooth, mpris-proxy, hostapd
    and wpa_supplicant; cx3576 also needs `iproute2`, `libbpf1` and
    `libcap2-bin`.
  - `mica.profile=dev|prod` is written into the signed kernel command line
    (`docs/decisions/2026-09-14-no-image-profile-packages.md`); its allowed
    effects are proposed and wait for the user.
  - `release.yml` (`release: published`) publishes, per product,
    `mica-<product>-<tag>.img`, `.micaupd` and `-components.tar` plus
    `SHA256SUMS` as GitHub Release assets. Trust material comes from
    repository variables (certificates and the public key) and secrets (the
    private keys); see the 2026-09-14 trust configuration note below. Caches
    follow the workspace rule.
  - Blocked: product builds and the first release wait for the `mica-boards`
    release (per-profile FIT kernels included) and for those secrets.
- 2026-09-14 (user): Q2 changed; the option (a) answer and the `deps/debian`
  consumer lock above are superseded
  (`docs/decisions/2026-09-14-base-pins-upstream-packages.md`). Every upstream
  Debian package that boards and products install is pinned by
  `mica-system-base` and published in its `system-base-packages.lock`; Base
  also seeds the `bluetooth` (989) and `netdev` (988) groups into every root.
  `mica-build` moves from `deps/debian` to Base `20260914-0742` and its
  `system-base-packages.lock` (in progress) and commits both locks unchanged.
  cx3576's `iproute2`, `libbpf1` and `libcap2-bin` are requested from Base.
- 2026-09-14: on branch `released-inputs` at `79693bcb` (not merged or
  pushed) `mica-build` composes on Base `20260914-0742`. The Base root comes
  from `system-base.lock`, and the later-stage packages from
  `system-base-packages.lock`, installed only when a product's selection needs
  them; `mica-build` pins none of them, keeps the presets for
  `bluetooth.service`, the user `mpris-proxy.service`, `hostapd.service` and
  `wpa_supplicant.service`, and relies on the groups Base seeds. Board sources
  are read in the new `mica-boards` layout (`7f6b7d8e`). Open: cx3576's
  `iproute2`, `libbpf1` and `libcap2-bin`, requested from Base.
- 2026-09-14: the request for cx3576's `iproute2`, `libbpf1` and
  `libcap2-bin` was withdrawn; Base `20260914-0809` added and `20260914-0829`
  dropped them. `20260914-0829` is the current Base and adds
  `system-base.sources`; `mica-build` is being moved to it under the rules in
  `mica-system-base:README.md` *Consuming a release*
  (`docs/decisions/2026-09-14-base-pins-upstream-packages.md`).
- 2026-09-14: release trust for the board bundles. `mica-boards`' repository
  variables `MICA_VERITY_TRUST_CERT` and `MICA_BOOT_TRUST_CERT` must hold
  the certificates matching this repository's signing keys; today they hold
  development certificates (CNs that still carry the former project name).
  The FIT boards'
  bundles carry `kernel/dev/` and `kernel/prod/`, and the kernel component
  takes `kernel/<product profile>/` (`docs/boards/contract.md` §3).
- 2026-09-14 (user): the proposed dev effects are confirmed: reporting the
  profile in `system_info`, diagnostic verbosity and log retention, and
  developer convenience that grants no access
  (`docs/decisions/2026-09-14-no-image-profile-packages.md`).
- 2026-09-14 (user): release trust material. Releases use the existing
  development certificates and keys; there are no separate release keys for
  now. `mica-boards`' variables `MICA_VERITY_TRUST_CERT` and
  `MICA_BOOT_TRUST_CERT` hold those development certificates, and this
  repository's signing-key secrets must be the matching development keys,
  which the user sets. Release material is then development-grade:
  `docs/design/security-lifecycle.md` §1.2 has the release gate refuse
  development-marked material on the candidate and stable channels.
- 2026-09-14 (user): Q4 answered. `mica-sftp-server` is installed in every
  product by the product stage, as part of `mica-build`'s common selection
  (`docs/design/access.md` §3.4).
- 2026-09-14 (user): releases signed with the development trust material
  target the development channel only. The release gate of
  `docs/design/security-lifecycle.md` §1.2 stays unchanged, so candidate and
  stable releases wait for production keys.
- 2026-09-14 (user, option a): `mica-build` moved to `micaoss`. The public
  `github.com/micaoss/mica-build` has `main` as one root commit `a5f1e364`
  (tree `b72b2103`) holding the reworked assembly, the work of
  `released-inputs`; its former history stays in the former organisation's
  repository and in local backup branches. It pins Base `20260914-0829`
  (`system-base-release`, trust hash `595daa91...624e`) and names neither the
  former organisation nor the former project, except text that is not its own
  at its pinned versions: `mica-core` `b21f3b7`'s component and envelope
  schemas and archive magic, still under the former project name there, `mica-boards`
  `bc2ea38`'s former file and API names (already renamed on `mica-boards`
  `main`), and the development certificates' CN.
  - Schemas it owns: `mica/meta/v1`, `mica/catalog/v1`, `mica/fleet/v1`,
    `mica-fleet/1`, `mica-fleet-request/1`, `mica/release/v1`,
    `mica/provenance/v1`, `mica/source-lineage/v1`,
    `mica/source-lineage/join-v1`, `mica/producer-join/v1`,
    `mica/non-publication-artifact-acceptance/v1`; `update-server` uses the
    archive extension `.micaupd`.
  - Releases with the development trust material target the development
    channel only: `tools/product-build.sh --release` assembles the release
    directory with `--channel development` and runs the release gate, and
    `tools/release-assets.sh` attaches `mica-<product>-<tag>-release.tar`
    and refuses any other channel. The gate still refuses development-marked
    material on candidate and stable.
  - `ci.yml`, `release.yml` and `privileged.yml` read the trust material
    from repository variables and secrets (the existing development set; see
    the trust configuration note below). `privileged.yml` runs on the self-hosted
    privileged runner and publishes nothing.
  - Deleted: `rootfs/scripts/derive-signing-key-ids.sh` and
    `rootfs/scripts/pack-export-factory-var.sh` (no citation in `mica`).
  - Blocked: CI waits for the first `mica-boards` release.
- 2026-09-14 (user): no former project name anywhere, the signed update
  contract included. The component and envelope schemas become `mica/*/v1`
  (`mica/deployment/v1`, `mica/kernel/v1`, `mica/rootfs/v1`,
  `mica/firmware/v1`, `mica/update-envelope/v1`; the catalog is
  `mica/catalog/v1`, and there is no `mica/update-catalog/v1`)
  and the update archive magic `MICAUPD1` (eight bytes, like the old one);
  `mica-core` (`mica-deploy`) and `mica-build` change reader, writer and
  signed fixtures together. The development certificates keep their current
  CN for now so the pipeline runs end to end; they are regenerated later.
- 2026-09-14 (user): trust material configuration, the same model in every
  repository: certificates and public keys are repository variables, private
  keys are secrets. `micaoss/mica-boards`: variables `MICA_VERITY_TRUST_CERT`
  and `MICA_BOOT_TRUST_CERT`. `micaoss/mica-build`: variables
  `MICA_VERITY_TRUST_CERT` and `MICA_BOOT_TRUST_CERT` (the same development
  certificates) and `MICA_UPDATES_PUBLIC_KEY`; secrets
  `MICA_RELEASE_VERITY_KEY`, `MICA_RELEASE_BOOT_KEY` and
  `MICA_RELEASE_UPDATES_KEY`. All were set on 2026-09-14 with the development
  set, so they no longer block CI or the first release.
- 2026-09-14: new inputs to move to. `mica-system-base` `20260914-1148`
  (`eb293178d892`, trust hash `574485b2...96258`) is the current Base; its
  `system-base-packages.lock` has a sixth column, roots, so a consumer
  installs the closure of the `upstream.pkgs` roots it needs.
  `mica-build-env` `20260914-1129` (trust hash `6c582b2a...9ce122`)
  supersedes `20260914-0128` and removes the former project name from the
  image configurations. `mica-build`, `mica-core`, `mica-boards` and
  `mica-podman` are moving to both.
- 2026-09-14: `mica-core` `20260914-1212` (`f5f53dfd484f`, built on
  `mica-build-env` `20260914-1129`; package version
  `0.1.0+gitf5f53dfd484f-1`; `SHA256SUMS` trust hash
  `c04180eb6f7870bd23d1f20514dbadd67910f716a0591daaed18180ac2029d34`) carries
  the signed-contract rename: `mica/deployment/v1`, `mica/kernel/v1`,
  `mica/rootfs/v1`, `mica/update-envelope/v1`, `mica/firmware/v1`, the catalog
  `mica/catalog/v1`, the archive magic `MICAUPD1` with the unchanged layout,
  and `.micaupd`. `mica-build` moves its pin and its writer to it.
- 2026-09-14: the first `mica-boards` release is done: `20260914-1603` at
  `c6ecd7bce901` (build-env `20260914-1129`, development trust certificates;
  `SHA256SUMS` trust hash
  `fe61758865cd49ca461757a880cf9c2ac718c029aeba2b880bea7818555a785b`). It
  publishes `ghcr.io/micaoss/mica-boards` `pool.amd64`, `pool.arm64` and
  `board.{x64,cx3576,s905x5m,virt-arm64}` at `.20260914-1603`, with the board,
  kernel, radio and s905x5m component packages at `0.1.0+gitc6ecd7bce901-1`.
  It includes the FIT loader environment fix (`c6ecd7b`): the renamed key
  `mica_entries=` is 13 bytes with the value at offset 18, where the rename
  (`c560f30`) had kept 12 and 17; this repository's FIT records lab found it,
  and `mica-boards` added a `uboot-env-test`. Known: the s905x5m kernel and
  U-Boot are not byte-reproducible across hosts (vendor build stamps,
  `20260913-0755-s905x5m-build-determinism`). `mica-build` is moving its
  board pins to this release. Remaining blocker: the Base release that fixes
  the shadow lock.
- 2026-09-15: the `mica-build-env` releases `20260914-0128` and
  `20260914-1129` cited here are deleted and no longer pull (user); the
  `mica-build-env` release to pin is `20260915-0138` in the `mica-lock v1`
  format (`docs/task/20260914-2042-release-lock-offline-build.md`).
- 2026-09-15: the `mica-system-base` releases cited here are deleted with
  their tags and its history is squashed into one root commit (`4d63430`,
  user), so its commits cited here are pre-reset history and the three Base
  files are gone; the current Base is `20260915-0209` at `4d63430`, whose
  release carries only `mica-system-base.lock` and `SHA256SUMS`
  (`docs/task/20260914-2042-release-lock-offline-build.md`).
- 2026-09-15: the `mica-core` releases `20260914-0529` and `20260914-1212`
  cited here are deleted with their tags and no longer resolve, and its
  commits cited here (`b21f3b7`, `f5f53dfd484f`) are pre-reset history (user);
  the current `mica-core` is release `20260915-0728` at `2a4c98d` (root `239e423`)
  (`docs/task/20260914-2042-release-lock-offline-build.md`), in the `mica-lock
  v1` format.
- 2026-09-15: the input releases this plan adopted are all deleted and no
  longer resolve (`mica-build-env` `20260914-0128`, `mica-core`
  `20260914-0529` and `20260914-1212`, `mica-system-base` `20260914-0654`,
  `mica-podman` `20260914-0158`). The releases to pin are `mica-build-env`
  `20260915-0138`, `mica-system-base` `20260915-0209`, `mica-core`
  `20260915-0728` and `mica-podman` `20260915-0245`, all in the `mica-lock v1`
  format (`docs/task/20260914-2042-release-lock-offline-build.md`);
  `mica-build` moves to them in stage 4.
