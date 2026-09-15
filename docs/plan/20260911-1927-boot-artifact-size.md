# 20260911-1927-boot-artifact-size Shrink the signed boot artifact: compression and early-userspace closure

- **status**: implementing
- **createdAt**: 2026-09-11 19:27
- **revisedAt**: 2026-09-13 (Phases 6-8 approved with user decisions)
- **reviewStatus**: 438 producers complete; final combined consumer review and system/hardware acceptance pending
- **approvedAt**: 2026-09-11 (explicit worker #347 dispatch)
- **relatedTask**: 20260911-1925-boot-artifact-size

## Context

The initramfs is embedded uncompressed in every signed kernel component
(`pkgs/mica-boot/fit.sh`, `compression = "none"` on all three FIT nodes):

| Board | FIT bytes | initramfs bytes | Share |
|---|---|---|---|
| s905x5m | 66,765,710 | 33,615,872 | **50.3%** |
| cx3576 | 78,798,326 | 33,615,360 | **42.7%** |

That is flash per deployment on SYSTEM, bytes per kernel update download, and
bytes hashed at boot under the FIT signature. It is **not** boot-peak RAM: the
startup half is released at `switch_root`. The resident cost is the exitrd and
belongs to 20260910-0341-minimal-boot-shutdown;
the two records do not overlap.

### Decisions taken before this revision

The user settled three questions on 2026-09-11; they are recorded here so the
plan is read as a decided route rather than a survey.

1. **Replace `veritysetup` and `dmsetup` with Rust directly** (Phase 2 below).
   The intermediate step of rebuilding cryptsetup against the kernel crypto
   backend is **not** taken — see *Alternatives*.
2. **Add `CONFIG_ZSTD` to cx3576's U-Boot**, so the kernel node can be
   compressed too rather than only the ramdisk (Phase 5).
3. **Remove cryptsetup from the early userspace entirely.** After Phase 2 the
   initramfs contains no cryptsetup binary and no cryptsetup library.

### Historical measurements: the pre-B2/B3 startup closure

Transitive `DT_NEEDED` walk over the built s905x5m ARM64 archive:

| Set | Files | Bytes | MiB |
|---|---|---|---|
| Historical: `mica-init` + 6 tools | 26 | 16,149,328 | 15.40 |
| Libraries | — | 14,116,944 | 13.46 (86.3%) |
| Programs | — | 2,234,917 | 2.13 (13.7%) |

`mica-init` itself needs only `libc.so.6` and `libgcc_s.so.1`. Every other
library belongs to the five util-linux/cryptsetup helpers it `exec`s. **Static
linking `mica-init` alone saves nothing** while any dynamically linked C program
remains in the archive, because `libc` and the loader stay for those.

The cost is concentrated in one helper. `veritysetup` is 73,672 bytes and
exclusively pulls 8,567,640 bytes:

| File | Bytes |
|---|---|
| `libcrypto.so.3` | 6,302,952 |
| `libzstd.so.1` (via `libcrypto`) | 723,048 |
| `libcryptsetup.so.12` | 603,376 |
| `libblkid.so.1` | 461,856 |
| `libz.so.1` (via `libcrypto`) | 133,600 |
| `libjson-c.so.5` | 133,368 |
| `veritysetup` | 73,672 |
| `libpopt.so.0` | 68,032 |
| `libuuid.so.1` | 67,736 |

Historical closure-subtraction projections, not measured implementation outputs:

| After | Files | Bytes |
|---|---|---|
| Pre-B2/B3 archive | 26 | 16,149,328 |
| Phase 2 (no veritysetup, no dmsetup) | 13 | **6,319,808** |
| Phase 3 (no util-linux helpers) | 4 | **3,413,472** |
| Phase 4 (static) | **1** | to be measured |

### Historical measurements: decompressor support

| Consumer | cx3576 | s905x5m | x64 | virt-arm64 |
|---|---|---|---|---|
| Kernel `CONFIG_RD_ZSTD` (unpacks the cpio) | y | y | y | y |
| U-Boot `CONFIG_ZSTD` (decompresses FIT nodes) | **absent** (`LZ4`, `GZIP` only) | y | n/a (UKI) | n/a (UKI) |

Read from the resolved configs under `_out/boards/*/`, not the committed
fragments, because `configure.sh` changes symbols before `olddefconfig`.

**The kernel side is already enabled on every board.** The only missing symbol
is cx3576's U-Boot, and Phase 5 adds it.

### Historical measurements: compression ratios

`zstd` is not installed on the analysis host, so `gzip -9` is recorded as a
historical comparison. It is not a guaranteed zstd floor; actual zstd output
must be measured before any claim is made.

| Object | Original | `gzip -9` | Ratio | Saves |
|---|---|---|---|---|
| `initramfs.cpio` | 33,615,872 | 13,806,185 | 2.43× | 19,809,687 (58.9%) |
| Kernel `Image` (s905x5m) | 33,065,472 | 13,111,167 | 2.52× | 19,954,305 |

The device tree is 82,203 bytes; compressing the `fdt` node is not worth a
change and is excluded.

### Where veritysetup is used

Two places, and only one ships:

- **Build time** — `veritysetup format` / `verify` in `build/src/component-build.ts`
  and `build/src/tools/veritysetup.ts`, inside build containers. Not on the
  device; out of scope, and **retained deliberately** because Phase 2's
  differential test needs it as the reference implementation.
- **The initramfs** — the copy `mica-init` invokes. This is what Phase 2 removes.

The shipped image carries neither `cryptsetup` nor `dmsetup` (absent from
`_out/cx3576/release/package-manifest.tsv`, 187 packages). So the device holds
exactly one copy and it is the one in the initramfs.

### Why the verity call is a translation, not a parse

`verity_args()` in `pkgs/mica-deploy/src/boot.rs` passes `--no-superblock` with
fully explicit geometry: format 1, sha256, 4096/4096 block sizes, data blocks,
hash offset, salt, root hash, root-hash signature, panic-on-corruption.
No-superblock means **there is no on-disk verity header to read**, which
`docs/design/ro-root.md` already states as the design. Every field of the kernel
table line

```
<version> <data_dev> <hash_dev> <data_bs> <hash_bs> <num_data_blocks>
<hash_start_block> <algo> <digest> <salt> [<#opt> <opt>...]
```

is already in hand; the only arithmetic is `hash_start_block = hash_offset /
hash_block_size`. `veritysetup`'s maturity lives in LUKS, superblock parsing and
algorithm breadth — none of which this path uses. That is what makes replacing
it a bounded job rather than a reimplementation of cryptsetup.

### Crates

| Crate | Version | Downloads | Licence | Nature |
|---|---|---|---|---|
| `devicemapper` | 0.34.8 | 903,898 | **MPL-2.0** | raw DM ioctls; README: "does not use libdm" |
| `devicemapper-sys` | 0.3.3 | 537,556 | **MPL-2.0** | `bindgen` + `pkg-config` as **build** deps only |
| `linux-keyutils` | 0.2.5 | 12,804,004 | Apache-2.0 OR MIT | `add_key(2)` |

`devicemapper::DM::table_load` takes `&[(u64, u64, String, String)]` —
`(sector_start, sector_length, type, params)` — so `"verity"` with an arbitrary
parameter string is expressible.

`pkgs/mica-deploy/deny.toml` currently allows only `Apache-2.0`, `MIT`, `ISC`,
`Unicode-3.0`, `Zlib`, and its comment states the list is deliberately minimal —
an allowance matching no real chain "reads as an approved risk rather than as
dead configuration". **Adding `MPL-2.0` is a review decision, not a formality**,
and it is the one approval gate Phase 2 carries.

Primary references:

- [dm-verity](https://docs.kernel.org/admin-guide/device-mapper/verity.html):
  table format and the `root_hash_sig_key_desc` optional parameter.
- [devicemapper-rs](https://github.com/stratis-storage/devicemapper-rs): wraps
  the devicemapper ioctls, does not use libdm.

## Proposal

Five phases. Phases 1 and 2 are independent and may run in parallel. Phase 3
depends on 2, Phase 4 depends on 3. Phase 5 is independent of all of them.

### Phase 1 — compress the ramdisk, no board change

Compress `initramfs.cpio` with zstd and leave the FIT ramdisk node at
`compression = "none"`. U-Boot then passes the blob through untouched and the
**kernel** decompresses it by magic, which every board already supports
(`CONFIG_RD_ZSTD=y` ×4). The same compressed cpio serves the UKI boards
unchanged, since the kernel unpacks it there too.

This phase is deliberately independent of Phase 5: it needs no U-Boot change, so
it can land before the cx3576 U-Boot work and on every board at once.

Decide and record what `pkgs/mica-boot/fit.sh`'s 64 MiB assertion
(`test "$(stat -c%s /output/initramfs.cpio)" -le 67108864`) should bound after
this change — the compressed bytes, the uncompressed bytes, or both. Leaving it
undecided silently weakens an existing bound.

### Phase 2 — replace veritysetup and dmsetup with Rust

Execution selects the typed-ioctl fallback through B3 lifecycle-sys plus
linux-keyutils. The original devicemapper proposal below is retained as decision
history; no devicemapper dependency or MPL allowance was added.

Historical proposal: take `devicemapper` and `linux-keyutils` into `pkgs/mica-deploy`. In `mica-init`:
load the PKCS#7 signature with `add_key(2)`, build the verity table line from
the values `verity_args()` already computes, then `device_create` →
`table_load` → `device_suspend`. Read the table back with `table_status` in
place of the current `dmsetup table` shell-out.

Delete `veritysetup` and `dmsetup` from the initramfs closure
(`pkgs/mica-boot/initramfs.sh`) in the same change. Endpoint: 16,149,328 →
**6,319,808** bytes across 13 files, **9,829,520 saved (61%)**. After this phase
the early userspace contains no cryptsetup binary and no cryptsetup library.

Retire `verity_args()` or narrow it to the table-line builder; do not leave a
second argument-formatting path that nothing calls.

**Licence route: (a) — add `MPL-2.0` to `pkgs/mica-deploy/deny.toml` after
review.** File-level copyleft over unmodified upstream crates; the obligation is
source availability for those files, satisfied by the upstream reference. If
that review is declined, the recorded fallback is **(b)**: hand-write the four
ioctls (`DM_DEV_CREATE`, `DM_TABLE_LOAD`, `DM_DEV_SUSPEND`, `DM_TABLE_STATUS`)
against `dm-ioctl.h` — roughly one to two hundred lines — and keep
`linux-keyutils`, which is Apache-2.0 OR MIT and needs no allowance. Record
which route was taken and why. Do not ship both.

### Phase 3 — internalise the remaining helpers

Replace `/bin/mount`, `/sbin/losetup`, `/sbin/blkid` and `/sbin/switch_root`
with direct syscalls in `mica-init`: `mount(2)`; `LOOP_CTL_GET_FREE` +
`LOOP_SET_FD` + `LOOP_SET_STATUS64`; a PARTUUID lookup restricted to GPT; and
`MS_MOVE` + `chroot` + `exec` with the old-root removal. `rustix` is already a
dependency. Endpoint: 6,319,808 → 3,413,472 bytes across 4 files.

BusyBox was considered for this phase and rejected — see *Alternatives*.

### Phase 4 — static-link mica-init

With no dynamically linked C program left, link `mica-init` statically so the
startup half is one file. The mechanism (musl target, or glibc `+crt-static`) is
an implementation decision; record which and why. **This phase is worth nothing
before Phase 3** and must not be scheduled earlier.

### Phase 5 — U-Boot `CONFIG_ZSTD`, then compress the kernel node

Add `CONFIG_ZSTD` to cx3576's U-Boot and set the FIT kernel node to zstd.

`boards/cx3576/bsp/uboot/build.sh` configures over the upstream
`${BOARD}_defconfig` with a `scripts/config --enable ...` chain followed by
`make olddefconfig`, so the symbol goes into that chain. **Assert `CONFIG_ZSTD=y`
in the resolved `.config`** using the assertion helper already in that script
(the `grep -q "$1" .config` guard); an `--enable` line is a request, and
`olddefconfig` is what decides. s905x5m already has `CONFIG_ZSTD=y` and needs no
change. Not applicable to the UKI boards, whose kernel is the signed PE itself.

## Verification

No phase is complete until the archive and FIT bytes are re-measured against the
baselines in *Context*, and **no size claim is made before measurement** — the
`gzip -9` figures above are a floor, not a prediction.

### Phase 1

- Confirm the compressed cpio is detected and unpacked on all four boards,
  including the two UKI boards, from a cold boot.
- Measure real zstd output and record it; compare against the `gzip -9` floor.
- Verify the rebuilt `fit.sh` assertion fails on an oversized payload, under
  whichever quantity it was decided to bound.

### Phase 2 — the security-critical phase

This phase moves a signature-enforcement boundary from validated upstream code
into this repository. The failure mode to exclude is **not** a boot failure; it
is a mapping that looks correct but does not enforce the signature. Verification
is therefore differential, negative and mutation-based, in that order.

**Differential, before the switch.** `veritysetup` still exists in the build
containers. For the same inputs, produce the table line both ways — the current
`veritysetup open` path and the new Rust path — and require
`dmsetup table` / `table_status` output to match **exactly**. A golden test over
the built s905x5m and x64 images makes the translation claim checkable instead
of asserted. This test must exist and pass before `veritysetup` leaves the
initramfs.

**Keep and strengthen the existing read-back guard.** `verified_mount()` already
requires `root_hash_sig_key_desc` in the table and the mapping to be read-only
after creation. It tests kernel state rather than a tool's exit code, which is
what makes it survive the implementation swap. Keep both assertions and add a
third: the mapping's target type is `verity`.

**Negative cases, each required to refuse rather than degrade:**

- a tampered data block faults on read (the mapping exists and the read fails —
  this is the property `docs/design/ro-root.md` claims);
- a wrong root hash refuses the mapping;
- an absent signature file refuses, and does not create an unverified mapping;
- a corrupt signature refuses;
- a signature made by a key outside the kernel's trusted keyring refuses. This
  one is the whole point of `CONFIG_DM_VERITY_VERIFY_ROOTHASH_SIG` and cannot be
  inferred from the others passing.

**Mutation tests, each required to turn a green run red:**

- omit `root_hash_sig_key_desc` from the table line → the read-back guard fails;
- omit the read-only assertion and load a writable mapping → caught;
- skip the `add_key(2)` call → the kernel refuses the table load, and the
  refusal is reported rather than swallowed.

A guard whose removal changes no result is not binding the behaviour it names;
each mutation above must be shown to fail, not assumed to.

**Also:** run `cargo deny` for `pkgs/mica-deploy` and show it fails before the
`MPL-2.0` allowance and passes after — the allowance must be demonstrated to be
load-bearing rather than added speculatively.

### Phases 3 and 4

- Verify the PARTUUID lookup against a GPT disk and confirm it **refuses** a
  non-GPT table rather than guessing; the library it replaces handles more cases
  than mica needs.
- Verify `switch_root` equivalence: `/dev`, `/proc`, `/sys` and `/run` survive
  the transition, and the old root is actually removed rather than leaked.
- After Phase 4, assert the startup manifest lists exactly one regular file.

### Phase 5

- Assert `CONFIG_ZSTD=y` in the **resolved** cx3576 U-Boot `.config`, not the
  enable line.
- Phase 5 cannot be accepted without a cx3576 **cold boot** on the local board.
  QEMU and image inspection do not count as physical acceptance.

### Every phase touching the initramfs

- x64 and virtual ARM64 signed boot, signature and corruption refusal,
  deployment selection, component upgrades, three-trial fallback, normal
  shutdown and actual reboot.
- A newly signed CX3576 FIT/image: offline signature, layout and growth checks,
  then cold boot, apid reboot, poweroff and watchdog behaviour on the local
  board when it is available.
- The relevant Rust, packaging, shell and documentation gates.
- Record delivered bytes per phase in the related task.

## Risks

Phase 2 reimplements a security boundary, which is why its verification is
differential against the tool it replaces rather than self-referential. The
residual risk after the differential test is a case the golden inputs do not
cover; the negative and mutation lists above exist to bound that, and the
trusted-keyring case in particular cannot be reached by any positive test.

Phase 1 changes what the FIT signature covers (compressed bytes), which is
sound, but it also changes what the size assertion measures; leaving that
undecided would silently weaken a bound. Phase 5 touches a board whose console
and boot path are under concurrent repair, and a U-Boot that cannot decompress
what the FIT declares is an unbootable image rather than a degraded one — which
is why the resolved-config assertion is mandatory and why Phase 1 was kept
independent of it.

Compression saves flash, download and hashed bytes; it does **not** reduce boot
RAM, since the kernel still expands the archive. Do not let the two axes be
conflated when reporting results.

## Scope

`pkgs/mica-boot/` (FIT/UKI packaging, initramfs construction),
`pkgs/mica-deploy/` (`mica-init`, `verity_args`, `deny.toml`),
`boards/cx3576/bsp/uboot/build.sh`, and the relevant build and boot tests.
Record the delivered measurements in the related task.

Out of scope: the resident exitrd (owned by
20260910-0341-minimal-boot-shutdown),
build-time `veritysetup` use in `build/` (retained as Phase 2's reference
implementation), board driver cleanup, main-system init replacement, partition
changes, compatibility layers and migrations.

## Alternatives

- **Rebuilding cryptsetup with `--with-crypto_backend=kernel` — declined
  2026-09-11.** It drops `libcrypto.so.3` and its `libz`/`libzstd` dependants
  (7,159,600 bytes) while keeping upstream's validated code, and was scheduled
  in the previous revision of this record as a low-risk early landing and as
  Phase 2's fallback. It was removed on the user's decision to remove cryptsetup
  from the early userspace outright. The reasoning that supports that decision:
  it saves 7,159,600 against Phase 2's 9,829,520; it leaves `dmsetup` in place;
  it requires a new cross-compiled from-source stage in
  `pkgs/mica-boot/Dockerfile`, which is more packaging work than Phase 2 is Rust
  work; it is retired by Phase 2 the moment that lands; and it can never reach
  Phases 3–4, because any dynamically linked C program in the archive keeps
  `libc` and the loader. Recorded rather than deleted so the option is not
  rediscovered as new.
- **BusyBox for the startup helpers — measured and rejected.** Replacing
  `mount`, `losetup`, `blkid` and `switch_root` frees only 1,522,104 bytes,
  because just two libraries are exclusive to them (`libmount.so.1` 527,152 and
  `libsmartcols.so.1` 395,432); the rest are shared with the verity/DM chain and
  stay. Against a static BusyBox of roughly 1,038,696 bytes (local 1.37.0 build,
  indicative) the net is about 0.46 MiB, versus 1,522,104 for Phase 3. It also
  reintroduces a recorded argument-contract risk: BusyBox's `blkid` lacks
  `-t PARTUUID=... -o device` and its `losetup` options differ. Less saving and
  more risk than doing the syscalls directly.
- **fs-verity instead of dm-verity** removes the cryptsetup chain outright, but
  changes the install path rather than only boot, and `docs/design/ro-root.md`
  specifies a no-superblock dm-verity tree with geometry bound by the deployment
  envelope. A redesign, not a size optimisation.
- **Dropping the initramfs entirely** is only available if the root stops being
  file-backed: the kernel cannot mount ext4 and attach a loop device to a file
  inside it before root, and `dm-mod.create=` takes block devices.
  `CONFIG_DM_INIT=y` is already set on all four boards, so the kernel side would
  be ready, but it requires abandoning LAYOUT_VERSION 3 signed file deployments.
  A product-level decision, recorded here so this plan is not read as having
  rejected it on size.

## Annotations

Measurements were read off already-built artifacts under `_out/` on 2026-09-11;
no build was run. The three route decisions above are settled; implementation is approved by the explicit worker #347 dispatch. No compatibility
is required. Historical measurements are not current B2/B3 artifact evidence.

## Approved execution (worker #347)

- Owner: boot-size/vhqwow6o; isolated branch bkd/vhqwow6o.
- Exact reviewed dependency: fb6c4597bb902f69d528bcdc3c8372f310c322b1,
  tree cbf2fa8ff2c8fc03534b218c952a511b6a6ba392; includes B3 source
  36866b47f2647e778ef33d7183fbba88a81a494e. Integrated at ef5e27c7.
- [x] Phase 1 implementation and offline proof: deterministic zstd archive;
  expanded and compressed 64 MiB bounds remain, as do load/component limits;
  malformed/truncated/oversized and actual signed FIT/UKI payload checks pass.
- [x] Phase 2 implementation and x64 kernel fixture: one typed DM/key route;
  real reference differential, signature/read-only/trusted-key/corruption and
  guard-removal evidence passed before retiring helpers.
- [x] Phase 3 implementation and x64 native fixture: mount/loop/GPT/switch-root,
  partial-creation rollback and old-root reclamation pass; existing supervisor
  deadlines and B3 teardown remain. Full-image watchdog acceptance is pending.
- [x] Phase 4 implementation: measured GNU static mica-init, single startup
  executable manifest and empty-userspace proof. Batched producer/full-image
  acceptance remains pending; no ARM native build was run.
- [ ] Phase 5 acceptance: resolved CX ZSTD, complete firmware build, original
  trust-anchor FIT verification and payload tamper refusal pass. Mandatory
  physical cold boot remains pending.
- Generic iteration and batched final image acceptance use x64. Focused CX
  U-Boot/FIT checks are authorized; broad ARM acceptance remains deferred until
  approved main integration. Mandatory CX cold-boot evidence remains pending
  without a confirmed bench device, console/endpoint, image and power control.
- Heavy jobs require an actual B/L1 allocation; no B7 inputs are modified.
- Final state is review, never done; local integration/commits are authorized,
  main writes, pushes and releases are not.

### Selected implementation route and evidence limits

The approved typed-ioctl fallback is used, extending B3's existing lifecycle-sys
boundary for startup create/load/resume and owned partial-creation rollback.
The retained active-only status/table/removal parser stays strict. There is no
second DM stack and no MPL-2.0 allowance. The historical line-count estimate is
not an implementation-size claim. The historical licence explanation is not a
verified compliance conclusion and does not apply to the selected fallback.

Registry sparse-index review on 2026-09-11 confirms linux-keyutils 0.2.5 (latest
non-yanked stable; archive SHA256
83270a18e9f90d0707c41e9f35efada77b64c0e6f3f1810e71c8368a864d5590), Apache-2.0 OR MIT,
with only existing bitflags/libc runtime dependencies. It uses Linux syscalls,
not a cryptsetup/libdevmapper/OpenSSL library. No toolchain refresh is needed.
The pinned rustix 1.1.4 typed ioctl and safe mount/chroot APIs are reused.
`cargo deny check licenses bans advisories` passes without changing deny.toml;
its existing duplicate-version and unmatched Zlib warnings remain visible.
The plan's MPL fail-before/pass-after check is conditional on the rejected
MPL route; adding an unused licence allowance to demonstrate it is excluded.

The native worker protocol keeps the existing startup watchdog supervisor and
its bounded process-group termination; it accepts typed operations through /init.
The final switch-root stays in PID1, validates ramfs/tmpfs and the separate new
root, limits traversal, avoids symlink targets and removes old-root files before
MS_MOVE/chroot/exec. Device mappings are authenticated during TABLE_LOAD; a later
corrupted-data read is a distinct outcome, never called a table-load refusal.

Source fixtures have passed the current workspace tests (two pre-existing ignored
runtime cases remain ignored), native mount options/worker/old-root tests and
verity geometry/readback mutation tests. x64 C UAPI assertions include startup
DM/loop requests. These results are not kernel, guest, signed-image or hardware
acceptance. Real x64 differential/negative proof subsequently passed, and the legacy
startup helpers were retired. Build-time veritysetup remains the independent
reference. Detailed measured artifacts, hashes, original failures and scope
limits are recorded in the related task.

### Current acceptance boundary

The current source implements all five phases. Phase 1 has deterministic bounded
archive tests and actual signed FIT/UKI extraction/tamper refusal. Phase 5 passed
the allocated focused CX resolved config/build and signed FIT packing checks
using the original public boot anchor. The previous builder CONFIG_ZSTD-unset result is preserved as RED.
No broad ARM native/root/image/guest run is authorized before main integration.

A review finding caught objcopy rewriting the signed UKI when extracting its
initrd section. Extraction now writes a disposable PE copy, leaves the signed
original unchanged and verifies that original again; an in-place payload-bit
mutation preserves the certificate table and fails Authenticode hash checking.
The first /dev/null-output attempt failed with "objcopy: /dev/null: file truncated"
and was replaced by an ordinary disposable output file.

Physical CX cold boot and the final batched full-image/producer evidence are
pending. This record must not be marked completed from source, tiny TCG or
offline packaging evidence alone.

The actual x64 native producer completed at source9673af581d9857a0ff3746a5483ca3e70533861e,
with a new source/tree/lock/tool/flag witness. The final matched assembly is
4,453,376 raw bytes and 1,094,275 compressed bytes; startup is2,403,504 bytes and
retained shutdown is2,047,144 bytes, measured separately. Shutdown was rebuilt
from the shared workspace, so its output hash changes while the B3 teardown
source/safety contract is preserved. Exact final hashes and prior probe rows
are kept separately in the task.

PMA-CR self-review found and fixed the DM partial-activation leak and signed-PE
extraction rewrite. No remaining high-confidence source defect was identified.
The existing Rust gate passes97 tests with2 existing skips, plus fmt/clippy/
doctests/deny; real x64 producer-worker/verity/GPT/mount/cleanup and compressed
artifact checks pass. This source-review result is not full-image or hardware
acceptance. The unchanged shell-policy failure at
`pkgs/micad/apid/ui/verify-ui-policy.sh:82` remains reported.

### B347-R1 approved review correction

The independent review found unconditional loop rollback after failed identity
readback, including the SET_STATUS64 error path. The focused correction requires
current exact binding proof before CLR_FD, with source-bound negative and owned
rollback tests. Existing native/guest/packing evidence retains its original source
identity; changed implementation needs a later production witness. Target-routing
overlap with reviewed B 85c54845 is prepared privately for subsequent integration.

R1 source correction is ready: changed/unknown loop state refuses without clear;
configuration failure clears only a fresh exact owned binding. Six new source-bound
regressions have RED/GREEN evidence; lifecycle-sys 14, native_startup 4 and startup 1
tests plus fmt/clippy passed. No live device race or new production native was run.
Detailed command/source/resource and failure hashes are in the existing task's
B347-R1 section. The three-file private target-route patch reconciles B 85c54845
without restoring helpers; 15 isolated branch/launcher cases pass. B's later
compressed-cpio/observer-symlink consumer correction and truthful successor producer
binding remain required. Full-system and physical acceptance are still pending.

### Accepted single-target route applied

B closed R1 after independent review and authorized the exact three-file route
patch (SHA256 63b227818b4ca26dfa4e90ebe64c229b99f37496eebf4f361925bf6ace6d986f).
It is now applied on the same branch with final bytes equal to the accepted
proposal and its 15-case test inputs. Only routing/syntax/docs/diff validation is
needed here; prior Rust, guest, native and packing suites are preserved, not rerun.
The selected EFI target, strict refusal rules, x64 isolation, zstd and startup
helper retirement coexist without restoring BusyBox. B's later exact consumer
binding and new producer identities remain required; full-system and physical
acceptance are pending. This source-only resolution does not complete the plan.

### Combined native producer

B reviewed and integrated source as 438c9551 (tree 775874cf, epoch 1789167215).
The next authorized obligation is one x64 boot-native production run in a clean
private detached checkout, using the existing GNU static hook and pinned Rust
image, followed only by direct ELF/empty-userspace proof. Prior native 9673
outputs are historical inputs, not substitutes for this changed source. Exact
boot-tools/deploy inputs may be prepared read-only for the later consumer join;
full-system and mandatory physical CX acceptance remain pending.

The actual combined-source boot-native hook succeeded once: mica-init 2403504
bytes (57c865ed...), retained mica-shutdown 2047144 bytes (77bf04b4...).
Source/tree/epoch remain 438c9551/775874cf/1789167215. Existing ELF parser and
new-byte empty-userspace/refusal proof passed, with full stdout/stderr and
terminal resource records retained under the combined output root. The task
contains exact hashes. This is a new native witness, not a new compressed image
or a guest/full-system acceptance result. The next exact deploy/boot-tools
input inventories are prepared read-only; their production and shared-consumer
binding remain pending. The producer allocation is released and the plan stays
in progress for full-system and mandatory physical CX acceptance.

L1 subsequently approved the exact 438 joined-consumer/source and native-format
continuation within this plan. The worker synchronized only the reviewed 438
commit at a clean boundary (merge 5d7d8c13), preserving its tracking records.
Implementation now binds fixed producer roles, all 15 input maps and bounded
canonical zstd/newc with exact native manifests/observer identity. Completed
438 native production is retained; changed deploy/boot-tools production and
consumer RED/GREEN remain active obligations. Existing B7 acceptance stays
independent. Full-system and physical CX acceptance remain pending.

The native-format/witness checkpoint implements bounded single-frame decoding,
strict archive/observer membership and source/capture-before-decode ordering.
It validates the actual completed 438 native outputs and preserves old-role
refusals; focused RED/GREEN, signature negatives and typecheck are recorded in
task 1925. No producer input has been relabeled. Complete new join admission is
still pending the fixed Makefile existence-only input disposition and actual
deploy/boot-tools witnesses; all 15 full input maps and both Git legs are
retained. Exact producer checkout/commands are ready for B scheduling. Source
fixture resources are terminal and released; no second native, independent
root/image or ARM production occurred. This is a review checkpoint within the
active plan, not completion or full-system/hardware acceptance.

### 2026-09-12: successor input contract approved

Implement L1-438-MAKEFILE-MEMBERSHIP-20260911-2336 within the existing joined
source blocks, retaining complete differing input maps and the exact five-reader
proof. The four named ARM maps remain recorded but unselected and unqualified.
B-347-BUILDKIT-EXECUTION-20260911-2348 authorizes the private pinned daemon only,
after deploy PREPARE cleanup, followed by one x64 boot-tools build. Successful
438 boot-native outputs are reused unchanged. Full signed-system and physical CX
acceptance remain pending.

### 2026-09-12 00:21: exact input contract checkpoint

The J-to-438 proof now retains all 15 full maps, the exact 72-byte Makefile
deletion and five unchanged readers, both reviewed Git delta legs, the exact
15 selected package names and four explicitly unqualified ARM maps. Actual
clean-source canonical proof SHA256 is
`93902df4c3351b3d3e2c3ca3977f6b4bbd07fb2361c2f0aedc1f0c1c3d1b87ba`.
Direct Python contract/mutation tests and the single Bun complete-input case
plus typecheck pass; original REDs and the editor syntax failure are retained.
These helpers are prepared for the pending complete consumer join, without
admitting missing or failed output witnesses.

Changed deploy compilation succeeded once (2,632,224-byte staged binary,
SHA256 `411419421b364a27fe466ba1b0f509ee2f054a502493d6f474f1a8f4fff2855d`).
Packaging did not start: the private daemon adapter rejected the native x64
ISA variant list returned by pinned BuildKit. The original package invocation
failed, its daemon was stopped/removed, and the successful compile is preserved.
B has the exact packaging-only continuation proposal; no PREPARE or boot-native
retry, extra resource allocation, shared builder change or source relabeling
is implied. The subsequent x64 boot-tools output and full consumer receipt
binding remain necessary. Physical CX and final signed-system acceptance are
still pending.

The 2026-09-12 00:39 recovery disposition resolves the daemon parser boundary:
one explicit recreation, fresh cgroup/remote checks, then the exact remaining
pack/export/index work and one x64 boot-tools invocation are authorized in the
existing serial slot. Previous failure and successful PREPARE identities remain
immutable; the full consumer join and physical/system acceptance remain pending.

The 2026-09-12 bounded packaging recovery completed the actual changed deploy
and single x64 boot-tools producers from clean reviewed `438c9551`. The native
producer and successful deploy PREPARE were not replayed. Exact receipts,
output identities, original collector failures and resource terminals are
recorded in task 1925 and `pack-recovery-v1/witnesses`. All producer containers
are removed and the heavy reservation is released. Full startup consumer
admission now binds the actual new outputs; its final direct tests, two-copy
canonical proof and independent integration review remain in progress. The
whole plan remains open for full-system and mandatory hardware acceptance.

The exact startup join implementation now binds actual 438 native, deploy and
boot-tools receipts while preserving original J package and old fb6/4716 role
semantics. Focused record, file, capture, default-source and unselected ARM
refusals pass; the final TypeScript check passes after preserving and fixing its
original missing-binding failure. The real creator has consumed all actual
producer inputs successfully. Final committed-source two-copy lineage and B
integration evidence are attached through the existing task handoff path.
This is consumer/source readiness, not complete plan or physical acceptance.

The additive reviewed four-mask and named-4716 overlap is being incorporated
at the next consumer boundary. A replacement bounded source gate verifies the
combined admission while frozen 438 producer outputs remain unchanged. New
combined-source two-copy lineage and independent B review are required; prior
33c619c9 evidence remains an immutable earlier-source result.

The exact named-tool/four-mask overlap now passes local review, eight bounded
Python cases and six explicit one-file release cases with 39 assertions plus
typecheck. Original mask RED and the incomplete-schema fixture failure remain
bound to their actual source and container runs. Both existing source roles
remain independently constrained; producer inputs and `COMPOSITION_PATHS` are
unchanged. All source containers are terminal and removed. The final committed
source is used for two-clean-copy canonical admission in
`consumer/mask-final-handoff`; independent B review, final signed-system and
physical CX evidence remain open. No successful producer was replayed.

### Final operator overlap and combined consumer handoff

The exact reviewed `70a7a408` to `66385757` two-path overlap is applied without
importing B/B7 history. Both declaration/test blobs equal the reviewed source;
Docker, operator/service/quota resources and native rc links preserve the four
masks and existing refusal policy. The three successful 438 producer receipts
remain immutable. No producer inputs, source-role allowances, capture policy,
selector or trust inputs changed for this integration.

Two clean copies of the final consumer commit generate canonical startup joins
from the actual 438 witnesses and 14 original-J plus one 438 deploy archives.
Final source/context, capture and release admission evidence is bound separately
from the reused B7 full-compose and 70a7 direct-test results at
`_out/boot-size/consumer/operator-final-handoff/delivery.json`. Reused fb6 capture
is never a 438 root qualification. B independent review and its existing-owner
combined x64 acceptance batch remain pending, as do mandatory physical CX inputs
and the post-approved-main consolidated ARM obligation. Status stays in progress.

## Proposed extension (2026-09-13): Phases 6-8

Status: approved by the user on 2026-09-13 with the decisions below. Requested: drop
`iproute2` and `curl` from the image, and merge the lifecycle executables into
one binary reached through links. Phases 6-8 are independent of each other and
of the physical CX acceptance still pending above.

### Current state

- The initramfs holds two static regular files: `init` (mica-init, 2,403,504
  bytes) and `exitrd/shutdown` (mica-shutdown, 2,047,144 bytes);
  `sbin/mica-shutdown` is already a symlink to `/exitrd/shutdown`
  (`mica-boot:initramfs.sh`). mica-init already links the shutdown module.
- `curl` has two device consumers: `mica-deploy:src/acquisition.rs` `download()`
  (execs `/usr/bin/curl`; the deb declares `Depends: mount, curl`) and the apid
  probe in `mica-system:overlay/usr/lib/mica/mica-health`.
- `iproute2` has three device consumers: `micad` `IpLink` (`ip link del dev`),
  `mica-boards:cx3576/hwinit/hwinit-can` (`ip link set ... type can bitrate`)
  and `hwinit-mac` (`ip link set dev ... address`). Guest suite
  `mica-build:tests/apid-api/guest/m7-net-smoke.sh` also runs `ip link add/del`.
- Both are declared by `mica-system.control` Depends and asserted by
  `mica-build:rootfs/runtime/consumers.json` and
  `rootfs/scripts/package-manager-purge.sh`. No other pool package depends on
  either. x64 release manifest: 161 packages including curl, libcurl4t64,
  iproute2 and their library closure (nghttp2/3, ssh2, rtmp, psl, ldap, sasl,
  krb5, bpf, elf, mnl, ...); the exclusive closure is to be measured, not
  asserted.

### Phase 6 - one lifecycle multi-call executable

Build one static `mica-lifecycle` binary from the two entry points, dispatching
on `basename(argv[0])`: `init` -> startup PID 1 and startup worker; `shutdown`
/ `mica-shutdown` -> retained shutdown PID 1 and lifecycle worker; anything else
refuses. Initramfs layout: `exitrd/shutdown` stays the only regular file (it is
what `copy_exitrd` retains), `init` and `sbin/mica-shutdown` become symlinks to
it. The startup manifest contract changes from "one regular file `init`" to
"one regular file, two named links"; `mica-lifecycle.control`, `prepare.sh`,
`initramfs.sh`, the native manifest/witness checks and the boot package tests
follow. `mica-deploy` stays a separate dynamic rootfs binary: it ships in a
different artifact, so merging it shares no bytes on the device.

Trade-off: the initramfs drops about one executable; the retained exitrd tmpfs
grows from the shutdown-only size to the merged size. Both are measured.

### Phase 7 - remove curl

- `mica-deploy`: replace the curl exec with an in-process HTTP/1.1 client
  (rustls over the existing `ring`, system CA bundle), preserving the current
  contract exactly: http/https only, no redirects, 15 s connect, 1800 s total,
  abort below 1024 B/s for 30 s, byte limit, resume via `Range` accepting 206
  (200 without resume). Crate and version chosen at the registry during
  implementation; `cargo deny` must pass without new licence allowances.
  Tests first against a local test server: 200, resume 206, error status,
  oversize, stall.
- `mica-health`: probe apid with a new `apid --healthcheck` (TLS to
  127.0.0.1:443, verification off as today, `GET /healthz`, 2xx required),
  replacing the curl/wget branches; `health-test.sh` follows.
- Drop `curl` from `mica-deploy.control`, `mica-system.control`,
  `consumers.json`, the purge keep-list and the `mica-debian` lock.

### Phase 8 - remove iproute2

- `micad` `IpLink` -> `networkctl delete <iface>` (systemd, already in the
  image; RTM_DELLINK without a second netlink engine). Unit tests keep the
  trait seam.
- `hwinit-can`: render `/run/systemd/network/` CAN settings
  (`[CAN] BitRate=`, `RestartSec=`, `FDMode=`) from `can.conf` and let networkd
  apply them; `hwinit-mac`: render a runtime `.link` with `MACAddress=` and
  retrigger the udev add event. Physical CX acceptance required.
- `m7-net-smoke.sh`: create/delete test devices through `.netdev` +
  `networkctl` instead of `ip`.
- Drop `iproute2` from `mica-system.control`, `consumers.json` (including the
  `routel` exception in `compose.py`), the purge keep-list and the lock.
- Operator impact: no `ip`, `ss`, `tc`, `bridge` on the device; diagnostics
  move to `networkctl`, `resolvectl` and `/proc/net`.

### Verification

- Phase 6: dispatch unit tests per argv[0] including refusal; initramfs
  manifest test (one regular file, two links); x64 guest boot, shutdown,
  reboot and partial-startup refusal; measured initramfs and exitrd bytes.
- Phase 7: RED/GREEN transfer tests; `cargo deny`; health-test suite; x64 guest
  update fetch from an HTTPS source and health gate mark-good.
- Phase 8: micad network reconciler tests; guest VLAN/WireGuard delete; CX CAN
  bitrate and MAC on the bench board.
- All: package manifest diff and composed root KiB before/after, recorded in
  task 20260911-1925.

### User decisions (2026-09-13)

1. The lifecycle executable is named `mica-runkit`; `init` and `shutdown` are
   links to it. In addition, `micad` and `apid` are merged into one binary
   (`micad` is the file, `apid` a link), both shipped by the same `micad`
   feature and producer. `mica-mqttd` and `mica-mqtt-broker` belong to the
   optional `mqtt` feature and stay separate, so images declining MQTT do not
   carry its code.
2. networkd/udev replace `ip` in the CX hwinit scripts. `mica-busybox` stays
   the operator fallback (`busybox ip`, `busybox wget`) and nothing depends on
   it, per its control file.
3. apid's own `--healthcheck` replaces curl/wget in `mica-health`.

Initramfs layout under decision 1: `/init` stays a regular file (startup record
retirement asserts `/proc/1/exe == /init`) and `exitrd/shutdown` is a hard link
to it, so the cpio stores the bytes once and `copy_exitrd` still retains a
regular `shutdown`. `sbin/mica-shutdown` remains the symlink to
`/exitrd/shutdown`. The `mica-lifecycle` archive ships one file,
`/usr/lib/mica/lifecycle/mica-runkit`.

### 2026-09-13: Phases 6-8 producer-side implementation

Source changes are in the working trees of the producer repositories,
uncommitted; nothing is pushed or published.

- `mica-deploy`: `mica-init` and `mica-shutdown` are one static `mica-runkit`
  (`src/bin/mica-runkit/`), dispatching on the invoked name; `mica-lifecycle`
  ships `/usr/lib/mica/lifecycle/mica-runkit` only. The curl exec is replaced by
  an in-process HTTP/1.1 client over rustls 0.23.44 (ring, system CA bundle)
  keeping the transfer contract, except that redirects are followed (up to 10,
  http/https only, no credentials; user decision 2026-09-13: sources may sit
  behind a CDN and catalogs and objects are authenticated by signature and
  digest, not by origin); `deny.toml` gains `BSD-3-Clause` for the one
  chain `rustls -> subtle`. `mica-deploy.control` drops `curl`.
- `mica-core`: `micad` and `apid` are libraries; the `micad` binary dispatches
  on the invoked name and `mica-apid` ships `/usr/bin/apid -> micad` (a thin
  `apid` bin remains for the crate's own tests and local runs and is not
  packaged). `apid --healthcheck` probes `GET /healthz` over TLS. The network
  reconciler deletes links with `networkctl delete`.
- `mica-system`: `mica-health` probes with `apid --healthcheck`;
  `mica-system.control` drops `iproute2`, `curl` and `iptables` (the lock
  removal of iptables is the user's 2026-09-13 decision recorded in
  `mica-debian` task 20260913-1748). `mica-busybox.control` names its one
  dependent.
- `mica-boards`: `hwinit-can` renders `/run/systemd/network/10-mica-can.network`
  (`[CAN]`) before `network-pre.target`; `hwinit-mac` keeps its udev-event
  design and writes through `busybox ip` (a `.link` cannot carry the derived
  address and networkd acts only after the event), so `mica-board-cx3576`
  depends on `mica-busybox` instead of `iproute2`. The bench collector reads
  through `busybox ip`, `networkctl status` and sysfs statistics.
- `mica-boot`: `initramfs.sh` takes `/input/mica-runkit` as `/init` and makes
  `exitrd/shutdown` a hard link to it.

Measured (x64 release builds from these trees):

| Artifact | Before | After |
|---|---|---|
| lifecycle executables | init 2,403,504 + shutdown 2,043,048 | mica-runkit 2,604,240 |
| initramfs cpio / zst | 4,453,376 / 1,094,275 | 2,606,592 / 963,275 |
| retained exitrd executable | 2,043,048 | 2,604,240 |
| micad + apid | 10,239,520 + 15,723,696 | 22,710,296 (+ link) |
| mica-deploy | 2,633,040 | 4,438,824 |

Verification: mica-core rust gate (full nextest, doctests, deny, openapi); mica-deploy rust gate (116 tests incl. new runkit dispatch and
transfer tests: chunked/close-delimited, redirect/error/oversize refusal,
ignored Range refusal, stall abandon, untrusted HTTPS refusal, redirect
follow with resume at the new location, and refusal of endless, unlocated,
non-http and credentialed redirects; RED shown with
curl removed) and boot-shutdown suite; mica-core multicall, apid e2e
healthcheck, network reconciler tests and clippy; mica-system health-test
80/80; mica-boards can-network-test (new), mac-stable-test 10 cases,
bench-collector-test and the full `make check`; mica-boot package test with a real mica-runkit
(RED against the previous initramfs.sh).

Pending: `mica-build` adapts only with the pin bump after these producers are
published (lifecycle input and kernel build identity `init`/`shutdown` ->
`runkit`, `component-cli --init/--shutdown`, `tools/deploy-pool.sh`,
`product-build.sh`, the lifecycle-uefi scripts, `consumers.json`, the purge
keep-list, `compose.py`'s routel exception, verify's http-client, firewall and
apid ELF checks, `m7-net-smoke.sh`); package manifest and composed root KiB
delta; x64 guest boot/shutdown/update; physical CX CAN, MAC and cold boot.
