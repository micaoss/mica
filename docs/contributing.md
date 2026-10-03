# Contributing to this documentation

This page is the contract behind the documentation in this repository: who it
is for, what each tree owns, how a claim about the product is labelled and
evidenced, and how the English and Chinese trees relate. A page that cannot
follow it is a defect in the page, not a licence to relax the contract.

## 1. Audience

Mica OS is an embedded appliance operating system. The documentation serves
three readers, in this order:

1. **Device operators**: the person in front of a fielded appliance,
   installing, configuring, updating, recovering, and deciding what to tell
   support.
2. **Product integrators**: the team building a product on Mica OS, composing
   images, delivering applications, selecting and qualifying boards.
3. **Support engineers**: the person a failure report reaches, who needs the
   device's identity and the honest boundary between what ships and what does
   not.

## 2. What lives where

This repository documents **the product**. How a module is built, tested and
released, and every wire format and schema version, is documented in the
repository that owns it; a page here states the behaviour and cites the owner
as `<repository>:<path>` instead of restating it.

| Tree | Owns |
|---|---|
| `start/` | what Mica OS is, getting an image, booting a device |
| `operate/` | running a device: configuration, updates, recovery, storage, troubleshooting, the API |
| `integrate/` | building a product on it: applications, containers, the bus, the console, provisioning, manufacturing |
| `hardware/` | one page per board, the board status table, the support tiers, assurance and qualification |
| `security/` | the security posture, the model, the lifecycle and the trust chain |
| `reference/` | the contracts of a device's behaviour that the guides rely on |
| `releases/` | how a release is identified, made, distributed and supported |
| `website/` | micaos.dev content briefs |
| `decisions/` | dated product decisions |

One page owns each fact; every other page links to it. `docs/README.md` is the
catalogue, and `make docs-verify` holds it to the tree.

## 3. Truth-status taxonomy — normative

Every capability claim in this documentation set carries a status. This is the
core of the contract: documentation alone can close usability gaps, and it must
never claim that missing mechanisms already ship.

The four statuses:

- **shipped** — the capability exists and is exercised by the build or its
  checks in the repository that owns it. Claiming it requires evidence that
  exists.
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
> status: shipped — evidence: `mica-core:crates/mica-apid/openapi.json`
> status: board-dependent — evidence: `mica-build:boards/cx3576/board.env`
> status: proposed — evidence: `docs/integrate/managed-applications.md`
> status: unsupported
```

### Evidence rules

- `shipped` and `board-dependent` must cite something that exists: a path in
  this repository, a path in another as `<repository>:<path>`, or a
  `make <target>`.
- `proposed` must cite what describes the work: the design that labels it not
  implemented, or the record of the repository that will implement it
  (`<repository>:docs/...`). This repository keeps no task or plan records.
  When the work lands, the page is relabelled.
- `unsupported` carries no evidence; the absence is the claim.
- Evidence is verified to exist before it is cited. A dead evidence reference
  is a broken claim, not a cosmetic defect.
- No `path:line` citations anywhere in this set. A document coupled to line
  numbers is falsified by edits that leave its meaning intact. Where a precise
  contract is needed, the artifact that carries it is named instead — for
  example, the HTTP surface is `mica-core:crates/mica-apid/openapi.json`.

### Proposed content

Where a page describes a capability that is still being built, it states the
planned contract and labels it `proposed` with the open record as evidence.
The evidence rule above forces the relabel when that record completes or
closes, so no separate TODO marker is used.

## 4. English and Chinese

English is authoritative. The Chinese set lives under `docs/zh/` in the same
layout and covers `start/`, `operate/`, `integrate/`, `hardware/`, `security/`
and `releases/`. `docs/zh/README.md` carries a coverage table with, for every
English page in a gated tree, the source version it was translated from and a
status: `current`, `lagging` or `not-translated`. On any conflict the English
page wins.

`tools/docs/verify-coverage.sh`, run by `make docs-verify`, checks the table
against both trees in both directions, and requires a `current` page to carry
the same status lines, in the same order, as its English source.

> status: shipped — evidence: `docs/zh/README.md`, `tools/docs/verify-coverage.sh`

## 5. Style rules

- Every page starts with an H1. Internal links are relative.
- Sober prose; no marketing register. A limitation is stated in the sentence
  that would otherwise overclaim, not in a footnote.
- **Present state only.** A page says what is true now. It carries no
  chronology, no "previously", no account of how a decision was reached; a
  decision that still binds is a record under `decisions/`, and history is in
  `git log`.
- **One fact, one place.** Link to the page that owns a fact instead of
  restating it. A fact another repository owns is cited, not copied.
- **Do not restate what moves.** Schema versions, release stamps, commit
  hashes, counts of products or tests, and upstream version numbers belong to
  their owners. Name the artifact that carries them.
- Commands shown are the real ones, checked against what they name.
- State the unit with the number.
- A sentence that counts a list beside it goes stale when the list changes.
  Prefer the non-counting form: "every board", and list them.
- A capability that has not run on hardware says so where it is described.
- When you explain some members of a set, say whether the set is closed.

## 6. Checks

| Command | Checks |
|---|---|
| `make docs-verify` | the catalogue against the tree, links, status lines and their evidence, the Chinese coverage table, the board pages against the template |
| `make docs-verify-test` | that each of those checks fails on a fixture where its fact is false; lints the scripts |
| `make docs-verify-world` | claims about other repositories, and every `<repository>:<path>` citation, against those repositories |

> status: shipped — evidence: `tools/docs/verify-index.sh`, `tools/docs/verify-status.sh`, `tools/docs/verify-citations.sh`
