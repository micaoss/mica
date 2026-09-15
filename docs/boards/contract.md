# Design: Board Support (BSP) Contract

> How a board joins Mica OS: what it must produce, what the OS build consumes, and
> the hard assertions between them. Reference implementation: `mica-boards:boards/cx3576`.

## 1. Separation rule

BSP layers produce **artifacts**; the OS build consumes **artifacts**. Neither
side reaches into the other's build. Yocto is permitted only inside a board
directory (when a vendor ships BSP solely as Yocto layers, run
`bitbake virtual/kernel virtual/bootloader` and export the deploy dir) — never
in the OS build chain.

## 2. Board directory layout

A board is a directory under `mica-boards:boards/`, discovered by its
`board.env`, and it carries its whole build: there are no families, and what
every board takes unchanged is under `mica-boards:common/`
(`mica-boards:boards/README.md` is the layout's contract). A board directory
is grouped by what reads it:

```
mica-boards/boards/<board>/
  board.env             geometry, architecture, capabilities; BOARD_FEATURES
  images.tsv            the board's flashing formats: image <kind> <packer> <runtime image> <suffix>
  Makefile              names the board; its kernel and firmware targets and its own
  sources.env           the upstream source pins (kernel, U-Boot, rkbin)
  bsp.env               a FIT board's file names for its builds (KERNEL_CONFIG, KERNEL_DTB, UBOOT_DEFCONFIG ...)
  manifests/            board.pkgs, radio-<r>.pkgs, component-<c>.pkgs -- what the board installs
  kernel/               the board's kernel build (Dockerfile, configure.sh, build.sh), config/, dts/, patches/ (a series file), hooks/, versions.env, tests/
  loader/               the board's U-Boot build (Dockerfile) and its policy, patches, tests, blobs
  firmware/             the support image's firmware files (BOARD_FIRMWARE_FILES) and component-copyright
  package/              the board package's inputs: control/, copyright, overlay/, hwinit/, init/
  extras/<producer>/    board-specific packages that are producers of their own (a radio bridge, a front panel)
  kernel/control/, package/control/   the bundle's and the board package's control templates
  evidence.json         the board evidence, where the board keeps one
  tests/                the board's own tests; flash/, userland/, components/ what a board keeps beside them
mica-boards/producers/
  board/                ONE producer for every board's package (FOR_EACH=boards/*/board.env)
  kernel/               ONE producer for every board's bundle
mica-boards/common/
  kernel/               mica-required.fragment (the shared floor), floor-check.sh, kernel-config-test.sh, export-regdb-certs.py
  uboot/                mica-records.h, embed-fit-trust.sh
  trust/                stage.sh with stage-inner.sh: validate and stage the public VERITY_TRUST_CERT / FIT_TRUST_CERT
  package/, scripts/    fstab.in and copyright; the builders' shared steps
```

A board carries no producer: `producers/board` and `producers/kernel` are
matrix producers of `build-env` (`FOR_EACH`), run once per `board.env`,
whose assignments name the instance (`PACKAGES="mica-board-${LAYOUT_BOARD}"`,
`ARCHES="${MICA_ARCH}"`, `ENABLEMENT` from `BOARD_PACKAGE_ENABLEMENT`). What
the board package ships is read out of `package/`: the rendered storage
policy, the overlay wholesale, and for every concern in `BOARD_HWINIT_CONFS`
whose fact is under `package/init/` the fact, the program and the unit when
`package/hwinit/` carries them. A concern whose files are under an extras
producer is that package's.

`board.env` declares facts, never logic (`board-env.md`). `BOARD_FEATURES` is
what the hardware has, from the vocabulary `wifi bluetooth display status-led
can usb-gadget audio containers`; a product selects from it and the resolver
refuses a feature the board does not declare. The board's flashing formats
are declared in `images.tsv`, not in `board.env` (`IMAGE_KINDS` is removed;
section 3.1, `docs/decisions/2026-09-15-board-image-packers.md`).
Independent BSP or demo artifacts remain inside the BSP and are not image
inputs unless a component producer names them.

`mica-boot` is split and retired
(`docs/decisions/2026-09-14-mica-boot-split.md`): systemd-boot is built by
`mica-system-base` as `mica-systemd-boot` (the unsigned loader in the Base
pool); the signed kernel packaging, the initramfs tools and the private
signing keys belong to `mica-build`; and the kernel floor every board merges,
the U-Boot trust helpers and the trust staging (`mica-boards:common/`) belong
to `mica-boards`, which takes only the public `VERITY_TRUST_CERT` and
`FIT_TRUST_CERT` and has no `boot/` source pin. The assembly still reads its
tools from the `boot/` pin until its own import lands. `mica-deploy` builds native init and the
runtime installer. The image path has no root-owned kernel Debian package and
no persistent boot command script.

## 3. The board bundle

Everything the assembly takes from a board travels as the board's component
artifacts (2026-09-15, agreed by `mica-boards` and `mica-build`), published
by `mica-boards:tools/publish-boards.sh` in a per-board `mica-boards` release
`<board>/<YYYYMMDD-HHMM>` beside `pool.<board>.<arch>.<YYYYMMDD-HHMM>`
(`docs/decisions/2026-09-15-mica-boards-per-board-releases.md`; the first
per-board releases were `<board>/20260915-0824`, the first under the
package-version rules `<board>/20260915-1128` (deleted), the current ones are
`<board>/20260915-1926`, and the earlier unscoped `20260914-1603` is
deleted). Each component is the OCI artifact
`ghcr.io/micaoss/mica-boards:<component>.<board>.<YYYYMMDD-HHMM>`:

| Component | `artifactType` | Content |
|---|---|---|
| `kernel` | `application/vnd.mica.board.kernel` | UEFI boards: `kernel/`; FIT boards: `kernel/dev/` and `kernel/prod/` with the DTB |
| `uboot` | `application/vnd.mica.board.uboot` | FIT boards only: the U-Boot binaries, the control dtb, the config and the FIT host tools, kept x86-64 (`uboot-package/` on s905x5m) |
| `firmware` | `application/vnd.mica.board.firmware` | `firmware.tar` and `component-copyright`, when the board carries firmware |
| `board` | `application/vnd.mica.board` | `board.env`, `manifests/`, `outputs.tsv`, `images.tsv`, the trust certificate and `evidence.json` |
| `packer` | (not fixed yet) | when `images.tsv` names a non-builtin packer: the packer tools and the board-level pieces they need (a Rockchip loader and `idblock.img`, an Amlogic packer binary and its ini), kept x86-64; absent while the board has only `disk` |

Each has one layer per file (`firmware.tar` as one layer) and is annotated
`mica.board`, `mica.arch`, `mica.component`, `mica.inputs=<sha256>` (the
component's input key), `mica.source-commit` and `mica.source-repo` (always
`mica-boards`: a package holds only its own repository's artifacts, and the
assembly refuses any other value). `mica.verity-cert-sha256` is required on
the `board` and `kernel` components, which carry the verity trust; a `uboot`
or `firmware` component may carry it, and then it must match
(`mica-build:tools/board-pool.sh`, as the per-board releases publish it).
A board release reuses an unchanged component by digest: the same manifest
bytes under the new release's tag, never a re-pointed tag. The board's lock
names each component as a `board` row (`docs/design/release-lock.md` 1.2).
The `mica-kernel-<board>` packages are retired: the pools hold
`mica-board-<board>`, the radio packages and s905x5m's component packages,
and the assembly takes the kernel files from the `kernel` artifact.
The publisher checks the complete annotation set when it reads the pushed
manifest back. The
assembly pins the manifest's digest (`mica-build:deps/boards/<board>.json`)
and reads the board out of the artifacts, assembling the components into one
board tree with the paths below. A pin recorded before the move to
per-repository packages may still name the historical
`mica-board:<board>.build-<commit12>`; that artifact stays published and
immutable for it (`docs/decisions/2026-09-13-ghcr-artifact-registry.md`).

| Path | Component | Required | Consumer in the assembly |
|---|---|---|---|
| `board.env` | `board` | yes | every host-time reader, through `_out/boards/<board>/` |
| `evidence.json` | `board` | when the board carries one | the release manifest |
| `manifests/board.pkgs` | `board` | yes | the resolver |
| `manifests/radio-<r>.pkgs` | `board` | when the radio needs board transport packages | the resolver |
| `manifests/component-<c>.pkgs` | `board` | per optional component | the resolver |
| `kernel/{Image\|bzImage,config,kernel.release,modules.tar,<dtb>}` | `kernel` | UEFI boards: yes, one kernel with an empty `CONFIG_CMDLINE` | the kernel component |
| `kernel/dev/`, `kernel/prod/` | `kernel` | `BOOT_BACKEND=uboot-fit` boards: both, and no top-level `kernel/` | the kernel component, which takes `kernel/<product profile>/` |
| `firmware/*` (from `firmware.tar`), `component-copyright` | `firmware` | when `BOARD_FIRMWARE_FILES` is non-empty | the support image |
| `uboot/*` (`uboot-package/` on s905x5m) | `uboot` | when `BOOT_BACKEND=uboot-fit` | the firmware package and the image |
| `trust/verity-signer.cert.pem` | `board` | yes | refused when it is not the assembly's |
| `outputs.tsv` | `board` | yes | the check of the components and the board's packages |
| `images.tsv` | `board` | yes | the image executor (section 3.1) |
| `packer/*` | `packer` | when `images.tsv` names a non-builtin packer | the image executor (section 3.1) |

On a `uboot-fit` board each of `kernel/dev/` and `kernel/prod/` is a complete
kernel directory (`Image`, the dtb, `config`, `System.map`, `kernel.release`,
`modules.tar`, `regdb-certs.pem`). Its `CONFIG_CMDLINE` is the board's line
plus exactly one `mica.profile=<profile>` token, with `CONFIG_CMDLINE_FORCE=y`;
a board line that already names `mica.profile` or `mica.recovery` is refused
(`mica-boards:boards/cx3576/kernel/configure.sh`,
`mica-boards:producers/kernel/prepare.sh`). The user chose this shape (option
A, 2026-09-14).

The board list and each board's expected outputs are machine-readable
(`mica-boards` `ce44907`, read by `mica-boards:tools/boards.sh`):

- `mica-boards:boards/boards.tsv`: line 1 `# mica-boards boards v1`, then one
  tab-separated row per supported board, sorted by board,
  `<board> <arch> <boot backend>` (`cx3576 arm64 uboot-fit`,
  `s905x5m arm64 uboot-fit`, `virt-arm64 arm64 systemd-boot`,
  `x64 amd64 systemd-boot`).
- `mica-boards:boards/<board>/outputs.tsv`: line 1
  `# mica-boards board outputs v1`, then rows `package <name>` (an archive of
  `pool.<board>.<arch>.<release>`) and `file <component> <path>` (a file of
  that component artifact, at its assembled path in the table above, for
  example `file firmware firmware/<file>`; `outputs.tsv` itself included),
  sorted by kind, then value. It travels in the `board` component, so every
  board release carries its own expected outputs.

A consumer reads the board list from `boards/boards.tsv` and a board's
expected outputs from the `outputs.tsv` of its `board` component; the
assembly checks each pinned component and the board's packages against it.

### 3.1 Flashing formats: `images.tsv` and the packer interface

`mica-boards` declares a board's flashing formats and supplies their packers;
`mica-build` only executes them (user, 2026-09-15,
`docs/decisions/2026-09-15-board-image-packers.md`).

`mica-boards:boards/<board>/images.tsv`, in the `board` component: line 1
`# mica-boards images v1`, then `image <kind> <packer> <runtime image>
<suffix>` rows. `<kind>` is for example `disk`, `rockchip-update` or
`amlogic-burn`; `<packer>` is `builtin` (the assembly's own raw disk image,
only for `disk`) or a path inside the `packer` component; `<runtime image>`
is an `image` row of `locks/mica-build-env.lock` (such as
`mica-build-env:base`), or `-` for a `builtin` packer (`image disk builtin -
img`); `<suffix>` is the output file's suffix. `mica-boards` still ships
`mica-build-env:base` on its `disk` row until its next board release. Rules, held by
`mica-boards`' board contract test:

- `disk` is present: it is the canonical image every other kind derives from;
- kinds are unique;
- every non-builtin packer path exists in the `packer` component and is
  listed in `outputs.tsv` (`file packer <path>`), with the board-level pieces
  it needs;
- the runtime image is named by the build-env lock.

The packer interface, executed by `mica-build`:

- `pack <input dir> <output file>` and `verify <input dir> <output file>`;
- the input directory, written by `mica-build` after signing: `disk.img` (the
  signed canonical image), `<partition>.img` per partition, `layout.json`
  (layout version, sectors, GUIDs), `board/` (the `board` component tree),
  `product.json` (product, release, profile);
- `verify` unpacks the output and proves every byte it writes to storage
  equals `disk.img`, exiting non-zero on any difference;
- the packer runs in its runtime image with `--network none`, a read-only
  input and no key material; its output is deterministic, and `mica-build`
  packs twice and compares at release.

A product selects a subset in `mica-build:products/<product>/product.env`
`IMAGE_KINDS` (default: every kind of the board's `images.tsv`; `disk` always
included; an undeclared kind is refused). A failed pack, verify or
determinism check, or an asset over 2 GiB, fails that product's whole
release. Each kind is published as the release asset
`mica-<product>-<YYYYMMDD-HHMM>.<suffix>.gz` (gzip-compressed, every kind,
`docs/decisions/2026-09-15-release-images-and-products.md`) and as one layer (title the file
name, annotation `mica.image-kind`) of the OCI manifest
`image.<product>.<YYYYMMDD-HHMM>`.

`images.tsv` also declares the update packages a board supports, because the
kernel and the system are upgraded independently (user, 2026-09-15;
`docs/decisions/2026-09-15-update-packages.md`): rows
`update <kind> builtin - <suffix>`, with the kinds `full` (mandatory, suffix
`micaupd`), `root` (`root.micaupd`) and `kernel` (`kernel.micaupd`);
`mica-build` signs and packs these `MICAUPD1` archives itself, and a
`firmware` update kind is refused. A product selects them in
`mica-build:products/<product>/product.env` `UPDATE_KINDS` (default all,
`full` always); they are published as release assets and as layers of
`update.<product>.<YYYYMMDD-HHMM>`. `mica-boards` adds the update rows after
`mica-core` and `mica-build` implement them.

Modules and kernel release must match inside the bundle. Root images contain
empty mountpoints for modules and firmware; verified support is mounted there
before udev. The factory assembler consumes already built components, so
building root does not rebuild kernel or firmware.

## 4. Kernel config assertions (CI gate per board)

Every board kernel build validates its resolved configuration before export:

- Boot path: built-in loop, device mapper, signed verity, trusted content keys,
  ext4, SquashFS/Zstd and the storage/watchdog drivers required before root.
  Authenticated native init establishes mappings and mounts support before udev.
- Runtime: cgroup v2 set, containerd/netfilter prerequisites (the docker set
  already asserted in cx3576's Dockerfile), seccomp.
- Shared baseline fragment: maintained once for all boards as
  `mica-boards:common/kernel/mica-required.fragment` (buildx named context
  `mica-common`),
  merged before olddefconfig — the source of truth for the list above plus the
  pseudo filesystems and security options it also asserts (hugetlbfs, tracing,
  SELinux + LSM boot list). Board-specific requirements stay in the board's own
  config baseline.

The shared fragment is enforced by each current BSP build; board-specific
requirements are checked against that board's resolved config. Kernel packaging
independently checks the early-boot signed-verity/watchdog floor. Root packaging
does not contain or inspect an exported kernel. Historical Debian configuration
comparisons below explain why runtime requirements entered the shared fragment;
they do not replace assertions on the current BSP kernel.

### 4.1 eBPF runtime

Not diagnostics. `crun` programs the cgroup v2 device controller as a
`BPF_PROG_TYPE_CGROUP_DEVICE` program — crun 1.29.1
`src/libcrun/ebpf.c:490,496` (load), `:423` (attach),
`src/libcrun/cgroup-systemd.c:1482,1501` (the caller, per container) — and on
cgroup v2 that program *is* the device policy; there is no `devices` controller
file to write instead. All four are bools with no module of their own.

| Symbol | What it buys | Debian |
|---|---|---|
| `CONFIG_BPF` | the eBPF core every program runs on | `=y` |
| `CONFIG_BPF_SYSCALL` | the `bpf(2)` syscall, without which no program can be loaded at all | `=y` |
| `CONFIG_BPF_JIT` | native compilation of those programs instead of interpretation | `=y` |
| `CONFIG_CGROUP_BPF` | crun's cgroup v2 device filter, which is the device policy there | `=y` |

`CONFIG_BPF_JIT` was the one gap: cx3576 shipped `# CONFIG_BPF_JIT is not set`.
It `depends on MODULES` and on `HAVE_CBPF_JIT || HAVE_EBPF_JIT` (v6.1
`kernel/bpf/Kconfig`); the board has both.

**`CONFIG_DEBUG_INFO_BTF` is deliberately NOT in the floor, and the price was
measured rather than estimated.** Debian sets it `=y`, so it is free on x64 and
not free on cx3576: it `depends on !DEBUG_INFO_SPLIT && !DEBUG_INFO_REDUCED`
(v6.1 `lib/Kconfig.debug`) and the board config sets
`CONFIG_DEBUG_INFO_REDUCED=y`, so adopting it means compiling the whole tree
with full DWARF and adding `dwarves` (pahole) to
`mica-boards:boards/cx3576/kernel/Dockerfile`. Both kernels were built and compared:

| | floor as shipped | with BTF | delta |
|---|---|---|---|
| `Image` | 44,493,312 B (42.4 MiB) | 52,554,240 B (50.1 MiB) | **+7.7 MiB, +18.1%** |
| `modules.tar` | 5,529,600 B | 6,010,880 B | +470 KiB, +8.7% |
| `make Image modules` | 683 s | 1366 s | **2.0×** |
| builder packages | `libssl-dev libelf-dev python3 kmod patch` | + `dwarves` (pahole 1.25) | one package |

The `Image` figure is the one that binds. It is `=y` payload — permanent kernel
RAM on a device, and carried by every signed kernel component SYSTEM retains
(at most two deployments within the fixed 1 GiB SYSTEM partition).
The 2.0× build time was measured while the package pools were building on the
same host, so part of it is contention; the direction and the order of magnitude
are the claim, not the second digit.

Without BTF a device runs everything the image ships — crun's device filter,
systemd's cgroup BPF programs, and any program compiled against this exact
kernel's headers. What it cannot run is a CO-RE binary: `bpftrace`, `bcc`,
anything built on libbpf's `vmlinux.h`, all of which relocate against the running
kernel's BTF. The image ships none of them. Adopting it later is three edits —
drop `DEBUG_INFO_REDUCED`, add `CONFIG_DEBUG_INFO_BTF=y`, add `dwarves` — and
belongs with whatever first ships a CO-RE tool.

### 4.2 Firewall back-end

The kernel side of an nftables front-end, with `iptables-nft` as the reference
because that is the compatibility surface Debian's `iptables` package provides
(trixie ships 1.8.11). Citations are into the upstream 1.8.11 tarball.

| Symbol | What it buys | Debian |
|---|---|---|
| `CONFIG_NF_TABLES` | the nf_tables core every rule is programmed into (`nft.c:440` `xtables_ipv4[]`) | `=m` `nf_tables` |
| `CONFIG_NF_TABLES_INET` | the inet family netavark puts its whole table in | `=y` |
| `CONFIG_NF_TABLES_IPV4` | the ip family `iptables-nft` builds its five builtin tables in (`nft.c:898` `builtin_tables_lookup`) | `=y` |
| `CONFIG_NF_TABLES_IPV6` | the ip6 family `ip6tables-nft` builds them in (same lookup, `AF_INET6`) | `=y` |
| `CONFIG_NFT_COMPAT` | the xt match and target expressions the front-end emits for everything with no native form (`nft.c:1502` `"match"`, `:1557` `"target"`), and what its revision probe queries (`nft.c:3658`, `NFNL_SUBSYS_NFT_COMPAT`) | `=m` `nft_compat` |
| `CONFIG_NETFILTER_XTABLES` | the x_tables core `NFT_COMPAT` `depends on` (v6.1 `net/netfilter/Kconfig`) | `=m` `x_tables` |
| `CONFIG_NF_CONNTRACK` | connection tracking, the state stateful filtering matches on | `=m` `nf_conntrack` |
| `CONFIG_NFT_CT` | the `ct` expression that reads that state | `=m` `nft_ct` |
| `CONFIG_NF_NAT` | the NAT core | `=m` `nf_nat` |
| `CONFIG_NFT_NAT` | the snat and dnat expressions | `=m` `nft_nat` |
| `CONFIG_NFT_MASQ` | the masquerade expression | `=m` `nft_masq` |

Two things are deliberately absent. The **legacy `IP_NF_*` / `IP6_NF_*`
back-end** — §4.2.1 measures it unreachable through anything the image selects.
And `NF_NAT_MASQUERADE`, which `NFT_MASQ` selects, so a line for it would state
a consequence rather than a requirement.

The two floors overlap: `tests/netavark-kernel-config-test.sh` asserts that
every symbol it cites which the fragment also states is stated there as `=y`,
so a weaker statement in the shared file cannot hide behind cx3576's own
Dockerfile loop.

#### 4.2.1 The x_tables extensions, and why they are floor and not policy

The table above is the front-end's *core*. It is not enough to run the
front-end, and the reason was measured rather than reasoned about.

**`iptables-nft` does not translate extensions natively.** Read the rule the
kernel actually stored, through `nft --json`, and every extension the front-end
was asked for comes back as an `nft_compat` `xt` expression:

| what was asked for | what the kernel stored |
|---|---|
| `-j MASQUERADE`, `-j REDIRECT`, `-j DNAT` | `xt target` MASQUERADE / REDIRECT / DNAT |
| `-j CHECKSUM`, `-j CT` (`--notrack` included), `-j MARK` | `xt target` CHECKSUM / CT / MARK |
| `-m addrtype`, `-m conntrack` | `xt match` addrtype / conntrack |
| `-t raw -j ACCEPT`, `-m mark`, `-p tcp --dport` | native — verdict and builtin matches only |

**Read `--json`, not `nft list ruleset`.** The text renderer runs an `xt`
expression back through libxtables' `xlate` callback and prints the
*translation*, so a compat rule prints as `masquerade` or `fib daddr type
local` exactly as a native one would. Classifying from the text output gets
every row of that table wrong.

`nft_compat` resolves an `xt` expression by loading the `xt_*` module by name.
With the module absent the rule is **refused**, on the x64 kernel this tree
builds:

```
# iptables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to-ports 8080
Warning: Extension REDIRECT revision 0 not supported, missing kernel module?
```

So these eight are floor, not policy — they decide whether the tool §4.2 exists
for actually runs:

| Symbol | Module | Reaches it |
|---|---|---|
| `CONFIG_NETFILTER_XT_MARK` | `xt_mark` | `-j MARK` |
| `CONFIG_NETFILTER_XT_NAT` | `xt_nat` | `-j SNAT`, `-j DNAT` |
| `CONFIG_NETFILTER_XT_MATCH_ADDRTYPE` | `xt_addrtype` | `-m addrtype` |
| `CONFIG_NETFILTER_XT_MATCH_CONNTRACK` | `xt_conntrack` | `-m conntrack` |
| `CONFIG_NETFILTER_XT_TARGET_CHECKSUM` | `xt_CHECKSUM` | `-j CHECKSUM`; no native form exists at all |
| `CONFIG_NETFILTER_XT_TARGET_CT` | `xt_CT` | `-j CT`, `--notrack` included |
| `CONFIG_NETFILTER_XT_TARGET_MASQUERADE` | `xt_MASQUERADE` | `-j MASQUERADE` |
| `CONFIG_NETFILTER_XT_TARGET_REDIRECT` | `xt_REDIRECT` | `-j REDIRECT` |

**This is a chosen subset and cannot be anything else.** Any of the ~60 xt
extensions an operator names needs its own module and the image will not carry
all of them. These eight are the symbols the operator-visible split was *made
of* — and not, which would sound tidier and be false, "everything both boards
already had": three of them (`CHECKSUM`, `CT`, `REDIRECT`) were absent on x64,
so adopting them added capability there.

**Eight, derived from running the rules** rather than from the symbols an
earlier floor swap dropped; the legacy tables of §4.2.2 leave by their own
route. `NETFILTER_XT_MATCH_CONNTRACK` is here because
cx3576's board loop stopped restating it and the assertion had to land
somewhere. And `NETFILTER_XT_NAT` is on this list without being on that one: it
is `=y` on cx3576 and `=m` on x64, the same split as `TARGET_MASQUERADE` beside
it, and a nat compatibility path that answers `-j MASQUERADE` but leaves
`-j DNAT` one class weaker would keep the defect this section closes.

**What it cost**, measured by building each kernel twice:

| | before | after | delta |
|---|---|---|---|
| x64 `bzImage` | 14,971,904 B | 14,980,096 B | **+8,192 B, +0.055 %** |
| x64 `modules.tar` | 337,920 B | 286,720 B | −51,200 B |
| x64 loadable modules | 8 | 4 | −4 |
| cx3576 `Image` | 44,493,312 B | 44,493,312 B | **0 B** |

cx3576 is zero because its committed vendor config already set all eight `=y`,
so the fragment merges values that are already there. Both kernels were built
from this tree with only the fragment differing, to show that rather than
assert it. **The comparison was by size, not by hash, and the reason is worth
keeping now that it has been repaired:** at the time
the cx3576 kernel Dockerfile (now `mica-boards:boards/cx3576/kernel/Dockerfile`) pinned none of `KBUILD_BUILD_TIMESTAMP`,
`_USER` or `_HOST`, which x64's did, so two builds of one unchanged tree already
differed — the two `Image` files here have equal size and different sha256, and
that difference was the build clock rather than this change.

Those three pins were then added, and the experiment run:
two `--no-cache` builds of the kernel target, same tree, back to back. **The
Image still differed, by 24 bytes at equal size.** Five of them were `__DATE__`
and `__TIME__` compiled into the vendor Mali driver, which no `KBUILD_BUILD_*`
reaches — they are cpp builtins reading the wall clock, and mainline's
`-Werror=date-time` does not cover a vendor tree. The other nineteen were the
GNU build-id, a hash OF the linked image, which moved only because the five did.
`modules.tar` differed for an unrelated reason: every member was byte-identical
and every tar header carried the build's mtime, a packaging defect the same line
gave x64 and virt-arm64. `SOURCE_DATE_EPOCH` pins the first and
`--sort=name --mtime --numeric-owner` the second; **all three boards' kernels are
byte-reproducible now and may be compared by sha256.**
The x64 figure is `=y` payload — permanent kernel RAM carried by each retained
kernel component — and 8 KiB is not a number that constrains anything. The four `.ko` that stopped being built are
the same four symbols moving from `=m` to `=y`, so the modules half of
`verify/src/checks-kernel.ts` keeps four subjects rather than none.

#### 4.2.2 The legacy back-end, measured

`IP_NF_RAW`, `IP6_NF_RAW`, `IP6_NF_NAT`, `IP6_NF_TARGET_MASQUERADE` and
`IP_NF_NAT` are a **separate question** from the `xt_*` modules above, and the
answer is the other way.

`iptables-nft` builds its `raw`, `nat`, `mangle` and `filter` tables **in
nf_tables**, not in the legacy table store. On the x64 kernel, which sets
`# CONFIG_IP_NF_RAW is not set`:

```
# iptables -t raw -A PREROUTING -j ACCEPT      →  accepted, stored native
# iptables-legacy -t raw -L -n
iptables v1.8.11 (legacy): can't initialize iptables table `raw':
Table does not exist (do you need to insmod?)
```

The only front-end that needs those symbols is `iptables-legacy`, and
**nothing in this tree selects it**: the alternatives group is left in auto
mode, where the nft front-end outranks the legacy one, and `update-alternatives`
is run nowhere here. So cx3576's board loop no longer asserts the ten legacy
entries it carried. That is not a config change on cx3576 — the vendor config
still sets them and they stay `=y` — it is the removal of an assertion that
made a leftover look like a requirement. x64 keeps whatever `x86_64_defconfig`
resolves (a partial legacy surface: `filter` and `mangle` in both families,
`nat` in ip only, `raw` in neither), because trimming it is a subtraction with
its own size argument and no consumer asking for it either way.

#### 4.2.3 Four differences of the same class, measured and NOT closed

Running the wider extension set against the rebuilt x64 kernel found four more
board differences of exactly the shape §4.2.1 closes. They are recorded here
rather than fixed, because each needs a **direction chosen** and that is a
decision about what the product's compatibility path guarantees, not a
measurement:

| Extension | Symbol | x64 | cx3576 |
|---|---|---|---|
| `-m multiport` | `NETFILTER_XT_MATCH_MULTIPORT` | refused | works |
| `-m comment` | `NETFILTER_XT_MATCH_COMMENT` | refused | works |
| `-j CT --zone` | `NF_CONNTRACK_ZONES` | refused | works |
| `-j LOG` | `NETFILTER_XT_TARGET_LOG` | works (`=m`) | **refused** |

`-j LOG` is the one to read twice: it runs the *other* way, so the board with
the weaker firewall surface is not the same board for every rule. `-j CT
--zone` is also not an xt module — the `CT` target itself is floor now and
`--notrack` works on both; `--zone` needs a conntrack feature that widens the
conntrack tuple and is priced separately.

Closing any of them means either adding capability to the board that lacks it
or taking it from the board that has it. Both are product decisions about the
guaranteed compatibility surface, and the tail behind them is long
(`-m limit` and `-m iprange` are refused on **both** boards today, and there
are ~50 more). A floor that grew by whichever extension was tried most recently
would be a policy nobody chose.

### 4.3 Bridge filtering

podman puts every container's veth on one Linux bridge, and traffic between two
containers on that bridge is **switched at layer 2** — it never reaches the
ip-family hooks, so a host firewall cannot see it. Three symbols are what make
it visible at all.

| Symbol | What it buys | Debian |
|---|---|---|
| `CONFIG_BRIDGE_NETFILTER` | bridged IP and ARP frames reaching the ip-family hooks, so one firewall covers container-to-container traffic ("let arptables resp. iptables see bridged ARP resp. IP traffic", `net/Kconfig`) | `=m` `br_netfilter` |
| `CONFIG_NF_TABLES_BRIDGE` | the nf_tables `bridge` family — filtering a bridged frame at layer 2 without redirecting it into the ip hooks | `=m` |
| `CONFIG_NF_CONNTRACK_BRIDGE` | conntrack and IP defragmentation for bridged traffic, without which `ct state` is not answerable there; its own Kconfig calls it "a replacement for the `br_netfilter` infrastructure" | `=m` `nf_conntrack_bridge` |

`CONFIG_NF_TABLES_BRIDGE` builds no object of its own: it is a tristate
`menuconfig` whose family compiles into `nf_tables.ko` and whose submenu holds
the per-expression modules (`nft_meta_bridge`, `nft_reject_bridge`), which are
policy. It takes the same module-less shape in `verify/src/checks-kernel.ts` as
the inet/ip/ip6 family bools.

**What an operator observes, and it is not the same on both boards.**
`br_netfilter` defaults every one of its `call-iptables` / `call-ip6tables` /
`call-arptables` switches to 1 (`net/bridge/br_netfilter_hooks.c:1255-1257`),
and its hooks register once a bridge exists. Built in — as it is on an in-tree
board kernel — that happens at the first bridge; as a module, as on Debian's,
only once something loads it. So on cx3576 an ip-family FORWARD policy applies
to same-bridge container traffic from the moment podman creates its network,
and on x64 today it does not. The capability is common; the default state is
not, and a DROP policy written against one board will not behave the same on
the other. Anyone writing that policy has to decide the `bridge-nf-call-*`
sysctls explicitly rather than inherit them.

Three bridge symbols the cx3576 vendor config carries are deliberately **not**
in the floor, all three of which both kernels already have — so this is a
choice on merit, not a constraint:

- `CONFIG_BRIDGE_NF_EBTABLES` — the legacy ebtables front-end, held to the same
  test as legacy xtables. Nothing in the image ships `ebtables`, and the
  modern front-end does not need it: `ebtables-nft` programs the bridge family
  through the nf_tables compat expression (iptables 1.8.11 `nft.c:898`,
  `NFPROTO_BRIDGE` → `xtables_bridge`), which `NF_TABLES_BRIDGE` and
  `NFT_COMPAT` above already cover.
- `CONFIG_BRIDGE_VLAN_FILTERING` — VLAN-aware bridging. micad renders a plain
  `Kind=bridge` netdev with no `VLANFiltering=`
  (`mica-core:micad/src/reconciler/network.rs:569`) and delivers VLANs as
  separate `Kind=vlan` netdevs (`:566`), so nothing in the image asks a bridge
  to be VLAN-aware. Both kernels have it today, so adopting it later costs a
  fragment line and nothing else.
- `CONFIG_BRIDGE_IGMP_SNOOPING` — multicast snooping, and not a neutral
  addition: built, it is on by default per bridge, and with no querier on the
  segment a bridge stops forwarding multicast to ports that sent no report,
  which is how mDNS and SSDP discovery inside a container network breaks.
  Nothing in the image needs snooping, so the floor does not require the
  behaviour change.

### 4.4 Measured against Debian: what is required, deferred and dropped

x64 will eventually build its own kernel, at which point "Debian must satisfy
it" stops being a constraint. So every candidate was measured against Debian's
shipped config and put in one of three buckets, and the middle one is a list
the later task consumes rather than re-derives.

**Required now** — both kernels satisfy it. All eighteen symbols in §4.1–§4.3.
Verified against the config the cx3576 build actually produces (exported after
`olddefconfig`, not the committed input): every one comes out `=y`.

**Deferred to the x64 kernel** — cx3576 has it, Debian does not. **Measured
empty.** Of the 101 symbols the built cx3576 kernel sets in the
BPF / netfilter / bridge / VLAN / veth namespaces, exactly two are not satisfied
by Debian's `6.12.107+deb13-amd64`, and neither is a capability worth carrying
forward:

| Symbol | cx3576 | Debian | Why not deferred |
|---|---|---|---|
| `CONFIG_NETFILTER_XTABLES_COMPAT` | `=y` | not set | the 32-bit compat layer for x_tables ioctls on a 64-bit kernel; the image has no 32-bit userspace. Dropped on merit |
| `CONFIG_DEBUG_INFO_REDUCED` | `=y` | not set | a build-cost knob, not a capability — and Debian's "off" is *more* debug information, not less |

So the x64-kernel task inherits **no backlog of symbols** from this one. What it
inherits is the removal of the constraint: a future addition to the floor no
longer has to clear Debian's config first.

**Dropped on merit** — both kernels could satisfy it and the floor does not ask
for it: the legacy `IP_NF_*` back-end (§4.2.2 measures why),
`CONFIG_NF_NAT_MASQUERADE` (a `select` of `NFT_MASQ`), the three bridge symbols
in §4.3, and `CONFIG_DEBUG_INFO_BTF` (§4.1, priced). The per-extension xt
matches and targets were on this list when it was written and are not any more:
§4.2.1 measured seven of them load-bearing for the front-end §4.2 exists for,
and they are floor now.

**Owed, and named rather than rounded up.** The floor's own
`CONFIG_LSM="…,bpf"` names an LSM cx3576 does not build. On 6.1
`BPF_LSM depends on BPF_EVENTS && BPF_SYSCALL && SECURITY && BPF_JIT`
(`kernel/bpf/Kconfig`); the board already had the first three, and
`CONFIG_BPF_JIT=y` in §4.1 removed the fourth — so `CONFIG_BPF_LSM` is now
*available* on cx3576 and is simply left at its default of `n`. On x64 the
`bpf` entry is real (Debian sets `CONFIG_BPF_LSM=y`), so the boot list means
different things on the two boards. Nothing in the image uses a BPF LSM hook,
so this task does not enable it; closing the gap is now one config line, and
the alternative — dropping `bpf` from the boot list — is a security-posture
change that belongs with `docs/design/security-model.md`.

### 4.5 Explicit mount policy and board exclusions

The root masks `systemd-gpt-auto-generator`. Native init supplies the verified
root/support and mounts SYSTEM; current fstab/mount units explicitly own DATA,
ESP and audited writable leaves. Automatic discovery must not create a writable
ESP or broad `/var` mount. The root verifier checks the shipped mask and mounts.

cx3576's vendor configuration leaves autofs disabled; this is a board capability
fact, not the mechanism protecting current storage. A future kernel capability
change must still preserve the explicit mount policy and pass complete boot,
service-namespace and shutdown checks.

## 5. cx3576 fixed FIT policy

The Mica OS U-Boot build pins required FIT configuration verification and embeds the
explicit public boot-key set. Persistent command imports are disabled. The native
C policy checks the current three-partition geometry, arms the watchdog before
storage, reads bounded redundant records, and persists/flushes/read-backs an
attempt decrement before loading FIT. No shell environment command is used to
select deployments or refill attempts.

`make os-fit-records-test` exercises the parser and complete production C entry
point under block write/flush/readback failures. Required signature tests reject
missing, changed and unknown-key FITs. Recovery-key or exhausted/invalid records
enter local rockusb. Physical watchdog handoff and eMMC power-loss behavior need
separate board evidence.

## 6. Kernel support policy

The boot path sets the floor. The root is a squashfs carrying its own dm-verity
hash tree, described by one `dm-mod.create=` table on the kernel command line —
"one boot contract, written once by rootfs/build.sh, read by the kernel's
dm-init on a board whose kernel has it and by this script on a board whose kernel
does not" — above a userland that
is "Debian trixie + systemd" — the digest-pinned base
`rootfs/compose/10-compose.Dockerfile` installs onto, with systemd arriving
as `mica-system`'s `Depends`. Every board therefore
has to carry the §4 assertion set built in — `=y`, never `=m`, because nothing
can load a module before the root is there. Both shipped boards do, and both
merge the same shared fragment before `olddefconfig`. Board intake tiers:

| Tier | Kernel | Support |
|---|---|---|
| 1 | >= 5.10 LTS | Full support (mainstream vendor BSPs: RK 5.10/6.1, NXP 5.15/6.6, TI 6.1) |
| 2 | 5.4 | Per-board evaluation; small shims expected, no structural work |
| — | 4.x | **Out of support.** Options in order: (a) uplift the vendor kernel, or mainline the SoC; (b) a separate profile for that board on a smaller base with the Mica OS services as containers, which gives up the signed A/B verity root the rest of this document assumes |

## 7. Adding a current board

1. In `mica-boards`: `bash tools/new-board.sh <name> --from <nearest>` copies
   a board under `boards/`, its build included -- `board.env`,
   `sources.env`, `manifests/board.pkgs`, the kernel build, configuration,
   device tree, patches and hooks under `kernel/`, the loader build and
   inputs under `loader/` with
   `bsp.env` naming them, the package inputs under `package/` -- with
   fresh identities; the Makefile discovers it. `make check` proves the contract
   (`tests/board-contract-test.sh`) and the kernel floor. The board package
   provides and conflicts with the virtual `mica-board`, so it excludes its
   siblings without naming them, and it may depend on the Debian packages
   the `mica-board-*` consumer family of `mica-debian:consumers.pkgs`
   pulls; a dependency beyond that set is a named consumer and a lock
   change in `mica-debian`.
2. Build the kernel through the family with the public content anchor, and
   the boot firmware where the family has one. Export matching modules,
   indexes, config and DTB; `make pool`, `make package-gate`, `make publish`.
3. In the assembly: pin the bundle and the board packages, then compose,
   sign and assemble a complete image with the component CLI. UEFI needs
   explicit Secure Boot enrollment; a FIT target needs fixed
   required-signature firmware policy.
4. Verify the explicit image/public-key inputs, then boot through actual
   firmware. Run full services/API, updates, fault recovery, quotas, reset
   and shutdown.
5. Record physical peripheral, power-cut, watchdog and recovery evidence
   before claiming hardware qualification. Every test begins with the
   complete current system, without an old-layout compatibility path.

## 8. Current boards

| Board | Architecture | Boot policy | Evidence |
|---|---|---|---|
| x64 | amd64 | UEFI Secure Boot → counted systemd-boot entry → signed UKI | Full QEMU runtime, API, updates, faults and shutdown |
| virt-arm64 | arm64 | AAVMF Secure Boot → counted systemd-boot entry → signed UKI | Full QEMU runtime/API and common update/fault policy |
| cx3576 | arm64 | Fixed Mica OS U-Boot → required signed FIT | Current full-image offline/FIT/IO proof; physical bench qualification pending |
| s905x5m | arm64 | eMMC boot0 Mica OS firmware → SD native records → required signed FIT | SD development port; physical qualification pending, excluded from qualified releases |

Per-board build and acceptance status is in
[support tiers](support-tiers.md#current-boards); each dossier holds its qualification rows.
