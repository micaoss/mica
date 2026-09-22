# Changelog

## 2026-09-22 16:15 [progress]

P3, fourth slice (`mica-build` `afb1f095`, `b4bfcd4a`): the producer
discovery, the package inputs hash, the package build driver and the pool
preflight are `src/pool/{producers,package-inputs,build,preflight}.ts`
(`bun src/cli.ts producers|package-inputs|pool-build|pool-preflight`),
their rows, manifests, reports and built archives byte-identical to the
shell's; the packer stays shell as `stages/pool/pack.sh`. The inputs hash
moved once, as the plan allows, while no release has published a pool.
The bootstrap's container is root again -- CI measured a container running
as the host user failing 79 fixture tests on `lchown` and a sibling's
root-owned output -- and hands its scratch output to the host user when
the command ends; it also mounts the docker client's configuration, so a
buildx builder is one builder on both routes.

## 2026-09-22 15:47 [progress]

P3, third slice (`mica-build` `2b0285d2`, `08e26e1d`): the package pool is
`src/pool/pool.ts` (`bun src/cli.ts pool rows|own|fetch|index`), row for
row and byte for byte with the shell over the tree's locks and the real
amd64 pool; the index still runs `dpkg-scanpackages` in the base image,
through `stages/pool/index.sh`. The OCI reader fetches instead of spawning
curl, so the pool gate is a bun test whose registry is the test process
(23/23 on both routes), and a `Refused` carries its whole message. CI on
the previous slice measured the bootstrap's container creating a cache
directory as root and the host refused beside it; the container now runs
as the calling user, reproduced and measured as uid 1001 before the push.
The seven entries of this day from 12:13 on were stamped ahead of the
clock and now carry the UTC time of the commit that added each.

## 2026-09-22 15:17 [progress]

P3, second slice (`mica-build` `1c2387b9`): the OCI reader and the offline
pins are `src/pool/oci.ts` and `src/pool/local-pins.ts` (`bun src/cli.ts
oci|local-pins`), byte-identical to the shell over a real pool manifest and
blob and over a fixture checkout's offline layout, lock and pin. Two seam
facts came with it: the pool gate's fake registry is handed to the reader
as `MICA_CURL` under the tree rather than through `PATH`, which the
bootstrap's container never inherits; and the bootstrap now names its
route inside (`MICA_BUN_ROUTE`) and mounts every offline pin's checkout
read-only, so an offline pool reads on that route while `local-pins`,
which writes outside the tree, refuses it by name.

## 2026-09-22 15:03 [progress]

P3 of the one-language plan has started in `mica-build` (`9f94575d`): the
image resolver, the upstream-lock reader and the source checkout are
`src/locks/{from,upstream,source}.ts`, reached as `bun src/cli.ts from|
upstream|source` by seventy callers that used to say `bash tools/*.sh`;
`src/image` and `src/verify` import the resolver rather than spawning it.
Message-for-message parity over the real `locks/` (39 image rows, 12
upstream rows, the Base checkout). On the way, two repairs the day's CI
runs measured: the host-toolchain lint now takes a whole-file container
declaration in TypeScript (`64509ba1`, since P2 made `.ts` files container
scripts), and a stray line in two BSP kernel Dockerfiles from the fourth
slice's edit (`801b220f`). `801b220f` also committed the three scripts'
deletions twenty minutes before their callers moved -- a staged `git rm`
rides along with a path-limited commit -- so main's pool jobs were red for
that window; `9f94575d` completes it.

## 2026-09-22 14:39 [decision]

**The bsp image's helpers become resources the base image's bun computes**
(user, 2026-09-22; `mica-build` `89fd5403`, plan `20260922-0817` P2, fourth
slice). Rather than adding bun to `mica-build-env:bsp`, each kernel
Dockerfile renders the boot logo in a `logo` stage on the base image
(`common/kernel/mklogo.ts`, byte-identical to the Python's PPM, 0.2 s
against 1.6 s) and exports the regulatory certificates in a `regdb` stage
over what the first profile's build staged (`export-regdb-certs.ts`,
byte-identical over a synthetic tree); the BSP stages copy the results in.
The uefi-x64 kernel rebuilt through the new stage is byte-identical in every
output. Every board's kernel inputs hash moves once. What remains Python in
`mica-build` is `common/scripts/git-pack-manifest.py`, in the bsp fetch step
until P3 moves the fetch to the host, and the inline heredocs of the shell
gates, which go with P4; the bsp image keeps python3 for the kernel's own
scripts, which are not this tree's.

## 2026-09-22 14:01 [finding]

**A gate that runs under sudo can write outside its fixture for months and
pass.** `mica-build`'s reproducibility gate substituted `/rootfs` once per
line into the pack scripts it exercises; a line naming it twice kept the
second, and every run created `/rootfs/var/lib/systemd` on the host. Root
never noticed; the first unprivileged run (CI `35733135324`, after the
suite lost its `sudo`) refused it and the gate went red. `8d565d39` bounds
the substitution at path boundaries and removes the litter here. The
privilege was the mask: a fixture gate should be run at least once as a user
who cannot write anywhere but the fixture.

## 2026-09-22 13:23 [finding]

**A JIT runtime does not survive user-mode emulation, and the boot
packager runs under it on arm64 runners.** `mica-build`'s boot tools image
is x86-64 by design and is emulated on an arm64 host; the third P2 slice put
bun into it for the ELF closure helper, every amd64 product packed, and every
arm64 release job died with bun's `panic(main thread): abort() called` under
qemu (run `35728952530`). The Python before it ran there because the
interpreter has no JIT. The helper is bash now (`3fa4e389`), the rule's own
exception for a container where bun is not the toolchain, and bun leaves that
image. The same run measured a second seam defect: `bin/bun.sh` announced
its route on stderr, and a gate comparing a command's combined output saw
the announcement; it is silent unless stderr is a terminal. With the `/tmp`
path (`9bb86d01`) and the unforwarded environment (`5c770a23`), that is four
container-route defects in one day, none visible with bun on the host:
the route is measured only where it runs, and `MICA_BUN_CONTAINER=1` is how
to run it here.

## 2026-09-22 12:44 [progress]

The host-side Python of `mica-build` is gone (`5c770a23`, plan
`20260922-0817` P2, third slice): the boot stage's ELF closure, the
evidence schema (`bun src/cli.ts evidence-schema`), the mirror-hook gate
(a bun test whose mirror is the test process), the lifecycle suite's three
QEMU helpers, the repart measurer, the cx3576 medium inspector and the three
cx3576 kernel tests are TypeScript; the boot tools image and the lifecycle
lab image copy `bun` out of the build-env base image. Measured: the closure's
`/init` and every initramfs member but `boot.json` byte-identical in a
release-shaped product build, the evidence schema and the DT test the same
output as the Python, the measurer's record byte-identical, 106 verify
checks. `bin/bun.sh` now forwards `CI`, `GITHUB_ACTIONS` and `MICA_*` into
its container route: without them the locks reader never saw CI and the
offline-pin refusal never fired there (`os-pool-test` 2/23 in run
`35725871542`; 23/23 now on both routes). What remains Python in `mica-build`
runs inside the bsp image, where there is no bun (`mklogo.py`,
`export-regdb-certs.py`, `git-pack-manifest.py`) -- an open question in the
plan -- plus the inline heredocs of the shell gates, which go with P4.

## 2026-09-22 12:13 [progress]

The runtime composition of `mica-build` runs on bun (`9bb86d01`, plan
`20260922-0817` P2, second slice): `rootfs/runtime/{select,compose,
source-lineage}.py` are `src/rootfs/runtime/{select,compose,lineage}.ts`
plus `fsx.ts`, `pyjson.ts` and `elf.ts`, the pack stage runs `bun` copied
out of the pinned build-env base image and `python3` leaves `pack-tools`,
and the 2.2k lines of Python tests are the 149 cases of
`tests/suites/rootfs-runtime/`. Parity measured on a release-shaped
`uefi-x64-prod` build: every signed component byte-identical to the
reference, the drops table identical, the runtime report the same size
with only the installation timestamps, source commits and input hashes
differing; the lineage record byte-identical over the real pool. The same
commit repairs the three reds of CI run `35722671849` on `2a9a9180`, one
defect: `tools/podman-pool.sh` handed `bin/bun.sh` a `/tmp` path, which
the container route writes inside the container and loses. Still Python
in `mica-build`: the lifecycle suite's QEMU helpers, `boot/elf-closure.py`,
the two kernel helpers, `common/scripts/git-pack-manifest.py`, two gates,
two suite helpers and the four under `boards/cx3576`.

## 2026-09-21 12:17 [finding]

**A gate has a domain, and `make docs-verify`'s is the working tree rather
than the commit.** `3f2926a` pushed an index entry for a research page that
exists only in another session's working tree: the local gate passed 243/243,
and `ci` failed on the clean checkout with `indexes
'2026-09-19-functional-architecture-audit.md' … does not exist`, 1 FAILED,
241 passed. Removing the entry then failed the **inverse** way locally, since
the file was still on disk. Neither state satisfies both readers, which is
`verify-index.sh` correctly reporting that **an index entry and the file it
names have to land in one commit** — the symmetry is the feature, not the
obstacle.

The repair (`162081b`) drops the entry and was verified by running the gate
on `git archive HEAD | tar -x`, an export that reproduces what CI builds and
touches nothing in a shared checkout belonging to somebody else. Every other
repair required moving or deleting another writer's untracked file, trading a
red job for an afternoon's work. Written into `docs/design/build-harness.md`
§6 because **this is a red I watched, not one I predicted**: the instrument
that only ever passes has no witnessed failure to quote, and this one now has
one in both directions.

The narrower rule it leaves: **a path being mine to edit does not make its
contents mine.** `docs/README.md` is a file I own edits in, and it had
accumulated a line I did not write. Staging an owned path is not the same as
staging an owned diff — read every hunk of `git diff HEAD -- <path>` before
`git add` in a tree other sessions write to.

## 2026-09-21 12:11 [finding]

**The coordinator is paused on the user's instruction and cross-repository
traffic goes to the user.** Recorded here because of the shape it would
otherwise take: **an unread channel and a slow one look identical from the
sending end**, which is the failure these records spent two days removing —
so the stand-down was announced rather than enacted by silence.

**Two pages counted the repositories and neither said whether the count was a
boundary.** `micaoss/mica-fleet` is checked out (`f048a4ae`, 2026-09-20),
private, with no entry in the workspace file and no issue. **Whether it
belongs to this documentation's scope is the user's call**, so `README.md` and
`architecture.md` now say *seven as this page counts them, and the set is not
closed* rather than adding an eighth row or leaving the count to read as a
boundary — **the rule landed this morning, applied to its author within the
day.**

**And the second expected red has landed and is named**: `os-build-test`, four
failures, all four of the parked board's kernels, beside
`release-products s905x5m-prod`. **Two expected reds, and the dossier now says
that is the whole set** — with the operational line: **check the pinned
release rather than the board's branch**, because the branch carries the
repair and the pin does not.

## 2026-09-21 12:07 [finding]

**A third placement question, and it is the one the other two cannot answer:
what will the reader have *in hand* when they arrive?** *Where do they stand*
and *what are they about to do* assume a **purpose**; a permanently red job is
a **symptom** — the reader holds one token and no question yet. **A fact
placed by purpose is invisible to them; place it where the token leads.** The
job named a board, so the fact went in that board's dossier: **a task record
answers *what is somebody doing*, a dossier answers *what is true of this
board*** — which is how a correct fact in a correct record stays unreachable.
Two readers, one home each.

**When you explain some of a set, say whether the set is closed** — a writing
rule at two instances. **A partial enumeration inside an explanatory artefact
actively misdirects about its complement**: a reader meeting two reds on one
parked board and finding one explained concludes the other is the **live
defect**, certified by the explanation beside it. Same shape as a sentence
naming one route of several, **worse than no sentence because it reads as a
complete answer to the question it raises**.

**An implication from a decision is not a measurement of an artefact.** *The
board is parked* implies *no new release*; the implication is not the tag
list. **The difference bites exactly where somebody later cuts a release and
nobody updates the prose**, at which point an inference reads identically to a
measurement and is wrong.

**And the doubt stays in the same paragraph as the culprit**: separation is
what lets the association form, because **a doubt on another page is not a
doubt, it is a footnote to a fact.**

## 2026-09-21 12:04 [finding]

**An expected red gets a home, because the reader who needs it is in neither
repository that holds the facts.** `s905x5m` is parked on the user's
instruction; its newest release still carries a forced kernel command line that
disagrees with the board's own `board.env`, and the repair sits on
`mica-boards` `main` (`e1e8231`) **in no release** — so `s905x5m-prod` is red
on `mica-build`'s `main`, **expected, indefinite and correct**. The refusal
message serves every FIT board and would rot carrying a fact about one of them;
the producing repository's task status is right for its own readers; **the
person staring at a permanently red job in a third repository goes to the
workspace record**, which is the board dossier.

**It is written because of the decay path**: an expected red that somebody is
waiting on gets treated as flaky, and then it gets muted — **waiting,
familiar, flaky, muted — and the mute outlives the reason.**

**And it names what would end it** — a new `s905x5m` release and a pin move —
**so that when it ends the paragraph is visibly stale rather than quietly
wrong**, which is the shape these records spent yesterday removing.

**The boot question is recorded as open**: nobody established that this defect
has anything to do with the board failing to boot, the device boots the old
known-good line, and **no console capture exists**. *The investigation is
paused rather than closed, which is exactly when that assumption hardens into
a fact nobody remembers doubting.*

## 2026-09-21 07:35 [finding]

**A third kind of rule, and it is this corpus's least defensible one.** *Go
and look* inspects an artefact; *go and ask* queries the party who owns it;
**say it first** — state the question before choosing the query — acts
**before any artefact exists**, on the order of one's own thinking. **A read
leaves a read behind and an ask leaves a message; this leaves nothing**, which
makes it **a habit by construction and impossible to turn into a format** — and
by this workspace's own table a habit protects one person on one day. **The
cheapest rule here is also the weakest**, written down rather than left for
whoever relies on it to discover.

**And remedies are now ranked, because the reader prices them with less
information than the writer**: three unordered remedies are a menu, three
ordered ones are advice.

**The two days do not close in a circle, and the smaller claim is the one the
evidence supports.** The class did not shrink: a relayed pin whose subject was
wrong began it, and *which product was that measurement of* is the last open
question. **What changed is where the question sits in the sequence** — on day
one the subject error was undetected and caught afterwards; today the subject
question is asked **first, before anybody builds on the measurement**. The
defect is as available as it was; **the reflex arrives earlier.** And the
remedies differ at the two ends: the first was a pin somebody could have read
correctly, the last is a measurement **nobody in the conversation can
resolve** — the go-and-look / go-and-ask split turning up in its own history.

## 2026-09-21 07:32 [finding]

**The cheapest fix for the wrong-field defect is one step earlier than either
of the two recorded: state the question before choosing the query, and
re-state it when the question changes.** A list written for *what happened*
does not answer *when did it end*, **and nothing in its output says so**. The
field name beside each timestamp catches it at the reader; `updated_at` with
`conclusion` catches it at the query; **the question catches it before the
query exists, which is where it is free.**

**And the entry landed ten minutes ago over-generalised, corrected at its
subject's own request.** *The cause was not attention* is true of the second
and third instances — the instrument repeating itself — and **generous about
the first**, which was **a choice**: a query written to list runs, pressed
into answering when a window closed. **A value obtained for one purpose and
reused for another, with nothing marking the change** — the same act as a
count reused without its population, arriving in a query.

**And the rule that asks for less now says why it is not an exception**: it is
the one most likely to be cut for looking like one. **A cost stated survives
an editor; a cost implied does not.**

## 2026-09-21 07:29 [finding]

**A defect that lives in a query survives knowing about it — three times in a
row, the third inside the thread about that exact substitution.** A run's
**start** was narrated as its outcome; the first two were corrected by two
different repositories and the distinction was written down twice. The cause
was not attention: **the query selected `.created_at` and was never changed**,
so the instrument kept handing back start times. **Knowledge acts on the
reading, and the defect was upstream of the reading** — which a habit cannot
reach and a format can: the field name beside every timestamp, and a query
that asks for `updated_at` and `conclusion` together.

**And it makes one sentence true in a way it was not meant**: *care at the
relay improves what you send; it cannot produce a fact you do not hold.* The
conclusion time had never been asked for, so no amount of care would have
manufactured it.

**The corpus note that follows is about the corpus's own survival**: every
other rule here adds work — count the members, read the call sites, open each
hit, print the subject, name the population — and **this is the only one that
asks for less**. A set of rules that all demand more effort is a set that gets
abandoned, so the one giving some back is worth protecting when somebody
trims.

## 2026-09-21 07:27 [finding]

**Three dates, not two: written, released, in a product.** A feature is on
`main` at the first, carried by a release at the second, and reaches a device
only at the third — **the assembly's re-pin**, separate and often unscheduled.
**A page saying *the device does X* is true at the third and false at the
first two**, and nothing in a record distinguishes them. Named before the
updating starts, because the tense error is far cheaper to avoid than to
correct: by the time it is wrong, it has been read.

**And why this corpus is almost entirely *go and look* rules.** Nearly every
defect in it was recoverable by opening something — a stale path, a wrong
count, a dead tool, a false `cannot`, an uncalled script, a field that means
`created` and not `concluded`. **Scope is not in anything**: it is a property
of the claim about the artefact, living only in the claimer's head and the
reader's, which is why its rule ends in **go and ask**.

**The cost of that rule, written down so it is not discovered later as
reluctance**: a *go and look* rule is paid by the person applying it; a *go
and ask* rule **spends another party's attention, on somebody with nothing to
gain from the answer.** The owner of a surface has no stake in whether another
repository's page describes it correctly — **structural, not an oversight**,
and it will keep feeling expensive.

**And the release-green property's first exercise is clean, the day after it
was written**: `mica-core` targets `275b72bc`, whose run concluded success,
**and not `ee4fba5f`**, the commit carrying the feature, **whose own run
failed** — the hazard avoided by the party that caused the red, using the rule
the page states.

## 2026-09-21 07:24 [finding]

**An abstention names what it abstained from.** Declining to assert a figure
was right; declining **silently** cost what an unreported zero costs — this
page carried a true, weaker sentence and **nothing in it signalled a stronger
one was available**, because the reasoning was in a message and the message
scrolled. The form is the empty-slot rule arriving at abstention: **a blank is
visible, a wrong figure is not, and an unstated omission is neither.**

**A derived number carries no trace of its inputs, and the more arithmetic it
took the more it looks like a measurement.** *Fourteen minutes* announced
neither which timestamps produced it nor that one was a **start** narrated as
an outcome; the repair is the field name travelling with the value.

**A boundary of the data is not a state of the world.** *No success since the
last green began* is about the rows in hand; *red since 05:39* is about the
branch and needs a fact the rows do not contain — the red began half an hour
later, at 06:09:06Z. Both come from one reading and only one survives it.

**And the window has closed**, which that paragraph now says: run
`35571307304` concluded success at 2026-09-21T07:19:59Z, so the branch was
without a green from the first failure at 2026-09-20T06:09:06Z until then.

## 2026-09-21 07:22 [finding]

**Re-deriving what you relay catches a wrong fact and does nothing about a
wrong scope** — which corrects the defence these records have leaned on all
day. The probe could have been re-run by anybody and would have printed the
same numbers, because the run is real and its output says so: **the artefact
is consistent with both readings**, so reading it saved nobody. **Scope is
checked by asking who owns the subject, not by looking harder at the
evidence.**

**And that gives a behaviour claim a route, since no row can hold one**: it
goes to **the repository it is about**, even when that repository did not ask
and has nothing to do. Routing by who *needs* a fact sends it downstream, and
**downstream cannot check upstream's behaviour by construction** — so routing
by need sends every such claim away from the only party that can falsify it.
Twice in two days the counterexample was held by somebody not in the
conversation: once the repository that owns the surface, once the claimant's
**own locks directory**.

**And the unreported zero has the same invisibility as a habit save, one
artefact along**: neither leaves anything behind, and both get paid for
repeatedly by people who cannot see each other.

## 2026-09-21 07:20 [finding]

**The number this page declined to write was wrong, and the corrected one is
stronger.** The run **concluded** success at 05:52:13Z and the release
published at 05:52:38Z — **twenty-five seconds**, not fourteen minutes. The
fourteen was the gap from the run's **start**, narrated as though it were the
gap from its outcome. So the clean instance is sharper than it looked: the
release did not go out *after* a green run, it went out **on** it.

**Each timestamp in that paragraph now carries the field it came from**,
because `created` is not `concluded` and **a duration taken from the wrong
field looks exactly like one taken from the right one**. Declining to assert
the figure was not caution in principle; it kept a wrong number out of a
design page on a fact nobody would have questioned.

**And the remedy for the attribution half is a form, not more care: a quoted
sentence carries its speaker; a summarised one takes its speaker from the
paragraph it lands in.** Twice in two days a claim crossing paragraph
boundaries took its subject from the nearest name — a bare path once, an
admission on the wrong repository once — and both times the sentence was true
of somebody. **Quote an admission; summarise a fact.**

## 2026-09-21 07:18 [finding]

**Report the zero — the inverse of every rule in this corpus, and missing from
all of them.** These records say a zero must carry the boundary it was
measured inside; **they never said it must be reported at all**, and **an
unreported zero is re-measured by everybody who wonders**. One sweep here for
stale product names, discoverability claims and a Bluetooth PIN found nothing
and cost one pass; unreported, the next three readers pay three. **And sorting
is what makes a zero believable**: three hits, three kinds — deliberate
history, an AP SSID that is hostapd and not mDNS, a future plan — **none of
them the thing looked for, which is a stronger result than *no hits*.**

**A relay does not only carry a sentence; it changes its scope, and the change
is invisible to whoever wrote it.** A probe's verdict about **one run**
arrived across a boundary as a sentence about **the product**, reported as a
chain *closed end to end* — a claim neither the probe's file nor this page had
made. **The page then made the relayed scope the answer**, which is not a
defect in the page but the reason a relay has to be right: a record landing a
relayed sentence asks **what it was a sentence about**, not only whether it is
true.

## 2026-09-21 07:16 [finding]

**An attribution in a landed record was wrong, and it was an admission.** The
three commits pushed on a green **local** `make check` without waiting for the
run are **`mica-core`'s, said of itself**; the record carried them against
`mica-build`, which is false of that repository. **An admission on the wrong
agent is the worst kind of misattribution**, and the repair is an attribution
rather than a rewrite.

**And the hazard now carries its one measured instance, which it needed.**
`c1a046b1` is both the **last green run** and exactly the commit `mica-core`'s
release `20260920-0552` targets — published 2026-09-20T05:52:38Z, the
successful run having started at 05:38:57Z — **and it is the release
`mica-build` pins**, all read back here. **The gap did not bite here, measured
rather than hoped.** A hazard recorded without its one clean instance invites
a reader to assume the worst.

**And the record is a floor rather than a ceiling**: it makes the omission
visible without making the reading mandatory, **and the reading is
mechanisable** — the target commit is the fourth field of the `release` row,
which every consumer already reads. No mechanism is proposed and placing one
is not this page's call.

## 2026-09-21 07:14 [finding]

**Section 8 collapsed *enforceable* and *enforced* for a day, and the
correction is that nothing in the product sets a ceiling.** The three numbers
— `memory.max=67108864`, `cpu.max=50000 100000`, `pids.max=42` — **were set by
the probe** to prove the kernel applies them. `mica-core`'s container surface,
`ContainerUnit`, carries image, command, environment, published ports,
volumes, restart policy and `autoStart` and **no memory, CPU, pids or IO field
at all**: nothing an operator can set through it, **no default `micad` writes
into a Quadlet unit**. The five-key table is what a **hand-written** unit could
carry; the product's own writer carries none of them.

**So the split the section now keeps, because *bounded* would be read as
both**: container **storage** has a bound — DATA mounted with `prjquota` by
init while Base assigns the ids — and container **memory and CPU have none,
declared nowhere by anybody.**

**And a rename sweep's residue is prose, which makes it a population to search
rather than four accidents.** Four places one sweep missed were all sentences,
**none of them read by anything that runs** — which is exactly why the code
and the fixtures moved and the sentences did not. Swept here on the
discriminating key: the surviving `x64-dev` mentions are the two Chinese
flashing pages naming a **pre-rename image on purpose**, which is history that
must keep the old name, and no document here claims a device is discoverable
or describes a Bluetooth pairing PIN — **checked, so the next person does not
have to.**

## 2026-09-21 07:11 [finding]

**A release's own green says the release job ran — the `ci.yml` run on the
commit it targets is a different run, and nothing connects them.** The lock
design says what a release *carries*; it said nothing about what its verdict
*means*, and that is the thing a consumer reads when deciding whether to pin.
Recorded in section 4 as a fact about the process: **no gate, pre-flight or
change to how a release is cut is proposed by it.**

**The near miss, measured here rather than relayed**: `mica-core`'s `main` has
had **no successful `ci` run since `c1a046b1` at 2026-09-20 05:38:57Z** — five
failures between 06:09 and 23:01, two cancellations, and today's 07:05Z run
unfinished as this was written. **No release was cut in that window.** Had one
been, it would have carried a green release job and a red commit **and looked
ordinary**.

**And it is yesterday's defect one artefact along**: *green* names a verdict
and not what produced it, so **a reader supplies the most complete gate they
know of, which is never the one that ran** — and at a release boundary that
reader is a different repository and cannot check. Whether any release here
was ever cut from a red commit is **unmeasured**, and the record says so
rather than guessing.

## 2026-09-20 21:09 [finding]

**A reason published here an hour ago was too generous to breakage, and the
correction is measurable in this workspace.** *A correct citation under a
wrong heading is more dangerous than a broken one, because a broken one sends
them looking* — it does, **at the path, not at the claim**. **A breakage
recruits a repair, not a re-examination**: six stale `evidenceRefs` were found
and fixed here today, six paths were corrected, and **nobody asked what the
evidence documents claimed**. It took a separate question entirely to reach
the claim layer.

**So the surviving form is narrower and stands without the trade-off**: a
correct citation under a wrong heading is dangerous **because nothing at any
layer is loud**, not because a breakage would have caught it. Making citations
resolve costs nothing that was ever protecting a heading, and buys
reachability outright.

## 2026-09-20 21:07 [finding]

**The ceiling on every citation form, recorded beside its two qualifiers: a
citation can never be made self-validating.** No repository prefix, no commit,
no line range protects a claim, **because the failure lives in the claim**. A
perfect citation guarantees a reader can go and look and **guarantees nothing
about what they will conclude** — and **a correct citation under a wrong
heading is more dangerous than a broken one, because a broken one sends them
looking.** An evening spent tightening citation forms across four repositories
ends at that wall, and the next person to improve one should know what
improving it cannot buy.

**A table's heading is load-bearing and is the least-read part of a table.**
The same row is correct under *call sites of this key* and misleading under
*cases that are exercised*, and nothing in the row distinguishes them — so a
table that could be read either way says which it is **inside the table**,
because a note above it is read by somebody who is reading notes.

**And an impression in that plan is replaced by a measurement**: the uncalled
scripts *read as gaps* is out; **none of the ten can be run standalone.** They
are **stages whose drivers do not invoke them** — inner container scripts,
stages expecting a runner to hand them a composed root and a kernel directory,
a guest-side helper. **Whole and unreachable rather than dead**, which is what
makes dropping the row the wrong repair rather than a tidy one.

## 2026-09-20 21:04 [finding]

**A valid citation whose premise is false.** A plan table here cites
`mica-build:tests/lifecycle-uefi/firmware.sh` — repository-qualified, path
resolves, file is real — **and nothing in that repository calls it**. The
citation gives its reader no reason to doubt, because the citation is
**correct**; what is absent is the only property that made citing it worth
doing. So the citation rule gains its second qualifier: the form **assumes the
instrument runs** and cannot say *cited and not invoked*.

**The claim in that table turns out to be the true one, and it now says which
it is.** The heading is *call sites of `IMAGE_BUN_1`* — files that break if
the key moves — **not** *cases that are exercised*. For a key survey an
uninvoked call site still counts, because it breaks the moment somebody wires
it up; for a reader looking for coverage the same row means nothing. The plan
now says so, and does **not** drop the citation: whether that instrument is
dead or merely unwired is `mica-build`'s open question, and nine other
uncalled scripts there read as gaps rather than dead code.

**And the sweep-key rule gets the instance it predicted, inside a sweep**: a
search for `trust.sh` returned five hits that were all `embed-trust.sh` and
`embed-fit-trust.sh` — names that **end in** the key. **A bare substring
supplies the nearest subject exactly as a bare path does**, the count would
have travelled where the lines did not, and it happened *inside the sweep that
exists because of bare paths*.

## 2026-09-20 20:46 [finding]

**The hardest denominator to get right is the one inside a direct
measurement.** *Nine of ten structs carry the annotation* mixed structs in a
file with structs a parser reaches, and it survived a day in which every other
error was caught by somebody going and looking — because **going to the source
buys correctness about the objects and nothing about the population, and the
confidence it produces does not know the difference.** A ratio announces
itself and invites the question; **a count of things you actually counted
arrives carrying its own evidence of diligence.**

**And the episode is evidence about the method rather than only about the
fact**: the constraint went one struct → nine → no exception across three
reads, each by a party closer to the source, and **each read strengthened
it.**

## 2026-09-20 20:43 [finding]

**Asked which of the ten structs lacks `deny_unknown_fields`, the answer is
none that is parsed — and the question exposed that *nine of ten* was the
wrong sentence.** It implied an exception in the schema and invited a reader
to go looking for the one permissive place a field could be added. Measured:
**all nine structs that derive `Deserialize` carry the annotation**, and the
other two — `ContractError` and `DeploymentPaths` — derive `Debug` alone and
are never parsed from a payload. **The constraint has no exception.**

**So there is no finding to route**: nothing is missing an annotation, and the
permissive extension point somebody would have gone looking for does not
exist. A count that mixes two populations — structs in a file, and structs a
parser reaches — reads as a property with a gap; **the denominator had to be
the parsed ones, which is the same wrong-denominator error as a byte ratio,
two hours later and in a place it looked like precision.**

## 2026-09-20 20:40 [finding]

**The deployment envelope's payloads are addition-closed for deployed
readers**, recorded beside the format rather than in whichever proposal next
trips over it. Read back here: nine of the ten structs in
`mica-core:crates/mica-deploy/src/components.rs` carry
`#[serde(deny_unknown_fields)]` — `BootArtifact` is exactly `format` and
`artifact` — so **adding a field does not degrade gracefully; a device running
today's `mica-deploy` refuses the record outright.**

**And the ordering that follows is the opposite of the producer-first
instinct**: the reader changes in `mica-core`, lands in a release, **reaches
the devices**, and only then may `mica-build` emit the field. Anybody
reasoning from *the producer owns the format* gets it backwards, and backwards
means publishing a record deployed devices reject — the party that owns the
producer said plainly this was the opposite of what it would have assumed.

**Written in the form that is correct under both answers to the open fleet
question**: *it is expensive the day there are devices*. If a fleet exists the
sentence is already operational; if every device is a bench device that gets
reflashed, the ordering is a property with no population **and the record does
not have to be rewritten either way.**

## 2026-09-20 20:11 [finding]

**The candidate recorded an hour ago is dangerous without its other half, and
the half is this: the same property that makes a wrong reason travel is the
only thing that makes a claim correctable at all.** Both of the evening's
`cannot` errors were in **reasons**, and both were caught **because** they
were reasons — *the UKI has no keyless fingerprint* could only be believed or
disbelieved, while *signing is part of producing it rather than a wrapper
around it* is a checkable statement about PE files, and checking it turned
*two of four* into *three of four* **before it was published**.

**So the rule is neither *give reasons* nor *beware reasons*: the trade is
worth taking, because a bare claim's errors are permanent.** A conclusion
offered without a reason cannot be argued with, only overruled. And the credit
for tonight's catch belongs there rather than to the hold — **holding the pen
only delayed it; the stated reason is what gave the hold something to grip.**

## 2026-09-20 20:08 [finding]

**The hold is released and the number changed: three of four components are
pinned keylessly today, not two, and the fourth is a script change away rather
than a law of PE files.** Root and kernel support carry content sha256 and
`rootHash` in the envelope payload. **The firmware already had one** — its
unsigned input is `mica-systemd-boot` `257.13-mica1`, pinned by version and
sha256 in `locks/mica-system-base.lock` (`054bbb71…`, `8a745830…`, read back
here), and the signed `BOOTX64.EFI` is a pure function of a pinned archive and
a key. The boot UKI has none because `ukify build --signtool=sbsign` assembles
and signs in one invocation; **`ukify build` without `--signtool` is a
supported mode**, so it is **not done**, not impossible.

**The word was `cannot` and the answer is `does not` — twice, at two
distances.** For the UKI, one script change. For the firmware, *already, in
that repository's own locks directory*. **The larger error was on the
component nobody thinks about.**

**And the justification for holding is that the hold did not change the
sentence's confidence — it changed its content.** *Two of four* was ready to
be written as a table an hour earlier, and it was wrong **in the direction
this record had warned about an hour before that**: an understatement invites
agreement, it would have been quoted approvingly by everyone including its
author, and **nothing downstream would ever have failed on it.**

**The unachievable half is unchanged and still closed**: the signatures
themselves, permanently, without the release private keys. What moved is how
much of the **content** under those signatures anybody with no key can
compare — and it is now most of it.

## 2026-09-20 20:03 [finding]

**Two rules of this page can collide, and tonight they did not only by luck.**
*A record may not drive the artefact it describes* and *a record must describe
the artefact accurately* are both satisfiable only while the artefact happens
to support the accurate sentence — a restatement that genuinely needed a
format change would have met both at once, and *you may not write it* is not
an answer. The resolution is a third thing: **the record states what it cannot
say and why, and the artefact's owner decides whether to move. A record naming
its own limit is not driving anything.** Written now because the collision was
invisible tonight and will not be next time.

**And the second candidate at two instances has a failure mode, which makes it
a different kind from the first: a right conclusion resting on a wrong
reason.** The `subuid` ranges are inert (right) because *no code asks for it*
(wrong); clause A was unsatisfied (right) because *nobody had done the work*
(wrong — nobody can). **The failure is remote, and that is why review cannot
catch it: the reason is what a reader generalises from.** Nobody re-derives a
conclusion; they carry the reason onward. An integrator reading *no code asks*
carries forward *I cannot reach it*, reaches it with `--userns=auto`, and
meets a failure instead of a mapping — **the conclusion protected them and the
reason sent them.** The test: **ask what a reader would do with the reason,
not with the conclusion.**

**Kept separate from a *check* right for the wrong reason, by repair rather
than by resemblance**: a check is repaired by making it read the right thing
and fails **when the world changes**; a statement is repaired by fixing the
reason and fails **when a reader travels**. Two classes, decided with
instances of both in hand.

## 2026-09-20 20:00 [finding]

**The keyless-fingerprint number is not a zero, and the comparison point was
already published.** The deployment record is a signed envelope whose payload
is base64 and **decodes with no key**, and those envelopes travel inside the
published `.micaupd` archives — so **nothing has to be added to the release
format** for clause A's achievable half to be checkable. Keyless and over
content: `rootfs.content.image`, `rootfs.content.rootHash`,
`kernel.support.image`, `kernel.support.rootHash`. Not keyless: the signed
UKI, the signatures, the firmware envelope. **Two of four components — not
nothing, and not the product.**

**The restatement is still held, on one word.** The report says the UKI and
firmware *cannot* have keyless fingerprints; a UKI is a PE binary whose
signature is appended in a certificate table, so the unsigned object may be
**transient rather than absent**. The open measurement is whether an unsigned
UKI exists as a file at any point, even for one step.

**And the rule arrived inside the sentence meant to replace the clause it came
from**: a statement that cannot distinguish *not yet done* from *cannot be
done* is read as **the stronger claim when it suits the writer and the weaker
one when it suits the reader**. Neither reading is a lie and the text supports
both, so **the word has to be earned by a measurement before it is written**.

**A ratio needs a denominator somebody would defend.** *65 MB of a 1.8 GB
artefact* is a byte ratio over mostly slack, padding and ESP; **3.6%
understates as badly as *covers the image* would overstate**, and it is harder
to refuse **because it reads as modesty** — an overstatement invites
challenge, an understatement invites agreement.

**And the save table gets its test**: whether the reading was optional. A
status line that must carry the date it was decided was filled in from the
rhythm of the round — `17:41` — and `date -u` said `19:54`. **The format made
the reading mandatory**, on the author of the format, the same day.

## 2026-09-20 19:58 [finding]

**Before calling a drop a defect, ask whether the rest of the feature is also
absent.** A feature absent in **every** piece is a composition decision; a
feature absent in **one piece of several** is a defect, and **only the census
distinguishes them, not the file**. The `subuid` maps dropped *and* `uidmap`
never installed *and* the engine depending only on `libsubid5` — rootless is
not shipped. `systemd-pstore` shipped its unit and its binary and lost only
the enablement. The method transfers: read the `passwd` file **and** the
binary list rather than inferring either from the other.

**And the clause goes inside the rule, because it is the census's own failure
mode: the census must cover the feature as *the format* defines it, not as the
investigator remembers it.** One census nearly stopped at *subuid is for
rootless, rootless is absent, done* — true, and complete-looking — and read
the pinned source anyway, where `--userns=auto` proved to be a **rootful**
consumer of `/etc/subuid`. **A census bounded by memory looks exactly like a
census bounded by the feature**, and from inside there is no signal which one
it was.

**That correction lands on a sentence of this repository's**: `access.md` said
the ranges were inert because *no code asks for it*. Nothing **shipped**
invokes the one flag that reaches them — an integrator writing a Quadlet unit
can — and the honest form is *nothing shipped invokes it*, not *nothing can*.

**And a writing rule at two instances, not a claim about the world: a default
with a specific-looking value is the best-disguised default there is.** `0`,
`true` and an empty string announce themselves; a round, deliberate, sized
number does not. `mica:100000:65536` is `login.defs`' `SUB_UID_MIN` and
`SUB_UID_COUNT`, and these records had described it as a range somebody chose.
**The value looked like the thing it was not, and nothing about its appearance
was wrong.**

## 2026-09-20 19:54 [finding]

**Clause A is not unproven: its byte-equality form is unachievable by everyone
except the release job, and that is the trust model working rather than a
gap.** Verified here at `origin`: `release-product.yml` writes the three
release **secrets** into `_out/release-signing/*/signer.key.pem` and points
`MICA_SIGNING_OUTPUT` at that directory, so a published product is signed with
private keys that exist only as GitHub secrets. **A clause satisfiable only by
the party it is meant to check is not a weak clause, it is an empty one** — so
it is recorded as **closed, achieved by design**, not deferred: *a deferred
item attracts effort forever; a closed one does not.*

**The achievable form is equality of what was signed, and its coverage is not
yet written.** `rootfs.roothash` is keyless and a complete fingerprint of the
root, so two builds agreeing on it agree on every byte of it, offline, by
anyone. But **a root is not a product**: it does not cover the kernel, the
UKI, the boot components or the ESP — precisely the signed things — and the
lock's `asset` rows are sha256 of the *signed* artefacts, so they cannot
serve. **A zero is a fine answer; a zero presented as full coverage is not**,
so the restatement waits for the measurement rather than being written to
sound complete.

**And the rule it leaves: a clause that cannot distinguish *not yet done* from
*cannot be done* is read as the first every time**, because that reading asks
nothing of the reader. *Unproven* is the comfortable state, and it cost this
workspace a day of treating a closed question as an open one. What
distinguished them was **not a better reading of the clause — it was somebody
grepping for where a value comes from**: the practice arriving at a fifth
subject, which is a clause.

## 2026-09-20 17:35 [finding]

**A practice can precede its diagnosis**, which this afternoon's entry was
written as though it could not. A candidate held at two instances has **no
recognition sentence yet, and that is its expected state rather than a defect
in it** — which also says what the third instance decides, and it is more than
membership: **if the three share a failure mode the candidate becomes a
diagnosis** and a reader can be taught to recognise it; **if they do not, it
stays a practice permanently** and the missing recognition sentence is **a
finding rather than a gap**. Whoever meets the third is asked to check for a
shared failure mode, not only to count to three.

## 2026-09-20 17:33 [finding]

**A candidate class is recorded at two instances without being named, with its
membership test written in advance.** The shared property is narrower than *no
failure mode*: **the deliverable is correct and stays correct** — a build that
makes four kernels to keep one (the image is right, the price is wrong), and a
wrong supporting number inside a true paragraph (the conclusion is right, the
number is wrong). Neither is a false green or a check right for the wrong
reason, because in those the output is wrong and somebody trips on it
eventually; here there is nothing to trip on.

**The test, stated now so it cannot be fitted to the third instance
afterwards: the defect lives in a dimension nothing downstream reads.** Nobody
consumes the price of a build; nobody checks a supporting number against the
conclusion it supports. Two instances and a use make a writing rule; a claim
about how the world is needs three and truth — so it is not named, and
**writing the test down early is the whole of its value: a test stated after
the third instance is a description of three things, not a prediction.**

**And the reason the status-line format was not imposed on the other 47 is now
in the rule**: it would have produced 47 status lines carrying dates nobody
verified against their notes — **a cell that reports itself falsely, which is
worse than the empty one.**

## 2026-09-20 17:30 [finding]

**Exactly one cell of the defence table reports itself.** A format's save
leaves an artefact other people read; a habit's save leaves nothing and is
known only if the person narrates it; a failure is counted only when somebody
later catches the wrong sentence; a defence never tried leaves no trace at
all. **So the argument for formats is not that they work better — it is that
they are the only defence whose effectiveness is measurable at all.** A habit
might be the better defence on a given day and nobody could ever find out.
And the arithmetic runs the counter-intuitive way: an unreported habit save
adds to the denominator and not to the format count, so **a quarter is the
ceiling, not the estimate**.

**A status line is a cached summary of the notes below it, and nothing in the
file says which was updated last.** The offline-build task's acceptance line
was untouched all day while a note four paragraphs down moved from
*unreachable* to *the seam was crossed* — **the sentence that changed was not
the sentence anybody was looking at**. The repair is a format: when a note
changes the state, the status line says so **and carries the date it was
decided**. Applied to that task; making it a required form across 48 records
is a proposal, not something to impose by fiat.

**And the hardest variant of the armoured comment, met the same evening:
borrowed evidence supporting a true conclusion.** Two saves were credited to
an instrument when one was a person's habit — the conclusion was right,
nothing downstream would have failed, and the sentence would have been quoted
for years with a two in it. **A wrong number inside a correct argument has no
failure mode of its own**, which is why it survives review.

## 2026-09-20 17:28 [finding]

**A sentence published here an hour ago counted two survivals as one kind, and
they are not.** The shared checkout answered about a different tree four
times: two cost a wrong sentence and nothing caught them; one survived because
**a person ran `git status` before speaking**; one survived because **the
report printed the head it read**. The earlier text credited both to the
instrument.

**A habit protects the person who has it, on the day they have it. A format
protects every reader downstream, including one six months from now who never
met the hazard and will never know it was there.** The habit survival left no
artefact and taught nobody anything; the format survival would happen again
for a reader who has never heard of that evening. Counting them together
records this workspace as **half protected** when it is **a quarter protected
and a quarter lucky**, and only the format quarter is load-bearing.

## 2026-09-20 17:26 [finding]

**The aligned chain completed, `rc=0`, and clause A moves from *unreachable*
to *reachable and unproven* — not to proven.** Decided against the clause's
own words rather than taken from the report: the acceptance line says
*reproduces the online bytes*, which the A/B table spells out as **equals the
published release**. Tonight proves **B** at alignment — `mica-core`
`c1a046b1`, `mica-podman` `ad9deb09`, `mica-boards` `2bfa259e`, **release
commits rather than checkout heads**, each producer built from source with no
release artefact fetched, in 123 s. The seam that made A unreachable this
morning was crossed.

**A could not have been proven tonight for two reasons that are not about the
chain**: there is no published product release at these board pins to compare
against, and the image carries an **offline version stamp** rather than a
release name, so byte equality is impossible **by construction** until the
chain can be given the release stamp as an input. That is the next holder's
question, and what closes it is a product release cut at these pins compared
against this same chain — a release decision.

**And the builder drew that bound itself, unasked**: evidence for the
mechanism, completely, and not for byte equality with a published product. **A
run that states what it is not evidence for is the only kind whose green can
be quoted.**

**The shared checkout answered about a different tree for the fourth time**,
its `main` a full day behind the `origin/main` the chain ran at. **Four is not
an incident**, and the instrument survived two of the four for one reason
only: it prints the head it read.

## 2026-09-20 17:23 [finding]

**The count came back four-for-four: *read the artefact, not the account* has
four subjects and four different failure modes — a tree (wrong subject), a
comment (a true account gone stale), a report (an accurate account over-read),
a unit of work (never looked).** One repair, four diagnoses, so by the
membership rule it is a class — and **a different kind of class from every
other one here**.

**A class defined by a shared failure mode is a diagnosis; a class defined by
a shared repair is a practice.** A diagnosis lets a reader recognise what
happened; a practice tells them what to do and **cannot help them recognise
anything** — nobody meeting the third instance will know it from the rule,
because nothing looked wrong at the time. So it is recorded with its subjects
named and **no failure mode attached**, and that absence is the honest signal
that it will not help anybody spot the fifth.

**And the format-over-rule boundary gains a second member, worse than the
first because it never looks like anything: a cost with no failing output.**
The approved unit would have built four kernels to keep one, four times over —
**a correct result, every time, fifty minutes at a time**. Every other defect
recorded today eventually produced a wrong sentence, a red job or a false
green; this one produces nothing to be wrong. **Formats catch wrong outputs;
they do not catch right outputs bought at the wrong price.**

## 2026-09-20 17:21 [finding]

**The sweep rule has a third state, measured while the class it came from was
being closed: a key that answers too much.** `x64` is both the retired board
name and the architecture nickname, so the sweep returns a list that looks
like defects and is mostly noise — **and the noise is what stops the sweep**.
The aperture family from the opposite end: not too little answered, too much.
Three states wanting three different things — **no key**, wait and let the
next invention specify its fixture; **a discriminating key**, sweep; **an
over-answering key**, sort the hits into kinds before counting them. Sorting
closed that class into three homes, and the test of a closed class is its
author's sentence: *no fourth home, and now I know that rather than hoping
it.*

**And the harder case the rule still does not reach: a correct generalisation
that did not produce the count.** The record that first found the defect named
its class rightly and then fixed one file, while eight siblings waited for the
evening. Not an over-reach — which is why the *finder is least likely to
sweep* rule misses it. **Naming a class is not counting it**, and the general
sentence can close the question as firmly as a fix does.

**And why the `data` row needed two readers to become a defect in the text**:
one reader's error is indistinguishable from that reader's carelessness — *one
data point cannot tell a personal error from a specification one* — so it took
two failing in **opposite** directions, neither able to see the other's
attempt. **A single wrong implementation is evidence about an
implementation.** That is what routing buys and reading each other's trees does
not.

## 2026-09-20 17:19 [finding]

**The clause repair was tested by the world moving and survived both states.**
All four boards now name one commit, so *one working tree cannot be at three
commits* is true of the state it measured and false tonight. **Per pinned
input does not care which world it is in**: written against the afternoon's
three-commit state it would already be wrong; written against tonight's
one-commit state it would break at the first board released alone. *Repair on
the shape, not on the counterexample* — measured six hours after it was
recorded.

**And the converse arrived from the implementation side without having seen
it**: *an impossibility observed on a given afternoon is not a property of the
design.* One half says a clause may not depend on today's luck; the other says
a constraint may not be inferred from it.

**A format paid for itself a third time, and this one has a price on both
sides.** The offline chain's first aligned run refused, correctly, with a
subject that was not the workspace under test — the chain reads the shared
checkout's `locks/`, behind its own branch — and that was legible only because
the report prints the head it read. **Every other instance of this shape today
cost somebody a wrong sentence; this one cost a re-run.**

**And a cost nobody would have called a defect**: *one clone per board* was
approved as a unit, while the script it drives builds every board and takes no
board argument — four kernels built to keep one, four times over, fifty
minutes a run with three-quarters discarded. **A cost with no failing output**
is the same family as a check that is right for the wrong reason, and the
repair is the page's own: read the artefact, not the account of it — **a unit
of work is an artefact too**.

## 2026-09-20 17:14 [finding]

**The held instance has its subject and lands: `mica-build` `81005ea6` fails
on a product built from `uefi-x64.20260916-0857` and passes on one built from
`20260920-1536`.** Same file, no injected defect, two products this workspace
publishes pins for. **The five recorded instances prove a gate reads its
inputs; this one proves a check can tell two worlds apart** — the property the
thing it replaced failed at three times.

**And the order is the argument**: the falsification **found a defect in the
check first** — a verdict printed over an error string — and the corrected
file **then proved the capability**. One experiment did both jobs, in that
order, which was not available when the rule was written this afternoon. The
two claims from that episode also separate cleanly, as they were recorded to:
**the defect is history and keeps its date; the capability is a property of
the current file, and the file now has a name.**

**And the honest boundary of the whole format-over-rule argument, found on the
day it was made: some false results are distinguishable only by somebody who
knows what they did.** Two results in the same round were **false and
plausible** — two guests run at once against a harness that names its
container with a fixed name, so both died at exit 137 and read as a broken
harness; and a symlinked `meta/` in a temporary worktree, accepted by the
build and unfollowable from inside the container. **Both were caught only
because the operator knew what they had just done.** Every other repair
recorded today moved a judgement into an instrument; this is the residue that
cannot be moved, and a page that recommends formats without naming it is
selling the argument rather than making it.

## 2026-09-20 17:07 [finding]

**The sweep rule landed an hour ago was incomplete in this tree, and the
qualifier is what keeps it from becoming a demand for guesses: a sweep
requires a key.** The rename defect had one — the string `x64`, and one `grep`
found eight siblings. *Which incidental property of a valid example is
somebody treating as required* is **not a query**, so *sweep the rest* means
guess eight times. **This sweep should have happened** and **this sweep is not
available** are two different statements, and a rule that cannot tell them
apart arrives as a process instead of as a class.

**What replaces it is a habit with a trigger, and the inversion is the useful
part: the invention is the specification for the fixture that disproves it.**
A reader who invents a rule has done the hard half — they have named precisely
which incidental property looked required — and the fixture costs two rows.
**A defect that specifies its own repair is the cheapest kind there is**, and
that specification cannot be obtained any other way, because nobody can
enumerate in advance what a future reader will over-read.

## 2026-09-20 17:07 [finding]

**The sweep rule landed an hour ago was incomplete in this tree, and the
qualifier is the half that keeps it from becoming a demand for guesses: a
sweep requires a key.** The rename defect had one — the string `x64`, and one
`grep` found eight siblings. *Which incidental property of a valid example is
somebody treating as required* is **not a query**, so *sweep the rest* means
guess eight times. **This sweep should have happened** and **this sweep is not
available** are two different statements, and a rule that cannot tell them
apart arrives as a process instead of as a class.

**What replaces it is a habit with a trigger, and the inversion is the useful
part: the invention is the specification for the fixture that disproves it.**
A reader who invents a rule has done the hard half — they have named precisely
which incidental property looked required — and the fixture costs two rows.
**A defect that specifies its own repair is the cheapest kind there is**, and
that specification cannot be obtained any other way, because nobody can
enumerate in advance what a future reader will over-read.

## 2026-09-20 17:05 [finding]

**Two independent readers got the `data` row wrong in opposite directions,
which is a fact about the text.** One implemented *the row's key* and stopped,
so it accepted a lock with two rows naming one file; one required
`<repository>-<name>.tsv` because the single valid vector happens to look like
that, so a duplicate-key vector came back `data-file`. **1.2.4 now says both
halves**: `<file>` is a second uniqueness key, and its form is unconstrained
beyond the charset — no repository, no name, no suffix.

**And the diagnosis is worth more than the clarification**: *an example's
incidental properties are indistinguishable from its required ones, and a
reader generalising from one instance cannot tell which is which.* The refused
vector caught the invention; the example generalised from could not have. **A
valid vector is the one artefact in this corpus with no defence against being
generalised from**, so `lock/valid/data-file-form.lock` now carries `data`
files named nothing like their keys — one fixture makes that invention
impossible. 357/357.

**A skipped vector is worse than a missing one: it is in the count.** Three
vectors were carried and skipped for want of a tool while the table counted
their rows as coverage. **A missing vector is a gap somebody can see; a
skipped one is coverage already claimed** — so either the runner refuses a row
it cannot run, or the row moves to an exclusion list with its reason.

**And the sweep rule, from a defect found once in the morning and eight more
times that evening**: **finding an instance is what creates the obligation to
sweep, and the finder is the least likely person to do it**, because the
satisfaction of a fix closes the question the instance opened. Third time in
one day that a class was mistaken for its first member.

## 2026-09-20 16:49 [finding]

**The falsification ran and found a defect in the check rather than confirming
it — on its first run, by the deliberate test rather than by an accident.**
Against a product built from the old pins (`uefi-x64` at `20260916-0857`,
`# CONFIG_MEMCG is not set` in the fetched config), podman failed outright and
`crun` said *open `memory.max` for writing: no such file or directory*; the
variable then held that error text and the CPU case ran over the string and
printed a **pass**. **A verdict about a string that was never a cgroup file.**
The repair is the empty-parse rule where it had not arrived: **a run that did
not happen has no ceilings to report.**

**And the near-miss is worth more than the defect.** The suite was red only
because the memory branch happened to fail first; one symbol different and it
would have been **green with a false pass on the exact experiment designed to
prove it could tell two worlds apart**. **A correct verdict reached by an
accident of ordering is indistinguishable from a correct verdict** — the
eight-of-nine shape, in an instrument instead of a fragment.

**The fifth instance is held rather than recorded**, because the result was
produced by a file that has since been fixed and both runs are repeating
against the corrected one. Recording it now would be the subject problem one
more time, in the record that names it.

**Two smaller things the episode settled**: the `available:` list printed
beside the verdict turned out to be a **second reading of the same fact** —
`memory` absent on the old kernel, present on the new — so a format added to
make a wrong answer legible paid for itself as evidence; and the report-both
branches are retired by the author who wrote their condition, **the absent
branch being a measurement while the floor was incomplete and a defect
today**.

## 2026-09-20 16:43 [finding]

**The handover pattern is recorded as a mechanism rather than an etiquette:
the author writes the rule, the repository that can measure supplies the
number, and neither signs for the other's half.** Three handed-over texts
landed here in one day and the third arrived with a **deliberate hole** where
a count belonged. **An empty slot is visible and a wrong number is not** —
every figure that travelled wrongly in these records was a filled slot, and
nobody would have quoted a blank. Checking a number afterwards costs a second
reader and only works if that reader arrives.

**And the two counts are reconciled in the record rather than left to be
found**: *five* is the comment-line repairs in `upstream/refused/`, *eight* is
those plus the three whose named defect dragged `sort-order` with it, across
the whole set. Two answers to two questions, not a stale figure — separated
rather than summed, because *eight defects* alone would read as one technique
finding one kind of thing.

**With the mechanism under the routing rule, from the receiving end**: a
conclusion routed alone does not get argued with, **it gets agreed with and
shelved**, which is why nothing would have run. Same fact as the counting
reflex firing at what you are about to argue rather than at what you are about
to agree with — **a technique cannot be agreed with; it can only be run or not
run.**

## 2026-09-20 16:41 [finding]

**The three coordination rules are landed as a section of the decision that
owns them**, in their author's words, with the verification split written into
the section rather than into a covering note: *a conditional ruling is not a
ruling when the condition is itself work*; *route techniques, not
conclusions*, whose cost is **not a slower result but no result**; and *send a
correction before the repository acts, not after it reports* — **late is not
wrong, it is expensive, and the expense lands on whoever was mid-work**, which
is the one cost in this workspace no gate measures.

**The count in it is this repository's because its author left it out on
purpose**, having relayed a wrong one earlier the same day: the multiset
argument came from `mica-system-base` and, run over these fixtures, **eight
were repaired across `0a4a13f`, `c4efe00` and `653f641` — five the missing
comment line, three whose named defect dragged `sort-order` with it**. The
other three instances exist only in the coordination channel and are marked as
their author's, which is **the subject of the decision they are a section
of**, not a caveat on it.

## 2026-09-20 16:38 [finding]

**Six offered rules, four homes, and the set is the widening.** A day's
coordination rules were offered as a page; counted against where each one
actually belongs, they are not one class. **Three have owners here and are
landed**: *a record may not drive the artefact it describes* — a release cut
to feed a check nobody has written, or a push made so a page reads as current,
is the tail wagging a product people run — and *ask the membership question
from both sides*, because a count taken from one side is a sample that reads
as a census, both in the documentation contract beside the rules they qualify;
and *a pin move is one line only where nothing is pinned to it*, which is a
fact about pins rather than about coordination, beside the one-line argument
it corrects in the lock spec.

**Three are coordination itself and already have a record that owns them** —
`decisions/2026-09-20-coordination-state-is-a-record.md`, whose owner is
*whoever coordinates*: a conditional ruling is not a ruling when the condition
is itself work; route techniques, not conclusions; send a correction to the
repository about to act **before** it acts. They are its instances, not a new
page, and they should arrive in their author's words the way the other two
handed-over texts did.

**The reason it is not a page is the day's own membership test**: the six
share a *day*, not a repair. Calling them *the coordination rules* would have
put a fact about pins and a rule about what a record may cause inside a class
that cannot repair either.

## 2026-09-20 16:36 [finding]

**A reading that is the arithmetic consequence of its input carries its own
corroboration.** `--memory=64m` producing `memory.max=67108864` and
`--cpus=0.5` producing `cpu.max=50000 100000` are one fact checked twice: a
number no instrument could have guessed from outside cannot be produced by an
instrument that is not looking at the thing. That is *what would this print if
the claim were false* answered **inside one measurement** rather than across
two — which is why a single run of the third version is stronger evidence than
two earlier versions were in an evening of agreeing with the configs. **Prefer
an output derived from its input over a state word**: `absent`, `present` and
`ok` are producible by an instrument pointed at nothing.

**And the reason these records keep both timestamps rather than the current
state**: a page rewritten to the later fact teaches the next reader nothing,
while a page that shows a sentence being true and then not true in four
minutes teaches them to put a time on theirs. **The first is a correct page;
the second is a page that changes behaviour.** Both sentences had been said in
messages and neither was in a record, which is the day's own rule turned on
itself — a sentence that lives in a message is not an instrument.

## 2026-09-20 16:33 [finding]

**Three of the five ceilings are enforced, measured inside a running
product.** From a booted `uefi-x64-prod` guest on `20260920-1536`,
`podman run --memory=64m --cpus=0.5 --pids-limit=42` returns
`memory.max=67108864`, `cpu.max=50000 100000`, `pids.max=42` — 64 MiB exactly,
half a CPU exactly, 42 — answers only a kernel with `MEMCG` and
`CFS_BANDWIDTH` can give. Nine hours from the fragment, through four board
releases, a re-pin and an artefact, to a machine.

**`io.max` stays a kernel-config claim, on this section's own warning**: no IO
limit was passed, because an `IO*` key needs a device path — the thing logged
and skipped when it does not resolve. **A row left half-open is worth more
than a row filled with a third thing that looks like evidence**, from the
author who had filled it with two.

**And what let version 3 answer what two versions could not is that it stopped
testing a path.** *Does `/sys/fs/cgroup/cpu.max` exist* was never a question
anybody had; *does `--cpus=0.5` reach the container* is the sentence this
document writes. **Neither earlier mistake was reachable from a check written
against the document's own promise.**

**The four-column table is now history and says so**: the pinned kernels carry
all four symbols on all four boards since the re-pin, and the table above
keeps its releases so both can be true. **A prediction table whose rows have
all fired is no longer a design; it is a measurement of the chain it was
written about.**

## 2026-09-20 16:29 [finding]

**The last unexercised row of the prediction table fired: `board-pin.*` red,
`board-release.*` green — at the re-pin and not at the release.** All four
pins moved to `20260920-1536` at 16:28. Every row of that table has now been
exercised by the event it predicts, and none of them needed an investigation
to read.

**And the paragraph it corrects was true when it was written, four minutes
earlier.** At 16:24 the re-pin answered 422 at `origin` and the pins still
named the old four; the push landed in between. Both readings were right of
their moment, which makes this **the third resolution of one question in a
single evening — working tree versus commit, commit versus `origin`, local
branch versus `origin`.** The rule is not *check whether it is pushed*: **a
claim's subject has a location, and the location is part of the claim.**

**The detail that would have been dropped as housekeeping is the one that
mattered**: the release configs were read **after deleting `_out/` and
re-fetching**. Without it the number is a reading of a build tree that was
already there — the stale-`_out` hazard, quoted as proof that the hazard was
repaired. **A number whose method is dropped can reproduce the defect the
number was proving fixed.**

## 2026-09-20 16:26 [finding]

**Landed: never quote a check you have not seen fail**, with five instances
reached by four repositories — a vectors-pin gate checked red three ways, an
identity check shown to refuse the banner it used to accept, a refusal proved
against a mutated copy, a floor loop with eight negative fixtures, and this
repository's vectors gate, which had 355 assertions and no negative test for
six days. **The counterexample was found by applying the rule to the ledger
used to test it**, which is a better outcome for a candidate than surviving
one.

**The operational half is what turns it from a virtue into a build target: a
bite test by hand proves a gate once and proves nothing tomorrow.** *Seen to
fail* has to mean a case that runs, or the evidence dies with the session that
saw it.

**How the instances arrived is recorded with its limit.** Channel
independence is verified — the seat that carries every cross-repository
message has none relaying the practice, and one repository was already
describing this shape in an unrelated suite beforehand. **Tree-level influence
cannot be excluded**: these repositories read each other's `tests/`
directories and one demonstrably did today. So the record says *reached
without being told* and names what that does not cover, which is worth more
than the word *independently*.

**And the test's own header now carries the case that caught itself**: its
refusal-set mutation first wrote `header` over a row whose rule already *was*
`header`, so the fixture was inert, the gate passed, and the case reported
FAIL — **the defect it exists to prevent, inside the test written to prevent
it**. Written the other way round it would have shipped a case that could
never fire.

## 2026-09-20 16:23 [finding]

**`memory.max` is present in a running product — the far end of a chain that
started at 08:35.** Fragment, four board releases at `20260920-1536`, a
re-pin, an artefact, a running `uefi-x64-prod` guest, measured at the last
step rather than inferred, with the release configs read after deleting and
re-fetching the build tree. **Nothing is claimed for `cpu.max` or `io.max`
from the product side**: that reading does not exist.

**And the subject of that measurement is a pin `origin` does not have.** The
re-pin is `mica-build` `49c7aed6`, which answers 422 here, and `locks/pins/`
at `origin` still names the old four — so the `board-pin.*` rows are green and
**correct**, and the prediction table's third row has not fired. A measurement
taken against an unpushed pin is true of the machine that took it and not
reproducible from `origin`.

**Three versions of one probe in one evening, and the third is different in
kind.** Version 1 read a file that can never exist; version 2 read one that
exists only if delegation was already asked for — `cgroup.controllers` saying
`cpuset cpu io memory pids` against `subtree_control` saying `memory pids`, so
a kernel with `CFS_BANDWIDTH` looks identical to one without. **Both checked a
proxy for the promise.** Version 3 checks the promise: `podman run
--memory=64m --cpus=0.5 --pids-limit=42`, then ask the container what it got.
**A proxy can be wrong in ways the promise cannot, and both wrong versions
were wrong in exactly that gap.**

**What caught version 2 was the output, not a reader**: it printed
`cgroup.controllers` and `subtree_control` beside the verdict, so the
contradiction was legible inside the round that introduced it. **Print what
the verdict depends on, beside the verdict** — the cheapest form of every rule
in the harness, because a rule spends attention at read time and a format
spends none. With its author's sentence for the pair: **a repair landing while
a measurement stays still is a finding about the measurement.**

## 2026-09-20 16:20 [finding]

**The candidate rule *never quote a check you have not seen fail* was offered
with a checkable negative — *the probe is the only check today that was
trusted without anybody seeing it fail* — and testing it against this
repository's own ledger broke it immediately: `verify-release-lock.sh` had
**355 assertions and no negative test**, and every commit report here has been
quoting `355/355 PASS` for six days.** It had been bite-tested twice by hand —
mutate a real vector, watch it refuse, restore from `/tmp` — which proves a
gate at that moment and leaves nothing a later reader can re-run.

**So the rule stands and the counterexample was mine.** The gate's vectors
directory is now injectable (`MICA_VECTORS`) **so that it can be shown to
fail**, and `tools/docs/verify-release-lock-test.sh` breaks a copy of the tree
eight ways and requires the gate's own message each time: a positive control, a
wrong expected result, an unlisted vector on disk, an `expected.tsv` with no
vectors, an empty `derived-from.tsv`, an empty `refusal-sets.tsv`, a wrong
recorded refusal set, and an unknown repair column. It is in
`make docs-verify-test`, which is what makes *seen to fail* mean something a
later reader can repeat.

**Two of its own cases failed first, which is the argument for writing it.**
The refusal-set mutation wrote `header` over a row whose rule already *was*
`header` — **an inert fixture in the test written to prove the gate reaches
the seam** — and the unlisted-vector case used `find | head -1`, which this
repository's shell lint refuses as an early-exiting reader on the right of a
pipe. **The lint caught its own author's new script on its first run**, which
is the third gate today to fire first on the person who wrote it.

## 2026-09-20 16:14 [finding]

**A requested-off symbol has four possible outcomes and the request can
express one of them.** It can come back `=y`, come back `=m` — the
`MDIO_BCM_UNIMAC` case, where a modular selector leaves kconfig free to answer
`m` — be explicitly off, or **not be mentioned at all**: `CGROUP_HUGETLB`
appears nowhere in `s905x5m`'s 8382-line vendor input, neither granted nor
denied, decided at `olddefconfig`. So **`is not set` has been doing duty for
several different states all along**, which is the *a value that cannot
express **not measured*** rule arriving in kconfig: the line cannot say
*unmentioned*, *modular*, or *absent because a dependency was unmet*, and a
reader cannot tell any of them from *decided off*.

**And the count of `=y` in that vendor input is six**, read here at `8e6c3ba`
and confirmed independently: `BLK_CGROUP_IOPRIO`, `CGROUP_RDMA`,
`CGROUP_MISC`, `CGROUP_NET_PRIO`, `CGROUP_PERF`, `TASKSTATS`. The number that
had been travelling was five. It remains a measurement of an **input** — the
floor is merged in afterwards — so *s905x5m ships controllers its floor
records off* would be a claim about a kernel from a measurement of an input,
which is this section's own trap one artefact further down.

## 2026-09-20 16:12 [finding]

**Every sentence claiming a booted guest confirmed `cpu.max`, `memory.max` or
`io.max` is out of section 8: the probe was reading the root cgroup.** In
cgroup v2 the root never carries those files — they exist in a cgroup whose
parent has enabled the controller in `cgroup.subtree_control` — so *absent* is
true on every Linux system ever built, with or without `MEMCG`. The product
side of that section is **unanswered**, not confirmed.

**What is untouched is what the table rests on**: the kernel-config numbers
were read from the build tree and were never the probe's. `uefi-x64` genuinely
had no `MEMCG` and genuinely has it now. The config measured it; the probe
only looked as though it did.

**A repair landed and a measurement did not move, which is how it survived.**
Two instruments agreed all evening **for different reasons** — one because the
kernel lacked the controller, the other because the file is never there — and
the agreement read as corroboration. Beside the replica rule: **agreement
between two instruments is not corroboration unless they could have disagreed,
and one of these two was constant.** It is the same statement as *a branch
that always passes is a measurement*, which the probe's author wrote the same
evening about the **other** branch of the same test.

**And a good comment armoured the mistake.** The probe warned that `cpu`
appears in `cgroup.controllers` on a kernel without `CFS_BANDWIDTH`, *"the
identifier that lies"* — true, careful, about the wrong cheap identifier, and
sitting directly above a read of a file that cannot exist where it was
looking. **A reader who sees somebody thinking carefully about one trap has no
reason to check for another**, which is a cost of a good comment these records
had not priced.

## 2026-09-20 16:09 [finding]

**The sentence under six of today's rules, in its author's words**
(`mica-boards`): **an input I authored looks like an output I verified, and
nothing in the tree distinguishes them.** Counted before it was written down,
because a class is checked by putting its instances back through it: a copy of
the vectors beside the vectors, a committed config beside a resolved one, a
fragment at `main` beside what ships, a pin beside a release, a comment
asserting a check beside a check, a requested symbol beside a resolved one —
**six**. The seventh, a working tree read as a commit, is on a different axis:
not an authored thing impersonating a checked one, but a subject with no name
at all. The sub-rules stay, because the operational halves differ; **the
repair is the same in all six — mark which it is, or re-derive the output and
compare.**

**And re-recording rather than reasoning caught a silent regression inside an
approved deletion.** One of the nineteen denied requests was not inert:
`CONFIG_MDIO_BCM_UNIMAC` went `m` to `y` when its request was removed, because
**a modular selector leaves kconfig free to answer `m`** — the request had
been refused as *off* and honoured as *not built in*, and nothing said which.
**A fragment edit is not an outcome.**

**The two FIT boards' numbers are bounded here before anybody quotes them**:
`s905x5m`'s **vendor input** carries six of the nine requested-off symbols
`=y` and `cx3576`'s carries none, measured at `8e6c3ba`. That is a statement
about an input the floor is merged into afterwards, not about either kernel —
their resolved configs are not in the tree, and the new loop's run is the
first reading anybody has of them.

**And the price list, beside the pre-assertion question**: of nine subject
errors in one day, exactly one was caught in front of the sentence — by
running `git status` before speaking — and it is the only one that cost
nothing. Every other was paid for by a second reader, a CI failure, or an edit
to a published page. **A rule applied after the claim is a rule that bills
somebody else.**

## 2026-09-20 16:07 [finding]

**The row written so that green is the defect and red is the fix went red four
minutes later, and the reader of the red deleted it.** `mica-boards` `8e6c3ba`
(16:04Z) repaired the denied request while the CI run that reported it was
still going: `uefi-x64`'s recorded config now carries both symbols off, and
the floor names the **selector** — `# CONFIG_NET_CLS_CGROUP is not set` —
because a selected symbol cannot be switched off directly. The claims file
keeps a plain row guarding that line, where a red means a regression in the
ordinary sense, and records the four-minute life of the inverted one.

**The missing loop landed with the repair, and two of its choices are worth
copying.** For every `# CONFIG_X is not set` line in either fragment, the
board's kernel build refuses if the resolved config holds any `CONFIG_X=`
line — **and refuses again if it read zero off-lines**, so a loop that asserts
nothing cannot pass. And it asserts *no line turns it on* rather than
requiring the literal `is not set`, because a symbol whose dependencies are
unmet does not appear in a resolved config at all: **absence and an explicit
off are both off, and only one of them is a line.**

**What survives the repair is the finding, not the symbol.** A floor that
never asserted its negative lines was right eight times out of nine by luck,
and nothing in the output distinguished the eight from the one. The nineteen
requests `uefi-arm64` carried were deleted rather than restated in the same
commit, on the same ground: a request a file cannot grant is not a record of a
decision.

## 2026-09-20 16:04 [finding]

**A fourth subject, and it is the one that cannot carry its own name: the
working tree of a shared checkout.** Two readings of `mica-boards`' floor on
the same afternoon were opposite and both true — nothing mentions
`NET_CLS_CGROUP` at `f3ff004` (verified here; that commit *is* `main`), and
something does in the workspace checkout, where its owner was implementing the
repair with five files modified and a fixture untracked. The rule has to be
about **where you read**, not about care: **in a shared checkout, read from a
commit — `git show <sha>:<path>` — or run `git status` first and say which you
read.** A working tree has no name to cite and no timestamp a reader can
check.

**And the result of the floor measurement is the eight, not the one.** A floor
that never asserted its negative lines was **right eight times out of nine by
luck**; nothing in the output distinguishes the eight from the one, because
they are not eight decisions that held but eight coincidences that happened to
match a decision. Same argument as a branch that always passes being a
measurement: the file cannot say which of its lines were granted.

**Row 26 gets the two sentences its reader will otherwise get backwards**:
green is the defect and red is the fix, and it reads `origin`, so it flips
when the repair is **pushed** and not when it is written. The repair existed
in a working tree while the row was still green, and both were correct — a row
cannot see an uncommitted edit and should not try.

## 2026-09-20 16:00 [finding]

**A fragment's `# CONFIG_X is not set` is a request, not a fact, and section 8
had been reading nine of them as facts.** kconfig turns a symbol back on the
moment something enabled `select`s it, and the floor's **positive** lines are
asserted against the resolved config while its **negative** lines were never
asserted against anything, on any board. Measured here across the two boards
whose resolved output is recorded: of the nine symbols the floor asks to be
off, **eight are off on both and one is not** — `uefi-x64` carries
`CONFIG_CGROUP_NET_CLASSID=y`, because `CONFIG_NET_CLS_CGROUP=y` in the x86_64
defconfig selects it and the arm64 defconfig does not have it. **Two boards,
one floor line, and the answer differs because of a file neither repository
wrote.**

**So every *off* in that section is a different kind of claim from every
*on*** — `y` asserted against the resolved config, `is not set` a line in an
input nothing checked — which is the input-versus-output distinction the
section already draws twice, arriving a third time **inside a single file**.
The exposure is the claim and not the behaviour: `CGROUP_NET_CLASSID` is
cgroup v1 `net_cls`, unreachable on a v2-only system. Compiled in and
unreachable.

**A line that reads as a decision and is not granted cannot be wrong in a way
anybody notices** — the same shape as a citation nobody can resolve and an
assurance nobody can test, now in kconfig. `uefi-arm64` carries nineteen more,
the display-trim helpers left behind after that board learned that **a helper
cannot be switched off, you have to name off the drivers that select it**;
they are being deleted rather than restated.

**And the denial is now a row written to flip**:
`net-classid-denied.uefi-x64` states today's `=y` and goes red when the
selector is turned off, so a red there is the repair landing rather than a
regression, and the row is deleted by whoever reads it. 26 of 26.

## 2026-09-20 15:57 [finding]

**An empty result whose bound is invisible**, recorded with its two instances
and its operational form. A **partial listing**: a paginated contents API
quoted as the directory. A **rooted history**: `git log` over a path returns
nothing for everything before a parentless root, so *no history in that
repository* is true of `origin` and false of the clone. The instrument answers
with a boundary it does not mention, and **the empty result is the same either
way**. So: before asserting that a path has no history, check whether the
history is rooted and compare the root's date to the period in question; for a
directory, enumerate the tree and put the count in the sentence.

**It is deliberately not filed with *a set that defines its own
completeness***, although the symptom is identical. The repair decides
membership, as the contract now says: these two are answered by asking the
instrument for its bound, inside the same query; that one can only be answered
from outside the artefact, which is behaving correctly inside a scope it
states. Two instances and a use make a rule, not a class.

## 2026-09-20 15:54 [finding]

**The unguarded rung is a regression, not a gap nobody filled, and that reads
differently.** `mica-build:verify/src/checks-kernel.ts` existed — 748 lines,
reading `/boot/config-*` out of the packed root and asserting `VETH`, the
`NFT_FIB_*` family with the netavark reasons, the `BPF`/`CGROUP_BPF` set with
the crun citation, `NF_TABLES` and the firewall family — and was deleted on
2026-09-09 in the same commit as `checks-display.ts`. **The `mica-boards`
comment citing it was accurate when it was written.** Somebody built the
mechanism, so its cost is known; section 8 and the claims row say *deleted*
rather than *never existed*.

**And the citation form both of us endorsed an hour ago fails on this very
citation.** `1875d133` answers **422** at `origin` — measured here — because
`mica-build`'s history is rooted at `a5f1e36`, a parentless commit of
2026-09-14, so the deletion predates the root and lives only in that
repository's clone. **A line number and a commit is checkable only if the
commit is fetchable**: a citation into pre-root history must carry its own
unreachability, or a reader gets a 422 and concludes the claim is false. The
boards contract now says so beside the rule it qualifies.

**Nobody was careless, which is what decides between a convention and a
row.** One cleanup deleted two checks and left comments in three places
asserting both, in another repository. The comments did not go out of date —
they were **falsified from outside their own file**, by an author with no
reason to read them. A row catches that; a convention is an instruction to
people who are not in the room when it breaks.

**And the closure is one source rather than a restoration**: the deleted file
carried its own copy of the symbol list, so restoring it verbatim would
rebuild the private copy. Approved instead — `mica-boards` publishes the
fragment as a file row of the board bundle and `mica-build` asserts
`/boot/config-<release>` against the fragment **from the pinned board
release**. One source, fetched at the pin, no copy, and the assertion moves
with the pin.

## 2026-09-20 15:46 [finding]

**The withheld paragraph is replaced rather than restored, in its author's
words**, as the closing part of `docs/boards/contract.md` section 4.6: two
places read a shipped kernel configuration, both about boot and verity, and
for the container-limit and netavark symbols *this file and the
post-olddefconfig loops are the only end, which is exactly why a stale
`_out/boards/<board>/kernel/` escapes everything*. Re-measured here before
landing — both readers at their lines, and the negative by enumerating the
tree and fetching every one of the 61 files under `verify/src/`.

**And the citation form it arrives in is the one to copy across a repository
boundary: a line number and a commit.** `build/src/kernel-package.ts` lines
141-149, measured against `mica-build` at `77a124b`. It can be checked, and
when it moves it goes stale **visibly** — which is the whole difference from
the citation this replaces, a bare path that asserted a check nobody could
find.

**The allocation rule gains its third form, which is the one that gets
mistaken for the other two.** A claim an instrument can hold; a claim only a
person can carry, with an owner and a deadline; and **a claim neither can
hold** — *a shipped artefact is asserted against the floor* is not expressible
as a line in a file — which is carried by the record alone and must **say that
it is**. An instrument whose limits are unwritten becomes the next false
assurance: a row watching one path reads as coverage of the question that path
was cited for.

**And the correction that produced the sharpest formulation of the day was
about a listing.** A directory listing that paginated was quoted as the set
itself, by the reader who had recommended it as the stronger instrument. Every
other aperture today announced itself as a query — a grep, a filter, a glob, a
name. **A partial listing is an aperture that looks like a directory**, which
is why it stops the looking rather than prompting it.

## 2026-09-20 15:44 [finding]

**The held sentence was not a bad citation, it was a false assurance, and the
difference decides the repair.** `mica-boards`' test header named
`mica-build:verify/src/checks-kernel.ts` as the half that reads the shipped
`/boot/config-*`. Measured: that path has no history in `mica-build`, **none
of the 61 files under `verify/src/` mentions `/boot/`** — read here one file
at a time rather than grepped for a name — and the two places that do read a
kernel configuration are `build/src/kernel-package.ts`, over the kernel
component, and `rootfs/compose/compose-install.sh`, over
`/boot/config-<release>` in the composed root. Both assert the boot and verity
floor. **Neither names a container-limit symbol, and nothing in either
repository asserts anything from `mica-required.fragment` against a shipped
artefact.**

**So the top rung of section 8's ladder is unguarded for the symbols that
section is about, and the committed inputs are the only end.** That is also
why the stale-build-tree hazard escapes everything: nothing downstream of the
build would notice. **The paragraph describing the hazard was the same
paragraph claiming it was covered** — correcting the citation would have left
the reassurance standing, and naming the gap removes it. The claims file keeps
its row with what the row can and cannot do written beside it: a reader under
another name closes the gap without ever touching it, and *a shipped artefact
is asserted against the fragment* is not expressible as a line in a file.

**And a rule from the clause repair that applies to everything written here
today: repair a clause on its shape, not on its current counterexample.** Four
boards released from one commit made the old per-producer form satisfiable the
same afternoon; had it been repaired only when it bit, the first single-board
release would have re-broken it and somebody would have re-derived the
argument from scratch.

## 2026-09-20 15:41 [finding]

**`mica-boards`' cx3576 measurement is landed in its author's words**, as
`docs/boards/contract.md` section 4.6 rather than as a paraphrase: the two
assertion sites, the not-rebuilt hazard, the `Image` from 2026-08-31 that rode
a week of images while the fragment moved, the CI run that demonstrates where
the hazard is **not**, and the two-hazards-one-directory-name distinction. One
paragraph — which instrument reads the shipped `/boot/config-*` — was withheld
by the coordinator pending an answer, and the withholding is named in the
record rather than left as a silence. The build harness now points at that
section instead of restating it, keeping each fact in one place.

**Landing somebody else's measurement means saying which half was checked**,
so the section does: the fragment's contents and the two FIT boards' missing
`kernel-config` target were read here at `main`, the `# CONFIG_SECURITY is not
set` line at the pinned release; the CI run id and the `Image` dates are taken
on their author's authority. A record that does not distinguish the two is a
record whose reader has to trust all of it equally.

## 2026-09-20 15:37 [finding]

**The row written to watch a step nobody watched fired twenty minutes after it
was written.** All four boards were released at `20260920-1536` from one
commit, `2bfa259e`; the four `board-release.*` rows went red naming the new
tags and the `board-pin.*` rows stayed green — **at this step and not at the
next one**, which is what the prediction table in `containers.md` section 8
said this event would look like. The value is not that the rows noticed. It is
that the red needed **no investigation**: the table had already said which
event produces this pattern and what it means — `mica-build` can now re-pin,
and until it does the products carry the older kernels.

**So the sentence those rows were guarding is already gone**: *the newest
release of every board is exactly what `locks/` names, so there is nothing to
re-pin to* was true when it was written at 15:14 and false at 15:36. Without
the rows it would have been a dated paragraph that reads as current; with them
it was a CI failure with its explanation attached.

**And the clause A impossibility turns out to be contingent**, which is the
reason it had to be repaired rather than waited out: with all four boards
released from a single commit, a workspace could stand at one commit for all
four inputs once they are pinned. **A clause that happens to be satisfiable on
a given afternoon is not a satisfiable clause** — the boards diverge again at
the next release anybody cuts alone.

## 2026-09-20 15:35 [finding]

**The product identity is repaired and `diagnostics.md` takes the one edit it
was held for.** Since `mica-build` `77a124ba`, `/usr/lib/os-release` carries
`ID=mica`, `IMAGE_ID` and `IMAGE_VERSION` with `/etc/os-release` symlinked to
it, from the same expression the signed components take their version from, so
the banner, `os-release` and what was signed cannot disagree. The user page
was held rather than edited and is true again without a diff.

**What the page records is the order, not the values.** The identity is
written **after the `dpkg` run**; the first placement was beside the preset
install, which runs before the packages are unpacked, where a `base-files` or
`mica-system` unpack would have put the component's identity straight back.
**A correction writes the right value once; a repair makes the wrong value
unreachable** — and the two would have looked identical until the next package
bump.

**And the check was verified in the direction that proves something**, which
is now a rule in the harness: the old `Mica OS *` prefix **could not have
failed** on the Base's banner and the anchored one **cannot pass** on it. A
tightened check is verified by showing it would now refuse what it used to
accept; a repair whose test was only ever run against the fixed world is a
test of the world.

**The widening that put a wrong sentence on this page is worth the record more
than the sentence was.** One repository said *my* unowned artefact cannot see
these four, true of that artefact; it was relayed as *if the other
repository's report has them in the same bucket, the bucket is wrong*, a claim
about a tool nobody in the chain had read; and it was written here as a fact.
**Every link was true of its own subject, which is why it survived every
reader** — each was reading their own link.

## 2026-09-20 15:31 [finding]

**A citation that was never checkable now has a row that goes red the day it
becomes true.** `mica-boards`' kernel config test names
`mica-build:verify/src/checks-kernel.ts` as the instrument that reads the
`/boot/config-*` an image ships — the top rung of the ladder in
`containers.md` section 8. The path is absent from that repository's directory
listing **and `git log` over it returns nothing**, so it was never there under
that name. A four-rung ladder whose top rung's instrument nobody can find is
three rungs with an assurance attached.

**So the gate learned a new kind, `no-path`, and its implementation is a rule
this corpus already carried.** The parent directory is **listed** rather than
the path probed: a probe answers *not found* both for an absent file and for a
reader that never arrived, and the two are the same exit status — while a
directory that answers proves the reach, and only then does a missing name
mean anything. Absence is claimed from positive evidence or not at all. The
expected column must read the literal `absent`, so a typo is loud rather than
a silent pass. Four negative tests: absent passes, present refuses, an
unlistable directory refuses, and a different expectation refuses. 13 of 13,
and 25 of 25 claims hold.

**The shape it belongs to is the third instance today of a comment asserting a
check in the present tense while the check is not there** — and it is the
worst of the three, because a **cross-repository citation is checked by no
gate either repository owns**: `mica-boards`' gates do not read `mica-build`'s
tree, and `mica-build` has never read that comment. It takes a third party
whose whole job is claims about other repositories, which is what this file
is.

## 2026-09-20 15:28 [finding]

**A paragraph published here four hours ago rested on an inference I had
passed along, and the correction is narrower and better.** The four dropped
Debian drop-ins are package-owned, and the triage that reported them **had
already sorted them that way** — the buckets were right. What is wrong is one
directory: the rule claiming `systemd`'s resources enumerates
`/usr/lib/systemd/system/*`, `/usr/lib/tmpfiles.d/*.conf`,
`/usr/lib/udev/rules.d/*.rules` and more, **and no `*.conf.d/*.conf`**. The
reason is right and the membership is one directory short — the
correct-class-short-membership defect a fourth time, and the first arriving
through an **enumeration inside a tool** rather than a person's list: nobody
decided those paths did not matter, a glob did not reach them, and everyone
downstream was right to trust the rule inside its scope.

**And one of the four narrows rather than closes.** With `resolved`'s drop-in
gone the compiled-in default returns: `MulticastDNS` is globally `yes` on a
booted `uefi-x64-prod`, and `eth0` says `no` only because `80-dhcp.network`'s
`Name=eth*` matches it — `sit0` says `yes`. **Closed for `eth*`, untested for
every other interface name, and the mechanism that makes it safe is a match
pattern rather than a decision about mDNS.**

**The `_out` staleness hazard is located rather than general, and it took a
run rather than a reading**: `mica-boards`' run `35500637534` on `58dee40`
failed at the recorded-config gate with the prefix cache warm, because the
fragment is not in the cache key and does not need to be — the config stage
`COPY`s it and BuildKit's content addressing keys that layer on its bytes. The
hazard needs a tree that persists across a fragment change and is consumed
rather than rebuilt: image assembly, and a developer's working tree.

**Same path, two hazards, different repairs**, which is what a reader who
learns one will get wrong about the other: `mica-boards`'
`_out/boards/<board>/kernel/` can be stale against a **fragment**, because
that repository builds from one; `mica-build`'s is fetched from a **pinned
board release**, so its staleness is the pin's. BuildKit's content addressing
answers one; comparing a report's mtime against the signed root it describes
answers the other. Both are called *the `_out` problem* by anybody describing
them quickly.

**And the general rule is `mica-boards`' and better than the one it
replaces**: *a constraint in a header warns whoever is already reading that
file, which is nobody who needs it.* Not that comments decay — that **a
comment's audience is selected by the one property that excludes the person at
risk**, having the file open.

## 2026-09-20 15:24 [finding]

**Section 8's artefact table conflated two kinds of file, and the ladder is
four rungs rather than three.** Verified in `mica-boards`' tree: `uefi-x64`
and `uefi-arm64` have a `make kernel-config` target that **re-records** the
committed config from the build, so theirs is a recorded resolved output;
`cx3576` and `s905x5m` have no such target, so theirs is a **vendor input**
the floor is merged into at build time — **there is nothing to re-record**,
and *not re-recorded yet* was a framing this page had taken on trust and
published. The proof is in the file: `cx3576`'s committed config says
`# CONFIG_SECURITY is not set` while the kernel it ships has it on, which is
normal for an input and would be the defect the `uefi` gate catches for a
recording.

**And the rung below has a staleness hazard the measurement was taken from.**
`_out/boards/<board>/kernel/` is an input to image assembly, so a tree that
already exists is not rebuilt and its gates do not run: `mica-boards` measured
an `Image` from 2026-08-31 riding every image built for the following week
while the fragment gained dm-crypt, the eBPF/firewall/bridge floor and two
`NF_*` symbols. Section 8 now names which instrument reads which rung, and
records that the instrument named for the shipped `/boot/config-*` —
`mica-build:verify/src/checks-kernel.ts` — **does not resolve at that
repository's `main` today**.

**The two world rows are renamed to what they measure**:
`io-throttling-vendor-input.{cx3576,s905x5m}`. Calling them *unrecorded*
implied a recording that does not exist, and the prediction table no longer
predicts an event that will never happen.

**A hazard recorded in a comment in one repository is invisible to the
repository that will hit it.** `mica-boards` had the stale-build-tree hazard
written in a header weeks ago; `mica-build` met it in its own tree this
afternoon and built a guard, neither knowing of the other. That is what
*constraints live in records* is for, and the cost of getting it wrong is that
the second repository pays the discovery again.

**Two smaller rules, both from testing a candidate rather than accepting it.**
A matcher comparing unit patterns literally — `disable getty@.service` never
matching `getty@tty1.service` — was offered as a third instance of *a set that
cannot see outside its own scope*. It is not: the consequence is identical, an
exclusion read as an absence, but the repair is not, because a matcher is a
**bug** fixable inside the artefact while a set defining its own completeness
or membership is **correct behaviour inside a stated scope**. So the
documentation contract now says to sort by whatever determines the action —
consequence for a triage, repair for a class — which is what two rules written
the same day were doing without saying so. And, with it: **where no instrument
exists, a named person with a deadline is the substitute, and the failure mode
to avoid is neither.**

## 2026-09-20 15:20 [finding]

**A count that travelled out of these records and came back wrong, measured to
the commit.** Five `upstream/refused/` fixtures were missing their sibling's
comment line — one repaired in `0a4a13f`, four in `c4efe00`, and the third
repair commit is a different fix (one insertion *and* one deletion per file is
a changed value, not a restored comment line). The double count entered where
nothing checks a number: `c4efe00`'s title says **five more** while it
repaired **four** in that directory, and this spec gave *half of it* beside
*five of the eight* in one sentence. **A count in a commit message is prose
nothing checks**, and it is the form most likely to be quoted, because a title
reads like a summary of a diff and is written before anybody reads one. The
paragraph now names the split and the commits; `git show --stat` settled it in
one command.

**And a relayed routing was stale in the other direction**: `IOWeight=` was
reported as reaching `io.weight` *rather than* iocost, with the io neighbours
uniformly off. `mica-boards`' floor says the opposite and shows its work —
`io.weight` is registered by `blk-iocost`, `io.latency` by the iolatency
policy, `io.prio` by nothing a product can set — so `BLK_CGROUP_IOCOST` and
`BLK_CGROUP_IOLATENCY` are on for all four boards and `IOPRIO` is off. Section
8 said the right thing already because it was written from the fragment rather
than from the message; it now names `io.latency` too. **The form that survived
this is the one that states both readings and names the test**: a scatter in
the pinned releases, a decision at `main`.

**The rule it leaves behind is about the reversal, not the symbol**: a
measurement that has been passed on is already in somebody else's page, so
withdrawing it privately leaves everyone holding it on your authority, and
they will not re-measure because you answered. Recorded in the documentation
contract — **a reversal costs one sentence and is the only part of
re-measuring that other people can act on.**

## 2026-09-20 15:17 [finding]

***Dropped* is not one mechanism, and the artefact that explains one cannot
see the other.** The composer's unowned-path account explains the `tty1`
symlink exactly and reaches none of the four dropped Debian drop-ins, which
are package-owned by `systemd` and `systemd-resolved`; which rule took them is
open. **A list of what no package claims cannot report a package-owned drop by
construction** — the same shape as a suite walking its own `expected.tsv`, one
level down, where a filter that defines its own scope is silent about
everything outside it and the silence reads as absence. Recorded beside the
polarity axis, because a triage sorted by shape would have put the two drops
in one row.

## 2026-09-20 15:14 [finding]

**A claim these records made about another repository's *set* was measured
false, and the repair keeps the sentence about the file.** Section 9 said
`mica-build`'s vector copy was byte-identical to canonical after one rename —
the reading available when it was written, and the ground for auditing the
vectors *here, once, at the source*. The copy held 127 files against 143. The
audit's conclusion stands, because it was run against this repository's own
set and the missing files are the copy's, but the reason given for running it
here had to be replaced with the one that does not depend on a tree nobody had
diffed: a finding about the vectors is a finding about the vectors.

**And the repair test stays, relabelled.** *No vector carries an incidental
defect beyond the one it names* is a real property of this corpus — it is what
the comment-line repairs restored — and **no other repository can check it**,
because the repair has to be made in the fixture. A fixture-hygiene test
mislabelled as an isolation test is worth relabelling and not worth deleting;
what the relabelling buys is that nobody reads its green as *every rule is
isolated* again.

## 2026-09-20 15:12 [finding]

**The capability text for section 8 landed merged rather than appended, and
the sentence the section was missing is the opening one**: a controller that
is not compiled in is not a weaker limit, it is **a file that does not
exist** — `podman run --memory=512m` against a kernel without `CONFIG_MEMCG`
does not round the limit off, it fails at the write.

**Every cell of the handed-over table was re-read here before it was
published**, from the kernel config committed at each pinned release
(`97aca03d`, `48d995b1`, `a15dbf8c`) rather than from the build output it was
measured in, and all sixteen agree: `pids.max` on four boards, `cpu.max` on
two, `memory.max` on three, `io.max` on none. A second artefact is not a proof
— two copies agreeing says they travelled — but a claim about another
repository that nobody here has read is weaker than one somebody has.

**A scatter became a decision, and the test that decided it is the part worth
carrying.** In the pinned releases `PSI` is on `s905x5m` alone, `TASKSTATS`
and `CGROUP_PERF` off on `cx3576` alone, `BLK_CGROUP_IOCOST` on two of four —
nobody chose any of it, the defconfigs differed. At `main` each symbol was
settled by asking **whether a unit key a product can set, or a podman flag,
reaches the file it creates**: `ManagedOOMSwap=` reaches `/proc/pressure`, so
`PSI` is on for all four; `IOWeight=` reaches `io.weight`, so
`BLK_CGROUP_IOCOST` is; nothing reaches `io.prio` or a `perf_event` cgroup, so
those are off uniformly with their reasons beside them. **An arbitrary
per-board split is the one answer that is wrong whichever way the symbol
goes**, because nobody chose it.

**And the floor states the distinction the whole section needed:** `PSI` on is
a **capability**; running `systemd-oomd` and setting those keys is a
**policy** the kernel neither decides nor enables. Applied to the storage
paragraph, where the word *bounded* spans the seam: `prjquota` makes a quota
possible, and `mica-system-base`'s project-id assignment is what makes a bound
exist. `mica-core` declined to write the conclusion from its own tree for that
reason and was right to.

**The step nothing watched now has four rows.** The config rows flip when
`mica-boards` records a symbol and the pin rows flip when `mica-build` moves
to a release carrying it — **the release itself is a third step, and it moved
neither**. Measured today: the newest tag of every board already *is* what
`locks/` names, so *there is nothing to re-pin to* was true and invisible, and
a page could have said *the repair has shipped* on the day the tags were cut
and been wrong by a re-pin. `board-release.*` names today's newest tag per
board and goes red when a board is released — before the pin rows, never
after — and the prediction table in section 8 gains that middle row. Three
more rows hold the floor's own decisions (`PSI`, `IOCOST`, `TASKSTATS` off),
so a defconfig bump that re-scatters them is red rather than quiet. 24 of 24.

## 2026-09-20 15:05 [finding]

**An acceptance clause of these records is unsatisfiable, and the repair is in
the clause.** Clause A of the offline-build task asks a workspace to stand at
the release commits of every input, which assumes **one release commit per
producer**; `mica-build`'s `locks/` name four `mica-boards` releases at
**three distinct commits** (`97aca03d`, `48d995b1`, `a15dbf8c`, each read back
from its tag), and one working tree cannot be at three commits. Not a
`mica-boards` special case: `mica-build` releases per scope too, so every
consumer of it inherits the same impossibility. The satisfiable form is **per
pinned input rather than per producer** — a producer with several pinned
inputs is checked out once per input — and it is now what the task and the
plan say, with the mechanism following the clause rather than the other way
round.

**Section 8 of `containers.md` names both of its instruments and predicts
which way each will go red.** The `world` rows watch another repository's
source and cannot reach a build output; `mica-build`'s session probe reads a
booted `uefi-x64-prod` and recorded `memory.max` **absent** — the third row of
the artefact table confirmed from the machine end, for `MEMCG` on one product.
Its memory branch passes on **both** sides on purpose, with the comment that
*a branch that always passes is a measurement and not an assertion*, and turns
into a `fail()` when the floor is uniform: the same rule as a column that can
only say `valid`, reached from the other side. A gate that says in advance
which way it will fail is a gate whose red can be read without an
investigation.

**A set that defines its own completeness cannot detect an omission.**
`mica-build`'s copy of the release-lock vectors held 127 files where this
repository held 143 — the five `data-*` vectors, the post-rename board vector
and `derived-from.tsv` among the missing — and its suite was green at 81 of
81, because it walks the copy's own `expected.tsv`. Filed with the aperture
family as a kind none of the others are: not too narrow, misaimed or too
coarse, but **no aperture at all in the direction that mattered**. The
repaired gate is worth a rule of its own — it compares the trees with `diff -r`
and not a digest, *because a digest says that they differ and nobody could see
what*: a digest is right for a release asset and wrong for a drift gate
somebody has to act on in the morning.

**Two guards became three, and a dropped file's polarity is the opposite of
the obvious question.** The generalisation threshold and the
counted-in-two-classes rule both guard against evidence that under-reaches;
neither guards a class wide enough to absorb every instance, and one
instrument answers both — enumerate, then test each instance against the class
as written. Separately, the first question about a dropped path is **what its
presence would authorise**: `/etc/nftables.conf` is the case where the drop
converts a silent-harm path into a loud one, so the triage field has three
values, not two.

**And a design page was wrong before its repair rather than after it**:
`system/info`'s `release` member is `/etc/os-release`, which on a built
product is Debian's, and `/etc/issue` names the Base component's release. The
member is faithful and the answer is wrong — an available, well-formed,
correct-looking statement about the wrong system. Recorded in
`design/diagnostics.md` where a reader learns what `release` answers; the
repair is owned elsewhere, and the user page's sentence becomes true again
when it lands rather than needing an edit in each direction.

## 2026-09-20 14:53 [finding]

**The claims written to fail flipped four hours after they were written, and
the `world` job is how this page found out.** `mica-boards` `3970753b`
(14:45Z, *io.max exists on no board: `BLK_DEV_THROTTLING` joins the floor*) put
the missing controller in `common/kernel/mica-required.fragment` and
re-recorded both UEFI configs; the next push here went red naming both boards
and the exact line. **The gap between a document being wrong and somebody
noticing was one CI run** — against four days for the last defect this corpus
found by hand. The `board-pin.*` rows stayed green throughout, correctly,
because nothing about what ships had changed.

**And the symbol now has three answers depending on which artefact is read**,
which is the pin-and-tree distinction at a third resolution: the **fragment**
(the requirement, asserted at every board build) has it for all four boards;
the **committed configs** (the last build's output) have it on the two boards
re-recorded in that commit and not on the two FIT boards; the **board releases
`mica-build` pins** have it nowhere. None is stale, none contradicts another,
and a reader who takes one for another gets a defensible wrong answer — so
`containers.md` section 8 now answers *does this board have `io.max`* with a
table of artefacts rather than a sentence.

## 2026-09-20 14:50 [finding]

**The negative-vector audit finished, and the definition it was built on tests
the wrong property.** `mica-build`'s form — *repair the named defect and
require the result to become valid* — was measured by hand on the eleven
vectors that were not plain single-rule reports, and **all eleven became
valid, the six recorded pairs among them**. Repair asks whether a fixture
carries a **second incidental defect**; the failure the property exists to
catch is a fixture that **keeps passing after the rule it names is broken**,
which is a question about the *unrepaired* file. The two verdicts agree on 45
of 56 vectors and disagree on exactly the six, which is how a set gets audited
against the wrong property and reported as clean.

**And suppression is not repair** — which is what the five stops were saying.
Suppressing a rule leaves the malformed value for the next check to read;
repairing replaces it. A stop is the approximation's boundary, not a
suspicious fixture, and it **truncates rather than taints**: two of the five
carry a second rule that was found before the stop and stands. Final state
**45 isolating, 8 inherent pairs in five families, 3 unresolved**, up from the
6 pairs recorded this morning.

**The numbers are now a gate's output rather than a paragraph's claim**:
`vectors/refusal-sets.tsv` records every rule each refused vector breaks, and
`verify-release-lock.sh` re-runs the collect mode over all 56 and compares
(355 checks, up from 298). It pins a measurement rather than proving a
property — a vector that starts breaking a second rule *or stops breaking one*
is a finding either way round. Column 4 carries the hand-measured repair
result and can say `unmeasured`, because **a column that can only say `valid`
records nothing**.

## 2026-09-20 14:42 [finding]

**One more relayed number was wrong, and I had already copied it into the
page.** `s905x5m` is pinned at **`20260919-2259`**, not `20260916-0857` —
read from `mica-build:locks/pins/` rather than from the message. The
conclusion survives (that release is still older than `04e0fae`, so the gap is
still one re-pin), but the fact in section 8 was wrong for an hour because I
took a list of four pins on trust after measuring everything else in the same
paragraph.

**And the other side of the gap is now watched too**: four world rows naming
the board release each `mica-build` pin holds. The kernel-config rows say what
the **next** board release will carry; these say what the products being built
carry **today**. **A re-pin flips these and not those**, which is exactly the
distinction a capability measured from a build output needs — and it means
neither half of section 8 can go stale without a job going red.

## 2026-09-20 14:40 [finding]

**Two measurements disagreed and neither was stale: they were about different
artefacts.** The configs at `mica-boards` `main` carry `MEMCG` and
`CFS_BANDWIDTH` on all four boards since `04e0fae` (2026-09-20 08:35:36Z,
*the floor carries the container limits*), verified here in
`common/kernel/mica-required.fragment`. `mica-build`'s table was read from
`_out/boards/<board>/kernel/config` — the kernel in the products it builds —
so it describes the board releases it **pins**: `20260916-0857` for three
boards and `20260917-1007` for `cx3576`, all cut before that commit. **One
describes what `main` builds, the other what ships today, and the gap is
exactly one re-pin.**

**So the rule the disagreement produced is in section 8, and it is the one
that would have prevented it**: *a capability measured from a build output is
a statement about a **pin**, not about a board.* Each column names the release
it was measured from — a reader given both tables without their dates
concludes one of them is wrong, and both are right.

**And the floor text gains the other half of the `release-slash` correction**:
read from the **name**, it was taken as constraining a consumer's own release
values — it does not. Read from the **file**,
`scoped-release-not-allowed.lock` **is** a `mica-core` lock carrying
`uefi-x64.20260914-2042`, an unscoped producer with a scope, so it does belong
in a consumer's floor by the third clause, *the vectors that say what its own
forms may not be*. One sentence, half invented from a filename and half held
by the file — and three repositories made the same mistake about the same
vector on the same day.

## 2026-09-20 14:35 [progress]

**The ceiling measurement is a world claim now, not a dated sentence.** Six
rows in `docs/world-claims.tsv`: `BLK_DEV_THROTTLING` absent on each of the
four boards, and `MEMCG` and `CFS_BANDWIDTH` present on `uefi-x64` — the two
the relayed table disagreed with me about, so the record carries the
disagreement's resolution rather than my word for it. **12/12 claims hold**
today.

**The absence rows are expected to flip**, and the file says so: when the
authorised repair lands, the `world` job goes red, which means **the dated
note in `containers.md` 8 is stale and the capability text replaces it** — the
gate doing its job rather than a regression. That is the first world claim
written to be broken on purpose, and it is the cheapest way I know to stop a
correct note outliving its correctness.

## 2026-09-20 14:34 [finding]

**A section of this corpus promises five ceilings and one of them exists
nowhere.** Measured in the four committed kernel configs at `mica-boards`
`main` on 2026-09-20: `MEMCG`, `CFS_BANDWIDTH` and `CGROUP_PIDS` are set on
**all four boards**, so `memory.high`, `memory.max`, `cpu.max` and `pids.max`
are real — and **`BLK_DEV_THROTTLING` is set on none**, so `io.max` does not
exist and the two `IO*` keys bound nothing on any Mica board today.
`containers.md` section 8 now says so beside the table, with the input/output
distinction stated: the configs are the input, and a published kernel carries
what the release that built it carried.

**The finding worth more than the table is that the section already worries
about the wrong half of the worst case.** Its warning — an `IO*` key naming a
device path that does not exist is logged and skipped, the unit starts
unlimited, the evidence is in the journal — is careful, true, and one level
above the real cause: the controller is **absent**, which produces no journal
line at all. **A correct warning about the near cause is exactly what stops
the next reader from looking for the far one.**

**And the section now says which of its claims are measured**: *a container
runs with no flag* is measured — ten "to run" symbols uniform across four
boards, and the session probe has seen a container run on a booted image —
while *a ceiling is a kernel controller* was an assumption until tonight, and
one fifth of it was wrong. **A document that says which of its claims are
measured is worth more than one that is uniformly confident.**

**Separately, one line for the floor derivation** (`mica-core`): it had read
`release-slash` as constraining its own release values **from the vector's
name**; the file is a `mica-boards` lock carrying `uefi-x64/20260914-2042`, a
form it neither pins nor emits. **A floor derived from filenames is a floor
derived from somebody's naming** — the rule survives only if it reads the
file.

## 2026-09-20 14:31 [finding]

**One rule with two instances from different domains on the same day: a
correct class with a hand-enumerated membership is the defect that survives
review**, because every reviewer checks the **reason** and the reason is
right. Mine: the collect mode's structural set left `release-row` out while
everything after it reads `rows[0]` as the release. `mica-build`'s:
`e2fsprogs` keeps `/etc/e2scrub.conf` *to preserve existing configured
defaults for the retained `e2scrub`* — and **stops at one of two retained
binaries**. The repair is the same and neither found it from the other:
**derive the membership from the class, or say in the rule that the list is
enumerated so a reader knows to re-derive it.** Applied to my own list in the
same commit: the structural set now says it is enumerated and how to
re-derive it.

**And a correction to numbers these records have been carrying as
workspace-wide: they are `uefi-x64`'s.** The drops report and the
composed-root assertions have only ever run on that product, so **2980
carried, 703 left behind, 626 owned-and-unclaimed, 77 owned by nothing** are
one product's figures — scoped now in `build-harness.md`, `access.md` and the
producer-data task. Running the scan on all four turned up **eight names one
product had been hiding**, which is the rule in its own words: *a scan that
answers about one product answers about one product.*

**With a second instance of the `libstdbuf` blind spot**: `libpcsclite.so.1`
is a shim that `dlopen`s `libpcsclite_real.so.1` by name from the same
package, and it fell out for the same two reasons — `DT_NEEDED` does not name
it, ownership does not claim it. Same two proofs, same gap, different package.

## 2026-09-20 14:28 [finding]

**Two more instances of *identical wrong bytes are a pass*, recorded as
instances rather than as new rules — and together they give it a shape.**

The **healthy** arrangement (`mica-system-base`): 21 negative cases **built in
code** from one baseline builder, so minimality holds by construction, and the
aperture moves inside its own file — a wrong builder makes all 21 wrong
together. What closes it is that the same `assertBase` runs on the **real
bootstrapped root of both architectures** every CI run. Its line is the remedy
in one sentence: **one reader over two originals catches what five readers
over one original cannot.** The vectors here are the opposite arrangement —
one original, five readers — which is why six defects sat in them.

The **pathological** one (`mica-build`): a fixture seeds
`50-mica-getty.preset` into a synthetic healthy root while **three of four
real boards do not have that file**, to feed a suite deleted on 2026-09-09.
**A fixture is never compared to a root, so it can fabricate reality in the
one place where nothing can notice.**

**And one repair in the vector set changed what the fixture is about**, which
a diff will not show, so `release-lock.md` 9.3 says it: two of the three were
re-sorted, but `image-source-reference` needed its **defect moved rather than
its rows** — a valid source with a reference pointing at another repository,
so it tests `reference-repository` alone instead of behind `image-source`.

## 2026-09-20 14:26 [progress]

**Two of the seven unknowns were a misclassification, not a limit: 45
isolating, 6 pairs, 5 unknown.** `release-row` belongs with the structural
refusals — everything after it reads `rows[0]` as the release, so suppressing
it leaves no readable file, exactly like a bad header or a wrong column count.
Classified, the two vectors that had stopped early now report their single
rule cleanly.

The five that remain stop for the reason the mode exists to respect:
suppression walks into code the skipped check was protecting — a reference
whose registry is wrong, an index row source, a digestless reference, an
update kind. They are still reported as **unknown rather than clean**, which
is the property that made the first run trustworthy.

## 2026-09-20 14:25 [spec]

**The multiset argument is stated as its author states it — a theorem about
the format rather than a fact about one fixture**: *a refused vector whose row
multiset equals a valid vector's can only break an order rule, because every
other rule here is a predicate on a row or on a set of rows, and both are
invariant under permutation.* Decidable by inspection, with no checker run and
no repair declaration. **And its generalisation subsumes `reorder-of` instead
of sitting beside it**: name the set of rules the vector's difference from its
declared sibling can **reach**; a singleton is provably single-rule. Order-only
is the easy end, and the three `minimal-of` vectors are where it stops — they
differ by rows, so their reachable set is not a singleton by inspection.

**The two things a coverage number would misread as a gap are now recorded
together**, because they are one failure mode at two levels: **a refusal no
input can reach** (`mica-core`) and **a rule no fixture can isolate** (the six
inherent pairs). In both the number goes green **by damaging something** — a
deleted guard, or a fixture contorted until it tests less — which is why the
subtraction and the collect mode report rather than refuse. A reader who meets
one is handed the other.

**And the best argument for the whole mechanism is what it did the hour it was
specified** (`mica-core`): it wrote a new `vectors.pin`, pinned the commit,
read the vectors at it, and **the vectors told it the file was wrong** — same
hour, nobody reviewing. **A copy taken that morning would have said nothing,
because the family did not exist that morning.** The canonical set is **92
rows**, seven of them that family. And the floor derivation **grew a fourth
element without the rule changing**: a repository that pins the vectors
produces a `vectors.pin`, so the family is in its floor the moment it writes
the file — the rule was written before the family existed and covered it
anyway.

## 2026-09-20 14:22 [progress]

**The three repairable fixtures are repaired: the set is now 43 isolating, 6
inherent pairs, 7 unknown.** `image-source`, `image-source-reference` and
`repository-source` each broke `sort-order` as well, because the field their
defect changes is part of the sort key — which the defect never required. Each
is re-sorted, each still refuses the rule it names, and one needed its defect
moved rather than its rows: `image-source-reference` now carries a **valid**
source with a reference pointing at another repository, so it tests
`reference-repository` alone instead of testing it behind `image-source`.

**The six that remain are recorded as pairs with the reason each cannot be
separated** — a slash-form release is malformed *and* wrongly scoped by the
same token; a reference without a digest fails its form test too; a `release`
row in an upstream lock is a kind that file may not carry; an input row an
index lock may not hold is also an input no `index` row names. **Demanding
isolation here would push someone to contort a fixture until it tested less
than it does now.**

## 2026-09-20 14:19 [finding]

**The collect mode is built, and the audit has its answer: 40 of 56 refused
vectors isolate the rule they name, 9 do not, 7 are unknown.**
`release-lock-check.py collect lock|upstream <file>` re-runs the reader with
each found rule suppressed. It **under-reports by construction** — anything
other than a refusal stops the collection with `collect-stopped`, because a
mode that hunts extra rules must never invent one — and the default path is
untouched, which the 298 existing checks prove.

**The nine are not one finding, and the split decides what to do.** Three are
**consequential**: changing a field that is part of the sort key moves the row
out of order, so `sort-order` fires too, and re-sorting the fixture repairs it
because the named defect does not need the disorder. Six are **inherent
pairs** — a slash-form release is malformed *and* wrongly scoped by the same
token; a reference without a digest also fails its form test; a wrong-kind row
in an upstream lock is an unknown kind by definition. **No single fixture can
separate an inherent pair**, so the record is the pair rather than a repair:
the same shape as a refusal no input can reach, one level up — **not a defect
to fix, a fact about the rules**.

**And the seven that stopped early are reported as unknown rather than as
clean.** Suppression walked into code the skipped check was protecting, which
is exactly the case the mode was designed to refuse to guess about.

## 2026-09-20 14:16 [decision]

**The second half has a shape and this repository owns it**: an optional
**collect mode** in the reference reader plus a second column in
`expected.tsv`, proposed by `mica-system-base` and taken because it is **one
spec decision rather than five local ones**. The short-circuit stays the
default — `expected.tsv` names one rule per vector, so a reader returning a
set would stop answering the question the table asks, and **the first-rule
behaviour is the table's contract, not an implementation detail**. Its refusal
to build a second reader locally is the better half of the argument: **a
private copy of somebody else's truth** is what this section exists to remove.

**And the constraint that stops it manufacturing its own findings is specified
before it is written**: suppressing a rule to see what fires next is only safe
where the continuation is safe. A structural refusal — encoding, header,
column count, unknown kind — makes the rest unreadable, so the mode reports
**either a structural refusal alone or the set of semantic refusals**, never a
mixture.

**A category nobody expected makes *every rule has a vector* the wrong thing
to gate** (`mica-core`): **a refusal no input can reach.** Two of its 35
cannot be triggered at all — `serde_json::to_value` over string keys and
finite numbers cannot fail, and the strict base64 engine refuses a
noncanonical encoding before the re-encode comparison can disagree. Both are
kept, because **deleting either widens the check above it**. It is the inverse
of dead code: **not a gap and not waste, but the floor under the check above
it** — and a coverage rule treating it as either would push somebody to delete
a guard to make a number go green. The subtraction here reports; it does not
refuse.

**And the comment allowance outlived its own instance within the hour**, which
is recorded beside it: the pin that argued for comments deleted its comment
when the defect was repaired upstream. **A comment that outlives its defect is
the next stale comment**, so a comment naming a defect is removed in the
commit that moves the pin past it.

## 2026-09-20 14:14 [finding]

**The borrowed argument found the same defect in five more fixtures, and it is
now a gate.** Applying *the row multiset decides what can differ* across
`upstream/refused/` showed **five of the eight** were missing the same comment
line their sibling carries — an incidental difference present since they were
written, breaking no rule and breaking the argument. All five repaired, each
still refusing the rule it names, verified per vector rather than in bulk.

**A third relation carries the argument itself**: `reorder-of` — exactly the
sibling's rows in another order, so **order is the only rule that vector can
break**. Three vectors are these; 50 are `edit-of`; three are `minimal-of`.
The gate sorts both files to check it, and adds the assertion that would have
caught the original defect: **a vector naming `sort-order` whose rows differ
from its sibling is refused.** Both assertions were **proven against mutated
copies** before being trusted — mislabel a reorder and it fails on the line
bound; add a row to the `sort-order` vector and it fails on the rows. Gate
**298/298**, up from 280.

That is the audit's first real product beyond a list: a property borrowed from
another repository, applied here, six fixtures repaired, and the property
itself made checkable so the next one cannot arrive silently.

## 2026-09-20 14:10 [finding]

**A technique borrowed, applied, and it found something in the canonical
set.** `mica-system-base`'s argument — where a refused vector's **row multiset
equals its sibling's, order is the only rule it can break** — is about what
*cannot* differ rather than about what a re-parse returns, and it is the only
form that reaches the ambiguity question without a report-every-rule mode. Run
here: `lock/refused/unsorted.lock` and `lock/refused/release-not-first.lock`
are provably single-rule. `upstream/refused/unsorted.lock` was **not**, and
the reason was an incidental difference — it was missing a **comment line**
its sibling carries. Restored; its multiset now matches and it too can only be
refused for order.

**The pin rule is corrected to `mica-system-base`'s, which is better than the
one it replaces**: **do not pin a known defect *silently*.** Removing a pin
does not remove the artefact — the copy carries those bytes either way and
**unpinned it carries them unverifiably** — and moving a pin is a one-line
change. So the defect is named in the pin file above the keys, with the
mechanism a reader needs: **a pin is a statement about one commit and never
about the newest one**, so the gate will not notice the repair on its own. **A
named defect under a gate beats an unnamed one under nothing.**

**And the asymmetry nobody had explained is in beside the `bun` paragraph**:
the `arm64` row was never hit because **`aarch64` contains no `x64`
substring**. One sweep, one line caught, one missed, for a reason invisible
until stated.

**What `mica-system-base`'s 56-of-56 pass does and does not prove** is
recorded with the distinction rather than the headline: it proved **each
fixture is one hunk from a valid file**, not that each tests the rule it
names, since reverting one hunk returns the valid file and the re-parse cannot
fail. What it establishes is the **precondition** `derived-from.tsv` exists to
record — no incidental differences beyond the defect — so the declaration
records something true rather than aspirational. And the signal a harness
would automate is now stated correctly: **not *repair → valid*, but *a second
rule surviving the repair***, which `mica-core`'s two copies of one fixture
demonstrate without any re-parse.

## 2026-09-20 14:08 [finding]

**A line in these records was wrong and is corrected: the fix did not beat the
pinning.** *Fixed before any repository pinned the commit* has become **fixed
before any pin was correct** — `mica-system-base` (`62c1ab51`, 08:46) and
`mica-podman` (`5cb82ec1`, 08:48) pinned the pre-fix commit `735ebaa` two and
four minutes after the repair landed at 08:44, while the messages crossed.
Both had byte-compared against `735ebaa` while it was `HEAD`; pinning the
commit you have just verified is the natural move, and the timing was four
minutes rather than carelessness. A reader of the old line would have
concluded that no pin carries the artefact, and two do.

**The mechanism's first observed success and first observed failure fell in
the same hour.** Four days of drift went unnoticed because nothing named a
commit; two minutes of drift was visible immediately because something did,
and it was found by **reading two files** — a check that was impossible that
morning. `mica-system-base` went further: its pin's comment records the
defect, so the file says *why* it sits at that commit rather than only which.

**Which changed the format, measured against its first two real uses.**
`vectors.pin` said *exactly those two keys and nothing else*; the first pin
written carries a six-line comment doing exactly what a record should. So
**comment lines are now allowed after the header** — they carry nothing the
gate acts on, and forbidding them would have pushed that reasoning into
nowhere. A vector proves it and the gate is 280/280.

**Two format defects in those same files, for their owners rather than for
me**: `mica-podman`'s pin begins `# mica-vectors v1` and `mica-system-base`'s
begins with a comment rather than the header, so **both are refused by the
checker as specified** — the identifier is the first line, as in every other
format here.

## 2026-09-20 14:05 [spec]

**The cheap first part is done: every refused vector now declares the valid
one it is written against**, in `vectors/derived-from.tsv` (`release-lock.md`
9.3) — **not** as a fifth column in `expected.tsv`, which five repositories
parse and would have had to tolerate on the morning they were told to pin it.
The gate asserts that every refused lock vector has a row, that each sibling
exists and is itself a listed vector, that none is identical to its sibling,
and the `edit-of` line bound.

**And writing it down corrected this section's own claim.** It said *each a
minimal edit of a valid lock*; measured, **four of the 48 are not edits at
all** — `column-count`, `image-platform`, `package-without-pool` and
`unsorted` are independently written minimal locks of the same shape. They now
declare `minimal-of`, where the sibling names the **shape** rather than the
source text and no line bound applies; the other 44 declare `edit-of` with a
bound of two changed lines.

The pairing is **declared rather than derived** for the reason measured an
hour ago: deriving it by smallest diff matched a `mica-build-env` shape
against an offline `mica-core` lock. A fixture's intent lives only in whoever
wrote it, which is the same category as a provenance line and the same
argument for writing it down.

## 2026-09-20 14:01 [progress]

**The remaining half of the vector audit has a shape now, measured rather than
guessed.** *Repair the named defect and require the result to become valid*
cannot be derived from a diff, **because the repair is the diff**: revert it
and the valid file is back, which proves nothing. Of the 48 refused lock
vectors, 16 differ from a valid one by a single changed line and 28 by two, so
for most of the set the whole edit is the defect.

**And my first attempt at deriving the sibling was wrong in tonight's own
way**, caught before it was reported: nearest-by-line-diff matched
`image-platform.lock`, a `mica-build-env` shape, against
`offline-mica-core.lock`, and made `column-count.lock` look like a five-line
edit when it is one row short of a column. Those were the heuristic, not
drift. **A comparison whose key is wrong returns a tidy answer about nothing**
— which is the same rule that produced a uniform `ABSENT` this morning.

So the work is a fixture-format change rather than a script, and
`docs/task/20260920-0851-negative-vector-audit.md` says which: each refused
vector **declares the valid vector it was derived from**, and then either
declares its repair or the checker gains a mode reporting **every** rule a
file breaks. The second is the honest one and the larger — the checker
short-circuits by design, and a half-converted version would report rule pairs
that are artefacts of its own ordering, which is the false-alarm shape.

## 2026-09-20 08:51 [finding]

**The subtraction found a rule nothing tested, here, within minutes of being
proposed.** `mica-core`'s form — **the refusal rules the reader can produce,
minus the rules the fixtures name** — run against the canonical set:
`release-lock-check.py` can produce **40**, the vectors named **39**, and the
gap was **`fetch-required`**, the cache miss outside offline mode.
`repos/fetch-miss` now names it; the sets agree in both directions and the
gate is 182/182.

**And the reason that subtraction beats relabelling is `mica-core`'s finding,
not a preference**: a `float` generation is refused by *unknown, missing or
invalid fields* because `serde` rejects it before the integer bound is
consulted, **so the integer bound has no test** — and a relabelling done from
the source would have written *integer bound* beside it with complete
confidence, leaving the bound untested behind a fixture that appears to cover
it. **The real product of naming the rule is not better labels, it is the list
of rules nothing tests.**

So the sixth property's practice is now stated as **name the rule from a
measurement** — run the case, record what fired — with its two findings:
**ambiguity** (two rules could refuse it, and it tests neither) and
**mislabelling** (one rule fires and it is not the named one), the second
being the one that produces a coverage hole.

**And the aperture family reaches fixtures**: `wrong-board` sets the board and
leaves architecture, the kernel's board and the boot format alone, so the
architecture rule wins — **a fixture named for a rule it does not exercise**,
beside a suite named for a thing it does not do and a test named for a chain
it does not run. **The name keeps doing the work a measurement should have
done**, and every instance tonight was found by *running* the thing.

## 2026-09-20 08:49 [finding]

**"Checkable by inspection and by no gate" was wrong in the useful
direction, and the amendment is the point**: `mica-build` gave the property a
mechanical definition — **for each refused vector, repair the named defect and
require the result to become valid; anything that stays refused was testing
two rules at once.** *No gate can check this* is a permanent limit; *no
harness exists yet* is a piece of work, and **only one of those ever gets
built**. Recorded as the second, in `release-lock.md` 9.1, in the `Makefile`'s
property list and as `docs/task/20260920-0851-negative-vector-audit.md` — the audit is
one pass here rather than five elsewhere, because `mica-build`'s copy is
byte-identical to canonical after one rename, so a finding would be a finding
about the vectors.

**Two facts bound what the one known instance proves**, and both stay visible:
it was found **by accident** — blobs compared, not double faults hunted — so
nobody knows whether it is a one-off or a pattern in a set written over months
by people thinking about the positive case; and it is **local rather than
inherited**, since the same file is byte-identical to canonical in the
workspace's oldest copy. That oldest copy is also the only one the `bun`
artefact could not reach, the sweep having come after it — an accident rather
than a virtue, and the reason *everyone is behind* was never the right frame:
**being behind and being wrong are different axes.**

**And the `data` row's first release exists, verified here from the
artefacts**: `mica-system-base` `20260920-0832`, four assets, `SHA256SUMS`
listing **only the lock**, and two `unowned.<arch>.tsv` files whose `data` row
digests match the files as downloaded. Line 51 of the amd64 file is
`/etc/systemd/system/getty.target.wants/getty@tty1.service` with writer
`systemd.postrm` — **the row that settled the console question is now a
published artefact rather than a claim in a report.**

## 2026-09-20 08:43 [finding]

**The canonical vectors carried a rename artefact, and it is fixed before any
repository pins the commit.** The board sweep of 2026-09-16 (`91fce7c8`)
turned `x64` into `uefi-x64` inside a **third-party download URL**:
`bun-linux-uefi-x64.zip`, an asset that does not exist, in **ten files** —
`pins/valid/release/upstream.lock`, `upstream/valid/upstream.lock` and eight
`upstream/refused/*.lock` (the count is files, and it is ten rather than the
five first reported). Bun publishes `bun-linux-x64.zip`, which is what
`mica-build-env`'s real `locks/upstream.lock` names. Timing mattered more than
the typo: a pinned commit would have made it **permanent and uniform** rather
than merely present.

**The boundary it crossed is recorded where the vectors are described**: **a
vocabulary rename is a change to words this project owns, and a fixture
contains words it does not.** It survived four days structurally rather than
carelessly — **a vector's URL is inert by design**, nothing downloads it, so
no gate could notice, which is precisely why it lasted in the file every
repository is now told to trust.

**And a new property of negative fixtures, from `mica-core`: a refused vector
that could be refused by two rules tests neither.** Its copy of
`upstream/refused/other-kind.lock` carried `pool.amd64.x` where the canonical
one carries a valid release — the vector exists to prove an upstream lock is
refused **for carrying a `pool` row**, and that copy would also have been
refused for an invalid release value, so it could pass for the wrong reason.
Each refused vector must break **exactly the rule it names**; it is checkable
by inspection and by no gate, and it is now the sixth property beside the five
a new checker starts from.

## 2026-09-20 08:39 [spec]

**`vectors.pin` is specified and proven, because four repositories are writing
it tonight.** `release-lock.md` 9.2: a two-key file — `REPOSITORY=` and
`COMMIT=`, in that order, nothing else — with the full 40-hex commit because
**the file is read by a gate rather than by a person**. Refusals are `header`,
`encoding`, `pin-format` and `field-value`, and six vectors under
`vectors-pin/` exercise each; the gate is **180/180**, up from 168.

**The basename is uniform and the directory is not**, which is the point:
*finding each reader's copy* was named here as the hard part of ever gating
this, and a uniform basename makes it **one command per repository** instead
of a maintained list of paths. The obstacle that made the gate not worth
building is removed by a naming convention that costs nothing today.

**The provenance rule met its failure mode within the hour, in the repository
whose files are perfect.** `mica-system-base`'s 133 vector blobs were
byte-identical to this tree at `735ebaa` — compared blob sha by blob sha —
while its provenance comment named `19fbdce`, where the list had 69 rows.
**Current files, a stale line, and the line is the only thing anyone reads**:
the rule had acquired the defect it was written to cure, pointing the other
way. **A provenance comment nobody checks is not provenance.** The resolution
is the mechanism already adopted — a gate that reads the pin makes the line an
**input** rather than a **claim** — and a repository adopting the pin deletes
its comment in the same commit, because a provenance line beside a pin is a
second source of truth that will disagree within a month.

**And the derivation is a floor, not a ceiling** (`mica-system-base`): it pins
one unscoped producer, could skip every scoped, index, product, bundle and
asset vector, and runs them anyway — **a producer that conforms only to what
it consumes can emit a row nobody downstream accepts.** The rule reads *what
you pin, plus what you produce, plus the vectors that say what your own forms
may not be*, and that is the minimum. **A floor stated as a ceiling is how a
correct rule produces a worse tree.**

## 2026-09-20 08:32 [finding]

**A record that needs a command instead of an owner.** The table in
`release-lock.md` 9.1 has the defect it describes — nothing compares those
copies to the canonical one, so it will go stale the way its own numbers did —
and the resolution is the commit-naming rule doing a second job: **if every
copy names its source, the table can be regenerated rather than maintained,
and a regenerated table cannot be stale in the way a maintained one is.**

**And the required subset is derivable rather than arguable**: what a reader
can encounter follows from `locks/pins/` — a fact about a directory, not a
claim about a repository's habits. That relocates the difficulty of ever
gating this: the hard part is not deciding what each reader owes, it is
**finding each reader's copy**.

**Named at three instances, in `build-harness.md` section 4: a value that
cannot express *not measured* is indistinguishable from a measurement.** A
vector copy's size, where 64 rows is either a deliberate subset or last
month's copy; `podman stats` printing `0B` where nothing was measured, which
reads as *nothing is being used*; and `cpu` in `cgroup.controllers` while
`cpu.max` is absent, which reads as *a quota is in force*. The field has no
value meaning *unknown*, so it returns one that means something else, and the
two answers are the same bytes. The operational form: **ask what the field
says when the thing is not known — if that is the same as when it is zero, the
number is not evidence.**

## 2026-09-20 08:30 [finding]

**A conformance test that ships its own fixtures tests conformance to
itself.** *78 of 78* is a true statement about a set six vectors short, green
on every push, with the test name and the pass line both looking complete —
worse than a suite that proves nothing, because it **proves something real
about the wrong specification**.

**The counts are re-measured with the unit stated**, since two correct counts
of one file differed by one until someone said which: a `lines` count includes
the header comment, a `rows` count is the vectors. Canonical 85/84 with six
`data` vectors; `mica-system-base` 85/84 and **byte-identical to the canonical
file**; `mica-build` 79/78 and **exactly the six short**; `mica-boards` 65/64;
`mica-core` 52/51; `mica-podman` 49/48; `mica-res` none. So *three counts, no
two the same* is not today's picture — two are identical and one is precisely
six behind, which is a sharper fact than the spread was.

**And the answer adopted goes further than the one proposed here**: not *name
the commit you copied from* but **do not copy** — a consumer reads the vectors
out of `mica` at a pinned commit and refuses a difference, the mechanism
`deploy-pool.sh --check` already uses for `mica-core`'s contract fixtures and
the one that caught the board vocabulary this morning. **Being on a list that
is checked beats being on a list that is surveyed**, and it answers
*conforming* rather than *running*, which are not the same question: running a
stale copy looks identical from outside.

**The `data` row's own record now carries what its first release costs**: the
lock will be refused with `kind-unknown` by readers that have not implemented
it, the release goes anyway because **holding a correct release for a stale
consumer is backwards**, each consumer implements before its next re-pin, and
— the sentence that is the whole argument for pinning the vectors — **the
artefact a repository asked for cannot reach it through a lock until it
implements a row it did not know had been specified.**

**One more aperture instance, self-reported**: a 404 at a **guessed path** is
not evidence of absence. Four repositories were probed at `mica-build`'s
vector path and answered nothing, while `mica-system-base`'s reader and
vectors were elsewhere, in TypeScript — one keystroke from *only `mica-build`
has vectors*.

## 2026-09-20 08:27 [finding]

**Surveyed rather than guessed: five of six repositories carry a copy of the
vectors, and every copy is a different size.** Read from each tree on
2026-09-20, counting non-comment rows of `expected.tsv` — `mica` 84,
`mica-system-base` 84, `mica-build` 78, `mica-boards` 64, `mica-core` 51,
`mica-podman` 48, `mica-res` none. The answer to *who runs the vectors* was
neither "all of them" nor "two of six": **they all run a snapshot of them**,
and the mechanism that is supposed to make the copies agree is itself copied.
The table is in `release-lock.md` 9.1 with a home, so a seventh reader is a
row rather than another survey.

**The counter is written down as the rule rather than left as the reason
nobody wired them up**: a reader must pass every vector **for the forms it can
encounter**, and what it can encounter is decided by what it pins. A
repository pinning only unscoped producers never sees a `<scope>.<release>`
row — which is why `mica-system-base`'s reader sat on the retired separator
for four days and it cost nothing. Requiring it to conform to scoped rules
would be requiring conformance nobody needs.

**And the residual problem is a resolution one, one level up**: a subset and a
stale copy are **indistinguishable by size**. 64 rows may be a deliberate
subset or last month's copy, and the file does not say. So the spec now asks a
copy to **name the `mica` commit it was taken from**, the way the Chinese
coverage table names each page's source version — with that, *stale* becomes a
question anyone can answer and *subset* stops being a guess.

## 2026-09-20 08:23 [finding]

**A third axis for weighing a rule, recorded at its point of use rather than
in the question: did an instance cost the person who produced it?** The
withdrawn kernel generalisation made its author's own local builds look
authoritative — it **benefited** — and the withdrawal took that away, on its
own measurement, unprompted. Two instances arriving independently rule out
both having been matched to one template; **a withdrawal against interest
rules out something else: that the rule survived because nobody with a reason
to look hard had looked.** Added beside the withdrawal in `build-harness.md`,
which is where the instance already was.

**And one dated caveat where the mirror's numbers are cited**: as of
2026-09-20 the mirror's published index pointer is four days stale, pending an
`index` namespace being declared or its token granted that write, so a count
read off the site is not the count the bucket holds. The `coverage` command
announces that before every count it prints — the right behaviour for an
instrument that knows its own reading is behind, and the reason the figures in
`release-lock.md` 2.1 are cited from the command rather than from the site.

## 2026-09-20 08:20 [finding]

**The composer has two proof mechanisms and a third category neither covers**,
recorded where the composition rules are because it is their **boundary**
rather than a defect in them: ownership proves a path, `DT_NEEDED` keeps a
library, and **neither sees a runtime load by name**. Every `dlopen` family in
the root — NSS, PAM, the OpenSSL providers — is carried because somebody named
it in `consumers.json`, so that category is held together entirely by human
foresight, and the sweep measured how far foresight got: **eleven families
right, one missed.**

**The illustration is the purest form of tonight's shape**: `/usr/bin/stdbuf`
is carried and `/usr/libexec/coreutils/libstdbuf.so` is dropped, and since
`stdbuf`'s whole mechanism is to put that library in `LD_PRELOAD` and `exec`,
the command **runs, exits zero, and silently does not buffer**. A tool that is
present, executes, succeeds and does nothing — found by reading the shipped
binary's strings rather than a manual, which is the output and not the input.
A reader of `consumers.json` today would conclude ownership plus `DT_NEEDED`
is the whole model, and would be wrong in exactly the direction that produces
a silent no-op.

**And a method rule with its own failed attempt attached**: *test a proposed
check against the case that made you want it, before proposing it.* The first
draft enumerated carried binaries whose dynamic symbols include `dlopen` —
and `stdbuf` does not `dlopen` anything, so it would have produced a tidy list
**not containing the one defect anyone knew about**. That is the worst kind of
check: **one that looks complete and omits the instance that motivated it.**
The second keys on the name rather than the mechanism, because the mechanism
is what varies.

## 2026-09-20 08:16 [finding]

**A fourth kind of aperture: a resolution.** The three named so far — a
filter, a file, a name — are all about *where* someone looked. This one is
about *how finely*: `mica-boards` compared two arm64 kernels, one from a
native CI runner and one cross-built locally, and they are **exactly the same
size, 33 065 472 bytes, with 3.7 MB of differing content.** A size comparison
would have passed and recorded a no-op that was not one — neither truncated
nor misaimed, just too coarse to see what it was asked about.

**And the rule it corrects is narrower than the one that was adopted.** *The
same pinned toolchain image is necessary and not sufficient, and whether cross
and native agree is a property of the tree*: mainline agrees, the Amlogic
vendor tree does not, so it is measured **per tree** and **one board's
agreement licenses nothing about another**. The generalisation it replaces was
offered, adopted into a standing note the same hour, and **withdrawn within
the hour by its own author on its own measurement** — and it was too strong in
the direction that makes a **local build look authoritative**, which is the
dangerous direction for a claim about reproducibility to be wrong in.

**The shape of the withdrawal is worth more than the kernel**, so it is in
`doc-contract.md` and its Chinese page: **the threshold binds whoever adopts a
generalisation as much as whoever offers one.** It reads as a rule for
authors, and the failure it exists to prevent happens at **adoption**. This
one was caught only because its author kept measuring after being believed,
which no rule can require — **being believed is where measurement usually
stops** — so the question to ask of an arriving rule is the one you would ask
of your own: how many instances, and did any come from somewhere that could
have disagreed?

## 2026-09-20 08:09 [decision]

**A fifth property for a new checker, taken because the first four all guard
one direction.** Assert nothing until the set is non-empty, keep a positive
control, one refusal per clause with its own message, refuse rather than pass
when the subject is unreachable — every one of those guards against a **false
green**, which made the list read as a complete account of how a checker fails
when it was not. The fifth guards the other way: **the checker's own parsing
must not be able to misread a pass as a fail.**

Its instance is `mica-build`'s session probe, which read **four of its own
seven passes as red** because its verdict reader anchored at line start while
the probe shares a console with `systemd` and a getty — *the reading was more
fragile than the thing read*. That cost a boot, and it is the direction that
kills an instrument rather than hiding a defect: **a suite that fails on its
own formatting gets disabled, and the disabling is reasonable at the time.**

The list is a list of properties rather than a claim about the world, so the
three-instance threshold does not govern it: a property a checker should have
earns its place by being a property a checker should have. What it needed was
an instance to stop it being a preference, and it has one.

## 2026-09-20 08:09 [finding]

**The third acceptance clause is not unproven, it is FALSE as of 2026-09-20.**
B ran end to end for the first time and failed: the three producers build from
source in 589, 589 and 653 seconds — eleven minutes, the good news — and then
`tools/local-pins.sh` cannot pin what they built,
`FileNotFoundError: mica-boards/_out/boards/cx3576/outputs.tsv`. A **contract
mismatch**, not a bug in either tool: `local-pins.sh` expects the layout an
assembled, fetched bundle has; `mica-boards`' `make offline` produces
component trees with no `outputs.tsv`, because there it is a *source* file
travelling inside the board component. Both internally consistent, **the same
path describing different things, and nothing comparing them.**

**So the record carries a third state and the word matters.** *Pending* reads
as *it will close itself*; *open because* reads as *it works and lacks a
proof*; neither is true of a tool that cannot produce a product. **B is
answered and negative** — nobody records *the offline chain works* on any
reading today — and **A is unreachable rather than unverified**, since a
workspace cloned at the release commits fails at the same seam: the seam has
nothing to do with which commits the checkouts hold.

**And the part that belongs to these records: `make os-offline-chain-test`
runs on every push and passes, over a fixture workspace that does not reach
the seam.** A suite named after the offline chain was green while the offline
chain could not complete. In `mica-build`'s words, kept verbatim: **a test
over a fixture that does not reach the seam is the same shape as a gate that
never boots an image — it proves the parts and not the join, and the join is
where the defect lives.**

**Second instance of *a name is an aperture*, recorded beside the first**, and
the pair says what neither says alone: the FIT-lifecycle suite that boots
nothing and the offline-chain test that never runs the chain are **both suites
nobody had run to the end**. The name was not merely a bad aperture — **it is
what made running the thing feel unnecessary.** One was found by reading and
one by failing, which makes them a hypothesis and an observation rather than
two of a kind.

## 2026-09-20 08:06 [decision]

**A justification is removed and no check is** *(user, 2026-09-20)*:
*"不应该限制podman的权限…只是提示说明即可"*. The engine is rootful and rootless
is unsupported, so **a caller who can run `podman` is already root** and can
run `--privileged` or mount the graph root elsewhere. `nosuid` and `nodev`
constrain nobody who is not already constrained: they are a **default, not a
boundary**.

`docs/design/containers.md` says that where the graph root is described, with
the two failure modes the note exists to prevent: **nobody removes them as
useless**, because that changes what containers can do for no reason, and
**nobody tightens them believing they are a boundary** — the next reader will
either add `noexec` for consistency or strip the lot as theatre, and both are
wrong for the same reason.

**The checks stand and their reason changes.** They were never security
checks: if `noexec` were ever set on DATA on one board, containers there could
not execute out of the graph root and the bind could not remove it — a
container behaving differently on one board with an identical kernel
configuration. They prove **uniformity, not confinement**, which is the
functional half of *uniform behaviour unless the kernel cannot support it* —
and the check belongs on the booted guest, since only the guest has DATA's
options composed with the bind's.

**The sentence worth more than the ruling**, now in
`docs/design/access.md` section 2 where the accounts are described:
**`podman` access implies root implies SSH — there is no unprivileged-user
story on these devices.** That makes *rootless is not supported* coherent with
the access model rather than merely unimplemented, and it explains why the
operator account `mica` exists without being an access path. Three records
answered that by omission until now.

**And the shape is named at three instances** in `doc-contract.md` and its
Chinese page: when a mechanism looks like it serves a reason it does not
serve, write what it is for beside it — `nosuid,nodev` that looks like
hardening, a quiet `tty1` that looked like policy and was a dropped symlink, a
`lock` row that would have looked like pool coverage. **Say what it is, keep
what works, and stop anyone reasoning from the appearance.**

## 2026-09-20 08:03 [decision]

**The most reliable quality mechanism here is imitation, and imitation has no
quality filter** — so the file to copy is now named. The `Makefile` header
says a new checker starts from `tools/docs/verify-board.sh` and its test, and
names the four properties to carry rather than the shape: assert nothing until
the set is non-empty; keep a positive control, so a red case is known to be
the mutation and not the fixture; one refusal per enforcement clause, each
failing with its own message; and refuse rather than pass when the checker
cannot reach what it checks.

**Why naming it is the only action available.** Every checker here after the
first got its empty-set refusal by copying, not by anyone reading a rule —
that is how the standards travel, faster than they are written down. The other
half is the caution: had the first file in that position been sloppy — a
refusal suite with no valid case, an empty set passing green — the same
mechanism would have propagated it just as fast and just as invisibly, and
nobody could have pointed at a decision that caused it. *Choose good things to
copy* is not a rule anyone can follow; **naming which file to start from is**.

## 2026-09-20 08:02 [finding]

**Five layers of one distinction, written as a table rather than as a
slogan.** *Check the output, not the input* fits everything and tells nobody
what to do — the failure mode of a rule that fits everything, and the reason
this was worth hesitating over. What makes it usable is naming, per kind of
claim, which artefact is the input and which is the output, so
`build-harness.md` section 4 now carries the five with their pairs: a
composer's declarations against the composed root (no image had a console
login); a committed `kernel/config` against the configured kernel (`cx3576`
says `# CONFIG_LOGO is not set` and its hook turns it on); board overlay trees
against a non-`cx3576` composed root (four readings of trees before anyone
asked a root); the tree before a rebase against the tree that reaches
`origin`; and — the fifth, the same day as the fourth — an `fstab` entry
against the **effective** mount on a booted guest, since a bind cannot weaken
the underlying mount and only the guest has both sets composed.

**The table is the argument and the sentence is only its title.** That is the
whole of why it is written down now: not because the general form became
truer with a fifth instance, but because five instances in five repositories
make a pairing table that someone can actually apply, and each row names the
artefact to go and read.

## 2026-09-20 08:00 [finding]

**A self-retiring check needs its predicate to *be* the reason, not a proxy
for it** — recorded where the self-retiring form is defined, because the
approved lock-mirroring round is about to test it. `poolsCovered()` guards a
refusal because **nothing mirrors the pools**; the round adds a `lock` kind to
the same mirror, and if a `lock` row were allowed to satisfy that predicate
the refusal would vanish while the pools stayed unmirrored — **silently, and
without the user ever being asked to lift it.**

The sentence under it is what makes the earlier rule survivable: *a
constraint that verifies itself cannot decay* is true only while the
verification tracks the reason. **A check that can be satisfied by something
other than its reason is worse than a record, because it retires itself
confidently.**

Applied where the hold lives: a `lock` row must not satisfy the pools
predicate, so the mirror gaining a different kind of object leaves that
refusal standing.

## 2026-09-20 07:57 [finding]

**The migration task's third clause is open because the tool does one thing
and the clause says another** — not because a run is pending, and the records
now say which. `offline-chain.sh` builds each producer from its **checkout's
head**, not from the commit its release was cut at. Read back here: the
workspace's `mica-build` checkout is `e13b4f78` (2026-09-19 23:58:35Z) and the
PAM repair is `49913d78` (2026-09-20 05:50:01Z), so a product built from this
workspace today would be **missing the fix four releases shipped this
morning**.

Two readings, recorded as a table because they are not the same work: **A**,
the clause as written — an offline build *equals the published release*, which
needs a scratch workspace cloned at the four release commits and hours of
compilation, and which is **the central claim of the whole `locks/` design**;
and **B**, what runs today — the chain builds a product from source without
touching a release, proving the **mechanism** and not the equality. B is
reported as B, A is a round of its own after the 626-path triage, owner
`mica-build`. *Pending* was the wrong word: it reads like something that will
close itself.

**And this is the second instance of the category named at instance one this
morning**, written beside the first in `docs/world-claims.tsv`: claims the
records make about **themselves**, which nothing checks. The first was a
self-description gone **stale** — *`make docs-verify` is the one gate*, three
lines above two gate targets. This is the other half, an **absent** one:
`offline-chain.sh` does not say what it builds from, so a clause here came to
assert what the tool never did, and it survived six days because **nothing
compares a record's claim about a tool against the tool**. The rows in that
file are claims about another repository's *state*, which a query settles;
this is a claim about its *behaviour*, which one probably cannot — so the
category still has no gate, and now two instances in one day.

## 2026-09-20 07:55 [spec]

**The `data` row is approved and in the spec.** The user took proposal A
("按建议处理"), so `docs/design/release-lock.md` carries
`data <name> <file> <sha256>` in 1.2.4: any repository may publish producer
data as a release asset named by a row of its own lock, and **`SHA256SUMS`
still lists exactly one file, the lock** — the chain is the one
`mica-build`'s images already use, `SHA256SUMS` → lock → row → file, with the
exception list closed.

**The correction that made it a new kind rather than a wider one is kept
where the row is defined**, because the next reader will ask: `asset` is
product-shaped and tied to a `bundle` by `asset-without-bundle`, and widening
it would give one kind two column layouts, which `column-count` exists to
prevent. The bounds are there too — not a package, not anything a device
installs, **not a build input** (no repository's build may depend on
another's `data` file), not mutable — and what a consumer may assume about a
row it does not understand: the file exists at that digest, it is needed for
nothing, skipping it is safe. `kind-unknown` is unchanged, so readers and
writers move in one round.

**Proven, not asserted**: six vectors — one valid lock carrying two rows and
five refusals (`data-file`, `column-count`, `field-value`, `duplicate-key`,
`sort-order`) — take `make docs-verify` from 156 to **168/168**, with every
pre-existing vector unchanged, which is the check that this is a widening and
not a new format.

`mica-system-base` can wire its unowned-paths artefact into its next release.

## 2026-09-20 07:52 [decision]

**Three more user answers recorded, each where it changes something.**

**Container features — the rule is uniform behaviour.** *"需要加上完善容器的特性，
除非内核不支持，不然要统一行为"*: the gaps are **closed rather than declared** —
`MEMCG` on `uefi-x64`, `CFS_BANDWIDTH` on both UEFI boards, `IOSCHED_BFQ`
where missing — and that settles the ordering question the
feature-declaration task was holding: **the refusal goes in after the gaps
close, when it blocks nothing.** A gate turned on against a clean tree is a
gate nobody argues about; one turned on against a tree it fails is a
negotiation about exceptions, and the exceptions outlive the negotiation.

**Mirroring the locks — approved, and recorded as a scope amendment rather
than as a recommendation.** *"按你推荐处理，可以加"* reverses the 2026-09-16
scope **for locks only**: locks and `SHA256SUMS` move into the mirror, and
**the pools, the board components and the device update service do not**. The
price keeps its limit in the same paragraph — under 5 MB against 1.8 GB, 150
to 250 lines inside the existing `sync.yml`, and **the chain from the mirror
ends at the lock, whose `package` rows point into pools nothing mirrors: it
makes the binding survivable, not the packages.** The hold's condition is
unblocked in one direction only and still cannot collapse to one row.

**`uefi-arm64` gets a framebuffer back**, *"arm64也加回去framebuffer"* — and
`docs/design/access.md` is **not edited yet**, deliberately.
`docs/task/20260920-0752-uefi-arm64-framebuffer.md` carries the pending edit:
`mica-boards` is pricing display **and** input together, because a logo nobody
can type under is half a decision and the +6.8% was the display half alone.
When it lands the claim changes from *cannot, by construction* to *can, as of
`<release>`*, and the clean case — a capability absent and a declaration
absent, agreeing — is **marked as having been one rather than deleted**: it
stopped being an example because the capability came back, not because the
reasoning was wrong.

## 2026-09-20 07:52 [decision]

**Release deletion is answered, and the answer is usable because the question
was.** The user allowed it on 2026-09-20 — *"可以删除，现在还是开发阶段"* — for
two cases: a release whose assets are absent because its workflow failed, and
a release superseded by a later one of the same scope.
`docs/decisions/2026-09-20-development-phase-release-deletion.md` records that
with its authority and a sunset that is the development phase itself.

**Two exclusions are marked as what they are: coordination's narrowing of a
broad yes, flagged to the user rather than granted by them.** A release a
published index references — because `--full` verification of every index
naming it fails forever, and that is the case where two rules disagree and the
index rule wins. And any **`ghcr` package version**, a different blast radius:
`ghcr` holds the only copy of every pool and every board component, so
deletion there is unrecoverable and a pinned consumer breaks at once, as
`20260915-0030` and `20260914-1129` did.

**And the reason the exclusions are not arbitrary is in the decision**:
**there is no way to withdraw a recommendation except by superseding it**, so
deleting a defective release neither un-recommends it nor corrects what it
said — it only removes the evidence. Deletion is about tidiness and never
about correcting what a release recommends.

The question record stays, marked answered and still authorising nothing,
because its five scope questions are why a yes could be acted on: one that did
not distinguish them would have covered `ghcr` package versions in the same
breath as an empty failed release.

## 2026-09-20 07:25 [finding]

**The instruction I wrote in a message was contradicted by the tree, in the
line a tidier reads first.** The `Makefile` header said *`make docs-verify` is
the one gate* three lines above two gate targets — true when it was written,
and by this morning the sentence that would have justified deleting the
second. It now says there are two gates and why: one **offline and hermetic**,
which `record.sh` runs and which must never depend on the network, and one
that **reaches other repositories**, holds standing claims only and is its own
CI job.

**And one word where it will be misread**: `docs-verify-test` runs
`verify-world-test.sh`, which is correct — that test drives the checker
through its injectable reader and touches no network — but *world* inside the
offline target looks like a violation of the rule three lines above it. The
header says so, because **a name that looks like a violation of a rule you
just wrote will be read as one.**

**A category named at its first instance and left ungated on purpose**: the
world gate holds claims about *other* repositories by construction, so a claim
the records make about **themselves** is outside it and checked by nothing
either. That is what this was. The note sits in `docs/world-claims.tsv` beside
the completeness limit, and is the whole of the category's defence — the same
honest shape as saying that adding a row is a habit rather than a gate.

## 2026-09-20 07:23 [finding]

**Named at its third instance, beside the noise floor: testing instead of
asserting protects you from the wrong story, not from the wrong cause.** A
comparison whose two cases differ in *two* things attributes the effect to
whichever one the comparer had in mind, and because a run was performed it
feels measured. The three, each paid for: the `-C metadata` diff, where code
and disambiguator both moved and the result was read as codegen; *emulation
changes bytes*, where host and toolchain both moved and the cause was
cross-compilation; and the self-edit experiment of 2026-09-20, where one case
was late and length-preserving and the other early and length-changing, and
the report named length — separating them showed the cause is **how far the
bytes before the interpreter's position moved**.

The remedy is the control build's rule one level up: **move one variable, or
name every variable that moved and refuse the attribution.** A second case
that differs in two ways is not a control, however carefully the first was
run.

This one is worth having because every instance passed the bar that usually
catches this — somebody did run the test. What it did not do is vary one
thing.

## 2026-09-20 07:21 [decision]

**A better reason to keep a pair than the count**, in `doc-contract.md`
section 6 and its Chinese page: **the strongest pair is one instance
hypothesised and one observed.** A rule designed in guards against a failure
someone imagined; a rule extracted from a failure that happened establishes
that anyone would ever have hit it. Keeping dated measurements out of the
world gate is the first kind — nobody knows whether anyone would have added
one — and `mica-res` reaching the same rule after two false alarms in an hour
is the second. Where a pair has both, the record says which is which: **the
hypothesis explains, the observation proves.**

**And one line of provenance in `build-harness.md`**, because it is how most
of what this workspace knows actually travels: `verify-world.sh` has its
empty-set refusal because `verify-board.sh` already had one and the habit was
copied, before either had a name. An origin that says *I copied this* is rarer
in a record than one that says *I realised this*, and more useful, because it
names the mechanism by which a rule spreads before anybody writes it down.

## 2026-09-20 07:19 [finding]

**The self-edit hazard is not loud, and "loud when the length changes" is not
the rule either — measured rather than reasoned.** A 78 KB script rewritten
one second into its own `sleep`, three ways:

- same inode, **large early insertion** → **loud**: the interpreter resumes
  inside a line and runs garbage (`ed: applet not found`). This is the case
  that was hit while editing `record.sh`'s own comment.
- same inode, **small late change** → **silent**: the running script executes
  the **new** text and exits 0 — and this held whether the replacement
  preserved the length or changed it, which is where the framing offered to
  this repository was wrong.
- **rename-based** edit (`sed -i`) → the running script keeps the old inode
  and never sees the change at all.

So the hazard is not the length; it is **how far the bytes before the
interpreter's position moved**. The note in `record.sh` now says that, with
the measurements, because the silent case is the dangerous one: nothing dies,
and the commit and the push are then performed by a script that is part old
and part new. *Nothing was committed because the sequence dies before the
commit exists* is true of the loud case only.

The thing worth keeping from the exchange: a framing was about to be asserted,
the test disproved it, and what went in was the measurement. Three behaviours
beat one rule, and a note recording *it failed loudly once* would have taught
that the hazard announces itself.

## 2026-09-20 07:16 [finding]

**No silent pass is named at its third instance**, in `build-harness.md`
section 4 beside the other rules about gates: *a check that cannot reach its
subject, or that has nothing to check, must refuse.* The three arrived three
different ways, which is the part worth keeping — `verify-board.sh` was
designed with it (*a check over an empty set reports green without having
checked anything*), `verify-world.sh` reasoned it from the aperture rule (no
reader and no claims exit 2), and `mica-res` found it **by testing the gate
rather than by thinking about it**: its guard reported *nothing to check*
while a candidate stood in front of it, and *arguments given and none parsed*
is now a refusal.

The third route is the lesson. A silent pass is invisible from outside by
construction, so a gate's own tests are the only place it can be caught — and
only if they include the case where the gate has nothing to work with.

**And the second independently-arrived pair of the evening is recorded where
the first is**: *an alarm that cries wolf destroys the instrument more quietly
than one that never fires* (`mica-res`, after two false alarms in an hour;
after a third nobody would have read the number again) is the same principle
as keeping dated measurements out of the world gate, reached from the opposite
direction — by consequence rather than by design. Its comparison is the half
this repository did not have: **a gate that never fires gets noticed
eventually; one that fires constantly gets ignored without anyone deciding
to.**

**Two is still two**, so both stay where they were written. The trigger is now
in `doc-contract.md` instead of in anyone's head: if a third such pair
appears, the fact worth recording is not any of the ideas — it is that this
workspace is producing **convergence rather than correction**, and that claim
gets its own record.

## 2026-09-20 07:14 [finding]

**Why `record.sh` gates after the rebase is now written in `record.sh`**, in
its header and beside the push itself, because *gate, then push* is the
simplification someone will make on a quiet afternoon and it would look like
tidying. **A gate run before a rebase validates a tree that is not the tree
you push**: the rebase replays the commit onto another session's, and the
result is a tree nothing has checked.

It is the same shape as every defect these records carry — a declaration
proved against an **input** while nothing compares it to the **output**:
paths in a composer, a committed kernel config against the shipped one, four
readings of a tree before anyone read a root. This is the one place where the
tooling already had it right before anyone had a name for the mistake, and the
note exists so the next reader does not remove the second gate as redundant.

Twice tonight a push collided with another session's, and both were harmless
for that reason. The fact about the workspace worth keeping with it: `mica`
has more than one writer at this hour, and what made the collisions safe was a
gate that **distrusts its own earlier result once the tree moves underneath
it.**

## 2026-09-20 07:11 [decision]

**Why the threshold exists is now written beside the threshold**, in
`docs/user/doc-contract.md` section 6 and its Chinese page, because that is
what decides when it could ever move: it guards against **a reader inventing a
pattern**. Two instances one reader finds while looking are two instances and
one reader; two reached **independently**, by repositories that never saw each
other's messages, cannot have been matched to the same template — so the
manner of arrival supplies the guard the third instance would have given.

**The bar does not move and nothing here was written on two.** The note exists
so that whoever meets the case recognises it instead of arguing the count, and
it names the single distinction on which the bar could ever move rather than
leaving that to be rediscovered as a dispute.

The instance that prompted it is worth its line: *a board overlay re-enabling
`tty1` would be a board repairing a composer* and *a detector belongs in the
CI of the repository whose files it guards* are one principle — **the fix
belongs where the thing being fixed lives** — reached in two repositories
within an hour, neither having seen the other. It is the first time today two
repositories arrived at the same idea rather than one correcting another.
## 2026-09-20 07:09 [progress]

**The hardware list is published, in both locales** (task
`20260920-0700-hardware-pages-in-english`). `docs/zh/hardware/` existed and
`/docs/hardware/` was a 404, because the site could not name it: every
allowlist entry resolved through `userDoc(name)` to `user/<name>.md`, so
`docs/user/` was the only tree that could ever be published.

**`docs/hardware/` now carries the English originals** — the board list and one
page per board — and joins the gates as a published tree does: catalog
membership in `docs/README.md`, truth-status lines under `verify-status.sh`,
and a row per page in the en/zh coverage table. The Chinese pages took the same
status lines in the same order, which is what the coverage gate compares.
`doc-contract.md` section 5 now names both authoritative trees.

**The allowlist entry gained a shape instead of a convention.** An entry may
name `dir` (default `user`) and `slug` (default `<dir>/<name>`), so
`hardware/README.md` publishes at `/docs/hardware/` rather than at a
`/README/` path, and `published.ts` resolves `<dir>/<name>.md` and
`zh/<dir>/<name>.md` rather than hardcoding one tree. The test that keeps
`design/`, `boards/`, `task/`, `plan/` and `research/` off the site is
unchanged and is what holds the line now that the shape is general.

Two gate self-tests had to learn the new tree: the index fixture copies
`docs/hardware/`, and the status fixture gained a hardware page with its own
evidence file — sharing one artefact would have reported a single deletion
twice and broken the case that counts findings.

`make docs-verify`, `make docs-verify-test`, and the website's lint, typecheck,
test and build all pass; the build emits the five pages under `/docs/hardware/`
and `/en/docs/hardware/`.

## 2026-09-20 07:07 [finding]

**The world gate's own limit is now written in the gate**, in
`docs/world-claims.tsv` where someone adding a row will read it and in the
checker's header: **the claims file's completeness is unchecked.** Six rows
are compared against the world; nothing compares the records against the file,
so a seventh standing claim written into a page tomorrow is stale-able and
invisible — the same shape as a declaration nobody compares to the thing it
declares, one level up, in my own tree.

**It is classified rather than hedged.** *This sentence is a standing claim
about another repository* is not detectable in prose, so the reason is not
computable and the violation is not reliably detectable either; by the three
forms written this morning that is the third row, **the record alone**, and
the comment in the claims file is that record. Adding a row is a **habit, not
a gate**, and a standing claim left outside the file will be found the way the
two of 2026-09-20 were: incidentally.

Stating it costs nothing and buys the only thing available here — a reader who
knows what the green tick covers. A gate whose limit is written where its
users are is a gate that is not mistaken for more than it is.

## 2026-09-20 07:05 [decision]

**A third form, taken because the two-row version could be read as *no check
is possible here*** — which for the device-capture practice would be wrong.
`2026-09-20-coordination-state-is-a-record.md` now splits the cases three
ways: the reason computable gives a **self-retiring check**
(`poolsCovered()`); the reason not computable but a **violation** detectable
gives a **detector** — a committed capture carrying an SoC serial is a pattern
a CI job can find, while *this publishes a device identity for the life of the
board* is a judgement no job can evaluate; and neither gives the record, and
only the record.

The sentence that makes the middle row useful rather than a hedge: **a check
that cannot compute its own reason cannot retire itself**, so it must carry a
record to be read when someone asks why it is refusing. *The check stops the
accident; the record stops the argument.* A detector belongs in the CI of the
repository whose files it guards, which is its owner's to add.

## 2026-09-20 07:03 [progress]

**"Found on the way to something else" was a description of the tooling, not a
property of stale records — so the tooling changed.**
`tools/docs/verify-world.sh` reads the claims these records make about
*another repository's standing state* and checks each against that repository:
six to start with, the four `BOARD_RELEASE_TARGET` rows behind
`support-tiers.md`, the index tag form behind `release-artifacts.md` (read
across **both** separators, so a slash-form index reappearing would be seen),
and the `logind` drop-in behind the `access.md` claim that the logo policy is
`cx3576`'s. Both of this morning's stale claims would have been caught by it.

**It is deliberately not part of `make docs-verify`.** That gate is offline,
file-only and deterministic, and a records change must not be blocked by
GitHub being slow or by another repository being mid-edit. `docs-verify-world`
is its own `make` target and its own CI job, red when a claim drifts.

**Only standing claims go in `docs/world-claims.tsv`**, and the file says why:
a dated measurement is true of a moment, and re-checking *427 snapshots on
2026-09-20* against today would turn a record into a false alarm every
morning. The distinction is the whole difference between a check that stays
useful and one that gets muted.

**No silent pass, and the tests need no network.** Without a reader it exits 2
and says it could not reach its subject, because a check that cannot reach the
world must not look like one that found nothing wrong; an empty claims file is
refused for the same reason. The reader is injectable, so
`verify-world-test.sh` drives nine refusals against a stub — including the one
that matters most, *a claim the world no longer holds is refused*.

## 2026-09-20 06:59 [finding]

**Corrected before it set: the unmirrored pools are a decision's consequence,
not a defect, and the table is eight rows.** The accepted scope of 2026-09-16
lists our package pools, `mica-boards` board components, release locks and
`SHA256SUMS` as *"out of scope and not to be re-added"*, so *nobody had a
reason to look* was wrong about the cause and is gone from
`release-lock.md` 2.1. The table is now transcribed **verbatim** from
`mica-res`'s record, because every count in it is a query result and a
re-worded query result is a sentence. The eighth row — `mica-boards` board
components, `ghcr` holding the only copy of every kernel, U-Boot and board
package — was added by the repository unasked, and its reason is the one to
keep: **seven rows would have left it out by accident, which is how the pools
stayed unnoticed.**

**The finding is a missing consequence, not a missing mirror.** The scope said
what would not be mirrored; nobody wrote down that this means `ghcr` holds the
only copy of every Debian package this workspace publishes. That implication
is now a query (`cli.ts coverage`) rather than something each reader has to
derive. And the policy constraint cuts both ways, which is why it is stated as
one: the three `NOTHING` rows may not be treated as *protected*, and may not
be quietly reversed either — **both moves are the user's.**

**Recommendation withdrawn and re-recorded as a scope change.** Mirroring the
locks was recommended here without knowing a user decision said not to. It is
priced — under 5 MB against 1.8 GB held, 150 to 250 lines with tests inside
the existing `sync.yml`, no new workflow or credential — and its limit travels
attached to it: the chain from the mirror would end at the lock, whose
`package` rows point into pools nothing mirrors. **It makes the binding
survivable, not the packages.**

**And the better answer to tonight's rule is recorded beside it**, in
`2026-09-20-coordination-state-is-a-record.md`: `coverage` computes
`poolsCovered()`, false today, so a retention proposal naming a `pool.*`
package can be refused mechanically and the refusal disappears by itself when
something mirrors the pools. **A constraint that verifies itself cannot decay,
and it retires itself when its reason ends.** With the limit of that answer
stated too — it needs the constraint's reason to be computable from the world
rather than from intent, which is rarer than it looks.

## 2026-09-20 06:56 [finding]

**The `latest` marker is a recommendation, and it is accepted as the second
instance — recorded at its point of use, not promoted to a rule.** It says
*take this one* to anything that resolves a release without naming one, so it
carries the same dependency on later findings that a sentence in
`download.md` does. Two things make it worse than the prose version rather
than better: it is in the mechanism, so no review reads it and no CI job
asserts it, and it moves automatically after every scoped release, so no
person revisits it. If an index were found defective after being marked
latest, the marker would keep recommending it.

Written into `docs/design/mica-index.md` beside the no-deletion rule, with the
remedy that follows from that rule instead of fighting it: **cut the corrected
index and let the marker move**, never delete the defective one — and the
consequence worth stating, that the marker cannot un-recommend anything until
a successor exists, which is why a corrected index is cut promptly rather than
when convenient.

The shape is the same and the medium is not, which is the only reason it was
worth thinking about: *a marker, not a sentence* would have been a fair
refusal. What decided it is that the difference cuts the wrong way — being
mechanical removes the review the prose version at least could have had. Two
instances, so it stays at its point of use; the rule about recommendations is
still unwritten as a rule.

**Two stale claims fixed in `docs/design/release-artifacts.md`** while reading
it for the marker: it still said `s905x5m` is not a release target, and still
gave the index tag in the slash form. Both are now current, with the dot
cut-over cited.

## 2026-09-20 06:53 [finding]

**The hold covers seven kinds of artefact and two of them are covered by
nothing.** Measured by `mica-res` against the mirror's own catalogue
(2026-09-20, run `35495033872`) and recorded in `release-lock.md` 2.1 as a
table rather than as the two-instrument sketch it replaces: run and job
metadata by the collector's snapshots (427 over five days, holes zero),
build-env images and product images and third-party inputs by the mirror, and
**nothing at all** for workflow logs and artifacts, or for the OCI pools that
carry every Debian package this workspace publishes.

Three of those are new findings. **The pools are mirrored nowhere** — no
`package` and no `pool` row has ever existed in the mirror's catalogue, so
nothing regressed; the gap was never looked at until a retention condition
depended on it. **The snapshots are metadata, not an archive** — deleting a
run still destroys its log bytes, and a policy that permits deleting runs is
permitting that loss rather than being covered by the word *protected*. **The
binding is not in the bucket** — zero locks and zero `SHA256SUMS`, while for
every producer except `mica-build` a release's only unique bytes are the lock.

**And the trap is written where it will be walked into**: the 324 `deb`
objects read exactly like package coverage and are not — every one is upstream
Debian from `snapshot.debian.org`. Counting them as *our packages are
mirrored* is the same substitution as counting run snapshots as image history,
one level down: a number that looks like the answer, sitting where the answer
would be. The question to ask of such a number is which **artefact** it
counts.

**The corrected end condition is still not written**, now for two reasons: the
division is the measuring repository's to confirm, and restating it as *the
mirror holds the packages* would repeat the error one level down, since that
is satisfied by an instrument covering one `ghcr` package out of many. **The
condition that is true of the world is per artefact.** The fork is the user's,
and the recommendation put to them is recorded with it.

**The early-warning number is in and the bound originally asked for was the
wrong one.** Not GitHub's retention: the collector reads one page of 100 runs
per repository without pagination and backfills from its own artifacts, so a
run that falls past position 100 before any pass sees it is unreachable by
both paths. The margins are `mica` 48.3 h, `mica-res` 58.3 h and about 102 h
for the other six, against a collector firing every two to five hours — and a
negative margin prints `UNREACHABLE`. Its property is the part worth keeping:
**a number that goes negative before anything is lost is worth more than an
alarm that fires after.**

## 2026-09-20 06:51 [finding]

**The logo VT policy is capability-shared, not board-shared**, and the page
says why rather than only what. The logo `50-mica-console.conf` protects is
the **kernel's**: `cx3576`'s `kernel/hooks/configure.sh` enables `LOGO` and
`LOGO_LINUX_CLUT224`, `prepare.sh` renders `flash/assets/splash.png` into the
kernel tree at build time through `common/kernel/mklogo.py`, and the forced
command line places it with `fbcon=logo-pos:center,logo-count:1`. No other
board does any of it — checked at `main`: `uefi-x64` and `s905x5m` say
`# CONFIG_LOGO is not set`, `uefi-arm64` does not mention it, having no
framebuffer. **So the drop-in's comment describes a state, not a preference,
and the rule it encodes is conditional: a board that draws a boot logo keeps
the logo VT idle.**

*With an aperture note that cost me a minute and would have cost a reader
more:* `cx3576`'s **committed** kernel config also says
`# CONFIG_LOGO is not set`. The hook turns it on during configure, so grepping
the config file answers the opposite of the truth. The file is not the
pipeline.

**The consequence a reader needs is now in the page**: on three of four boards
`tty1` shows kernel messages and then nothing — no logo, no prompt, a dead VT.
That is what a person with a monitor meets on a generic board today, and it is
the second confirmed instance of the composition defect rather than a design.

**And the repair's ownership, in the sentence that decided it**: `mica-boards`
could have closed its own question with three board overlays and refused,
because **a board overlay re-enabling `tty1` would be a board repairing a
composer — the wrong repository holding the fix**. The Base half is in
`assertBase`; the product half is `mica-build`'s.

**Pure preservation**, in `docs/design/display.md` section 5: giving another
board a logo is four things **in order** — `CONFIG_LOGO` in the kernel
configure hook, the `mklogo.py` hook, `fbcon=logo-pos:` in the forced command
line, and only then the drop-in. Out of order, the last step alone gives an
idle VT protecting nothing. Nobody is doing this yet, which is exactly when
the order is cheapest to write down.

**Flagged, not counted**, in the feature-declaration task: `mica-boards` used
the capability idea in the opposite direction — not *does this board provide
X* but *should this board carry policy P*, with `P` conditioned on the same
`X` — and drew from it that **a policy selected by its own precondition cannot
outlive it**. It is not folded into *a capability row is a necessary
condition, not a proof of function*, because it is a different claim. If the
capability table is becoming a language for conditioning policy and not only
for checking provision, that is bigger than the table was proposed as, and the
time to notice is while it is one file.

## 2026-09-20 06:48 [progress]

**The user pages now point at `20260920-0622`**, in `docs/user/download.md`,
`docs/user/flashing.md` and their Chinese pages, with both repairs named and
neither dropped: `20260919-2356` fixed the board name that made images power
down at PID 1, and `20260920-0622` fixed the console login that no image
before it had. Someone taking the round we recommended an hour ago would have
had a bootable image nobody could log into.

**One line beside the gate-reports rule**: while a gate reports without
refusing, say what it is — **a report is a necessary condition, not a proof**.
The drops gate tells you what the composition left behind and proves nothing
about whether the root is right.

**And an instance deliberately not counted**, recorded where it would have
been counted: that drops gate is a candidate second instance for *a capability
row is a necessary condition, not a proof of function*, and it is not one — it
belongs to the gate-reports rule, where the sentence above now sits. Counting
it in both places is the failure mode recorded next door in
`doc-contract.md`: an instance spent twice inflates both classes. The
capability-row sentence still has one instance and stays at its point of use.

## 2026-09-20 06:45 [progress]

**The console-login gap is closed and the sentence is replaced rather than
deleted.** `uefi-x64`, `uefi-arm64`, `cx3576` and `s905x5m` `20260920-0622`,
index `mica.20260920-0636`, from `73aca2c`, read back from the releases: those
composed roots carry sixteen files in `/etc/pam.d`, `login` and all four
`common-*` among them, every include resolving. `docs/design/access.md` now
says what the gap was, when it closed and which release closed it, with the
mechanism worth keeping — the failure was the **stack, not the account**:
`agetty` runs `/usr/bin/login`, PAM finds no `login` service, falls back to
`other`, and `other` includes the four `common-*` that were missing. SSH was
unaffected because `dropbear` authenticates against `/etc/shadow` without PAM,
which is why the gap survived three days of use. `/etc/subuid` and
`/etc/subgid` are deliberately still absent from a product root: carrying
inert files to close a gap is not a fix.

**The VT question re-opens as one board's policy and three boards' accident.**
`mica-system-base` measured that the base root ships `tty1` enabled — the
symlink is written by `systemd`'s postinst and is line 51 of its own unowned
artefact, writer `systemd.postrm` — so a product root loses it by exactly the
mechanism that lost the `pam.d` files. What the loss *agrees with* decides
whether it was meant: on `cx3576` it agrees with a board overlay
(`NAutoVTs=0`, `ReserveVT=2`), so `tty1` is the logo by intent; on `uefi-x64`,
`uefi-arm64` and `s905x5m` it agrees with **nothing**, so those three have no
`tty1` console by accident and whatever `tty2` does there is `logind`'s
default. That is a second confirmed instance of the composition defect, and
the page says so instead of reading as a settled design. `mica-build` has the
falsifiable prediction: on `uefi-x64`, Alt+F2 through F6 answer and `tty1`
does not, with no policy behind the absence.

**And the half that belongs to `mica-system-base`**, which is the shape of
every fix that worked here: `assertBase` now refuses a base root without that
link — *a base root has a login console on `tty1`, and a product that wants
none says so itself.* Before it, a product that wanted a console had to
discover it had lost one; after it, a product that wants a logo VT has to
state so.

## 2026-09-20 06:43 [finding]

**The retention hold's end condition measures one instrument while the hold
covers two artefacts**, so the pause record now says the hold cannot end on
the snapshots alone. The collector snapshots Actions runs and jobs and **not**
`ghcr` package versions (`mica-res`, 2026-09-20), which `release-lock.md` 2.1
already said from the other direction: what protects an image version is the
mirror holding its bytes under a content-addressed key with the index naming
it. A retention discussion reading *the snapshots are in the bucket* as cover
for pruning `ghcr` packages would end the hold on half an argument. The
corrected two-instrument condition is **deliberately not written yet** — it is
being confirmed by the repository that measured it rather than restated from
an account of it — and the paragraph exists so nothing ends the hold in the
meantime.

**A cadence corrected where it is described**: the collector's `*/30` schedule
fires every **two to five hours**, not every thirty minutes, because GitHub
deprioritises scheduled runs. `docs/design/mica-index.md` said thirty minutes
on the strength of the crontab. **A schedule is a request, not a fact**, and
the line is there for the next person who reads the crontab and takes it for a
measurement.

**The sixth aperture instance gets `mica-boards`' formulation, which is a
procedure where the earlier one was a warning**: *a uniform answer from a
query that names something is the shape to re-ask with a looser key, because a
wrong key returns exactly that.* It also disowned the trigger it had actually
used — the uniform `ABSENT` looked *too tidy* — because "too tidy" is a weak
signal to depend on, and **uniformity is the checkable version of that
instinct**. Attributed to the repository that found it.

**And one sentence placed at its point of use rather than promoted**, in
`docs/task/20260920-0627-feature-declaration-promises.md`: *a capability row
is a necessary condition, not a proof of function*, `uefi-x64` as the worked
example, written by `mica-boards` into its own mechanism before anyone could
hit it — *if that sentence is not in the mechanism from the start, the first
surprise will be read as the check lying.* One instance, so it stays where it
applies.

## 2026-09-20 06:40 [finding]

**The VT question closed within the hour, and not by a decision: by a policy
that was in the tree all along.** `logind.conf.d/50-mica-console.conf` sets
`NAutoVTs=0` and `ReserveVT=2` with the comment *keep the logo VT idle; only
tty2 receives an on-demand login console*. `autovt@.service` — still a symlink
to `getty@.service` — `getty@.service`, `serial-getty@.service`,
`getty.target`, `logind` and its D-Bus files all survived composition; the
`cx3576` renders a VT on HDMI at 1920x1080p60 with a USB HID keyboard; and the
user confirmed it on the device, Alt+F2 a console and F1 the logo.
`docs/design/access.md` now records the answer and drops the outcome table,
which had done its job.

**One correction, found by looking for the file before citing it**: the
drop-in is **not** shipped by `mica-system`. It is
`mica-boards:boards/cx3576/package/overlay/etc/systemd/logind.conf.d/50-mica-console.conf`,
and no other board carries one — measured by reading the `main` trees of
`mica-boards`, `mica-build`, `mica-core` and `mica-system-base` for any
`logind.conf.d` entry. So the `tty1`-logo/`tty2`-console split is `cx3576`'s
board policy rather than a system-wide one, and on a board without the
drop-in `logind`'s own default applies. The record cites the file rather than
anyone's account of it.

Two boards stay outside the answer and both are in the page: `uefi-arm64`
**cannot** render a VT by construction and declares no `display` feature — a
capability absent and a declaration absent, agreeing, the one place in this
investigation where the two sides matched without anyone checking — and
`uefi-x64` is open, because `FB_EFI` and `FRAMEBUFFER_CONSOLE` are set while
`DRM_FBDEV_EMULATION` is not with `i915` and `virtio-gpu` built in. A QEMU
session answers the `virtio-gpu` half only, and **a QEMU pass does not stand
for real Intel hardware**.

**A sixth instance for the aperture rule, in a variant none of the five had: a
wrong key is an aperture of zero.** A symbol carried from memory,
`CONFIG_BLK_DEV_BFQ`, grepped exactly, returned absent on all four boards —
nothing truncated, nothing filtered, and the answer still a property of the
query. The symbol is `CONFIG_IOSCHED_BFQ` and the real split is `uefi-x64` no,
`uefi-arm64` yes, `cx3576` no, `s905x5m` yes. It is the most dangerous variant
because **a uniform answer reads as a finding rather than as an error**, and
it was caught by distrusting the key — a case-insensitive `grep` for `bfq` —
rather than the result.

## 2026-09-20 06:33 [decision]

**The VT question is placed as a question with a pending measurement**, in
`docs/design/access.md` section 2 beside the console-login sentence, where
someone asking what local access a product has will meet it: is there a local
virtual-terminal login on a board with a display and a keyboard, or is the
serial console the only local console? Recorded with the correction rather
than the first version of the claim — *a board with a display has no VT login*
overstated what had been looked at, because the dropped symlink governs `tty1`
at boot while Alt+F2 goes through `logind` activating `autovt@ttyN.service`,
a different mechanism. A table says what each outcome turns the question into:
a real product question only if the units survived composition **and** the
board's kernel can render a VT; no decision at all if `autovt` survived, since
then the only thing ever wrong with it was PAM; and part of the repair, not a
decision, if `autovt` was dropped too.

**And the rule those five instances earned**,
`docs/decisions/2026-09-20-coordination-state-is-a-record.md`: **a
coordinator's working state is a record nobody else can read**, and the role
produces them faster than any single one gets written. The five are named —
the format freeze, the consolidated-round pause, the device-capture practice,
the release-deletion authorisation and this VT question — with the property
that makes it a claim about the role rather than about a person: each was
reasonable when issued, and **four of the five were found by the repository
being told, not by the one telling**. The operational half is the test already
in use, *could someone check this without asking the holder*, plus: write the
rule the second time you enforce it, record a constraint's end in the same
file as the constraint, and treat a queued record as an unrecorded constraint
with a good intention attached.

## 2026-09-20 06:29 [progress]

**The question is recorded; the authorisation is not.**
`docs/task/20260920-0629-release-deletion-question.md` states, in this order: the rule
that holds today — deleting or re-cutting a published release happens only on
the user's explicit instruction — then that a development-phase practice to
the contrary has been in use in coordination, then the five scope questions an
answer has to settle, because *empty*, *superseded*, index releases and `ghcr`
package versions are four different blast radii. The file says in its own
first line that it authorises nothing.

It exists for the reason the rest of today produced: a practice that
contradicts a written rule and lives in one head is the shape where an agent
reading the tree and an agent asking get different answers, and the difference
is a deleted release. Recording the **question** closes that without granting
anything — and either answer produces a record, including the one nobody would
think to write: that the authorisation was assumed and is withdrawn.

## 2026-09-20 06:27 [progress]

A placeholder with a fact in it, `docs/task/20260920-0627-feature-declaration-promises.md`:
the feature-to-symbols mapping authorised across `mica-podman`, `mica-build`
and `mica-boards` will need a home here, and the part worth writing when it
lands is not the mapping. It is that **a feature declaration had never been
defined as promising anything, which is why nothing could check it** — a
declaration that promises nothing cannot be violated, so no gate can exist for
it, and the gap surfaces only when someone measures a kernel. That is how
`CONFIG_CFS_BANDWIDTH` came to be missing on both UEFI boards, where a CPU
quota therefore cannot be enforced, found by a `mica-boards` control build
that reproduces the published `bzImage` byte for byte.

The record exists now rather than when the proposal lands for the reason the
rest of this evening kept demonstrating: an expected record held in one head
is a record that arrives late or not at all. No mapping is written here and
nothing is pre-empted.

## 2026-09-20 06:22 [decision]

**Three more things that lived in one place are in the tree**, placed by the
test rather than by category — *could someone check this without asking the
holder?*

`docs/decisions/2026-09-16-consolidated-round-pause.md`: the pause of
2026-09-16 and its lifting on 2026-09-19, recorded because **it ended the way
a constraint should not — work resumed and nobody said the word.** Same decay
as the format freeze, caught one step earlier. With the clause that survives
it and is most likely to be assumed spent: nothing is pruned in any `ghcr`
package and no workflow run is deleted until the collector's snapshots are in
the bucket and a retention policy is agreed.

`docs/decisions/2026-09-20-device-captures-are-not-committed.md`: a capture
carrying a SoC serial is not committed to a public repository, because the
hostname and MAC derive from that serial, so committing one publishes a device
identity for the life of the board. Repositories cite the sha256; the bytes
stay in coordination until the user decides where captures live. It also says
what it does *not* ask for — redaction in place, since a capture with the
serial removed is a different artefact from the one that was taken.

**Two standing rules into `build-harness.md` section 4**, where the other
rules about reading evidence already are. *A gate reports before it refuses,
and the count that matters is unexplained, not dropped* — a gate relaxed to
pass converts an open question into a green tick, so the refusal arrives when
the unexplained count reaches zero and stays there; 703 paths left behind is
not a failure condition, 703 unexplained would be. And `mica-core`'s
**unchosen-property test**: count how many independent things would have to
change for a property nobody chose to stop holding — *one is luck and needs a
gate, several is structure and needs a record* — with its two instances,
Dropbear without PAM and D-Bus activation being unreachable.

**The aperture rule stops being a footnote in two specs.** It has five
instances across four repositories and three tools, so section 4 now carries
the single statement — *a negative claim inherits the aperture of the query
that produced it*, whether the aperture was a filter, a file or a name — and
`release-lock.md` 1.3 keeps its operational tag-separator instruction but
cites the general rule instead of restating it. The fifth instance is the FIT
suite: a name is an aperture too.

## 2026-09-20 06:18 [decision]

**Two things that existed only in someone's head are now in the tree.**

`docs/decisions/2026-09-16-podman-pins-its-own-snapshot.md`: `mica-podman`'s
`pins/snapshot` is deliberately not the Base `apt` row's snapshot, because the
build-env images carry packages newer than the Base snapshot and `apt` will
not resolve against them without downgrades. The intent of the rule is kept
where it binds — the declared `Depends` floors, verified by `make base-check`
on both architectures every run, which snapshot equality never was — and the
measurement at the time is cited rather than restated: all seven engine
binaries byte-identical to the previous build, no-cache rebuild identical,
evidence in the `20260916-0846` release notes. Sunset 2027-03-16, with the
condition that would end it named. The deviation was accepted and explained on
2026-09-16; what was missing is that a release note is a note about one
release, and a reader asking *why do these two files disagree* reads
`docs/decisions/`.

**The operator account policy, lifted from `mica-system-base:README.md`
(`b66a358d`) into `docs/design/access.md` section 2**, where a person looking
for console access will meet it: two accounts, neither with a password, a
signed root being byte-identical across the fleet; `/home/mica` absent on
purpose with the DATA mechanism and its one-line diagnostic (a missing home is
`mica-seed-home.service` or `home.mount`, never the account); `uidmap` absent
on purpose with where it would come from if rootless were ever wanted; and
`/etc/subuid`/`subgid` kept inert by design rather than suppressed. It is
workspace policy, not one repository's build detail, which is why it is here
and not only there.

**And the sentence those rows needed beside them**: every published image of
every board has **no console login**, because the composer's ownership proof
dropped `/etc/pam.d/login` and the generated `common-*` files — 2980 paths
carried, 703 left behind, 626 owned and unclaimed, 77 owned by nothing. The
design rows describe the design; a login prompt on a published image cannot
succeed until a release carries those files. Recorded where the channels are
described rather than as an incident note.

## 2026-09-20 06:12 [spec]

**The 2026-09-14 format freeze is spent, checked rather than recalled.** Its
terms — no new release asset, lock or OCI formats until the common `locks/`
and offline-build proposal is decided, each repository frozen until its step
was dispatched — are met on both counts: the user accepted the proposal on
2026-09-14 (`docs/decisions/2026-09-14-release-lock-and-offline-build.md`) and
all four migration stages read done in the plan's own table, with `locks/` and
`make offline` everywhere. Worth saying beside the answer: **the freeze is
written in no record of this repository**. It lived in coordination memory, so
nobody could have checked it from the tree, and a constraint only its holder
can verify decays without anyone noticing. It is now in
`docs/task/20260920-0610-producer-data-assets.md`.

**A proposal, not a change: where a producer publishes data about its own
output.** `mica-system-base` computed a list its consumers need — 93 rows per
architecture naming every path no package owns, with its writer named
mechanically — and stopped, because the spec says a release carries exactly
the lock and a `SHA256SUMS` listing it, and `asset` rows are `mica-build`
only. The correct reading of the spec is what blocked it, which is the spec
working. `docs/plan/20260920-0610-producer-data-assets.md` proposes reusing the existing
chain (`SHA256SUMS` → lock → row with sha256) through a new `data` row, with
one correction to the recommended form: the existing `asset` row **cannot** be
widened literally, because its columns are product-shaped and tied to a
`bundle`, and one kind with two column layouts is what `column-count` exists
to prevent. The alternative if that is rejected is to carry the rows in the
lock itself, and the criterion between them is stated: identity-shaped and
bounded belongs in the lock, a dataset that grows with the output belongs
behind a row naming an asset.

The user decides; nothing is wired into any release meanwhile, and the
statuses of the 2026-09-14 migration records are noted as stale rather than
quietly closed — two of its three acceptance clauses are verifiable here, the
offline-bytes clause is not.
## 2026-09-20 05:20 [progress]

**A Chinese hardware list, one page per board** (`docs/zh/hardware/`, task
`20260917-1033-zh-hardware-list`). Requested in Chinese, so it lives under
`zh/`: a list page carrying a dated state snapshot, and one page per board —
`uefi-x64`, `uefi-arm64`, `cx3576`, `s905x5m` — in one section order (overview;
feature and verification state; layout; console; obtaining an image; flashing;
first boot; updates; recovery; known limitations; verification record). The
facts come from the English dossiers, each board's `board.env` and
`evidence.json`, and the Chinese user pages; `uefi-x64` has no dossier, and its
page says so and names where each fact came from. Every page dates its snapshot
and names `docs/boards/support-tiers.md` as authoritative, so this is a
reader's view of the status table rather than a second one.

What the pages carry to be true on the day they were written: a release target
is not a hardware claim; `uefi-x64` is booted on each push and each release
while `uefi-arm64` is booted by nothing automatic, and the FIT images are
started by nothing in these repositories; the three `uefi` rounds that power
down at PID 1 are named beside the corrected round to take instead; the
`cx3576` bench boot is a report with no artefact and moves no row; and
`s905x5m` publishes images that cannot be installed onto a blank board.

**Two board tables corrected.** `README.md` and `README.zh-CN.md` still listed
`x64` and `virt-arm64` four days after the rename, and still said there was no
public release. Both now carry the current names, a dated status column, and
the distinction the tiers page draws. `docs/README.md` and `docs/zh/README.md`
index the new tree.

The first four pages were written before `16f2ddb` narrowed "never started by
anything" to "started by nothing automatic", and were swept into `a00036c`
before that edit reached them; they now say what was measured.

`make docs-verify` passes.

## 2026-09-20 05:08 [finding]

**A hardware boot of `cx3576` was reported by the user on 2026-09-20** — the
first physical boot report this project has had, hours after these pages were
rewritten around what nothing starts. It is recorded as a report and nothing
more: a pass row carries a date and an evidence reference, this arrived as a
sentence with no artefact, and `mica-boards` owns the dossier and what would
turn it into a row. No tier row moves, `cx3576` keeps "physical rows not
tested", and the pages that a reader meets say the same.

**What it did expose is an overclaim of my own, and that is fixed.** Several
pages said the four FIT products "have never been started by anything". What
was measured is narrower: no suite boots a FIT image, and both suites that
boot refuse a FIT board by name. Automation is what this tree can speak for; a
person on a bench is a different claim with a different kind of evidence. The
sentences now say *started by nothing automatic* / *nothing in this tree*, in
`build-harness.md`, `support-tiers.md`, `download.md`, `overview.md`,
`flashing.md` and the Chinese pages. `flashing.md` also stops asserting that
no physical board has booted one, which it cannot know, and says instead that
no physical boot has an evidence row.

The two facts are not in tension and the records keep the distinction visible:
**a board that has booted on a bench and a catalogue that nothing automated
starts are different claims.** When the row exists they sit side by side.

## 2026-09-20 00:55 [finding]

**Unstarted, not unrun — and the distinction is load-bearing.** `ci.yml` runs
`make os-fit-records-test` on every push and the FIT suite covers firmware IO,
signatures, trust and record logic, so the FIT side is attended by checks that
never start the thing. "Nothing runs for FIT" would be false and would invite
the wrong repair: more host-side checks and a feeling of coverage. The
sentence the records carry is that **nothing starts a FIT image**.

**It is explicit in the tree, not inferred from an absence.** Both suites that
start a guest refuse a FIT board by name — `tests/apid-api/src/qemu.ts` throws
`<board> boots a FIT; QEMU acceptance boots UEFI boards`, and
`tests/lifecycle-uefi/product-inputs.sh` refuses the same case in shell (read
at `e92dc5d`). So the scoping answer is in the record before the question is
asked: **a FIT boot suite is a new suite, not the unblocking of an existing
one.**

**Where my wrong belief came from, found by looking for a source rather than
assuming carelessness.** `product-inputs.sh` refuses with *this suite boots
UEFI boards (`tests/lifecycle-uboot-fit` for the other)*, and "for the other"
reads as though a FIT image were booted somewhere. A written source, sitting
at the point of use, wrong in the direction that manufactures a capability. It
is the fourth instance of a wrong version of a rule where the right one
belongs, and the first that cost a **claim** rather than a measurement: the
other three were wrong descriptions of code that was right, this one had me
assert a capability three times. It had a natural point of use after all, so
the condition for naming the class and giving it a home is still unmet and no
abstract rule is written here.

## 2026-09-20 00:53 [finding]

**No suite boots a FIT image, so half the published catalogue has never been
started by anything.** Measured here file by file in
`mica-build:tests/lifecycle-uboot-fit/` at `e92dc5d` — no QEMU anywhere; it
tests firmware IO, records, signatures, trust and dirty-filesystem behaviour
on the host, while the boot machinery lives in `tests/lifecycle-uefi/` — and
verified independently afterwards. The claim it replaces, that three suites
boot a guest, had been stated once and forwarded three times before anyone
opened the directory.

The statement is therefore bigger than last night's: not that the `s905x5m`
images have never been booted, but that **no FIT board image has ever been
booted by any suite, because no suite boots one**. Four of eight published
products are on that side — `cx3576-dev`, `cx3576-prod`, `s905x5m-dev`,
`s905x5m-prod` — and `cx3576` has been a release target through six releases,
so it is the rule for the FIT backend rather than a new board's exception.
`cx3576` is named beside `s905x5m` in every place the pair appears, for that
reason. The other four carry boot evidence of two ages: `uefi-x64` from the CI
gate per push and per release since 2026-09-19, `uefi-arm64` from hand-run
QEMU rows predating the rename.

**Why the mistake was easy is recorded with it**: the suite is named
`lifecycle-uboot-fit`, sits beside `lifecycle-uefi`, and tests the FIT boot
*path*, so the name and the neighbourhood both say it boots. A name that
parallels a booting suite without booting is the same shape as a comment
asserting what the code does not do — **a name is not evidence of behaviour**,
and the check is one `grep` for the machinery rather than a reading of the
directory listing.

The user decision changes shape with it: not "should the FIT side have boot
evidence" but "half the published catalogue has never been started, and a FIT
boot suite is work nobody has scoped". It is recorded as that, unscoped.

## 2026-09-20 00:50 [progress]

**All four boards are release targets, and the catalogue now has two kinds of
backing.** `s905x5m.20260920-0033` and the index `mica.20260920-0046` are
published from `e92dc5d`; both trust hashes were read back and match, the
release carries an image and a full archive per product plus the lock and
`SHA256SUMS`, and the index carries four boards, eight products and `full=8` —
no partial archive anywhere. `docs/boards/support-tiers.md` drops the
"decided 2026-09-19" qualifier and the paragraph that said the flag had not
been flipped; `docs/user/download.md` and its Chinese page name all four
boards; `docs/user/update-packages.md` now shows both full-only reasons in one
file, six products because everything compared moved and two because there was
nothing to compare against.

**The boundary, recorded as one pair in `build-harness.md` section 4, beside
the boot gate**: four boards are release targets, eight products are published
and indexed, the UEFI images boot, and the `s905x5m` images have never been
booted by anything. Nor have the `cx3576` ones. That is sharper than the tier
table, which is about qualification: this is about whether anything has ever
started what we publish. It is consistent with the user's decision that a
release target asserts nothing about hardware, and what to do about the FIT
side is a question for the user rather than a suite to schedule.

**One of my own sentences was wrong and is corrected in the same edit.** This
section listed three suites that boot a guest, `lifecycle-uboot-fit` among
them. It carries no QEMU at all — checked file by file at `e92dc5d` — and runs
firmware IO, signatures, records and dirty-filesystem behaviour on the host.
The suites that start a guest are `lifecycle-uefi` and the `apid-api`
harness, which is why the FIT half of the catalogue has no boot behind it.

## 2026-09-20 00:21 [finding]

**Correction, and it understated the gate: the boot runs on every push to
`main` and every pull request, not only in a release.**
`release-product.yml` is a reusable workflow with no triggers of its own;
`ci.yml` calls it in its `release-products` job with `upload: false`, and
`release.yml` calls it when a release is published. Measured on the push of
`f46b64a6`: in that `ci` run `release-products (uefi-x64-prod, amd64)` booted
and passed, while the `uefi-arm64` and `cx3576` jobs skipped the step. So the
gate fires on the push that renames a board, which was the requirement it was
asked for. The real limits are unchanged and stay written: amd64 only, one
runtime stage, no faults, no updates, and `mica-deploy`'s `BOOTAA64.EFI` arm
would pass it green. `build-harness.md` section 4, `docs/user/build.md`,
`docs/user/flashing.md`, `docs/boards/support-tiers.md` and the Chinese pages
are corrected.

**Understating coverage costs what overstating it costs, in the other
direction**: a record that says the gate does not run on push invites the next
person to add a second gate that does, or to distrust the one that exists.

**The aperture rule took its fourth instance, from correcting its third.**
Having found the gate in `release-product.yml`, I read that file, saw no `on:`
block, and wrote that it does not run on push — true of the file, false of the
system, because a reusable workflow inherits the trigger of whoever calls it.
When the claim is *when* something runs, one file is never the aperture. The
rule catching its author within the hour is the evidence that it was worth
writing.

## 2026-09-20 00:18 [finding]

**Correction, twenty minutes old: a release does boot an image, and my query
was narrower than my claim.** The entry above said the boundary still stood
because `ci.yml` at `f46b64a6` carries no lifecycle job. The gate is not in
`ci.yml`: it is a step of `release-product.yml`, `Boot it, one runtime stage,
no faults`, running `tests/lifecycle-uefi/run.sh <product> --runtime-only`.
Read back from the three release runs of the `20260919-2356` round, it ran and
**passed for both `uefi-x64` products** — the first boot of an image here
outside a hand run — and was **skipped** for both `uefi-arm64` and both
`cx3576` products, the step being `if: inputs.arch == 'amd64'`.

The pages now say that with its coverage attached: `build-harness.md` section
4 records the move, the three red runs it took to land (every one a harness
defect, none an image), and what the gate does not cover — no fault stages, no
updates, nothing on a push to `main`, and `mica-deploy`'s `BOOTAA64.EFI` arm
would pass it green. `docs/user/download.md`, `docs/user/flashing.md`,
`docs/boards/support-tiers.md`, `docs/user/build.md` and the Chinese pages are
corrected the same way, including the tier rows, where the evidence is now
uneven between `uefi-x64` and `uefi-arm64` rather than merely dated.

**The rule the mistake earns, beside the other two on reading evidence:** *a
query's aperture must be at least as wide as the claim built on it.* Three
instances, all this week: `mica-res`'s reader followed the slash form and
ignored every dot-form release; the index count used a `mica.` prefix test and
returned nine of ten; and this one grepped `ci.yml` for a claim about anything
in CI **or release**. A query returns *nothing found*, never *nothing exists*,
and the two are indistinguishable from its output — so the aperture belongs in
the sentence the result becomes. The instance in `doc-contract.md` about
fixtures stays where it is; this rule is carried by three instances of its
own.

## 2026-09-20 00:16 [progress]

**The corrected round is published and the non-booting note resolves.**
`uefi-x64.20260919-2356`, `uefi-arm64.20260919-2356` and
`cx3576.20260919-2356`, with `mica.20260920-0008` marked latest, all from
`f46b64a6`; the four trust hashes were read back from the published
`SHA256SUMS` and match, and each scoped release carries exactly its two
products' images and one full archive each. `docs/user/download.md`,
`docs/user/flashing.md`, their Chinese pages and
`docs/boards/support-tiers.md` now point a reader at `20260919-2356` or later
and keep the three broken rounds named, still published, still not deleted.

**Full-only rounds, both directions, in one rule** in
`docs/user/update-packages.md`: this round is full-only because *everything
compared moved* — `mica-deploy` is in every root and `mica-lifecycle` ships
the `mica-runkit` packed into the initramfs as `/init`, part of the
authenticated kernel identity — and a board's first release, `s905x5m`'s
among them, will be full-only because *there is nothing to compare against*.
A reader meets one rule instead of two coincidences.

**One claim did not survive the read-back, and the boundary stands.** The
round was forwarded as built from the commit whose guest reached
`FILE_AB_RUNTIME_PASS` **in CI**. At `f46b64a6` `ci.yml` carries no lifecycle
job — the gate was landed and withdrawn twice while it was being made to pass
as a non-root user (`bc5e400`, `c8eb64d`) — and that commit's `ci` run has
nineteen jobs, none of which boots a guest. So what backs the corrected images
is a source fact: the `mica-core` release they pin, `20260919-2226`
(`dc1c870`), matches `uefi-x64` and `uefi-arm64` in the board arm whose
absence produced the refusal. The pages say exactly that and leave *boots* as
a claim carrying the date of a run. `build-harness.md` section 4 records that
the boundary still stands on 2026-09-20.

## 2026-09-19 22:24 [finding]

**Nine was ten, and the count is replaced by a boundary sentence.** There are
ten index releases in `mica-build`, not nine: the slash-form
`mica/20260915-2242` predates the separator cut-over, and my query tested for
the `mica.` prefix, so it could not have matched it. Read directly, that index
names `cx3576/20260915-2230` and `x64/20260915-2230` and is clean for the
reason that confirms the diagnosis — the board names of its era are the ones
the client of its era matched. `docs/design/mica-index.md` now states the fact
being claimed instead of a population: **every index cut since the rename
references at least one of the six non-booting releases, and the one cut
before it references none.** Deleting the six would take all nine post-rename
indexes as `--full` casualties and leave that single pre-rename index the only
verifiable one in the repository — and the index history becomes evidence for
the diagnosis rather than a casualty of it. Classification unchanged and
heavier: non-functional, not unsafe; supersede, delete nothing.

**The filter lesson is recorded as a rule, not named as a class.** In
`docs/design/release-lock.md` section 1.3, where the two tag forms are
defined: anything enumerating releases or tags here matches both separators —
`mica[./]` — or says in the query why it excludes one, because both forms stay
published and silence from a filter looks exactly like absence in the
registry. It has two instances, one in each direction: `mica-res`'s reader
followed the slash form and ignored every dot-form release; this count
followed the dot form and dropped the slash-form index.

It stays a rule because of a threshold written beside the class it would
otherwise join, in `docs/user/doc-contract.md` section 6 and its Chinese page:
**an instance counted in two classes inflates both.** The fixture pair is
already assigned to *two correct things whose relationship is wrong* — two
artefacts checked only against each other — so it cannot also be the filter
observation's third instance. A taxonomy whose classes each have three
instances and share all of them says nothing. If the filter rule earns a third
instance it owns, it can be named then.

## 2026-09-19 22:22 [finding]

The nine-index measurement has an independent read: two of the nine,
`mica.20260919-2115` and `mica.20260919-2110`, were re-read elsewhere and
matched the per-index list, and the earlier figure of three is confirmed to
have come from a repository record that nobody counted. Recorded in
`docs/design/mica-index.md` beside the measurement, marked as a **spot check
confirming the reading, not a second audit** of all nine — the same
distinction kept when the mirror came back. The classification survives the
correction and is what the rule was tested on: a non-booting image is
non-functional, not unsafe, so it does not reach the withdrawal exception, and
the measured count makes the case stronger than the rule needed. What the
record keeps is not the corrected number but why a figure that cheap to check
travelled on sounding right.

## 2026-09-19 22:20 [finding]

**The summary-sentence defect is named as a class at its third instance**, in
`docs/user/doc-contract.md` section 6 and its Chinese page: *two correct
things whose relationship is wrong*. The three, each already in these records:
a summary and the list beside it (three of those, fixed 2026-09-19); a
boundary written in `build-harness.md` section 4 while section 5 still
described `privileged.yml` in the present tense, of something that has never
run; and two copies of a shared fixture diffed against each other, both saying
`x64`, the check passing. The threshold held on purpose — a claim about the
world waits for a third instance, a rule about writing does not — so the
counting rule was written from two instances this afternoon and the class was
not.

No gate. Each piece is defensible alone, so a lexical flag would fire on every
dated measurement and be dismissed every run. The control is procedural and
stated as one sentence to apply while writing: a claim about other text — a
count, a boundary, a negation — is not finished until you have read the text
it ranges over; and where two artefacts are only checked against each other,
one of them must also be checked against the world. The verbatim form is
*a boundary stated in one section and contradicted two screens later is not
stated.* `build-harness.md` points at the class from the fixture case, which
is the same shape outside prose.

## 2026-09-19 22:16 [finding]

**The published `uefi` images do not boot; they power down.** `mica-build`
booted one: the kernel starts, verity signature policy comes up, PID 1 refuses
the board name in the image's own signed identity
(`mica-init: boot refused: unsupported boot backend board`, the bail arm of
the pinned `BootKind::for_board` reached from `mica-runkit`, against a
`kernel/boot.json` that says `uefi-x64`) and the guest powers off at 1.7
seconds. Both ends of the pipeline agree from opposite directions — a
published `.micaupd`'s signed envelope decodes to `uefi-x64`, and the image
built from the same pins refuses it. Six releases carry it: `uefi-x64` and
`uefi-arm64` at `20260916-0845`, `20260916-1653` and `20260919-2103`.
`cx3576` and `s905x5m` are untouched, their names never having changed, so the
two boards anyone would have put on a bench still work and the break is
exactly where the harness is the only thing that runs. Recorded in
`docs/design/build-harness.md` section 4 with the console, in
`docs/boards/support-tiers.md` as a date bound on the QEMU rows, and in
`docs/user/download.md` and its Chinese page where someone would fetch one.

**The boot gate is authorised** (2026-09-19, by the coordinator, not put to
the user): one `uefi` lifecycle boot in `ci.yml` on the amd64 runner over the
product that job already builds — one product, one boot, no fault stages — and
it must fail the job rather than warn, and be conditional on nothing a person
can forget, since this break arrived through a rename that a path filter would
have skipped. That supersedes the line written here earlier the same day,
which said whether CI boots a guest was with the user; four minutes on a push
stopped being a decision worth forwarding once three days of green CI over a
non-booting image were the alternative. What closes it is the guest reaching
`FILE_AB_RUNTIME_PASS` after the pin moves, not the diff: a rename verified by
reading the diff is what produced the break.

**Supersede, not delete**, recorded as the second and harder instance of that
rule in `docs/design/mica-index.md`. A non-booting image is non-functional,
not unsafe — it does nothing on a disk and a reflash recovers the unit — so it
does not reach the withdrawal exception. Measured cost of the alternative:
**every `mica.*` index that exists**, all nine from `mica.20260916-0852` to
`mica.20260919-2115`, references at least one of the six releases, so deleting
them would make the entire published index history permanently unverifiable by
`--full`. The coordinator forwarded three; reading all nine published indexes
gave nine. What happens to the published releases is a user decision and is
with them; nothing is deleted and no published release is edited meanwhile.

## 2026-09-19 22:08 [finding]

**Nothing in CI or in a release has ever booted an image**, in any repository
here (`mica-build`, from its own workflows, 2026-09-19). Recorded in
`docs/design/build-harness.md` section 4 where the gates are described, with
both halves: what the automated gates *do* prove — a static read-back of the
assembled image against its contract, a container smoke over the shipped
binaries, the package, lock and reuse gates, the docs gates — and the one
thing none of them does, which is start the guest. The three suites that boot
one are `make` targets run by hand, and `privileged.yml`, the workflow that
would have covered it, has never run: `workflow_dispatch` plus a Monday cron
that has not fired.

The dates make it checkable: the newest lifecycle evidence is 2026-09-15
20:17 UTC and the rename landed 2026-09-16 08:05 UTC, so the last boot of a
product precedes the rename by twelve hours — which is how three days of green
CI coexisted with published `uefi` images whose signed board name the pinned
client refuses at PID 1. A reader can now sort the claims: *assembled to its
contract, binaries execute* is evidence-backed; *boots and reaches its
services* is inference carrying the date of the last hand-run suite.
`docs/user/build.md` and its Chinese page say the same in one clause where the
suite is named. Whether CI should boot a guest is with the user; no plan is
written here.

**Two method rules from the same investigation.** *String absence in a
stripped Rust binary is not evidence of a missing match arm*: a 3 to 10 byte
literal compiles into an immediate comparison and never reaches `.rodata`,
while the bail messages of those same matches are present — a binary answers
"is this string stored", not "does this code compare against it". It sits
beside the noise-floor rule, same family. And *identical wrong bytes are a
pass*: the shared component-contract fixtures are diffed byte for byte between
the two repositories, both said `x64`, and the check passed. A byte-equality
check between two copies proves they match each other and says nothing about
whether either matches the world. The agreed fix makes the fixture state the
board vocabulary and has `mica-build` assert it equals the board rows it pins,
so renaming a board turns a gate red in the repository that renamed it, on the
same push.

## 2026-09-19 21:48 [finding]

The loader question is answered from `mica-build`'s code rather than from
design intent, and the answer is larger than the question: **archive kinds are
computed over the root and kernel identities only, and the bootloader is in no
archive kind at all — not even `full`.** An archive packs a signed descriptor
and exactly two object families, the kernel and the root; the firmware is not
a member of the deployment descriptor and enters the factory image only. A
moved U-Boot therefore changes no archive byte, cannot force a `full` archive
and cannot suppress a `root` or a `kernel` package.

That kills the worry it was asked about: `s905x5m` ships partial updates
exactly as the other three boards do, from its second release on,
non-deterministic vendor signing and all. Two measurements stay in play and
they count different things, so both are recorded with their units: **16.13
MiB** of component bytes differ when the loader rebuilds, on the releases
whose loader inputs moved; **3.17 MiB** is `u-boot.bin.signed` inside every
published factory image, present in every `.img.gz` and never in a
`.micaupd`.

**The corollary is the part that matters, and it is not a property of that
board:** no device on any board receives a new bootloader through an update
archive. Firmware moves offline only — the guest stopped, or the board owned
over RockUSB — per the firmware-maintenance contract. That has been true since
the format existed, on `uefi-x64`, `uefi-arm64` and `cx3576` as much as on
`s905x5m`, and nobody had stated it; it became visible only because someone
asked what a moving loader costs on one board. `docs/user/update-packages.md`
records it beside the archive-kind rules, with its Chinese page, as **an open
product question and not a defect** — the bootloader is not updatable in the
field by any current mechanism, changing that would change the format, and
what to do about it is with the user. It is written as a long-standing fact
rather than a new one, so a reader meeting it does not read a regression.

## 2026-09-19 21:46 [finding]

The two-directional audit is in, and it is the third fact of the restoration —
kept apart from the other two because it answers a third question.

**Both directions, against the final catalogue:** 508 keys in the catalogue
and in the locks (492 before the 21:03 releases), 0 in the locks and missing,
0 in the catalogue named by no lock, 0 with the same key and a different
digest; 896 public objects audited with digests verified, 0 problems; 31
declared pack chunks, 0 problems; 16 index URLs verified by digest, 0
problems. Forward, everything the locks name is present; reverse, everything
held is named by a lock or derived from a commit a lock pins, and nothing
else. The reverse column reads 0 because the arithmetic closes exactly.

**Two numbers with two units, both true of the same mirror on the same
evening.** The contract requires 44 keys — 13 manifests plus 31 chunk names —
and the bucket stores 43 byte strings, because one 64 MiB chunk coincides
between the two `uefi` packs. 492 + 44 = 536 answers *what must resolve*;
492 + 43 = 535 answers *how many distinct objects exist*. `docs/user/doc-contract.md`
gains the rule in both languages: state the unit with the number.

**And the gap was a defect.** `uefi-x64-kernel` pack chunk 00 existed under
the `arm64` name only, so a consumer following the contract would fail on the
first chunk of the largest tree `mica-boards` pulls — while the audit and the
reconciliation both read clean, because both are about the object *set* and
neither was about the *contract over names*. Repaired, independently verified,
and `mica-res` built the check that sees the class: every chunk a manifest
declares must resolve under that manifest's own name.

`mica-res`' sentence is recorded in `docs/design/build-harness.md` section 4,
beside the control procedure and the noise-floor rule, because it belongs to
the same family — how to read a measurement: **a number that disagrees with
your model is worth more than the explanation that makes it go away.** The
explanation here was coherent and arithmetically correct about digests, and it
dismissed the defect it was explaining.

## 2026-09-19 21:44 [finding]

A correction that narrows a claim rather than reversing it, and it was the
coordinator's claim rather than a measurement: **reuse is decided by inputs,
not by bytes.** `mica-boards` compares a component's `mica.inputs` against the
board's latest release, so an `s905x5m` release whose loader inputs did not
move republishes the same digest without rebuilding. The loader does not move
every release; it moves when its inputs move.

The permanent statement is the narrow one: **a release whose loader inputs did
move rebuilds it, and that rebuild is never byte-identical**, because the
vendor signing is non-deterministic. The inputs are the board's `loader/`,
`bsp.env`, the board `Makefile`, `common/uboot`, `common/scripts`,
`common/trust`, the two vendor git rows, the toolchain source rows, the `bsp`
image digest and the boot certificate. Cost when it happens: four files of
twelve, 16.13 MiB. Frequency follows the loader rather than the calendar —
three times in the week of 2026-09-16, none in a week that does not touch it.

So the question recorded beside the archive-kind rules keeps its place and its
openness, with a smaller premise: whether a moved loader alone forces a `full`
archive decides the cost of the releases that rebuild the loader, not of every
release, and `s905x5m` is not structurally barred from partial updates.
`docs/user/update-packages.md` and its Chinese page carry the corrected
framing.

**And the reason the release-target flag has not been flipped yet**, which is
a better answer than "not yet": the board has no `evidence.json`, and
`mica-build`'s release manifest requires one — `schemaVersion` 2, the board
name, a known `bootAssurance`, a non-empty qualification, at least one
`evidenceRef` and `physicalBoundaries`. Flipping today would produce a product
whose release manifest cannot be built, so `mica-boards` writes the document
first, on the `cx3576` model that states its own pending physical rows.
`docs/boards/support-tiers.md` records that beside the decision, because that
document is where "a release target is not a hardware claim" gets stated for
this board.

## 2026-09-19 21:42 [progress]

The summary sentence is a class, not an incident, so it was hunted where the
lists change most — the board table, the product catalogue and the release
status paragraphs — and there were **three**, all now fixed: the one found
last night in `docs/user/overview.md` section 5, "All four boards are release
targets" in section 3, and "all three have published images" in
`docs/user/flashing.md`, with their Chinese pages. Each was true when written
and false the moment `s905x5m` joined the list.

Everything else that counts in these pages is a **dated measurement** — eight
archives rebuilt, six packages differing, three hosts timing out, eight
repositories green — and those do not decay, because they describe a moment
rather than a standing state. That is the distinction the fix rests on.

The control is a rule rather than a gate, in `docs/user/doc-contract.md`
section 6 and its Chinese page: a sentence that counts or quantifies a list
beside it is rewritten with that list; prefer a form that does not count, and
where a count is the point, date it. **No gate was added deliberately.** The
defect is a relationship between two individually correct pieces of text,
which a lexical flag cannot judge; such a flag would fire on every dated
measurement, and a gate whose findings a person dismisses every run is worse
than the rare, cheap defect it catches.

## 2026-09-19 21:40 [decision]

`s905x5m` is opened as a release target (user, 2026-09-19): `mica-boards` sets
`BOARD_RELEASE_TARGET=1` and cuts a release, `mica-build` re-pins and
publishes its products. **Its tier does not move** — it stays bring-up, with
the same evidence column, four physical rows untested and `RFCT-922` open.

That is not a contradiction, and `docs/boards/support-tiers.md` now says why
rather than leaving a reader to reconstruct it: **being a release target has
never meant being qualified on hardware here.** It says the board's images are
built and published and its products appear in the index; the dossier is where
the claim about hardware lives. `cx3576` has published images at the bring-up
tier, with the same "physical rows not tested", since before the rename —
`s905x5m` was the outlier and the table gave no reason for it, so the decision
removes an inconsistency rather than lowering a bar.

`docs/user/overview.md`, `download.md` and `flashing.md` follow with their
Chinese pages. The flashing guide keeps the distinction that matters there:
publishing changes what exists to download, not what can be written — the
`s905x5m` image still installs no bootloader, because U-Boot runs from eMMC
boot0 outside it.

**Recorded as open, beside the archive rules rather than in the board's
page:** `s905x5m`'s U-Boot cannot be reused byte-identically while the vendor
signing is non-deterministic, confirmed twice by `mica-boards`, so from its
second release on the loader moves every time. Whether that alone forces a
`full` archive, or whether the kinds are computed over the root and kernel
identities with the loader riding along, is `mica-build`'s to answer from its
code and its first two releases. It sits beside the rules because it is the
first case where a board property may constrain an archive kind, and the
answer is about kinds rather than about that board.

## 2026-09-19 21:40 [finding]

The mirror serves again, and the restoration is recorded as **two facts**
rather than one, because they answer different questions.

**The service holds objects.** `/upstream/` and `/mica/` render directory rows
where they rendered empty tables this afternoon — `upstream/debian/`,
`upstream/git/`, `upstream/source/`, `mica/cx3576/`, `mica/uefi-x64/` — with
namespace counts `upstream` 390, `oci` 115, `mica` 30, `status` 315. The
re-publish ran from the pins rather than the v1 import, as decided.

**And a party outside the service verified one object against a lock that
neither the mirror nor its own audit produced.** `alsa-utils` `amd64`
`1.2.14-1`, sha256 `1e2b5f31…2596b` in the `mica-system-base` `20260919-1959`
lock, fetched from `/blob/1e/1e2b5f31…2596b`: `200` after one redirect,
1 140 648 bytes in 0.48 s, received bytes hashing to that digest. The digest
route resolves, the redirect contract works as `mica-res` specified it, and
the mirror serves the bytes a producer lock pins. The same digest answered
`404` in the earlier probe of the same evening.

That second fact is the one that makes the first credible: an audit reports
what a service believes about itself, while an outside check against an
independent lock reports what it actually serves. Recording them apart was
worth doing before either existed.

**What is not established, stated with them:** one object, not 536 — a spot
check, not an audit, which `mica-res` still owes in both directions; and the
measurement carries the coordinator container's scope, the zone reached
through a user-supplied address mapping.

**`/status/` is settled too**: the namespace had gone with everything else and
is back, 0 to 315 objects, `/status/current.json` and `/status/health.json`
both `200`, and `health.json` at `2026-09-19T20:37:56Z` reporting `green` for
all eight repositories with `runsSince` 0 — the same verdict a person reached
by hand an hour earlier, now recomputed every thirty minutes by something that
does not depend on anyone looking.

## 2026-09-19 21:00 [progress]

Three items from the workspace audit, all in `docs/`.

**The `add-endpoint` row is the format specimen, not a live task** — it sits
under *Format* in `docs/task/index.md` and its detail file deliberately does
not exist. It is now fenced, so it cannot be read as an open P1 at the top of
the index by a person or by a tool; being read that way in the audit is the
argument for fencing it, and the reason is written beside it. `mica-res` has
the same residue and it is theirs to judge — reported, not edited.

**`20260913-1700-registry-migration` is closed**, checked against its own goal
rather than against an impression: every repository publishes to its own
package under `ghcr.io/micaoss`, every package is public and read
anonymously — this week's index verifications pull manifests and layers with
no token from a fresh clone — publication is CI's alone, and every consumer
pins by digest through its lock. The record says plainly that this was *not*
done by executing its steps: the release-lock migration replaced the mechanism
underneath them, `deps.sh` and `deps/boards/*.json` giving way to `locks/`
with pins, and the `build-<commit12>` tag grammar to
`<kind>[.<name>]*.<release>`, where no tag carries a commit at all. Steps 3 to
5 describe files that no longer exist and are kept as the record of what was
planned, not as instructions.

**Pre-rename tags keep their names**, stated in `docs/design/release-lock.md`
1.3 where the tag vocabulary is: 22 today, 18 in `mica-boards` and 4 in
`mica-build`, all from before 2026-09-16 and all named by locks of releases
that still exist — so 2.1 already forbids touching them, and this is the same
treatment the slash-form release tags have.

## 2026-09-19 20:15 [finding]

The empty mirror is confirmed from a third vantage by a second method, and the
evidence is better than the `404`s that started it. From the agent container
on this host, reaching the zone through a container-local address mapping the
user supplied (`104.19.151.13 res.micaos.dev`, after which it answers in
0.09 s): `/` and `/v2/` answer `200`, **`/upstream/` and `/mica/` render their
namespace listings with the table body empty**, `/index/current.json` answers
`302`, and `/blob/<aa>/<sha256>` for an object the locks pin, plus
`/upstream/debian/`, the legacy `/d/upstream/debian/` and
`/status/current.json`, all answer `404`.

**Why the empty listing is the better evidence**, and it is now the sentence
in the spec: a `404` is consistent with a moved path, a wrong key or a route
that was never wired, while a listing page that renders its title, its
description and its headers with no rows says the service is up, its structure
is correct, its routes work, and it holds nothing. That closes the last
reading in which any of this was a path problem, and two vantages by two
methods now agree. The lesson is recorded for the next reader who meets `404`s
from a mirror: look at the listing before concluding the path is wrong.

The measurement is recorded with its scope as the third of three, replacing
neither of the others: it is a fact about that container, which could not
reach the zone at all this afternoon, and not about the zone or about DNS.

One thing it surfaced is open and is `mica-res`': `/status/current.json` is
`404` on the `res` host too. The collector has been running every thirty
minutes throughout, so whether its status pointer moved to the download host
and is well, or whether the status namespace went with everything else, is the
question — and it is a second thing the re-publish does not cover.

## 2026-09-19 18:10 [finding]

The `/blob/` question is settled, and the answer is bigger than the question:
**nothing resolves on the mirror, because the mirror is empty.** Measured by
`mica-res` from a runner on 2026-09-19 with redirects not followed — the
legacy `/d/upstream/git/…` and `/d/mica/…` paths, the current
`/upstream/git/…` and `/mica/…` keys, the same keys on `dl.res.micaos.dev`
and the digest lookup `/blob/<aa>/<sha256>` all answer `404`, with only
`/index/current.json` answering at all, a `302`. The cause is not a path
change and not a redirect the client fails to follow: the v1 import never ran
after the 2026-09-18 cutover, so the service has held none of the 486 objects
and 8.2 GB since then. The redirect-following hypothesis is dead and the
disputed slot in `docs/design/mica-index.md` 3.1 is now empty.

**And the thing that did not happen, which is the whole argument for the
design.** The mirror held nothing for about a day and a half and no repository
noticed in its results: every consumer treated the non-answering mirror as the
next URL and fell back upstream, every run stayed green, and the only effect
was slower fetches. That property has now been paid out twice in three days —
once for a host move, once for an empty service — and the second is the larger
payout, because a service holding nothing is the worst case the design was
written against.

A full re-publish from the producers' locks is running, from the pins rather
than the v1 import: the import would reconstruct from a snapshot of the
service being retired, and where the two disagree the locks win. The
restoration is `mica-res`' audit reporting green against the new service, and
it is not recorded until it does.

## 2026-09-19 17:30 [spec]

Two artefacts here are called an index and both carry a `YYYYMMDD-HHMM` stamp:
this repository's version index, a published `mica-build` release verified by
byte-identical rebuild, and `mica-res`' bucket catalog, a snapshot of what a
bucket holds verified by an audit against it. `docs/design/mica-index.md` now
opens with a table distinguishing them and one convention that costs nothing:
**the version index is written with its tag, `mica.<stamp>`, never as a bare
stamp.**

The evidence for bothering is in the entry: the two were conflated within
minutes of reading both reports on 2026-09-16, and the failure that matters is
not a confusing sentence but verifying the wrong artefact and calling it
healthy.

A rename is `mica-res`' call and not needed for this to be unambiguous here.

## 2026-09-19 17:00 [spec]

Three changes to `docs/design/mica-index.md` 3.1, one of them a ruling against
what I wrote yesterday.

**The whole prefix is the committed value.** A mirror entry is
`<prefix>/<scope>/<stamp>/<file>`, `mirrors.list` holds one absolute `https`
prefix per line, and today's line — `https://dl.res.micaos.dev/mica` — is an
example rather than the rule. My version put `/mica/` in the spec, which made
the 2026-09-18 move a change in `mica-build` *and* a change here; as a prefix
it is one committed line in one repository and this document names no path
shape of another service at all. It is the rule I wrote two days ago —
mandate the property, not the mechanism — applied to the thing I wrote it
about, and I did not apply it. What `mica-res` serves is kept, moved into its
own bullet, because that is a fact a reader needs rather than a derivation the
emitter follows.

**The `/d/` dispute is settled, and not by the probe that was planned.**
`mica-boards`' CI prints whether each fetch was mirrored, and ran the same
command twice from GitHub runners: `35207062715` (2026-09-17 09:47) mirrored
all eleven fetches, `35454561921` (2026-09-19 16:19) mirrored none and fell
back on all eleven, with `MICA_MIRROR` unchanged since 2026-09-16. The old
paths stopped answering on or before 2026-09-19 16:19 with no consumer having
landed, so the failing sync was right and the migration notice described a
plan that was not followed. Two dated runs of one command with one variable
changed beat a probe, and nothing broke — the fallback is the designed
behaviour, which is the property recorded yesterday doing its work a second
time.

**`/blob/<aa>/<sha256>` takes the disputed slot:** it stopped working in the
same interval while `mica-res` says the shape is unchanged and now answers by
redirect, so whether it stopped answering or the client does not follow the
redirect is open, and is recorded as open.

And a second reachability measurement, with its own scope and beside the first
rather than replacing it: from an agent container on this host on 2026-09-19,
`dl.res.micaos.dev` (`188.114.97.5`), `s3.res.micaos.dev` (`188.114.96.5`) and
`res.micaos.dev` (`188.114.97.5`) all time out on 443 while
`www.cloudflare.com` answers in 0.14 s. The new download host is in the same
unreachable range as the old one from that vantage, and that says nothing
about runners or the user's machine — where `mica-boards`' mirrored fetches
are the evidence.

## 2026-09-19 [spec]

`mica-res` became a general resource publishing service (user decision
2026-09-17; the Worker is gone, three hosts now: `dl.res.micaos.dev` for
files, `res.micaos.dev` for listings, `/blob/`, `/v2` and the console,
`s3.res.micaos.dev` for the S3 read API). The rule for the move is one
sentence — the new key is the old readable name with the `/d/` prefix dropped
— with `/blob/` and `/v2` unchanged, `/blob/` answering by redirect to the
download host, and the v1 `/index/` documents frozen.

So `docs/design/mica-index.md` 3.1 derives a mirror entry as
`https://dl.res.micaos.dev/mica/<scope>/<stamp>/<file>`, and `mirrors.list`
carries that host. `mica-build` makes the matching change to the file and its
derivation in the same round.

**The part worth more than the edit: already-published indexes are not broken
and are not republished.** They carry the old URLs, those URLs may stop
answering, and that is the designed behaviour — a mirror that does not answer
is the next URL, and the last URL is the release's own, so a reader falls back
to GitHub and gets the same bytes against the same `sha256`. The host moved
and nothing had to be reissued. This is the first time the property carried
weight, and it is what "a mirror is a source, never a trust anchor" buys.

Recorded as **disputed**, not resolved: whether the old `/d/` URLs still
answer today. `mica-res`' migration notice says the old paths go only once all
four consumers have landed and not before 2026-10-02, while its own sync has
been failing since 2026-09-19 08:46 because its git pack lookups at `/d/…`
find nothing. A probe from a runner settles it, because neither `mica-res` nor
the coordinator can reach the zone from a container on this host. The scope
rule in its second form: a claim about what a host serves is not established
until someone who can reach the host says so.

## 2026-09-17 09:37 [progress]

The CX3576 boot logo is the **Mica OS** icon above its wordmark: `docs/design/display.md`
section 4 and `docs/boards/cx3576-bench.md` no longer name the retired
**YBO - Hub OS** artwork. The master is still
`mica-boards:boards/cx3576/flash/assets/splash.png`, now rendered from
`mica-res:mica/brand/logo/mica-os-icon-dark.svg` and
`mica-os-wordmark-dark.svg`.

## 2026-09-16 19:25 [spec]

`docs/design/mica-index.md` 3.1 now names the committed bases the way
`mica-build` implemented them, in the same words: `mirrors.list`, one absolute
`https` base per line in preference order, each base deriving one entry and
the entries appearing in the file's order, with an emitter that sorts either
being wrong. Today the file has one line. The removal case needs no special
rule: no file, or an empty one, and the member is omitted — which is what
omission already meant.

Still open, and deliberately not written yet: whether section 4's remedy for a
changed base — a full rebuild — should become "state the invariant, and let
the emitter satisfy it by re-derivation on carry or by a full rebuild". The
invariant is not in dispute: every `mirrors` member in an index is derived
from the bases committed at that index's own commit. The question is whether
`mica-build`'s re-derivation on carry covers **every** carried entry,
including entries carried from an index cut before `mirrors.list` existed and
the case where the previous index carries no `mirrors` at all. If it does, the
spec should mandate the property and not the mechanism; if any path lets an
old member survive, the full rebuild stays. That answer is `mica-build`'s to
give, and the wording waits for it.

## 2026-09-16 19:05 [spec]

Answered ahead of the question, because it is the spec's to answer: **what
happens when the committed mirror base changes between two indexes**
(`docs/design/mica-index.md` section 4). If it changed since the previous
index, the cut is a **full rebuild**. `mirrors` is derived at the index's own
commit, so carrying an entry would leave a member derived from the old base
sitting beside entering entries derived from the new one — the file would
disagree with itself, and `verify-index --full`, which re-derives every entry
from the base at that commit, would not reproduce the incremental cut. One
rule survives instead: every `mirrors` member in an index is derived from the
base committed at that index's commit. The first index that emits the member
at all is a full rebuild for the same reason.

The cost is a rebuild on the rare cut where the list moves, which is the
cheaper half of the trade: the alternative is an index that verifies only if
the verifier knows which entries were carried and which entered, and that is
exactly the state the byte-identical rebuild exists to avoid.

## 2026-09-16 18:50 [spec]

Two corrections, both to text written today.

**The protected set takes a hop, and the hop is now part of the rule**
(`docs/design/release-lock.md` 2.1, from `mica-res` implementing the query). A
consumer release lock carries no `image` rows at all, only its products, so
"walk the published locks and collect image references" read literally yields
**nothing** — an empty protected set and the conclusion that everything is
prunable, which is a silent wrong answer in the one direction that destroys
data. The rule now says what to do: for each published release take the commit
its lock names, read `locks/mica-build-env.lock` at that commit, and collect
the image references there; `mica-build-env`'s own lock is the exception that
carries `image` rows directly. With the numbers, so the rule is checkable:
`20260915-0138` is named by 17 published locks and `20260916-0735` by 19, both
failing the first clause, and the derivation re-runs on every sync rather than
being kept as a list, so the set moves when a lock moves.

**The mirror reachability finding was mis-scoped, by the coordinator and then
by me.** `res.micaos.dev` serves CI and the developer machine normally. What
was measured unreachable on 2026-09-16 is the agent containers on one host:
from inside a container `188.114.96.5`, `188.114.97.5` and `172.67.0.1` time
out while `104.16.123.96` and `1.1.1.1` open instantly, with no proxy
variables and a plain docker bridge route — container egress, almost certainly
host-side routing that does not cover the bridge. `docs/design/mica-index.md`
3.1 now says that, and says that nobody has measured a fetch through the
mirror hook, so no page claims one either way. It was never a property of the
mirror or of the development network, and a caveat with the wrong scope is
worse than none: it would have had someone chasing a design problem that does
not exist.

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

## 2026-09-17 07:55 [progress]

The download catalogue's `refreshedAt` stood at 2026-09-16 19:30:38 the next morning: one
cron refresh had succeeded, and roughly twenty since had not, with nothing anywhere to say
why. `scheduled()` swallowed its errors, and there is no Cloudflare access from here to read
cron logs. A manual refresh at 05:21 succeeded, so neither the parser nor the source was
broken.

Every refresh now goes through `recordedRefresh`, which writes a `catalog-status` key: when
the attempt ran, whether the cron, a manual refresh or the empty-store fill started it, when
one last succeeded, and the error of the last failure — cleared by the next success.
`GET /api/catalog` answers it as `status`. It is a separate key so a failed attempt never
rewrites the rows the pages read. A GitHub failure message carries the rate-limit headers,
because an exhausted anonymous limit and a permission refusal are both 403.

The likely cause is the anonymous GitHub limit — 60 calls an hour per egress IP, and the
Worker's egress is shared — but that is inference. The next failing cron will say. Covered by
`worker/index.test.ts`, the first tests the Worker has had.

## 2026-09-17 08:01 [progress]

The first recorded cron refresh settled the cause: `github answered 403 (rate limit remaining
0)` at 08:00:43, five minutes after a manual refresh through the same Worker had succeeded.
The cron and request paths leave through different, shared egress addresses, and the
anonymous API allowance on the cron's was already spent.

The API call exists only to find the latest release. `https://github.com/<repo>/releases/
latest/download/mica-index.json` answers 302 to the latest release's asset without touching
the API or its limits, which would make a token unnecessary rather than merely helpful.

## 2026-09-17 08:15 [progress]

The catalogue refresh no longer calls the GitHub API. It fetches
`https://github.com/micaoss/mica-build/releases/latest/download/mica-index.json` with
`redirect: 'manual'`, reads the release name from the redirect's location, then fetches the
asset. That URL is outside the API, so the anonymous rate limit that the cron's shared egress
address had exhausted does not apply, and no token is needed — `GITHUB_TOKEN` is gone from the
Worker's environment and from the index check's workflow step.

`bun run check:index` reads the same URL, so the hourly CI check now exercises the path
production takes rather than a neighbouring one. A 404 there says the latest release carries
no index; any other non-redirect answer is named with its status.

## 2026-09-20 05:10 [decision]

The Worker no longer refreshes the download catalogue; CI builds it and writes it into KV,
and the Worker only reads.

Reading GitHub from a Cloudflare egress address does not work for this. The cron's refreshes
failed with `403 (rate limit remaining 0)` from the API; moving to
`releases/latest/download/mica-index.json`, which is outside the API, only changed the
symptom to `429`. Those addresses are shared and heavily used against GitHub, so neither the
anonymous API allowance nor the web download path survives on them. A GitHub token would have
fixed the API call, but CI needs no token and reads GitHub from GitHub.

So the website workflow's `index` job — already running hourly to check the live index —
now also parses it (`scripts/publish-catalog.ts`) and writes `catalog` and `catalog-status`
with `wrangler kv key put`. `deploy` waits on it, so a manual deployment leaves the catalogue
current. The cron is gone from `wrangler.jsonc`, and so are the Worker's refresh endpoint and
its `REFRESH_TOKEN`: refreshing on demand is `gh workflow run website`. The publish is refused
when an index names products and none parses, which is the guard that kept an empty catalogue
off the board pages when the release stamp changed form.

This needs the deploy token to carry **Workers KV Storage: Edit**. If it does not, the
publish steps fail loudly in CI rather than leaving the catalogue silently stale.

## 2026-09-21 12:19 [decision]

The update server leaves `mica-build` (`20260921-1216-remove-update-server`,
plan `20260921-1217`). The user's ruling: the fleet service implements update
distribution completely, the assembly does component work only, and updates
are not its responsibility; the protocol documentation stays.

Deleted in `mica-build`: `update-server/` (44 files: the Bun, Hono and SQLite
service, its admin API, web page, catalogue signing and import), its CI gate
step, and the four lifecycle files that only existed to publish through it
(`acquisition.sh`, `offline-clock.sh`, `publish.ts`, `http-measure-server.ts`)
together with the `source-url` branch of the guest harness they fed. Measured
before deleting: none of the four was called by any suite; only
`build/HARNESS.md` named them. `shared/update-envelope.ts` stays, `build/`
imports it on its own.

Rewritten here: `docs/user/update-packages.md` section 11 and its Chinese
page say the server is the fleet service's (`micaoss/mica-fleet`) and this
repository ships the archives, the index and the section 10 contract;
`docs/user/release-notes.md` section 3, its Chinese page and
`docs/website/downloads.md` *Publication* now claim what `mica-build`
publishes with evidence that exists (`tools/release.sh`, `mica-index.md`)
instead of citing a deleted directory the docs gate accepts by shape;
`docs/design/updates.md` names a catalogue server rather than this
repository's; the harness gate row is gone from `docs/design/build-harness.md`;
the 2026-09-15 update-packages decision keeps its text and carries the date
in its status line. Section 10, what the device demands of any server, is
unchanged.

## 2026-09-21 13:40 [progress]

The records of `mica-boards` join this repository with the merge
(`20260921-1140-merge-boards-into-build`): its 20 task and 3 plan detail
files are copied unchanged into `docs/task/` and `docs/plan/` under their own
identifiers and listed in the indexes with the markers their statuses map to
(`done` and `landed` to `[x]`; `open`, `review` and `proposal` to `[ ]`; their
owner is `tdpnmgkr`), and its changelog follows here verbatim, its entries in
their original order under one heading, so that nothing it recorded is lost
and nothing is rewritten. Records of the retired repository cite its files as
`mica-boards:<path>`; the same files are `mica-build:<path>` now.

### The changelog of mica-boards, as it stood at `925e31d`

#### 2026-09-21 09:11 [fix]

`s905x5m.20260920-1536` shipped a kernel whose forced command line is not the
one the same release's `board.env` declares: the logo round added
`fbcon=logo-pos:center,logo-count:1 vt.global_cursor_default=0` to `board.env`
and not to `kernel/config/signed-boot.fragment`, which is where this board
keeps `CONFIG_CMDLINE`. Measured in the published component, both profiles. On
a FIT board the built-in line is what the device boots with, so it is not
cosmetic, and the assembly refuses to package it
(`mica-build:build/src/kernel-package.ts:149`, correct as written). The
fragment now carries the declared line and
`boards/s905x5m/tests/kernel-cmdline-test.sh` holds the two equal -- cx3576
had that test and this board did not, which is the whole gap. A new release is
required for the fix to reach anything. Recorded in
`docs/task/20260921-0911-s905x5m-forced-line-and-its-declaration.md`.

#### 2026-09-20 17:30 [progress]

The lock vectors are mica's, at the commit `tools/vectors.pin` names, with
`tests/vectors/excluded.tsv` declaring the paths this repository does not
carry and one reason each. `tests/vectors-sync-test.sh` (`make
vectors-sync-test`, CI beside `make deps` because it is the one gate that
reaches the network) fetches that commit and refuses any other difference in
either direction, compared as blobs; `expected.tsv` is rebuilt from canonical
rather than copied, and all five of its refusals were observed before it was
recorded. The refresh found the copy was canonical at `f742615` minus 14
files with EIGHT fixtures still naming `x64`, the board this repository
retired on 2026-09-16. `tools/check-lock.sh` gained the `data` row
(release-lock.md 1.2.4, not base-only) and a `vectors-pin` mode for the pin
format, and the `repos/` vectors -- carried and skipped by the only thing
that read them -- are declared rather than counted. 82 assertions to 95, 64
vectors to 74. Recorded in
`docs/task/20260920-1730-the-vectors-are-read-from-mica-at-a-pin.md`.

#### 2026-09-20 17:00 [progress]

The shared kernel floor is a file row of every board bundle:
`common/kernel/mica-required.fragment` ships beside the config it resolved,
as `kernel/mica-required.fragment` on the UEFI boards and under
`kernel/dev/` and `kernel/prod/` on the FIT boards, one `outputs.tsv` row
each. mica-build asserts the floor against the config of the bundle it fetched
at its pin (`build/src/kernel-package.ts`) and keeps no copy of the symbol
list -- the reader this replaces carried one and decayed. Both halves of the
fragment are asserted there, the `=y` lines and the `# ... is not set`
lines, so the gap found earlier today is not rebuilt one repository further
out; a stale bundle fails its own floor instead of passing quietly. The off
half also ran on cx3576 and s905x5m for the first time in CI 35521519448 and
holds on both, although their vendor inputs carry six of the nine symbols
`=y` before the floor is merged over them. Recorded in
`docs/task/20260920-1700-the-floor-travels-with-the-config.md`.

#### 2026-09-20 16:00 [progress]

A `# CONFIG_X is not set` line in a kernel fragment is a REQUEST: kconfig
grants it unless something enabled `select`s the symbol, and nothing in this
repository asked afterwards whether it had been granted. Both halves of the
shared floor are now asserted over the resolved config --
`common/kernel/floor-check.sh` and both UEFI kernel Dockerfiles refuse any
`CONFIG_X=` line for a symbol a fragment records off -- with
`tests/floor-check-fixtures.sh` (eight fixtures) as the negative half in
`make check`. Run over the two recorded resolved configs it found twenty
denied requests. One is a shared floor line: `CGROUP_NET_CLASSID=y` on
uefi-x64, selected by `NET_CLS_CGROUP=y` from that board defconfig, which
uefi-arm64, s905x5m and cx3576 do not set; the classifier is now named off,
which is the two-line change to that board config. Of the nineteen on
uefi-arm64, deleting all of them moved exactly one symbol
(`MDIO_BCM_UNIMAC`, `m` to `y`), so eighteen were inert and one was partly
granted; it is now written as `CONFIG_MDIO_BCM_UNIMAC=m` and that board
recorded config is byte-identical to `uefi-arm64.20260920-1536`. Recorded in
`docs/task/20260920-1600-a-fragment-off-line-is-a-request.md`.

#### 2026-09-20 [progress]

Measured while costing the boot logo, and it corrects a shorthand rather than
only adding a number: a LOCAL CROSS build of the uefi-arm64 kernel reproduced
byte for byte what a NATIVE arm64 runner published
(`kernel.uefi-arm64.20260916-0857`, `Image` 24537600). So cross-versus-native
is not the variable that decides whether two builds agree -- whether they use
the same pinned toolchain is. The emulated-on-target pool agreed with the
native one, mica-core's Rust disagreed with a DIFFERENT cross toolchain, and
this agrees with the SAME bsp compiler used as a cross.


#### 2026-09-20 [progress]

First hardware observation of Mica OS on cx3576, read out of the console
capture rather than summarised: the vendor loader verified this project's key
on real silicon (`sha256,rsa2048:mica+ OK` for kernel, fdt and ramdisk), the
signed command line carried `dm_verity.require_signatures=1` and
`mica.profile=prod`, native init selected and verified its deployment, and
`mica-health.service` confirmed it. The kernel identifies itself as `6.1.115`
built by the bsp toolchain with `#1 SMP @1577836800` -- the `kernel.release`
`cx3576.20260917-1007` published, pinned by `mica-build`'s
`cx3576.20260919-2356`, so the run binds to published bytes. `evidence.json`
records the observation and stays I1: the capture is a loader-initiated warm
reset, so it is neither the cold-boot nor the warm-boot qualification row, and
the enforcement half of I3 -- an unsigned FIT refused on the same bench -- is
not observed. Recorded in
`docs/task/20260920-cx3576-first-hardware-capture.md`, which also lists what
the capture does not establish.


#### 2026-09-19 [progress]

`s905x5m.20260919-2259`, this board's first release as a release target, from
`a15dbf8`. The board component rebuilt and now carries `evidence.json`, the
kernel rebuilt BYTE-IDENTICALLY (14 of 14 layers, so the mirror hook moved its
inputs and not its output), the U-Boot rebuilt and differs in exactly the four
files of the vendor-signing defect, and the firmware was reused by digest. Two
method corrections came out of the round and are recorded as method: a version
bump propagates along declared dependencies and an inputs hash cannot see a
version pinned in a sibling producer's control template, so the package gate
is what answers "what does this bump cost"; and what a release will reuse is
asked by comparing component inputs against the LATEST RELEASE, not against
the working tree's parent.


#### 2026-09-19 [progress]

s905x5m is a release target (`BOARD_RELEASE_TARGET=1`, user decision). Its
`evidence.json` was written first, because `mica-build`'s release manifest
requires one and derives the product's boot assurance from it: I1, the same
grade as cx3576 at the same support tier, with the physical boundaries of this
board's Amlogic USB recovery path and a qualification that states plainly what
is not established -- no image published before, physical rows untested,
RFCT-922 open, and a loader that does not rebuild byte-identically. The flag
costs five package versions, not the one the inputs diff predicted:
`mica-board-s905x5m` `0.1.0-3`, and with it `mica-s905x5m-wireless`,
`mica-s905x5m-wifi` and `mica-bm201-front-panel` `0.1.0-4` and
`mica-s905x5m-bluetooth` `0.1.0-7`, because three control templates pin a
cross-producer dependency by literal version and an inputs hash cannot see a
version written into a sibling producer's control file. The kernel, U-Boot and
firmware components are unchanged and reused by digest. None of this
claims the board works on hardware.


#### 2026-09-19 [progress]

A mirrored tree whose manifest resolves but whose chunk does not now names the
chunk and its status -- `the mirror has the manifest of <name> <commit> but not
its chunk <i> of <n> (curl 22, HTTP 404, ...)` -- and
`tests/mirror-hook-test.sh` keeps the case that produces it. It is the real one:
the restored mirror 404s on `uefi-x64-kernel` `.pack.00` because the two UEFI
trees do not share a pack after all (different pack digests; only their first
chunk hashes the same, stored under the arm64 name). The hook routes around
nothing -- no sibling name, no digest fallback, no special case for chunk 00 --
it falls back to the clone and says why.


#### 2026-09-19 [progress]

A mirror miss now says why. `mirror_get` records `curl <exit>, HTTP <code>,
<n> redirect(s), <final url>`, a miss prints it and a hit that followed a
redirect says so, because "not mirrored" alone is how the mirror could stop
answering between 2026-09-17 (11 of 11 fetches mirrored) and 2026-09-19 (0 of
11) with every run green. Both halves of the contract have always followed
redirects -- one `mirror_get` with `-L` serves the digest lookups and the pack
chunks alike -- and `tests/mirror-hook-server.py` now proves it by answering a
`/r/` prefix with a 302 and fetching an archive and a two-chunk pack through
it.


#### 2026-09-19 [progress]

The board-independent radio packages stay in each board's pool, recorded with
its reason in `docs/task/20260919-1945-shared-radio-packages-stay-per-board.md`:
a board release is self-contained, and the duplication a consumer sees
(`mica-bluetooth`, `mica-wifi` and `mica-wifi-ap`, identical in `cx3576` and
`s905x5m`) is collapsed where two boards are composed, which is the only place
that sees both. The equality is by construction -- no producer of these takes a
board input of any kind -- and the one vector that could have broken it was
measured away: built on an amd64 host they are byte-identical to the archives
the arm64 runners published. A board that ever needs different radio bytes gets
a different package name, as `mica-s905x5m-bluetooth` already does.


#### 2026-09-18 [progress]

The git half of the mirror hook follows mica-res's rebuilt resource service:
`common/scripts/fetch-source.sh` asks for `upstream/git/<name>/<commit>.json`
and its `.pack.<NN>` chunks without the retired `d/` prefix;
`res.micaos.dev` redirects them to the R2 download host and `mirror_get`
follows. Archives are still looked up at `blob/<sha256[0:2]>/<sha256>`, which
only `res.micaos.dev` answers, so `MICA_MIRROR` is unchanged.
`tests/mirror-hook-test.sh` serves the new layout (25 assertions).

#### 2026-09-17 [progress]

`boards/cx3576/flash/assets/splash.png` shows the **Mica OS** icon above its
wordmark instead of the retired **YBO - Hub OS** text. mica-res's
`mica/brand/logo/mica-os-icon-dark.svg` (360 px wide, at +656+184) and
`mica-os-wordmark-dark.svg` (600 px wide, at +536+552) are rasterised with
`rsvg-convert` and composited on a 1672x941 radial gradient from
`rgb(6,76,95)` to black (radii 760x480) with ImageMagick, and saved as 8-bit
truecolour without alpha or timestamps (`debian:trixie-slim`, `librsvg2-bin`,
`imagemagick`). `mklogo.py` derives a 720x405 logo of 223 colours from it. The
bench collector's expected-logo prompt names Mica OS, and `tests/publish-test.sh`
finds the reference lock checker at `../mica` beside this checkout instead of
the retired `/srv/ybolab` path.

#### 2026-09-16 [progress]

Every builder fetches through `common/scripts/fetch-archive.sh` and
`common/scripts/fetch-source.sh`, which try mica-res's mirror before a pinned
row's own URL: `blob/<sha256[0:2]>/<sha256>` for a `source` row, and for a `git`
row the `mica/git-pack/v1` manifest, its chunks in order and `git index-pack`.
A lock URL is never rewritten -- it is in the component inputs hash -- so
`MICA_MIRROR` is a fetch-time environment variable and is nowhere in
`tools/inputs.sh`. Wrong bytes from the mirror are refused rather than fetched
again; a 404, a refused connection and a timeout all mean "not mirrored" and
cost one three-second connect. `tests/mirror-hook-test.sh` (25 assertions,
`make check`) serves the contract locally, and a real `uefi-x64` source stage
with the mirror set but unreachable *from this build host's container egress*
-- it answers from GitHub runners -- fell back after 3.178 s.
`mica-s905x5m-bluetooth` is `0.1.0-6`: the board Makefile carries the mirror
argument and that file is in its `PREPARE_INPUTS`. Decided the same day and
recorded in the task: `PREPARE_INPUTS` is not narrowed. One bump on one package
per board-Makefile edit is the accepted cost; an under-declared input would be
a package shipped stale and found by a device rather than by CI.

#### 2026-09-16 [progress]

The s905x5m recovery packer runs on `linux/amd64`, not `linux/386`: the pinned
`aml_image_v2_packer` is a statically linked i386 binary an x86-64 kernel runs
directly, and packing the published `20260916-0857` U-Boot artifacts on amd64
reproduces that release's `update.img` and `aml_sdc_burn.ini` byte for byte. It
is also deterministic, so `update.img` follows the two signed U-Boot binaries
rather than being a second reproducibility defect. That removes the only
`linux/386` platform in the repository. There is no 64-bit vendor packer to pin
instead, and `aml-imgpack.py` packs `AML_RES!` resource images, not this
`0x27b51956` container.

#### 2026-09-16 [progress]

`mica-s905x5m-bluetooth` is `0.1.0-4` (epoch 1789545600): the bsp switch edited
`boards/s905x5m/Makefile`, which that producer declares in `PREPARE_INPUTS`, so its
inputs moved while its version did not and the guard refused it in CI. Measured
against the published pool of `s905x5m.20260916-0558`, it is the only producer of
any board whose inputs the switch moved; the other seven packages of that board
rebuild byte-identical under the bsp toolchain, as do cx3576's four. Third time in
one day that the version guard has caught an input change a human would have
shipped (the `tools/deb/producers.sh` pipe-hygiene edit, mica-core's `mica-apid`
after a lint edit, and this Makefile edit reaching a package through
`PREPARE_INPUTS`).

#### 2026-09-16 [progress]

The kernel, U-Boot and loader builders build FROM the mica-build-env `bsp` image
(release `20260916-0735`, pinned by digest in `locks/mica-build-env.lock`) instead
of installing a toolchain from the Ubuntu archive snapshot: no build of this
repository fetches an apt byte any more, and the 502/503 outage of
snapshot.ubuntu.com earlier today is exactly the failure this removes.
`common/scripts/apt-install.sh`, `tools/apt-snapshot.sh` and the three
`ubuntu-<suite>` rows of `locks/upstream.lock` are gone; the toolchain enters the
kernel and U-Boot inputs as the image digest (`tools/inputs.sh`), and the cross
packages come with the image's amd64 variant rather than from
`KERNEL_CROSS_PACKAGES`, which is retired with them. The three vendor toolchains
of the s905x5m U-Boot stay `source` rows fetched at their pinned sha256.

#### 2026-09-16 [progress]

The generic systems are named by their firmware class (user decision 2026-09-16):
`boards/x64` is `boards/uefi-x64` and `boards/virt-arm64` is `boards/uefi-arm64`;
the hardware boards keep their names. The packages are new names with fresh
declared versions, `mica-board-uefi-x64` and `mica-board-uefi-arm64` at `0.1.0-1`
(not bumps of the old ones); `boards/boards.tsv`, each board's `outputs.tsv`, the
kernel config and required file names, the `<board>-kernel` git rows of
`locks/upstream.lock`, the tests, the READMEs and `evidence.json` follow. Every
identity stays as it was -- the partition GUIDs, the filesystem UUIDs and the ESP
volume ids are the same boards under new names.

uefi-arm64 is now the generic UEFI/ACPI arm64 image and a release target
(`BOARD_RELEASE_TARGET=1`). Its kernel keeps virtio and adds what a generic UEFI
machine needs to reach its root before any module can load: NVMe, AHCI/SATA, SCSI
disk, USB mass storage behind xHCI/EHCI, PCIe port services, HID, ACPI, DMI and
the EFI and PL031 clocks. The physical NIC families (Intel, Realtek, Broadcom,
Mellanox, Aquantia) and their PHYs are modules: networking is not on the path to
the root. SD/eMMC is deliberately absent -- a machine that boots from a platform
MMC controller is a hardware board, not this image.
`kernel/config/uefi-arm64.required` now holds mica-build's list (read from the
built config of its bundle, every entry `builtin`) together with that hardware
set, and `tools/kernel-config-test.sh` holds the resolved config to it.

#### 2026-09-16 [progress]

Board release tags are `<board>.<YYYYMMDD-HHMM>` (user decision 2026-09-16, mica
`docs/decisions/2026-09-16-scoped-tags-use-a-dot.md`; spec f742615). No
compatibility form: `tools/check-lock.sh` splits a release row at its last dot, so
a slash leaves the release out of form and is refused as `field-value`
(`tests/vectors/lock/refused/release-slash.lock`). `tools/deb/registry.sh` matches
and splits the tag on the dot, `release.yml`'s scope job parses it, and
`tools/reuse.sh` and `tools/deb/version-guard.sh` resolve "the board's latest
release" by the `<board>.` prefix. The spec vectors were re-copied at the dot form;
`tests/publish-test.sh` and `tests/version-guard-test.sh` tag their fixtures with
it, and the version-guard test now declares the version it asserts. Pins are
unchanged (`RELEASE` and `SCOPE` stay separate fields).

#### 2026-09-16 [progress]

Every producer's revision is bumped (epoch 1789516800): the pipe-hygiene commit
edited `tools/deb/producers.sh`, which the package inputs hash covers as packaging
tooling, so the version guard refused the unchanged versions in CI -- the guard
working as designed. `mica-board-*`, `mica-wifi`, `mica-wifi-ap` and
`mica-bluetooth` are `0.1.0-2`; the s905x5m extras `mica-s905x5m-bluetooth`,
`mica-s905x5m-wireless`, `mica-s905x5m-wifi` and `mica-bm201-front-panel` are
`0.1.0-3`, with their literal cross-producer pins moved with them.

#### 2026-09-15 [progress]

Early-exiting readers on the right of a pipe, the defect class mica docs found in
its own gate. Fixed here: `tools/deb/registry.sh` held `printf | grep -qxF` as the
membership test for the release tag -- under `pipefail` it reports failure exactly
when the tag is found and the writer still has bytes to write, so a release whose
HEAD carried several tags could fail on the tag it had -- now a loop; and the
`| head -n1` pipelines of `tools/component.sh`, `tools/deb/producers.sh`,
`tools/kernel-config-test.sh`, `tools/new-board.sh`, `tests/board-contract-test.sh`
(`grep -m1`), `tools/deb/oci.sh` (an `awk ... exit` over the header file),
`boards/cx3576/tests/{kernel-cmdline-test,gadget-configfs-test}.sh` and
`boards/cx3576/tests/bench/collect.sh` (three), where a second match would kill the
producer with SIGPIPE. `tests/shell-lint.sh` now also scans a library sourced by a
file that sets pipefail -- registry.sh was out of its scope, which is why the defect
survived there.

#### 2026-09-15 [progress]

cx3576 flashing, three fixes found while writing the product documentation's
flashing guide: `loader/MiniLoaderAll.bin.sha256` named `uboot/MiniLoaderAll.bin`,
so `make flash-maskrom` failed at its checksum step before reaching
`rkdeveloptool db`; `flash/rkdeveloptool/build-macos.sh` installed the built
binary in `boards/cx3576/tools/` while the Makefile looks in
`boards/cx3576/flash/tools/` (now the build's output, and git-ignored); and
`BUILD.md` and `flash/rkdeveloptool/README.md` still named `make flash` and
`make flash-rootfs-offline`, targets this board no longer has. The flashing
section now describes the two targets it has, the image they take and the
geometry preflight.

#### 2026-09-15 [progress]

CI reuses kernel and U-Boot components (user decision on the kernel speed report,
proposal 2): the plan no longer builds a kernel or uboot component whose inputs
hash equals the one the board's latest published release carries
(`tools/reuse.sh`); that release is the proof the component builds. A push or
pull request that changes a file the component jobs run but the inputs hash does
not cover (`BUILD_FILES` in `build.yml`: the workflows, the root `Makefile`, the
lock, pin and output tools, `tools/inputs.sh`, `tools/reuse.sh`) builds every
component without moving any component's inputs; so does a run with no base
commit (a manual run) and a push whose previous head is not an ancestor of the new
one (a force-push). A multi-commit push is compared from its previous head, so
every commit in it counts.

#### 2026-09-15 [progress]

The GitHub release listing of `tools/reuse.sh` and `tools/deb/version-guard.sh`
sends the workflow's `GITHUB_TOKEN` when one is handed in: anonymous API calls
from the shared runner addresses were refused with 403 in CI. The locks and
artifacts are still read anonymously.

#### 2026-09-15 [progress]

virt-arm64 kernel trimmed to mica-build's QEMU virt guest (its evaluation of
the speed report, 2026-09-15): the board fragment switches off at their menus the
physical platforms, SoC buses and peripherals, USB, radios, wired Ethernet
hardware, display, sound, media, extra input, SCSI/ATA/NVMe/MMC, unattached virtio
devices, filesystems nothing mounts and crypto accelerators. The resolved config
goes from 3272 built-in and 1134 module symbols to 1319 and 75; the kernel ships
71 modules instead of 1273. `kernel/config/virt-arm64.required` lists the guest's
symbols (`builtin` =y, `runtime` =y or =m), held by `tools/kernel-config-test.sh`;
`common/kernel/mica-required.fragment` is unchanged.

#### 2026-09-15 [progress]

Kernel and U-Boot builds (user decisions on the kernel speed report). FIT boards
compile their kernel once: dev is built whole, prod only moves the forced command
line (`common/kernel/set-profile.sh`) and relinks the Image in the same tree, with
the modules, device tree and regulatory certificates of that build;
`KBUILD_BUILD_VERSION=1` keeps the relink's version string. `make <board>-kernel-profile-test`
builds prod alone and requires every file byte-identical to the relinked one
(`common/kernel/profile-test.sh`). Every kernel and U-Boot builder installs its
toolchain from the Ubuntu archive snapshot 20260915T000000Z, pinned by the sha256
of each suite's signed InRelease in the `ubuntu-<suite>` source rows of
`locks/upstream.lock` (`tools/apt-snapshot.sh`, `common/scripts/apt-install.sh`,
part of the kernel and U-Boot inputs); the s905x5m recovery packer is fetched by
`ADD --checksum` into the pinned Debian image with nothing installed. The profile
test found the s905x5m kernel was not reproducible at all: three vendor
`common_drivers` Makefiles compiled a wall-clock `BUILD_TIME`; kernel patch 0018
takes it from `SOURCE_DATE_EPOCH`.

#### 2026-09-15 [progress]

The s905x5m Bluetooth userland builds in the mica-build-env `c` image, pinned by
digest in `locks/mica-build-env.lock`, instead of installing Debian's
build-essential unpinned on `debian:trixie-slim`, so its compiler cannot move under
an unchanged `mica-s905x5m-bluetooth` version (the payload is byte-identical to the
0.1.0-1 build); the pool job's userland prefix cache is gone with that stage. A
control template pins another producer's package by its literal version
(`@VERSION@` only within one producer). `mica-s905x5m-bluetooth`,
`mica-s905x5m-wireless`, `mica-s905x5m-wifi` and `mica-bm201-front-panel` are
0.1.0-2 (epoch 1789473600).

#### 2026-09-15 [progress]

Package versions (user decision, mica `docs/decisions/2026-09-15-package-versions.md`):
a package is locked by its declared version and a release never changes it. Each
producer declares `VERSION` and `SOURCE_DATE_EPOCH` in `version.env` beside its
control templates (`boards/<board>/package/version.env` for the board producer);
every producer starts at `0.1.0-1`, epoch 1789430400. The root `VERSION`,
`tools/deb/version.sh`, `VERSION_FROM` and the `Mica-Source-Commit` field are gone.
`tools/deb/package-inputs.sh` no longer hashes build-env images and takes a hook's
inputs from `PREPARE_INPUTS`; `tools/deb/version-guard.sh`, run in `build.yml`'s pool
job for every board in CI and for the release's board, refuses changed inputs
without a bump, a lower version and an unchanged version whose bytes moved. Pool
manifests carry only `mica.source-repo` and `mica.arch` (layers: title,
`mica.inputs`), so an unchanged pool keeps its digest. The package gate checks each
archive against its declared version instead of one git stamp. This replaces the
identity-rebuild reuse of the entry below (`tools/deb/reuse.sh`,
`tests/package-reuse-test.sh` removed); `tests/version-guard-test.sh` (`make
version-guard-test`) covers it.

#### 2026-09-15 [progress]

Package reuse by inputs (user decision): a board release keeps an unchanged
package at its published version and bytes instead of re-versioning it. Each pool
layer carries its producer's inputs hash as `mica.inputs`
(`tools/deb/package-inputs.sh`). In a board release's pool job,
`tools/deb/reuse.sh` reads the board's latest release, downloads the archives of
every producer whose inputs are unchanged at their layer digests, holds them to
that lock's package rows, rebuilds the producer as their identity
(`MICA_DEB_IDENTITY`: Version, Mica-Source-Commit, SOURCE_DATE_EPOCH) on an
empty-cache builder and takes them only when byte-identical, and writes
`reused.tsv`; a missing, mismatching or unreproduced archive stops the release.
The package gate holds reused archives to those rows like imports, the publisher
accepts them from their own commit and, when every archive is reused and the
layers are the previous pool's, puts that pool manifest under the new tag. No lock
row or specification change. `tests/package-reuse-test.sh` (`make
package-reuse-test`): reused, rebuilt, pool digest kept, and three refusals.

#### 2026-09-15 [progress]

`images.tsv` declares update packages too: every board has `image disk builtin -
img` and `update full|root|kernel builtin - micaupd|root.micaupd|kernel.micaupd`.
`board-contract-test`: an image disk builtin row and an update full row, builtin
only on disk among images, update kinds full, root and kernel (all builtin), `-` as
the runtime image of a builtin row and a build-env image row otherwise, kinds and
suffixes unique within each row type.

#### 2026-09-15 [progress]

Workflow outputs travel as uniquely named tars (`tools/ci-outputs.sh`), uploaded
as `<scope>-<name>` and downloaded with `merge-multiple`: a board release's single
pool artifact failed `build / pools` because `download-artifact` extracts a single
matching artifact into the path itself, and the components check silently took an
undownloaded kernel for a reused one. The components check now expects exactly the
tars the plan built, and `ci.yml` also runs the one-board path (`build-board`, x64).

#### 2026-09-15 [progress]

Flashing formats (user decision): every board declares what it is flashed with in
`boards/<board>/images.tsv` (`# mica-boards images v1`; rows `image <kind> <packer>
<runtime image> <suffix>`), carried in its board component and covered by its
inputs hash. All four boards declare `image disk builtin mica-build-env:base img`.
`IMAGE_KINDS` is gone from `board.env`; `board-contract-test` requires the disk row
with `builtin`, no other `builtin` kind, unique kinds and suffixes, and runtime
images named by `locks/mica-build-env.lock`.

#### 2026-09-15 [progress]

Board components (user decision, mica 1cd0fdd): a board release publishes its
components as separate artifacts, `<component>.<board>.<YYYYMMDD-HHMM>` --
board, kernel, and uboot and firmware where the board has them
(`tools/component.sh`) -- each annotated with `mica.component` and `mica.inputs`,
the sha256 of everything that determines it (`tools/inputs.sh`). A component
whose inputs equal the same component of the board's latest release is reused by
digest and not built (`tools/reuse.sh`, `tools/publish-components.sh`). The lock's
board rows are `board <board> <component> <arch> <reference>`; `outputs.tsv` names
`file <component> <path>`; `mica-kernel-<board>` is retired. `build.yml` builds
each board's kernel natively on its architecture's runner and U-Boot on x86-64
(the FIT host tools the assembly runs there; s905x5m's i386 packer).

#### 2026-09-15 [progress]

Releases are per board (user decision): `gh release create <board>/<YYYYMMDD-HHMM>`
builds, gates and publishes that board alone -- `pool.<board>.<arch>.<YYYYMMDD-HHMM>`,
`board.<board>.<YYYYMMDD-HHMM>` and a `mica-boards.lock` whose release row is
`<board>/<YYYYMMDD-HHMM>`. `boards/boards.tsv` lists the supported boards, one
row each (architecture, boot backend); `boards/<board>/outputs.tsv` names the
board's pool packages and bundle files and travels in its bundle. `tools/boards.sh`
reads them for `build.yml` (the plan job), `make pool POOL_BOARD=`, the package
gate (`--board`), the publishers, `release-lock.sh`, `make offline` and
`board-contract-test`. CI keeps building every board.

#### 2026-09-15 [progress]

Release lock (mica:docs/design/release-lock.md). Inputs are in `locks/`:
`locks/mica-build-env.lock` with `locks/pins/mica-build-env.pin` (mica-build-env
`20260915-0138`) gives every image, build-env images by name and third-party
images by their upstream rows (`tools/from.sh`); `locks/upstream.lock` pins the
kernel, U-Boot and rkbin trees as git rows and the s905x5m toolchains and
packer as source rows (`tools/upstream.sh`). `build-env-image.lock`,
`build-env-release`, `base-images.env`, every `sources.env` and the UEFI
`kernel/versions.env` are gone; the UEFI kernels check their tag's commit.
`tools/check-lock.sh` implements the file rules, `tests/locks-test.sh` runs it
over the specification's vectors. A release carries `mica-boards.lock`
(release, pool, package and board rows) and `SHA256SUMS` only
(`tools/release-lock.sh`), written after every pool and bundle reads back
anonymously; both publishers refuse a tag holding another manifest digest.

#### 2026-09-14 [progress]

The project name is mica everywhere in the tree: the shared inputs are
`common/kernel/mica-required.fragment` and `common/uboot/mica-records.h`; the
build contexts `mica-common`, `mica-trust` and `mica-boot-trust`; the verity
anchor `certs/mica-verity-anchor.pem`; the U-Boot policy `MICA_FILE_BOOT`
(`loader/mica-file-boot.c`, `loader/build-mica.sh`, stage `artifact-mica`),
its environment key `mica_entries` and the `/chosen/mica,deployment-id`
property; the cx3576 targets `uboot-mica` and `flash-mica`; the buildx
builders `mica-<arch>`. The FIT boards build one kernel per image profile
(`kernel/dev/`, `kernel/prod/`), each forcing `mica.profile=<profile>` on its
command line. The build-env images are those of mica-build-env
`20260914-1129` (`build-env-image.lock` and `build-env-release` replaced
whole).

#### 2026-09-14 [progress]

Workspace rules and mica-build-env `20260914-0128`
(`20260914-0514-workspace-rules-and-build-env`). The images come from
`build-env-image.lock` (verified against the release's `SHA256SUMS`,
recorded in `build-env-release`) and `base-images.env`, through
`tools/from.sh`; the `build-env/` source pin, `tools/deps.sh` and `deps/` are
gone. Packaging, the package gate and the publisher are this repository's own
under `tools/deb/` and pack in `IMAGE_MICA_BUILD_BASE`. Releases are
`gh release create <YYYYMMDD-HHMM>`: `release.yml` builds that tag and
publishes `pool.<arch>.<release>` and `board.<board>.<release>`; `ci.yml` runs
the gates and, through the reusable `build.yml`, the BSP build on x64 (cross)
and one native pool job per architecture with its package gate. The cx3576
kernel hook reads the boot-logo master at `flash/assets/splash.png`, where the
board layout moved it (the kernel build had failed since).

#### 2026-09-14 [progress]

The boot split, step 3: the inputs this repository took from the `mica-boot`
source pin are its own, and the pin is gone. `families/common/kernel/` holds
`mica-required.fragment`, `kernel-config-test.sh` and `export-regdb-certs.py`;
`families/common/uboot/` `mica-records.h` and `embed-fit-trust.sh`;
`families/common/package/` `fstab.in` and `copyright` (taken from
`mica-boot` 302d9cc `common/`; only comments naming paths and key provenance
changed). `families/common/trust/stage.sh` is the
certificate-only half of the former `verity-tool.sh stage`: it validates a
public certificate bundle in the pinned OpenSSL image and stages it for the
kernel and U-Boot builds; signing and every private key belong to the
assembly, and nothing here generates keys. `tests/trust-stage-test.sh`
(`make trust-stage-test`, docker) covers it.

#### 2026-09-13 07:40 [progress]

Phase 1 of `mica:20260913-0416-board-product-build-architecture`, board
contract v2 and the family layer. Every `board.env` declares
`BOARD_FEATURES`, `BOARD_FAMILY` and `IMAGE_KINDS`; the package manifests
moved here from the assembly as `<board>/manifests/` and travel in the
`mica-kernel-<board>` bundle; `bsp/containers.env` is gone (the product
decides features). `families/` holds what the boards of one SoC line
share: `uefi` (x64, virt-arm64: one kernel Dockerfile), `rockchip`
(cx3576) and `amlogic` (s905x5m), each with its Dockerfiles, configure and
build scripts and source pins; a board keeps its configuration, device
tree, patches, firmware and the hooks the family calls, and names its
files in `bsp/bsp.env` (`families/README.md`). Proof: every board's kernel
rebuilt through its family byte-identical to a build of the same pins
before the change (config, release, modules, System.map, DTB; the
s905x5m `Image` carries a 25-byte vendor build stamp that differs between
any two builds, and its `modules.tar` now pins mtimes and order like the
other families'); cx3576 and s905x5m U-Boot likewise.
`tests/board-contract-test.sh` asserts the contract in `make check`.

#### 2026-09-13 19:30 [progress]

Created from `boards/{x64,virt-arm64,cx3576,s905x5m}/` of `mica-build`
(each kept through `git subtree split`, briefly a repository of its own,
then brought in here with that history under `<board>/`). The BSP builds
take the boot tooling from the `mica-boot` source pin at `boot/` and the
shared inputs from `boot/common`; a `mica-kernel-<board>` producer per board
packs the BSP outputs for the assembly. Published together as
`build-<commit12>` (`20260913-1600-split-boot-and-boards`).

## 2026-09-21 14:30 [progress]

`mica-boards` is merged into `mica-build` (`20260921-1140-merge-boards-into-build`,
plan `20260921-1142`, decision `2026-09-21-mica-boards-merged-into-mica-build.md`):
the boards' history imported under `boards/`, `common/` and `producers/`, the
tools and tests joined the assembly's, the lock checker, image resolver, pool
indexer and lock writer of the boards replaced by the assembly's own, the
`locks/mica-boards.*` pins gone, `tools/board-pool.sh` assembling a board from
the tree plus a local kernel build or the latest release's component by
inputs hash, the board packages built into the composer's pool, and one
release model in which a scoped release builds and publishes the scope's
board before its products (`release.yml`, `build-boards.yml`). The `board`
and `packer` components are not published any more (user). The proof and the
gates are in the plan's *Progress*. In this repository: `release-lock.md`
1.0, 1.2, 1.2.2, 1.3, 1.5, 2, 4 and 9, the reference checker and the
canonical vectors (the `scope-content` rule and the scoped consumer pins are
gone; the `board` rows are `mica-build`'s), `boards/contract.md` sections 1,
2, 3, 3.1 and 7, `architecture.md`, `user/build.md`, `user/releasing.md`
and their Chinese pages, `design/mica-index.md`, and the workspace
`AGENTS.md`.

## 2026-09-22 07:30 [progress]

The merge of `mica-boards` into `mica-build` is on `main`
(`20260921-1140-merge-boards-into-build`): `de476350..0e34a1b4`, 98 commits,
the import of `mica-boards` at `925e31d` with its history and the wiring
replayed onto the main that had moved under the branch. Before the push the
gates of the plan's *Progress* were green on the replayed branch, the
`uefi-x64-dev` product built from the tree's own kernel, `product-verify`
passed (106 checks) and the image booted and shut down in QEMU. The update
server followed as `abc59de2` and `90b72919`
(`20260921-1216-remove-update-server`). The first CI run of the merged main
builds every board's components, since no `mica-build` release has published
any yet. Open in the plan: P3 (`layout.tsv`, the dispatch rule, the fact
lint) and P4 (`mica-core`).


## 2026-09-22 07:34 [progress]

The `world` gate went red on the merged `mica-build` (run `35699972514`):
its `board-pin.*` rows read `locks/pins/mica-boards.*.pin`, which the merge
removed. `docs/world-claims.tsv` now reads the boards in `mica-build`
(`boards/`, `common/`), the `board-release.*` rows name `mica-build`'s newest
release per board (`20260920-0622`), and the four `board-pin.*` rows are gone
with the re-pin step; `containers.md`, `support-tiers.md` and `access.md`
say so where they stated those rows or cited the moved paths. 22/22 claims
hold.

## 2026-09-22 07:59 [progress]

Two readers the merge missed, found by the first CI run of the merged
`mica-build` main (`35699869336`) and fixed as `f8ad6bd1` and `2e8ebaef`:
the product job of `release-product.yml` expected every board's built tar
when `ci.yml` builds all boards in one run, and `tools/deploy-pool.sh
--check` read the fixture's board vocabulary against the `board` rows of
`locks/`, which the merge emptied; it reads `boards/boards.tsv` now. The
suites steps CI never reached were run by hand on the merged tree, all
green; the plan's *Progress* has the list.

## 2026-09-22 08:47 [progress]

Four more readers of the merged pool rows, found by `mica-build` CI run
`35702312526` and fixed as `6b596709`, `8c32e849` and `b76b23fe`: the
release manifest's tree lock now carries the tree's own packages as the
composer's lineage does (`tools/pool.sh own`), git trusts the mounted tree
inside the bun container, the consumer-policy test reads the producers'
declarations beside the pool rows, and producer discovery prunes `.tmp/`
and `repos/`. Each was reproduced locally first; the release-shaped
product build and the gates are green on `b76b23fe`. Details in the merge
plan's *Progress*.

## 2026-09-22 08:56 [decision]

One language and one layout for the `mica-build` engine
(`20260922-0815-one-language-one-layout`, plan `20260922-0817`, decision
`2026-09-22-mica-build-one-language.md`): approved by the user ("开始处理"),
with the boards' host-side tests in TypeScript, all five phases, the names
`src/`, `stages/`, `tests/{gates,suites,fixtures}/`, and external shell
that runs inside a container left as it is. The board directory comes
under one management: data and vendor inputs, no per-board Makefile,
flashing as documentation. P1 begins with one Bun package.

## 2026-09-22 09:37 [progress]

`mica-build` is one Bun package (`20260922-0815-one-language-one-layout`,
P1a; `e26ee3cf`..`44993e32`): `src/image`, `src/verify`, `src/shared`,
`src/cli.ts` the one entry, `bin/bun.sh` the one bootstrap, the QEMU and
API suites under `tests/suites/`, the gates `lint`, `typecheck` and `test`
at the root; every reader of the old paths, the workspace instructions
and the living records follow. The signed components of `uefi-x64-prod`
are byte-identical to the build before the move; the DATA image differs
in 40 bytes of timestamps, a producer gap recorded in the plan. Next: P1b
(`tests/` split and `stages/`), P1c (the board directory).

## 2026-09-22 10:12 [progress]

`mica-build`'s tests are split into `tests/gates/`, `tests/fixtures/` and
`tests/suites/`, and the shell that runs inside the root composer's and
the boot-tools images lives under `stages/compose/` and `stages/boot/`
(`20260922-0815-one-language-one-layout`, P1b; `2e68cb3d`..`5a91495d`).
The living records name the moved paths. Two container-route reds of
P1a's CI are fixed in the bootstrap. Next: P1c, the board directory under
one management.

## 2026-09-22 10:20 [progress]

cx3576 flashing is an operator procedure, not tree content
(`20260922-0815-one-language-one-layout`, P1c; `mica-build` `0ade0a58`):
the `rkdeveloptool` steps for Loader and Maskrom mode are in the hardware
and user pages, the tool's macOS build with its two patches beside the
board page, and `boards/cx3576/flash/`, its three targets and its test are
deleted. The rebuilt cx3576 kernel is byte-identical but for two comment
lines of the shipped floor fragment that P1a renamed.

## 2026-09-22 10:54 [progress]

The first Python of `mica-build`'s engine is TypeScript
(`20260922-0815-one-language-one-layout`, P2): the lock reader
(`src/locks/locks.ts`, held by the 82 canonical vectors), the Debian
archive reader (`src/pool/deb.ts`, on a pure JavaScript xz decoder) and
the version index (`src/release/index.ts`), each compared byte for byte
with its original before the Python was deleted. Details and what is
still Python in the plan's *Progress*.

