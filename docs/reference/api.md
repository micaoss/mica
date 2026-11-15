# Management API and UI hosting

`apid` owns the listeners (plain HTTP on 8080 by default, HTTPS on 8443 once
`access.web` turns it on, with a per-device or uploaded certificate; in the
`local` web mode only the root-owned socket `/run/mica/apid.sock`),
authentication, the JSON management API and static UI hosting. It is micad's
executable under another name, in micad's core component. `micad` owns settings, reconciliation and system actions over D-Bus.
The generated OpenAPI document (`mica-core:crates/mica-apid/openapi.json`) is the
operation and schema contract. This page explains ownership and behavior;
it does not duplicate the route inventory.

## 1. Runtime boundary

The appliance runs separate `micad` and `apid` services, on systemd or OpenRC. API handlers
use the typed settings/bus client for management operations. MQTT carries only
package-enrolled application item trees and cannot invoke this management API
through the bus. See [management](management.md) and [bus](../integrate/bus.md).

`/api` owns management operations, discovery, authentication and API errors.
`/healthz` only checks the listener; it is not the appliance health verdict.
`/_ui/` always serves the embedded dashboard. `/` serves a valid selected
custom UI or redirects to the built-in dashboard.

One request, from the client to the applied change:

```text
client --HTTP--> listener (network mode: :8080, or :8443 with HTTPS; local: the socket only)
         --> /api route --> credential: session cookie (+ X-CSRF-Token on writes),
                            bearer token, or uid 0 on the socket
         --> validation (apid's rules) --> audit line (writes)
         --> D-Bus call to micad --> read: 200 with the document
                                 \-> write: stored, 202 {"taskId"}
                                       --> micad applies --> GET /api/v1/tasks/{id}
                                           phase applied, outcome succeeded or failed
         errors: {"error": {"code", "message", ...}} with the status of 2.2
```

### 1.1 Who reaches it: the web mode

`access.web.mode` decides it, and `GET /api/v1/meta` reports it as `webMode`:

| Mode | apid | Serves |
|---|---|---|
| `network` (default) | running | the listeners below and the local socket |
| `local` | running | the local socket alone: root on the device |
| `off` | not running | nothing |

Outside `network` there is no console, no HTTP API, no setup page on the
access point and no bearer token in use; micad and what it drives (the health
gate, updates, SSH, MQTT, BLE provisioning, the user's services) are unchanged.
The way back is root on the device (over SSH when it is on), a provisioning
document, or a reset.

### 1.2 Listeners and the HTTPS identity

Under `network`, apid listens where `access.web` says (`GET`/`PUT /api/v1/web`),
read at start from `/run/mica/apid.json`: by default plain HTTP on 8080 and no
HTTPS, so it takes neither 80 nor 443 from another service. With `httpsEnabled`
it serves HTTPS on `httpsPort` (default 8443) and the HTTP port only redirects
there; the session cookie is `Secure` exactly then. A port another enabled
listener (SSH, MQTT) holds is refused. A change restarts apid on the new
listeners, or stops it.

The HTTPS identity is `identity.pem` in apid's state directory, the chain and
key in one `0600` file, generated self-signed (`mica`, `localhost`,
`127.0.0.1`) the first time HTTPS serves. `/api/v1/web/certificate` describes
it (never the key) and replaces it with an uploaded chain and key, which must
match and be inside their validity; `/api/v1/web/certificate/generate` makes a
fresh self-signed one for the names and days given. Either applies from the next
connection, with no restart. A configuration reset removes it.

| Variable | Default | Meaning |
|---|---|---|
| `APID_LISTENERS_FILE` | `/run/mica/apid.json` | the rendered `access.web` |
| `APID_HTTPS_ADDR`, `APID_HTTP_ADDR` | unset | override the file |
| `APID_STATE_DIR` | `/var/lib/mica/apid` | TLS identity, session key, login backoff, audit ring |
| `APID_BUS` | `system` | the bus micad is on |
| `APID_UI_DIR` | `/usr/share/mica-apid/ui` | the built-in console served at `/_ui/` |
| `APID_LOCAL_SOCKET` | `/run/mica/apid.sock` | the API for root on the device |

`mica-apid --version`, `--openapi` (the committed schema) and `--healthcheck`
(for the boot health gate; asks `/healthz` on the local socket, and passes
without asking when the mode is `off`) answer without starting a daemon.

### 1.3 URL space

| Path | What |
|---|---|
| `/api/v1/...` | the API; `/api/versions` lists the versions served |
| `/healthz` | listener liveness, unauthenticated |
| `/api/v1/health` | micad's state from one live bus call; authenticated, always 200 with the verdict in the body |
| `/ssdp/device.xml` | the UPnP description |
| `/_ui/` | the built-in console (404 without the `mica-apid-ui` package) |
| `/` | the active custom console bundle, or a redirect to `/_ui/` |

### 1.4 The local socket

apid also serves the API on `/run/mica/apid.sock` whenever it runs. A caller
there carries no credential: the kernel's peer credentials name its uid, only
root may call (any other uid is 403 `not_allowed`), and the socket is `0600`.
Root is asked for no device code and, for a password change, no current
password; requests are audited with the source `local uid 0`.

## 2. Resources and actions

### 2.1 Settings, observations and tasks

Configuration describes requested state. Observations describe what the device
currently reports. Network observations combine configured interfaces with
`systemd-networkd` state; observation failure remains explicit while readable
configuration is retained. Top-level interface fields are normalized; nested
address, DNS and route arrays retain networkd's vocabulary.

Accepted settings mutations return an apply task. Clients observe its ID and
terminal outcome rather than treating HTTP acceptance as successful application.
The bounded apply queue can fold related writes into a broader task; the
returned ID, outcome and task metadata describe that admission. Task history
is bounded, and an interrupted task is not silently reported as successful.

Power, update, reset and credential operations have their own typed routes and
policy checks. Native deployment state and rollback refusals are specified in
[updates](updates.md). Firmware maintenance is a separate operation described
in [release signing](../security/signing.md).

Power actions return 202 only after micad admits the request. A policy or permission
refusal returns 409 `power_refused` with its reason; dispatch failure, unavailable
micad and timeout return 500, 503 and 504 respectively. Acceptance does not prove
that reboot completed. The dashboard closes confirmation to expose this result
and does not retry power mutations automatically.

### 2.2 Errors and redaction

API errors use the published JSON envelope, including unmatched API paths and
unsupported methods:

```json
{
  "error": {
    "code": "version_conflict",
    "message": "…",
    "source": "…",
    "path": null,
    "params": { }
  }
}
```

`code` is stable and meant for programs; `message` is for people; `params`
carries the values the message names. A refused network write also lists every
rule it breaks in `details` (by interface and field), and a refused Compose file
every problem in `problems`.

| Status | Meaning |
|---|---|
| 202 | accepted; a settings write answers `{"taskId": "…"}`, to be followed at `GET /api/v1/tasks/{id}` |
| 400 | malformed request |
| 401 | no or expired session or token |
| 403 | wrong secret (`device_code_incorrect`, `wrong_password`, `password_incorrect`) or not allowed (`not_allowed`) |
| 404 | no such resource, or a feature the product lacks |
| 409 | a state refusal: `version_conflict`, `power_refused`, `media_busy`, `media_device_busy`, micad's factory-reset and driver refusals, … |
| 422 | a value that breaks a rule, at the field it names |
| 423 | `wifi_locked`: BLE provisioning holds the radio |
| 429 | `login_throttled`: the persistent backoff after wrong secrets, at most 300 s |
| 500, 503, 504 | dispatch failure, micad unavailable, micad timeout |

Missing data, a failed bus observation and an unsupported
capability are distinct outcomes. Responses do not fabricate healthy defaults
when their source is unavailable.

Settings reads and diagnostics redact secrets at the management boundary.
Passwords, password hashes, private keys and token material are not returned
through general settings or diagnostic responses. Dedicated write operations
validate the supported path and shape before forwarding a mutation.

## 3. Authentication

`GET /api/v1/session` reports session/setup state. Password login creates a
signed session cookie; browser mutations also require the per-session
`X-CSRF-Token`. Stored bearer tokens support automation and do not use CSRF.
Credential and token operations follow the generated schema and
[access policy](access.md).

The built-in SPA uses root-relative `/api/...` requests and stores no session
or bearer credential in browser storage. Persistent login backoff and a bounded
audit trail survive service restart. Recovery rotates a credential under the
[presence gate](recovery.md#4-physical-presence); it never reveals one.
Security-relevant actions go to an audit ring in apid's state directory.

The TLS certificate and private key are published together as one private
`identity.pem`. File and directory synchronization complete before publication
is reported successful. The cookie signing key is also persisted durably.
First-boot interruption must not leave a certificate paired with a missing or
partially written key.

### 3.1 Claiming and logging in

Until an administrator password exists, `POST /api/v1/setup`
(`{password, hostname?, network?, deviceCode?}`) sets it. On a device with a
device code, a network caller's body carries the code as `deviceCode` (dashes,
spaces and case ignored); the code is on the label, the device's console and
login prompt. A missing code is 422 at `deviceCode`, a wrong one 403
`device_code_incorrect` and counts in the login backoff (429
`login_throttled`). A device that declares a `random` code and cannot read it is
not claimed: 503 `device_code_unavailable`. A product with
`CLAIM_DEVICE_CODE=off` claims without it. `GET /api/v1/session` in setup
carries `deviceCode` `required` or `off`. The claim sets no access-point key.

Browsers exchange the password for an HMAC-signed, HttpOnly session cookie
(`POST /api/v1/session` `{password}`, 201) and send the session's CSRF token
(`csrfToken` from `GET /api/v1/session`) as `X-CSRF-Token` on every mutation.
Automation uses bearer tokens: `POST /api/v1/tokens` `{name}` answers
`{id, name, token}` with the whole token `mica_<id>_<secret>` exactly once; only
its SHA-256 digest is stored, at most 32 tokens, and `DELETE /api/v1/tokens/{id}`
revokes one. Passwords are argon2id.

`POST /api/v1/actions/change-password` `{currentPassword, newPassword}` asks for
the current password: missing is 422, wrong is 403 `wrong_password` and counts
in the same backoff.

A worked example with a token (the device at `192.168.1.50`):

```sh
# a session, to mint a token
curl -s -c jar -H 'Content-Type: application/json' \
  -d '{"password":"…"}' http://192.168.1.50:8080/api/v1/session
csrf=$(curl -s -b jar http://192.168.1.50:8080/api/v1/session | jq -r .csrfToken)
curl -s -b jar -H "X-CSRF-Token: $csrf" -H 'Content-Type: application/json' \
  -d '{"name":"fleet"}' http://192.168.1.50:8080/api/v1/tokens
# {"id":"…","name":"fleet","token":"mica_…_…"}

# then automation with the token: set the timezone and follow the task
T=mica_…_…
curl -s -X PUT -H "Authorization: Bearer $T" -H 'Content-Type: application/json' \
  -d '"Europe/Athens"' http://192.168.1.50:8080/api/v1/settings/time.timezone
# {"taskId":"…"}
curl -s -H "Authorization: Bearer $T" http://192.168.1.50:8080/api/v1/tasks/<taskId>
# … "phase":"applied" …
```

### 3.2 Factory reset

`POST /api/v1/system/factory-reset` `{password}` asks for the administrator
password whatever the credential, and answers 202 `{"applies": "reboot"}` once
micad has staged it. An empty password is 422; a wrong one 403
`password_incorrect` (429 `login_throttled` in the backoff); micad's refusals are
409 with their code (`not_claimed`, `update_in_progress`, `trial_pending`,
`data_encrypted`, `factory_reset_unsupported`; [micad](management.md#factory-reset-refusals)).
`GET` answers `supported`, the current `refusal` and the `last` completed
reset. The `full-factory` tier of `/api/v1/reset` is 422 naming this route.

### 3.3 Owner certificates and driver extensions

`GET /api/v1/system/owner-certs` and `GET /api/v1/system/extensions` list them.
Each change asks for the administrator password (403 `password_incorrect`, 429
`login_throttled`, 409 `not_claimed`) and answers 202 with a `drivers.apply`
task id; it applies from the next boot.

| Route | Body |
|---|---|
| `POST /api/v1/system/owner-certs` | `{password, certificate}`: the PEM or DER in base64, at most 64 KiB |
| `DELETE /api/v1/system/owner-certs/{sha256}` | `{password}` |
| `POST /api/v1/system/extensions` | multipart: `password` and either `archive` (`MICAUPD1`) or `descriptor`, `image`, `signature`; at most 256 MiB |
| `DELETE /api/v1/system/extensions/{name}` | `{password}` |
| `POST /api/v1/system/extensions/{name}/drop` | `{password, kernel}` |

### 3.4 WireGuard peers

`/api/v1/network/{iface}/peers` lists, adds, edits in place
(`PUT …/peers/{publicKey}`) and removes a tunnel's peers, each write applied
before it answers. The listing's `ETag` is the network version: an add or edit
names it as `baseVersion`, a removal as `If-Match`, and a map changed since is
refused 409 `version_conflict`. Each listed peer carries the kernel's view:
`latestHandshake`, `rxBytes`, `txBytes`, `operationalState`
(`ready`, `pending_endpoint_resolution`, `endpoint_route_loop`), `routesReady`
and `unroutedIps`. `GET /api/v1/network/wireguard/defaults` proposes the first
free `wg<N>`, `10.<N>.0.1/24` and a listen port from 51821.

A peer change is refused `settings_rejected` with the rule's code first in the
message:

| Code | Rule |
|---|---|
| `wireguard_default_route_unsupported` | a `/0` allowed IP |
| `wireguard_prefix_invalid` | loopback, multicast, link-local, unspecified or broadcast |
| `wireguard_address_missing` | the tunnel has no address of the prefix's family |
| `wireguard_peer_prefix_conflict` | the same prefix on another peer of the tunnel |
| `wireguard_route_conflict` | overlaps another tunnel's prefix, another entry's subnet or route |
| `wireguard_endpoint_route_loop` | a numeric endpoint a tunnel prefix would carry |
| `port_in_use` | the listen port is another tunnel's or held by a UDP socket on the device |

### 3.5 External media and update archives

| Route | Answers |
|---|---|
| `GET /api/v1/storage/media` | `supported`, and one item per volume of each USB or SD device ([storage](storage.md#external-media)) |
| `POST /api/v1/storage/media/{id}/unmount` | unmounts one volume; 409 `media_busy`, 404 `media_not_found` |
| `POST /api/v1/storage/media/devices/{deviceId}/eject` | prepares the device for unplugging; 409 `media_device_busy` with each volume's `reason`, 404 `media_device_not_found` |
| `GET /api/v1/update/media` | `*.micaupd` files at a volume's root and in `mica-updates/`, at most 100 per volume; `importable` false (`archive_too_large`) above the upload limit |
| `POST /api/v1/update/media/import` | `{mediaId, candidateId}`; 202, the outcome in the update state; 409 `media_candidate_changed`, 404 `media_removed` |

## 4. Static hosting

API, built-in and custom resource roots are isolated. A miss in one root never
falls through to another. Logical paths are decoded once and validated before
lookup; traversal, encoded separators, control characters and reserved-root
aliases are refused. SPA fallback remains inside the selected resource root.

`apid/build.rs` embeds the complete frontend build supplied by the package
producer. `index.html` is the stable entry; content-hashed route, locale and
vendor chunks remain separately addressable and cacheable. The frontend build
and its dependency lock are under `mica-core:crates/mica-apid/ui/`.

## 5. Custom UI lifecycle

Authenticated upload streams a bounded raw ZIP into `/mica/ui`, validates its
manifest and paths, and atomically installs a retained generation. Installation
does not activate it. Activation rechecks and selects the exact requested
generation; removing the selection returns to the built-in UI. Only inactive
generations may be deleted. Retention is explicit.

Custom UI installation does not replace the root filesystem or enroll OS trust
keys. A UI archive is distinct from a signed OS `.micaupd` archive. Packaging
instructions are in the [application guide](../integrate/applications.md).

## 6. Built-in recovery and verification

`/_ui/` stays reachable even when a custom UI is missing, invalid or broken.
Custom content cannot shadow that prefix or the API. The built-in console's
assets live in its verity-signed core component (`mica-apid-ui`), independent
of DATA UI selection.

Rust route and bus tests verify authentication, path isolation, validation and
task behavior. The OpenAPI generation gate checks the committed schema against
the binary. The API harness (`mica-build:tests/suites/apid-api/README.md`) exercises
the full service stack on a fresh current QEMU image. The harness writes its result to
`_out/<board>/apid-api/result.json`.
