# Security lifecycle

Who holds which trust material, how it is created, rotated and recovered, and
how releases and vulnerabilities are handled. The mechanisms each key drives
are [signing](signing.md); what they defend is the [model](model.md).

## 1. Where the project stands

- **Every release so far is signed with development keys.** Production key
  custody is not established, and no release claims it. A device reports
  whether it trusts production or development keys
  (`GET /api/v1/system/info`).
- There is no published security contact, no advisory channel, no support
  window and no end-of-life policy.
- There is no fleet certificate authority and no device enrolment.

What follows separates what exists from the procedure that is to be stood up.

> status: unsupported

## 2. Trust material

| Material | Authenticates | Created | Rotation | If lost or compromised |
|---|---|---|---|---|
| **Boot keys** | the loader and kernel a board starts: the UKI under UEFI, the FIT under U-Boot | a build input, separate from the others | a new loader or firmware carrying the new anchor; firmware moves only through the offline maintenance route | a complete reflash |
| **Content keys** | the root, support and core component images, through signatures the kernel requires on every verity mapping | a build input; the public certificate is built into the kernel | a kernel that carries the new certificate beside or instead of the old; never a mutable keyring | a complete reflash when no accepted combination remains |
| **Metadata keys** | deployment descriptors and firmware records | a build input; the public keys are in the signed kernel | an overlap set: the new key is added before the old is removed, and no key is removed while a published artifact depends on it | a complete reflash when no accepted combination remains |
| **The API's TLS identity** | "the same device as last time", to a browser that accepted it | self-signed on the device the first time HTTPS serves | replaced by an administrator, with an uploaded chain or a fresh self-signed one | regenerated; a configuration reset removes it |
| **The admin password and API tokens** | the management API | set by whoever claims the device | through the API | none: see below |
| **SSH authorized keys** | a root shell | enrolled by an administrator | edit the list | none: see below |
| **The transient root password** | SSH and the local consoles until the next boot | set by an administrator | — | gone at the next boot by design |

Rules that hold across the table:

- **The three signing domains are separate keys.** A key of one cannot stand
  in for another.
- **Private keys never enter an image, a package or a release.** The build
  takes public certificates; signing happens where the private key is held.
- **Trust anchors are not settings.** No API, configuration document or update
  source can add or replace one; they change only with the signed kernel that
  carries them.
- **An installed deployment boots offline.** Nothing about booting waits for a
  network, a revocation list or a clock. There is no expiry, so withholding or
  retiring a release on a server does not revoke what a device already runs.
- **A generation only rises**, and failed deployments are remembered, so a
  device does not return to a release it rejected.
- **There is no software recovery for a lost administrator credential.** An
  operator who loses the admin password, every token and every key reflashes
  the device, which costs everything on it ([access](../reference/access.md)
  section 7). Support states this up front.
- The device password minted at first boot authenticates nothing and is never
  offered to a customer as a credential
  ([provisioning](../integrate/provisioning.md) section 2).

> status: shipped — evidence: `docs/security/signing.md`, `mica-core:docs/mica-core.md`, `mica-build:README.md`

## 3. Custody

Custody is by role, and every procedure has exactly one accountable role.

| Role | Accountable for |
|---|---|
| Release owner | key custody and ceremonies, release publication, support windows |
| Security owner | vulnerability intake, severity, advisories, incident response |
| Manufacturing owner | factory inputs, records, quarantine and rework ([manufacturing](../reference/manufacturing.md)) |
| Support owner | field escalation, returns, linking failures to releases and factory records |

Where staffing allows, release and security ownership are held by different
people: a compromise of the release path is the incident the security owner
must be able to answer independently.

Production private material exists only on ceremony media and the release
host. CI uses disposable development material and never imports a production
key. The build refuses an image whose factory shadow file carries a usable
password, and a development-key marker travels with the public defaults so a
release gate and the device can both report it.

> status: proposed — evidence: `docs/security/signing.md`

## 4. Releases

A release is one product, signed, published by `mica-build`
([how releases work](../releases/how-releases-work.md)). Releases signed with
development material are development releases; a candidate or stable release
waits for production keys. Promotion between channels, soak requirements,
support windows and end-of-life notices are procedure to be defined, and no
tooling or commitment exists for them today.

One gate does exist: a release whose claims exceed its board's recorded
evidence, including an assurance level above the board's, is refused when its
manifest is assembled.

> status: shipped — evidence: `mica-build:src/image/release-manifest.ts`, `mica-build:src/boot/dev-keys.ts`

## 5. Security response

None of this has an operating channel yet; it is the procedure to stand up.

- **Intake.** A published contact and disclosure policy. Until one exists,
  report privately to the maintainers. Every report gets an acknowledgement, a
  record and a severity.
- **Severity**, judged against the stated [model](model.md) and its limits, so
  a report that restates a documented limit is answered with the document:

  | Severity | Means | Fix target |
  |---|---|---|
  | critical | compromise of the management plane without credentials; an update accepted that signing should refuse; code that survives the verified root | emergency release |
  | high | escalation beyond the documented root-equivalence; defeat of a credential mechanism; denial of update or recovery | next release |
  | medium | weaknesses needing local access or unusual configuration; disclosure short of credentials | a scheduled release |
  | low | hardening gaps | with related work |

- **Advisories**, one per fixed vulnerability, naming the affected releases
  and boards, the fixed release and any workaround. An advisory is also how an
  overstated claim is retracted.
- **Incidents**: contain (suspend publication), assess (which keys, releases
  and devices), rotate (the row of section 2), notify (including what cannot be
  fixed remotely: re-anchoring a device is a physical-contact event), record.

> status: proposed — evidence: `docs/security/model.md`
