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
paths left behind is not a failure condition, 703 *unexplained* would be. And
while it reports without refusing, say what it is: **a report is a necessary
condition, not a proof** — the drops gate tells you what the composition left
behind and proves nothing about whether the root is right.

**And the third time one format paid, with the cost of the alternative
measured** *(2026-09-20)*. The offline chain's first aligned run refused, and
the refusal was **correct while its subject was not the workspace being
tested**: the chain reads the *shared* checkout's `locks/`, which was behind
its own branch. That was legible only because the report prints the head it
read. **Every other instance of this shape today cost somebody a wrong
sentence; this one cost a re-run** — which is the whole argument for a format
in one comparison, and the first time today it has had a price on both sides.
*(By the end of that day the shared checkout had answered about a different
tree **four** times: its `main` was measured a full day behind the
`origin/main` the chain actually ran at. **Four is not an incident.** Sorted
rather than counted: two cost a wrong sentence and nothing caught them — a
stale `mica-podman` pin, and four board pins of which one was stale. One
survived **because a person ran `git status` before speaking**. One survived
**because the report printed the head it read**.)*

**And those two survivals must not be counted together**, which is a
correction to the sentence that stood here before: **a habit protects the
person who has it, on the day they have it; a format protects every reader
downstream, including one six months from now who never met the hazard and
will never know it was there.** The habit survival taught nobody anything and
left no artefact; the format survival would happen again for a reader who has
never heard of that evening. Counting them as one kind records this workspace
as **half protected** when it is **a quarter protected and a quarter lucky** —
and the quarter that is load-bearing is the format.

**And a defect that lives in a query survives knowing about it**
*(2026-09-21, the sharpest evidence this table has)*. One party narrated a
run's **start** as its outcome **three times**: the first two were corrected
by two different repositories, the distinction was written down twice, and the
third happened anyway — **in the sentence declaring the window closed, in the
thread about that exact substitution.** **The query selected `.created_at` and was
never changed**, so the instrument kept handing back start times and the
reader kept believing them. **Knowledge acts on the reading; the defect was
upstream of the reading** — for the second and third, which were the
instrument repeating itself. **The first was a choice**, and its author says
so: a query written to *list runs* was pressed into answering *when did the
window close*. **A value obtained for one purpose and reused for another, with
nothing marking the change** — the same act as a count reused without its
population or a verdict reused without its subject, arriving in a query.

**So the cheapest fix is one step earlier than either of the others: state the
question before choosing the query, and re-state it when the question
changes.** A list written for *what happened* does not answer *when did it
end*, **and nothing in its output says so**. The field name beside every
timestamp catches this at the **reader**; asking for `updated_at` and
`conclusion` together catches it at the **query**; stating the question
catches it **before the query exists**, which is where it is free.

**And the test for which column a save belongs in is whether the reading was
optional**, demonstrated the same day on the author of a format: a status line
that must carry the date it was decided was filled in from the rhythm of the
round — `17:41` — and `date -u` said `19:54`. **The format made the reading
mandatory**; nobody remembered to check the clock, the field simply could not
be filled without it. A habit would have had to fire; this could not fail to.
Nothing downstream would have failed on `17:41` either, and nobody reading it
would have known to doubt it.

**And the honest boundary of all of this, found the day it was argued: some
false results are distinguishable only by somebody who knows what they did,
and no format reaches them** *(2026-09-20)*. In the same round, two results
were **false and plausible**: two guests were run at once and the harness
names its container with a **fixed** name, so they collided and both died at
exit 137 — two *the probe never finished* results that read as a broken
harness; and a symlinked `meta/` in a temporary worktree was accepted by the
build and unfollowable from inside the container. **Both were caught only
because the operator knew what they had just done.** Every other repair on
this page moves a judgement into an instrument; this is the residue that
cannot be moved, and a page that recommends formats without naming it is
selling the argument rather than making it.

**The residue has a second member, and it is worse because it never looks like
anything: a cost with no failing output.** A unit of work approved without
reading the script it drives would have built four kernels to keep one, four
times over — **a correct result, every time, fifty minutes at a time**. Every
other defect recorded today eventually produced a wrong sentence, a red job or
a false green; this one produces nothing to be wrong, so **no instrument in
this workspace could ever have caught it**. Formats catch wrong outputs; they
do not catch right outputs bought at the wrong price.

**A reading that is the arithmetic consequence of its input carries its own
corroboration** *(2026-09-20)*. `--memory=64m` producing `memory.max=67108864`
and `--cpus=0.5` producing `cpu.max=50000 100000` are not two facts; they are
one fact checked twice, because **a number no instrument could have guessed
from the outside cannot be produced by an instrument that is not looking at
the thing**. That is the falsifiability question — *what would this print if
the claim were false* — answered **inside a single measurement** rather than
across two, and it is why that one reading is stronger evidence than two
earlier versions of the same check were in an evening of agreeing with the
configs. **Prefer a check whose output is derived from its input over one
whose output is a state word**: `absent`, `present` and `ok` are producible by
an instrument pointed at nothing.

**Print what the verdict depends on, beside the verdict** *(2026-09-20)*. A
product probe reported `cpu.max absent` from a cgroup where the file exists
only if delegation has been asked for; the same output also printed
`cgroup.controllers` and `cgroup.subtree_control`, so *the controller is
available* and *the file exists* stood side by side and the contradiction was
legible **inside the round that introduced it**. Nobody had to be more careful.
That is the cheapest form of every rule on this page: **a rule spends the
reader's attention at read time and a format spends nothing**, so where a rule
can be replaced by an output, the rule is the fallback and the output is the
fix.

**And check the promise rather than a proxy for it.** The same probe took
three versions in one evening: one read a file that can never exist, one read
a file that exists only if somebody already asked, and the third ran
`podman run --memory=64m --cpus=0.5` and asked the container what it got. The
first two were proxies and were wrong in the gap a proxy has; the third can
only be answered by a kernel that has the controller. **A proxy can be wrong
in ways the promise cannot**, and the promise is usually one command further
on.

**A skipped vector is worse than a missing one: it is in the count**
*(2026-09-20)*. Three vectors were carried into a suite and skipped for want
of a tool, while the table that lists them counted their rows as coverage. **A
missing vector is a gap somebody can see; a skipped one is coverage already
claimed** — the same family as a branch that always passes and a floor right
eight times in nine, and the same repair: **a number that includes something
that did not run is not a smaller number, it is a different kind of claim.**
Either the runner refuses a row it cannot run, or the row moves to a list of
exclusions **with its reason**, where the next reader meets the gap instead of
the total.

**Never quote a check you have not seen fail** *(2026-09-20, five instances)*.
A gate that has only ever been green is a gate whose red nobody has
witnessed, and a green from it is a number rather than evidence. The
instances, each reached by a different repository: a vectors-pin gate checked
**red three ways** — tampered, deleted, wrong commit — before it was trusted;
an identity check shown to **refuse the banner it used to accept**; a refusal
proved against a **mutated copy** rather than assumed; a kernel floor loop
with **eight negative fixtures**, which also refuses if it read zero lines;
and this repository's own vectors gate, which had **355 assertions and no
negative test for six days** while every commit report quoted `355/355 PASS`.
The counterexample was found by applying the rule to the ledger used to test
it.

**A sixth arrived by experiment and is different in kind from the other
five**: `mica-build` `81005ea6` **fails** on a product built from board
release `20260916-0857` and **passes** on one built from `20260920-1536` —
same file, no injected defect, two products the workspace actually publishes
pins for. The five above prove a gate **reads its inputs**; this one proves a
check **can tell two worlds apart**, which is the property the thing it
replaced failed at three times. And the order is the argument: **the
falsification found a defect in the check first** — a verdict printed over an
error string — **and the corrected file then proved the capability. One
experiment did both jobs, in that order.**

**And the falsification's first run found a defect rather than confirming the
check**, which is the argument made by the experiment instead of about it: the
run that was supposed to demonstrate a check could tell two worlds apart found
that its CPU case was pronouncing a verdict on an **error string**, because
the command it was reading had failed. The repair is the empty-parse rule in a
place it had not been applied — **a verdict pronounced on a value never
obtained** — and the near-miss is sharper than the defect: the suite was red
only because another branch happened to fail first, so with one symbol
different it would have been **green with a false pass on the experiment
designed to prove it could not be**. **A correct verdict reached by an
accident of ordering is indistinguishable from a correct verdict.**

**The operational half is what makes it a build target rather than a virtue:
a bite test by hand proves a gate once and proves nothing tomorrow.** This
one had been mutated and restored twice, by a person, at a terminal — *seen to
fail* has to mean **a case that runs**, or the evidence dies with the session
that saw it. `tools/docs/verify-release-lock-test.sh` is that repair: eight
cases against a copy of the vectors, each required to produce the gate's own
message.

*(On how the instances arrived: the practice was **reached without being
told** — the coordinating seat carries every cross-repository message and has
none relaying it, and one repository was already describing this shape in an
unrelated suite before the round began. What cannot be excluded is
**tree-level** influence: these repositories read each other's `tests/`
directories, and one demonstrably did so today. Channel independence is
verified; the stronger claim is not available, and the difference is worth
more than the word *independently* would have been.)*

**A tightened check is verified by showing it would now refuse what it used to
accept** *(2026-09-20)*. The session probe's identity test was a `Mica OS *`
prefix match, which a component's banner satisfies; the anchored version
requires `ID=mica` with a non-empty `IMAGE_ID` and `IMAGE_VERSION`. The
evidence that the repair is real is not that the new check passes on the
repaired image — a check that asserts nothing passes there too — it is that
**the old check could not have failed on the old banner and the new one cannot
pass on it.** Run the tightened check against the input that motivated it,
expecting red; a repair whose test was only ever run against the fixed world
is a test of the world.

**A check that cannot reach its subject, or that has nothing to check, must
refuse — never pass quietly.** Three instances, in three tools and two
repositories, arrived three different ways. `verify-board.sh` was **designed**
with it: *a check over an empty set reports green without having checked
anything*, so both its heading list and its row set must be non-empty before
anything is asserted. `verify-world.sh` **reasoned** it from the aperture
rule: no reader and no claims exit 2, because a check that cannot reach its
subject must not look like one that found nothing wrong. And `mica-res` found
it **by testing the gate rather than by thinking about it** — its guard
reported *nothing to check* while a candidate stood in front of it, and
*arguments given and none parsed* is now a refusal.

The routes are not three copies of one fact: a designed rule guards against a
failure someone imagined, a reasoned one inherits its evidence from elsewhere,
and **only the third establishes that anyone would ever have hit it**. The
provenance of the middle one is worth its line too, since it is how most of
what this workspace knows actually travels: `verify-world.sh` has its
empty-set refusal because `verify-board.sh` already had one and the habit was
copied, before either had a name. The third route is the one worth noticing:
the first two were prevented, the third had to be **provoked**. A silent pass is invisible from the outside by
construction, so a gate's own tests are the only place it can be caught, and
they only catch it if they include the case where the gate has nothing to work
with.

**And an alarm that cries wolf destroys the instrument more quietly than one
that never fires** *(`mica-res`, 2026-09-20, after two false alarms in an
hour: after the third, nobody would have read the number again)*. It is the
same reason `docs/world-claims.tsv` holds standing claims only — a dated
measurement re-checked against today is a false alarm every morning — reached
from the other direction. **A gate that never fires gets noticed eventually;
one that fires constantly gets ignored without anyone deciding to ignore it.**

**The unchosen-property test: count how many independent things would have to
change for it to stop being true.** When you find a property nobody chose —
something that happens to hold — **one is luck and needs a gate; several is
structure and needs a record.** Dropbear working without PAM is the first
kind: one package, one build flag, and it stops. D-Bus activation being
unreachable is the second: several independent facts hold it, so it is a
property of the design and belongs written down rather than guarded. The test
is `mica-core`'s and it answers a question that otherwise turns into taste.

**Ask the artefact that ships, not the one that produced it** — and the
useful form of this is a table, not the sentence. Said as *check the output,
not the input* it fits everything and tells nobody what to do, which is the
failure mode of a rule that fits everything. What makes it actionable is
naming, per kind of claim, which artefact is the input and which is the
output. Five layers, five repositories, one distinction *(2026-09-19/20)*:

| The claim is about | The input someone checked | The output that settles it |
|---|---|---|
| what a root contains | the composer's declarations | the composed root — `/etc/pam.d/login` was declared nowhere and no image had a console login |
| what a kernel enables | the committed `kernel/config` | the configured kernel — `cx3576`'s config says `# CONFIG_LOGO is not set` and its hook turns it on |
| which board carries a policy | the board overlay trees | a non-`cx3576` composed root — four readings of trees before anyone asked the root |
| what a gate validated | the tree before the rebase | the tree that reaches `origin` — `record.sh` gates again afterwards for this reason |
| a mount's options | the `fstab` entry | the **effective** mount on the booted guest: a bind cannot weaken the underlying mount, so the effective set is `DATA`'s options composed with the bind's, and only the guest has both |

The table is the argument and the sentence is only its title. Each row cost
something to learn, and the fifth arrived the same day as the fourth.

**A correct class with a hand-enumerated membership is the defect that
survives review**, because every reviewer checks the **reason**, and the
reason is right. Two instances, different domains, the same day: the
collect mode's structural set left `release-row` out although everything after
it reads `rows[0]` as the release; and `e2fsprogs` carries a hand-written rule
keeping `/etc/e2scrub.conf` *to preserve existing configured defaults for the
retained `e2scrub`* — which **stopped at one of two retained binaries**. The
repair is the same in both and neither found it from the other: **derive the
membership from the class, or say in the rule that the list is enumerated, so
a reader knows to re-derive it.**

**A value that cannot express *not measured* is indistinguishable from a
measurement.** Three instances, in three places: a vector copy's **size**,
where 64 rows is either a deliberate subset or last month's copy and the file
cannot say which; `podman stats` printing **`0B`** where the figure was not
measured, which reads as *nothing is being used*; and **`cpu` appearing in
`cgroup.controllers`** while `cpu.max` is absent, which reads as *a quota is
in force*. In each the field has no value meaning *unknown*, so it returns one
that means something else — and the reader cannot tell, because the two
answers are the same bytes. **Ask what the field says when the thing is not
known; if the answer is *the same as when it is zero*, the number is not
evidence.**

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
the aperture was a filter, a file, a name, a guessed path — **or a
resolution.** *(A 404 at a guessed path is not evidence of absence: four
repositories were probed at `mica-build`'s vector path on 2026-09-20 and
answered nothing, while `mica-system-base`'s reader and vectors were simply
elsewhere, in TypeScript. The probe was one keystroke from being reported as
"only `mica-build` has vectors".)* The three
named so far are all about *where* someone looked; the fourth is about *how
finely*. `mica-boards` compared two arm64 kernels, one published by a native
CI runner and one cross-built locally: **exactly the same size, 33 065 472
bytes, with 3.7 MB of differing content.** A size comparison would have passed
and recorded a no-op that was not one — neither truncated nor misaimed, just
too coarse to see what it was asked about.

**A constraint in a header warns whoever is already reading that file, which
is nobody who needs it** *(2026-09-20, `mica-boards`' formulation and better
than the one it replaces)*. The point is not that comments decay: it is that
**a comment's audience is selected by the one property that excludes the
person at risk** — having the file open. `mica-boards` had measured the stale
build-tree hazard and written it into `common/kernel/kernel-config-test.sh`'s
header weeks ago; `mica-build` met the same shape in its own tree at 14:06
today, read neither the file nor the comment, and built a guard. The cost of
getting this wrong is not a repeated discussion, it is that **the second
repository pays the discovery again**, at whatever hour it lands.

**And the instance that decides between a convention and a row: nobody was
careless** *(2026-09-20)*. One cleanup on 2026-09-09 deleted two checks and
left comments in three places asserting both, in a second repository. The
comments were **accurate when written**; they became false by somebody else's
deletion, in another file, in a commit whose author had no reason to read
them. **The author of the comment did nothing wrong and the author of the
deletion never read it** — which is exactly the case a row catches and a
convention cannot, because a convention is an instruction to people who are
not in the room when it breaks. It is also the reason *a constraint in a
header warns nobody who needs it* has a sharper edge than decay: the comment
did not go out of date, it was **falsified from outside its own file**.

**And the hazard is located rather than general, which took a run rather than
a reading**: it needs an `_out/boards/<board>/kernel/` that persists across a
fragment change and is consumed as an input rather than rebuilt — the
image-assembly side and a developer's working tree, not `mica-boards`' CI,
where a run with a warm prefix cache still failed at the recorded-config gate.
The measurement, the CI demonstration and the BuildKit mechanism are recorded
in their author's words in [the board contract](../boards/contract.md) section
4.6, rather than paraphrased here.

**Same path, two hazards, different repairs**, which is the part a reader who
learns one will get wrong about the other: `mica-boards`'
`_out/boards/<board>/kernel/` can be stale relative to a **fragment**;
`mica-build`'s is fetched from a **pinned board release**, so its staleness is
the **pin's**. BuildKit's content addressing answers the first, comparing a
report's mtime against the signed root it describes answers the second, and
**neither would have helped the other**.

**And there is a kind none of these are: no aperture at all in the direction
that mattered** *(2026-09-20, `mica-build`)*. Its copy of the
release-lock vectors held **127 files where `mica` held 143** — sixteen
missing, including all five `data-*` vectors, the board vector under its
post-rename name, and `derived-from.tsv` itself — while its suite was **green
at 81 of 81**, because the suite walks the **copy's own** `expected.tsv`: a
vector absent from the copy is absent from the list of vectors to run. The
suite was complete with respect to itself. Every instance above is an aperture too
narrow, misaimed, too coarse, or pointed at nothing; this one has none in the
direction of the question, and **a set that defines its own
completeness cannot detect an omission by any amount of care.** That is why it
is filed here rather than as a rule of its own, and why set equality **in both
directions** against the source is the only instrument that reaches it. The
cost was concrete rather than hypothetical: the `data` kind the suite reported
as exercised was exercised against the four vectors it happened to hold, and
the five written for that row had never run there. They pass now, 88 of 88 —
**the implementation was right and the evidence was weaker than it believed.**

**An empty result whose bound is invisible**, which is a rule rather than a
class and has its two instances *(2026-09-20)*. A **partial listing**: the
contents API paginated, about half of 61 files were quoted as the directory,
and the negative claim built on it was wrong. A **rooted history**: `git log`
over a path in `mica-build` returns nothing for anything before `a5f1e36`, a
parentless commit of 2026-09-14, so *the path has no history in that
repository* was true of `origin` and false of the clone that holds the
deletion. In both, the instrument answers with a boundary it does not mention,
and the answer is **the same empty result** either way.

**And a fourth subject that cannot carry its own name: the working tree of a
shared checkout** *(2026-09-20)*. Two readings of `mica-boards`' floor on the
same afternoon were opposite and both true: nothing mentions `NET_CLS_CGROUP`
at `f3ff004`, and something does in the workspace checkout — where its owner
was implementing the repair, with the fragment, a board config, the gate and
two Dockerfiles modified and a new fixture file untracked. **In a shared
checkout, read from a commit — `git show <sha>:<path>` — or run `git status`
first and say which you read.** A working tree has no name to cite and no
timestamp a reader can check: it is the only artefact here that **cannot carry
its own subject**, which is why the rule has to be about where you read rather
than about how carefully.

The operational form is a question to ask before the claim, not a habit of
care: **before asserting that a path has no history, check whether the
repository's history is rooted and compare the root's date to the period you
care about** — and for a directory, enumerate the tree rather than quoting a
listing, with the count in the sentence. *(A 422 explained is evidence; a 422
observed is a dead end that reads as a refutation.)*

It is deliberately **not** filed with *a set that defines its own
completeness* above, though the symptom is identical — an exclusion reading as
an absence. The repair differs, which is what decides membership: these two
are answered by **asking the instrument for its bound**, inside the same
query; that one can only be answered **from outside the artefact**, because
the artefact is behaving correctly within a scope it states.

**A drift gate diffs where a release gate digests.** The repair
(`mica-build:tests/vectors-pin-check.sh`) pins the copy to a `mica` commit and
compares the trees with `diff -r` and not a digest, *"because a digest says
that they differ and the whole reason this drifted is that nobody could see
what"*. Both are equality checks and they are not interchangeable: a digest is
right for a release asset, where the question is *are these the bytes that
were published* and any difference disqualifies; it is wrong for a gate
somebody has to act on at eight in the morning, where the question is *what
moved*. **Choose the instrument by what its red output has to tell the person
who reads it.** The pin is the other half: because the gate compares against a
named commit rather than against `main`, this repository's later commits do
not turn it red — drift becomes visible at the deliberate act of moving the
pin, and `diff -r` then names the files. (It also refuses when `gh` is absent
instead of skipping, which is the *a check that cannot reach its subject must
refuse* rule arriving from a third repository.)

**A name is an aperture, and the second instance says what the first could
not** *(2026-09-20, `mica-build`, reached from a failure rather than from this
record)*. `make os-offline-chain-test` runs in `ci.yml` on every push and
passes, over a **fixture workspace that does not reach the seam** — so a suite
named after the offline chain was green while the offline chain could not
complete. Its general form, which is worth keeping in its words: **a test over
a fixture that does not reach the seam is the same shape as a gate that never
boots an image — it proves the parts and not the join, and the join is where
the defect lives.**

What the pair says that neither says alone: **both suites named after the
thing they did not do are suites nobody had run to the end.** The name was not
merely a bad aperture — **it is what made running the thing feel
unnecessary.** One of the two was found by reading and one by failing, which
by the pairing rule is a hypothesis and an observation rather than two of a
kind ([doc-contract](../user/doc-contract.md) section 6).

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

**Four instances now, and together they give the rule a shape it did not have:
the healthy arrangement and the pathological one** *(2026-09-20)*.

- The **second** is the stronger version of the first: 139 vector files
  identical across repositories **as blob names**, six of them carrying the
  same defect since they were written. Agreement between copies proved exactly
  what it claimed — that the copies agreed — and had an aperture of zero on a
  defect they shared.
- The **healthy** arrangement, from `mica-system-base`: its 21 negative cases
  are **built in code** from one baseline builder, so minimality holds by
  construction — and the aperture moves inside its own file, since a wrong
  builder makes all 21 wrong together. What closes it is that the **same
  `assertBase` runs on the real bootstrapped root of both architectures in
  every CI run**. Its formulation is the remedy in one line: **one reader over
  two originals catches what five readers over one original cannot.** The
  vectors here have the opposite arrangement — one original checked by five
  readers — which is why six defects sat in them.
- The **pathological** arrangement, from `mica-build`:
  `verify/src/checks-fixture.ts` seeds `50-mica-getty.preset` into a synthetic
  healthy root, and **three of the four real boards do not have that file**.
  It seeds it to feed a suite deleted on 2026-09-09, with the comment naming
  that suite touched *after* the deletion. **A fixture is never compared to a
  root, so it can fabricate reality in the one place where nothing can notice.**

All four are the same rule. Naming a new one for each would inflate the
taxonomy and hide which rules are load-bearing
([doc-contract](../user/doc-contract.md) section 6).

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

**The same pinned toolchain image is necessary and not sufficient, and
whether cross and native agree is a property of the *tree*** *(2026-09-20)*. A
generalisation that the toolchain image was the variable — that cross versus
native stops mattering once both use the pinned image — was offered, adopted,
and **withdrawn within the hour by its own author on its own measurement**:
mainline agrees, the Amlogic vendor tree does not. So it is measured **per
tree**, and **one board's agreement licenses nothing about another**. The
withdrawal is worth as much as the rule: the claim was too strong in the
direction that makes a **local build look authoritative**, which is the
dangerous direction for a claim about reproducibility to be wrong in.

**And it is evidence of a kind that independence cannot supply: it cost its
author something.** The original rule made that repository's own local builds
look authoritative — it benefited — and the withdrawal took that away, on its
own measurement, unprompted. Two instances arriving independently rule out
both having been matched to one template; **a withdrawal against interest
rules out something else — that the rule survived because nobody with a reason
to look hard had looked.**

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

**Testing instead of asserting protects you from the wrong story, not from
the wrong cause.** A comparison whose two cases differ in *two* things
attributes the effect to whichever one the comparer had in mind — and a run
was performed, so it feels measured. Three instances, each one paid for:

- the `-C metadata` case above — code and disambiguator both moved, and the
  difference was read as codegen;
- *emulation changes bytes* — the compared builds differed in host **and** in
  toolchain, and the effect was attributed to emulation until `mica-core`'s
  own evidence named cross-compilation;
- a self-edit experiment on 2026-09-20 — one case edited **late and
  length-preserving**, the other **early and length-changing**, reported as
  *length decides*. Separating them showed a small late change is silent
  either way and a large early insertion is loud, so the cause is how far the
  bytes before the interpreter's position moved.

The remedy is the control build's, one level up: **move one variable, or name
every variable that moved and refuse the attribution.** A second case that
differs in two ways is not a control, however carefully the first was run.

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

**The composer's declaration model has two proof mechanisms and a third
category neither covers** *(2026-09-20, `mica-build`, from the 626 sweep)*. It
proves a path by **package ownership** and keeps a library by **`DT_NEEDED`**.
**Neither sees a runtime load by name.** Every `dlopen` family in the root is
carried because somebody wrote a rule naming it — NSS, PAM, the OpenSSL
providers, all named in `consumers.json` — so that third category is held
together **entirely by human foresight**, and last night measured how far
foresight got: **eleven families right, one missed** — and then a second
missed, `libpcsclite.so.1`, a shim that `dlopen`s `libpcsclite_real.so.1` by
name from the same package, out for the same two reasons: `DT_NEEDED` does not
name it and ownership does not claim it.

**Those counts are one product's.** The drops report and the composed-root
assertions have only ever run on `uefi-x64`, so **2980 carried, 703 left
behind, 626 owned-and-unclaimed and 77 owned by nothing are `uefi-x64`
numbers**, not workspace ones — running the scan on all four products turned
up **eight names one product had been hiding**. *A scan that answers about one
product answers about one product.*

The one missed is the illustration and it is the purest form of a shape these
records keep meeting: `/usr/bin/stdbuf` is carried and
`/usr/libexec/coreutils/libstdbuf.so` is dropped. `stdbuf`'s whole mechanism
is to put that library in `LD_PRELOAD` and `exec`, so without it **the command
runs, exits zero, and silently does not buffer** — a tool that is present,
executes, succeeds and does nothing. It was found by reading the shipped
binary's own strings rather than a manual, which is the output rather than the
input.

This is a **boundary of the model, not a defect in it**, which is why it is
stated where the rules are: a reader of `consumers.json` today would
reasonably conclude that ownership plus `DT_NEEDED` is the whole model, and
would be wrong in the one direction that produces a silent no-op.

**And test a proposed check against the case that made you want it, before
proposing it.** The first check drafted for this enumerated carried binaries
whose dynamic symbols include `dlopen` — and `stdbuf` does not `dlopen`
anything, it sets `LD_PRELOAD` and execs, so the check would have produced a
tidy list **not containing the one defect anyone knew about**. That is the
worst kind of check: **one that looks complete and omits the instance that
motivated it.** The second draft keys on the **name** rather than the
mechanism, because the mechanism is what varies.

**Before calling a drop a defect, ask whether the rest of the feature is also
absent** *(2026-09-20, reached independently by three repositories)*. **A
feature absent in every piece is a composition decision; a feature absent in
one piece of several is a defect — and only the census distinguishes them, not
the file.** Absent in every piece: the `subuid`/`subgid` maps dropped **and**
`uidmap` never installed at the source **and** the engine depending only on
`libsubid5` — rootless is simply not shipped. Absent in one of several:
`systemd-pstore`, where the unit and the binary ship and only the enablement
fell out. The method is the transferable part: it read the `passwd` file
**and** the binary list rather than inferring either from the other.

**And the clause belongs inside that rule rather than beside it, because it is
the census's own failure mode: the census must cover the feature as *the
format* defines it, not as the investigator remembers it.** One census nearly
stopped at *subuid is for rootless, rootless is absent, done* — a true
sentence and a complete-looking answer — and went to the pinned source anyway,
where `--userns=auto` turned out to be a **rootful** consumer of
`/etc/subuid` that nobody here knew existed. **A census bounded by memory
looks exactly like a census bounded by the feature**, and from inside there is
no signal that the boundary was the wrong one.

**And the first question about a dropped path is what its presence would
authorise, not whether the binary still works without it** *(2026-09-20)*. The
obvious question points the wrong way on the case that matters:
`/usr/lib/systemd/system/nftables.service` runs `nft -f /etc/nftables.conf` at
start and `nft flush ruleset` at stop, and Debian's conffile itself begins
`flush ruleset` — so enabling that unit *for completeness* would wipe
netavark's ruleset on every reload, restart and shutdown. Because
`/etc/nftables.conf` is **dropped**, that mistake instead fails loudly on a
missing file and takes `sysinit.target` with it. **The drop converts a
silent-harm path into a loud one, so presence is the dangerous pole here** —
the opposite of the assumption a loud/silent field is built on.

So that field has **three values and not two**: absence breaks it **loudly**,
absence **changes a default silently**, and **presence authorises harm**. And
a fourth state is none of the three: `ld.so.conf` is inert only because a
cached artefact happens to be carried, which is a property of the image and
not of the file. **Membership follows the consequence, not the shape**, so
`mke2fs.conf` must not be assumed to share `nftables.conf`'s polarity for
sharing its shape — a correct class with a hand-enumerated membership is the
defect this page names above, and sorting a triage by shape is how it is
produced.

**And *dropped* is not one mechanism** *(2026-09-20)*. The composer's
unowned-path account explains the `tty1` symlink exactly: nothing claimed it,
so nothing carried it. The four dropped Debian drop-ins are **package-owned**,
by `systemd` and `systemd-resolved`, and the triage that reported them had
already put them in its `owned` bucket — **the buckets were right**, and the
first version of this paragraph, which said the account could not see them and
left the rule that took them open, was an inference passed along rather than a
reading of the report. Corrected here rather than quietly, because it was
published — and the chain is worth keeping, because **every link was true of
its own subject**: one repository said *my* unowned artefact cannot see these,
which is true of that artefact; it was relayed as *if the other repository's
report has them in the same bucket, the bucket is wrong*, a claim about a tool
nobody in the chain had read; and it was written down here as a fact. **A
statement widened one subject at a time survives every reader, because each of
them is reading their own link.**

What is actually wrong is narrower and sharper: **the rule that claims
`systemd`'s resources enumerates `/usr/lib/systemd/system/*`,
`/usr/lib/tmpfiles.d/*.conf`, `/usr/lib/udev/rules.d/*.rules` and more, and no
`*.conf.d/*.conf`** — the reason is right and the membership is one directory
short. That is the correct-class-short-membership defect a fourth time, and
the first arriving through an **enumeration inside a tool** rather than
through a person's list: nobody wrote those four paths down and decided they
did not matter; a glob simply did not reach them, and everyone downstream was
right to trust the rule inside its scope. What survives of the structural
point is the narrower half — **a list defined as *what no package claims* is
silent about a package-owned drop by construction**, so quoting that list as
the account of these four would have been quoting the wrong bucket.

**And the consequence of one of the four narrows rather than closes.** With
`resolved`'s drop-in gone the compiled-in default returns, and on a booted
`uefi-x64-prod` `MulticastDNS` is globally `yes`. `eth0` reports `no` — but
only because it is matched by `80-dhcp.network`'s `Name=eth*`, and anything
that does not match falls back to the global: `sit0` reports `yes`. So it is
**closed for `eth*`, untested for every other interface name, and the
mechanism that makes it safe on `eth0` is a match pattern rather than a
decision about mDNS** (`wlan0` does not match either and cannot be tested in
QEMU). Another instance of a mechanism that looks like it serves a reason it
does not serve, and the reason to write what a mechanism is for beside it.

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
