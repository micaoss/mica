# Build and verification entry points

Use the repository wrappers and pinned images. The [build guide](build.md)
defines component inputs and assembly; this page maps changes to checks and
explains execution prerequisites.

## 1. Execution model

`build/run.sh` and `verify/run.sh` orchestrate with Bun. Set
`MICA_BUILD_CONTAINER=1` or `MICA_VERIFY_CONTAINER=1` to select their pinned
container routes. Byte-producing tools run in their declared images through
`build/src/toolbox.ts`; orchestration does not install a host compiler.

`IMAGE_BUN_1` and `IMAGE_DOCKER_CLI_28` in `mica-build-env:images.env` pin Bun and the
Docker CLI/buildx inputs. `build/Dockerfile` also provides Python and libcap
for transport and file-capability checks, recording resolved Debian versions
in `/etc/mica-build/build-tools.tsv`. Image pins do not freeze the Debian archive.

Keep outputs and caches under the project's ignored `_out/`, `tmp/` or `.tmp/`
directories. A sibling Docker container resolves volume sources on the daemon
host: use the actual host project path and mount only required directories.

## 2. Gate map

| Change | Entry point |
|---|---|
| A product, end to end | `make product PRODUCT=<name>`, then `make product-verify PRODUCT=<name>` |
| A product's recipe or a board's manifests | `make os-product-test`, `make os-rootfs-manifest-test` |
| Anything that names a board | `make os-board-name-lint` |
| Component/image/release producer | `MICA_BUILD_CONTAINER=1 make os-build-test` |
| Image verifier | `make os-verify-test` |
| Independent release gate | `make os-release-verify-test` |
| Rust services and native deployment tools | `make os-rust-gate` |
| Built-in dashboard | `bash apid/ui/build.sh --check` (in `micad`) |
| API contract expectations | `make os-apid-api-spec-pins` |
| Update server | `bun run --cwd update-server check` |
| Documentation | `make docs-verify docs-verify-test` |
| Shared component contract | the fixtures, diffed byte for byte between the two repositories |
| Host/toolchain boundaries | `make os-host-toolchain-lint os-host-toolchain-lint-test` |

**A gate reports before it refuses, and the count that matters is
*unexplained*, not *dropped*.** A gate that is relaxed to make it pass is
worse than no gate: it converts an open question into a green tick. So a new
gate starts by reporting its number, the number is split into what is
explained and what is not, and the refusal arrives when the unexplained count
reaches zero and stays there. The composition drops are the instance: 703
paths left behind is not a failure condition, 703 *unexplained* would be.

**The unchosen-property test: count how many independent things would have to
change for it to stop being true.** When you find a property nobody chose —
something that happens to hold — **one is luck and needs a gate; several is
structure and needs a record.** Dropbear working without PAM is the first
kind: one package, one build flag, and it stops. D-Bus activation being
unreachable is the second: several independent facts hold it, so it is a
property of the design and belongs written down rather than guarded. The test
is `mica-core`'s and it answers a question that otherwise turns into taste.

**A query's aperture must be at least as wide as the claim built on it.**
*This is the general statement; where a spec needs the operational form, it
cites this paragraph rather than restating it (`release-lock.md` 1.3).* Five
instances now, across four repositories and three tools, the fourth of them
while correcting the third:
`mica-res`'s reader followed the spec's slash form and silently ignored every
dot-form release; the index count was taken with a `mica.` prefix test that
could not match the slash-form index and returned nine of ten; and the boot
gate was declared absent from this repository after grepping `ci.yml` alone,
when it is a step of `release-product.yml` — the claim was about *anything in
CI or release*, the query covered one file. A query returns nothing found, not
nothing exists, and the two are indistinguishable from the output alone. State
the aperture in the sentence the result becomes, or widen it until it matches.

The fourth was the correction of the third, an hour later: `release-product.yml`
was read, found to carry no `on:` block, and written up as a gate that does not
run on push. True of that file, false of the system — a reusable workflow
inherits the trigger of whoever calls it, so the aperture had to include the
callers. When the claim is *when* something runs, one file is never the
aperture.

**The sixth is the sharpest and it is a different variant: a wrong key is an
aperture of zero.** A symbol was handed on from memory and never checked —
`CONFIG_BLK_DEV_BFQ` — and a `grep` for exactly that returned **absent on all
four boards**. Nothing was truncated, nothing was filtered out, and the answer
was still a property of the query: the symbol in those trees is
`CONFIG_IOSCHED_BFQ`, and the real split is `uefi-x64` no, `uefi-arm64` yes,
`cx3576` no, `s905x5m` yes. Every other instance here is an aperture too
narrow; this one points at nothing at all, and it is the most dangerous
variant **because it returns a uniform answer, and a uniform answer reads as a
finding rather than as an error**. It was caught by grepping
case-insensitively for `bfq` instead of for the symbol that had been handed
over — that is, by distrusting the **key** rather than the result. The
durable form is `mica-boards`', which found it: **a uniform answer from a
query that names something is the shape to re-ask with a looser key, because
a wrong key returns exactly that.** It disowned the trigger it had actually
used — the uniform `ABSENT` *looked too tidy* — on the ground that "too tidy"
is a weak signal to depend on, and **uniformity is the checkable version of
that instinct**, which is what turns an instance into something a person can
follow.

The fifth came from the opposite direction and is the reason this is stated
once rather than twice: a suite named for FIT lifecycle tests the FIT boot
path and boots nothing, so *no suite boots a FIT image* could only be
established by reading every suite, not by trusting the one named for it. A
negative claim inherits the aperture of the query that produced it, whether
the aperture was a filter, a file or a name.

**Identical wrong bytes are a pass.** The shared component-contract fixtures
are diffed byte for byte between `mica-core` and `mica-build`; on the board
rename both sides said `x64`, they agreed exactly, and the check passed. That
was not a failure to follow the contract — the reasoning about it was correct
— it is a hole in what the contract is *about*: a byte-equality check between
two copies proves they match each other and says nothing about whether either
matches the world. The agreed fix makes the fixture state the board
**vocabulary**, and has `mica-build` assert that vocabulary equals the board
rows it pins, so renaming a board turns a gate red in the repository that
renamed it, on the same push. The shape — two correct things whose
relationship is wrong — is named with its other instances in
[doc-contract](../user/doc-contract.md) section 6; this is that shape outside
prose.

The update-server command runs in its pinned Bun environment. Consult
`.github/workflows/check.yml` for the full CI gate set. Local success and remote
CI status are recorded separately; test counts belong to a dated delivery
record, not to the permanent invocation contract.

## 3. Rust workspaces

`tests/rust-gate.sh` runs the unmodified `hack/check.sh` in `micad` and
`mica-deploy`. Each workspace checks formatting, strict clippy, nextest,
doctests and cargo-deny. The micad gate also checks generated OpenAPI drift.

The local `mica-build-rust-check` image adds rustfmt, clippy, nextest, cargo-deny
and a real private D-Bus daemon to the pinned Rust builder. The image records
its versions; the wrapper prints them. Select one workspace with
`bash tests/rust-gate.sh mica-deploy` or `bash tests/rust-gate.sh micad`.

The wrapper builds the embedded UI before entering the Rust check container and
supplies `MICA_APID_UI_DIST_DIR`. CI builds the pinned image family and calls the
same wrapper. It checks that the workspace MSRV declarations agree, but does
not run a separate compiler at that MSRV. The gate result attests the pinned
release compiler actually named in its log.

## 4. ARM64 execution

Building an ARM64 image under a buildx executor does not establish that a
direct `docker run --platform linux/arm64` can execute on the daemon host.
BuildKit's emulator and host binfmt registration are separate facilities.

Nor does it establish the released bytes. Before trusting a local arm64
artefact against a release, answer one question: **is the local build the same
build as the CI one?** Ask it **per artifact, not per repository** — one tree
can hold all three answers, and "which position is my repository in" is the
question that gets this wrong.

| The build container runs | Local versus CI | Measured |
|---|---|---|
| on the target platform | the same build, emulated | reproduces (`mica-system-base`, eight archives; `mica-podman`, three trees including its Rust stage) |
| on the host with a cross toolchain, CI native | two different builds | differs (`mica-core`, six Rust packages of six) |
| on the host with a cross toolchain, CI the same | the same build | nothing to compare |

`mica-boards` answered it on paper for three artifacts and got three different
answers in one repository (2026-09-16):

- **pools** run on the target platform — `tools/deb/build.sh` sets the platform
  to the package architecture — so CI is native per architecture and a foreign
  local host is emulated. Measured: a locally emulated arm64 pool rebuild
  matched the CI-published `cx3576` packages byte for byte, the fourth
  independent measurement of emulation not changing bytes.
- **kernels** are built on the host with the toolchain doing the crossing, and
  CI cross-builds no kernel: all four run on their matching native runner. So
  on an x86-64 workstation the three arm64 kernels are the `mica-core`
  position, while `uefi-x64` is the same build in both places.
- **U-Boots** are cross-built on amd64 in CI and cross-built on amd64 locally,
  pinned there deliberately because the assembly runs the FIT host tools on
  x86-64. Same build in both places: nothing to sort.

Compare **OCI layer bytes, not manifest digests**. A manifest digest moves
with the release string, so comparing manifests reports noise for every
artefact and signal for none.

So a local reuse or version guard is authoritative for the half CI builds the
same way — for `mica-podman`, which checked its scripts stage by stage, that
is both halves — and for the other half only once the shapes are known to
match. Name the repositories the caveat binds rather than stating it of the
workspace: today it binds `mica-core`, and `mica-boards` is answering the same
question on paper.
Before treating an arm64 difference as a changed input, run the control: the
same station, the same command, the previous lock. Two locks giving the same
bytes, both unlike the release, means the difference is in how the build runs
rather than in an input (`docs/task/20260916-0900-emulated-arm64-bytes.md`) —
and that is a reason to look, not a reason to stop looking: a real change hides
in exactly the same shape.

**String absence in a stripped Rust binary is not evidence of a missing match
arm.** Scanning the shipped `mica-deploy` and `mica-runkit` for the old board
literals found none — not because the vocabulary is absent, but because a 3
to 10 byte literal compiles into an immediate comparison and never reaches
`.rodata`, while the *bail messages* of those same matches are present in both
binaries. Read naively, the scan says the pinned client has no board
vocabulary, and an investigation closed on it would have closed with the wrong
answer. A binary answers "is this string stored", not "does this code compare
against it".

**A number that disagrees with your model is worth more than the explanation
that makes it go away.** On 2026-09-19 a one-object gap between a contract's
44 required keys and a bucket's 43 stored digests was explained as a counting
difference — coherent, arithmetically correct, and it dismissed the defect it
was explaining: a pack chunk stored under the wrong board's name, which no
audit over the object set could see because the fault was in the contract over
names. The rule that follows is cheap: when a count disagrees with the model,
find the object the disagreement points at before writing the explanation, and
if the explanation arrives first, treat it as a hypothesis with a name
attached rather than as a resolution.

**Rust: hold `-C metadata` constant before you diff.** A byte comparison of two
Rust artifacts built with different `-C metadata` is **not evidence of a code
difference**. The `rustc` host triple feeds the disambiguator, so a cross build
and a native build differ in it by construction, and `mica-core` measured what
that alone does: two local cross builds differing *only* in the metadata
string moved twelve shared function names in size against five, moved function
counts, duplicated `drop_glue` differently and moved linker erratum stubs —
noisier than the cross-versus-native difference it was investigating, which
sits below that noise floor. So hold the disambiguator constant first; if you
cannot, the only honest statement available is that the difference is below the
noise floor. Reporting codegen without doing this is how someone eventually
reports a compiler bug that is not there.

Use the native pinned Rust builder's `aarch64-linux-gnu-gcc` for cross C test
helpers on an x86-64 host. The C-only builder is native-only. Use QEMU full-system
acceptance for the target kernel and service behavior. A qemu-user smoke
limitation, such as crun execution, is reported explicitly and does not become
a skipped full-system requirement.

### What no gate does: start the guest

**Nothing in CI or in a release has ever booted an image**, in any repository
here *(established 2026-09-19 from `mica-build`'s workflows)*. That is a
boundary, not a verdict on the gates, so take both halves together.

What the automated gates *do* prove, and they have caught real defects this
month: `--verify` is a static read-back of the assembled image against its
contract — geometry, signed objects, roothashes, the firmware receipt; the
products job runs a **container** smoke over the shipped binaries in the root
that ships; the package, lock and reuse gates prove what a release may
contain; and the docs gates prove the records. The only QEMU in the tree that
CI touches is `binfmt`, so that amd64 packaging tools run on an arm64 runner.

What none of them does is start the guest. The suites that boot one —
`lifecycle-uefi` and the `apid-api` harness — are `make` targets run by hand;
`lifecycle-uboot-fit` is not one of them despite the name, and carries no QEMU
at all (checked at `e92dc5d`): it exercises firmware IO, signatures, records
and dirty-filesystem behaviour on the host. `privileged.yml`, the one workflow that would
cover it, **has never run**: it is `workflow_dispatch` plus a Monday cron that
has not fired since it was written.

The consequence, dated so it can be checked: the newest lifecycle evidence
directory is **2026-09-15 20:17 UTC** and the board rename landed
**2026-09-16 08:05 UTC**, so the last time anything booted a product precedes
the rename by twelve hours. That is how three days of green CI coexisted with
published `uefi` images whose signed board name the pinned client refuses at
PID 1.

So a reader can sort claims about a product: *the image is assembled to its
contract and its binaries execute* is evidence-backed; *the product boots and
reaches its services* is inference from the last hand-run suite, and carries
that suite's date.

#### What the boundary was hiding, and the console that showed it

The same day the boundary was written, `mica-build` booted one of the
published images. **The device does not boot; it powers down.** That is the
phrase to use — not "updates break", which describes a working device that
refuses an archive. The guest starts the kernel, brings up verity signature
policy, refuses the board name in its *own* signed identity at PID 1
(`mica-init: boot refused: unsupported boot backend board`) and powers itself
off at **1.7 seconds**.

The message is the bail arm of the pinned `BootKind::for_board` reached from
`mica-runkit`, while the image's `kernel/boot.json` says `uefi-x64`. Both ends
of the pipeline now agree from opposite directions: the signed envelope of a
published `.micaupd`, decoded, reads `uefi-x64`, and the image built from the
same pins refuses that name at PID 1. Every `uefi` image published since the
rename carries it — `uefi-x64` and `uefi-arm64` at `20260916-0845`,
`20260916-1653` and `20260919-2103`.

**Why nobody noticed is the part that stops this reading as carelessness.**
`cx3576` and `s905x5m` are untouched: their names did not change, so their
arms still match. The two boards anyone would have put on a bench still work,
and the break is precisely in the two products nobody has hardware for — the
products where this harness is the only thing that ever runs them.

#### The boot gate, authorised 2026-09-19

One `uefi` lifecycle boot in `ci.yml`, on the amd64 runner, over the product
that job already builds: one product, one boot, no fault stages, landing with
`mica-build`'s re-pin round. Two constraints, because a gate that is skipped
is worse than no gate:

- it **fails** the job rather than warning — no pass marker, red push;
- it is conditional on nothing a person can forget: no path filter, no opt-in
  variable. This break arrived through a rename that touched code and locks,
  and a path filter would have skipped it again.

The earlier line here — that whether CI boots a guest is a user decision — was
superseded on the measurement: four minutes on a push is not a cost worth
sending anywhere as a decision, against three days of green CI over an image
that powers itself off. The fallback, if those four minutes ever become a real
problem, is to make `privileged.yml` actually run and put the suite there,
trading same-push detection for weekly detection — and only against a
measurement showing the cost, not in advance.

What closes this is the guest reaching `FILE_AB_RUNTIME_PASS` after the pin
moves, not the diff. A rename verified by reading the diff is what produced
the break.

**The boundary moved on 2026-09-19 at 23:56 UTC, and it moved in the release
path rather than in `ci.yml`.** The gate is a step of `release-product.yml`,
`Boot it, one runtime stage, no faults`, running
`tests/lifecycle-uefi/run.sh <product> --runtime-only` after the image is
built and statically verified; it took three red runs to land, every one of
them a defect in the harness — container-made root-owned files touched from
the host, fine on the root host the suite had only ever run on — and none in
an image. In the `20260919-2356` round it ran and passed for both `uefi-x64`
products, which is the first time anything here booted an image outside a
hand run.

**Its coverage, stated so nobody trusts it for more:** the step is
`if: inputs.arch == 'amd64'`, so it booted `uefi-x64-dev` and
`uefi-x64-prod` and was **skipped** for both `uefi-arm64` products and both
`cx3576` products in the same round — read back from the three release runs.
It covers the UEFI amd64 path, one runtime stage, no fault stages, no updates;
`mica-deploy`'s arm64 arm (the `BOOTAA64.EFI` target) would pass this green if
it broke.

**It does run on a push, which an earlier wording here denied.**
`release-product.yml` is a reusable workflow with no triggers of its own, and
two workflows call it: `ci.yml`, whose `release-products` job calls it on
every push to `main` and every pull request with `upload: false`, and
`release.yml` when a release is published. So the gate fires on the push that
renames a board, which was the point of asking for it. Measured on the push of
`f46b64a6`: in that `ci` run, `release-products (uefi-x64-prod, amd64)` booted
and passed while the `uefi-arm64` and `cx3576` jobs skipped the step.

#### The catalogue now has two kinds of backing

Stated as one pair, because the halves are only useful together *(2026-09-20,
after `s905x5m.20260920-0033` and the index `mica.20260920-0046`)*: **four
boards are release targets, eight products are published and indexed, the UEFI
images boot, and no FIT board image has ever been booted by any suite —
because no suite boots one.** Not "no automation runs it": there is nothing to
run. `tests/lifecycle-uboot-fit/` carries no QEMU at all — measured file by
file at `e92dc5d` and verified independently — and tests firmware IO,
records, signatures, trust and dirty-filesystem behaviour on the host, while
the boot machinery (`boot.sh`, `timed-boot.py`, `runtime-build.sh`,
`kernel-faults.sh`) is in `tests/lifecycle-uefi/`.

**The number, since it is half the catalogue.** Of eight published products,
**four are started by nothing in this tree**: `cx3576-dev`, `cx3576-prod`,
`s905x5m-dev`, `s905x5m-prod`. The claim is about suites and automation, which
is what can be measured from here; a person starting one on a bench is a
different claim with a different kind of evidence, and one was reported on
2026-09-20 (below). `cx3576` is not a new-board exception — it has
been a release target since before the rename, with six published releases
behind it; it is the rule for its whole boot backend. The other four have boot
evidence of two different ages: `uefi-x64` from the CI gate, per push and per
release since 2026-09-19, and `uefi-arm64` from hand-run QEMU rows that
predate the rename.

**Unrun is not the word; unstarted is.** The FIT side is attended: `ci.yml`
runs `make os-fit-records-test` on every push, and the FIT suite's own checks
cover firmware IO, signatures, trust and the record logic. What none of them
does is start the image. Saying "nothing runs for FIT" would be false and
would invite the wrong repair — more host-side checks, and a feeling of
coverage. The true sentence is that **nothing starts a FIT image**.

**And it is explicit in the tree, not inferred from an absence.** Both suites
that do start a guest refuse a FIT board by name:
`tests/apid-api/src/qemu.ts` throws
`<board> boots a FIT; QEMU acceptance boots UEFI boards`, and
`tests/lifecycle-uefi/product-inputs.sh` refuses the same case in shell. So
the position is stated in three places — two refusals and a FIT suite that
boots nothing — and the consequence for anyone scoping the work is that **a
FIT boot suite is a new suite, not the unblocking of an existing one**.

**Why the mistake was easy, which is the part worth keeping.** The suite is
named `lifecycle-uboot-fit`, it sits beside `lifecycle-uefi`, and it tests the
FIT boot *path* — firmware IO, signatures, trust. Everything about the name
and the neighbourhood says the FIT one boots too, and the refusal message says
it outright: *this suite boots UEFI boards (`tests/lifecycle-uboot-fit` for
the other)*. **For the other** reads as though a FIT image were booted
somewhere. That is where the belief came from — a written source, at the point
of use, wrong in the direction that manufactures a capability — and it is
worth looking for such a source before concluding that a wrong belief was
simply careless. A name is not evidence of behaviour either: the check is one
`grep` for the machinery, not a reading of the directory listing.

**A bench boot was reported the same day, and it does not move this.** The
user reported on 2026-09-20 that `cx3576` booted successfully on hardware —
the first physical boot report this project has had. It arrives with no
artefact attached, so it is a report rather than a qualification row: the
dossier rule is that a pass row carries a date and an evidence reference, and
`mica-boards` owns what would make it one. Nothing in the paragraphs above
changes either way. *No suite boots a FIT image* and *a person booted one* are
different claims about different things, and when the row exists they will sit
side by side: a board that has booted on a bench, and a catalogue that nothing
automated starts.

This is consistent with the decision that a release target publishes images
and asserts nothing about hardware
([support tiers](../boards/support-tiers.md)), and it is a **different and
sharper statement than the tier table makes**: that table is about
qualification, this is about whether anything has ever started the thing we
publish. Half the catalogue moved from inference to evidence on 2026-09-19;
the other half has not moved at all, and a reader picking a product should be
able to see which half it is in. What to do about the FIT side is a question
for the user, not a suite to schedule here.

## 5. Complete-image acceptance

Build the current package pool and compose the root, then produce signed root,
kernel/support and deployment artifacts with `build/run.sh --components`.
The `image` command assembles a new three-partition factory image. No test
upgrades an old-layout image into this layout.

Run `verify/run.sh --verify` with the explicit board, complete image and metadata
public key. The API harness (`mica-core:tests/apid-api/README.md`) also
requires a complete image and public boot trust input. Its dry run checks
prerequisites without booting (`MICA_PRODUCT=<name>`). `make lifecycle-uefi
PRODUCT=<name>` (`tests/lifecycle-uefi/run.sh`) assembles the acceptance disk
out of the built product, boots it for the runtime and shutdown evidence,
then runs the update and fault stages; the privileged lane
(`.github/workflows/privileged.yml`) is written to build, verify, gate,
smoke-break and repart-test every product under `products/`, and has never
run (section 4). Tests under `tests/lifecycle-uefi/` cover both UEFI
architectures, full services, updates, interruption, fallback and shutdown.

The API harness does not build its input image. Missing images, signing inputs
or emulation facilities are prerequisite failures, not evidence against the
guest. API observation tests must wait for admitted tasks; HTTP acceptance does
not prove a reconciler has finished.

cx3576 software checks precede the separate [physical bench sequence](../boards/cx3576-bench.md).
VM reset and deterministic I/O faults cannot establish physical eMMC power-loss
durability. Each acceptance result is bound to its artifact; remaining hardware gates are in
[support tiers](../boards/support-tiers.md#current-boards).

## 6. Documentation gates

`make docs-verify` checks catalog membership in both directions, relative links,
normative truth-status evidence, board dossiers and Chinese user-guide coverage.
`make docs-verify-test` proves failures on deliberately invalid fixtures.

Keep the catalog synchronized with the shipped design/user/website/BSP pages.
Engineering proposals belong in plan/task tracking. Product instructions must
describe the current contract; superseded operating procedures remain in Git
history rather than beside current instructions.

## 7. Development integration and acceptance workflow

Source integration and image qualification are separate. A reviewed source
change may merge to development main after its affected checks pass while
exact-image guest or board acceptance is still pending. A merge is neither a
release nor an acceptance pass; authentication, signature and release gates
are unchanged.

Each acceptance round uses one immutable candidate image:

1. Preflight the whole input set: package ownership, generated files, symlinks
   and masks, ELF/interpreter closure, pinned downloads, source identity, trust
   inputs and tool availability. Report every input defect before building.
2. Produce only changed packages or boot/kernel tools. Architecture-independent
   packages are produced once; architecture-dependent recipes keep separate
   amd64/arm64 outputs and receipts.
3. Compose the affected root from verified packages, run its closure and binary
   smoke checks, then sign components and assemble one candidate image.
4. Test isolated copies of that image for boot, reboot, shutdown,
   update/fallback, reset, storage, services and authenticated API behaviour.
   Bind each verdict to its source and artifact; keep the original image.

Generic development iterates on x86-64. An ARM-specific source change requires a
targeted ARM check; a consolidated ARM round follows a stable x86-64 baseline.

### Changes and invalidation

| Changed input | Work that must be reconsidered |
|---|---|
| Documentation or tracking only | Documentation checks; preserve artifact source labels |
| Package source, recipe, pin, toolchain or feature inputs | That producer and its consumers; preserve unrelated packages/kernels |
| Runtime selection or root composition | Affected input/closure tests and root onward; reuse unchanged verified packages |
| Native startup/shutdown or boot packaging | Affected native/boot outputs and dependent signing/image/guest checks |
| Kernel, device tree, firmware or boot trust | The affected board components and their actual consumers |
| Test transport or executor wrapper only | Prove the wrapper, then resume the failed check against the same immutable input |

Reuse follows the source, recipe, toolchain, configuration and trust contracts
and byte identities. A different main commit is not evidence that all
producers changed; matching architecture alone is not evidence of reuse. Do not
weaken freshness checks or rename old outputs to claim new production. A
recovered transport error or a successfully retried stage stays in history;
unresolved product failures remain failures.
