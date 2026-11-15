# Compute Engine

How to run Mica OS on Google Compute Engine, from the release files to a
claimed instance you update like any other device: import the image into your
own project with `gce-import.sh` (or start from the public test image
family), create a Shielded VM, log in with your metadata keys, claim it, and
update it. The product is `uefi-x64.gcp`
([uefi-x64](../hardware/uefi-x64.md)).

## Before you start

- **A Google Cloud project** with Compute Engine on, a Cloud Storage bucket in
  it, and `gcloud` logged in with that project set.
- **What the product is:** Docker, OpenSSH on from the first boot with keys
  only, the Compute Engine agent for metadata logins, no MQTT, no mDNS or
  SSDP. DATA grows to the boot disk at every boot. It needs a Shielded VM with
  gVNIC.
- **Claiming asks for the device code**, which on this product is random and
  read on the instance (section 4).

> status: board-dependent — evidence: `mica-build:boards/uefi-x64/products/gcp/product.env`, `mica-build:boards/uefi-x64/README.md`

## 1. Get the image

**From a release (your own project).** Each `uefi-x64.gcp.<stamp>` release of
[mica-build](https://github.com/micaoss/mica-build/releases) carries, besides
the disk image and the update archive:

| File | What |
|---|---|
| `mica-uefi-x64.gcp-<stamp>.gce.tar.gz` | the disk packed for import |
| `mica-uefi-x64.gcp-<stamp>.db.der` | the certificate Mica's boot loader and kernel are signed with |

Check both against the release's `SHA256SUMS` ([download](../start/download.md)),
then, with `gce-import.sh` from the same mica-build tag:

```sh
GCE_LOCATION=europe-west4 \
  bash boards/uefi-x64/gce/gce-import.sh \
  mica-uefi-x64.gcp-20261115-1652.gce.tar.gz \
  mica-uefi-x64.gcp-20261115-1652.db.der \
  my-bucket/mica
# image mica-uefi-x64-gcp-20261115-1652 created from gs://my-bucket/mica/...
```

It uploads the archive and creates the image with UEFI, gVNIC and multi-queue
SCSI, and with `db.der` as the Secure Boot platform key, key exchange key and
signature database: no Microsoft keys, so the firmware boots Mica's signed
binaries and nothing else. The image name defaults to the archive's, in lower
case with dashes; `--family F` puts it in an image family of yours,
`--labels K=V` adds labels.

**The public test image family.** Project `micaos` publishes test builds as
the family `mica-uefi-x64-gcp-test`. They are test images, not releases: use
them to try the product, not for anything you keep.

> status: board-dependent — evidence: `mica-build:boards/uefi-x64/gce/gce-import.sh`, `mica-build:boards/uefi-x64/gce/publish.sh`

## 2. Create a Shielded VM

```sh
gcloud compute instances create mica-1 \
  --zone europe-west4-a --machine-type e2-small \
  --image mica-uefi-x64-gcp-20261115-1652 \
  --shielded-secure-boot --shielded-vtpm --shielded-integrity-monitoring
```

From the test family instead:

```sh
gcloud compute instances create mica-test-1 \
  --zone europe-west4-a --machine-type e2-small \
  --image-family mica-uefi-x64-gcp-test --image-project micaos \
  --shielded-secure-boot --shielded-vtpm --shielded-integrity-monitoring
```

Secure Boot is what makes `db.der` count: the firmware refuses a boot loader
not signed with it. A bigger boot disk (`--boot-disk-size`) becomes DATA's
space at the first boot; growing the disk later grows DATA at the next boot.

**Check it worked:** the serial console shows the boot
(`gcloud compute instances get-serial-port-output mica-1 --zone europe-west4-a`),
and the instance answers SSH within a minute or two.

> status: board-dependent — evidence: `mica-build:boards/uefi-x64/gce/gce-import.sh`, `mica-build:boards/uefi-x64/README.md`

## 3. Log in

```sh
gcloud compute ssh mica-1 --zone europe-west4-a
```

`gcloud` puts your key in the instance's (or project's) `ssh-keys` metadata;
the image's agent makes you an account with that key and adds you to
`mica-admins`, the cloud administrators, who are root through `sudo` while
`access.cloudAdmins.enabled` is on (the product's default). Every user named
in the metadata gets the same. To keep only keys you add yourself, see
[SSH](../operate/ssh.md) section 5.

```sh
sudo mica status
```

> status: shipped — evidence: `mica-pkgs:docs/mica-pkgs.md`, `mica-core:crates/micad/src/reconciler/admins.rs`

## 4. Claim it

Until it is claimed, an instance has no administrator password. Either:

**From the shell** (no device code needed, since you are already root):

```sh
sudo mica setup
# Administrator password: (twice)
# the device is set up
```

**Or in the console,** through an SSH tunnel, with the device code:

```sh
gcloud compute ssh mica-1 --zone europe-west4-a -- -L 8080:localhost:8080
sudo mica internal device-code        # in that session: the code the first page asks for
```

then open `http://localhost:8080` on your workstation and set the password.
The console is never on the instance's public address unless you open a
firewall rule for it; the tunnel is the way in.

**Check it worked:** through the tunnel, the console shows its login page
instead of the first-run page, and takes the password.

> status: shipped — evidence: `mica-core:crates/micad/src/cli/account.rs`, `mica-core:crates/micad/src/device_code.rs`, `docs/start/first-run.md`

## 5. Update an instance

An instance updates itself like any device, in place, A/B, with a rollback;
you do not import a new image for it:

```sh
sudo mica update check
# available: system <version>
sudo mica update install --reboot
# checking...
# downloading...
# installing...
# installed; rebooting
```

After the reboot `sudo mica update` shows `validating`, then `succeeded`.
Automatic updates and maintenance windows are the console's System, Updates
page ([updates](../operate/updates.md)). A new image from `gce-import.sh` is
for new instances.

> status: shipped — evidence: `docs/operate/updates.md`

## 6. What can go wrong

| You see | Why | Fix |
|---|---|---|
| `error: ... is not a gce image kind (*.gce.tar.gz)` | the `.img.gz` was given | the `.gce.tar.gz` |
| `error: gcloud is not installed` | no gcloud on the machine | install the Google Cloud CLI |
| The instance does not boot | Secure Boot on an image imported without `db.der`, or another certificate | import again with the release's `db.der` |
| `gcloud compute ssh` is refused | the metadata key was not picked up yet, or OS Login is enforced on the project | wait a minute; turn OS Login off for the instance (`enable-oslogin=FALSE` metadata) |
| `sudo` asks for a password | cloud administrators are off | [SSH](../operate/ssh.md) section 5 |
| The console asks for a device code you do not have | claim from the shell | `sudo mica setup`, or `sudo mica internal device-code` |
| No `mica-*.local` name | the product announces nothing on purpose | use the instance's address or name in Compute Engine |

> status: board-dependent — evidence: `mica-build:boards/uefi-x64/gce/gce-import.sh`, `mica-pkgs:docs/mica-pkgs.md`
