# Support and lifecycle

Mica OS is an operating system a product is built on, so support is a shared
responsibility: Mica OS owns the OS contract, the reference boards and the update
trust chain; the product integrator owns the board they selected, the
applications they deliver, and the product's own support relationship with its
end customers. This page states who owns what, how hardware support is
tiered, and what a support case needs to contain to be actionable.

## 1. Support tiers for hardware

The tier vocabulary, aligned with the board qualification plan:

- **mica-qualified** — a board revision qualified by the Mica OS project itself,
  with a dated hardware-in-the-loop board page (boot, A/B update, power-cut,
  storage growth, recovery, peripherals as applicable) in which every row is
  pass, fail, N/A or not-tested — never implicitly green.
- **integrator-qualified / bring-up** — a board an integrator has ported and
  qualified against the published contract; Mica OS supports the contract, the
  integrator owns the board evidence.
- **unsupported** — everything else, including boards whose kernels fall
  below the support floor.

The tier definitions, the qualification matrix and the intake rubric are
published with the BSP documentation: the tiers in
[the support tiers](../hardware/README.md#support-tiers), the matrix and its row
grammar in [../hardware/qualification.md](../hardware/qualification.md), the vendor
rubric in [`intake.md`](https://github.com/micaoss/mica/blob/9dd6302/docs/boards/intake.md). The vocabulary existing is not
a board having earned a tier: no board is mica-qualified today, because the one
board page on file carries every qualification row as `not tested`, so today's
boards hold their standing by the evidence in this repository rather than by a
completed board page.

> status: shipped — evidence: `docs/hardware/README.md`, `docs/hardware/qualification.md`
> status: board-dependent — evidence: `docs/hardware/cx3576.md`

## 2. Current hardware standing

Every board is at bring-up; the evidence behind each is in
[current boards](../hardware/README.md#current-boards).

| Board | Released products | Standing |
|---|---|---|
| uefi-x64 (generic UEFI amd64) | `full`, `docker`, `gcp` | bring-up: the QEMU baseline, booted in each release run |
| mini-x64 (small UEFI amd64) | `basic` | bring-up: QEMU, booted in each release run |
| qemu-armhf (QEMU 32-bit Arm) | `basic` | bring-up: QEMU |
| cx3576 (CX3576-Z, RK3576) | `full` | bring-up: static verification and one hardware observation |
| s905x5m (BM201, S905X5M) | `sd-full`, `emmc-full` | bring-up: static verification and fixtures |
| uefi-arm64 (generic UEFI arm64) | none | bring-up: QEMU reference, not released |

Integrators bringing their own hardware start at
[`mica-build:boards/README.md`](https://github.com/micaoss/mica-build/blob/main/boards/README.md); the board contract itself (artifact
boundary, kernel assertion set, layout schema) is shipped and enforced by the
build.

> status: board-dependent — evidence: `docs/hardware/README.md`, `docs/start/download.md`, `mica-build:boards/README.md`

## 3. Lifecycle ownership

- **Mica OS** owns: the OS image contract and its verification, the A/B update
  mechanism and signing chain, the management API contract, the BSP contract,
  and the documentation set with its truth-status discipline.
- **The integrator** owns: board selection and qualification evidence beyond
  the reference boards, application delivery and updates (containers are
  explicitly not updated by Mica OS), the product's configuration profile, and
  end-customer support.
- **The security lifecycle** assigns every procedure an owning role — release
  owner, security owner, support owner, manufacturing owner — and states each
  procedure's real maturity: key ceremonies and custody, credential lifecycle,
  vulnerability intake, severity classes with triage and patch targets,
  advisory publication, incident response, support windows and end of life.
  Read it before promising anything on Mica OS's behalf
  ([../security/lifecycle.md](../security/lifecycle.md)).

> status: shipped — evidence: `docs/security/lifecycle.md`

**Written policy is not an operating channel, and the difference matters
here.** No tooling enforces a support window; no end-of-life date is bound to
a release by any mechanism; there is no published security contact, no
advisory feed and no channel promotion. Until those exist, **no support
duration, patch target or advisory coverage may be promised to an end customer
on Mica OS's behalf** — a severity target with no intake channel behind it is a
number, not a commitment.

> status: unsupported

## 4. What a support case needs

A report that can be acted on cites, in this order:

1. **Release identity** — the product, the deployment id and generation, and
   the core set ([release-notes.md](release-notes.md)). The support summary
   (`GET /api/v1/system/support-info`, or the console's Help tab) carries
   them without the device's names, addresses or credentials.
2. **Board and revision** — and, for non-reference boards, the integrator's
   qualification standing.
3. **The device identity** — hostname / device id ([../start/first-run.md](../start/first-run.md)).
4. **Evidence captured before recovery** — a diagnostic snapshot (the
   console, or `micad diag` on the device: this and the previous boot's
   warnings, failed services, update state), and any refusal text quoted verbatim
   ([../operate/troubleshooting.md](../operate/troubleshooting.md)); a reflash destroys evidence,
   so capture first.

> status: shipped — evidence: `docs/reference/diagnostics.md`, `docs/operate/troubleshooting.md`

## 5. Where to ask

Support channels and the product-facing support brief are part of the
official-site content set at [../website/support.md](../website/support.md);
for source-level questions this repository's documentation
([../README.md](../README.md)) is the entry point.
