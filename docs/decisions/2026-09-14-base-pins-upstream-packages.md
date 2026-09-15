# mica-system-base pins the shared upstream Debian packages

- **date**: 2026-09-14
- **kind**: engineering decision
- **owner**: the mica-system-base owner; boards and products as consumers
- **review sunset**: 2027-03-14
- **status**: accepted (user, 2026-09-14); first published in `mica-system-base` `20260914-0742` (deleted); current Base `20260915-0209`, where the pins are the `upstream` rows of `mica-system-base.lock`; the consumption rules are `mica-system-base:README.md` *Consuming a release*

## Decision

The upstream Debian packages that boards and products install are generic
Debian packages, and `mica-system-base` pins them. Base never installs them
into its rootfs. It publishes them in the release asset
`system-base-packages.lock`, one tab-separated row per package and
architecture: package, architecture, version, sha256, snapshot URL, and
(from `20260914-1148`) roots, the `upstream.pkgs` roots the package is pinned
for, so a consumer installs the closure of the roots it needs.

Boards and products only install and enable the packages the lock lists.
They reuse its pinned addresses and never pin a listed package themselves.
A package the lock lacks is resolved by the consumer from Base's
`system-base.sources` alone, against the root's dpkg status, and recorded and
tested in the consumer's own repository; a package many stages need is
proposed for Base's `upstream.pkgs`. The rules, including system IDs Base does
not pin, are in `mica-system-base:README.md`, section *Consuming a release*
(user instruction, 2026-09-14); this record does not restate them.

Base also pins and seeds, into every root, the system groups those packages
need: `bluetooth` (gid 989) and `netdev` (gid 988), in `ids.json`.

A consumer commits `system-base.lock`, `system-base-packages.lock` and
`system-base.sources` unchanged at its repository root, verified against the
release's `SHA256SUMS`, together with a record of the release tag and the
sha256 of that `SHA256SUMS`; `SHA256SUMS` itself is not committed (user,
2026-09-14). Moving to another Base release replaces all of them.

The first release carrying the package lock is `20260914-0742` (target
`de95269640799e54aeb50f535cd375cbca2a25e5`). Its assets are `SHA256SUMS`
(trust hash `fc2b0dbe441b30883cc5a390fb149d142f59c5465cbbde2f34883b1629e46d96`),
`system-base.lock` and `system-base-packages.lock`. The package lock holds 21
packages for both amd64 and arm64, all from snapshot `20260905T000000Z`:
`libatomic1`, `libglib2.0-0t64`, `libjson-c5`, `libsubid5`, `bluez`,
`hostapd`, `iw`, `libasound2t64`, `libasound2-data`, `libdw1t64`,
`libnl-route-3-200`, `libpcsclite1`, `libreadline8t64`, `readline-common`,
`rfkill`, `wpasupplicant`, `alsa-utils`, `libatopology2t64`, `libgomp1`,
`libfftw3-single3`, `libsamplerate0`.

Later releases:

- `20260914-0809` (target `cf7096b2d613`): the same three assets, with
  `iproute2`, `libbpf1` and `libcap2-bin` added to the package lock (24
  packages) for a request that was then withdrawn.
- `20260914-0829` (target `bb0f475faecc`): `SHA256SUMS`
  (trust hash `595daa91b5e2bba310dfa5447b2d65769640da77ab2cb2be2cf037a4512f624e`),
  `system-base.lock`, `system-base-packages.lock` (the 21 packages again, the
  three from `0809` dropped) and, new, `system-base.sources`: the lock's Debian
  archive as an apt deb822 source (snapshot.debian.org `20260905T000000Z`,
  `trixie` `main`, `Check-Valid-Until: no`, signed by the Debian archive
  keyring).
- `20260914-0909`: cut automatically by a workflow that was then reversed,
  and deleted on the user's instruction; it is not a Base release to consume.
- `20260914-1148` (target `eb293178d892`, built on `mica-build-env`
  `20260914-1129`), the last Base in this form: the same four assets (trust hash
  `574485b25f6ccb1e852b875ff08b811e9c708a8329bf29654d090f2eb9896258`); the
  package lock, still 21 packages, gains its sixth column, roots.

On 2026-09-15, on the user's instruction, every release above and its tag was
deleted, and `mica-system-base` was reset to one root commit (now `4d63430`);
the targets above are pre-reset history. Since `20260915-0059` (deleted too;
the current Base is `20260915-1102`) the policy is published in the one
release lock (`docs/design/release-lock.md` section 3): the pinned packages
are its `upstream` rows with their roots (42 rows in `20260915-0209` and, unchanged, in `20260915-1102`), and
the Debian archive is its `apt` row.

This supersedes the answer recorded earlier on 2026-09-14 to question Q2 of
`20260914-0558-mica-build-released-inputs` (option a: `mica-build` keeps its
own consumer lock).

## Rationale

The same Debian package would otherwise be pinned in several places, and each
consumer would need its own snapshot lookup, sha256 verification and
group-id allocation. One pin at the Base keeps one version per release for
every board and product and one owner for adding a package. The groups
belong in every root so a package that needs them works wherever a board or
product installs it.

## Removal condition

Revisited if a board or product needs a package that cannot come from the
Base's Debian snapshot.
