# Drivers: owner certificates and driver extensions

How to add a kernel module of your own to a device: make a signing identity,
enrol its certificate on the device, build and sign the module against the
device's exact kernel with the kernel development kit (KDK), install it as a
driver extension, and keep it through kernel updates. The contract is
`mica-core:docs/mica-core.md` sections 6.2 and 6.3; the boot order that makes
it safe is [boot](../reference/boot.md) section 6.

## Before you start

- **A board whose kernel has the owner keyring:** `uefi-x64`, `uefi-arm64`,
  `mini-x64` and `qemu-armhf`. On `cx3576` and `s905x5m` every driver is built
  into the board kernel and there are no extensions
  ([kernel features](../reference/kernel-features.md)). On `uefi-x64` and
  `uefi-arm64`, check first whether the generic kernel's own driver modules
  already cover your hardware.
- **A claimed device** and its administrator password: every change asks for
  it again. The console's System page has a Drivers tab; the API routes are
  under `/api/v1/system/` ([HTTP API](../reference/http-api.md)).
  The examples use these variables on the workstation:

  ```sh
  DEV=http://mica-a4e2e69e.local:8080
  AUTH="Authorization: Bearer mica_<id>_<secret>"   # from: mica tokens create laptop
  read -rs ADMIN_PASSWORD                           # the administrator password
  ```

- **A workstation** with Docker, git and bun, and a checkout of
  [mica-build](https://github.com/micaoss/mica-build) at the tag of the
  release the device runs (for example `uefi-x64.full.20261115-1356`). Its
  `driver-key` and `driver-ext` tools need nothing else of Mica OS's.

> status: board-dependent — evidence: `mica-core:docs/mica-core.md`, `docs/reference/kernel-features.md`, `mica-build:src/drivers/driver-ext.ts`

## 1. Make your signing identity (once)

```sh
cd mica-build
bun src/cli.ts driver-key init --out ~/mica-owner --name "Example Ltd drivers"
ls ~/mica-owner
# owner-ca.cert.pem  owner-ca.key.pem  signer.cert.pem  signer.key.pem
```

| File | What it is |
|---|---|
| `owner-ca.cert.pem` | the certificate you enrol on devices (public) |
| `owner-ca.key.pem` | the CA key: keep it offline, it issues further signing keys |
| `signer.key.pem`, `signer.cert.pem` | the signing key and its certificate the build takes |

The default is RSA-3072; `--type ecdsa` makes P-256 keys. The keys are made
offline in a container; nothing of Mica OS's issues or holds them.

> status: shipped — evidence: `mica-build:src/drivers/driver-key.ts`

## 2. Enrol the certificate on the device

**In the console:** System, Drivers, add an owner certificate, upload
`owner-ca.cert.pem`, give the administrator password.

**With the API:**

```sh
curl -s -H "$AUTH" -X POST $DEV/api/v1/system/owner-certs \
  -H 'content-type: application/json' \
  -d "{\"password\": \"$ADMIN_PASSWORD\", \"certificate\": \"$(base64 -w0 ~/mica-owner/owner-ca.cert.pem)\"}"
# 202 {"taskId":"<id>"}
```

It applies from the next boot. Reboot (`mica reboot`). Where the product's
signed boot policy asks for it, the device's own console shows the new
certificate (SHA-256 and subject) at that boot, and it is trusted only if
someone presses Enter within 30 s.

**Check it worked:**

```sh
curl -s -H "$AUTH" $DEV/api/v1/system/owner-certs
# each certificate with its sha256, "state": "loaded", its subject, issuer and validity
```

`pending-next-boot` means it waits for a reboot, `pending-confirmation` for
the console, `rejected` carries a `reason`. A certificate is one X.509 v3
certificate with an RSA key of 2048 bits or more or an ECDSA key on P-256 or
P-384; a device takes at most 16. While the device's clock is synchronized,
the certificate must be within its validity period.

> status: shipped — evidence: `mica-core:docs/mica-core.md`, `mica-core:crates/mica-deploy/src/owner_certs.rs`

## 3. Get the KDK and the kernel id

The KDK is the build tree of the exact kernel a release runs. In the
mica-build checkout at the device's release tag:

```sh
make board-fetch BOARD=uefi-x64
ls _out/boards/uefi-x64/kernel/
# ... kdk.tar  kernel.release ...
cat _out/boards/uefi-x64/kernel/kernel.release
```

The fetch takes the kernel component that release published. Its
`kernel.release` must be what `uname -r` prints on the device.

The **kernel id** is the device's running kernel component, 64 hex digits:

```sh
curl -s -H "$AUTH" $DEV/api/v1/system/extensions | jq -r .kernel
```

> status: shipped — evidence: `mica-build:boards/uefi-x64/kernel/Dockerfile`, `mica-build:src/boards/board-pool.ts`, `mica-core:crates/micad/src/drivers.rs`

## 4. Build and sign the extension

A module source directory, built with the kernel's own toolchain image:

```sh
mkdir -p ~/hello-mod
cat > ~/hello-mod/hello.c <<'EOF'
#include <linux/module.h>
static int __init hello_init(void) { pr_info("hello: loaded\n"); return 0; }
static void __exit hello_exit(void) { pr_info("hello: unloaded\n"); }
module_init(hello_init);
module_exit(hello_exit);
MODULE_LICENSE("GPL");
EOF
echo 'obj-m := hello.o' > ~/hello-mod/Makefile
```

```sh
bun src/cli.ts driver-ext build \
  --kdk _out/boards/uefi-x64/kernel/kdk.tar \
  --src ~/hello-mod --load hello \
  --name hello --version 1.0.0 \
  --kernel-id <the 64-digit kernel id> \
  --key ~/mica-owner/signer.key.pem --cert ~/mica-owner/signer.cert.pem \
  --out ~/hello-ext --archive
# driver-ext: hello 1.0.0 for kernel <id> (<release>): 1 module(s), .../ext.img
```

The output directory holds `ext.img` (squashfs with dm-verity),
`ext.roothash`, `ext.roothash.p7s` (the signature the kernel checks),
`ext.json` (the descriptor) and, with `--archive`, `ext.micaupd`, the one file
a device takes.

- `--modules DIR` takes modules built elsewhere instead of `--src`; their
  vermagic must be the kernel's.
- `--firmware DIR` adds firmware files; `--option hello=debug=1` a modprobe
  options line; `--load` names the modules loaded at boot.
- A name is 1 to 32 lowercase letters, digits and hyphens; at most 64 modules
  and 256 firmware files.

> status: shipped — evidence: `mica-build:src/drivers/driver-ext.ts`

## 5. Install it

**In the console:** System, Drivers, upload `ext.micaupd`, give the password.

**With the API:**

```sh
curl -s -H "$AUTH" -X POST $DEV/api/v1/system/extensions \
  -F password="$ADMIN_PASSWORD" -F archive=@$HOME/hello-ext/ext.micaupd
# 202 {"taskId":"<id>"}
```

It installs **on trial from the next boot**. Reboot. At that boot the runkit
seals the owner keyring, then maps the extension; the kernel checks its
signature. If the boot reaches healthy, the change is kept; if not, the trial
is retried and then dropped, and the device boots without it.

**Check it worked:**

```sh
curl -s -H "$AUTH" $DEV/api/v1/system/extensions | jq '{installed, pending, boot}'
```

On the device as root:

```sh
cat /run/mica/extensions.json       # hello: "mapped"
grep hello /proc/modules
dmesg | grep 'hello: loaded'
```

> status: shipped — evidence: `mica-core:docs/mica-core.md`, `mica-core:crates/mica-apid/openapi.json`

## 6. Kernel updates wait for your extension

A system update whose kernel is not the running one needs a build of every
installed extension for the new kernel. Until it has one:

- `GET /api/v1/system/extensions` lists it in `waitsForExtension`
  (`[{name, kernel}]`), and the console's Drivers tab shows it;
- an automatic update is deferred (`waits-for-extension`); a manual install
  is refused with an error beginning `waitsForExtension:`.

Then either build the extension again for the new kernel (sections 3 and 4,
with the new release's KDK and the `kernel` id from `waitsForExtension`) and
upload it as in section 5, where it is staged for that update; or let the
update run without it:

```sh
curl -s -H "$AUTH" -X POST $DEV/api/v1/system/extensions/hello/drop \
  -H 'content-type: application/json' \
  -d "{\"password\": \"$ADMIN_PASSWORD\", \"kernel\": \"<new kernel id>\"}"
```

The running kernel's build stays for a rollback.

> status: shipped — evidence: `mica-core:docs/mica-core.md`

## 7. Remove

```sh
curl -s -H "$AUTH" -X DELETE $DEV/api/v1/system/extensions/hello \
  -H 'content-type: application/json' -d "{\"password\": \"$ADMIN_PASSWORD\"}"
curl -s -H "$AUTH" -X DELETE $DEV/api/v1/system/owner-certs/<sha256> \
  -H 'content-type: application/json' -d "{\"password\": \"$ADMIN_PASSWORD\"}"
```

Both apply from the next boot; this boot's keyring keeps the certificate. A
factory reset removes every owner certificate and extension, and a factory
reset boot loads none. Every enrolment and removal is recorded on the device
(the last 64) and in the audit ring.

> status: shipped — evidence: `mica-core:docs/mica-core.md`

## 8. What can go wrong

| You see | Why | Fix |
|---|---|---|
| 403 `password_incorrect` | the administrator password is wrong | retry; failures back off (429 `login_throttled`) |
| 409 `not_claimed` | the device is not claimed | claim it first |
| Certificate `rejected` with a `reason` | not a v3 certificate, a weak key, or outside its validity period | a certificate from `driver-key init` |
| Certificate stays `pending-confirmation` | nobody pressed Enter on the device's console in time | reboot and confirm at the console |
| Extension `refused` in `/run/mica/extensions.json` | the signature does not chain to an enrolled certificate, or the certificate is not loaded | enrol the CA (section 2), check its state, reboot |
| Extension `unused` | built for another kernel (id, release or architecture) | rebuild with the running kernel's KDK and id |
| `driver-ext: the kernel id is the kernel component's 64-digit hex id` | a wrong `--kernel-id` | the `kernel` from `GET /api/v1/system/extensions` |
| `driver-ext: <module> is not a module of this extension (...)` | `--load` or `--option` names a module the build did not make | the module's file name without `.ko`, `-` as `_` |
| An update stays deferred | `waits-for-extension` | section 6 |

> status: shipped — evidence: `mica-core:docs/mica-core.md`, `mica-build:src/drivers/driver-ext.ts`
