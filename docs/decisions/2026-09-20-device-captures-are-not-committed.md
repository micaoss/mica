# A hardware capture carrying a SoC serial is not committed to a public repository

- **date**: 2026-09-20
- **kind**: working practice, enforced since 2026-09-19 and recorded here because it governs every repository
- **owner**: every repository that takes a capture; the bytes are held in coordination
- **review sunset**: 2027-03-20, or the user's decision on where captures live, whichever comes first
- **status**: practice; the user's decision on the destination is open

## Decision

A capture taken from real hardware — a boot log, a console transcript, a
register or firmware dump — that carries the SoC serial is **not committed to
a public repository**. A repository cites the capture by its **sha256**; the
bytes stay with the coordinator under `.bkd-coordinator/evidence/` until the
user decides where captures should live.

## Why

Mica OS derives the device hostname and the MAC address from the SoC serial
(`docs/boards/`), so a capture containing that serial publishes a device
identity, not just a log. The repositories are public. The harm is not that
the number is secret in itself; it is that the number is the device's name on
every network it joins, for the life of the board.

## What this does and does not ask for

- It asks for the **citation** to be complete: a sha256 a later reader can
  match against the bytes, plus what the capture shows, so a record stands on
  its own without the file.
- It does **not** ask for redaction in place. A capture with the serial
  removed is a different artefact from the one that was taken, and a
  qualification row should name what was taken.
- It does not block evidence: a board dossier may cite a capture it does not
  carry. `mica-boards` did exactly that on 2026-09-19 — correctly, and because
  it was told to, which is why this record exists rather than the practice
  continuing to live in one place.

## Open

Where captures live permanently is the user's decision: a private repository, a
bucket beside the mirror, or with the coordinator as today. The practice above
holds either way; only the destination changes.
