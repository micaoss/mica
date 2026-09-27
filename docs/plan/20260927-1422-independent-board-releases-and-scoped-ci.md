# 20260927-1422-independent-board-releases-and-scoped-ci Each board releases on its own, and CI checks what a change touches

- **status**: implementing
- **createdAt**: 2026-09-27 14:22
- **approvedAt**: 2026-09-27 14:22 (the user decided both parts)
- **relatedTask**: 20260927-1422-independent-board-releases-and-scoped-ci

## Context

- A mica-build release is cut by publishing a GitHub release `<scope>.<YYYYMMDD-HHMM>`, which
  triggers `release.yml`. Its last job cuts the Mica version index `mica.<YYYYMMDD-HHMM>`
  (`src/release/index.ts`, `scoped-release index`): the previous index with the entering release,
  under one `mica-index` concurrency group. That group keeps one pending run, so two boards released
  together lose an index entry, and every board release waits on the others' index jobs.
- `ci.yml` builds every board on every push: all kernels and U-Boots (or their reuse), every
  product, a release rehearsal of every release-target board's full product, and re-verifies the
  newest index. With twenty boards every push runs all twenty.

## Decisions (user, 2026-09-27)

- **A.** A board releases on its own through a workflow with parameters. No index lists every
  board: `mica-build` drops the index and everything about it. `mica-fleet` composes what it offers
  by reading the board definitions and taking each board's latest release.
- **B.** CI checks what a change touches, not every board every time; a scheduled run every three
  days checks everything.

## Proposal

**A, `mica-build`:**

1. `release.yml` runs on `workflow_dispatch` with the input `scope` (a board, or one product) and
   `ref` (default `main`). Its plan stamps the tag `<scope>.<YYYYMMDD-HHMM>` itself and holds the
   commit to `main`. The board, its products and the publish run as today; the last job creates the
   GitHub release at that commit and attaches the assets, the lock and `SHA256SUMS` last. The
   concurrency group is the scope, so two boards release in parallel and one board's releases queue.
2. Deleted: `src/release/index.ts`; `scoped-release index` and `verify-index`; the index job of
   `release.yml` and the `release-index` job of `ci.yml`; `mirrors.list`; the index tests; the
   index text of `products/README.md`.

**A, elsewhere (their own changes):** `mica:docs/design/mica-index.md` is retired; the fleet plan
`20260926-0800-fleet-without-a-board-table` reads board definitions and each board's latest
release instead of an index.

**B, `ci.yml`:**

1. A first job names the boards a change touches, from the files between the push's previous head
   (or a pull request's base) and its head: a path under `boards/<board>/` is that board, a path under
   `products/<product>/` is its board, and any other path touches the shared engine, which names the
   representative pair `uefi-x64` and `cx3576` (one UEFI, one FIT; amd64 and arm64).
2. `build-boards.yml` takes a list of boards; the pools, products and board bundles follow the
   named boards only. The release rehearsal leaves the push: a release rehearses its own board.
3. A `schedule` every three days, and `workflow_dispatch`, name every board and run everything,
   the rehearsal of every release-target board included.

## Risks

- A shared change that breaks only a board outside the pair shows up at the scheduled run or at
  that board's release, not at the push.
- Releases no longer serialise, so two releases of different boards may run at once; each release
  names only its own board's rows, so nothing is shared between them.

## Scope

`mica-build`: `.github/workflows/{release,ci,build-boards}.yml`, `src/release/{scoped,index}.ts`,
`src/cli.ts`, `mirrors.list`, `tests/gates/release.test.ts`, `products/README.md`, `README.md`.
