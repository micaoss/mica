# mica-build: one language on the build host, shell only where Bun is not the toolchain

- **date**: 2026-09-22
- **kind**: engineering decision
- **owner**: the mica-build owner
- **review sunset**: 2027-03-22
- **status**: accepted (user, 2026-09-22: "统一下build的语言和重构一下目录结构", "开始处理"); implemented by `docs/plan/20260922-0817-one-language-one-layout.md`

## Decision

Everything of `mica-build` that runs on the build host is TypeScript on
Bun, in one package at the repository root (`src/`, one `package.json`, one
lockfile, the gates `lint`, `typecheck`, `test`). The Makefile stays the
entry point and every target is one Bun invocation through the one
bootstrap `bin/bun.sh`, which finds Bun on the host or runs it in the
pinned build-env image. Python exists nowhere in the engine.

Shell exists only where Bun is not the toolchain: inside a container whose
image is not the build-env base (the boot-tools and bsp images, the
product root's own pack stage), a guest, an initramfs, a device root. It
lives under `stages/` (one directory per image) and the suites' guest
directories, and every such file carries the `# mica-build-side:
container` marker the host-toolchain lint reads. A build script that comes
from outside and runs inside a container (a vendor build, an upstream tree)
stays the external shell it is (user, 2026-09-22).

A board directory (`boards/<board>/`) is data and vendor inputs: the
definition and layout tables, the package inputs, firmware, the kernel and
loader configuration, patches, hooks and vendor trees, the package
producers and the board's tests. The engine drives every board build from
that data; there is no per-board Makefile, and flashing support is
documentation (`docs/boards/<board>.md`), not tree content. What a board
runs on the host -- its tests -- is TypeScript like the engine.

The layout is `src/`, `stages/`, `boards/`, `common/`, `producers/`,
`products/`, `locks/`, `tests/{gates,suites,fixtures}/`, and nothing else
at the top beside the Makefile, the package files, `.github/` and
`trust-certificates.sha256`. A lint refuses a `.sh` outside the shell
homes and a `.py` anywhere.

## Rationale

Measured at `2e8ebaef`: the engine was 41k lines of TypeScript in three
Bun packages, 29k of bash, 5.7k of Python and a forty-script `tools/`,
with the same job done in two or three languages side by side (the lock
reader Python, its callers bash, the release manifest TypeScript); the
two CI-only reds of 2026-09-22 lived in shell no local gate ran.
`mica-system-base` already took the Bun decision for its build tooling
(2026-09-13) with the same device-payload exemption.

## Removal condition

Revisited only if Bun leaves the build-env base image.
