# Containers on Mica OS

**Mica OS does not orchestrate containers; it runs the Compose projects you
declare.** A product with the `containers` feature carries a container engine.
You declare each project — one Compose file — in micad's settings, through
`micad ctr` on the device, the API or the console; micad hands the whole set to
the engine, which runs each service as one container, restarts it by its
policy and starts it at boot. systemd or OpenRC only starts the engine's
daemon and takes no part in a container's life, so the same declaration runs
on either init. On a product whose engine is Docker nothing is declared to
micad: you run containers with `docker` and `docker compose` (section 4).

The engine is in the `<board>.full` products (`mica-build:boards/products.md`).
It is off until you switch it on.

> status: shipped — evidence: `mica-podman:README.md`, `mica-core:docs/mica-core.md`, `mica-core:crates/micad-settings/src/model/containers.rs`

---

## 1. The engine

A product names its engine, `CONTAINER_ENGINE` in `/usr/lib/mica/product.conf`:
`podman` (the default) or `docker`. The settings, the bus, the API, the console
and `micad ctr` are the same on both; what differs is who carries a project
out.

- **podman**: the package `mica-podman` — podman (also as `/usr/bin/docker`;
  there is no Docker daemon or socket), crun, conmon, netavark, aardvark-dns,
  catatonit — and its supervisor `mica-containerd`, built from pinned
  upstream source. `/usr/share/mica-podman/upstream.lock` names the versions.
  Every container is `mica-containerd`'s, and a file is held to the Compose
  subset it carries out (section 3).
- **docker**: the package `mica-docker`, dockerd with the `docker` and
  `docker compose` CLIs. There is no `mica-containerd` and no declaration:
  micad switches dockerd on and off and reads and acts on its containers
  through the Docker Engine API, and dockerd runs what you create with
  `docker` and `docker compose`. No product carries the Docker engine yet.

Container storage and network state live on DATA under `/mica/containers`.

> status: shipped — evidence: `mica-podman:README.md`, `mica-core:docs/mica-core.md`

## 2. Declaring a project

This section is podman's; on docker, section 4 says what replaces it.

On the device, as root over SSH (a key in `access.ssh`), `micad ctr` (or
`mica-ctr`) talks to micad over the bus, so it, the console and the API change
one set of declarations:

```sh
mkdir -p /mica/compose/app && cd /mica/compose/app
cat >compose.yaml <<'YAML'
services:
  web:
    image: docker.io/library/nginx:1.27@sha256:<digest>
    ports: ["8080:80"]
    volumes: ["./html:/usr/share/nginx/html:ro"]
    restart: unless-stopped
YAML
micad ctr up                      # project app; ./html is /mica/compose/app/html
micad ctr list                    # every project's containers and their phase
micad ctr logs app/web --tail 50
micad ctr down                    # its containers and network go; ./html stays
```

| Command | Does |
|---|---|
| `up [-p <project>] [-f <file\|->] [--project-dir <dir>]` | checks the file, prints the problems and exits 1 when refused; otherwise stores it as the project with its directory and turns containers on |
| `down [-p <project>]` | removes the project; its containers and network go, its directory and `/mica/volumes/<project>/` stay |
| `list` (or `ps`) | every project's containers: project, service, container, phase, health |
| `check [-p <project>] [-f <file\|->] [--project-dir <dir>]` | checks a file without storing it |
| `start`, `stop`, `restart <project>[/<service>]` | the verb on every container of the project, or on one |
| `logs <project>/<service> [--tail N]` | the last lines of its log |

`up`, `down` and `check` take docker compose's defaults: the file is the first
of `compose.yaml`, `compose.yml`, `docker-compose.yaml` and
`docker-compose.yml` in the working directory; the project directory is the
file's directory; the project is `-p`, else the file's top-level `name`, else
the directory's name. A relative host path (`./data`, an `env_file`) resolves
in the project directory; a project declared without one has
`/mica/volumes/<project>/`.

In the settings, `container.enabled` is the switch (`false` on every image),
`container.projects.<project>` a project's Compose text and
`container.projectDirs.<project>` its directory. Each project is stored as
`/mica/config/container/<project>.yaml` on DATA. Every write is checked before
it is stored, with no daemon needed: a file the engine would refuse is refused
when it is written, with every problem named, not when it runs.

The API is `GET /api/v1/containers` and `/api/v1/container-projects/{project}`
(`PUT`, `DELETE`, `POST .../check`, and the verbs); the console lists the
projects with each service's state and edits a project's text with the
check's problems beside it ([../operate/api.md](../operate/api.md)).

> status: shipped — evidence: `mica-core:docs/mica-core.md`, `mica-core:crates/micad/src/ctr_cli.rs`, `mica-core:crates/micad-settings/src/model/containers.rs`

## 3. On podman: what mica-containerd does

- **The Compose subset.** A file is parsed with the parser of
  `docker compose` and held to what `mica-containerd` carries out: image,
  command and entrypoint, environment and `env_file`, published ports, bind
  mounts and named volumes, devices and device cgroup rules, the project
  network, `network_mode: host` or `none`, `container_name`, added and dropped
  capabilities, user and working directory, pids, memory and CPU limits, a
  health check, `depends_on` and the restart policy. Anything else in the file
  is refused by its name (`privileged`, `build`, `secrets`, ...), never
  ignored; the table is in `mica-podman:README.md`.
- **Running.** Each service is one container, `<project>-<service>-1` or its
  `container_name`, on the project network `<project>_default`, where its
  service name resolves. A changed service recreates its container; a
  restart-only change does not.
- **Restarting.** Whether a stopped container restarts follows from the
  stored declaration and the exit code podman reports. Attempts that never
  reached running and restarts after it did are bounded separately, with a
  growing back-off; exhausting either leaves the container `fatal` until it is
  started again. A `stop` holds until a `start`, across a restart of the
  supervisor; a reboot starts every service again, so `unless-stopped` is
  `always`.
- **Health and order.** The supervisor runs each health check on its
  interval; a container waits until each dependency runs, or is healthy.
- **A container run by hand** (`podman run`) carries no `mica.containerd`
  label and is neither managed nor touched; a project naming a container one
  holds is refused.
- **The supervisor stopping leaves the containers running**, and a restarted
  supervisor takes them up again as they are.
- **Logs** are kept in RAM under `/run/mica-containerd/logs/`, capped, and
  lost at reboot.

`mica-containerd ctl` and `mica-containerd compose check` are the
supervisor's own client and checker, the low-level and debugging path; a
project put with `ctl` and not in micad's settings is undone by micad's next
declaration.

> status: shipped — evidence: `mica-podman:README.md`

## 4. On docker: what micad does

On a docker product micad is a client of dockerd's Engine API on
`/run/docker.sock` and does nothing of its own: it runs no `docker compose`
and declares nothing.

- **The switch.** `container.enabled` enables and starts `docker.service`
  (the OpenRC script `docker`) and waits for dockerd to answer; turned off, it
  stops and disables the service. dockerd runs with `live-restore` off, so
  stopping it stops its containers, and the next start applies their restart
  policies.
- **Containers are made with `docker` and `docker compose`** on the device.
  Restart, start at boot and health are dockerd's, from each container's
  restart policy and health check: a container with no restart policy does not
  come back after a reboot.
- **Reads and verbs.** `micad ctr list`, the API and the console list every
  container dockerd holds, a compose one under its project and service, any
  other under its own name; start, stop, restart and logs are dockerd's.
- **No declarations.** A write of `container.projects` or
  `container.projectDirs` is refused, and so are `micad ctr up`, `down` and
  `check`: they say to use docker compose. The console lists and acts on
  containers but has no add or edit.

> status: proposed — evidence: `mica-core:docs/mica-core.md`, `mica-core:crates/micad/src/docker.rs`, `mica-docker:README.md`

## 5. Data and updates

- **What survives an update**: everything under `/mica/` on DATA — the
  projects, their directories and volumes, the images the engine pulled. A
  deployment changes the root and the kernel, and a core set the core
  components; neither touches DATA.
- **What a reset removes** is the reset tier's to say
  ([recovery](../reference/recovery.md)): a configuration reset drops the
  `container` settings, an application-data reset the projects, their volumes
  and the container storage.
- **Images are not verified by signature**: what protects a pull is the
  registry's TLS and a digest in the reference. Pin every image by digest.

> status: shipped — evidence: `docs/reference/recovery.md`, `docs/reference/storage.md`

## 6. Limits

- No orchestration across devices, no service discovery beyond one device's
  project networks, no rolling update of a project.
- On podman, a privileged container or a network other than the project's,
  the host's or none is not something a project can express.

> status: unsupported
