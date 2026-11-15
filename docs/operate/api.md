# API reference

The Mica OS management API is specified by one machine-readable contract:
**`mica-core:crates/mica-apid/openapi.json`**. It is generated from the same code that
serves the routes, and CI holds it equal to what the shipped binary reports —
so it cannot drift from the device the way a hand-written endpoint list
would. This page deliberately does not duplicate the endpoint inventory; it
tells you where the contract is and states the facts the schema itself cannot.

> status: shipped — evidence: `mica-core:crates/mica-apid/openapi.json`

## 1. The surface in one paragraph

apid serves plain HTTP on port 8080 by default, and HTTPS on 8443 once it is
turned on (`PUT /api/v1/web`; HTTP then only redirects), and `/api` is the complete
management protocol: versioned settings and state reads, typed writes, queued
task records, setup and session lifecycle, UI selection, live network
observation, update state and system actions. Errors are JSON envelopes.
`/healthz` is the one operational exception outside `/api`, and it proves
only that the apid process is listening — not that micad or anything else is
healthy. The built-in browser UI at `/_ui/` is an ordinary client of the same
API, with no privileged side channel.

> status: shipped — evidence: `mica-core:crates/mica-apid/openapi.json`, `docs/reference/remote.md`

## 2. Authentication

Two credential shapes, both defined in the contract:

- **Browser session** — password login at the session route creates a signed
  `HttpOnly; Secure` cookie plus a per-session CSRF token; session-based
  mutations must send the token in `X-CSRF-Token`.
- **Bearer token** — for automation; stored tokens authenticate API calls
  without CSRF. Setup mints none: it answers with a browser session and its
  CSRF token, and a token is made afterwards (`POST /api/v1/tokens`, the
  console's Access page, or `mica tokens create` as root on the device).

Setup discovery and session state (`GET /api/v1/session`) are the narrow
unauthenticated operations; everything that reads or changes appliance state
requires one of the credentials above. Login attempts are rate-limited with
persistent backoff and audited ([../security/overview.md](../security/overview.md)).

> status: shipped — evidence: `mica-core:crates/mica-apid/openapi.json`, `docs/reference/access.md`

## 3. Versioning

The API currently uses `/api/v1/...`. During system development, backward
compatibility across builds is not guaranteed unless explicitly requested.
Consume the OpenAPI contract from the image you target; CI verifies that the
committed document matches the binary. Breaking changes do not require a
second version router or an adapter under this development policy
([../contributing.md](../contributing.md)).

> status: shipped — evidence: `mica-core:crates/mica-apid/openapi.json`, `docs/reference/api.md`

## 4. What is not a public API

- **The D-Bus interface `com.mica.micad1`** is the local IPC boundary between
  apid and micad (and the boot health gate). It is root-only by policy on the
  device and is not a supported integration surface; integrate over HTTPS.
- **MQTT** is the application-data plane, not a management channel: only
  package-enrolled application services are bridged, and management state and
  actions are structurally excluded. The grammar and enrollment contract are
  [../integrate/bus.md](../integrate/bus.md).
- **`/_ui` and custom UI assets** are static content, not contract; a custom
  bundle cannot shadow `/api` routes.

> status: shipped — evidence: `docs/integrate/bus.md`, `mica-core:crates/micad/dist/`

## 5. Trying it

The API acceptance suite boots the uefi-x64 image in QEMU and drives every phase
of the contract over a real socket — it is also the reference for how the
surface behaves end to end, including TLS, redirects and auth gating:

```sh
bash tests/suites/apid-api/run.sh      # in a mica-build checkout
```

> status: shipped — evidence: `mica-build:tests/suites/apid-api/run.sh`

## 6. A worked example: a script against the API

A claimed device on the LAN and a token made for the script
([first run](../start/first-run.md) section 7, or `mica tokens create laptop`
as root on the device):

```sh
DEV=http://mica-a4e2e69e.local:8080
AUTH="Authorization: Bearer mica_<id>_<secret>"

curl -s $DEV/healthz                                  # apid is listening, nothing more
curl -s $DEV/api/v1/system/info | jq .error           # without the token
# {"code":"not_authenticated","message":"...","source":"apid"}
curl -s -H "$AUTH" $DEV/api/v1/system/info | jq '{board, uptime}'
curl -s -H "$AUTH" -X PUT $DEV/api/v1/settings/time.timezone \
  -H 'content-type: application/json' -d '"Europe/Athens"'
# {"taskId":"<id>"}
curl -s -H "$AUTH" $DEV/api/v1/tasks/<id>
# ... "phase":"applied", "outcome":"succeeded" ...
```

Every failure under `/api` is that one envelope: `error.code` is the stable
word a script branches on, `error.message` is for a person, `error.source`
says whether apid or micad refused, and `error.path` names the setting when
there is one. A write with a token needs no CSRF header; the same write with
a browser cookie needs `X-CSRF-Token`.

### Check it worked

```sh
curl -s -o /dev/null -w '%{http_code}\n' -H "$AUTH" $DEV/api/v1/settings/time.timezone   # 200
curl -s -H "$AUTH" $DEV/api/v1/settings/time.timezone                                     # "Europe/Athens"
curl -s -H "$AUTH" $DEV/api/v1/tokens | jq -r '.[].name'                                  # laptop, and the others
```

| What you see | Why, and what to do |
|---|---|
| `401` `not_authenticated` | no token, a mistyped one, or one that was revoked: make a new one |
| `403` `csrf_invalid` | a cookie session without `X-CSRF-Token`; use the token instead |
| `409` `rotation_required` | the device was claimed by a provisioning document: change the password first ([first run](../start/first-run.md) section 4) |
| `422` `validation_failed` | the value was refused; `error.path` names the setting |
| `503` `micad_unreachable`, `504` `micad_timeout` | apid is up and micad did not answer; retry after `Retry-After` |
| connection refused on 8080 | the web mode is `local` or `off`: `mica web status` on the device; with HTTPS on, 8080 only redirects to 8443 (`curl -L`, or `https://...:8443`) |

The routes and their bodies are the contract, not this page:
`mica-core:crates/mica-apid/openapi.json`, and [HTTP API](../reference/http-api.md)
lists them.

> status: shipped — evidence: `mica-core:crates/mica-apid/src/routes/error.rs`, `mica-core:crates/mica-apid/src/routes/credential.rs`, `mica-core:crates/mica-apid/src/routes/tokens.rs`, `mica-core:crates/mica-apid/openapi.json`
