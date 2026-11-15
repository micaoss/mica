# HTTP API 路由

管理 API 提供的每个路由，按领域分组：103 个路径、134 个操作，由 core 0.0.8（`20261115-0958`）的
`mica-core:crates/mica-apid/openapi.json` 生成。模式是契约，本页是它的索引；表中"内容"一列保留 OpenAPI
摘要的英文原文，以免与契约产生偏差。API 的行为（模式、监听器、认证、错误封套、任务）见
[API 页](api.md)；设置类路由背后的设置见[设置树](settings.md)。

## 使用 API

- **基础地址。** 默认为 `http://<设备>:8080`，开启 HTTPS 后为 `https://<设备>:8443`，设备上的 root 也可使用
  本地套接字 `/run/mica/apid.sock`。产品不具备的特性没有相应路由（404）。
- **凭据。** `POST /api/v1/setup` 和 `POST /api/v1/recovery/credential` 不需要凭据，`GET /api/v1/session`
  回答任何调用方；其余路由都需要浏览器会话（写操作带 `X-CSRF-Token`）或 bearer 令牌
  `Authorization: Bearer mica_<id>_<secret>`。
- **稍后生效的写入**返回 `202` 和 `{"taskId"}`；在 `GET /api/v1/tasks/{id}` 跟进，直到其 `phase` 为
  `applied`，然后读取其 `outcome`（不论结果如何，`phase` 最终都是 `applied`）。
- **模式本身。** 在设备上运行 `mica-apid --openapi` 会打印同一份文档；闸门保证它与处理程序一致。
- **错误**始终是 `{"error": {"code", "message", "source", …}}`（[状态码](api.md#22-错误与遮蔽)）。

## 会话、设置与凭据

| 方法 | 路径 | 内容（OpenAPI 摘要原文） | 成功 |
|---|---|---|---|
| POST | `/api/v1/actions/change-password` | Change the admin password. | 204 |
| GET | `/api/v1/claim` | Report how this device was claimed and whether its credential must still be rotated. | 200 |
| GET | `/api/v1/device/code` | Read the device code. | 200 |
| GET | `/api/v1/meta` | Report what the caller is talking to. | 200 |
| GET | `/api/v1/provisioning/status` | Read what a provisioning document did to this device. | 200 |
| POST | `/api/v1/recovery/credential` | Recover the management credential: rotate, never reveal. | 200 |
| GET | `/api/v1/session` | Report setup and browser authentication state without redirecting. | 200 |
| POST | `/api/v1/session` | Authenticate a browser and create its HttpOnly session cookie. | 201 |
| DELETE | `/api/v1/session` | Revoke the acting browser session. | 204 |
| POST | `/api/v1/setup` | First-run setup: set the admin password and, optionally, a hostname and network entries. | 201 |
| GET | `/api/v1/tokens` | List every API token this device holds. | 200 |
| POST | `/api/v1/tokens` | Mint an API token. | 201 |
| DELETE | `/api/v1/tokens/{id}` | Revoke one API token by its id. | 204 |
| GET | `/api/versions` | List the API major versions this build serves. | 200 |

## 设置、状态与任务

| 方法 | 路径 | 内容（OpenAPI 摘要原文） | 成功 |
|---|---|---|---|
| PATCH | `/api/v1/settings` | Write several settings by dot-path at once. | 202 |
| GET | `/api/v1/settings/{path}` | Read the settings tree at a dot-path. | 200 |
| PUT | `/api/v1/settings/{path}` | Write one scalar setting by dot-path. | 202 |
| GET | `/api/v1/state/{path}` | Read the live-state tree at a dot-path. | 200 |
| GET | `/api/v1/tasks` | List micad's bounded apply-task history, oldest first. | 200 |
| GET | `/api/v1/tasks/{id}` | Read one apply task by the id returned with a settings or transient-password write. | 200 |

## 网络、DNS 与 Wi-Fi

| 方法 | 路径 | 内容（OpenAPI 摘要原文） | 成功 |
|---|---|---|---|
| POST | `/api/v1/actions/wireguard/{iface}/rotate-key` | Rotate a WireGuard interface's private key. | 200 |
| GET | `/api/v1/dns` | Read what the device resolves with. | 200 |
| PUT | `/api/v1/dns/global` | Switch the global servers on or off, or change them. | 202 |
| POST | `/api/v1/dns/probe` | Run the resolution check now. | 200 |
| POST | `/api/v1/dns/static-records` | Add a static record. | 201 |
| PUT | `/api/v1/dns/static-records/{id}` | Replace one static record. | 200 |
| DELETE | `/api/v1/dns/static-records/{id}` | Remove one static record. | 204 |
| POST | `/api/v1/dns/test` | Ask each server directly for one `A` record. | 200 |
| GET | `/api/v1/network` | Read declared network configuration together with current link state. | 200 |
| PUT | `/api/v1/network` | Replace the whole interface map, validated as one tree. | 200, 202 |
| GET | `/api/v1/network/status` | Read the observed network state. | 200 |
| GET | `/api/v1/network/wireguard/defaults` | The values a new WireGuard tunnel starts from. | 200 |
| PUT | `/api/v1/network/{iface}` | Declare or replace one interface, validated against the whole map. | 202 |
| DELETE | `/api/v1/network/{iface}` | Remove one interface, re-validating the rest of the map without it. | 204 |
| GET | `/api/v1/network/{iface}/peers` | List every peer configured on one WireGuard tunnel. | 200 |
| POST | `/api/v1/network/{iface}/peers` | Add one peer to a WireGuard tunnel. | 201 |
| PUT | `/api/v1/network/{iface}/peers/{publicKey}` | Edit one peer of a WireGuard tunnel in place, identified by its public key. | 200 |
| DELETE | `/api/v1/network/{iface}/peers/{publicKey}` | Remove one peer from a tunnel, identified by its public key. | 204 |
| GET | `/api/v1/wifi` | Read which role holds the radio. | 200 |
| PUT | `/api/v1/wifi` | Switch the radio's role and write that role's configuration, as one write and one task. | 202 |
| GET | `/api/v1/wifi/ap` | Read the access-point configuration, with its key redacted. | 200 |
| PUT | `/api/v1/wifi/ap` | Configure the access point: switch it on, name it, key it, place it. | 202 |
| GET | `/api/v1/wifi/capabilities` | Read what the radio can do as an access point. | 200 |
| GET | `/api/v1/wifi/channels` | Read the channels an access point may use in a country. | 200 |
| GET | `/api/v1/wifi/client` | Read which radio the WiFi station runs on, and whether it runs. | 200 |
| PUT | `/api/v1/wifi/client` | Bind the WiFi station to a radio, and switch it on or off. | 202 |
| GET | `/api/v1/wifi/client/networks` | List every known WiFi network. | 200 |
| POST | `/api/v1/wifi/client/networks` | Add one known WiFi network. | 201 |
| PUT | `/api/v1/wifi/client/networks/{ssid}` | Replace one known network, keeping its stored key unless a new one is sent. | 200 |
| DELETE | `/api/v1/wifi/client/networks/{ssid}` | malformed-SSID case: any non-empty path segment is a possible name. | 204 |
| POST | `/api/v1/wifi/client/scan` | Scan for WiFi networks on the station's radio. | 200 |

## 访问：SSH、Web 监听、局域网发现

| 方法 | 路径 | 内容（OpenAPI 摘要原文） | 成功 |
|---|---|---|---|
| GET | `/api/v1/mdns` | What the device announces on the LAN over mDNS. | 200 |
| GET | `/api/v1/ssdp` | Whether the device answers UPnP discovery, and what it announces. | 200 |
| GET | `/api/v1/ssh/authorized-keys` | List every authorized SSH key. | 200 |
| POST | `/api/v1/ssh/authorized-keys` | Authorize one SSH public key. | 201 |
| DELETE | `/api/v1/ssh/authorized-keys/{fingerprint}` | Remove one authorized SSH key by its fingerprint. | 204 |
| GET | `/api/v1/web` | Read where the console listens. | 200 |
| PUT | `/api/v1/web` | Move the console: who reaches the API, its ports, and whether it serves HTTPS. | 202 |
| GET | `/api/v1/web/certificate` | Read the console's TLS identity. | 200 |
| PUT | `/api/v1/web/certificate` | Replace the console's TLS identity with an uploaded certificate and key. | 200 |
| POST | `/api/v1/web/certificate/generate` | Replace the console's TLS identity with a new self-signed one. | 200 |

## 容器、服务与 MQTT

| 方法 | 路径 | 内容（OpenAPI 摘要原文） | 成功 |
|---|---|---|---|
| PUT | `/api/v1/container-projects/{project}` | Declare or replace one project. | 202 |
| DELETE | `/api/v1/container-projects/{project}` | Remove one project: its containers and network go; `/mica/volumes/<project>/` stays. | 202 |
| POST | `/api/v1/container-projects/{project}/check` | Check a Compose file as a project, storing nothing. | 200 |
| GET | `/api/v1/container-projects/{project}/services/{service}/logs` | The last lines of one service's log, bounded, each line scrubbed as a service log's are before it leaves the device. | 200 |
| POST | `/api/v1/container-projects/{project}/services/{service}/{action}` | Start, stop or restart one service's container. | 204 |
| POST | `/api/v1/container-projects/{project}/{action}` | Start, stop or restart every container of a project. | 204 |
| GET | `/api/v1/containers` | The projects, and what mica-containerd reports, as micad joins them. | 200 |
| GET | `/api/v1/mqtt` | Read the MQTT configuration together with the reconciler's live state. | 200 |
| PUT | `/api/v1/mqtt` | Replace the MQTT configuration, applied as one reconcile. | 202 |
| GET | `/api/v1/units` | Every service declared or put there with `mica-unit`. | 200 |
| PUT | `/api/v1/units/{name}` | Declare or replace one service. | 202 |
| DELETE | `/api/v1/units/{name}` | Remove one declared service: micad stops it and deletes it with its links. | 202 |
| GET | `/api/v1/units/{name}/logs` | The newest lines of an installed service's log: its journal, or on OpenRC the RAM log's lines tagged with its name. | 200 |
| POST | `/api/v1/units/{name}/{action}` | Start, stop or restart an installed service, managed by micad or put there with `mica-unit`. | 204 |

## 蓝牙

| 方法 | 路径 | 内容（OpenAPI 摘要原文） | 成功 |
|---|---|---|---|
| GET | `/api/v1/bluetooth` | Read the Bluetooth surface: the trust list, the adapter, the devices, the pairing window and whatever is waiting to be confirmed. | 200 |
| PUT | `/api/v1/bluetooth` | Switch the adapter on or off. | 202 |
| DELETE | `/api/v1/bluetooth/devices/{address}` | Drop a device: out of the trust list, and out of the adapter's keys. | 204 |
| POST | `/api/v1/bluetooth/devices/{address}/{action}` | Act on a device: `pair` with one this device started the pairing with; `trust`, `untrust`, `block` or `unblock` a declared one. | 204 |
| POST | `/api/v1/bluetooth/pairing-requests/{mac}` | Answer a pairing waiting in `pending`: `accept` when the six digits match what the other device shows. | 204 |
| POST | `/api/v1/bluetooth/pairing-window` | Open the pairing window: for 180 seconds the adapter is discoverable and pairable, and a pairing waits in `pending` for the console. | 200 |
| DELETE | `/api/v1/bluetooth/pairing-window` | Close the pairing window now; whatever still waits is refused. | 204 |
| GET | `/api/v1/bluetooth/provisioning` | Read BLE provisioning's state. | 200 |
| POST | `/api/v1/bluetooth/provisioning` | Open a `manual` window: a phone authenticates with the temp code the answer carries. | 200 |
| DELETE | `/api/v1/bluetooth/provisioning` | Close the `manual` window; its temp code stops working. | 204 |
| PUT | `/api/v1/bluetooth/provisioning/settings` | Switch the offline trigger: whether a claimed device that loses its default route for 120 seconds opens a window. | 202 |

## 系统、观测与诊断

| 方法 | 路径 | 内容（OpenAPI 摘要原文） | 成功 |
|---|---|---|---|
| GET | `/api/v1/diagnostics/snapshots` | List the stored diagnostic snapshots. | 200 |
| POST | `/api/v1/diagnostics/snapshots` | Collect a diagnostic snapshot. | 201 |
| GET | `/api/v1/diagnostics/snapshots/{id}` | Export one diagnostic snapshot. | 200 |
| DELETE | `/api/v1/diagnostics/snapshots/{id}` | Delete one diagnostic snapshot. | 204 |
| GET | `/api/v1/health` | Report whether this appliance is manageable. | 200 |
| GET | `/api/v1/storage/media` | Read the external media inventory. | 200 |
| POST | `/api/v1/storage/media/devices/{deviceId}/eject` | Eject one external media device. | 200 |
| POST | `/api/v1/storage/media/{id}/unmount` | Unmount one external media volume. | 200 |
| GET | `/api/v1/storage/status` | Read the storage status. | 200 |
| GET | `/api/v1/system/info` | Read the system-information surface. | 200 |
| GET | `/api/v1/system/integrity` | Read the integrity card. | 200 |
| GET | `/api/v1/system/logs/{source}` | Read the newest lines of one service's log. | 200 |
| GET | `/api/v1/system/support-info` | Read the support summary. | 200 |
| GET | `/api/v1/system/telemetry` | Read the board telemetry. | 200 |
| GET | `/api/v1/time/status` | Read the time-synchronization status. | 200 |
| GET | `/api/v1/time/zones` | Read the zone catalog. | 200 |

## 电源与 root 密码

| 方法 | 路径 | 内容（OpenAPI 摘要原文） | 成功 |
|---|---|---|---|
| POST | `/api/v1/actions/poweroff` | Power the appliance off. | 202 |
| POST | `/api/v1/actions/reboot` | Reboot the appliance. | 202 |
| POST | `/api/v1/actions/transient-root-password` | Set a transient root password. | 202 |

## 更新

| 方法 | 路径 | 内容（OpenAPI 摘要原文） | 成功 |
|---|---|---|---|
| GET | `/api/v1/update` | Read the complete update state. | 200 |
| POST | `/api/v1/update/check` | Start an update metadata check. | 202 |
| POST | `/api/v1/update/config` | Write the operator's update configuration. | 200 |
| POST | `/api/v1/update/confirm` | Confirm the authenticated running deployment explicitly. | 200 |
| POST | `/api/v1/update/fetch` | Start a bundle download into the reserve directory. | 202 |
| POST | `/api/v1/update/import` | Upload a signed offline archive and import it. | 202 |
| POST | `/api/v1/update/install` | Install an acquired signed deployment; poll update state for completion. | 202 |
| POST | `/api/v1/update/install-latest` | Check for, download and install the newest release. | 202 |
| GET | `/api/v1/update/media` | List the update archives on external media. | 200 |
| POST | `/api/v1/update/media/import` | Import an update archive from external media. | 202 |
| POST | `/api/v1/update/reboot-override` | Arm the bounded administrative override of the safe-to-reboot gate. | 200 |
| POST | `/api/v1/update/reject` | Reject a deployment while retaining a usable fallback. | 200 |
| POST | `/api/v1/update/rollback` | Reject the confirmed running deployment and select its retained fallback. | 200 |

## 重置、驱动与 owner 证书

| 方法 | 路径 | 内容（OpenAPI 摘要原文） | 成功 |
|---|---|---|---|
| POST | `/api/v1/reset` | Stage a reset tier. | 202 |
| GET | `/api/v1/system/extensions` | The driver extensions: `installed` (the confirmed builds, by kernel and name), `pending` (a change on trial and its `attemptsLeft`), `pair` (one paired with a system update), `pendingVerification` (builds the kernel checks at the next boot that maps them), `waitsForExtension` (what the selected system update waits for, `[{name, kernel}]`), `boot` (what this boot mapped and refused), `trust` and the running `kernel`. | 200 |
| POST | `/api/v1/system/extensions` | Install an owner's driver extension build from the next boot, on trial: `multipart/form-data` with `password` and either `archive` (the build's `MICAUPD1` archive) or `descriptor`, `image` and `signature` (its `ext.json`, `ext.img` and `ext.roothash.p7s`). | 202 |
| DELETE | `/api/v1/system/extensions/{name}` | Stop installing a driver extension, on trial from the next boot. | 202 |
| POST | `/api/v1/system/extensions/{name}/drop` | Let the system update to a new kernel run without a driver extension it waits for (`waitsForExtension`): its install leaves the extension out. | 202 |
| GET | `/api/v1/system/factory-reset` | Whether a factory reset can run now, and the last one. | 200 |
| POST | `/api/v1/system/factory-reset` | Erase everything configured on the device: the administrator and the claim, settings, networks, keys, containers and all data. | 202 |
| GET | `/api/v1/system/owner-certs` | The enrolled owner certificates, each with its `sha256`, `state` (`loaded`, `rejected` with its `reason`, `pending-next-boot`, `pending-confirmation` or `removed-next-boot`) and, while it reads, `subject`, `issuer`, `notBefore`, `notAfter` and `key`. | 200 |
| POST | `/api/v1/system/owner-certs` | Enrol an owner certificate from the next boot: one X.509 v3 certificate, PEM or DER, with an RSA key of 2048 bits or more or an ECDSA key on P-256 or P-384; its validity period is held to the clock while the device believes it. | 202 |
| DELETE | `/api/v1/system/owner-certs/{sha256}` | Remove an enrolled owner certificate from the next boot; this boot's keyring keeps it. | 202 |

## 控制台包

| 方法 | 路径 | 内容（OpenAPI 摘要原文） | 成功 |
|---|---|---|---|
| GET | `/api/v1/ui` | Report whether `/` currently selects a custom UI bundle. | 200 |
| PUT | `/api/v1/ui/active` | Select one exact retained custom bundle after repeating every safety and compatibility check. | 200 |
| DELETE | `/api/v1/ui/active` | Deactivate the custom bundle so `/` selects the built-in UI. | 200 |
| GET | `/api/v1/ui/bundles` | List every retained custom UI generation. | 200 |
| POST | `/api/v1/ui/bundles` | Stream a `.mica-ui.zip` to DATA, validate and extract it off the async worker, then install it without changing the active generation. | 201 |
| DELETE | `/api/v1/ui/bundles/{generation}` | Delete one inactive retained custom UI generation. | 204 |

