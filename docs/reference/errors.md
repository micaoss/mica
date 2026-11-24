# Error codes

Every failure under `/api/` is one JSON envelope:

```json
{ "error": { "code": "…", "message": "…", "source": "apid", "path": null, "params": null } }
```

`code` is stable and is what a program should branch on; `message` is a
sentence for people and may change; `source` says who refused (`apid` the API
server, `micad` the daemon behind it); `path` names the setting or field when
there is one; `params` carries the values the message names. A refused network
write lists every broken rule in `details`, a refused Compose file every problem
in `problems`. This page lists the codes, from `mica-core:crates/mica-apid/src`
at core 0.0.9 (`20261124-0755`) and `mica-core:docs/mica-core.md`. Behaviour
around them is [the API page](api.md).

## Codes apid answers

| Code | Status | Source | Meaning and what to do |
|---|---|---|---|
| `request_invalid` | 400 | apid | the body is not the JSON the route takes; fix the request |
| `archive_invalid` | 400 | apid | an uploaded update archive is not a `MICAUPD1` archive |
| `invalid_credentials` | 401 | apid | wrong password at login |
| `not_authenticated` | 401 | apid | no session or token, or it expired; log in again |
| `csrf_invalid` | 403 | apid | a browser write without the session's `X-CSRF-Token` |
| `device_code_incorrect` | 403 | apid | the claim's device code does not match; counts in the login backoff |
| `wrong_password` | 403 | apid | wrong current password for a password change; counts in the backoff |
| `not_allowed` | 403 | apid | a non-root caller on the local socket |
| `authenticated_session` | 403 | apid | credential recovery called with a session or token; it is authorised by physical presence only, use change-password instead |
| `presence_required` | 403 | apid | credential recovery without proof of physical presence ([recovery](recovery.md#4-physical-presence)) |
| `not_found`, `settings_not_found`, `task_not_found`, `snapshot_not_found` | 404 | apid, micad | no such route, setting path, task or diagnostic snapshot; also every route of a feature the product lacks |
| `media_not_found`, `media_device_not_found` | 404 | apid | no volume or device with that id now (ids change when a device is plugged again) |
| `method_not_allowed` | 405 | apid | the path exists, the method does not |
| `already_configured` | 409 | apid | setup on a device that already has an administrator |
| `setup_required` | 409 | apid | login before first-run setup |
| `rotation_required` | 409 | apid | the device was claimed with a bootstrap credential; change the password before any other write |
| `not_claimed` | 409 | apid | a factory reset or driver change on an unclaimed device |
| `version_conflict` | 409 | apid | the network or peer list changed since the version the write names; reload and retry |
| `busy` | 409 | apid | a network change is still being applied; retry when it finishes |
| `settings_read_only` | 409 | apid, micad | the path is not written through this route |
| `key_exists`, `key_limit_reached` | 409 | apid | the SSH key is already authorised, or the list is full |
| `token_limit_reached` | 409 | apid | 32 API tokens exist; revoke one |
| `peer_exists` | 409 | apid | a WireGuard peer with that public key exists; edit it instead |
| `record_duplicate`, `record_limit` | 409 | apid | a DNS static record repeats an id or name, or 100 exist |
| `ssid_exists` | 409 | apid | a Wi-Fi network with that SSID is already known |
| `media_busy` | 409 | apid | a file is open on the volume; close it and retry |
| `media_device_busy` | 409 | apid | the device cannot be ejected; `params.items` gives each volume's `reason` |
| `diagnostics_busy` | 409 | apid | a diagnostic snapshot is already being made |
| `custom_ui_unavailable` | 409 | apid | no retained custom console passes the safety and API checks |
| `target_changed` | 409 | apid | the rollback target is no longer the `expectedTarget` the caller confirmed |
| `policy_refused` | 409 | micad | the update policy refuses the request now (outside every window, on a metered link, …); the message says which |
| `power_refused` | 409 | micad | reboot or power-off refused, with the reason |
| `validation_failed` | 422 | apid, micad | a value breaks a rule; `path` names the field |
| `settings_rejected` | 422 | micad | the settings tree refused the write; the message quotes the rule (WireGuard rules put their code first) |
| `compose_invalid` | 422 | apid | the Compose file is not one mica-containerd runs; see `problems` |
| `dns_server_invalid` | 422 | apid | a DNS server is not a usable address |
| `channel_not_allowed` | 422 | apid | the access-point channel is not allowed in the country; `params.channel` |
| `wifi_country_unconfirmed` | 422 | apid | the change moves the radio's country; resend with `countryConfirmed: true` |
| `not_supported` | 422 | apid | the radio or adapter cannot do it (WPA3 access point, a fixed Bluetooth PIN) |
| `invalid_duration` | 422 | apid | a BLE provisioning window lasts 300, 600 or 1800 seconds |
| `wifi_locked` | 423 | micad | BLE provisioning holds the radio; wait for its window to close |
| `login_throttled` | 429 | apid | the persistent backoff after wrong secrets, at most 300 s; wait |
| `settings_invalid`, `encoding_failed`, `hash_failed`, `hashing_failed`, `mint_failed`, `identity_unreadable`, `identity_write_failed`, `diagnostics_io`, `publish_failed`, `ui_activation_failed`, `ui_deactivation_failed`, `ui_status_failed`, `configuration_unavailable`, `baked_configuration_unavailable`, `settings_io`, `micad_failed` | 500 | apid, micad | an internal failure; nothing was changed unless the message says so. Collect a diagnostic snapshot ([troubleshooting](../operate/troubleshooting.md)) |
| `micad_unreachable` | 503 | apid | micad is not on the bus; check that it runs ([micad](management.md#checking-micad)) |
| `device_code_unavailable` | 503 | apid | the device declares a `random` code it cannot read; it cannot be claimed |
| `tzdata_unavailable` | 503 | apid | the device has no time-zone data to list |
| `micad_timeout` | 504 | apid | micad did not answer in time; the request may still complete |

## Codes from micad's answers and rule checks

These codes are carried from micad's answer or a rule check rather than
written into a route, so the table above does not list them.

| Code | Status | When |
|---|---|---|
| `password_required` | — | micad refuses an empty administrator password from a caller that is not uid 0; over the API an empty password is already 422 `validation_failed` |
| `password_incorrect` | 403 | a wrong administrator password for a factory reset or driver change |
| `factory_reset_unsupported`, `data_encrypted`, `update_in_progress`, `trial_pending` | 409 | factory-reset refusals ([micad](management.md#factory-reset-refusals)) |
| `media_candidate_changed` | 409 | the update archive on the medium is not the file that was listed |
| `media_removed` | 404 | the medium is gone or a read failed during the copy |
| `archive_too_large` | — | listed archive above the upload limit (`importable: false`) |
| `validation_failed` with `details` | 422 | a refused network map; each broken rule is one `details` item `{interface, field, code, params}` with its own code (below) |
| `wireguard_default_route_unsupported`, `wireguard_prefix_invalid`, `wireguard_address_missing`, `wireguard_peer_prefix_conflict`, `wireguard_route_conflict`, `wireguard_endpoint_route_loop` | 422 (`settings_rejected`) | WireGuard peer route rules, first in the message ([API](api.md#34-wireguard-peers)) |

### Network rule codes in `details`

| Code | Rule |
|---|---|
| `name_invalid` | a key that is not an interface name |
| `address_overlap` | two overlapping subnets |
| `gateway_out_of_subnet` | a gateway outside its subnet |
| `gateway_not_allowed` | a static gateway or `0.0.0.0/0` route on an interface with `internet: false` |
| `metric_duplicate` | two default routes with one metric |
| `route_metric_reserved` | a default route with a metric below 20, which is kept for the device's own routes (0.0.9) |
| `probe_not_allowed` | a reachability check on an entry that carries no default route, a tunnel or a CAN controller (0.0.9) |
| `probe_targets` | more than four targets, or one twice (0.0.9) |
| `probe_address`, `probe_method`, `probe_port` | a target that is not an IPv4 unicast address or `gateway`, not `icmp` or `tcp`, or a port outside 1 to 65535 or on `icmp` (0.0.9) |
| `probe_interval`, `probe_timeout`, `probe_threshold` | an interval outside 2 to 300 s, a timeout outside 200 to 10 000 ms or not below the interval, a threshold out of range (0.0.9) |
| `vlan_duplicate` | one VLAN id twice on a parent |
| `vlan_parent_invalid` | a VLAN parent that is not declared or is CAN |
| `vlan_parent_unsupported` | an undeclared VLAN parent whose image configuration cannot be adopted |
| `bridge_port_invalid`, `bridge_port_addressed`, `bridge_port_taken` | a bridge port that is not declared or is CAN, carries addressing, or is claimed twice |
| `port_in_use` | a tunnel's listen port another tunnel declares or a service on the device holds; from 0.0.9 every network write checks it, not only the WireGuard routes |
| `in_use` | an entry another entry depends on |
| `validation_failed` | a field's own syntax |

## D-Bus errors

Callers of `com.mica.micad1` on the bus see these error names:

| Error | When |
|---|---|
| `org.freedesktop.DBus.Error.InvalidArgs` | the settings tree refused the value |
| `com.mica.micad1.Error.AlreadyClaimed` | a second claim |
| `com.mica.micad1.Error.WifiLocked` | a write reaching `wifi` while BLE provisioning holds the radio |
| `com.mica.micad1.Error.FactoryResetRefused` | a factory-reset refusal; the description is `{code, message}` |
| `com.mica.micad1.Error.DriversRefused` | an owner-certificate or driver-extension refusal; the description is `{code, message}` |

## Update refusals

Refusals of an update install, rollback or import are reported in the update
state and named by the deployment client; the rollback reasons are
`candidate_pending`, `running_not_confirmed` and `no_usable_fallback`, and a
system update can wait for a driver build (`waitsForExtension`). See
[the update engine](updates.md) and, for each refusal an operator meets, the
[updates guide](../operate/updates.md#7-the-refusals).
