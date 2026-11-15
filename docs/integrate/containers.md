# Containers on Mica OS

**Mica OS does not orchestrate containers; it runs the Compose projects you
declare.** A product with the `containers` feature carries a container engine.
You declare each project — one Compose file — in micad's settings, through
`mica container` on the device, the API or the console; micad hands the whole set to
the engine, which runs each service as one container, restarts it by its
policy and starts it at boot. systemd or OpenRC only starts the engine's
daemon and takes no part in a container's life, so the same declaration runs
on either init. On a product whose engine is Docker nothing is declared to
micad: you run containers with `docker` and `docker compose` (section 4).

The engine is in the products that carry containers: Docker in `cx3576.full`,
`uefi-x64.docker` and `uefi-x64.gcp`, podman in the others;
[download](../start/download.md) section 1 says which products those are
(`mica-build:boards/products.md`). It is off until you switch it on.

> status: shipped — evidence: `mica-podman:README.md`, `mica-core:docs/mica-core.md`, `mica-core:crates/micad-settings/src/model/containers.rs`

---

## 1. The engine

A product names its engine, `CONTAINER_ENGINE` in `/usr/lib/mica/product.conf`:
`podman` (the default) or `docker`. The settings, the bus, the API, the console
and `mica container` are the same on both; what differs is who carries a project
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
  `docker` and `docker compose`. `cx3576.full`, `uefi-x64.docker` and
  `uefi-x64.gcp` carry it.

Container storage and network state live on DATA under `/mica/containers`.

> status: shipped — evidence: `mica-podman:README.md`, `mica-core:docs/mica-core.md`

## 2. Declaring a project

This section is podman's; on docker, section 4 says what replaces it.

On the device, as root over SSH (a key in `access.ssh`), `mica container`
talks to micad over the bus, so it, the console and the API change
one set of declarations:

```sh
mkdir -p /mica/compose/app && cd /mica/compose/app
cat >compose.yaml <<'YAML'
services:
  web:
    image: docker.io/library/nginx:1.27@sha256:<digest>
    ports: ["8081:80"]
    volumes: ["./html:/usr/share/nginx/html:ro"]
    restart: unless-stopped
YAML
mica container up                 # project app; ./html is /mica/compose/app/html
mica container list               # every project's containers and their phase
mica container logs app/web --tail 50
mica container down               # its containers and network go; ./html stays
```

| Command | Does |
|---|---|
| `up [--project <project>] [--file <file\|->] [--project-dir <dir>]` | checks the file, prints the problems and exits 1 when refused; otherwise stores it as the project with its directory and turns containers on |
| `down [--project <project>]` | removes the project; its containers and network go, its directory and `/mica/volumes/<project>/` stay |
| `list` | every project's containers: project, service, container, phase, health; `--json` prints the bus answer |
| `check [--project <project>] [--file <file\|->] [--project-dir <dir>]` | checks a file without storing it |
| `start`, `stop`, `restart <project>[/<service>]` | the verb on every container of the project, or on one |
| `logs <project>/<service> [--tail N]` | the last lines of its log (100 unless asked) |
| `status` | whether containers are on (`container.enabled`) |
| `on`, `off` | writes `container.enabled` and waits for it; the projects stay declared |

`up`, `down` and `check` take docker compose's defaults: the file is the first
of `compose.yaml`, `compose.yml`, `docker-compose.yaml` and
`docker-compose.yml` in the working directory; the project directory is the
file's directory; the project is `--project`, else the file's top-level `name`, else
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
  policies. The package turns IP forwarding on at boot
  (`/usr/lib/sysctl.d/50-mica-docker.conf`), which dockerd's nftables backend
  does not do itself.
- **Containers are made with `docker` and `docker compose`** on the device.
  Restart, start at boot and health are dockerd's, from each container's
  restart policy and health check: a container with no restart policy does not
  come back after a reboot.
- **Reads and verbs.** `mica container list`, the API and the console list every
  container dockerd holds, a compose one under its project and service, any
  other under its own name; start, stop, restart and logs are dockerd's.
- **No declarations.** A write of `container.projects` or
  `container.projectDirs` is refused, and so are `mica container up`, `down` and
  `check`: they say to use docker compose. The console lists and acts on
  containers but has no add or edit.

> status: shipped — evidence: `mica-core:docs/mica-core.md`, `mica-core:crates/micad/src/docker.rs`, `mica-docker:README.md`, `mica-build:boards/uefi-x64/products/docker/product.env`, `mica-build:boards/cx3576/products/full/product.env`

## 5. Without micad: switching the engine on by hand

On a product without micad, or before micad is installed, the container switch
is `mica-units`: the base starts at boot every unit listed in
`/var/lib/mica/units/enabled` on DATA, and `mica-units enable` lists one and
starts it ([without micad](../operate/without-micad.md)). As root on the device
(SSH by a key, for instance one from a provisioning medium's
`mica-authorized-keys`):

```sh
# podman products: mica-containerd; docker products: docker
/usr/lib/mica/mica-units enable mica-containerd   # now, and at every boot
```

Then declare the projects to the engine itself:

- **podman**: `mica-containerd ctl`, the daemon's own client, in the project
  directory: `ctl up [-p PROJECT] [-f FILE]`, `ctl list`, `ctl logs NAME`,
  `ctl down [-p PROJECT]`. The daemon keeps each project in
  `/var/lib/mica/containerd/projects/` on DATA and starts its services at
  every boot (`mica-podman:README.md`, *On the device: the CLI*).
- **docker**: `docker compose up -d`; give every service a restart policy, or
  it does not come back after a reboot (section 4).

To switch the engine off, `/usr/lib/mica/mica-units disable mica-containerd`;
the projects stay declared.

**When micad is added later**, its `container.enabled` setting decides: off,
the default, stops the engine and takes its line out of the list. Switch
containers on through micad first. On podman micad then adopts, once, the
projects put with `mica-containerd ctl` that its settings lack, and from then
on its set is what the engine runs.

> status: shipped — evidence: `mica-system-base:payload/usr/lib/mica/mica-units`, `mica-core:crates/micad/src/reconciler/enabled.rs`, `mica-podman:README.md`

## 6. Data and updates

- **What survives an update**: everything under `/mica/` on DATA — the
  projects, their directories and volumes, the images the engine pulled. A
  deployment changes the root and the kernel, and a core set the core
  components; neither touches DATA.
- **The engine's storage on a disk of your own.** Mount a disk exactly at the
  engine root, `/mica/containers/storage` (podman) or `/mica/containers/docker`
  (docker), to keep images and containers off DATA. The engine then requires
  that mount and does not start without it, so a missing disk fails the
  engine instead of filling DATA ([storage](../operate/storage.md) section 3).
- **What a reset removes** is the reset tier's to say
  ([recovery](../reference/recovery.md)): a configuration reset drops the
  `container` settings, an application-data reset the projects, their volumes
  and the container storage on DATA, but nothing on a disk mounted at the
  engine root. On docker an application-data reset is refused while dockerd
  runs: switch containers off first.
- **Images are not verified by signature**: what protects a pull is the
  registry's TLS and a digest in the reference. Pin every image by digest.

> status: shipped — evidence: `docs/reference/recovery.md`, `docs/reference/storage.md`, `mica-podman:README.md`, `mica-docker:README.md`

## 7. End to end on podman

`uefi-x64.full`, `s905x5m.sd-full` or `s905x5m.emmc-full`, as root on the
device. A web server publishing a page from `/srv`, which no reset tier
clears:

```sh
mica container on                      # switches container.enabled on and waits
mkdir -p /srv/web/html && cd /srv/web
echo '<h1>hello from mica</h1>' > html/index.html
cat > compose.yaml <<'YAML'
name: web
services:
  nginx:
    image: docker.io/library/nginx:1.27
    ports: ["8081:80"]
    volumes: ["./html:/usr/share/nginx/html:ro"]
    restart: unless-stopped
YAML
mica container check                   # the problems, if any; exit 1 when refused
mica container up                      # stores project "web" with /srv/web as its directory
mica container list                    # web  nginx  web-nginx-1  running ...
```

Pin the image by digest (`nginx:1.27@sha256:...`) for anything you keep, so
an update of the tag does not change what runs. Port 8081, not 8080: the
device's console holds 8080.

**Check it worked:**

```sh
curl -s http://mica-a4e2e69e.local:8081/      # from the workstation: <h1>hello from mica</h1>
mica container logs web/nginx --tail 5
mica reboot                                   # then, after the boot:
mica container list                           # web-nginx-1 running again
```

**Change it:** edit `compose.yaml`, `mica container up` again; a changed
service's container is recreated. **Stop it for a while:**
`mica container stop web` (it stays stopped across a supervisor restart,
and starts again at the next boot). **Remove it:** `mica container down`;
the container and its network go, `/srv/web` stays.

The same through the API, from the workstation, with the Compose file
beside you:

```sh
jq -n --rawfile text compose.yaml '{compose: $text}' |
  curl -s -H "$AUTH" -X POST $DEV/api/v1/container-projects/web/check \
    -H 'content-type: application/json' -d @-          # {"ok":true,...} or the problems
jq -n --rawfile text compose.yaml '{compose: $text}' |
  curl -s -H "$AUTH" -X PUT $DEV/api/v1/container-projects/web \
    -H 'content-type: application/json' -d @-          # 202 {"taskId":"<id>"}
curl -s -H "$AUTH" $DEV/api/v1/containers              # each service's container, phase, health
```

A project declared through the API has no project directory of its own: its
relative paths (`./html`) resolve in `/mica/volumes/web/`, so put the page
there. The other project routes are in [the HTTP API](../reference/http-api.md).

> status: shipped — evidence: `mica-core:crates/micad/src/ctr_cli.rs`, `mica-podman:README.md`

## 8. End to end on Docker

`cx3576.full`, `uefi-x64.docker` and `uefi-x64.gcp` run Docker. Nothing is
declared to micad; you use `docker compose`, and micad only switches dockerd
and shows its containers.

```sh
mica container on                      # starts docker.service and waits for dockerd
mkdir -p /srv/web/html && cd /srv/web
echo '<h1>hello from mica</h1>' > html/index.html
cat > compose.yaml <<'YAML'
services:
  nginx:
    image: docker.io/library/nginx:1.27
    ports: ["8081:80"]
    volumes: ["./html:/usr/share/nginx/html:ro"]
    restart: unless-stopped
YAML
docker compose up -d
docker compose ps
mica container list                    # the same container, under project web, service nginx
```

`restart: unless-stopped` (or `always`) is what brings it back after a
reboot: dockerd starts again at boot and applies each container's restart
policy, and a container with none stays down. `mica container up`, `down`
and `check` are refused on these products and say to use `docker compose`.

**Check it worked:**

```sh
curl -s http://mica-a4e2e69e.local:8081/      # <h1>hello from mica</h1>
mica reboot                                   # then:
docker compose -f /srv/web/compose.yaml ps    # running again
```

**Remove it:** `docker compose down` in `/srv/web`. Images and containers are
on DATA under `/mica/containers/docker`; to keep them off DATA, mount a disk
there ([storage](../operate/storage.md) section 3).

> status: shipped — evidence: `mica-core:docs/mica-core.md`, `mica-docker:README.md`, `mica-build:boards/uefi-x64/products/docker/product.env`

## 9. Limits

- No orchestration across devices, no service discovery beyond one device's
  project networks, no rolling update of a project.
- On podman, a privileged container or a network other than the project's,
  the host's or none is not something a project can express.

> status: unsupported
