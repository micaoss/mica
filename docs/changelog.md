# Changelog

## 2026-09-16 18:20 [spec]

Two rules from `mica-build-env`'s practice, neither of them written down
anywhere until now, are in `docs/design/release-lock.md` 2.1.

**A release and the images its lock names are one unit.** Images may be
deleted when the releases naming them go in the same operation, so nothing is
left pointing at missing bytes. The failure it prevents is silent: a published
lock that resolves to nothing looks like a working release until someone tries
to reproduce it.

**Protection is owed to any release whose images a published lock still names,
not to the release that is merely recent** — and the sentence that makes it
usable: "does anything still *build* against it" is the right question for
dropping a **pin** and the wrong one for deleting **images**. Both are
legitimate; they decide different things. `mica-build-env` asked the first,
got a clean answer, and then accepted that it had answered a different
question than the one it was about to act on.

The set is computable rather than a judgement — walk the published locks and
collect the image references — so the retention policy can be stated
objectively when it is written: an image release is prunable only if no
published lock names it and it is mirrored. Today the set is exactly build-env
`20260915-0138` and `20260916-0735`: nothing builds against `0138` any more,
but `mica-core` `20260915-1135`, `mica-system-base` `20260915-1102`,
`mica-podman` `20260915-1057` and the pre-2026-09-16 `mica-build` releases
name its images in immutable locks.

And a fact that changes what the pruning pause means: **the collector does not
protect images.** It snapshots Actions runs and jobs, not `ghcr` package
versions, so a pause lifted on its strength alone would delete images nothing
had captured. The mirror protects image history, and only for what it holds —
today `20260916-0735` and not `20260915-0138`. The condition for `0138`
becoming prunable is stated rather than open-ended: mirrored, **and** a
consumer shown to read those images from the mirror at the same digests.

## 2026-09-16 17:55 [spec]

The no-deletion rule of `docs/design/mica-index.md` section 5 gains its one
exception, named rather than left to be discovered: **withdrawal for safety**.
The rule stands for a defect in content, where superseding is the whole remedy
and the generation counter protects devices. It does not cover a release whose
artefacts are unsafe to have on a device at all — compromised signing
material, an artefact signed that should not have been, bytes that must not
remain fetchable. Removing those is a user decision that accepts a cost, and
the cost is stated when it is taken: every index referencing the release
becomes permanently unverifiable by `--full`, so the withdrawal covers those
indexes too rather than leaving them pointing at something gone, and a record
names which releases and which indexes were withdrawn and why — after the
fact, nothing in the published set can explain its own absence.

The reason for naming it rather than softening the rule: a rule with a named
exception is followed, while "never delete" against a compromised release is
either broken quietly or obeyed wrongly.

## 2026-09-16 17:40 [decision]

The separate `cx3576` re-cut was cancelled, and the defective release stays
published — both by decision. By the time a re-cut would have happened all
four producers had released, so the re-pin round re-cut every scope at the
corrected generations anyway: `cx3576.20260916-1653` **is** that release.
Nothing was deleted, because `mica.20260916-0858` references
`cx3576.20260916-0847` and its byte-identical rebuild was verified; deleting
the release would leave a published index that can never verify `--full`
again, trading a defect for a permanently unverifiable record.

The general rule is now in `docs/design/mica-index.md` section 5 rather than
only in this entry: a release an index references is not deleted, even when it
is defective, and a bad release is withdrawn by superseding it. The instance
is named there and in `docs/task/20260916-1653-root-only-archive.md`, so a
reader who finds a defective release still published learns it was a decision
rather than an oversight — and that the generation counter is what protects
devices from it.

## 2026-09-16 17:25 [finding]

Two facts from the same round that belong in the design pages rather than in a
release note.

**A remote may compute a value after acknowledging the write.** GitHub
computes a release asset's digest asynchronously, after the upload call
returns; `mica-build` read it once, got a placeholder, and concluded the lock
did not carry the asset's digest — failing an index job on a correct file. The
fix distinguishes *not yet* from *wrong*: wait for a digest to appear, and
refuse only one that differs from the file. The general shape is recorded in
`docs/design/release-artifacts.md` section 5, because it recurs outside this
API: an absent value and a wrong value are not the same finding, and code that
treats them alike reports a defect where there is none.

**The mirror's reachability is a network fact, stated where the mirror is
described.** `res.micaos.dev` is proven to serve GitHub runners and was
measured unreachable from this workstation's network on 2026-09-16 — IPv4
times out, IPv6 has no route, `www.cloudflare.com` answers in 0.14 s from the
same host. `docs/design/mica-index.md` 3.1 now says so beside the `mirrors`
member, and no page claims that a local or offline build here fetches from the
mirror. It is a routing question with the user, and `url` is unaffected, which
is exactly why `mirrors` is advice rather than a source of truth.

## 2026-09-16 17:15 [milestone]

The **root-only update archive ran for the first time**, on real releases and
on all six products at once
(`docs/task/20260916-1653-root-only-archive.md`). The rule has been in
`docs/decisions/2026-09-15-update-packages.md` since 2026-09-15 — an unchanged
kernel identity publishes a `root` archive beside `full` — and nothing had
ever exercised it.

Three predictions were written before the cut and all three held after it: the
kernel identities would hold on all four boards, because the `mica-boards`
kernels came out byte-identical under `bsp`; every product root would move,
because `mica-apid` went `0.1.0-2`; and therefore every product would emit
`full` plus `root` and no `kernel` archive. No divergence.

It applies to devices rather than to a fixture. `cx3576-dev`'s `root` archive
requires kernel `620f60e6a012`, the identity the generation-4 devices are
running, so that population can take it; and `requires.generationBelow` equals
each product's own generation, so the `cx3576` archives refuse the
generation-2 rows of the defective `cx3576.20260916-0847` without anyone
having to remember that release is bad. The counter does it.

The prediction-then-check shape is recorded with the result, because it is
what makes this a measurement: a release that happens to produce the expected
artifacts proves only that it produced them, while a prediction that survives
the cut proves the rule it came from. The device side remains unexercised on
hardware, and the record says so.

## 2026-09-16 17:09 [release]

`mica-build` published the re-pin round from `04f05227`:
`uefi-x64.20260916-1653` (trust `35317ed668ed0b7e…`),
`uefi-arm64.20260916-1653` (`e21e69c61d48b422…`) and
`cx3576.20260916-1653` (`625696f6a16f6a4d…`), and the index job cut
`mica.20260916-1709` (trust
`63e3658dc1cca0b44686e5a11820443b9fd84814cd8b510ac4c19bad824b6cb3`, previous
`mica.20260916-1703`, GitHub latest). Verified anonymously from a fresh clone:
the index rebuilt byte-identically from its previous plus the one entering
release, and `--full` rebuilt byte-identically from all three releases it
references.

**The milestone: every published product is now built entirely from released
producers, with no in-flight pin.** Six pins, each verified anonymously at pin
time and none pointing at a branch, a local build or an unreleased commit —
`mica-boards` `uefi-x64`, `uefi-arm64`, `cx3576` and `s905x5m` at
`20260916-0857`, `mica-core` `20260916-0916`, `mica-podman` `20260916-0846`,
`mica-system-base` `20260915-1102` (deliberately unchanged) and
`mica-build-env` `20260916-0735`.

The two places that said `uefi-arm64` images would come from a later round are
corrected, in `docs/user/overview.md`, `docs/user/download.md` and
`docs/user/flashing.md` with their Chinese pages; the state paragraph of the
overview now leads with the milestone instead of a list of pending things.

## 2026-09-16 12:30 [finding]

The cross-compiled arm64 investigation is closed with an answer: the
difference is **stamps and linker layout, not machine code** (`mica-core`,
with `-C metadata` forced constant). The `.text` delta of 12 096 bytes is
accounted for — 12 224 bytes of padding, alignment and linker glue, and three
missing function bodies that are three missing linker erratum stubs — leaving
128 bytes of function content in 5.07 MB, which are recorded as unattributed
rather than explained away. The hypothesis that the cross package contributes
different `crt` and `libgcc` objects was refuted by its own author: the 278
non-Rust `FUNC` symbols are the same names at the same sizes on both sides.

**The rule it produced is recorded as a rule**, in
`docs/design/build-harness.md` section 4 beside the control procedure: a byte
comparison of two Rust artifacts built with different `-C metadata` is not
evidence of a code difference. `mica-core` built that control too — two local
cross builds differing only in the metadata string — and it is noisier than
the phenomenon: twelve shared function names differing in size against five,
function counts moving, `drop_glue` duplicating differently, erratum stubs
moving. Cross versus native sits below that noise floor. Hold the
disambiguator constant before diffing Rust; where that is impossible, the only
honest statement is that the difference is below the noise floor.

The bound is **provisional**: running `mica-core`'s container on the target
platform would close it — the configuration `mica-podman` measured reproducing
with Rust — and it is deferred because it costs seven version bumps and
changes no shipped byte. A configuration not yet paid for, with the price
named, not a limitation of the design.

No follow-up record for the 128 bytes, deliberately: they cannot be attributed
while the disambiguator perturbs every symbol, and pinning it costs the same
seven bumps as the real fix while answering less. Recorded as closed so nobody
reopens it thinking it was forgotten. And the closing fact, which is the one
that matters for trust: nothing about these packages is unstable — the native
build reproduced itself exactly across a build-env move, twelve of twelve
reused at their published sha256, including the arm64 hashes a local cross
build cannot produce. The local toolchain path simply is not the published one.

## 2026-09-16 12:05 [spec]

`mica/index/v1` gains an optional `mirrors` member on every `images` and
`updates` entry (`mica-res`' proposal, accepted as the spec's owner with three
additions; `docs/design/mica-index.md` 3.1, the sort-order paragraph and
section 5).

What it is: an array of absolute `https` URLs emitted immediately after `url`
and omitted entirely when absent. A reader may try them in order and fall back
to `url`, and a mirror that does not answer is the next URL rather than an
error. `url` keeps its meaning as the release's own URL, and `sha256` and
`size` stay the only proof — **a mirror is a source, never a trust anchor** —
so a pruned mirror costs a reader nothing the release still has. The entries
are derived, never looked up: `<base>/d/mica/<scope>/<stamp>/<file>`. The
member is unsorted, which the sort-order paragraph now states as an explicit
exception, because every other list in that document is sorted and the next
reader would sort a preference list whose order is its content.

Three additions of mine, each protecting the property that made the proposal
acceptable in the first place — the index must rebuild identically from a
clean checkout:

- the base is a **committed value in `mica-build`**, not an environment
  variable; an emitter with no committed base omits the member. A member that
  depended on a runner's configuration would make the rebuild environment-
  dependent, which is the thing this index is not allowed to become.
- `verify-index` **re-derives every entry** and refuses one it cannot
  re-derive. Without it, `mirrors` would be the one part of the index an
  emitter could put anything into and still verify.
- an entry equal to `url` is refused as well as a duplicate: it is not a
  mirror, it is the source the reader already has.

No transition: published indexes have no `mirrors` member and nothing rewrites
them; it appears from the first index that emits it. `mica-build` implements
the emitter and the re-derivation when it is dispatched — not in this change,
and not in its name.

## 2026-09-16 11:40 [finding]

Two more measurements close the arm64 byte question, and one of them corrects
a claim in the 11:05 entry.

**Rust under emulation reproduces.** `mica-podman` builds `netavark` and
`aardvark-dns` with `cargo build --release` in a container run on the *target*
platform, so it is emulated on the amd64 station and native in CI; its
emulated arm64 package is byte-identical to the natively built archive of
release `20260916-0846`, sha256
`b7f23a277a4d3204b6d1551fe0bad5bca8d2aee5c31f413a2d5a977324606de3`. That is
its third independent measurement on three trees. The accurate statement is
therefore simpler than any version so far: **nothing measured here says
emulation changes bytes** — not for C, make, meson, ninja or data packaging,
and not for Rust. What changes bytes is a local build that is not the same
build as the CI one, which for `mica-core` means cross-compiled against
native. The caveat does not bind `mica-podman`, which verified from its own
scripts that every compiling stage runs on the target platform, so its local
arm64 build validates its arm64 half and its `make offline` produces the
published arm64 bytes.

**The question is answered per artifact, not per repository.** `mica-boards`
answered it on paper for three artifacts and got three different answers in
one tree: its pools run on the target platform (and a locally emulated arm64
pool rebuild matched the CI-published `cx3576` packages byte for byte, a
fourth measurement of emulation not changing bytes); its kernels are
cross-built locally while CI builds every one of them natively, which is
`mica-core`'s position; and its U-Boots are cross-built on amd64 in both
places, pinned there because the assembly runs the FIT host tools on x86-64,
which is nothing to compare. Its method is recorded with it: compare OCI layer
bytes, not manifest digests, which move with the release string and would have
reported four boards of noise.

Both are in `docs/design/build-harness.md` section 4, with the per-artifact
rule stated where a reader will bring the wrong question, and in
`docs/design/release-lock.md` section 5, `docs/design/build.md` and
`docs/user/build.md` with its Chinese page. The reachability claim, the
control procedure and the sentence that a real local difference stays visible
are unchanged.

**The `bsp` toolchain switch is measured and holds** (same report): every
kernel on all four boards including both vendor trees, the `cx3576` U-Boot,
all board and firmware components and three of four pools rebuilt
byte-identically under the digest-pinned `bsp` image — the Ubuntu snapshot pin
removed from `mica-boards` produced the same bytes the `bsp` image now
produces. The two exceptions are the `s905x5m` U-Boot vendor signing
non-determinism, pre-existing and recorded there, and one package deliberately
bumped. `docs/decisions/2026-09-16-toolchains-live-in-build-env.md` carries it
in place of the pause note.

## 2026-09-16 11:05 [finding]

The mechanism behind the arm64 byte difference is corrected, by the repository
that reported it, with evidence: **it is not emulation, it is
cross-compilation**. `mica-core` does not emulate arm64 at all. It runs its
rust container on the host platform and cross-compiles with
`--target aarch64-unknown-linux-gnu`, while its CI arm64 job runs on an arm64
runner where the same command is a native build — two different builds, not
one build run two ways. The proof is in the artefact: the local binary carries
an ELF note `.note.package` naming `cross-toolchain-base`, architecture
`amd64`, which the released binary does not carry, and the Rust crate
disambiguators differ because the `rustc` host triple feeds `-C metadata`. The
compiler version is the same in both.

So the question a reader applies is not "does my build emulate" but **is my
local build the same build as the CI one**. A container that runs on the
target platform differs from CI only by emulation, and that reproduces —
measured twice, `mica-system-base`'s eight archives and `mica-podman`'s
offline build, with podman's re-check against the natively published
`20260916-0846` archive still pending. A container that runs on the host with
a cross toolchain, against a CI that builds natively, is a different build and
differs. A container that cross-builds in both places is the same build and
has nothing to compare.

This supersedes the 09:00 and 10:10 entries at the mechanism; both are kept,
because the sequence is the point: broadcast from one repository, contradicted
by two controls, reframed, then corrected at the cause by its own author inside
a day. Nothing measured anywhere says emulation changes bytes, and the earlier
entries said it did.

Corrected in `docs/design/release-lock.md` section 5,
`docs/design/build.md`, `docs/design/build-harness.md` section 4 and
`docs/user/build.md` with its Chinese page. Unchanged, because they were right:
CI is the authority for an architecture's half, a local difference is not
evidence until the control has been run, nothing is bumped on one, and the
control procedure itself — which produced both refinements. The bound for
`mica-core` is stated where it matters: a local arm64 archive built on an
amd64 station is a valid archive and is not the published one.

## 2026-09-16 10:10 [finding]

The emulation finding of 09:00 is narrower than it was first stated, and two
independent controls say so. `mica-system-base` on build-env `20260916-0735`
reproduced all eight of its archives byte-identically to `20260915-1102` on
both architectures — in CI over natively built artefacts and locally on the
amd64 station with arm64 under QEMU — for BusyBox and systemd-boot (C, make,
meson, ninja) and two data packages. `mica-podman` compared a local emulated
`make offline` at `09ccebe` against the CI artefacts of the same commit and
found both architectures identical across the `.deb`, `Packages` and
`SHA256SUMS`; its re-check against the natively published arm64 archive of
`20260916-0846` is pending, so that one is a strong prior rather than settled.

So the correct statement is not "emulated arm64 does not reproduce native
arm64". On this station emulation reproduces for C, make, meson, ninja and
data packaging, and does not reproduce for `mica-core`'s Rust pool, six
packages of six. Something in that build is sensitive to the emulated
environment; the investigation is
`docs/task/20260916-0900-emulated-arm64-bytes.md`, now assigned to `mica-core`
at P2, since it is the only repository showing the difference and has both
halves measured on one machine.

What does not change: a local arm64 rebuild is not authoritative for an arm64
half, CI is, and a difference between a local build and a release is not
evidence of a change until the control has been run — the control that
produced this refinement, unchanged in `docs/design/build-harness.md` section
4. `docs/design/release-lock.md` section 5, `docs/design/build.md` and
`docs/user/build.md` with its Chinese page now name which repositories are
measured on which side, so no reader takes this as a workspace-wide property.

## 2026-09-16 09:00 [finding]

Emulated arm64 does not reproduce natively built arm64 bytes, which bounds
what a local build and an offline build can prove (`mica-core`, 2026-09-16).
Answering the build-env byte-identity question on `20260916-0735`, its amd64
pool reproduced release `20260915-1135` six of six while its arm64 pool
differed six of six — not the shape a toolchain change makes, so it ran the
control: the same station, the previous lock `20260915-0138`, and got exactly
the same arm64 bytes, all six still unlike the published ones. The cause is
that `docker buildx build --platform linux/arm64` on an amd64 station runs the
arm64 build under emulation, while the published arm64 archives were built
natively on `ubuntu-24.04-arm`. It predates the build-env move and is a
property of the station.

Consequences, now recorded: a local version or reuse guard validates the amd64
half only, and CI is the only answer for arm64, because its gate runs the guard
over natively built artefacts; `mica-boards` and `mica-system-base` are in the
same position by construction, and `mica-podman` should check its engine
build. **A local arm64 difference is not a reason to bump a version** — run
the control first, and two locks giving the same bytes that both differ from
the release is emulation, not a change. For offline: an offline build on an
amd64 station produces a working arm64 root, not the published bytes.

Stated in `docs/design/release-lock.md` section 5, `docs/design/build.md`,
`docs/design/build-harness.md` section 4 and `docs/user/build.md` with its
Chinese page. What actually differs inside an archive is unidentified and is
`docs/task/20260916-0900-emulated-arm64-bytes.md`, deferred until after the
current round.

## 2026-09-16 08:30 [decision]

The pause is lifted (user, 2026-09-16), with an order, because the held work
now depends on itself: `mica-build` goes first and everything else's first
step waits on it — the scoped releases for `uefi-x64`, `uefi-arm64` and
`cx3576`, with `MICA_RELEASE_GENERATIONS` for `cx3576` only (`cx3576-dev` 5,
`cx3576-prod` 4; the renamed products start at 2), then the index job's first
`mica.<stamp>`. After it: `mica-boards` cuts its four board releases, the
first carrying the `bsp` toolchain, which is where the open question is
answered — whether the kernels, U-Boots and components come out byte-identical
to what `20260916-0744` and `20260916-0558` published — and then its i386
packer round; in parallel `mica-podman` cuts `5.8.6-2` with its pinned build
closure, `mica-core` moves to build-env `20260916-0735` and cuts
`mica-apid` `0.1.0-2`, and `mica-system-base` moves and reports whether its
four packages still rebuild byte-identically. `mica-boards` then adds the
fetch-time mirror hook, which tries `<mirror>/blob/<sha256[0:2]>/<sha256>`
before a row's URL and falls back on 404 without ever rewriting a lock URL,
since the URL is in the inputs hash. `mica-res` starts phase 2 once the index
exists. `mica-build` closes the round by re-pinning each producer as its
release lands.

Still in force, and not lifted: nothing is pruned in any `ghcr` package and no
workflow run is deleted anywhere until the collector's snapshots are in the
bucket and a retention policy is agreed; `mica-build-env` `20260915-0138`
stays alive until every consumer has moved off it.

## 2026-09-16 08:10 [decision]

Work that is not the cache and mirror design is paused (user, 2026-09-16), so
that everything else lands in one consolidated round once those details are
settled. `mica-build` finishes the round it is holding — the four board pins
(`uefi-x64` and `uefi-arm64` at `20260916-0744`, `cx3576` and `s905x5m` at
`20260916-0558`), the build-env pin to `20260916-0735`, the product renames,
the deleted minimal products and the `PUBLISH` removal — cuts its scoped
releases, lets the index job run, and stops there; stopping earlier would have
left the workspace with the boards renamed and the assembly still pinning the
old names. `mica-boards` holds the `bsp` switch and the i386 packer round,
`mica-podman` holds its pinned build closure, the engine stages and
`5.8.6-2`, and `mica-core`, `mica-system-base` and `mica-build-env` start
nothing. `mica-res` continues, because it is the cache and mirror design.

Also decided, for every repository: **Actions run pruning is paused.** No
workflow run is deleted anywhere until a collector keeps the history and a
retention policy is agreed. `mica` has no step that deletes runs — its
workflows are `ci` (the `docs` job) and `website` (`checks`, and `deploy`
only on a manual dispatch) — so nothing here changes in practice.

## 2026-09-16 07:44 [release]

`mica-boards` released the renamed boards from `main` `65c25c8`:
`uefi-x64.20260916-0744` (`SHA256SUMS` sha256
`10165c9721237b2a8e8e06a0fa82da05f95f1e8cbd2a53053b424684aecf12ca`) and
`uefi-arm64.20260916-0744`
(`4ed5a94eef767b65dfb1235c629a6d2f1d7350da29b5c7db84f34a795cef230b`), both
verified anonymously, with `cx3576.20260916-0558` and `s905x5m.20260916-0558`
unchanged beside them. The board packages are new names with fresh versions,
`mica-board-uefi-x64` and `mica-board-uefi-arm64` at `0.1.0-1`, not bumps, and
every identity carried over: the partition GUIDs, the filesystem UUIDs and the
ESP volume id are the values the old boards had.

`uefi-arm64` is now a release target and carries the generic driver set, as
fact rather than proposal. Built in, because a dm-verity root has no initramfs
and nothing can load before it is mounted: EFI and its stub, `EFIVAR_FS`,
ACPI, DMI, PCI with `PCI_HOST_GENERIC` and `PCIEPORTBUS`, `EFI_PARTITION`, the
PL011 UART and its console, RTC through PL031 and EFI; storage as virtio,
SCSI, AHCI, NVMe and USB mass storage over xHCI and EHCI; HID and evdev.
Networking is carried **as modules** — the Intel, Realtek, Broadcom, Mellanox
and Aquantia drivers with the common PHYs — because it is not on the path to
the root and loads from the signed support image. SD and eMMC are deliberately
absent: a machine that boots from a platform MMC controller is a hardware
board of its own, not this image, which is the line between the two board
classes. The set is enforced by `kernel/config/uefi-arm64.required`, 122
symbols the kernel configuration test holds. Cost: 1568 built-in and 240
module symbols where there were 1319 and 75, 232 modules instead of 71, a
24.5 MB `Image`, and a CI kernel job of 718 s where it was 330 s.

The qualification did not move: QEMU `virt` only, exactly as `uefi-x64`
claims, and `evidence.json` says so. The dossier, the board status table, the
flashing guide, the download and install pages and the overview all state the
new status and, in the same breath, that carrying a driver is not evidence
that a machine boots.

## 2026-09-16 07:35 [release]

`mica-build-env` `20260916-0735` at `bf347e2` (`SHA256SUMS` sha256
`7df0af68761a63c6517b37a739a57ce947da53fbe558aba2646368e53724bf0a`) adds
`bsp`, the fifth build-env image: Ubuntu 24.04 with gcc 13.3, the aarch64
cross toolchain on amd64, and the kernel, U-Boot and packer dependencies of
`mica-boards` (the union of its lists, without `python3-pip`). The Ubuntu
archive snapshot moves here as the `ubuntu-<suite>` rows of
`locks/upstream.lock`, read only while `bsp` is built (`bsp/apt-install.sh`
checks each signed `InRelease` against its pinned sha256), so no consumer
build reaches an archive; this removes the failure that the
`snapshot.ubuntu.com` outage of 2026-09-16 caused in `mica-boards`. Compressed
in the package: `bsp` 516 MB of 2912 MB for the five images. The same release
fixes 24 early-exiting pipe consumers under `pipefail` (`lib/common.sh` line 1)
and makes the tests refuse that shape. `mica-boards` pins the image by digest
and drops `apt-install.sh`, `tools/apt-snapshot.sh` and its `ubuntu-<suite>`
rows.

It is a breaking update for every consumer — every image moved, because the
pipefail fix touched inputs shared by `base`, `c`, `go` and `rust`. Consumers
move in sequence: `mica-boards` with its `uefi` rename round, `mica-podman`
before it resolves its pinned build closure, then `mica-core`,
`mica-system-base` and `mica-build`. Both `20260915-0138` and `20260916-0735`
exist in the package until the consumers have moved. The direction is recorded
as `docs/decisions/2026-09-16-toolchains-live-in-build-env.md`: with
`mica-podman`'s pinned build closure, this removes the last consumer-time
`apt` from the workspace.

## 2026-09-16 02:40 [progress]

A shell lint, after `mica-podman` reported the wider shape of the pipefail
defect this repository hit this morning (its `6c63a7a`, three `| head -n1`
readers; ours was `printf | grep -qxF` in `verify-release-lock.sh`, fixed by
`3fd60fa`). `tools/docs/shell-lint.sh` holds every script under `tools/` to
two rules: it sets `set -euo pipefail`, and it has no early-exiting reader on
the right of a pipe (`head`, `grep -q`, `grep -m`, `sed -n <n>q`, `read`),
because such a reader lets the still-writing producer die of SIGPIPE and the
pipeline then fails on good input. `shell-lint-test.sh` proves each refusal
and that a quoted example is not a finding; both run in `make docs-verify-test`.
The audit found nothing left to fix: 15 scripts, 30/30, the only earlier
instance being the one already repaired this morning.

## 2026-09-16 02:10 [decision]

`PUBLISH` goes with the minimal products (coordinator, accepting `mica-build`'s
proposal, 2026-09-16). It appeared only on the four minimal products, nothing
else set it, and `s905x5m-dev` is unpublished through its board's
`BOARD_RELEASE_TARGET=0`, so the key, its default in `tools/product.sh`, the
release scope filter and their tests are dead machinery and `mica-build`
removes them in the rename round. Its one consumer was the index catalogue's
`publish` field: `docs/design/mica-index.md` 3.1 now fixes that a catalogue
product's `publish` is true when its board is a release target, which
reproduces today's output exactly — `s905x5m-dev` stays `publish` and `indexed`
false, every `uefi-x64`, `uefi-arm64` and `cx3576` product is published — and
leaves one mechanism instead of two. Keeping `PUBLISH` as a documented key no
product sets was rejected. The version-index decision follows, and the minimal
decision records the question as settled.

## 2026-09-16 01:40 [decision]

The naming rules are written down so a new variant is a lookup rather than a
discussion (user, 2026-09-16):
`docs/decisions/2026-09-16-board-and-product-naming.md`, with the normative
text in `docs/boards/contract.md` 1.1. Two classes of board — generic systems
named by firmware class and architecture (`uefi-x64`, `uefi-arm64`), hardware
boards named by their hardware (`cx3576`, `s905x5m`). What a variant is
follows from what it changes: kernel, loader or layout make a new board (a
slim virtio-only guest kernel would be `qemu-x64`, not a product), the root
composition makes a product, the downloaded file format is an image kind in
`images.tsv`. A board is `[a-z0-9][a-z0-9-]*` with no dot, which is what lets
`<board>.<stamp>` be parsed; a product is `<board>-<variant>`; a board package
is `mica-board-<board>`; a platform-specific guest board is `<platform>-<arch>`.
The tag, OCI and asset forms follow, and the product set is the seven names
left after the minimal removal. `docs/design/release-lock.md` 1.0,
`docs/user/overview.md` and `docs/user/releasing.md` point at the rules, with
the Chinese pages. Names published before today stay as they were published.

## 2026-09-16 01:20 [decision]

The minimal products are removed on every board (user, 2026-09-16:
"不需要minimal这个，所有的都不发布这个"), which supersedes
`docs/decisions/2026-09-15-minimal-products-not-released.md` and returns to
removal: `docs/decisions/2026-09-16-minimal-products-removed.md`. The product
set becomes `uefi-x64-dev`, `uefi-x64-prod`, `uefi-arm64-dev`,
`uefi-arm64-prod`, `cx3576-dev`, `cx3576-prod` and `s905x5m-dev`; no
`uefi-x64-minimal` or `uefi-arm64-minimal` is created in the rename. Every
rule, test, fixture and CI entry that required a minimal product goes with
them, and `PUBLISH` goes too if nothing else uses it — `s905x5m-dev` is
unpublished through `BOARD_RELEASE_TARGET`, so `mica-build` reports whether
`PUBLISH=0` still has a user. The coverage minimal gave, that the floor
composes with no feature selected, stays as a composition test. The guides,
the build design, the release-artifacts page and `boards/porting.md` (whose
exit criteria now use the `dev` product) follow, with their Chinese versions;
releases published before today keep their minimal assets as history.

## 2026-09-16 00:45 [decision]

The generic systems are named by their firmware class: `x64` becomes
`uefi-x64` and `virt-arm64` becomes `uefi-arm64`; the hardware boards keep
their names (user, 2026-09-16,
`docs/decisions/2026-09-16-generic-systems-named-by-firmware.md`,
`docs/task/20260916-0040-uefi-board-names.md`). The rename is folded into the
dot tag cut-over, so `mica-boards` cuts `uefi-x64.<stamp>`,
`uefi-arm64.<stamp>`, `cx3576.<stamp>` and `s905x5m.<stamp>` in one cycle and
`mica-build` renames its products, re-pins and cuts its scoped releases with
the final names. Board directories, packages, pins, scopes and image file
names follow; every identity (partition GUIDs, ESP volume ids, disk GUIDs)
stays, so these are the same boards under new names. `uefi-arm64` also becomes
the generic UEFI/ACPI arm64 system and a release target with a driver set
beyond virtio, which `mica-boards` proposes and has not implemented yet. The
renamed products are new products and start at generation 2. Tags, products
and image files published before today keep their old names as history.

## 2026-09-16 00:20 [decision]

Scoped release tags separate the scope with a dot: `x64.20260915-2230` instead
of `x64/20260915-2230`, `mica.20260915-2242` instead of `mica/20260915-2242`
(user, 2026-09-16, `docs/decisions/2026-09-16-scoped-tags-use-a-dot.md`). A
scope is `[a-z0-9][a-z0-9-]*` and a stamp carries no dot, so everything before
the first dot is the scope; the form matches the OCI tags already in use and
removes the git ref-directory limit that kept a tag named exactly `x64` from
existing beside `x64/...`. `docs/design/release-lock.md` states the form in
1.0, the release row of 1.2, 1.2.2, 1.2.3, the `release-scope` rule and the
offline `<scope>.offline` lock; the reference checker splits the release row on
the last dot, so a slash is refused as `field-value`, proven by the new vector
`lock/refused/release-slash.lock` (156/156). `docs/design/mica-index.md` moves
the asset URL to `.../download/<scope>.<stamp>/<file>` and fixes that the
`inputs[].id` keeps its slash, `<built name>/<release>`, because it joins a
name to a release rather than naming a git tag. The decisions and user pages
that quote tag forms follow; releases published before today keep their slash
tags and are not rewritten. There is no compatibility form: nothing reads the
old form after this change.

## 2026-09-15 23:16 [progress]

`mica-build` `19e7c9ce` fixes the index plan's generation edge case: a product
that is in neither the newest index nor a later scoped release is looked up
across every earlier release and planned one generation above the highest it
was ever released at, with the full scan built once per plan and only when
such a product exists; a product never released still plans generation 2
(`release-test` 48/48). Until the next index is cut, the CI re-verification of
`mica/20260915-2242` runs the tools of its own commit and therefore without
the later download retries.

## 2026-09-15 22:52 [progress]

The first Mica version indexes are published and verified anonymously.
`mica-build` cut the scoped releases `x64/20260915-2230` and
`cx3576/20260915-2230` (`9c2f399e`, not latest), in which every product ships
`full`, `root` and `kernel` update archives because both component identities
held across commits: the first `root` archives. The `x64` index job then built
`mica/20260915-2240` in full, and the `cx3576` job cut `mica/20260915-2242`
(the GitHub latest) incrementally from it, with a 12.7 KB `mica-index.json`
over six shared inputs and a catalogue of four boards and ten products. Both
re-verify byte-identically, incrementally and in full, from a fresh clone,
and every asset URL answers with its recorded size.

## 2026-09-15 22:20 [progress]

`docs/design/mica-index.md` now states exactly the `mica-index.json` shape
that `mica-build` `9c2f399e` emits: a `previous` member naming the index it was
cut from, one shared `inputs` table keyed `<built name>/<release>` (one id
with two trust hashes refused), fixed sort orders, asset URLs under their
scoped release, boolean `releaseTarget`, `publish` and `indexed`, and a
reserved, not emitted per-board shard member with a proposed 1 MiB threshold.
It also records incremental generation from the newest `mica/*` tag (no cut
when nothing enters or drops) and the `verify-index` incremental and `--full`
modes that `ci.yml` runs. The version-index decision follows.

## 2026-09-15 22:02 [decision]

The Mica version index is amended for scale (user): a new index is the
previous `mica/*` index, checked against its `SHA256SUMS`, plus the scoped
release just published, and only entering or replacing entries get the full
cross-release checks, while `mica-build`'s CI re-verifies the newest index in
full on every push to `main`. `mica-index.json` gains one shared inputs table
referenced by id, reserves per-board sharding, and makes the catalogue's
`publish` and `releaseTarget` booleans; products no longer published move to
the catalogue only. The index job is implemented on `mica-build` `da1d36a1`
(CI dry run green); no `mica/*` release is cut yet.
`docs/design/mica-index.md`, `docs/decisions/2026-09-15-mica-version-index.md`.

## 2026-09-15 21:11 [decision]

The Mica version index release (user, "同意"): after every fully successful
scoped release, `mica-build`'s `release.yml` cuts `mica/<YYYYMMDD-HHMM>`
automatically, naming the newest scoped release of every published product;
it is the GitHub latest release, scoped releases are not, and manual
`mica/*` releases are refused. Its lock uses the scope `mica` with `input`
rows for the referenced releases, new `origin`, `built` and `index` rows,
and the indexed products' `product`, `bundle` and `asset` rows copied byte for
byte; its assets are that lock, `mica-index.json` (`mica/index/v1`, the whole
state for an external reader) and `SHA256SUMS`. The release-lock spec (1.2.3),
the checker and 8 vectors add the rules `index-scope`, `index-only-inputs`,
`index-input`, `index-product-source` and `index-built-form` (154 checks).
`docs/decisions/2026-09-15-mica-version-index.md`, `docs/design/mica-index.md`.

## 2026-09-15 20:58 [progress]

The second `mica-build` scoped releases, `x64/20260915-2042` and
`cx3576/20260915-2042` at `a1f13280`, are published and verified anonymously
on boards `<board>/20260915-1926`, core `20260915-1135`, Base `20260915-1102`,
podman `20260915-1057` and build-env `20260915-0138`. They carry the dev and
prod products, every disk image as a verified `.img.gz` (about 83 MB and 86
MB) and no raw image. They also carry the first `kernel` update archives:
`x64-dev` and `cx3576-dev` moved to generation 3 with unchanged rootfs
identities and new kernels, so each publishes `full` plus a 16 MB `kernel`
archive, while the new prod products publish `full` only. No `root` archive
is published where the kernel changed.

## 2026-09-15 20:43 [progress]

`mica-build` `a1f13280` (ci run 35019880080 green) pins `mica-boards`
`<board>/20260915-1926`; its `virt-arm64` acceptance passed on the trimmed
kernel (smoke, verify, negatives, repart and `lifecycle-uefi` with quotas,
podman, updates, the 9p import and faults; `os-netavark-kernel-test`
121/121), and ACPI stays. The coordinator then deleted the superseded
`mica-boards` `<board>/20260915-1128` releases and tags and the 7 ghcr
versions no `1926` lock references, leaving exactly the 16 digests of the
`1926` locks. The board inputs recorded by `x64/20260915-1458` and
`cx3576/20260915-1515` are therefore no longer downloadable; their own assets
and bundles are unaffected.

## 2026-09-15 20:32 [progress]

`mica-boards` `94e1dc4` enables CI reuse of unchanged kernel and U-Boot
components: its build plan skips a component whose `mica.inputs` equals the
latest published board release's, fails on an unreadable listing, lock or
manifest, and forces a full build when the build files outside the inputs
hash change or when there is no base to compare with. A push touching no
component input fell from 65.5 to 4.3 runner-minutes (17.4 to 2.7 minutes
wall); one changed `x64` kernel input takes 26.7. Pool jobs, the version guard
and package gates still run every time. Steps (1), (2), (3) and (5) of
`docs/decisions/2026-09-15-board-kernel-builds.md` are done.

## 2026-09-15 19:50 [progress]

`mica-boards` `<board>/20260915-1926` at `12564a3` are released and verified
anonymously: FIT kernels compiled once with prod relinked and proven
byte-identical, kernel and U-Boot builders pinned to the Ubuntu snapshot
`20260915T000000Z` through `locks/upstream.lock`, `virt-arm64` trimmed to 71
modules (from 1273) against `mica-build`'s 83 required symbols, and a
reproducible `s905x5m` kernel. Board build times fell from 1132 to 628 s on
`cx3576`, 1732 to 944 s on `s905x5m` and 1123 to 330 s on `virt-arm64`.
Kernels and U-Boots are new; board, firmware and pools are reused, except
four `s905x5m` packages at `0.1.0-2`. The kernel-build decision's steps (1),
(5) and the `virt-arm64` trim are done; CI reuse (2) is next. `mica-build`
re-pins, then cuts `x64` and `cx3576` with dev and prod products.

## 2026-09-15 19:34 [decision]

The form of the OCI image layer is decided (user, "a"): the image bundle
layer is the same `.gz` file as the GitHub Release asset, annotated
`mica.compression=gzip`, `mica.uncompressed-sha256` and
`mica.uncompressed-size`, with the asset sha256 equal to the layer digest, as
`docs/design/release-lock.md` section 2 already states. The hold on releases
is lifted; `mica-build`'s next scoped releases wait only for the
`mica-boards` kernel rebuild release and the re-pin.
`docs/decisions/2026-09-15-release-images-and-products.md`.

## 2026-09-15 19:31 [progress]

`mica-build` `669b607` (ci run 35012585951 green) implements the prod products,
the never-released minimal products and the compressed images. It has ten
products: `<board>-dev` and `<board>-minimal` for the four boards plus
`x64-prod` and `cx3576-prod` (dev features, `PROFILE=prod`, development keys
and channel). The minimal products declare `product.env` `PUBLISH=0`, which
`release.sh plan` skips, refusing a scope holding only them; CI rehearses the
release path on the prod products. Every image kind is gzipped twice with
`gzip -n -9`, compared, and verified against the raw image before upload
(`x64-prod` 1.88 GB to 83 MB in 41 s, `cx3576-prod` 1.36 GB to 86 MB in 24 s).
No release is cut until the user confirms the form of the OCI image layer.

## 2026-09-15 18:51 [decision]

No manually triggered release workflow (user): there is no `cut-release.yml`,
and releases stay `gh release create` only. The release-lock reader keeps the
`mica-<product>-<release>.` prefix rule for asset files and does not require
`.gz`, so the published `x64/20260915-1458` and `cx3576/20260915-1515` locks
with raw `.img` assets stay readable; the form of the OCI image layer is being
reconsidered and section 2 of the spec waits for it.

## 2026-09-15 18:50 [decision]

`mica-build`'s compressed-image form B is accepted within the gzip decision:
every image kind is published as `mica-<product>-<release>.<suffix>.gz`, made
by `gzip -n -9` in the pinned `mica-build-env:base`, compressed twice and
compared, and decompressed against the raw signed image's sha256 and size
before any upload; no raw image is uploaded; the 2 GiB limit applies to the
`.gz`; the image layer carries `mica.compression=gzip`,
`mica.uncompressed-sha256` and `mica.uncompressed-size`; update kinds stay
uncompressed; the lock rows are unchanged. `docs/design/release-lock.md`
1.2.2 and section 2 (the valid `mica-build` vector names `.img.gz` assets),
the release-images-and-products, scoped-release and packer decisions,
`docs/design/release-artifacts.md`, `docs/boards/contract.md`.

## 2026-09-15 18:48 [progress]

The stable root and kernel component identities are implemented. `mica-build`
`7d18da6` (ci run 35008433331 green) names the kernel packager by the tools
image label `mica.boot.inputs` over its pinned inputs (K1), runs `ukify` and
`sbsign` under `faketime` frozen at `SOURCE_DATE_EPOCH` so two signings are
byte-identical (K2), and refuses at release a kernel with the previous
`buildId` but another identity. Builds at two commits and after rebuilt tool
images give identical ids, and the rootfs ids equal those published in
`x64/20260915-1458` and `cx3576/20260915-1515`; R1 and R2 were already in
`mica-core` `20260915-1135` and `mica-build` `fe3ad07`. From the next scoped
releases, `root`-only and `kernel`-only update archives are published when
only the other component changed.

## 2026-09-15 18:01 [decision]

User correction, replacing the removal of the minimal products ("按推荐处理，minimal只是本地编译和ci用，不发布"):
the `<board>-minimal` products stay for local builds and CI, with their
gates, negatives and floor coverage, and are never released. A scoped release
builds and publishes only `<board>-dev` and `<board>-prod`, excluding minimal
products by a declared product property (such as `RELEASE=0`) and refusing a
scope with only unpublished products. `x64/20260915-1458` and
`cx3576/20260915-1515` stay as they are.
`docs/decisions/2026-09-15-minimal-products-not-released.md` supersedes
`2026-09-15-no-minimal-products`; `docs/design/build.md`,
`docs/design/release-artifacts.md` and `docs/boards/porting.md` name the
minimal products again.

## 2026-09-15 18:00 [decision]

The minimal products are removed entirely (user, "删除这个构建"):
`x64-minimal`, `virt-arm64-minimal`, `cx3576-minimal` and `s905x5m-minimal`
go, with every rule, test, fixture and CI entry that requires a
`<board>-minimal` product. The products are `<board>-dev` for all four boards
plus `x64-prod` and `cx3576-prod`; CI runs the release path for the prod
products; the featureless floor is kept as a composition test, not a hidden
product. The published `x64/20260915-1458` and `cx3576/20260915-1515` keep
their minimal assets as history. `docs/decisions/2026-09-15-no-minimal-products.md`,
`docs/design/build.md`, `docs/design/release-artifacts.md`,
`docs/boards/porting.md`.

## 2026-09-15 17:55 [progress]

Plan `20260912-2043-unify-board-behavior` section 3 (zstd delivery) is marked
superseded by `docs/decisions/2026-09-15-release-images-and-products.md`: the
disk image is published as `.img.gz`, and update archives stay uncompressed
`.micaupd`.

## 2026-09-15 17:54 [decision]

User correction to the compressed images: a `mica-build` GitHub Release
never carries the raw `.img`; it carries `mica-<product>-<release>.img.gz`,
gzip replacing zstd. The OCI image layer is the same file, so the `asset`
sha256 still equals the layer digest. The gzip is deterministic (no name or
timestamp, a fixed level, the compressor from a pinned build-env image, two
compressions byte-identical) and is decompressed and compared with the raw
signed image before publishing; the raw image is still built, gated and
verified, and `mica-build` proposes how its sha256 and size are recorded.
`mica-build` implements it after K1 and K2.
`docs/decisions/2026-09-15-release-images-and-products.md`.

## 2026-09-15 17:53 [decision]

User decisions after the first scoped releases. `mica-boards` kernel builds:
FIT boards build prod incrementally after dev (proven byte-identical by a
kept test) with pinned kernel and U-Boot toolchains, followed by one release
of all four boards; CI reuses unchanged kernel and U-Boot components only
after that; `mica-build` evaluates a `virt-arm64` config trim first; no
ccache. Releases and products: `s905x5m` stays out of the release targets;
`mica-build` publishes the disk image as a deterministic
`mica-<product>-<release>.img.zst`, verified against the raw signed image,
which is still built and gated; `x64-prod` and `cx3576-prod` are added with
`PROFILE=prod`, development keys and the development channel.
`docs/decisions/2026-09-15-board-kernel-builds.md`,
`docs/decisions/2026-09-15-release-images-and-products.md`.

## 2026-09-15 15:32 [progress]

`mica-build` `cx3576/20260915-1515` at `9fe2d18` is published and verified
anonymously (trust hash
`01c261093177a07c576aa8dcbdac4943149770a693886f51467d9c7e665b828e`):
`cx3576-dev` and `cx3576-minimal` at generation 2 on boards
`cx3576/20260915-1128` and the same build-env, core, podman and Base releases
as `x64/20260915-1458`, each with a disk image and a `full` update archive.
Both release-target boards are released; `virt-arm64` and `s905x5m` are not
release targets (`s905x5m` pending a user decision), and every product is
`PROFILE=dev` until the user decides on a prod product. Next in `mica-build`:
the kernel `buildId` and deterministic signing (K1, K2).

## 2026-09-15 15:17 [progress]

The first `mica-build` scoped release, `x64/20260915-1458` at `9fe2d18`, is
published and verified anonymously (trust hash
`97126a89da28280433b0e6efdf87c004a15aad7ea5cdcbf2f155530a098910aa`): products
`x64-dev` and `x64-minimal` at generation 2, built on boards
`x64/20260915-1128`, build-env `20260915-0138`, core `20260915-1135`, podman
`20260915-1057` and Base `20260915-1102`, published as the `image` and
`update` bundles in `ghcr.io/micaoss/mica-build` and as release assets (a
disk image and a `full` update archive per product). Three failed earlier
cuts without assets were deleted with their tags; CI now runs the same
reusable release-product workflow as the release. Next is the `cx3576` scope.

## 2026-09-15 12:44 [progress]

Clean-up batch 2: after `mica-build` `fe3ad07` pinned `mica-core`
`20260915-1135` (with Base `20260915-1102`, podman `20260915-1057` and boards
`<board>/20260915-1128`), the coordinator deleted `mica-core` `20260915-0728`
and `20260915-0235` with their tags and pruned `ghcr.io/micaoss/mica-core` to
the two pool digests of the `1135` lock, readable anonymously. The clean-up
of the releases from before the package-version rules is complete.

## 2026-09-15 12:05 [progress]

Clean-up batch 1 of the pre-rule releases: after `mica-build` `10936ff` pinned
`mica-system-base` `20260915-1102`, `mica-podman` `20260915-1057` and
`mica-boards` `<board>/20260915-1128`, the coordinator deleted Base
`20260915-0209`, podman `20260915-0245` and boards `<board>/20260915-0945`
with their tags and pruned each ghcr package to the digests its current locks
reference (Base 5, podman 2, boards 16, all readable anonymously). `mica-core`
`20260915-0235` and `20260915-0728` follow once `mica-build` pins
`20260915-1135`.

## 2026-09-15 11:55 [progress]

`mica-core` `20260915-1135` at `610782c` is its first release under the
package-version rules (trust hash
`f61c37c3c32566e7c2e00b9a5d15fe1edf8b2a8a41ef9ed952925f292df8f641`): all 14
packages `0.1.0-1` with no `Mica-Source-Commit`, pools annotated only
`mica.source-repo` and `mica.arch`, and `micad (= 0.1.0-1)` pins. It also
implements `mica/rootfs/v2` without `version`, drops the `release-identity.env`
reader, `system.gitStamp`, `system.commitDate` and `daemon.commit`, and prints
the package version from `--version`. All four package repositories now have
a release under the rules; `mica-build` pins them in one round before its
first scoped release, and the old-release clean-up starts from that pin. The
design documents and the package-version and stable-identity decisions mark
the `mica-core` parts implemented.

## 2026-09-15 11:43 [progress]

`mica-build` `main` `718a1226` implements scoped releases (`release.sh`
`plan`, `collect`, `publish`, `attach`; `generation` the previous product
row's plus one, starting at 2; `root` and `kernel` assets only when the other
identity is unchanged; `release-test` 17/17; a local `x64-minimal` rehearsal
passed); the first `x64` cut waits for the new pins. The release-lock tag
list drops `mica-build:root.<product>.<release>`, which nothing produces:
`mica-build` publishes only `image.<product>.<release>` and
`update.<product>.<release>`. `docs/design/release-lock.md` 1.3,
`docs/design/build.md`, `docs/design/release-artifacts.md`, the OCI-tag and
scoped-release decisions.

## 2026-09-15 11:39 [decision]

The releases from before the package-version rules are cleaned up once
`mica-build` no longer pins them (user): after it pins `mica-system-base`
`20260915-1102`, `mica-podman` `20260915-1057` and `mica-boards`
`<board>/20260915-1128`, the coordinator deletes `mica-system-base`
`20260915-0209`, `mica-podman` `20260915-0245` and `mica-boards`
`<board>/20260915-0945` and prunes each ghcr package to its current locks;
`mica-core` `20260915-0235` and `20260915-0728` follow after `mica-core`'s
first release under the rules is pinned. Plan and task
`20260914-2042-release-lock-offline-build`.

## 2026-09-15 11:38 [progress]

The `mica-boards` `<board>/20260915-0824` releases were deleted on user
instruction ("可以删除 现在还是开发阶段") after `mica-build` had pinned
`<board>/20260915-0945`: the four releases with their tags and the eight
`board` and `pool` ghcr versions no `0945` lock reached, keeping the `kernel`,
`uboot` and `firmware` digests shared with `0945`. ghcr then held exactly the
16 digests of the `0945` locks, readable anonymously.

## 2026-09-15 11:37 [progress]

`mica-boards` `<board>/20260915-1128` at `ebf93f7` are its first releases
under the package-version rules, for `x64`, `virt-arm64`, `cx3576` and
`s905x5m`: every package `0.1.0-1` with no `Mica-Source-Commit` and a
declared `SOURCE_DATE_EPOCH`, pools annotated only `mica.source-repo` and
`mica.arch` with `mica.inputs` on each layer, and the board components reused
by digest from `<board>/20260915-0945`. `mica-build` pins them with
`mica-podman` `20260915-1057` and `mica-system-base` `20260915-1102` before
its first scoped release.

## 2026-09-15 11:20 [progress]

`mica-podman` `20260915-1057` at `d47ffbc` is its first release under the
package-version rules (trust hash
`d347fdf5a59ffa39509d9f621113a9a51a252a632b8338ce0e6f6edc839b7426`):
`mica-podman` `5.8.6-1` with a declared `SOURCE_DATE_EPOCH` and no
`Mica-Source-Commit`, pools annotated only `mica.source-repo` and `mica.arch`,
and layers with `mica.inputs`. Moving its Base pin to `20260915-1102`
(`0ed321e`) left the inputs and bytes unchanged on both architectures, so no
new release was needed: the first proven reuse. `mica-build` pins it with
Base `20260915-1102` before its first scoped release.

## 2026-09-15 11:08 [progress]

`mica-system-base` `20260915-1102` at `3ae160d` is the first release with
version-locked packages (trust hash
`2e3ab8029c2b0c2896c2e99bcaf88a7c955e23f57880444d8df7e11eddb0d5a2`):
`mica-busybox` `1.38.0-mica1`, `mica-ca-trust` `20250419-mica1`,
`mica-system` `1.0.0-1` and `mica-systemd-boot` `257.13-mica1`, with no
`Mica-Source-Commit`, pool manifests carrying only `mica.arch` and
`mica.source-repo`, and layers carrying `mica.inputs`. It built everything,
because `20260915-0209` predates version-locked packages (D1); the upstream
rows are unchanged. `mica-build` pins it after its package-version adaptation,
and `mica-podman` may move to it in its own.

## 2026-09-15 10:59 [decision]

`system_info`'s `daemon` member loses `commit`, and `daemon.version` and
`micad --version` show the declared package version (such as `0.1.0-1`):
`mica-core` removes `MICA_BUILD_COMMIT` under the package-version rules (R3).
Decided, landing with `mica-core`'s package-version release.
`docs/design/diagnostics.md`.

## 2026-09-15 10:57 [decision]

Stable root and kernel component identities (user, "接受"). `mica-build`
measured that an empty commit changes the rootfs identity
(`release-identity.env` with a `+git` version and `COMMIT_DATE`, and the
`version` field of `mica/rootfs/v1`) and that the kernel identity changes even
at one commit (a `buildId` over a local tool image identity, and `sbsign`'s
PKCS#7 signing time). The release identity now lives only in the signed
deployment: `release-identity.env` leaves the root and `system_info` drops
`system.commitDate` and `system.gitStamp`; `mica/rootfs/v2` replaces v1
without `version`; the kernel `buildId` hashes the tool image's pinned inputs;
`sbsign` runs under a pinned clock, with a release guard against a changed
kernel identity under an unchanged `buildId`. A board-only or release-only
change then keeps both identities, so `root`-only and `kernel`-only update
packages can be published. Order: `mica-core`, then `mica-build`.
`docs/decisions/2026-09-15-stable-component-ids.md`,
`docs/design/diagnostics.md`, `docs/design/release-signing.md`,
`docs/design/build.md`, the update-packages decision.

## 2026-09-15 10:33 [decision]

Package-version rules clarified: the R5 comparison with the previous release
applies only to a release made under the rules (pool layers with
`mica.inputs`), so each repository's first release under them builds
everything even though its declared versions sort below the old `+git` or
date-stamped ones, with no Debian epoch; and copyright texts may keep citing
upstream commits pinned in `locks/upstream.lock`.
`docs/decisions/2026-09-15-package-versions.md`.

## 2026-09-15 10:31 [decision]

The unified package-version rules are resolved (user, "全部按建议处理") and
adopted by `mica-boards`, `mica-system-base`, `mica-podman` and `mica-core`,
with no compatibility: versions and `SOURCE_DATE_EPOCH` are declared next to
each package or producer and bumped deliberately (R1, R2); no commit,
date or release reaches a package or binary, and `Mica-Source-Commit` is
dropped (R3); the per-producer inputs hash, excluding build-env digests, is
only a guard recorded as `mica.inputs` (R4); CI and releases reuse an
unchanged package by digest after proving a byte-identical rebuild, and refuse
changed inputs without a bump (R5); pool manifests carry only
`mica.source-repo`, `mica.arch` and per-layer title and `mica.inputs`, so an
unchanged pool keeps its digest (R6); `mica-core` keeps exact `micad` pins
(R7); `make offline` only warns (R8). `docs/design/release-lock.md` 1.3 and
section 2, `docs/decisions/2026-09-15-package-versions.md`. The repositories
implement next, each cutting one full release first.

## 2026-09-15 10:20 [decision]

Packages are locked by their own version (user): a release never changes a
package version (no commit, date or release stamp in the version or control
fields; `SOURCE_DATE_EPOCH` from the version identity), and a package is
rebuilt only when its version is bumped. Against the previous release of the
scope, the same name, architecture and version reuses the published bytes by
digest, a higher version is built, and a lower one is refused. The
`mica.inputs` hash stays as a guard that refuses changed inputs without a
bump; reused packages still rebuild byte-identically at release. Repository
metadata changes and releases no longer affect packages. `mica-boards`
implements it first; `mica-core`, `mica-podman` and `mica-system-base` are
assessing it. `docs/decisions/2026-09-15-package-versions.md` supersedes
`2026-09-15-package-reuse-by-inputs`.

## 2026-09-15 10:18 [decision]

The `mica-boards` package-reuse design is accepted (implementation in
progress, not released): `tools/deb/package-inputs.sh` hashes each producer,
the hash is the pool layer annotation `mica.inputs=<sha256>`, and a board
release reuses an unchanged producer's archives from its previous
`<board>/*` release only after rebuilding them with the recorded identity and
proving byte-identical bytes; unchanged pools are re-tagged at the same
digest, and the first release after it lands rebuilds everything once.
`docs/design/release-lock.md` section 2 (lock rows unchanged),
`docs/decisions/2026-09-15-package-reuse-by-inputs.md`.

## 2026-09-15 10:15 [decision]

Packages are reused by inputs across releases, first in `mica-boards` (user):
a package whose inputs hash is unchanged since the previous release of the
same scope is not rebuilt; its published `.deb` (same bytes, same version) is
verified and placed in the new pool, only changed packages get the new commit
version, and an unchanged pool is reused by digest. CI and the package gate
still prove byte-identical rebuilds from source, and caches never decide
reuse. Without it every board release changed the product root and no
`kernel` update package could be produced. `mica-build` checks its root for
release-varying content; the other package repositories are undecided.
`docs/decisions/2026-09-15-package-reuse-by-inputs.md`, linked from the
update-packages decision.

## 2026-09-15 09:13 [progress]

`mica-build` `main` `0094a097` has switched to the per-board `mica-boards`
releases (`locks/mica-boards.<board>.lock` with `SCOPE` pins, component
board fetch checked against `outputs.tsv`) and to `mica-core`
`20260915-0728` (the `mica/deployment/v2` writer with the product, `full`,
`root` and `kernel` update archives, update-server catalog v2), with the
image-kinds executor and the `images.tsv` update-row reader. `60a93a48`
renames the development certificates `MICA-development-<domain>`, and the
repository variables now equal `mica-boards`'. CI and the eight product
builds are running; the scoped releases follow. `docs/boards/contract.md`
section 3 now states that `mica.verity-cert-sha256` is required on the
`board` and `kernel` components and must match where `uboot` or `firmware`
carries it.

## 2026-09-15 09:04 [progress]

Release-lock migration stage 4, `mica-boards` part, complete: the first
per-board releases `x64/20260915-0824`, `virt-arm64/20260915-0824`,
`cx3576/20260915-0824` and `s905x5m/20260915-0824` at `0f8e313`, each with
only `mica-boards.lock` and `SHA256SUMS`, carry the boards as component
artifacts (`board` and `kernel` on `x64` and `virt-arm64`, plus `uboot` and
`firmware` on the FIT boards), with `mica-kernel-<board>` retired and every
board's `images.tsv` declaring `disk`. The failed cut `20260915-0715`, the
unscoped `20260914-1603` and all old ghcr versions and Actions runs are
deleted. Next are the `mica-build` per-board switch, the certificate switch,
eight products and the scoped releases.

## 2026-09-15 07:45 [progress]

`mica-core` `20260915-0728` at `2a4c98d` implements the accepted update
packages (trust hash
`75187b8a312aae80cb02d34e8f92fbab310a742a79a4d75ebc30f4bfbea37590`; 14
packages at `0.1.0+git2a4c98de1f64-1`; `make check` 1236 tests, package gate
99/99): partial `MICAUPD1` import, `mica/deployment/v2` with the signed
`product`, the device product from `product.conf`, and `mica/catalog/v2`
heads keyed by board, product and channel. The contract files under
`crates/mica-deploy/tests/component-contracts/` are regenerated. `mica-build`
pins it next and implements the v2 descriptor, catalog v2 and the three
archives; the design documents now name `mica-core`'s side as implemented.

## 2026-09-15 07:01 [progress]

The update-package records use `mica-core`'s names (implementation in
progress, `mica-core:docs/task/20260915-0657-update-packages.md`): `mica/deployment/v2` replaces v1 with a required signed
`product` field; the device's product is the single unquoted `PRODUCT=` line
of the five-line `/usr/lib/mica/product.conf`; `mica/catalog/v2` carries
channel heads keyed by board, product and channel; `MICAUPD1` keeps its
layout with an object count from 0 to the descriptor's, missing objects
present in the store; `mica/kernel/v1` and `mica/rootfs/v1` are unchanged.
`docs/design/release-signing.md`, `docs/design/updates.md`,
`docs/design/build.md`, `docs/decisions/2026-09-15-update-packages.md`.

## 2026-09-15 06:59 [decision]

`mica-build`'s update-package proposal is accepted (user, "接受"). Each product
release has one signed deployment, published as `MICAUPD1` archives with the
same descriptor: `full` (`<name>.micaupd`, always), `root`
(`<name>.root.micaupd`, only when the kernel identity is unchanged) and
`kernel` (`<name>.kernel.micaupd`, only when the rootfs identity is
unchanged), decided against the previous `mica-build.lock`. Modules stay in
the support image; there is no firmware-only package yet; a kernel package is
refused across a verity trust change. `mica-core` gains partial import and a
signed `product` field; the update-server is keyed by product and imports from
the `full` archive or the OCI layer; there is no generic root. `images.tsv`
rows are `update <kind> builtin - <suffix>` with `full` mandatory, `-` the
runtime image of every builtin row. The release-lock spec gains the
`mica-build` rows `input`, `product`, `bundle` and `asset` with the rules
`build-only-kind`, `bundle-without-product`, `asset-without-bundle` and
`update-full`; checker and vectors follow (138 checks). Order: `mica-core`,
`mica-build`, `mica-boards`. `docs/decisions/2026-09-15-update-packages.md`,
`docs/design/release-lock.md` 1.2.2, `docs/boards/contract.md` 3.1,
`docs/design/release-signing.md`, `docs/design/updates.md`, the scoped-release
and packer decisions.

## 2026-09-15 06:39 [decision]

Update packages reuse `images.tsv` (user): the kernel and the system are
upgraded independently, so a board's `images.tsv` also declares its update
kinds, proposed as `update <kind> <packer> <runtime image> <suffix>` with
`root`, `kernel` and `full` and the `builtin` packer (`mica-build` signs and
packs `MICAUPD1`). Products select `UPDATE_KINDS` beside `IMAGE_KINDS`; a
`kernel` or `root` package is produced only when that part changed, a `full`
package every release. The exact row is pending `mica-build`'s proposal.
`docs/decisions/2026-09-15-board-image-packers.md`, `docs/boards/contract.md`
3.1.

## 2026-09-15 06:38 [decision]

Flashing formats, replacing the earlier split (user): `mica-boards` declares
each board's formats in `boards/<board>/images.tsv` (`image <kind> <packer>
<runtime image> <suffix>`, `disk` mandatory and `builtin`) and supplies the
packers in a new `packer` board component; `mica-build` only executes them
through `pack` and `verify` over a signed input directory, sandboxed and
packed twice. `IMAGE_KINDS` leaves `board.env`; a product selects kinds in
`product.env`. Any failed pack, verify, determinism check or asset over 2 GiB
fails the product's release; each kind is a release asset
`mica-<product>-<YYYYMMDD-HHMM>.<suffix>` and a layer of
`image.<product>.<YYYYMMDD-HHMM>`. `mica-boards`' first four releases stay
`disk` only and are not delayed. `docs/decisions/2026-09-15-board-image-packers.md`
(superseding parts of `2026-09-15-board-image-kinds`),
`docs/boards/contract.md` 3.1, `board-env.md`, `porting.md`, the release-lock
spec and checker (`packer` component), the per-board and `mica-build`
release decisions, the Rockchip plan and task.

## 2026-09-15 06:20 [decision]

Board image kinds (user): a board-specific whole-disk flashing format is
split between the repositories. The board repository delivers the board-level
pieces (a Rockchip loader and `idblock.img`, an Amlogic burn package and its
packer tool, kept x86-64) in its `uboot` component, lists them in
`outputs.tsv` and declares `IMAGE_KINDS` in `board.env`; `mica-build` builds
each product's flashing format by image kind and publishes it as a release
asset and OCI artifact. Only `disk` is implemented; `rockchip-update` and
`amlogic-burn` are reserved and refused until implemented, and a board may
declare a kind only once its packer exists. The Rockchip `update.img` plan
`20260912-2253` stays deferred, its M1-M4 mapped onto this split, M0 still
blocking; there is no Amlogic burn plan.
`docs/decisions/2026-09-15-board-image-kinds.md`, `docs/boards/contract.md`,
`docs/boards/board-env.md`, the per-board and `mica-build` release decisions.

## 2026-09-15 05:49 [decision]

A `mica-boards` lock must name the `board` and `kernel` components (`uboot` and
`firmware` stay optional); the checker refuses one without either as
`board-components`, with the refused vector `board-components.lock` (no
`kernel` row). With the board-and-component key this gives two to four
`board` rows (`docs/design/release-lock.md` 1.0 and 1.5).

## 2026-09-15 05:47 [decision]

Agreed by `mica-boards` and `mica-build`: a board is published as separate
component artifacts, `kernel`, `uboot` (FIT boards), `firmware` and `board`,
tagged `<component>.<board>.<YYYYMMDD-HHMM>` with `artifactType`
`application/vnd.mica.board[.kernel|.uboot|.firmware]` and the annotations
`mica.component` and `mica.inputs`, and a board release reuses an unchanged
component by digest. The release-lock `board` row becomes
`board <board> <component> <arch> <reference>` (key board and component, two
to four per lock), and `scope-content` also checks each component's tag; the
checker and vectors follow (124 checks). The `mica-kernel-<board>` packages
are retired, and `boards/<board>/outputs.tsv` rows become `package <name>` and
`file <component> <path>`. `docs/design/release-lock.md` 1.0, 1.2, 1.3, 1.5,
2 and 9, `docs/boards/contract.md` section 3, the per-board releases and
OCI-tag decisions, `docs/design/build.md` and `README.md`.

## 2026-09-15 04:23 [progress]

`mica-boards` defined its board list (`ce44907`): `boards/boards.tsv` lists
every supported board with its architecture and boot backend, and
`boards/<board>/outputs.tsv` lists the board's packages and bundle files and
travels in the bundle, so each board release carries its own expected
outputs. `docs/boards/contract.md` section 3 and the per-board releases
decision cite it.

## 2026-09-15 03:45 [decision]

A scoped `mica-boards` lock holds only its board: every `board` row names the
scope's board and every pool tag is `pool.<scope>.<arch>.<...>`, refused
otherwise as `scope-content` (`docs/design/release-lock.md` 1.0 and 1.5; the
checker and two refused vectors, `scope-content-board.lock` and
`scope-content-pool.lock`).

## 2026-09-15 03:43 [decision]

`mica-boards` is not merged into `mica-build`; it releases per board (user):
tag and GitHub Release `<board>/<YYYYMMDD-HHMM>`, only that board built and
published, OCI tags `board.<board>.<release>` and
`pool.<board>.<arch>.<release>`, assets exactly `mica-boards.lock` and
`SHA256SUMS`, and a machine-readable board list in `boards/`. The release-lock
spec gains scoped releases (1.0) for `mica-boards` and `mica-build` only: the
release row may carry `<scope>/<YYYYMMDD-HHMM>` (refused elsewhere as
`release-scope`), and a consumer keeps each scope as
`locks/<repository>.<scope>.lock` with `locks/pins/<repository>.<scope>.pin`
(`SCOPE=`), refused on a mismatch as `scope-mismatch`. The checker and vectors
follow (114 checks). `docs/decisions/2026-09-15-mica-boards-per-board-releases.md`;
the `mica-build`, release-lock and OCI-tag decisions, `docs/boards/contract.md`,
plan and task `20260914-2042-release-lock-offline-build`. Stage 4 runs
`mica-boards` per-board releases first, then `mica-build`.

## 2026-09-15 03:19 [decision]

Two user decisions for `mica-build`, the last exit of the system, which
nothing consumes: it follows its own release logic, an exception to the
uniform release rules for `mica-build` only. A release is scoped to a board
(all its products) or one product, tagged `<scope>/<YYYYMMDD-HHMM>` (for
example `x64/20260915-0300`), and only that scope is built, verified and
published. A release also carries the images as downloadable assets (per
product the compressed factory image, the update archive and, for FIT boards,
the vendor flashing format) beside `mica-build.lock` and `SHA256SUMS`; the
OCI artifacts `image.<product>.<release>` and `update.<product>.<release>` are
the canonical copies, and the lock ties each asset to its digest and records
the five input releases. Its lock row kinds are pending.
`docs/decisions/2026-09-15-mica-build-scoped-releases.md`, spec section 1,
plan and task `20260914-2042-release-lock-offline-build`.

## 2026-09-15 03:00 [progress]

Release-lock migration stage 3 complete: `mica-podman`'s clean release. Its
history is the root `b385fa19` (force-pushed by the user), the releases
`20260915-0138` and `20260914-0158` and 25 old Actions runs are deleted, and
`20260915-0245` (trust hash
`64e2ec07c90947e5e323d15537033f14f720256e304134cc1810c8a34a09bf32`) carries
only `mica-podman.lock` and `SHA256SUMS`, with pools
`pool.<arch>.20260915-0245` and `mica-podman` `5.8.6+gitb385fa19ea71-1` per
architecture, built on build-env `20260915-0138` and Base `20260915-0209`;
ghcr holds only its two pools. Every input `mica-build` adopted in
`20260914-0558` is now deleted, and stage 4 (`mica-boards`, then `mica-build`
and the final image assembly) has started.

## 2026-09-15 02:52 [progress]

Release-lock migration stage 3, `mica-core` part, done under the user's
clean-release instruction: root `239e423`, the releases `20260915-0145`,
`20260914-1212` and `20260914-0529` and all 16 earlier Actions runs deleted,
and the new release `20260915-0235` (trust hash
`fb2eb30600f49b5c4b016063f7304bc3106cf9782662331e1cfdc0151ce2db21`) carrying
only `mica-core.lock` and `SHA256SUMS`: pools `pool.<arch>.20260915-0235` in
the new public package and the seven packages at `0.1.0+git239e42340795-1`
per architecture. It consumes only `locks/mica-build-env.lock`
(`20260915-0138`); the signed update contract is unchanged. The earlier core
pins no longer resolve, and the records citing them or pre-reset core commits
say so. `mica-podman`'s clean release awaits the user's authorization.

## 2026-09-15 02:16 [progress]

User instruction for `mica-system-base`, `mica-podman` and `mica-core`: once
on `mica-build-env` `20260915-0138` and the final format, each squashes its
history, deletes its previous Actions runs, tags and releases, publishes a
completely new version and prunes ghcr to the new lock. `mica-system-base`
is done: root `4d63430`, all 30 old Actions runs and `20260915-0059` deleted,
and the new release `20260915-0209` (trust hash
`19672ed41506466679d2a93d18d7ba5ecf5ef30817bc0219e859ac80db918ab3`) carries
the same rows as before with the packages at `20260915-0209-1`; its ghcr
package holds only that release's 5 versions. `20260915-0209` is the Base to
pin; `mica-podman` and `mica-core` follow.

## 2026-09-15 01:50 [progress]

Release-lock migration stage 3, `mica-podman` part, done: `mica-podman`
`20260915-0138` at `6a15000` carries only `mica-podman.lock` and `SHA256SUMS`
(trust hash `39b47945017d1e6f1bede9f99c686aee89150faa89735773f409860530456873`),
naming its pools `pool.<arch>.20260915-0138` and the package
`5.8.6+git6a150004dc49-1` per architecture by digest. Its inputs are only
`locks/`: the build-env and Base locks with their pins, and the six upstream
engine trees as `git` rows of `locks/upstream.lock`, which the package ships
as `/usr/share/mica-podman/upstream.lock` in place of `versions.env`. The
design and user documentation cite that lock. `repos/` and the offline lock
form are still to come, and `20260914-0158` with `.deb` assets still exists.
`mica-core` is in progress (`20260915-0145` failed on the deleted build-env
`20260915-0030` and has no assets).

## 2026-09-15 01:47 [progress]

`mica-build-env` `20260915-0138` at `f7b896b` is the only release
(`SHA256SUMS` sha256
`8efc21bab0b959f436f1131cbfbd0fb37d7f546c447cd6ec5e86f81592e3385c`). Image
tags are the release number, `<image>.<release>` and per architecture
`<image>.<arch>.<release>`, with no hash or commit tags. An image's inputs are
the label `com.mica.build-env.inputs` on every platform config, and an
unchanged image is reused under the new release tag with its digest. Release
`20260915-0130` failed because an index annotation does not survive a Docker
manifest list; fixed in `f7b896b`. On user instruction the releases
`20260915-0030` and `20260915-0130` and every ghcr version `20260915-0138`
does not use were deleted; the package holds only its 12 versions. Every OCI
tag in Mica is `<kind>[.<name>]*.<release>` (user decision; `mica-build-env`
`RULES.md` section 3). `mica-system-base` and the stage 3 consumers move to
`20260915-0138`; the OCI-tags decision now names the config label as the
rebuild key.

## 2026-09-15 01:11 [decision]

OCI tags follow the release version (user): every tag in
`ghcr.io/micaoss/<repository>` is `<kind>[.<name>]*.<YYYYMMDD-HHMM>`, its last
part exactly the release tag that published it, never a commit
(`build-<commit12>`) or a hash (`inputs-<16>`); for example
`mica-build-env:base.20260915-0030`, `<repository>:pool.<arch>.<release>`,
`mica-build:root.<product>.<release>`. A tag holding another digest is
refused, an unchanged artifact is reused by digest under the new release tag,
and `mica-build-env` keeps its rebuild key in the index annotation
`com.mica.build-env.inputs`. Readers still read by digest. Recorded in
`docs/decisions/2026-09-15-oci-tags-follow-release-version.md` and
`docs/design/release-lock.md` 1.3 and 2; `mica-build-env` `RULES.md` section 3
states it (`4a04b7e`).

## 2026-09-15 01:09 [progress]

Release-lock migration stage 2 done: `mica-system-base` `20260915-0059` at
`a6db959` (`SHA256SUMS` sha256
`88feb509dc516bb97b1b7473d9af8a3e617fa8467958a29b0f93ac72e6620cb4`) carries
only `mica-system-base.lock` and `SHA256SUMS`: the rootfs index and platform
roots, both pools, its four packages per architecture, 42 `upstream` rows with
roots and the `apt` row. It reads `locks/mica-build-env.lock`
(`20260915-0030`), pins its third-party inputs in `locks/upstream.lock` and
takes its Dockerfile frontend and BuildKit from the build-env `upstream` rows.
On the user's direct instruction its history was squashed into that root
commit and its releases `20260914-0455` to `20260914-2206`, their tags and 40
ghcr versions were deleted; the `mica-system-base` commits and releases cited
in earlier entries are pre-reset history. `README.md` and
`docs/design/build.md` describe the one Base lock, and the records citing the
old Base say so. Stage 3 (`mica-podman`, `mica-core`) has started.

## 2026-09-15 00:39 [progress]

Release-lock migration stage 1 done again, in the source-column row format:
`mica-build-env` `20260915-0030` at `e042744` is the release to pin
(`SHA256SUMS` sha256
`02b712ffbe3cd289a242e63af68e1f81a1cbe7f50bf466d36d34e50122a6dcff`). Its lock
names base, c, go and rust as `mica-build-env` rows on
`ghcr.io/micaoss/mica-build-env` and the approved third-party images as
`upstream` rows taken unchanged from `locks/upstream.lock`, at their original
`docker.io` references; nothing is republished, the mirror job and
`publish-mirrors.sh` are removed, and Docker Hub rate limits are accepted. The
user reset its `main` to one root commit (`5c05745`) and deleted the ghcr
package and the releases `20260914-2353`, `20260914-1129` and
`20260914-0128`; `20260915-0026` failed in `build.sh` and has no assets. Every
`mica-build-env` commit cited in earlier entries and records is pre-reset
history; the records that cite them say so. Stage 2 (`mica-system-base`) is in
progress. Task and plan `20260914-2042-release-lock-offline-build`.

## 2026-09-15 00:17 [decision]

The `image` row of `mica-lock v1` gains a source column (user):
`image <source> <name> <platform> <reference>`, where the source is the
producing repository for an image it publishes on
`ghcr.io/micaoss/<repository>` (`image mica-build-env base amd64 ...`) and
`upstream` a third-party image named and referenced exactly as upstream spells
it (`debian:trixie-slim`,
`docker.io/library/debian:trixie-slim@sha256:...`), with the index digest on
every platform row. `ghcr.io/micaoss` republishes no upstream image: the
mirrors, their `upstream.<path>.<tag>` names and digest12 tags are dropped
(spec 2.1 removed), and an `upstream` reference into `ghcr.io/micaoss` or
`local` is refused (`reference-upstream`; `image-source` refuses any other
source form, a repository other than the release row's, and a repository
source in `locks/upstream.lock`). Consumers take third-party images from the
`upstream` rows of `locks/mica-build-env.lock`. `locks/upstream.lock` uses
the same row shape. The user's refinement of the same day made the source the
repository name instead of a fixed `mica`. `mica-build-env` `20260914-2353`
uses the superseded shape; its next release replaces it.
`docs/design/release-lock.md` 1.2.1, the checker, the vectors, the decision,
the plan and the task follow.

## 2026-09-14 23:59 [progress]

Release-lock migration stage 1 done: `mica-build-env` `20260914-2353`
(`8ec2ff0f5959`, `SHA256SUMS` sha256
`c932a7386b32799a5f42015cf87c3596b0fb0477a69eab96c18bb5d6aa2aed21`) is its
first `mica-lock v1` release line: only `mica-build-env.lock` and
`SHA256SUMS`, the four images by index and platform manifest, every upstream
image mirrored into `ghcr.io/micaoss/mica-build-env` and listed by index
digest, and third-party inputs pinned only in `locks/upstream.lock`
(`images.env` and `mirrors.list` removed). By user decision `registry:2`,
`alpine:3.21` and `debian:bookworm-slim` are dropped for `registry:3.1.1`,
`alpine:3.24.1` and `debian:trixie-slim`. Stage 2 (`mica-system-base`) has
started. Task and plan `20260914-2042-release-lock-offline-build`;
`docs/design/release-lock.md` 2.1 names the current inventory.

## 2026-09-14 22:57 [decision]

Two user decisions for the release lock: there is no transition period, so a
repository's first new-format release already carries only
`<repository>.lock` and `SHA256SUMS`; and every repository's third-party
inputs move into `locks/upstream.lock`, the same file format with only
`image`, `source` and `git` rows and no release row or pin, replacing each
repository's own pin files in its migration stage (`mica-build-env` now).
`docs/design/release-lock.md` (section 1, new 4.1, `repos.sh check`, vectors),
the decision, the plan and the task follow.

## 2026-09-14 20:52 [decision]

`mica-build-env` mirrors every third-party image the repositories pin into
`ghcr.io/micaoss/mica-build-env` (user, "用ghcr"): whole upstream indexes
copied with their digest, immutable tags `upstream.<path>.<tag>.<digest12>`,
published only by `release.yml`, and listed as `image upstream.<path>.<tag>`
rows of its lock (platform `amd64`, `arm64`, and `386` for
`debian:trixie-slim`). Consumers read them from `locks/mica-build-env.lock`
instead of upstream references. Open with the user: whether each row names
the index digest (recommended) or its platform manifest.
`docs/design/release-lock.md` 2.1, the decision, the plan and the build-env
lock vector follow.

## 2026-09-14 20:50 [decision]

Correction (user): `locks/pins` is a directory, not one file. Each input has
its own `locks/pins/<repository>.pin` (`mica-pin v1`: `REPOSITORY`, `RELEASE`,
`SHA256SUMS`, and `CHECKOUT` on an offline pin), so moving one input replaces
its lock and its pin and touches no other file; the `.pin` suffix is
`mica-build`'s reading. The specification, the decision, the plan and the
pins test vectors follow; `mica-pins v1` (the single file) is gone.

## 2026-09-14 20:42 [decision]

One release lock format and an offline build (user): every release carries
`<repository>.lock` (`mica-lock v1`) and `SHA256SUMS` only, packages live only
in OCI pools, consumers keep `locks/<repository>.lock` and one `locks/pins`
(`mica-pins v1`), and every repository gets `repos/` with `tools/repos.sh` and
`make offline`. Decision `docs/decisions/2026-09-14-release-lock-and-offline-build.md`,
specification `docs/design/release-lock.md` with 36 test vectors under
`docs/design/release-lock/vectors/`, which `make docs-verify` proves with a
reference checker, and plan and task `20260914-2042-release-lock-offline-build`.
Open: where the offline driver lives.

## 2026-09-14 18:08 [progress]

First `mica-boards` release `20260914-1603` (`c6ecd7bce901`, build-env
`20260914-1129`, development trust certificates; trust hash
`fe61758865cd49ca461757a880cf9c2ac718c029aeba2b880bea7818555a785b`): both
pools and the four board bundles on `ghcr.io/micaoss/mica-boards`, packages at
`0.1.0+gitc6ecd7bce901-1`. It carries the FIT loader environment fix
(`mica_entries=` read at its 13-byte length, value offset 18), which
`mica-build`'s FIT records lab found after the rename. The s905x5m kernel and
U-Boot are still not byte-reproducible across hosts. `mica-build` moves its
board pins to it; its remaining blocker is the Base shadow lock fix.

## 2026-09-14 12:29 [progress]

`mica-core` `20260914-1212` (`f5f53dfd484f`, on build-env `20260914-1129`;
`SHA256SUMS` trust hash
`c04180eb6f7870bd23d1f20514dbadd67910f716a0591daaed18180ac2029d34`) carries
the signed-contract rename, and `mica-build` moves to it. Corrected record:
the schemas are `mica/deployment/v1`, `mica/kernel/v1`, `mica/rootfs/v1`,
`mica/update-envelope/v1` and `mica/firmware/v1`, the catalog is
`mica/catalog/v1`, and there is no `mica/update-catalog/v1` schema (the
earlier entry named one). `docs/design/release-signing.md` now states the
envelope key order, the `keyId` rule and the `MICAUPD1` archive layout.

## 2026-09-14 11:54 [progress]

`mica-build-env` `20260914-1129` (trust hash
`6c582b2a6ff7a861c547623b6cec72259676d2c7851c5c7ab84c9ef94f9ce122`)
supersedes `20260914-0128` and drops the former project name from the image
configurations. `mica-system-base` `20260914-1148` (`eb293178d892`, trust hash
`574485b25f6ccb1e852b875ff08b811e9c708a8329bf29654d090f2eb9896258`), built on
it, is the current Base; its `system-base-packages.lock` adds a roots column,
the `upstream.pkgs` roots each package is pinned for. `mica-podman`,
`mica-build`, `mica-core` and `mica-boards` are moving to both.

## 2026-09-14 11:22 [decision]

The former project name goes from the signed update contract too (user): the
component and envelope schemas are `mica/*/v1` (`mica/deployment/v1`,
`mica/kernel/v1`, `mica/rootfs/v1`, `mica/firmware/v1`,
`mica/update-envelope/v1`; the catalog is `mica/catalog/v1`) and the update
archive magic is `MICAUPD1`; `mica-core` and `mica-build` change them together. The
development certificates are not regenerated yet, so the builds can run end
to end first; renaming their CN comes later. `docs/design/build.md`,
`release-artifacts.md`, `release-signing.md`, `updates.md`, the cx3576 bench
page and task `20260914-0558-mica-build-released-inputs` follow.

## 2026-09-14 11:21 [progress]

`mica-build` moved to `micaoss` (user, option a): `micaoss/mica-build` is
public with one root commit `a5f1e364` holding the reworked assembly on Base
`20260914-0829`; it owns the `mica/*` release, catalog, meta, fleet,
provenance and lineage schemas and the `.micaupd` extension, releases only
to the development channel, and its CI waits for the first `mica-boards`
release. With it, the organisation migration is complete: every Mica OS
repository (`mica`, `mica-build`, `mica-build-env`, `mica-core`,
`mica-system-base`, `mica-boards`, `mica-podman`) is on `micaoss`; the
retired `mica-debian`, `mica-system`, `mica-deploy` and `mica-boot` did not
move. Task and plan `20260914-0558-mica-build-released-inputs`.

## 2026-09-14 10:42 [decision]

User decisions: the dev/prod allowed effects are decided (the profile in
`system_info`, diagnostic verbosity and log retention, convenience that grants
no access); there is no hardened prod U-Boot for now, an accepted limit of the
FIT boards' command line enforcement; releases use the existing development
certificates and keys; `mica-sftp-server` is installed in every product;
Base consumers commit `system-base.lock`, `system-base-packages.lock` and
`system-base.sources` at their root with the release tag and the sha256 of
`SHA256SUMS`, which is not committed. Base release `20260914-0909` was deleted.
Recorded in the dev/prod and Base packages decisions, the registry decision,
`docs/design/access.md`, `docs/design/build.md`, `README.md` and task and plan
`20260914-0558-mica-build-released-inputs`.

## 2026-09-14 09:10 [progress]

`mica-boards` `aa22e75`: the bundle of a U-Boot FIT board carries
`kernel/dev/` and `kernel/prod/`, two complete kernels whose forced
`CONFIG_CMDLINE` ends in their `mica.profile` token, and the assembly takes
the product's profile (user choice, option A); UEFI boards keep one kernel.
The FIT boards enforce the command line on the boot path but not against the
serial console, since both U-Boots keep an interactive console, serve both
profiles and are not verified by the boot ROM; a hardened prod U-Boot is open
with the user. The board trust variables still hold development certificates
and must become the public halves of `mica-build`'s release certificates.
`docs/boards/contract.md` §3, the dev/prod decision, `docs/design/access.md`
§5.3 and the `mica-build` released-inputs task follow.

## 2026-09-14 08:37 [decision]

`mica-system-base` `20260914-0829` is the current Base: its fourth asset,
`system-base.sources`, is the one Debian archive a consumer resolves any
package from that `system-base-packages.lock` does not list, and the
consumption rules are written in `mica-system-base:README.md` *Consuming a
release* (user instruction). `20260914-0809` briefly carried three cx3576
packages for a withdrawn request. The Base packages decision, the registry
decision, `docs/design/build.md`, `README.md` and the `mica-build`
released-inputs records cite that section. `mica-build` and `mica-podman` are
being moved to `20260914-0829`.

## 2026-09-14 07:58 [decision]

`mica-system-base` pins every upstream Debian package (user): boards and
products only install and enable them from `system-base-packages.lock`, which
a Base release publishes from `20260914-0742`; a missing package is requested
from Base, and Base seeds the `bluetooth` (989) and `netdev` (988) groups into
every root. This supersedes the `mica-build` consumer lock `deps/debian` and
the earlier Q2 option (a) answer. `mica-build` moves to Base `20260914-0742`.
`docs/decisions/2026-09-14-base-pins-upstream-packages.md`, the registry
decision, `docs/design/build.md`, `README.md` and task and plan
`20260914-0558-mica-build-released-inputs` follow.

## 2026-09-14 07:57 [progress]

`mica-build` (branch `released-inputs` at `edafed96`, not merged or pushed):
Base comes from `system-base.lock` of `20260914-0654`; the upstream Debian
packages beyond the Base root are pinned in the consumer lock `deps/debian`;
`mica.profile` is written on the signed kernel command line; `release.yml`
publishes per-product images, update archives and component tarballs with
`SHA256SUMS` as GitHub Release assets; caches are pruned to the pins and saved
only from `main`. Task and plan `20260914-0558-mica-build-released-inputs`.

## 2026-09-14 07:18 [progress]

`mica-boards` moved to `micaoss` (user) and step 3 of
`20260914-0503-retire-mica-boot` landed there: `common/` holds the shared
kernel floor, the U-Boot trust helpers and the certificate-only trust staging,
there is no `boot/` pin, and each board carries its own kernel and loader
build (no families). Its releases will publish `pool.<arch>.<YYYYMMDD-HHMM>`
and `board.<board>.<YYYYMMDD-HHMM>`; none is cut yet. The SFTP server is not
a board component: it is `mica-core`'s package, installed by the product
stage, and which products install it is an open user question. The board
contract, porting, board-env and virt-arm64 pages, the evidence lines naming
the kernel floor, `docs/architecture.md`, `docs/design/build.md`,
`docs/design/access.md` §3.4 and the registry decision follow.

## 2026-09-14 07:08 [decision]

Q2 of `20260914-0558-mica-build-released-inputs` is answered (user): upstream
Debian packages beyond the Base lock are not merged into `mica-system-base`,
and `mica-build` keeps a consumer lock for those it composes, pinned from the
Base snapshot `20260905T000000Z` or verified against the Base root's dpkg
status; no user question remains open there. Base releases carry a lock from
`20260914-0654`: `system-base.lock` and `SHA256SUMS`, committed unchanged by a
consumer like `build-env-image.lock`. Recorded in
`docs/decisions/2026-09-13-ghcr-artifact-registry.md`, `docs/design/build.md`,
`README.md` and the task and plan.

## 2026-09-14 06:38 [decision]

The dev/prod carrier is decided (user): the kernel command line parameter
`mica.profile=dev|prod`, written by `mica-build` from `product.env` `PROFILE`
for every image and only into signed boot configuration, identical across
every command line variant and signed per A/B slot; `micad` reads exactly one
`mica.profile=dev` as dev and anything else as prod, once at start, never as a
setting. Profile and `trust.grade` are independent, and no difference is
implemented before the allowed effects are listed.
`docs/decisions/2026-09-14-no-image-profile-packages.md`,
`docs/design/access.md` §5.3, `docs/architecture.md`, `README.md`,
`docs/boards/qualification.md` and the `mica-build` released-inputs records
follow.

## 2026-09-14 05:03 [decision]

Two user decisions recorded. `mica-boot` is split three ways and retired
(`docs/decisions/2026-09-14-mica-boot-split.md`, plan and task
`20260914-0503-retire-mica-boot`): systemd-boot goes to `mica-system-base` as
`mica-systemd-boot`, the packaging, signing and key tools to `mica-build`, and
`common/` with `verity-tool.sh stage` to `mica-boards`, which takes public
certificates only. There are no image profile packages
(`docs/decisions/2026-09-14-no-image-profile-packages.md`): dev and prod images
are to differ through the signed kernel command line, not yet designed.
`docs/design/access.md` §5.3, `docs/architecture.md`, `docs/design/build.md`,
`docs/design/provisioning.md`, `docs/design/recovery.md` and the board contract,
porting, qualification and virt-arm64 pages follow.

## 2026-09-14 00:21 [decision]

The user asked to keep agent instructions only in the workspace directory
above the repositories. `AGENTS.md` and `CLAUDE.md` are removed from every
repository; the workspace `AGENTS.md` now carries the workspace constraints
(no backward compatibility during development, UTC `YYYYMMDD-HHMM` release
versions, latest action versions, `ci.yml`/`release.yml` split, releases cut
with `gh release create`) and each repository's skill stack and facts, moved
as written. `README.md` and `docs/decisions/README.md` no longer name a
repository's own `AGENTS.md`. Task and plan:
`20260914-0021-workspace-agents-file`.

## 2026-09-13 19:30 [decision]

The user requested `mica-system-base`, a new repository that merges
`mica-debian` and `mica-system` (build tooling in Bun and TypeScript, device
payload exempt; radio and SFTP are board features), with the old repositories
retired after the migration. This supersedes the base-only and layered rootfs
proposals recorded at 19:06. Recorded in
`docs/decisions/2026-09-13-ghcr-artifact-registry.md`; the merge is not done
and nothing is published or deleted by it.

## 2026-09-13 19:06 [decision]

`docs/decisions/2026-09-13-ghcr-artifact-registry.md` records the settled
per-repository contract (the package is the producer repository, the kind
leads the tag), a 404-only legacy read of the historical shared packages
during the pin transition, byte-stable source artifacts (`git archive` with
`gzip -cn`, required expected sha256, strict full-commit historical
publication, one canonical shell publisher in `mica-build-env` and an
equivalent TypeScript one in `mica-debian`), and the user's choice of a
base-only Debian root (68 packages, a builder with mmdebstrap, downstream
stages owning their additions), which supersedes the 123-package draft and is
not yet implemented. `docs/design/build.md` and
`docs/design/release-artifacts.md` name the new references. Milestones:
`mica-build-env` `cb4080d`, `mica-build` `565d5250`; the migration is not
complete.

## 2026-09-13 18:49 [progress]

Records synchronized from the repository owners' handoffs. The public
`mica-builder/base` index and the `mica-build-env` source artifact at
`41f292694f9e` are anonymously readable, which clears
`20260913-0409-bun-from-build-base` for the mica-build and mica-core
migrations. The user's 18:41 direction, one set of packages per repository
published by that repository's CI, supersedes the four shared packages as
the registry target (a shared-package upload from mica-debian was refused
with HTTP 403); the new grammar waits on the `mica-build-env` contract. The
boot-size producer changes are recorded as committed (four of the five
commits local only, `mica-boot` `5ac0371` observed on its `origin/main`), with
guest, composition and physical CX acceptance still open. The Dropbear
contract is noted on `20260908-2011-ssh-generator-vs-image-policy`;
`docs/design/access.md` is unchanged until its owners hand off verified text.

## 2026-09-13 18:30 [progress]

Phases 6-8 of `20260911-1927-boot-artifact-size`, producer side: one static
`mica-runkit` reached as `init` and `shutdown` (initramfs 4,453,376 ->
2,606,592 raw bytes, `exitrd/shutdown` a hard link to `/init`); `micad` and
`apid` one binary with an `apid` link (25,963,216 -> 22,710,296 bytes);
`mica-deploy` fetches over rustls instead of curl; `apid --healthcheck` is the
health gate's probe; micad deletes links with `networkctl`; cx3576 CAN goes
through networkd and its MAC write through `busybox ip`; `mica-system` no
longer depends on iproute2, curl or iptables. Not yet published; `mica-build`
adapts with the pin bump.

## 2026-09-13 17:35 [progress]

`20260913-1730-board-repository-layout` landed: a board is a data directory
under `mica-boards:boards/<name>/` (kernel, loader, firmware, package,
extras), `producers/board` and `producers/kernel` are the two producers
over every board (the matrix producer of `mica-build-env`, `FOR_EACH`),
and `new-board.sh` copies eleven data files. The pool is member for member
what it was. Publishing moves to CI: `publish-source.yml` in
`mica-build-env` and `mica-debian`, package write permission in
`mica-boards:release.yml` and the assembly's privileged lane; the
registry migration runbook follows.

## 2026-09-13 17:04 [progress]

Phases 6 and 7 of `20260913-0416-board-product-build-architecture`: the
registry is OCI and the tests dispatch on facts. `mica-build-env:deb/oci.sh`
speaks the Distribution API with curl; pools, source trees, board bundles
(`mica-boards:tools/publish-boards.sh`) and product roots
(`mica-build:tools/product-release.sh`) are artifacts under
`ghcr.io/<former organisation>/`, pinned by digest, and `deps/boards/<board>.json` is how a
board enters the assembly; GitHub Releases are no longer written or read.
One composition per product; `BOARD_RADIOS`/`BOARD_HAS_*` gone; the
board-name lint covers `tests/` and `.github/`; the privileged lane and
`make lifecycle-uefi` run over products. The push to GHCR waits on a token
with the packages scopes: `20260913-1700-registry-migration`.

## 2026-09-13 09:48 [progress]

Phase 5 of `20260913-0416-board-product-build-architecture`: a new board
is one command and one pin. `mica-boards:tools/new-board.sh` clones a
board with fresh identities and the Makefile discovers it; a board package
excludes its siblings through the virtual `mica-board`, the package gate
resolves Conflicts through virtual names, and `mica-debian:consumers.pkgs`
and `mica-build:rootfs/runtime/consumers.json` name the `mica-board-*`
family, so the onboarding dry run
(`virt-arm64-proof`) changed nothing in the assembly beyond `deps/` and
`products/`. `tests/lifecycle-uefi/`, `tests/lifecycle-uboot-fit/` and the
API harness are keyed by product; `make product` builds the packager it
runs; every board's minimal product composes and verifies.

## 2026-09-13 13:30 [progress]

Phase 4 of `20260913-0416-board-product-build-architecture`: one product,
one closure. `make product PRODUCT=<name>` (`mica-build:tools/product-build.sh`)
from recipe to signed image under `_out/products/<name>/`, reused by
receipt; `fetch.sh --packages` in `mica-build-env` fetches the product's
closure alone; `check.yml` runs one job per product selected by the diff;
the root carries `/usr/lib/mica/product.conf` and the verifier scopes its
register to it. `docs/design/build.md` §3 and the harness gate map follow.

## 2026-09-13 11:40 [progress]

Phase 3 of `20260913-0416-board-product-build-architecture`: the engine
dispatches on board facts. `board.env` declares the authenticated boot
(`FIRMWARE_FORMAT`, the `FIT_*` facts, the exact command line;
`mica-boards` `build-0ff6d58798cb`); `mica-build:build/src/board-facts.ts`
replaces every branch on a board's name, and `tests/board-name-lint.sh`
holds the line. `docs/boards/board-env.md` documents the keys.

## 2026-09-13 10:30 [progress]

Phase 2 of `20260913-0416-board-product-build-architecture`: an image is a
product. `mica-build:products/<name>/` (`product.env`, `meta/`, optional
`defaults.toml` and `provisioning.toml`), `tools/product.sh` the one reader,
`MICA_PRODUCT` the composer's one input with the old switches refused,
opt-in `--features`, `make os-rootfs PRODUCT=`, eight products including a
minimal one per board (x64-minimal: six packages, 108 MB against x64-dev's
eleven, 198 MB), the factory seed on the ESP, and the smoke runner executing
what a root carries. `docs/design/build.md`, `access.md` and
`provisioning.md` gained the product tier.

## 2026-09-13 08:30 [progress]

Phase 1 of `20260913-0416-board-product-build-architecture`: board contract
v2 and the family layer in `mica-boards` (`f4ad268`, release
`build-f4ad2684729f`) -- `manifests/`, `BOARD_FEATURES`, `BOARD_FAMILY`,
`IMAGE_KINDS`, `families/{uefi,rockchip,amlogic,common}`, every kernel
byte-identical through its family -- and the assembly reading boards out of
their pinned bundles (`mica-build` `46537bc6`): `boards/` and the board
manifests deleted, `make board-fetch`, `resolve.sh --board-dir`, discovery
from the pins. `docs/boards/contract.md` sections 2, 3 and 7 restated.

## 2026-09-13 06:10 [decision]

The repository `micad` is `mica-core` (GitHub and Gitea,
history and releases kept); the daemon, its four packages, its units and
bus names stay `micad`. The user decided it on 2026-09-13 from the
recommendation recorded in `20260913-1600-split-boot-and-boards`.
`mica-core` re-released as `build-c05bec48fa8e` so the archives carry
`Mica-Source-Repo: mica-core`; the assembly pins that release and checks
the source out at `_out/src/mica-core`; the evidence prefix in these
documents is `mica-core:`. The four per-board repositories are deleted on
Gitea; on GitHub the deletion needs the `delete_repo` scope the CLI token
lacks. The `MICA_DEPS_TOKEN` secret stays unset by the user's decision.

## 2026-09-13 05:20 [progress]

`20260913-1600-split-boot-and-boards` complete: `mica-boot` is a
source pin at `boot/` and `mica-boards` (release `build-ec968ea153f7`)
holds every board in one repository, each with its history; the assembly
`mica-build` (`4725877b`) builds no package, imports 27 at their pins and
composes, verifies and releases the x64 image from them. `mica-build-env`
`8860b00cd2b6` accepts a producer-less tree in the pre-flight, the package
gate and the composer, and exempts a shared path for any mutually
conflicting set of packages. The permanent documents cite `micad:`,
`mica-deploy:`, `mica-podman:`, `mica-system:`, `mica-boot:` and
`mica-boards:` paths; the status gate accepts the two new prefixes.

## 2026-09-13 05:20 [pitfall]

`.gitignore` `/meta/` ignores a directory, not a symlink named `meta`: a
link committed from a worktree by `git add -A` replaced the assembly's
ignored `meta/` at the merge, and the development signing material was
restored from the monorepo's identical set. The rule is `/meta` now.

## 2026-09-13 04:35 [plan]

`20260913-0416-board-product-build-architecture` approved on the condition
that implementation starts when `20260913-1600-split-boot-and-boards`
lands. The plan restates the build as three declared axes (board, profile,
product) over one engine with no board name in its source, a SoC family
layer in `mica-boards`, a product directory with three trust tiers
(`product.env`, `meta/`, `defaults.toml`, `provisioning.toml`), one target
per product closure, and every artifact as OCI on GHCR
(`docs/decisions/2026-09-13-ghcr-artifact-registry.md`). The `micad` half
is `20260913-0440-micad-product-defaults`.

## 2026-09-13 15:30 [progress]

Phase 6 of `20260911-2006-split-package-repositories`, the last: the build
variables became `MICA_*`, the builder images `mica-build-*` and the control
fields `Mica-Source-*`, swept through the substrate, the Debian base, the four
package repositories and the assembly, each re-released and re-pinned in
turn; the permanent documents cite the split repositories. The split plan
is complete: `mica-build` composes and verifies the x64 image from seven
repositories' pinned releases and builds only the boards and the image.

## 2026-09-13 13:40 [progress]

Phase 3a of `20260911-2006-split-package-repositories`: `mica-system`
stands alone (release `build-4cd6a0064d68`) and `mica-build` imports its
eight packages (`f6b72253`); `rootfs/` keeps the composer only (`build.sh`,
`compose/`, `packages/`, `runtime/`, `scripts/`, plus the pinned
`debian/`). The board packages depend on the system and radio packages
unversioned across the lock boundary. Every package repository is now
extracted; what remains of the plan is Phase 6, the mechanical rename of
`MICA_*`, the builder images and the provenance fields, begun in
`mica-build-env` `c9174f82d5d9`.

## 2026-09-13 12:30 [progress]

Phase 5 of `20260911-2006-split-package-repositories`: `micad`
stands alone (release `build-3ea7e297ab6f`) and `mica-build` imports its
four packages (`e49b3583`, `c389d7b0`). The API harness stays in the
assembly and pins its phase literals against the OpenAPI document the
`mica-apid` archive now ships; verify reads the wifi reconcilers' contract
out of the pinned micad source. `pkgs/` holds `mica-boot` alone. The
package gate in `mica-build-env` (`19165d01f2ac`) now draws the lock
boundary between origins, so packages released together from one commit
may still pin each other exactly. Proven at `c389d7b0` through the release
gate.

## 2026-09-13 11:00 [progress]

Phase 4 of `20260911-2006-split-package-repositories`: `mica-deploy`
stands alone (release `build-91d0173ecfbb`; the new `mica-lifecycle`
package carries the static `mica-init` and `mica-shutdown`) and
`mica-build` imports both packages (`ee4fa960`). The kernel component
reads the two executables out of the pinned archive instead of compiling
them, the contract fixtures are checked against the pinned source in
`os-pool`, and the Rust gate, the shutdown suite and the IO fault suite run
in the new repository. On the way: `rootfs/packages/resolve.sh` accepts
manifest lines naming what the lock imports (`69a20c70`), and the x64
image pipeline through the release gate passed at both `69a20c70` and
`ee4fa960`.

## 2026-09-13 09:40 [progress]

Phase 3 of `20260911-2006-split-package-repositories`: `mica-podman`
stands alone (release `build-3e8375d5c1dd`) and `mica-build` imports it
through `deps/packages/mica-podman.json` (`f4bbcbdc`); `pkgs/podman`, the
pins test and the `podman*` targets are gone from the assembly. The archive
carries `/usr/share/mica-podman/versions.env` so the assembly's tests read
the engine's versions out of what they install: `tools/podman-pool.sh`
keeps a derived copy beside the pin and `make os-pool` refuses drift;
`tools/deb-member.py` reads a payload member without `dpkg-deb`. The
rename sweep landed as `mica-build` `f9860057` and `89311b8e`; what the
word-boundary sweep missed and the gates found: names glued to shell
variables in the board producers (`mica-${n}.service`), fixtures spelling
the old names behind `\n`/`\t` escapes or without a leading slash, the
`CARGO_BIN_EXE_micad` and `mica_mqtt_reference` identifiers, the
package-prefix ownership rules (`starts_with("mica")` in `system_info.rs`
and `release-manifest.ts`), the `var-lib-mica` and `com\.mica\.` regexes in
`verify`, the wants-links of `mica-health` and `mica-status-led`, the
`/etc/mica-build` builder-image marker (a substrate name, put back), and
the micad `Cargo.lock` order. Proven at `89311b8e`: Rust gate, the offline
suites, x64 compose and smoke (12/12), install-closure gate (99/99),
`os-verify` (104 checks) and the release gate; the package gate reports
only the two known `/etc/fstab` board findings once `mica-podman` is
imported across the lock boundary.

## 2026-09-13 05:20 [progress]

The Mica OS rename sweep (plan section 12) ran over `mica-build` in one
commit: every package (`mica-system`, `micad`, `mica-apid`, `mica-mqttd`,
`mica-mqtt-broker`, `mica-deploy`, `mica-podman`, `mica-busybox`,
`mica-ca-trust`, `mica-profile-*`, `mica-wifi*`, `mica-bluetooth`,
`mica-board-*`, `mica-s905x5m-*`, `mica-bm201-front-panel`), the daemon
and its crates (`micad`, `micad-settings`, `mica-busname`, `mica-ui-bundle`,
`mica-mqtt-reference`, `mica-deploy`), the lifecycle executables
(`mica-init`, `mica-shutdown`), the units and scripts under the root layout,
the bus names (`com.mica.*`) and the root paths (`/usr/lib/mica`,
`/etc/mica`, `/var/lib/mica`, `/usr/share/mica`, `/run/mica`,
`/mnt/data/mica`), with the package directories moved to `pkgs/micad`,
`pkgs/mica-deploy` and `pkgs/mica-boot`. Left with the former project name
on purpose, for later sweeps: the data mount and its units, boot-side
identifiers, partition labels, network interface names, docker stage names,
builder image names and the build variables (Phase 6). `mica-build-env` and `mica-debian` follow in their own
releases (`48592fbdb9b8`, `bacf18dfb65e`).

## 2026-09-13 04:30 [decision]

`mica-build` stays the image assembly and `mica` is this repository: project
management and documentation for every Mica OS repository (user,
2026-09-13). Both forges renamed and the new `mica` created; `docs/` and
the documentation gates moved here from the assembly with their history;
citations of code are `<repository>:<path>`, accepted by the status gate;
the assembly keeps `build/release-verify.md` and
`tests/quadlet-doc/containers.md` as the executed copies its tests read and
points its `AGENTS.md` here. `mica-podman` is republished from `mica-build`
and re-pinned.

## 2026-09-13 03:50 [progress]

`git.ds.cc` is back: the Gitea mirrors are in step with GitHub. `mica-build`
was renamed to `mica`, `mica-debian` and `mica-system` were created, and
`main` of `mica`, `mica-build-env` and `mica-debian` was pushed to the `gitea`
remote of each checkout; every Mica OS repository now has the same name on
both forges, GitHub being `origin`.

## 2026-09-13 03:20 [decision]

Package pins are JSON, one file per package under `deps/packages/`, in the
shape of the Debian pins (user, 2026-09-13): name, source repository, its
commit, and a target per pool with version, architecture, sha256 and the
release asset name. `lock.sh --rows` stays the one reader and prints the
pins as rows, so `fetch.sh`, the package gate, the composer, the lineage
record and the release gate read one shape; `lock.sh --bump` writes and
removes pin files; `rootfs/packages/lock.tsv` was converted to
`deps/packages/mica-podman.json` and retired. The lineage and release tests
and the stub-registry test drive the pin shape and its refusals by file.

## 2026-09-13 02:30 [decision]

Repositories are linked by pins, not submodules (user, 2026-09-13): a JSON
file per source dependency under `deps/sources/` names the commit, the
release asset and its sha256, in the shape of the Debian pins, and the
vendored `tools/deps.sh` fetches it into a gitignored directory (`build-env/`
from `mica-build-env`, `rootfs/debian/` from `mica-debian`),
bumps a pin from a release, and publishes a repository's own source as the
release asset `<repository>-<commit12>.tar.gz`. `make deps`, `deps-check`
and `deps-bump DEP=` wrap it; the Makefile refuses an empty directory with
`make deps`; CI fetches with `MICA_DEPS_TOKEN`; the lineage identity requires
each directory at its pin. The submodules and `.gitmodules` are gone.

## 2026-09-13 01:10 [decision]

Archives are published as GitHub Release assets by each repository's
workflow, not through a package registry of our own (user, 2026-09-13):
one release `build-<commit12>` per source commit, one asset per archive.
`fetch.sh` derives a lock row's asset from its repository and commit and
verifies bytes, the API digest and the control fields; `lock.sh --bump`
downloads a release's `.deb` assets and writes the rows from the archives
themselves; `publish.sh` creates the release on HEAD and uploads with
read-back. `registry.env` names the API, the organisation and `GH_TOKEN`
(`gh auth token` as the fallback). `tests/pool-lock-test.sh` now stubs the
release API (20 checks). The Gitea Debian registry is retired; Gitea remains
a git mirror.

## 2026-09-13 00:20 [progress]

Phase 2 of `20260911-2006-split-package-repositories`: `build-env/` and
`rootfs/debian/` left this tree as `mica-build-env` (14 commits) and
`mica-debian` (20 commits), split with their history and added back
as submodules at the same paths. `tests/deb-package-gate.sh` is now
`build-env/deb/package-gate.sh`, the two Debian tests are
`rootfs/debian/tests/`, and every reference follows. The Makefile refuses an
empty submodule with the `git submodule update --init --recursive` line,
`check.yml` checks submodules out, the host-toolchain and pipefail lints
list submodule files, and `source-lineage.py` requires each submodule
checked out at the recorded commit and clean (tested). Both new
repositories carry README, AGENTS.md, LICENSE and PMA records. Pushed to
GitHub; the Gitea mirrors wait for `git.ds.cc` to come back.

## 2026-09-12 23:30 [decision]

The Mica OS repositories live on GitHub under one organisation: `mica` is the
documentation and assembly repository (this tree; `origin` repointed, the
Gitea remote kept as `gitea`), and `mica-build-env`, `micad`, `mica-deploy`,
`mica-podman`, `mica-debian` and `mica-system` were created private and
empty. Local checkouts go side by side in one workspace directory. The
Debian archives stay on the internal Gitea registry (GitHub has none);
`MICA_SOURCE_URL` now names GitHub. The rename table in the split plan's
section 12 was confirmed; the three retired ARM64 and discarded worktrees
were removed. Nothing was pushed.

## 2026-09-12 23:05 [progress]

Phase 1 of `20260911-2006-split-package-repositories` proven and landed on
main (`5ca946f4` to `de8378cb`, rebased onto the documentation restructure).
`mica-podman` built at `c87bfd1d` was published to the Debian registry under
component `mica-build`, locked by `make os-lock-bump` and, after the local
archives were deleted, fetched back by `make os-pool` and verified against
its rows while `os-debs` skipped the podman producer. From that pool the x64
root composed (198 MB, smoke 12/12), the components, image, `os-verify`
(104 checks) and the release assemble and gate passed with the lock rows in
`provenance.json`; virt-arm64 composed the same way (221 MB, smoke 11 pass,
crun executor-limited). `os-install-closure-gate` 99/99. `tests/pool-lock-test.sh`
drives `fetch.sh` and `lock.sh` against a stub registry. `fetch.sh --check`
uses a ranged GET because the registry answers HEAD with 405; `publish.sh`
gained `--package`; the smoke runner reads the seven-column record; four
diagnostic URL followers were attested in the native endpoint check. The
build ran in the worktree `mica-build` beside the workspace because the main checkout
carried another session's uncommitted work and the stamp rule refuses a
dirty tree. Phases 2 to 6 remain, now with the rename and the `mica-debian`
and `mica-system` repositories folded in.

## 2026-09-12 22:40 [decision]

Recorded task and plan `20260912-2236-phase1-findings` for the seven
pre-existing defects the Phase 1 lock proof surfaced and worked around: the
s905x5m BSP `userland` target builds arm64 on the ambient builder, the three
arm64 board packages share layout files without mutual `Conflicts`, the
native endpoint check attests merged-string neighbours and was red for the
tree's own binaries, the composer's default `MICA_META_DIR` fails the public
metadata validation, two pipefail lint findings, the factory-root gate's
device negative case failing on a root that ships no device nodes, and the
resulting red gate records. Pending approval; fixes come later and do not touch the lock.

## 2026-09-12 21:30 [progress]

Implemented Phase 1 of `20260911-2006-split-package-repositories` inside this
tree, after approval, and closed its Phase 0. Every archive now carries
`Mica-Source-Repo` and `Mica-Source-Commit` control fields written by
`build-env/deb/pack.sh` from values `build.sh` resolves (each producer
Dockerfile declares the two ARGs); `version.sh` reads the new `VERSION` file
and `pkgs/micad/hack/check.sh` asserts the crates agree. The pool has two
classes -- built here at this tree's stamp, or imported by
`rootfs/packages/lock.tsv` at the locked digest and source -- implemented
once in `rootfs/runtime/source-lineage.py`, which lost the fixed producer join
(`join-v1`, `MICA_ROOTFS_*`, every `JOIN_*`/`STARTUP_*`/`GPT_*` constant) and
gained `lock`/`unlocked` in the record; `build/src/release-manifest.ts` lost
the same join and its native-payload verifier, re-checks the record's lock
rows against the tree's lock at assembly, and refuses a `MICA_POOL_UNLOCKED`
image outside the development channel. New `build-env/deb/{registry.env,
registry.sh,fetch.sh,lock.sh,publish.sh,source.sh}`, `make os-pool` and
`make os-lock-bump COMPONENT=`, `MICA_POOL_DIR`; `os-debs` skips a producer
whose every package is locked; `tests/deb-package-gate.sh` is lock-aware
(imports must be their row, exact pins only within a class); `mica-podman`
depends on `mica-system` unversioned and `@SYSTEM_VERSION@` is gone; the
composer reads `micad-build.txt` from the archive's field and
`_out/micad-build-<arch>.txt` is no longer written. Phase 0 findings: the
registry round trip works (201/200/204, custom fields in the index); no
Actions runner is registered anywhere, so publishing is from the developer
machine until one is. Offline suites green (lineage 13, runtime 139, release
71, preflight 19, typechecks, host-toolchain lint, docs-verify); the x64
proof from a fetched `mica-podman` is the next step.

## 2026-09-12 21:25 [decision]

Restructured the documentation system (20260912-2049-docs-restructure).

- Tracking follows `/pma` as written: both index headers use the `/pma`
  templates, index rows are permanent and deleted details are marked `[d]`;
  status values and plan `relatedTask` fields are canonical. The changelog is
  one heading format, newest first.
- Deleted stale records written against the removed RAUC/TUF/raw-slot system
  or already delivered, marked `[d]`: PLAN-037 (roadmap umbrella, superseded
  by current plans); PLAN-054, PLAN-072, PLAN-076 and RFCT-290 (fleet design,
  replaced by the completed protocol plan and 20260912-2058-fleet-runtime);
  PLAN-069 (managed applications, owned by `docs/design/applications.md`, work in
  20260912-2058-managed-applications); PLAN-070 and PLAN-071 (configuration
  seam and automatic updates, implemented; residual acceptance in
  20260912-2058-auto-update-acceptance); PLAN-077, RFCT-305 and RFCT-315
  (RAUC/TUF trust gate, replaced by 20260912-2058-production-key-custody);
  PLAN-086 and RFCT-336 (runtime composition, delivered and continued by
  root-closure-reduction and boot-artifact-size); RFCT-310 (build policy,
  implemented; the remaining fixed job count is
  20260912-2058-fit-sandbox-job-limit); UI-011 (replaced by Vitest/Istanbul
  coverage); RFCT-941 (installer receipt, installer path removed).
- Removed `docs/reports/`; its open findings became tasks, including
  20260912-2058-wifi-no-radio-reconcile. The three 2026-09-08 startup/login
  tasks now read "implemented, acceptance outstanding".
- Layout: `docs/bsp/`, `design/boards.md` and `design/bsp-cx3576-sync.md` are
  `docs/boards/` (`contract.md`, `cx3576.md`, `cx3576-bsp-sync.md`);
  `design/connd.md` is `design/wifi.md`; docs gates moved to `tools/docs/`; the
  bench collector moved to `tests/cx3576-bench/collect.sh`. Deleted the seven
  stale `zh/design/` translations and `zh/research/`; the Chinese UI brief stays.
- Content: prose uses the Mica OS name while identifiers kept the former project prefix; one board
  status table in `boards/support-tiers.md`; STATE/slot/boot-credit vocabulary
  replaced by DATA namespaces and deployments; website storage and recovery
  copy rewritten; deleted-record citations, campaign chronology and milestone
  names removed from permanent documents; `micad.md`, `remote-management.md`,
  `build-harness.md` §7 and `diagnostics.md` aligned with current code;
  `virt-arm64.md` now states `BOARD_RELEASE_TARGET=0` as `board.env` does.
- Gates: `make docs-verify` adds `verify-tracking.sh` (index rows against
  records) and `verify-terms.sh` (stale terms and dead record citations in
  permanent documents); links are now checked in tracking records too, and
  `status: proposed` must cite an open plan or task. Follow-ups outside the
  docs scope: 20260912-2125-source-record-citations and
  20260912-2125-api-slot-vocabulary.

## 2026-09-12 20:50 [decision]

Revised `20260912-2043-unify-board-behavior` at the user's direction: updates
will use ECDSA P-256/SHA-256; boot and verity may use RSA or ECDSA according to
verified target-platform support. This supersedes the original fixed
RSA/RSA/Ed25519 proposal and its blanket preservation of current identities.
The plan now covers explicit key replacement, update signature/public-key
encoding, profile enforcement and rejection tests. No legacy compatibility or
silent algorithm fallback is planned. This revision changes documentation only.

## 2026-09-12 20:43 [decision]

Added draft plan and task `20260912-2043-unify-board-behavior` for shared board
compression, zstd delivery, signing-role checks and lifecycle acceptance. The
proposal preserves UEFI/FIT backends and current trust identities, requires an
ARM64 EFI zboot proof, and keeps physical acceptance distinct from build results.
No implementation is approved or performed by this documentation change.

## 2026-09-12 20:35 [decision]

Closed the remaining signed-file delivery and cx3576 watchdog records at the
user's direction and removed the dead coordination shells; per the index rule
the closed records left the tree.

- Completed and deleted: 20260908-1423-file-ab-signed-components (task),
  20260908-2229-file-ab-delivery-x64-first (task),
  20260908-1428-file-ab-signed-components (plan) and
  20260909-2331-cx3576-boot-watchdog (task and plan). Software delivery is
  complete on x64 and the ARM images are built. Physical CX3576 startup,
  watchdog, recovery and power-cut evidence is not claimed by this closure and
  currently has no record of its own.
- Closed and deleted: 20260909-1421-apid-reboot. The generic dispatch and
  feedback repair is delivered and x64 reboot is proven; the originally
  affected device was never supplied, so that diagnosis is dropped.
- Closed and deleted as abandoned coordination: RFCT-273 and
  20260910-1013-open-plans-campaign (task and plan). The bkd campaign dispatch
  has been inactive since 2026-09-12. PLAN-037 stays as the roadmap umbrella.
- Shipped documents that linked the x64 delivery record now name it as text;
  seven truth-status lines dropped it from their evidence lists and keep their
  other citations.

## 2026-09-12 14:54 [completed]

Completed signed virt-arm64, CX3576 and S905X5M full images and update archives,
plus the S905X5M recovery package. Static checks passed 104/126/105 respectively
(virt-arm64 skips its undeclared Bluetooth policy); QEMU API passed 149/149 and
verified real ARM64 reboot, persistence, poweroff and crun execution. Physical
board acceptance remains unexecuted. Corrected boot-tool architecture/PE
extraction and runtime closure omissions. Reused 21 frozen ARM64 packages and
successful kernel/firmware inputs with verified composition-only lineage.
Task and plan: `20260912-1329-arm64-board-builds`.

## 2026-09-12 14:31 [progress]

On `git.ds.cc`, renamed the assembly repository (under the former project name) to `mica-build` and
created the private, empty repositories `mica-build-env`, `micad`,
`mica-deploy` and `mica-podman` in the same organisation, as the user authorized.
`origin` now points at `mica-build`. No content was pushed; the split
plan's Phase 0 keeps the throwaway registry round trip and the runner check.

## 2026-09-12 14:24 [decision]

The project is now Mica OS; the split plan's repository names follow it:
this repository becomes `mica-build`, the substrate `mica-build-env`, the
package repositories `micad`, `mica-deploy` and `mica-podman` (replacing the
`mica-` names recorded at 14:06). Package, binary and workspace names inside
the tree are unchanged by the plan; renaming the Gitea repository and
repointing `origin` is added to Phase 0.

## 2026-09-12 14:15 [progress]

Repointed `origin` to the assembly repository on `git.ds.cc` and the
`cx3576-alpine` citations in the BSP documents to the renamed organisation.
Rewrote plan `20260911-2006-split-package-repositories` as a current-state
document: the six bindings, the coupling inventory, the probed forge facts,
the `mica-` repository set, the lock and join retirement, gate relocation and
phases; removed the draft narrative, closed decisions and superseded
alternatives, which stay recorded in the 13:57 and 14:06 entries above.

## 2026-09-12 14:06 [decision]

Package repository split: the user chose one repository per package, all
named with the `mica-` prefix (`mica-build-env`, `mica-micad`, `mica-deploy`,
`mica-podman`). Evaluated OCI images against Debian archives as the package
format: both registries exist on `git.ds.cc`, but an image drops the
shlibdeps dependency contract, the install-closure gate, maintainer scripts
and the dpkg ownership that runtime selection and provenance read, while the
lock already gives a digest per archive. Archives stay; OCI remains the
builder-image and composed-root export format.

## 2026-09-12 13:57 [progress]

Revised plan `20260911-2006-split-package-repositories` against `7742a596`,
planning only. Since its first draft the tree gained a fixed producer join
(hard-coded commit, pool, receipt and native-executable digests in
`source-lineage.py` and `release-manifest.ts`), which is the plan's lock
mechanism done once by hand; the plan now retires it in Phase 1 and publishes
`mica-init`/`mica-shutdown` as a `mica-lifecycle` archive. Probed Gitea with the
exported token: version 1.26.1, organisation renamed from `miehq`,
Debian registry enabled and empty, no target repositories yet. Coupling
inventory re-counted at 100 files. Approval still pending.

## 2026-09-12 13:49 [progress]

Opened task and plan `20260912-1347-root-closure-reduction` from the
root-closure research report, planning only. The plan re-measures the current
x64 dev root (200.4 MB unpacked, 71.2 MB shipped) and records eight
corrections to the report: the health gate fails rather than skips without
curl, purge residue is down to one path, the five Rust binaries span two
workspaces, a multicall crosses four packages, `gconv` exclusion needs both
`select.py` and a pack script, and the curl, openssh-client and iptables items
fall under the declined PLAN-086 S5. In scope: micad release profile with a
measured multicall prototype, `gconv` exclusion, e2scrub and `dpkg-realpath`
removal. Awaiting approval.

## 2026-09-12 13:45 [decision]

Pruned the settled tracking records identified by the plan and task audit
(`docs/reports/20260912-plan-task-audit.md`): 53 plan and 93 task detail
files whose own status heads read completed, closed or rejected left the tree
with their index rows, per the index rule that a finished record is deleted.
Every record remains in git history
(`git log --diff-filter=D -- docs/plan/ docs/task/`). No open record was
closed or reclassified; the audit's remaining obligations (current ARM and
physical-board qualification, independent cold-build comparison, Bluetooth
peer traffic, storage power cuts, the no-radio Wi-Fi diagnostic, fleet
runtime, managed applications and the repository split) stay with the open
records and the audit report.

- Completed plans: PLAN-078, 080, 085, 087, 088, 089, 911, 914, 917-926,
  20260908-1702-pma-project-injection, 20260910-0047-cx3576-hdmi-fullscreen-logo,
  20260910-0159-cx3576-uboot-console, 20260910-0517-writable-var-regdb,
  20260910-0555-apid-spa-interaction-refactor, 20260910-0559-s905x5m-current-system,
  20260910-0616-cx3576-storage-display-cleanup, 20260910-0726-unlimited-application-data,
  the C slices (20260910-1012 x2, 20260910-1046 x2, 20260910-1050 x3,
  20260910-1221-c-offline-fleet-config), 20260910-1013-b0-lifecycle-rootfs-audit,
  A1-A4 (20260910-1014), B1 (20260910-1038), B2 (20260910-1142), B4 (20260910-2100),
  B5 (20260910-2152), B6 (20260911-0110), 20260912-0614-development-workflow, 20260912-1113-remove-build-resource-limits
  and 20260912-1123-clean-x64-diagnosis.
- Rejected or closed plans: PLAN-910, 913, 915, 916 and B7
  (20260911-0145-b7-fresh-lifecycle-acceptance, canceled; the clean-x64
  record delivered the bounded x64 acceptance in its place).
- 20260910-0341-minimal-boot-shutdown (draft) was rejected and deleted as
  superseded: the native static startup/shutdown route under
  20260911-1927-boot-artifact-size replaced the BusyBox payload, as the audit
  records for B1/B2; reintroducing BusyBox would reverse current work.
- Completed tasks: RFCT-334 (completed but unindexed; deleted rather than
  re-indexed), 335, 343-360, 910-915, 917-920, 923, 924, 927-931, 933,
  935-939, 942, 943, 946, 947, and the timestamped records paired with the
  plans above plus 20260908-1712 P1-A/P1-B, 20260908-1727-status-gate-plan-naming,
  20260908-2115-p2-descriptor-contracts-x64, 20260909-2358-cx3576-system-1g,
  20260910-0040-strict-file-ab, 20260910-0254-cx3576-integrated-image,
  20260910-0338-minimal-boot-shutdown, 20260910-0350-cx3576-latest-boot-review
  and 20260910-0836-apid-ui-chunk-split.
- Closed tasks: RFCT-921, 926, 932, 944, 945 and the B7 task.
- Kept although completed: 20260910-1910-fleet-device-plane-protocol. It is
  the only normative home of the fleet protocol design (N1-N10) and
  `tests/fleet-protocol/fixtures.md` cites it as the contract; it stays until
  that design moves under `docs/design/`. Its task record was deleted.

Links to deleted records in `docs/changelog.md`, `docs/bsp/`, `docs/reports/`,
`tests/` and the open records became bare names. Three `cx3576-bench.md`
evidence citations dropped the deleted A2 and storage-cleanup records; the
document-level line now cites `docs/bsp/cx3576.md` and
`tests/cx3576-bench/collector-test.sh`. `rootfs/runtime/source-lineage.py`
and `build/src/release-manifest.ts` still name the B7 records in their frozen
producer-transition allowlists; those describe historical commits and were
left unchanged. Recorded under 20260912-1341-prune-settled-records.

## 2026-09-12 13:36 [fix]

ARM64 UEFI components now select the ARM64 boot-tools image for packaging and
record that image in kernel identity. A firmware-invocation regression failed
before the fix and passed afterward. Removed fixed bootloader Ninja job limits
under the existing build-resource policy. Docker route, native-payload, display
and startup archive checks passed. ARM/board production acceptance is pending.

## 2026-09-12 11:57 [verification]

Completed the fresh main x64 build at `a6b7b55c6183` using pinned Docker tools
and new development identities in ignored `meta/`. Produced the signed complete
image and update archive; root smoke passed 12/12 and real API acceptance
151/151. Native shutdown/QMP actions, same-VM reboot persistence, storage,
component update/fallback and all three interrupted-reset tiers passed.
The clean-x64 task records exact artifact hashes, measured sizes and evidence.
No-radio Wi-Fi reconciler errors remain a diagnostic follow-up. ARM, physical
hardware and unexecuted fault matrices are not covered by this result. No push.

## 2026-09-12 11:33 [progress]

Added `make os-keys-init` for idempotent development signing initialization in
`meta/`, using the existing three-domain generator in Docker. Existing keys
are validated without replacement; partial, mismatched, symlinked and unsafe
permission inputs fail. Fresh/repeated/concurrent and refusal tests passed,
as did documentation, shell and host-toolchain checks. A new development
identity was generated locally for the clean x64 rebuild; keys remain ignored.

## 2026-09-12 11:23 [decision]

The user canceled handoff continuation and requested a clean current-main x64
rebuild. Removed the handoff document and replaced B7 execution diaries with
closure notices; old dispatch instructions are inactive. Old filesystem outputs
were moved outside the project after force-removal was rejected. Dedicated Mica OS
Docker cache, containers and compiled images were removed. Product source edits
remain intact; no historical or new runtime acceptance is inferred.

## 2026-09-12 11:14 [decision]

Removed fixed Docker CPU/memory/swap caps and the four-job Cargo override from
the deploy builder and boot/shutdown fixture runner at the user's request.
The project build policy and handoff now supersede historical B7 resource
envelopes, job ceilings and reservation requirements; historical execution
evidence remains intact. Shell syntax, local diff review and all five
documentation checks passed. No full rebuild was needed.

## 2026-09-12 10:19 [progress]

Reviewed GPT startup/source-admission changes and their accepted root/signature
records are merged into main at `4a451011`. The user requested continuation on
a new development machine. The L1 watchdog is paused and its read-only turn
was stopped; no build or guest was interrupted. The development handoff (subsequently removed)
records remaining components, x64/ARM/physical acceptance, the stale two-job
memory reservation, source/artifact identities and transfer requirements.
No incomplete acceptance result is promoted to PASS.

## 2026-09-12 06:16 [progress]

**Development source integration and workflow**

Reviewed native startup/shutdown, explicit runtime composition and campaign
cleanup are integrated into local main. Source review, signed-image production
and full runtime qualification now have separate status. The existing x64
candidate remains immutable while its guest acceptance continues.

The development runbook batches preflight checks, reuses unchanged verified
producers and resumes affected stages automatically. One half-hour campaign
watchdog replaces duplicated periodic review scanning; recovered fixture or
transport errors retain evidence without requiring individual approval.

## 2026-09-10 11:11 [progress]

D2 reconciled the bounded open task/plan set for campaign
`mica-open-plans-20260910-100408` without changing product code or current
architecture/design wording.

The dangling index-only task
`cx3576-reproducible-bsp-20260907T1356Z` and plan
`cx3576-reproducible-bsp-20260907T1400Z` were introduced together by
`dfe16aca45fd66ccea766cbe31d5facf0787ff4a`; neither detail path has any blob
in reachable history. PLAN-087 identifies the plan as an untracked draft from
issue `69d0bv7y`, reconciles its measurements and scope, and records completion
through RFCT-343 and RFCT-345. Both dangling rows were therefore removed rather
than fabricated or restored.

PLAN-037 remains an implementing, non-executable coordination umbrella owned by
campaign D (`bkd/z36xbrtu`). Its dated RAUC/TUF and raw-slot roadmap text is
explicitly historical; current execution follows the strict signed-file
contracts. PLAN-086 and RFCT-336 now truthfully identify campaign B ownership
of remaining S3/S6 work. The user's 2026-09-08 decision is unchanged in meaning:
**S5 was declined, not deferred and not owed; the slice is out of the plan.**
The separate BusyBox boot/shutdown work does not authorize general
shell/network-tool reduction, outbound-SSH removal, or PAM/NSS/crypto pruning.

Historical S905X5M records were reconciled against current signed-file task
`20260910-0554-s905x5m-current-system` and plan
`20260910-0559-s905x5m-current-system`. PLAN-910, PLAN-913, PLAN-915 and
PLAN-916 are closed as superseded; PLAN-911 is completed by its recorded
hardware smoke result; PLAN-912 retains the real controlled-peer gap with no
invented owner. RFCT-915 and RFCT-335 are completed. RFCT-921, RFCT-926,
RFCT-932, RFCT-944 and RFCT-945 are closed as superseded. RFCT-922 remains
pending and unassigned for a controlled-peer run on a fresh current image.

Four obsolete task details left the tree with their index rows: RFCT-916
(`Declare the shared kernel surface for container networking`) had completed
historical PLAN-911 evidence and an obsolete M2/RAUC deployment path; RFCT-925
(`Decide the tree-wide FIT verified-boot design`) is superseded by the current
required signed-FIT contract; RFCT-934 (`Prove the s905x5m A/B watchdog and
rollback on hardware`) used the removed RAUC/raw-slot path, while its physical
watchdog/power-cut gap remains open in the campaign; RFCT-940 (`The installer
card blocks Linux boot on a board it already installed`) already said it was
fixed and proven on hardware. Its full evidence remains in Git history.
RFCT-941 (`The installer reinstalls on every boot because its receipt never
persists`) is also fixed and proven, but remains because the current S905X5M
board dossier links to its evidence; its link to deleted RFCT-940 became a bare
historical ID. Current S905X5M physical installation, boot, peripheral,
watchdog, recovery, power-cut, shutdown, MQTT and native-container obligations
remain explicitly unassigned and blocked on a fresh newest-image bench run in
the campaign record; historical evidence was not relabeled as current proof.

PMA lifecycle transitions used `task-state.sh`: RFCT-273 and RFCT-336 were
unclaimed from their stale owners and claimed by the current D and B
coordinators; RFCT-335 and RFCT-915 were completed; RFCT-921, RFCT-926,
RFCT-932, RFCT-944 and RFCT-945 were closed; RFCT-922 was unclaimed. Serializer
rejections for legacy noncanonical records are preserved verbatim in the
campaign task. No owner/status field was hand-edited after a rejection.

## 2026-09-10 10:39 [progress]

L1 supplied the user-authorized `#313` S905X5M source handoff, superseding the
10:31 no-commit state for current dependency decisions while preserving it as
chronology. Exact local commit
`5d0dca577a782aa707d9530779c4b23f2a7eda31`, tree
`a8b079edc67010b6662b2243a5647950eb7176ef`, and parent
`5c61f7fbb5589807e931e981b3ef8cb9bdff8b6d` carry the subject
`feat: integrate s905x5m with signed-file boot and SD images`. The approved
scope has 108 changed paths, 105 after rename detection; L1 verified its 1,730
source-record entries against canonical `sourceSha256`
`5eab1647263866e310b98999e9d5df063aa6bbe3248fc8a0bd7ee7a907c75b42`.
`main` was clean after the local commit, no push occurred, and `#313` reports
no remaining implementation, build, cleanup, or source lock.

Immutable `committed-source.json` maps 1,727 committed files/links plus three
deletions to the complete tree and has SHA-256
`ce4330ed3845acf77e5e7f061d62255761eed80d21172211139ca7dc6180cd7c`.
The original source record and 56-entry artifact manifest remain byte-for-byte
unchanged. Existing artifacts remain source-equivalent pre-commit
dirty-stamped development builds with `BOARD_RELEASE_TARGET=0`, not rebuilt
clean artifacts or hardware evidence. Physical S905X5M rows and the separate
complete eMMC installer milestone remain open.

D1 did not synchronize source. At D's next safe boundary, L2 may take only the
exact approved commit into its clean branch; D2 must then use the integrated
local `bkd/z36xbrtu` HEAD. D3's `#313` source dependency is satisfied, but D3
still waits for reviewed A/B/C handoffs and ordered final reconciliation. The
registry also records reviewed B0 commit
`488b8d68b240ae818dc4b763c46ed7b7f9904129` without claiming it is integrated
into B. Grants remain L3 A/B/C/D=2/1/2/1 and expensive A=1, B/C/D=0, with the
second expensive slot unallocated at L1. No main merge, push, publication, or
`done` transition is authorized.

## 2026-09-10 10:31 [progress]

D1 incorporated the campaign's timestamped coordination evidence without
changing sibling-owned records. L1 observed the unique A/B/C/D 15-minute crons
`gf4aphxr`, `nkglvdlt`, `w8lj5nbz`, and `v2kr5k8p` enabled and nondeleted at
2026-09-10 10:14–10:15 UTC. The registry now records A1–A4, serial B0–B7, and
C1–C2 ownership, dependencies, models where supplied, owned paths, grant use,
and verification boundaries. Their running and todo states remain timestamped
observations; D owns only later global index/changelog reconciliation and does
not reset their task or plan states.

`#313` / `4ay6q72f` reported S905X5M implementation and offline acceptance
complete and released implementation ownership, but its 108 delivery changes
remain dirty and unstaged on `main` at source base
`5c61f7fbb5589807e931e981b3ef8cb9bdff8b6d`. No approved commit/tree handoff
exists. L1 validated the 1,730-entry source record with canonical
`sourceSha256` `5eab1647263866e310b98999e9d5df063aa6bbe3248fc8a0bd7ee7a907c75b42`
and reverified the 56-entry artifact manifest; these remain read-only dirty
evidence, not synchronized source or hardware acceptance. D3 and B1 stay
blocked on L1's exact approved committed identity.

The recorded S905X5M artifacts retain development signing and dirty identities;
no hardware was flashed and `releaseTarget=false`. Every physical-board row
remains pending. `#313` retains its completed delivery records for eventual
preservation. Its unused reserved expensive position returned to L1's
unallocated pool; grants remain A=1 and B/C/D=0 until reassigned. No `main`
merge, push, compatibility fallback, product implementation, image build, or
hardware claim was performed by D1.

## 2026-09-10 10:24 [progress]

**S905X5M signed-file development images**

The S905X5M port (20260910-0554-s905x5m-current-system) now produces
current signed SD images using paired Mica OS firmware in eMMC boot0. Native records
at 120/124 MiB, required FIT verification and independent firmware receipts
replace the retired cfgload/raw-slot path. Root/kernel updates preserve firmware;
only DATA grows. Wi-Fi and Bluetooth remain independently selectable, with shared
SDIO transport, protected pairing state and an optional BM201 front panel.

The kernel embeds content/regulatory trust and fixes the vendor watchdog for
userspace ownership, a 60-second timeout and NOWAYOUT. Final firmware/FIT and
content signatures, 104 offline image checks, interrupted transactions and real
DATA-only growth passed. ARM64 root smoke has 11 passes and one known crun
emulator limitation. Physical board acceptance remains pending and the board is
excluded from qualified releases. No compatibility migration is supplied.

## 2026-09-10 10:13 [progress]

Campaign `mica-open-plans-20260910-100408` established its task, implementing
plan, and ownership registry under L1 `#314` / `10nksom6`, with D coordinated
by `#318` / `z36xbrtu` and the campaign task serialized to stable owner
`bkd/z36xbrtu`. A (`#315` / `6064wf7l`), B (`#316` / `8t4ghqi6`), and C
(`#317` / `58sdocnk`) retain their bounded workstreams; external active owner
`#313` / `4ay6q72f` retains S905X5M integration. The integration branch is
`main` and the committed source base is
`5c61f7fbb5589807e931e981b3ef8cb9bdff8b6d`.

The approved charter covers parallel dispatch, scoped local L3 commits, and
L3-to-L2 merges, but no L2-to-`main` merge, remote publication, or `done`
transition. Fresh newest-image flashing is the development target; historical
compatibility readers, migrations, RAUC restoration, raw-slot paths, and old
update-package support remain out of scope. D1 records tracking only. D2 waits
for D1 to merge into `bkd/z36xbrtu`; D3 waits for D1, D2, and L1's exact
approved sibling/`#313` commit and lifecycle evidence before global
reconciliation. PLAN-037 remains a non-executable umbrella, and PLAN-086 S5's
2026-09-08 rejection remains in force alongside the separate allowed BusyBox
startup/shutdown plan.

Initial active L3 grants are A=2, B=1, C=2, D=1 (maximum six). Expensive-build
grants are A=1, B=0, C=0, D=0 (maximum two, with one position reserved while
`#313` builds); D performs no full image build. Missing indexed CX3576 records,
removed RAUC/TUF references, and PLAN-086 lifecycle divergence remain explicit
D2/D3 obligations. No product implementation, image build, hardware proof, or
historical reconciliation is claimed by this entry.

## 2026-09-10 08:44 [progress]

**Split apid console chunks**

The approved bundle split (20260910-0836-apid-ui-chunk-split) groups the
console's vendor libraries into React, Base UI, router and i18n chunks that the
browser fetches and compiles in parallel, and removes a route re-export that had
hoisted the whole system page into the entry. The entry chunk falls from 594 kB
to 106 kB and no chunk trips Vite's size warning. On an appliance the saving is
parse and compile time on a weak core; the bundle is served from local flash, so
transfer was never the cost. The policy gate now refuses a route module that
exports anything but its route, which is the mistake that caused the hoist.

## 2026-09-10 08:43 [progress]

**apid console rebuilt on the shadcn registry**

The approved console refactor (20260910-0555-apid-spa-interaction-refactor) (20260910-0555-apid-spa-interaction-refactor)
replaces the hand-written component layer with shadcn `base-nova` primitives over
`@base-ui/react` and extracts a shared composite library the feature pages
consume. Sixteen registry primitives were added through the CLI and fifteen
composites built on them; `src/components/`, the duplicate `cn`, the `lib/api`
re-export and 500 of 591 stylesheet lines are gone, and the remaining stylesheet
carries only tokens, in oklch, plus two decorative marks. No dependency was
added: the toast is `@base-ui/react/toast` through the registry's own wrapper.

Eleven confirmations had each re-derived the same interaction and ten never
closed their dialog, because `base-nova` leaves closing to the caller by design;
they are now one `ConfirmDialog` that owns the close, the pending state and the
report. Every write reports success as well as failure through one toast
channel, replacing 94 inline callouts of which only eight ever said a write had
worked. Dialogs are bounded by the viewport and scroll their own body, so a
1024x520 panel no longer clips the title off the top and the buttons off the
bottom. The language picker left the header menu, which used to stay open behind
its own backdrop.

`verify-ui-policy.sh` now enforces the library rule in `build.sh --check`: no
forbidden UI ecosystem, no hand-written primitive, no raw control or colour
literal in a feature, and one component tree. Coverage measures the application
rather than a seven-file allowlist — 82% of statements over 1,593, against a
previously reported 97% over 208. Tests went from 154 to 232, plus 22 browser
cases; three visual baselines were regenerated for the deliberate `base-nova`
spacing change. Two defects were found by browser measurement during the work: a
menu label outside a group crashed the settings menu, and the header controls
rendered white on white.

## 2026-09-10 07:45 [progress]

**Latest CX3576 boot-log assessment**

The new serial-log assessment (20260910-0350-cx3576-latest-boot-review) binds `_out/tio.log` to
generation 8 of the integrated image and observes management/API startup and
health completion. It identifies missing rfkill state storage and a confirmed
regulatory-database signer mismatch; the matching upstream pair passes offline
trust validation. GPU IRQ lookup and NPU/IOMMU overlap are distinguished from
unproven hardware failures. Existing board cleanup, radio/accelerator workloads
and reboot/watchdog qualification remain open. This is analysis only.

## 2026-09-10 07:45 [progress]

**Writable var and matching regulatory database**

The approved storage and regdb repair (20260910-0517-writable-var-regdb) (20260910-0517-writable-var-regdb)
binds all of /var to DATA/var, replacing per-systemd-state and var-tmp mounts.
General variable data shares a project budget of one eighth of DATA, capped at
256 MiB and 16384 inodes, with minimum limits of 32 MiB and 2048 inodes.
Identity, management credentials and native metadata retain protected storage.
The BSP exports its built-in regulatory certificates, and support packaging
verifies the pinned upstream database/signature pair against them before
publication. Unknown-signer and tampered-database checks refuse output.

Two signed boots each on x64 and ARM64 pass new StateDirectory creation, var
persistence, real quota exhaustion, protected reserve writes and complete exitrd
teardown. ARM64 full-system crun execution closes the qemu-user smoke limitation.
Build/verifier suites pass 389/645 tests; 22 Rust storage tests, fmt/clippy and
documentation checks pass. The timestamped 1,299 MiB CX3576 image passes all 124
offline checks, required FIT signature negatives and flash geometry. The task
records the exact artifacts; physical board rfkill/regdb acceptance remains open.

Campaign-level record, one entry per plan, newest first. Details live in the
plan file and the task records it names; this file holds the one-paragraph
history a reader can scan without opening either.

## 2026-09-10 07:45 [progress]

**Independent container storage and CX3576 presentation**

The approved continuation (20260910-0616-cx3576-storage-display-cleanup) (20260910-0616-cx3576-storage-display-cleanup)
gives container images, layers, volumes and download temporary files a dedicated
DATA directory, bind and project quota. Three bounded byte/inode budgets preserve
the system reserve without double-counting capacity. Private mount propagation
keeps protected state/container mounts out of physical reset paths. The HDMI
bitmap now shows centered YBO - Hub OS with a surrounding gradient; Alt+F2 selects
an authenticated tty2 while tty1 stays idle. Source-proven camera/TEE/Mali/IRQ,
autofs and FIT metadata fixes are included, retaining upstream matched regdb.
Two signed boots per x64/ARM64, all three interrupted reset tiers and 125 CX3576
offline checks pass. Physical display, radio and accelerator qualification remains
open; returning from the console does not yet redraw the kernel logo.

## 2026-09-10 07:45 [progress]

**Unlimited system, user and container data**

The quota correction (20260910-0726-unlimited-application-data) removes byte and inode limits
from /mica, /srv and container storage while retaining independent directories
and project accounting. Only the variable-data project remains bounded. There
is no aggregate quota-backed DATA reserve. Focused layout and real ext4 writes
verify the new policy; previously delivered flash images retain their old limits.

## 2026-09-10 03:48 [progress]

**cx3576 boot-log repair planning**

The [repair plan](plan/20260910-0029-cx3576-boot-log-cleanup.md) classifies the
historical boot diagnostics, records disconnected HDMI as expected, and covers
board configuration, FIT descriptions, and current-image physical acceptance.
Exact archive accounting confirms that the released 32.1 MiB initramfs includes
a separate 16.45 MiB shutdown payload retained by the runtime design. The plan
distinguishes Linux fixes from vendor BL31 limitations; implementation remains
pending approval.

## 2026-09-10 03:48 [progress]

**Restore the standard CX3576 U-Boot console**

The approved console repair (20260910-0159-cx3576-uboot-console) restores
the native one-second any-key countdown in the Mica OS firmware. Timeout and `boot`
execute the registered `micaboot` signed deployment command; entering the console
does not consume a trial. The early pre-CLI bypass is removed, with native
countdown/command and firmware I/O regressions. The
[development console policy](design/uboot-ab-handshake.md#development-console-policy)
requires an explicit user request before removing this standard entry.
The rebuilt loader and a candidate retaining the HDMI repair pass required FIT
signature checks, all 123 offline image checks, flash geometry and checksum.
The delivery record (20260910-0159-cx3576-uboot-console) identifies the
artifacts; physical UART/HDMI acceptance remains untested.

## 2026-09-10 03:43 [progress]

**Minimal BusyBox boot and shutdown feasibility**

The feasibility assessment (20260910-0338-minimal-boot-shutdown) records a
draft replacement (20260910-0341-minimal-boot-shutdown) for generic startup tools and the
retained shutdown environment. Signed Rust boot policy remains necessary, and
BusyBox does not supply the device-mapper helpers. The current ARM64 shutdown
payload is 16.45 MiB; the existing dmsetup closure alone is 4,765,416 bytes.
Command differences and boot/shutdown acceptance are recorded before any code
change. Implementation approval is pending; concurrent board repairs remain
unchanged.

## 2026-09-10 03:13 [progress]

**Integrated cx3576 image and boot-log review**

The integrated image task (20260910-0254-cx3576-integrated-image) combines
current strict A/B root/init with the centered HDMI logo and native U-Boot console
repairs. The timestamped 1,299 MiB image preserves 1 GiB SYSTEM and passes 389
build tests, 123 offline checks, FIT signature negatives and DATA-only growth.
Source hashes and reused component identities are recorded with the image.
Review of the existing boot-log proposal confirms remaining board/config/FIT
items and updates the initramfs measurement; accelerator and physical acceptance
remain separate. The pre-existing `embed-trust.sh:15` shell-lint failure remains
explicit. Other owners' changes and the draft cleanup plan are preserved.

## 2026-09-10 01:02 [progress]

**Strict two-deployment file A/B replacement**

The approved replacement task (20260910-0040-strict-file-ab) replaces old
inactive B only after authenticating the new inputs and confirming running A.
Native records retire B before collection; shared components survive, and new B
is activated only after durable publication. Both FIT environment copies forget
retired objects. Factory and runtime capacity checks budget two deployments,
including measured ext4 overhead. Native tests cover 549 interrupted/error cases,
transaction restart and replacement-only space availability; Rust/build suites
pass 46/385 tests. Clean-source x64 and ARM64 guests pass signed startup, component
updates, three-trial fallback and DATA archive retirement-failure recovery. The
1,299 MiB cx3576 image passes 123 offline checks, required FIT signatures and
DATA-only growth; SYSTEM is 1 GiB with 197 MiB allocated. The task records the
pinned source, reused BSP kernel and image checksum. Physical P10 remains open.

## 2026-09-10 00:51 [decision]

The user narrowed `20260910-0047-cx3576-hdmi-fullscreen-logo` to one centered
CX3576 HDMI logo with no cursor and approved implementation. The earlier
fullscreen-scaling and late-logo-lifetime proposal is superseded by correcting
the effective kernel command line and its authenticated packaging policy.

The implemented fix embeds `fbcon=logo-pos:center,logo-count:1` and
`vt.global_cursor_default=0` in the forced kernel command line, with matching
packaging and board declarations. Four regressions reproduce the original defect
and pass after the repair; all 388 build tests pass. The rebuilt kernel contains
the policy and its signed 1,299 MiB candidate image passes required FIT signatures,
123 offline checks, flash geometry and checksum validation. The
delivery record (20260910-0044-cx3576-hdmi-fullscreen-logo) identifies the
image and reused root/firmware inputs. Physical HDMI display remains untested.

## 2026-09-10 00:23 [progress]

**cx3576 SYSTEM reduced to 1 GiB**

SYSTEM is now 1024 MiB and DATA starts at 1042 MiB. Firmware layout validation,
flash preflight/readback and the board package's runtime repart limits use the
same geometry. The full ARM64 package pool, signed root and firmware are rebuilt;
the complete image is 1299 MiB, down by 1 GiB. SYSTEM uses 197.0 MiB including
filesystem overhead and has 827.0 MiB free. All 384 build tests, 123 offline
checks, signature negatives, flash readback fixtures and real DATA-only growth
pass. The completed task (20260909-2358-cx3576-system-1g) (20260909-2358-cx3576-system-1g)
records exact artifacts, sources and the initial loop-device test failure; the
completed plan with the same ID is consolidated there and in current layout docs.
Physical board acceptance remains pending.

## 2026-09-09 23:55 [progress]

**cx3576 boot watchdog repair**

The RK3576 clock driver now enables the watchdog clocks needed by DesignWare
probe, fixing the pre-Linux `required boot watchdog unavailable` stop. Probe and
start failures report their errors before storage access or attempt consumption.
RockUSB recovery runs cyclic watchdog service while waiting for USB. Pinned-source
regressions reproduce both defects and pass after repair. The rebuilt complete
image passes FIT signature negatives, 123 offline checks and flash geometry; the
task (20260909-2331-cx3576-boot-watchdog) identifies its exact artifacts
and component sources. Bench instructions reflect the enabled SYSFS/NOWAYOUT
configuration. Physical startup and watchdog acceptance remain pending.

## 2026-09-09 17:37 [progress]

**Timestamped factory images**

Factory image publication now uses `mica-BOARD-YYYYMMDD-HHmmss.img` with UTC
build time to the second. Release packaging preserves and validates the name in
its manifest, checksums and provenance; cx3576 flashing selects the newest
matching image by default. The existing cx3576 handover uses its actual
`20260909-164233` build time with unchanged bytes and source identity. All 384
build tests, real image CLI output, release verification and flash selection
checks pass. The completed task and plan `20260909-1725-timestamped-factory-images`
are consolidated into the delivery record (20260908-2229-file-ab-delivery-x64-first)
and current build/install documentation to avoid retaining obsolete work records.

## 2026-09-09 16:47 [progress]

**Clean cx3576 image rebuild**

Deleted the generated `_out/` tree at the user's request and rebuilt the complete
cx3576 image from clean commit `38f2a37b9a3c`, including the apid power feedback
repair. The image passes all 123 offline checks, required FIT signature negatives,
flash geometry, DATA-only growth and the 14-artifact release gate. Root smoke
reports 11 passes and the existing crun qemu-user limitation. Earlier generated
images and transcripts were removed; the delivery record (20260908-2229-file-ab-delivery-x64-first)
identifies the new artifacts and preserves the distinction from pending physical
board acceptance.

## 2026-09-09 14:54 [progress]

**Power action feedback**

Apid now waits for micad to admit a reboot or power-off request before answering
202. Refusals return 409 with the reason; failed dispatch, an unavailable daemon
and an unconfirmed timeout retain explicit backend error responses. The dashboard
closes its confirmation dialog so success and failure remain visible, and avoids
automatic power retries. Reboot interlocks are unchanged. Regression tests cover
admission, refusal, failure, timeout, confirmation and cancellation; the full Rust
and frontend gates pass. The investigation (20260909-1421-apid-reboot)
records fresh-image browser evidence and the unresolved original-device context.
The completed focused plan `20260909-1425-apid-power-feedback` is consolidated
into that open investigation rather than retained as an obsolete plan entry.
Fresh x64 acceptance verifies a visible 409 refusal, admitted reboot, distinct
boot IDs, reauthentication and admitted power-off, with complete exitrd cleanup
on both shutdowns. Both architecture package pools were rebuilt at one source
stamp; the physical device's specific failure still needs its access details.

## 2026-09-09 14:07 [progress]

**Signed file-based deployments**

Documentation cleanup replaces the accumulated API/dashboard proposals
(PLAN-039/040/060/061/062/066), recovery narrative (PLAN-048) and build-harness
history with current contracts at their existing design paths. Superseded
Chinese engineering translations now link from the language portal to the
authoritative English pages; the current Chinese user guides remain. The old
exported `docs/zh/design/mica-ui` prototype, its ZIP and duplicate uploaded brief
are removed after the shipped React implementation replaced them. The separate
product design brief remains. Git history retains removed content; no obsolete
operational instructions or compatibility stubs are kept in the active tree.

Replaced the raw-slot RAUC/GRUB installation model with independently signed
firmware, kernel/support and rootfs components. Fresh images use three GPT
partitions, authenticated native boot attempts, serialized file installation,
health confirmation and retained fallback. DATA owns persistent state and
quota-limited writable leaves; var parents stay immutable. Server, API, device
UI, release packaging and current user documentation use the new contracts.
Earlier layouts, update protocols and migration paths are removed. Independent
S905X5M BSP sources remain, with its superseded Mica OS image producers retired.

QEMU, kernel/firmware signature negatives, transaction fault injection and
current-image integration provide software evidence. Kernel panic testing found
and fixed first-boot TLS identity durability. cx3576 firmware/FIT/image packaging,
offline verification and DATA-only growth pass; physical startup, watchdog
handoff and storage power-cut qualification remain pending bench access. The
implementation plan (20260908-1428-file-ab-signed-components) and
delivery task (20260908-2229-file-ab-delivery-x64-first) track the exact
artifacts, completed checks and remaining acceptance work.

Final software acceptance passes on x64 and virt-arm64, including all three
interrupted-reset tiers, panic/watchdog and pre-SYSTEM hang fallback, offline
boot at wrong clocks, and latest factory API runs (153/151 combined checks).
The x64 sampled installation-space run also passes all three update types and
subsequent boots. Cleanup gates include 644 verifier tests, 150 frontend tests,
both Rust workspace gates and document/negative-fixture checks. Physical
cx3576 acceptance remains the outstanding P10 requirement.

## 2026-09-08 21:50 [progress]

P2 of `20260908-1428-file-ab-signed-components` is complete locally after the
user resumed work following P1 review. Rust and Bun share strict signed
component contracts and golden negatives; support identity binds all verity
metadata. The server's Ed25519 signer is shared with build tooling, root hashes
use pinned RSA/SHA-256 PKCS#7 signing, and BSPs require explicit public trust
inputs instead of silently minting keys. x64 QEMU accepts the anchor before
validity and after expiry; built-in-key revocation returns EACCES. Replacement
kernel rotation remains P9. Build 1,028, focused contracts/signing 42, Rust 68
and server 36 tests passed, along with the compiled server, docs and relevant
shell/trust gates. Record `20260908-2115-p2-descriptor-contracts-x64`; P3 is next.

## 2026-09-08 21:06 [progress]

P2 (x64) of `20260908-1428-file-ab-signed-components` dispatched: `ofu05clu`,
record `20260908-2105-p2-descriptor-contracts-x64`. Watchdog cron replaced to watch it.

## 2026-09-08 21:04 [progress]

P1-A of `20260908-1428-file-ab-signed-components` merged, completing P1: the
feasibility gate passed on every proof without weakening a requirement. The
kernel floor now embeds a verity trust anchor and requires the root-hash
signature check, the contract reads it back, and the signed-boot lab is on the
tree. Two shell lints that the P1-B merge had left red on main were fixed in
the same step. P2 (frozen artifact/descriptor contracts) is dispatched for x64.

## 2026-09-08 20:22 [progress]

P1-B of `20260908-1428-file-ab-signed-components` merged: the x64 writable-path
contract (14 leaves, 25 paths with no writer), the random-seed file bind proven
across start, shutdown and reboot, the container-network destination under
`/mica`, and the change list P5 inherits. L1 reproduced the static audit and one
candidate boot before merging. Record `20260908-1712-p1-writable-path-audit`.

## 2026-09-08 20:11 [progress]

Three tasks opened from the P1-B audit's findings, none part of the file-based
A/B contract: `20260908-2011-state-units-never-load` (units seeded into STATE are never
loaded on first boot), `20260908-2011-ssh-generator-vs-image-policy` (port 22 conflict
and `AuthorizedKeysFile` override) and `20260908-2011-wtmp-unbounded-append`. Recorded
pending; not dispatched from the P1 watchdog.

## 2026-09-08 19:32 [progress]

P1-A of `20260908-1428-file-ab-signed-components` reports the boot/trust half
feasible as drafted: signed dm-verity accepted/refused with the plan's errno
set on x64, virt-arm64 and the cx3576 vendor kernel; one kernel boots two
signed roots; cx3576 FIT enforcement in the U-Boot sandbox; systemd-boot
shared-UKI Type #1 entries with boot counting on x64 and virt-arm64. L1
verified the raw logs, re-ran the gates and refused a byte-flipped signature.
Merge pending the committed harness and the x64 contract.

## 2026-09-08 17:27 [progress]

`docs/verify-status.sh` now accepts any plan record under `docs/plan/` (index
excluded) for a `proposed` status line, instead of only `PLAN-NNN.md`; the
negative test carries both record shapes and an index-only case, and the
user-doc contract (en and zh) states the rule. Task `20260908-1727-status-gate-plan-naming`.

## 2026-09-08 17:19 [progress]

User direction on `20260908-1428-file-ab-signed-components`: parallel
execution confirmed; x64 completes each phase first and is verified under
QEMU, then the same layout is applied to cx3576 and the other boards. The
plan's sequencing rule and annotations record it; both P1 tasks were
re-prioritised by follow-up, and P1-A reports its x64 stage separately so P2
for x64 can open on it.

## 2026-09-08 17:14 [progress]

P1 of `20260908-1428-file-ab-signed-components` dispatched: `ew42ee3o`
(P1-A, boot/trust primitives) and `iku9ubdw` (P1-B, writer audit), records
`20260908-1712-p1-signed-verity-boot` and `20260908-1712-p1-writable-path-audit`.

## 2026-09-08 17:11 [progress]

Plan `20260908-1428-file-ab-signed-components` (file-based A/B, independently
signed components, three-partition layout, unified DATA) approved by the user
for implementation. Task `20260908-1423-file-ab-signed-components` claimed by
L1. P1 — the feasibility gate — is being dispatched as two parallel L3 tasks;
later phases wait on its evidence per the plan's own sequence.

## 2026-09-08 17:02 [decision]

Repository wired into the PMA workflow per the skill as of 2026-09-08 15:42
UTC. `docs/CHANGELOG.md` renamed to `docs/changelog.md` (18 references
rewritten). Two records renamed from the interim slug-first form to the
`<timestamp>-<feature-slug>` form, IDs stable in meaning:
`file-ab-signed-components-20260908T1423Z` → `20260908-1423-file-ab-signed-components`
(task) and `file-ab-signed-components-20260908T1428Z` →
`20260908-1428-file-ab-signed-components` (plan); their four cross-references
updated. Added `AGENTS.md` (+ `CLAUDE.md` symlink), `docs/decisions/`,
`.gitattributes`, `.editorconfig`, `.env.example`. Fast path stays
enabled. Record: `docs/plan/20260908-1702-pma-project-injection.md`.

## 2026-09-08 10:09 [progress]

**PLAN-926 — S905X5M integration into updated local main**

Updated local main to upstream 3c5374f3 and integrated the S905X5M adaptation,
including the Wi-Fi switch and front-panel repairs. Conflict resolution keeps
CX3576's slot-specific boot digests and S905X5M's independent payload contract.
Added the newly required display/DRAM declarations and aligned board readers
with upstream's path resolution inside extracted roots. Display fixtures now
exercise fresh slot reads. Verifier and build-driver typechecks passed, with
1,468 verifier tests and 171 boot/bundle/geometry unit tests passing. This is
a local source integration; image packaging, remote main publication and
device deployment are outside its scope. Existing hardware gaps remain open.

## 2026-09-08 09:48 [progress]

**PLAN-924 — S905X5M front-panel executable permissions**

The package producer now installs both front-panel entry points as mode 0755.
The composed-root verifier checks optional executable modes and the panel
stop helper. All 1,394 verifier tests, actual package/root mode checks, 392 SD
image checks and 14 executable smoke checks passed. A temporary device bind
repair also passed service start/stop/restart. Replacement SD and RAUC artifacts
were produced before packaging was stopped; the later installer rebuild was
terminated. RFCT-944 retains the SD/eMMC boot-state ambiguity and remaining
runtime qualification gaps. The running root filesystem was not replaced.

## 2026-09-08 09:48 [progress]

**PLAN-925 — Wi-Fi client switch API alignment**

The built-in network page's Wi-Fi switch returned 409 because mica-apid omitted
`wifi.client.enabled` from its settings write allowlist. The boolean leaf now
returns 202 with an apply task, while adjacent Wi-Fi settings remain refused.
OpenAPI and the resource inventory are synchronized. Formatting, clippy and
325 apid binary tests passed, including switch, validation and session/CSRF
regressions. The device and existing images still contain the earlier service;
no packaging or deployment followed the user's disk-space stop instruction.
RFCT-945 records successful managed Wi-Fi DNS/HTTPS and unresolved gateway
ICMP loss separately from this API repair.

## 2026-09-08 08:19 [progress]

**PLAN-923 — Local initialization helper and S905X5M SD inspection**

Adapted the workspace-local initialization helper to the current JSON API,
session/CSRF contract, asynchronous apply tasks and additive SSH-key workflow.
Credentials are stored privately and retries preserve existing device state.
Fifteen isolated protocol cases and live fresh/repeat initialization passed.
SD runtime checks verified storage identity, management, Ethernet/NTP, MQTT,
container networking, radio discovery and basic HDMI/USB access. The image
remains degraded: non-executable front-panel scripts also prevent the boot
health gate from confirming the slot. RFCT-943 records the evidence and
RFCT-944 tracks the remaining runtime defects. The helper remains outside
the Mica OS Git checkout; this entry records its local delivery.

## 2026-09-08 07:12 [progress]

**PLAN-922 — S905X5M package integration on current mainline**

Added the S905X5M/BM201 BSP to the top-level layout and package-based rootfs
pipeline, with resolved kernel configuration exports, independent radio
selection, and default-off front-panel and MQTT reference packages. SD images
and RAUC bundles consume the selected package's boot export; eMMC packages and
installer cards keep their separate media contracts. Runtime checks follow
mainline configuration and package inventories. The port retains mainline's
cx3576 boot-digest protocol and supports the x64 GRUB toolset on arm64 builders.
Factory-root smoke checks can use the existing BuildKit executor when Docker's
classic image store rejects a validated OCI archive.
Build evidence is recorded in RFCT-942. Existing-device configuration migration
and qualification of the new image on hardware remain separate work.

## 2026-09-06 02:33 [progress]

**PLAN-083 — Locked Debian runtime packages and QEMU acceptance**

Runtime package manifests now pin versions, architectures, URLs and SHA256
checksums. Docker mounts a reusable archive cache; composition starts with 68
bootstrap packages and adds selected dependencies using dpkg without network
access or APT. The x64 system contains 159 upstream and 13 local packages.
Validation passed 920 build tests, 1,279 verifier tests, 315 applicable image
checks, 12 executable smoke checks and all eight QEMU/API E2E phases with 137
assertions, zero failures and zero skips. The guest tests now create a managed
WireGuard tunnel to exercise permissions on a real daemon-generated key.
Arm64 archives are verified; physical board acceptance remains separate.
See PLAN-083.

## 2026-09-06 02:33 [progress]

**PLAN-084 — Per-package JSON manifests and independent cache updates**

Debian runtime pins now live in 172 individual JSON files with explicit target
variants, plus a separate bootstrap-helper record. All 342 previous target pins
and consumer mappings are preserved. `--package NAME` refreshes or verifies one
archive without processing unrelated package records; a real empty-cache run
fetched one archive and passed disconnected verification. The Bun builder renders
temporary installation records, keeping JSON tooling out of the target system.
Validation passed 40 archive checks, both-architecture selection checks, 920 build
tests, 1,279 verifier tests, 315 applicable image checks, 12 executable smoke
checks and all eight QEMU E2E phases with 137 assertions and no failures or skips.
See PLAN-084.

## 2026-09-05 20:54 [progress]

**PLAN-081 — Repository audit repairs**

Closed stale-password session issuance, partial settings persistence, invalid UI
installation requests, diagnostics sandbox permissions, stale update/session UI
state, authenticated MQTT bridge connections and the package preflight regression.
Settings now use a private recoverable undo journal across DATA and STATE. CI adds
preflight, DATA layout and update-server checks, keeps generated OpenAPI equality,
and removes mandatory backward-compatibility enforcement during development.
English and Chinese current-state documentation is reconciled. Verification passed
1,047 micad workspace tests, 149 UI tests, 920 build tests, 1,279 image-verifier tests,
25 preflight cases, 36 update-server tests and an isolated systemd sandbox probe.
Board and power-cut acceptance remain separate. See PLAN-081;
the audit resolution record it was written beside was a temporary document and
has been removed.

## 2026-09-04 21:41 [progress]

**PLAN-079 — Update server and release console**

`update-server/` now provides a Bun/TypeScript service with a Chinese release
console, administrator sessions, streaming RAUC artifact uploads, publication
and withdrawal, expiring Ed25519-signed catalogs, range downloads and an audit
trail. SQLite stores release state; a standalone executable embeds the console
and database migration. The new protocol replaces TUF on the server side;
the existing OS client still needs its new reader before devices can use it.
Validation includes 36 tests, real HTTP range checks, full browser workflows
against the executable, and a clean dependency audit. Details and run commands
are in PLAN-079.

## 2026-09-04 13:18 [progress]

**x64 builds its own kernel, and there is no initramfs**

x64 shipped Debian's generic amd64 kernel — 108 MB, with its own maintainer
scripts, its own initramfs run during the compose, and a klibc shell script in
the initrd that assembled the verity root. It now builds its own kernel from
mainline `v6.12.107`, pinned by tag and verified by digest, from a reviewed
fragment merged over `x86_64_defconfig` with the resolved config recorded in
tree and a build that refuses a config that drifted from it.

The reason was not size. `boards/common/mica-required.fragment` called itself the
board-independent baseline and was not one: measured against the Debian config
x64 actually shipped, of its 23 `=y` lines, 10 held, 12 were `=m`, one was absent
and its `CONFIG_LSM` was a different string — and nothing in the tree checked any
of it. That gap had already cost a whole-board outage: a change to the verity
format updated two of its three consumers and missed the klibc script, so every
x64 image was unbootable while cx3576 stayed green, because cx3576's kernel reads
the same command line directly and never runs that code.

**The initramfs is gone with it.** `rootfs/initramfs/` is deleted, initramfs-tools
and klibc-utils are out of the root, and there is no initrd in either slot's boot
partition, in `grub.cfg`, in the assembler or in the bundle. The kernel carries
`DM_INIT` and `DM_VERITY` built in and GRUB's `dm-mod.create` does what the shell
script did. Measured on the built artefacts: the kernel package drops from 108 MB
to 15 MB, the root from 435 MB to 296 MB, the RAUC bundle from 298 MB to 132 MB,
and 4230 modules become 8. The bzImage grows, from 11.6 MiB to 14.9 MiB, because
the drivers are built in — that is the trade, stated rather than hidden. Both
first-boot repartition and RAUC installation were always ordinary units after
`/sbin/init`, so removing the initrd took nothing from either.

The checks changed meaning rather than being deleted. `checks-kernel.ts` accepted
`=y` or `=m` over 7 symbols; it now requires `=y` **and** builtin over 31, which is
itself the provenance check — Debian's config has twelve of them `=m` and
`CONFIG_DM_INIT` nowhere, so a distribution kernel returning goes red. The
assertion that an x64 slot must carry an initrd was inverted rather than dropped,
and a BusyBox clause that would have become vacuous over an archive that can no
longer exist was restated stronger.

The floor is now one floor. The container-network symbols moved out of cx3576's
per-board loop into the shared fragment that both boards merge and assert after
`olddefconfig`. That consolidation also introduced, and then caught, the exact
defect the work exists to prevent: replacing a 59-symbol floor with a 41-symbol
one dropped 22 symbols and compensated for them only on the board that already
had them, so `CONFIG_NF_CONNTRACK_MARK` — the DNAT mark netavark sets for
published ports — was silently absent from x64's own config. The netavark gate
found it, and it and `NF_NAT_MASQUERADE` are named in the shared floor now.

The kernel also provisions the disk-encryption capability, and that is all it
does: `DM_CRYPT`, `CRYPTO_XTS` and `CRYPTO_AES` in a separately labelled block
that says it is the only block whose entries name no consumer, and that carries
its exit condition — each line leaves when a consumer lands in the image, and the
whole block is deleted if the product decision reverses. Nothing is encrypted at
rest; the image ships no cryptsetup, formats no LUKS header and has no unlock
path. Derived as three symbols, measured as six, because the crypt target selects
ESSIV in 6.12 and accelerated x86 AES pulls in cryptd and the SIMD helpers.
`CONFIG_TRUSTED_KEYS` and `CONFIG_ENCRYPTED_KEYS` stay off: cx3576 has no TPM —
its device tree declares none — so on that board the symbol would seal against
nothing, and enabling them would decide by accident where a volume key lives,
which is the first question an unlock design has to answer.

## 2026-09-03 21:20 [progress]

**The kernel floor covers eBPF, the firewall back-end and bridge filtering**

`boards/common/mica-required.fragment` named the virtual link kinds and netavark's
fib expressions and nothing else, so two capabilities the shipped runtime already
depends on were unstated. crun programs the cgroup v2 device controller as a
`BPF_PROG_TYPE_CGROUP_DEVICE` program, and on cgroup v2 that program *is* the
device policy — there is no controller file to write instead — so the eBPF core,
`bpf(2)`, the JIT and `CGROUP_BPF` are engine facts rather than diagnostics
niceties. The firewall half is derived from what `iptables-nft` actually resolves
through: the nf_tables core and its inet, ip and ip6 families, the xt compat
expression and the x_tables core it depends on, conntrack, NAT and masquerade.
Bridge filtering adds three more, because traffic between two containers on one
bridge is switched at layer 2 and no host firewall sees it otherwise.

Eighteen symbols, each with the clause that says what it buys. Deliberately left
out and recorded as such: the legacy `IP_NF_*` back-end and `BRIDGE_NF_EBTABLES`,
which nothing in the image uses; the per-extension matches and targets, which are
policy; `BRIDGE_VLAN_FILTERING`, which has no consumer because micad renders VLANs
as their own netdevs; and `BRIDGE_IGMP_SNOOPING`, which is not neutral — built, it
stops forwarding multicast to ports that sent no report, which is how mDNS
discovery inside a container network breaks. BTF was priced by building it — 7.7
MiB added to `Image` in both A/B slots and twice the build time — and declined
until something ships a CO-RE tool.

The floor is now checked from both sides: `verify/src/checks-kernel.ts` asserts it
against Debian's built artefact on x64, the fragment is merged before
`olddefconfig` and asserted against the built config on cx3576, and a test reads
the fragment and requires every registered symbol pinned there. Eight symbols
build no object of their own, so a register entry may omit its module, and the
modprobe check names in its PASS message which symbols it skipped — a green line
cannot be read as covering them. One asymmetry is written down rather than
smoothed over: `br_netfilter` defaults its `call-iptables` switches on and
registers its hooks once a bridge exists, so a FORWARD policy reaches same-bridge
container traffic on the board whose kernel builds it in and not on the board
where it is a module. The capability is common; the default state is not.

## 2026-09-03 03:09 [progress]

**Application delivery, an emergency binary and a recovery interface**

`docs/user/applications.md` now routes application code on one question — may
this code be a release behind the OS? — into either build-time `.deb`
composition under the RAUC lifecycle (`docs/design/native-applications.md`) or
digest-pinned OCI/Quadlet delivery. Three more Quadlet examples are fed to the
shipped generator by the documentation test, so a broken example is a red gate
rather than a customer's discovery. What is not enforced is named: signature
admission, mandatory ceilings, a secret store and per-application automatic
rollback; the slot-wide rollback the boot health gate does perform is stated
separately rather than folded in, because folding it in would have made the
group false.

`mica-busybox` ships one unexpanded `/usr/bin/busybox` for emergencies. Depending
on Debian's package would have shipped an initrd carrying busybox and 271 applet
hard links through the initramfs hook it also installs — the applet farm the
plan rejects, arriving as a side effect of one dependency line — so the producer
extracts the single file and runs no maintainer script. Verify walks the packed
root for symlinks and for files sharing the binary's inode, because the hook
expands as hard links.

Physical recovery actions now have a system-layer interface: a board declares
its own actions in `board.env`, micad maps a boot-time intent through that
declaration into the presence assertion and reset tier the existing flows
consume, and a board that declares none refuses and says so. Both shipped boards
declare none, and the debug serial console is withdrawn as a candidate — on
cx3576, displacing its getty was measured to wedge the tty and block systemd.
PLAN-045, PLAN-048, PLAN-051.

## 2026-09-03 00:05 [progress]

**The built-in console follows the prototype's information architecture**

PLAN-067 closed the visual gap to the approved prototype; this closes the
structural one. Page titles lose their descriptions and gain a status slot, the
footer reports release and active slot, the connection has the prototype's
three states with a banner, and preferences become a searchable language picker
and a segmented appearance control. Overview's attention rows stop being
hard-coded copy and become device facts. Network merges observed state into the
interface table and opens an interface detail route with a review dialog and an
apply strip whose every step is observed. Services opens a service detail route
and the terminal window. Applications gains its filters, retained-data count
and Desired column. Access becomes four labelled sections. System folds to the
prototype's six tabs, with the update check table, automatic policy, manual
upload and configuration backup.

Two rules governed the work. Nothing states a device fact the device did not
report: service endpoints, bridge membership, whether a change would cut off
this browser, and the update checks are all derived or omitted. And anything
designed but not yet real is built, disabled and marked at the section that is
incomplete, not only at the bottom of the page. Six shipped surfaces the
prototype has no place for are retained under sections that name them as
additions. PLAN-068.

## 2026-09-03 00:00 [progress]

**The base image carries a firewall vocabulary, and keeps its unit off**

`mica-system` now depends on both `nftables` and `iptables`. Neither is a
firewall: the image ships no rule set, no policy, no persistence and nothing
that reapplies a rule after a reboot. What it gains is the ability to look and
to act at all, on every profile — before this, a build that declined containers
had no firewall tooling whatsoever, because `nft` reached the image only as a
dependency of `mica-podman`.

Two front-ends over one backend is supportable only if the documentation says
which one answers which question, so it does. `nft list ruleset` is the complete
view of the `nf_tables` subsystem, including the container network driver's own
tables; `iptables -S` shows only what came through the iptables front-end, and
on a device running containers, reading it as "the firewall on this box" is
wrong. `iptables` here is `iptables-nft`, a translation layer over the same
kernel subsystem — the legacy binaries ship in the same Debian package, the
alternatives group is in auto mode where nft outranks legacy, and nothing in the
tree runs `update-alternatives`. A check asserts that endpoint, because a
flipped alternatives group leaves an executable `iptables` writing to a rule
store nothing else on the device reads.

The unit that ships with `nftables` needed a decision rather than an absence.
`nftables.service` runs `nft -f /etc/nftables.conf`, whose first line is `flush
ruleset` — on a device with containers that clears the container network's rules.
It was not enabled, but only because nothing had enabled it: measured on a clean
trixie root, **no shipped preset rule matches `nftables.service` at all, and
systemd's fallback for an unmatched unit is enable**, so a single `systemctl
preset-all` was enough. `mica-system` now ships `50-mica-nftables.preset` with
`disable nftables.service`, the postinst asserts the outcome, and a verify check
resolves the preset the way systemd does — basename masking across `/etc`,
`/run` and `/usr/lib`, first matching rule wins — rather than grepping for the
line it hopes is decisive.

On the image this project ships the closure delta is six packages and 2768 KiB,
because four of the ten were already present through `mica-podman`; the profile
this decision actually changes is the container-less one, which pays ten
packages and 4351 KiB for a firewall vocabulary it previously did not have.

## 2026-09-02 22:26 [progress]

**The built-in console matches the prototype detail for detail**

PLAN-064 reproduced the approved prototype in outline; the shipped console now
reproduces it in detail. The OKLCH re-derivation of the palette is replaced by
the prototype's own Klein values for both themes, including the hover,
accent-soft, accent-strong, skeleton and chrome roles. The type scale drops to
the prototype's 22px page titles, 16px section titles, 15px control and table
text and one 13px secondary size, and the shell adopts its 56/52px header,
square logo mark with a stacked wordmark and hostname, navigation pills with an
inverted active state, 44px footer on the page ground and 300px drawer with a
status block. Buttons, inputs, tags, tables, tab strips, switches, dialogs,
progress bars and the blueprint-framed sign-in card follow the prototype's
sizes, radii and states, and the breakpoints move to 581px and 1100px. Content,
routes, API bindings and the simulation boundary are unchanged. PLAN-067.

## 2026-09-02 20:58 [progress]

**Built-in UI builds are isolated from source**

The built-in UI now has one production and quality path through the Bun image
pinned by `build-env/images.env`; host Bun discovery and configurable output
directories are gone. The UI source is mounted read-only, while dependency
installation, generated metadata and Vite output are confined to
`_out/apid-ui/`, with the production tree fixed at `_out/apid-ui/dist`. Rust
target and package builders also mount repository source read-only, write Cargo
artifacts through a separate target mount and consume the UI tree through
`/build/apid-ui:ro`. This supersedes PLAN-065's source-adjacent producer
placement without changing APID's embedded VFS or runtime routes. PLAN-066.

## 2026-09-02 19:49 [progress]

**Install, onboarding, provisioning and recovery**

A device can now be configured before anybody logs into it: a versioned,
totally validated provisioning document arrives on the boot partition or on
removable media, applies in one save or not at all, and is refused once the
device has an administrator — so a fielded appliance cannot be reconfigured
from a stick. Claiming records how it happened, and a bootstrap credential is
bound by a forced rotation at first sign-in rather than by an expiry, because
an unclaimed device is the one with no trusted clock and a window that closes
with nobody in it would brick. Slot state is inspectable and a manual rollback
is guarded: it can only ever mark the booted slot bad, never mark a target
good, and it refuses a target that was installed more recently than the
running system or that cannot be ordered against it — which derives "the
target has run before" from RAUC installing only the inactive slot, a premise
now named where the guard lives. Reset has three tiers with a table that says
what each one preserves as well as what it clears, executed from an intent
record applied on the next boot; META and the system slots are unreachable
because the type that carries the roots has no member for them. Secure wipe is
deliberately absent until a board evidences a device-level erase primitive.
The console renders every reachable flow and explains the two that are not.

Not closed, and the records say so: the presence gate ships and nothing writes
a presence assertion, so tier 3 and credential recovery are implemented,
tested and unreachable on a fielded device; every install, flash and
first-boot procedure is documented and unrun on hardware. PLAN-046, PLAN-048.

## 2026-09-02 12:21 [progress]

**Built-in UI assets are generated before Rust builds**

`pkgs/micad/apid/ui/dist/` is now ignored generated output rather than a second
source of truth in Git. The frontend production entry uses local Bun or the
pinned Bun container; local checks, target builds and package producers run it
before Cargo and pass the absolute output directory explicitly. APID's build
script validates that tree, copies accepted bytes into Cargo-owned output and
generates the same sorted embedded VFS. The frontend gate now proves source,
tests and a fresh production build, while a focused contract gate prevents
generated files or unwired Cargo entries from returning. PLAN-065.

## 2026-09-02 11:29 [progress]

**Time, storage, diagnostics and the system-information surface**

The image now keeps time on purpose: `systemd-timesyncd` ships as base policy
with a pinned 32-2048 s poll, a 30 s retry and a 60 s clock save, its saved
clock bound onto STATE so `max(RTC, last known good)` holds before TLS and TUF
validity are ever checked. NTP servers and the timezone are typed settings
with a runtime reconciler; the timezone is presentation only, rendered to
`/run/mica/timezone`, and `/etc/localtime` stays UTC because a bind over the
zoneinfo symlink would hand the operator's zone to every reader of UTC. The
cx3576 kernel now asserts its RTC driver. `GET /api/v1/storage/status`
reports the PLAN-063 tiers: DATA at `/mnt/data` with `/mica` and `/srv` as
binds of one pool whose capacity is stated once, readiness proven by a real
probe write with named unavailable and degraded states, eMMC wear as a JEDEC
bucket range beside its raw evidence, and every lifecycle action explicitly
unsupported. `GET /api/v1/system/info` assembles what this device is from
the shipped manifest, machine id, uname and RAUC; `/api/v1/system/telemetry`
and `/api/v1/network/status` report observed state, kept distinct from the
desired configuration, and say so when a fact is absent. Diagnostics
snapshots collect one at a time under `/mica/diagnostics` with retention and
explicit deletion, redacted by a fail-closed allowlist. A Wi-Fi AP
passphrase refusal no longer names the secret's length. Board validation of
RTC backup power, media health, fsck evidence and the telemetry fields needs
bench hardware and is recorded as not done. PLAN-044, PLAN-049, PLAN-052.

## 2026-09-02 11:16 [progress]

**The built-in UI now implements the complete product prototype**

The recovery SPA now matches the approved horizontal Klein-blue prototype and
uses the shadcn/ui base-nova contract on Base UI, Spectrum-aligned OKLCH tokens,
self-hosted Barlow fonts, responsive desktop/mobile navigation, persisted
English/Simplified Chinese and light/dark preferences, and route-level lazy
loading inside the embedded VFS. Overview, typed network management, system
services, credentials, UI package versions and authenticated update actions
use the current APID contracts. Applications, browser terminal, time, automatic
update policy, storage, diagnostics/support, backup and recovery are complete
interactive simulations backed only by ephemeral in-memory state; every
affected page labels that boundary at its bottom. Vitest and Playwright cover
the simulation boundary, navigation, preferences and critical workflows. The
34-file embedded tree is 1,067,103 bytes raw and 501,172 bytes as the sum of
per-file gzip streams; 250,984 raw bytes are the twelve Latin Barlow font
assets, and the remaining increase from the 676 KiB baseline delivers the
complete route and interaction surface. PLAN-064.

## 2026-09-02 05:45 [progress]

**Release identity, authenticated updates and the security lifecycle**

A release is now a validated manifest (version, channel, board
compatibility, artifacts with sizes and digests, source and build identity)
with SHA256SUMS, a CycloneDX SBOM taken from the image's package manifest,
provenance and a license inventory; `make os-release-gate` refuses to
publish without them or without board evidence. Devices carry
`rauc-update`: it discovers releases from signed TUF metadata, downloads
resumably into `/mica/updates/downloads`, moves only an authenticated bundle
into `/mica/updates/verified` and hands RAUC that path alone, with an offline
import through a lockbox. micad owns the update lifecycle (idle through
rolled-back, plus `update-unavailable` when the DATA pool is missing,
read-only or exhausted) under a fail-closed policy file for maintenance
windows, metered links and a health-gated reboot; apid exposes it under
`/api/v1/update` and the System page exposes its state and typed actions.
`docs/design/security-model.md` separates six security boundaries and is
the canonical I1-I4 boot-assurance ladder; `security-lifecycle.md` and
`manufacturing.md` name owners for keys, releases, advisories, factory
records and RMA. Both boards honestly remain I1. Production key ceremonies,
release hosting and every board-side fault row are operator or bench work
and are listed in the task records. PLAN-043, PLAN-047, PLAN-053.

## 2026-09-02 00:20 [progress]

**The built-in UI moved to an internal namespace**

The verity-covered recovery SPA now owns `/_ui` and uses canonical `/_ui/`
asset and navigation URLs; `/` redirects there when no usable custom UI is
active. `/ui` has no compatibility alias and is now an ordinary custom-UI
route, so an integrator bundle can own that path without being intercepted by
APID. The route router, one-decode reserved-segment guard, Vite/TanStack bases,
localized recovery copy, committed hashed assets, tests and current English
and Chinese guidance moved together. `/api/v1/ui` and `/mica/ui` retain their
existing API and storage meanings. PLAN-060.

## 2026-09-02 00:00 [progress]

**The os/ wrapper is gone**

`os/boards`, `os/build`, `os/build-env`, `os/pkgs`, `os/rootfs`, `os/tests`,
`os/tools` and `os/verify` now live at the repository root. The wrapper dated
from when the tree was expected to hold more than the OS; it never did.
Every path reference followed -- including the self-locating scripts that
derive the repository root from their own depth, and both TypeScript path
modules, whose `OS_DIR` (now equal to `REPO_ROOT`) was retired. The `os-*`
make target names stayed: they are names, not paths. Historical records keep
the paths they were written with. Landed as 69febcae.

## 2026-09-02 00:00 [progress]

**User documentation, website briefs and the BSP porting set**

`docs/user/` now carries the fifteen-page customer journey from download to
support under an explicit documentation contract: audience, page ownership
and a truth-status taxonomy on every claim. `docs/website/` holds one content
brief per official-website page. `docs/bsp/` is the porting manual, the
vendor intake rubric, the `board.env` reference, the dossier template with
its cx3576 instance, the field-reliability qualification matrix, the I1-I4
boot-assurance ladder and the support tiers. `docs/zh/` mirrors all three
sets. `make docs-verify` grew four gates -- internal links, truth-status
lines, en/zh coverage and dossier shape -- each with its own negative test.
The twelve cx3576 qualification rows still read "not tested"; they need a
bench run. PLAN-042, PLAN-050.

## 2026-09-01 23:54 [progress]

**Built-in UI assets are an isolated embedded tree**

APID now generates a sorted compile-time VFS from the complete committed
`ui/dist` tree instead of naming `index.html`, `app.js` and `app.css` in Rust.
Vite emits content-hashed vendor, route and locale chunks; page routes and the
Simplified Chinese catalog load on demand, while every resource remains inside
the verity-covered binary. `/`, `/ui` and `/api` are terminal ownership domains:
misses and ambiguous encoded or repeated-separator paths cannot cross between
the custom UI, built-in UI and JSON API. The Chinese UI development guide now
documents the VFS, lazy-loading, cache and path-isolation contract. PLAN-059.

## 2026-09-01 23:17 [progress]

**The built-in UI is bilingual and theme-selectable**

The recovery SPA now ships typed inline English and Simplified Chinese
resources and browser-local language selection, plus persisted system, light
and dark appearance modes available before and after authentication. Its owned
shadcn `base-nova` controls remain backed solely by Base UI, while local
semantic tokens now follow Adobe Spectrum 2 color hierarchy, focus, state,
density and accessibility guidance without importing a second component
runtime. Every shipped route was localized, theme and locale document metadata
stay synchronized, and the complete embedded APID asset tree remains deterministic.
PLAN-058.

## 2026-09-01 15:56 [progress]

**Package versions mean something, and the image says what it holds**

Upstream repacks now carry their upstream version in front of the pool's git
stamp -- `mica-podman 5.8.6+git…`, `mica-rauc 1.13+git…`, declared per producer
by `VERSION_FROM` in producer.env -- while first-party packages keep the
workspace version. The pool-wide invariant weakened from one version to one
stamp, in the gate, the compose preflight and the exact-version Depends pins
(now pinned to the named package's own pool version; the cross-boundary pin
uses the new `@SYSTEM_VERSION@` control token). The composed image ships
`/usr/share/mica/manifest.tsv`, its bill of materials written before the
package-manager purge and asserted by os/verify. The `radios` producer split
into independent `wifi` and `bluetooth` producers, and each radio name is its
own `MICA_ROOTFS_WITHOUT` token -- declining Bluetooth keeps Wi-Fi -- with the
umbrella `radios` token removed. The container-network kernel floor (VETH and
the nft fib family) moved into the shared `mica-required.fragment` and into
os/verify's per-image kernel checks for the Debian-kernel board. PLAN-041.

## 2026-09-01 11:43 [progress]

**The v2 suffix is retired**

The `v2` in file and target names dated from when the current layout coexisted
with a legacy chain; that chain is gone, so the suffix stopped naming a
distinction. `os/rootfs/build-v2.sh` is now `build.sh`, `os/rootfs/overlay-v2/`
is `overlay/`, the cx3576 assembler `mkimage-v2*` is `mkimage-cx3576*` (the
name `mkimage-x64` already used), the make targets dropped their `-v2`, and
images assemble as `<board>-mica-<epoch>.img`. Prose that said "v2 image" or
"layout v2" now says "the image" or "the A/B layout". Version numbers that
really are versions -- the settings schema's v2, the API `/api/v2` rule,
upstream releases -- are untouched, and historical records (this file,
docs/plan, docs/task) keep the names they were written with.

## 2026-08-31 20:54 [progress]

**The rootfs is composed from Debian packages**

The nine-file rootfs stage chain is gone. A root is now one APT transaction
against a local package pool -- `_out/debs/<arch>/`, built and indexed by
`make os-debs` -- on a digest-pinned Debian base, followed by one finalizer
that closes and packs it. What used to be a floor stage, a read-only-root
wiring stage, four feature stages and a board stage is package metadata:
fifteen packages from ten producers discovered from the tree, with
configuration order coming from their own `Depends` rather than from a number
in a filename. Declining a feature is naming fewer packages, through a resolver
that refuses a set not naming exactly one profile package. Enablement is
package-owned symlink payload; nothing anywhere calls `systemctl enable`. The
RAUC keyring stays the one path that is not package payload, staged per build
from `ca/`, and it is a different seam from the TLS trust store `mica-ca-trust`
ships. The switch-over was accepted on a gate that built x64 through both paths
at one commit and judged every difference between the two roots -- 35
differences, 35 sanctioned, 0 unsanctioned -- whose reasoning is kept as a
closed record in `os/tests/dual-build-sanctions.md`.

## 2026-08-31 20:21 [progress]

**Built-in UI is a pure SPA over the management API**

apid now embeds a React/Vite application at `/ui`; `/` serves a valid active
custom bundle and otherwise redirects to that built-in UI. All server-rendered
Maud pages and non-API form mutations, including `/containers/enable`, were
removed. Setup, login and logout have JSON session routes, API handlers accept
either a stored bearer token or a signed browser session, and session mutations
require a per-session CSRF header. Custom UI status/deactivation is likewise an
API resource. micad now obtains an on-demand normalized network snapshot from
systemd-networkd, and the network API/SPA report the observed interface count,
configured intent and each link's operational, carrier, address-family and
address details. The committed frontend assets are rebuilt and byte-compared
in CI before Cargo embeds them.

## 2026-08-31 15:33 [progress]

**Settings writes are bounded, scoped and queued**

apid-to-micad and micad-to-systemd waits now have five-second bounds, while
micad keeps settings/live-state reads separate from its serialized apply lock
and reconciles only overlapping subtrees. Persisted settings writes enter one
bounded, coalescing queue whose task records are mirrored into apid by
`TaskChanged`; the settings and transient-password APIs return 202 plus a task
id, and bearer clients can read the bounded task collection or one record.
The zero-JavaScript SSH pane redirects to that task and meta-refreshes only
until success, failure, interruption, or confirmed history loss, and no
plaintext password can enter the queue.

## 2026-08-30 17:46 [progress]

**cx3576 builds on a host without binfmt**

The rootfs stage driver links its chain one of two ways, decided by the
builder's driver: by tag in the daemon's image store on the `docker` driver,
as before, or by OCI layout on any other -- each stage exported
`type=oci,tar=false` under `_out/<board>/stages/` and handed to the next as a
named build context under the tag its `FROM` names. A `docker-container`
builder bundles its own emulator, so `os/rootfs/build-v2.sh` now selects
`mica-<arch>` when `default` cannot reach the platform, the way the RAUC and
podman builds already did, instead of refusing with the host binfmt command.
The smoke run that closes the build follows: when the daemon cannot execute
the root, every register entry runs inside that builder through one throwaway
build per artifact, with the same register and the same judging. With that,
every cx3576 step -- builder images, U-Boot, kernel, RAUC, podman, micad, the
rootfs, the image, its verification and the bundle -- builds on an amd64 host
with docker and buildx and nothing registered on it.

## 2026-08-30 11:44 [progress]

**MQTT bridge hardened against its application peers**

A review of the decoupled bridge found it still treating its D-Bus peers as
micad. Every `GetItems` and `SetValue` into an application is now bounded by
five seconds, so a hung application is recorded as unreachable instead of
stopping the heartbeat and every other application. The rumqttc event-loop
task no longer waits on the runtime: requests that arrive while it is busy
are dropped, and a reconnect travels on its own channel, closing a deadlock
between the two bounded channels. An activation that fails while the
application still owns its name -- one that claims the name before it
registers `/` -- is retried by a bus sweep five seconds later.

The documented application policy now grants root `GetItems`: the stock
system bus has no root exemption, so a package that granted only the bridge
was published to MQTT and reported non-conforming by micad's registry on every
boot. Image verification requires that grant for every enrollment. The MQTT
reconciler no longer lets an identity that fails validation block the off
path, and a read of a path no application publishes is ignored rather than
answered with a retained null under the client's chosen name.

## 2026-08-30 03:00 [progress]

**MQTT enrollment decoupled from service naming**

`com.mica.ext.*` is no longer a privileged application namespace. All services
use the uniform `com.mica.<class>[.<suffix>]` grammar, while MQTT eligibility is
an independent package-owned contract: an exact regular-file enrollment under
`/usr/lib/mica/mqtt-applications.d` must be paired with exact D-Bus name
ownership and `mica-mqttd` Item1 grants. Global prefix ownership and the central
mqttd policy were removed; wildcard, prefix, unenrolled, and unpaired grants
fail image verification.

`mica-mqttd` now has zero D-Bus access to `com.mica.micad`. `GetDeviceId` and the
bridge identity proxy were removed; micad instead renders the already-validated
topic identity into `/run/mica/mqttd-device.env` before starting the bridge.
micad retains its explicit local `com.mica.micad1` management API because APID and
micad are separate processes, but exports no Item1 façade and no settings,
state, signal, or action to MQTT. This entry supersedes the extension-namespace
and single-`GetDeviceId` exception described in the immediately following
entry.

## 2026-08-30 02:01 [progress]

**MQTT restricted to application data**

`mica-mqttd` no longer mirrors the `com.mica.micad` management tree. It now
discovers only class-bearing `com.mica.ext.*` application services, validates
their identities and item paths at the trust boundary, coordinates one
device-wide heartbeat/full-publish lifecycle, and fails closed when two
applications claim the same class and instance. System settings and state —
including SSH, networking, credentials, containers and MQTT configuration —
and power or update actions have no MQTT read, publication or write path.

The bridge's sole system-management permission is the new read-only
`com.mica.micad1.GetDeviceId` method used to form topic addresses. APID now calls
the dedicated `Reboot` and `PowerOff` management methods directly, and micad's
obsolete system `com.mica.Item1` façade and action-item implementation are gone.
D-Bus policy and image verification pin the exact grant across all policy
files. Application disappearance, watcher failure, invalid item paths and
address collisions withdraw retained values rather than leaving stale state.

## 2026-08-30 00:54 [progress]

**Micad workspace tests consolidated and repository prose audited**

The repository-root `test/apid-api/` harness now lives at
`os/pkgs/micad/tests/apid-api/`, beside the D-Bus policy harness moved out of
`os/pkgs/micad/hack/`. Repository-root discovery, container workdirs, fixtures,
Make targets, verification inputs, executable modes, and current documentation
all follow the new ownership boundary. Cargo unit and integration tests remain
crate-local, while `os/tests/` remains the home for OS-wide tests.

The accompanying audit removed a committed conflict marker, unstable source
line citations, stale references to deleted build and verification scripts,
incorrect current paths, and incomplete prose in design documents and code
comments. It also corrected a stale build-test expectation that still named the
deleted bundle script. Validation passed the 48-case documentation index, the
31-file shell pipefail scan, 689 build tests, 1,096 image-verification tests,
47 APID self-checks, 38 API specification pins, 45 D-Bus policy checks, and the
Rust workspace tests and clippy gates. The full QEMU APID run was not available
because this checkout has no `_out/x64` image; dry-run resolution reached the
new paths and stopped only at that missing prerequisite.

## 2026-08-29 23:04 [progress]

**Scratch root renamed to `tmp/`**

`runtime/` collided with a real runtime path twice over. A genuine `runtime/`
directory in this repository would have been silently gitignored, and
`build-harness.md` quotes `/srv/bkd/runtime/bun` two sections above the one
that defined the scratch root, so a reader had to work out which `runtime` was
meant. It is `tmp/` now — unambiguous, and the convention PMA already states
for throwaway files. Nothing in the tree read the old name: it was a rule in
`.gitignore` and a section of `build-harness.md`, not a path any script builds.

Renaming it exposed a gap in the citation sweep. That sweep matched
`name.ext`, so it could not see a filename with no extension (`Dockerfile:41`)
or one whose dot comes first (`.gitignore:33`) — and the doc it was about to
rewrite cited `.gitignore:33`, a line number the rename itself was about to
invalidate. Twenty-three such citations survived and are now gone, across
`build-harness.md`, `uboot-ab-handshake.md`, `boards.md`,
`mica-required.fragment`, `podman/Dockerfile` and three `os/verify` sources.

Still there, and measured rather than fixed: about a hundred bare continuation
references in `os/verify/src/` and `os/build/src/` — `:1750`, `:2096` and the
like — pointing into `os/verify-image-v2.sh`, the shell verifier that was
deleted. They are archaeology in comments, not links anything resolves, and
clearing them is a separate pass over roughly a hundred sites.

## 2026-08-29 23:00 [progress]

**The docs gate narrowed to what ships**

`docs/plan/` and `docs/task/` are PMA process tracking. They are not part of
the product, and a record is deleted when it closes, so the sets an index gate
asserted over them were down to two task records and zero plans — a check that
reports green without having checked anything. Both sections are removed.

What remains is the pairing a reader depends on: `docs/design/*.md` against
`docs/README.md`, both directions, plus the once-each assertion that catches a
document listed twice. A design document that no index lists is not broken,
does not fail a build, and is simply never found again; nothing else in the
tree can catch that.

The gate goes from 352 lines to 118 and the negative suite from 398 to 202 —
750 to 320 against 16 documents, where it had been 750 against 18 rows.

One gap closed on the way out. The forward direction for `design/` — a
document that exists with no row — had no negative case of its own: the task
half of that pair had been carrying it, and removing the task section would
have left the gate's primary assertion untested. It has a case now, and the
suite is 4/4.

`docs/research/` is not gated because it does not exist; it went with the
Venus OS evaluation. `check_readme_dir` still takes its directory as an
argument, so if a second shipped tree appears, one call adds it.

## 2026-08-29 22:43 [progress]

**Talos removed from the tree, and the settled records pruned**

Talos is gone. The three references that were not history went with it: the
`.gitignore` entry for a `talos/` directory that does not exist, the base name
in the Makefile's retired-`os` message (the target keeps its recipe — a retired
build path that exits 0 is the failure mode every check here exists to
prevent), and the `apid` name-collision note in `remote-management.md`, which
disambiguated a daemon no reader can now encounter.

`README.md` keeps one mention, deliberately: the design-lineage sentence.
Talos really is where the immutable-root idea came from, and crediting an
influence is not the same as naming a dependency.

The rest of the Talos residue was inside settled records, so applying this
campaign's own rule cleared it. PLAN-029 M3 established that a record is
deleted when it closes; the closures in the previous commit left seven behind,
which contradicted it. Every settled record is now pruned — thirteen in all,
including this campaign's own PLAN-029 and RFCT-262/263/264. `docs/plan/` holds
no plan records, and `docs/task/` holds RFCT-253 and RFCT-260, the two that are
genuinely open.

An empty plan set turned out to break `docs/verify-index.sh`: an unmatched glob
expands to the pattern itself, and the forward loop reported `PLAN-*.md` as a
record with no row. It failed closed rather than passing green, which is the
right direction, but it was still a defect. Both forward loops now skip a path
that does not exist. The negative suite stays at 17/17 — it mints its own
`PLAN-900` fixture rather than borrowing a real record, which is what keeps the
plan assertions armed against an empty tree.

## 2026-08-29 22:40 [progress]

**Backlog cleanup**

The open set was four plans and five tasks; most of it was bookkeeping rather
than work. Verified against the tree, then closed:

- **RFCT-005 and PLAN-007 — the Talos rebase, abandoned.** Both proposed
  rebasing the fork onto upstream Talos v1.14.0-rc.1. The project took the
  other fork, PLAN-010's systemd base. There is no fork left to rebase. The
  last three references outside the records — a `.gitignore` entry for a
  directory that does not exist, the base name in the Makefile's own "retired"
  message, and the `apid` name-collision note in `remote-management.md` — went
  with them. What stays is the design-lineage sentence in `README.md`, which
  credits an influence rather than naming a dependency.
- **RFCT-008 and PLAN-010 M1 — superseded.** The systemd rootfs prototype was
  replaced by the v2 chain (`os/rootfs/build-v2.sh` over nine stage
  Dockerfiles, squashfs+dm-verity, A/B layout) that M2-M5 build on and that
  ships. M1 was the only milestone still open under a plan whose other four
  were implementation-complete. Its remaining done criterion — hardware boot
  to sshd — was never recorded, and closing it does not claim it.
- **PLAN-006 — completed by supersession**, executed on the systemd base as
  PLAN-010 M4. **PLAN-008 — completed by supersession**: the connectivity
  concern ships as two micad reconcilers, and no `connd` process exists,
  deliberately.
- **RFCT-007 — completed.** Item 1 had shipped. Item 3, the flashing matrix,
  is delivered in `os/boards/cx3576/bsp/README.md`: five paths, which board
  state each applies to, and why `ums` is reachable only from U-Boot and never
  from Maskrom. **Item 2, the `update.img` pipeline, is closed as superseded
  and will not be built** — three flash paths already write a whole-disk image
  through `rkdeveloptool wl 0`, and the RK packaging format would require
  vendoring `afptool` and `rkImageMaker`, closed-source SDK binaries, for no
  capability the tree lacks.

Left open, and genuinely open: **RFCT-253** (whether `access.ssh` may stay
bus-writable, a decision on evidence already gathered) and **RFCT-260** (the AP
reconciler's third copy of the WPA byte rule, and a refusal that names the
secret's length). Standing and untracked: the arm64/cx3576 verifications owed
to a host with binfmt.

## 2026-08-29 22:33 [progress]

**PLAN-029 — Documentation system rebuild**

The documentation tree went from 276 files and 77,319 lines to 42 files and
17,306, and stopped being coupled to code positions. Delivered as one record,
RFCT-262, because record proliferation was one of the things being removed.

- **Decoupled from code.** 3,843 `path:line` citations are gone from the
  documents, along with the gate that kept them resolvable
  (`docs/verify-citations.sh`, its test and three baselines — 1,821 lines, two
  `Makefile` targets and a CI step). Documents now name a module or a contract.
  The HTTP surface defers to `os/pkgs/micad/apid/openapi.json`, which CI already
  holds equal to what the shipped binary prints and diffs for breaking changes —
  moving the API surface off an ungated prose transcription and onto a gated
  artifact. api.md's transcribed route table and operation inventory collapsed
  accordingly; its design reasoning stayed.
- **Settled records pruned.** 205 completed `RFCT-*` and 24 closed `PLAN-*`
  deleted, both indexes rewritten to the survivors. RFCT-257 and RFCT-261 were
  closed rather than kept: both were work scoped against the citation gate this
  campaign removed, so leaving them open would have left the tree with a task to
  build on machinery that no longer exists.
- **Re-anchored on the current version.** `docs/research/` deleted with the
  Venus OS comparison it existed for; the eight `*.zh.md` siblings replaced by
  `docs/zh/`, written against the tree rather than translated from a moving
  target. micad.md was a M2 brief under five dated amendments claiming schema v4
  in one heading and v7 in another while the code is at v8, and five reconcilers
  where seven are registered; the amendments are collapsed into one statement of
  where the design stands.
- **Tests.** Measurement did not support a broad prune — `os/verify` runs a
  0.84 test-to-source ratio and `os/build` 1.06, close to one test file per
  module — so only what lost its subject went: the citation gate's negative
  suite, and `os-layout-lint-test`, a filename filter over a suite
  `os-verify-test` runs whole and which nothing invoked. `test/apid-api` is
  recorded as the manual harness it already was. The index gate's negative suite
  stayed green at 17/17; its plan cases now mint their own completed plan rather
  than borrowing a real one the pruning rule would delete.

Left open deliberately: 97 references to deleted records remain in 24 non-docs
files, mid-sentence in doc comments and in the generated `openapi.json`. They
resolve in the history, and clearing them costs a 24-file prose edit plus a
regeneration.

**Amendment 1 (same day).** Two things the milestones left short. Code no
longer cites task or plan records at all — 390 references across 125 files,
including the doc comments `utoipa` publishes into `openapi.json`, so an API
client was being shown `docs/task/RFCT-210.md`. The document was regenerated
from the corrected source, never hand-edited. Doing that surfaced two classes
M1's own dangling check had missed by requiring a `.md` suffix: 179 record
references in the living design documents and 94 pointers at the deleted
`docs/research/`. Both are now zero. `docs/zh/design/` also grew from six
documents to all sixteen.

## 2026-08-28 00:00 [progress]

**PLAN-021 — The defect and debt batch**

Fifteen of the sixteen filed tasks closed: RFCT-094, RFCT-096, RFCT-129
through RFCT-134, and RFCT-136 through RFCT-142; the sixteenth, RFCT-135,
grew into PLAN-022 rather than closing here. Alongside the filed batch,
RFCT-180 delivered the M1 quick-fix batch (test timeouts, the audit-trail
flake, dead instructions and dead code), and RFCT-190/191 ran the M3 ghost
sweeps — stale provenance references across os/** re-measured and repointed
or dated, plus the docs-side re-measures, owner sweep, and gate repairs.

The five defect clusters, by outcome:

- **Credential and auth**: the admin password is changeable after setup
  (RFCT-134), /healthz states what it actually checks (RFCT-131), and one
  outage no longer reports as both 502 and 503 (RFCT-140).
- **API/bus plumbing**: uptime comes from micad instead of apid's own
  /proc read (RFCT-129), the three settings failures reach the API as
  distinct errors (RFCT-130), per-request GetSettings round trips are
  cached (RFCT-132), and apid receives micad's SettingsChanged (RFCT-133).
- **Hardening**: apid's unit sandboxes the filesystem it serves
  (RFCT-137), cargo-deny enforces the no-C posture it previously only
  named (RFCT-138), the unreachable bundle store's fate is decided and
  recorded (RFCT-136), and the traversal guards gained over-the-wire
  coverage with a bundle-carrying fixture (RFCT-141).
- **Device**: the U-Boot boot-credit read is ordered against writers
  (RFCT-142), and the production keyring provisioning path is documented
  and testable while staying fail-closed (RFCT-139).
- **Test honesty**: dotted keys' missing item objects are certain rather
  than theoretical (RFCT-094), and "0 skipped" no longer hides skips
  (RFCT-096).

## 2026-09-15 03:20 [progress]

The documentation system starts moving to the shape the project actually has (task
`20260915-0316`, plan `20260915-0318`). The rule, settled with the user: **product
documentation lives in `mica`, module documentation lives in the repository that produces
the module.**

Landed here:

- `README.zh-CN.md`, the Chinese edition of the repository README, with the English one
  linking to it. Its wording follows the site, which is the product's core statement.
- `docs/README.md` opens with *Where documentation lives* — what this repository keeps
  against what a module's repository keeps, and the `<repository>:<path>` reference form.
- `architecture.md` no longer maps a repository that does not exist. Its component table
  cited `rootfs/` and `boards/` as local directories and `mica-core:micad/`,
  `mica-core:apid/`, `mica-core:mqttd/`, `mica-core:broker/` as component paths; `mica-core`
  is one Cargo workspace under `crates/`, and the two directories belong to `mica-build` and
  `mica-boards`. Every path was checked against the repository it names.
- Section 6 was a directory tree of `mica-build` — including `boot/`, the pin for the
  retired `mica-boot`. It is now a map of the seven repositories: what each produces, what
  it consumes, and the five files that are the interfaces between them.

Still open: the five subsystem designs that exist in both `mica` and `mica-core` and have
diverged, the per-repository moves, and the gate that would have caught the divergence.

## 2026-09-15 04:05 [progress]

First batch of the fact audit (task `20260915-0316`): **the documentation said the device
runs OpenSSH; it runs Dropbear.**

Checked against the code, not against another document:

- `mica-system-base:packages.tsv` selects `dropbear-bin`, and its base-root gate
  (`mica-system-base:src/rootfs.ts`) asserts that `usr/sbin/sshd`, `usr/bin/ssh` and
  `usr/lib/openssh` are **absent** from the packed root.
- `mica-core:crates/micad/src/reconciler/sshd.rs` renders `/run/mica/dropbear.env` as one
  `DROPBEAR_ARGS` line and each managed account's `~/.ssh/authorized_keys`, and drives
  `dropbear.service` — restarting it when the arguments change, because Dropbear reads them
  once at start.
- `mica-build` selects no SSH server of its own; it takes what the base root carries.

Corrected here:

- `architecture.md` §5 and its component diagram: Dropbear, with the absence of OpenSSH
  stated as the gate that enforces it.
- `design/access.md`: the opening note, the channel table, *One policy source*, and §3.1's
  three system effects — which described `/etc/ssh/sshd_config.d/10-mica.conf`,
  `/etc/ssh/authorized_keys.d/<account>` and `ssh.service`, none of which exist. The
  reload-on-change paragraph became restart-on-change for the same reason.
- `design/access.md` §3.4 was titled "*Dropbear replaces OpenSSH — decided, not shipped*"
  and told the reader that the sections above described "the OpenSSH behaviour images carry
  today". It is now *shipped, image acceptance pending*: the base and the packages are
  published, and what is still missing is an assembled guest acceptance — key login, sftp
  and the refusals exercised on a booted guest.
- `design/micad.md`'s reconciler table.

`make docs-verify` passes 8/8.

## 2026-09-15 04:25 [progress]

`design/micad.md` was 575 lines and shared five subjects with
`mica-core:docs/design/micad.md`, which had already drifted from it. Applying the rule —
product documentation here, module documentation with the module — it is now 369 lines of
contract:

- **Kept**: the D-Bus-not-a-second-IPC-stack decision, the `/mica/config/` rules a subsystem
  inherits, per-document schema versions and what an A/B rollback costs, fail-closed on the
  medium, and the boundary the bus draws — root-only in both directions, no `com.mica.Item1`
  façade, apid as a client rather than a second authority, a power action recorded before it
  is executed, and secrets that never round-trip through settings.
- **Moved to `mica-core`** (commit `2fead65` there): the measured detail behind each
  registered reconciler, the network reconciler's kinds, netdevs and teardown, the apply
  queue's segment-wise folding and its locks, and the ordering `power.rs` logs in. The
  member list of `com.mica.micad1` goes with it; this document names the interface and who
  may call it, not its methods.
- **Replaced** by a contract section: what every reconciler answers to — render to `/run`
  and enable at runtime scope, because a persistent enable would fail with EROFS on a
  read-only root; and tear down what you created, because removing a unit file does not
  reap a device networkd built.

`make docs-verify` passes 8/8.

## 2026-09-15 04:40 [progress]

The README opened on the slogan the site dropped. micaos.dev leads with **"Build the
product, not the OS." / "做产品，别做系统。"**; both READMEs still said "for teams that
build a product, not a distribution" — the wording the site replaced, because "distribution"
is jargon and nobody claims to be building one. Both now open on the site's line, with the
product description as the sentence under it. `README.zh-CN.md` keeps its language switch.

`docs/website/product.md` still describes the audience as "teams that ship a device, not a
distribution". That is the content contract's *who it is for*, not the slogan, so it is left
until the site's own copy is reviewed against it.

## 2026-09-15 05:00 [decision]

`verify-tracking` and `verify-terms` are removed, with their self-tests, on the user's call:
`plan/` and `task/` are development records, published nowhere, and their internal
consistency does not need a gate.

What goes with them:

- **`verify-tracking`** (322 assertions): index markers against each record's `status`
  field. Nothing now catches a record that says `completed` under a `[-]` row.
- **`verify-terms`** (107 assertions): its subject was not the tracking tree but the
  permanent documents — it refused the vocabulary of removed systems (RAUC, TUF, lode,
  raw-slot, the STATE partition, boot credits, connd), refused numbered record IDs
  (`PLAN-NNN`, `RFCT-NNN`, `UI-NNN`) in permanent prose, and required that a cited
  `<timestamp>-<slug>` record still exist. A permanent document may now name a system that
  no longer exists, or cite a record that was deleted, without failing the build.

`make docs-verify` is six scripts and 1931 assertions: catalog both ways, internal links,
truth-status evidence, board dossiers, Chinese coverage, release-lock vectors.
`make docs-verify-test` is five.

## 2026-09-15 04:40 [progress]

The download page now reads its catalogue at runtime from `/api/catalog`, answered by the
site's own Worker (`website/worker/index.ts`). The Worker is one route: static assets are
served by Cloudflare before it runs, and only a request matching no asset reaches it.

The pipeline is built ahead of the data, deliberately. No repository publishes a product
image: `mica-build` has no release at all, and the five releases that exist
(`mica-core`, `mica-system-base`, `mica-podman`, `mica-build-env`, `mica-boards`) carry lock
files and `SHA256SUMS`, not images — the artifacts themselves are in GHCR. So with no
`CATALOG_SOURCE` configured the endpoint answers `{"artifacts": []}` and the page keeps the
empty state it has today. Pointing it at a real catalogue is one secret, no code change.

Every entry is validated in the page (`catalog-schema.ts`): an entry missing a field it
should carry, or naming a `kind` or `profile` this site does not publish, is dropped rather
than completed with a guess — the content contract forbids hand-written release identities.
A fetch that fails leaves the empty state standing.

## 2026-09-15 04:55 [progress]

`CATALOG_DEMO=1` makes the Worker serve a sample catalogue — six rows over the four boards,
both profiles, four artifact kinds — so the download page's filters can be seen working
before anything is published. The answer carries `"sample": true` and the page renders the
rows behind a banner that says they are sample data and not a release, in both languages.

The content contract refuses hand-written release identities. A labelled sample behind an
explicit switch is the form that does not violate it: the rows never claim to be a release,
their deployment IDs read `sample-*`, and their digests are obviously placeholder. Turning
the switch off, or pointing `CATALOG_SOURCE` at real metadata, removes both the rows and the
banner.

## 2026-09-15 06:15 [progress]

The download page was listing artifacts; it now lists **images**. A row is a bootable image
for one board and profile — component packages (kernel, root, firmware, `.micaupd`) are not
downloads, they reach a device through an update, so the artifact-kind facet is gone.

Versions are the other half of the correction. An image has a history, and the page opens on
the newest version of each board and profile; a control below the table loads the earlier
ones and says how many there are. Ordering is by `releasedAt`, which is now a required field
— an entry without a release date is dropped, because there is no honest way to say which of
two undated images is current.

The table reads board · profile · version · released · deployment · size · download, and the
payload key is `images`. The sample catalogue behind `CATALOG_DEMO=1` carries seven rows
over four boards with two versions on three of them, so the history control has something to
open.

## 2026-09-15 06:30 [progress]

The download section is two levels now. `/download/` lists the boards and nothing else; a
board's page carries what can be obtained for it. Filtering lives inside a board, where it
is a choice between forms and profiles rather than a way to find the board in the first
place.

The forms are back, corrected: **system image**, **update package**, **firmware package** —
what an integrator can obtain and put on a device. Kernel and root components are not
downloads; they arrive inside an update, which is why the earlier artifact-kind facet was
wrong in both directions. Each form keeps its own version history, so a board's update
package does not hide behind its system image.

An entry now carries `filename` as published, and the download column shows it: a row says
`disk.img` or `x64-2026.09-2.micaupd` rather than a generic label. The payload key is
`downloads`.

The site builds 44 pages, eight of them board pages (four boards × two locales).

## 2026-09-15 06:47 [progress]

A board page now carries the three documents someone acts on after taking a file from it:
flashing (`user/install`), updates and rollback (`user/update-rollback`), and troubleshooting
(`user/troubleshooting`). They sit between the download table and the verification block,
which is the order the work happens in — obtain, write, update, diagnose. Both locales
resolve to their own documentation.

## 2026-09-15 07:15 [progress]

Two changes to the download section, on the user's call.

**A board's guides are configuration.** They were three hard-coded links — install, update,
troubleshooting — on every board, which is wrong: `cx3576` has a bench session and a
dossier, `virt-arm64` is the QEMU reference, and a board with none of those should not
pretend to. `website/boards.json` now carries each board's guide list in order; an entry
names a published documentation slug (`doc`, resolved per locale) or an external target
(`url`, for the board dossiers and bench sessions this site does not publish). The wording
comes from `download.guides` in the dictionaries, selected by `id`, so the configuration
stays language-free and an unknown id is skipped rather than rendered blank.

**The board index reads the catalogue.** Each card now says the newest version published for
that board, or that nothing is published yet. And a board that appears in the catalogue but
has no page here — an image published upstream before the site knew about the board — is
named in a line under the cards instead of being silently dropped.

The board list itself stays where it was, in the dictionaries: it carries hardware and
support status, which the catalogue does not, and it is what generates the routes.

## 2026-09-15 19:10 [decision]

`mica-build` started publishing: `x64/20260915-1458` and `cx3576/20260915-1515`, each with a
`.img` and a `.micaupd` per product. The download catalogue is wired to read them, through a
store rather than through GitHub on every request.

**KV, not a database.** The catalogue is a few dozen rows read whole, with no query, no
pagination and no history comparison, so a key holding the parsed result is the whole
requirement; D1 would add an operational surface for nothing. `GET /api/catalog` is a KV
lookup and never calls GitHub — an upstream rate limit or outage costs a stale answer, not a
broken page. A cron every 30 minutes rebuilds the stored copy, and
`POST /api/catalog/refresh` does it on demand behind a bearer token. With no token configured
that endpoint answers 401 to everyone: a refresh anyone can trigger is a way to spend the
upstream rate limit.

**The product is no longer a fixed set.** It was `dev | prod` in the schema; the build
publishes `dev` and `minimal`, and a fixed list would have silently dropped every `minimal`
asset. `profile` is now whatever the source names, and the page's filter offers what the
catalogue contains — the same way the board list is derived.

The parser (`src/features/download/github.ts`, unit-tested apart from the Worker) reads the
board and version from the scoped tag, the product from the asset name, and the form from the
extension. It skips the lock and the checksums, and skips any asset GitHub reports without a
digest rather than publishing something unverifiable. Firmware has no rule: no release has
carried a firmware asset, so its naming is unknown, and the rule I would have written was a
guess — the failing test that made that obvious was deleted rather than made to pass.

`deploymentId` became optional for the same reason: GitHub's release metadata does not carry
one, and the alternative was fetching and parsing `mica-build.lock` for a column the table
can leave blank.

Still to do, and it needs Cloudflare access I do not have: create the KV namespace, set the
two secrets, drop `CATALOG_DEMO`. `website/README.md` has the five commands.

## 2026-09-16 03:45 [progress]

The download catalogue reads `mica-index.json` instead of parsing release asset names.

`mica-build` now cuts a version index — `mica/<stamp>`, the release GitHub marks latest,
carrying `mica-index.json` — and `docs/design/mica-index.md` specifies it as the entry point
for exactly this: one file naming every current product, its files, their sizes and their
hashes. The parser that read `mica-<board>-<product>-<stamp>.<ext>` is deleted; the Worker
fetches the latest release, takes that one asset, and reads it.

Three things the site could not state before and now does:

- **The deployment identity** of each row, from `products[].deployment`. The column showed
  `—` because GitHub's release metadata does not carry one.
- **The uncompressed size** beside the compressed one. Images are `.img.gz`: the cx3576
  image is 82 MiB to download and 1.3 GiB written. Showing only the former misleads.
- **Which update archive a row is.** A deployment publishes up to three — `full` always,
  `root` when the kernel identity is unchanged, `kernel` when the rootfs is — and they are
  not interchangeable (`docs/user/update-packages.md`). A row now says which, and an archive
  kind the parser does not know is skipped rather than flattened into "update".

The `-minimal` products drop out on their own: the index omits what the catalogue marks
`publish: false`, so the rule lives upstream rather than in a filter here.

## 2026-09-16 05:15 [progress]

`user/flashing.md` now has a Chinese translation, so the site publishes it: the download
pages were sending readers to `user/install` for flashing, and install owns the order of
operations, not the per-board write. Every board page links the flashing guide, and
`published-docs.json` carries it — 32 prepared documents, up from 30.

Five user pages stay unpublished, and the reason differs:

- `overview.md`, `update-packages.md` — English only so far. `docs/zh/README.md` lists them
  `not-translated`. Publishing an English-only page would leave the Chinese site with a hole
  where the rest of the set has a page.
- `build.md`, `releasing.md` — `releasing.md` opens "For maintainers", and `build.md` is the
  building guide rather than a step in the customer journey. Whether they belong on a public
  site is a content decision, not mine.
- `manufacturing.md` — unpublished since the first allowlist, unchanged.

`docs/user/doc-contract.md` §2's information architecture does not list any of the five
either, so the contract is behind the document set it governs. That is worth reconciling
upstream before the site decides anything.

## 2026-09-16 09:05 [progress]

A careful pass over the download section, prompted by two stale-list bugs, found a third
that was minutes from shipping an empty catalogue.

**The release stamp moved form under the parser.** `mica-build`'s scoped tags became
`uefi-x64.20260916-0845` (`2026-09-16-scoped-tags-use-a-dot`), and `stamp()` split on the
slash of the earlier `cx3576/20260915-2230`. Every product of the new index parsed to no date
and was dropped: probed against `mica.20260916-0854`, the parser returned zero rows. The live
catalogue still held the 08:30 copy; the 09:00 cron would have overwritten it with nothing.
The fix deployed at 08:59:30. The stamp is now matched as a trailing `YYYYMMDD-HHMM`, which
reads both forms.

Two guards came with it. A refresh that parses to nothing while a non-empty catalogue is
stored keeps what is stored and fails, since an index that names products and yields no rows
is the parser's fault, not a mass unpublish. And a failed manual refresh answers 502; it
answered 200 with an error body, which a caller would read as success.

**The generic systems were renamed** (`2026-09-16-generic-systems-named-by-firmware`, accepted):
`x64` is `uefi-x64` and `virt-arm64` is `uefi-arm64`, and `uefi-arm64` is now a release
target. The site's board list, `boards.json` and the dossier link follow `support-tiers.md`;
`/download/x64/` and `/download/virt-arm64/` redirect permanently, in both locales, because
those URLs were already in use.

**Two more identity collisions.** The table keys rows on their href since the last fix, but
the Worker's sample rows all shared one href and so did the test fixtures — the sample would
have reproduced the stale-list bug the moment `CATALOG_DEMO` was set, and most rendering tests
had been running under duplicate keys. Each now carries its own, and the sample's update rows
say which archive they are.

## 2026-09-16 09:20 [progress]

Two follow-ups to the download pass, both agreed with the user.

**The form filter offers only what the board publishes.** It listed image, update and
firmware for every board, and no release has ever carried firmware, so choosing it could only
answer an empty table. The options are now derived from the board's rows, in the fixed order.

**The live index is checked, not only the parser.** The three faults of this morning — every
product dropped when the release stamp changed separator, and two board pages empty after
the rename — all passed every unit test, because fixtures are written in the shape the parser
expects and cannot see upstream move. `bun run check:index` reads the live `mica-index.json`
and fails if any published product parses to no downloads, naming the product, or if a
release-target board upstream is missing from the site's board list. Reverting the board list
to `x64` makes it fail with `uefi-x64 is a release target upstream but the site lists no such
board`, which is the check this morning's rename needed.

It runs in the website workflow on push and on an hourly schedule, because `mica-build`
publishes on its own clock and nothing there triggers a build in this repository. The full
lint/test/build job is skipped on the schedule; it has nothing new to check.
