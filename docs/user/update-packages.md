# Update packages: which archive, and how a device takes it

A Mica OS release publishes update archives beside the image. This page says
which archive applies to a device, how it reaches the device, what the device
does with it, and every refusal a user can meet on the way. The state machine
behind an installation is [update-rollback](update-rollback.md) for operators
and [updates](../design/updates.md) for the contract.

**How much of this has been run.** The producing side — which archive is
published, what its descriptor states — is exercised by the release tooling,
and the device side is exercised in QEMU by the lifecycle suite and by
`mica-core`'s contract tests. No full cycle (import, install, reboot,
automatic confirmation, rollback) has been run on physical hardware, and the
command lines below are read from `mica-core` rather than transcribed from a
device session. The behaviour they describe is the code's; the exact console
output is not quoted where nobody has seen it.

> status: unsupported

## 1. One deployment, three archives

Each product release has one signed deployment, published as up to three
`MICAUPD1` archives that carry the same descriptor:

| Kind | File | Published when |
|---|---|---|
| `full` | `mica-<product>-<stamp>.micaupd` | always |
| `root` | `mica-<product>-<stamp>.root.micaupd` | the kernel identity is unchanged from the product's previous release |
| `kernel` | `mica-<product>-<stamp>.kernel.micaupd` | the rootfs identity is unchanged |

When both changed, only `full` is published. A `root` archive carries the
rootfs objects, a `kernel` archive the boot artifact and the support image
with its modules and firmware; the objects they leave out must already be on
the device, which is why each states what it requires. Update archives are not
compressed. The suffixes are a naming convention of the producing side — the
client reads the `MICAUPD1` header, not the file name.

> status: shipped — evidence: `docs/decisions/2026-09-15-update-packages.md`, `docs/design/release-signing.md`, `mica-core:crates/mica-deploy`

## 2. Which archive applies

Read the running state first: `mica-deploy status`, or `GET /api/v1/update`
and `GET /api/v1/system/info`, report the authenticated deployment, its
generation, and the kernel and rootfs identities.

- The device's product must equal the descriptor's signed `product` field. The
  device's identity is the `PRODUCT=` line of `/usr/lib/mica/product.conf` in
  its own signed root, and nothing on the device can change it.
- The generation must be above everything the device has seen, not just above
  what is running.
- A `root` archive applies only where the device already runs the kernel it
  names; a `kernel` archive only where it already runs the rootfs; `full`
  always applies.

> status: shipped — evidence: `docs/design/updates.md`, `mica-core:crates/mica-deploy/src/acquisition.rs`, `docs/decisions/2026-09-15-update-packages.md`

## 3. Getting the archive onto the device

There is **no upload endpoint**. apid accepts no update file; only the
*install* step has an API route. The offline path is therefore:

1. copy the `.micaupd` to the device over SSH/SFTP (the built-in server is
   `mica-sftp-server`, which dropbear execs as the logged-in user — every
   authorized key is a key for both `root` and `mica`), or mount any medium
   that carries it;
2. `mica-deploy import <archive>` over SSH;
3. install, either on the CLI or with `POST /api/v1/update/install` and the
   64-hex `deploymentId` that `import` printed.

The archive may be any readable regular file — it is streamed, not copied —
but it **must not sit inside `/mica/updates/`**: everything under that tree
counts against the acquisition workspace budget (512 MiB by default), so an
archive parked there can make its own import fail with
`workspace budget exhausted`. Nothing may be mounted under that tree either:
`unexpected mount in update workspace`.

> status: shipped — evidence: `mica-core:crates/mica-deploy/src/bin/mica-deploy.rs`, `mica-core:crates/mica-sftp-server`, `mica-core:crates/mica-apid/src/update_api.rs`

## 4. Taking one on the device

`mica-deploy` is the only device-side update client; micad drives the same
binary on D-Bus and apid sits behind that. Every invocation first reads the
authenticated boot receipt and signed boot policy and refuses if the mounts
disagree with them; there is no user-space trust override.

```sh
mica-deploy probe                                   # workspace readiness and free space
mica-deploy import /path/to/mica-<product>-<stamp>.micaupd
mica-deploy check  --source <origin> --channel stable|beta|dev
mica-deploy fetch  --source <origin> --channel stable|beta|dev
mica-deploy install /mica/updates/verified/<id>.json --objects /mica/updates/verified/objects
mica-deploy status | mica-deploy booted             # what is running
mica-deploy confirm | mica-deploy rollback | mica-deploy reject <id>
mica-deploy gc | mica-deploy discard
```

- Every command prints one JSON object on stdout.
- `import` and `fetch` are the two acquisition paths, offline and online, and
  both end the same way: the objects that were missing land in
  `/mica/updates/verified/objects/` and the verified descriptor in
  `/mica/updates/verified/<deploymentId>.json`. That directory is the only
  place micad accepts an install from.
- Acquisition needs the still-missing objects plus a 128 MiB reserve and 2080
  free inodes on DATA.
- `install` is a separate step and never reboots. `--max-bytes` moves the
  workspace budget (default 512 MiB, maximum 8 GiB).

> status: shipped — evidence: `mica-core:crates/mica-deploy/src/bin/mica-deploy.rs`, `mica-core:crates/micad/src/update_lifecycle.rs`

## 5. What an installation writes, and when it is committed

1. Objects are verified by digest and length before anything is exposed;
   objects already on the device are reused, not copied.
2. The previous non-running entries are retired **first**, so no new object is
   written until the old fallback is durably unbootable.
3. The objects are published to `/mnt/system/roots/<rootfsId>/`,
   `/mnt/system/kernels/<kernelId>/` and the boot file, with their root hashes
   beside them.
4. The signed descriptor is written to
   `/mnt/system/deployments/<deploymentId>.json`.
5. **The boot entry is written last: that is the activation commit.** On UEFI
   it is `/boot/loader/entries/mica-<id>+3.conf`, three tries of systemd-boot
   boot counting; on FIT boards it is a record prepended to `mica_entries=` in
   the redundant U-Boot environment with `triesLeft = 3`.
6. DATA records the new `candidate` and the new highest generation.

At most two deployments are retained, so a device always keeps one fallback.
Installation needs the new bytes plus a 128 MiB reserve on SYSTEM and 64 MiB
on the ESP, counting what garbage collection reclaims first.

> status: shipped — evidence: `mica-core:crates/mica-deploy/src/deployments.rs`, `mica-build:build/src/file-image.ts`, `docs/design/updates.md`

## 6. Reboot, confirmation and rollback

- The loader boots the entry with the highest generation that still has trials
  left, decrementing the counter each attempt; an entry at zero is never
  chosen again, so a deployment that never comes up falls back on its own.
- **Confirmation is automatic and health-gated, not manual.**
  `mica-health.service` runs after `multi-user.target`, checks the members
  named in `/etc/mica/health.conf` (`boot-settled`, `micad`, `apid`) and runs
  `mica-deploy confirm` on success. On failure `mica-boot-failure.service`
  runs `mica-deploy fail-boot` and reboots into the remaining entry; if DATA
  itself is unavailable it powers off instead.
- `confirm` removes the running entry's trial counter — that is the durable
  confirmation fact — and records `current`, `fallback` and `candidate`.
- **Manual rollback** is `mica-deploy rollback`: it retires the running,
  confirmed deployment so the retained fallback boots next. `reject <id>`
  retires one by id. Neither reboots; the operator does.
- Rollback is a boot selection, not a data restore. The DATA policy is
  `unchanged`: only the booted root and kernel go back.

> status: shipped — evidence: `mica-core:crates/mica-deploy/src/deployments.rs`, `mica-system-base:debs/mica-system`, `docs/design/updates.md`

## 7. The refusals

Acquisition (`import`, `fetch`) and installation check separately and both
apply: acquisition refuses early so nothing is written, and `install` refuses
again against the state at that moment. The messages are verbatim.

| Cause | Message |
|---|---|
| Wrong product | `deployment targets another product` |
| Wrong board or architecture | `deployment targets another device` |
| Boot format wrong for this device (UKI vs FIT) | `deployment boot format differs from this device` |
| Generation not above the highest seen | `deployment generation is not newer` |
| A candidate already waits for its first boot | `another deployment is pending` |
| The running deployment is not confirmed yet | `confirm the running deployment before installation` |
| Already installed, or previously rejected | `deployment is installed or rejected` |
| A partial archive whose other component is absent | `deployment objects are incomplete` |
| The archive carries objects the descriptor does not name | `archive carries more objects than the deployment names` |
| An object is unlisted, duplicated or the wrong length | `unlisted, duplicate or wrong-sized archive object` |
| Object bytes do not match their digest | `archive object digest mismatch` |
| Bytes after the last object | `trailing archive bytes` |
| Not a `MICAUPD1` archive | `invalid component archive` |
| Unknown signing key | `Invalid component contract: untrusted metadata key` |
| Bad signature | `Invalid component contract: metadata signature rejected` |
| No room in the acquisition workspace | `workspace budget exhausted`, `DATA reserve unavailable` |
| No room at install time | `insufficient destination space: <path>`, `insufficient destination inodes` |
| Catalogue stale, replayed or rewritten | `catalog expired or clock is unsuitable`, `catalog revision rollback`, `catalog revision changed its signed contents` |
| Catalogue URL the wrong shape | `invalid catalog source URL` |
| Object URL outside the catalogue origin | `object URL differs from the catalog origin or digest` |

Over the API the same refusals arrive as status codes: a policy refusal is
**409** `policy_refused`, a malformed deployment id or acquisition path
**422** `validation_failed`, and a backend refusal **500** `micad_failed`.
`GET /api/v1/update` carries a closed failure vocabulary, including
`no-newer-release`, `install-refused`, `outside-window` and
`reboot-gate-closed`.

> status: shipped — evidence: `mica-core:crates/mica-deploy/src/acquisition.rs`, `mica-core:crates/mica-deploy/src/components.rs`, `mica-core:crates/mica-apid/src/update_api.rs`

## 8. Seeing what is running

- `mica-deploy booted` prints the running deployment id; `mica-deploy status`
  prints the boot receipt, the effective state (`current`, `fallback`,
  `candidate`, `failed`, `highestGeneration`) and every retained deployment
  with its generation, tries left, kernel and rootfs identities.
- `GET /api/v1/system/info` reports the deployment identity, the board, the
  kernel, the release and whether trust is `production` or `development`.
- `micad --version` and `mica-apid --version` print the package version.

No commit hash and no build date is a device-visible fact any more:
`gitStamp`, `commitDate`, `daemon.commit` and `release-identity.env` are gone,
and package versions carry neither
([stable component ids](../decisions/2026-09-15-stable-component-ids.md)).

Map a deployment id back to a release with the index:

```sh
jq -r '.products[]|[.product,.release,.generation,.deployment]|@tsv' mica-index.json
```

> status: shipped — evidence: `mica-core:crates/micad/src/system_info.rs`, `docs/design/mica-index.md`, `docs/decisions/2026-09-15-stable-component-ids.md`

## 9. Picking a file from the index

The version index `mica.<YYYYMMDD-HHMM>` of `micaoss/mica-build` is the one
place that names every published product's newest artifacts. In
`mica-index.json`, each product carries:

- `generation`, `deployment`, `kernel` and `rootfs`: the identities to compare
  with the device;
- `updates[]`: one entry per archive with `kind`, `file`, `url`, `sha256`,
  `size` and `requires`, where `requires.generationBelow` is the archive's
  generation, and `requires.kernel` or `requires.rootfs` names the component
  the archive does not carry;
- `images[]`: the same for the disk images, with the compression and the
  uncompressed identity.

So: find the product, compare `requires` with what the device runs, download
`url`, check `sha256`, and import it. The shape is
[mica-index](../design/mica-index.md); the checks are
[download](download.md#4-which-digest-at-which-step).

> status: shipped — evidence: `docs/design/mica-index.md`, `docs/decisions/2026-09-15-mica-version-index.md`

## 10. Online updates: what the device demands of a server

`check` and `fetch` are given an origin, not a path, and the device enforces
the whole contract:

- the source resolves to exactly `http(s)://<host>/v1/manifest.json`, with no
  query, fragment or credentials;
- that document is a signed envelope over a `mica/catalog/v2` payload, in
  canonical JSON, at most 1 MiB, with a monotonic `revision` (a repeated
  revision must be byte-identical), `issuedAt`/`expiresAt` at most 30 days
  apart, at most 128 releases and 12 channels;
- `channels` are heads keyed by **board + product + channel**, each naming the
  highest generation and its release; a head that is not the highest release
  of its key is refused;
- each object's `url` must equal `<origin>/v1/objects/<sha256>`; transfers are
  resumable by range and are abandoned below 1 KiB/s.

What the device dials is the operator's to set; what it will accept is not.
The baked `mica/meta/v1` manifest in the image carries `update.source`,
`channel`, `policy` (`off`, `check`, `auto`) and `checkIntervalMinutes`, and
`/mica/config/updates.json` on DATA may override **those four keys only**. A
document that names a trust anchor is refused: the anchors are inside the
signed image.

> status: shipped — evidence: `mica-core:crates/mica-deploy/src/catalog.rs`, `mica-core:crates/micad-settings/src/configuration.rs`, `docs/design/remote-management.md`

## 11. Running an update server

The server is `mica-build:update-server/`: Bun, Hono and SQLite in one
process, with an admin UI and a device-facing surface.

- It is initialised with `bun run init`, which writes a `.env` with a random
  admin token and refuses to overwrite an existing one, and started with
  `bun run start` (or as the single binary `bun run build` produces).
- A release is published in two steps: `bun scripts/import.ts --channel stable
  --archive <file>.micaupd` (or `--oci <bundle>@sha256:<digest>`, which reads
  the bundle anonymously and requires exactly one layer annotated
  `mica.update-kind=full`) creates a **draft**, and publication is a separate
  action. Publication refuses a release whose deployment envelope no longer
  verifies against the trusted keys: `409 invalid_deployment`.
- Devices see `GET /v1/manifest.json` and `GET /v1/objects/<sha256>`, both
  unauthenticated, with range and conditional-request support. The limits are
  128 published releases and a 1 MiB catalogue, both answered `409
  catalog_full`.
- All state lives under `DATA_DIR` — the SQLite database and the objects — so
  that directory is the backup. The process speaks plain HTTP on `127.0.0.1`
  by default, so it needs a TLS proxy and a `PUBLIC_URL` equal to the external
  origin: that string is baked into the signed object URLs, and a mismatch
  gives devices URLs they cannot fetch. There is one shared admin token and no
  user accounts.
- The server signs the catalogue and checks each release's deployment envelope
  against the trusted keys, but it is not a trusted party for the payload: the
  device checks the same signatures itself.

The service's own test suite passes; nobody has deployed or operated it here,
so the ports, the proxy configuration, the service unit and the backup
procedure are unverified.

> status: unsupported

## 12. Traps

- Do not park the archive inside `/mica/updates/`, and do not mount anything
  there.
- Do not expect an upload endpoint: the file travels over SSH/SFTP, and only
  the install step has an API.
- Do not install a second update before the running one is confirmed, and do
  not install while a candidate waits for its first boot — both are refused.
- Do not rebuild "the same" release with a lower generation: the device
  refuses it, and over the catalogue it simply never appears as newer.
- Do not hand-edit `/usr/lib/mica/product.conf`, the deployment descriptors,
  the loader entries or the FIT `mica_entries=` record; they are read as
  authenticated state.
- Do not delete objects under `/mnt/system/roots/` or `/mnt/system/kernels/`
  by hand — `mica-deploy gc` removes exactly what no retained deployment
  references.
- Do not treat rollback as a data restore.
- Do not assume SSH is on: a fresh device has it off, and every authorized key
  is a key for both managed accounts.

> status: shipped — evidence: `mica-core:crates/mica-deploy/src/acquisition.rs`, `mica-core:crates/micad/src/reconciler/sshd.rs`, `docs/user/security.md`

## 13. Limits

- There is no firmware-only archive: firmware maintenance is separate, and a
  `firmware` update kind is refused.
- A kernel package is not published across a change of the verity trust
  certificate; such a release ships `full` only.
- Update archives are published only for products a release publishes; the
  minimal products are never released.

> status: unsupported
