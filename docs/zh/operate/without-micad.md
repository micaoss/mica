# 在没有 micad 的设备上运行

没有 `micad` 特性的产品，或 micad 已不在的设备，仍然能启动、加入网络、接受密钥 SSH 登录、更新和重置：Base 的
每个服务都在启动时从 DATA 上它自己的文件启动（[架构](../architecture.md)第 7 节）。没有 micad 时，没有东西替你
写这些文件。本页说明如何在设备上以 root 手写它们。每个文件都是其服务读取的格式，与 micad 写的格式相同，所以
之后加入 micad 的设备仍能继续工作；那时 micad 接管这些文件，并按它的设置重写它们。也没有 `mica` 命令：它属于
micad（[`mica` 命令](mica.md)）。

> status: shipped — evidence: `mica-system-base:docs/floor-and-options.md`, `mica-system-base:payload/usr/lib/mica/mica-units`

---

## 1. 进入设备

没有 micad 就没有控制台登录：没有账户有密码，临时 root 密码属于 micad。进入的途径是密钥 SSH。

- 产品设置 `SSH=on`（`mica-build:boards/products.md`），所以 SSH 从首次启动起运行。
- 密钥来自配置介质：引导介质 ESP 根目录或可移动介质根目录上的 `mica-authorized-keys` 文件，每行一个 OpenSSH
  公钥。启动时 `mica-provisioning-import` 把它们加入 root 和 `mica` 的 `~/.ssh/authorized_keys`；已有的密钥
  保留。在设备上，`/usr/lib/mica/mica-add-keys <file>` 做同样的事。

> status: shipped — evidence: `mica-system-base:payload/usr/lib/mica/mica-provisioning-import`, `mica-system-base:payload/usr/lib/mica/mica-add-keys`

## 2. 打开一个服务：`mica-units`

镜像启用 Base 自己的服务。特性服务，即 Wi-Fi 客户端、MQTT 代理和桥接、容器引擎，通过列入
`/var/lib/mica/units/enabled` 来打开，Base 在每次启动时启动列表中的服务：

```sh
/usr/lib/mica/mica-units enable mica-containerd    # 列入并立即启动
/usr/lib/mica/mica-units disable mica-containerd   # 移出列表并停止
/usr/lib/mica/mica-units list                      # 列出了什么
```

服务名带不带 `.service` 都可以。先写服务的文件（见下面各节），再启用它。下面的示例把命令简写为 `mica-units`。

> status: shipped — evidence: `mica-system-base:payload/usr/lib/mica/mica-units`, `mica-system-base:tests/payload/units.test.ts`

## 3. 网络

在有文件另作规定之前，有线网络使用 DHCP。

- **systemd**：networkd 的 `.network` 文件放在 `/var/lib/mica/network/networkd/`（`/run/systemd/network` 链接
  到那里），然后 `systemctl restart systemd-networkd`。静态地址：

  ```ini
  # /var/lib/mica/network/networkd/10-eth0.network
  [Match]
  Name=eth0

  [Network]
  Address=192.168.1.20/24
  Gateway=192.168.1.1
  DNS=192.168.1.1
  ```

- **OpenRC**：busybox ifupdown 的 `/var/lib/mica/network/interfaces`（`/etc/network/interfaces` 链接到那里），
  然后 `rc-service mica-network restart`。在这个文件存在之前，每个 `eth*` 都使用 DHCP。

  ```
  auto eth0
  iface eth0 inet static
      address 192.168.1.20
      netmask 255.255.255.0
      gateway 192.168.1.1
  ```

  整台设备的 DNS 服务器写在 `/var/lib/mica/dns/resolv.global` 中，格式与 `resolv.conf` 相同
  （`nameserver 192.168.1.1`），它随后就是 `/etc/resolv.conf` 的全部内容。

主机名是 `/etc/hostname`，保存在 DATA 上；新的主机名在下次启动时生效。

> status: shipped — evidence: `mica-system-base:debs/mica-systemd/payload/usr/lib/tmpfiles.d/mica-network.conf`, `mica-system-base:debs/mica-openrc/payload/etc/init.d/mica-network`

## 4. Wi-Fi 客户端

为接口写一份 wpa_supplicant 配置，然后启用服务。

- **systemd**：`/etc/wpa_supplicant/wpa_supplicant-wlan0.conf`（保存在 DATA 上），一个在该链路上使用 DHCP 的
  networkd 文件，以及模板实例：

  ```sh
  cat >/etc/wpa_supplicant/wpa_supplicant-wlan0.conf <<'EOF'
  ctrl_interface=/run/wpa_supplicant
  network={
      ssid="site"
      psk="passphrase"
  }
  EOF
  printf '[Match]\nName=wlan0\n\n[Network]\nDHCP=yes\n\n[DHCPv4]\nRouteMetric=600\n' \
      >/var/lib/mica/network/networkd/90-wifi-client-wlan0.network
  systemctl restart systemd-networkd
  mica-units enable wpa_supplicant@wlan0
  ```

- **OpenRC**：配置放在 `/var/lib/mica/wpa_supplicant/`，服务的参数放在 `/var/lib/mica/wifi/client.env`，然后
  启用 `mica-wifi-client`：

  ```sh
  mkdir -p /var/lib/mica/wpa_supplicant /var/lib/mica/wifi
  # 与上面相同的 wpa_supplicant-wlan0.conf，放在 /var/lib/mica/wpa_supplicant/
  printf 'interface=wlan0\nconfig=/var/lib/mica/wpa_supplicant/wpa_supplicant-wlan0.conf\nmetric=600\n' \
      >/var/lib/mica/wifi/client.env
  mica-units enable mica-wifi-client
  ```

度量值 600 让有线连接（如果有）保持为默认路由。接入点没有手工做法：它的地址、DHCP 服务器和密钥都属于 micad。

> status: shipped — evidence: `mica-core:crates/micad/src/reconciler/wifi_client.rs`, `mica-system-base:debs/mica-wifi/mica-wifi-client.openrc`

## 5. MQTT

两个文件都放在 `/var/lib/mica/mqtt/`，格式见 `mica-pkgs:docs/mica-pkgs.md` 第 3 节，然后启用两个服务：

```sh
mkdir -p /var/lib/mica/mqtt
printf 'listen_address = "127.0.0.1"\nlisten_port = 1883\nauth_enabled = false\n' \
    >/var/lib/mica/mqtt/broker.toml
echo 'MICA_MQTT_DEVICE_ID=device-1' >/var/lib/mica/mqtt/mqttd-device.env
mica-units enable mica-mqtt-broker
mica-units enable mica-mqttd
```

> status: shipped — evidence: `mica-pkgs:docs/mica-pkgs.md`, `mica-pkgs:crates/mica-mqtt-broker/dist/mica-mqtt-broker.service`, `mica-pkgs:crates/mica-mqttd/dist/mica-mqttd.service`

## 6. 容器

`mica-units enable mica-containerd`（docker 产品上是 `docker`），然后通过引擎自己的客户端管理项目：
[容器](../integrate/containers.md)第 5 节。

> status: shipped — evidence: `mica-podman:README.md`, `mica-system-base:payload/usr/lib/mica/mica-units`

## 7. 时间、SSH、更新和重置

- **时间**：NTP 服务器，在 systemd 上写 `/var/lib/mica/time/timesyncd.conf`（`[Time]` 和 `NTP=<servers>`）并
  `systemctl restart systemd-timesyncd`；在 OpenRC 上写 `/var/lib/mica/time/ntpd.conf`
  （`ntp_servers="<servers>"`）并 `rc-service mica-ntpd restart`。没有这个文件时使用 Debian 的池。
- **SSH**：`/var/lib/mica/ssh/sshd.env`，起初是镜像中 `/usr/lib/mica/ssh/sshd.env` 的副本（`SSH_ENABLED`、
  `SSH_LISTEN`、`SSH_PASSWORD`、`SSH_ROOT_LOGIN`），然后重启 `mica-sshd`。在 SSH 会话中关闭 SSH 会把你锁在外面，
  直到有下一种进入途径（第 1 节）。
- **更新**：`mica-deploy update` 手动检查并安装，`mica-deploy update --archive <file>` 从更新归档安装；
  `/mica/config/updates.json` 中写 `{"policy": "auto"}` 时，Base 在两种 init 上都每天检查一次，安装但不重启。
  同一文件中的 `"source": {"url": "..."}` 指定另一个更新根。
- **重置**：`mica-deploy factory-reset --reboot`。

> status: shipped — evidence: `mica-core:crates/mica-deploy/src/defaults.rs`, `mica-system-base:debs/mica-systemd/payload/etc/systemd/system/mica-update.timer`, `mica-system-base:debs/mica-openrc/payload/etc/init.d/mica-update`

## 8. 没有手工途径的东西

接入点、蓝牙配对、设备码和认领、临时 root 密码、mDNS 和 SSDP 通告，以及控制台和 API，都只属于 micad。

> status: unsupported
