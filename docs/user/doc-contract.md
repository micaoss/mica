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
- **The strongest pair is one instance hypothesised and one observed**, and
  that is a better reason to keep both than *two is not three*. A rule
  designed in guards against a failure someone imagined; a rule extracted from
  a failure that actually happened establishes that anyone would ever have hit
  it. Keeping dated measurements out of the world gate is the first kind —
  nobody knows whether anyone would have added one; `mica-res` reaching the
  same rule after two false alarms in an hour is the second. Where a pair has
  both, say which is which: the hypothesis explains, the observation proves.
