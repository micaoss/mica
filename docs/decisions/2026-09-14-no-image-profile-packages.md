# There are no image profile packages

- **date**: 2026-09-14
- **kind**: engineering decision
- **owner**: the mica-system-base and mica-core owners; the command line parameter, the mica-build owner (writer) and the mica-core owner (reader)
- **review sunset**: 2027-03-14
- **status**: accepted (user, 2026-09-14); packages and reader removed; the `mica.profile` carrier decided, its writer implemented on `mica-build` branch `released-inputs` (`edafed96`, not merged), no reader yet; the allowed effects decided (user, 2026-09-14), none implemented yet

## Decision

`mica-profile-dev` and `mica-profile-prod` are removed from
`mica-system-base` (`f0d555f`, pre-reset history; its root `4d63430` has
neither), and no package ships
`/usr/lib/mica/profile.conf`. `micad` no longer reads that file, and
`micad.control` no longer depends on a profile package (`mica-core`
`758ba0f`).

### The dev/prod carrier (user, 2026-09-14)

Development and production images differ by the kernel command line
parameter `mica.profile=dev|prod`.

**Writer (`mica-build`).** The value comes from `PROFILE` in
`products/<name>/product.env` and is written explicitly for every image,
prod included. It is carried only in signed boot configuration: the signed
UKI `.cmdline` (and signed UKI profiles or add-ons), or the signed FIT
configuration's `bootargs`. Every command line variant of an image, recovery
and boot-counting entries included, carries exactly one identical token, and
each A/B slot carries its own signed value.

**Reader (`mica-core`).** Exactly one token `mica.profile=dev` means dev.
Anything else -- the parameter absent, `prod`, an empty value, another
spelling, or the token more than once -- means prod. The outcome is logged and
is never a reason to refuse boot. `micad` reads it once at start; it is not a
setting, is never persisted or seeded, and is shown read-only in
`system_info`.

**Limits.**

- Where a board does not enforce its command line (no Secure Boot, or an
  unsigned U-Boot environment), dev may only relax diagnostics or
  convenience, never security.
- The profile and `trust.grade` are independent: a prod image may ship with
  development-grade signing keys.
- No difference between dev and prod exists today. The allowed effects are
  listed below; `mica-core` implements none beyond them.

### How mica-build writes it (2026-09-14)

Implemented on `mica-build` branch `released-inputs` at `edafed96`, not
merged or pushed. The kernel component writes `mica.profile=dev|prod` from
`products/<name>/product.env` `PROFILE` for both profiles, and
`release-identity.env` derives its `PROFILE` from the same file.

- **UEFI boards** (x64, virt-arm64): the token is in the UKI's signed
  `.cmdline`. Boot-counting entries share that UKI, systemd-boot entries
  carry no `options` line, and `loader.conf` sets `editor no`.
- **FIT boards** (cx3576, s905x5m): the token is in the kernel's forced
  built-in `CONFIG_CMDLINE`, which `mica-boards` builds once per profile.
- A board command line that already names `mica.profile` or `mica.recovery`
  is refused.
- A recovery entry, when one is added, exists only as a signed UKI profile or
  add-on, or a signed FIT configuration, carrying the same token.

### Command line enforcement per board

- **x64 and virt-arm64** (systemd-boot and a signed UKI): enforced only when
  UEFI Secure Boot is on with the boot certificate enrolled; under Secure
  Boot, systemd-stub ignores options the loader supplies. The QEMU lab boards
  run without enforcement.
- **cx3576 and s905x5m** (U-Boot and FIT), as stated by `mica-boards`
  (`aa22e75`): the command line is enforced on the boot path. The U-Boot
  control DTB's FIT key has `required=conf`, `FIT_SIGNATURE` is on (cx3576's
  build also asserts `FIT_FULL_CHECK`), `LEGACY_IMAGE_FORMAT`, `CMD_BOOTI` and
  `USE_PREBOOT` are off, and the kernel forces its own line, so U-Boot
  environment `bootargs` are ignored. It is **not** enforced against access to
  the serial console: both U-Boots keep an interactive console
  (`BOOTDELAY=1`) with `fdt` and `md`/`mw` (and `go` on cx3576), one U-Boot
  serves both profiles, and the SoC boot ROM does not verify U-Boot. This is
  an accepted, known limit (user, 2026-09-14): there is no hardened prod
  U-Boot for now, and each FIT board keeps one U-Boot with its interactive
  console.
- Where enforcement is not established, dev may only relax diagnostics or
  convenience.

### Allowed effects (user, 2026-09-14)

Proposed by `mica-build` and confirmed by the user. The profile may change only:

1. reporting the profile in `system_info`;
2. diagnostic verbosity and log retention;
3. developer convenience that grants no access (boot banners, extra
   read-only diagnostics endpoints).

Never allowed for either profile: SSH or console access defaults, credentials or
passwords, the update channel, trust anchors or signature checks, network
exposure, and any state-changing `apid` endpoint.

## Rationale

The profile no longer changed any seeded value: every image seeds
`access.ssh.enabled = false` at first boot, on dev and prod alike. A package
whose only payload was a file nothing depends on is a second source of image
identity to keep consistent. The kernel command line is inside the signed
boot component on a board that enforces it, so the value there cannot be
edited on such a device; the fail-to-prod reader keeps every malformed or
missing value on the stricter side.

## Removal condition

Revisited when the list of allowed dev effects is written, or if an image
difference appears that the command line cannot carry.
