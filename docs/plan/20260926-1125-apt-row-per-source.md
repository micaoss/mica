# 20260926-1125-apt-row-per-source One `apt` row per Debian source

- **status**: implementing
- **createdAt**: 2026-09-26 11:25
- **approvedAt**: 2026-09-26 11:31
- **relatedTask**: 20260926-1125-apt-row-per-source

## Context

- `apt <uri> <suite> <components> <signed-by>` is "the one apt source" (1.2, table), its key
  is empty, and a second `apt` row is `duplicate-key` (1.5). Base publishes
  `https://snapshot.debian.org/archive/debian/<ts> trixie main`, and a consumer resolves an
  unpinned package from it (section 3; mica-podman `tools/base-check.sh` renders it as the
  deb822 source).
- Between Debian point releases, security fixes are in `trixie-security` (a different URI,
  `archive/debian-security/<ts>`) and fixes in `trixie-updates`; `trixie main` gets them
  only at the next point release. mica-system-base found OpenSSL 3.5.7, libexpat1 2.8.3 and
  util-linux 2.41.5 there at its snapshot 20260905 that its root did not carry
  (mica-system-base task 20260926-1040-runtime-lock-security). Moving the snapshot to
  20260926 took them from the point release; the next fix before the next point release
  needs the security source in the lock.
- One row cannot hold the three sources: they differ in URI, and one deb822 stanza with
  several URIs and several suites pairs each URI with each suite.
- Readers of the `apt` row: `tools/docs/release-lock-check.py` here;
  mica-system-base `src/release-lock.ts` (and its publisher `src/publish.ts`);
  mica-build `src/locks/locks.ts` and `src/boot/build-tools.ts` ("the one Debian archive
  the apt row names"); mica-build-env `check-lock.sh`; mica-podman `tools/check-lock.sh`
  and `tools/base-check.sh`. mica-core and mica-res list
  the kind and do not check it.

## Proposal

A new subsection **1.2.5 The Debian sources**, and its rules:

- `apt <uri> <suite> <components> <signed-by>`, columns unchanged; **one row per source**,
  key `<uri> <suite>`. Base publishes three:
  `https://snapshot.debian.org/archive/debian/<ts> trixie`,
  `https://snapshot.debian.org/archive/debian/<ts> trixie-updates`,
  `https://snapshot.debian.org/archive/debian-security/<ts> trixie-security`, each `main`
  and `/usr/share/keyrings/debian-archive-keyring.gpg`.
- New rule `apt-snapshot`: every `apt` row's URI names the same snapshot timestamp.
- New rule `apt-suite`: a lock with `apt` rows has one whose suite carries no `-<pocket>`
  (the release itself); the others are its pockets.
- Sort order unchanged in kind; within `apt`, by key as bytes (the security URI sorts first).
- A consumer renders one deb822 stanza per row.

Vectors (section 9): the valid `mica-system-base.lock` carries the three rows; refused
`apt-duplicate.lock` (`duplicate-key`, two rows with one key), `apt-snapshot.lock`,
`apt-suite.lock`; `expected.tsv`, `derived-from.tsv` and `refusal-sets.tsv` follow; the
checker implements both rules.

Rollout, in this order, because a reader of today refuses a second `apt` row:

1. mica: 1.2.5, 1.5, 3 and 9, the vectors and the checker. The vectors pin moves.
2. Every reader above moves to the new vectors and implements the key and the two rules;
   mica-podman's `base-check.sh` separates the stanzas; mica-build's `build-tools.ts`
   installs from every source.
3. mica-system-base resolves its runtime, upstream and inputs from the three sources and
   publishes three rows, in the first release after every reader has moved.

## Risks

- A Base release with three rows before a reader has moved is refused by that reader:
  step 3 waits for step 2 in every repository.
- The security source makes a snapshot move bring fixes at once, but a fix still waits for
  the snapshot to move past it.

## Scope

mica: `docs/design/release-lock.md`, `docs/design/release-lock/vectors/`,
`tools/docs/release-lock-check.py`. Then each reader's own change, and Base's.

## Alternatives

- One row with suites as a list: cannot say which URI serves which suite.
- Keep one row and move the snapshot at every point release: fixes between point releases
  wait up to two months.

## Progress

2026-09-26, step 1 done: `docs/design/release-lock.md` 1.2.5, the `apt` row of the 1.2 table
(key `uri, suite`), `apt-snapshot` and `apt-suite` in 1.5, section 3 and section 9;
`tools/docs/release-lock-check.py` keys `apt` by source and implements both rules; the valid
`mica-system-base.lock` carries the three sources and `data-columns`, `data-name` and
`data-sort-order` follow it; `mica-system-base-data.lock` keeps one row, the release with
no pocket, which stays valid; refused `apt-duplicate.lock` (`duplicate-key`),
`apt-snapshot.lock` and `apt-suite.lock`, each one line from the valid lock and breaking
only its rule, with their `expected.tsv`, `derived-from.tsv` and `refusal-sets.tsv` rows.
`tools/docs/verify-release-lock.sh` 349/349, `verify-release-lock-test.sh` 8/8,
`make docs-verify` passes. Steps 2 and 3 are the readers' and Base's.

## Annotations

2026-09-26, the user: approved; mica-boards is retired (merged into mica-build) and is not a
reader; this task writes the specification only -- step 1, the
section, the rules, the vectors and the checker here. Each reader follows it in its own
repository (step 2), and Base publishes three rows after that (step 3).
