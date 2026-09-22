# rkdeveloptool for the CX3576-Z, on macOS

Flashing the CX3576-Z is an operator procedure, documented in
[`docs/hardware/cx3576.md`](../../../hardware/cx3576.md) and
[`docs/user/flashing.md`](../../../user/flashing.md); the build tree carries
no flashing tooling (user decision, 2026-09-22: the assembly builds
components and products, flashing is documentation). Linux hosts use the
distribution's `rkdeveloptool`. macOS needs a native build, and this
directory keeps what that build takes.

Build Rockchip's `rkdeveloptool` at upstream commit
`304f073752fd25c854e1bcf05d8e7f925b1f4e14`
(`https://github.com/rockchip-linux/rkdeveloptool.git`) with the two patches
beside this file:

- `0001-macos-clang-constant-sector-size.patch` -- the two-line fix of
  upstream PR #126 for the variable-length arrays macOS 26's Clang refuses.
- `0002-detect-unfixed-uboot-rockusb-as-loader.patch` -- a scoped
  compatibility fix: an early CX3576-Z U-Boot v2026.07 RockUSB gadget with
  `bcdDevice=0x7ea7` reports `bcdUSB=0x0200`; the patch recognises it as a
  Loader so that an image carrying the corrected descriptors can be flashed
  over it.

```sh
brew install autoconf automake libusb pkg-config
git clone https://github.com/rockchip-linux/rkdeveloptool.git && cd rkdeveloptool
git checkout --detach 304f073752fd25c854e1bcf05d8e7f925b1f4e14
git apply /path/to/0001-macos-clang-constant-sector-size.patch /path/to/0002-detect-unfixed-uboot-rockusb-as-loader.patch
autoreconf -i && ./configure && make
./rkdeveloptool -v
```

The binary needs Homebrew's `libusb` at run time.
