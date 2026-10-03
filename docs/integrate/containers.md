# Containers on Mica OS

**Mica OS does not orchestrate containers; it runs the ones you declare.** A
product with the `containers` feature carries the Podman engine and its
supervisor, `mica-containerd`. You declare containers in micad's settings;
micad hands the whole set to `mica-containerd`, which runs each one with
podman, restarts it by its policy and starts at boot what should. systemd or
OpenRC only starts the supervisor and takes no part in a container's life, so
the same declaration runs on either init.

The engine is in the `<board>.full` products and in `mini-x64.basic`
(`mica-build:boards/products.md`). It is off until you switch it on.

> status: shipped — evidence: `mica-podman:README.md`, `mica-core:docs/mica-core.md`, `mica-core:crates/micad-settings/src/model/containers.rs`

---

## 1. What is on the device

| Binary | Path | What it is |
|---|---|---|
| `mica-containerd` | `/usr/bin/mica-containerd` | the supervisor and its API, static |
| `podman` | `/usr/bin/podman`, `/usr/bin/docker` (symlink) | the engine; there is no Docker daemon or socket |
| `crun` | `/usr/bin/crun` | the OCI runtime |
| `conmon` | `/usr/libexec/podman/conmon` | per-container monitor |
| `netavark`, `aardvark-dns` | `/usr/libexec/podman/` | networking and container name resolution |
| `catatonit` | `/usr/libexec/podman/catatonit` | container init, for `--init` |

All of it is the one package `mica-podman`, built from pinned upstream source;
`/usr/share/mica-podman/upstream.lock` names the versions. Container storage
and network state live on DATA under `/mica/containers`.

> status: shipped — evidence: `mica-podman:README.md`

## 2. Switching it on

The `container` subtree of micad's settings holds the switch and the
declarations, as the document `/mica/config/container.json` on DATA or through
the API and the console:

```json
{
  "enabled": true,
  "units": {
    "web": {
      "image": "docker.io/library/nginx:1.27@sha256:<digest>",
      "publish": [{ "host": 8081, "container": 80 }],
      "volumes": [{ "host": "/mica/apps/web", "container": "/usr/share/nginx/html", "readOnly": true }],
      "restart": "always",
      "autoStart": true,
      "memory": "128m"
    }
  }
}
```

- **`enabled`** starts `mica-containerd` and declares every unit to it in one
  call. Switched off, micad declares none, waits until podman lists none of
  them, then stops the supervisor. It is `false` on every image.
- **Each unit** is a name (letters, digits, `-`, `_`) and:

| Key | Meaning |
|---|---|
| `image` | the image reference; pin it by digest |
| `command` | the command instead of the image's own |
| `environment` | variables passed in |
| `publish` | `{ host, container, protocol }` (`tcp` default, or `udp`); a host port may be published by one container only |
| `volumes` | `{ host, container, readOnly }`; the host path must lie under `/mica/` (DATA) and may not climb out of it |
| `restart` | `no` (default), `on-failure` or `always` |
| `autoStart` | whether it starts at boot |
| `pids` | 1 to 65536; absent is podman's own 2048 |
| `memory` | `<n>k`, `<n>m` or `<n>g`, at least `6m`; absent is unlimited |
| `cpu` | a number of CPUs such as `0.5` or `2`; absent is unlimited |

An unknown key is refused, and a declaration the device could not run — two
containers on one host port, a volume outside `/mica/`, an empty image — is
refused when it is written, not when it runs.

> status: shipped — evidence: `mica-core:crates/micad-settings/src/model/containers.rs`, `mica-core:docs/mica-core.md`

## 3. What the supervisor does

- **Running.** Each container is created with `podman run --replace` and the
  labels `mica.containerd=1` and `mica.containerd.spec=<hash>`. A changed
  declaration recreates it; a change to whether it runs does not.
- **Restarting.** Whether a stopped container restarts follows from its
  persisted declaration and the exit code podman reports. Attempts that never
  reached running and restarts after it did are bounded separately, with a
  growing back-off; exhausting either leaves the container `fatal` until it is
  started again.
- **Persistence.** Declarations and whether each should run are stored
  atomically on STATE (`/var/lib/mica/containerd/`). A stop survives a restart
  of the supervisor, and a reboot starts what starts at boot.
- **The supervisor stopping leaves the containers running**, and a restarted
  supervisor adopts them.
- **Logs** are kept in RAM under `/run/mica-containerd/logs/`, capped.

On the device, `mica-containerd ctl list`, `ctl logs --follow <name>` and
`ctl apply <file>` talk to its API on `/run/mica-containerd/api.sock`
(root only). The supervisor's own API also takes a health check and
dependencies between containers; micad's settings do not declare them yet.

> status: shipped — evidence: `mica-podman:README.md`

## 4. Data and updates

- **What survives an update**: everything under `/mica/` on DATA — the
  volumes you mount, the images podman pulled, the declarations. A deployment
  changes the root, the kernel and the core components, never DATA.
- **What a reset removes** is the reset tier's to say
  ([recovery](../reference/recovery.md)): a configuration reset drops the `container`
  document, an application-data reset the container storage.
- **Images are not verified by signature**: what protects a pull is the
  registry's TLS and a digest in the reference. Pin every image by digest.

> status: shipped — evidence: `docs/reference/recovery.md`, `docs/reference/storage.md`

## 5. Limits

- No orchestration across devices, no service discovery beyond one device's
  container network, no rolling update of a container set.
- The API and console declare containers through micad; the supervisor's
  health checks and dependencies are not reachable through them yet.
- An image that needs a privileged container, a host device or the host
  network is not something the declaration can express.

> status: unsupported
