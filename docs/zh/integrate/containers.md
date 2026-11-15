# Mica OS 上的容器

**Mica OS 不编排容器；它运行你声明的 Compose 项目。**带 `containers` 特性的产品带有一个容器引擎。你在
micad 的设置中声明每个项目（一个 Compose 文件），途径是设备上的 `mica container`、API 或控制台；micad 把整个
集合交给引擎，引擎把每个服务作为一个容器运行，按其策略重启它，并在启动时启动它。systemd 或 OpenRC 只负责
启动引擎的守护进程，不参与容器的生命周期，所以同样的声明在两种 init 上都能运行。在引擎是 Docker 的产品上，
不向 micad 声明任何东西：你用 `docker` 和 `docker compose` 运行容器（第 4 节）。

引擎在带容器的产品中：`cx3576.full`、`uefi-x64.docker` 和 `uefi-x64.gcp` 是 Docker，其他是 podman；
[下载](../start/download.md)第 1 节写明是哪些产品（`mica-build:boards/products.md`）。在你打开它之前它是关闭的。

> status: shipped — evidence: `mica-podman:README.md`, `mica-core:docs/mica-core.md`, `mica-core:crates/micad-settings/src/model/containers.rs`

---

## 1. 引擎

产品在 `/usr/lib/mica/product.conf` 中用 `CONTAINER_ENGINE` 指定引擎：`podman`（默认）或 `docker`。设置、
总线、API、控制台和 `mica container` 在两者上相同；不同的是由谁执行项目。

- **podman**：软件包 `mica-podman`，包含 podman（也作为 `/usr/bin/docker`；没有 Docker 守护进程或 socket）、
  crun、conmon、netavark、aardvark-dns、catatonit，以及它的监管进程 `mica-containerd`，均由固定版本的上游源码
  构建。`/usr/share/mica-podman/upstream.lock` 写明各版本。每个容器都归 `mica-containerd` 管，文件被限定在它
  所执行的 Compose 子集内（第 3 节）。
- **docker**：软件包 `mica-docker`，即 dockerd 加上 `docker` 和 `docker compose` 命令行。没有
  `mica-containerd`，也没有声明：micad 开关 dockerd，并通过 Docker Engine API 读取和操作它的容器，dockerd
  运行你用 `docker` 和 `docker compose` 创建的东西。`cx3576.full`、`uefi-x64.docker` 和 `uefi-x64.gcp` 带它。

容器存储和网络状态在 DATA 上的 `/mica/containers` 下。

> status: shipped — evidence: `mica-podman:README.md`, `mica-core:docs/mica-core.md`

## 2. 声明一个项目

本节针对 podman；在 docker 上，第 4 节说明用什么代替它。

在设备上，以 root 通过 SSH（`access.ssh` 中的密钥）运行的 `mica container` 经总线与 micad 通信，所以它、
控制台和 API 修改的是同一组声明：

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
mica container up                 # 项目 app；./html 即 /mica/compose/app/html
mica container list               # 每个项目的容器及其阶段
mica container logs app/web --tail 50
mica container down               # 它的容器和网络消失；./html 保留
```

| 命令 | 作用 |
|---|---|
| `up [--project <project>] [--file <file\|->] [--project-dir <dir>]` | 检查文件，被拒绝时打印问题并以 1 退出；否则把它连同目录存为项目，并打开容器 |
| `down [--project <project>]` | 移除项目；其容器和网络消失，其目录和 `/mica/volumes/<project>/` 保留 |
| `list` | 每个项目的容器：项目、服务、容器、阶段、健康；`--json` 打印总线的回答 |
| `check [--project <project>] [--file <file\|->] [--project-dir <dir>]` | 检查文件而不保存 |
| `start`、`stop`、`restart <project>[/<service>]` | 对项目的每个容器或其中一个执行该动作 |
| `logs <project>/<service> [--tail N]` | 其日志的最后几行（未指定时 100 行） |
| `status` | 容器是否打开（`container.enabled`） |
| `on`、`off` | 写入 `container.enabled` 并等待其生效；项目保持声明 |

`up`、`down` 和 `check` 采用 docker compose 的默认值：文件是工作目录中 `compose.yaml`、`compose.yml`、
`docker-compose.yaml` 和 `docker-compose.yml` 里的第一个；项目目录是文件所在目录；项目名是 `--project`，
否则是文件顶层的 `name`，否则是目录名。相对的主机路径（`./data`、`env_file`）在项目目录中解析；声明时没有
项目目录的项目使用 `/mica/volumes/<project>/`。

在设置中，`container.enabled` 是开关（每个镜像上都是 `false`），`container.projects.<project>` 是项目的
Compose 文本，`container.projectDirs.<project>` 是它的目录。每个项目存为 DATA 上的
`/mica/config/container/<project>.yaml`。每次写入在保存前都会检查，不需要守护进程：引擎会拒绝的文件在写入时
就被拒绝，并列出每个问题，而不是等到运行时。

API 是 `GET /api/v1/containers` 和 `/api/v1/container-projects/{project}`（`PUT`、`DELETE`、
`POST .../check` 以及各动作）；控制台列出项目及每个服务的状态，并在编辑项目文本时把检查出的问题显示在旁边
（[../operate/api.md](../operate/api.md)）。

> status: shipped — evidence: `mica-core:docs/mica-core.md`, `mica-core:crates/micad/src/ctr_cli.rs`, `mica-core:crates/micad-settings/src/model/containers.rs`

## 3. 在 podman 上：mica-containerd 做什么

- **Compose 子集。**文件用 `docker compose` 的解析器解析，并限定在 `mica-containerd` 执行的内容内：镜像、
  命令和入口点、环境变量和 `env_file`、发布的端口、绑定挂载和命名卷、设备和设备 cgroup 规则、项目网络、
  `network_mode: host` 或 `none`、`container_name`、增加和去除的能力、用户和工作目录、pids、内存和 CPU 限制、
  健康检查、`depends_on` 以及重启策略。文件中的其他任何东西都按名称被拒绝（`privileged`、`build`、`secrets`
  等），从不被忽略；表格在 `mica-podman:README.md` 中。
- **运行。**每个服务是一个容器，名为 `<project>-<service>-1` 或其 `container_name`，位于项目网络
  `<project>_default` 上，服务名在其中可解析。服务改变会重建其容器；只改重启策略则不会。
- **重启。**停止的容器是否重启，取决于保存的声明和 podman 报告的退出码。从未进入运行状态的尝试与运行之后的
  重启分别计数，退避时间递增；任一耗尽都会让容器处于 `fatal`，直到再次启动它。`stop` 会一直保持到
  `start`，监管进程重启也不例外；重启设备会再次启动每个服务，所以 `unless-stopped` 等同于 `always`。
- **健康与顺序。**监管进程按间隔运行每个健康检查；容器会等待它的每个依赖运行起来，或变为健康。
- **手工运行的容器**（`podman run`）不带 `mica.containerd` 标签，既不被管理也不被触碰；项目若使用了这种容器
  占用的名称，会被拒绝。
- **监管进程停止时容器继续运行**，监管进程重启后按原样接管它们。
- **日志**保存在内存中的 `/run/mica-containerd/logs/` 下，有上限，重启后丢失。

`mica-containerd ctl` 和 `mica-containerd compose check` 是监管进程自己的客户端和检查器，属于底层和调试
途径；用 `ctl` 放入、但不在 micad 设置中的项目，会被 micad 的下一次声明撤销。

> status: shipped — evidence: `mica-podman:README.md`

## 4. 在 docker 上：micad 做什么

在 docker 产品上，micad 是 dockerd 在 `/run/docker.sock` 上的 Engine API 的客户端，自己什么也不做：它不运行
`docker compose`，也不声明任何东西。

- **开关。**`container.enabled` 启用并启动 `docker.service`（OpenRC 脚本 `docker`），并等待 dockerd 应答；
  关闭时停止并禁用该服务。dockerd 以关闭的 `live-restore` 运行，所以停止它会停止它的容器，下次启动时应用
  它们的重启策略。软件包在启动时打开 IP 转发（`/usr/lib/sysctl.d/50-mica-docker.conf`），dockerd 的
  nftables 后端自己不会这样做。
- **容器在设备上用 `docker` 和 `docker compose` 创建。**重启、开机启动和健康都归 dockerd，依据每个容器的
  重启策略和健康检查：没有重启策略的容器在重启设备后不会回来。
- **读取与动作。**`mica container list`、API 和控制台列出 dockerd 持有的每个容器，compose 创建的列在其项目和
  服务下，其他的列在自己的名称下；启动、停止、重启和日志都由 dockerd 执行。
- **没有声明。**写入 `container.projects` 或 `container.projectDirs` 会被拒绝，`mica container up`、`down` 和
  `check` 也一样：它们会提示使用 docker compose。控制台能列出和操作容器，但没有添加或编辑。

> status: shipped — evidence: `mica-core:docs/mica-core.md`, `mica-core:crates/micad/src/docker.rs`, `mica-docker:README.md`, `mica-build:boards/uefi-x64/products/docker/product.env`, `mica-build:boards/cx3576/products/full/product.env`

## 5. 没有 micad 时：手动打开引擎

在没有 micad 的产品上，或在安装 micad 之前，容器开关是 `mica-units`：Base 在启动时启动 DATA 上
`/var/lib/mica/units/enabled` 中列出的每个 unit，`mica-units enable` 把一个 unit 加入列表并启动它
（[没有 micad](../operate/without-micad.md)）。在设备上以 root（通过密钥登录 SSH，例如来自配置介质的
`mica-authorized-keys` 的密钥）运行：

```sh
# podman 产品：mica-containerd；docker 产品：docker
/usr/lib/mica/mica-units enable mica-containerd   # 现在以及每次启动时
```

然后直接向引擎声明项目：

- **podman**：在项目目录中使用守护进程自己的客户端 `mica-containerd ctl`：`ctl up [-p PROJECT] [-f FILE]`、
  `ctl list`、`ctl logs NAME`、`ctl down [-p PROJECT]`。守护进程把每个项目保存在 DATA 上的
  `/var/lib/mica/containerd/projects/` 中，并在每次启动时启动其服务（`mica-podman:README.md`，
  *On the device: the CLI*）。
- **docker**：`docker compose up -d`；给每个服务设置重启策略，否则重启设备后它不会回来（第 4 节）。

要关闭引擎，运行 `/usr/lib/mica/mica-units disable mica-containerd`；项目保持声明。

**之后加入 micad 时**，由它的 `container.enabled` 设置决定：关闭（默认）会停止引擎，并把它从列表中移除。
先通过 micad 打开容器。在 podman 上，micad 随后会一次性接管用 `mica-containerd ctl` 放入、而它的设置中没有的
项目，从那以后引擎运行的就是它的集合。

> status: shipped — evidence: `mica-system-base:payload/usr/lib/mica/mica-units`, `mica-core:crates/micad/src/reconciler/enabled.rs`, `mica-podman:README.md`

## 6. 数据与更新

- **更新后保留什么**：DATA 上 `/mica/` 下的一切：项目、它们的目录和卷、引擎拉取的镜像。部署改变根和内核，
  core 集改变 core 组件；两者都不触碰 DATA。
- **把引擎的存储放在你自己的磁盘上。**把一块磁盘恰好挂载在引擎根，`/mica/containers/storage`（podman）或
  `/mica/containers/docker`（docker），让镜像和容器不占 DATA。引擎随后要求这个挂载，没有它就不启动，所以
  磁盘缺失时是引擎启动失败，而不是写满 DATA（[存储](../operate/storage.md)第 3 节）。
- **重置会移除什么**由重置层级决定（[恢复](../reference/recovery.md)）：配置重置丢弃 `container` 设置，
  应用数据重置丢弃项目、它们的卷和 DATA 上的容器存储，但不动挂载在引擎根上的磁盘里的任何东西。在 docker 上，
  dockerd 运行时应用数据重置会被拒绝：先关闭容器。
- **镜像不做签名验证**：保护一次拉取的是镜像仓库的 TLS 和引用中的摘要。每个镜像都按摘要固定。

> status: shipped — evidence: `docs/reference/recovery.md`, `docs/reference/storage.md`, `mica-podman:README.md`, `mica-docker:README.md`

## 7. 局限

- 没有跨设备的编排，没有超出单台设备项目网络的服务发现，没有项目的滚动更新。
- 在 podman 上，特权容器，或项目网络、主机网络、none 之外的网络，都不是项目能够表达的。

> status: unsupported
