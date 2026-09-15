# 20260914-0558-mica-build-released-inputs mica-build: adopt the released inputs and the workspace rules

- **status**: implementing
- **createdAt**: 2026-09-14 05:58
- **approvedAt**: 2026-09-14 (the user unpaused mica-build after the mica-core and mica-system-base releases; S6 waits for the user)
- **relatedTask**: 20260914-0558-mica-build-released-inputs

## Context

`mica-build` keeps no records of its own; its owner (issue `lppm7hfw`) sent
this plan. The inputs it adopts are released: `mica-build-env` `20260914-0128`,
`mica-core` `20260914-0529`, `mica-system-base` `20260914-0654` and
`mica-podman` `20260914-0158`. `mica-boot` is split and removed
(`docs/decisions/2026-09-14-mica-boot-split.md`), and there are no image
profile packages (`docs/decisions/2026-09-14-no-image-profile-packages.md`).

The branch `step3-dropbear` is superseded by composing on the Base rootfs,
which installs `mica-system` with dropbear; only the checks still needed are
ported from it.

## Proposal

One local branch, `released-inputs`, in `mica-build`, one commit per step, no
push.

- **S1 build-env.** `build-env-image.lock` of `20260914-0128`, verified
  against its `SHA256SUMS` (trust
  `c85bd9749ad08021be0d8795f6b6a4b036ed761bed87efd7ef4e1468a42c92a9`). Own
  loader `tools/build-env.sh` and `tools/from.sh`, with `mica-build`'s own
  digest-pinned images for anything the build-env lock does not provide.
  Every `build-env/` caller is replaced. `deps/sources/mica-build-env.json`,
  the `LOCAL_MICA_BUILD_*` local images, and `IMAGE_BUN_1` and
  `IMAGE_DEBIAN_BOOKWORM` where the base image covers them are removed. The
  producer, build, version and preflight machinery goes (`mica-build` has no
  local producers).
- **S2 released pools.** Base is pinned as release `20260914-0654` through its
  `system-base.lock`, committed unchanged and verified against the release's
  `SHA256SUMS` (trust
  `9f1300fbdbd595f5c13d1ea5a7cd7db0d2b905b94e74a34f0648db8c7081292d`); both
  Base pools come from the lock, and `mica-systemd-boot` is located in its
  pool by layer title. The 14 `mica-core` debs
  and the `mica-podman` debs from GitHub Releases through a trusted
  `SHA256SUMS`. The component contracts are compared against `mica-core`
  `b21f3b7`. The profile, pre-reset core, retired `mica-deploy` and
  `mica-system` pins are removed. Board pins stay untouched until
  `mica-boards` publishes.
- **S3 composition.** On the per-platform Base rootfs named by
  `system-base.lock` (release `20260914-0654`),
  local debs added with dpkg, the installed-set and provenance checks kept.
  `rootfs/debian` and every `os-debian-*` target are removed.
- **S4 boot tools.** `mica-boot` is imported into a tracked `boot/` directory:
  `initramfs.sh`, `kernel.sh`, `fit.sh`, `compression.sh`, `elf-closure.py`,
  the tools `Dockerfile`, `Dockerfile.fit`, `build-tools.sh`, `regdb.sh`,
  `fit-regdb.env`, `verity-tool` `sign`, `init-keys.sh`, `dev-keys.sh`,
  `meta.example/` and five tests. The loader is the unsigned systemd-boot EFI
  from `mica-systemd-boot` in the Base pool, signed here; the UKI stub comes
  from Debian's `systemd-boot-efi` on the Base snapshot. The `boot/common`
  references switch to `mica-boards` inputs once those are published.
- **S5 CI.** `ci.yml` (push and pull request gates, one job per architecture,
  native arm64, caches) and `release.yml` (`release: published` only).
  `privileged.yml` stays as the self-hosted privileged suite and publishes
  nothing. `check.yml` and the branch `actions-latest` are dropped.
- **S6 dev/prod.** Proposal: a kernel command line parameter
  `mica.profile=dev|prod`, set from `product.env` `PROFILE` and signed in the
  UKI `.cmdline` or the FIT bootargs. Waits for the user.

## Verification

Each step's commit passes the gates it touches; the proposal's checks
(lock verification, pool and rootfs digests, installed-set and provenance,
signed loader) stay in place. Nothing is published from a workstation.

## Risks

- The board pins and `boot/common` stay on their old sources until
  `mica-boards` publishes, so S2 and S4 are partial until then.
- No question is open with the user: Q1 (the dev/prod carrier, S6), Q2
  (upstream Debian pins beyond the Base lock, S3) and Q3 (the release artifact
  shape, S5) are answered (see Annotations).

## Scope

`mica-build` only, on the local branch `released-inputs`; records in `mica`.

## Alternatives

- **Continue `step3-dropbear`**: superseded; the Base rootfs already carries
  `mica-system` with dropbear.

## Annotations

- 2026-09-14: plan sent by the `mica-build` owner (issue `lppm7hfw`) through
  the coordinator.
- 2026-09-14 (user): S6 decided as proposed, with the rules in
  `docs/decisions/2026-09-14-no-image-profile-packages.md`: the token is
  written for every image, prod included, only into the signed UKI `.cmdline`
  (and signed UKI profiles or add-ons) or the signed FIT `bootargs`, identical
  across every command line variant, with each A/B slot carrying its own signed
  value. No dev/prod difference is implemented before the list of allowed
  effects exists.
- 2026-09-14 (user): Q3 answered, for S5. A `mica-build` release publishes the
  images as GitHub Release assets -- per-product image files and component
  artifacts named with the UTC release, plus `SHA256SUMS` -- and
  `privileged.yml` stops publishing.
- 2026-09-14 (user): Q2 answered, for S2 and S3. Upstream Debian packages
  beyond the Base lock stay out of `mica-system-base`; `mica-build` keeps a
  consumer lock for those it composes (`mica-podman`'s four libraries, the
  radio packages and their libraries, s905x5m's `alsa-utils`), pinned from the
  Base snapshot `20260905T000000Z` or verified against the Base root's dpkg
  status. Base releases from `20260914-0654` on carry `system-base.lock` and
  `SHA256SUMS`; a consumer verifies the lock and commits it unchanged
  (`20260914-0455`, which S3 names, has no lock).
- 2026-09-14: after Base `20260914-0654` was released, `mica-build` was
  directed to pin Base as that release through `system-base.lock`, taking the
  per-platform rootfs and both pools from the lock and locating
  `mica-systemd-boot` by layer title; S2 and S3 updated, and the
  `20260914-0455` digests are superseded.
- 2026-09-14: S1-S6 implemented on branch `released-inputs` at `edafed96`
  (13 commits), not merged or pushed. S3 composes on `system-base.lock` (Base
  `20260914-0654`) with the consumer lock `deps/debian` (24 packages at
  `20260905T000000Z`; groups `netdev` 950 and `bluetooth` 951 seeded; presets
  for bluetooth, mpris-proxy, hostapd, wpa_supplicant; cx3576 adds
  `iproute2`, `libbpf1`, `libcap2-bin`). S5's `release.yml` publishes
  `mica-<product>-<tag>.img`, `.micaupd` and `-components.tar` with
  `SHA256SUMS` as GitHub Release assets, with trust material from repository
  variables (certificates, public key) and secrets (private keys). S6 writes `mica.profile` into the UKI's
  signed `.cmdline` and, on FIT boards, the kernel's per-profile
  `CONFIG_CMDLINE`; its allowed effects are proposed. Product builds and the
  first release wait for the `mica-boards` release and the secrets.
- 2026-09-14 (user): Q2 changed, superseding the option (a) annotation and
  S3's `deps/debian` consumer lock. `mica-system-base` pins every upstream
  Debian package boards and products install and publishes them in
  `system-base-packages.lock`
  (`docs/decisions/2026-09-14-base-pins-upstream-packages.md`). S2 and S3 move
  to Base `20260914-0742`, both locks committed unchanged (trust hash
  `fc2b0dbe441b30883cc5a390fb149d142f59c5465cbbde2f34883b1629e46d96`); in
  progress. cx3576's `iproute2`, `libbpf1` and `libcap2-bin` are requested
  from Base.
- 2026-09-14: the move to Base `20260914-0742` is done on `released-inputs` at
  `79693bcb` (not merged or pushed): S2 and S3 take the root from
  `system-base.lock` and install later-stage packages from
  `system-base-packages.lock` only when a product selects them, pin none, keep
  the bluetooth, mpris-proxy, hostapd and wpa_supplicant presets and rely on
  Base's seeded groups; board sources follow the new `mica-boards` layout
  (`7f6b7d8e`). cx3576's `iproute2`, `libbpf1` and `libcap2-bin` wait for a
  Base release.
- 2026-09-14: Base `20260914-0829` is current (four assets, including
  `system-base.sources`); S2 and S3 move to it under
  `mica-system-base:README.md` *Consuming a release*, in progress. The cx3576
  package request to Base was withdrawn.
- 2026-09-14 (user): S5's release trust is the existing development
  certificates and keys, with no separate release keys for now; the
  `mica-boards` trust variables hold those certificates and this
  repository's key secrets the matching keys (set by the user).
- 2026-09-14 (user): Q4 answered for S3: `mica-sftp-server` is in the common
  selection, installed in every product.
- 2026-09-14 (user): S5 releases with the development trust material target
  the development channel only; the release gate stays unchanged, and
  candidate and stable releases wait for production keys.
- 2026-09-14 (user, option a): S1-S6 landed as the single root commit
  `a5f1e364` of `micaoss/mica-build`, replacing the local branch
  `released-inputs`; the former history stays with the former organisation
  and in local backups. Base is `20260914-0829`. CI waits for the first
  `mica-boards` release.
- 2026-09-14 (user): trust material in S5 is certificates and the public key
  as repository variables (`MICA_VERITY_TRUST_CERT`, `MICA_BOOT_TRUST_CERT`,
  `MICA_UPDATES_PUBLIC_KEY`) and private keys as secrets
  (`MICA_RELEASE_VERITY_KEY`, `MICA_RELEASE_BOOT_KEY`,
  `MICA_RELEASE_UPDATES_KEY`), the same model as `mica-boards`' two
  certificate variables; all set on 2026-09-14 with the development set.
- 2026-09-14: S2 moves the `mica-core` pin to `20260914-1212` (`f5f53dfd484f`,
  trust hash `c04180eb...9d34`), which carries the signed-contract rename;
  the writer follows (`docs/design/release-signing.md`).
- 2026-09-14: `mica-boards` `20260914-1603` is released (trust hash
  `fe617588...785b`); S2 and S4 move the board pins and the `boot/common`
  inputs to it. What remains before product builds is the Base release that
  fixes the shadow lock.
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
  the current `mica-core` is release `20260915-0235` at its root `239e423`
  (`docs/task/20260914-2042-release-lock-offline-build.md`), in the `mica-lock
  v1` format.
