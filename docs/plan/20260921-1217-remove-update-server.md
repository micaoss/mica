# 20260921-1217-remove-update-server Remove the update server from mica-build

- **status**: completed
- **createdAt**: 2026-09-21 12:17
- **approvedAt**: 2026-09-21 12:16 (user: the fleet service implements updates completely; delete the server, keep the protocol documentation)
- **relatedTask**: 20260921-1216-remove-update-server

## Context

Measured at `mica-build` `e13b4f78`, `mica-core` `b70b1fe`, `mica` `ccad216`.

`mica-build:update-server/` is a Bun, Hono and SQLite service (44 tracked
files): an admin API with draft and publish steps, a web page, and the
device-facing `GET /v1/manifest.json` (a signed `mica/catalog/v2` envelope)
and `GET /v1/objects/<sha256>`. Its readers outside the directory:

- `.github/workflows/ci.yml`: one step that runs `bun run check` and
  `bun audit` in the pinned Bun image;
- `tests/lifecycle-uefi/http-measure-server.ts` imports the service;
  `publish.ts` drives its admin API; `acquisition.sh` runs both for the
  online half of an acquisition stage; `offline-clock.sh` reads that stage's
  `http-measurements.json`. **None of the four is called by anything**: only
  `build/HARNESS.md` names them, and `run.sh` runs `updates.sh` and
  `faults.sh`. The guest harness `runtime.sh` has a `source-url` branch that
  only `publish.ts`'s stage fed;
- `README.md`'s layout table and three `build/HARNESS.md` rows;
- `shared/update-envelope.ts` is imported by `build/` on its own and stays.

The device contract does not depend on the service: `mica-deploy` requires
exactly `<origin>/v1/manifest.json` and `<origin>/v1/objects/<sha256>` with
range support (`mica-core:crates/mica-deploy/src/catalog.rs`), which any host
of static files can serve. The fleet service is that host (user, 2026-09-21).

`mica` documents that name the server: `docs/user/update-packages.md`
section 11 and its Chinese page; `docs/user/release-notes.md` section 3 and
its Chinese page; `docs/website/downloads.md` *Publication*;
`docs/design/updates.md`; `docs/design/build-harness.md` (a gate row and a
sentence); `docs/decisions/2026-09-15-update-packages.md` (its owner and
status lines). The status lines cite `mica-build:update-server/src`, which
the docs gate accepts by shape, so a deleted directory would leave a
correct-looking citation under a false heading.

## Proposal

In `mica-build`: delete `update-server/`, the CI step, the four lifecycle
files and the `source-url` branch of `runtime.sh`; drop the README row and
the three harness rows. In `mica`: section 11 of `update-packages.md` (en and
zh) says the server is the fleet service's and this repository ships the
archives and the contract; release-notes section 3 and downloads
*Publication* claim what `mica-build` publishes (release assets, the index)
with evidence that exists; `updates.md` names a catalog server rather than
this repository's; the harness gate row goes; the decision keeps its text
and gains a dated status note. Status kinds and their order stay the same
on every page pair, as the coverage gate requires.

## Risks

- The online acquisition stage was the only place the device's `check` and
  `fetch` ran against a server in this workspace. It was not wired into any
  suite, so nothing that runs today loses coverage; the fleet service owns
  that proof now.
- `mica-core:docs/task/20260920-0100-protocol-as-data.md` says only
  `mica-build`'s server tests could verify the catalog vectors; that record
  is history and is not edited here.

## Scope

`mica-build`: `update-server/` (deleted), `.github/workflows/ci.yml`,
`README.md`, `build/HARNESS.md`, `tests/lifecycle-uefi/{acquisition.sh,
offline-clock.sh, publish.ts, http-measure-server.ts}` (deleted),
`tests/lifecycle-uefi/runtime.sh`. `mica`: the seven documents above.

## Alternatives

Generating a static catalog at release time here was offered and declined:
the assembly does component work only.

## Annotations

- 2026-09-21 (user): "我们的fleet服务实现了完整的，不需要这个build内部的，保留协议文档即可，当前的build组件不需要做组件以外的工作，更新不是这边负责的".
