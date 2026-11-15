# The Mica app for Android

The Mica app sets up and manages Mica OS devices from an Android phone. It
does two things: it gives a device in its Bluetooth setup window the network
to join, without joining the device's access point, and it manages a device
it can reach over the network, as the console does for a few common tasks.
It needs no account and talks only to the device.

> status: shipped — evidence: `mica-app:lib/main.dart`, `mica-app:.github/workflows/release.yml`

## 1. Getting it

The app is released as an APK on
[micaoss/mica-app](https://github.com/micaoss/mica-app/releases), one file,
`mica-app.apk`, with its `SHA256SUMS`; the release's tag is the app's version
(the current one is `20261114-0429`). It is not in an app store. Download the
APK on the phone, check its digest if you can, and allow the install from your
browser or file manager when Android asks.

At start the app reads the newest release and, when there is a later one,
offers to download its APK, to install over the current one. The app speaks
English and Chinese.

There is no iOS release.

> status: shipped — evidence: `mica-app:lib/update.dart`, `mica-app:.github/workflows/release.yml`

## 2. Bluetooth setup

For a product with WiFi and Bluetooth (`cx3576.full`, `s905x5m.sd-full`,
`s905x5m.emmc-full`), on a device whose setup window is open: for 10 minutes
after every boot, or after an administrator opens it in the console
([first run](first-run.md) section 5 lists the windows).

1. **Bluetooth setup** lists the devices in setup by hostname
   (`mica-xxxxxxxx`). No Bluetooth pairing is needed. Only one phone can be
   connected to a device at a time.
2. A claimed device asks for the administrator password, or, in a window an
   administrator opened, the 8-digit code the console shows. Wrong answers
   count; too many lock the device for a while. An unclaimed device asks
   nothing.
3. Choose **Wi-Fi** (pick a network from the device's scan, or type its name;
   then its password) or **the wired port** (DHCP, or a static address with
   an optional gateway and DNS servers). On a device whose radio is running
   the access point, joining a network turns the access point off.
4. **Finish setup.** The app shows the device's address and a link to its
   console. On an unclaimed device whose access point is still on, it shows
   the access point's name and key, with a QR code, and can ask the phone to
   join it.

Bluetooth sets the network and nothing else: no password, no hostname, no
claim. An unclaimed device is claimed afterwards in its console or in the
app's network management (section 3). If the connection drops before
**Finish** on an unclaimed device, the device undoes that session's changes.

A claimed device whose administrator has not signed in to the console since
the device gained Bluetooth setup cannot check the password yet: the app says
to sign in to the console once.

> status: shipped — evidence: `mica-app:lib/setup_page.dart`, `mica-app:docs/protocol.md`, `mica-core:docs/ble-provisioning.md`

## 3. Managing over the network

**Manage over the network** works with a device the phone can reach: on the
same network, on the device's access point, or on a cable to the phone.

- **Finding it.** The app lists the devices announcing `_mica._tcp` over mDNS
  on the phone's network, and the devices you signed in to before. A device
  with announcements off, or one on a cable to the phone, is reached by typing
  its address: an IP address, `<hostname>.local`, or the `Console` line of the
  device's login prompt.
- **First setup.** On an unclaimed device the app sets the administrator
  password, which then signs in to the app and to the console; on a product
  that requires it, it also asks for the device code from the label.
- **Signing in** with the administrator password. The app lists the devices
  you signed in to before, until you forget one.
- **Status**: whether micad answers, the software, board, deployment and
  kernel, uptime, whether the clock is synchronized, and the features.
- **Network**: the saved Wi-Fi networks (add, remove) and the wired ports
  (DHCP or a static address).
- **System settings**: change the administrator password; switch the SSH
  server and add or remove its authorized keys.

On HTTPS the app remembers the certificate the device first presented and
warns when another one answers, showing its fingerprint; trust the new one
only when you know the device was reset or its certificate replaced. A device
whose web mode is `local` cannot be managed over the network.

> status: shipped — evidence: `mica-app:lib/console/discovery.dart`, `mica-app:lib/manage_page.dart`, `mica-app:lib/manage_settings.dart`

## 4. Limits

- **Not run on hardware.** The protocol, the device side and the clients are
  tested against each other's reference; no Bluetooth setup on a physical
  board is on record yet ([first run](first-run.md) section 5).
- Android only. A phone without Bluetooth Low Energy sets a device up through
  its access point instead.
- The app covers a small part of the console. Everything else (updates,
  containers, services, storage, access, logs) is in the console, the API or
  [`mica`](../operate/mica.md).

> status: unsupported
