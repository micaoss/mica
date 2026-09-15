# 20260915-0318-docs-multi-repo-ownership Restate the documentation system for seven repositories

- **status**: implementing
- **approvedAt**: 2026-09-15 03:20
- **createdAt**: 2026-09-15 03:18
- **relatedTask**: 20260915-0316-docs-multi-repo-ownership

## Context

### What exists

| Repository | Code | Documentation it keeps |
|---|---|---|
| `mica` | none (records and gates) | `architecture.md`, `design/` 28, `user/` 16, `boards/` 13, `decisions/` 8, `task/` 37, `plan/` 21, `research/` 3, `website/` 9, `zh/` 18 |
| `mica-core` | `crates/` — micad, apid, mqttd, broker, sftp, mica-deploy, mica-runkit | `architecture.md`, `development.md`, `design/` (apid, deployment, micad, mqtt, packaging-and-release), `task/`, `plan/`, `changelog.md` |
| `mica-build` | `rootfs/`, `boot/`, `deps/`, `products/`, `update-server/`, `verify/` | none — README routes its records to `mica` |
| `mica-boards` | `boards/`, `common/`, `producers/`, `tools/` | `task/`, `plan/`, `changelog.md` |
| `mica-system-base` | `src/`, `debs/`, `locks/`, `payload/` | `task/`, `plan/`, `changelog.md` |
| `mica-build-env` | `base/`, `c/`, `go/`, `rust/`, `RULES.md` | none |
| `mica-podman` | `deb/`, `overlay/`, `tools/`, `locks/` | `task/`, `plan/`, `changelog.md` |

### The three defects

1. **Structure describes a repository that no longer exists.** `architecture.md` maps
   `rootfs/`, `boards/`, `boot/`, `deps/` as local directories and cites component paths
   (`mica-core:micad/`) that do not match `mica-core`'s `crates/` workspace.
2. **Duplicate ownership.** Five subsystem designs exist in both `mica` and `mica-core`,
   already divergent. Nothing decides which is authoritative.
3. **Records follow no rule.** Four repositories keep their own tracking; `mica-build`
   keeps none and points here; `mica` holds tracking for work that happens elsewhere.

## Proposal

### The rule

**A document lives with the code it describes.** `mica` keeps only what is true across
repositories, or what has no code: the system map, the cross-repository contracts, the user
and website documentation, and the decisions that bind more than one repository.

| Stays in `mica` | Moves to the repository that owns the code |
|---|---|
| `architecture.md`, rewritten as a repository map | `design/micad.md`, `api.md`, `bus.md` → `mica-core` |
| `user/`, `zh/`, `website/` (what the site publishes) | `design/build.md`, `build-harness.md`, `release-artifacts.md`, `updates.md` → `mica-build` |
| `decisions/` that bind more than one repository | `design/ro-root.md`, `storage.md` → `mica-system-base` |
| `boards/contract.md` (the contract every board answers to) | `boards/*.md` dossiers, `porting.md`, `board-env.md` → `mica-boards` |
| the tracking of work that spans repositories | `design/containers.md` → `mica-podman` |
| `research/` | per-repository `task/`, `plan/`, `changelog.md` stay where the work happens |

Where both a contract and an implementation exist — `release-signing.md` and
`release-lock.md` are the clear cases — the contract stays in `mica` and the implementing
repository links to it rather than restating it.

### The rewrite of `architecture.md`

Three sections, no directory trees: what Mica OS is; the seven repositories and what each
produces; the interfaces between them (release locks, `build-env-image.lock`, the board
bundle, the Debian pool, the signed deployment envelope). Every claim cites the repository
that can be read to check it.

### The gates

`tools/docs/verify-index.sh` and `verify-links.sh` currently only see this tree. Extend them:

- a reference of the form `<repo>:<path>` must name a repository in the map and a path that
  exists in its default branch (checked against a pinned commit list so the gate stays
  offline and reproducible)
- no document title may exist in two repositories at once — the duplicate-owner check this
  audit had to do by hand

### Sequence

1. Land the rule and the rewritten `architecture.md` in `mica`, with the moves listed but
   not yet made.
2. Move documents one target repository at a time, each move a commit in both repositories:
   the document arrives with its history summarised, and `mica` keeps a one-line pointer.
3. Extend the gates once the moves are complete, so they do not fail the intermediate steps.
4. Re-point `website/published-docs.json` if any published document moved — on the current
   proposal none do, because `user/` stays.

### Settled by the user, 2026-09-15

- **The rule is confirmed**: product documentation in `mica`, module documentation in the
  repository that produces the module.
- **The README carries Chinese**: `README.zh-CN.md` beside the English one, with the English
  README linking to it.
- **The website is the product's core statement.** Where the site and a document disagree
  about what the product is, the site's wording — reviewed against `docs/website/` — is the
  one to align to.

## Risks

- **Seven repositories, one rule.** Each move is two commits in two repositories; a half-done
  move leaves a dangling reference. The gates cannot catch this until step 3, so the order
  above matters.
- **`mica-build` has no `docs/`.** Giving it one is a change to that repository's shape; its
  README says records live here. That has to be agreed with whoever owns `mica-build`.
- **Divergent duplicates need a merge, not a delete.** `micad.md` here is 575 lines against
  `mica-core`'s shorter, newer file. Choosing the newer one silently drops the settings and
  reconciler contract. Each of the five needs reading before it is resolved.
- **The Chinese translation (`zh/` 18 documents) mirrors `user/`.** If a user document moves
  or is rewritten, its translation has to move with it or be dropped deliberately.

## Scope

- This plan covers `mica`: the rule, `architecture.md`, the gate extensions, and the
  pointers left behind.
- Moves into the other six repositories are separate tasks, one per target repository.
- Out of scope: rewriting subsystem designs for accuracy. This is about where a document
  lives and who owns it; a document that is wrong about its own subsystem is a separate fix.

## Alternatives

1. **Keep everything in `mica`.** One place to read, but the design drifts from the code it
   describes — which is how the current divergence happened.
2. **Move everything out, leaving `mica` as records only.** Then nothing owns the system map
   or the cross-repository contracts, and the website loses its source.
3. **Leave it and fix the facts in place.** The audit would have to be repeated after every
   repository split.

## Verification

- `make docs-verify docs-verify-test`
- every `<repo>:<path>` reference resolves against the pinned commit list
- `cd website && bun run build` still publishes the same 15 slugs
- no document title appears in two repositories
