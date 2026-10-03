# Applications

Mica OS supports two application delivery paths, and they differ by who releases
them and when:

1. **Native applications** are composed into the signed system image as
   build-time Debian packages. They update and roll back with the OS, inside
   the same signed A/B bundle, and they are an integrator capability — there
   is no on-device package installation, no `apt` on the device, ever.
2. **Containers** are the independently released path: pinned OCI images
   declared to micad and run by podman under `mica-containerd`, on either init,
   delivered and updated on the integrator's own schedule, surviving OS updates
   untouched. They are in the products with the `containers` feature.

The default customer for both is a trusted product integrator, not an
untrusted marketplace — the security consequences of that are stated plainly
below.

## 1. Choosing between them

The question that decides it is not how the code is written. It is **may this
code be a release behind the operating system?** If the answer is no, it is
native. Everything else follows from that one answer, and each row below is a
fact about the device rather than a preference:

| | Native package | Container |
|---|---|---|
| Who decides when it ships | the OS release does | you do, independently |
| Is it in the signed image | yes | no — the image is pulled at run time |
| What signs it | the signed deployment and kernel-verified dm-verity root signature | nothing today |
| Does an OS rollback take it back | yes, atomically, with the OS | no — it keeps running across the rollback |
| Does its failure roll the OS back | no — a failed unit is reported, not fatal; only a unit the health gate REQUIRES rolls the OS back, and no application is in that set | no — `mica-containerd` restarts it by its policy, and nothing else watches it |
| Where the code sits | the read-only verity root | `/mica/containers/storage` on DATA |
| Changeable on a running device | no | yes — the `container` settings, through the API, the console or `/mica/config/container.json` |
| Needs the container switch on | no | yes |

Two consequences are worth reading twice. Neither path's failure rolls the OS
back on its own: the health gate requires a small named set — the boot
transaction finished, micad answering, apid answering — and an application unit
is not in it, so a crash loop after an update leaves you a running device with
a broken application rather than a rollback. That is deliberate; a device
rolled into a deployment that may not run is worse than a device you can reach and
fix. And a container survives an OS rollback unchanged, which is a feature when
the two release on different schedules and a hazard when the application
depended on something the older OS does not have.

Neither path rolls back an application's **data**. That is section 6.

The integrator's guide to each is
[native-applications.md](native-applications.md) and
[containers.md](containers.md).

> status: shipped — evidence: `docs/integrate/native-applications.md`, `docs/integrate/containers.md`

## 2. Native applications: packages in the image

The root filesystem is composed from a local Debian package pool in one APT
transaction onto a pinned base. An integrator's native service is one more
producer in that pool: a `.deb` carrying the binary, its hardened systemd
unit, and its own enablement symlinks. Dependency ordering is `Depends`;
adding a component is adding a producer, not editing a build stage. The result
ships inside the verity-sealed root and is updated only by shipping a new
signed image.

> status: shipped — evidence: `mica-build:docs/design/packages.md`, `mica-core:scripts/deb/`, `mica-build:rootfs/packages/`

The integrator's guide —
[native-applications.md](native-applications.md) — covers
the producer convention, dedicated service accounts, where writable state
belongs, health and logs, named device access and the CPU, memory, PID and I/O
ceilings. Its examples are the packages this repository actually builds, and
its references into the source tree are resolved by `make docs-verify`, so a
file it names cannot quietly stop existing.

> status: shipped — evidence: `docs/integrate/native-applications.md`, `make docs-verify`

## 3. Containers: podman and mica-containerd

A product with the `containers` feature ships the engine (podman, crun, conmon,
netavark, aardvark-dns) and its supervisor `mica-containerd`, built from pinned
upstream source. Mica OS does not orchestrate containers: you declare each one
in micad's `container` settings — image, command, environment, published
ports, volumes, restart policy, start at boot, limits — and micad hands the set
to `mica-containerd`, which runs, restarts and starts them at boot. The
integrator's guide is [containers.md](containers.md).

The operating facts an operator needs:

- **One switch.** `container.enabled` in the settings tree, `false` by
  default. While it is false, the supervisor is stopped and nothing is
  declared. It is set through the authenticated API or the console.
- **Where declarations go.** The `container` document,
  `/mica/config/container.json` on DATA, or the API. They survive reboots and
  A/B updates, and a configuration reset removes them.
- **Where data goes.** Images and named volumes land under
  `/mica/containers` on DATA; a bind-mounted host path must lie under `/mica/`.
  Never `/var` — it is small, disposable, and wiped by design
  ([../operate/storage.md](../operate/storage.md)).
- **Logs** are kept in RAM by the supervisor
  (`mica-containerd ctl logs <name>`), and lost at reboot.
- **No automatic image updates.** Pulling a new image and deciding when a
  restart is safe is the integrator's, for the same reason OS updates are A/B
  and deliberate.

> status: shipped — evidence: `docs/integrate/containers.md`, `mica-podman:README.md`, `mica-core:docs/mica-core.md`

Two security truths:

- **Containers run as root.** Rootless mode is not built. Anything that can
  declare a container can run code with root's capabilities; that is what the
  switch and the authenticated API gate, and why the switch defaults to off.
- **Image signatures are not verified.** The shipped policy accepts anything;
  what protects a pull is registry TLS and a digest reference. Tightening it
  is a build-time change, because the policy file is inside the read-only
  root.

> status: shipped — evidence: `docs/integrate/containers.md`

### Running a container release safely

- **Pin by digest.** A tag is a pointer somebody else can move;
  `image@sha256:...` is content.
- **Registry credentials are yours to place and rotate**; Mica OS does not
  manage them.
- **Rollback is a new declaration with the previous digest.** That works only
  while the previous image is still on the device or in the registry.
- **Data compatibility is yours.** See section 6.

> status: shipped — evidence: `docs/integrate/containers.md`

## 4. Applications on the bus, and MQTT

The management plane and application data are separated by contract.
Applications that want to publish live data expose the `com.mica.Item1`
interface under a well-known name `com.mica.<class>[.<suffix>]`, and the
`mica-mqttd` bridge mirrors **only** services enrolled by their package, by
exact name, onto the local MQTT broker using the
`N/R/W/<deviceId>/<class>/<instance>/<path>` grammar. Management concerns —
network, SSH, credentials, updates, power, container enablement — are never
MQTT items, and the bridge structurally cannot address the management daemon.
The full contract, including enrollment, D-Bus policy, collision handling and
the default read-only bridge mode, is
[bus.md](bus.md).

> status: shipped — evidence: `docs/integrate/bus.md`, `mica-core:crates/mica-mqttd`

## 5. Application UI

apid can serve an integrator's web UI in place of the built-in one. From the
built-in System → UI versions page, upload a `.mica-ui.zip` generated by
`mica-ui-pack`; it is validated and retained under `/mica/ui` on DATA without
being activated. You can keep multiple versions, select one explicitly at
`/`, return to the built-in UI, and delete inactive versions. The built-in UI
remains reachable at `/_ui/` regardless of custom-bundle state — a broken
custom UI can never lock you out of management. See [../operate/api.md](../operate/api.md).

> status: shipped — evidence: `docs/reference/api.md`, `mica-core:crates/mica-apid/openapi.json`

A dedicated HDMI kiosk rendering the same UI on an attached screen is a
design with no shipped implementation in this repository.

> status: unsupported

## 6. What Mica OS does not enforce

Everything above is documentation and tested convention for a trusted product
integrator. None of it is a mechanism that refuses a release, and the
difference matters most to whoever is deciding what to promise a customer.

Four controls that a managed application platform would have, and that this
one does not: **image signature admission** — the shipped container policy
accepts any image, and nothing checks a signature at start; **mandatory
resource ceilings** — CPU, memory, PID and I/O limits are documented and
tested on both paths, and nothing requires them, so a unit with none is
started like any other; **a secret store** — registry credentials and
application secrets are files somebody places on DATA/state, readable by root, and
Mica OS does not create, rotate, escrow or audit them; and **automatic
application rollback** — no health gate watches an application update on
either path.

> status: unsupported

The last one has a native qualification that is easy to over-read in either
direction, and it is narrower than it used to be. Native code inherits the
whole-deployment A/B rollback, but the health gate does not trigger it on an
application's failure: it requires only that the deployment can be RECOVERED — the
boot transaction finished, micad answers, apid answers — and reports everything
else. An application that takes the device off the network entirely will fail
the gate; one that simply crashes will not. When the rollback does happen it is
not per-application — it moves every application on the device at once, and it
moves none of their **data**. DATA/state
and DATA sit outside the A/B pair by design, which is what makes them survive
an update; the consequence is that an application which migrated its own
schema on first start is, after any rollback, an old version pointed at new
data. That contract is the integrator's to write and to test, on both paths.

> status: shipped — evidence: `mica-system:overlay/usr/lib/mica/mica-health`, `docs/integrate/native-applications.md`

Managed and untrusted application controls — independently signed application
bundles, a distributable container trust policy, admission that can refuse a
release, a protected secret store, an audit trail and per-application
health-gated rollback — are a separate product with a separate cost. Their design is
[managed applications](managed-applications.md); they are not implemented
and not described by the guides above.

> status: proposed — evidence: `docs/integrate/managed-applications.md`
