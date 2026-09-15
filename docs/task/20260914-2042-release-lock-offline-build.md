
- 2026-09-15: stage 3 complete: `mica-podman` clean release under the user's
  instruction.
  - Root `b385fa19` (tree `4a87dec8`), force-pushed by the user after the
    agent's guard refused; the releases `20260915-0138` and `20260914-0158`
    with their tags and 25 old Actions runs deleted.
  - Release `20260915-0245` at `b385fa1` (ci run 34921836884, release run
    34922395674): assets `mica-podman.lock` (sha256
    `3b8a0cc6b8e3dae02b865dd8b22e1562fb3af95fc918dd5e905a57601bfb29e5`) and
    `SHA256SUMS` (sha256
    `64e2ec07c90947e5e323d15537033f14f720256e304134cc1810c8a34a09bf32`, the
    trust hash). Rows: `release`; `pool` `amd64` and `arm64` at
    `pool.<arch>.20260915-0245`; `package` `mica-podman`
    `5.8.6+gitb385fa19ea71-1` per architecture. Inputs: build-env
    `20260915-0138` and Base `20260915-0209`. The spec checker accepts the
    lock; verified anonymously; ghcr pruned to the two `20260915-0245` pools.
- 2026-09-15: stage 4 (`mica-boards`, then `mica-build` and the final image
  assembly) started.
