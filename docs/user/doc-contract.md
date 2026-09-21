# The Mica OS user documentation contract

This page is the contract behind everything under `docs/user/`: who these
pages are for, what each page owns, how a claim about the product is labelled
and evidenced, how the set is versioned, and how the English and Chinese trees
relate. Pages in this set follow this contract; a page that cannot is a defect
in the page, not a licence to relax the contract.

## 1. Audience

Mica OS is an embedded appliance operating system. The user documentation serves
three readers, in this order:

1. **Device operators** — the person in front of a fielded appliance:
   installing, configuring, updating, recovering, and deciding what to tell
   support.
2. **Product integrators** — the team building a product on Mica OS: composing
   images, delivering applications, selecting and qualifying boards.
3. **Support engineers** — the person a failure report reaches, who needs the
   device's identity and the honest boundary between shipped behaviour and
   roadmap.

The engineering design record stays in [`docs/design/`](../README.md) and
[`docs/architecture.md`](../architecture.md). User pages state current
supported behaviour and link back to the design record for rationale; they do
not restate design history, and design rationale is not duplicated here.

## 2. Information architecture

The customer journey runs from release selection through installation,
operation, applications, update, recovery, troubleshooting and support. One
page owns each stage; a fact appears on the page that owns it and is linked
from everywhere else.

| Page | Owns |
|---|---|
| [quickstart.md](quickstart.md) | the shortest honest path to a running Mica OS system |
| [download.md](download.md) | release selection and obtaining an image |
| [install.md](install.md) | the order of operations for an installation, from choosing an image to first boot |
| [first-run.md](first-run.md) | first boot, the offline provisioning document, and claiming the device |
| [manufacturing.md](manufacturing.md) | putting Mica OS on units at volume: identity and credential ownership, factory records, quarantine |
| [configuration.md](configuration.md) | the configuration model and every supported way to change settings |
| [applications.md](applications.md) | delivering and running applications: native packages and containers |
| [update-rollback.md](update-rollback.md) | the A/B update path, health confirmation and rollback |
| [recovery.md](recovery.md) | what to do when a device does not boot, and what recovery costs |
| [storage.md](storage.md) | the storage tiers, what survives what, and where data belongs |
| [troubleshooting.md](troubleshooting.md) | diagnosis: access channels, evidence to read, refusals to interpret |
| [security.md](security.md) | the security posture: what is protected, by what, and the named gaps |
| [release-notes.md](release-notes.md) | how releases are identified and where release facts come from |
| [api.md](api.md) | the programmatic surface and its machine-readable contract |
| [support.md](support.md) | support tiers, lifecycle ownership, and what a support case needs |

Website content briefs live under `docs/website/` and the BSP porting and
qualification set under `docs/boards/`; user pages link into both where the
journey crosses them (hardware selection, downloads, support tiers).

## 3. Truth-status taxonomy — normative

Every capability claim in this documentation set carries a status. This is the
core of the contract: documentation alone can close usability gaps, and it must
never claim that missing mechanisms already ship.

The four statuses:

- **shipped** — the capability exists in this repository and is exercised by
  the build or its checks. Claiming it requires evidence that exists.
- **board-dependent** — the capability ships for at least one board and its
  presence or shape is a board fact (declared in `boards/<board>/` or by a
  board's BSP).
- **proposed** — the capability is planned and tracked by an open plan or
  task record, and does not ship. Describing a proposed
  contract is allowed; presenting it as current behaviour is not.
- **unsupported** — the capability does not exist and is not currently
  planned, or is explicitly outside the product contract.

### The grammar

A status line is a Markdown blockquote of exactly this shape — statuses as
above, the separator an em dash with spaces, each evidence reference in
backticks, multiple references separated by `, `:

```
> status: shipped — evidence: `mica-core:apid/openapi.json`
> status: board-dependent — evidence: `mica-boards:boards/cx3576/board.env`
> status: proposed — evidence: `docs/task/20260912-2058-fleet-runtime.md`
> status: unsupported
```

### Evidence rules

- `shipped` and `board-dependent` must cite an existing repository path (a
  file or a directory) or a `make <target>` that exists in the top-level
  `Makefile`.
- `proposed` must cite at least one open tracking record: a detail file under
  `docs/plan/` or `docs/task/` whose index entry is pending (`[ ]`) or in
  progress (`[-]`). When the record completes or closes, the gate fails until
  the page is relabelled.
- `unsupported` carries no evidence; the absence is the claim.
- Evidence is verified to exist before it is cited. A dead evidence reference
  is a broken claim, not a cosmetic defect.
- No `path:line` citations anywhere in this set. A document coupled to line
  numbers is falsified by edits that leave its meaning intact. Where a precise
  contract is needed, the artifact that carries it is named instead — for
  example, the HTTP surface is `mica-core:apid/openapi.json`.

### Proposed content

Where a page describes a capability that is still being built, it states the
planned contract and labels it `proposed` with the open record as evidence.
The evidence rule above forces the relabel when that record completes or
closes, so no separate TODO marker is used.

## 4. Versioning

The user documentation set is versioned with the Mica OS release it ships in.
A page describes the release it is checked out with; there is no separate
documentation version number, and no page describes a newer or older release
than the tree that contains it. Statements tied to a specific board or profile
say so.

> status: shipped — evidence: `docs/user/`

## 5. English and Chinese

English under `docs/user/` and `docs/hardware/` is authoritative. A tracked
Chinese user-facing set lives under `docs/zh/`, indexed by `docs/zh/README.md`
with a per-page
coverage table carrying, for every page in this set: the source page, the
source version it was translated from, and a status that is one of `current`,
`lagging` or `not-translated`. On any conflict the English page wins.

The Chinese set exists under `docs/zh/`, and the check that holds the coverage
table honest is `tools/docs/verify-coverage.sh`, run by `make docs-verify`: it
asserts the table against both trees in both directions, and requires a
`current` page to carry the same status lines, in the same order, as its
English source.

> status: shipped — evidence: `docs/zh/README.md`, `tools/docs/verify-coverage.sh`

## 6. Style rules

- Every page starts with an H1. Internal links are relative.
- Sober prose; no marketing register. A limitation is stated in the sentence
  that would otherwise overclaim, not in a footnote.
- Commands shown are the real ones, verified against the `Makefile` and the
  scripts they name.
- User pages do not narrate implementation. The design record owns the why;
  these pages own what an operator or integrator can do today.
- **A default with a specific-looking value is the best-disguised default
  there is** *(2026-09-20; a writing rule at two instances, not yet a claim
  about the world)*. `0`, `true` and an empty string announce themselves; a
  **round, deliberate, sized** number does not. `mica:100000:65536` was
  described in these records as though somebody had chosen the range — it is
  `login.defs`' `SUB_UID_MIN`/`SUB_UID_COUNT` — and a harness value that read
  as an identifier was `process.pid`. **The value looked like the thing it was
  not, and nothing about its appearance was wrong.** Before citing a number as
  a decision, find who wrote it.
- **Three dates, not two: written, released, in a product** *(2026-09-21)*.
  A feature is on `main` at the first, carried by a release at the second, and
  reaches a device only at the third — **when the assembly re-pins**, which is
  a separate and often unscheduled date. **A page that says *the device does
  X* is true at the third and false at the first two**, and nothing in a
  record distinguishes them, so a sentence about behaviour names which date it
  is about or waits for the third. The tense error is far cheaper to avoid
  than to correct: by the time it is wrong, it has been read.
- **Why this page is almost entirely *go and look* rules, and what the one
  exception costs** *(2026-09-21)*. Nearly every defect these records hold was
  recoverable by **opening something** — a stale path, a wrong count, a dead
  tool, a false `cannot`, an uncalled script, a field that means `created` and
  not `concluded`. **Scope is not in anything.** It is not a property of the
  artefact but of the **claim about** it, and it lives only in the claimer's
  head and the reader's — which is why the rule for it ends in **go and ask**
  and why no amount of care at the reading end reaches it.
  **And there is a third kind, which the wrong-field defect produced: *say it
  first*.** Stating the question before choosing the query acts **before any
  artefact exists**, on the order of one's own thinking — there is nothing to
  inspect and nobody to ask. **That is why it is the only free rule here and
  also the only one nothing can verify**: a *go and look* rule leaves a read
  behind and a *go and ask* rule leaves a message, while this one **leaves
  nothing, which makes it a habit by construction and impossible to turn into
  a format** — and by this page's own table a habit protects the person who
  has it, on the day they have it. **The cheapest rule in this corpus is also
  its least defensible**, written here rather than discovered by whoever
  relies on it.
  **And that is also why nobody routes that way by default: a *go and look*
  rule is paid by the person applying it, while a *go and ask* rule spends
  another party's attention — and spends it on somebody with nothing to gain
  from the answer.** The repository that owns a surface has no stake in
  whether another repository's page describes it correctly. **The cost of the
  correct rule lands on a party with no interest in it**, which makes it
  structural rather than an oversight, and means it will keep feeling
  expensive every time somebody does it. Written here so that it is recognised
  as the cost of a rule rather than discovered later as reluctance. **And it is the only
  rule in these records that asks for *less*: every other one adds work —
  count the members, read the call sites, open each hit, print the subject,
  name the population — while this one says *stop trying harder at the relay
  and route differently*. A corpus in which every rule demands more effort is
  a corpus that gets abandoned**, so the one that gives some back is worth
  protecting when somebody later trims for weight — **it is the one most
  likely to be cut for looking like an exception, and it now says why it is
  not. A cost stated survives an editor; a cost implied does not.**
  *(And *ask the owner* sometimes resolves to *ask yourself*: one
  counterexample was in a file its own claimant maintains. The working version
  of that is the plainest rule here — **read your own artefact before
  asserting what it contains.**)*
- **Rank remedies, because the reader prices them with less information than
  the writer** *(2026-09-21)*. Three unordered remedies are a **menu**; three
  ordered ones are **advice**. The wrong-field defect has three fixes and they
  are recorded cheapest first — say the question, then change the query, then
  name the field beside the value — so that a reader who can afford one takes
  the one that costs nothing.
- **An abstention names what it abstained from** *(2026-09-21)*. Declining to
  assert a figure is right, and **silently** declining costs what an
  unreported zero costs: this page once carried a true, weaker sentence
  because a completion time had not been read, and **nothing in it signalled
  that a stronger one was available** — the reasoning lived in a message,
  which scrolled. So write the slot, not the silence: not *the page says what
  I read* but **“the completion time is unread; the gap from conclusion is
  unmeasured.”** A blank is visible and a wrong figure is not, and **an
  unstated omission is neither.**
- **A derived number carries no trace of its inputs, and the more arithmetic
  it took the more it looks like a measurement** *(2026-09-21)*. *Fourteen
  minutes* announced neither which two timestamps produced it nor that one of
  them was a **start** narrated as an outcome. The fix is a format: **the
  field name travels with the value** — `created` is not `concluded` — which
  is the same repair as a count naming the population it was taken over.
- **A boundary of the data is not a state of the world** *(2026-09-21)*. *No
  successful run since the last green began* is a claim about the rows in
  hand; *red since 05:39* is a claim about the branch, and it needs a fact the
  rows do not contain — **when the red began**, which was half an hour later.
  Both sentences come from one reading and only one survives it. **Nothing in
  a list announces that the sentence you are about to write has left it.**
- **Report the zero.** *(2026-09-21; the inverse of every rule here and
  missing from all of them.)* These records already say a zero must carry the
  boundary it was measured inside — **they never said it must be reported at
  all**, and **an unreported zero is re-measured by everybody who wonders**.
  One sweep of this tree for stale product names, discoverability claims and a
  Bluetooth PIN found nothing and cost one pass; unreported, the next three
  readers pay three — **and none of them would know the others had already
  done it, which is a habit save's invisibility one artefact along**: neither
  leaves anything behind, and both get paid for repeatedly by people who
  cannot see each other. **And sort rather than count, because that is what makes
  a zero believable**: the surviving `x64-dev` mentions are two Chinese
  flashing pages naming a pre-rename image **on purpose**, the one
  *advertising* sentence is `wifi.md` on the AP SSID — **hostapd, not mDNS** —
  and the Bluetooth hits are a future bring-up plan and a line about stored
  pairing keys. **Three hits, three kinds, none of them the thing looked for,
  which is a stronger result than *no hits*.**
- **A relay does not only carry a sentence; it changes its scope, and the
  change is invisible to whoever wrote it** *(2026-09-21)*. A probe's verdict
  was a sentence about **one run**; carried across a repository boundary it
  arrived as a sentence about **the product**, reported as a chain *closed end
  to end* — a claim neither the probe's file nor this page had ever made. The
  page then did what a page does: **it made the relayed scope the answer.**
  That is not a defect in the page, it is why a relay has to be right — and
  why a record landing a relayed sentence asks **what it was a sentence
  about**, not only whether it is true.
  **And the remedy for the attribution half is a form rather than more care: a
  quoted sentence carries its speaker; a summarised one takes its speaker from
  the paragraph it lands in.** Twice in two days a claim crossing paragraph
  boundaries took its subject from the **nearest name** rather than from the
  sentence — once a bare path, once an admission that landed on the wrong
  repository. Both times the sentence was true of somebody. **Quote an
  admission; summarise a fact.**
  **And the obvious defence does not work on the scope half: re-deriving what
  you relay catches a wrong *fact* and does nothing about a wrong *scope*.**
  The probe could have been re-run by anybody and would have printed the same
  numbers, because the run is real and its output says so — **the artefact is
  consistent with both readings**, which is why reading it saved nobody. Scope
  is checked by asking **who owns the subject**, not by looking harder at the
  evidence.
- **A ratio needs a denominator somebody would defend, and a modest-sounding
  one is the hardest error to refuse** *(2026-09-20)*. *The root hash covers
  65 MB of a 1.8 GB artefact* is a **byte** ratio, and the 1.8 GB is mostly
  filesystem slack, partition padding and the ESP — nobody fears the padding
  differing. **3.6% understates the coverage as badly as *covers the image*
  would overstate it**, and it is harder to catch **because it reads as
  modesty**: an overstatement invites challenge and an understatement invites
  agreement. State coverage in the units the claim is about — here, **the
  components that carry code and data onto the device**.
  **And the hardest denominator to get right is the one in a direct
  measurement** *(2026-09-20)*: *nine of ten structs carry the annotation*
  mixed **structs in a file** with **structs a parser reaches**, and it
  survived a day in which every other error was caught by somebody going and
  looking — because **going to the source buys correctness about the objects
  and nothing about the population, and the confidence it produces does not
  know the difference.** A ratio announces itself and invites the question; a
  count of things you actually counted **arrives carrying its own evidence of
  diligence.** *(The claim went one struct → nine → no exception across three
  reads, each by a party closer to the source and each strengthening it, which
  is evidence about the method rather than only about the fact.)*
- **State the unit with the number.** 536 and 535 were both true of the same
  mirror on the same evening — one counts the keys a contract requires, the
  other the distinct byte strings stored — and a bare number is wrong for
  whichever question its reader is not asking.
- **A sentence that counts or quantifies a list beside it is rewritten with
  that list.** "All four boards", "nothing on this list is waiting", "the only
  one that" — each is true when written and false the moment the list changes,
  and no gate can catch it: the sentence and the list are both correct on
  their own and only their relationship is wrong. Prefer a form that does not
  count (*every board*, naming them), and where a count is the point, date it
  so it reads as a measurement rather than as a standing claim.
- **The class it belongs to, named at its third instance (2026-09-19): two
  correct things whose relationship is wrong.** A summary and the list beside
  it; a boundary in one section and a present-tense description of the same
  thing two sections later (`docs/design/build-harness.md` recorded that
  `privileged.yml` has never run, and two screens on still said the lane
  builds, verifies, gates and repart-tests every product); two copies of a
  shared fixture diffed against each other, both saying `x64`, the check
  passing ([harness](../design/build-harness.md) section 4). Each piece is
  defensible alone, which is why no lexical gate can judge the pair, so the
  check is procedural: **a claim about other text — a count, a boundary, a
  negation — is not finished until you have read the text it ranges over**,
  and where two artefacts are only checked against each other, one of them
  must also be checked against the world. *A boundary stated in one section
  and contradicted two screens later is not stated.*
- **An instance counted in two classes inflates both.** The fixture pair above
  belongs to that class — two artefacts checked only against each other — so
  it does not also count towards the observation that a filter encoding one
  naming convention silently drops everything under the other
  ([release-lock](../design/release-lock.md) section 1.3), which keeps two
  instances of its own and stays a rule rather than a class until it earns a
  third that it owns. A taxonomy whose classes each have three instances and
  share all of them says nothing; the threshold above guards against naming a
  class too early, and this guards against the same instances being spent
  twice.
- **And the sentence that says why the same defect keeps arriving in different
  clothes** *(`mica-boards`, 2026-09-20, and it is its formulation)*: **an
  input I authored looks like an output I verified, and nothing in the tree
  distinguishes them.** Its own instance is the cleanest — *the nine lines of
  my floor read exactly like the nine facts they were supposed to establish*.
  Counted against the day it was written, six of the seven shapes these
  records name are it: a copy of the vectors beside the vectors, a committed
  config beside a resolved one, a fragment at `main` beside what ships, a pin
  beside a release, a comment asserting a check beside a check, and a
  requested symbol beside a resolved one. **The seventh is on a different
  axis** — a working tree read as a commit is not an authored thing
  impersonating a checked one, it is a subject with no name at all — and the
  wider phrasing that admits it (*something somebody wrote, sitting where a
  reader expects something somebody checked*) is worth less than the narrower
  one, because the narrow one names the repair.
  **That repair is the same in all six, which is what makes it a class rather
  than a theme: mark which it is, or re-derive the output and compare.** Keep
  the sub-rules; they carry the operational halves and those differ. This
  sentence carries the reason a reader keeps meeting the defect and not
  recognising it.
- **And the price list, which is the argument for a question asked before the
  claim over a rule applied after it** *(2026-09-20)*. Of nine subject errors
  in one day, exactly one was caught **in front of the sentence** — by running
  `git status` before speaking rather than after — and it is the only one that
  cost nothing. Every other was paid for by a second reader, a CI failure, or
  an edit to a page that had already been published. A rule applied after the
  claim is a rule that bills somebody else.
- **Finding an instance is what creates the obligation to sweep, and the
  finder is the least likely person to do it** *(2026-09-20)*. A rename defect
  was found once in the morning, fixed in the file where it was found, and met
  **eight more times** that evening — and the record that found it is the one
  that missed the siblings. The mechanism is not carelessness: **the
  satisfaction of a fix closes the question that the instance opened**, which
  is why the sweep has to be booked at the moment of the find rather than
  after it. Third time in one day that a class was mistaken for its first
  member.
- **Approving a design is reading what it drives, not reading the report that
  describes it** *(2026-09-20)*. *One clone per board* was approved as a unit;
  the script it drives builds **every** board and takes no board argument, so
  the approved design would have built four kernels to keep one, four times
  over — fifty minutes a run with three-quarters discarded. **Nobody would
  have called that a defect**, which is what makes it the expensive kind: it
  is a cost with no failing output, in the same family as a check that is
  right for the wrong reason. The repair is the one this page keeps arriving
  at from other directions — read the artefact, not the account of it — and
  the variant worth naming is that **a unit of work is an artefact too**.
- **And a sweep requires a key** *(2026-09-20, the qualifier the rule above
  needs)*. The rename defect had one — the string `x64`, and one `grep` found
  eight siblings. Where the question is *which incidental property of a valid
  example is somebody treating as required*, **there is no query**, and
  *sweep the rest* means **guess eight times**. So the two statements are
  separate: *this sweep should have happened* and *this sweep is not
  available*. Without the qualifier the rule is a demand for guesses, which is
  the over-reach this page warns about arriving as a **process** instead of as
  a class.
- **And the key must discriminate, which is the third state** *(2026-09-20,
  measured while closing that same class)*. `x64` is both the retired board
  name and the **architecture nickname** — *on an x64 host the arm64 pool is
  emulated* — so the sweep returns something that looks like a list of defects
  and is mostly noise, **and the noise is what stops the sweep**. That is the
  aperture family arriving from the opposite end: not a key that answers too
  little, but one that **answers too much**. Three states, wanting three
  different things: **no key** — wait, and let the next invention specify its
  own fixture; **a discriminating key** — sweep; **an over-answering key** —
  *sort the hits into kinds before counting them*. **A bare substring supplies the nearest subject exactly as a
  bare path does**, which is that state met inside a sweep: a search for
  `trust.sh` returned five hits that were all `embed-trust.sh` and
  `embed-fit-trust.sh` — files whose names **end in** the key — and **the
  count would have travelled where the lines did not**. Read the lines, not
  the count, and note where it happened: *inside the sweep that exists because
  of bare paths*. **And where the misses will
  be is knowable in advance: a rename sweep's residue is prose.** Four places
  one sweep missed on 2026-09-19 were all sentences — a table row, a design
  page, records citing the old name — and **none of them is read by anything
  that runs**, which is why code and fixtures moved and the sentences did not.
  **That is a population to search, not four accidents.** Sorting is what made that
  class closeable: historical record that must keep the old names or stop
  being history, the records **of** the defect that quote it to name it, and
  the nickname. Its author's sentence is the test of a closed class: **"no
  fourth home, and now I know that rather than hoping it."**
- **And the harder case: a correct generalisation that still did not produce
  the count** *(2026-09-20)*. The record that first found that defect
  generalised it **rightly** — naming the one place where no copy could be
  blamed — and then fixed a single file, while eight siblings waited for the
  evening. Every other over-reach here was written by somebody convinced by
  their own sentence; this one was **not an over-reach at all**, which is why
  the rule above does not reach it. **Naming a class is not counting it**, and
  writing the general sentence can close the question as firmly as a fix
  does.
- **A second candidate at two instances, and this one has a failure mode: a
  right conclusion resting on a wrong reason** *(2026-09-20, both instances
  this repository's)*. The `subuid` ranges are inert (right) *because no code
  asks for it* (wrong); clause A was unsatisfied (right) *because nobody had
  done the work* (wrong — nobody can). **The failure is remote, which is why
  review cannot catch it: the reason is what a reader generalises from.**
  Nobody re-derives a conclusion; they carry the reason to the next case. An
  integrator who reads *no code asks* carries forward *I cannot reach it*,
  reaches it with `--userns=auto`, and meets a failure instead of a mapping —
  **the conclusion protected them and the reason sent them.** The test: **ask
  what a reader would do with the reason, not with the conclusion** — a
  conclusion is consumed once, in place; a reason travels.
  **And the other half, which this entry would be dangerous without: the same
  property that makes a wrong reason travel is the only thing that makes a
  claim correctable at all.** Both of the evening's `cannot` errors were in
  **reasons**, and both were caught **because** they were reasons: the claim
  *the UKI has no keyless fingerprint* could only have been believed or
  disbelieved, while *signing is part of producing it rather than a wrapper
  around it* is a checkable statement about PE files, and checking it turned
  *two of four* into *three of four* before it was published. **Stating a
  reason exposes you to being wrong in a new place and is the only thing that
  lets anybody find it.** So the rule is not *give reasons* and not *beware
  reasons*: **the trade is worth taking, because a bare claim's errors are
  permanent — a conclusion offered without a reason cannot be argued with,
  only overruled.**
  *(Kept separate from a **check** right for the wrong reason, which these
  records already hold, and separated by repair as the membership rule
  requires: a check is repaired by making it read the right thing and fails
  **when the world changes**; a statement is repaired by fixing the reason and
  fails **when a reader travels**. Two classes, not one — decided with
  instances of both in hand rather than by how alike they sound.)*
- **A candidate recorded at two instances, with its test written in advance —
  deliberately not named** *(2026-09-20)*. Two defects share a property
  narrower than *no failure mode*: **the deliverable is correct and stays
  correct.** A unit of work that builds four kernels to keep one — the image
  is right, the price is wrong; and a wrong supporting number inside a true
  paragraph — the conclusion is right, the number is wrong. Neither is a false
  green, two checks cancelling or right-for-the-wrong-reason, because in all
  of those the **output** is wrong and somebody eventually trips on it. Here
  there is nothing to trip on. **The candidate test, stated now so it cannot
  be fitted to the third instance afterwards: the defect lives in a dimension
  nothing downstream reads.** Nobody consumes the price of a build; nobody
  checks a supporting number against the conclusion it supports. Two instances
  and a use make a writing rule; **a claim about how the world is needs three
  and truth**, so this is not named — and whoever meets the third can test it
  against a sentence that was not written with their instance in front of it.
  *(Writing it down early is the whole of its value: a test stated after the
  third instance is a description of three things, not a prediction.)*
- **A third guard, pointing the other way from those two** *(2026-09-20)*.
  The threshold and the double-counting rule both guard against **evidence
  that under-reaches** — too few instances, or the same ones spent twice.
  Neither guards the opposite failure: **a class stated widely enough to
  absorb every instance**, which passes both tests and says nothing. One
  instrument answers both — **enumerate the instances, then test each one
  against the class as written**. Under-reach shows as a count below the
  threshold; over-reach shows as an instance the class admits that nobody
  would have called a member. A class is not checked by re-reading it, only by
  putting its own instances back through it, and the occasion for this was a
  synthesis withdrawn by its author after counting rather than after being
  argued with.
- **What the threshold is actually guarding against, since that decides when
  it could ever move: a reader inventing a pattern.** Two instances a single
  reader finds while looking for a pattern are two instances *and* one reader;
  two reached **independently** — by repositories that never saw each other's
  messages — cannot have been matched to the same template, so the manner of
  arrival supplies the guard the third instance would have. The bar does not
  move today and none of the rules here were written on two: this is recorded
  because it is the **one distinction** on which it could, and because whoever
  meets the case should recognise it rather than argue the count. The instance
  that prompted it: *a board overlay re-enabling `tty1` would be a board
  repairing a composer* and *a detector belongs in the CI of the repository
  whose files it guards* are one principle — **the fix belongs where the thing
  being fixed lives** — reached in two repositories within an hour, neither
  having seen the other. A second such pair followed the same evening: *an
  alarm that cries wolf destroys the instrument more quietly than one that
  never fires*, reached by design here and by consequence in `mica-res`. **If
  a third pair appears, the fact worth recording is not any of the ideas — it
  is that this workspace is producing convergence rather than correction**,
  and that is a claim about the workspace with a record of its own.
- **When a mechanism looks like it serves a reason it does not serve, write
  what it is for beside it.** Three instances in one evening: `nosuid,nodev`
  on a container graph root looks like hardening, and the access model does
  not support the belief; `tty1` sitting quiet looked like a logo policy and
  was a dropped symlink on three of four boards; a `lock` row in the mirror
  would have looked like pool coverage. The repair is the same each time —
  **say what it is, keep what works, and stop anyone reasoning from the
  appearance** — because the next reader either extends the mechanism for
  consistency or removes it as theatre, and both are wrong for the same
  reason.
- **The threshold binds whoever adopts a generalisation as much as whoever
  offers one.** It is written as a rule for authors, and the failure it was
  built to prevent happens at adoption: on 2026-09-20 a one-instance
  generalisation about kernels was offered confidently, written into a
  standing note the same hour, and was false — withdrawn by its own author,
  who kept measuring after being believed. **Being believed is where
  measurement usually stops**, so the question to ask of an arriving rule is
  the one you would ask of your own: how many instances, and did any of them
  come from somewhere that could have disagreed?
- **A record may not drive the artefact it describes** *(2026-09-20)*. A
  release cut to feed a check nobody has written, or a push made so that a
  page reads as current, is the page driving the artefact — the tail of these
  records wagging a product that people run. The instruments here are written
  to **go red and wait**, not to be satisfied: a claims row that is red
  because the world moved is doing its job, and the repair is a measurement or
  an edit, never an artefact cut to turn it green. *(This is why a prediction
  table is worth more than an alert: it says which red means "go and change
  the page", and none of them means "go and change the world".)*
  **And when this collides with *a record must describe the artefact
  accurately*, neither gives** *(2026-09-20; the collision stayed invisible
  tonight only because a comparison point turned out to be already published,
  which is luck)*. A restatement that genuinely needs an artefact change meets
  both rules at once, and *you may not write it* is not an answer. The
  resolution is a third thing: **the record states what it cannot say and why,
  and the artefact's owner decides whether to move. A record naming its own
  limit is not driving anything** — it is the only form that keeps the
  accuracy without spending somebody else's artefact.
- **Ask the membership question from both sides** *(2026-09-20)*. The third
  guard says to enumerate the instances and test each against the class; this
  is its other half, because **a count taken from one side is a sample that
  reads as a census**. Today: the vector copy's suite counted the vectors it
  held (81) and the source held 143; a floor counted the lines it asked for
  and not the outcomes they produced. Where two independent measurements agree
  on a count, the class is closed; where only one exists, say which side it
  was taken from.
- **A clause that cannot distinguish *not yet done* from *cannot be done* is
  read as the first every time, because that is the reading that asks nothing
  of the reader** *(2026-09-20)*. *Unproven* is the comfortable state: it
  implies somebody will eventually, and it costs whoever holds it nothing
  today. One clause here was tracked as open for a day while it was **closed
  by the trust model** — signed bytes cannot be reproduced without the private
  keys that only the release job holds. **And what distinguished the two was
  not a better reading of the clause; it was somebody grepping for where a
  value comes from.** So a clause states which kind of obstacle it faces, or
  it will be read as the kind that effort removes. **And the sharper form,
  which arrived inside the sentence meant to replace that very clause: such a
  statement is read as the stronger claim when it suits the writer and the
  weaker one when it suits the reader.** *Cannot* closes a gap for whoever is
  tired of it; *not yet* keeps it open for whoever is not. Neither reading is
  a lie and the text supports both, which is why **the word has to be earned
  by a measurement before it is written**. *(Fifth subject for the
  practice above — a tree, a comment, a report, a unit of work, and now a
  clause. The five share a repair and not a failure mode, so it stays a
  practice.)*
- **A table's heading is load-bearing, and it is the least-read part of a
  table** *(2026-09-20)*. The same row — a repository-qualified path to a real
  file — is **correct** under *call sites of this key* and **misleading**
  under *cases that are exercised*, and **nothing in the row distinguishes
  them**. A reader scanning for coverage meets a citation that resolves and
  has every reason to believe what they conclude. So a table that could be
  read either way says which it is **inside the table**, not in a note above
  it: a note is read by somebody who is reading notes.
- **A status line is a cached summary of the notes below it, and nothing in
  the file says which was updated last** *(2026-09-20)*. A record can change
  **in the note** while the status reads the same: the offline-build task's
  acceptance line was untouched all day while a note four paragraphs down went
  from *unreachable* to *the seam was crossed* — **the sentence that changed
  was not the sentence anybody was looking at**. A reader who trusts the
  status is reading a summary that may predate the thing it summarises. The
  cheap repair is a format rather than a rule: **when a note changes the
  state, the status line says so and carries the date it was decided**, which
  turns *which of these two is newer* from unanswerable into readable. Applied
  to that task today; making it a required form across every task file is a
  proposal and not something to impose on 48 records by fiat — **which would
  have produced 47 status lines carrying dates nobody verified against their
  notes, a cell that reports itself falsely, and that is worse than the empty
  one.**
- **Do not rewrite a page to the later fact when the earlier one taught
  something** *(2026-09-20)*. A claim was published at 16:24 with its subject
  named — a re-pin that answered 422 at `origin` — and by 16:28 the push had
  landed and the same sentence was stale. The page keeps **both timestamps**
  rather than the current state alone, and the reason is not only honesty: **a
  page rewritten to the later fact teaches the next reader nothing, while a
  page that shows a sentence being true and then not true in four minutes
  teaches them to put a time on theirs.** The first is a correct page; the
  second is a page that changes behaviour. Where the superseded reading
  carried no lesson, drop it and date the new one — this is not an argument
  for keeping every stale sentence.
- **Where no instrument exists, a named person with a deadline is the
  substitute — and the failure mode to avoid is neither** *(2026-09-20)*: a
  page waiting on a repair nobody promised. Today produced four instruments
  and two things that needed a person, and saying which is which is what stops
  the next reader assuming the instruments cover everything. A held sentence
  with an owner is a decision; a held sentence with nobody attached is a
  sentence that will be found stale by whoever trips over it. **And there is a
  third form, which is the one that gets mistaken for the first two**: a claim
  neither an instrument nor a person can hold — *a shipped artefact is
  asserted against the floor* is not expressible as a line in a file — and it
  is carried by the record alone, which then has to **say that it is**. An
  instrument whose limits are unwritten becomes the next false assurance: the
  row that watches one path reads as coverage of the question that path was
  cited for.
- **A class defined by a shared failure mode is a diagnosis; a class defined
  by a shared repair is a practice, and they are not written the same way**
  *(2026-09-20)*. *Read the artefact, not the account of it* has four subjects
  and **four different failure modes**: a **tree** — the artefact was there
  and a different one was read (wrong subject); a **comment** — the account
  was true when written and went stale because nobody reads the cited thing;
  a **report** — accurate, and reachability was inferred that it never claimed
  (over-reading a true account); a **unit of work** — there was no account at
  all (never looked). One repair, four diagnoses. **A diagnosis tells a reader
  what happened and lets them recognise it; a practice tells them what to do
  and cannot help them recognise anything** — nobody meeting the third will
  know it from the rule, because nothing looked wrong at the time. So a
  practice is written **with its subjects named and no failure mode
  attached**, and the missing failure mode is the honest signal that it will
  not help anybody spot the fifth.
- **And a practice can precede its diagnosis**, which the entry above was
  written as though it could not *(2026-09-20)*. A candidate held at two
  instances **has no recognition sentence yet, and that is its expected state
  rather than a defect in it**. This also says what the third instance
  decides, which is more than membership: **if the three share a failure mode
  the candidate becomes a diagnosis** and a reader can be taught to recognise
  it; **if they do not, it stays a practice permanently**, and the missing
  recognition sentence is then **a finding rather than a gap**. So whoever
  meets the third instance is asked to check for a shared failure mode and not
  only to count to three.
- **Sort by whatever determines the action, which is not always the same
  property** *(2026-09-20, from two rules written the same day that look like
  they disagree)*. A triage of dropped files sorts by **consequence**, because
  the consequence is what you do about the file
  ([harness](../design/build-harness.md) section 7). A class of defects sorts
  by **repair**, because two defects with the same symptom and different
  repairs are two classes. The test case: a matcher comparing unit patterns
  literally, so `disable getty@.service` never matched `getty@tty1.service`
  and a decision was reported as an absence. Its *consequence* is identical to
  a set that cannot see outside its own scope — an exclusion read as an
  absence — but its *repair* is not: the matcher is a **bug**, fixable inside
  the artefact, while a set defining its own completeness or membership is
  **correct behaviour inside a stated scope** and can only be answered by a
  second artefact or by asking the question per item. So it is not a third
  instance, and saying so is worth more than the instance would have been.
- **When a text crosses a repository boundary, the author writes the rule and
  the repository that can measure supplies the number — and neither signs for
  the other's half** *(2026-09-20)*. Three handed-over texts landed here in
  one day; the third arrived with a **deliberate hole** where a count belonged,
  because its author had relayed a wrong one earlier and the repository
  receiving it could read the figure out of its own commits. That is better
  than checking a number afterwards, and the reason is mechanical rather than
  polite: **an empty slot is visible and a wrong number is not.** Every figure
  that travelled wrongly this workspace has recorded was a filled slot —
  nobody would have quoted a blank. Checking afterwards costs a second reader
  and only works if that reader arrives; leaving the slot empty costs the
  author nothing and cannot fail silently.
- **And say so when you reverse an answer you have already given**
  *(2026-09-20)*. Re-measuring and correcting yourself is the behaviour these
  rules want; not announcing it is what makes the correction private. A
  measurement that has been passed on is **already in somebody else's page**,
  so the moment it is withdrawn, everyone still holding it is holding it on
  your authority — and they will not re-measure, because you answered. The
  instance: a kernel symbol's routing was reversed by a second measurement,
  correctly, without a word, and the superseded version reached two more
  repositories before the tree was read. **A reversal costs one sentence and
  is the only part of re-measuring that other people can act on.**
- **The strongest pair is one instance hypothesised and one observed**, and
  that is a better reason to keep both than *two is not three*. A rule
  designed in guards against a failure someone imagined; a rule extracted from
  a failure that actually happened establishes that anyone would ever have hit
  it. Keeping dated measurements out of the world gate is the first kind —
  nobody knows whether anyone would have added one; `mica-res` reaching the
  same rule after two false alarms in an hour is the second. Where a pair has
  both, say which is which: the hypothesis explains, the observation proves.
