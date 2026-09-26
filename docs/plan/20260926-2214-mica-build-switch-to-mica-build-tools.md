# 20260926-2214-mica-build-switch-to-mica-build-tools mica-build switches to mica-build-tools and mica-build-env 20260926-2110

- **status**: implementing
- **createdAt**: 2026-09-26 22:14
- **approvedAt**: 2026-09-26 22:14
- **relatedTask**: 20260926-2214-mica-build-switch-to-mica-build-tools

## Context

- `mica-build-tools` (`mica-build-tools:docs/design.md`) is the one implementation of the
  release lock, the consumer's `locks/`, the source cache and the build rules of
  `mica-build-env:RULES.md`; each repository switches in one change (design section 8) and
  deletes its own. It passes every vector of `mica:6d2d756`, so it reads the three `apt` rows
  of lock 1.2.5.
- `mica-build-env` switched and released `20260926-2110`: the images `mica-build` pins
  (`20260916-0735`), rebuilt on pinned snapshots.
- What the design deletes here: `src/locks/{locks,from,upstream}.ts`,
  `src/pool/{oci,deb,package-inputs,version-guard,local-pins}.ts`, the generic part of
  `src/pool/registry.ts`, `src/release/version.ts`, `tests/fixtures/release-lock/`. Kept:
  boards, components and their reuse, scoped and index releases, the offline chain, image,
  rootfs and verify, on the library.

## Proposal

1. Pin `mica-build-tools` (`bin/mica-tools`, `locks/mica-build-tools.pin`, the
   `@mica/build-tools` path alias) and move `locks/mica-build-env.lock` to `20260926-2110`
   with `mica-tools locks move`.
2. Delete the modules above; their callers use the library or the commands; the Makefile and
   CI route `locks-verify`, the vectors check and the release steps through `mica-tools`.
3. Every producer gets a `mica-inputs` (design 3.3.1); `VERSION` and `SOURCE_DATE_EPOCH`
   move into the control templates; archives are packed with `deb pack`, pools indexed,
   gated and guarded with `pool index|gate|guard`, releases published with
   `release check|pool|attach`.
4. Bump the revision of every own package, since each `mica.inputs` value changes; `pool
   guard` confirms nothing else moved.
5. `src/boot/build-tools.ts` installs from every `apt` row (one deb822 stanza per row, lock
   1.2.5), so `mica-build` no longer holds Base's three-row release back.
6. Verify: every unit test and gate, a local uefi-x64-dev build with verify and the lifecycle
   suite, CI green on both architectures, and a release dry run.

## Risks

- One large change; its proof is the gates, a full build of both architectures and CI.
- The rebuilt build-env images can move compiled bytes (board packages, kernels); the bump
  of step 4 covers them.
- Consumers see new pool digests and a new revision of every package at the first release.

## Scope

mica-build: `bin/`, `locks/`, `tsconfig.json`, producers and board packages, `src/`,
`tests/`, the Makefile and CI.

## Alternatives

- Move the build environment in its own change first: the packages would be bumped twice.

## Progress

2026-09-26, mica-build `89efb4e`: the switch in one change. mica-build-tools pinned at `f29772c`
(`5d0a5d9` plus the `controlEntries` export gate.ts reads the control members with),
mica-build-env at `20260926-2110`; the modules of the design's section 8 deleted with their
vectors copy; every producer declares a `mica-inputs`, versions in the control templates, packed
by `deb pack`, every own package bumped by one; the boot tools install from every `apt` row.
Local: typecheck clean, image 589, verify 937, rootfs-runtime 153, gates green but the two
publisher gates whose registry sibling this host does not reach (also red on `origin/main` here),
every CI lint target, and uefi-x64-dev built, verified (106) and through the lifecycle suite.
Kept for a later change: `stages/pool/index.sh` (its `manifest.txt` carries the source commit
the lineage reads, which `pool index` does not) and the scoped publisher's own OCI client in
`src/pool/registry.ts`.
