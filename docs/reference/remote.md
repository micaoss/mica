# Design: Remote Management & API Surface

> Who reaches the device, over what, with which trust. **[implemented]** means
> code exists and is named by path; **[not implemented]** means prose only.

## 1. What reaches the device today — **[implemented]**

**apid, on the LAN.** apid is micad's executable under the name `mica-apid`,
in micad's core component, enabled on both inits. It listens where the
`access.web` setting says (`GET`/`PUT /api/v1/web`, the console's access page):
by default plain HTTP on `0.0.0.0:8080` and no HTTPS, so it takes neither 80
nor 443 from another service. With `httpsEnabled` it serves HTTPS on
`httpsPort` (default 8443) with a per-device self-signed identity, which an
operator may replace with an uploaded chain, and the HTTP port then only
redirects; the session cookie is `Secure` exactly then. There is no other
management protocol or port (`mica-core:docs/mica-core.md` section 4).

**The API is the gate.** apid reserves `/api`, `/_ui`, `/healthz` and `/`
before the custom-bundle fallback (`mica-core:crates/mica-apid/src/routes`). The static
SPA is always readable; appliance data is not. Each management API handler
requires a stored bearer token or a signed browser session, and a
session-authenticated mutation also requires its random `X-CSRF-Token`. Setup
and session discovery are the only unauthenticated API operations; `/healthz`
proves listener liveness only.

**The JSON API under `/api` is the complete management protocol**: versioned
settings and state reads, typed writes and collections, queued task records,
setup and session lifecycle, UI selection, live network observation and system
actions. Its generated contract is `mica-core:crates/mica-apid/openapi.json`.

**apid owns no state; it is a client of micad** over D-Bus
(`mica-core:crates/mica-apid/src/bus_client.rs`). micad holds the tree as `com.mica.micad`;
apid never spawns a process and never talks to systemd itself.

**SSH and the console are access channels, not management channels**, and
both are closed by default: SSH is off, and the serial console has no account that accepts a
credential (`docs/reference/access.md`).

**No device-initiated management channel or fleet plane ships.** Nothing dials
out and nothing enrolls a device; every path in is inbound, on the LAN.

## 2. Reaching devices behind NAT — requirement

A device behind NAT on somebody else's network must be reachable for support,
and a fleet must be manageable, **without an inbound port**: forwarding a port
leaves an appliance without a support story or with an attack surface its
owner did not choose. That forces a device-initiated channel — the device dials
out and management rides back over the connection it opened.

## 3. Fleet management — **[not part of the published product]**

No fleet plane ships with Mica OS and no released image enrolls with one. The
baked defaults carry a `fleet` block that is off (`enabled: false`, no `url`),
and nothing in a released root reads it. Any future channel must hold the
invariants of section 5.

## 4. Update control flow

The implemented path is catalog check, missing-object acquisition, verified
deployment staging, native installation, reboot and health confirmation.
`mica-deploy` authenticates every deployment descriptor against the keys in the
signed kernel and serializes installation with collection and reset. micad
exposes the lifecycle over D-Bus; apid and the console show the candidate,
current and fallback identities and the acquisition, installation, reboot and
confirmation states.

The source is an update root, such as `https://res.micaos.dev/update/`:
an unsigned manifest of each product's current release, that release's
document, and its signed descriptor. Trust comes from the descriptor: a device
takes only its own board, architecture and product, only a generation above
the one it runs, and only the objects the descriptor names. There is no
channel and no expiry; a withheld manifest reads as "nothing newer". The
source is an operator setting (`/mica/config/updates.json`), seeded from the
defaults baked into the image; changing it cannot change the anchors embedded
in the signed boot policy. Offline `.micaupd` import converges on the same
verified workspace (`mica-core:docs/mica-core.md` section 6.2).

The release run of `mica-build` posts each release to the resource service
behind that root (`mica-build:README.md`), which offers the current release of
each product.

Automatic policy uses the device's configured schedule, maintenance window and
reboot policy. Reboot gating prevents an unrelated reboot from discarding an
unsettled update; override is explicit and audited. See [updates](updates.md)
for exact routes and failure semantics.

There is no outbound fleet-management connection or remote fleet trigger. A
future one must invoke the same verified deployment policy and cannot bypass
signature, board, capacity, retained-fallback or reboot checks.

## 5. Security posture

**Exposed today — [implemented].** apid on the LAN, on 8080 (and 8443 once HTTPS is on), is the entire inbound
management surface. `/_ui` and custom UI assets are public static code on that
origin; every appliance operation and datum is protected by the `/api`
credential boundary described in section 1.

**Not exposed today — [implemented], as an absence the build asserts.** No
other inbound management port, no outbound management connection, and **no
operator credential provisioned onto a device**. A signed rootfs is
byte-identical on every unit, so a credential baked into one would be a
fleet-wide shared secret (`stages/compose/scripts/pack-assert-shadow-chain.sh`)
— the pack step fails the build over that, and the reasoning binds any future
fleet credential too.

**The invariant a future channel must hold — [not implemented].** Each plane is
an independent credential domain; compromise of one grants nothing in another.
An apid session is not an enrollment credential, an enrollment credential is
not a root shell, and an endpoint holding a fleet's channel credentials must
not thereby hold the keys that authorise an image — the update trust anchor is
already a separate key hierarchy (`mica-core:crates/mica-deploy`) and stays one.
