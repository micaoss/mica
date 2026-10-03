# Manufacturing and the device-identity lifecycle

The rules for putting Mica OS on units at volume: what a factory consumes,
what it must verify, what it records, and how a failed or returned unit is
handled without ever cloning an identity. The integrator's guide is
[manufacturing](../integrate/manufacturing.md).

## 1. What exists today

**Mica OS ships no factory tooling.** What a factory builds on is:

- first-boot self-provisioning: a device mints its own device id, hostname and
  secrets on its first boot, never in the image
  ([provisioning](../integrate/provisioning.md));
- a provisioning document or a product seed for the first configuration
  ([provisioning](../integrate/provisioning.md) sections 4 and 6);
- the whole-disk write of each board, with read-back, as the flashing and
  recovery primitive ([board pages](../hardware/README.md));
- `GET /api/v1/system/info`, which lets a station ask a flashed unit for its
  deployment and whether it trusts production or development keys.

Everything below is the contract factory work is built to. None of it is
tooling in these repositories.

## 2. Inputs are versioned

Every input a factory consumes is versioned, immutable once issued, and named
in the per-device record. A device built from unversioned inputs cannot be
audited, recalled by cohort or reproduced.

| Input | Rule |
|---|---|
| The release image | a named, signed release, never a loose build; an image that trusts development keys is never flashed at a station ([signing](../security/signing.md)) |
| Serial numbers and MAC addresses | issued as bounded allocations; a value is consumed exactly once and never returned to a pool |
| Calibration data | produced by versioned stations; the station version is part of the record |
| Identity | not an input: it is minted on the device, and the station witnesses it |
| Keys | a factory receives public anchors and signed artifacts only; private signing keys stay in the signing environment |

## 3. Nothing is injected unverified

Nothing is verified only by the tool that wrote it.

- **Image**: read back and compared with the release's published digests
  before first boot.
- **Serial and MAC**: read back through the running system and checked against
  the allocation, both that the value is the assigned one and that it was not
  consumed before. A duplicate is a quarantine event, not a retry.
- **Calibration**: the calibrated subsystem's output is checked against
  acceptance bounds, not merely that the write succeeded.
- **Identity**: the station witnesses first boot complete and records the
  device id read from the device. A station never supplies or copies one.

## 4. One record per device

Created at the first station, closed at pass or quarantine, and kept for the
support lifetime of the product:

- the identity (device id, serial, MAC addresses) **as read back**, not as
  assigned;
- every versioned input consumed;
- per-station evidence: measured values against bounds, not bare verdicts;
- the disposition: pass, or quarantined with the failing station;
- for a reworked unit, the link from its old identity to its new one.

Rows are pass, fail or not tested, never implicitly green
([qualification](../hardware/qualification.md)).

## 5. Quarantine, rework and returns

A unit that fails a station stops moving forward. Its consumed serial and MAC
stay consumed. It leaves quarantine by rework, under a new record generation,
or by scrap, which includes destroying its storage: DATA is not encrypted
([security model](../security/model.md)).

**A device identity exists on exactly one physical device, ever.**

- A replacement board gets a new identity. A fresh write mints a fresh device
  id on first boot; nobody copies one unit's state onto another to preserve
  it. Continuity is in the record, not on the flash.
- A returned unit's credentials are treated as exposed from intake, and any
  trust tied to its identity is revoked then, not at diagnosis.

## 6. Ports, by lifecycle stage

| Port | Factory | Field |
|---|---|---|
| Serial console | open; stations may use it to witness provisioning | a login prompt that no account can satisfy ([access](access.md)) |
| SSH and the API | station network, station credentials | SSH off by default; access by an operator-enrolled key |
| Board loader mode | the flashing primitive | open to physical access: it is the recovery path and the physical-access boundary |
| JTAG / SWD | open on the bench | per board and revision, recorded in the board's `evidence.json`; no current board enforces a closed state |

The field posture is therefore: software access closed by default and gated by
credentials; physical access open by design, and stated as the boundary.

## 7. Irreversible operations

Fusing a debug port off, locking a boot configuration or burning a key hash is
irreversible on most SoCs, and on a device whose recovery path is the physical
port an incorrect fuse destroys that path.

- No irreversible operation enters production without validation on
  sacrificial hardware of the same board revision, including proof that the
  fused unit still boots, still updates and still has a recovery path, or a
  recorded acceptance that it has none.
- Vendor documentation is input, not evidence.
- Until a board carries that validation, Mica OS ships no fused debug or boot
  policy for it, and claims nothing above the software levels of the
  [assurance ladder](../hardware/assurance.md).
