# 20260913-0755-s905x5m-build-determinism The s905x5m kernel Image and U-Boot are not byte-reproducible

- **status**: pending
- **priority**: P3
- **owner**: (unassigned)
- **createdAt**: 2026-09-13 07:55

## Description

Found while proving the family layer (`20260913-0416-board-product-build-architecture`,
work package 1.2) byte-identical: two builds of the s905x5m kernel from the
same pins agree on `config`, `kernel.release`, `System.map`, the DTB and
every module, but the `Image` differs in 25 bytes next to the vendor
tree's `[cpuinfo]: build info: project:%s, build_type:%s, gki_config:%s,
gki_image:%s` string -- a build stamp the Hardkernel tree derives outside
`KBUILD_BUILD_*` and `SOURCE_DATE_EPOCH`. The signed U-Boot
(`u-boot.bin.signed`, `u-boot.bin.sd.bin.signed`) also differs between two
builds of the same pins. The other three boards are reproducible.

Find the stamp's source in `common_drivers` and pin it (a patch under
`mica-boards:boards/s905x5m/kernel/patches/`, as cx3576's Mali `BUILD_DATE`
patch does), and the U-Boot build's, so the amlogic family's proof can be
a sha256 comparison like the others'.

## ActiveForm

Pinning the s905x5m vendor build stamps.

## Dependencies

- **blocked by**: (none)
- **blocks**: (none)

## Notes

`mica-boards:boards/s905x5m/kernel/build.sh` already pins the module
archive's order and mtimes (2026-09-13).

- 2026-09-14: still true for the first `mica-boards` release `20260914-1603`:
  the s905x5m kernel and U-Boot are not byte-reproducible across hosts
  (vendor build stamps).
