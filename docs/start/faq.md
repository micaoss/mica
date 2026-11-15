# Questions people ask first

Short answers, each pointing to the page that holds the whole of it. Where a
page and this one disagree, the page is right.

## Getting started

**Which image do I take?** The newest release of your product,
`<board>.<variant>`. The products, what each carries and the current stamps
are on [download](download.md); the variant names what the product is for,
so read the table rather than the name.

**Can I try it without hardware?** Yes: `uefi-x64` under QEMU is the
baseline every release boots ([quickstart](quickstart.md)).

**How do I find the device on my network?** Open
`http://mica-xxxxxxxx.local:8080`: the hostname is `mica-` and eight hex
characters, and the device announces it over mDNS. Otherwise take its
address from your DHCP server. A product with Wi-Fi also has a factory access
point, `http://192.168.4.1:8080` once you join it with the key on the label
([first run](first-run.md) section 2).

**What is the default password?** There is none. The first visitor to the
console sets the administrator password, which claims the device, so claim a
new device promptly on a network you control. `root` and `mica` have no
password; the shadow file locks them again at every boot
([first run](first-run.md) section 4, [access](../reference/access.md)).

**How do I get a shell?** SSH is off until an administrator turns it on and
adds a key, on the console's access page; every authorized key is a root key.
At a serial or display console, log in as root with a transient root
password an administrator set, valid until the next boot. `uefi-x64.gcp` runs
SSH from the first boot with the logins in the instance's metadata
([first run](first-run.md) section 6).

**What do I type once I am root?** [`mica`](../operate/mica.md):
`mica status`, `mica update`, `mica set`, `mica container`, `mica unit` and
the rest ([reference](../reference/cli.md)). A device on a release of
2026-11-14 or earlier has no `mica` command; update it first.

## Configuring

**Why does my change under `/etc` disappear?** The root filesystem is
read-only and verified. Settings live in micad's settings tree on DATA and
change through the console, the API or `mica set`; an unmodelled setting is
not supported ([configuration](../operate/configuration.md) section 4).

**Where do my own files go?** `/srv` (or a disk of your own mounted there),
`/home` and `/root`, all on DATA, all surviving updates
([storage](../operate/storage.md)).

**Can I install a package?** There is no `apt` on the device. Run your
software as containers, as a service of your own on DATA (`mica unit`), or
build it into the image as a native package
([applications](../integrate/applications.md)).

**How do I set a static address, Wi-Fi or a VPN?** On the console's network
pages or through the API: interfaces, routes, DNS, WireGuard and the Wi-Fi
station. `mica wifi` adds a network on the device
([configuration](../operate/configuration.md) section 3).

**Why is the clock in UTC?** It always is. The time zone is for display and
never changes `/etc/localtime` ([configuration](../operate/configuration.md)
section 5.1).

## Updating

**How do I update?** `mica update install --reboot`, the console's System
page, or an offline `.micaupd` uploaded, imported from a USB stick or with
`mica-deploy import` ([updates](../operate/updates.md)).

**What if an update does not boot?** The new system gets three attempts and
must pass the health gate; otherwise the device boots the previous one by
itself. You can also roll back by hand with `mica update rollback`
([recovery](../operate/recovery.md)).

**Does a rollback restore my data?** No. It changes which system boots;
configuration and data on DATA stay as they are
([updates](../operate/updates.md) section 6).

**Why was my update refused?** Each refusal has a fixed message and code:
another product, an older generation, a pending candidate, outside the
maintenance window and the rest are listed in [updates](../operate/updates.md)
section 7.

**What is a core set?** The management daemon and the console, released on
their own and taken without a new system image
([updates](../operate/updates.md) section 10).

## Recovering and security

**I lost the administrator password.** With an authorized SSH key, log in as
root and run `mica password set`. Without any key there is no software way
back in; reflash the whole disk, which gives the device a new identity
([recovery](../operate/recovery.md)).

**How do I erase a device?** A factory reset: the console's System page with
the administrator password, or `mica factory-reset` as root. It keeps the
running system and erases everything configured
([recovery](../operate/recovery.md) step 6).

**Is DATA encrypted?** Not on any released product. Only a test image for
Compute Engine encrypts it, and an encrypted DATA has no factory reset yet
(`data_encrypted`) ([security model](../security/model.md)).

**Is the key on the label a secret?** No. It is a first-contact credential
that anyone holding an image and the label can compute; set your own key on
the console's Wi-Fi page ([first run](first-run.md) section 2).

**Has this run on my board?** Each board page says what was verified and
how. No full update cycle on physical hardware is on record yet
([boards](../hardware/README.md)).

**What do I send with a bug report?** The support summary (the console's
Information page), and a diagnostic snapshot from the console or
`mica doctor` ([troubleshooting](../operate/troubleshooting.md),
[support](../releases/support.md)).
