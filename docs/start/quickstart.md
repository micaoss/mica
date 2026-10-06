# Quickstart

The shortest honest path to a running Mica OS system is a published amd64
UEFI image under QEMU: about a minute, and no hardware. That is also the only
path that has been run: no physical machine has been booted from a release
image ([flashing](flashing.md)).

## 1. What you need

To run a published image: `curl`, `jq`, `sha256sum`, `gzip`, and
`qemu-system-x86_64` with OVMF firmware (`apt-get install qemu-system-x86
ovmf` on Debian or Ubuntu). To build one instead: docker with a working
daemon, plus bash, make, git and python3 — every compiler, filesystem maker
and signing tool runs inside the pinned build-env images.

> status: shipped — evidence: `mica-build:tests/suites/lifecycle-uefi/boot.sh`, `mica-build:Makefile`, `docs/start/build.md`

## 2. Take a published image

```sh
PRODUCT=mini-x64.basic        # any uefi-x64 or mini-x64 product that has a release
curl -fsS https://res.micaos.dev/update/products/v1.json -o products.json
BASE=$(jq -r .baseUrl products.json)
jq -r --arg p "$PRODUCT" '.products[] | select(.product == $p) | .latest.files[]
      | select(.kind == "image" and .form == "disk") | "\(.path) \(.sha256)"' products.json |
while read -r path sha256; do
  curl -fsSLO "$BASE$path"
  echo "$sha256  ${path##*/}" | sha256sum -c -
  gzip -dc "${path##*/}" > disk.img
done
truncate -s 4G disk.img                       # room for DATA to grow into
```

Which products have a release is on the
[download page](https://micaos.dev/download/); what else can be checked about
one is [download](download.md). The image is a whole GPT disk — ESP, SYSTEM
and DATA — carrying two signed deployments.

> status: shipped — evidence: `docs/start/download.md`, `mica-build:src/image/file-layout.ts`

## 3. Boot it under QEMU

```sh
cp /usr/share/OVMF/OVMF_VARS_4M.fd vars.fd
qemu-system-x86_64 -machine q35 -cpu max -m 1024 -smp 2 -nographic -no-reboot \
  -device i6300esb -watchdog-action reset \
  -netdev user,id=net0,hostfwd=tcp:127.0.0.1:8080-:8080 -device virtio-net-pci,netdev=net0 \
  -drive if=pflash,format=raw,unit=0,readonly=on,file=/usr/share/OVMF/OVMF_CODE_4M.secboot.fd \
  -drive if=pflash,format=raw,unit=1,file=vars.fd \
  -drive if=none,id=disk0,format=raw,file=disk.img \
  -device virtio-blk-pci,drive=disk0,bootindex=0
```

The serial console is on the terminal (`Ctrl-a x` leaves QEMU), and the
guest's management API is on `http://127.0.0.1:8080`. The boot is done when
the console prints

```
mica-health: booted slot <id> marked good (PENDING_CONFIRM -> CONFIRMED)
```

The watchdog device and the `secboot` firmware build are both required; the
plain copy of the variable store leaves Secure Boot off, which is enough to
look at the system. Secure Boot on, the arm64 line and what to do when it does
not come up are in [flashing](flashing.md) section 4.

> status: shipped — evidence: `mica-build:tests/suites/lifecycle-uefi/boot.sh`, `mica-build:make lifecycle-uefi`

## 4. Or build the image first

```sh
make locks-verify
make os-pool
make product PRODUCT=uefi-x64.dev
make product-verify PRODUCT=uefi-x64.dev
```

The result lands in `_out/products/uefi-x64.dev/` of the `mica-build` checkout. `uefi-x64.dev` is
the development variant, built locally and never released; `uefi-x64.basic`
builds the same way. A build never invents
keys or inputs: signing material is explicit (`make os-devkeys` writes a
development set) and every input comes from `locks/`. The full path, online
and offline, is the [build guide](build.md).

> status: shipped — evidence: `mica-build:Makefile`, `mica-build:src/product/build.ts`, `docs/start/build.md`

## 5. First contact

The first boot seeds a device identity on DATA, takes its hostname from that
identity alone (`mica-<first 8 hex>`, never from DHCP or a MAC), grows DATA to
the medium, and brings up micad and apid. SSH is off whatever the image, and
no credential exists yet: the device is **unclaimed**.

Claim it on the first page of the web console, at `http://127.0.0.1:8080/`,
or where the product carries no console (`mini-x64.basic`) over the API:

```sh
curl http://127.0.0.1:8080/api/v1/session        # {"state":"setup"}
curl -X POST -H 'content-type: application/json' \
  -d '{"password":"at-least-eight-bytes"}' http://127.0.0.1:8080/api/v1/setup
```

It answers `201` with a browser session, and `409 already_configured` on a
device that is already claimed. A device with no
network at all is claimed by a `mica-provisioning.toml` document instead; see
[first run](first-run.md) and [configuration](../operate/configuration.md).

> status: shipped — evidence: `mica-core:crates/micad/src/provisioning.rs`, `mica-core:crates/mica-apid`, `docs/integrate/provisioning.md`

## 6. Next steps

- [Flashing](flashing.md) — writing an image to a board, per board.
- [Updates and rollback](../operate/updates.md) — moving a running device forward.
- [Applications](../integrate/applications.md) — workloads and persistent data.

> status: shipped — evidence: `docs/start/flashing.md`, `docs/operate/updates.md`, `docs/integrate/applications.md`
