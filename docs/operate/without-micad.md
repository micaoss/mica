# Running a device without micad

A product without the `micad` feature, or a device whose micad is gone, still
boots, joins its network, takes SSH logins by key, updates and resets: every
service of the base starts at boot from its own file on DATA
([architecture](../architecture.md) section 1.1). Without micad nothing writes
those files for you. This page is how to write them by hand, as root on the
device. Each file is in the format its service reads, the same one micad
writes, so a device that gains micad later keeps working; micad then owns the
files and rewrites them from its settings.

> status: shipped — evidence: `mica-system-base:docs/floor-and-options.md`, `mica-system-base:payload/usr/lib/mica/mica-units`

---

## 1. Getting in

There is no console login without micad: no account has a password, and the
transient root password is micad's. The way in is SSH by key.

- The product sets `SSH=on` (`mica-build:boards/products.md`), so SSH runs from
  the first boot.
- The keys come from a provisioning medium: a file `mica-authorized-keys` at the
  root of the boot medium's ESP or of a removable medium, one OpenSSH public key
  a line. At boot `mica-provisioning-import` adds them to root's and `mica`'s
  `~/.ssh/authorized_keys`; keys already there stay. On the device,
  `/usr/lib/mica/mica-add-keys <file>` does the same.

> status: shipped — evidence: `mica-system-base:payload/usr/lib/mica/mica-provisioning-import`, `mica-system-base:payload/usr/lib/mica/mica-add-keys`

## 2. Switching a service on: `mica-units`

The image enables the base's own services. The feature services — the Wi-Fi
station, the MQTT broker and bridge, the container engine — are switched on by
listing them in `/var/lib/mica/units/enabled`, which the base starts at every
boot:

```sh
/usr/lib/mica/mica-units enable mica-containerd    # list it and start it now
/usr/lib/mica/mica-units disable mica-containerd   # take it off the list and stop it
/usr/lib/mica/mica-units list                      # what is listed
```

It takes a service with or without `.service`. Write the service's file first
(the sections below), then enable it. The examples below shorten the command
to `mica-units`.

> status: shipped — evidence: `mica-system-base:payload/usr/lib/mica/mica-units`, `mica-system-base:tests/payload/units.test.ts`

## 3. Network

The wired network is DHCP until a file says otherwise.

- **systemd**: networkd `.network` files in `/var/lib/mica/network/networkd/`
  (`/run/systemd/network` links there), then `systemctl restart
  systemd-networkd`. A static address:

  ```ini
  # /var/lib/mica/network/networkd/10-eth0.network
  [Match]
  Name=eth0

  [Network]
  Address=192.168.1.20/24
  Gateway=192.168.1.1
  DNS=192.168.1.1
  ```

- **OpenRC**: busybox ifupdown's `/var/lib/mica/network/interfaces`
  (`/etc/network/interfaces` links there), then `rc-service mica-network
  restart`. Until the file exists every `eth*` takes DHCP.

  ```
  auto eth0
  iface eth0 inet static
      address 192.168.1.20
      netmask 255.255.255.0
      gateway 192.168.1.1
  ```

  DNS servers for the whole device go in `/var/lib/mica/dns/resolv.global`,
  in `resolv.conf`'s format (`nameserver 192.168.1.1`), which then is the
  whole of `/etc/resolv.conf`.

The hostname is `/etc/hostname`, kept on DATA; a new one takes effect at the
next boot.

> status: shipped — evidence: `mica-system-base:payload/usr/lib/tmpfiles.d/mica-network.conf`, `mica-system-base:debs/mica-openrc/payload/etc/init.d/mica-network`

## 4. Wi-Fi station

A wpa_supplicant configuration for the interface, then the service.

- **systemd**: `/etc/wpa_supplicant/wpa_supplicant-wlan0.conf` (kept on DATA),
  a networkd file that takes DHCP on the link, and the template instance:

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

- **OpenRC**: the configuration in `/var/lib/mica/wpa_supplicant/`, the
  service's parameters in `/var/lib/mica/wifi/client.env`, and `mica-wifi-client`:

  ```sh
  mkdir -p /var/lib/mica/wpa_supplicant /var/lib/mica/wifi
  # the same wpa_supplicant-wlan0.conf as above, in /var/lib/mica/wpa_supplicant/
  printf 'interface=wlan0\nconfig=/var/lib/mica/wpa_supplicant/wpa_supplicant-wlan0.conf\nmetric=600\n' \
      >/var/lib/mica/wifi/client.env
  mica-units enable mica-wifi-client
  ```

The metric 600 keeps a cable, when there is one, the default route. The
access point has no manual recipe: its addressing, DHCP server and key are
micad's.

> status: shipped — evidence: `mica-core:crates/micad/src/reconciler/wifi_client.rs`, `mica-system-base:debs/mica-wifi/mica-wifi-client.openrc`

## 5. MQTT

Both files in `/var/lib/mica/mqtt/`, in the formats of
`mica-pkgs:docs/mica-pkgs.md` section 3, then both services:

```sh
mkdir -p /var/lib/mica/mqtt
printf 'listen_address = "127.0.0.1"\nlisten_port = 1883\nauth_enabled = false\n' \
    >/var/lib/mica/mqtt/broker.toml
echo 'MICA_MQTT_DEVICE_ID=device-1' >/var/lib/mica/mqtt/mqttd-device.env
mica-units enable mica-mqtt-broker
mica-units enable mica-mqttd
```

> status: shipped — evidence: `mica-pkgs:docs/mica-pkgs.md`, `mica-pkgs:crates/mica-mqtt-broker/dist/mica-mqtt-broker.service`, `mica-pkgs:crates/mica-mqttd/dist/mica-mqttd.service`

## 6. Containers

`mica-units enable mica-containerd` (`docker` on a docker product), then the
projects through the engine's own client: [containers](../integrate/containers.md)
section 5.

> status: shipped — evidence: `mica-podman:README.md`, `mica-system-base:payload/usr/lib/mica/mica-units`

## 7. Time, SSH, updates and reset

- **Time**: the NTP servers, on systemd `/var/lib/mica/time/timesyncd.conf`
  (`[Time]` and `NTP=<servers>`) and `systemctl restart systemd-timesyncd`; on
  OpenRC `/var/lib/mica/time/ntpd.conf` (`ntp_servers="<servers>"`) and
  `rc-service mica-ntpd restart`. Without the file, Debian's pool.
- **SSH**: `/var/lib/mica/ssh/sshd.env`, which starts as a copy of the image's
  `/usr/lib/mica/ssh/sshd.env` (`SSH_ENABLED`, `SSH_LISTEN`, `SSH_PASSWORD`,
  `SSH_ROOT_LOGIN`), then restart `mica-sshd`. Switching SSH off from an SSH
  session locks you out until the next way in (section 1).
- **Updates**: `mica-deploy update` checks and installs by hand,
  `mica-deploy update --archive <file>` from an update archive, and with
  `{"policy": "auto"}` in `/mica/config/updates.json` the base checks daily on
  either init and installs without rebooting. `"source": {"url": "..."}` in the
  same file names another update root.
- **Reset**: `mica-deploy factory-reset --reboot`.

> status: shipped — evidence: `mica-core:crates/mica-deploy/src/defaults.rs`, `mica-system-base:debs/mica-systemd/payload/etc/systemd/system/mica-update.timer`, `mica-system-base:debs/mica-openrc/payload/etc/init.d/mica-update`

## 8. What has no manual path

The access point, Bluetooth pairing, the device code and claiming, the
transient root password, mDNS and SSDP announcements, and the console and API
are micad's alone.

> status: unsupported
