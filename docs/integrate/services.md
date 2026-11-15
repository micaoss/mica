# Your own services

How to run a program of your own as a service on a device: put it on DATA,
give it an account, install its systemd unit or OpenRC script with
`mica unit`, enable it, read its log, change it and remove it; then timers,
mounts, and what survives which reset. The contract is
`mica-core:docs/mica-core.md` section 3.10; why this is not the way to ship
an application inside a product is
[native applications](native-applications.md) section 10.

## Before you start

- **Root on the device** (SSH, see [SSH](../operate/ssh.md), or the local
  console), or the API with a token from a workstation:

  ```sh
  DEV=http://mica-a4e2e69e.local:8080
  AUTH="Authorization: Bearer mica_<id>_<secret>"   # from: mica tokens create laptop
  ```

- **Which init the product runs.** systemd products take unit files;
  `mini-x64.basic` and `qemu-armhf.basic` run OpenRC and take `openrc-run`
  scripts. A service written for the other init is refused.
- **Where things go.** The root is read-only, so your program lives on DATA,
  in `/srv` (yours: no reset tier clears it, only a factory reset). `mica unit` keeps the unit or script
  itself on DATA, in `/usr/local/lib/systemd/system` (systemd) or
  `/usr/local/etc` (OpenRC).
- **Limits.** At most 32 services, each at most 64 KiB, an OpenRC conf at most
  16 KiB, 256 KiB in all. A name the root already ships is refused, so a
  service of yours never replaces one of Mica OS's.

> status: shipped — evidence: `mica-core:docs/mica-core.md`, `mica-core:crates/micad-settings/src/model/services.rs`

## 1. The program and its account

A small example that logs the uptime every 30 seconds:

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

Give it an account of its own, with no login (uid and gid 30000 to 39999):

```sh
/usr/lib/mica/mica-accounts add hello 30001
/usr/lib/mica/mica-accounts list
# hello	30001	30001
```

The account is kept on DATA and survives reboots and updates. micad neither
adds nor removes accounts; you do, with `mica-accounts add` and
`mica-accounts remove`.

> status: shipped — evidence: `mica-system-base:docs/floor-and-options.md`

## 2. On systemd

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

Enabling starts it now and at every boot. A unit you enable needs
`WantedBy=`, `RequiredBy=` or `Alias=` in `[Install]`. A name without a type
is a `.service`, so `hello` and `hello.service` are the same.

> status: shipped — evidence: `mica-core:crates/micad/src/unit_cli.rs`

## 3. On OpenRC

The script, saved as `/root/hello`:

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

The first line must be `#!/sbin/openrc-run`. The script's output goes to the
system log tagged with its name, which is where `mica unit logs` reads it.
Settings for the script can go in a conf file, given with `--conf`:

```sh
mica unit install /root/hello --enable
# hello installed, enabled
mica unit list
mica unit logs hello
```

`mica-local` starts the enabled scripts at boot.

> status: shipped — evidence: `mica-core:crates/micad/src/unit_cli.rs`, `mica-core:crates/micad-settings/src/model/services.rs`

## 4. The same through the API

From a workstation, with the unit file beside you (`jq` builds the body):

```sh
jq -n --rawfile text hello.service '{kind: "systemd", text: $text, enabled: true}' |
  curl -s -H "$AUTH" -X PUT $DEV/api/v1/units/hello.service \
    -H 'content-type: application/json' -d @-
# {"taskId":"<id>"}
curl -s -H "$AUTH" $DEV/api/v1/units
curl -s -H "$AUTH" -X POST $DEV/api/v1/units/hello.service/restart     # 204
curl -s -H "$AUTH" $DEV/api/v1/units/hello.service/logs
```

`kind` is `openrc` for a script, which may carry `conf` too. The console's
Services page shows each service with its log and its start, stop and restart
buttons. The service account still has to be made on the device (section 1).

> status: shipped — evidence: `mica-core:docs/mica-core.md`, `mica-core:crates/mica-apid/openapi.json`

## 5. Check it worked

- `mica unit list` shows it `yes` / `active` / `micad`.
- `mica unit logs hello` shows a line every 30 seconds.
- After `mica reboot`, it is running again without anything done.

## 6. Change, restart, stop, remove

| To | Do |
|---|---|
| Change it | edit the file, `mica unit install` it again: an enabled service whose text changed is restarted, and an enabled one stays enabled |
| Restart, stop, start now | `mica unit restart hello` (also `stop`, `start`); lasts until the next boot or the next change of `enable` |
| Keep it but not at boot | `mica unit disable hello` (stops it) |
| Remove it | `mica unit remove hello` (stops it, deletes it and its links) |
| Remove its account | `/usr/lib/mica/mica-accounts remove hello` |

`/srv/hello` is yours to delete.

> status: shipped — evidence: `mica-core:crates/micad/src/unit_cli.rs`, `mica-core:docs/mica-core.md`

## 7. Timers (systemd)

A job that runs on a schedule is a `.service` with no `[Install]`, and a
`.timer` that is enabled:

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

A reconcile never stops a service a timer runs. OpenRC has no timer units:
on OpenRC, write a long-running script that sleeps between runs, as in
section 3.

> status: shipped — evidence: `mica-core:docs/mica-core.md`

## 8. Mounts

Your own disks are mounted the same way: on systemd a `.mount`, `.automount`
or `.swap` unit installed and enabled with `mica unit`; on OpenRC a line in
`/usr/local/etc/fstab`, checked with `mica unit fstab check`. Which places
may be mounted, and a worked example of each, are in
[storage](../operate/storage.md) section 3. A service that needs the disk
names it: `RequiresMountsFor=/srv` on systemd, `need localmount` and the
path in its own check on OpenRC.

> status: shipped — evidence: `mica-core:crates/micad/src/unit_cli.rs`, `mica-system-base:docs/floor-and-options.md`

## 9. What survives what

| Event | Your services | Their accounts | `/srv` |
|---|---|---|---|
| Reboot | kept, enabled ones started | kept | kept |
| Update, rollback | kept, and **not** rolled back with the system | kept | kept |
| Configuration reset | on a released device the declarations go with every other setting, so at the next apply micad stops and removes the services it installed; ones installed by hand stay | kept | kept |
| Application-data reset | removed, and their directories cleared | removed | kept |
| Factory reset | removed | removed | removed (DATA is made again), except a disk you mounted there |

A service put in place by hand with `/usr/lib/mica/mica-unit` rather than
`mica unit` is not micad's: micad leaves it alone, and only the
application-data and factory resets clear it. The tiers are in
[recovery](../operate/recovery.md).

> status: shipped — evidence: `mica-core:crates/micad/src/reset.rs`, `mica-core:docs/mica-core.md`, `docs/reference/recovery.md`

## 10. What can go wrong

| You see | Why | Fix |
|---|---|---|
| `"hello.service" has no WantedBy=, RequiredBy= or Alias= in [Install]; nothing would start it` | enabled without `[Install]` | add `WantedBy=multi-user.target`, or do not enable it (a timer's service) |
| `service "hello" is for systemd; this device runs openrc` | a unit file on an OpenRC device, or the other way round | write it for the device's init |
| `micad.service is shipped by the root; a user service cannot replace it` | the name, or an `Alias=`, is one of Mica OS's | another name |
| `service "hello" is not an openrc-run script: its first line is not #!/sbin/openrc-run` | the shebang | make it the first line |
| `"x" is not a unit file name: ...` | no known unit type, or a character outside a-z, A-Z, 0-9, `:`, `_`, `.`, `-` | e.g. `x.service` |
| `33 services are declared; a device declares at most 32` | the limit | remove one |
| `mica unit: no service named hello.service is declared here; ...` | `enable` of a service not installed with `mica unit` | `mica unit install` it |
| `mica unit: stored, but the reconcile failed: ...` | the init refused it (a bad unit, a missing program) | read `mica unit logs`, fix, install again |
| The service runs but fails with `Permission denied` | the account cannot read or run the program | `chmod 755` it, check the account in `User=` / `command_user` exists |
| `mica unit logs` is empty on OpenRC | the script's output does not reach syslog with its name | `output_logger="busybox logger -t <name>"` |

> status: shipped — evidence: `mica-core:crates/micad-settings/src/model/services.rs`, `mica-core:crates/micad/src/user_units.rs`, `mica-core:crates/micad/src/unit_cli.rs`
