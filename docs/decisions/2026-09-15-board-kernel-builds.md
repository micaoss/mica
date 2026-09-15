# Board kernel builds: incremental prod, pinned toolchains, then reuse

- **date**: 2026-09-15
- **kind**: engineering decision
- **owner**: the mica-boards owner; the virt-arm64 config trim, the mica-build owner first
- **review sunset**: 2027-03-15
- **status**: accepted (user, 2026-09-15); not implemented; order: (1) with (5) and one planned release of all four boards, then (2); (3) evaluated by `mica-build` first; (4) not now

## Decision

`mica-boards`' kernel and U-Boot builds are made faster in this order (user,
2026-09-15):

1. **Incremental prod kernel.** A FIT board builds its prod kernel
   incrementally after the dev kernel, in the same tree. The result is proven
   byte-identical to a clean prod build, and that proof stays as a test.
2. **Reuse in CI.** CI skips rebuilding a kernel or U-Boot component whose
   inputs equal those of the latest release's published component. This
   starts only after (5) has been released.
3. **virt-arm64 config trim.** A trimmed `virt-arm64` kernel configuration is
   evaluated by `mica-build` first.
4. **No ccache** for kernel or U-Boot builds for now.
5. **Pinned toolchains.** Kernels and U-Boots build with pinned toolchains:
   images pinned by digest, or a pinned apt snapshot recorded in `locks/`.
   This lands together with (1), and one planned release of all four boards
   follows.

## Rationale

Kernel and U-Boot builds are the slowest part of a board release. Building
prod on top of dev saves a full kernel build per FIT board, and the
byte-identical test keeps it honest. Reusing unchanged components is only
safe once the toolchains that produce them are pinned, so a component whose
declared inputs are unchanged really has unchanged bytes; that is why (2)
waits for (5).

## Removal condition

Revisited when a board's build time is no longer dominated by kernel and
U-Boot builds, or when a cache can be proven not to change their bytes.
