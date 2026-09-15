# 20260908-2011-ssh-generator-vs-image-policy systemd-ssh-generator overrides the image's SSH policy and port

- **status**: pending
- **priority**: P2
- **owner**: (unassigned)
- **createdAt**: 2026-09-08 20:11

## Description

`systemd-ssh-generator` could listen on port 22 beside `ssh.service` and start
sshd with an `AuthorizedKeysFile` that overrides the image policy
(`/etc/ssh/authorized_keys.d/%u`, rendered by micad from
`settings.access.ssh.keys`).

Implemented: the generator is masked with `/dev/null` in
`rootfs/packages-src/system/Dockerfile`, and `rootfs/runtime/consumers.json`
declares that mask.

Acceptance outstanding: on a current x64 QEMU image, a negative test proves
that `systemd.ssh_listen=` on the kernel command line causes no listen
conflict, and that a key present only under the image policy path
authenticates. `docs/design/access.md` states the result.

## ActiveForm

Accepting the implemented fix on a current image.

## Dependencies

- **blocked by**: (none)
- **blocks**: (none)

## Notes

- 2026-09-12: description rewritten against current source during the
  documentation restructure; the original QEMU measurement is in Git history.
- 2026-09-13 18:49: the user decided the device SSH server is Dropbear, which
  changes this task's premise (the generator and the policy path are
  OpenSSH's). The approved implementation contract, under active work
  (`mica-core:docs/task/20260913-1840-dropbear-and-sftp-server.md`,
  `mica-system:docs/task/20260913-1818-openssh-to-dropbear.md`,
  `mica-debian:docs/task/20260913-1818-openssh-to-dropbear.md`) and not yet
  shipped: root login semantics stay yes/no (`-w` when
  `permitRootLogin` is false; `-s` when effective password authentication is
  off; `-g` is not used); SSH ships disabled in both profiles and micad
  enables it at runtime after a validated configuration; scp and sftp come
  from the standalone SFTP server package where a board selects it (not the
  base; user change, mica-system `13c1299`); `procps` is retained.
  `docs/design/access.md` still describes OpenSSH and is rewritten only when
  the mica-core and mica-system owners hand off final text and verification.
  The system side (mica-system `e0be7b6`, `7faafef`) is recorded in
  `docs/design/access.md` §3.4, as is the core side (mica-core `ae513fb`,
  `790a067`); assembly adoption and guest acceptance are open.
- 2026-09-15: the `mica-core` commits cited here (`ae513fb`, `790a067`) are
  pre-reset history (its history is squashed into the root `239e423`, user);
  the current `mica-core` is release `20260915-0235` at its root `239e423`
  (`docs/task/20260914-2042-release-lock-offline-build.md`).
