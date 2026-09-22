# Board support tiers

A tier is a claim about evidence and ownership, not about whether an image
boots. Mica OS normally supplies the contract and the guidance while the
integrating customer selects and integrates the board, so the tiers exist to
keep three different situations from blurring into one word "supported".

The definitions below are the vocabulary. Whether a board has reached a tier
is answered by that board's dossier; the current placement is under
[Current boards](#current-boards).

> status: shipped — evidence: `docs/boards/qualification.md`, `docs/boards/board-template.md`
> status: board-dependent — evidence: `docs/boards/cx3576.md`

## The tiers

### mica-qualified

**Definition.** Mica OS owns the board's port and its evidence: the dossier is
complete, and the field-reliability matrix
([qualification.md](qualification.md)) was run by Mica OS on a named revision
with dated rows — including the power-cut, A/B-update and recovery rows,
which are the tier's gate.

**Evidence it names.** A dossier validating against
[board-template.md](board-template.md); a qualification matrix with dated
`pass` rows for at least cold/warm boot, A/B switch and update, power-cut
during update, and recovery, on the named combination; an Assurance level
section with per-level status lines.

**Lifecycle owner.** Mica OS: BSP sync, CVE response and requalification on
change are Mica OS's to run, on Mica OS's cadence.

**Permitted claims.** Release notes may list the board as supported at the
named revision/combination; the website may present it as a qualified
platform, stating the evidenced assurance level (I1–I4) and nothing above
it.

### integrator-qualified / bring-up

**Definition.** The port exists and the contract is met — the board builds,
the image verifies, the dossier exists — but the field evidence is owned by
the integrating customer, or is still being accumulated (bring-up). This is
the normal tier for customer-selected hardware.

**Evidence it names.** The same dossier and matrix grammar, with the matrix
rows filled by the integrator (or honestly `not tested` during bring-up),
and the Owners section naming the integrator as qualification owner.

**Lifecycle owner.** The integrating customer, with Mica OS providing the
contract, the templates and guidance. Which side owns BSP sync and CVE
response is recorded per board in the dossier's Owners section — it is not
implied by the tier.

**Permitted claims.** Release notes may state that the board builds and
passes the repository's gates; neither release notes nor the website may
call it "supported" or "qualified" without naming whose qualification it
is. Field-reliability language belongs to whoever holds the evidence.

### unsupported

**Definition.** Everything else: no dossier, an out-of-support kernel tier,
unresolved redistribution rights, or a port that was never taken through the
[porting manual](porting.md). "It boots" does not move a board out of this
tier — field reliability, recovery, update and lifecycle ownership are
exactly the things a booting image leaves unproven.

**Evidence it names.** None required; where a dossier fragment exists it
records why the board is unsupported (Known limitations).

**Lifecycle owner.** Nobody — which is the point of saying it.

**Permitted claims.** None. The board may be mentioned only as explicitly
unsupported.

## Tier assignment and movement

- A tier is assigned per board **and revision combination** (the
  qualification binding), at release registration (porting manual stage 10).
- Movement up requires the evidence, not intent: bring-up becomes
  integrator-qualified when the integrator's matrix rows are dated;
  either becomes mica-qualified only when Mica OS runs and owns the matrix.
- Movement down is automatic in effect: a re-qualification trigger
  ([qualification.md](qualification.md) section 5) reverts rows to
  `not tested` for the new combination, and the tier's claims lapse with
  them until the matrix is re-run.

## Current boards

This table is the single source for board status; other documents link here
instead of restating it. No board is mica-qualified: no dossier has a dated
physical qualification row.

| Board | SoC / boot | Disk layout | Release target | Build | Acceptance on file | Tier today |
|---|---|---|---|---|---|---|
| `uefi-x64` | generic amd64 system, UEFI systemd-boot with a signed UKI | ESP/SYSTEM/DATA | yes | complete image | QEMU lifecycle: API, power actions, reboot, runtime, updates and reset | bring-up (QEMU baseline) |
| `uefi-arm64` | generic arm64 system, UEFI systemd-boot with a signed UKI | ESP/SYSTEM/DATA | yes | complete image | QEMU API, update, fault and reboot rows — [uefi-arm64.md](uefi-arm64.md) | bring-up (QEMU reference) |
| `cx3576` | Rockchip RK3576, U-Boot with a signed FIT | FIRMWARE/SYSTEM/DATA | yes | complete image, static verification | physical rows not tested — [cx3576.md](cx3576.md) | bring-up |
| `s905x5m` | Amlogic S7D (BM201), U-Boot with a signed FIT, SD boot | FIRMWARE/SYSTEM/DATA | yes | complete image, static verification | build and fixture rows only; physical rows not tested — [s905x5m.md](s905x5m.md) | bring-up |

"Release target" is `BOARD_RELEASE_TARGET` in the board's `board.env`. It
says that the board's images are built and published and that its products
appear in the version index. **It is not a claim that the board boots on
hardware** — that claim lives in the dossier, and for `s905x5m` the dossier
still says four physical rows untested with `RFCT-922` open.

**A hardware boot of `cx3576` was reported by the user on 2026-09-20**, the
first physical boot report here. It changes no row in this table: a pass row
carries a date and an evidence reference, and this arrived as a sentence with
no artefact, so `cx3576` keeps "physical rows not tested" until the board's
dossier records one. What it would satisfy, and what the person who booted it
would have to keep, is the board's to state (in `mica-build:boards/cx3576/`
since the merge of 2026-09-21).

`s905x5m` was opened as a release target by user decision on 2026-09-19 and
published its first release, `s905x5m.20260920-0033`, on 2026-09-20; its tier
does not move and stays bring-up with the same evidence column.
That combination is not a contradiction, because being a release target has
never meant being qualified on hardware here — `cx3576` has published images
at the bring-up tier, with the same "physical rows not tested", since before
the rename. `s905x5m` was the outlier and this table gave no reason for it, so
the decision removes an inconsistency rather than lowering a bar. The flag in
`board.env` and the first release followed from `mica-boards`, and `mica-build`
re-pinned and published its products after that; since the merge of
2026-09-21 one `mica-build` release scoped to the board does both.

The flag took a while to flip, and the reason is worth reading: **the board
had no `evidence.json`**, and `mica-build`'s release manifest requires one — `schemaVersion` 2, the board name, a known `bootAssurance`, a non-empty
qualification, at least one `evidenceRef` and `physicalBoundaries`. Flipping
today would produce a product whose release manifest cannot be built, so
`mica-boards` wrote the document first, on the `cx3576` model that states its
own pending physical rows. That document is where the distinction this table
draws — a release target is not a hardware claim — gets stated for this
board.
uefi-x64 and uefi-arm64 evidence is emulator evidence, not field evidence.
It is also dated evidence, and it is uneven in two directions. Between the
UEFI boards: since
2026-09-19 every amd64 product is booted automatically — on each push to
`main` and again in its release run — so `uefi-x64` carries a boot per push
and per release, while `uefi-arm64` carries none: the gate's boot step is
amd64-only and was skipped for both its products
([harness](../design/build-harness.md) section 4). And between UEFI and FIT:
the `cx3576` and `s905x5m` images are started by nothing in these
repositories, because no suite boots a FIT image at all — `tests/lifecycle-uboot-fit/` runs on the
host and carries no QEMU, and both suites that do start a guest refuse a FIT
board by name. The FIT side is checked on every push; it is unstarted, not
unattended. Four of the eight published products are on that
side, and `cx3576` has been there through six releases, so it is the rule for
the FIT backend rather than a new board's exception. A published image is not
a booted image, and for these two boards that gap is the whole distance. The three `uefi`
rounds published before it fail at PID 1 and power down. These rows describe
what the boards were qualified to do, not what any particular published image
does.

`uefi-arm64` became a release target on 2026-09-16 and carries a generic
hardware driver set (AHCI, NVMe, USB storage, the common NICs as modules; no
MMC). Its qualification is unchanged: QEMU `virt` only. Carrying a driver is
not evidence that a machine boots.

`uefi-x64` and `uefi-arm64` are **generic systems**, named for the firmware
class that starts them rather than for a machine; `cx3576` and `s905x5m` are
**hardware boards**, named for the product
([decision](../decisions/2026-09-16-generic-systems-named-by-firmware.md)).
They were called `x64` and `virt-arm64` until 2026-09-16, and releases
published before that date carry the old names.

> status: board-dependent — evidence: `mica-build:boards/uefi-x64/board.env`, `mica-build:boards/uefi-arm64/board.env`, `mica-build:boards/cx3576/board.env`, `mica-build:boards/s905x5m/board.env`
