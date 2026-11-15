# Built-in management dashboard

The dashboard is the React/Vite SPA embedded in `apid` and served at `/_ui/`.
It is a client of the [management API](../reference/api.md), with no private management
protocol. Its source is `mica-core:crates/mica-apid/ui/`; the generated OpenAPI document
defines the backend contract.

## Navigation and ownership

| Area | Purpose |
|---|---|
| Overview | Device identity, health, LAN discovery (mDNS/SSDP) and bounded runtime summaries |
| Network | Overview, interfaces (Ethernet, Wi-Fi, CAN), Wi-Fi (station and access point), DNS, routes, WireGuard with each peer's state, and Bluetooth with its pairing window and BLE provisioning; Wi-Fi and Bluetooth show only on a product that has them |
| Services | MQTT, containers, and the user's own services (`services.units`) with their logs |
| Access | Operator credentials, SSH, where the API listens (`network`, `local`, `off`) and its HTTPS certificate, cloud administrators on a cloud product |
| System | Information with the integrity card and the support summary; updates (automatic updates and maintenance windows, manual import from an upload or a USB stick, rollback and its outcome); storage (DATA, external media, the user's mounts); drivers (owner certificates and driver extensions); time and time zone; logging and service logs; diagnostics; Help (troubleshooting guides and links to this documentation); resets, factory reset and power |
| System / UI versions | Upload, retain, activate and remove custom UI generations |

File routes live under `src/app/routes/`. TanStack Query owns fetched server
state; forms distinguish edited values, accepted writes and completed apply
tasks. Capability and unavailable responses control what an operator can use.
The UI must not present a proposed backend feature as an executable action.

## State and interaction

Pages distinguish initial loading, empty data, refresh with retained data and
failed observation. A previous snapshot is not evidence of current health.
Polling is bounded; actions invalidate the relevant queries rather than
assuming a successful write has already converged on the device.

Update screens display authenticated deployment/component identities,
acquisition progress, remaining trials, confirmation and backend rollback
eligibility. They do not infer boot state from version labels. Firmware has a
separate signed maintenance flow and explicit readback/recovery requirements.
See [updates](../reference/updates.md) and [release signing](../security/signing.md).

Session mutations send the API's CSRF token. Authentication secrets are not
persisted in browser storage. Refusals and task failures remain visible; a
rebooting or disconnected device is not reported as a completed update merely
because installation was accepted.

## Customization

The built-in UI remains available at `/_ui/` when an operator selects a custom
UI at `/`. UI archive installation and activation are separate actions, and
inactive versions can be removed explicitly. See [API hosting](../reference/api.md#5-custom-ui-lifecycle).

The [product design brief](../zh/reference/built-in-ui-design.md) records broader
interaction ideas with maturity markers. It does not define shipped capability.

## Development and acceptance

The UI uses the repository's pinned Bun build, React, TanStack Router/Query,
Tailwind and shadcn components. Locale resources own user-facing copy.
Run `bash crates/mica-apid/ui/build.sh --check` (in `mica-core`) for the frontend gate. Build output
is supplied to the Rust/package producer; it is not checked into the source.

Component tests cover state and action behavior. Browser acceptance checks the
rendered flows, and full-image API acceptance checks the real service contract.
Keep hardware behavior separate from browser and mock evidence.
