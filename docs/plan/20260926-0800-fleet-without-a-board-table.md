# 20260926-0800-fleet-without-a-board-table The update platform checks a release's shape, not a list of boards

- **status**: pending
- **createdAt**: 2026-09-26 08:00
- **relatedPlan**: `mica-core:docs/plan/20260925-1300-board-facts-from-the-boot-policy.md`

## Context

The user asked (2026-09-26) whether adding a board still touches repositories other than
`mica-build`. Measured at `mica-fleet` `d2feb27`, `mica-core` `db3500b`, `mica-build` `ebcc6e8`.

`mica-core` `db3500b` removed every board name from the device's code: which board, architecture,
boot format, partitions, firmware target and FIT records a device accepts is the `board` section of
its signed `/etc/mica/boot.json`, which `mica-build` writes. Its changelog states the result: "A
board that uses an existing boot backend, firmware mechanism and architecture needs no code here."

`mica-fleet` is now the one repository besides `mica-build` that a new board has to touch. Its
`@app/update` package validates releases "exactly as `mica-deploy` validates them", so that the
update server never publishes bytes a device would refuse, and it does so with two board tables:

| File | Table | Used by |
|---|---|---|
| `packages/update/src/deployment.ts:16` | `BOARDS`: board -> `{ arch, format }` (`uki` / `fit`) | `parseDeployment`: `unsupported board`, `board/architecture mismatch`, `wrong boot format` |
| `packages/update/src/firmware.ts:17` | `TARGETS`: board -> `{ arch, target, limit }` | `parseFirmware`: `unsupported firmware board`, `firmware architecture mismatch`, `invalid firmware write destination`, `invalid firmware length` |

Their callers: `authenticateDeployment` (`packages/update/src/catalog.ts` twice,
`apps/api/src/modules/fleet/update/archive.ts`, `releases.service.ts`) and `authenticateFirmware`
(`apps/updates/src/store.ts`, which authenticates every held firmware manifest at startup and
stops the service on a failure).

A deployment for a fifth board is refused as `unsupported board` and a firmware manifest as
`unsupported firmware board`, although the device would accept both.

The copy has also fallen behind the reader it mirrors. `db3500b` renamed the firmware targets by
mechanism, and it refuses the old names rather than aliasing them:

| `mica-deploy` before `db3500b` (and `mica-fleet` today) | `mica-deploy` at `db3500b` |
|---|---|
| `efi { partition, path }` | `efi { partition, path }`, the path any `EFI/.../*.EFI` |
| `rockchip-loader { diskOffset, maxBytes }` | `disk-range { diskOffset, maxBytes }` |
| `amlogic-boot0 { payloadOffset, maxBytes }` | `emmc-boot { area: "boot0" \| "boot1", payloadOffset, maxBytes }` |

So once a release carries `db3500b`, `mica-fleet` would refuse every firmware manifest `mica-build`
produces for a FIT board, and would accept manifests the device refuses.

## Proposal

Follow `mica-deploy`'s own split: the parser judges a release **on its own**, and only a
device judges it **against a board**. The update platform has no board to compare against, so it
does the first half and no longer pretends to do the second.

**`parseDeployment`**, with `BOARDS` deleted, mirrors `components.rs` `Deployment::validate`:
- `board` is a name;
- `arch` is `amd64` or `arm64` (`unsupported architecture`);
- the kernel and rootfs components agree with the deployment's board and architecture (`component
  target mismatch`, as today);
- `kernel.boot.format` is `uki` or `fit` (`unsupported boot format`).

`board/architecture mismatch` and `wrong boot format` go: they are the device's `admit` rules.

**`parseFirmware`**, with `TARGETS` deleted, mirrors `firmware.rs` `Target::validate`:
- the target is one of the three mechanisms, with exactly its members;
- `efi`: `partition >= 1`, and `path` starts with `EFI/` and ends in `.EFI` (case-insensitive).
  The artifact limit is `EFI_MAX_BYTES`, 4 MiB.
- `disk-range`: `diskOffset >= 34 * 512` (past the primary GPT) and sector aligned, `1 <= maxBytes
  <= 64 MiB`, no overflow. The artifact limit is `maxBytes`.
- `emmc-boot`: `area` is `boot0` or `boot1`, `1 <= maxBytes <= 64 MiB`, and `payloadOffset +
  maxBytes <= 64 MiB`. The artifact limit is `maxBytes`.
- the artifact is `1..=limit` bytes;
- `arch` is `amd64` or `arm64`.

`unsupported firmware board`, `firmware architecture mismatch` and `invalid firmware write
destination` (the per-board equality) go. The device holds the target to its signed policy
(`admit_firmware`: `firmware target differs from signed board policy`).

**What the platform loses, and why it is acceptable.** Today it refuses to publish a deployment
whose board does not exist, or whose boot format is wrong for its board, before a device sees it.
After this change such a release is published, and every device refuses it at `admit`. That is the
same outcome `mica-deploy` accepted when it split its reader; the release is already signed by the
updates key, whose holder is `mica-build`'s release job. If the operator should still see such a
mistake in the console, the board facts can come from the one place that publishes them, and never
from a list here. That is the Mica version index's catalogue, `catalogue.boards` (`board`, `arch`,
`releaseTarget`), which would gain `boot`, `kernel` and `firmware`, written by `mica-build` from
the same table as `boot.json`'s `board` section. This is left out of the plan's scope below and is
an open question.

**Tests.** Ported from the cases each rule has today, plus the new ones:
- every accepted target shape of each mechanism, and each bound refused by name;
- the old names `rockchip-loader` and `amlogic-boot0` are refused;
- a deployment and a firmware manifest for a board this repository has never heard of are
  accepted by the parser. That is the regression test for the question that started this plan.

A copy of `mica-core`'s shared contract vectors, if `mica-fleet` takes one, carries the rules'
names as `mica-core` records them (`alsoRefusedBy` for `wrong-board`, `wrong-arch`,
`wrong-boot-format`).

After this, `git grep -nE 'cx3576|s905x5m|uefi-x64|uefi-arm64' -- packages apps` outside tests
and comments finds nothing.

## Rollout

The order is forced by the vocabulary change, not by this repository:

1. `mica-core` releases `db3500b` (the device side).
2. `mica-build` pins that release and, in one commit: writes `boot.json`'s `board` section, writes
   firmware manifests with the new target names (`src/image/firmware-formats.ts`,
   `src/image/board-facts.ts`, `firmware-maintenance`), follows `boardPolicies` in `deploy-pool
   --check`, and deletes `src/image/device-fit-geometry.ts`. Then a scoped release per board.
3. `mica-fleet` lands this plan and deploys. If it deploys before step 2's release, it refuses the
   old-name manifests; if after, it refuses the new ones until it deploys. Either way the
   window is the time between the release and the deploy.

`apps/updates` authenticates its held firmware manifests at startup and stops on a failure. So an
old-name manifest still held when the new code starts would stop the service. Before the deploy,
the held firmware manifests are listed, and any with an old target name is withdrawn or replaced by
its re-published successor. The deploy's runbook says so.

## Risks

- **A device on a `mica-deploy` older than `db3500b`** knows only the old target names, and a
  firmware manifest in the new names is refused by it. That is a device-side transition. An OS
  update to a release carrying `db3500b` comes first, then firmware. The platform can do no better
  than serve what the current release produced.
- **Losing the early refusal** (above): a mis-built release is published and refused by every
  device, instead of never being published. It is mitigated by `mica-build`'s release gate, which
  already verifies each product against the contract before anything is published.

## Scope

In: `packages/update/src/deployment.ts`, `packages/update/src/firmware.ts`, their tests, and the
deploy runbook's note. Out: the catalogue extension (open question 1); anything outside
`@app/update`'s two readers.

## Open questions for the user

1. Should the console still refuse a release for a board it cannot know, from facts `mica-build`
   would add to the version index's catalogue? Or is the device's refusal enough, as in
   `mica-deploy`?

## Progress

## Annotations
