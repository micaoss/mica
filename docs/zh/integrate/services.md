# 你自己的服务

如何把自己的程序作为服务运行在设备上：把它放到 DATA 上，给它一个账户，用 `mica unit` 安装它的 systemd unit 或
OpenRC 脚本，启用它，读它的日志，修改和删除它；然后是定时器、挂载，以及什么在哪种重置后保留。契约见
`mica-core:docs/mica-core.md` 第 3.10 节；为什么这不是在产品中交付应用的方式，见[原生应用](native-applications.md)
第 10 节。

## 开始之前

- **设备上的 root**（SSH，见 [SSH](../operate/ssh.md)，或本地控制台），或在工作站上使用带令牌的 API：

  ```sh
  DEV=http://mica-a4e2e69e.local:8080
  AUTH="Authorization: Bearer mica_<id>_<secret>"   # 来自：mica tokens create laptop
  ```

- **产品运行哪种 init。**systemd 产品接受 unit 文件；`mini-x64.basic` 和 `qemu-armhf.basic` 运行 OpenRC，接受
  `openrc-run` 脚本。为另一种 init 写的服务会被拒绝。
- **东西放在哪里。**根文件系统是只读的，所以你的程序放在 DATA 上的 `/srv`（属于你：没有哪个重置层级清除它，只有
  出厂重置会）。`mica unit` 把 unit 或脚本本身保存在 DATA 上，`/usr/local/lib/systemd/system`（systemd）或
  `/usr/local/etc`（OpenRC）。
- **限制。**最多 32 个服务，每个最多 64 KiB，OpenRC 的 conf 最多 16 KiB，合计 256 KiB。根文件系统已经带有的名称会
  被拒绝，所以你的服务永远不会替换 Mica OS 自己的服务。

> status: shipped — evidence: `mica-core:docs/mica-core.md`, `mica-core:crates/micad-settings/src/model/services.rs`

## 1. 程序和它的账户

一个每 30 秒记录一次运行时长的小例子：

```sh
mkdir -p /srv/hello
cat > /srv/hello/hello.sh <<'EOF'
#!/bin/sh
while true; do
    echo "up $(cut -d' ' -f1 /proc/uptime) s"
    sleep 30
done
EOF
chmod 755 /srv/hello/hello.sh
```

给它一个自己的、不能登录的账户（uid 和 gid 在 30000 到 39999 之间）：

```sh
/usr/lib/mica/mica-accounts add hello 30001
/usr/lib/mica/mica-accounts list
# hello	30001	30001
```

账户保存在 DATA 上，重启和更新后仍在。micad 既不添加也不删除账户；由你用 `mica-accounts add` 和
`mica-accounts remove` 管理。

> status: shipped — evidence: `mica-system-base:docs/floor-and-options.md`

## 2. 在 systemd 上

```ini
# /root/hello.service
[Unit]
Description=Hello: logs the uptime every 30 s
After=network.target

[Service]
User=hello
ExecStart=/srv/hello/hello.sh
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```sh
mica unit install /root/hello.service --enable
# hello.service installed, enabled
mica unit list
# NAME           ENABLED  ACTIVE  MANAGED
# hello.service  yes      active  micad
mica unit logs hello --tail 3
```

启用会立即启动它，并在每次启动时启动。要启用的 unit 需要在 `[Install]` 中有 `WantedBy=`、`RequiredBy=` 或
`Alias=`。没有类型的名称就是 `.service`，所以 `hello` 和 `hello.service` 是同一个。

> status: shipped — evidence: `mica-core:crates/micad/src/unit_cli.rs`

## 3. 在 OpenRC 上

脚本保存为 `/root/hello`：

```sh
#!/sbin/openrc-run
description="Hello: logs the uptime every 30 s"
command=/srv/hello/hello.sh
command_user=hello
supervisor=supervise-daemon
output_logger="busybox logger -t hello"

depend() {
    need net
}
```

第一行必须是 `#!/sbin/openrc-run`。脚本的输出以它的名称为标记进入系统日志，`mica unit logs` 就从那里读取。脚本的
设置可以放在一个 conf 文件中，用 `--conf` 给出：

```sh
mica unit install /root/hello --enable
# hello installed, enabled
mica unit list
mica unit logs hello
```

`mica-local` 在启动时启动已启用的脚本。

> status: shipped — evidence: `mica-core:crates/micad/src/unit_cli.rs`, `mica-core:crates/micad-settings/src/model/services.rs`

## 4. 通过 API 做同样的事

在工作站上，unit 文件就在手边（用 `jq` 构造请求体）：

```sh
jq -n --rawfile text hello.service '{kind: "systemd", text: $text, enabled: true}' |
  curl -s -H "$AUTH" -X PUT $DEV/api/v1/units/hello.service \
    -H 'content-type: application/json' -d @-
# {"taskId":"<id>"}
curl -s -H "$AUTH" $DEV/api/v1/units
curl -s -H "$AUTH" -X POST $DEV/api/v1/units/hello.service/restart     # 204
curl -s -H "$AUTH" $DEV/api/v1/units/hello.service/logs
```

脚本的 `kind` 是 `openrc`，还可以带 `conf`。控制台的服务页显示每个服务及其日志，以及启动、停止和重启按钮。服务
账户仍需在设备上创建（第 1 节）。

> status: shipped — evidence: `mica-core:docs/mica-core.md`, `mica-core:crates/mica-apid/openapi.json`

## 5. 检查是否生效

- `mica unit list` 显示它为 `yes` / `active` / `micad`。
- `mica unit logs hello` 每 30 秒出现一行。
- `mica reboot` 之后，无需任何操作它就又在运行。

## 6. 修改、重启、停止、删除

| 目的 | 做法 |
|---|---|
| 修改 | 编辑文件，再 `mica unit install` 一次：文本变化的已启用服务会被重启，已启用的仍保持启用 |
| 立即重启、停止、启动 | `mica unit restart hello`（还有 `stop`、`start`）；持续到下次启动或下次改变启用状态 |
| 保留但不在启动时运行 | `mica unit disable hello`（会停止它） |
| 删除 | `mica unit remove hello`（停止它，删除它及其链接） |
| 删除它的账户 | `/usr/lib/mica/mica-accounts remove hello` |

`/srv/hello` 由你自己删除。

> status: shipped — evidence: `mica-core:crates/micad/src/unit_cli.rs`, `mica-core:docs/mica-core.md`

## 7. 定时器（systemd）

按计划运行的任务是一个没有 `[Install]` 的 `.service`，加上一个启用的 `.timer`：

```ini
# /root/hello-report.service
[Unit]
Description=Hello report
[Service]
Type=oneshot
User=hello
ExecStart=/bin/sh -c 'echo "report at $(date -u)"'
```

```ini
# /root/hello-report.timer
[Unit]
Description=Hello report, hourly
[Timer]
OnCalendar=hourly
Persistent=true
[Install]
WantedBy=timers.target
```

```sh
mica unit install /root/hello-report.service
mica unit install /root/hello-report.timer --enable
mica unit list
systemctl list-timers hello-report.timer
```

协调从不停止由定时器运行的服务。OpenRC 没有定时器 unit：在 OpenRC 上，写一个在两次运行之间休眠的常驻脚本，如第 3
节那样。

> status: shipped — evidence: `mica-core:docs/mica-core.md`

## 8. 挂载

你自己的磁盘用同样的方式挂载：在 systemd 上是用 `mica unit` 安装并启用的 `.mount`、`.automount` 或 `.swap` unit；
在 OpenRC 上是 `/usr/local/etc/fstab` 中的一行，用 `mica unit fstab check` 检查。哪些位置可以挂载，以及各自的完整
示例，见[存储](../operate/storage.md)第 3 节。需要该磁盘的服务要声明它：systemd 上用 `RequiresMountsFor=/srv`，
OpenRC 上用 `need localmount`，并在自己的检查中确认路径。

> status: shipped — evidence: `mica-core:crates/micad/src/unit_cli.rs`, `mica-system-base:docs/floor-and-options.md`

## 9. 什么在什么之后保留

| 事件 | 你的服务 | 它们的账户 | `/srv` |
|---|---|---|---|
| 重启 | 保留，已启用的会启动 | 保留 | 保留 |
| 更新、回滚 | 保留，且**不**随系统回滚 | 保留 | 保留 |
| 配置重置 | 从 core 0.0.9 起保留；0.0.8 及更早的版本会把声明随其他设置一起清除，micad 随后停止并删除它安装的服务 | 保留 | 保留 |
| 应用数据重置 | 删除，其目录被清空 | 删除 | 保留 |
| 出厂重置 | 删除 | 删除 | 删除（DATA 重新创建），挂载在那里的你自己的磁盘除外 |

用 `/usr/lib/mica/mica-unit` 手工放置、而非通过 `mica unit` 安装的服务不归 micad 管：micad 不碰它，只有应用数据重置
和出厂重置会清除它。重置层级见[恢复](../operate/recovery.md)。

> status: shipped — evidence: `mica-core:crates/micad/src/reset.rs`, `mica-core:docs/mica-core.md`, `docs/reference/recovery.md`

## 10. 可能出现的问题

| 你看到 | 原因 | 解决 |
|---|---|---|
| `"hello.service" has no WantedBy=, RequiredBy= or Alias= in [Install]; nothing would start it` | 启用了没有 `[Install]` 的 unit | 加上 `WantedBy=multi-user.target`，或不启用它（定时器的服务） |
| `service "hello" is for systemd; this device runs openrc` | 在 OpenRC 设备上用了 unit 文件，或反过来 | 按设备的 init 编写 |
| `micad.service is shipped by the root; a user service cannot replace it` | 名称或某个 `Alias=` 是 Mica OS 自己的 | 换个名称 |
| `service "hello" is not an openrc-run script: its first line is not #!/sbin/openrc-run` | shebang 不对 | 把它放在第一行 |
| `"x" is not a unit file name: ...` | 没有已知的 unit 类型，或含有 a-z、A-Z、0-9、`:`、`_`、`.`、`-` 以外的字符 | 例如 `x.service` |
| `33 services are declared; a device declares at most 32` | 超出上限 | 删掉一个 |
| `mica unit: no service named hello.service is declared here; ...` | 对没有用 `mica unit` 安装的服务执行 `enable` | 先 `mica unit install` |
| `mica unit: stored, but the reconcile failed: ...` | init 拒绝了它（unit 有误、程序缺失） | 读 `mica unit logs`，修正后再安装 |
| 服务运行但报 `Permission denied` | 账户无法读取或运行程序 | `chmod 755`，并确认 `User=` / `command_user` 中的账户存在 |
| OpenRC 上 `mica unit logs` 为空 | 脚本的输出没有带着它的名称进入 syslog | `output_logger="busybox logger -t <name>"` |

> status: shipped — evidence: `mica-core:crates/micad-settings/src/model/services.rs`, `mica-core:crates/micad/src/user_units.rs`, `mica-core:crates/micad/src/unit_cli.rs`
