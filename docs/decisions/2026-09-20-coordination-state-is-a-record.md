# A coordinator's working state is a record nobody else can read

- **date**: 2026-09-20
- **kind**: working practice, written from five instances in one evening
- **owner**: whoever coordinates; every repository that is told something it cannot verify
- **review sunset**: 2027-03-20
- **status**: accepted (coordination, 2026-09-20)

## The rule

A constraint, practice or open question that exists only in a coordinator's
working state **is a record that nobody else can read**, and the role produces
them faster than any single one gets written. So the moment a rule is
*enforced* is the moment it needs a record — not the moment the work it
governs ends.

The test, which is the operational half: **could someone check this without
asking the holder?** If not, it is unrecorded no matter how consistently it is
applied.

## The five instances, all of 2026-09-19 and 2026-09-20

1. **The 2026-09-14 format freeze.** Enforced across seven repositories for six
   days on recall alone; written in no tree
   (`docs/task/20260920-0610-producer-data-assets.md`).
2. **The 2026-09-16 consolidated-round pause.** Never formally lifted: it
   ended because work resumed and nobody said the word
   (`2026-09-16-consolidated-round-pause.md`).
3. **The device-capture practice.** Enforced all evening, correctly followed
   by `mica-boards` *because it was told to*
   (`2026-09-20-device-captures-are-not-committed.md`).
4. **The release-deletion authorisation**, which contradicted a rule written
   in the workspace instructions, so the tree and the holder gave different
   answers and the difference was a deleted release
   (`docs/task/20260920-0629-release-deletion-question.md`).
5. **The VT question**, held as an open user decision that no repository could
   see ([access](../design/access.md) section 2).

## Why the role produces them

Coordination is where cross-repository facts meet: a rule is usually issued to
solve one repository's problem and then applied to the next, which is exactly
the path that never passes through a file. Each instance above was reasonable
when it was issued. None of them was written, and four of the five were found
by the repository being told, not by the one telling.

## What to do instead

- Write the rule **when you enforce it the second time**, which is when it has
  stopped being a one-off.
- Place it by what it constrains: one repository's constraint in that
  repository's records; a cross-repository constraint in `mica`; anything
  explaining why two artefacts deliberately disagree in `docs/decisions/` with
  a sunset.
- Record the **end** of a constraint in the same file as the constraint, so it
  does not acquire two half-lives, and record it deliberately rather than
  letting it expire by disuse.
- A queued record — "I will write it when the work lands" — is an unrecorded
  constraint with a good intention attached.

## Better than a record, where the constraint can compute itself

A record still needs someone to read it at the right moment. A check does not.
`mica-res`'s `coverage` computes `poolsCovered()`, false today, so a retention
proposal naming a `pool.*` package can be **refused mechanically** while that
is false — and the refusal **disappears by itself** when something mirrors the
pools. So: **a constraint that verifies itself cannot decay, and it retires
itself when its reason ends.**

That is the better answer to this whole page wherever it is available, and it
is available less often than it looks: it needs the constraint's reason to be
computable from the world rather than from intent. Where it is not, the rule
above stands and the record is what there is.

## Why it is written as a rule rather than as an incident

Five instances across two days is a claim about how the role works, not a
sequence of lapses. The next coordinator inherits the same structure and none
of this one's memory, which is the whole reason it is here rather than in a
report.
