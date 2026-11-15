# SSH

How to get a root shell on a device over SSH: switch the server on, add your
key, log in, use the one-boot root password when you have no key, sign in on
a Compute Engine instance with its metadata keys, and close it all again. The
rules are in [access](../reference/access.md), the setting in
[settings](../reference/settings.md).

## Before you start

- **A claimed device** and its console at `http://<device>:8080`, or `mica`
  on the device as root, or the API with a token:

  ```sh
  DEV=http://mica-a4e2e69e.local:8080
  AUTH="Authorization: Bearer mica_<id>_<secret>"   # from: mica tokens create laptop
  ```

- **A key pair on your workstation.** Make one if you have none:

  ```sh
  ssh-keygen -t ed25519 -C me@laptop      # writes ~/.ssh/id_ed25519 and id_ed25519.pub
  ```

- **What the product starts with.** Every released product ships with no
  authorized key and no account that takes a password. SSH is off until you
  turn it on, except on `uefi-x64.gcp`, where it runs from the first boot and
  takes the instance's metadata keys (section 5).

| Products | SSH server |
|---|---|
| `cx3576.full`, `uefi-x64.gcp` | OpenSSH |
| `uefi-x64.full`, `uefi-x64.docker`, `s905x5m.sd-full`, `s905x5m.emmc-full`, `mini-x64.basic`, `qemu-armhf.basic` | Dropbear |

Both run as the service `mica-sshd`, read the same settings and behave the
same from here on.

> status: shipped — evidence: `mica-core:docs/mica-core.md`, `mica-build:boards/uefi-x64/products/gcp/product.env`, `mica-build:boards/cx3576/products/full/product.env`

## 1. Add your key and switch SSH on

**In the console**: Access, add the public key (the one line of
`~/.ssh/id_ed25519.pub`), then switch SSH on.

**With the API**, from the workstation:

```sh
curl -s -H "$AUTH" -X POST $DEV/api/v1/ssh/authorized-keys \
  -H 'content-type: application/json' \
  -d "{\"key\": \"$(cat ~/.ssh/id_ed25519.pub)\"}"
# 201 {"key":{"key":"ssh-ed25519 AAAA...","comment":"me@laptop","fingerprint":"SHA256:..."},
#      "notice":"Every authorized key is a root key."}
curl -s -H "$AUTH" -X PUT $DEV/api/v1/settings/access.ssh.enabled \
  -H 'content-type: application/json' -d 'true'
# {"taskId":"<id>"}
```

**On the device as root** (for example on the local console), with the key
file copied over or pasted on standard input:

```sh
mica ssh keys add - <<'EOF'
ssh-ed25519 AAAA... me@laptop
EOF
# added SHA256:...
mica ssh on
# access.ssh.enabled is true
```

`mica ssh keys add` takes one key per file; comment lines and blank lines are
skipped.

> status: shipped — evidence: `mica-core:crates/mica-apid/src/routes/ssh.rs`, `mica-core:crates/micad/src/cli/account.rs`

## 2. Log in and check it worked

```sh
ssh root@mica-a4e2e69e.local
```

On the device:

```sh
mica ssh status
# enabled: true
mica ssh keys list
# SHA256:... ssh-ed25519 me@laptop
```

**Which accounts.** There is one key list, and it is written for both
accounts: `root`, and `mica`, the operator account with its own home and a
non-root shell. Every key you add opens both, so **every authorized key is a
root key**; there is no key with less access. The port is 22.

> status: shipped — evidence: `mica-core:crates/micad/src/reconciler/sshd.rs`

## 3. No key? The one-boot root password

For someone in front of a device who has no key installed: a root password
that works for SSH and the local consoles (the serial console, `tty2` on a
display) and is gone at the next boot. It is stored in no setting.

```sh
mica root-password            # asked twice, echo off
# the transient root password is set until the next boot
```

Or through the API (8 to 72 bytes):

```sh
curl -s -H "$AUTH" -X POST $DEV/api/v1/actions/transient-root-password \
  -H 'content-type: application/json' -d '{"password": "..."}'
# {"taskId":"<id>"}
```

SSH offers password logins only while such a password is set. Use the
session to add your key (section 1), then reboot to clear the password.

> status: shipped — evidence: `mica-core:crates/micad/src/transient.rs`, `mica-core:crates/micad/src/cli/account.rs`

## 4. Remove a key

```sh
mica ssh keys list
mica ssh keys remove SHA256:...
# removed SHA256:...
```

Through the API the fingerprint is the path segment; it can contain `/`, so
percent-encode it:

```sh
curl -s -H "$AUTH" -X DELETE \
  "$DEV/api/v1/ssh/authorized-keys/$(python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1],safe=""))' 'SHA256:...')"
# 204
```

> status: shipped — evidence: `mica-core:crates/mica-apid/src/routes/ssh.rs`

## 5. Compute Engine: metadata logins and cloud administrators

On `uefi-x64.gcp` SSH is on from the first boot with keys only, and you log
in the way Compute Engine does it everywhere:

```sh
gcloud compute ssh <vm>
```

The image's Compute Engine agent makes an account for each user the
instance's `ssh-keys` metadata names and puts it in the group `mica-admins`.
While `access.cloudAdmins.enabled` is on (the product's default there), micad
renders the sudo rule `%mica-admins ALL=(ALL:ALL) NOPASSWD: ALL`, so those
users are root through `sudo`:

```sh
sudo mica status
```

**Switch it off** when you want only the keys you added yourself:

```sh
sudo mica set access.cloudAdmins.enabled false
```

or in the console's Access page. Off removes the rule at once: the accounts
stay, membership grants nothing, and a shell that is already root stays root
until it ends. `GET /api/v1/state/cloudAdmins` answers
`{enabled, source, productDefault}`. Claiming an instance is
[first run](../start/first-run.md) section 6.

> status: shipped — evidence: `mica-core:crates/micad/src/reconciler/admins.rs`, `mica-core:docs/mica-core.md`, `mica-build:boards/uefi-x64/products/gcp/product.env`

## 6. Lock it down

| To | Do |
|---|---|
| Stop SSH | `mica ssh off`, or the console's Access switch; reversible |
| Drop a key that should not be there | `mica ssh keys list`, then `mica ssh keys remove <fingerprint>` |
| Drop a forgotten root password | reboot |
| Stop cloud administrators (gcp) | `mica set access.cloudAdmins.enabled false` |
| Keep the API off the network as well | `mica web local` ([configuration](configuration.md)) |

The port, the listen addresses (at most 10), root login and password logins
are the other keys of `access.ssh`. No API route writes them; they are set in
the configuration document `/mica/config/ssh.json`, prepared while the device
is stopped ([settings](../reference/settings.md)). With
`permitRootLogin` false, root is refused by every method.

The server's settings are on DATA and read by the init at boot, so SSH
starts before micad and keeps working without it.

> status: shipped — evidence: `mica-core:crates/micad/src/reconciler/sshd.rs`, `mica-core:crates/mica-apid/src/routes/settings.rs`

## 7. What can go wrong

| You see | Why | Fix |
|---|---|---|
| `Permission denied (publickey)` | the key is not on the device, or SSH is using another key | `mica ssh keys list` on the device; `ssh -i ~/.ssh/id_ed25519 root@...` |
| `Connection refused` | SSH is off | `mica ssh on`, or the console |
| 409 `key_exists` | that public key is already authorized | nothing to do |
| 409 `key_limit_reached` | the device holds the most keys it takes | remove one first |
| 422 `validation_failed` on add | the line is not `<type> <base64> [comment]`, e.g. a private key or two lines | paste the `.pub` line |
| `mica ssh: <file> holds 2 keys; add one at a time` | more than one key in the file | one file per key |
| 404 `settings_not_found` on remove | no key has that fingerprint | copy it from the list |
| 422 `validation_failed` on remove | not a fingerprint at all (`/` not percent-encoded, or a missing `SHA256:`) | encode it as in section 4 |
| The root password stops working | the device rebooted | set it again, or use a key |
| `sudo` asks for a password on gcp | cloud administrators are off | switch them on from another root session, or use a key you added |

Lost everything (password, tokens, keys): [access](../reference/access.md)
section 7 and [recovery](recovery.md). The error format is in
[errors](../reference/errors.md).

> status: shipped — evidence: `mica-core:crates/mica-apid/src/routes/ssh.rs`, `mica-core:crates/micad/src/cli/account.rs`
